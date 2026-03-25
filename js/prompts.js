/* ── AI Prompts & Portal Generation Pipeline ── */

const Prompts = {

  SYSTEM: `You are PrepMe, a senior interview preparation strategist.
Analyze job materials and produce structured, personalized interview prep content.
Be specific, honest, and actionable. Mark inferred information with [inferred].
Respond ONLY with valid JSON matching the exact schema. No extra text, no markdown fences.`,

  SYSTEM_MOCK: (interviewer, role, company) =>
    `You are ${interviewer.name}, ${interviewer.title} at ${company}.
You are conducting a ${role} interview in your style: ${interviewer.style}.
Ask one focused interview question at a time. React naturally to answers.
Be professional but human. Probe weak answers. Acknowledge strong ones.
Do not break character. Do not offer coaching mid-interview.`,

  // ── Shared context block ──
  _ctx(inputs) {
    const { jdText, pastedJD, resumeText, coverText, linkedinText, glassdoorText } = inputs;
    const jd = [jdText, pastedJD].filter(Boolean).join('\n\n---\n\n');
    return `=== JOB DESCRIPTION ===\n${jd || 'Not provided'}\n\n=== RESUME ===\n${resumeText || 'Not provided'}\n\n=== COVER LETTER ===\n${coverText || 'Not provided'}\n\n=== INTERVIEWER LINKEDIN ===\n${linkedinText || 'Not provided'}\n\n=== COMPANY/GLASSDOOR DATA ===\n${glassdoorText || 'Not provided'}`;
  },

  // ── Call 1: Overview + fit analysis ──
  async _genOverview(inputs) {
    const prompt = `${this._ctx(inputs)}

Return ONLY this JSON (no fences, no extra text):
{"meta":{"role":"<job title>","company":"<company>","generatedAt":${Date.now()}},"overview":{"readinessScore":<0-100>,"topFitSignals":["<string>"],"topRisks":["<string>"],"interviewThemes":["<string>"],"quickSummary":"<2-3 sentences>","realBrief":"<what this role is really about>","whatTheyCareAbout":"<top 3 things employer values>","yourStrongestAngles":["<string>"]}}`;
    return AI.callJSON(this.SYSTEM, prompt, 2000);
  },

  // ── Call 2: Job scope breakdown ──
  async _genJobScope(inputs) {
    const prompt = `${this._ctx(inputs)}

Return ONLY this JSON (no fences, no extra text):
{"jobScope":{"roleMission":"<string>","responsibilities":[{"theme":"<string>","items":["<string>"],"type":"strategic|delivery|technical|operational|stakeholder","priority":"must-have|nice-to-have"}],"skillsExpected":["<string>"],"toolsExpected":["<string>"],"successMetrics":["<string>"],"stakeholderExposure":["<string>"],"seniorityLevel":"<string>"}}

Include 4-6 responsibility themes. Be specific to this role.`;
    return AI.callJSON(this.SYSTEM, prompt, 3500);
  },

  // ── Call 3: Resume scan + interviewer + edge ──
  async _genAnalysis(inputs) {
    const prompt = `${this._ctx(inputs)}

Return ONLY this JSON (no fences, no extra text):
{"resumeScan":{"matchScore":<0-100>,"strengths":[{"point":"<string>","evidence":"<string>"}],"gaps":[{"gap":"<string>","severity":"high|medium|low","suggestion":"<string>"}],"atsKeywords":{"matched":["<string>"],"missing":["<string>"]},"phrasingSuggestions":[{"original":"<string>","improved":"<string>"}],"storiesWithImpact":["<string>"]},"interviewer":{"name":"<realistic name>","title":"<title>","emoji":"<single emoji>","style":"friendly but structured|direct and pragmatic|technical and detail-focused|senior stakeholder style","background":"<2 sentences>","likelyMindset":"<string>","howToSpeakToThem":"<string>","likelyProbes":["<string>"],"mistakesToAvoid":["<string>"],"isDefault":<true if no LinkedIn data>},"edge":{"strongestAchievements":["<string>"],"transferableExperience":["<string>"],"top3SellingPoints":["<string>"],"top3ConcernsToManage":["<string>"],"addressingGaps":"<string>","thirtySecondIntro":"<string>","sixtySecondPitch":"<string>","closingNarrative":"<string>"},"mockConfig":{"openingQuestion":"<string>","modes":["Junior","Mid","Senior","Recruiter Screen","Hiring Manager","Technical Deep Dive"]}}`;
    return AI.callJSON(this.SYSTEM, prompt, 4000);
  },

  // ── Call 4: Q&A bank ──
  async _genQA(inputs) {
    const prompt = `${this._ctx(inputs)}

Generate a Q&A prep bank. Return ONLY this JSON (no fences, no extra text):
{"qa":{"groups":[{"category":"<category name>","questions":[{"question":"<string>","whyAsked":"<string>","whatStrongAnswerCovers":"<string>","modelSkeleton":"<string>","followUpTraps":["<string>"],"coachingNotes":"<string>"}]}]}}

Use exactly these 7 categories: "General Recruiter", "Role-Specific", "Technical/Domain", "Behavioral", "Stakeholder & Conflict", "Execution & Prioritization", "Company Culture".
4 questions per category, tailored to this specific role and company.`;
    return AI.callJSON(this.SYSTEM, prompt, 6000);
  },

  // ── Call 5: Quiz ──
  async _genQuiz(inputs) {
    const prompt = `${this._ctx(inputs)}

Generate a 15-question multiple choice quiz. Return ONLY this JSON (no fences, no extra text):
{"quiz":{"questions":[{"q":"<string>","choices":["A. <string>","B. <string>","C. <string>","D. <string>"],"correct":<0-3>,"explanation":"<string>"}]}}

Mix: industry knowledge, role-specific scenarios, and behavioral judgment questions.`;
    return AI.callJSON(this.SYSTEM, prompt, 2500);
  },

  // ── Main pipeline: 5 calls, calls 2+3 run in parallel ──
  async generatePortal(inputs, onStep) {
    // Step: Analyzing fit & gaps
    onStep?.('analyze');
    const overviewData = await this._genOverview(inputs);

    // Step: Generating your prep deck (job scope + analysis in parallel)
    onStep?.('core');
    const [jobScopeData, analysisData] = await Promise.all([
      this._genJobScope(inputs),
      this._genAnalysis(inputs),
    ]);

    // Step: Building Q&A and quiz
    onStep?.('qa');
    const qaData = await this._genQA(inputs);

    // Step: Configuring mock interview
    onStep?.('quiz');
    const quizData = await this._genQuiz(inputs);

    return {
      meta:        overviewData.meta        || {},
      overview:    overviewData.overview    || {},
      jobScope:    jobScopeData.jobScope    || {},
      resumeScan:  analysisData.resumeScan  || {},
      interviewer: analysisData.interviewer || {},
      edge:        analysisData.edge        || {},
      mockConfig:  analysisData.mockConfig  || {},
      qa:          qaData.qa               || { groups: [] },
      quiz:        quizData.quiz           || { questions: [] },
    };
  },

  scoreInterview(transcript, role) {
    const prompt = `Score this mock interview for a ${role} role.\n\n=== TRANSCRIPT ===\n${transcript}\n\nReturn ONLY this JSON (no fences):\n{"overallScore":<0-100>,"categories":{"clarity":<0-100>,"relevance":<0-100>,"confidence":<0-100>,"structure":<0-100>,"evidenceQuality":<0-100>,"roleAlignment":<0-100>,"communicationPolish":<0-100>},"strongestAnswer":"<string>","weakestAnswer":"<string>","improvementTips":["<string>"],"nextQuestionsToPractice":["<string>","<string>","<string>","<string>","<string>"]}`;
    return AI.callJSON(this.SYSTEM, prompt, 2000);
  },
};
