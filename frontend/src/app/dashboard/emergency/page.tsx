"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Handshake,
  Phone,
  Scale,
  ShieldAlert,
  Siren,
  WifiOff,
} from "lucide-react";
import { emergencyRights } from "@/data/dashboard-mock-data";
import { Badge } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";
import { PageHeader, Disclaimer } from "@/components/dashboard/shared";
import { dh } from "@/lib/dashboard-utils";

const actions = [
  { key: "arrest", label: "Someone is being arrested", icon: ShieldAlert },
  { key: "domestic_violence", label: "Domestic violence", icon: Siren },
  { key: "harassment", label: "Harassment or stalking", icon: Phone },
  { key: "threat", label: "A threat to safety", icon: Siren },
] as const;

const helplines = [
  { number: "112", label: "Emergency police", desc: "Immediate danger, arrest, violence", tone: "danger" },
  { number: "181", label: "Women helpline", desc: "Domestic violence, safety", tone: "warn" },
  { number: "15100", label: "Free legal aid", desc: "DLSA / NALSA helpline", tone: "mint" },
] as const;

export default function EmergencyPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<keyof typeof emergencyRights | null>(null);
  const info = selected ? emergencyRights[selected] : null;

  return (
    <div className="animate-fade">
      <PageHeader
        eyebrow="Emergency"
        title="Get help now"
        subtitle="This page works without any AI call and is designed for a slow connection. If there is immediate danger, call 112 first."
        backTo={dh("/")}
        actions={
          <Badge tone="mint">
            <WifiOff className="size-3" /> Works on low bandwidth
          </Badge>
        }
      />

      {/* Helplines first, always visible */}
      <section aria-label="Emergency helplines" className="grid gap-3 sm:grid-cols-3">
        {helplines.map((h) => (
          <a
            key={h.number}
            href={`tel:${h.number}`}
            className={cn(
              "group flex items-center gap-3.5 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-pop",
              h.tone === "danger" && "border-danger/25 bg-danger-soft",
              h.tone === "warn" && "border-warn/25 bg-warn-soft",
              h.tone === "mint" && "border-dot/25 bg-mint-soft"
            )}
          >
            <span
              className={cn(
                "grid size-12 shrink-0 place-items-center rounded-2xl text-card-bg",
                h.tone === "danger" && "bg-danger",
                h.tone === "warn" && "bg-warn",
                h.tone === "mint" && "bg-dot"
              )}
            >
              <Phone className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[21px] leading-tight font-extrabold">{h.number}</span>
              <span className="block text-[12px] font-semibold text-ink">{h.label}</span>
              <span className="block text-[10.5px] text-body">{h.desc}</span>
            </span>
            <span className="ml-auto hidden text-[10px] font-bold text-body group-hover:block sm:block">TAP TO CALL</span>
          </a>
        ))}
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_340px]">
        <section className="card p-5 sm:p-6">
          {!info ? (
            <>
              <h2 className="text-[17px] font-extrabold">What is happening?</h2>
              <p className="mt-1 text-[12.5px] text-body">Choose the closest situation. This is not a legal intake and nothing is sent to an AI.</p>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {actions.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setSelected(a.key)}
                    className="flex min-h-[64px] cursor-pointer items-center gap-3 rounded-xl border border-line p-4 text-left transition hover:border-danger/40 hover:bg-danger-soft/40"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger">
                      <a.icon className="size-4.5" aria-hidden />
                    </span>
                    <span className="flex-1 text-[13px] font-semibold text-ink">{a.label}</span>
                    <ArrowRight className="size-4 text-muted" aria-hidden />
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-brand-tint p-3.5">
                <Siren className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                <p className="text-[11.5px] leading-5 text-body">
                  If someone’s life is in danger, do not read further. Call <a href="tel:112" className="font-bold text-danger underline">112</a> now.
                </p>
              </div>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setSelected(null)} className="mb-3 inline-flex cursor-pointer items-center gap-1 text-[12px] font-semibold text-body hover:text-ink">
                <ArrowLeft className="size-3.5" aria-hidden /> Choose another situation
              </button>
              <div className="rounded-2xl bg-danger-soft p-4">
                <h2 className="text-[19px] font-extrabold text-danger">{info.title}</h2>
                <p className="mt-1 text-[12.5px] leading-5.5 text-danger/90">{info.summary}</p>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="flex items-center gap-1.5 text-[12.5px] font-bold">
                    <BadgeCheck className="size-4 text-dot" aria-hidden /> Your rights
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {info.rights.map((r) => (
                      <li key={r} className="flex gap-2 text-[11.5px] leading-5 text-body">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-danger" aria-hidden /> {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="flex items-center gap-1.5 text-[12.5px] font-bold">
                    <Siren className="size-4 text-danger" aria-hidden /> First steps
                  </h3>
                  <ol className="mt-2 space-y-2">
                    {info.firstSteps.map((s, i) => (
                      <li key={s} className="flex gap-2 text-[11.5px] leading-5 text-body">
                        <span className="grid size-4 shrink-0 place-items-center rounded-full bg-danger text-[9px] font-bold text-card-bg">{i + 1}</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row">
                <a
                  href={`tel:${info.helpline}`}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-danger text-[13px] font-bold text-card-bg transition hover:bg-brand-dark"
                >
                  <Phone className="size-4" aria-hidden /> Call {info.helpline} now
                </a>
                <Link
                  href={dh("/advocates")}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand text-[13px] font-bold text-card-bg transition hover:bg-brand-dark"
                >
                  <Scale className="size-4" aria-hidden /> Connect an advocate urgently
                </Link>
              </div>
              <button
                type="button"
                onClick={() => router.push(dh("/triage"))}
                className="mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 text-[11.5px] font-semibold text-body hover:bg-brand-tint"
              >
                <Handshake className="size-3.5" aria-hidden /> Contact legal aid instead
              </button>
            </>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-danger/20 bg-danger-soft p-4">
            <p className="flex items-center gap-1.5 text-[12px] font-bold text-danger">
              <Siren className="size-4" aria-hidden /> If you are in danger
            </p>
            <p className="mt-1.5 text-[11.5px] leading-5 text-danger/90">
              Call 112. You can also walk into the nearest police station or ask a protection officer for help. Keep
              your phone charged and share your location with a trusted person.
            </p>
            <a href="tel:112" className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-danger text-[13px] font-bold text-card-bg">
              <Phone className="size-4" aria-hidden /> Call 112
            </a>
          </div>

          <div className="card p-4">
            <p className="text-[11.5px] font-bold">No AI is used on this page</p>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-5 text-body">
              <li>· Helplines are static links.</li>
              <li>· Rights summaries are pre-written and reviewed.</li>
              <li>· No chat, no model call, no document upload.</li>
              <li>· Works on a 2G connection.</li>
            </ul>
          </div>

          <div className="rounded-2xl bg-brand-tint p-4">
            <p className="text-[11.5px] font-bold">After the immediate danger</p>
            <p className="mt-1 text-[11px] leading-5 text-body">
              You can record what happened in the app, keep documents safe, and track deadlines. Nothing is shared
              without your consent.
            </p>
            <Link href={dh("/vault")} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline">
              Open document vault <ArrowRight className="size-3" aria-hidden />
            </Link>
          </div>

          <Disclaimer variant="banner" text="Rights summaries are general information. They are not legal advice and may not cover your specific facts." />
        </aside>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-muted">
        <Link href={dh("/profile")} className="hover:underline">Grievance officer</Link>
        <span>·</span>
        <Link href={dh("/profile")} className="hover:underline">Privacy & consent</Link>
        <span>·</span>
        <a href="tel:15100" className="hover:underline">DLSA 15100</a>
      </div>
    </div>
  );
}
