/**
 * MOCK ASSISTANT SERVICE — NYAYASETU BHARAT
 *
 * NOTE: All data structures, legal answers, advocate records, and statutory
 * summaries contained in this file are PLACEHOLDER mock data for prototype
 * interaction and agent evaluation purposes.
 */

export type DecisionBadgeType =
  | "Self-help first"
  | "Advocate advised"
  | "Time-sensitive"
  | "Urgent";

export interface CitationItem {
  id: string;
  act: string;
  section: string;
  title: string;
  snippet: string;
  url: string;
}

export interface DeadlineCalculation {
  memoDate: string;
  noticeDueDate: string;
  noticeDueDays: number;
  paymentWindowEndDate: string;
  paymentWindowDays: number;
  complaintDueDate: string;
  complaintDueDays: number;
  statutoryNote: string;
}

export interface AssistantAnswer {
  id: string;
  decisionBadge: DecisionBadgeType;
  oneLineSummary: string;
  explanation: string[];
  nextSteps: Array<{
    step: number;
    text: string;
    isFortyEightHours?: boolean;
  }>;
  deadlineCalculation?: DeadlineCalculation;
  citations: CitationItem[];
  sourcesReviewedDate: string;
  isLowConfidence?: boolean;
  confidenceReason?: string;
  followUpChips?: string[];
  isEmergency?: boolean;
  emergencyBullets?: string[];
  language?: "en" | "kn" | "hi";
}

export interface FictionalAdvocate {
  id: string;
  name: string;
  court: string;
  practiceAreas: string;
  languages: string[];
  enrolmentBadge: string;
  activityBadge: string;
  feeRange: string;
}

export interface CaseBriefData {
  facts: string;
  timeline: string;
  parties: string;
  documents: string[];
  relevantSections: string[];
  probableForum: string;
  deadline: string;
}

export interface ScanExplainResult {
  fileName: string;
  fileSize: string;
  whatThisIs: string;
  deadlinesFound: string;
  amounts: string;
  whatToDoNext: string;
}

// ---------------------------------------------------------------------------
// Fictional Advocates (Belagavi District & Sessions Court aware)
// ---------------------------------------------------------------------------
export const MOCK_MATCHED_ADVOCATES: FictionalAdvocate[] = [
  {
    id: "adv_1",
    name: "Adv. Sujata V. Patil",
    court: "Belagavi District & Sessions Court",
    practiceAreas: "Tenancy disputes, Rent Controller proceedings, Civil recovery",
    languages: ["Kannada", "English", "Marathi"],
    enrolmentBadge: "Enrolment verified",
    activityBadge: "Court activity confirmed",
    feeRange: "₹1,500 – ₹3,000 / consult",
  },
  {
    id: "adv_2",
    name: "Adv. Raghavendra Kulkarni",
    court: "Belagavi District & Sessions Court & JMFC",
    practiceAreas: "Sec 138 NI Act, Commercial recovery, Cheque dishonour appeals",
    languages: ["Kannada", "English", "Hindi"],
    enrolmentBadge: "Enrolment verified",
    activityBadge: "Court activity confirmed",
    feeRange: "₹2,000 – ₹4,000 / consult",
  },
  {
    id: "adv_3",
    name: "Adv. Meenakshi Hegde",
    court: "Belagavi District & Sessions Court",
    practiceAreas: "Partition suits, Property inheritance, Revenue boundary disputes",
    languages: ["Kannada", "English"],
    enrolmentBadge: "Enrolment verified",
    activityBadge: "Court activity confirmed",
    feeRange: "₹2,500 – ₹5,000 / consult",
  },
];

// Helper to calculate NI Act Sec 138 deadlines
export function calculate138Deadlines(memoDateStr: string): DeadlineCalculation {
  const baseDate = new Date(memoDateStr);
  const isValid = !isNaN(baseDate.getTime());
  const start = isValid ? baseDate : new Date();

  // Notice due: memo + 30 days
  const noticeDue = new Date(start);
  noticeDue.setDate(noticeDue.getDate() + 30);

  // Payment window ends: notice date + 15 days
  const payWindow = new Date(noticeDue);
  payWindow.setDate(payWindow.getDate() + 15);

  // Complaint due: payment window + 30 days
  const complaintDue = new Date(payWindow);
  complaintDue.setDate(complaintDue.getDate() + 30);

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return {
    memoDate: isValid ? memoDateStr : new Date().toISOString().split("T")[0],
    noticeDueDate: fmt(noticeDue),
    noticeDueDays: 30,
    paymentWindowEndDate: fmt(payWindow),
    paymentWindowDays: 15,
    complaintDueDate: fmt(complaintDue),
    complaintDueDays: 30,
    statutoryNote: "Assumes the notice is delivered the day it is sent.",
  };
}

// ---------------------------------------------------------------------------
// Mock Assistant Answer Engine
// ---------------------------------------------------------------------------
export async function getAssistantAnswer(
  query: string,
  preferredLanguage?: string
): Promise<AssistantAnswer> {
  // Simulate network/inference latency (600 - 900 ms)
  const latency = Math.floor(Math.random() * 300) + 600;
  await new Promise((r) => setTimeout(r, latency));

  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();

  // Check for Kannada script
  const isKannadaScript = /[\u0C80-\u0CFF]/.test(query) || preferredLanguage === "kn";
  // Check for Hindi / Devanagari script
  const isHindiScript = /[\u0900-\u097F]/.test(query) || preferredLanguage === "hi";

  // -------------------------------------------------------------------------
  // Scenario C: Emergency (arrest, police, violence, eviction threats)
  // -------------------------------------------------------------------------
  if (/arrest|police|custody|lockup|assault|violence|eviction threat|fir/i.test(lower)) {
    return {
      id: `ans_${Date.now()}`,
      decisionBadge: "Urgent",
      oneLineSummary: "Immediate legal safeguards apply under Article 22 of the Constitution.",
      isEmergency: true,
      emergencyBullets: [
        "You must be informed of the specific grounds of arrest immediately.",
        "You have the statutory right to consult and be defended by an advocate of your choice.",
        "You must be produced before the nearest Judicial Magistrate within 24 hours of arrest.",
        "Do not sign any blank sheets, unread statements, or confessions under pressure.",
      ],
      explanation: [],
      nextSteps: [
        {
          step: 1,
          text: "Dial 112 for police control room or 15100 for round-the-clock free legal aid.",
          isFortyEightHours: true,
        },
        {
          step: 2,
          text: "Demand entry of the arrest in the police station General Diary (GD) with exact time.",
        },
        {
          step: 3,
          text: "Request an immediate medical examination under Section 54 of CrPC / BNSS.",
        },
      ],
      citations: [
        {
          id: "cit_art22",
          act: "Constitution of India, 1950",
          section: "Article 22(1) & 22(2)",
          title: "Protection against arrest and detention in certain cases",
          snippet:
            "Mandates communication of grounds of arrest without delay, right to legal counsel, and production before magistrate within 24 hours.",
          url: "https://www.indiacode.nic.in",
        },
      ],
      sourcesReviewedDate: "12 Jan 2026",
      followUpChips: [
        "What is Section 41A CrPC notice?",
        "How to apply for anticipatory bail?",
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Scenario E / A in Kannada Script: Deposit / Landlord
  // -------------------------------------------------------------------------
  if (isKannadaScript && (lower.includes("ಠೇವಣಿ") || lower.includes("ಮಾಲೀಕ") || /deposit|landlord/i.test(lower))) {
    return {
      id: `ans_${Date.now()}`,
      decisionBadge: "Self-help first",
      oneLineSummary: "ನಿಮ್ಮ ಭದ್ರತಾ ಠೇವಣಿ ನಿಮ್ಮ ಹಣವಾಗಿದ್ದು, ಗುತ್ತಿಗೆ ಮುಗಿದ ನಂತರ ಹಿಂತಿರುಗಿಸಬೇಕು.",
      explanation: [
        "ನಿಮ್ಮ ಭದ್ರತಾ ಠೇವಣಿ ಮನೆ ಮಾಲೀಕರ ಬಳಿ ಇರುವ ನಿಮ್ಮ ಹಣ. ಗುತ್ತಿಗೆ ಮುಗಿದು ಆಸ್ತಿಯನ್ನು ಹಸ್ತಾಂತರಿಸಿದ ನಂತರ ಅದನ್ನು ಹಿಂತಿರುಗಿಸಬೇಕು, ಸಾಮಾನ್ಯ ಸವೆತವನ್ನು ಹೊರತುಪಡಿಸಿ ನಿಜವಾದ ಹಾನಿಗಳಿಗೆ ಮಾತ್ರ ಕಡಿತ ಅನುಮತಿಸಲಾಗಿದೆ.",
        "ಮನೆ ಮಾಲೀಕರು ಹಾನಿಯ ಲಿಖಿತ ತಪಾಸಣಾ ವರದಿ ಇಲ್ಲದೆ ಸಂಪೂರ್ಣ ಹಣವನ್ನು ತಡೆಹಿಡಿಯುವಂತಿಲ್ಲ.",
      ],
      nextSteps: [
        {
          step: 1,
          text: "ಇಮೇಲ್ ಅಥವಾ ನೋಂದಾಯಿತ ಅಂಚೆ ಮೂಲಕ ಅಧಿಕೃತ ಬೇಡಿಕೆ ಪತ್ರವನ್ನು ಕಳುಹಿಸಿ (ಮುಂದಿನ 48 ಗಂಟೆಗಳಲ್ಲಿ ಮಾಡಿ).",
          isFortyEightHours: true,
        },
        {
          step: 2,
          text: "ಮನೆ ಹಸ್ತಾಂತರದ ಪುರಾವೆ ಮತ್ತು ಮೂಲ ಪಾವತಿ ರಶೀದಿಗಳನ್ನು ಸಂಗ್ರಹಿಸಿಡಿ.",
        },
        {
          step: 3,
          text: "15 ದಿನಗಳಲ್ಲಿ ಉತ್ತರ ಬಾರದಿದ್ದರೆ, ಬಾಡಿಗೆ ನಿಯಂತ್ರಣ ಪ್ರಾಧಿಕಾರ ಅಥವಾ ಸಿವಿಲ್ ನ್ಯಾಯಾಲಯವನ್ನು ಸಂಪರ್ಕಿಸಿ.",
        },
      ],
      citations: [
        {
          id: "cit_tpa108_kn",
          act: "Transfer of Property Act, 1882",
          section: "Section 108",
          title: "Rights and liabilities of lessor and lessee",
          snippet: "Defines tenant restoration of possession and landlord duty on deposits.",
          url: "https://www.indiacode.nic.in",
        },
        {
          id: "cit_kra27_kn",
          act: "Karnataka Rent Act, 1999",
          section: "Section 27",
          title: "Deposit of rent and tenant claims",
          snippet: "Governs security deposit custody and dispute resolution in Karnataka.",
          url: "https://dpal.karnataka.gov.in",
        },
      ],
      sourcesReviewedDate: "12 Jan 2026",
      followUpChips: [
        "ಬೇಡಿಕೆ ಪತ್ರದ ಕರಡು ಸಿದ್ಧಪಡಿಸಿ",
        "ಬಾಡಿಗೆ ನ್ಯಾಯಾಲಯದ ಶುಲ್ಕ ಎಷ್ಟು?",
      ],
      language: "kn",
    };
  }

  // -------------------------------------------------------------------------
  // Scenario A: Deposit / Landlord (English / Hindi / Other)
  // -------------------------------------------------------------------------
  if (/deposit|landlord|tenant|tenancy|rent|lease/i.test(lower)) {
    return {
      id: `ans_${Date.now()}`,
      decisionBadge: "Self-help first",
      oneLineSummary: "Your security deposit must be refunded after tenancy termination, minus only proven non-wear damages.",
      explanation: [
        "A security deposit is your money held in trust by the landlord. Once your lease tenure ends and you hand over vacant possession, the landlord is statutorily obligated to return the full amount minus verified damages beyond ordinary wear and tear.",
        "Routine paint fading, aging fittings, and standard weathering do not legally justify arbitrary forfeiture without an agreed handover inventory report.",
      ],
      nextSteps: [
        {
          step: 1,
          text: "Send a formal written demand letter via registered post (RPAD) and email (do this in 48 hours).",
          isFortyEightHours: true,
        },
        {
          step: 2,
          text: "Preserve photographic proof of handover, key exchange receipt, and original bank payment traces.",
        },
        {
          step: 3,
          text: "If there is no repayment or response within 15 days, approach the Rent Controller or Civil Small Causes Court.",
        },
      ],
      citations: [
        {
          id: "cit_tpa108",
          act: "Transfer of Property Act, 1882",
          section: "Section 108(m) & (q)",
          title: "Rights and liabilities of lessor and lessee",
          snippet:
            "Lessees are bound to restore property in good condition, reasonable wear and tear excepted. Landlords cannot unjustly enrich themselves via deposits.",
          url: "https://www.indiacode.nic.in",
        },
        {
          id: "cit_kra27",
          act: "Karnataka Rent Act, 1999",
          section: "Section 27 & Schedule II",
          title: "Refund of Advance / Security Deposit",
          snippet:
            "Mandates prompt refund of excess tenancy deposit upon vacation of premises within notified territorial limits of Karnataka.",
          url: "https://dpal.karnataka.gov.in",
        },
      ],
      sourcesReviewedDate: "12 Jan 2026",
      followUpChips: [
        "Draft the demand letter",
        "What if they don't reply in 15 days?",
        "Can I deduct rent against deposit?",
      ],
      language: "en",
    };
  }

  // -------------------------------------------------------------------------
  // Scenario B: Cheque Bounced / Sec 138 NI Act
  // -------------------------------------------------------------------------
  if (/cheque|bounce|138|dishonour|memo|insufficient/i.test(lower)) {
    const todayStr = new Date().toISOString().split("T")[0];
    const deadlines = calculate138Deadlines(todayStr);

    return {
      id: `ans_${Date.now()}`,
      decisionBadge: "Time-sensitive",
      oneLineSummary: "Strict 30-day statutory limitation applies to issue legal notice from the date of the bank return memo.",
      explanation: [
        "Under Section 138 of the Negotiable Instruments Act, 1881, dishonour of a cheque for insufficiency of funds is a statutory criminal offence punishable with up to two years imprisonment or fine up to twice the cheque amount.",
        "The cause of action depends entirely on adhering to strict statutory timelines: the statutory demand notice must be dispatched within 30 calendar days of receiving the bank memo.",
      ],
      nextSteps: [
        {
          step: 1,
          text: "Collect the original bounced cheque and official bank return memo with clearing seal (do this in 48 hours).",
          isFortyEightHours: true,
        },
        {
          step: 2,
          text: "Issue a statutory demand notice through an advocate within 30 days of memo receipt.",
        },
        {
          step: 3,
          text: "Give the drawer 15 days from notice delivery to make full payment.",
        },
        {
          step: 4,
          text: "If unpaid upon expiry of 15 days, file a formal complaint before the Judicial Magistrate within 1 month.",
        },
      ],
      deadlineCalculation: deadlines,
      citations: [
        {
          id: "cit_ni138",
          act: "Negotiable Instruments Act, 1881",
          section: "Section 138",
          title: "Dishonour of cheque for insufficiency, etc., of funds in the account",
          snippet:
            "Deems dishonour an offence if presented within validity and demand notice dispatched within 30 days of memo receipt.",
          url: "https://www.indiacode.nic.in",
        },
        {
          id: "cit_ni142",
          act: "Negotiable Instruments Act, 1881",
          section: "Section 142",
          title: "Cognizance of offences and limitation period",
          snippet:
            "Prescribes complaint filing within one month after the 15-day notice period expires before the competent jurisdictional Magistrate.",
          url: "https://www.indiacode.nic.in",
        },
      ],
      sourcesReviewedDate: "12 Jan 2026",
      followUpChips: [
        "Draft the Section 138 notice",
        "What if the postal address is wrong?",
        "Can we freeze their bank account?",
      ],
      language: "en",
    };
  }

  // -------------------------------------------------------------------------
  // Scenario D: Ancestral Property / Property Share (Low Confidence)
  // -------------------------------------------------------------------------
  if (/ancestral|property share|coparcenary|partition|inheritance|will/i.test(lower)) {
    return {
      id: `ans_${Date.now()}`,
      decisionBadge: "Advocate advised",
      oneLineSummary: "Coparcenary and ancestral partition depends on generational lineage and local civil records.",
      isLowConfidence: true,
      confidenceReason:
        "I'm not fully sure about this one because ancestral property devolution depends heavily on specific family genealogical trees, year of succession, state amendments, and title deeds.",
      explanation: [
        "In Indian law, ancestral property rights vary significantly based on whether the property was inherited through four generations of male lineage undivided, whether a registered partition occurred previously, and applicable personal succession laws.",
        "Under the Hindu Succession (Amendment) Act, 2005, daughters possess equal coparcenary rights by birth, but specific claims require verification against encumbrance certificates and revenue partition records (RTC / Khata).",
      ],
      nextSteps: [
        {
          step: 1,
          text: "Compile genealogical family tree (Vamshavruksha) and certified death certificates (do this in 48 hours).",
          isFortyEightHours: true,
        },
        {
          step: 2,
          text: "Apply for 30-year Encumbrance Certificates (EC) from the Sub-Registrar's Office.",
        },
        {
          step: 3,
          text: "Have a civil property advocate review the title chain before issuing a partition demand.",
        },
      ],
      citations: [
        {
          id: "cit_hsa6",
          act: "Hindu Succession Act, 1956",
          section: "Section 6 (as amended in 2005)",
          title: "Devolution of interest in coparcenary property",
          snippet:
            "Confers coparcenary status on daughters in joint Hindu family governed by Mitakshara law on equal footing with sons.",
          url: "https://www.indiacode.nic.in",
        },
      ],
      sourcesReviewedDate: "12 Jan 2026",
      followUpChips: [
        "How to obtain certified RTC in Karnataka?",
        "Can father sell ancestral land without consent?",
      ],
      language: "en",
    };
  }

  // -------------------------------------------------------------------------
  // Scenario F: General / Fallback (Low confidence with structured intake prompt)
  // -------------------------------------------------------------------------
  return {
    id: `ans_${Date.now()}`,
    decisionBadge: "Advocate advised",
    oneLineSummary: "Preliminary assessment requires additional factual context to pinpoint statutory jurisdiction.",
    isLowConfidence: true,
    confidenceReason:
      "I'm not fully sure about this one because your description is brief and spans multiple possible statutory provisions.",
    explanation: [
      "In civil and statutory disputes across India, remedies depend on whether there exists a written contract, whether consumer/commercial jurisdiction applies, and whether the claim falls within the Limitation Act, 1963 schedules.",
      "To avoid misdirecting your filing, we recommend organizing your core facts into a formal Case Brief first, or consulting a verified advocate at your district court.",
    ],
    nextSteps: [
      {
        step: 1,
        text: "Structure your timeline and assemble contracts, bank entries, and notices (do this in 48 hours).",
        isFortyEightHours: true,
      },
      {
        step: 2,
        text: "Review limitation deadlines applicable to your specific claim type.",
      },
      {
        step: 3,
        text: "Consult an empanelled court advocate to examine documentary admissibility.",
      },
    ],
    citations: [
      {
        id: "cit_limitation",
        act: "Limitation Act, 1963",
        section: "Schedule Articles 1-137",
        title: "Periods of limitation for suits, appeals and applications",
        snippet:
          "Prescribes statutory deadlines after which civil remedy is extinguished before Indian courts.",
        url: "https://www.indiacode.nic.in",
      },
    ],
    sourcesReviewedDate: "12 Jan 2026",
    followUpChips: [
      "What is the limitation period for my claim?",
      "How to send a formal legal notice?",
    ],
    language: isHindiScript ? "hi" : "en",
  };
}
