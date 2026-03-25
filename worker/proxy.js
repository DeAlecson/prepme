/**
 * PrepMe — Cloudflare Worker Proxy
 * Forwards requests to Anthropic API with CORS headers.
 * Deploy at: https://workers.cloudflare.com
 *
 * The API key is passed per-request from the user's session — it is never
 * stored in this worker.
 */

const ANTHROPIC_BASE = 'https://api.anthropic.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version',
};

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS });
    }

    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: { message: 'Missing x-api-key header' } }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    const targetPath = url.pathname; // e.g. /v1/messages
    const targetUrl  = ANTHROPIC_BASE + targetPath;

    const body = await request.text();
    const isStream = (() => {
      try { return JSON.parse(body).stream === true; } catch { return false; }
    })();

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01',
      },
      body,
    });

    if (isStream) {
      // Pass stream straight through
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          ...CORS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    }

    const data = await upstream.text();
    return new Response(data, {
      status: upstream.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  },
};
