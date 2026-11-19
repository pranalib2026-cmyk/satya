"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  FileText,
  Handshake,
  Info,
  MapPin,
  Phone,
  Scale,
  Siren,
  Sparkles,
} from "lucide-react";
import { Button, Badge, Field, Input, Select } from "@/components/dashboard/ui";
import { Disclaimer, PageHeader } from "@/components/dashboard/shared";
import { loadCaseProfile } from "@/services/dashboard/intake";
import { getTriage, runTriage } from "@/services/dashboard/triage";
import { cases, dlsa } from "@/data/dashboard-mock-data";
import type { TriagePath, TriageResult } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { dh } from "@/lib/dashboard-utils";

const ICONS = {
  "self-help": FileText,
  "legal-aid": Handshake,
  advocate: Scale,
  emergency: Siren,
} as const;

export default function TriagePage() {
  const router = useRouter();
  const profile = loadCaseProfile() ?? cases[0];
  const [result, setResult] = useState<TriageResult>(() => runTriage({ profile, annualIncome: 600000 }));
  const [selected, setSelected] = useState<TriagePath["key"]>(result.recommended);

  useEffect(() => {
    getTriage(profile, 600000)
      .then((res) => {
        setResult(res);
        setSelected(res.recommended);
      })
      .catch(() => {});
  }, [profile]);

  const [income, setIncome] = useState("");
  const [category, setCategory] = useState("general");
  const [checked, setChecked] = useState(false);

  const eligible =
    category !== "general" || (!!income && Number(income.replace(/[^\d]/g, "")) <= 300000);

  const path = result.paths.find((p) => p.key === selected) ?? result.paths[0];

  return (
    <div className="space-y-6 animate-fade">
      <PageHeader
        eyebrow="Structured Triage Output"
        title="Recommended Statutory Course of Action"
        subtitle="Determined via deterministic statutory limitation rules and court jurisdiction thresholds — zero commercial bias."
        backTo={dh("/intake")}
        actions={
          <Badge tone="brand" className="h-7">
            <Sparkles className="size-3 mr-1" aria-hidden /> {Math.round(result.confidence * 100)}% Match Confidence
          </Badge>
        }
      />

      {/* Case Assessment Summary Strip */}
      <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-5 shadow-[0_1px_2px_rgba(42,28,18,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs border-b border-[#e2d5c1]/60 pb-3">
          <p><span className="font-sans uppercase tracking-[0.08em] text-[#85725f] font-semibold">Matter:</span> <strong className="text-[#2a1c12] font-semibold">{profile.title}</strong></p>
          <p><span className="font-sans uppercase tracking-[0.08em] text-[#85725f] font-semibold">Urgency:</span> <strong className="text-[#2a1c12] font-semibold uppercase">{profile.urgency}</strong></p>
          <p><span className="font-sans uppercase tracking-[0.08em] text-[#85725f] font-semibold">Complexity:</span> <strong className="text-[#2a1c12] font-semibold capitalize">{profile.complexity.replaceAll("-", " ")}</strong></p>
          <Link href={dh("/intake")} className="font-semibold text-[#9a6a35] hover:underline text-xs">
            Edit Case Intake
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {result.rules.map((r) => (
            <span key={r} className="rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/40 px-2.5 py-1 text-[11px] font-mono text-[#5b4a3b]">
              {r}
            </span>
          ))}
        </div>
      </div>

      {/* Four Triage Paths Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {result.paths.map((p) => {
          const Icon = ICONS[p.key];
          const active = selected === p.key;
          return (
            <button
              type="button"
              key={p.key}
              onClick={() => setSelected(p.key)}
              className={cn(
                "relative flex flex-col rounded-[2px] border p-5 text-left transition-all duration-150 cursor-pointer shadow-[0_1px_2px_rgba(42,28,18,0.04)]",
                active
                  ? "border-[#2a1c12] bg-[#fffaf2] ring-1 ring-[#2a1c12] shadow-[0_4px_20px_rgba(42,28,18,0.06)]"
                  : "border-[#e2d5c1] bg-[#fffaf2] hover:border-[#cfbe9e]"
              )}
              aria-pressed={active}
            >
              {p.recommended && (
                <span className="absolute top-4 right-4 rounded-[2px] border border-[#e2d5c1] bg-[#dceada]/70 px-2 py-0.5 text-[10px] font-sans uppercase tracking-[0.1em] font-semibold text-[#2e7d32]">
                  Recommended Next Step
                </span>
              )}
              <span className="grid size-9 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/50 text-[#9a6a35]">
                <Icon className="size-4.5" aria-hidden />
              </span>
              <h3 className="mt-3 font-serif text-[18px] sm:text-[20px] font-normal leading-snug text-[#2a1c12]">
                {p.title}
              </h3>
              <p className="mt-1 text-xs sm:text-[13px] leading-relaxed text-[#5b4a3b]">{p.description}</p>
              {p.recommended && (
                <div className="mt-3 rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 p-2.5 text-[11.5px] leading-relaxed text-[#5b4a3b]">
                  <span className="font-semibold text-[#2a1c12]">Statutory Reason: </span>
                  {p.reason}
                </div>
              )}
              <span className="mt-auto pt-4 text-xs font-semibold text-[#9a6a35] flex items-center gap-1">
                Select Course of Action →
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Path Action Panel */}
      <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-6 sm:p-7 shadow-[0_1px_2px_rgba(42,28,18,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#e2d5c1]/60">
          <div>
            <p className="text-[10.5px] font-sans uppercase tracking-[0.14em] font-semibold text-[#85725f]">Active Selection</p>
            <h2 className="mt-1 font-serif text-[22px] sm:text-[24px] font-normal text-[#2a1c12]">{path.title}</h2>
          </div>
          <Badge tone={selected === result.recommended ? "mint" : "neutral"}>
            {selected === result.recommended ? "System Recommendation" : "Citizen Discretion"}
          </Badge>
        </div>

        {selected === "self-help" && (
          <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <p className="text-xs sm:text-[13.5px] leading-relaxed text-[#5b4a3b]">
                Access vetted draft notices and statutory forms. File complaints directly before Consumer Commissions, Rent Controllers, or send formal legal demands without initial retainer costs.
              </p>
              <p className="text-[11.5px] text-[#85725f]">Templates contain statutory limitation warnings and filing checklists.</p>
            </div>
            <Button variant="primary" size="md" onClick={() => router.push(dh("/self-help"))}>
              Open Self-Help Library <ArrowRight className="size-4 ml-1" />
            </Button>
          </div>
        )}

        {selected === "advocate" && (
          <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <p className="text-xs sm:text-[13.5px] leading-relaxed text-[#5b4a3b]">
                Connect with advocates verified on State Bar rolls matching your exact court jurisdiction, language, and budget parameters. Detailed reasoning is disclosed for every match.
              </p>
              <p className="flex items-center gap-1 text-[11.5px] text-[#85725f]">
                <Info className="size-3.5 text-[#9a6a35]" aria-hidden /> Bar Council of India Rule 36 compliant non-advertising directory.
              </p>
            </div>
            <Button variant="primary" size="md" onClick={() => router.push(dh("/advocates"))}>
              Match Verified Advocates <ArrowRight className="size-4 ml-1" />
            </Button>
          </div>
        )}

        {selected === "emergency" && (
          <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="text-xs sm:text-[13.5px] leading-relaxed text-[#5b4a3b]">
                In situations of immediate bodily harm, domestic violence, or unlawful custody, bypass online assessments and dial state emergency helplines directly.
              </p>
            </div>
            <Button variant="danger" size="md" onClick={() => router.push(dh("/emergency"))}>
              <Siren className="size-4 mr-1" /> Call Helpline: 112 / 181
            </Button>
          </div>
        )}

        {selected === "legal-aid" && (
          <div className="mt-5 space-y-4">
            <p className="text-xs sm:text-[13.5px] leading-relaxed text-[#5b4a3b]">
              Free advocate representation and waiver of court fees is guaranteed by statute under the Legal Services Authorities Act, 1987. Check preliminary eligibility below.
            </p>

            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Annual Household Income (₹)" htmlFor="income">
                <Input
                  id="income"
                  inputMode="numeric"
                  placeholder="e.g. 240000"
                  value={income}
                  onChange={(e) => {
                    setIncome(e.target.value);
                    setChecked(false);
                  }}
                />
              </Field>
              <Field label="Social Category" htmlFor="category">
                <Select
                  id="category"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setChecked(false);
                  }}
                >
                  <option value="general">General Category</option>
                  <option value="scst">Scheduled Caste / Scheduled Tribe (Automatic Eligibility)</option>
                  <option value="woman">Woman / Child (Automatic Eligibility)</option>
                  <option value="disability">Person with Disability (Automatic Eligibility)</option>
                  <option value="custody">Person in Custody</option>
                </Select>
              </Field>
              <Button variant="secondary" onClick={() => setChecked(true)} disabled={!income && category === "general"}>
                Verify Eligibility
              </Button>
            </div>

            {checked && (
              <div className={cn("rounded-[2px] border p-4 text-xs leading-relaxed", eligible ? "border-[#e2d5c1] bg-[#dceada]/50 text-[#1e5623]" : "border-[#e2d5c1] bg-[#ebe1d1]/40 text-[#5b4a3b]")}>
                <p className="flex items-center gap-1.5 font-semibold text-sm">
                  {eligible ? <CheckCircle2 className="size-4 text-[#2e7d32]" /> : <Info className="size-4 text-[#85725f]" />}
                  {eligible ? "Eligible for Free Legal Services (Sec 12, LSA Act)" : "Standard Income Limit Exceeded"}
                </p>
                <p className="mt-1 text-xs">
                  {eligible
                    ? "Bring identification and case documents to the District Legal Services Authority front office. Free counsel will be assigned."
                    : "You may still consult the DLSA helpline at 15100 to verify state-specific exemptions or access self-help workflows."}
                </p>
              </div>
            )}

            <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/50 text-[#9a6a35]">
                    <Handshake className="size-4.5" aria-hidden />
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-[#2a1c12]">{dlsa.authority}</p>
                    <p className="flex items-start gap-1.5 text-xs text-[#5b4a3b]">
                      <MapPin className="mt-0.5 size-3 text-[#9a6a35] shrink-0" aria-hidden /> {dlsa.address}
                    </p>
                    <p className="text-xs text-[#85725f]">{dlsa.hours}</p>
                  </div>
                </div>
                <a
                  href="tel:15100"
                  className="inline-flex h-10 items-center gap-2 rounded-[2px] border border-[#2a1c12] bg-[#2a1c12] px-4 text-xs font-sans uppercase tracking-[0.1em] font-semibold text-[#fffaf2] transition hover:bg-[#9a6a35] hover:border-[#9a6a35]"
                >
                  <Phone className="size-3.5" aria-hidden /> Call 15100
                </a>
              </div>
              <div className="mt-4 grid gap-2 border-t border-[#e2d5c1]/60 pt-3 sm:grid-cols-2 text-xs text-[#5b4a3b]">
                {dlsa.eligibility.slice(0, 4).map((e) => (
                  <p key={e} className="flex items-start gap-1.5">
                    <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-[#2e7d32]" aria-hidden /> {e}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
        <Disclaimer />
        <Button variant="ghost" size="sm" onClick={() => router.push(dh("/brief"))}>
          Review Matter Brief <ArrowRight className="size-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
