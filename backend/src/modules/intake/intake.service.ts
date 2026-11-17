import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { AppDatabase } from "../../db/client.js";
import { intakeRequests } from "../../db/schema.js";
import { createIntakeReference } from "../../shared/lib/reference.js";
import type { IntakeBody } from "./intake.schema.js";

export function createIntakeRequest(db: AppDatabase, input: IntakeBody) {
  const reference = createIntakeReference();
  const now = new Date();

  const consultation =
    input.kind === "consultation"
      ? {
          advocateId: input.advocateId ?? null,
          preferredDate: input.preferredDate ?? null,
          preferredTime: input.preferredTime ?? null,
        }
      : {
          advocateId: null,
          preferredDate: null,
          preferredTime: null,
        };

  return db
    .insert(intakeRequests)
    .values({
      id: randomUUID(),
      reference,
      kind: input.kind,
      status: "received",
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      jurisdiction: input.jurisdiction,
      practiceArea: input.practiceArea,
      urgency: input.urgency,
      matterSummary: input.matterSummary,
      adverseParties: input.adverseParties ?? null,
      consentAcknowledged: input.consentAcknowledged,
      source: input.source,
      metadata: {
        ...(input.metadata ?? {}),
        ...(input.companyName ? { companyName: input.companyName } : {}),
        ...(input.role ? { role: input.role } : {}),
      },
      createdAt: now,
      updatedAt: now,
      ...consultation,
    })
    .returning()
    .get();
}

export function getIntakeByReference(db: AppDatabase, reference: string) {
  return db
    .select({
      reference: intakeRequests.reference,
      kind: intakeRequests.kind,
      status: intakeRequests.status,
      practiceArea: intakeRequests.practiceArea,
      urgency: intakeRequests.urgency,
      createdAt: intakeRequests.createdAt,
      updatedAt: intakeRequests.updatedAt,
    })
    .from(intakeRequests)
    .where(eq(intakeRequests.reference, reference))
    .get();
}
