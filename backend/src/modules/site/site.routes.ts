import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

const site = {
  brand: {
    name: "NyayaSetu",
    nameDevanagari: "न्यायसेतु",
    tagline: "Legal Help Should Be Clear. Justice Should Be Accessible.",
    established: "2026",
    domain: "https://nyayasetu.in",
    description:
      "AI-assisted preliminary legal assessment and Bar Council-verified advocate discovery for Indian citizens and MSMEs.",
  },
  languages: [
    { code: "en", label: "English", nativeLabel: "English" },
    { code: "hi", label: "Hindi", nativeLabel: "हिंदी" },
    { code: "kn", label: "Kannada", nativeLabel: "ಕನ್ನಡ" },
    { code: "mr", label: "Marathi", nativeLabel: "मराठी" },
    { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
    { code: "te", label: "Telugu", nativeLabel: "తెలుగు" },
  ],
  offices: [
    { city: "New Delhi", role: "Legal triage and Supreme Court desk" },
    { city: "Mumbai", role: "Commercial and corporate desk" },
    { city: "Bengaluru", role: "Startup, debt recovery and consumer desk" },
    { city: "Kolkata", role: "Civil and property desk" },
    { city: "Chennai", role: "Family and consumer desk" },
    { city: "Hyderabad", role: "Corporate and consumer desk" },
  ],
  support: {
    tollFree: "1800-692-9273",
    tollFreeLabel: "1800-NYAYA-SETU",
    hours: "Mon–Sat 9:00 AM – 8:00 PM IST",
    emergencyNote:
      "For bail, injunction, or cyber-fraud emergencies, call the urgent triage desk.",
  },
  legal: {
    platformRole:
      "NyayaSetu provides an AI-assisted preliminary legal assessment and advocate discovery platform. It does not replace independent advice from a licensed advocate under the Advocates Act, 1961.",
    noRelationship:
      "Submitting an intake request does not create an advocate-client relationship. A relationship is formed only through a separate written engagement with an advocate.",
    barCouncil:
      "Advocates on NyayaSetu do not solicit work or advertise, in compliance with Rule 36, Chapter II, Part VI of the Bar Council of India Rules.",
  },
} as const;

export const siteRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/site",
    {
      schema: {
        tags: ["Site"],
        summary: "Get public site configuration",
        description:
          "Brand metadata, supported languages, office locations, support contacts, and legal notices used by the frontend shell.",
      },
    },
    async () => ({ data: site }),
  );
};
