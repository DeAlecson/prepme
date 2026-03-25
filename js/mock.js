/* ── Mock Interview Engine ── */

const Mock = {
  messages: [],
  interviewer: null,
  role: '',
  company: '',
  mode: 'Mid',
  started: false,
  ended: false,

  MODES: ['Junior', 'Mid', 'Senior', 'Recruiter Screen', 'Hiring Manager', 'Technical Deep Dive'],

  init(portal) {
    this.interviewer = portal.interviewer;
    this.role = portal.meta?.role || 'this role';
    this.company = portal.meta?.company || 'the company';
    this.openingQuestion = portal.mockConfig?.openingQuestion || `Tell me about yourself and why you're interested in this role.`;
    this.messages = [];
    this.started = false;
    this.ended = false;
    this.renderShell();
  },

  renderShell() {
    const iv = this.interviewer || {};

    // Header
    $('mock-header').innerHTML = `
      <div class="mock-avatar">${escapeHTML(iv.emoji || '👤')}</div>
      <div>
        <div class="mock-interviewer-name">${escapeHTML(iv.name || 'Interviewer')}</div>
        <div class="mock-interviewer-role">${escapeHTML(iv.title || 'Hiring Manager')}</div>
      </div>
      <div class="mock-mode-select" id="mock-mode-select">
        ${this.MODES.map(m => `<button class="mode-btn ${m === this.mode ? 'active' : ''}" onclick="Mock.setMode('${m}')">${escapeHTML(m)}</button>`).join('')}
      </div>
      <div class="mock-status">
        <span class="status-chip" id="mock-status-chip">${this.started ? 'In Progress' : 'Ready'}</span>
      </div>
    `;

    // Empty state
    $('mock-messages').innerHTML = `
      <div class="mock-empty" id="mock-empty">
        <div class="mock-empty-icon">${escapeHTML(iv.emoji || '🎤')}</div>
        <div class="mock-empty-title">Ready when you are</div>
        <div class="mock-empty-sub">You'll be interviewed by ${escapeHTML(iv.name || 'your interviewer')} for the ${escapeHTML(this.role)} role. Choose a mode and start.</div>
        <button class="btn btn-primary" style="margin-top:8px" onclick="Mock.start()">Start Interview</button>
      </div>
    `;

    // Input bar state
    $('mock-send').onclick = () => Mock.sendMessage();
    $('mock-end').onclick = () => Mock.endInterview();
    $('mock-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); Mock.sendMessage(); }
    });
    $('mock-input').addEventListener('input', () => autoGrow($('mock-input')));
  },

  setMode(mode) {
    this.mode = mode;
    $$('.mode-btn').forEach(b => b.classList.toggle('active', b.textContent === mode));
  },

  async start() {
    this.started = true;
    this.messages = [];
    $('mock-messages').innerHTML = '';
    $('mock-status-chip').textContent = 'In Progress';

    const openingMsg = this.openingQuestion;
    this.addMessage('interviewer', openingMsg);
    this.messages.push({ role: 'assistant', content: openingMsg });
  },

  async sendMessage() {
    const input = $('mock-input');
    const text = input.value.trim();
    if (!text || this.ended) return;

    input.value = '';
    autoGrow(input);
    $('mock-send').disabled = true;

    this.addMessage('user', text);
    this.messages.push({ role: 'user', content: text });

    // Typing indicator
    const typingId = 'typing-' + Date.now();
    const typingEl = document.createElement('div');
    typingEl.className = 'msg interviewer';
    typingEl.id = typingId;
    typingEl.innerHTML = `<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
    $('mock-messages').appendChild(typingEl);
    this.scrollToBottom();

    try {
      const systemPrompt = Prompts.SYSTEM_MOCK(this.interviewer, this.role, this.company) +
        `\nInterview mode: ${this.mode}. Adjust depth and seniority expectations accordingly.`;

      // Build message history for context
      const apiMessages = this.messages.slice(-10); // last 10 for context window

      let responseText = '';
      const responseBubble = document.createElement('div');
      responseBubble.className = 'msg interviewer';
      responseBubble.innerHTML = `<div class="msg-name">${escapeHTML(this.interviewer?.name || 'Interviewer')}</div><div class="msg-bubble" id="stream-bubble"></div>`;

      typingEl.replaceWith(responseBubble);
      const bubble = $('stream-bubble');

      await AI.stream(systemPrompt, apiMessages, (chunk, full) => {
        responseText = full;
        bubble.textContent = full;
        this.scrollToBottom();
      });

      this.messages.push({ role: 'assistant', content: responseText });

    } catch (err) {
      typingEl.remove();
      toast(err.message || 'AI error. Check your API key.', 'error');
    }

    $('mock-send').disabled = false;
    $('mock-input').focus();
  },

  addMessage(role, text) {
    const iv = this.interviewer || {};
    const el = document.createElement('div');
    el.className = `msg ${role}`;
    el.innerHTML = `
      <div class="msg-name">${role === 'interviewer' ? escapeHTML(iv.name || 'Interviewer') : 'You'}</div>
      <div class="msg-bubble">${escapeHTML(text)}</div>
    `;
    $('mock-messages').appendChild(el);
    this.scrollToBottom();
  },

  scrollToBottom() {
    const msgs = $('mock-messages');
    msgs.scrollTop = msgs.scrollHeight;
  },

  async endInterview() {
    if (!this.started || this.messages.length < 2) {
      toast('Have at least one exchange before ending.', 'error');
      return;
    }
    this.ended = true;
    $('mock-status-chip').textContent = 'Scoring...';
    $('mock-send').disabled = true;

    try {
      const transcript = this.messages
        .map(m => `${m.role === 'assistant' ? 'Interviewer' : 'Candidate'}: ${m.content}`)
        .join('\n\n');

      const score = await Prompts.scoreInterview(transcript, this.role);
      Renderer.renderScore(score);

      $('score-modal').classList.remove('hidden');
      $('score-overlay').classList.remove('hidden');
      $('mock-status-chip').textContent = 'Complete';

    } catch (err) {
      toast(err.message || 'Scoring failed. Try again.', 'error');
      this.ended = false;
      $('mock-send').disabled = false;
      $('mock-status-chip').textContent = 'In Progress';
    }
  },
};
