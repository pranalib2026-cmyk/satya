import { and, asc, count, desc, eq, like, or, type SQL } from "drizzle-orm";
import type { AppDatabase } from "../../db/client.js";
import { insights } from "../../db/schema.js";
import type { PaginationQuery } from "../../shared/http/pagination.js";
import { getOffset } from "../../shared/http/pagination.js";

export type InsightListFilters = PaginationQuery & {
  category?: string;
  author?: string;
  q?: string;
};

function buildInsightConditions(filters: InsightListFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.category) {
    conditions.push(eq(insights.category, filters.category));
  }

  if (filters.author) {
    conditions.push(eq(insights.author, filters.author));
  }

  if (filters.q) {
    const term = `%${filters.q}%`;
    conditions.push(
      or(
        like(insights.title, term),
        like(insights.subtitle, term),
        like(insights.excerpt, term),
        like(insights.author, term),
        like(insights.category, term),
      )!,
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function listInsights(db: AppDatabase, filters: InsightListFilters) {
  const where = buildInsightConditions(filters);

  const rows = db
    .select()
    .from(insights)
    .where(where)
    .orderBy(desc(insights.publishedDate), asc(insights.title))
    .limit(filters.limit)
    .offset(getOffset(filters))
    .all();

  const total =
    db.select({ value: count() }).from(insights).where(where).get()?.value ?? 0;

  return { rows, total };
}

export function listInsightCategories(db: AppDatabase) {
  return db
    .selectDistinct({ category: insights.category })
    .from(insights)
    .orderBy(asc(insights.category))
    .all()
    .map((row) => row.category);
}

export function getInsightBySlugOrId(db: AppDatabase, slugOrId: string) {
  return db
    .select()
    .from(insights)
    .where(or(eq(insights.slug, slugOrId), eq(insights.id, slugOrId)))
    .get();
}
