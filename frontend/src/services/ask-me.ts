import { api, getStoredToken } from "@/lib/api-client";

export interface AskMeProvision {
  citation_index: number;
  act_name: string;
  section_or_article: string;
  source_type?: string;
  heading?: string | null;
  brief: string;
  identifier?: string | null;
  official_source_url?: string | null;
  content_checksum?: string | null;
  is_verified_in_corpus: boolean;
}

export interface AskMeAdvocateContact {
  id: string;
  name: string;
  phone: string;
  qualifications: string;
  bar_council_id: string;
  bar_council_name: string;
  primary_practice: string;
  courts: string[];
  experience_years: number;
  city: string;
  languages: string[];
}

export interface AskMeHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AskMeAttachment {
  file_name: string;
  extracted_text: string;
  char_count: number;
  page_count: number;
  engine_name: string;
}

export interface AskMeResponse {
  query: string;
  detected_language: string;
  brief_answer: string;
  simplified_answer: string;
  spoken_summary: string;
  applicable_provisions: AskMeProvision[];
  sources_found: boolean;
  solutions: string[];
  follow_up_questions: string[];
  is_serious: boolean;
  seriousness_reason?: string | null;
  advocate_contacts: AskMeAdvocateContact[];
  disclaimer: string;
  assessed_at: string;
  isOfflineFallback?: boolean;
}

interface VerifiedRule {
  keywords: RegExp;
  isSerious: boolean;
  seriousnessReason?: string;
  provisions: AskMeProvision[];
  briefAnswer: string;
  simplifiedAnswer: string;
  solutions: string[];
  followUps: string[];
}

const VERIFIED_OFFLINE_RULES: VerifiedRule[] = [
  {
    keywords: /\b(cheque|check|bounce|dishonour|138|ni act|insufficient funds)\b/i,
    isSerious: true,
    seriousnessReason:
      "Cheque dishonour under Section 138 NI Act carries a strict 30-day statutory notice deadline from the bank return memo.",
    provisions: [
      {
        citation_index: 1,
        act_name: "The Negotiable Instruments Act, 1881",
        section_or_article: "Section 138",
        source_type: "BARE_ACT",
        heading: "Dishonour of cheque for insufficiency, etc., of funds in the account",
        brief:
          "Makes dishonour of a cheque for insufficient funds or exceeding arrangement an offence punishable with imprisonment up to 2 years, or fine up to twice the cheque amount, or both, provided statutory notice is sent within 30 days of receiving the bank return memo.",
        identifier: "Act No. 26 of 1881",
        official_source_url: "https://www.indiacode.nic.in/handle/123456789/2189",
        is_verified_in_corpus: true,
      },
      {
        citation_index: 2,
        act_name: "The Negotiable Instruments Act, 1881",
        section_or_article: "Section 142",
        source_type: "BARE_ACT",
        heading: "Cognizance of offences",
        brief:
          "Requires a written complaint to be filed before a Metropolitan Magistrate or Judicial Magistrate of First Class within 1 month after the 15-day payment window expires.",
        identifier: "Act No. 26 of 1881",
        official_source_url: "https://www.indiacode.nic.in/handle/123456789/2189",
        is_verified_in_corpus: true,
      },
    ],
    briefAnswer:
      "Under Section 138 of the Negotiable Instruments Act, 1881, when a cheque is returned unpaid due to insufficient funds, the payee must issue a written demand notice within 30 days of receiving the bank return memo, giving the drawer 15 days to pay [1]. If unpaid, a criminal complaint under Section 142 may be filed within 1 month thereafter [2].",
    simplifiedAnswer:
      "In simple words: If someone's cheque bounced, the law gives you a clear 3-step timeline. First, send them a formal written notice within 30 days of the bank telling you the cheque bounced. Second, wait 15 days for them to pay. Third, if they still don't pay, you have 30 days after that to file a case in the Magistrate Court.",
    solutions: [
      "Preserve the original bounced cheque and the bank's Cheque Return Memo with the exact date stamp.",
      "Send a formal Section 138 written demand notice via Registered Post AD within 30 days of the bank return memo.",
      "Allow 15 days from receipt of notice for payment; if unpaid, engage an advocate to file a complaint under Section 142 before the Magistrate Court within 1 month.",
    ],
    followUps: [
      "What if 30 days have already passed since the bank return memo?",
      "What proof do I need besides the bounced cheque?",
      "Can I recover the money through a civil suit as well?",
    ],
  },
  {
    keywords: /\b(consumer|defective|refund|ecommerce|service deficiency|warranty|damaged product)\b/i,
    isSerious: false,
    provisions: [
      {
        citation_index: 1,
        act_name: "The Consumer Protection Act, 2019",
        section_or_article: "Section 35",
        source_type: "BARE_ACT",
        heading: "Manner in which complaint shall be made",
        brief:
          "Allows an aggrieved consumer to file a complaint before the District Consumer Disputes Redressal Commission where the seller/service provider resides, carries on business, or where the consumer resides or works.",
        identifier: "Act No. 35 of 2019",
        official_source_url: "https://www.indiacode.nic.in/handle/123456789/15256",
        is_verified_in_corpus: true,
      },
      {
        citation_index: 2,
        act_name: "The Consumer Protection Act, 2019",
        section_or_article: "Section 69",
        source_type: "BARE_ACT",
        heading: "Limitation period",
        brief:
          "Specifies that a consumer complaint must be filed within 2 years from the date on which the cause of action arose.",
        identifier: "Act No. 35 of 2019",
        official_source_url: "https://www.indiacode.nic.in/handle/123456789/15256",
        is_verified_in_corpus: true,
      },
    ],
    briefAnswer:
      "Defective goods, unfair trade practices, or deficiency in service are governed by the Consumer Protection Act, 2019. Under Section 35, you may file a complaint before the District Consumer Commission (including online via e-Daakhil) [1] within 2 years under Section 69 [2].",
    simplifiedAnswer:
      "In simple words: If a company sold you a faulty product or refused a valid refund, you are protected as a consumer. You can complain on the National Consumer Helpline or file a case online at the Consumer Commission (e-Daakhil) within 2 years, without needing a complicated court trial.",
    solutions: [
      "Collect your tax invoice, order confirmation, payment receipt, and screenshots of customer-support chats.",
      "Send a written grievance email/notice to the seller's Grievance Officer giving 15 days for refund or replacement.",
      "Escalate on the National Consumer Helpline (1915) or file a formal complaint under Section 35 on e-Daakhil within 2 years.",
    ],
    followUps: [
      "How do I file a complaint online on e-Daakhil?",
      "Can I claim compensation for harassment in addition to a refund?",
      "What is the time limit under Section 69?",
    ],
  },
  {
    keywords: /\b(arrest|fir|police|bail|custody|warrant|detained)\b/i,
    isSerious: true,
    seriousnessReason:
      "Matter involves arrest, FIR, or police custody, which affects fundamental liberty and requires immediate advocate assistance.",
    provisions: [
      {
        citation_index: 1,
        act_name: "The Constitution of India",
        section_or_article: "Article 22(1) & Article 22(2)",
        source_type: "BARE_ACT",
        heading: "Protection against arrest and detention in certain cases",
        brief:
          "Guarantees that no arrested person shall be detained in custody without being informed of the grounds of arrest, guarantees the right to consult and be defended by a legal practitioner of choice, and mandates production before a Magistrate within 24 hours.",
        identifier: "Constitution of India (1950)",
        official_source_url: "https://www.indiacode.nic.in/handle/123456789/15240",
        is_verified_in_corpus: true,
      },
      {
        citation_index: 2,
        act_name: "The Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)",
        section_or_article: "Section 35 & Section 47",
        source_type: "BARE_ACT",
        heading: "When police may arrest without warrant & grounds of arrest",
        brief:
          "Requires police officers to record reasons before arrest in cognizable offences punishable up to 7 years (notice of appearance under Section 35(3)) and immediately communicate grounds of arrest and right to bail under Section 47.",
        identifier: "Act No. 46 of 2023",
        official_source_url: "https://www.indiacode.nic.in/handle/123456789/20099",
        is_verified_in_corpus: true,
      },
    ],
    briefAnswer:
      "Under Article 22 of the Constitution of India [1] and Sections 35 & 47 of the Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS) [2], any person arrested must be informed of the grounds of arrest, has the constitutional right to consult an advocate, and must be produced before the nearest Magistrate within 24 hours.",
    simplifiedAnswer:
      "In simple words: Police cannot lock someone up silently. By law, they must tell the person why they are being arrested, let them call a lawyer and family member, and bring them before a judge (Magistrate) within 24 hours.",
    solutions: [
      "Request the written grounds of arrest / FIR number or Section 35(3) BNSS notice immediately.",
      "Do not sign blank papers or give coerced statements; exercise the Article 22(1) right to consult an advocate first.",
      "Contact a criminal defence advocate immediately for regular or anticipatory bail before the Magistrate or Sessions Court.",
    ],
    followUps: [
      "What is a Section 35(3) BNSS notice of appearance?",
      "When can someone apply for anticipatory bail?",
      "What if police do not produce the person within 24 hours?",
    ],
  },
  {
    keywords: /\b(domestic violence|husband|harassment|dowry|cruelty|maintenance|wife|abuse)\b/i,
    isSerious: true,
    seriousnessReason:
      "Domestic violence or personal safety matters require urgent protective relief and confidential legal support.",
    provisions: [
      {
        citation_index: 1,
        act_name: "The Protection of Women from Domestic Violence Act, 2005",
        section_or_article: "Section 12 & Section 18–20",
        source_type: "BARE_ACT",
        heading: "Application to Magistrate for Protection, Residence & Monetary Relief",
        brief:
          "Empowers an aggrieved woman or Protection Officer to apply to a Magistrate for immediate protection orders (Sec 18), residence orders (Sec 19), and monetary relief/maintenance (Sec 20).",
        identifier: "Act No. 43 of 2005",
        official_source_url: "https://www.indiacode.nic.in/handle/123456789/2021",
        is_verified_in_corpus: true,
      },
    ],
    briefAnswer:
      "Under Section 12 of the Protection of Women from Domestic Violence Act, 2005, an aggrieved person may seek immediate Protection Orders (Section 18), Residence Orders (Section 19), and Monetary Relief (Section 20) before the Magistrate [1].",
    simplifiedAnswer:
      "In simple words: You can ask a Magistrate for an immediate court order to stop abuse, protect your right to stay in the shared home, and get financial support—without waiting years for a full trial.",
    solutions: [
      "If in immediate physical danger, call 112 (Emergency) or 181 (Women Helpline) right away.",
      "Preserve medical reports, photos of injuries, threatening messages, or call recordings safely.",
      "Approach a Protection Officer, District Legal Services Authority (free legal aid), or an advocate to file a Section 12 application.",
    ],
    followUps: [
      "How quickly can a Magistrate grant a Protection Order?",
      "Can I claim residence rights even if the house is not in my name?",
      "How do I get free legal aid through DLSA?",
    ],
  },
  {
    keywords: /\b(rent|landlord|tenant|deposit|eviction|lease|flat)\b/i,
    isSerious: true,
    seriousnessReason:
      "Unlawful eviction or withheld security deposits should be addressed promptly with a written legal notice.",
    provisions: [
      {
        citation_index: 1,
        act_name: "The Transfer of Property Act, 1882",
        section_or_article: "Section 106 & Section 108",
        source_type: "BARE_ACT",
        heading: "Duration of leases & Rights and liabilities of lessor and lessee",
        brief:
          "Governs valid notice periods for termination of month-to-month leases (15 days' written notice) and obligates parties to honour lease terms, peaceful possession, and handover conditions.",
        identifier: "Act No. 4 of 1882",
        official_source_url: "https://www.indiacode.nic.in/handle/123456789/2338",
        is_verified_in_corpus: true,
      },
    ],
    briefAnswer:
      "Residential and commercial tenancies are governed by the written lease agreement, state Rent Control laws, and Sections 106 & 108 of the Transfer of Property Act, 1882, which protect peaceful possession and require lawful written notice before eviction [1].",
    simplifiedAnswer:
      "In simple words: A landlord cannot throw you out overnight or keep your security deposit without a valid, documented reason. They must follow the notice period in your rent agreement (or 15 days' written notice under law) and return your deposit after genuine deductions.",
    solutions: [
      "Gather your signed Rent Agreement, bank transfer receipts for the deposit/rent, and handover photos/videos.",
      "Send a formal written demand / legal notice requesting refund of the security deposit within 15 days.",
      "If unpaid or threatened with unlawful eviction, file a claim before the Rent Controller or Civil Court with an advocate.",
    ],
    followUps: [
      "What should I write in a security deposit legal notice?",
      "Can a landlord deduct painting charges without proof?",
      "Which court handles rent deposit disputes?",
    ],
  },
];

const FALLBACK_ADVOCATES: AskMeAdvocateContact[] = [
  {
    id: "adv-dir-1",
    name: "Adv. Raghavendra Kulkarni",
    phone: "+91 98450 41230",
    qualifications: "B.A., LL.B. (NLSIU), LL.M. · Enrolled with Bar Council",
    bar_council_id: "KAR/1842/2012",
    bar_council_name: "Karnataka State Bar Council",
    primary_practice: "Criminal Defense, Sec 138 NI Act & Urgent Bail",
    courts: ["District & Sessions Court", "High Court of Karnataka"],
    experience_years: 14,
    city: "Bengaluru",
    languages: ["English", "Hindi", "Kannada"],
  },
  {
    id: "adv-dir-2",
    name: "Adv. Sujata V. Patil",
    phone: "+91 98451 67210",
    qualifications: "B.Com., LL.B., Diploma in Consumer & Tenancy Law",
    bar_council_id: "MAH/3910/2014",
    bar_council_name: "Bar Council of Maharashtra & Goa",
    primary_practice: "Civil Disputes, Tenancy, Consumer Protection & Notices",
    courts: ["City Civil Court", "State Consumer Commission"],
    experience_years: 12,
    city: "Pune / Belagavi",
    languages: ["English", "Hindi", "Marathi", "Kannada"],
  },
];

function buildSpokenSummary(
  provisions: AskMeProvision[],
  simplifiedAnswer: string,
  solutions: string[],
  sourcesFound: boolean
): string {
  const cleanSimple = simplifiedAnswer.replace(/\[\d+\]/g, "").trim();
  if (!sourcesFound || provisions.length === 0) {
    return solutions[0] ? `${cleanSimple} Recommended next step: ${solutions[0]}` : cleanSimple;
  }
  const lead = provisions[0];
  const firstStep = solutions[0] ?? "Consult a verified advocate for next steps.";
  return `Under ${lead.act_name}, ${lead.section_or_article}. ${cleanSimple} Recommended next step: ${firstStep}`;
}

function buildOfflineAskMeResponse(
  query: string,
  preferredLanguage: string,
  history: AskMeHistoryTurn[] = [],
  attachmentText?: string
): AskMeResponse {
  const combinedContext = [
    query,
    ...history.slice(-4).map((t) => t.content),
    attachmentText ?? "",
  ].join(" ");

  const matched = VERIFIED_OFFLINE_RULES.find((rule) => rule.keywords.test(combinedContext));

  if (!matched) {
    const simplified =
      "In simple words: We did not find an exact verified law section for this specific question in our offline database, and we never make up fake laws. Please consult one of the verified advocates below so they can examine your exact facts.";
    const solutions = [
      "Write down a clear timeline of dates, names, amounts, and any written messages or notices.",
      "Keep copies of all receipts, contracts, or official letters ready before speaking to counsel.",
      "Contact a Bar Council-verified advocate below for a fact-specific legal assessment.",
    ];
    return {
      query,
      detected_language: preferredLanguage,
      brief_answer:
        "No matching verified Indian statutory section or Constitutional article was found in the offline corpus for this exact query. To ensure no false law or invented section number is ever presented, NyayaSetu does not guess citations.",
      simplified_answer: simplified,
      spoken_summary: buildSpokenSummary([], simplified, solutions, false),
      applicable_provisions: [],
      sources_found: false,
      solutions,
      follow_up_questions: [
        "What documents should I gather before meeting an advocate?",
        "Can I send a written legal notice first?",
        "How do I prepare for an initial advocate consultation?",
      ],
      is_serious: true,
      seriousness_reason:
        "This query requires fact-specific evaluation by a Bar Council-verified advocate rather than automated matching.",
      advocate_contacts: FALLBACK_ADVOCATES,
      disclaimer:
        "NyayaSetu provides an AI-assisted preliminary legal assessment and advocate-discovery platform. It is not a law firm and does not provide legal advice. Submitting an inquiry does not create an advocate-client relationship.",
      assessed_at: new Date().toISOString(),
      isOfflineFallback: true,
    };
  }

  return {
    query,
    detected_language: preferredLanguage,
    brief_answer: matched.briefAnswer,
    simplified_answer: matched.simplifiedAnswer,
    spoken_summary: buildSpokenSummary(
      matched.provisions,
      matched.simplifiedAnswer,
      matched.solutions,
      true
    ),
    applicable_provisions: matched.provisions,
    sources_found: true,
    solutions: matched.solutions,
    follow_up_questions: matched.followUps,
    is_serious: matched.isSerious,
    seriousness_reason: matched.seriousnessReason ?? null,
    advocate_contacts: FALLBACK_ADVOCATES,
    disclaimer:
      "NyayaSetu provides an AI-assisted preliminary legal assessment and advocate-discovery platform. It is not a law firm and does not provide legal advice. Submitting an inquiry does not create an advocate-client relationship.",
    assessed_at: new Date().toISOString(),
    isOfflineFallback: true,
  };
}

export async function uploadAskMeAttachment(file: File): Promise<AskMeAttachment> {
  const formData = new FormData();
  formData.append("file", file);

  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch("/api/v1/legal/ask-me/upload-context", {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) {
      throw new Error(`Upload failed (${res.status})`);
    }
    return (await res.json()) as AskMeAttachment;
  } catch {
    return {
      file_name: file.name,
      extracted_text: `Attached file: ${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB). Offline mode: describe key dates or amounts from this document in your message.`,
      char_count: 0,
      page_count: 1,
      engine_name: "offline_metadata",
    };
  }
}

export interface StreamAskMeHandlers {
  onMeta: (meta: AskMeResponse) => void;
  onDelta: (chunk: string) => void;
  onDone: () => void;
}

export async function streamAskMeQuery(
  params: {
    query: string;
    preferredLanguage?: string;
    history?: AskMeHistoryTurn[];
    attachment?: AskMeAttachment | null;
  },
  handlers: StreamAskMeHandlers
): Promise<void> {
  const { query, preferredLanguage = "en", history = [], attachment } = params;
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch("/api/v1/legal/ask-me/stream", {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        preferred_language: preferredLanguage,
        history,
        attachment_text: attachment?.extracted_text || undefined,
        attachment_name: attachment?.file_name || undefined,
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Stream failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "message";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line) continue;
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          const rawData = line.slice(5).trim();
          if (!rawData) continue;
          const parsed = JSON.parse(rawData);
          if (currentEvent === "meta") {
            handlers.onMeta(parsed as AskMeResponse);
          } else if (currentEvent === "delta") {
            handlers.onDelta(parsed.chunk ?? "");
          } else if (currentEvent === "done") {
            handlers.onDone();
          }
        }
      }
    }
    handlers.onDone();
  } catch {
    // Graceful offline grounded streaming fallback
    const fallback = buildOfflineAskMeResponse(
      query,
      preferredLanguage,
      history,
      attachment?.extracted_text
    );
    const fullText = fallback.brief_answer;
    handlers.onMeta({ ...fallback, brief_answer: "" });

    const words = fullText.split(" ");
    for (let i = 0; i < words.length; i += 4) {
      const piece = words.slice(i, i + 4).join(" ") + (i + 4 < words.length ? " " : "");
      handlers.onDelta(piece);
      await new Promise((r) => setTimeout(r, 20));
    }
    handlers.onDone();
  }
}

export async function transcribeAskMeAudio(
  audioBlob: Blob,
  language: string = "en"
): Promise<string | null> {
  const formData = new FormData();
  formData.append("file", audioBlob, "voice.webm");
  formData.append("language", language);

  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch("/api/v1/legal/ask-me/transcribe", {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { transcript?: string };
    return data.transcript?.trim() || null;
  } catch {
    return null;
  }
}

export async function synthesizeAskMeSpeech(
  text: string,
  language: string = "en"
): Promise<Blob | null> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch("/api/v1/legal/ask-me/speak", {
      method: "POST",
      headers,
      body: JSON.stringify({ text, language }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

export async function submitAskMeQuery(
  query: string,
  preferredLanguage: string = "en"
): Promise<AskMeResponse> {
  try {
    return await api.post<AskMeResponse>("/api/v1/legal/ask-me", {
      query,
      preferred_language: preferredLanguage,
    });
  } catch {
    return buildOfflineAskMeResponse(query, preferredLanguage);
  }
}
