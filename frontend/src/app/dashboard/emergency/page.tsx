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
  { key: "arrest", label: "Impending or Active Arrest", icon: ShieldAlert },
  { key: "domestic_violence", label: "Domestic Violence & Safety Threat", icon: Siren },
  { key: "harassment", label: "Stalking, Harassment & Extortion", icon: Phone },
  { key: "threat", label: "Imminent Physical Harm or Coercion", icon: Siren },
] as const;

const helplines = [
  { number: "112", label: "National Emergency Service", desc: "Immediate police, fire, or ambulance dispatch", tone: "danger" },
  { number: "181", label: "Women in Distress Helpline", desc: "24/7 emergency response & safety refuge", tone: "warn" },
  { number: "15100", label: "NALSA Free Legal Aid", desc: "Statutory state legal services authority", tone: "mint" },
] as const;

export default function EmergencyPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<keyof typeof emergencyRights | null>(null);
  const info = selected ? emergencyRights[selected] : null;

  return (
    <div className="animate-fade space-y-6">
      <PageHeader
        eyebrow="HIGH-PRIORITY CIVIC SAFEGUARD"
        title="Emergency Legal First-Response"
        subtitle="Zero-latency statutory information operating offline without LLM dependencies. In immediate physical danger, dial 112 prior to administrative review."
        backTo={dh("/")}
        actions={
          <Badge tone="mint">
            <WifiOff className="size-3 text-[#2a6b3b]" /> Low-Bandwidth 2G Optimized
          </Badge>
        }
      />

      {/* Helplines first, always visible */}
      <section aria-label="Emergency statutory helplines" className="grid gap-4 sm:grid-cols-3">
        {helplines.map((h) => (
          <a
            key={h.number}
            href={`tel:${h.number}`}
            className={cn(
              "group flex items-center gap-4 rounded-[2px] border p-5 transition-all hover:border-[#2a1c12]",
              h.tone === "danger" && "border-[#9a3424]/40 bg-[#fbf2ef]",
              h.tone === "warn" && "border-[#b97a29]/40 bg-[#fdf5eb]",
              h.tone === "mint" && "border-[#2a6b3b]/40 bg-[#f0f7f2]"
            )}
          >
            <span
              className={cn(
                "grid size-12 shrink-0 place-items-center rounded-[2px] text-[#fffaf2]",
                h.tone === "danger" && "bg-[#9a3424]",
                h.tone === "warn" && "bg-[#b97a29]",
                h.tone === "mint" && "bg-[#2a6b3b]"
              )}
            >
              <Phone className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-serif text-[26px] leading-tight font-normal text-[#2a1c12]">{h.number}</span>
              <span className="block font-medium text-[13px] text-[#2a1c12]">{h.label}</span>
              <span className="block text-[11px] text-[#5b4a3b]">{h.desc}</span>
            </span>
            <span className="ml-auto hidden font-mono text-[9px] uppercase tracking-wider text-[#85725f] group-hover:text-[#2a1c12] sm:block">DIAL</span>
          </a>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-6 sm:p-8">
          {!info ? (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Situation Assessment</p>
              <h2 className="mt-1 font-serif text-[22px] font-normal text-[#2a1c12]">What is the nature of the situation?</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#5b4a3b]">
                Select the nearest category. All responses are parsed deterministically from verified Indian criminal and civic statutes.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {actions.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setSelected(a.key)}
                    className="flex min-h-[72px] cursor-pointer items-center gap-4 rounded-[2px] border border-[#e2d5c1] bg-[#f4efe6] p-4 text-left transition hover:border-[#9a3424] hover:bg-[#fbf2ef]"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] text-[#9a3424]">
                      <a.icon className="size-5" aria-hidden />
                    </span>
                    <span className="flex-1 font-serif text-[14px] font-normal text-[#2a1c12]">{a.label}</span>
                    <ArrowRight className="size-4 text-[#85725f]" aria-hidden />
                  </button>
                ))}
              </div>
              <div className="mt-6 flex items-start gap-3 rounded-[2px] border border-[#9a3424]/30 bg-[#fbf2ef] p-4">
                <Siren className="mt-0.5 size-4.5 shrink-0 text-[#9a3424]" aria-hidden />
                <p className="text-[12px] leading-relaxed text-[#7a2517]">
                  If immediate violence is unfolding, dismiss this browser and dial <a href="tel:112" className="font-bold underline">112</a> without delay.
                </p>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="mb-4 inline-flex cursor-pointer items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-[#85725f] hover:text-[#2a1c12]"
              >
                <ArrowLeft className="size-3.5" aria-hidden /> Re-select situation
              </button>
              <div className="rounded-[2px] border border-[#9a3424]/30 bg-[#fbf2ef] p-5">
                <h2 className="font-serif text-[22px] font-normal text-[#7a2517]">{info.title}</h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#7a2517]">{info.summary}</p>
              </div>

              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="flex items-center gap-2 font-serif text-[16px] font-normal text-[#2a1c12]">
                    <BadgeCheck className="size-4 text-[#2a6b3b]" aria-hidden /> Fundamental Rights
                  </h3>
                  <ul className="mt-3 space-y-2.5">
                    {info.rights.map((r) => (
                      <li key={r} className="flex gap-2.5 text-[12.5px] leading-relaxed text-[#5b4a3b]">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#9a3424]" aria-hidden /> {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="flex items-center gap-2 font-serif text-[16px] font-normal text-[#2a1c12]">
                    <Siren className="size-4 text-[#9a3424]" aria-hidden /> Immediate Protocol
                  </h3>
                  <ol className="mt-3 space-y-2.5">
                    {info.firstSteps.map((s, i) => (
                      <li key={s} className="flex gap-2.5 text-[12.5px] leading-relaxed text-[#5b4a3b]">
                        <span className="grid size-4 shrink-0 place-items-center rounded-[2px] bg-[#2a1c12] font-mono text-[9px] font-medium text-[#fffaf2]">{i + 1}</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-[#e2d5c1] pt-6 sm:flex-row">
                <a
                  href={`tel:${info.helpline}`}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[2px] bg-[#9a3424] font-mono text-[11px] uppercase tracking-wider text-[#fffaf2] transition hover:bg-[#7a2517]"
                >
                  <Phone className="size-4" aria-hidden /> Dial {info.helpline} Immediately
                </a>
                <Link
                  href={dh("/advocates")}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[2px] bg-[#2a1c12] font-mono text-[11px] uppercase tracking-wider text-[#fffaf2] transition hover:bg-[#3d2b1f]"
                >
                  <Scale className="size-4" aria-hidden /> Urgent Advocate Consult
                </Link>
              </div>
              <button
                type="button"
                onClick={() => router.push(dh("/triage"))}
                className="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] py-2.5 font-mono text-[11px] uppercase tracking-wider text-[#5b4a3b] hover:border-[#9a6a35] hover:text-[#2a1c12] transition-colors"
              >
                <Handshake className="size-4 text-[#9a6a35]" aria-hidden /> Access Free Legal Aid (DLSA) Pathway
              </button>
            </>
          )}
        </section>

        <aside className="space-y-6">
          <div className="rounded-[2px] border border-[#9a3424]/40 bg-[#fbf2ef] p-6">
            <p className="flex items-center gap-2 font-serif text-[16px] font-normal text-[#7a2517]">
              <Siren className="size-4" aria-hidden /> Immediate Threat Protocol
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-[#7a2517]">
              Dial 112. You hold the statutory right under Article 22 of the Constitution to communicate with counsel upon apprehension and to demand appearance before a Magistrate within 24 hours.
            </p>
            <a href="tel:112" className="mt-4 flex h-10 items-center justify-center gap-2 rounded-[2px] bg-[#9a3424] font-mono text-[11px] uppercase tracking-wider text-[#fffaf2]">
              <Phone className="size-4" aria-hidden /> Emergency 112
            </a>
          </div>

          <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Deterministic Engine</p>
            <h3 className="mt-1 font-serif text-[16px] font-normal text-[#2a1c12]">No AI Execution on This Route</h3>
            <ul className="mt-3 space-y-2 font-mono text-[11px] text-[#5b4a3b]">
              <li>• Direct carrier telephone hooks</li>
              <li>• Verified statutory constitutional rights</li>
              <li>• Zero external LLM token overhead</li>
              <li>• Guaranteed low-latency execution</li>
            </ul>
          </div>

          <div className="rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Post-Resolution</p>
            <h3 className="mt-1 font-serif text-[16px] font-normal text-[#2a1c12]">Subsequent Evidence Preservation</h3>
            <p className="mt-2 text-[12px] leading-relaxed text-[#5b4a3b]">
              Once physical safety is established, record incident specifics and secure station diary receipts in your vault.
            </p>
            <Link href={dh("/vault")} className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-[#9a6a35] hover:underline">
              Access Encrypted Vault <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>

          <Disclaimer variant="banner" text="Statutory constitutional principles are provided for civic awareness. Contact an enrolled advocate for judicial representation before the magistrate." />
        </aside>
      </div>

      <div className="flex flex-wrap gap-4 pt-2 font-mono text-[11px] text-[#85725f]">
        <Link href={dh("/profile")} className="hover:text-[#2a1c12] hover:underline">Grievance Desk</Link>
        <span>·</span>
        <Link href={dh("/profile")} className="hover:text-[#2a1c12] hover:underline">DPDP Data Sovereign Rights</Link>
        <span>·</span>
        <a href="tel:15100" className="hover:text-[#2a1c12] hover:underline">NALSA Helpline 15100</a>
      </div>
    </div>
  );
}
