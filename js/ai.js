/* ── Anthropic API Client ── */

const AI = {
  MODEL: 'claude-haiku-4-5-20251001',
  API_URL: 'https://api.anthropic.com/v1/messages',

  // Pricing per token (Claude Haiku 4.5 approximate)
  PRICE_INPUT:  0.80 / 1_000_000,
  PRICE_OUTPUT: 4.00 / 1_000_000,

  // Session usage accumulator
  session: { inputTokens: 0, outputTokens: 0 },

  resetSession() {
    this.session = { inputTokens: 0, outputTokens: 0 };
    this._updateUsageBar();
  },

  trackUsage(usage) {
    if (!usage) return;
    this.session.inputTokens  += usage.input_tokens  || 0;
    this.session.outputTokens += usage.output_tokens || 0;
    this._updateUsageBar();
  },

  getCost() {
    const cost = (this.session.inputTokens * this.PRICE_INPUT) +
                 (this.session.outputTokens * this.PRICE_OUTPUT);
    return {
      inputTokens:  this.session.inputTokens,
      outputTokens: this.session.outputTokens,
      totalTokens:  this.session.inputTokens + this.session.outputTokens,
      costUSD:      cost,
    };
  },

  _updateUsageBar() {
    const el = document.getElementById('token-bar');
    if (!el) return;
    const c = this.getCost();
    el.innerHTML = `
      <span class="tbar-item"><span class="tbar-label">In</span>${c.inputTokens.toLocaleString()}</span>
      <span class="tbar-sep">·</span>
      <span class="tbar-item"><span class="tbar-label">Out</span>${c.outputTokens.toLocaleString()}</span>
      <span class="tbar-sep">·</span>
      <span class="tbar-item tbar-cost">$${c.costUSD.toFixed(4)}</span>
    `;
    el.classList.remove('hidden');
  },

  // Estimate tokens from raw text (~4 chars per token)
  estimateTokens(text) {
    return Math.ceil((text || '').length / 4);
  },

  _headers() {
    return {
      'Content-Type': 'application/json',
      'x-api-key': Storage.getApiKey(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-allow-browser': 'true',
    };
  },

  async call(systemPrompt, userContent, maxTokens = 4096) {
    const key = Storage.getApiKey();
    if (!key) throw new Error('No API key set.');

    let res;
    try {
      res = await fetch(this.API_URL, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({
          model: this.MODEL,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        }),
      });
    } catch (err) {
      // Network-level failure (CORS, DNS, offline)
      console.error('[PrepMe] fetch to Anthropic failed:', err);
      throw new Error(
        'Cannot reach Anthropic API. This is usually a network or CORS issue. ' +
        'Open DevTools → Console for details.'
      );
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    this.trackUsage(data.usage);
    return data.content[0].text;
  },

  async callJSON(systemPrompt, userContent, maxTokens = 4096) {
    const text = await this.call(systemPrompt, userContent, maxTokens);
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = match ? match[1] : text;
    try {
      return JSON.parse(jsonStr.trim());
    } catch {
      throw new Error('AI returned malformed JSON. Please try again.');
    }
  },

  // Ping test — checks API key validity without wasting tokens
  async ping() {
    const key = Storage.getApiKey();
    if (!key) return { ok: false, error: 'No API key.' };
    try {
      const res = await fetch(this.API_URL, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({
          model: this.MODEL,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      if (res.status === 401) return { ok: false, error: 'Invalid API key.' };
      if (res.status === 403) return { ok: false, error: 'API key lacks permissions.' };
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        return { ok: false, error: b?.error?.message || `Error ${res.status}` };
      }
      const data = await res.json();
      this.trackUsage(data.usage);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: 'Network error — cannot reach Anthropic. Check console.' };
    }
  },

  // Streaming for mock interview
  async stream(systemPrompt, messages, onChunk) {
    const key = Storage.getApiKey();
    if (!key) throw new Error('No API key set.');

    let res;
    try {
      res = await fetch(this.API_URL, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({
          model: this.MODEL,
          max_tokens: 1024,
          stream: true,
          system: systemPrompt,
          messages,
        }),
      });
    } catch (err) {
      throw new Error('Cannot reach Anthropic API. Check your connection.');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `API error ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let inputTokens = 0, outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
      for (const line of lines) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.type === 'content_block_delta' && json.delta?.text) {
            fullText += json.delta.text;
            onChunk(json.delta.text, fullText);
          }
          if (json.type === 'message_delta' && json.usage) {
            outputTokens = json.usage.output_tokens || 0;
          }
          if (json.type === 'message_start' && json.message?.usage) {
            inputTokens = json.message.usage.input_tokens || 0;
          }
        } catch { /* skip malformed SSE lines */ }
      }
    }

    this.trackUsage({ input_tokens: inputTokens, output_tokens: outputTokens });
    return fullText;
  },
};
