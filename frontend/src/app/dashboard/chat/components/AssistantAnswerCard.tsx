"use client";

import React, { useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Share2,
  FolderPlus,
  Scale,
  PhoneCall,
  AlertTriangle,
  HelpCircle,
  Clock,
  Check,
  BookOpen,
} from "lucide-react";
import {
  type AssistantAnswer,
  calculate138Deadlines,
} from "@/services/dashboard/chat-assistant";
import { CitationChip } from "@/components/dashboard/shared";
import { Badge, Button } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";
import { CaseBriefFlow } from "./CaseBriefFlow";
import { AdvocateMatchInline } from "./AdvocateMatchInline";
import { FlagErrorDialog } from "./FlagErrorDialog";

interface AssistantAnswerCardProps {
  answer: AssistantAnswer;
  onSaveToCases: (title: string, summary: string) => void;
  onAddToDeadlines: (title: string, dueDate: string) => void;
  onRequestConsultation: (advocateName: string) => void;
  onFollowUpClick: (prompt: string) => void;
  onShowToast: (message: string) => void;
}

export function AssistantAnswerCard({
  answer,
  onSaveToCases,
  onAddToDeadlines,
  onRequestConsultation,
  onFollowUpClick,
  onShowToast,
}: AssistantAnswerCardProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [showCaseBrief, setShowCaseBrief] = useState(false);
  const [showAdvocates, setShowAdvocates] = useState(false);
  const [showFlagInput, setShowFlagInput] = useState(false);

  // Reactive deadline calculation state (for cheque bounce / 138)
  const [memoDate, setMemoDate] = useState<string>(() => {
    return answer.deadlineCalculation?.memoDate || new Date().toISOString().split("T")[0];
  });

  const activeDeadlines = answer.deadlineCalculation
    ? calculate138Deadlines(memoDate)
    : undefined;

  const handleCopy = () => {
    const textToCopy = [
      answer.oneLineSummary,
      ...answer.explanation,
      ...answer.nextSteps.map((s) => `${s.step}. ${s.text}`),
    ].join("\n\n");
    void navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    onShowToast("Answer copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const badgeToneMap: Record<AssistantAnswer["decisionBadge"], "mint" | "warn" | "neutral" | "danger"> = {
    "Self-help first": "mint",
    "Time-sensitive": "warn",
    "Advocate advised": "neutral",
    Urgent: "danger",
  };

  // -------------------------------------------------------------------------
  // SPECIAL CASE: EMERGENCY (Arrest, Police, Violence, Eviction threats)
  // -------------------------------------------------------------------------
  if (answer.isEmergency) {
    return (
      <div className="space-y-3.5 animate-in-up">
        {/* Calm Top Emergency Card */}
        <div className="rounded-[2px] border border-[#c0392b]/40 bg-[#fffaf2] p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2d5c1] pb-3">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-[2px] bg-[#c0392b] text-[#fffaf2]">
                <AlertTriangle className="size-4" aria-hidden="true" />
              </span>
              <div>
                <span className="text-[11px] font-sans uppercase tracking-[0.12em] font-semibold text-[#c0392b]">
                  Emergency Safeguards Active
                </span>
                <h3 className="font-serif text-[17px] sm:text-[19px] font-normal text-[#2a1c12]">
                  {answer.oneLineSummary}
                </h3>
              </div>
            </div>
            <Badge tone="danger">Article 22 Protected</Badge>
          </div>

          {/* 3-4 Short Bullets */}
          <ul className="space-y-2 text-xs sm:text-[13px] text-[#2a1c12] leading-relaxed">
            {answer.emergencyBullets?.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#c0392b]" aria-hidden="true" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>

          {/* Call Buttons & Urgent Advocate Connection */}
          <div className="pt-2 border-t border-[#e2d5c1]/70 flex flex-wrap items-center gap-2.5">
            <a
              href="tel:112"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[2px] border border-[#c0392b] bg-[#c0392b] px-4 text-xs font-sans uppercase tracking-[0.08em] font-semibold text-[#fffaf2] transition-colors hover:bg-[#a93226]"
            >
              <PhoneCall className="size-3.5" aria-hidden="true" />
              Call 112 Police
            </a>
            <a
              href="tel:15100"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[2px] border border-[#2a1c12] bg-[#2a1c12] px-4 text-xs font-sans uppercase tracking-[0.08em] font-semibold text-[#fffaf2] transition-colors hover:bg-[#9a6a35] hover:border-[#9a6a35]"
            >
              <PhoneCall className="size-3.5" aria-hidden="true" />
              Call 15100 (Free Legal Aid)
            </a>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowAdvocates((prev) => !prev)}
              className="h-9 text-xs"
            >
              <Scale className="size-3.5 mr-1 text-[#9a6a35]" aria-hidden="true" />
              Connect to an advocate urgently
            </Button>
          </div>

          {/* Constitutional Citation Chip */}
          {answer.citations.length > 0 && (
            <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-[#e2d5c1]/60">
              <span className="text-[10.5px] font-sans uppercase tracking-[0.1em] font-medium text-[#85725f]">
                Statutory Source:
              </span>
              {answer.citations.map((c) => (
                <CitationChip key={c.id} citation={c} />
              ))}
            </div>
          )}
        </div>

        {/* Inline Advocate List if expanded */}
        {showAdvocates && (
          <AdvocateMatchInline
            onClose={() => setShowAdvocates(false)}
            onRequestConsultation={(name) => {
              onRequestConsultation(name);
              onShowToast(`Urgent consultation request transmitted to ${name}`);
            }}
          />
        )}

        {/* Follow-up chips */}
        {answer.followUpChips && answer.followUpChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {answer.followUpChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => onFollowUpClick(chip)}
                className="rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 px-3 py-1 text-xs text-[#5b4a3b] hover:border-[#9a6a35] hover:text-[#2a1c12] transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // STANDARD ASSISTANT ANSWER ANATOMY (Sections 1 through 8 in strict order)
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-4 animate-in-up">
      <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-5 sm:p-6 shadow-xs space-y-4 text-[#2a1c12]">
        {/* 1. Decision badge + one-line answer */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge tone={badgeToneMap[answer.decisionBadge]}>
              {answer.decisionBadge}
            </Badge>
          </div>
          <p className="font-serif text-[17px] sm:text-[19px] font-normal leading-snug text-[#2a1c12]">
            {answer.oneLineSummary}
          </p>
        </div>

        {/* 2. Plain-language explanation (2-3 short paragraphs max, simple words) */}
        {answer.explanation.length > 0 && (
          <div className="space-y-2.5 text-xs sm:text-[13.5px] leading-relaxed text-[#5b4a3b]">
            {answer.explanation.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        )}

        {/* 3. Next steps: numbered, max 4, the first marked "Do this in 48 hours" */}
        {answer.nextSteps.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#e2d5c1]/60">
            <p className="text-[11px] font-sans uppercase tracking-[0.1em] font-semibold text-[#85725f]">
              Recommended Next Steps:
            </p>
            <ol className="space-y-2 text-xs sm:text-[13px] text-[#2a1c12]">
              {answer.nextSteps.map((st) => (
                <li key={st.step} className="flex items-start gap-2.5">
                  <span className="grid size-5 shrink-0 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/60 font-mono text-[10.5px] font-bold text-[#2a1c12] mt-0.5">
                    {st.step}
                  </span>
                  <div className="flex-1 leading-relaxed">
                    <span>{st.text}</span>
                    {st.isFortyEightHours && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-[2px] border border-[#e2d5c1] bg-[#fff8e7] px-2 py-0.5 text-[10px] font-sans uppercase tracking-[0.08em] font-semibold text-[#b54708]">
                        <Clock className="size-2.5" aria-hidden="true" />
                        Do this in 48 hours
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* 4. Deadline block (when relevant, with interactive Bank memo date input & Add to Court Deadlines button) */}
        {activeDeadlines && (
          <div className="rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2d5c1]/60 pb-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="size-4 text-[#b54708]" aria-hidden="true" />
                <span className="text-xs font-semibold text-[#2a1c12]">
                  Section 138 Statutory Limitation Calculator
                </span>
              </div>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  onAddToDeadlines(
                    "Sec 138 Legal Notice Due",
                    activeDeadlines.noticeDueDate
                  );
                  onShowToast(
                    `Added to Court Deadlines: Notice due ${activeDeadlines.noticeDueDate}`
                  );
                }}
                className="h-7 text-[11px] px-2.5"
              >
                Add to Court Deadlines
              </Button>
            </div>

            {/* Input date */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label htmlFor="memoDateInput" className="font-medium text-[#5b4a3b]">
                Bank memo date:
              </label>
              <input
                id="memoDateInput"
                type="date"
                value={memoDate}
                onChange={(e) => setMemoDate(e.target.value)}
                className="h-8 rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] px-2.5 font-mono text-xs text-[#2a1c12] focus:outline-none focus:border-[#9a6a35]"
              />
            </div>

            {/* Computed dates grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pt-1">
              <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-2.5">
                <span className="text-[10px] font-sans uppercase tracking-[0.08em] text-[#85725f] block">
                  1. Notice Due (+30 days)
                </span>
                <span className="font-mono text-xs font-semibold text-[#2a1c12] mt-0.5 block">
                  {activeDeadlines.noticeDueDate}
                </span>
              </div>
              <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-2.5">
                <span className="text-[10px] font-sans uppercase tracking-[0.08em] text-[#85725f] block">
                  2. Payment Window (+15 days)
                </span>
                <span className="font-mono text-xs font-semibold text-[#2a1c12] mt-0.5 block">
                  {activeDeadlines.paymentWindowEndDate}
                </span>
              </div>
              <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-2.5">
                <span className="text-[10px] font-sans uppercase tracking-[0.08em] text-[#85725f] block">
                  3. Complaint Due (+30 days)
                </span>
                <span className="font-mono text-xs font-semibold text-[#2a1c12] mt-0.5 block">
                  {activeDeadlines.complaintDueDate}
                </span>
              </div>
            </div>

            <p className="text-[10.5px] text-[#85725f]">
              {activeDeadlines.statutoryNote}
            </p>
          </div>
        )}

        {/* 5. Sources: collapsed "Sources (n)" row that expands to mono chips + 12 Jan 2026 review date */}
        {answer.citations.length > 0 && (
          <div className="pt-2 border-t border-[#e2d5c1]/60">
            <button
              type="button"
              onClick={() => setSourcesOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#85725f] hover:text-[#2a1c12] transition-colors"
              aria-expanded={sourcesOpen}
            >
              <BookOpen className="size-3.5 text-[#9a6a35]" aria-hidden="true" />
              <span>Sources ({answer.citations.length})</span>
              <ChevronDown
                className={cn("size-3 transition-transform", sourcesOpen && "rotate-180")}
                aria-hidden="true"
              />
            </button>

            {sourcesOpen && (
              <div className="mt-2.5 space-y-2 rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/20 p-3 animate-in-up">
                <div className="flex flex-wrap gap-1.5">
                  {answer.citations.map((c) => (
                    <CitationChip key={c.id} citation={c} />
                  ))}
                </div>
                <p className="text-[11px] text-[#85725f] pt-1 border-t border-[#e2d5c1]/50">
                  Based on current law, last reviewed {answer.sourcesReviewedDate}.
                </p>
              </div>
            )}
          </div>
        )}

        {/* 6. Confidence note only when not high */}
        {answer.isLowConfidence && (
          <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fff8e7] p-3.5 text-xs text-[#5b4a3b] space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-[#b54708]">
              <HelpCircle className="size-3.5" aria-hidden="true" />
              <span>I&apos;m not fully sure about this one.</span>
            </div>
            <p className="leading-relaxed">{answer.confidenceReason}</p>
            <p className="text-[11px] text-[#85725f] pt-1">
              Marked as <strong className="font-semibold text-[#2a1c12]">Advocate advised</strong>. We recommend organizing your facts into a Case Brief below first.
            </p>
          </div>
        )}

        {/* 7. Action row (small, ghost style): Save to My Cases, Prepare case brief, Find advocate, Copy, thumbs up/down, Flag an error */}
        <div className="pt-2 border-t border-[#e2d5c1]/60 flex flex-wrap items-center justify-between gap-1 text-xs">
          <div className="flex flex-wrap items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onSaveToCases(answer.decisionBadge, answer.oneLineSummary);
                onShowToast("Saved matter summary to My Cases");
              }}
              className="h-8 text-[11px] px-2 text-[#5b4a3b]"
            >
              <FolderPlus className="size-3.5 mr-1" aria-hidden="true" />
              Save to My Cases
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowCaseBrief((v) => !v);
                setShowAdvocates(false);
              }}
              className={cn("h-8 text-[11px] px-2 text-[#5b4a3b]", showCaseBrief && "bg-[#ebe1d1]/60 text-[#2a1c12]")}
            >
              <Share2 className="size-3.5 mr-1 text-[#9a6a35]" aria-hidden="true" />
              Prepare case brief
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAdvocates((v) => !v);
                setShowCaseBrief(false);
              }}
              className={cn("h-8 text-[11px] px-2 text-[#5b4a3b]", showAdvocates && "bg-[#ebe1d1]/60 text-[#2a1c12]")}
            >
              <Scale className="size-3.5 mr-1 text-[#9a6a35]" aria-hidden="true" />
              Find advocate
            </Button>
          </div>

          <div className="flex items-center gap-0.5 text-[#85725f]">
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy answer"
              className="grid size-8 place-items-center rounded-[2px] hover:bg-[#ebe1d1]/50 hover:text-[#2a1c12] transition-colors"
            >
              {copied ? <Check className="size-3.5 text-[#2e7d32]" /> : <Copy className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedback("up");
                onShowToast("Feedback recorded: Helpful");
              }}
              aria-label="Helpful"
              className={cn(
                "grid size-8 place-items-center rounded-[2px] hover:bg-[#ebe1d1]/50 hover:text-[#2a1c12] transition-colors",
                feedback === "up" && "text-[#2e7d32]"
              )}
            >
              <ThumbsUp className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedback("down");
                onShowToast("Feedback recorded: Needs revision");
              }}
              aria-label="Not helpful"
              className={cn(
                "grid size-8 place-items-center rounded-[2px] hover:bg-[#ebe1d1]/50 hover:text-[#2a1c12] transition-colors",
                feedback === "down" && "text-[#c0392b]"
              )}
            >
              <ThumbsDown className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowFlagInput((v) => !v)}
              aria-label="Flag an error"
              className="grid size-8 place-items-center rounded-[2px] hover:bg-[#ebe1d1]/50 hover:text-[#2a1c12] transition-colors"
              title="Flag an error"
            >
              <Flag className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Flag Error Inline Form */}
        {showFlagInput && (
          <FlagErrorDialog
            onClose={() => setShowFlagInput(false)}
            onSubmitFlag={() => {
              setShowFlagInput(false);
              onShowToast("Sent to reviewing advocates");
            }}
          />
        )}
      </div>

      {/* Inline Case Brief Flow */}
      {showCaseBrief && (
        <CaseBriefFlow
          onClose={() => setShowCaseBrief(false)}
          onSaveToCases={(brief) => {
            onSaveToCases("Formal Case Matter Brief", brief.facts);
            onShowToast("Case brief saved to My Cases");
          }}
          onShareWithAdvocate={() => {
            setShowCaseBrief(false);
            setShowAdvocates(true);
            onShowToast("Consent logged under DPDP Act · Advocates matched below");
          }}
        />
      )}

      {/* Inline Advocate Matches */}
      {showAdvocates && (
        <AdvocateMatchInline
          onClose={() => setShowAdvocates(false)}
          onRequestConsultation={(name) => {
            onRequestConsultation(name);
            onShowToast(`Consultation request sent to ${name}`);
          }}
        />
      )}

      {/* 8. Up to 3 follow-up chips */}
      {answer.followUpChips && answer.followUpChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {answer.followUpChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onFollowUpClick(chip)}
              className="rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 px-3 py-1 text-xs text-[#5b4a3b] hover:border-[#9a6a35] hover:text-[#2a1c12] transition-colors cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
