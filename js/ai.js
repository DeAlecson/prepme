/* ── Anthropic API Client (via Cloudflare Worker proxy) ── */

const AI = {
  MODEL:      'claude-haiku-4-5-20251001',
  WORKER_URL: 'https://prepme.alecson95.workers.dev/v1/messages',

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
    const cost = (this.session.inputTokens  * this.PRICE_INPUT) +
                 (this.session.outputTokens * this.PRICE_OUTPUT);
    return {
      inputTokens:  this.session.inputTokens,
      outputTokens: this.session.outputTokens,
      totalTokens:  this.session.inputTokens + this.session.outputTokens,
      costUSD:      cost,
    };
  },

  _updateUsageBar() {
    if (!Storage.getAdvancedMode()) return; // hidden unless Advanced Mode is on
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

  estimateTokens(text) {
    return Math.ceil((text || '').length / 4);
  },

  _headers() {
    const jwt = Auth.getJWT();
    return {
      'Content-Type':  'application/json',
      'Authorization': jwt ? `Bearer ${jwt}` : '',
    };
  },

  async call(systemPrompt, userContent, maxTokens = 4096, context = 'api') {
    if (!Auth.isAuthed()) throw new Error('Not authenticated. Please log in.');

    let res;
    try {
      res = await fetch(this.WORKER_URL, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({
          model:      this.MODEL,
          max_tokens: maxTokens,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: userContent }],
          _context:   context, // passed to worker for usage logging
        }),
      });
    } catch (err) {
      console.error('[PrepMe] fetch to worker failed:', err);
      throw new Error('Cannot reach the API. Check your connection.');
    }

    if (res.status === 401) throw new Error('Session expired. Please log in again.');
    if (res.status === 403) throw new Error('Access denied. Contact the admin.');

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    this.trackUsage(data.usage);
    return data.content[0].text;
  },

  // ── JSON repair ─────────────────────────────────────────
  _repairJSON(raw) {
    let t = raw;
    t = t.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();
    t = t.replace(/"(\s*\n\s*)"/g, '",\n"');
    t = t.replace(/([}\]"0-9])\s*\n(\s*[{["a-zA-Z_])/g, (m, a, b) => `${a},\n${b}`);
    t = t.replace(/,(\s*,)+/g, ',');
    t = t.replace(/,(\s*[}\]])/g, '$1');

    // Fix unclosed string literal
    const qPos = [];
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '\\') { i++; continue; }
      if (t[i] === '"') qPos.push(i);
    }
    if (qPos.length % 2 !== 0) t = t.slice(0, qPos[qPos.length - 1]);

    t = t.replace(/,?\s*$/, '');
    const opens  = (t.match(/\{/g) || []).length;
    const closes = (t.match(/\}/g) || []).length;
    const aOpens = (t.match(/\[/g) || []).length;
    const aClose = (t.match(/\]/g) || []).length;
    for (let i = 0; i < aOpens - aClose; i++) t += ']';
    for (let i = 0; i < opens  - closes;  i++) t += '}';
    return t;
  },

  async callJSON(systemPrompt, userContent, maxTokens = 4096, context = 'api') {
    const text = await this.call(systemPrompt, userContent, maxTokens, context);
    const tryParse = s => { try { return JSON.parse(s); } catch { return null; } };

    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      const r = tryParse(fenced[1].trim()) ?? tryParse(this._repairJSON(fenced[1].trim()));
      if (r) return r;
    }
    const r2 = tryParse(text.trim()) ?? tryParse(this._repairJSON(text.trim()));
    if (r2) return r2;

    const start = text.indexOf('{'), end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const slice = text.slice(start, end + 1);
      const r3 = tryParse(slice) ?? tryParse(this._repairJSON(slice));
      if (r3) return r3;
    }
    const r4 = tryParse(this._repairJSON(text));
    if (r4) return r4;

    console.error('[PrepMe] Raw AI response that failed JSON parse:\n', text);
    throw new Error('AI returned malformed JSON. Raw response logged to console.');
  },

  // ── Streaming for mock interview ──────────────────────
  async stream(systemPrompt, messages, onChunk) {
    if (!Auth.isAuthed()) throw new Error('Not authenticated. Please log in.');

    let res;
    try {
      res = await fetch(this.WORKER_URL, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({
          model:      this.MODEL,
          max_tokens: 1024,
          stream:     true,
          system:     systemPrompt,
          messages,
          _context:   'mock',
        }),
      });
    } catch (err) {
      throw new Error('Cannot reach the API. Check your connection.');
    }

    if (res.status === 401) throw new Error('Session expired. Please log in again.');
    if (res.status === 403) throw new Error('Access denied. Contact the admin.');
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error?.message || `API error ${res.status}`);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '', inputTokens = 0, outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '));
      for (const line of lines) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.type === 'content_block_delta' && json.delta?.text) {
            fullText += json.delta.text;
            onChunk(json.delta.text, fullText);
          }
          if (json.type === 'message_delta'  && json.usage)         outputTokens = json.usage.output_tokens || 0;
          if (json.type === 'message_start'  && json.message?.usage) inputTokens = json.message.usage.input_tokens || 0;
        } catch { /* skip malformed SSE lines */ }
      }
    }

    this.trackUsage({ input_tokens: inputTokens, output_tokens: outputTokens });

    // Log streaming usage to Supabase (worker only logs non-streaming)
    if (inputTokens + outputTokens > 0) {
      Storage.logUsage(inputTokens, outputTokens, 'mock');
    }

    return fullText;
  },
};
