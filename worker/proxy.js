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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version, anthropic-dangerous-allow-browser',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // Health check — GET to root confirms worker is alive
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.pathname === '/' || url.pathname === '') {
        return new Response(JSON.stringify({ status: 'PrepMe proxy is running' }), {
          status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
    }

    // Diagnostic ping — POST to /ping confirms worker accepts POST without calling Anthropic
    if (request.method === 'POST') {
      const url = new URL(request.url);
      if (url.pathname === '/ping') {
        return new Response(JSON.stringify({ status: 'ok', method: 'POST', message: 'Worker is accepting POST requests' }), {
          status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed. Send POST to /v1/messages', receivedMethod: request.method }), {
        status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
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
