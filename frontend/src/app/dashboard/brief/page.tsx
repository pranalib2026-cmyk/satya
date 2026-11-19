"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Pencil,
  Scale,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { advocates, cases, documents } from "@/data/dashboard-mock-data";
import { loadCaseProfile } from "@/services/dashboard/intake";
import { saveConsent } from "@/services/dashboard/consent";
import { Button, Card, Badge, Checkbox, Textarea } from "@/components/dashboard/ui";
import { PageHeader, Disclaimer } from "@/components/dashboard/shared";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime, dh } from "@/lib/dashboard-utils";

export default function BriefPage() {
  const profile = loadCaseProfile() ?? cases[0];
  const [editing, setEditing] = useState(false);
  const [sections, setSections] = useState({
    facts:
      profile.summary ||
      'The tenant vacated the premises on 15 September 2026 upon lease expiry. An advance security deposit of ₹60,000 was remitted in March 2024. The lessor has withheld the sum alleging painting refurbishment without an attested inspection report.',
    timeline:
      '12 Mar 2024 — Lease deed executed and security deposit remitted\n15 Sep 2026 — Tenancy premises vacated; keys surrendered\n15 Oct 2026 — Written reminder dispatched via registered post\n2 Oct 2026 — Adverse legal notice received from lessor’s counsel',
    parties: 'Rahul Kumar — Lessee (Citizen Client)\nMr. S. Rao — Lessor (Opposite Party)\nM/s Rao & Associates — Counsel for Lessor',
    documents: 'Registered Lease Agreement (12 pp.)\nSecurity Deposit Bank Transaction Receipt\nPremises Handover Photographic Record\nFormal Notice and Rejoinder Correspondence',
    sections:
      'Transfer of Property Act, 1882 — s.108 (Surrender & Deposit Refund)\nKarnataka Rent Act, 1999 — s.27 (Jurisdiction of Rent Controller)\nLimitation Act, 1963 — Art. 22 (Three-year period for monetary claims)',
    forum: profile.probableForum || 'Court of the Rent Controller, Bengaluru Urban',
    limitation: 'Monetary claim enforceable within 36 months of accrual. Recommended filing cutoff: 15 Nov 2026.',
    goal: profile.userGoal || 'Recover the ₹60,000 security deposit with statutory interest without protracted trial delay.',
  });
  const [attached, setAttached] = useState<string[]>(['doc_1', 'doc_2']);
  const [advocateId, setAdvocateId] = useState(advocates[0].id);
  const [consent, setConsent] = useState(false);
  const [shared, setShared] = useState(false);
  const [sharedAt, setSharedAt] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const advocate = advocates.find((a) => a.id === advocateId) ?? advocates[0];

  const share = async () => {
    setSharing(true);
    await saveConsent({
      userId: 'usr_1024',
      consentType: 'share_brief',
      version: '1.0',
      purpose: 'Case brief review and consultation',
      advocateId,
      itemsShared: ['Case brief', ...documents.filter((d) => attached.includes(d.id)).map((d) => d.name)],
    });
    setSharing(false);
    setSharedAt(new Date().toISOString());
    setShared(true);
  };

  const sectionFields: Array<{ key: keyof typeof sections; label: string; rows: number }> = [
    { key: 'facts', label: 'Summary of Verified Facts', rows: 5 },
    { key: 'timeline', label: 'Chronological Sequence', rows: 5 },
    { key: 'parties', label: 'Named Parties & Opposing Counsel', rows: 3 },
    { key: 'documents', label: 'Evidentiary Records Held', rows: 4 },
    { key: 'sections', label: 'Applicable Statutory Provisions', rows: 4 },
    { key: 'forum', label: 'Jurisdictional Bench / Forum', rows: 2 },
    { key: 'limitation', label: 'Limitation Horizon', rows: 2 },
    { key: 'goal', label: 'Client Strategic Objective', rows: 2 },
  ];

  return (
    <div className="animate-fade space-y-6">
      <PageHeader
        eyebrow="CLIENT-COUNSEL HANDOFF"
        title="Matter Dossier & Case Brief"
        subtitle="A controlled legal summary compiled from your structured intake. Edit particulars, attach verified vault documents, and seal DPDP transfer consent."
        backTo={dh('/advocates')}
        actions={
          <Badge tone="brand"><Sparkles className="size-3 text-[#9a6a35]" /> Compiled from Active Docket</Badge>
        }
      />

      {shared ? (
        <div className="space-y-6">
          <div className="rounded-[2px] border border-[#2a6b3b]/30 bg-[#2a6b3b]/10 p-6">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-[2px] border border-[#2a6b3b]/30 bg-[#fffaf2] text-[#2a6b3b]">
                <CheckCircle2 className="size-6" aria-hidden />
              </span>
              <div>
                <h2 className="font-serif text-[20px] font-normal text-[#2a1c12]">Dossier Authorized for Adv. {advocate.name}</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[#5b4a3b]">
                  An immutable, read-only evidentiary snapshot was recorded on {sharedAt ? formatDate(sharedAt) : 'today'}. The DPDP consent registry retains the specific purpose, recipient bar enrollment, and revocability status.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="mint">DPDP Consent Registered</Badge>
                  <Badge tone="neutral">Snapshot v1.0 (Signed)</Badge>
                  <Badge tone="neutral">{attached.length} Vault Annexures Bound</Badge>
                </div>
              </div>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#e2d5c1] bg-[#ebe1d1]/20 px-6 py-4">
              <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">
                <Lock className="size-3.5 text-[#9a6a35]" aria-hidden /> Read-Only Chambers Transmission
              </p>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#85725f]">Authorized {sharedAt ? formatDateTime(sharedAt) : '—'}</span>
            </div>
            <div className="grid gap-x-8 gap-y-6 p-6 sm:grid-cols-2">
              {sectionFields.map((f) => (
                <div key={f.key} className={f.key === 'facts' || f.key === 'timeline' ? 'sm:col-span-2' : ''}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">{f.label}</p>
                  <p className="mt-1.5 font-serif text-[13.5px] leading-relaxed whitespace-pre-line text-[#2a1c12]">{sections[f.key]}</p>
                </div>
              ))}
              <div className="sm:col-span-2 pt-4 border-t border-[#e2d5c1]">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Attached Vault Documents</p>
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {documents.filter((d) => attached.includes(d.id)).map((d) => (
                    <li key={d.id} className="inline-flex items-center gap-1.5 rounded-[2px] border border-[#e2d5c1] bg-[#f4efe6] px-3 py-1 font-mono text-[11px] text-[#2a1c12]">
                      <FileText className="size-3.5 text-[#9a6a35]" aria-hidden /> {d.name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <Button variant="secondary" onClick={() => setShared(false)}>
              <Pencil className="size-4" aria-hidden /> Re-open Draft for Amendments
            </Button>
            <div className="flex gap-2.5">
              <Link
                href={dh("/profile")}
                className="inline-flex h-10 items-center rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] px-4 font-mono text-[11px] uppercase tracking-wider text-[#2a1c12] transition hover:border-[#9a6a35]"
              >
                Inspect Consents
              </Link>
              <Link
                href={dh("/booking/adv_1")}
                className="inline-flex h-10 items-center gap-2 rounded-[2px] bg-[#2a1c12] px-4 font-mono text-[11px] uppercase tracking-wider text-[#fffaf2] transition hover:bg-[#3d2b1f]"
              >
                Schedule Hearing <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
          <Disclaimer />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[#e2d5c1] bg-[#ebe1d1]/20 px-6 py-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Draft Dossier · {profile.category}</p>
                <h2 className="mt-1 font-serif text-[18px] font-normal text-[#2a1c12]">{profile.title}</h2>
              </div>
              <Button size="sm" variant={editing ? 'primary' : 'secondary'} onClick={() => setEditing((v) => !v)}>
                {editing ? <><Check className="size-3.5" /> Save</> : <><Pencil className="size-3.5" /> Edit Particulars</>}
              </Button>
            </div>

            <div className="grid gap-6 p-6 sm:grid-cols-2">
              {sectionFields.map((f) => (
                <div key={f.key} className={f.key === 'facts' || f.key === 'timeline' ? 'sm:col-span-2' : ''}>
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">{f.label}</p>
                  {editing ? (
                    <Textarea
                      rows={f.rows > 3 ? f.rows : 3}
                      value={sections[f.key]}
                      onChange={(e) => setSections({ ...sections, [f.key]: e.target.value })}
                    />
                  ) : (
                    <div className="rounded-[2px] border border-[#e2d5c1] bg-[#f4efe6] p-4 text-[13px] leading-relaxed whitespace-pre-line text-[#2a1c12]">
                      {sections[f.key]}
                    </div>
                  )}
                </div>
              ))}

              <div className="sm:col-span-2">
                <div className="flex items-start gap-3 rounded-[2px] border border-[#b97a29]/30 bg-[#fdf5eb] p-4">
                  <Clock className="mt-0.5 size-4.5 shrink-0 text-[#b97a29]" aria-hidden />
                  <p className="text-[12px] leading-relaxed text-[#5b4a3b]">
                    <span className="font-semibold text-[#8a5b1c]">Statutory Limitation Precaution: </span>
                    Limitation cutoff dates reflect deterministic calculations pursuant to the Limitation Act, 1963. Verify accrual dates with retained advocate before filing.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <aside className="space-y-6">
            <Card className="p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Annexures</p>
              <h2 className="mt-1 flex items-center gap-2 font-serif text-[16px] font-normal text-[#2a1c12]">
                <FileText className="size-4 text-[#9a6a35]" aria-hidden /> Enclose Vault Records
              </h2>
              <p className="mt-1 text-[11.5px] text-[#85725f]">Selected records will be cryptographically bound into the handoff payload.</p>
              <div className="mt-4 space-y-2.5">
                {documents.slice(0, 6).map((d) => (
                  <Checkbox
                    key={d.id}
                    className="!p-3 rounded-[2px] border border-[#e2d5c1] bg-[#f4efe6]"
                    label={d.name}
                    description={`${d.sizeLabel} · ${d.caseTitle}`}
                    checked={attached.includes(d.id)}
                    onChange={(e) =>
                      setAttached((a) => (e.target.checked ? [...a, d.id] : a.filter((x) => x !== d.id)))
                    }
                  />
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Designated Recipient</p>
              <h2 className="mt-1 flex items-center gap-2 font-serif text-[16px] font-normal text-[#2a1c12]">
                <Scale className="size-4 text-[#9a6a35]" aria-hidden /> Counsel of Record
              </h2>
              <div className="mt-4 space-y-2.5">
                {advocates.slice(0, 3).map((a) => (
                  <button
                    type="button"
                    key={a.id}
                    onClick={() => setAdvocateId(a.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[2px] border p-3 text-left transition-colors',
                      advocateId === a.id ? 'border-[#2a1c12] bg-[#f4efe6] ring-1 ring-[#2a1c12]' : 'border-[#e2d5c1] bg-[#fffaf2] hover:border-[#9a6a35]',
                    )}
                  >
                    <span className="grid size-8 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] font-mono text-[11px] font-medium text-[#2a1c12]">
                      {a.initials}
                    </span>
                    <span className="flex-1">
                      <span className="flex items-center gap-1 font-serif text-[13.5px] font-normal text-[#2a1c12]">
                        Adv. {a.name}
                        <BadgeCheck className="size-3 text-[#2a6b3b]" aria-hidden />
                      </span>
                      <span className="block font-mono text-[10px] text-[#85725f]">{a.practiceAreas[0]} · {a.city}</span>
                    </span>
                    <span className={cn('grid size-4 place-items-center rounded-[2px] border', advocateId === a.id ? 'border-[#2a1c12] bg-[#2a1c12] text-[#fffaf2]' : 'border-[#e2d5c1]')}>
                      {advocateId === a.id && <Check className="size-2.5" aria-hidden />}
                    </span>
                  </button>
                ))}
                <Link href={dh("/advocates")} className="block pt-1 font-mono text-[11px] uppercase tracking-wide text-[#9a6a35] hover:underline">
                  Browse alternate verified counsel
                </Link>
              </div>
            </Card>

            <Card className="p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">DPDP Mandate</p>
              <h2 className="mt-1 flex items-center gap-2 font-serif text-[16px] font-normal text-[#2a1c12]">
                <Lock className="size-4 text-[#9a6a35]" aria-hidden /> Explicit Consent Authorization
              </h2>
              <Checkbox
                className="mt-3 !p-3 rounded-[2px] border border-[#e2d5c1] bg-[#f4efe6]"
                label="I authorize transmission of this matter brief and selected vault annexures"
                description={`To Adv. ${advocate.name} strictly for preliminary assessment and scheduled consultation. Revocable via citizen settings.`}
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <Button fullWidth className="mt-4" disabled={!consent} loading={sharing} onClick={share}>
                <Share2 className="size-4" aria-hidden /> Authorize Transmission to Adv. {advocate.name.split(' ')[0]}
              </Button>
              <p className="mt-2.5 text-center font-mono text-[10px] text-[#85725f]">
                Generates a cryptographic consent hash. No data is exposed prior to authorization.
              </p>
            </Card>

            <div className="flex items-start gap-2.5 rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 p-4">
              <X className="mt-0.5 size-4 shrink-0 text-[#85725f]" aria-hidden />
              <p className="font-mono text-[10px] leading-relaxed text-[#5b4a3b]">
                Briefs never expose private phone numbers, Aadhaar identifiers, or unselected documents.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
