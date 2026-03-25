/* ── App Boot ── */

const APP_VERSION = '1.0.3';

function initVersion() {
  const stored = localStorage.getItem('prepme_version');
  if (stored !== APP_VERSION) {
    // Clear all prepme_ keys on version bump
    Object.keys(localStorage)
      .filter(k => k.startsWith('prepme_'))
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
  if (key) {
    showApp();
    return;
  }

  const gate = $('key-gate');
  const input = $('gate-key-input');
  const btn = $('gate-submit');

  btn.addEventListener('click', () => {
    const val = input.value.trim();
    if (!val.startsWith('sk-ant-')) {
      toast('Key should start with sk-ant-', 'error');
      return;
    }
    Storage.setApiKey(val);
    gate.style.display = 'none';
    showApp();
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') btn.click();
  });
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

  // Switch to processing screen
  switchTab('processing');
  const steps = ['proc-parse', 'proc-scrape', 'proc-analyze', 'proc-generate', 'proc-qa', 'proc-mock'];
  let stepIdx = 0;

  function setStep(i) {
    steps.forEach((s, si) => {
      const el = $(s);
      if (si < i) el.className = 'proc-step done';
      else if (si === i) el.className = 'proc-step active';
      else el.className = 'proc-step';
    });
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

    // Step 3 — Analyze
    setStep(2);

    // Step 4 — Generate portal
    setStep(3);
    let portal;
    try {
      portal = await Prompts.generatePortal({
        jdText: scraped.jdText,
        pastedJD: jdText,
        resumeText,
        coverText,
        linkedinText: scraped.linkedinText,
        glassdoorText: scraped.glassdoorText,
      });
    } catch (err) {
      throw new Error(`AI generation failed: ${err.message}`);
    }

    // Step 5 — Q&A ready
    setStep(4);
    await new Promise(r => setTimeout(r, 300));

    // Step 6 — Mock config ready
    setStep(5);
    await new Promise(r => setTimeout(r, 300));

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

// ── API Key Reset ──
function initKeyReset() {
  $('clear-key-btn').addEventListener('click', () => {
    Storage.clearApiKey();
    location.reload();
  });
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
