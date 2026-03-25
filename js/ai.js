/* ── Anthropic API Client ── */

const AI = {
  MODEL: 'claude-haiku-4-5-20251001',
  API_URL: 'https://api.anthropic.com/v1/messages',

  async call(systemPrompt, userContent, maxTokens = 4096) {
    const key = Storage.getApiKey();
    if (!key) throw new Error('No API key set.');

    const res = await fetch(this.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-allow-browser': 'true',
      },
      body: JSON.stringify({
        model: this.MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    return data.content[0].text;
  },

  async callJSON(systemPrompt, userContent, maxTokens = 4096) {
    const text = await this.call(systemPrompt, userContent, maxTokens);
    // Extract JSON from markdown code blocks if present
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = match ? match[1] : text;
    try {
      return JSON.parse(jsonStr.trim());
    } catch {
      throw new Error('Failed to parse AI response as JSON. Try again.');
    }
  },

  // Streaming for mock interview
  async stream(systemPrompt, messages, onChunk) {
    const key = Storage.getApiKey();
    if (!key) throw new Error('No API key set.');

    const res = await fetch(this.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-allow-browser': 'true',
      },
      body: JSON.stringify({
        model: this.MODEL,
        max_tokens: 1024,
        stream: true,
        system: systemPrompt,
        messages,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

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
        } catch { /* skip */ }
      }
    }
    return fullText;
  },
};
