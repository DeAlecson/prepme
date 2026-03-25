/* ── AI Prompts & Portal Generation Pipeline ── */

const Prompts = {

  SYSTEM_PORTAL: `You are PrepMe, a senior interview preparation strategist.
Your job is to analyze job materials and produce a structured, personalized interview prep workspace.
Be specific, honest, and actionable. Mark inferred information with [inferred].
Always respond with valid JSON matching the exact schema requested. No extra text before or after the JSON.
Do not hallucinate company facts not supported by the provided data.`,

  SYSTEM_MOCK: (interviewer, role, company) =>
    `You are ${interviewer.name}, ${interviewer.title} at ${company}.
You are conducting a ${role} interview in your style: ${interviewer.style}.
Ask one focused interview question at a time. React naturally to answers.
Be professional but human. Probe weak answers. Acknowledge strong ones.
Do not break character. Do not offer coaching mid-interview.`,

  // ── Build shared context block reused across calls ──
  _context(inputs) {
    const { jdText, pastedJD, resumeText, coverText, linkedinText, glassdoorText } = inputs;
    const combinedJD = [jdText, pastedJD].filter(Boolean).join('\n\n---\n\n');
    return `=== JOB DESCRIPTION ===
${combinedJD || 'Not provided'}

=== RESUME ===
${resumeText || 'Not provided'}

=== COVER LETTER ===
${coverText || 'Not provided'}

=== INTERVIEWER LINKEDIN ===
${linkedinText || 'Not provided'}

=== GLASSDOOR / COMPANY CONTEXT ===
${glassdoorText || 'Not provided'}`;
  },

  // ── Call 1: Core portal sections (no QA, no quiz) ──
  async _generateCore(inputs) {
    const ctx = this._context(inputs);
    const content = `${ctx}

Analyze these materials and return ONLY a JSON object with this exact structure (no extra text):
{
  "meta": {
    "role": "job title",
    "company": "company name",
    "generatedAt": ${Date.now()}
  },
  "overview": {
    "readinessScore": 0-100,
    "topFitSignals": ["string"],
    "topRisks": ["string"],
    "interviewThemes": ["string"],
    "quickSummary": "2-3 sentence summary",
    "realBrief": "What this role is really about",
    "whatTheyCareAbout": "Top 3 things this employer values",
    "yourStrongestAngles": ["string"]
  },
  "jobScope": {
    "roleMission": "string",
    "responsibilities": [{ "theme": "string", "items": ["string"], "type": "strategic|delivery|technical|operational|stakeholder", "priority": "must-have|nice-to-have" }],
    "skillsExpected": ["string"],
    "toolsExpected": ["string"],
    "successMetrics": ["string"],
    "stakeholderExposure": ["string"],
    "seniorityLevel": "string"
  },
  "resumeScan": {
    "matchScore": 0-100,
    "strengths": [{ "point": "string", "evidence": "string" }],
    "gaps": [{ "gap": "string", "severity": "high|medium|low", "suggestion": "string" }],
    "achievements": ["string"],
    "atsKeywords": { "matched": ["string"], "missing": ["string"] },
    "phrasingSuggestions": [{ "original": "string", "improved": "string" }],
    "verboseLines": ["string"],
    "storiesWithImpact": ["string"]
  },
  "interviewer": {
    "name": "string",
    "title": "string",
    "emoji": "single emoji",
    "style": "friendly but structured|direct and pragmatic|technical and detail-focused|senior stakeholder style",
    "background": "string",
    "likelyMindset": "string",
    "howToSpeakToThem": "string",
    "likelyProbes": ["string"],
    "mistakesToAvoid": ["string"],
    "isDefault": true
  },
  "edge": {
    "strongestAchievements": ["string"],
    "transferableExperience": ["string"],
    "top3SellingPoints": ["string"],
    "top3ConcernsToManage": ["string"],
    "addressingGaps": "string",
    "thirtySecondIntro": "string",
    "sixtySecondPitch": "string",
    "closingNarrative": "string"
  },
  "mockConfig": {
    "openingQuestion": "string",
    "modes": ["Junior", "Mid", "Senior", "Recruiter Screen", "Hiring Manager", "Technical Deep Dive"]
  }
}`;
    return AI.callJSON(this.SYSTEM_PORTAL, content, 6000);
  },

  // ── Call 2: Q&A bank ──
  async _generateQA(inputs) {
    const ctx = this._context(inputs);
    const content = `${ctx}

Based on these materials, generate a Q&A prep bank. Return ONLY a JSON object:
{
  "qa": {
    "groups": [
      {
        "category": "General Recruiter|Role-Specific|Technical/Domain|Behavioral|Stakeholder & Conflict|Execution & Prioritization|Company Culture",
        "questions": [
          {
            "question": "string",
            "whyAsked": "string",
            "whatStrongAnswerCovers": "string",
            "modelSkeleton": "string",
            "followUpTraps": ["string"],
            "coachingNotes": "string"
          }
        ]
      }
    ]
  }
}
Include all 7 categories. 4-5 questions per category tailored to the specific role and company.`;
    return AI.callJSON(this.SYSTEM_PORTAL, content, 6000);
  },

  // ── Call 3: Quiz ──
  async _generateQuiz(inputs) {
    const ctx = this._context(inputs);
    const content = `${ctx}

Generate a 15-question multiple choice quiz to test readiness for this role. Return ONLY a JSON object:
{
  "quiz": {
    "questions": [
      {
        "q": "string",
        "choices": ["A. string", "B. string", "C. string", "D. string"],
        "correct": 0,
        "explanation": "string"
      }
    ]
  }
}
Mix industry knowledge, role-specific scenarios, and behavioral judgment questions.`;
    return AI.callJSON(this.SYSTEM_PORTAL, content, 3000);
  },

  // ── Main: run all 3 calls, merge results ──
  async generatePortal(inputs, onStep) {
    onStep?.('core');
    const core = await this._generateCore(inputs);

    onStep?.('qa');
    const qaData = await this._generateQA(inputs);

    onStep?.('quiz');
    const quizData = await this._generateQuiz(inputs);

    return {
      ...core,
      qa:   qaData.qa   || { groups: [] },
      quiz: quizData.quiz || { questions: [] },
    };
  },

  scoreInterview(transcript, role) {
    const content = `
Score this mock interview for a ${role} role.

=== TRANSCRIPT ===
${transcript}

Return ONLY a JSON object:
{
  "overallScore": 0-100,
  "categories": {
    "clarity": 0-100,
    "relevance": 0-100,
    "confidence": 0-100,
    "structure": 0-100,
    "evidenceQuality": 0-100,
    "roleAlignment": 0-100,
    "communicationPolish": 0-100
  },
  "strongestAnswer": "quote or summary",
  "weakestAnswer": "quote or summary",
  "improvementTips": ["string"],
  "nextQuestionsToPractice": ["string", "string", "string", "string", "string"]
}`;
    return AI.callJSON(this.SYSTEM_PORTAL, content, 2048);
  },
};
