"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { CheckCircle2, MessageSquare, Star } from "lucide-react";
import { getBooking } from "@/services/dashboard/bookings";
import { submitFeedback } from "@/services/dashboard/messages";
import type { Booking } from "@/types/dashboard";
import { formatDate } from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";
import { Button, Card, Badge, Textarea, EmptyState } from "@/components/dashboard/ui";
import { PageHeader } from "@/components/dashboard/shared";
import { dh } from "@/lib/dashboard-utils";

const tags = ["Clear communication", "On time", "Fair fee", "Explained next steps", "Prepared well", "Respectful"];

export default function FeedbackPage() {
  const params = useParams<{ bookingId: string }>();
  const rawBookingId = params.bookingId;
  const bookingId = Array.isArray(rawBookingId) ? rawBookingId[0] ?? "" : rawBookingId ?? "";
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [resolved, setResolved] = useState<"yes" | "no" | "in_progress" | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void getBooking(bookingId).then((b) => setBooking(b ?? null));
  }, [bookingId]);

  if (booking && booking.status !== "completed") {
    return (
      <div className="mx-auto max-w-lg">
        <PageHeader title="Feedback" backTo={dh("/bookings")} />
        <EmptyState
          icon={<MessageSquare className="size-5" />}
          title="Feedback opens after the consultation"
          body="You can rate an advocate only once the booking is marked completed. This keeps reviews verified."
          action={<Button onClick={() => router.push(dh("/bookings"))}>Back to bookings</Button>}
        />
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg animate-fade text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-mint">
          <CheckCircle2 className="size-8 text-dot" aria-hidden />
        </span>
        <h1 className="mt-4 text-[26px] font-extrabold">Thank you for the feedback</h1>
        <p className="mt-2 text-[13.5px] leading-6 text-body">
          Your rating helps other clients choose well and helps advocates improve. Feedback is moderated and shown
          without success-rate claims.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => router.push(dh("/bookings"))}>My bookings</Button>
          <Button onClick={() => router.push(dh("/advocates"))}>Find an advocate</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade">
      <PageHeader
        eyebrow="Verified feedback"
        title="How was your consultation?"
        subtitle={booking ? `With Adv. ${booking.advocateName} on ${formatDate(booking.date)}` : "Only clients with a completed booking can leave feedback."}
        backTo={dh("/bookings")}
      />

      <Card className="p-5 sm:p-6">
        <div>
          <p className="label">Your rating</p>
          <div className="flex items-center gap-1.5" role="group" aria-label="Rating from 1 to 5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                aria-pressed={rating === n}
                className="grid size-11 cursor-pointer place-items-center rounded-xl transition hover:bg-warn-soft"
              >
                <Star
                  className={cn(
                    "size-7 transition",
                    n <= (hover || rating) ? "fill-gold text-gold" : "text-border-hover"
                  )}
                  aria-hidden
                />
              </button>
            ))}
            <span className="ml-2 text-[12px] font-semibold text-body">
              {rating ? ["", "Poor", "Fair", "Good", "Very good", "Excellent"][rating] : "Select a rating"}
            </span>
          </div>
        </div>

        <div className="mt-5">
          <p className="label">What went well? <span className="font-normal text-muted">(optional)</span></p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1.5 text-[12px] font-semibold transition",
                  selected.includes(t)
                    ? "border-dot bg-mint text-dot"
                    : "border-line text-body hover:border-brand/40"
                )}
              >
                {selected.includes(t) && <span className="mr-1">✓</span>}
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <label className="label" htmlFor="comment">Anything else? <span className="font-normal text-muted">(optional)</span></label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Was the advice easy to understand? Did you know what to do next?"
          />
          <p className="mt-1 text-right text-[10.5px] text-muted">{comment.length}/500</p>
        </div>

        <div className="mt-4">
          <p className="label">Was your issue resolved?</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["yes", "Yes"],
              ["in_progress", "In progress"],
              ["no", "No"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setResolved(value as typeof resolved)}
                className={cn(
                  "h-11 cursor-pointer rounded-xl border text-[12.5px] font-semibold transition",
                  resolved === value
                    ? "border-brand bg-brand-soft text-brand-dark ring-4 ring-brand/10"
                    : "border-line text-body hover:border-brand/40"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Button
          fullWidth
          className="mt-6"
          loading={submitting}
          disabled={!rating || !resolved}
          onClick={async () => {
            setSubmitting(true);
            await submitFeedback({
              bookingId,
              advocateId: booking?.advocateId ?? "adv_1",
              rating,
              tags: selected,
              comment,
              resolved: (resolved || "in_progress") as "yes" | "no" | "in_progress",
            });
            setSubmitting(false);
            setDone(true);
          }}
        >
          Submit feedback
        </Button>
        <p className="mt-2 text-center text-[10.5px] text-muted">
          Reviews are verified, moderated and never bought. We do not publish claims about success rates.
        </p>
      </Card>

      <div className="mt-4 flex justify-center">
        <Badge tone="outline">
          <Star className="size-3" aria-hidden /> Feedback appears on the advocate’s verified profile
        </Badge>
      </div>
    </div>
  );
}
