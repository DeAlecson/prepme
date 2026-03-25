/* ── Storage — Supabase backed ── */

const Storage = {

  // ── Prep Profiles (Supabase) ───────────────────────────

  async getProfiles() {
    if (!Auth?.client || !Auth?.session) return [];
    const { data, error } = await Auth.client
      .from('preps')
      .select('id, title, company, role, readiness_score, created_at, updated_at, data')
      .eq('user_id', Auth.session.user.id)
      .order('updated_at', { ascending: false });
    return error ? [] : (data || []);
  },

  async saveProfile(profile) {
    if (!Auth?.client || !Auth?.session) return;
    const userId = Auth.session.user.id;
    const title  = profile.title
      || `${profile.meta?.role || profile.role || 'Role'} at ${profile.meta?.company || profile.company || 'Company'}`;

    const row = {
      id:              profile.id,
      user_id:         userId,
      title:           title,
      company:         profile.meta?.company || profile.company || null,
      role:            profile.meta?.role    || profile.role    || null,
      readiness_score: profile.overview?.readinessScore ?? null,
      data:            profile,
    };

    // Upsert — insert or update
    const { error } = await Auth.client
      .from('preps')
      .upsert(row, { onConflict: 'id' });

    if (error) console.error('[PrepMe] saveProfile error:', error.message);
  },

  async deleteProfile(id) {
    if (!Auth?.client || !Auth?.session) return;
    await Auth.client.from('preps').delete().eq('id', id);
  },

  async getProfile(id) {
    if (!Auth?.client || !Auth?.session) return null;
    const { data, error } = await Auth.client
      .from('preps')
      .select('data')
      .eq('id', id)
      .single();
    return error ? null : data?.data;
  },

  // ── Usage logging (Supabase) ───────────────────────────
  // Used by the frontend for streaming calls (worker handles non-streaming)

  async logUsage(inputTokens, outputTokens, context = 'mock') {
    if (!Auth?.client || !Auth?.session) return;
    const userId  = Auth.session.user.id;
    const costUsd = (inputTokens * 0.80 / 1_000_000) + (outputTokens * 4.00 / 1_000_000);

    // Fire and forget — don't block UI
    Auth.client.from('usage_logs').insert({
      user_id: userId, input_tokens: inputTokens,
      output_tokens: outputTokens, cost_usd: costUsd, context,
    });

    Auth.client.rpc('increment_tokens', {
      user_id_param: userId,
      input_delta:   inputTokens,
      output_delta:  outputTokens,
    });
  },

  // ── Settings (localStorage — no server needed) ─────────

  getAdvancedMode()    { return localStorage.getItem('prepme_advanced') === 'true'; },
  setAdvancedMode(v)   { localStorage.setItem('prepme_advanced', String(v)); },

  // ── ID generator ──────────────────────────────────────
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },
};
