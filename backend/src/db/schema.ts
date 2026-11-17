import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

type PracticeResult = {
  metric: string;
  description: string;
  forum: string;
};

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
};

export const practices = sqliteTable(
  "practices",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    num: text("num"),
    title: text("title").notNull(),
    tagline: text("tagline"),
    description: text("description").notNull(),
    shortDescription: text("short_description"),
    fullDescription: text("full_description"),
    startingFee: text("starting_fee"),
    feeType: text("fee_type"),
    feeBasis: text("fee_basis"),
    feeDetail: text("fee_detail"),
    partnerNames: text("partner_names"),
    partnerIds: text("partner_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    imageUrl: text("image_url"),
    iconName: text("icon_name"),
    whatWeHandle: text("what_we_handle", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    whenClientsCall: text("when_clients_call", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    whereWeArgue: text("where_we_argue", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    mattersCount: integer("matters_count"),
    results: text("results", { mode: "json" })
      .$type<PracticeResult[]>()
      .notNull()
      .default(sql`'[]'`),
    ...timestamps,
  },
  (table) => [
    index("practices_num_idx").on(table.num),
    index("practices_title_idx").on(table.title),
  ],
);

export const advocates = sqliteTable(
  "advocates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    practice: text("practice").notNull(),
    bio: text("bio").notNull(),
    inPracticeYears: integer("in_practice_years").notNull().default(0),
    admissions: text("admissions", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    education: text("education", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    priorExperience: text("prior_experience"),
    keyResults: text("key_results", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    languages: text("languages", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    phone: text("phone").notNull(),
    email: text("email").notNull().unique(),
    imageUrl: text("image_url").notNull(),
    isPartner: integer("is_partner", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("advocates_practice_idx").on(table.practice),
    index("advocates_name_idx").on(table.name),
    index("advocates_partner_idx").on(table.isPartner),
  ],
);

export const matters = sqliteTable(
  "matters",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    result: text("result"),
    resultUnit: text("result_unit"),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    whatHappened: text("what_happened"),
    outcome: text("outcome"),
    leadPartner: text("lead_partner"),
    leadAdvocateId: text("lead_advocate_id"),
    practice: text("practice"),
    clientType: text("client_type"),
    forum: text("forum"),
    year: text("year").notNull(),
    category: text("category").notNull(),
    ...timestamps,
  },
  (table) => [
    index("matters_category_idx").on(table.category),
    index("matters_practice_idx").on(table.practice),
    index("matters_year_idx").on(table.year),
  ],
);

export const insights = sqliteTable(
  "insights",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    excerpt: text("excerpt"),
    content: text("content"),
    category: text("category").notNull(),
    publishedDate: text("published_date"),
    readTime: text("read_time").notNull(),
    author: text("author").notNull(),
    authorRole: text("author_role"),
    authorPractice: text("author_practice"),
    authorImageUrl: text("author_image_url"),
    pullQuote: text("pull_quote"),
    paragraphs: text("paragraphs", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    takeaways: text("takeaways", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    imageUrl: text("image_url").notNull(),
    ...timestamps,
  },
  (table) => [
    index("insights_category_idx").on(table.category),
    index("insights_published_idx").on(table.publishedDate),
    index("insights_author_idx").on(table.author),
  ],
);

export const faqs = sqliteTable(
  "faqs",
  {
    id: text("id").primaryKey(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    category: text("category"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [index("faqs_sort_idx").on(table.sortOrder)],
);

export const testimonials = sqliteTable(
  "testimonials",
  {
    id: text("id").primaryKey(),
    quote: text("quote").notNull(),
    author: text("author"),
    role: text("role").notNull(),
    company: text("company").notNull(),
    clientSince: text("client_since"),
    avatarUrl: text("avatar_url"),
    rating: integer("rating"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [index("testimonials_sort_idx").on(table.sortOrder)],
);

export const fixedFees = sqliteTable(
  "fixed_fees",
  {
    id: text("id").primaryKey(),
    service: text("service"),
    title: text("title"),
    description: text("description").notNull(),
    price: text("price"),
    period: text("period"),
    features: text("features", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    popular: integer("popular", { mode: "boolean" }).notNull().default(false),
    ctaText: text("cta_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [index("fixed_fees_sort_idx").on(table.sortOrder)],
);

export const intakeRequests = sqliteTable(
  "intake_requests",
  {
    id: text("id").primaryKey(),
    reference: text("reference").notNull().unique(),
    kind: text("kind", {
      enum: ["legal-assessment", "conflict-check", "consultation"],
    }).notNull(),
    status: text("status", {
      enum: ["received", "in-review", "matched", "closed", "rejected"],
    })
      .notNull()
      .default("received"),

    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    jurisdiction: text("jurisdiction").notNull(),
    practiceArea: text("practice_area").notNull(),
    urgency: text("urgency", {
      enum: ["emergency-24h", "urgent-48h", "standard-30d", "exploratory"],
    })
      .notNull()
      .default("standard-30d"),
    matterSummary: text("matter_summary").notNull(),
    adverseParties: text("adverse_parties"),

    advocateId: text("advocate_id"),
    preferredDate: text("preferred_date"),
    preferredTime: text("preferred_time"),

    consentAcknowledged: integer("consent_acknowledged", { mode: "boolean" })
      .notNull()
      .default(false),
    source: text("source").notNull().default("website"),
    metadata: text("metadata", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    ...timestamps,
  },
  (table) => [
    index("intake_kind_idx").on(table.kind),
    index("intake_status_idx").on(table.status),
    index("intake_email_idx").on(table.email),
    index("intake_created_idx").on(table.createdAt),
  ],
);

export const newsletterSubscribers = sqliteTable(
  "newsletter_subscribers",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(),
    status: text("status", { enum: ["subscribed", "unsubscribed"] })
      .notNull()
      .default("subscribed"),
    source: text("source").notNull().default("website"),
    ...timestamps,
  },
  (table) => [uniqueIndex("newsletter_email_idx").on(table.email)],
);

export type PracticeRow = typeof practices.$inferSelect;
export type AdvocateRow = typeof advocates.$inferSelect;
export type MatterRow = typeof matters.$inferSelect;
export type InsightRow = typeof insights.$inferSelect;
export type FaqRow = typeof faqs.$inferSelect;
export type TestimonialRow = typeof testimonials.$inferSelect;
export type FixedFeeRow = typeof fixedFees.$inferSelect;
export type IntakeRequestRow = typeof intakeRequests.$inferSelect;
export type NewsletterSubscriberRow = typeof newsletterSubscribers.$inferSelect;
