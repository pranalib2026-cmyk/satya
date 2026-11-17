import { pathToFileURL } from "node:url";
import type { AppDatabase } from "./client.js";
import { createDatabase } from "./client.js";
import {
  advocates,
  faqs,
  fixedFees,
  insights,
  matters,
  practices,
  testimonials,
} from "./schema.js";
import {
  advocateSeed,
  faqSeed,
  fixedFeeSeed,
  insightSeed,
  matterSeed,
  practiceSeed,
  testimonialSeed,
} from "./seed-data/index.js";

/**
 * Seeds public content tables. Intake requests and newsletter subscribers are
 * deliberately left untouched so local re-seeding never destroys user data.
 */
export function seedDatabase(db: AppDatabase): void {
  db.transaction((tx) => {
    tx.delete(fixedFees).run();
    tx.delete(testimonials).run();
    tx.delete(faqs).run();
    tx.delete(insights).run();
    tx.delete(matters).run();
    tx.delete(advocates).run();
    tx.delete(practices).run();

    tx.insert(practices).values(practiceSeed).run();
    tx.insert(advocates).values(advocateSeed).run();
    tx.insert(matters).values(matterSeed).run();
    tx.insert(insights).values(insightSeed).run();
    tx.insert(faqs).values(faqSeed).run();
    tx.insert(testimonials).values(testimonialSeed).run();
    tx.insert(fixedFees).values(fixedFeeSeed).run();
  });
}

async function main(): Promise<void> {
  const { db, close } = createDatabase();

  try {
    seedDatabase(db);
    console.log(
      `Seeded ${practiceSeed.length} practices, ${advocateSeed.length} advocates, ${matterSeed.length} matters, ${insightSeed.length} insights, ${faqSeed.length} FAQs.`,
    );
  } finally {
    close();
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  await main();
}
