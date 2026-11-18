"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Info,
  MapPin,
  Receipt,
  ShieldCheck,
  Sparkles,
  Stamp,
} from "lucide-react";
import { templates } from "@/data/dashboard-mock-data";
import { loadCaseProfile } from "@/services/dashboard/intake";
import { printHtml } from "@/lib/dashboard-print";
import { Badge, Button, Field, Input, Textarea } from "@/components/dashboard/ui";
import { Disclaimer, PageHeader } from "@/components/dashboard/shared";
import { cn } from "@/lib/utils";
import { dh } from "@/lib/dashboard-utils";
import { DASHBOARD_TODAY_PLACEHOLDER } from "@/lib/dashboard-time";

const prefill: Record<string, string> = {
  recipient: "Mr. S. Rao, 402 Lake View Apartments, HSR Layout, Bengaluru 560102",
  sender: "Rahul Kumar, 12th Main, Indiranagar, Bengaluru 560038",
  facts:
    "I vacated the flat on 15 September 2026 and returned all keys. The flat was handed over in good condition apart from normal wear and tear. A security deposit of ₹60,000 has not been refunded despite written reminders.",
  demand: "refund the security deposit of ₹60,000 along with interest",
  deadline: "15 days",
  authority: "The Public Information Officer, BBMP, Bengaluru",
  applicant: "Rahul Kumar, 12th Main, Indiranagar, Bengaluru 560038",
  information: "Copies of all complaints received regarding road repair work on 12th Main, Indiranagar, between January and September 2026.",
  period: "1 January 2026 to 30 September 2026",
  complainant: "Rahul Kumar, 12th Main, Indiranagar, Bengaluru 560038",
  opposite: "M/s TechnoMart Retail Pvt. Ltd., Koramangala, Bengaluru",
  product: "a laptop (invoice INV-8842) costing ₹72,999",
  defect: "the keyboard stopped working within the warranty period, and the seller refused a refund or replacement.",
  relief: "a full refund of ₹72,999 with compensation for mental agony and litigation costs.",
  advocate: "M/s Rao & Associates, Bengaluru",
  points:
    "The premises were inspected on the day of handover in the presence of the building caretaker. No damage was recorded. Photographs taken on the same day are enclosed.",
  request: "withdraw the demand and confirm a date for return of the deposit.",
};

function BeforeYouSend({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-line bg-brand-tint p-4', className)}>
      <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-ink">
        <Info className="size-3.5 text-brand" aria-hidden /> Before you send
      </p>
      <ul className="mt-2 space-y-2">
        {['Use the other side’s full and correct address.', 'Send by registered post or email and keep proof.', 'Keep a copy of every document you attach.'].map((x) => (
          <li key={x} className="flex gap-1.5 text-[11px] leading-4.5 text-body">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-dot" /> {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SelfHelpPage() {
  const router = useRouter();
  const profile = loadCaseProfile();
  const [templateId, setTemplateId] = useState(templates[0].id);
  const template = templates.find((t) => t.id === templateId)!;
  const [values, setValues] = useState<Record<string, string>>(prefill);
  const [reviewed, setReviewed] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [draftDate] = useState(() =>
    DASHBOARD_TODAY_PLACEHOLDER.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
  );

  const rendered = useMemo(
    () =>
      template.body.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
        key === 'date' ? draftDate : values[key] || `[${key}]`,
      ),
    [template, values, draftDate],
  );

  const download = () => {
    printHtml(template.name, rendered.replaceAll('&', '&amp;').replaceAll('<', '&lt;'))
    setGenerated(true)
  }

  return (
    <div className="animate-fade">
      <PageHeader
        eyebrow="Self-help tools"
        title="Draft it yourself, with a checklist"
        subtitle="Reviewed templates with plain-language guidance. Every draft is a starting point — an advocate should review it before you file."
        actions={<Badge tone="mint"><ShieldCheck className="size-3" /> Advocate-reviewed templates</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-[290px_1fr]">
        {/* List */}
        <aside className="min-w-0 space-y-3">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                className={cn(
                  'flex flex-col rounded-xl border p-3.5 text-left transition',
                  templateId === t.id
                    ? 'border-brand bg-brand-tint ring-1 ring-brand/20'
                    : 'border-line bg-card-bg hover:border-brand/30',
                )}
              >
                <span className="flex items-center gap-2">
                  <FileText className={cn('size-4', templateId === t.id ? 'text-brand' : 'text-muted')} aria-hidden />
                  <span className="text-[13px] font-bold text-ink">{t.name}</span>
                </span>
                <span className="mt-1 line-clamp-2 text-[11px] leading-4.5 text-body">{t.description}</span>
              </button>
            ))}
          </div>

          <BeforeYouSend className="hidden lg:block" />
        </aside>

        {/* Editor + preview */}
        <div className="min-w-0 space-y-4">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-brand-tint px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-bold">{template.name}</h2>
                <p className="text-[11px] text-body">Pre-filled from your case profile · {profile ? profile.title : 'your case'}</p>
              </div>
              <Badge tone="outline">Template</Badge>
            </div>

            <div className="grid divide-y divide-line lg:grid-cols-2 lg:divide-x lg:divide-y-0">
              {/* Form */}
              <div className="space-y-3.5 p-4 sm:p-5">
                <p className="text-[10.5px] font-bold tracking-[0.14em] text-muted uppercase">Details</p>
                {template.fields.map((f) => (
                  <Field key={f.key} label={f.label} htmlFor={`f-${f.key}`}>
                    {f.multiline ? (
                      <Textarea
                        id={`f-${f.key}`}
                        rows={4}
                        value={values[f.key] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      />
                    ) : (
                      <Input
                        id={`f-${f.key}`}
                        value={values[f.key] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      />
                    )}
                  </Field>
                ))}
              </div>

              {/* Preview */}
              <div className="bg-brand-tint p-4 sm:p-5">
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="text-[10.5px] font-bold tracking-[0.14em] text-muted uppercase">Live preview</p>
                  <button type="button" onClick={download} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline">
                    <Download className="size-3.5" aria-hidden /> PDF
                  </button>
                </div>
                <div className="max-h-[420px] overflow-y-auto rounded-xl border border-line bg-card-bg p-4 shadow-card">
                  <pre className="font-serif text-[11.5px] leading-6 whitespace-pre-wrap text-ink">{rendered}</pre>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] font-medium text-warn">
                Template. Advocate review recommended.
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setReviewed(true)}>
                  <Sparkles className="size-3.5" aria-hidden /> Get this reviewed
                </Button>
                <Button size="sm" onClick={download}>
                  <Download className="size-3.5" aria-hidden /> Download PDF
                </Button>
              </div>
            </div>
          </div>

          {reviewed && (
            <div className="rounded-xl border border-dot/30 bg-mint-soft px-4 py-3 text-[12.5px] font-semibold text-dot animate-in-up">
              Review requested from Adv. Ananya Rao. You will get a notification when she adds comments.
              <button type="button" onClick={() => router.push(dh('/messages'))} className="ml-2 inline-flex items-center gap-1 underline">
                Open messages <ArrowRight className="size-3" aria-hidden />
              </button>
            </div>
          )}
          {generated && (
            <p className="flex items-center gap-1.5 text-[11.5px] text-muted">
              <CheckCircle2 className="size-3.5 text-dot" aria-hidden /> Draft generated. Keep a copy with your case documents.
            </p>
          )}

          <BeforeYouSend className="lg:hidden" />

          {/* Checklist */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: MapPin, title: 'Where to file', body: template.forum },
              { icon: Receipt, title: 'Fee', body: template.fee },
              { icon: Stamp, title: 'Documents', body: template.documents.join(' · ') },
            ].map((item) => (
              <div key={item.title} className="card p-4">
                <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand">
                  <item.icon className="size-4" aria-hidden />
                </span>
                <p className="mt-2.5 text-[11px] font-bold tracking-wide text-muted uppercase">{item.title}</p>
                <p className="mt-1 text-[12px] leading-5 text-body">{item.body}</p>
              </div>
            ))}
          </div>

          <Disclaimer variant="banner" />
        </div>
      </div>
    </div>
  )
}
