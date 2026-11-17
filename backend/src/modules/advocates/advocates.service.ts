import { and, asc, count, eq, like, or, type SQL, sql } from "drizzle-orm";
import type { AppDatabase } from "../../db/client.js";
import { advocates } from "../../db/schema.js";
import type { PaginationQuery } from "../../shared/http/pagination.js";
import { getOffset } from "../../shared/http/pagination.js";

export type AdvocateListFilters = PaginationQuery & {
  practice?: string;
  language?: string;
  partner?: boolean;
  q?: string;
};

function buildAdvocateConditions(filters: AdvocateListFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.practice) {
    conditions.push(eq(advocates.practice, filters.practice));
  }

  if (filters.partner !== undefined) {
    conditions.push(eq(advocates.isPartner, filters.partner));
  }

  if (filters.language) {
    conditions.push(
      sql`${advocates.languages} like ${`%${filters.language}%`}`,
    );
  }

  if (filters.q) {
    const term = `%${filters.q}%`;
    conditions.push(
      or(
        like(advocates.name, term),
        like(advocates.practice, term),
        like(advocates.role, term),
        like(advocates.bio, term),
        like(advocates.priorExperience, term),
      )!,
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function listAdvocates(db: AppDatabase, filters: AdvocateListFilters) {
  const where = buildAdvocateConditions(filters);

  const rows = db
    .select()
    .from(advocates)
    .where(where)
    .orderBy(asc(advocates.name))
    .limit(filters.limit)
    .offset(getOffset(filters))
    .all();

  const total =
    db.select({ value: count() }).from(advocates).where(where).get()?.value ??
    0;

  return { rows, total };
}

export function getAdvocateById(db: AppDatabase, id: string) {
  return db.select().from(advocates).where(eq(advocates.id, id)).get();
}
