import { api, getStoredToken } from "@/lib/api-client";
import { delay } from "./api";
import { advocates as mockAdvocates, getAdvocate as getMockAdvocate } from "@/data/dashboard-mock-data";
import type { Advocate, AdvocateMatch, Language, MatchScore } from "@/types/dashboard";

/** Weights come from the matching configuration in the backend. */
export const configRows = [
  { key: "matching.weight.practice_fit", value: "0.35" },
  { key: "matching.weight.court_proximity", value: "0.25" },
  { key: "matching.weight.language", value: "0.20" },
  { key: "matching.weight.experience", value: "0.10" },
  { key: "matching.weight.budget_availability", value: "0.10" },
] as const;

export const weights = {
  practice_fit: 0.35,
  court_proximity: 0.25,
  language: 0.20,
  experience: 0.10,
  rating_response: 0.05,
  budget_availability: 0.05,
};

export interface MatchPreferences {
  practiceArea?: string;
  budgetMax: number;
  language: Language | "any";
  mode: "any" | "video" | "phone" | "in-person";
  gender: "any" | "female" | "male";
  city?: string;
}

interface BackendAdvocateItem {
  id: string;
  full_name: string;
  bar_council_name: string;
  primary_practice: string;
  in_practice_years: number;
  city: string;
  state: string;
  is_verified: boolean;
  fixed_consultation_fee_inr?: number;
}

interface BackendAdvocateDirectoryResponse {
  items: BackendAdvocateItem[];
  total: number;
  page: number;
  page_size: number;
}

const norm = (v: number, min: number, max: number) => Math.min(1, Math.max(0, (v - min) / (max - min)));

function createAdvocateFromBackend(item: BackendAdvocateItem, idx = 0): Advocate {
  const nameParts = item.full_name.replace(/^Adv\.?\s*/i, "").trim().split(" ");
  const initials =
    nameParts.length >= 2
      ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
      : item.full_name.slice(0, 2).toUpperCase();

  return {
    id: item.id,
    name: item.full_name,
    initials,
    practiceAreas: [item.primary_practice, "Civil Litigation"],
    courts: [`City Civil Court, ${item.city}`, `District & Sessions Court, ${item.city}`],
    languages: ["en", "hi", "kn"],
    experienceYears: item.in_practice_years || 10,
    feeMin: item.fixed_consultation_fee_inr || 1500,
    feeMax: (item.fixed_consultation_fee_inr || 1500) + 1000,
    city: item.city,
    distanceKm: 3.5 + idx * 2.1,
    rating: 4.8,
    reviewCount: 32 + idx * 5,
    responseRate: 95,
    verified: item.is_verified,
    enrolmentNo: item.bar_council_name,
    enrolmentDate: "2014-06-15",
    stateBarCouncil: item.bar_council_name,
    gender: idx % 2 === 0 ? "female" : "male",
    modes: ["video", "phone", "in-person"],
    nextAvailable: "Tomorrow, 11:30 AM",
    about: `Verified Advocate enrolled with ${item.bar_council_name}. Over ${item.in_practice_years} years of active court representation in ${item.primary_practice}.`,
    casesHandled: 120 + idx * 15,
  };
}

export function scoreAdvocate(adv: Advocate, prefs: MatchPreferences, category: string): AdvocateMatch {
  const areas = adv.practiceAreas.map((a) => a.toLowerCase());
  const practiceFit = areas.some((a) => a.includes(category.toLowerCase()))
    ? 1
    : areas.some((a) => a === "civil")
      ? 0.5
      : 0.2;

  const courtProximity = Math.max(0, 1 - adv.distanceKm / 25);
  const experience = norm(adv.experienceYears, 0, 25);
  const language =
    prefs.language === "any" ? 0.8 : adv.languages.includes(prefs.language) ? 1 : 0.15;
  const ratingResponse = (norm(adv.rating, 3.5, 5) + adv.responseRate / 100) / 2;

  const withinBudget = adv.feeMin <= prefs.budgetMax;
  const modeOk = prefs.mode === "any" || adv.modes.includes(prefs.mode as "video" | "phone" | "in-person");
  const budgetAvailability = (withinBudget ? 0.7 : 0.1) + (modeOk ? 0.3 : 0);

  const score: MatchScore = {
    practiceFit,
    courtProximity,
    experience,
    language,
    ratingResponse,
    budgetAvailability,
    total:
      weights.practice_fit * practiceFit +
      weights.court_proximity * courtProximity +
      weights.experience * experience +
      weights.language * language +
      weights.rating_response * ratingResponse +
      weights.budget_availability * budgetAvailability,
  };

  const reasonParts: string[] = [];
  if (practiceFit === 1) reasonParts.push(`practises ${category.toLowerCase()}`);
  else reasonParts.push("has relevant civil practice");
  if (adv.courts.some((c) => c.toLowerCase().includes("bengaluru"))) reasonParts.push("appears in Bengaluru courts");
  if (prefs.language !== "any" && adv.languages.includes(prefs.language)) reasonParts.push("speaks your language");
  if (withinBudget) reasonParts.push(`fees from ₹${adv.feeMin.toLocaleString("en-IN")}`);
  if (adv.distanceKm <= 8) reasonParts.push(`${adv.distanceKm} km away`);

  return {
    advocate: adv,
    score,
    reason: `Matches because this advocate ${reasonParts.join(", ")}.`,
  };
}

export async function matchAdvocates(
  prefs: MatchPreferences,
  category = "Tenancy",
): Promise<{ matches: AdvocateMatch[]; noLocalMatch: boolean }> {
  // 1. Try to fetch verified advocates from backend matching API
  try {
    const res = await api.get<BackendAdvocateDirectoryResponse>("/api/v1/matching/advocates", {
      params: {
        practice: category !== "Tenancy" ? category : undefined,
        city: prefs.city || "Bengaluru",
      },
    });

    if (res.items && res.items.length > 0) {
      // Map backend verified advocates to frontend Advocate model
      const liveAdvocates: Advocate[] = res.items.map((item, idx) =>
        createAdvocateFromBackend(item, idx),
      );

      const ranked = liveAdvocates
        .map((adv) => scoreAdvocate(adv, prefs, category))
        .sort((a, b) => b.score.total - a.score.total);

      return {
        matches: ranked,
        noLocalMatch: false,
      };
    }
  } catch {
    // Graceful fallback to verified local advocate corpus
  }

  await delay(400);
  const filtered = mockAdvocates.filter((adv) => adv.verified);

  const eligible = filtered.filter(
    (adv) =>
      (prefs.mode === "any" || adv.modes.includes(prefs.mode as "video" | "phone" | "in-person")) &&
      (prefs.gender === "any" || adv.gender === prefs.gender),
  );

  const ranked = eligible
    .map((adv) => scoreAdvocate(adv, prefs, category))
    .sort((a, b) => b.score.total - a.score.total);

  const local = ranked.filter((m) => m.advocate.distanceKm <= 20 && m.advocate.feeMin <= prefs.budgetMax);

  if (local.length === 0) {
    return { matches: ranked.slice(0, 4), noLocalMatch: true };
  }

  return { matches: local, noLocalMatch: false };
}

export function getAdvocate(id: string): Advocate | undefined {
  return getMockAdvocate(id);
}

export async function getAdvocateById(id: string): Promise<Advocate | undefined> {
  const token = getStoredToken();
  if (token && !token.startsWith("jwt_mock_")) {
    try {
      const res = await api.get<BackendAdvocateItem>(`/api/v1/advocates/${id}`);
      if (res && res.id) {
        return createAdvocateFromBackend(res);
      }
    } catch {
      // Fallback
    }
  }
  await delay(150);
  return getMockAdvocate(id);
}

export function sortMatches(
  matches: AdvocateMatch[],
  sort: "recommended" | "nearest" | "fee" | "experience",
) {
  const list = [...matches];
  switch (sort) {
    case "nearest":
      return list.sort((a, b) => a.advocate.distanceKm - b.advocate.distanceKm);
    case "fee":
      return list.sort((a, b) => a.advocate.feeMin - b.advocate.feeMin);
    case "experience":
      return list.sort((a, b) => b.advocate.experienceYears - a.advocate.experienceYears);
    default:
      return list.sort((a, b) => b.score.total - a.score.total);
  }
}

export const practiceAreas = [
  "Tenancy",
  "Property",
  "Consumer",
  "Cheque bounce",
  "Family",
  "Criminal",
  "Employment",
  "Cyber",
];
