/* ── Quiz Engine ── */

const Quiz = {
  questions: [],
  current: 0,
  score: 0,
  answered: false,

  init(questions) {
    this.questions = questions || [];
    this.current = 0;
    this.score = 0;
    this.answered = false;
    this.render();
  },

  render() {
    const el = $('content-quiz');
    if (!this.questions.length) {
      el.innerHTML = `<h1 class="pg-title">Quiz</h1><p class="pg-sub">No quiz questions generated yet.</p>`;
      return;
    }

    if (this.current >= this.questions.length) {
      this.renderResults();
      return;
    }

    const q = this.questions[this.current];
    const pct = Math.round((this.current / this.questions.length) * 100);

    el.innerHTML = `
      <h1 class="pg-title">Knowledge <span>Quiz</span></h1>
      <p class="pg-sub">Test your prep. ${this.questions.length} questions based on your role and materials.</p>

      <div class="quiz-wrap">
        <div class="quiz-progress-bar">
          <div class="quiz-progress-label">
            <span>Question ${this.current + 1} of ${this.questions.length}</span>
            <span>${this.score} correct</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>

        <div class="quiz-card">
          <div class="quiz-q-label">Question ${this.current + 1}</div>
          <div class="quiz-q-text">${escapeHTML(q.q)}</div>
          <div class="quiz-choices" id="quiz-choices">
            ${(q.choices || []).map((c, i) => `
              <button class="quiz-choice" data-idx="${i}" onclick="Quiz.answer(${i})">${escapeHTML(c)}</button>
            `).join('')}
          </div>
          <div id="quiz-feedback" class="quiz-feedback" style="display:none"></div>
        </div>

        <div class="quiz-nav">
          <button id="quiz-next" class="btn btn-primary" style="display:none" onclick="Quiz.next()">
            ${this.current + 1 < this.questions.length ? 'Next Question →' : 'See Results'}
          </button>
        </div>
      </div>
    `;
    this.answered = false;
  },

  answer(idx) {
    if (this.answered) return;
    this.answered = true;

    const q = this.questions[this.current];
    const correct = q.correct;
    const choices = $$('.quiz-choice');

    choices.forEach(btn => {
      btn.disabled = true;
      const i = parseInt(btn.dataset.idx);
      if (i === correct) btn.classList.add('correct');
      else if (i === idx && i !== correct) btn.classList.add('wrong');
    });

    if (idx === correct) this.score++;

    const feedback = $('quiz-feedback');
    feedback.style.display = 'block';
    feedback.className = `quiz-feedback ${idx === correct ? 'correct' : 'wrong'}`;
    feedback.textContent = `${idx === correct ? '✓ Correct! ' : '✗ Incorrect. '}${q.explanation || ''}`;

    $('quiz-next').style.display = 'inline-flex';
  },

  next() {
    this.current++;
    this.render();
  },

  renderResults() {
    const el = $('content-quiz');
    const pct = Math.round((this.score / this.questions.length) * 100);
    const emoji = pct >= 80 ? '🎯' : pct >= 60 ? '📈' : '💪';

    el.innerHTML = `
      <div class="quiz-wrap">
        <div class="quiz-results">
          <div style="font-size:48px;margin-bottom:12px">${emoji}</div>
          <div class="quiz-score-big">${pct}%</div>
          <div class="quiz-score-sub">${this.score} of ${this.questions.length} correct</div>
          <p style="font-size:13px;color:var(--text-muted);margin-top:16px;max-width:300px;margin-left:auto;margin-right:auto">
            ${pct >= 80 ? "You're well prepared on the knowledge side. Focus your remaining energy on the mock interview." :
              pct >= 60 ? "Good foundation. Review the Q&A Prep section for the topics you missed." :
              "More prep needed on the content. Go through Job Scope and Q&A Prep again before the interview."}
          </p>
          <button class="btn btn-primary" style="margin-top:24px" onclick="Quiz.init(Quiz.questions)">Retry Quiz</button>
        </div>
      </div>
    `;
  },
};
