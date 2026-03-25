/* ── PrepMe Auth — Supabase Magic Link ── */

const Auth = {
  SUPABASE_URL: 'https://bhywxbtmgcxcpnctximg.supabase.co',
  SUPABASE_ANON: 'sb_publishable_f49McYCrNCAS0Zjw3ei0Lw_1-S36V-O',

  client:  null,
  session: null,
  profile: null,

  // ── Bootstrap ──────────────────────────────────────────
  async init() {
    this.client = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON, {
      auth: { persistSession: true, autoRefreshToken: true },
    });

    // Listen for session changes (magic link callback lands here)
    this.client.auth.onAuthStateChange(async (event, session) => {
      this.session = session;
      if (event === 'SIGNED_IN' && session) {
        await this._onSignedIn(session);
      } else if (event === 'SIGNED_OUT') {
        this.profile = null;
        this._showStep('email');
        this._showGate();
      }
    });

    // Check for existing session
    const { data: { session } } = await this.client.auth.getSession();
    if (session) {
      this.session = session;
      await this._onSignedIn(session);
    } else {
      this._showStep('email');
      this._showGate();
    }
  },

  // ── Session handler ────────────────────────────────────
  async _onSignedIn(session) {
    const profile = await this._fetchProfile(session.user.id);

    if (!profile) {
      // Profile wasn't created by trigger yet — wait briefly and retry
      await new Promise(r => setTimeout(r, 800));
      const retry = await this._fetchProfile(session.user.id);
      if (!retry) {
        this._showStep('denied');
        this._showGate();
        return;
      }
      this.profile = retry;
    } else {
      this.profile = profile;
    }

    if (!this.profile.is_active) {
      // User exists but hasn't used invite code yet
      this._showStep('invite');
      this._showGate();
      return;
    }

    await this._launchApp();
  },

  async _fetchProfile(userId) {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return error ? null : data;
  },

  async _launchApp() {
    this._hideGate();
    $('app').classList.remove('hidden');
    this._updateNavUser();
    initApp();
  },

  _updateNavUser() {
    const email = this.profile?.email || '';
    const label = $('nav-user-label');
    if (label) label.textContent = email.split('@')[0] || 'User';
    const avatar = $('nav-user-avatar');
    if (avatar) avatar.textContent = (email[0] || 'U').toUpperCase();
    const adminBtn = $('nav-admin-btn');
    if (adminBtn) adminBtn.classList.toggle('hidden', !this.isAdmin());
    const emailDisplay = $('settings-email-display');
    if (emailDisplay) emailDisplay.textContent = email;
  },

  // ── Magic link ─────────────────────────────────────────
  async sendMagicLink(email) {
    const { error } = await this.client.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: window.location.href.split('?')[0].split('#')[0],
      },
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  },

  // ── Invite code redemption ─────────────────────────────
  async redeemCode(code) {
    const upper = code.trim().toUpperCase();

    const { data: codeRow, error } = await this.client
      .from('invite_codes')
      .select('*')
      .eq('code', upper)
      .eq('is_active', true)
      .is('used_by', null)
      .single();

    if (error || !codeRow) {
      return { ok: false, error: 'Invalid or already used invite code.' };
    }

    const userId = this.session.user.id;

    // Activate profile
    await this.client
      .from('profiles')
      .update({ is_active: true, invite_code_used: upper })
      .eq('id', userId);

    // Mark code as used
    await this.client
      .from('invite_codes')
      .update({ used_by: userId, used_at: new Date().toISOString(), is_active: false })
      .eq('id', codeRow.id);

    this.profile = await this._fetchProfile(userId);
    return { ok: true };
  },

  // ── Sign out ───────────────────────────────────────────
  async signOut() {
    await this.client.auth.signOut();
    this.session = null;
    this.profile = null;
  },

  // ── Helpers ────────────────────────────────────────────
  getJWT()   { return this.session?.access_token || null; },
  isAdmin()  { return this.profile?.role === 'admin'; },
  isAuthed() { return !!this.session && !!this.profile?.is_active; },

  // ── Gate UI ────────────────────────────────────────────
  _showGate() {
    $('auth-gate').classList.remove('hidden');
    $('app').classList.add('hidden');
  },
  _hideGate() {
    $('auth-gate').classList.add('hidden');
  },
  _showStep(step) {
    ['email', 'sent', 'invite', 'denied'].forEach(s => {
      const el = $(`auth-step-${s}`);
      if (el) el.classList.toggle('hidden', s !== step);
    });
  },
};

// ── Gate event wiring (runs after DOM ready) ──────────────
function initAuthGate() {
  // Step 1: Send magic link
  const sendBtn = $('auth-send-btn');
  const emailInput = $('auth-email-input');
  if (sendBtn && emailInput) {
    sendBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      if (!email || !email.includes('@')) {
        toast('Enter a valid email address.', 'error');
        return;
      }
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending…';
      const res = await Auth.sendMagicLink(email);
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send Magic Link';
      if (res.ok) {
        $('auth-sent-email').textContent = email;
        Auth._showStep('sent');
      } else {
        toast(res.error || 'Failed to send link.', 'error');
      }
    });

    emailInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') sendBtn.click();
    });
  }

  // Step 2: Back from sent screen
  const backBtn = $('auth-back-btn');
  if (backBtn) backBtn.addEventListener('click', () => Auth._showStep('email'));

  // Step 3: Redeem invite code
  const codeBtn   = $('auth-code-btn');
  const codeInput = $('auth-code-input');
  if (codeBtn && codeInput) {
    codeBtn.addEventListener('click', async () => {
      const code = codeInput.value.trim();
      if (!code) { toast('Enter your invite code.', 'error'); return; }
      codeBtn.disabled = true;
      codeBtn.textContent = 'Checking…';
      const res = await Auth.redeemCode(code);
      codeBtn.disabled = false;
      codeBtn.textContent = 'Unlock Access';
      if (res.ok) {
        toast('Access granted! Loading your workspace…', 'success');
        await Auth._launchApp();
      } else {
        toast(res.error, 'error');
      }
    });
    codeInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') codeBtn.click();
    });
  }

  // Sign out from denied screen
  const deniedSignOut = $('auth-denied-signout');
  if (deniedSignOut) {
    deniedSignOut.addEventListener('click', () => Auth.signOut());
  }

  // Nav sign out button
  const navSignOut = $('nav-signout-btn');
  if (navSignOut) navSignOut.addEventListener('click', () => Auth.signOut());
}
