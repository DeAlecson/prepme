/* ── App Boot ── */

const APP_VERSION = '1.1.4';

// Keys that belong to the USER and must never be wiped on version bump
const PRESERVE_KEYS = ['prepme_profiles'];

function initVersion() {
  const stored = localStorage.getItem('prepme_version');
  if (stored !== APP_VERSION) {
    // Clear only cache/config keys — never touch user data
    Object.keys(localStorage)
      .filter(k => k.startsWith('prepme_') && !PRESERVE_KEYS.includes(k))
      .forEach(k => localStorage.removeItem(k));
    localStorage.setItem('prepme_version', APP_VERSION);
  }
  const el = $('footer-version');
  if (el) el.textContent = `v${APP_VERSION}`;
}

let currentPortal = null;

// ── API Key Gate ──
function initGate() {
  const key = Storage.getApiKey();
  if (key) { showApp(); return; }

  // Pre-fill proxy if saved
  const proxyInput = $('gate-proxy-input');
  if (proxyInput) proxyInput.value = Storage.getProxyUrl();

  // How-to toggle
  $('proxy-help-toggle')?.addEventListener('click', e => {
    e.preventDefault();
    $('proxy-help-steps')?.classList.toggle('hidden');
  });

  const input = $('gate-key-input');
  const btn   = $('gate-submit');

  btn.addEventListener('click', saveGateSettings);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') saveGateSettings(); });
}

function normalizeProxy(raw) {
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw.replace(/\/$/, '') : 'https://' + raw.replace(/\/$/, '');
}

function saveGateSettings() {
  const key   = $('gate-key-input')?.value.trim() || '';
  const proxy = normalizeProxy($('gate-proxy-input')?.value.trim() || '');

  if (!key.startsWith('sk-ant-')) {
    toast('API key should start with sk-ant-', 'error');
    return;
  }

  Storage.setApiKey(key);
  if (proxy) Storage.setProxyUrl(proxy);
  else Storage.clearProxyUrl();

  $('key-gate').style.display = 'none';
  showApp();
}

function showApp() {
  $('key-gate').style.display = 'none';
  $('app').classList.remove('hidden');
  initApp();
}

// ── Tab Navigation ──
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
  // Hide footer on mock and processing (full-height views)
  const footer = $('app-footer');
  if (footer) footer.classList.toggle('hidden', tabId === 'mock' || tabId === 'processing');
}

function enablePortalTabs() {
  $$('.ntab[data-portal]').forEach(t => t.classList.add('enabled'));
}

// ── Intake & Processing ──
function initIntake() {
  initDropzone('resume-drop', 'resume-file-name');
  initDropzone('cover-drop', 'cover-file-name');

  $('process-btn').addEventListener('click', runProcess);

  // Test API key button
  $('test-api-btn').addEventListener('click', async () => {
    const btn = $('test-api-btn');
    btn.disabled = true;
    btn.textContent = 'Testing...';
    const result = await AI.ping();
    if (result.ok) {
      toast('API key works!', 'success');
    } else {
      toast(`API key error: ${result.error}`, 'error');
    }
    btn.disabled = false;
    btn.textContent = 'Test API Key';
  });

  // Live cost estimate — update whenever inputs change
  const estimateInputs = ['jd-url', 'jd-text', 'linkedin-url', 'glassdoor-url'];
  estimateInputs.forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', updateCostEstimate);
  });
  updateCostEstimate();
}

function updateCostEstimate() {
  const jdText   = ($('jd-text')?.value || '') + ($('jd-url')?.value || '');
  const linkedin = $('linkedin-url')?.value || '';
  const glassdoor = $('glassdoor-url')?.value || '';
  const resumeDrop = $('resume-drop');
  const coverDrop  = $('cover-drop');

  // Rough char count from typed inputs + file size estimate
  let chars = jdText.length + linkedin.length + glassdoor.length;
  if (resumeDrop?._file)  chars += resumeDrop._file.size * 0.6; // text ratio
  if (coverDrop?._file)   chars += coverDrop._file.size  * 0.6;

  // Add system prompt + output overhead
  const inputTokens  = Math.ceil(chars / 4) + 800;  // +800 for system prompt
  const outputTokens = 8000; // typical generation output

  const cost = (inputTokens * AI.PRICE_INPUT) + (outputTokens * AI.PRICE_OUTPUT);

  const estTokensEl = $('est-tokens');
  const estCostEl   = $('est-cost');
  if (estTokensEl) estTokensEl.textContent = `~${(inputTokens + outputTokens).toLocaleString()} tokens`;
  if (estCostEl)   estCostEl.textContent   = `~$${cost.toFixed(4)} USD`;
}

function initDropzone(dropId, nameId) {
  const drop = $(dropId);
  const nameEl = $(nameId);
  const input = drop.querySelector('.dropzone-input');

  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
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
  const jdUrl = $('jd-url').value.trim();
  const jdText = $('jd-text').value.trim();
  const resumeDrop = $('resume-drop');
  const coverDrop = $('cover-drop');
  const linkedinUrl = $('linkedin-url').value.trim();
  const glassdoorUrl = $('glassdoor-url').value.trim();

  // Validation
  if (!jdUrl && !jdText) { toast('Provide a job URL or paste the job description.', 'error'); return; }
  if (!resumeDrop._file) { toast('Please upload your resume.', 'error'); return; }

  // Reset token counter and switch to processing screen
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
        // Start live tick for this step
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

  function stopTimers() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  try {
    // Step 1 — Parse files
    setStep(0);
    let resumeText, coverText;
    try {
      [resumeText, coverText] = await Promise.all([
        Parsers.parseFile(resumeDrop._file),
        coverDrop._file ? Parsers.parseFile(coverDrop._file) : Promise.resolve(null),
      ]);
    } catch (err) {
      throw new Error(`File parsing failed: ${err.message}`);
    }

    // Step 2 — Scrape URLs (non-fatal — failures fall back to null)
    setStep(1);
    let scraped = { jdText: null, linkedinText: null, glassdoorText: null };
    try {
      scraped = await Scraper.scrapeAll({ jdUrl, linkedinUrl, glassdoorUrl });
    } catch {
      // Scraping failed entirely — continue with pasted JD only
    }

    // Steps 3-6 — Generate portal (5 AI calls, 2 run in parallel)
    let portal;
    try {
      portal = await Prompts.generatePortal(
        {
          jdText: scraped.jdText,
          pastedJD: jdText,
          resumeText,
          coverText,
          linkedinText: scraped.linkedinText,
          glassdoorText: scraped.glassdoorText,
        },
        (phase) => {
          if (phase === 'analyze') setStep(2); // Analyzing fit & gaps
          if (phase === 'core')    setStep(3); // Generating your prep deck
          if (phase === 'qa')      setStep(4); // Building Q&A and quiz
          if (phase === 'quiz')    setStep(5); // Configuring mock interview
        }
      );
    } catch (err) {
      throw new Error(`AI generation failed: ${err.message}`);
    }

    stopTimers();

    // Save profile
    const profile = {
      id: Storage.generateId(),
      ...portal,
      savedAt: Date.now(),
    };
    Storage.saveProfile(profile);
    currentPortal = profile;

    // Render all portal sections
    Renderer.renderAll(portal);
    Quiz.init(portal.quiz?.questions || []);
    Mock.init(portal);

    enablePortalTabs();
    switchTab('overview');

  } catch (err) {
    stopTimers();
    console.error(err);
    toast(err.message || 'Something went wrong. Check your API key and try again.', 'error');
    switchTab('intake');
  }
}

// ── Profiles Drawer ──
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

function renderProfilesList() {
  const profiles = Storage.getProfiles();
  const list = $('profiles-list');

  if (!profiles.length) {
    list.innerHTML = `<div class="empty-state">No saved preps yet.<br>Complete your first prep to save it here.</div>`;
    return;
  }

  list.innerHTML = profiles.map(p => `
    <div class="profile-card" data-id="${escapeHTML(p.id)}">
      <div onclick="loadProfile('${escapeHTML(p.id)}'); closeProfiles();" style="flex:1;cursor:pointer">
        <div class="profile-role">${escapeHTML(p.meta?.role || 'Unknown Role')}</div>
        <div class="profile-company">${escapeHTML(p.meta?.company || 'Unknown Company')}</div>
        <div class="profile-date">${formatDate(p.savedAt)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <div class="profile-score">${p.overview?.readinessScore || '--'}</div>
        <button class="profile-delete" onclick="deleteProfile('${escapeHTML(p.id)}')" title="Delete">✕</button>
      </div>
    </div>
  `).join('');
}

function loadProfile(id) {
  const profile = Storage.getProfile(id);
  if (!profile) { toast('Profile not found.', 'error'); return; }

  currentPortal = profile;
  Renderer.renderAll(profile);
  Quiz.init(profile.quiz?.questions || []);
  Mock.init(profile);
  enablePortalTabs();
  switchTab('overview');
  toast(`Loaded: ${profile.meta?.role} @ ${profile.meta?.company}`, 'success');
}

function deleteProfile(id) {
  Storage.deleteProfile(id);
  renderProfilesList();
  toast('Prep deleted.', 'success');
}

// ── Score Modal ──
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

// ── API Key Modal ──
function initKeyReset() {
  $('clear-key-btn').addEventListener('click', openKeyModal);
  $('key-modal-close').addEventListener('click', closeKeyModal);
  $('key-modal-overlay').addEventListener('click', closeKeyModal);

  $('modal-key-save').addEventListener('click', () => {
    const key   = $('modal-key-input').value.trim();
    const proxy = normalizeProxy($('modal-proxy-input').value.trim());
    if (key && !key.startsWith('sk-ant-')) {
      toast('API key should start with sk-ant-', 'error');
      return;
    }
    if (key) Storage.setApiKey(key);
    if (proxy) Storage.setProxyUrl(proxy);
    else Storage.clearProxyUrl();
    // Refresh proxy input to show normalized URL
    $('modal-proxy-input').value = Storage.getProxyUrl();
    closeKeyModal();
    toast('Settings saved.', 'success');
  });

  $('modal-key-clear').addEventListener('click', () => {
    Storage.clearApiKey();
    Storage.clearProxyUrl();
    location.reload();
  });
}

function openKeyModal() {
  // Pre-fill with stored key — shows as dots (password field), confirming it's saved
  $('modal-key-input').value   = Storage.getApiKey();
  $('modal-proxy-input').value = Storage.getProxyUrl();
  $('key-modal').classList.remove('hidden');
  $('key-modal-overlay').classList.remove('hidden');
}

function closeKeyModal() {
  $('key-modal').classList.add('hidden');
  $('key-modal-overlay').classList.add('hidden');
}

// ── Boot ──
function initApp() {
  initTabs();
  initIntake();
  initProfiles();
  initScoreModal();
  initKeyReset();
}

document.addEventListener('DOMContentLoaded', () => {
  initVersion();
  initGate();
});
