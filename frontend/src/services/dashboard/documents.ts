import { api, getStoredToken } from "@/lib/api-client";
import { delay } from "./api";
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

export interface BackendScanResponse {
  document_id: string;
  status: string;
  text: string;
  confidence: number;
  low_confidence: boolean;
  ocr_engine: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  processing_error?: string | null;
  processed_at?: string | null;
}

export interface BackendExplanationResponse {
  document_id: string;
  document_type: string;
  summary: string;
  parties: string[];
  dates: Array<{ label: string; value: string }>;
  amounts: Array<{ label: string; value: string }>;
  obligations: string[];
  risks: string[];
  citations: Array<{
    source_title: string;
    source_type?: string;
    section_or_paragraph?: string;
    clause_heading?: string;
    official_source_url?: string;
  }>;
  sources_found: boolean;
  disclaimer: string;
  confidence: number;
  extracted_text_snippet?: string;
  created_at: string;
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
 * Optical document text extraction.
 * Uploads document to backend vault and processes via real PDF / OCR vision pipeline.
 */
export async function runOcr(fileOrName: File | string): Promise<OcrResult> {
  const token = getStoredToken();

  if (fileOrName instanceof File) {
    if (token && !token.startsWith("jwt_mock_")) {
      const formData = new FormData();
      formData.append("file", fileOrName);
      formData.append("document_category", "EVIDENCE");
      formData.append("is_confidential", "true");

      const res = await api.upload<BackendScanResponse>("/api/v1/documents/scan", formData);
      return {
        documentId: res.document_id,
        text: res.text,
        confidence: res.confidence,
        lowConfidence: res.low_confidence || res.confidence < 0.70,
        status: res.status,
        ocrEngine: res.ocr_engine,
        processingError: res.processing_error,
      };
    }
  }

  // Handle sample name string trigger if invoked without a real File object
  if (typeof fileOrName === "string") {
    if (token && !token.startsWith("jwt_mock_")) {
      const sampleBlob = new Blob([
        `LEGAL NOTICE\n\nTo, Mr. S. Rao, 402, Lake View Apartments, HSR Layout, Bengaluru 560102.\n\nUnder the terms of the lease dated 12 March 2024, the security deposit of Rs. 60,000 was payable within 15 days of handover. Our client vacated the premises on 15 September 2026 and returned all keys. Despite reminders, the amount has not been refunded.\n\nYou are called upon to pay Rs. 60,000 within 15 days of this notice, failing which legal proceedings will be initiated.\n\nDated: 2 October 2026\nIssued by: M/s Rao & Associates`
      ], { type: "text/plain" });
      const sampleFile = new File([sampleBlob], fileOrName.endsWith(".txt") ? fileOrName : `${fileOrName}.txt`, { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", sampleFile);
      formData.append("document_category", "EVIDENCE");

      try {
        const res = await api.upload<BackendScanResponse>("/api/v1/documents/scan", formData);
        return {
          documentId: res.document_id,
          text: res.text,
          confidence: res.confidence,
          lowConfidence: res.low_confidence || res.confidence < 0.70,
          status: res.status,
          ocrEngine: res.ocr_engine,
          processingError: res.processing_error,
        };
      } catch {
        // Fallback for offline mode
      }
    }
  }

  // Fallback when unauthenticated
  await delay(500);
  return {
    text: "",
    confidence: 0.0,
    lowConfidence: true,
    status: "failed",
    processingError: "Authentication required to scan and process document.",
  };
}

/**
 * Grounded legal document explanation using uploaded document ID and verified statutory RAG.
 */
export async function explainDocument(
  textOrDocId: string,
  explicitDocId?: string,
): Promise<DocumentExplanation> {
  const token = getStoredToken();
  const docId = explicitDocId || (textOrDocId.length === 36 && textOrDocId.includes("-") ? textOrDocId : undefined);

  if (docId && token && !token.startsWith("jwt_mock_")) {
    const res = await api.post<BackendExplanationResponse>(`/api/v1/documents/${docId}/explain`);
    return {
      documentId: res.document_id,
      documentType: res.document_type,
      summary: res.summary,
      parties: res.parties,
      dates: res.dates,
      amounts: res.amounts,
      obligations: res.obligations,
      risks: res.risks,
      citations: res.citations,
      sourcesFound: res.sources_found,
      disclaimer: res.disclaimer,
    };
  }

  // If no document ID exists or unauthenticated
  throw new Error("Unable to explain document: Valid document ID and authenticated session required.");
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
