import { and, asc, count, desc, eq, like, or, type SQL } from "drizzle-orm";
import type { AppDatabase } from "../../db/client.js";
import { matters } from "../../db/schema.js";
import type { PaginationQuery } from "../../shared/http/pagination.js";
import { getOffset } from "../../shared/http/pagination.js";

export type MatterListFilters = PaginationQuery & {
  category?: string;
  practice?: string;
  year?: string;
  q?: string;
};

function buildMatterConditions(filters: MatterListFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.category) {
    conditions.push(eq(matters.category, filters.category));
  }

  if (filters.practice) {
    conditions.push(eq(matters.practice, filters.practice));
  }

  if (filters.year) {
    conditions.push(eq(matters.year, filters.year));
  }

  if (filters.q) {
    const term = `%${filters.q}%`;
    conditions.push(
      or(
        like(matters.title, term),
        like(matters.summary, term),
        like(matters.leadPartner, term),
        like(matters.practice, term),
        like(matters.forum, term),
        like(matters.result, term),
      )!,
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function listMatters(db: AppDatabase, filters: MatterListFilters) {
  const where = buildMatterConditions(filters);

  const rows = db
    .select()
    .from(matters)
    .where(where)
    .orderBy(desc(matters.year), asc(matters.title))
    .limit(filters.limit)
    .offset(getOffset(filters))
    .all();

  const total =
    db.select({ value: count() }).from(matters).where(where).get()?.value ?? 0;

  return { rows, total };
}

export function listMatterCategories(db: AppDatabase) {
  return db
    .selectDistinct({ category: matters.category })
    .from(matters)
    .orderBy(asc(matters.category))
    .all()
    .map((row) => row.category);
}

export function getMatterBySlugOrId(db: AppDatabase, slugOrId: string) {
  return db
    .select()
    .from(matters)
    .where(or(eq(matters.slug, slugOrId), eq(matters.id, slugOrId)))
    .get();
}
