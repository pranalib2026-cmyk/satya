import { asc, eq, or } from "drizzle-orm";
import type { AppDatabase } from "../../db/client.js";
import { practices } from "../../db/schema.js";

export function listPractices(db: AppDatabase) {
  return db.select().from(practices).orderBy(asc(practices.num)).all();
}

export function getPracticeBySlugOrId(db: AppDatabase, slugOrId: string) {
  return db
    .select()
    .from(practices)
    .where(or(eq(practices.slug, slugOrId), eq(practices.id, slugOrId)))
    .get();
}
