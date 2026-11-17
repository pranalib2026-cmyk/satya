"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Loader2,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import { intakeQuestions } from "@/data/dashboard-mock-data";
import { classifyIntake, saveCaseProfile, type IntakeAnswers } from "@/services/dashboard/intake";
import type { CaseProfile } from "@/types/dashboard";
import { Button, Card, Input, Textarea, Field, Select, Progress, Badge } from "@/components/dashboard/ui";
import { Disclaimer } from "@/components/dashboard/shared";
import { cn } from "@/lib/utils";
import { dh } from "@/lib/dashboard-utils";

const emptyAnswers: IntakeAnswers = { facts: '', when: '', who: '', documents: [], urgency: '' }

export default function IntakePage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<IntakeAnswers>(emptyAnswers)
  const [custom, setCustom] = useState('')
  const [profile, setProfile] = useState<CaseProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)

  const total = intakeQuestions.length
  const q = intakeQuestions[step]

  const setValue = (patch: Partial<IntakeAnswers>) => setAnswers((a) => ({ ...a, ...patch }))

  const toggleDoc = (doc: string) => {
    setValue({
      documents: answers.documents.includes(doc)
        ? answers.documents.filter((d) => d !== doc)
        : [...answers.documents, doc],
    })
  }

  const canContinue = () => {
    if (!q) return false
    if (q.field === 'facts') return answers.facts.trim().length > 8
    if (q.field === 'when') return !!answers.when
    if (q.field === 'who') return !!answers.who
    if (q.field === 'documents') return answers.documents.length > 0
    return !!answers.urgency
  }

  const next = async () => {
    if (step < total - 1) {
      setStep((s) => s + 1)
      setCustom('')
      return
    }
    setLoading(true)
    const result = await classifyIntake(answers)
    setProfile(result)
    setLoading(false)
  }

  const save = () => {
    if (!profile) return
    saveCaseProfile(profile)
    router.push(dh('/triage'))
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-brand-soft">
          <Loader2 className="size-6 animate-spin text-brand" />
        </div>
        <h1 className="mt-5 text-[22px] font-extrabold">Organising your facts</h1>
        <p className="mt-2 max-w-sm text-[13.5px] leading-6 text-body">
          Classifying the matter, probable forum and urgency. This is a mock classifier — no LLM call is made in this
          build.
        </p>
        <div className="mt-6 w-full max-w-xs">
          <Progress value={72} label="Classifying" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] text-brand uppercase">
            <ClipboardList className="size-3.5" aria-hidden /> Guided intake
          </p>
          <h1 className="text-[24px] leading-tight font-extrabold sm:text-[28px]">Build your case profile</h1>
        </div>
        {!profile && (
          <div className="text-right">
            <p className="text-[12px] font-bold text-ink">Question {step + 1} of {total}</p>
            <button type="button" onClick={() => router.push(dh('/chat'))} className="text-[11.5px] font-medium text-muted hover:text-ink">
              Skip to chat
            </button>
          </div>
        )}
      </div>

      {!profile && <Progress value={((step + 1) / total) * 100} className="mb-5" label="Intake progress" />}

      {!profile && q && (
        <Card className="p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-[13px] font-extrabold text-brand-dark">
              {step + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] leading-snug font-bold">{q.question}</h2>
              <p className="mt-1 text-[12.5px] text-body">{q.hint}</p>

              {q.field === 'facts' && (
                <div className="mt-4">
                  <Textarea
                    value={answers.facts}
                    onChange={(e) => setValue({ facts: e.target.value })}
                    placeholder="For example: I vacated my flat in HSR Layout on 15 September. The landlord has not returned my ₹60,000 deposit and says there is paint damage."
                    rows={5}
                    autoFocus
                  />
                  <p className="mt-1.5 text-right text-[10.5px] text-muted">{answers.facts.length}/1000</p>
                </div>
              )}

              {q.field === 'when' && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {q.quickReplies.map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setValue({ when: r })}
                      className={cn(
                        'h-11 rounded-xl border px-4 text-[13px] font-semibold transition',
                        answers.when === r
                          ? 'border-brand bg-brand-soft text-brand-dark ring-4 ring-brand/10'
                          : 'border-line text-body hover:border-brand/40',
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}

              {q.field === 'who' && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {q.quickReplies.map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setValue({ who: r })}
                      className={cn(
                        'flex h-11 items-center justify-between rounded-xl border px-4 text-[13px] font-semibold transition',
                        answers.who === r ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line text-body hover:border-brand/40',
                      )}
                    >
                      {r}
                      {answers.who === r && <Check className="size-4 text-brand" aria-hidden />}
                    </button>
                  ))}
                </div>
              )}

              {q.field === 'documents' && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {q.quickReplies.map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => toggleDoc(r)}
                      className={cn(
                        'flex h-11 items-center justify-between rounded-xl border px-4 text-[13px] font-semibold transition',
                        answers.documents.includes(r)
                          ? 'border-brand bg-brand-soft text-brand-dark'
                          : 'border-line text-body hover:border-brand/40',
                      )}
                    >
                      {r}
                      {answers.documents.includes(r) && <Check className="size-4 text-brand" aria-hidden />}
                    </button>
                  ))}
                </div>
              )}

              {q.field === 'urgency' && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {q.quickReplies.map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setValue({ urgency: r })}
                      className={cn(
                        'flex h-12 items-center justify-between rounded-xl border px-4 text-[13px] font-semibold transition',
                        answers.urgency === r ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line text-body hover:border-brand/40',
                        r === 'Emergency' && answers.urgency === r && 'border-danger bg-danger-soft text-danger',
                      )}
                    >
                      {r}
                      {answers.urgency === r && <Check className="size-4" aria-hidden />}
                    </button>
                  ))}
                </div>
              )}

              {(q.field === 'who' || q.field === 'documents') && (
                <div className="mt-3 flex items-center gap-2">
                  <Input
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="Something else? Type it here"
                    className="h-10 text-[13px]"
                  />
                  <Button
                    size="md"
                    variant="secondary"
                    onClick={() => {
                      if (!custom.trim()) return
                      if (q.field === 'documents') {
                        setValue({ documents: [...answers.documents, custom.trim()] })
                      } else {
                        setValue({ who: custom.trim() })
                      }
                      setCustom('')
                    }}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-7 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => (step === 0 ? router.push(dh('/chat')) : setStep((s) => s - 1))}
            >
              <ArrowLeft className="size-4" aria-hidden /> {step === 0 ? 'Back to chat' : 'Previous'}
            </Button>
            <Button onClick={next} disabled={!canContinue()}>
              {step === total - 1 ? (
                <>
                  Build profile <Sparkles className="size-4" aria-hidden />
                </>
              ) : (
                <>
                  Next question <ArrowRight className="size-4" aria-hidden />
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {profile && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-mint-soft px-3.5 py-2.5 text-[12.5px] font-semibold text-dot">
            <Check className="size-4" aria-hidden /> Profile created. Review and edit anything before saving.
          </div>

          <Card className="overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-line bg-brand-tint px-5 py-4">
              <div>
                <p className="text-[10.5px] font-bold tracking-[0.14em] text-muted uppercase">Case profile · draft</p>
                <h2 className="mt-1 text-[19px] font-extrabold">{profile.title}</h2>
                <p className="mt-1 text-[12px] text-body">Confidence {Math.round(profile.confidence * 100)}% · mock classifier</p>
              </div>
              <Button size="sm" variant={editing ? 'primary' : 'secondary'} onClick={() => setEditing((v) => !v)}>
                {editing ? <><Check className="size-3.5" /> Done editing</> : <><Pencil className="size-3.5" /> Edit</>}
              </Button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Category" htmlFor="category">
                <Input
                  id="category"
                  value={profile.category}
                  onChange={(e) => setProfile({ ...profile, category: e.target.value })}
                  disabled={!editing}
                />
              </Field>
              <Field label="Sub-category" htmlFor="subcategory">
                <Input
                  id="subcategory"
                  value={profile.subCategory}
                  onChange={(e) => setProfile({ ...profile, subCategory: e.target.value })}
                  disabled={!editing}
                />
              </Field>
              <Field label="Probable forum" htmlFor="forum" className="sm:col-span-2">
                <Input
                  id="forum"
                  value={profile.probableForum}
                  onChange={(e) => setProfile({ ...profile, probableForum: e.target.value })}
                  disabled={!editing}
                />
              </Field>
              <Field label="Urgency">
                <Select
                  value={profile.urgency}
                  onChange={(e) => setProfile({ ...profile, urgency: e.target.value as CaseProfile['urgency'] })}
                  disabled={!editing}
                >
                  <option value="immediate">Immediate</option>
                  <option value="time-bound">Time-bound</option>
                  <option value="routine">Routine</option>
                </Select>
              </Field>
              <Field label="Complexity">
                <Select
                  value={profile.complexity}
                  onChange={(e) => setProfile({ ...profile, complexity: e.target.value as CaseProfile['complexity'] })}
                  disabled={!editing}
                >
                  <option value="self-help-possible">Self-help possible</option>
                  <option value="advocate-advised">Advocate advised</option>
                  <option value="specialist-needed">Specialist needed</option>
                </Select>
              </Field>

              <div className="sm:col-span-2">
                <p className="label">Key dates</p>
                <div className="space-y-2">
                  {profile.keyDates.map((kd, i) => (
                    <div key={kd.label} className="flex flex-col gap-2 rounded-xl border border-line px-3 py-2.5 sm:flex-row sm:items-center">
                      <span className="flex-1 text-[12.5px] font-semibold text-ink">{kd.label}</span>
                      <span className="text-[12px] text-body">{kd.date}</span>
                      <input
                        type="date"
                        value={kd.date}
                        disabled={!editing}
                        onChange={(e) => {
                          const nextDates = [...profile.keyDates]
                          nextDates[i] = { ...kd, date: e.target.value }
                          setProfile({ ...profile, keyDates: nextDates })
                        }}
                        className="rounded-lg border border-line px-2 py-1 text-[11px] disabled:bg-transparent disabled:text-body"
                        aria-label={`${kd.label} date`}
                      />
                      <span className="text-[10.5px] text-muted">{kd.basis}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Field label="Your goal" className="sm:col-span-2">
                <Textarea
                  value={profile.userGoal}
                  onChange={(e) => setProfile({ ...profile, userGoal: e.target.value })}
                  disabled={!editing}
                  rows={2}
                />
              </Field>

              <div className="sm:col-span-2">
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-tint px-3.5 py-3">
                  <Badge tone="brand">Next step</Badge>
                  <p className="text-[12.5px] text-body">
                    Get a triage recommendation based on these facts.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={() => setProfile(null)}>
              <X className="size-4" aria-hidden /> Start over
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => router.push(dh('/chat'))}>
                Back to chat
              </Button>
              <Button onClick={save}>
                Save & see options <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>

          <Disclaimer />
        </div>
      )}
    </div>
  )
}
