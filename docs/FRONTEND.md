# Frontend

**Location:** `frontend/`
**Framework:** Next.js 16.4.5 (App Router), React 19.3, TypeScript 5
**Styling:** Tailwind CSS 4 with custom tokens in `src/app/globals.css`
**Motion / 3D:** Framer Motion 14, Three.js via `@react-three/fiber` and
`@react-three/drei`

> This is **Next.js 16**, not an older release. Before using an unfamiliar API,
> read the bundled docs under `frontend/node_modules/next/dist/docs/`. See
> `frontend/AGENTS.md` for the version warning.

## Run it

```bash
cd frontend
npm install
npm run dev
```

- URL: <http://localhost:3000>
- `predev` deletes `.next/dev/lock` and kills any process on port 3000.
- Production check: `npm run build`, then `npm run start`.

There are no frontend environment variables yet. The backend API is not consumed
by the frontend at the time of writing.

## Structure

```text
frontend/
├── public/
│   ├── model/…              Lady Justice GLB (legacy path)
│   └── models/lady-justice/ Lady Justice GLB (current path)
├── scripts/predev.js        Port/lock cleanup
├── src/
│   ├── app/                 App Router routes
│   ├── components/
│   │   ├── 3d/              Three.js canvas and loader
│   │   ├── layout/          Container, section, navbar, footer, back-to-top
│   │   ├── sections/        Home-page and shared marketing sections
│   │   └── ui/              Button, input, modal, tabs, accordion, badge, card
│   ├── data/                Static content arrays
│   ├── lib/utils.ts         `cn()` class merge helper
│   └── types/index.ts       Content and form types
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Routes

| Route | Rendering | Purpose |
| --- | --- | --- |
| `/` | Server composition | Hero, about, practices slider, transparency, contract annotator, matters preview, partners, testimonials, insights, FAQ, conflict intake |
| `/login` | Client | Dual-role authentication (Citizen OTP + Advocate Bar Enrolment) and 3-step citizen onboarding (language, disclaimer, DPDP consent) |
| `/dashboard` | Client | Citizen & Advocate portal home: problem intake router, stat cards, active case tracker, urgency deadlines, quick action tiles |
| `/dashboard/chat` | Client | AI legal assistant with Indian statutory citations (BNS, CPC, NI Act, etc.) and direct next actions |
| `/dashboard/intake` | Client | Structured matter intake: urgency, complexity, income, and user goal |
| `/dashboard/triage` | Client | Deterministic triage result: emergency, legal aid, self-help, or advocate path |
| `/dashboard/brief` | Client | Reviewable case brief with citations, timeline, and share controls |
| `/dashboard/cases` | Client | Case file manager: timeline view, procedural hearings, case dates, and new matter intake |
| `/dashboard/cases/[caseId]/progress` | Client | Case progress timeline, hearing dates, pending steps, and notifications |
| `/dashboard/deadlines` | Client | Limitation and court compliance tracker with statutory rule references and completion toggles |
| `/dashboard/advocates` | Client | Bar-verified advocate directory with practice filters and consultation slot booking |
| `/dashboard/advocates/[id]` | Client | Advocate profile with verified details, practice areas, fees, and booking CTA |
| `/dashboard/booking/[advocateId]` | Client | Slot selection, mode, consent confirmation, and mock checkout |
| `/dashboard/booking/confirmation/[bookingId]` | Client | Booking confirmation, .ics download, and next steps |
| `/dashboard/self-help` | Client | Interactive legal notice generator (Tenancy, Cheque Dishonour, Consumer Grievance) with live print preview |
| `/dashboard/vault` | Client | Encrypted document repository with time-limited DPDP consent sharing and access audit logs |
| `/dashboard/scan` | Client | OCR legal notice analyzer: entity extraction, risk score, and recommended legal remedies |
| `/dashboard/bookings` | Client | Scheduled video and chamber consultation management |
| `/dashboard/feedback/[bookingId]` | Client | Verified post-consultation rating and feedback |
| `/dashboard/messages` | Client | Secure direct advocate communication threads with simulated instant replies |
| `/dashboard/emergency` | Client | 24/7 statutory helplines (112, 181, 15100 DLSA) and situational constitutional rights guides |
| `/dashboard/profile` | Client | User details, language preference, and DPDP Act 2023 consent ledger (grant/revoke/erase) |
| `/practices` | Client | Anchor navigation, practice detail cards, consultation modal |
| `/people` | Client | Advocate directory, filters/search, vCard download |
| `/matters` | Client | Matter ledger with category/search filters |
| `/insights` | Client | Guide index, category tabs, search, newsletter form |
| `/insights/[slug]` | Server with `generateStaticParams`-style lookup from static data | Guide detail |
| `/firm` | Server/client sections | Story, timeline, commitments, client profiles, pro bono |
| `/contact` | Client | Four-step conflict-check intake simulation |
| `/privacy` | Server | Privacy notice |
| `/disclaimer` | Server | Legal notices |
| `not-found` | Server | Custom 404 |
| `sitemap.ts` | Metadata route | Static + article URLs |
| `layout.tsx` | Root layout | AuthProvider wrapper, metadata, fonts, conditional navbar/footer, back-to-top |

## Key components

### Layout

- `src/components/layout/navbar.tsx` — primary navigation with dropdown.
- `src/components/layout/footer.tsx` — footer links and legal copy.
- `src/components/layout/container.tsx` — width variants (`md`, `lg`, `xl`).
- `src/components/layout/section.tsx` — consistent section spacing.
- `src/components/layout/back-to-top.tsx` — scroll control.

### Home sections

- `hero-section.tsx` — headline, language/advocate social proof, CTAs, 3D scene.
- `about-strip.tsx` — metrics and positioning.
- `practices-slider.tsx` — practice carousel.
- `transparency-preview.tsx` — fee/transparency messaging.
- `contract-annotator.tsx` — interactive clause annotations (client-side only,
  no AI call).
- `matters-preview.tsx` — selected outcomes.
- `partner-showcase.tsx` — client institutions.
- `client-quotes.tsx` — testimonials.
- `latest-insights.tsx` — recent guides.
- `faq-section.tsx` — accordion.
- `conflict-intake-section.tsx` — home-page conflict-check form (simulated).

### UI primitives

`button.tsx`, `input.tsx` (`Input`, `Textarea`, `Select`), `modal.tsx`,
`quick-consultation-modal.tsx`, `tabs.tsx`, `accordion.tsx`, `badge.tsx`,
`card.tsx`.

### Dashboard portal

The authenticated portal is self-contained under `src/app/dashboard/`. It uses a
dashboard-only shell (`layout.tsx`), scoped CSS (`dashboard.css`, nested under
`.dashboard-scope`), UI primitives in `src/components/dashboard/`, and mock
services in `src/services/dashboard/`. Ported screens keep the reference
structure and English copy; only the palette is mapped to the warm-paper tokens
in `globals.css`. `src/lib/dashboard-utils.ts` provides `dh()`, which maps a
reference route such as `/cases` to `/dashboard/cases`.

### 3D

`src/components/3d/lady-justice-canvas.tsx` is dynamically imported with
`ssr: false` from the hero. It loads the Lady Justice GLB and textures from
`public/models/lady-justice/`. Do not make the hero a fully client component just
to host the canvas; the existing `dynamic()` boundary is intentional.

## Data layer

All content currently comes from `src/data/`:

| File | Export | Consumers |
| --- | --- | --- |
| `practices.ts` | `practices` | Home slider, `/practices` |
| `lawyers.ts` | `partners`, `teamRoster` | `/people`, CTAs |
| `matters.ts` | `matters` | Home preview, `/matters` |
| `articles.ts` | `articles` | `/insights`, `/insights/[slug]`, sitemap |
| `faqs.ts` | `faqs` | Home FAQ |
| `testimonials.ts` | `testimonials` | Home quotes |
| `fixed-fees.ts` | `fixedFees` | Transparency/fee UI |
| `firm.ts` | `firmTimeline`, `writtenCommitments`, `clientProfiles`, `proBonoDetails` | `/firm` |
| `partners.ts` | `clientInstitutions` | Home partner showcase |
| `navigation.ts` | `navigationLinks` | Navbar/footer |
| `mock-citizen-data.ts` | `demoUser`, `notifications`, language labels | Auth context, dashboard shell |
| `dashboard-mock-data.ts` | Ported reference seed data | Dashboard mock services |

Types live in `src/types/index.ts`. Dashboard-specific ported types live in
`src/types/dashboard.ts`.

### Static vs API content

The backend seed content was manually aligned with most of these arrays, but the
frontend does not fetch it. Until integration is complete:

- Changing content may require edits in **both** `frontend/src/data/` and
  `backend/src/db/seed-data/`.
- The backend is the better long-term source of truth.
- See [`CONTENT.md`](CONTENT.md) for the current mismatches and legacy copy.

## API integration plan

The backend contract is documented in [`API.md`](API.md).

### 1. Add an API base URL

Create `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Use a server-only variable if the client never calls the API directly.

### 2. Add a typed client

Suggested `src/lib/api.ts`:

```ts
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type ApiEnvelope<T> = {
  data: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export async function apiGet<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body?.error?.message ?? "Request failed");
  }

  return body as ApiEnvelope<T>;
}
```

Add Next.js caching/revalidation deliberately, for example:

```ts
const { data: practices } = await apiGet<Practice[]>("/practices", {
  next: { revalidate: 300 },
});
```

### 3. Migration order

1. `/api/v1/site` → navbar/footer/contact/site shell.
2. `/api/v1/practices` → home slider and `/practices`.
3. `/api/v1/advocates` → `/people`.
4. `/api/v1/matters` + `/matters/categories` → `/matters`.
5. `/api/v1/insights` + `/insights/categories` → `/insights` and detail.
6. `/api/v1/catalog` → FAQ, testimonials, fixed fees.
7. `POST /api/v1/intake` → `/contact`, home conflict section, quick consultation
   modal.
8. `POST /api/v1/newsletter` → `/insights` subscribe form.

### 4. Intake form mapping

The current forms collect data that maps to the intake API with small changes:

| UI field | API field |
| --- | --- |
| Full name | `fullName` |
| Company/entity | `companyName` (stored in `metadata`) |
| Email | `email` |
| Phone | `phone` |
| Role/title | `role` (stored in `metadata`) |
| Practice group | `practiceArea` |
| Adverse parties | `adverseParties` |
| Urgency | `urgency` (`upcoming-30d` → `standard-30d`, `none-yet` → `exploratory`) |
| Matter description | `matterSummary` |
| Preferred date/time | `preferredDate`, `preferredTime` (consultation only) |
| Consent checkbox | `consentAcknowledged: true` |
| Form type | `kind` (`legal-assessment`, `conflict-check`, `consultation`) |

The home conflict form currently uses a `none-yet` urgency and a simulated
`setTimeout`. Replace the timeout with a `POST /api/v1/intake` call and display
the returned `reference` and `nextStep`.

Do not send privileged or highly sensitive material before a conflict clearance;
the UI copy already warns about this. Keep the warning.

### 5. Error and loading states

- Keep the existing step validation; add server-side field errors from the
  `validation_error` `details` array.
- Show the `requestId` in support copy when a request fails.
- Disable the submit button while in flight; prevent duplicate submissions.
- Respect `429` with a retry message instead of a generic failure.
- For newsletter, treat `202` as success and keep the form idempotent.

## Styling and design system

- Palette tokens are inline hex values: paper `#f3ece1` / `#f4efe6`, surface
  `#fffaf2`, border `#e2d5c1`, ink `#2a1c12`, muted `#5b4a3b`, accent gold
  `#9a6a35`, error `#9e2a2b`.
- Display type is a serif (Gambetta via Fontshare); body is General Sans. The
  stylesheet is loaded in `layout.tsx`.
- Labels often use uppercase mono with wide tracking.
- Borders are square and thin; shadows are restrained.
- Framer Motion is used for entrance transitions and step changes. Keep duration
  short and avoid gratuitous motion.
- Tailwind 4 is wired through `@tailwindcss/turbopack` in `next.config.ts`.

## Next.js config notes

`next.config.ts` enables:

- `cacheComponents: true`
- `partialPrefetching: true`
- Remote images from `images.unsplash.com` and `framerusercontent.com`
- Tailwind CSS via Turbopack rules

If you add a new remote image host, update `images.remotePatterns`. Do not disable
the image optimizer to work around a missing host.

## Forms and client state

- Forms are local React state with hand-written validation.
- No form library, schema resolver, or shared validation package is used.
- The `/contact` form is a four-step state machine (`1 | 2 | 3 | 4`).
- The home conflict form and quick consultation modal each simulate a submission
  with `setTimeout`.
- `/people` generates a vCard string in the browser.
- `/insights` filters locally and simulates newsletter subscription.

There is no global state manager and no React Query/SWR. Server components plus
`fetch` caching should be preferred over adding a client data library for public
content.

## Known frontend debt

| Item | Detail |
| --- | --- |
| Legacy brand copy | Multiple pages still say Ellery Kowal LLP / Chicago / Illinois |
| Legacy sitemap host | `src/app/sitemap.ts` uses `https://ellery-visuvate.framer.website` |
| Package name | `frontend/package.json` name is `ellery-app` |
| CSS comment | `src/app/globals.css` references Ellery Kowal tokens |
| Fixed fees | USD amounts and legacy firm packages |
| Mixed data | Some arrays are India-focused; some firm/articles copy is US-focused |
| No API usage | All content is static; all writes are simulated |
| No tests | No unit, component, or E2E suite |
| Duplicate 3D assets | `public/model/` and `public/models/` both exist |
| Newsletter copy | Mentions a "partner distribution list" and quarterly briefing |

See [`CONTENT.md`](CONTENT.md) for the full register and remediation order.

## Verification

```bash
cd frontend
npm run lint
npm run build
```

The production build is the best check for App Router, metadata, image, and
server/client boundary issues. If the build fails on remote images, verify the
host is in `next.config.ts`.

## Related docs

- [`API.md`](API.md) — request/response contract
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — system context
- [`CONTENT.md`](CONTENT.md) — copy and compliance rules
- [`DEVELOPMENT.md`](DEVELOPMENT.md) — setup and troubleshooting
