/* ── Mock Interview Engine ── */

const Mock = {
  messages: [],
  interviewer: null,
  role: '',
  company: '',
  mode: 'Mid',
  started: false,
  ended: false,

  // TTS state
  ttsEnabled: true,
  _ttsReady: false,
  _ttsVoices: [],

  // Mic / waveform state
  _micActive:    false,
  _recognition:  null,
  _audioCtx:     null,
  _analyser:     null,
  _micStream:    null,
  _waveformRAF:  null,

  MODES: ['Junior', 'Mid', 'Senior', 'Recruiter Screen', 'Hiring Manager', 'Technical Deep Dive'],

  // ── TTS Engine ────────────────────────────────────────
  _initTTS() {
    if (this._ttsReady || !window.speechSynthesis) return;
    this._ttsReady = true;
    this._ttsVoices = window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      this._ttsVoices = window.speechSynthesis.getVoices();
    };
    // Chrome bug: speechSynthesis pauses after ~15s — keep it alive
    setInterval(() => {
      if (this.ttsEnabled && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  },

  toggleTTS() {
    this.ttsEnabled = !this.ttsEnabled;
    const btn = $('tts-btn');
    if (!btn) return;
    if (this.ttsEnabled) {
      btn.textContent = '🔊 Voice On';
      btn.classList.add('tts-on');
    } else {
      window.speechSynthesis.cancel();
      btn.textContent = '🔇 Voice Off';
      btn.classList.remove('tts-on');
    }
  },

  speakText(text) {
    if (!this.ttsEnabled || !text?.trim() || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    // Strip markdown formatting
    const clean = text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')
      .replace(/#+\s/g, '')
      .trim();
    if (!clean) return;

    const voices = this._ttsVoices.length
      ? this._ttsVoices
      : window.speechSynthesis.getVoices();

    // Prefer English male voice; fallback to en-SG, en-GB, en-US, any English
    const voice = voices.find(v =>
      v.lang.startsWith('en') &&
      v.name.toLowerCase().includes('male') &&
      !v.name.toLowerCase().includes('female')
    ) || voices.find(v =>
      v.lang.startsWith('en-SG') || v.lang.startsWith('en-GB') || v.lang.startsWith('en-US')
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

    // Split into sentences for more natural phrasing
    const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
    const total = sentences.length;
    let done = 0;
    const btn = $('tts-btn');

    sentences.forEach((sentence, idx) => {
      const utt = new SpeechSynthesisUtterance(sentence.trim());
      utt.lang = 'en-SG';
      utt.rate = 0.95;
      utt.pitch = 1.0;
      utt.volume = 1.0;
      if (voice) utt.voice = voice;

      utt.onstart = () => {
        if (idx === 0 && btn) btn.textContent = '🔊 Speaking…';
      };
      utt.onend = () => {
        done++;
        if (done === total && btn && this.ttsEnabled) btn.textContent = '🔊 Voice On';
      };
      utt.onerror = () => {
        if (btn && this.ttsEnabled) btn.textContent = '🔊 Voice On';
      };
      window.speechSynthesis.speak(utt);
    });
  },

  // ── Mic + Speech Recognition ──────────────────────────
  _initMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    this._recognition = new SR();
    this._recognition.continuous      = true;
    this._recognition.interimResults   = true;
    this._recognition.lang             = 'en-US';

    this._recognition.onresult = (e) => {
      let final = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        e.results[i].isFinal
          ? (final += e.results[i][0].transcript + ' ')
          : (interim = e.results[i][0].transcript);
      }
      const input = $('mock-input');
      if (input) { input.value = final + interim; autoGrow(input); }
    };

    this._recognition.onend = () => {
      if (this._micActive) {
        try { this._recognition.start(); } catch {}
      }
    };
  },

  async toggleMic() {
    if (this._micActive) {
      this._micActive = false;
      try { this._recognition?.stop(); } catch {}
      this._stopWaveform();
      this._micStream?.getTracks().forEach(t => t.stop());
      this._micStream = null;
      const btn = $('mock-mic-btn');
      if (btn) { btn.classList.remove('mic-active'); btn.innerHTML = _micIcon(); }
      return;
    }

    if (!this._recognition) {
      toast('Speech recognition not supported in this browser.', 'error');
      return;
    }

    try {
      this._micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      toast('Microphone access denied.', 'error');
      return;
    }

    this._micActive = true;

    // Wire up AudioContext analyser for the waveform
    this._audioCtx  = new AudioContext();
    this._analyser  = this._audioCtx.createAnalyser();
    this._analyser.fftSize = 128;
    this._audioCtx.createMediaStreamSource(this._micStream).connect(this._analyser);

    try { this._recognition.start(); } catch {}
    this._startWaveform();

    const btn = $('mock-mic-btn');
    if (btn) { btn.classList.add('mic-active'); btn.innerHTML = _stopIcon(); }
  },

  _startWaveform() {
    const waveform = $('mock-waveform');
    if (!waveform) return;
    waveform.classList.remove('hidden');

    const bars = Array.from({ length: 5 }, (_, i) => document.getElementById(`wbar-${i}`));
    const data = new Uint8Array(this._analyser.frequencyBinCount);
    // Frequency bins to sample (low → high bands)
    const bins = [3, 6, 12, 22, 38];

    const animate = () => {
      if (!this._micActive) return;
      this._waveformRAF = requestAnimationFrame(animate);
      this._analyser.getByteFrequencyData(data);
      bars.forEach((bar, i) => {
        if (!bar) return;
        const amp = data[bins[i]] / 255;
        // Center bar (index 2) gets a slight boost
        const boost = i === 2 ? 1.2 : 1;
        const h = Math.max(4, Math.round(amp * 36 * boost));
        bar.style.height = `${h}px`;
      });
    };
    animate();
  },

  _stopWaveform() {
    if (this._waveformRAF) { cancelAnimationFrame(this._waveformRAF); this._waveformRAF = null; }
    const waveform = $('mock-waveform');
    if (waveform) waveform.classList.add('hidden');
    if (this._audioCtx) { this._audioCtx.close().catch(() => {}); this._audioCtx = null; this._analyser = null; }
    // Reset bars to min height
    Array.from({ length: 5 }, (_, i) => document.getElementById(`wbar-${i}`))
      .forEach(b => { if (b) b.style.height = '4px'; });
  },

  // ── Init & Shell ──────────────────────────────────────
  init(portal) {
    this.interviewer = portal.interviewer;
    this.role = portal.meta?.role || 'this role';
    this.company = portal.meta?.company || 'the company';
    this.openingQuestion = portal.mockConfig?.openingQuestion
      || `Tell me about yourself and why you're interested in this role.`;
    this.messages = [];
    this.started = false;
    this.ended = false;
    this._micActive = false;
    this._initTTS();
    this._initMic();
    this.renderShell();
  },

  renderShell() {
    const iv = this.interviewer || {};

    $('mock-header').innerHTML = `
      <div class="mock-avatar">${escapeHTML(iv.emoji || '👤')}</div>
      <div class="mock-interviewer-info">
        <div class="mock-interviewer-name">${escapeHTML(iv.name || 'Interviewer')}</div>
        <div class="mock-interviewer-role">${escapeHTML(iv.title || 'Hiring Manager')}</div>
      </div>
      <div class="mock-mode-select" id="mock-mode-select">
        ${this.MODES.map(m =>
          `<button class="mode-btn ${m === this.mode ? 'active' : ''}" onclick="Mock.setMode('${m}')">${escapeHTML(m)}</button>`
        ).join('')}
      </div>
      <div class="mock-controls">
        <button class="tts-btn tts-on" id="tts-btn" onclick="Mock.toggleTTS()">🔊 Voice On</button>
        <span class="status-chip" id="mock-status-chip">${this.started ? 'In Progress' : 'Ready'}</span>
      </div>
    `;

    $('mock-messages').innerHTML = `
      <div class="mock-empty" id="mock-empty">
        <div class="mock-empty-icon">${escapeHTML(iv.emoji || '🎤')}</div>
        <div class="mock-empty-title">Ready when you are</div>
        <div class="mock-empty-sub">You'll be interviewed by ${escapeHTML(iv.name || 'your interviewer')} for the ${escapeHTML(this.role)} role. Choose a mode and start.</div>
        <button class="btn btn-primary" style="margin-top:8px" onclick="Mock.start()">Start Interview</button>
      </div>
    `;

    // Set initial mic icon
    const micBtn = $('mock-mic-btn');
    if (micBtn) micBtn.innerHTML = _micIcon();

    $('mock-send').onclick   = () => Mock.sendMessage();
    $('mock-end').onclick    = () => Mock.endInterview();
    micBtn?.addEventListener('click', () => Mock.toggleMic());
    $('mock-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); Mock.sendMessage(); }
    });
    $('mock-input').addEventListener('input', () => autoGrow($('mock-input')));
  },

  setMode(mode) {
    this.mode = mode;
    $$('.mode-btn').forEach(b => b.classList.toggle('active', b.textContent === mode));
  },

  // ── Interview Flow ────────────────────────────────────
  async start() {
    this.started = true;
    this.messages = [];
    $('mock-messages').innerHTML = '';
    $('mock-status-chip').textContent = 'In Progress';

    const openingMsg = this.openingQuestion;
    this.addMessage('interviewer', openingMsg);
    this.messages.push({ role: 'assistant', content: openingMsg });
    this.speakText(openingMsg);
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
    const typingEl = document.createElement('div');
    typingEl.className = 'msg interviewer typing-msg';
    typingEl.innerHTML = `<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
    $('mock-messages').appendChild(typingEl);
    this.scrollToBottom();

    try {
      const systemPrompt = Prompts.SYSTEM_MOCK(this.interviewer, this.role, this.company) +
        `\nInterview mode: ${this.mode}. Adjust depth and seniority expectations accordingly.`;

      const apiMessages = this.messages.slice(-10);

      // Capture token baseline before call
      const tokensBefore = AI.session.inputTokens + AI.session.outputTokens;

      let responseText = '';
      const responseBubble = document.createElement('div');
      responseBubble.className = 'msg interviewer';
      responseBubble.innerHTML = `
        <div class="msg-name">${escapeHTML(this.interviewer?.name || 'Interviewer')}</div>
        <div class="msg-bubble" id="stream-bubble"></div>
        <div class="msg-tokens" id="stream-tokens"></div>
      `;
      typingEl.replaceWith(responseBubble);
      const bubble = $('stream-bubble');

      await AI.stream(systemPrompt, apiMessages, (chunk, full) => {
        responseText = full;
        bubble.textContent = full;
        this.scrollToBottom();
      });

      // Show per-message token cost
      const tokensAfter = AI.session.inputTokens + AI.session.outputTokens;
      const msgTokens = tokensAfter - tokensBefore;
      const msgCost = msgTokens * ((AI.PRICE_INPUT + AI.PRICE_OUTPUT) / 2);
      const tokenBadge = document.getElementById('stream-tokens');
      if (tokenBadge && msgTokens > 0) {
        tokenBadge.textContent = `~${msgTokens.toLocaleString()} tokens · $${msgCost.toFixed(4)}`;
      }
      tokenBadge?.removeAttribute('id'); // clean up id so next message can reuse it

      this.messages.push({ role: 'assistant', content: responseText });

      // Speak the response after streaming completes
      this.speakText(responseText);

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

  // ── End & Score ───────────────────────────────────────
  async endInterview() {
    if (!this.started || this.messages.length < 2) {
      toast('Have at least one exchange before ending.', 'error');
      return;
    }
    // Stop TTS and mic before scoring
    window.speechSynthesis?.cancel();
    if (this._micActive) {
      this._micActive = false;
      try { this._recognition?.stop(); } catch {}
      this._stopWaveform();
      this._micStream?.getTracks().forEach(t => t.stop());
      this._micStream = null;
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
