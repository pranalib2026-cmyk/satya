import { asc } from "drizzle-orm";
import type { AppDatabase } from "../../db/client.js";
import { faqs, fixedFees, testimonials } from "../../db/schema.js";

export function listFaqs(db: AppDatabase) {
  return db.select().from(faqs).orderBy(asc(faqs.sortOrder)).all();
}

export function listTestimonials(db: AppDatabase) {
  return db
    .select()
    .from(testimonials)
    .orderBy(asc(testimonials.sortOrder))
    .all();
}

export function listFixedFees(db: AppDatabase) {
  return db
    .select()
    .from(fixedFees)
    .orderBy(asc(fixedFees.sortOrder))
    .all();
}

export function getCatalog(db: AppDatabase) {
  return {
    faqs: listFaqs(db),
    testimonials: listTestimonials(db),
    fixedFees: listFixedFees(db),
  };
}
