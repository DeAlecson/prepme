/* ── Portal Renderer — turns portal JSON into HTML ── */

const Renderer = {

  renderAll(portal) {
    this.renderOverview(portal.overview, portal.meta);
    this.renderJobScope(portal.jobScope);
    this.renderResumeScan(portal.resumeScan);
    this.renderInterviewer(portal.interviewer);
    this.renderEdge(portal.edge);
    this.renderQA(portal.qa);
  },

  _card(title, body, accent = '') {
    return `<div class="card ${accent}"><div class="card-title">${escapeHTML(title)}</div><div class="card-body">${body}</div></div>`;
  },

  _sec(label) {
    return `<div class="sec-header">${escapeHTML(label)}</div>`;
  },

  _tag(text, color = '') {
    return `<span class="tag ${color}">${escapeHTML(text)}</span>`;
  },

  _bar(value, color = '') {
    const c = value >= 70 ? 'green' : value >= 40 ? 'amber' : 'red';
    return `<div class="progress-bar"><div class="progress-fill ${color || c}" style="width:${value}%"></div></div>`;
  },

  // ── Overview ──
  renderOverview(o, meta) {
    const el = $('content-overview');
    const scoreColor = o.readinessScore >= 70 ? 'green' : o.readinessScore >= 40 ? 'amber' : 'red';
    el.innerHTML = `
      <h1 class="pg-title">${escapeHTML(meta.role || 'Your Role')} <span>@ ${escapeHTML(meta.company || 'Company')}</span></h1>
      <p class="pg-sub">Here's your executive prep summary. Know this before anything else.</p>

      <div class="stat-grid">
        <div class="stat">
          <div class="stat-val" style="color:var(--${scoreColor})">${o.readinessScore}<span style="font-size:16px">%</span></div>
          <div class="stat-lbl">Readiness Score</div>
        </div>
        <div class="stat">
          <div class="stat-val">${o.topFitSignals?.length || 0}</div>
          <div class="stat-lbl">Fit Signals</div>
        </div>
        <div class="stat">
          <div class="stat-val">${o.topRisks?.length || 0}</div>
          <div class="stat-lbl">Risk Areas</div>
        </div>
        <div class="stat">
          <div class="stat-val">${o.interviewThemes?.length || 0}</div>
          <div class="stat-lbl">Likely Themes</div>
        </div>
      </div>

      ${this._sec('The Real Brief')}
      ${this._card('What this role is really about', escapeHTML(o.realBrief || ''))}
      ${this._card('What they likely care about', escapeHTML(o.whatTheyCareAbout || ''))}

      ${this._sec('Your Strongest Angles')}
      <div class="card accent-green">
        <div class="card-body">${(o.yourStrongestAngles || []).map(a => `<div style="margin-bottom:6px">✦ ${escapeHTML(a)}</div>`).join('')}</div>
      </div>

      ${this._sec('Top Fit Signals')}
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px">
        ${(o.topFitSignals || []).map(s => this._tag(s, 'green')).join('')}
      </div>

      ${this._sec('Risks & Gaps to Manage')}
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px">
        ${(o.topRisks || []).map(r => this._tag(r, 'red')).join('')}
      </div>

      ${this._sec('Likely Interview Themes')}
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px">
        ${(o.interviewThemes || []).map(t => this._tag(t, 'violet')).join('')}
      </div>

      ${this._sec('Quick Prep Summary')}
      ${this._card('', escapeHTML(o.quickSummary || ''), 'accent-violet')}
    `;
  },

  // ── Job Scope ──
  renderJobScope(js) {
    const el = $('content-jobscope');
    const typeColors = { strategic:'violet', delivery:'blue', technical:'amber', operational:'', stakeholder:'green' };
    el.innerHTML = `
      <h1 class="pg-title">Job <span>Scope</span></h1>
      <p class="pg-sub">The JD decoded into what they actually want from you.</p>

      ${this._sec('Role Mission')}
      ${this._card('', escapeHTML(js.roleMission || ''), 'accent-violet')}

      ${this._sec('Responsibilities')}
      ${(js.responsibilities || []).map(r => `
        <div class="card accent-${typeColors[r.type] || 'blue'}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px">
            <div class="card-title">${escapeHTML(r.theme)}</div>
            <div style="display:flex;gap:5px;flex-shrink:0">
              ${this._tag(r.type || '', '')}
              ${this._tag(r.priority || '', r.priority === 'must-have' ? 'red' : 'amber')}
            </div>
          </div>
          <ul style="padding-left:18px;color:var(--text-muted);font-size:13px;line-height:1.8">
            ${(r.items || []).map(i => `<li>${escapeHTML(i)}</li>`).join('')}
          </ul>
        </div>
      `).join('')}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
        <div>
          ${this._sec('Skills Expected')}
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${(js.skillsExpected || []).map(s => this._tag(s)).join('')}
          </div>
        </div>
        <div>
          ${this._sec('Tools & Domain')}
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${(js.toolsExpected || []).map(t => this._tag(t, 'amber')).join('')}
          </div>
        </div>
      </div>

      ${this._sec('Success Metrics')}
      ${(js.successMetrics || []).map(m => this._card('', `✦ ${escapeHTML(m)}`)).join('')}

      ${this._sec('Seniority Signal')}
      ${this._card('Inferred Level', escapeHTML(js.seniorityLevel || ''), 'accent-amber')}
    `;
  },

  // ── Resume Scan ──
  renderResumeScan(rs) {
    const el = $('content-resume');
    el.innerHTML = `
      <h1 class="pg-title">Resume <span>Scan</span></h1>
      <p class="pg-sub">How your resume stacks up against this role.</p>

      <div class="stat-grid" style="margin-bottom:28px">
        <div class="stat">
          <div class="stat-val" style="color:var(--${rs.matchScore >= 70 ? 'green' : rs.matchScore >= 40 ? 'amber' : 'red'})">${rs.matchScore}%</div>
          <div class="stat-lbl">Match Score</div>
        </div>
        <div class="stat">
          <div class="stat-val">${(rs.strengths || []).length}</div>
          <div class="stat-lbl">Strengths Found</div>
        </div>
        <div class="stat">
          <div class="stat-val">${(rs.gaps || []).length}</div>
          <div class="stat-lbl">Gaps Detected</div>
        </div>
      </div>

      ${this._sec('Strengths Matched to JD')}
      ${(rs.strengths || []).map(s => `
        <div class="card accent-green">
          <div class="card-title">${escapeHTML(s.point)}</div>
          <div class="card-body">${escapeHTML(s.evidence)}</div>
        </div>
      `).join('')}

      ${this._sec('Gaps to Address')}
      ${(rs.gaps || []).map(g => `
        <div class="card accent-${g.severity === 'high' ? 'red' : g.severity === 'medium' ? 'amber' : 'blue'}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div class="card-title">${escapeHTML(g.gap)}</div>
            ${this._tag(g.severity, g.severity === 'high' ? 'red' : g.severity === 'medium' ? 'amber' : '')}
          </div>
          <div class="card-body">💡 ${escapeHTML(g.suggestion)}</div>
        </div>
      `).join('')}

      ${this._sec('ATS Keyword Coverage')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div>
          <div style="font-size:11px;color:var(--green);font-weight:600;margin-bottom:8px">✓ MATCHED</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px">${(rs.atsKeywords?.matched || []).map(k => this._tag(k, 'green')).join('')}</div>
        </div>
        <div>
          <div style="font-size:11px;color:var(--red);font-weight:600;margin-bottom:8px">✗ MISSING</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px">${(rs.atsKeywords?.missing || []).map(k => this._tag(k, 'red')).join('')}</div>
        </div>
      </div>

      ${this._sec('Impact Stories to Highlight')}
      ${(rs.storiesWithImpact || []).map(s => this._card('', `⭐ ${escapeHTML(s)}`, 'accent-violet')).join('')}

      ${rs.phrasingSuggestions?.length ? `
        ${this._sec('Phrasing Upgrades')}
        ${(rs.phrasingSuggestions || []).map(p => `
          <div class="card">
            <div style="font-size:12px;color:var(--red);margin-bottom:6px;text-decoration:line-through">${escapeHTML(p.original)}</div>
            <div style="font-size:13px;color:var(--green)">→ ${escapeHTML(p.improved)}</div>
          </div>
        `).join('')}
      ` : ''}
    `;
  },

  // ── Interviewer ──
  renderInterviewer(iv) {
    const el = $('content-interviewer');
    el.innerHTML = `
      <h1 class="pg-title">Your <span>Interviewer</span></h1>
      <p class="pg-sub">${iv.isDefault ? 'No LinkedIn provided — using a default interviewer persona.' : 'Personalized based on LinkedIn profile data.'}</p>

      <div class="interviewer-card">
        <div class="interviewer-avatar">${escapeHTML(iv.emoji || '👤')}</div>
        <div class="interviewer-info">
          <div class="interviewer-name">${escapeHTML(iv.name)}</div>
          <div class="interviewer-title">${escapeHTML(iv.title)}</div>
          <div class="interviewer-style">
            ${this._tag(iv.style || '', 'violet')}
            ${iv.isDefault ? this._tag('Default Persona', 'amber') : this._tag('Profile-Based', 'green')}
          </div>
        </div>
      </div>

      ${this._sec('Background')}
      ${this._card('', escapeHTML(iv.background || ''))}

      ${this._sec('Their Likely Mindset')}
      ${this._card('', escapeHTML(iv.likelyMindset || ''), 'accent-violet')}

      ${this._sec('How to Speak to Them')}
      ${this._card('', escapeHTML(iv.howToSpeakToThem || ''), 'accent-green')}

      ${this._sec('What They Will Probe')}
      ${(iv.likelyProbes || []).map(p => this._card('', `❓ ${escapeHTML(p)}`)).join('')}

      ${this._sec('Mistakes to Avoid')}
      ${(iv.mistakesToAvoid || []).map(m => this._card('', `⚠️ ${escapeHTML(m)}`, 'accent-red')).join('')}
    `;
  },

  // ── Your Edge ──
  renderEdge(e) {
    const el = $('content-edge');
    el.innerHTML = `
      <h1 class="pg-title">Your <span>Edge</span></h1>
      <p class="pg-sub">Your narrative, angles, and talking points. Know these cold.</p>

      ${this._sec('Top 3 Selling Points')}
      ${(e.top3SellingPoints || []).map((p, i) => this._card(`${i+1}. ${p}`, '', 'accent-green')).join('')}

      ${this._sec('Top 3 Concerns to Manage')}
      ${(e.top3ConcernsToManage || []).map((p, i) => this._card(`${i+1}. ${p}`, '', 'accent-amber')).join('')}

      ${this._sec('Strongest Achievements')}
      ${(e.strongestAchievements || []).map(a => this._card('', `⭐ ${escapeHTML(a)}`, 'accent-violet')).join('')}

      ${this._sec('Transferable Experience')}
      ${(e.transferableExperience || []).map(t => this._card('', `→ ${escapeHTML(t)}`)).join('')}

      ${this._sec('How to Address Missing Experience')}
      ${this._card('Reframe Strategy', escapeHTML(e.addressingGaps || ''))}

      ${this._sec('Your 30-Second Intro')}
      <div class="card accent-violet" style="font-size:14px;line-height:1.8;color:var(--text)">${escapeHTML(e.thirtySecondIntro || '')}</div>

      ${this._sec('Your 60-Second Value Pitch')}
      <div class="card accent-blue" style="font-size:14px;line-height:1.8;color:var(--text)">${escapeHTML(e.sixtySecondPitch || '')}</div>

      ${this._sec('Closing Narrative')}
      <div class="card" style="font-size:14px;line-height:1.8;color:var(--text)">${escapeHTML(e.closingNarrative || '')}</div>
    `;
  },

  // ── Q&A ──
  renderQA(qa) {
    const el = $('content-qa');
    el.innerHTML = `
      <h1 class="pg-title">Q&amp;A <span>Prep</span></h1>
      <p class="pg-sub">Tailored questions with model answer frameworks. Click any question to expand.</p>
      ${(qa.groups || []).map(group => `
        <div class="qa-group">
          <div class="qa-group-title">${escapeHTML(group.category)}</div>
          ${(group.questions || []).map((q, i) => `
            <div class="qa-item" data-qa="${group.category}-${i}">
              <div class="qa-question" onclick="Renderer.toggleQA(this.parentElement)">
                <span class="qa-question-text">${escapeHTML(q.question)}</span>
                <span class="qa-chevron">▾</span>
              </div>
              <div class="qa-answer">
                <div class="qa-answer-section">
                  <div class="qa-answer-label">Why they ask this</div>
                  <div class="qa-answer-text">${escapeHTML(q.whyAsked)}</div>
                </div>
                <div class="qa-answer-section">
                  <div class="qa-answer-label">Strong answer covers</div>
                  <div class="qa-answer-text">${escapeHTML(q.whatStrongAnswerCovers)}</div>
                </div>
                <div class="qa-answer-section">
                  <div class="qa-answer-label">Model skeleton</div>
                  <div class="qa-answer-text" style="color:var(--accent-light)">${escapeHTML(q.modelSkeleton)}</div>
                </div>
                ${q.followUpTraps?.length ? `
                  <div class="qa-answer-section">
                    <div class="qa-answer-label">Follow-up traps</div>
                    ${q.followUpTraps.map(t => `<div class="qa-answer-text" style="color:var(--amber)">⚠ ${escapeHTML(t)}</div>`).join('')}
                  </div>
                ` : ''}
                <div class="qa-answer-section">
                  <div class="qa-answer-label">Coaching note</div>
                  <div class="qa-answer-text" style="color:var(--text-muted)">${escapeHTML(q.coachingNotes)}</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('')}
    `;
  },

  toggleQA(item) {
    item.classList.toggle('open');
  },

  // ── Score Modal ──
  renderScore(score) {
    const el = $('score-body');
    const cats = score.categories || {};
    const catLabels = {
      clarity: 'Clarity', relevance: 'Relevance', confidence: 'Confidence',
      structure: 'Structure', evidenceQuality: 'Evidence Quality',
      roleAlignment: 'Role Alignment', communicationPolish: 'Communication Polish',
    };
    el.innerHTML = `
      <div class="score-ring">
        <div class="score-number">${score.overallScore}</div>
        <div class="score-label">Overall Score</div>
      </div>
      ${this._bar(score.overallScore)}

      <div class="score-categories">
        ${Object.entries(catLabels).map(([key, label]) => `
          <div class="score-cat">
            <div class="score-cat-header">
              <span class="score-cat-name">${label}</span>
              <span class="score-cat-val">${cats[key] || 0}%</span>
            </div>
            ${this._bar(cats[key] || 0)}
          </div>
        `).join('')}
      </div>

      <div style="margin-top:24px">
        ${this._sec('Strongest Answer')}
        <div class="card accent-green"><div class="card-body">${escapeHTML(score.strongestAnswer || '')}</div></div>

        ${this._sec('Weakest Answer')}
        <div class="card accent-red"><div class="card-body">${escapeHTML(score.weakestAnswer || '')}</div></div>

        ${this._sec('Improvement Tips')}
        ${(score.improvementTips || []).map(t => `<div class="card"><div class="card-body">→ ${escapeHTML(t)}</div></div>`).join('')}

        ${this._sec('Next 5 Questions to Practice')}
        ${(score.nextQuestionsToPractice || []).map(q => `<div class="card"><div class="card-body">❓ ${escapeHTML(q)}</div></div>`).join('')}
      </div>
    `;
  },
};
