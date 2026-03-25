/* ── PrepMe Admin Panel ── */

const Admin = {

  // ── Open / Close ─────────────────────────────────────
  open() {
    if (!Auth.isAdmin()) return;
    $('admin-modal').classList.remove('hidden');
    $('admin-overlay').classList.remove('hidden');
    this.loadUsers();
    this.loadCodes();
  },

  close() {
    $('admin-modal').classList.add('hidden');
    $('admin-overlay').classList.add('hidden');
  },

  // ── Users Tab ─────────────────────────────────────────
  async loadUsers(search = '') {
    const list = $('admin-users-list');
    list.innerHTML = `<div class="admin-loading">Loading users…</div>`;

    let query = Auth.client
      .from('profiles')
      .select('id, email, role, is_active, total_input_tokens, total_output_tokens, last_active_at, created_at, invite_code_used')
      .order('created_at', { ascending: false });

    if (search.trim()) {
      query = query.or(`email.ilike.%${search.trim()}%,id.eq.${search.trim()}`);
    }

    const { data: users, error } = await query;

    if (error || !users) {
      list.innerHTML = `<div class="admin-loading" style="color:var(--red)">Failed to load users.</div>`;
      return;
    }

    if (!users.length) {
      list.innerHTML = `<div class="admin-loading">No users found.</div>`;
      return;
    }

    list.innerHTML = users.map(u => {
      const cost = ((u.total_input_tokens * 0.80 / 1_000_000) + (u.total_output_tokens * 4.00 / 1_000_000)).toFixed(4);
      const lastSeen = u.last_active_at ? formatDate(u.last_active_at) : 'Never';
      const isAdmin  = u.role === 'admin';
      return `
      <div class="admin-user-row ${u.is_active ? '' : 'inactive'}">
        <div class="admin-user-main">
          <div class="admin-user-email">
            ${escapeHTML(u.email)}
            ${isAdmin ? '<span class="admin-badge admin">ADMIN</span>' : ''}
            ${!u.is_active ? '<span class="admin-badge inactive">INACTIVE</span>' : ''}
          </div>
          <div class="admin-user-meta">
            UID: ${escapeHTML(u.id.slice(0,8))}…
            · Joined: ${formatDate(u.created_at)}
            · Last seen: ${lastSeen}
            ${u.invite_code_used ? `· Code: ${escapeHTML(u.invite_code_used)}` : ''}
          </div>
        </div>
        <div class="admin-user-stats">
          <span title="Total tokens">${((u.total_input_tokens || 0) + (u.total_output_tokens || 0)).toLocaleString()} tok</span>
          <span title="Estimated cost" class="admin-cost">$${cost}</span>
        </div>
        ${!isAdmin ? `
        <div class="admin-user-actions">
          <button class="admin-btn ${u.is_active ? 'danger' : 'success'}"
            onclick="Admin.toggleUser('${u.id}', ${u.is_active})">
            ${u.is_active ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>` : ''}
      </div>`;
    }).join('');
  },

  async toggleUser(userId, currentlyActive) {
    const { error } = await Auth.client
      .from('profiles')
      .update({ is_active: !currentlyActive })
      .eq('id', userId);

    if (error) { toast('Failed to update user.', 'error'); return; }
    toast(currentlyActive ? 'User deactivated.' : 'User reactivated.', 'success');
    this.loadUsers($('admin-search-input')?.value || '');
  },

  // ── Invite Codes Tab ──────────────────────────────────
  async loadCodes() {
    const list = $('admin-codes-list');
    list.innerHTML = `<div class="admin-loading">Loading codes…</div>`;

    const { data: codes, error } = await Auth.client
      .from('invite_codes')
      .select(`
        id, code, is_active, created_at, used_at,
        used_by_profile:profiles!invite_codes_used_by_fkey(email)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !codes) {
      list.innerHTML = `<div class="admin-loading" style="color:var(--red)">Failed to load codes.</div>`;
      return;
    }

    if (!codes.length) {
      list.innerHTML = `<div class="admin-loading">No invite codes yet. Generate one above.</div>`;
      return;
    }

    list.innerHTML = codes.map(c => `
      <div class="admin-code-row ${c.is_active ? '' : 'used'}">
        <div class="admin-code-value">${escapeHTML(c.code)}</div>
        <div class="admin-code-meta">
          ${c.used_at
            ? `Used by ${escapeHTML(c.used_by_profile?.email || 'unknown')} · ${formatDate(c.used_at)}`
            : `Created ${formatDate(c.created_at)}`}
        </div>
        <div class="admin-code-status ${c.is_active ? 'active' : 'used'}">
          ${c.is_active ? 'Available' : 'Used'}
        </div>
        ${c.is_active ? `
        <button class="admin-btn danger small" onclick="Admin.revokeCode('${c.id}')">Revoke</button>
        <button class="admin-btn small" onclick="Admin.copyCode('${escapeHTML(c.code)}')">Copy</button>
        ` : ''}
      </div>`).join('');
  },

  async generateCode() {
    const btn = $('admin-gen-code-btn');
    btn.disabled = true;
    btn.textContent = 'Generating…';

    const code = this._randomCode();
    const { error } = await Auth.client
      .from('invite_codes')
      .insert({ code, created_by: Auth.session.user.id });

    btn.disabled = false;
    btn.textContent = '+ Generate Invite Code';

    if (error) { toast('Failed to generate code.', 'error'); return; }
    toast(`Code created: ${code}`, 'success');
    this.loadCodes();
  },

  async revokeCode(codeId) {
    const { error } = await Auth.client
      .from('invite_codes')
      .update({ is_active: false })
      .eq('id', codeId);

    if (error) { toast('Failed to revoke code.', 'error'); return; }
    toast('Code revoked.', 'success');
    this.loadCodes();
  },

  copyCode(code) {
    navigator.clipboard.writeText(code).then(() => toast(`Copied: ${code}`, 'success'));
  },

  _randomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const seg   = n => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${seg(4)}-${seg(4)}`;
  },
};

// ── Admin panel init (wired after DOM) ────────────────────
function initAdmin() {
  const openBtn = $('nav-admin-btn');
  if (openBtn) openBtn.addEventListener('click', () => Admin.open());

  $('admin-overlay')?.addEventListener('click', () => Admin.close());
  $('admin-close-btn')?.addEventListener('click', () => Admin.close());

  // Tab switching inside admin
  $$('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.admin-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      $$('.admin-tab-panel').forEach(p => p.classList.toggle('hidden', p.id !== btn.dataset.panel));
    });
  });

  // Search users
  $('admin-search-input')?.addEventListener('input', e => {
    Admin.loadUsers(e.target.value);
  });

  // Generate code
  $('admin-gen-code-btn')?.addEventListener('click', () => Admin.generateCode());
}
