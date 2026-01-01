# Octonix Assessment Platform - Complete Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Project Architecture](#project-architecture)
4. [Database Schema](#database-schema)
5. [User Flows](#user-flows)
6. [File Structure & Key Files](#file-structure--key-files)
7. [API Routes](#api-routes)
8. [Features & Functionality](#features--functionality)
9. [Environment Variables](#environment-variables)
10. [Deployment](#deployment)
11. [Development Guide](#development-guide)

---

## Project Overview

**Purpose**: A comprehensive candidate assessment platform for Octonix Solutions to evaluate candidates across multiple dimensions including personality, AI tool proficiency, domain knowledge, coding skills, and video interviews.

**Core Value Proposition**:
- Streamlined candidate evaluation process
- AI-powered scoring and analysis
- Video interview recording with proctoring
- Password-protected video sharing for team review
- Comprehensive PDF export of results

**Target Users**:
1. **Candidates**: Take multi-step assessments
2. **Admins**: Create assessments, review submissions, generate reports

---

## Tech Stack

### Frontend
- **Framework**: Next.js 16.1.0 (App Router with React 19)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **State Management**: React hooks (useState, useEffect, useRef)
- **Form Handling**: Controlled components with debounced autosave (600ms)

### Backend
- **Runtime**: Node.js (via Next.js API Routes)
- **Database**: PostgreSQL (via Supabase)
- **Storage**: Supabase Storage (for video recordings)
- **Authentication**: Custom admin authentication
- **AI Evaluation**: Groq API (llama-3.3-70b-versatile model)

### Media & Recording
- **Video Recording**: MediaRecorder API (browser native)
- **Audio Analysis**: Web Audio API (for live audio level visualization)
- **Video Format**: WebM with VP8/VP9 codec

### Deployment
- **Platform**: Vercel
- **Region**: Washington D.C. (iad1)
- **Build System**: Turbopack (Next.js 16)

### Key Libraries
- `zod` - Schema validation
- `next` - React framework
- `react` - UI library
- `typescript` - Type safety

---

## Project Architecture

### Application Structure
```
octonix-assessments/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Landing page
│   ├── globals.css               # Global styles + print CSS
│   ├── apply/[token]/           # Candidate assessment flow
│   │   └── applyFlow.tsx        # Main 5-step assessment
│   ├── admin/                   # Admin section
│   │   ├── page.tsx            # Admin home
│   │   ├── dashboard.tsx       # Create/manage assessments
│   │   ├── login/              # Admin authentication
│   │   └── [id]/               # View submission results
│   │       └── submissionClient.tsx
│   ├── video-access/[tokenId]/ # Password-protected video viewer
│   └── api/                    # API routes
│       ├── application/        # Candidate-side APIs
│       │   ├── load/           # Load assessment data
│       │   ├── save/           # Save answers
│       │   ├── submit/         # Submit assessment
│       │   ├── upload-video/   # Upload video recordings
│       │   └── log/            # Proctoring events
│       └── admin/              # Admin-side APIs
│           ├── submissions/    # Get assessment data
│           ├── run-ai-score/   # Trigger AI evaluation
│           ├── video-tokens/   # Generate video access links
│           └── cleanup-expired-videos/  # Delete old videos
├── lib/                         # Shared utilities
│   ├── assessmentConfig.ts     # Questions, roles, coding problems
│   ├── groq.ts                 # AI evaluation logic
│   ├── supabaseServer.ts       # Database client
│   └── types.ts                # TypeScript type definitions
├── components/                  # Reusable UI components
│   └── ui.tsx                  # Card, Button, Input, etc.
└── supabase.sql                # Database schema
```

### Data Flow

**Candidate Assessment Flow**:
1. Admin creates assessment link → generates unique token
2. Candidate visits `/apply/{token}` → loads assessment
3. Candidate completes 5 steps → auto-saves every 600ms
4. Candidate submits → status changes to "submitted"
5. Admin reviews → can trigger AI scoring
6. Admin exports PDF → includes video access links

**Video Recording Flow**:
1. Candidate grants camera/mic permissions
2. MediaRecorder captures video → chunks stored in memory
3. Upload to Supabase Storage → stored as WebM file
4. Admin generates one-time access token → password-protected
5. Reviewer accesses video → link marked as used
6. Expired videos deleted via cleanup API

---

## Database Schema

### Tables

#### 1. `candidate_assessments`
Main table storing all assessment data.

```sql
CREATE TABLE candidate_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,              -- Unique assessment link token
  admin_label TEXT NULL,                    -- Admin's label for candidate
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'submitted'
  current_step INTEGER NULL,                -- Current step (0-4) for resume
  answers JSONB NOT NULL DEFAULT '{}',      -- All candidate answers
  proctoring JSONB NOT NULL DEFAULT '{"counts": {}, "events": []}',
  videos JSONB NOT NULL DEFAULT '{}',       -- Video metadata (not actual files)
  ai_evaluations JSONB NOT NULL DEFAULT '{}', -- AI scoring results
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ NULL
);
```

**Answers JSONB Structure**:
```typescript
{
  personality?: {
    hobbies?: string[],              // Tag-based hobby input
    dailyAvailability?: {
      timezone: "EST" | "PST" | "CST" | "MST",
      schedule: [{
        days: string[],              // ["Monday", "Tuesday"]
        ranges: [{ start: "09:00", end: "17:00" }]  // Multiple ranges per day
      }]
    },
    pressureNotes?: string,
    honestyCommitment?: boolean
  },
  aiUsage?: {
    knownChatbots?: string,
    otherAiTools?: string,
    knownAgents?: string,
    automationTools?: string,
    promptTask1?: string,
    promptTask2?: string,
    promptTask3Problem?: string,     // NEW: Problem description
    promptTask3?: string             // AI prompt to solve problem
  },
  domain?: {
    selectedRoleId?: string          // "backend" | "frontend" | "fullstack" | etc.
  },
  domainKnowledge?: {
    answersByQuestionId?: { [questionId: string]: string },
    coding?: {
      language?: "python" | "java",
      problems?: [{
        problemId: string,
        skipped: boolean,
        usedHint: boolean,
        code: string
      }],
      optedOutOfCoding?: boolean
    }
  },
  video?: {
    attemptedQuestionIndices?: number[],
    recordings?: [{
      questionIndex: number,
      storagePath: string,           // Path in Supabase Storage
      durationSec: number,
      sizeBytes: number,
      createdAtIso: string
    }]
  }
}
```

**Proctoring JSONB Structure**:
```typescript
{
  counts: {
    "visibility_hidden": 3,
    "copy": 1,
    "suspected_devtools": 2,
    // ... event type counts
  },
  events: [{
    atIso: "2024-01-15T10:30:00Z",
    type: "copy" | "paste" | "window_blur" | "suspected_devtools" | etc.,
    details?: { key?: string, ... }
  }]
}
```

#### 2. `video_access_tokens`
One-time password-protected video access links.

```sql
CREATE TABLE video_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES candidate_assessments(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL,          -- Which video question (0-4)
  storage_path TEXT NOT NULL,               -- Path to video in storage
  password TEXT NOT NULL,                   -- 6-character alphanumeric
  expires_at TIMESTAMPTZ NOT NULL,          -- duration_sec * 15 minutes
  accessed_at TIMESTAMPTZ NULL,             -- When link was accessed
  is_used BOOLEAN NOT NULL DEFAULT FALSE,   -- One-time use flag
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_video_access_tokens_expires ON video_access_tokens(expires_at);
CREATE INDEX idx_video_access_tokens_assessment ON video_access_tokens(assessment_id);
```

### Storage Buckets

**Bucket**: `candidate-videos` (configured in Supabase)
- Stores video recordings as WebM files
- Path format: `{assessment_id}/{question_index}_{timestamp}.webm`
- Access: Private (requires signed URLs)
- Cleanup: Manual via `/api/admin/cleanup-expired-videos`

---

## User Flows

### Candidate Flow (5 Steps)

#### Step 0: Honesty Popup
**Purpose**: Set expectations before starting
- Shows popup on first visit
- "Read carefully" acknowledgment checkbox
- Stores `honestyCommitment: true` in answers

#### Step 1: Personality & Availability
**Fields**:
1. **Hobbies**: Tag-based input
   - Type and press Enter/Space/Comma to add
   - Auto-adds on blur (clicking outside)
   - Tags displayed with remove button

2. **Daily Availability**: Advanced timezone + schedule selector
   - Select timezone (EST/PST/CST/MST)
   - Add day groups (e.g., "Monday, Tuesday")
   - Multiple time ranges per day group
   - Example: Mon-Tue: 9-12, 14-17 (two ranges)

3. **Working Under Pressure**: Long-form text

**Validation**: All fields required

#### Step 2: AI Tool Usage
**Fields**:
1. Known AI chatbots (text)
2. Other AI tools used (text)
3. Known AI agents (text)
4. Automation tools (text)
5. **Prompt Task 1**: Generate weekly report prompt
6. **Prompt Task 2**: Debug code prompt
7. **Prompt Task 3**:
   - **Your problem** (NEW): Describe a real problem
   - **Your prompt for AI**: How you'd solve it with AI

**Validation**: All 7 fields required (including both parts of task 3)

#### Step 3: Domain Selection
**UI**: Grid of role cards
**Roles**: Backend, Frontend, Full-stack, DevOps, Data Engineer, Mobile, QA/Testing

**Validation**: Must select one role

#### Step 4: Domain Knowledge
**Part A: MCQ Questions** (role-specific)
- 5 multiple-choice questions per role
- Radio button selection
- All questions required

**Part B: Coding Problems** (optional)
- Language selection (Python or Java)
- 2 coding problems per language
- Monaco-like code editor (textarea)
- "Skip", "Show Hint", "I don't know coding" options
- Auto-saves code as user types (600ms debounce)

**Validation**: All MCQs required, coding optional

#### Step 5: Video Interview
**Questions**: 5 predefined video questions
**UI Features**:
- Camera preview (mirrored)
- 3-second countdown before recording
- **Audio level indicator**: 20 animated green bars (NEW)
- Recording indicator (red pulsing dot)
- Maximum 2 minutes per question
- Progress: "Question X of 5"

**Recording Flow**:
1. Click "Start Recording" → Request camera/mic
2. 3-second countdown → "3... 2... 1..."
3. Recording starts → Audio bars animate in real-time
4. Auto-stop at 2:00 or manual stop
5. Upload to Supabase → Show progress
6. Mark as completed (green checkmark)

**Features**:
- Can re-record (overwrites previous)
- Can skip questions
- Can opt out of video entirely
- Shows which questions attempted

**Technical**:
- Web Audio API for real-time audio analysis
- AnalyserNode with FFT size 256
- requestAnimationFrame for smooth updates
- Blob chunking for upload

#### Submission Screen
**After Step 5**:
- Success message
- Assessment details recap
- 15-second auto-redirect to landing page
- "Back to Home" manual button

### Admin Flow

#### 1. Login
**Path**: `/admin/login`
**Fields**: Username, Password
**Security**: Basic authentication (credentials in env vars)

#### 2. Dashboard
**Path**: `/admin`
**Features**:
1. **Create Assessment**:
   - Input candidate label (optional)
   - Click "Create Link"
   - **Auto-copies link to clipboard** (NEW)
   - Shows "Copied!" confirmation (green box)
   - Link persists after refresh (NEW)

2. **Assessment List**:
   - Table with columns: Label, Status, Created, Actions
   - **Shows assessment link with copy button** (NEW)
   - Individual copy buttons per assessment
   - "View Results" button → submission page
   - "Delete" button (with confirmation)

#### 3. View Submission Results
**Path**: `/admin/{id}`
**Sections** (all collapsible):

1. **Overview**:
   - Candidate name, role, status
   - "Run AI Scoring" button
   - AI error handling: **User-friendly messages** (NEW)

2. **Step 1: Personality**:
   - Hobbies (tag display)
   - Availability (formatted schedule)
   - Pressure notes

3. **Step 2: AI Usage**:
   - All tool responses
   - 3 prompts (including problem description)

4. **Step 3: Domain Selection**:
   - Selected role

5. **Step 4: Domain Knowledge**:
   - MCQ answers with correct/incorrect indicators
   - Coding submissions (if any)

6. **Step 5: Videos**:
   - Video playback (signed URLs, 60min expiry)
   - **One-Time Video Access Links** (NEW):
     - "Generate Links" button
     - Shows password-protected links
     - 6-char password (e.g., "A3K9P2")
     - Link format: `{domain}/video-access/{tokenId}`
     - Expiry time: video_duration × 15 minutes
     - Visible in PDF export

7. **Proctoring Signals**:
   - Event counts by type
   - Full event log with timestamps

8. **AI Evaluation** (if run):
   - Overall score (0-100)
   - Section scores (0-10 each)
   - Strengths (bullet points)
   - Risks (bullet points)
   - Recommended next steps

**Actions**:
- "Back" → Dashboard
- **"Export PDF"** → Print dialog with all sections expanded (NEW)
- "Download JSON" → Raw data export

#### 4. PDF Export
**Trigger**: "Export PDF" button
**Behavior**:
1. Expands ALL sections (400ms wait)
2. Opens browser print dialog
3. Restores previous section state after print
4. Includes video access links with passwords
5. Print CSS hides UI elements, optimizes layout

#### 5. Video Access Page
**Path**: `/video-access/{tokenId}`
**Public Page** (no admin auth required)

**Flow**:
1. Enter 6-character password
2. Click "Access Video"
3. Validates password, expiry, usage
4. Marks token as used
5. Shows video player (autoplay)
6. Cannot access again (one-time use)

**Error Handling**:
- Invalid password → "Incorrect password"
- Expired link → "This link has expired"
- Already used → "This link has already been used"
- Invalid token → "Invalid or expired link"

---

## File Structure & Key Files

### Core Application Files

#### `app/apply/[token]/applyFlow.tsx` (1400+ lines)
**Purpose**: Main candidate assessment flow
**Responsibilities**:
- 5-step wizard UI
- Form state management
- Debounced autosave (600ms)
- Video recording with audio monitoring
- Validation logic
- Proctoring event capture
- Step navigation

**Key State Variables**:
```typescript
currentStep: 0-4
answers: AllAnswers
videoState: { isRecording, countdownSecRemaining, activeQuestionIndex, ... }
audioLevel: 0-100  // NEW: For audio bars
proctorEvents: ProctoringEvent[]
savePending: boolean
```

**Key Functions**:
- `saveAnswers()` - Debounced save to database
- `startRecordingForActiveQuestion()` - MediaRecorder setup
- `startAudioMonitoring()` - Web Audio API setup (NEW)
- `uploadVideoBlob()` - Supabase upload
- `captureProctorEvent()` - Log suspicious behavior
- `isStepValid()` - Validation per step

#### `app/admin/[id]/submissionClient.tsx` (500+ lines)
**Purpose**: Admin view of candidate submission
**Responsibilities**:
- Display all answers in readable format
- Trigger AI evaluation
- Generate video access tokens
- PDF export functionality
- Collapsible sections

**Key State**:
```typescript
item: StoredAssessment
videoLinks: { questionIndex, url }[]
videoTokens: { questionIndex, tokenId, password, expiresAt }[]  // NEW
groqState: "idle" | "running" | "done" | "error"
expandedSections: Set<string>
```

**Key Functions**:
- `load()` - Fetch assessment data
- `exportPDF()` - Print with all sections expanded (NEW: improved)
- `generateVideoTokens()` - Create password-protected links (NEW)

#### `lib/assessmentConfig.ts`
**Purpose**: All questions, roles, and problems
**Exports**:
- `ROLE_MARKET`: Array of role definitions
- `DOMAIN_QUESTIONS`: MCQ questions per role
- `CODING_PROBLEMS`: Coding challenges per language
- `VIDEO_QUESTIONS`: 5 video interview questions

**Structure**:
```typescript
ROLE_MARKET = [
  {
    roleId: "backend",
    label: "Backend Developer",
    description: "...",
    codingLanguage: "python" | "java" | null
  }
]

DOMAIN_QUESTIONS = {
  backend: [
    { id: "backend_q1", question: "...", options: ["A", "B", "C", "D"], correct: "A" }
  ]
}

CODING_PROBLEMS = {
  python: [
    { id: "py_p1", title: "...", description: "...", starterCode: "...", hint: "..." }
  ]
}
```

#### `lib/groq.ts`
**Purpose**: AI evaluation via Groq API
**Key Function**: `evaluateWithGroq()`
**Input**: Role, answers, proctoring data
**Output**: Structured evaluation with scores

**Error Handling** (NEW - User-friendly):
```typescript
if (status === 429) → "AI service is experiencing high demand..."
if (status >= 500) → "AI service is temporarily down..."
else → "Unable to connect to AI service..."
```

**Response Schema** (Zod):
```typescript
{
  overallScore0to100: number,
  sectionScores: {
    honestySignal0to10: number,
    aiTooling0to10: number,
    promptEngineering0to10: number,
    domainBasics0to10: number,
    codingBasics0to10?: number,
    communication0to10?: number,
    integrityRisk0to10: number
  },
  strengths: string[],  // max 8
  risks: string[],      // max 8
  recommendedNextSteps: string[],  // max 8
  shortSummary: string  // max 600 chars
}
```

#### `lib/types.ts`
**Purpose**: TypeScript type definitions
**Key Types**:
- `PersonalityAnswers`
- `AiUsageAnswers` (includes `promptTask3Problem`)
- `DomainSelectionAnswers`
- `DomainKnowledgeAnswers`
- `VideoAnswers`
- `AllAnswers` (combines all above)
- `ProctoringEvent`
- `StoredAssessment`

#### `components/ui.tsx`
**Purpose**: Reusable UI components
**Components**:
- `OctonixFrame` - Layout wrapper with header/footer
- `Card` - Container with title and optional right content
- `Button` - Styled button (variants: primary, ghost, danger)
- `Input` - Text input field
- `Textarea` - Multi-line text input
- `TinyLabel` - Small label text
- `Muted` - Gray helper text
- `Divider` - Horizontal line

#### `app/globals.css`
**Purpose**: Global styles and print CSS
**Print Styles** (NEW enhancements):
```css
@media print {
  .print-hidden { display: none !important; }
  .print-block { display: block !important; }
  button { display: none !important; }
  video { display: none; }  /* Shows placeholder text */
}
```

---

## API Routes

### Candidate-Side APIs

#### `POST /api/application/load`
**Purpose**: Load assessment data for candidate
**Input**: `{ token }`
**Output**: `{ item, currentStep, isSubmitted }`
**Logic**:
- Validates token exists
- Returns assessment with current step
- Checks if already submitted

#### `POST /api/application/save`
**Purpose**: Auto-save candidate answers
**Input**: `{ token, answers, currentStep }`
**Output**: `{ ok: true }`
**Logic**:
- Merges new answers with existing
- Updates current_step for resume functionality
- Updates updated_at timestamp

#### `POST /api/application/submit`
**Purpose**: Final submission
**Input**: `{ token }`
**Output**: `{ ok: true }`
**Logic**:
- Sets status = "submitted"
- Sets submitted_at timestamp
- Prevents further edits

#### `POST /api/application/upload-video`
**Purpose**: Upload video recording
**Input**: `FormData { token, questionIndex, video (blob) }`
**Output**: `{ storagePath }`
**Logic**:
- Generates unique filename
- Uploads to Supabase Storage
- Saves metadata to answers.video.recordings

#### `POST /api/application/log`
**Purpose**: Log proctoring events
**Input**: `{ token, events: [{ type, details }] }`
**Output**: `{ ok: true }`
**Logic**:
- Increments event counts
- Appends to events array (max 4000 events)

### Admin-Side APIs

#### `GET /api/admin/submissions`
**Purpose**: List all assessments
**Output**: `{ items: StoredAssessment[] }`
**Auth**: Required (checks session)

#### `GET /api/admin/submissions/[id]`
**Purpose**: Get single assessment with video links
**Output**: `{ item, videoLinks }`
**Logic**:
- Fetches assessment
- Generates signed URLs for videos (60min expiry)

#### `POST /api/admin/run-ai-score/[id]`
**Purpose**: Trigger AI evaluation
**Output**: `{ ok: true }`
**Logic**:
- Fetches assessment
- Calls `evaluateWithGroq()`
- Stores result in ai_evaluations.overall

#### `POST /api/admin/video-tokens/[id]` (NEW)
**Purpose**: Generate one-time video access tokens
**Output**: `{ tokens: [{ questionIndex, tokenId, password, expiresAt }] }`
**Logic**:
- For each video recording:
  - Generate 6-char alphanumeric password
  - Calculate expiry: duration_sec × 15 minutes
  - Insert into video_access_tokens table
  - Return token info for display

**Password Generation**:
```typescript
chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  // No ambiguous chars
password = random 6 characters
```

#### `POST /api/video-access/[tokenId]` (NEW)
**Purpose**: Validate password and serve video
**Input**: `{ password }`
**Output**: `{ videoUrl, questionIndex }`
**Errors**:
- 400: Missing password
- 401: Incorrect password
- 404: Invalid token
- 410: Expired or already used

**Logic**:
1. Fetch token by ID
2. Validate password matches
3. Check expiry time
4. Check is_used flag
5. Mark as used (set is_used = true, accessed_at = now)
6. Generate signed URL (24hr expiry)
7. Return video URL

#### `GET/POST /api/admin/cleanup-expired-videos` (NEW)
**Purpose**: Delete expired videos from storage
**GET**: Check how many videos are expired
**POST**: Delete expired videos and tokens

**POST Logic**:
1. Find all tokens where expires_at < now
2. Extract unique storage paths
3. Delete files from Supabase Storage
4. Delete token records from database
5. Return counts (deleted, failed)

**Use Cases**:
- Manual cleanup via admin panel
- Scheduled cron job (future)
- Storage cost optimization

---

## Features & Functionality

### Candidate-Side Features

#### 1. Resume Functionality
- Candidates can close browser and return later
- `current_step` tracks progress
- Auto-loads last saved step
- Works until submission

#### 2. Auto-Save System
- Debounced saves every 600ms after typing
- Visual "Saving..." indicator
- Prevents data loss
- Saves answers + current step

#### 3. Proctoring System
**Monitored Events**:
- `visibility_hidden` - Tab not visible
- `window_blur` - Window lost focus
- `copy` - Ctrl+C pressed
- `paste` - Ctrl+V pressed
- `cut` - Ctrl+X pressed
- `context_menu` - Right-click
- `blocked_shortcut` - F12, Ctrl+Shift+I, etc.
- `suspected_devtools` - Window resize patterns
- `heartbeat` - Every 30 seconds (proof of activity)

**Capture Method**: Event listeners on document
**Storage**: Counts + full event log with timestamps
**Limit**: 4000 events max (trimmed)

#### 4. Tag-Based Hobby Input (NEW)
**Features**:
- Type and press Enter/Space/Comma
- **Auto-add on blur** (clicking outside)
- Visual tags with × remove button
- Stored as string array

**Implementation**:
```typescript
onBlur={() => {
  if (hobbyInput.trim()) addHobby(hobbyInput);
}}
```

#### 5. Advanced Availability Selector (NEW)
**Features**:
- Timezone selection (EST/PST/CST/MST)
- Day grouping (e.g., "Mon, Tue, Wed")
- **Multiple time ranges per day group**
- Add/remove ranges dynamically

**Example**:
```typescript
{
  timezone: "EST",
  schedule: [
    {
      days: ["Monday", "Tuesday"],
      ranges: [
        { start: "09:00", end: "12:00" },
        { start: "14:00", end: "17:00" }
      ]
    }
  ]
}
```

**UI**:
```
Days: [Mon] [Tue] [Wed] ...
Time Ranges:
  09:00 to 12:00 [×]
  14:00 to 17:00 [×]
  [+ Add Time Range]
```

#### 6. Separate Problem Field (NEW)
**Step 2, Prompt Task 3**:
- **Your problem**: Describe a real daily problem
- **Your prompt for AI**: How you'd solve it with AI

**Purpose**: Better assess problem identification + prompt engineering

#### 7. Audio Level Visualization (NEW)
**Features**:
- 20 animated green bars
- Real-time response to audio input
- Uses Web Audio API
- Smooth animations (requestAnimationFrame)

**Implementation**:
```typescript
// Setup
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 256;
const source = audioContext.createMediaStreamSource(stream);
source.connect(analyser);

// Update loop
const dataArray = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(dataArray);
const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
const normalizedLevel = Math.min(100, (average / 128) * 100);
```

**Visual**:
```
Recording... 🔴
━━━━━━━━━━━━━━━━━━━━  ← 20 bars, height based on audioLevel
```

### Admin-Side Features

#### 1. Auto-Copy Assessment Link (NEW)
**Features**:
- Automatically copies link to clipboard on creation
- Shows green "Copied!" confirmation box
- 2-second auto-dismiss
- Uses Clipboard API

**Code**:
```typescript
await navigator.clipboard.writeText(url);
setCopiedLink(true);
setTimeout(() => setCopiedLink(false), 2000);
```

#### 2. Persistent Assessment Links (NEW)
**Features**:
- Links shown in assessment list table
- Individual "Copy Link" buttons per assessment
- Link format: `{origin}/apply/{token}`
- Persists after page refresh

#### 3. User-Friendly AI Error Messages (NEW)
**Old**: "AI isn't working right now. Please try again later."

**New**:
```
Hmm, having trouble connecting to our AI assistant

Our AI scoring service is temporarily unavailable. This usually
resolves quickly. Feel free to try again in a moment, or continue
reviewing other sections manually.
```

**Styling**: Orange (not red), friendly tone

#### 4. Improved PDF Export (NEW)
**Features**:
- Expands all sections before print
- 400ms wait for DOM render (increased from 100ms)
- Auto-restores previous section state after print
- Uses `afterprint` event for restoration

**Print CSS**:
- Hides buttons, headers, footers
- Shows video access links
- Optimizes layout for A4
- Print-safe colors

#### 5. One-Time Video Access System (NEW)
**Complete Feature Set**:

**Admin Side**:
1. "Generate Links" button in video section
2. Creates password-protected tokens
3. Displays in blue box:
   - Link URL
   - 6-character password (green highlight)
   - Expiry time (human-readable)
   - "one-time use" label
4. Visible in PDF export

**Candidate/Reviewer Side**:
1. Public page at `/video-access/{tokenId}`
2. Password input (auto-uppercase)
3. Validates: password, expiry, usage
4. Plays video on success
5. Marks as used (cannot access again)

**Security**:
- Passwords: 6-char alphanumeric (no confusing chars)
- Expiry: video_duration × 15 (e.g., 2min video = 30min expiry)
- One-time use enforcement via `is_used` flag
- Video served via signed URL (24hr expiry)

**Error Handling**:
- Clear error messages for each failure mode
- Orange info box about one-time use
- Success message when accessed

#### 6. Video Cleanup API (NEW)
**Purpose**: Delete expired videos to save storage costs

**Endpoints**:
- `GET /api/admin/cleanup-expired-videos` - Check expired count
- `POST /api/admin/cleanup-expired-videos` - Delete expired files

**Process**:
1. Find tokens where `expires_at < now()`
2. Get unique storage paths
3. Delete from Supabase Storage
4. Delete token records
5. Return statistics

**Response Example**:
```json
{
  "message": "Cleanup completed",
  "expiredTokens": 15,
  "videosDeleted": 8,
  "videosFailed": 0,
  "deletedPaths": ["path1.webm", "path2.webm", ...],
  "failedPaths": []
}
```

---

## Environment Variables

### Required Variables

```bash
# Database (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...  # Server-side only

# AI Evaluation (Groq)
GROQ_API_KEY=gsk_xxx...
GROQ_MODEL=llama-3.3-70b-versatile  # Optional, defaults to this

# Admin Authentication
ADMIN_USERNAME=admin  # Change in production
ADMIN_PASSWORD=your_secure_password  # Change in production

# Storage
STORAGE_BUCKET=candidate-videos  # Supabase bucket name
```

### Configuration Files

#### `.env.local` (development)
```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GROQ_API_KEY=...
ADMIN_USERNAME=admin
ADMIN_PASSWORD=test123
STORAGE_BUCKET=candidate-videos
```

#### Vercel Environment Variables (production)
- Add all variables in Vercel Dashboard
- Use "Environment Variables" section
- Set for Production, Preview, Development

---

## Deployment

### Vercel Deployment

**Current Setup**:
- Repository: `vatsaloctonix/octonix-assessments`
- Branch: `main`
- Region: Washington D.C. (iad1)
- Build Command: `npm run build`
- Framework: Next.js
- Node Version: 20.x

**Build Process**:
1. Clone repository
2. Install dependencies (`npm install`)
3. Run TypeScript compilation
4. Build Next.js with Turbopack
5. Generate static/dynamic routes
6. Deploy to edge network

**Deployment Triggers**:
- Push to `main` branch
- Manual deployment from Vercel dashboard

### Database Setup (Supabase)

**Initial Setup**:
1. Create new Supabase project
2. Copy connection details to env vars
3. Run SQL from `supabase.sql` in SQL Editor
4. Create storage bucket `candidate-videos`
5. Set bucket to private
6. Enable RLS (Row Level Security)

**Migration Steps** (for new video features):
```sql
-- Run only the new section (lines 37-53)
CREATE TABLE IF NOT EXISTS video_access_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES candidate_assessments(id) ON DELETE CASCADE,
  question_index INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  password TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accessed_at TIMESTAMPTZ NULL,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_access_tokens_expires ON video_access_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_video_access_tokens_assessment ON video_access_tokens(assessment_id);

ALTER TABLE video_access_tokens ENABLE ROW LEVEL SECURITY;
```

**Storage Bucket Configuration**:
```
Name: candidate-videos
Public: No
File size limit: 50 MB
Allowed MIME types: video/webm, video/mp4
```

### Post-Deployment Checklist

- [ ] Database migrations run
- [ ] Environment variables set
- [ ] Storage bucket created
- [ ] Admin login works
- [ ] Assessment creation works
- [ ] Video recording works
- [ ] Video upload works
- [ ] AI scoring works (Groq API key valid)
- [ ] PDF export works
- [ ] Video access links work
- [ ] Proctoring events captured

---

## Development Guide

### Local Development Setup

1. **Clone Repository**:
   ```bash
   git clone https://github.com/vatsaloctonix/octonix-assessments.git
   cd octonix-assessments
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

4. **Database Setup**:
   - Create Supabase project
   - Run `supabase.sql` in SQL Editor
   - Create storage bucket

5. **Run Development Server**:
   ```bash
   npm run dev
   # Opens at http://localhost:3000
   ```

### Development Workflow

1. **Make Changes**: Edit files in `app/`, `lib/`, or `components/`
2. **Test Locally**: Use `npm run dev`
3. **Commit**:
   ```bash
   git add .
   git commit -m "Description of changes"
   ```
4. **Push**:
   ```bash
   git push origin main
   ```
5. **Vercel Auto-Deploys**: Check deployment status

### Common Development Tasks

#### Add New Step to Assessment Flow
1. Update `currentStep` range in `applyFlow.tsx`
2. Add step validation in `isStepValid()`
3. Add step UI in render method
4. Update navigation logic
5. Add answer type to `lib/types.ts`

#### Add New Question to Existing Step
1. Edit `lib/assessmentConfig.ts`
2. Add question to appropriate array
3. Update validation if needed
4. Test on local environment

#### Add New Role
1. Add to `ROLE_MARKET` in `assessmentConfig.ts`
2. Create questions in `DOMAIN_QUESTIONS`
3. Add coding problems if applicable
4. Update role selection UI

#### Modify AI Evaluation Criteria
1. Edit `lib/groq.ts`
2. Update system prompt
3. Modify `GroqScoreSchema` if structure changes
4. Test with sample data

#### Add New Proctoring Event Type
1. Add event type to `ProctoringEvent` in `types.ts`
2. Add event listener in `applyFlow.tsx`
3. Add to proctoring display in `submissionClient.tsx`

### Testing Checklist

**Candidate Flow**:
- [ ] Create new assessment
- [ ] Complete all 5 steps
- [ ] Test autosave (close and reopen)
- [ ] Test validation (skip fields)
- [ ] Record videos
- [ ] Submit assessment

**Admin Flow**:
- [ ] Login
- [ ] View submission
- [ ] Run AI scoring
- [ ] Generate video tokens
- [ ] Access video with password
- [ ] Export PDF
- [ ] Delete assessment

**Edge Cases**:
- [ ] Expired assessment link
- [ ] Already submitted assessment
- [ ] Invalid token
- [ ] Network interruption during save
- [ ] Video recording timeout
- [ ] Large video files
- [ ] Proctoring event spam

### Troubleshooting Common Issues

**Issue**: Build fails with module not found
- **Solution**: Check import paths, ensure files exist, run `npm install`

**Issue**: Video upload fails
- **Solution**: Check storage bucket permissions, file size limits, network connection

**Issue**: AI scoring fails
- **Solution**: Verify Groq API key, check rate limits, review error logs

**Issue**: Proctoring events not captured
- **Solution**: Check event listeners, verify API route, check browser console

**Issue**: PDF export doesn't expand all sections
- **Solution**: Increase timeout in `exportPDF()`, check print CSS

**Issue**: Video access link gives 401 error
- **Solution**: Check password match (case-sensitive), verify token not expired/used

---

## Technical Deep Dives

### Video Recording Architecture

**Browser APIs Used**:
1. `navigator.mediaDevices.getUserMedia()` - Camera/mic access
2. `MediaRecorder` - Record video stream
3. `AudioContext` - Audio analysis for level visualization
4. `AnalyserNode` - Frequency data extraction
5. `requestAnimationFrame` - Smooth audio bar updates

**Recording Flow**:
```
User clicks "Start Recording"
  ↓
Request camera/mic permissions
  ↓
Create MediaRecorder with stream
  ↓
Start 3-second countdown
  ↓
Start recording + audio monitoring
  ↓
Collect data chunks in array
  ↓
Stop recording (manual or 2min timeout)
  ↓
Create Blob from chunks
  ↓
Upload to Supabase Storage
  ↓
Save metadata to database
  ↓
Stop audio monitoring
```

**Audio Level Calculation**:
```typescript
// Get frequency data (0-255 per bin)
const dataArray = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(dataArray);

// Calculate average
const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

// Normalize to 0-100
const normalizedLevel = Math.min(100, (average / 128) * 100);

// Each bar height = max(0, audioLevel - (barIndex * 5))
// Creates cascade effect from left to right
```

### Debounced Auto-Save System

**Problem**: Save on every keystroke = too many API calls
**Solution**: Debounce with 600ms delay

**Implementation**:
```typescript
const [savePending, setSavePending] = useState(false);
const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

const saveAnswers = (partial: Partial<AllAnswers>) => {
  // Merge with existing answers
  setAnswers(prev => ({ ...prev, ...partial }));

  // Clear existing timeout
  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
  }

  // Set new timeout
  setSavePending(true);
  saveTimeoutRef.current = setTimeout(async () => {
    await fetch('/api/application/save', {
      method: 'POST',
      body: JSON.stringify({ token, answers, currentStep })
    });
    setSavePending(false);
  }, 600);
};
```

**Benefits**:
- Reduces API calls by ~90%
- Prevents race conditions
- Better UX (less latency)
- Preserves user typing flow

### One-Time Video Link Security

**Challenge**: Share videos securely with external reviewers
**Requirements**:
- Password protection
- Time-based expiry
- One-time use
- No permanent public access

**Architecture**:
```
Admin generates token
  ↓
Creates database record:
  - Unique token ID (UUID)
  - Random 6-char password
  - Expiry time (duration × 15)
  - is_used = false
  ↓
Shares link + password with reviewer
  ↓
Reviewer enters password
  ↓
Server validates:
  ✓ Token exists
  ✓ Password matches
  ✓ Not expired
  ✓ Not used
  ↓
Mark as used (is_used = true)
  ↓
Generate 24hr signed URL
  ↓
Return video URL
  ↓
Future attempts fail (already used)
```

**Security Layers**:
1. **Random token ID**: UUID (128-bit entropy)
2. **Password**: 6 alphanumeric chars (no confusing chars)
3. **Expiry**: Time-based (proportional to video length)
4. **One-time use**: Database flag prevents reuse
5. **Signed URL**: Supabase enforces access control
6. **HTTPS**: All traffic encrypted

### Proctoring Event System

**Philosophy**: Monitor without disrupting candidate experience

**Events Captured**:
| Event Type | Trigger | Risk Level |
|------------|---------|------------|
| visibility_hidden | Tab not visible | Medium |
| window_blur | Window lost focus | Low |
| copy | Ctrl+C pressed | High |
| paste | Ctrl+V pressed | High |
| cut | Ctrl+X pressed | High |
| context_menu | Right-click | Medium |
| blocked_shortcut | F12, DevTools shortcuts | High |
| suspected_devtools | Window resize patterns | High |
| heartbeat | Every 30 seconds | None (activity proof) |

**Implementation Strategy**:
- Non-intrusive: No popups or warnings
- Silent logging: Events saved to database
- Batch updates: Reduces API calls
- Admin review: Human decision on integrity

**Limitations**:
- Cannot detect phone usage
- Cannot detect second monitor
- Cannot prevent screen sharing software
- Cannot detect someone else present

**Design Decision**: Trust-based with verification, not prevention

---

## Performance Optimizations

### Bundle Size
- Tree-shaking enabled (Next.js default)
- Dynamic imports for heavy components
- Minimal external dependencies
- Turbopack for faster builds

### Database Queries
- Indexed columns: token, id, expires_at, assessment_id
- JSONB for flexible schema (reduces joins)
- Pagination for assessment lists (future)

### Video Storage
- WebM format (smaller than MP4)
- 2-minute limit per video
- Automatic cleanup of expired videos
- Signed URLs with reasonable expiry

### Rendering
- Server components where possible
- Client components only for interactivity
- Debounced saves reduce re-renders
- Memoization for expensive calculations

---

## Future Enhancements (Not Implemented)

### Potential Features
1. **Email Notifications**: Send results to candidate/admin
2. **Bulk Assessment Creation**: Upload CSV of candidates
3. **Custom Branding**: White-label for different companies
4. **Analytics Dashboard**: Aggregate statistics
5. **Video Transcription**: AI-powered transcript generation
6. **Scheduled Cleanup**: Cron job for video deletion
7. **Multi-Language Support**: i18n for questions
8. **Mobile Optimization**: Better mobile video recording
9. **Interview Scheduling**: Calendar integration
10. **Candidate Portal**: View own results

### Technical Debt
- Add unit tests (Jest + React Testing Library)
- Add E2E tests (Playwright)
- Improve error boundaries
- Add loading states
- Refactor large components (applyFlow.tsx)
- Add API rate limiting
- Implement proper session management
- Add request validation (Zod on API routes)

---

## Glossary

**Assessment**: A single candidate evaluation session (5 steps)
**Token**: Unique identifier for assessment link (UUID)
**Proctoring**: Monitoring candidate behavior during assessment
**Signed URL**: Time-limited URL for private file access
**Debouncing**: Delaying function execution until after delay
**JSONB**: PostgreSQL's binary JSON storage format
**RLS**: Row Level Security (database access control)
**MCQ**: Multiple Choice Question
**Groq**: AI inference platform (alternative to OpenAI)
**Supabase**: Open-source Firebase alternative (Postgres + Storage)

---

## Contact & Support

**Repository**: https://github.com/vatsaloctonix/octonix-assessments
**Issues**: Create GitHub issue for bugs/features
**Documentation**: This file + inline code comments

---

## Changelog

### v2.0 (Latest) - Comprehensive Enhancements
**Candidate-Side**:
- ✅ Hobby auto-add on blur
- ✅ Multiple time ranges per day in availability
- ✅ Separate "Your problem" field in Step 2
- ✅ Audio level visualization during recording

**Admin-Side**:
- ✅ Auto-copy assessment links
- ✅ Persistent links in dashboard
- ✅ User-friendly AI error messages
- ✅ Improved PDF export (400ms timeout + state restoration)
- ✅ One-time video access system
- ✅ Video cleanup API

**Database**:
- ✅ New `video_access_tokens` table
- ✅ Indexes on expires_at and assessment_id

### v1.0 - Initial Release
- 5-step candidate assessment flow
- Admin dashboard with AI scoring
- Video recording and playback
- Proctoring system
- PDF export
- Basic database schema

---

**End of Documentation**

This documentation covers the complete Octonix Assessment Platform. For code-level details, refer to inline comments in the source files. For questions or clarifications, create a GitHub issue or contact the development team.

Last Updated: 2026-01-01
