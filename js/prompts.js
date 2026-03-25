/* ── AI Prompts & Portal Generation Pipeline ── */

const Prompts = {

  SYSTEM_PORTAL: `You are PrepMe, a senior interview preparation strategist.
Your job is to analyze job materials and produce a structured, personalized interview prep workspace.
Be specific, honest, and actionable. Mark inferred information with [inferred].
Always respond with valid JSON matching the exact schema requested.
Do not hallucinate company facts not supported by the provided data.`,

  SYSTEM_MOCK: (interviewer, role, company) =>
    `You are ${interviewer.name}, ${interviewer.title} at ${company}.
You are conducting a ${role} interview in your style: ${interviewer.style}.
Ask one focused interview question at a time. React naturally to answers.
Be professional but human. Probe weak answers. Acknowledge strong ones.
Do not break character. Do not offer coaching mid-interview.`,

  async generatePortal(inputs) {
    const { jdText, resumeText, coverText, linkedinText, glassdoorText, pastedJD } = inputs;

    const combinedJD = [jdText, pastedJD].filter(Boolean).join('\n\n---\n\n');

    const userContent = `
Analyze these interview materials and generate a complete PrepMe portal JSON.

=== JOB DESCRIPTION ===
${combinedJD || 'Not provided'}

=== RESUME ===
${resumeText || 'Not provided'}

=== COVER LETTER ===
${coverText || 'Not provided'}

=== INTERVIEWER LINKEDIN ===
${linkedinText || 'Not provided'}

=== GLASSDOOR / COMPANY CONTEXT ===
${glassdoorText || 'Not provided'}

Return ONLY a JSON object with this exact structure:
{
  "meta": {
    "role": "job title",
    "company": "company name",
    "generatedAt": ${Date.now()}
  },
  "overview": {
    "readinessScore": 0-100,
    "topFitSignals": ["string", ...],
    "topRisks": ["string", ...],
    "interviewThemes": ["string", ...],
    "quickSummary": "2-3 sentence summary",
    "realBrief": "What this role is really about",
    "whatTheyCareAbout": "Top 3 things this employer values",
    "yourStrongestAngles": ["string", ...]
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
    "verbosLines": ["string"],
    "storiesWithImpact": ["string"]
  },
  "interviewer": {
    "name": "string",
    "title": "string",
    "emoji": "single emoji representing persona",
    "style": "friendly but structured|direct and pragmatic|technical and detail-focused|senior stakeholder style",
    "background": "string",
    "likelyMindset": "string",
    "howToSpeakToThem": "string",
    "likelyProbes": ["string"],
    "mistakesToAvoid": ["string"],
    "isDefault": true|false
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
  },
  "quiz": {
    "questions": [
      {
        "q": "string",
        "choices": ["A. string", "B. string", "C. string", "D. string"],
        "correct": 0,
        "explanation": "string"
      }
    ]
  },
  "mockConfig": {
    "openingQuestion": "string",
    "modes": ["Junior", "Mid", "Senior", "Recruiter Screen", "Hiring Manager", "Technical Deep Dive"]
  }
}`;

    return AI.callJSON(this.SYSTEM_PORTAL, userContent, 8192);
  },

  scoreInterview(transcript, role) {
    const content = `
Score this mock interview for a ${role} role.

=== TRANSCRIPT ===
${transcript}

Return JSON:
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
  "improvementTips": ["string", ...],
  "nextQuestionsToPractice": ["string", "string", "string", "string", "string"]
}`;

    return AI.callJSON(this.SYSTEM_PORTAL, content, 2048);
  },
};
