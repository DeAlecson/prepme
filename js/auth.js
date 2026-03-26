/* ── PrepMe Auth — Email + Password ── */

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

    this.client.auth.onAuthStateChange(async (event, session) => {
      this.session = session;
      if (event === 'SIGNED_IN' && session) {
        await this._onSignedIn(session);
      } else if (event === 'SIGNED_OUT') {
        this.profile = null;
        this._showStep('login');
        this._showGate();
      }
    });

    const { data: { session } } = await this.client.auth.getSession();
    if (session) {
      this.session = session;
      await this._onSignedIn(session);
    } else {
      this._showStep('login');
      this._showGate();
    }
  },

  // ── Session handler ────────────────────────────────────
  async _onSignedIn(session) {
    let profile = await this._fetchProfile(session.user.id);

    if (!profile) {
      await new Promise(r => setTimeout(r, 1000));
      profile = await this._fetchProfile(session.user.id);
    }

    if (!profile) {
      this._showStep('invite');
      this._showGate();
      return;
    }

    this.profile = profile;

    if (!this.profile.is_active) {
      // Check for a pending invite code saved before email confirmation redirect
      const pendingCode = localStorage.getItem('prepme_pending_code');
      if (pendingCode) {
        localStorage.removeItem('prepme_pending_code');
        const res = await this.redeemCode(pendingCode);
        if (res.ok) {
          await this._launchApp();
          return;
        }
        toast(res.error, 'error');
      }
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
    const name  = this.profile?.display_name || this.profile?.email?.split('@')[0] || 'User';
    const email = this.profile?.email || '';
    const label = $('nav-user-label');
    if (label) label.textContent = name;
    const avatar = $('nav-user-avatar');
    if (avatar) avatar.textContent = (name[0] || 'U').toUpperCase();
    const adminBtn = $('nav-admin-btn');
    if (adminBtn) adminBtn.classList.toggle('hidden', !this.isAdmin());
    const emailDisplay = $('settings-email-display');
    if (emailDisplay) emailDisplay.textContent = email;
    const nameInput = $('settings-name-input');
    if (nameInput) nameInput.value = this.profile?.display_name || '';
  },

  // ── Email + Password sign in ───────────────────────────
  async signIn(email, password) {
    const { error } = await this.client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  },

  // ── Sign up (validates invite code first) ─────────────
  async signUp(email, password, code) {
    const upper = code.trim().toUpperCase();

    // Validate code exists and is available before creating account
    const { data: codeRow, error: codeErr } = await this.client
      .from('invite_codes')
      .select('*')
      .eq('code', upper)
      .eq('is_active', true)
      .is('used_by', null)
      .single();

    if (codeErr || !codeRow) {
      return { ok: false, error: 'Invalid or already used invite code.' };
    }

    // Create account — trigger will create inactive profile
    const { error } = await this.client.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) return { ok: false, error: error.message };

    // Persist code to localStorage so it survives the email confirmation redirect
    localStorage.setItem('prepme_pending_code', upper);
    return { ok: true, confirmEmail: true };
  },

  // ── Invite code redemption (initial + re-activation) ──
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

    await this.client
      .from('profiles')
      .update({ is_active: true, invite_code_used: upper })
      .eq('id', userId);

    await this.client
      .from('invite_codes')
      .update({ used_by: userId, used_at: new Date().toISOString(), is_active: false })
      .eq('id', codeRow.id);

    this.profile = await this._fetchProfile(userId);
    return { ok: true };
  },

  // ── Password strength ──────────────────────────────────
  validatePassword(password) {
    if (password.length < 8)          return { score: 0, label: 'Too short', color: 'red' };
    const hasNum    = /\d/.test(password);
    const hasSym    = /[^a-zA-Z0-9]/.test(password);
    const hasUpper  = /[A-Z]/.test(password);
    const hasLower  = /[a-z]/.test(password);
    const score = [hasNum, hasSym, hasUpper, hasLower].filter(Boolean).length;
    if (score <= 1) return { score: 1, label: 'Weak',   color: 'red'   };
    if (score === 2) return { score: 2, label: 'Fair',   color: 'amber' };
    if (score === 3) return { score: 3, label: 'Good',   color: 'green' };
    return              { score: 4, label: 'Strong', color: 'green' };
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
    ['login', 'register', 'invite'].forEach(s => {
      const el = $(`auth-step-${s}`);
      if (el) el.classList.toggle('hidden', s !== step);
    });
    // Show/hide tabs — hide on invite step
    const tabs = $('auth-tabs');
    if (tabs) tabs.classList.toggle('hidden', step === 'invite');
  },
};

// ── Gate event wiring ─────────────────────────────────────
function initAuthGate() {

  // Tab switching: login ↔ register
  $('gate-tab-login')?.addEventListener('click', () => {
    $('gate-tab-login').classList.add('active');
    $('gate-tab-register').classList.remove('active');
    Auth._showStep('login');
  });
  $('gate-tab-register')?.addEventListener('click', () => {
    $('gate-tab-register').classList.add('active');
    $('gate-tab-login').classList.remove('active');
    Auth._showStep('register');
  });

  // ── Sign In ──────────────────────────────────────────
  const signInBtn = $('auth-signin-btn');
  if (signInBtn) {
    signInBtn.addEventListener('click', async () => {
      const email    = $('auth-login-email').value.trim();
      const password = $('auth-login-password').value;
      if (!email || !email.includes('@')) { toast('Enter a valid email.', 'error'); return; }
      if (!password) { toast('Enter your password.', 'error'); return; }
      signInBtn.disabled = true;
      signInBtn.textContent = 'Signing in…';
      const res = await Auth.signIn(email, password);
      signInBtn.disabled = false;
      signInBtn.textContent = 'Sign In';
      if (!res.ok) toast(res.error || 'Sign in failed.', 'error');
    });
    $('auth-login-password').addEventListener('keydown', e => {
      if (e.key === 'Enter') signInBtn.click();
    });
  }

  // ── Sign Up ──────────────────────────────────────────
  const signUpBtn  = $('auth-signup-btn');
  const pwInput    = $('auth-register-password');
  const pwStrength = $('auth-pw-strength');
  const pwBar      = $('auth-pw-bar');
  const pwLabel    = $('auth-pw-label');

  if (pwInput && pwStrength) {
    pwInput.addEventListener('input', () => {
      const val = pwInput.value;
      if (!val) { pwStrength.classList.add('hidden'); return; }
      pwStrength.classList.remove('hidden');
      const result = Auth.validatePassword(val);
      pwBar.style.width = `${result.score * 25}%`;
      pwBar.className = `pw-bar pw-bar-${result.color}`;
      pwLabel.textContent = result.label;
      pwLabel.className = `pw-label pw-label-${result.color}`;
    });
  }

  if (signUpBtn) {
    signUpBtn.addEventListener('click', async () => {
      const email    = $('auth-register-email').value.trim();
      const password = $('auth-register-password').value;
      const code     = $('auth-register-code').value.trim();

      if (!email || !email.includes('@')) { toast('Enter a valid email.', 'error'); return; }
      if (!password) { toast('Enter a password.', 'error'); return; }

      const strength = Auth.validatePassword(password);
      if (strength.score < 2) {
        toast('Password too weak — use 8+ chars with numbers and symbols.', 'error');
        return;
      }
      if (!code) { toast('Enter your invite code.', 'error'); return; }

      signUpBtn.disabled = true;
      signUpBtn.textContent = 'Creating account…';
      const res = await Auth.signUp(email, password, code);
      signUpBtn.disabled = false;
      signUpBtn.textContent = 'Create Account';

      if (!res.ok) {
        toast(res.error || 'Sign up failed.', 'error');
      } else if (res.confirmEmail) {
        // Email confirmation required — show message
        $('auth-register-email').value = '';
        $('auth-register-password').value = '';
        $('auth-register-code').value = '';
        $('auth-pw-strength').classList.add('hidden');
        toast('Account created! Check your email to confirm, then sign in.', 'success');
        // Switch to sign in tab
        $('gate-tab-login').click();
      } else {
        toast('Account created! Signing you in…', 'success');
      }
    });
    $('auth-register-code').addEventListener('keydown', e => {
      if (e.key === 'Enter') signUpBtn.click();
    });
    // Auto-uppercase invite code
    $('auth-register-code').addEventListener('input', e => {
      const pos = e.target.selectionStart;
      e.target.value = e.target.value.toUpperCase();
      e.target.setSelectionRange(pos, pos);
    });
  }

  // ── Invite code re-activation (inactive user) ────────
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
        toast('Access granted!', 'success');
        await Auth._launchApp();
      } else {
        toast(res.error, 'error');
      }
    });
    codeInput.addEventListener('keydown', e => { if (e.key === 'Enter') codeBtn.click(); });
    codeInput.addEventListener('input', e => {
      const pos = e.target.selectionStart;
      e.target.value = e.target.value.toUpperCase();
      e.target.setSelectionRange(pos, pos);
    });
  }

  // Sign out from invite/denied screen
  $('auth-invite-signout')?.addEventListener('click', () => Auth.signOut());

  // Nav sign out
  $('nav-signout-btn')?.addEventListener('click', () => Auth.signOut());
}
