/* ── App Boot ── */

const APP_VERSION = '2.0.0';

function initVersion() {
  const stored = localStorage.getItem('prepme_version');
  if (stored !== APP_VERSION) {
    // Clear only config/cache keys — never user data
    Object.keys(localStorage)
      .filter(k => k.startsWith('prepme_') && k !== 'prepme_advanced')
      .forEach(k => localStorage.removeItem(k));
    localStorage.setItem('prepme_version', APP_VERSION);
  }
  const el = $('footer-version');
  if (el) el.textContent = `v${APP_VERSION}`;
}

let currentPortal = null;

// ── Tab Navigation ────────────────────────────────────────
function initTabs() {
  $$('.ntab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.portal && !tab.classList.contains('enabled')) return;
      switchTab(tab.dataset.tab);
    });
  });
}

function switchTab(tabId) {
  $$('.ntab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  $$('.page').forEach(p => {
    const isTarget = p.id === `page-${tabId}`;
    p.classList.toggle('on', isTarget);
    if (tabId === 'mock') p.classList.toggle('mock-page', isTarget);
  });
  const footer = $('app-footer');
  if (footer) footer.classList.toggle('hidden', tabId === 'mock' || tabId === 'processing');
}

function enablePortalTabs() {
  $$('.ntab[data-portal]').forEach(t => t.classList.add('enabled'));
}

// ── Intake & Processing ───────────────────────────────────
function initIntake() {
  initDropzone('resume-drop', 'resume-file-name');
  initDropzone('cover-drop',  'cover-file-name');
  $('process-btn').addEventListener('click', runProcess);

  const estimateInputs = ['jd-url', 'jd-text', 'linkedin-url', 'glassdoor-url'];
  estimateInputs.forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', updateCostEstimate);
  });
  updateCostEstimate();
}

function updateCostEstimate() {
  const jdText    = ($('jd-text')?.value   || '') + ($('jd-url')?.value || '');
  const linkedin  = $('linkedin-url')?.value  || '';
  const glassdoor = $('glassdoor-url')?.value || '';
  const resumeDrop = $('resume-drop');
  const coverDrop  = $('cover-drop');

  let chars = jdText.length + linkedin.length + glassdoor.length;
  if (resumeDrop?._file) chars += resumeDrop._file.size * 0.6;
  if (coverDrop?._file)  chars += coverDrop._file.size  * 0.6;

  const inputTokens  = Math.ceil(chars / 4) + 800;
  const outputTokens = 8000;
  const cost = (inputTokens * AI.PRICE_INPUT) + (outputTokens * AI.PRICE_OUTPUT);

  const estTokensEl = $('est-tokens');
  const estCostEl   = $('est-cost');
  if (estTokensEl) estTokensEl.textContent = `~${(inputTokens + outputTokens).toLocaleString()} tokens`;
  if (estCostEl)   estCostEl.textContent   = `~$${cost.toFixed(4)} USD`;
}

function initDropzone(dropId, nameId) {
  const drop   = $(dropId);
  const nameEl = $(nameId);
  const input  = drop.querySelector('.dropzone-input');

  drop.addEventListener('dragover',  e => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', ()  => drop.classList.remove('dragover'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) setFile(drop, nameEl, file);
  });
  input.addEventListener('change', () => {
    if (input.files[0]) setFile(drop, nameEl, input.files[0]);
  });
}

function setFile(drop, nameEl, file) {
  drop._file = file;
  drop.classList.add('has-file');
  drop.querySelector('.dropzone-icon').textContent = '✓';
  drop.querySelector('.dropzone-text').textContent = file.name;
  nameEl.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  nameEl.classList.remove('hidden');
  updateCostEstimate();
}

async function runProcess() {
  const jdUrl       = $('jd-url').value.trim();
  const jdText      = $('jd-text').value.trim();
  const resumeDrop  = $('resume-drop');
  const coverDrop   = $('cover-drop');
  const linkedinUrl = $('linkedin-url').value.trim();
  const glassdoorUrl = $('glassdoor-url').value.trim();

  if (!jdUrl && !jdText) { toast('Provide a job URL or paste the job description.', 'error'); return; }
  if (!resumeDrop._file)  { toast('Please upload your resume.', 'error'); return; }

  AI.resetSession();
  switchTab('processing');

  const steps = ['proc-parse', 'proc-scrape', 'proc-analyze', 'proc-generate', 'proc-qa', 'proc-mock'];
  const stepTimers = {};
  let timerInterval = null;

  function setStep(i) {
    const now = Date.now();
    steps.forEach((s, si) => {
      const el = $(s);
      if (si < i) {
        el.className = 'proc-step done';
        const elapsed = stepTimers[si] ? ((now - stepTimers[si]) / 1000).toFixed(1) : null;
        const timerEl = el.querySelector('.proc-timer');
        if (timerEl && elapsed) timerEl.textContent = `${elapsed}s`;
      } else if (si === i) {
        el.className = 'proc-step active';
        stepTimers[i] = now;
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
          const timerEl = el.querySelector('.proc-timer');
          if (timerEl) timerEl.textContent = `${((Date.now() - stepTimers[i]) / 1000).toFixed(1)}s`;
        }, 100);
      } else {
        el.className = 'proc-step';
        const timerEl = el.querySelector('.proc-timer');
        if (timerEl) timerEl.textContent = '';
      }
    });
  }

  function stopTimers() { clearInterval(timerInterval); timerInterval = null; }

  try {
    setStep(0);
    let resumeText, coverText;
    try {
      [resumeText, coverText] = await Promise.all([
        Parsers.parseFile(resumeDrop._file),
        coverDrop._file ? Parsers.parseFile(coverDrop._file) : Promise.resolve(null),
      ]);
    } catch (err) { throw new Error(`File parsing failed: ${err.message}`); }

    setStep(1);
    let scraped = { jdText: null, linkedinText: null, glassdoorText: null };
    try { scraped = await Scraper.scrapeAll({ jdUrl, linkedinUrl, glassdoorUrl }); } catch { }

    let portal;
    try {
      portal = await Prompts.generatePortal(
        { jdText: scraped.jdText, pastedJD: jdText, resumeText, coverText,
          linkedinText: scraped.linkedinText, glassdoorText: scraped.glassdoorText },
        (phase) => {
          if (phase === 'analyze') setStep(2);
          if (phase === 'core')    setStep(3);
          if (phase === 'qa')      setStep(4);
          if (phase === 'quiz')    setStep(5);
        }
      );
    } catch (err) { throw new Error(`AI generation failed: ${err.message}`); }

    stopTimers();

    const profile = { id: Storage.generateId(), ...portal, savedAt: Date.now() };
    await Storage.saveProfile(profile);
    currentPortal = profile;

    Renderer.renderAll(portal);
    Quiz.init(portal.quiz?.questions || []);
    Mock.init(portal);
    enablePortalTabs();
    switchTab('overview');

  } catch (err) {
    stopTimers();
    console.error(err);
    toast(err.message || 'Something went wrong.', 'error');
    switchTab('intake');
  }
}

// ── Saved Preps Drawer ────────────────────────────────────
function initProfiles() {
  $('profiles-btn').addEventListener('click', openProfiles);
  $('profiles-close').addEventListener('click', closeProfiles);
  $('profiles-overlay').addEventListener('click', closeProfiles);
}

function openProfiles() {
  renderProfilesList();
  $('profiles-drawer').classList.remove('hidden');
  $('profiles-overlay').classList.remove('hidden');
}

function closeProfiles() {
  $('profiles-drawer').classList.add('hidden');
  $('profiles-overlay').classList.add('hidden');
}

async function renderProfilesList() {
  const list = $('profiles-list');
  list.innerHTML = `<div class="empty-state" style="opacity:0.5">Loading…</div>`;
  const profiles = await Storage.getProfiles();

  if (!profiles.length) {
    list.innerHTML = `<div class="empty-state">No saved preps yet.<br>Complete your first prep to save it here.</div>`;
    return;
  }

  list.innerHTML = profiles.map(p => {
    const d = p.data || p;
    return `
    <div class="profile-card" data-id="${escapeHTML(p.id)}">
      <div onclick="loadProfile('${escapeHTML(p.id)}'); closeProfiles();" style="flex:1;cursor:pointer">
        <div class="profile-role">${escapeHTML(d.meta?.role || p.role || 'Unknown Role')}</div>
        <div class="profile-company">${escapeHTML(d.meta?.company || p.company || 'Unknown Company')}</div>
        <div class="profile-date">${formatDate(p.updated_at || p.savedAt)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <div class="profile-score">${p.readiness_score || d.overview?.readinessScore || '--'}</div>
        <button class="profile-delete" onclick="deleteProfile('${escapeHTML(p.id)}')" title="Delete">✕</button>
      </div>
    </div>`;
  }).join('');
}

async function loadProfile(id) {
  const profile = await Storage.getProfile(id);
  if (!profile) { toast('Profile not found.', 'error'); return; }
  currentPortal = profile;
  Renderer.renderAll(profile);
  Quiz.init(profile.quiz?.questions || []);
  Mock.init(profile);
  enablePortalTabs();
  switchTab('overview');
  toast(`Loaded: ${profile.meta?.role} @ ${profile.meta?.company}`, 'success');
}

async function deleteProfile(id) {
  await Storage.deleteProfile(id);
  renderProfilesList();
  toast('Prep deleted.', 'success');
}

// ── Score Modal ───────────────────────────────────────────
function initScoreModal() {
  $('score-close').addEventListener('click', () => {
    $('score-modal').classList.add('hidden');
    $('score-overlay').classList.add('hidden');
  });
  $('score-overlay').addEventListener('click', () => {
    $('score-modal').classList.add('hidden');
    $('score-overlay').classList.add('hidden');
  });
}

// ── Settings Modal ────────────────────────────────────────
function initSettings() {
  $('nav-settings-btn')?.addEventListener('click', openSettings);
  $('settings-modal-close')?.addEventListener('click', closeSettings);
  $('settings-modal-overlay')?.addEventListener('click', closeSettings);

  // Display name save
  $('settings-name-save')?.addEventListener('click', async () => {
    const input = $('settings-name-input');
    const name = input?.value.trim();
    if (!name) { toast('Enter a name.', 'error'); return; }
    const btn = $('settings-name-save');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    const { error } = await Auth.client
      .from('profiles')
      .update({ display_name: name })
      .eq('id', Auth.session.user.id);
    btn.disabled = false;
    btn.textContent = 'Save';
    if (error) { toast('Failed to save name.', 'error'); return; }
    Auth.profile.display_name = name;
    Auth._updateNavUser();
    toast('Name saved.', 'success');
  });

  // Advanced Mode toggle
  const toggle = $('advanced-mode-toggle');
  if (toggle) {
    toggle.checked = Storage.getAdvancedMode();
    toggle.addEventListener('change', () => {
      Storage.setAdvancedMode(toggle.checked);
      const bar = $('token-bar');
      if (bar) bar.classList.toggle('hidden', !toggle.checked);
      if (!toggle.checked && bar) bar.classList.add('hidden');
      else AI._updateUsageBar();
    });
  }

  // Sign out button in settings
  $('settings-signout-btn')?.addEventListener('click', () => {
    closeSettings();
    Auth.signOut();
  });
}

function openSettings() {
  const toggle = $('advanced-mode-toggle');
  if (toggle) toggle.checked = Storage.getAdvancedMode();
  const nameInput = $('settings-name-input');
  if (nameInput) nameInput.value = Auth.profile?.display_name || '';
  $('settings-modal').classList.remove('hidden');
  $('settings-modal-overlay').classList.remove('hidden');
}

function closeSettings() {
  $('settings-modal').classList.add('hidden');
  $('settings-modal-overlay').classList.add('hidden');
}

// ── Boot (called by Auth after login) ────────────────────
function initApp() {
  initTabs();
  initIntake();
  initProfiles();
  initScoreModal();
  initSettings();
  initAdmin();
  // Show/hide Advanced Mode token bar based on setting
  const bar = $('token-bar');
  if (bar && !Storage.getAdvancedMode()) bar.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  initVersion();
  initAuthGate(); // wires up auth gate buttons
  Auth.init();    // checks session and either shows gate or launches app
});
