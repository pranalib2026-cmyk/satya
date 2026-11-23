"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { AlertCircle, CheckCircle2, MessageSquare, Star } from "lucide-react";
import { getBooking } from "@/services/dashboard/bookings";
import { getBookingReview, submitReview, type BackendReviewResponse } from "@/services/dashboard/reviews";
import type { Booking } from "@/types/dashboard";
import { formatDate } from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";
import { Button, Card, Badge, Textarea, EmptyState } from "@/components/dashboard/ui";
import { PageHeader } from "@/components/dashboard/shared";
import { dh } from "@/lib/dashboard-utils";

const tags = [
  "Clear communication",
  "Punctual & prepared",
  "Fair statutory fee",
  "Actionable next steps",
  "Procedural clarity",
  "Respectful & attentive",
];

export default function FeedbackPage() {
  const params = useParams<{ bookingId: string }>();
  const rawBookingId = params.bookingId;
  const bookingId = Array.isArray(rawBookingId) ? rawBookingId[0] ?? "" : rawBookingId ?? "";
  const router = useRouter();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [existingReview, setExistingReview] = useState<BackendReviewResponse | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [resolved, setResolved] = useState<"yes" | "no" | "in_progress" | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (bookingId) {
      void getBooking(bookingId).then((b) => {
        if (mounted) setBooking(b ?? null);
      });
      void getBookingReview(bookingId).then((r) => {
        if (mounted && r) setExistingReview(r);
      });
    }
    return () => {
      mounted = false;
    };
  }, [bookingId]);

  // Case 1: Booking not yet completed
  if (booking && booking.status !== "completed") {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <PageHeader title="Client Evaluation" backTo={dh("/bookings")} />
        <EmptyState
          icon={<MessageSquare className="size-5 text-[#9a6a35]" />}
          title="Evaluation Registers After Hearing Concludes"
          body="Feedback may only be registered once the advocate marks the consultation session concluded. This ensures 100% verified evaluations."
          action={<Button onClick={() => router.push(dh("/bookings"))}>Return to Consultations</Button>}
        />
      </div>
    );
  }

  // Case 2: Review already exists for this booking
  if (existingReview) {
    return (
      <div className="mx-auto max-w-lg animate-fade text-center space-y-6 pt-6">
        <span className="mx-auto grid size-16 place-items-center rounded-[2px] border border-[#2a6b3b]/30 bg-[#2a6b3b]/10 text-[#2a6b3b]">
          <CheckCircle2 className="size-8" aria-hidden />
        </span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Verified Docket Record</p>
          <h1 className="mt-1 font-serif text-[28px] font-normal text-[#2a1c12]">Evaluation Already Registered</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[#5b4a3b]">
            An authoritative evaluation has already been deposited for this consultation booking on{" "}
            <span className="font-medium text-[#2a1c12]">{formatDate(existingReview.created_at)}</span>.
          </p>
        </div>

        <Card className="p-6 text-left space-y-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Your Rating</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={cn(
                    "size-5",
                    n <= existingReview.rating ? "fill-[#d1a46a] text-[#9a6a35]" : "text-[#e2d5c1]",
                  )}
                  aria-hidden
                />
              ))}
              <span className="ml-2 font-serif text-[14px] text-[#2a1c12]">
                {["", "Deficient", "Fair", "Satisfactory", "Commendable", "Exemplary"][existingReview.rating]}
              </span>
            </div>
          </div>

          {existingReview.tags && existingReview.tags.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Selected Strengths</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {existingReview.tags.map((t) => (
                  <Badge key={t} tone="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {existingReview.comment && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Observations</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#5b4a3b] italic bg-[#f4efe6] p-3 rounded-[2px] border border-[#e2d5c1]">
                &ldquo;{existingReview.comment}&rdquo;
              </p>
            </div>
          )}
        </Card>

        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={() => router.push(dh("/bookings"))}>
            Consultation Register
          </Button>
          <Button onClick={() => router.push(dh("/advocates"))}>Advocate Roll</Button>
        </div>
      </div>
    );
  }

  // Case 3: Just submitted
  if (done) {
    return (
      <div className="mx-auto max-w-lg animate-fade text-center space-y-6 pt-6">
        <span className="mx-auto grid size-16 place-items-center rounded-[2px] border border-[#2a6b3b]/30 bg-[#2a6b3b]/10 text-[#2a6b3b]">
          <CheckCircle2 className="size-8" aria-hidden />
        </span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Audit Receipt</p>
          <h1 className="mt-1 font-serif text-[28px] font-normal text-[#2a1c12]">Evaluation Recorded</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[#5b4a3b]">
            Your evaluation has been deposited into the verified advocate roll. Thank you for contributing to transparent legal access under BCI compliance guidelines.
          </p>
        </div>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={() => router.push(dh("/bookings"))}>
            Consultation Register
          </Button>
          <Button onClick={() => router.push(dh("/advocates"))}>Advocate Roll</Button>
        </div>
      </div>
    );
  }

  // Case 4: Form ready to submit
  return (
    <div className="mx-auto max-w-2xl animate-fade space-y-6">
      <PageHeader
        eyebrow="POST-HEARING EVALUATION"
        title="Consultation Feedback"
        subtitle={
          booking
            ? `With Adv. ${booking.advocateName} on ${formatDate(booking.date)}`
            : "Verified evaluation open solely to participating citizens."
        }
        backTo={dh("/bookings")}
      />

      <Card className="p-6 sm:p-8">
        {error && (
          <div className="mb-6 rounded-[2px] border border-[#c0392b]/30 bg-[#fdf2f0] p-3.5 flex items-center justify-between text-xs text-[#c0392b]">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-[11px] font-mono uppercase underline hover:text-[#2a1c12]"
            >
              Dismiss
            </button>
          </div>
        )}

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Overall Rating</p>
          <div className="mt-3 flex items-center gap-2" role="group" aria-label="Rating from 1 to 5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                aria-pressed={rating === n}
                className="grid size-11 cursor-pointer place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] transition hover:border-[#9a6a35]"
              >
                <Star
                  className={cn(
                    "size-6 transition",
                    n <= (hover || rating) ? "fill-[#d1a46a] text-[#9a6a35]" : "text-[#e2d5c1]",
                  )}
                  aria-hidden
                />
              </button>
            ))}
            <span className="ml-3 font-serif text-[14px] text-[#2a1c12]">
              {rating ? ["", "Deficient", "Fair", "Satisfactory", "Commendable", "Exemplary"][rating] : "Select statutory grade"}
            </span>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-[#e2d5c1]">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">
            Counsel Strengths <span className="text-[#85725f]">(Optional)</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))}
                className={cn(
                  "cursor-pointer rounded-[2px] border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors",
                  selected.includes(t)
                    ? "border-[#2a1c12] bg-[#2a1c12] text-[#fffaf2]"
                    : "border-[#e2d5c1] bg-[#fffaf2] text-[#5b4a3b] hover:border-[#9a6a35]",
                )}
              >
                {selected.includes(t) && <span className="mr-1 text-[#d1a46a]">✓</span>}
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-[#e2d5c1]">
          <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]" htmlFor="comment">
            Detailed Observations <span className="text-[#85725f]">(Optional)</span>
          </label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Were the statutory provisions articulated clearly? Did you receive actionable advice regarding procedural steps?"
            className="mt-2"
          />
          <p className="mt-1.5 text-right font-mono text-[10px] text-[#85725f]">{comment.length}/500</p>
        </div>

        <div className="mt-6 pt-6 border-t border-[#e2d5c1]">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Matter Resolution Status</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              ["yes", "Substantially Resolved"],
              ["in_progress", "Filing in Progress"],
              ["no", "Unresolved / Advisory Only"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setResolved(value as typeof resolved)}
                className={cn(
                  "h-11 cursor-pointer rounded-[2px] border px-3 text-[12.5px] font-medium transition-colors",
                  resolved === value
                    ? "border-[#2a1c12] bg-[#2a1c12] text-[#fffaf2]"
                    : "border-[#e2d5c1] bg-[#fffaf2] text-[#5b4a3b] hover:border-[#9a6a35]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Button
          fullWidth
          className="mt-8"
          loading={submitting}
          disabled={!rating || !resolved || submitting}
          onClick={async () => {
            setSubmitting(true);
            setError(null);
            try {
              await submitReview({
                bookingId,
                rating,
                tags: selected,
                comment,
                resolved: (resolved || "in_progress") as "yes" | "no" | "in_progress",
              });
              setDone(true);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Failed to record evaluation. Please retry.";
              setError(msg);
            } finally {
              setSubmitting(false);
            }
          }}
        >
          Transmit Verified Evaluation
        </Button>
        <p className="mt-3 text-center font-mono text-[10px] text-[#85725f]">
          Evaluations are strictly moderated. NyayaSetu prohibits published claims concerning guaranteed outcomes under BCI Rule 36.
        </p>
      </Card>

      <div className="flex justify-center">
        <Badge tone="neutral">
          <Star className="size-3 text-[#9a6a35]" aria-hidden /> Aggregated anonymously onto advocate’s public dossier
        </Badge>
      </div>
    </div>
  );
}
