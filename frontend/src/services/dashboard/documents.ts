import { api, getStoredToken } from "@/lib/api-client";
import { DISCLAIMER, delay } from "./api";
import { dateOnly, documents as mockDocuments, documentShares, accessLogs } from "@/data/dashboard-mock-data";
import type { AccessLog, DocumentExplanation, DocumentShare, OcrResult, VaultDocument } from "@/types/dashboard";

export interface BackendDocumentResponse {
  id: string;
  case_id: string;
  uploaded_by_id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  document_category: string;
  sha256_hash: string;
  is_confidential: boolean;
  created_at: string;
}

export interface BackendDocumentDownloadTokenResponse {
  document_id: string;
  access_token: string;
  expires_in_seconds: number;
  download_url: string;
}

/**
 * Storage and Document Management Service
 * Connected to FastAPI Document Module (/api/v1/documents)
 */
export const storage = {
  async upload(file: File, caseId = "00000000-0000-0000-0000-000000000001"): Promise<{ id: string }> {
    const token = getStoredToken();
    if (token && !token.startsWith("jwt_mock_")) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("document_category", "EVIDENCE");
        formData.append("is_confidential", "true");

        const res = await api.upload<BackendDocumentResponse>(
          `/api/v1/documents/cases/${caseId}/upload`,
          formData,
        );
        return { id: res.id };
      } catch {
        // Fallback to local storage simulation
      }
    }

    await delay(500);
    return { id: `doc_${Date.now()}_${file.name.slice(0, 6)}` };
  },

  async getSignedUrl(documentId: string): Promise<string> {
    const token = getStoredToken();
    if (token && !token.startsWith("jwt_mock_")) {
      try {
        const res = await api.get<BackendDocumentDownloadTokenResponse>(
          `/api/v1/documents/${documentId}/access-token`,
        );
        return res.download_url;
      } catch {
        // Fallback
      }
    }
    const fakeToken = btoa(`${documentId}:${Date.now() + 300 * 1000}`);
    return `/api/v1/documents/${documentId}/download?token=${fakeToken}`;
  },

  signedUrl(documentId: string, seconds = 300): string {
    const fakeToken = btoa(`${documentId}:${Date.now() + seconds * 1000}`);
    return `/api/v1/documents/${documentId}/download?token=${fakeToken}`;
  },
};

export const signedUrl = storage.signedUrl;

/**
 * Client-side preview OCR simulation.
 * Note: Explicitly flagged in UI as preview mode pending dedicated backend vision OCR pipeline.
 */
export async function runOcr(fileName: string): Promise<OcrResult> {
  await delay(1000);
  const lowConfidence = /blur|photo|scan|receipt/i.test(fileName);
  return {
    text:
      "LEGAL NOTICE\n\nTo, Mr. S. Rao, 402, Lake View Apartments, HSR Layout, Bengaluru 560102.\n\nUnder the terms of the lease dated 12 March 2024, the security deposit of Rs. 60,000 was payable within 15 days of handover. Our client vacated the premises on 15 September 2026 and returned all keys. Despite reminders, the amount has not been refunded.\n\nYou are called upon to pay Rs. 60,000 within 15 days of this notice, failing which legal proceedings will be initiated.\n\nDated: 2 October 2026\nIssued by: M/s Rao & Associates",
    confidence: lowConfidence ? 0.61 : 0.93,
    lowConfidence,
  };
}

export async function explainDocument(text: string): Promise<DocumentExplanation> {
  void text;
  await delay(800);
  return {
    documentType: "Legal notice (demand for refund of security deposit)",
    summary:
      "This is a formal demand sent to a landlord asking for a ₹60,000 security deposit to be returned. It states the tenant vacated the premises, returned the keys, and the deposit was withheld without lawful deduction. Gives a 15-day statutory reply window.",
    parties: ["Mr. S. Rao — recipient (landlord)", "Rahul Kumar — tenant (you)", "M/s Rao & Associates — issuing advocates"],
    dates: [
      { label: "Lease date", value: "12 March 2024" },
      { label: "Handover date", value: "15 September 2026" },
      { label: "Notice date", value: "2 October 2026" },
      { label: "Payment deadline", value: "17 October 2026 (15 days from notice)" },
    ],
    amounts: [{ label: "Security deposit claimed", value: "₹60,000" }],
    obligations: [
      "Pay ₹60,000 within 15 days of the notice date.",
      "Reply in writing to the issuing advocates if you dispute the claim.",
    ],
    risks: [
      "If the deadline passes without payment or reply, a civil claim may follow.",
      "Late reply can weaken your position, so respond before the deadline.",
      "The notice mentions only paint damage — ask for the inspection report if you dispute it.",
    ],
    disclaimer: DISCLAIMER,
  };
}

export async function listDocuments(): Promise<VaultDocument[]> {
  await delay(300);
  return mockDocuments;
}

export async function getAccessLogs(documentId: string): Promise<AccessLog[]> {
  await delay(200);
  return accessLogs.filter((l) => l.documentId === documentId);
}

export async function getShares(documentId: string): Promise<DocumentShare[]> {
  await delay(150);
  return documentShares.filter((s) => s.documentId === documentId);
}

export async function createShare(
  documentId: string,
  advocateId: string,
  advocateName: string,
  days: number,
) {
  await delay(400);
  return {
    id: `shr_${Date.now()}`,
    documentId,
    advocateId,
    advocateName,
    expiresAt: dateOnly(days),
    revoked: false,
  } satisfies DocumentShare;
}

export async function sendMockSms(to: string, body: string) {
  await delay(150);
  console.info("[sms-dispatch]", { to, body });
  return { sent: true };
}
