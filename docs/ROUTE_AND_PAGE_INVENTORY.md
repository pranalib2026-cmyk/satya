# NyayaSetu (न्यायसेतु) — Route and Page Inventory

**Date of Audit:** November 19, 2026  
**Total Routes Audited:** 32 (11 Public/Marketing + 1 Auth + 20 Authenticated Dashboard Portal)  
**Status:** Audit Complete · Zero Code Modifications (Phase 1)

---

## 1. Inventory Summary Matrix

| # | Route | Purpose | Key Components | Backend API Dependencies | Functional Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `/` | Main Homepage & Platform Overview | `HeroSection`, `LadyJusticeCanvas`, `AboutStrip`, `PracticesSlider`, `TransparencyPreview`, `ContractAnnotator`, `MattersPreview`, `PartnerShowcase`, `ClientQuotes`, `LatestInsights`, `FaqSection`, `ConflictIntakeSection` | None (Static composition) | **Fully Functional** (Client + Server) |
| 2 | `/practices` | Practice Areas Directory & Timelines | `Container`, `Badge`, `Button`, `QuickConsultationModal`, `practices` static data | `/api/v1/matching/advocates` | **Functional** (Static + Modal) |
| 3 | `/people` | Empanelled Advocates & Partners Directory | `Container`, `Badge`, `Button`, `partners` data, vCard exporter | `/api/v1/matching/advocates` | **Functional** (Static + Search/Filter) |
| 4 | `/matters` | Precedents & Court Representative Matters Ledger | `Container`, `Badge`, `Button`, `matters` static data | `/api/v1/cases` (Precedents) | **Functional** (Static + Filter) |
| 5 | `/insights` | Legal Guides, Articles & Newsletter Form | `Container`, `Badge`, `Button`, `articles` data, Newsletter input | `/api/v1/legal/admin/sources` | **Functional** (Static + Filter) |
| 6 | `/insights/[slug]` | Individual Legal Guide Article Reading View | `Container`, `Badge`, `Button`, article markdown renderer | None (SSG lookup) | **Fully Functional** (Server SSG) |
| 7 | `/firm` | Story, Heritage, Written Commitments & Pro Bono | `Container`, `Badge`, `Button`, `firmTimeline`, `writtenCommitments` | None | **Fully Functional** (Static) |
| 8 | `/contact` | Conflict-Check Inquiry & Consultation Intake | `Container`, `Badge`, `Button`, 4-step conflict wizard | `/api/v1/cases`, `/api/v1/triage/assess` | **Functional** (Client Simulation) |
| 9 | `/privacy` | DPDP Act 2023 Compliance & Privacy Notice | `Container`, legal policy text | None | **Fully Functional** (Static) |
| 10 | `/disclaimer` | Bar Council of India Regulatory Disclosures | `Container`, regulatory policy text | None | **Fully Functional** (Static) |
| 11 | `/not-found` | Custom 404 Page | `Container`, `Button` | None | **Fully Functional** |
| 12 | `/login` | Dual-Role Login & 3-Step Citizen Onboarding | Role Tabs, Mobile Input, 6-digit OTP, Onboarding wizard, `useAuth` | `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/refresh` | **Functional** (Local Simulation / Disconnected) |
| 13 | `/dashboard` | Citizen & Advocate Central Portal Home | `Sidebar`, `LanguageSwitcher`, `StatCard`, Quick Action tiles, `getDashboardSummary` | `/api/v1/cases`, `/api/v1/deadlines`, `/api/v1/appointments` | **Functional** (Local Simulation / Disconnected) |
| 14 | `/dashboard/chat` | AI Legal Assistant with Statutory Citations | Chat window, message bubbles, `CitationChip`, `streamAnswer` | `/api/v1/legal/ask` | **Functional** (Local Simulation / Disconnected) |
| 15 | `/dashboard/intake` | Structured 5-Step Case Matter Intake Wizard | Multi-step form, document selector, `classifyIntake` | `/api/v1/cases`, `/api/v1/triage/assess` | **Functional** (Local Simulation / Disconnected) |
| 16 | `/dashboard/triage` | Deterministic Legal Triage Assessment | Triage path selector, income calculator, DLSA cards, `runTriage` | `/api/v1/cases/{id}/triage`, `/api/v1/triage/assess` | **Functional** (Local Simulation / Disconnected) |
| 17 | `/dashboard/brief` | Reviewable Case Brief with DPDP Sharing | Section editor, document chips, consent box, `saveConsent` | `/api/v1/cases/{id}`, `/api/v1/documents/cases/{id}` | **Functional** (Local Simulation / Disconnected) |
| 18 | `/dashboard/cases` | Case Files & Matter Tracker Directory | `PageHeader`, `Card`, `Badge`, `Button`, cases filter, `cases` data | `/api/v1/cases` | **Functional** (Local Simulation / Disconnected) |
| 19 | `/dashboard/cases/[caseId]/progress` | Individual Case Procedural Milestone Tracker | Milestone timeline, hearing countdown, procedural stage badges | `/api/v1/cases/{id}`, `/api/v1/deadlines/cases/{id}` | **Functional** (Local Simulation / Disconnected) |
| 20 | `/dashboard/deadlines` | Limitation Act & Court Compliance Calendar | List/calendar view, urgency chips, confirm modal, `listDeadlines` | `/api/v1/deadlines` | **Functional** (Local Simulation / Disconnected) |
| 21 | `/dashboard/advocates` | Verified Advocate Discovery & Matching | Filter sidebar, advocate cards, verification seals, `matchAdvocates` | `/api/v1/matching/cases/{id}/advocates`, `/api/v1/matching/advocates` | **Functional** (Local Simulation / Disconnected) |
| 22 | `/dashboard/advocates/[id]` | Verified Advocate Profile & Credentials View | Profile banner, bar ID badge, fee table, booking CTA | `/api/v1/matching/advocates`, `/api/v1/admin/advocates/{id}` | **Functional** (Local Simulation / Disconnected) |
| 23 | `/dashboard/booking/[advocateId]` | Consultation Appointment Slot Booking | Date picker, time slot pills, mode selector, fee checkout, `bookSlot` | `/api/v1/appointments` | **Functional** (Local Simulation / Disconnected) |
| 24 | `/dashboard/booking/confirmation/[bookingId]` | Booking Confirmation & .ics Export | Reference code badge, meeting URL tile, .ics export generator | `/api/v1/appointments/{id}` | **Functional** (Local Simulation / Disconnected) |
| 25 | `/dashboard/bookings` | Scheduled Consultation Management | `Tabs`, `Badge`, `Button`, `EmptyState`, `listBookings` | `/api/v1/appointments` | **Functional** (Local Simulation / Disconnected) |
| 26 | `/dashboard/feedback/[bookingId]` | Post-Consultation Rating & Review | Star rating selector, feedback text area, submit button | Needs backend feedback endpoint (Gap) | **Functional** (Client State Only) |
| 27 | `/dashboard/self-help` | Interactive Legal Notice Generator | Template tabs, field inputs, live print preview, `printHtml` | None (Client-side HTML generator) | **Fully Functional** |
| 28 | `/dashboard/vault` | Encrypted Case Document Repository | Document table, upload modal, share modal, access log, `signedUrl` | `/api/v1/documents/*` | **Functional** (Local Simulation / Disconnected) |
| 29 | `/dashboard/scan` | Notice OCR Analyzer & Plain-English Explainer | Dropzone, OCR stage progress, dates/amounts list, `runOcr` | Needs backend OCR pipeline (Gap) | **Functional** (Client Simulation) |
| 30 | `/dashboard/messages` | Direct Advocate Communication Threads | Thread sidebar, chat window, attachment modal, report/block | Needs P2P message thread API (Gap) | **Functional** (Client Simulation) |
| 31 | `/dashboard/emergency` | 24/7 Low-Bandwidth Helplines & Rights | Direct dial cards (112, 181, 15100), constitutional rights tabs | None (Offline-first by design) | **Fully Functional** |
| 32 | `/dashboard/profile` | Profile, Language & DPDP Consent Ledger | Profile form, language selector modal, consent table, export CTA | `/api/v1/auth/me`, `/api/v1/users/{id}` | **Functional** (Local Simulation / Disconnected) |

---

## 2. Detailed Route Dossiers

### 2.1 Public / Marketing Routes (Design Benchmark)
All public marketing routes (`/`, `/practices`, `/people`, `/matters`, `/insights`, `/firm`, `/contact`) share the classical editorial layout wrapped in `src/app/layout.tsx`.
- **Top Navigation (`Navbar`):** Transparent cream background `#f4efe6/95`, justice monogram scale SVG, serif wordmark "NyayaSetu BHARAT", dot-activated links, and a sharp primary CTA button.
- **Footer (`Footer`):** Deep espresso background `#24180f`, gold typography `#d1a46a`, Bar Council disclaimer, and structured column sitemap.
- **Visual Polish:** High. Employs classical typography (`Gambetta` display serif), warm paper backgrounds (`#f4efe6`, `#f3ece1`), crisp square borders (`rounded-none` / `rounded-[2px]`), and antique bronze accents (`#9a6a35`).

### 2.2 Authentication Screen (`/login`)
- **Visual Divergence:** Splits screen into an espresso left sidebar with glassmorphic cards (`bg-white/10 rounded-2xl`) and a right container with rounded-xl inputs, rounded-xl role switcher tabs, and rounded buttons.
- **State & Logic:** Employs client-side phone number validation, simulated 30-second OTP timer, and a 3-step onboarding wizard. Stores mock token in `localStorage`.
- **Backend Coupling:** Zero. The FastAPI backend has `/api/v1/auth/login` and `/api/v1/auth/register`, but `/login` does not call them.

### 2.3 Dashboard Shell & Layout (`/dashboard/layout.tsx`)
- **Visual Divergence:** Introduces `dashboard.css`, which overrides display typography from `Gambetta` (serif) to `General Sans`/`Inter` (sans-serif), injects `shadow-card`, rounded pill badges (`rounded-full`), and rounded buttons (`rounded-xl`).
- **Sidebar Navigation:** Contains 3 navigation groups (`Main`, `Get help`, `Account`) with 11 links. Active links use pastel brand tints (`bg-brand-soft text-brand-dark rounded-xl`) instead of the homepage's crisp square active states with dot indicators.
- **Top Header Bar:** Contains search input, language switcher dropdown, and notification badge button.

### 2.4 Dashboard Feature Pages (`/dashboard/*`)
- **Triage & Intake (`/intake`, `/triage`, `/brief`):** Implements an exhaustive legal intake questionnaire, deterministic decision engine, and case brief generator. The logic is robust, but the visual components use rounded SaaS pills.
- **Advocate Discovery & Booking (`/advocates`, `/advocates/[id]`, `/booking/*`, `/bookings`):** Simulates advocate matching and appointment booking with conflict checking. It faithfully mimics the backend's logic, but does not fetch from `/api/v1/matching/advocates` or post to `/api/v1/appointments`.
- **Vault & Scanner (`/vault`, `/scan`):** Simulates encrypted document management and OCR extraction. The document vault features a consent-sharing modal and access log ledger.
- **Statutory Deadlines (`/deadlines`):** Contains both list and monthly calendar views, displaying limitation rules (e.g. Section 138 NI Act, Order VIII Rule 1 CPC).
- **Self-Help Suite (`/self-help`):** An outstanding, fully working client-side legal notice drafting suite with live printable previews.
- **Emergency Rights (`/emergency`):** An offline-first, low-bandwidth emergency directory with one-tap dialing and constitutional rights summaries.
