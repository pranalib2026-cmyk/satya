# NyayaSetu (न्यायसेतु) — Page Consolidation Plan

**Date:** November 20, 2026  
**Document Status:** Proposal for User Review · No Routes Deleted  
**Scope:** Complete Application (Public Marketing, Authentication, Citizen, Advocate, Admin)  

---

## 1. Executive Summary & Objective

The NyayaSetu application currently spans **32 distinct page routes** (11 public marketing pages, 1 authentication gateway, and 20 dashboard routes). While individual screens are functional and visually aligned with the classical editorial design language, the user journey suffers from **fragmentation, overlapping features, and multi-step page hopping**:
1. **Intake & Case Fragmentation:** A citizen's legal problem journey is broken across four disparate URLs (`/dashboard/intake` → `/dashboard/triage` → `/dashboard/brief` → `/dashboard/cases`), plus an overlapping public conflict intake form on `/contact`.
2. **Document Tool Redundancy:** Document management is split between `/dashboard/vault` (storage & sharing) and `/dashboard/scan` (OCR & explainer), forcing citizens to navigate between two separate top-level menu items for related document tasks.
3. **Advocate Booking & Feedback Sprawl:** Advocate discovery, profiles, booking, confirmation, consultation ledgers, and feedback are fragmented across six distinct URLs (`/advocates`, `/advocates/[id]`, `/booking/[advocateId]`, `/booking/confirmation/[bookingId]`, `/bookings`, `/feedback/[bookingId]`), with an overlapping partner directory on `/people`.
4. **Single-Role Sidebar Navigation:** The dashboard sidebar currently renders a single hardcoded menu for all users, leaving verified Advocates and Platform Admins without dedicated chamber or governance workspaces despite existing backend API capabilities.

This consolidation plan provides a **clean, unified architecture** organized into four logical functional workspaces:
* **Citizen Workspace** (9 streamlined core destinations)
* **Legal Information** (4 public knowledge base sections)
* **Advocate Workspace** (7 dedicated chamber management modules)
* **Admin Workspace** (6 governance and verification tools)

> [!IMPORTANT]
> **Zero Deletion Guarantee:** This is an architectural proposal for your review. No files, code, or routes have been modified or deleted. Execution will commence only after your feedback and approval.

---

## 2. Complete Inventory & Overlap Audit

| Existing Route | Current Purpose | Overlap / Problem Identified | Recommended Action |
|---|---|---|---|
| `/` | Homepage & Platform Reference | Single source of truth for branding, typography, and aesthetic. | **Keep unchanged** |
| `/firm` | Firm heritage, commitments, pro bono | Standalone marketing page. | **Keep unchanged** |
| `/people` | Empanelled advocate leadership roster | Overlaps conceptually with `/dashboard/advocates`. Currently acts as a public partner showcase. | **Keep & clarify:** Public partner showcase on marketing; verified search lives in `/dashboard/advocates`. |
| `/practices` | Practice areas & court timelines | Comprehensive statutory domain reference. | **Keep as core "Legal Topics"** |
| `/matters` | Representative matters & rulings | Court precedents and case studies ledger. | **Keep as core "Precedents"** |
| `/insights` | Articles, guides, newsletter | Public legal guides and knowledge articles. | **Keep as core "Legal Guides"** |
| `/insights/[slug]` | Full-length guide reading view | Detailed statutory analysis article. | **Keep unchanged** |
| `/contact` | Inquiry form + 4-step conflict wizard | The 4-step conflict intake wizard duplicates the intake logic of `/dashboard/intake`. | **Simplify `/contact`:** General chambers contact & inquiry; route legal problem intakes to `/dashboard/intake`. |
| `/disclaimer` | BCI Rule 36 non-solicitation notice | Statutory disclosure requirement. | **Keep unchanged** |
| `/privacy` | DPDP Act, 2023 compliance notice | Statutory data privacy requirement. | **Keep unchanged** |
| `/login` | Dual-mode citizen/advocate login | Clean entry point with OTP and credential quick-fills. | **Keep unchanged** |
| `/dashboard` | Dashboard Overview (Home) | Central workspace home for active dockets and quick actions. | **Keep as Workspace Home** (with role-specific widgets) |
| `/dashboard/chat` | AI Legal Assistant (Grounded RAG) | Bare Act citations, gazette links, checksums, non-advice disclaimer. | **Keep as core "AI Legal Assistant"** |
| `/dashboard/intake` | 5-step intake questionnaire | Standalone route that redirects to `/dashboard/triage`. | **Merge into My Cases:** Retain as `/dashboard/cases/new` (or intake entry), redirecting directly to the created case dossier. |
| `/dashboard/triage` | Triage output & recommended path | Orphan page showing recommendation; user must click out to `/brief`. | **Consolidate:** Embed as the "Triage & Assessment" tab within `/dashboard/cases/[caseId]`. |
| `/dashboard/brief` | Matter Brief & DPDP sharing consent | Orphan page with static brief editor; disconnected from case dossier. | **Consolidate:** Embed as the "Matter Brief & Sharing" tab within `/dashboard/cases/[caseId]`. |
| `/dashboard/cases` | Active Case Files & Matter Ledger | Central case directory connected to `GET /api/v1/cases`. | **Keep as core "My Cases"** |
| `/dashboard/cases/[caseId]/progress` | Procedural milestone stages | Separate page just for milestone progression. | **Consolidate:** Embed as the "Procedural Timeline" view inside `/dashboard/cases/[caseId]`. |
| `/dashboard/vault` | Evidence Vault & document shares | Document storage, DPDP sharing logs, authorized download tokens. | **Keep as core "Documents"** |
| `/dashboard/scan` | Notice OCR Analyzer & Explainer | Standalone scanning tool; duplicates document management context. | **Merge into Documents:** Integrate as a "Scan & Explain" action/tab within `/dashboard/vault`. |
| `/dashboard/deadlines` | Limitation Act & Hearing Calendar | Critical statutory dates, advocate review confirmation. | **Keep as core "Deadlines"** |
| `/dashboard/advocates` | Verified Advocate Search & Matching | Objective multi-factor matching, BCI Rule 36 compliance. | **Keep as core "Find an Advocate"** |
| `/dashboard/advocates/[id]` | Advocate Credentials & Profile | Full profile, bar roll, court list, consultation booking CTA. | **Keep as core Advocate Profile** |
| `/dashboard/booking/[advocateId]` | Consultation slot & mode checkout | Separate booking screen. | **Streamline:** Embed as a direct modal/drawer from `/dashboard/advocates/[id]` or preserve as clean sub-route. |
| `/dashboard/booking/confirmation/[bookingId]` | Confirmation badge & .ics export | Single-purpose confirmation screen. | **Keep as transient confirmation** (with redirect link to `/dashboard/bookings`). |
| `/dashboard/bookings` | Scheduled Consultation Register | Lists upcoming dockets and past proceedings. | **Keep as core "Appointments"** |
| `/dashboard/feedback/[bookingId]` | Post-consultation rating form | Isolated orphan form with star selector. | **Merge into Appointments:** Embed as an inline "Submit Review" modal on completed appointment cards in `/dashboard/bookings`. |
| `/dashboard/messages` | Chambers Dispatch / Chat | Confidential citizen-advocate consultation communication relay. | **Keep as core "Messages"** |
| `/dashboard/self-help` | Interactive Legal Notice Generator | Client-side notice drafting, field inputs, print-ready preview. | **Promote to Legal Information:** Accessible both publicly and within dashboard as "Self-Help Resources". |
| `/dashboard/emergency` | 24/7 Helplines & Rights Directory | Low-bandwidth emergency directory (112, 181, 15100). | **Promote to Legal Information:** Accessible publicly and inside dashboard as "Emergency Safeguards". |
| `/dashboard/profile` | Citizen Dossier & DPDP Consent | Personal credentials, language preference, DPDP consent ledger. | **Keep as core "Profile & Settings"** |

---

## 3. The Consolidated Architecture

### 3.1 Workspace 1: Citizen Workspace (9 Core Destinations)
Designed for citizens seeking legal redress, preliminary assessment, advocate consultation, and active case tracking.

```
CITIZEN WORKSPACE (/dashboard)
├── 1. Overview                 (/dashboard)                 — Caseload summary, next critical deadline, quick actions
├── 2. My Cases                 (/dashboard/cases)           — Central docket of active matters
│   ├── New Matter Intake       (/dashboard/intake)          — 5-step structured problem intake
│   └── Case Dossier View       (/dashboard/cases/[id])      — Unified tabbed case file:
│       ├── Tab A: Overview & Procedural Stages              — Hearing countdown, stage milestones (absorbs [id]/progress)
│       ├── Tab B: Triage & Statutory Assessment             — Forum, urgency, missing information (absorbs /triage)
│       ├── Tab C: Matter Brief & DPDP Sharing               — Chronology, claims, advocate sharing (absorbs /brief)
│       └── Tab D: Attached Evidence Filings                 — Case-specific vault documents
├── 3. AI Legal Assistant       (/dashboard/chat)            — Grounded conversational RAG with Bare Act citations
├── 4. Find an Advocate         (/dashboard/advocates)       — Roll-verified advocate directory & transparent matching
│   ├── Advocate Profile        (/dashboard/advocates/[id])  — Practice courts, experience, verified bar roll
│   └── Book Consultation       (/dashboard/booking/[id])    — Mode selector, slot hold, conflict-checked booking
├── 5. Documents & Evidence     (/dashboard/vault)           — Private vault (absorbs /dashboard/scan as action tab)
│   ├── Tab 1: Evidence Repository                           — Uploaded case records, confidentiality tags, signed URLs
│   ├── Tab 2: Scan & Explain (OCR)                          — Notice analyzer, obligation extractor, add to vault
│   └── Tab 3: Access & Sharing Logs                         — DPDP consent audit trail, revoked permissions
├── 6. Court Deadlines          (/dashboard/deadlines)       — Limitation periods, hearing dates, advocate confirmations
├── 7. Appointments             (/dashboard/bookings)        — Upcoming hearings, concluded sessions, inline review modal
├── 8. Messages                 (/dashboard/messages)        — Privileged consultation communications
└── 9. Profile & Settings       (/dashboard/profile)         — Language selection, contact info, consent management
```

---

### 3.2 Workspace 2: Legal Information (Public & Universal Knowledge Base)
Designed for any citizen, student, or litigant seeking un-gated statutory legal knowledge and self-help tools.

```
LEGAL INFORMATION (Public Knowledge Base)
├── 1. Legal Topics             (/practices)                 — Practice areas, statutory scopes, court procedural timelines
├── 2. Legal Guides             (/insights)                  — Practical explainers, Bare Act summaries, legal guides
│   └── Article View            (/insights/[slug])           — Individual deep-dive guide with Markdown typography
├── 3. Precedents               (/matters)                   — Landmark rulings, representative dockets, case studies
└── 4. Self-Help Resources      (/self-help)                 — Accessible without login (mirrored from /dashboard/self-help):
    ├── Tab 1: Legal Notice Drafting                         — Interactive 138 NI / Security Deposit notice generator
    ├── Tab 2: Procedural Checklists                         — Step-by-step guidance for Consumer, RTI, and Rent forums
    └── Tab 3: Emergency Rights & Helplines                  — 112, 181, 15100, Article 21/22 constitutional rights
```

---

### 3.3 Workspace 3: Advocate Workspace (Chamber Management)
Activated dynamically when the logged-in user possesses `role === 'advocate'`. Replaces citizen intake with professional chamber operations.

```
ADVOCATE WORKSPACE (/dashboard) [Role: ADVOCATE]
├── 1. Chamber Overview         (/dashboard)                 — Today's appointments, pending intake reviews, active client files
├── 2. Chamber Profile          (/dashboard/profile)         — State Bar Council enrolment, verification badge, fee schedule
├── 3. Client Enquiries         (/dashboard/enquiries)       — Incoming consultation requests from matching engine (/matching/consultation-requests)
├── 4. Appointments & Hearings  (/dashboard/bookings)        — Accept/reject consultation requests, meeting links, hearing calendar
├── 5. Assigned Matters         (/dashboard/cases)           — Client case dossiers, stage progression updates, limitation tracking
├── 6. Evidence Documents       (/dashboard/vault)           — Client-shared evidence files, authorized download tokens
└── 7. Client Messages          (/dashboard/messages)        — Direct privileged consultation threads with clients
```

---

### 3.4 Workspace 4: Admin Workspace (Platform Oversight & Governance)
Activated dynamically when the logged-in user possesses `role === 'admin'`. Surfaces platform governance, advocate verification, and compliance logging.

```
ADMIN WORKSPACE (/dashboard/admin) [Role: ADMIN]
├── 1. Governance Overview      (/dashboard/admin)           — Platform metrics, active users, total dockets, API diagnostics
├── 2. User Management          (/dashboard/admin/users)     — Citizen & advocate account statuses, active sessions
├── 3. Advocate Verification    (/dashboard/admin/verify)    — Review pending Bar Council enrolments, approve/reject verified badges
├── 4. Case Oversight           (/dashboard/admin/cases)     — Platform matter ledger, docket distribution across forums
├── 5. Reports & Audit Logs     (/dashboard/admin/reports)   — Immutable audit trails for DPDP compliance, RAG queries, auth events
└── 6. Knowledge Corpus CMS     (/dashboard/admin/sources)   — Ingestion of official Bare Acts, gazettes, and statutory chunks
```

---

## 4. Key Consolidations & Reductions

### Consolidation 1: The Unified Case Dossier (`/dashboard/cases/[caseId]`)
* **Current Fragmentation:**
  Citizens must visit `/dashboard/intake` to answer questions, get pushed to `/dashboard/triage` for results, visit `/dashboard/brief` to see their summary, visit `/dashboard/cases` to see active cases, and visit `/dashboard/cases/[caseId]/progress` to see the timeline.
* **Consolidated Experience:**
  - Citizen fills intake on `/dashboard/intake` (or `/dashboard/cases/new`).
  - Upon submission, the backend generates the case reference (`NYA-2026-CS-XXXX`) and redirects directly to the unified dossier: `/dashboard/cases/[caseId]`.
  - Inside `/dashboard/cases/[caseId]`, a crisp tabbed interface surfaces:
    1. **Overview & Milestones** (formerly `.../progress`): Hearing countdown and procedural stages.
    2. **Triage Assessment** (formerly `/triage`): Legal forum, urgency rating, evidentiary gaps, and legal aid eligibility.
    3. **Matter Brief & Sharing** (formerly `/brief`): Facts summary, chronology, and DPDP advocate sharing controls.
    4. **Case Documents**: Attached evidence files.
* **Benefits:** Eliminates 3 disconnected top-level URLs while giving citizens a single persistent URL for their entire legal matter.

### Consolidation 2: Unifying Documents and Scanner (`/dashboard/vault`)
* **Current Fragmentation:**
  `/dashboard/vault` holds documents, while `/dashboard/scan` is an isolated page where an uploaded document cannot be saved directly into a case.
* **Consolidated Experience:**
  - Move "Scan & Explain" inside `/dashboard/vault` as a secondary tab or action modal.
  - When a citizen scans a legal notice, they immediately have a "Save to Vault" or "Attach to Case" button.
  - Remove "Scan & Explain" from the top-level sidebar, streamlining the navigation.

### Consolidation 3: Inline Appointment Feedback (`/dashboard/bookings`)
* **Current Fragmentation:**
  `/dashboard/feedback/[bookingId]` is a standalone page with an isolated star rating form.
* **Consolidated Experience:**
  - On `/dashboard/bookings`, completed consultations show a subtle "Rate Consultation" button.
  - Clicking opens an elegant modal dialog on the same page.
  - Eliminates an orphan page with zero loss of functionality.

### Consolidation 4: Clean Public vs Dashboard Boundaries for Legal Info
* **Current Fragmentation:**
  `/dashboard/self-help` and `/dashboard/emergency` are locked inside the authenticated dashboard, while `/practices`, `/matters`, and `/insights` are on the public marketing site.
* **Consolidated Experience:**
  - Standardize public navigation links into:
    1. **Legal Topics** (`/practices`)
    2. **Legal Guides** (`/insights`)
    3. **Precedents** (`/matters`)
    4. **Self-Help Resources** (`/self-help` — housing notice drafting & emergency helplines)
  - Citizens in the dashboard can still access these resources via the "Resources" footer or sidebar shortcut.

---

## 5. Navigation Architecture Before & After

### 5.1 Public Navbar

```
BEFORE (5 links):
[Legal Areas]  [Find Advocates]  [Precedents]  [Legal Guides]  [About Us]  [Client Access CTA]

AFTER (4 Consolidated Knowledge Links + 1 About Link):
[Legal Topics]  [Legal Guides]  [Precedents]  [Self-Help Resources]  [About Us]  [Sign In / Dossier CTA]
```

### 5.2 Dashboard Sidebar (Citizen View)

```
BEFORE (11 cluttered links in 3 groups):
Group 1 (Main):
  - Home
  - AI Legal Assistant
  - My Cases
  - Court Deadlines
  - Consultations
  - Messages
Group 2 (Legal Services):
  - Find an Advocate
  - Self-Help Guides
  - Document Vault
  - Scan & Explain       <-- [Redundant; merge into Vault]
Group 3 (Account):
  - Profile & Privacy

AFTER (9 purposeful, structured links in 2 logical groups):
Group 1 (My Matters):
  - Workspace Home       (/dashboard)
  - My Cases             (/dashboard/cases)      <-- [Includes Intake, Progress, Triage & Brief]
  - AI Legal Assistant   (/dashboard/chat)
  - Court Deadlines      (/dashboard/deadlines)
  - Appointments         (/dashboard/bookings)   <-- [Includes Bookings, Calendar & Inline Review]
  - Messages             (/dashboard/messages)
Group 2 (Services & Vault):
  - Find an Advocate     (/dashboard/advocates)  <-- [Includes Matching & Profiles]
  - Document Vault       (/dashboard/vault)      <-- [Includes Evidence, Sharing & Scan Explainer]
  - Profile & Settings   (/dashboard/profile)
```

### 5.3 Dashboard Sidebar (Advocate View)

```
ADVOCATE CHAMBERS MENU (7 purposeful items):
Group 1 (Chamber Practice):
  - Chambers Overview    (/dashboard)
  - Client Enquiries     (/dashboard/enquiries)  <-- [New consultation requests via /matching]
  - Hearing Calendar     (/dashboard/bookings)   <-- [Appointments & scheduled sessions]
  - Active Matters       (/dashboard/cases)      <-- [Assigned client dossiers]
  - Client Messages      (/dashboard/messages)   <-- [Privileged client communications]
Group 2 (Chamber Administration):
  - Case Documents       (/dashboard/vault)      <-- [Filing records & evidence vault]
  - Bar Enrolment Profile(/dashboard/profile)    <-- [Bar Council credentials & verification]
```

---

## 6. Route Redirection & Preservation Matrix

To ensure **no broken links or bookmarks**, every consolidated route will feature graceful backward compatibility:

| Old URL | New Consolidated Destination | Method | API / State Impact |
|---|---|---|---|
| `/dashboard/cases/[caseId]/progress` | `/dashboard/cases/[caseId]?tab=progress` | 301 / Client Redirect | Preserves `GET /api/v1/cases/{id}` & stage data |
| `/dashboard/triage` | `/dashboard/cases/[caseId]?tab=triage` (or `/dashboard/cases/new`) | Modal / Dossier Tab | Preserves `POST /api/v1/triage/assess` |
| `/dashboard/brief` | `/dashboard/cases/[caseId]?tab=brief` | Dossier Tab | Preserves `GET /api/v1/cases/{id}` & DPDP consent |
| `/dashboard/scan` | `/dashboard/vault?action=scan` | Tab / Modal Redirect | Preserves document OCR & explain logic |
| `/dashboard/feedback/[bookingId]` | `/dashboard/bookings?feedback=[bookingId]` | Modal Dialog | Preserves review form state |
| `/dashboard/emergency` | `/self-help#emergency` (and quick shortcut) | Standalone or Tab | Preserves offline-first helpline dialing |

---

## 7. Phased Implementation Strategy

Following your review and approval, the consolidation will proceed in these controlled phases:

1. **Phase 1: User Review & Sign-Off (Current Step)**
   - Align on proposed groupings and route merges.
   - Adjust any specific naming preferences (e.g. "Appointments" vs "Consultations", "Legal Topics" vs "Practice Areas").
2. **Phase 2: Navigation & Shell Realignment**
   - Update `frontend/src/app/dashboard/layout.tsx` to render role-based navigation menus based on `auth.role`.
   - Clean up sidebar items from 11 to 9 for citizens, and inject dedicated advocate items for advocates.
3. **Phase 3: Unified Case Dossier Implementation**
   - Enhance `frontend/src/app/dashboard/cases/[caseId]/page.tsx` with tabs for Overview, Timeline, Triage Assessment, Brief, and Evidence.
   - Redirect `/dashboard/cases/[caseId]/progress`, `/dashboard/triage`, and `/dashboard/brief` to the unified dossier.
4. **Phase 4: Document Vault & Scanner Integration**
   - Add the "Scan & Explain" notice extractor as an active tab inside `/dashboard/vault`.
   - Setup redirect from `/dashboard/scan` to `/dashboard/vault?tab=scan`.
5. **Phase 5: Advocate & Admin Chamber Views**
   - Connect Advocate Enquiries to `/api/v1/matching/consultation-requests`.
   - Add the Admin Verification screen connected to `/api/v1/admin/advocates/pending`.
6. **Phase 6: Verification & QA**
   - Full regression test across ESLint, TypeScript, and Next.js Webpack builds.
   - Verify all 44 routes and redirect behaviors.

---

## 8. Questions for Your Review

1. **Case Dossier Unification:** Do you approve merging **Triage**, **Matter Brief**, and **Progress Milestones** into unified tabs inside `/dashboard/cases/[caseId]`?
2. **Document Scanner Placement:** Do you agree with integrating **Scan & Explain** as a tab inside **Documents / Vault** (`/dashboard/vault`) rather than a standalone sidebar link?
3. **Public Navigation Naming:** Do you prefer the terminology **"Legal Topics"** (suggested) or **"Legal Areas / Practices"** (current) for `/practices`?
4. **Advocate & Admin Workspaces:** Should we proceed with introducing the role-based navigation switch in `dashboard/layout.tsx` so Advocates and Admins see their specific tools?
