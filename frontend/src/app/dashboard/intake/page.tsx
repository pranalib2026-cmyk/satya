"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ClipboardList,
  Loader2,
  Pencil,
  X,
} from "lucide-react";
import { intakeQuestions } from "@/data/dashboard-mock-data";
import { classifyIntake, saveCaseProfile, type IntakeAnswers } from "@/services/dashboard/intake";
import type { CaseProfile } from "@/types/dashboard";
import { Button, Input, Textarea, Field, Select, Progress } from "@/components/dashboard/ui";
import { Disclaimer } from "@/components/dashboard/shared";
import { cn } from "@/lib/utils";
import { dh } from "@/lib/dashboard-utils";

const emptyAnswers: IntakeAnswers = { facts: "", when: "", who: "", documents: [], urgency: "" };

export default function IntakePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<IntakeAnswers>(emptyAnswers);
  const [custom, setCustom] = useState("");
  const [profile, setProfile] = useState<CaseProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  const total = intakeQuestions.length;
  const q = intakeQuestions[step];

  const setValue = (patch: Partial<IntakeAnswers>) => setAnswers((a) => ({ ...a, ...patch }));

  const toggleDoc = (doc: string) => {
    setValue({
      documents: answers.documents.includes(doc)
        ? answers.documents.filter((d) => d !== doc)
        : [...answers.documents, doc],
    });
  };

  const canContinue = () => {
    if (!q) return false;
    if (q.field === "facts") return answers.facts.trim().length > 8;
    if (q.field === "when") return !!answers.when;
    if (q.field === "who") return !!answers.who;
    if (q.field === "documents") return answers.documents.length > 0;
    return !!answers.urgency;
  };

  const next = async () => {
    if (step < total - 1) {
      setStep((s) => s + 1);
      setCustom("");
      return;
    }
    setLoading(true);
    const result = await classifyIntake(answers);
    setProfile(result);
    setLoading(false);
  };

  const save = () => {
    if (!profile) return;
    saveCaseProfile(profile);
    router.push(dh("/triage"));
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
        <div className="grid size-12 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/50">
          <Loader2 className="size-6 animate-spin text-[#9a6a35]" />
        </div>
        <h1 className="mt-5 font-serif text-[24px] font-normal text-[#2a1c12]">Structuring Matter Facts</h1>
        <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#5b4a3b]">
          Analyzing jurisdiction, limitation applicability, and procedural pathways against statutory court rules.
        </p>
        <div className="mt-6 w-full max-w-xs">
          <Progress value={75} label="Classifying" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade">
      {/* Editorial Header */}
      <div className="pb-5 border-b border-[#e2d5c1] flex items-center justify-between">
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-sans uppercase tracking-[0.14em] font-medium text-[#85725f]">
            <ClipboardList className="size-3.5 text-[#9a6a35]" aria-hidden /> Structured Intake
          </p>
          <h1 className="font-serif text-[28px] sm:text-[34px] font-normal tracking-tight text-[#2a1c12] leading-tight">
            Build Your Matter Profile
          </h1>
        </div>
        {!profile && (
          <div className="text-right">
            <span className="inline-block px-2.5 py-0.5 text-xs font-mono font-medium border border-[#e2d5c1] bg-[#fffaf2] text-[#2a1c12] rounded-[2px]">
              Question {step + 1} of {total}
            </span>
            <button
              type="button"
              onClick={() => router.push(dh("/chat"))}
              className="block mt-1 text-[11px] font-medium text-[#85725f] hover:text-[#2a1c12]"
            >
              Skip to assistant →
            </button>
          </div>
        )}
      </div>

      {!profile && <Progress value={((step + 1) / total) * 100} className="mb-5" label="Intake progress" />}

      {!profile && q && (
        <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-6 sm:p-8 shadow-[0_1px_2px_rgba(42,28,18,0.04)]">
          <div className="flex items-start gap-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/50 font-mono text-sm font-semibold text-[#2a1c12]">
              {step + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="font-serif text-[20px] sm:text-[22px] font-normal text-[#2a1c12] leading-snug">
                {q.question}
              </h2>
              <p className="text-xs text-[#85725f] leading-relaxed">{q.hint}</p>

              {q.field === "facts" && (
                <div className="mt-4 space-y-1">
                  <Textarea
                    value={answers.facts}
                    onChange={(e) => setValue({ facts: e.target.value })}
                    placeholder="State the core chronology of events. For example: Vacated leased premises in Bengaluru on 15 September; lessor withheld ₹1,20,000 security deposit without itemized deductions despite statutory notice served…"
                    rows={5}
                    autoFocus
                  />
                  <p className="text-right text-[11px] font-mono text-[#85725f]">{answers.facts.length} / 1000 characters</p>
                </div>
              )}

              {q.field === "when" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {q.quickReplies.map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setValue({ when: r })}
                      className={cn(
                        "h-10 rounded-[2px] border px-4 text-xs font-medium transition cursor-pointer",
                        answers.when === r
                          ? "border-[#2a1c12] bg-[#2a1c12] text-[#fffaf2]"
                          : "border-[#e2d5c1] bg-[#fffaf2] text-[#5b4a3b] hover:border-[#cfbe9e]"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}

              {q.field === "who" && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {q.quickReplies.map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setValue({ who: r })}
                      className={cn(
                        "flex h-11 items-center justify-between rounded-[2px] border px-4 text-xs font-medium transition cursor-pointer",
                        answers.who === r
                          ? "border-[#2a1c12] bg-[#ebe1d1]/50 text-[#2a1c12] font-semibold"
                          : "border-[#e2d5c1] bg-[#fffaf2] text-[#5b4a3b] hover:border-[#cfbe9e]"
                      )}
                    >
                      <span>{r}</span>
                      {answers.who === r && <Check className="size-4 text-[#9a6a35]" aria-hidden />}
                    </button>
                  ))}
                </div>
              )}

              {q.field === "documents" && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {q.quickReplies.map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => toggleDoc(r)}
                      className={cn(
                        "flex h-11 items-center justify-between rounded-[2px] border px-4 text-xs font-medium transition cursor-pointer",
                        answers.documents.includes(r)
                          ? "border-[#2a1c12] bg-[#ebe1d1]/50 text-[#2a1c12] font-semibold"
                          : "border-[#e2d5c1] bg-[#fffaf2] text-[#5b4a3b] hover:border-[#cfbe9e]"
                      )}
                    >
                      <span>{r}</span>
                      {answers.documents.includes(r) && <Check className="size-4 text-[#9a6a35]" aria-hidden />}
                    </button>
                  ))}
                </div>
              )}

              {q.field === "urgency" && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {q.quickReplies.map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setValue({ urgency: r })}
                      className={cn(
                        "flex h-11 items-center justify-between rounded-[2px] border px-4 text-xs font-medium transition cursor-pointer",
                        answers.urgency === r
                          ? "border-[#2a1c12] bg-[#ebe1d1]/50 text-[#2a1c12] font-semibold"
                          : "border-[#e2d5c1] bg-[#fffaf2] text-[#5b4a3b] hover:border-[#cfbe9e]",
                        r === "Emergency" && answers.urgency === r && "border-[#c0392b] bg-[#fdf2f0] text-[#c0392b]"
                      )}
                    >
                      <span>{r}</span>
                      {answers.urgency === r && <Check className="size-4" aria-hidden />}
                    </button>
                  ))}
                </div>
              )}

              {(q.field === "who" || q.field === "documents") && (
                <div className="mt-3.5 flex items-center gap-2">
                  <Input
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="Specify other documentary or opposing party detail"
                    className="h-10 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (!custom.trim()) return;
                      if (q.field === "documents") {
                        setValue({ documents: [...answers.documents, custom.trim()] });
                      } else {
                        setValue({ who: custom.trim() });
                      }
                      setCustom("");
                    }}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-[#e2d5c1] flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (step === 0 ? router.push(dh("/chat")) : setStep((s) => s - 1))}
            >
              <ArrowLeft className="size-3.5 mr-1" aria-hidden /> {step === 0 ? "Return to Assistant" : "Previous Question"}
            </Button>
            <Button size="sm" variant="compound" onClick={next} disabled={!canContinue()}>
              {step === total - 1 ? "Synthesize Profile" : "Next Question"}
            </Button>
          </div>
        </div>
      )}

      {profile && (
        <div className="space-y-5">
          <div className="flex items-center gap-2 rounded-[2px] border border-[#e2d5c1] bg-[#dceada]/50 p-3 text-xs font-medium text-[#1e5623]">
            <Check className="size-4 text-[#2e7d32]" aria-hidden /> Draft matter profile compiled. Review statutory parameters before proceeding to triage.
          </div>

          <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] shadow-[0_1px_2px_rgba(42,28,18,0.04)] overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-[#e2d5c1] bg-[#ebe1d1]/30 p-5 sm:p-6">
              <div>
                <span className="text-[10px] font-sans uppercase tracking-[0.14em] font-semibold text-[#85725f]">Matter Summary · Preliminary</span>
                <h2 className="mt-1 font-serif text-[22px] sm:text-[24px] font-normal text-[#2a1c12]">{profile.title}</h2>
                <p className="mt-0.5 text-xs text-[#85725f]">Statutory Confidence {Math.round(profile.confidence * 100)}% · Deterministic Legal Rules</p>
              </div>
              <Button size="sm" variant={editing ? "primary" : "secondary"} onClick={() => setEditing((v) => !v)}>
                {editing ? <><Check className="size-3.5 mr-1" /> Save</> : <><Pencil className="size-3.5 mr-1" /> Edit</>}
              </Button>
            </div>

            <div className="grid gap-4 p-5 sm:p-6 sm:grid-cols-2 text-xs">
              <Field label="Category" htmlFor="category">
                <Input
                  id="category"
                  value={profile.category}
                  onChange={(e) => setProfile({ ...profile, category: e.target.value })}
                  disabled={!editing}
                />
              </Field>
              <Field label="Sub-Category" htmlFor="subcategory">
                <Input
                  id="subcategory"
                  value={profile.subCategory}
                  onChange={(e) => setProfile({ ...profile, subCategory: e.target.value })}
                  disabled={!editing}
                />
              </Field>
              <Field label="Probable Court / Forum" htmlFor="forum" className="sm:col-span-2">
                <Input
                  id="forum"
                  value={profile.probableForum}
                  onChange={(e) => setProfile({ ...profile, probableForum: e.target.value })}
                  disabled={!editing}
                />
              </Field>
              <Field label="Urgency Level">
                <Select
                  value={profile.urgency}
                  onChange={(e) => setProfile({ ...profile, urgency: e.target.value as CaseProfile["urgency"] })}
                  disabled={!editing}
                >
                  <option value="immediate">Immediate</option>
                  <option value="time-bound">Time-bound</option>
                  <option value="routine">Routine</option>
                </Select>
              </Field>
              <Field label="Procedural Complexity">
                <Select
                  value={profile.complexity}
                  onChange={(e) => setProfile({ ...profile, complexity: e.target.value as CaseProfile["complexity"] })}
                  disabled={!editing}
                >
                  <option value="self-help-possible">Self-help possible</option>
                  <option value="advocate-advised">Advocate advised</option>
                  <option value="specialist-needed">Specialist needed</option>
                </Select>
              </Field>

              <div className="sm:col-span-2 space-y-1.5">
                <p className="text-xs font-sans uppercase tracking-[0.12em] font-medium text-[#5b4a3b]">Critical Statutory Limitation Dates</p>
                <div className="space-y-2">
                  {profile.keyDates.map((kd, i) => (
                    <div key={kd.label} className="flex flex-col gap-2 rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 p-3 sm:flex-row sm:items-center">
                      <span className="flex-1 text-xs font-semibold text-[#2a1c12]">{kd.label}</span>
                      <span className="text-xs font-mono text-[#5b4a3b]">{kd.date}</span>
                      <input
                        type="date"
                        value={kd.date}
                        disabled={!editing}
                        onChange={(e) => {
                          const nextDates = [...profile.keyDates];
                          nextDates[i] = { ...kd, date: e.target.value };
                          setProfile({ ...profile, keyDates: nextDates });
                        }}
                        className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] px-2 py-1 text-xs disabled:bg-transparent font-mono"
                        aria-label={`${kd.label} date`}
                      />
                      <span className="text-[11px] text-[#85725f]">{kd.basis}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Field label="Primary Relief Sought" className="sm:col-span-2">
                <Textarea
                  value={profile.userGoal}
                  onChange={(e) => setProfile({ ...profile, userGoal: e.target.value })}
                  disabled={!editing}
                  rows={2}
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={() => setProfile(null)}>
              <X className="size-4 mr-1" aria-hidden /> Reset Intake Form
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => router.push(dh("/chat"))}>
                Back to Assistant
              </Button>
              <Button size="sm" variant="compound" onClick={save}>
                Proceed to Triage
              </Button>
            </div>
          </div>

          <Disclaimer />
        </div>
      )}
    </div>
  );
}
