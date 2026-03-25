/* ── Anthropic API Client ── */

const AI = {
  MODEL: 'claude-haiku-4-5-20251001',
  DIRECT_URL: 'https://api.anthropic.com/v1/messages',

  get API_URL() {
    let proxy = Storage.getProxyUrl();
    if (!proxy) return this.DIRECT_URL;
    // Normalize — add https:// if bare domain was entered
    if (!/^https?:\/\//i.test(proxy)) proxy = 'https://' + proxy;
    return proxy.replace(/\/$/, '') + '/v1/messages';
  },

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

  // Attempt to fix common Claude JSON mistakes before giving up
  _repairJSON(raw) {
    let t = raw;

    // Strip markdown fences if any remain
    t = t.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();

    // Fix 1: missing comma between adjacent string items in arrays
    // e.g.  "value one"\n  "value two"  →  "value one",\n  "value two"
    t = t.replace(/"(\s*\n\s*)"/g, '",\n"');

    // Fix 2: missing comma between object/array items on separate lines
    // e.g.  }\n  {  or  ]\n  [  or  "val"\n  "key":
    t = t.replace(/([}\]"0-9])\s*\n(\s*[{["a-zA-Z_])/g, (m, a, b) => {
      // Already has comma? skip
      return `${a},\n${b}`;
    });

    // Fix 3: remove duplicate commas introduced above
    t = t.replace(/,(\s*,)+/g, ',');

    // Fix 4: trailing commas before closing bracket
    t = t.replace(/,(\s*[}\]])/g, '$1');

    // Fix 5: close unclosed brackets caused by truncation
    // Strip any trailing incomplete token (partial string or hanging comma)
    t = t.replace(/,?\s*$/, '');
    const opens  = (t.match(/\{/g) || []).length;
    const closes = (t.match(/\}/g) || []).length;
    const aOpens = (t.match(/\[/g) || []).length;
    const aClose = (t.match(/\]/g) || []).length;
    for (let i = 0; i < aOpens - aClose; i++) t += ']';
    for (let i = 0; i < opens  - closes;  i++) t += '}';

    return t;
  },

  async callJSON(systemPrompt, userContent, maxTokens = 4096) {
    const text = await this.call(systemPrompt, userContent, maxTokens);

    const tryParse = (s) => { try { return JSON.parse(s); } catch { return null; } };

    // Strategy 1: fenced ```json block
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      const r = tryParse(fenced[1].trim()) ?? tryParse(this._repairJSON(fenced[1].trim()));
      if (r) return r;
    }

    // Strategy 2: raw text
    const r2 = tryParse(text.trim()) ?? tryParse(this._repairJSON(text.trim()));
    if (r2) return r2;

    // Strategy 3: outermost { ... } block
    const start = text.indexOf('{');
    const end   = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const slice = text.slice(start, end + 1);
      const r3 = tryParse(slice) ?? tryParse(this._repairJSON(slice));
      if (r3) return r3;
    }

    // Strategy 4: repair the full raw text (handles truncation)
    const r4 = tryParse(this._repairJSON(text));
    if (r4) return r4;

    console.error('[PrepMe] Raw AI response that failed JSON parse:\n', text);
    throw new Error('AI returned malformed JSON. Raw response logged to console.');
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
      if (res.status === 405) return { ok: false, error: 'Proxy returned 405 — wrong URL or method blocked. Visit your proxy URL in a browser to check it is alive.' };
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
