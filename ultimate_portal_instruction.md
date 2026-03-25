# Ultimate Build Instruction File
## PrepMe, Modern AI Interview Prep Portal

Use this instruction file to build PrepMe, a modern AI-powered interview preparation portal. The uploaded HTML is only a prototype for flow reference, not a design system to copy. Keep the strong portal logic, modular learning journey, interview prep sections, quiz flow, and mock interview concept, but redesign the product with a more modern visual language, cleaner spacing, fresher components, and a premium SaaS feel. Source reference: the uploaded HTML shows the general portal pattern, tabbed learning flow, quiz logic, and mock interview experience that should be reinterpreted into a more current product design. fileciteturn1file0

## Product Goal
Create a unique platform portal where a user prepares for a job interview by submitting core hiring materials. The system should read the materials, extract context, generate an interview learning deck, analyze the resume against the role, create a personalized interviewer agent, and provide a guided mock interview experience.

The portal should feel like a polished private prep workspace, not a generic form page.

## Core User Outcome
After uploading the required files and optional context, the user should get:
- a job scope breakdown
- a fit and gap analysis against their resume
- a personalized interviewer profile or fallback interviewer persona
- a Q&A prep deck
- a quiz section
- a mock interview chat experience
- a cover letter comparison if provided
- company culture and review context if Glassdoor link is provided

## Inputs
Build the intake flow around these 5 items.

### 1. Mandatory, Job Link or JD Description
Allow either:
- a URL input for the job posting link
- a large textarea for pasting the full job description

Rules:
- user must provide at least one
- if both are provided, merge both sources and deduplicate overlapping content
- if the job link fails to parse, fall back to the pasted JD
- if only pasted JD is provided, process as primary source

### 2. Mandatory, Resume Upload
Allow upload of common formats:
- PDF
- DOCX
- TXT

Rules:
- parse the document into structured sections
- extract profile summary, roles, years, achievements, tools, industries, metrics, education, certifications
- identify measurable achievements
- detect likely missing metrics

### 3. Optional, Employer LinkedIn URL
Allow a field for the employer hiring profile or company hiring manager profile.

Rules:
- if profile exists, use it to personalize interviewer tone, seniority, likely probing style, and topic emphasis
- if the system cannot extract enough profile data, fall back gracefully
- if not provided at all, use a default interviewer persona

Default interviewer fallback rules:
- choose one random professional hiring agent name from a preset pool
- examples: Maya Chen, Ethan Brooks, Nina Patel, Marcus Hale, Olivia Tan, Julian Reeves
- assign a default persona such as Professional Hiring Manager, Direct Product Lead, Structured Recruiter, Technical PM Interviewer

### 4. Optional, Cover Letter Upload
Allow upload of common formats:
- PDF
- DOCX
- TXT

Rules:
- compare claims in the cover letter against the resume and JD
- highlight alignment, repeated strengths, unsupported claims, and missing keywords
- use it to strengthen talking points and the mock interview narrative

### 5. Optional, Glassdoor Link
Allow a URL field for the company Glassdoor page.

Rules:
- use company review context to tailor culture prep, interview expectations, and likely concerns
- if no Glassdoor link is provided, show a helper hyperlink near the field that teaches the user how to search manually
- helper text example: Search Google for: company name Glassdoor interviews or company name Glassdoor reviews
- make the helper link clickable and open in a new tab

## Platform Experience
The final product should follow a modular page structure similar to the uploaded HTML, but generalized into a reusable portal. The reference file uses tabbed navigation and a clean page-by-page story flow. Keep that pattern. fileciteturn1file1turn1file4

## Required Portal Sections
Create these top navigation tabs.

### 1. Overview
Purpose:
Give the user a fast executive summary.

Content blocks:
- role title
- company name
- readiness score
- top fit signals
- top risks or gaps
- interview probability themes
- quick prep summary

Card ideas:
- The real brief
- Why this role exists
- What they likely care about
- Your strongest angles

### 2. Job Scope
Purpose:
Turn the JD into a digestible learning deck.

Content blocks:
- role mission
- main responsibilities grouped by theme
- skills expected
- tools and domain knowledge expected
- success metrics implied by the JD
- team or stakeholder exposure implied by the JD
- inferred seniority level

Extra features:
- break each responsibility into plain English
- mark which parts are strategic, delivery, technical, operational, or stakeholder-facing
- show what is likely must-have versus nice-to-have

### 3. Resume Scan
Purpose:
Compare the user resume against the job.

Content blocks:
- match score
- strengths matched to JD bullets
- gaps matched to JD bullets
- measurable achievements pulled from resume
- missing or weak evidence areas
- ATS keyword overlap
- suggestions for stronger phrasing

Extra features:
- flag vague lines on the resume
- suggest what to emphasize verbally in the interview
- highlight stories with strongest business impact

### 4. Employer / Interviewer
Purpose:
Build a personalized interviewer profile.

If LinkedIn is present:
- infer interviewer background
- infer technical depth
- infer communication style
- infer likely question themes
- infer what they may respect in an answer

If LinkedIn is absent:
- create a default interviewer card with random name and professional persona
- assign interview style such as friendly but structured, direct and pragmatic, technical and detail-focused, or senior stakeholder style

Content blocks:
- interviewer summary
- likely mindset
- how to speak to them
- what they may probe
- mistakes to avoid

### 5. Your Edge
Purpose:
Build the user's narrative.

Content blocks:
- strongest relevant achievements
- transferable experience
- top 3 selling points
- top 3 concerns to manage
- how to address missing experience cleanly
- 30 second intro
- 60 second value pitch
- closing narrative

### 6. Q&A Prep
Purpose:
Generate tailored interview questions and model answers.

Question groups:
- general recruiter questions
- role-specific questions
- technical or domain questions
- behavioral questions
- stakeholder and conflict questions
- execution and prioritization questions
- company culture questions

Each question should include:
- why they may ask this
- what a strong answer should cover
- a model answer skeleton, not a robotic full script
- follow-up traps
- coaching notes

### 7. Quiz
Purpose:
Help the user retain key facts.

Quiz rules:
- generate 10 to 20 multiple choice questions
- use knowledge from JD, company context, interviewer profile, and resume fit
- show progress bar
- reveal correct answer with short explanation
- show final readiness result

### 8. Mock Interview
Purpose:
Create the chat experience from the reference HTML, but generalized for any role.

Modes:
- Junior
- Mid
- Senior
- Recruiter screen
- Hiring manager
- Technical deep dive
- Assessment defense

Core chat features:
- start interview button
- empty state screen
- interviewer avatar and status chip
- text input
- voice input if browser speech recognition is available
- typing indicator
- end and score button
- restart session button
- optional token counter if AI usage is metered
- optional TTS voice playback toggle

Scoring after the interview:
- clarity
- relevance
- confidence
- structure
- evidence quality
- role alignment
- communication polish

Return:
- overall score
- category breakdown
- strongest answer
- weakest answer
- improvement tips
- next 5 questions to practice

## Intake Screen Requirements
Before the deck appears, create a clean intake section.

Layout:
- premium drag and drop upload area
- grouped fields with short helper text
- clear required versus optional state
- process button at the bottom

Required fields logic:
- job link or pasted JD, one is required
- resume upload is required

Optional fields logic:
- LinkedIn
- cover letter upload
- Glassdoor link

Processing states:
- idle
- uploading
- parsing
- extracting insights
- generating portal
- ready
- failed with retry option

## Data Processing Requirements
The AI pipeline should process each input into structured data.

### JD Parser
Extract:
- job title
- company
- location
- role level
- responsibilities
- requirements
- preferred skills
- keywords
- domain signals
- metrics and goals mentioned

### Resume Parser
Extract:
- name
- headline
- years of experience
- role history
- achievements
- technologies
- industries
- education
- certifications
- leadership signals

### Cover Letter Parser
Extract:
- personal brand themes
- repeated claims
- motivation for the role
- company-specific tailoring
- unsupported claims versus resume

### LinkedIn Analyzer
Extract if available:
- person or company name
- title
- background summary
- probable communication style
- likely interview lens

### Glassdoor Analyzer
Extract if link is available:
- common interview rounds
- recurring review themes
- culture signals
- common complaints
- hiring process expectations

## AI Output Requirements
The portal should not dump raw AI text. Structure every output into crisp cards, lists, and action blocks.

Each generated section should feel like:
- researched
- customized
- interview-oriented
- visually scannable
- useful in under 30 seconds per section

## Design Direction
The uploaded HTML is a prototype reference for structure only. Do not follow its visual styling too closely. PrepMe should look more modern, cleaner, and more productized than the prototype. Use the reference for experience flow, not final aesthetics. fileciteturn1file1turn1file4

Target visual direction:
- modern SaaS product design
- polished onboarding portal feel
- cleaner spacing and lighter visual density
- premium but approachable interface
- strong hierarchy with modern typography
- smoother cards, cleaner iconography, better empty states
- sharper dashboard polish without looking like an old enterprise admin panel

Recommended UI style:
- neutral or lightly tinted dark mode, or a refined dual-theme system
- optional accent colors such as electric blue, violet, cyan, or a controlled coral, instead of locking into the red accent from the prototype
- layered glassmorphism or soft elevated cards used sparingly
- larger border radius, softer shadows, cleaner dividers
- modern top navigation or sidebar-tab hybrid
- richer progress indicators and more polished upload states
- avatar-driven interviewer cards with cleaner profile presentation
- modern chat surface for mock interview, similar to premium AI workspaces

Recommended design rules:
- single-page app feel
- mobile responsive
- max-width content canvas for reading sections
- full-height chat screen for mock interview
- subtle motion and micro-interactions
- no clutter
- no dated dashboard visuals
- no generic corporate template vibe

Suggested inspiration level, without copying:
- modern AI SaaS platforms
- premium onboarding dashboards
- clean productivity tools
- elegant learning portals

Design goal in one line:
PrepMe should feel like a premium AI command center for interview preparation, modern, clean, personal, and clearly beyond the prototype HTML.

## UX Rules
- keep copy sharp and easy to scan
- avoid long paragraphs unless in coaching sections
- every page should answer one user need
- prioritize action over decoration
- show the user what the AI inferred versus what was directly provided
- clearly mark assumptions
- allow edit and regenerate flow

## Personalization Logic
The portal must adapt based on inputs.

Examples:
- if resume strongly matches JD, emphasize confidence and advanced question prep
- if resume is weak, emphasize gap management and reframing transferable experience
- if cover letter is present, use tone and positioning from the letter
- if LinkedIn exists, make interviewer persona less generic
- if Glassdoor exists, add culture and process prep cards
- if no LinkedIn, use default interviewer and say profile-based personalization was unavailable

## Suggested App Structure
Use a component-based architecture.

Suggested major components:
- AppShell
- IntakeForm
- UploadDropzone
- ProcessingState
- TopNavTabs
- OverviewPage
- JobScopePage
- ResumeScanPage
- InterviewerPage
- EdgePage
- QAPrepPage
- QuizPage
- MockInterviewPage
- ScoreModal
- HelperLinkCard
- SourceTracePanel

## Suggested State Model
Store:
- intake values
- parsed documents
- generated insights
- interviewer persona
- quiz questions and answers
- mock interview history
- scores
- loading states
- errors
- regeneration flags

## Suggested Backend Capabilities
Needed services:
- file upload handler
- PDF and DOCX parser
- link fetcher for JD and Glassdoor pages
- AI orchestration layer
- structured JSON output formatter
- session persistence or local draft save

## Output Schema Suggestion
Generate normalized objects like:
- jobProfile
- resumeProfile
- coverLetterProfile
- interviewerProfile
- companyReviewProfile
- fitAnalysis
- learningDeck
- quizSet
- mockInterviewConfig

## Default Interviewer Persona Pool
Use fallback names such as:
- Maya Chen
- Ethan Brooks
- Nina Patel
- Marcus Hale
- Olivia Tan
- Julian Reeves

Persona styles:
- structured recruiter
- direct hiring manager
- technical product lead
- pragmatic operations leader

## Example Prompting Rules for AI Engine
Use structured prompts behind the scenes.

Prompt jobs should include:
- parse the input
- identify evidence
- extract measurable claims
- infer role expectations
- produce concise structured output
- avoid hallucinating company facts not supported by uploaded data or trusted sources
- mark inferred items explicitly

## Error Handling
- if JD link fails, ask user to paste JD text
- if resume parsing fails, allow reupload
- if LinkedIn profile is blocked or empty, use default interviewer persona
- if Glassdoor content cannot be parsed, keep the helper link and skip culture section gracefully
- if cover letter is missing, do not show error, simply omit comparison blocks

## Nice-to-Have Features
- save portal state locally
- export prep deck as PDF
- export likely interview questions as markdown
- copy answer coaching notes
- pin strongest stories
- countdown to interview date
- confidence tracker across mock interview attempts

## Build Constraint
This portal should feel custom and premium, like a private AI prep command center. Do not make it look like a plain ATS checker or simple chatbot wrapper.

## Final Build Summary
Build PrepMe as a modern, premium, AI-powered interview prep portal. The user provides a job link or pasted JD, a resume, and optional LinkedIn, cover letter, and Glassdoor links. The system parses all content, generates a learning deck, scans resume fit, personalizes an interviewer persona, creates tailored Q&A and quizzes, and runs a scored mock interview in a chat interface. Keep the portal logic and prep journey inspired by the uploaded prototype, but redesign the experience with a cleaner, more modern product aesthetic and a reusable, document-driven architecture. fileciteturn1file0turn1file1turn1file4
