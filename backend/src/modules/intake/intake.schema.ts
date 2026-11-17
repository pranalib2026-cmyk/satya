import { z } from "zod";

const urgencySchema = z
  .enum([
    "emergency-24h",
    "urgent-48h",
    "standard-30d",
    "exploratory",
    "upcoming-30d",
    "none-yet",
  ])
  .transform((value) => {
    if (value === "upcoming-30d") return "standard-30d" as const;
    if (value === "none-yet") return "exploratory" as const;
    return value;
  });

const baseIntakeSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  phone: z
    .string()
    .trim()
    .min(10)
    .max(20)
    .refine(
      (value) => value.replace(/\D/g, "").length >= 10,
      "Phone must contain at least 10 digits.",
    ),
  companyName: z.string().trim().max(200).optional(),
  role: z.string().trim().max(120).optional(),
  jurisdiction: z.string().trim().min(2).max(200),
  practiceArea: z.string().trim().min(2).max(120),
  urgency: urgencySchema.default("standard-30d"),
  matterSummary: z.string().trim().min(20).max(5000),
  adverseParties: z.string().trim().max(3000).optional(),
  consentAcknowledged: z.literal(true),
  source: z.string().trim().max(80).default("website"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const intakeBodySchema = z.discriminatedUnion("kind", [
  baseIntakeSchema.extend({
    kind: z.literal("legal-assessment"),
  }),
  baseIntakeSchema.extend({
    kind: z.literal("conflict-check"),
  }),
  baseIntakeSchema.extend({
    kind: z.literal("consultation"),
    advocateId: z.string().trim().max(120).optional(),
    preferredDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
      .optional(),
    preferredTime: z.string().trim().max(40).optional(),
  }),
]);

export type IntakeBody = z.infer<typeof intakeBodySchema>;

export const intakeParamsSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(5)
    .max(40)
    .transform((value) => value.toUpperCase()),
});

export type IntakeKind = IntakeBody["kind"];

export function nextStepFor(kind: IntakeKind): string {
  switch (kind) {
    case "legal-assessment":
      return "A preliminary assessment dossier and matched advocates will be sent to your email and WhatsApp within 4 business hours.";
    case "conflict-check":
      return "The conflicts desk will screen the listed adverse parties and respond within 4 business hours.";
    case "consultation":
      return "Intake counsel will confirm the consultation slot within 3 business hours.";
  }
}
