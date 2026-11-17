"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CalendarPlus,
  Camera,
  Check,
  FileImage,
  FileText,
  Loader2,
  Pencil,
  RotateCcw,
  ScanLine,
  Upload,
} from "lucide-react";
import { explainDocument, runOcr } from "@/services/dashboard/documents";
import type { DocumentExplanation, OcrResult } from "@/types/dashboard";
import { Badge, Button, Input } from "@/components/dashboard/ui";
import { Disclaimer, PageHeader } from "@/components/dashboard/shared";
import { cn } from "@/lib/utils";
import { dh } from "@/lib/dashboard-utils";
import { useDashboardUI } from "@/lib/dashboard-ui-context";

type Stage = 'idle' | 'ocr' | 'explain' | 'done'

export default function ScanPage() {
  const router = useRouter();
  const { pushNotification } = useDashboardUI();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('idle')
  const [ocr, setOcr] = useState<OcrResult | null>(null)
  const [explanation, setExplanation] = useState<DocumentExplanation | null>(null)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [dates, setDates] = useState<Array<{ label: string; value: string }>>([])
  const [amounts, setAmounts] = useState<Array<{ label: string; value: string }>>([])
  const [saved, setSaved] = useState(false)

  const process = async (name: string, imageUrl?: string) => {
    setFileName(name)
    if (imageUrl) setPreview(imageUrl)
    setStage('ocr')
    setOcr(null)
    setExplanation(null)
    setSaved(false)
    const result = await runOcr(name)
    setOcr(result)
    setStage('explain')
    const explained = await explainDocument(result.text)
    setExplanation(explained)
    setDates(explained.dates)
    setAmounts(explained.amounts)
    setStage('done')
  }

  const onFile = (file?: File) => {
    if (!file) return
    const url = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    void process(file.name, url)
  }

  const addDates = () => {
    setSaved(true)
    pushNotification({
      title: 'Dates added to your deadlines',
      body: `${dates.length} dates from ${fileName} were added. Confirm each trigger date.`,
      href: '/deadlines',
    })
  }

  const reset = () => {
    setStage('idle')
    setOcr(null)
    setExplanation(null)
    setPreview(null)
    setFileName('')
    setSaved(false)
    setEditing(false)
  }

  return (
    <div className="animate-fade">
      <PageHeader
        eyebrow="Scan & explain"
        title="Understand a legal document"
        subtitle="Photograph a notice, FIR copy, agreement or summons. We extract the text and explain it in plain language, with dates and amounts called out."
        actions={<Badge tone="outline"><ScanLine className="size-3" /> OCR is mocked</Badge>}
      />

      {stage === 'idle' && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              onFile(e.dataTransfer.files?.[0])
            }}
            className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-line bg-brand-tint px-6 py-14 text-center transition hover:border-brand/40 hover:bg-brand-tint/40"
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-card-bg text-brand shadow-card">
              <Upload className="size-6" aria-hidden />
            </span>
            <h2 className="mt-4 text-[18px] font-extrabold">Upload or scan a document</h2>
            <p className="mt-1.5 max-w-sm text-[12.5px] leading-5 text-body">
              JPG, PNG or PDF up to 10 MB. Files stay private and are shared only with your consent.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" aria-hidden /> Choose a file
              </Button>
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <Camera className="size-4" aria-hidden /> Use camera
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />

            <div className="mt-6 w-full max-w-sm border-t border-line pt-4">
              <p className="text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">No document handy?</p>
              <div className="mt-2 flex flex-col gap-1.5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void process('sample-legal-notice.jpg')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-card-bg px-3 py-2 text-[11.5px] font-semibold text-ink hover:border-brand/40"
                >
                  <FileText className="size-3.5 text-brand" aria-hidden /> Sample notice
                </button>
                <button
                  type="button"
                  onClick={() => void process('blurry-photo-scan.jpg')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-card-bg px-3 py-2 text-[11.5px] font-semibold text-ink hover:border-brand/40"
                >
                  <FileImage className="size-3.5 text-warn" aria-hidden /> Low-quality sample
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="card p-4">
              <h3 className="text-[13.5px] font-bold">What you will get</h3>
              <ul className="mt-2.5 space-y-2.5">
                {[
                  ['Document type', 'Notice, FIR, agreement or summons'],
                  ['Plain summary', 'What it says, without legal jargon'],
                  ['Parties & dates', 'Who sent it, deadlines to respond'],
                  ['Amounts & obligations', 'What you must pay or do'],
                  ['Risks', 'What happens if you ignore it'],
                ].map(([t, d]) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-dot" aria-hidden />
                    <span className="text-[11.5px] leading-4.5 text-body">
                      <span className="font-semibold text-ink">{t}: </span>
                      {d}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-brand-tint p-4">
              <p className="text-[11.5px] leading-5 text-body">
                <span className="font-bold text-ink">Privacy: </span> your document is processed only to explain it.
                You choose whether to add the dates to your tracker or share the file with an advocate.
              </p>
            </div>
          </div>
        </div>
      )}

      {stage === 'ocr' && (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <div className="relative grid size-16 place-items-center rounded-2xl bg-brand-soft">
            <Loader2 className="size-7 animate-spin text-brand" />
          </div>
          <h2 className="mt-5 text-[19px] font-extrabold">Reading the document</h2>
          <p className="mt-1.5 max-w-sm text-[12.5px] leading-5 text-body">
            Extracting text and checking confidence. Larger documents can take a few seconds.
          </p>
          <p className="mt-4 flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1.5 text-[11px] text-muted">
            <FileText className="size-3.5" aria-hidden /> {fileName}
          </p>
          <div className="mt-6 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-brand-tint">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-brand" />
          </div>
        </div>
      )}

      {stage === 'explain' && (
        <div className="card flex flex-col items-center px-6 py-16 text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-mint">
            <ScanLine className="size-7 text-dot" />
          </div>
          <h2 className="mt-5 text-[19px] font-extrabold">Explaining it in plain language</h2>
          <p className="mt-1.5 max-w-sm text-[12.5px] leading-5 text-body">
            Identifying the document type, parties, dates, amounts and obligations.
          </p>
          <p className="mt-5 flex items-center gap-1.5 text-[10.5px] text-muted">
            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            Mock explainer
          </p>
        </div>
      )}

      {stage === 'done' && ocr && explanation && (
        <div className="space-y-4">
          {ocr.lowConfidence && (
            <div className="flex items-start gap-3 rounded-2xl border border-warn/25 bg-warn-soft px-4 py-3.5">
              <AlertTriangle className="mt-0.5 size-4.5 shrink-0 text-warn" aria-hidden />
              <div className="flex-1">
                <p className="text-[13px] font-bold text-warn">Low OCR confidence, retake photo</p>
                <p className="mt-0.5 text-[11.5px] leading-5 text-warn">
                  Only {Math.round(ocr.confidence * 100)}% of the text was read cleanly. Check every extracted value
                  below or retake the photo in good light, straight and without shadows.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                <RotateCcw className="size-3.5" aria-hidden /> Retake
              </Button>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
            {/* Original */}
            <div className="card flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <p className="text-[12.5px] font-bold">Original document</p>
                <Badge tone={ocr.lowConfidence ? 'warn' : 'mint'}>
                  {Math.round(ocr.confidence * 100)}% OCR confidence
                </Badge>
              </div>
              <div className="flex flex-1 items-center justify-center bg-brand-tint p-4">
                {preview ? (
                  <Image
                    src={preview}
                    alt="Uploaded document preview"
                    unoptimized
                    width={720}
                    height={960}
                    className="h-auto max-h-[460px] w-auto rounded-lg shadow-card"
                  />
                ) : (
                  <div className="w-full max-w-sm rounded-lg bg-card-bg p-5 shadow-card">
                    <div className="mb-3 h-2 w-1/2 rounded bg-border-hover" />
                    <div className="space-y-1.5">
                      {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} className={cn('h-1.5 rounded bg-brand-tint', i % 4 === 0 ? 'w-3/4' : 'w-full')} />
                      ))}
                    </div>
                    <p className="mt-4 text-center font-serif text-[10px] tracking-wide text-muted uppercase">
                      {fileName}
                    </p>
                  </div>
                )}
              </div>
              <div className="border-t border-line px-4 py-3">
                <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.12em] text-muted uppercase">Extracted text</p>
                <div className="max-h-32 overflow-y-auto rounded-lg bg-brand-tint p-3">
                  <p className="font-mono text-[10.5px] leading-5 whitespace-pre-wrap text-body">{ocr.text}</p>
                </div>
              </div>
            </div>

            {/* Explanation */}
            <div className="space-y-3">
              <div className="card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10.5px] font-bold tracking-[0.14em] text-muted uppercase">Document type</p>
                    <h2 className="mt-1 text-[16px] leading-snug font-bold">{explanation.documentType}</h2>
                  </div>
                  <Button size="sm" variant={editing ? 'primary' : 'ghost'} onClick={() => setEditing((v) => !v)}>
                    {editing ? <><Check className="size-3.5" /> Done</> : <><Pencil className="size-3.5" /> Edit</>}
                  </Button>
                </div>
                <p className="mt-3 text-[12.5px] leading-6 text-body">{explanation.summary}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="card p-4">
                  <p className="text-[11px] font-bold tracking-wide text-muted uppercase">Parties</p>
                  <ul className="mt-2 space-y-1.5">
                    {explanation.parties.map((p) => (
                      <li key={p} className="text-[12px] leading-5 text-body">{p}</li>
                    ))}
                  </ul>
                </div>
                <div className="card p-4">
                  <p className="text-[11px] font-bold tracking-wide text-muted uppercase">Amounts</p>
                  <div className="mt-2 space-y-2">
                    {amounts.map((a, i) => (
                      <div key={a.label}>
                        <p className="text-[10.5px] text-muted">{a.label}</p>
                        {editing ? (
                          <Input
                            value={a.value}
                            onChange={(e) => {
                              const next = [...amounts]
                              next[i] = { ...a, value: e.target.value }
                              setAmounts(next)
                            }}
                            className="mt-0.5 h-8 text-[12px]"
                          />
                        ) : (
                          <p className="text-[13px] font-bold text-ink">{a.value}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card p-4">
                <p className="text-[11px] font-bold tracking-wide text-muted uppercase">Dates</p>
                <div className="mt-2 divide-y divide-line">
                  {dates.map((d, i) => (
                    <div key={d.label} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                      <span className="flex-1 text-[12px] font-medium text-ink">{d.label}</span>
                      {editing ? (
                        <Input
                          value={d.value}
                          onChange={(e) => {
                            const next = [...dates]
                            next[i] = { ...d, value: e.target.value }
                            setDates(next)
                          }}
                          className="h-8 w-44 text-[12px]"
                        />
                      ) : (
                        <span className="text-[12px] font-semibold text-brand-dark">{d.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="card p-4">
                  <p className="text-[11px] font-bold tracking-wide text-muted uppercase">Your obligations</p>
                  <ul className="mt-2 space-y-1.5">
                    {explanation.obligations.map((o) => (
                      <li key={o} className="flex gap-1.5 text-[11.5px] leading-5 text-body">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-dot" /> {o}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card border-danger/20 bg-danger-soft/30 p-4">
                  <p className="text-[11px] font-bold tracking-wide text-danger uppercase">Risks</p>
                  <ul className="mt-2 space-y-1.5">
                    {explanation.risks.map((r) => (
                      <li key={r} className="flex gap-1.5 text-[11.5px] leading-5 text-body">
                        <AlertTriangle className="mt-0.5 size-3 shrink-0 text-danger" aria-hidden /> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button fullWidth onClick={addDates} disabled={saved}>
                  {saved ? <><Check className="size-4" /> Dates added</> : <><CalendarPlus className="size-4" /> Add these dates to my deadlines</>}
                </Button>
                <Button variant="secondary" onClick={() => router.push(dh('/vault'))}>
                  Save to vault <ArrowRight className="size-4" aria-hidden />
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <Disclaimer text={explanation.disclaimer} />
                <button type="button" onClick={reset} className="shrink-0 text-[11px] font-semibold text-brand hover:underline">
                  Scan another
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
