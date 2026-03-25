/**
 * PrepMe — Cloudflare Worker Proxy v2
 *
 * Now with Supabase JWT authentication.
 * Users no longer pass API keys — the worker uses env.ANTHROPIC_API_KEY.
 *
 * Required Worker Secrets (set in Cloudflare Dashboard → Worker → Settings → Variables):
 *   ANTHROPIC_API_KEY   — your Anthropic API key
 *   SUPABASE_URL        — https://bhywxbtmgcxcpnctximg.supabase.co
 *   SUPABASE_SERVICE_KEY — Supabase service role key (Settings → API → service_role)
 */

const ANTHROPIC_BASE = 'https://api.anthropic.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {

    // ── CORS preflight ──────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ── Health check ────────────────────────────────────
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.pathname === '/' || url.pathname === '') {
        return json({ status: 'PrepMe proxy is running', version: 2 });
      }
    }

    // ── Diagnostic ping (no auth required) ─────────────
    if (request.method === 'POST') {
      const url = new URL(request.url);
      if (url.pathname === '/ping') {
        return json({ status: 'ok', message: 'Worker accepts POST' });
      }
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    // ── Auth: verify Supabase JWT ───────────────────────
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: { message: 'Unauthorized — no session token.' } }, 401);
    }
    const jwt = authHeader.slice(7);

    // Verify JWT and get user info via Supabase auth endpoint
    let userId;
    try {
      const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'apikey': env.SUPABASE_SERVICE_KEY,
        },
      });
      if (!userRes.ok) {
        return json({ error: { message: 'Session expired. Please log in again.' } }, 401);
      }
      const userData = await userRes.json();
      userId = userData.id;
    } catch {
      return json({ error: { message: 'Auth verification failed.' } }, 401);
    }

    // ── Access check: must be active in profiles ────────
    try {
      const profileRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=is_active,role`,
        {
          headers: {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          },
        }
      );
      const profiles = await profileRes.json();
      const profile = profiles?.[0];
      if (!profile?.is_active) {
        return json({ error: { message: 'Access denied. Contact the admin.' } }, 403);
      }
    } catch {
      return json({ error: { message: 'Profile check failed.' } }, 500);
    }

    // ── Forward to Anthropic ────────────────────────────
    const bodyText = await request.text();
    const bodyObj  = (() => { try { return JSON.parse(bodyText); } catch { return {}; } })();
    const isStream = bodyObj.stream === true;
    const context  = bodyObj._context || 'api'; // optional context tag from frontend

    // Strip internal fields before forwarding
    delete bodyObj._context;
    const cleanBody = JSON.stringify(bodyObj);

    const upstream = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: cleanBody,
    });

    // ── Streaming: pass through directly ────────────────
    if (isStream) {
      // Usage logging for streams is handled by the frontend
      // (it reads usage from SSE events)
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          ...CORS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // ── Non-streaming: log usage fire-and-forget ────────
    const data = await upstream.json();

    if (data.usage && userId) {
      const inputTokens  = data.usage.input_tokens  || 0;
      const outputTokens = data.usage.output_tokens || 0;
      const costUsd = (inputTokens * 0.80 / 1_000_000) + (outputTokens * 4.00 / 1_000_000);

      const sbHeaders = {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      };

      // Log usage entry
      fetch(`${env.SUPABASE_URL}/rest/v1/usage_logs`, {
        method: 'POST',
        headers: sbHeaders,
        body: JSON.stringify({ user_id: userId, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: costUsd, context }),
      });

      // Increment profile token totals + last_active_at
      fetch(`${env.SUPABASE_URL}/rest/v1/rpc/increment_tokens`, {
        method: 'POST',
        headers: sbHeaders,
        body: JSON.stringify({ user_id_param: userId, input_delta: inputTokens, output_delta: outputTokens }),
      });
    }

    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  },
};
