import { api } from "@/lib/api-client";
import type { Consent } from "@/types/dashboard";

interface BackendConsent {
  id: string;
  user_id: string;
  consent_type: string;
  version: string;
  purpose: string;
  action: string;
  advocate_id?: string | null;
  items_shared?: string[] | null;
  is_revoked: boolean;
  revoked_at?: string | null;
  created_at: string;
}

interface ConsentStatusResponse {
  consents: BackendConsent[];
  active_count: number;
  revoked_count: number;
  dpdp_notice: string;
}

function mapBackendConsent(b: BackendConsent): Consent {
  return {
    id: b.id,
    userId: b.user_id,
    consentType: b.consent_type as Consent["consentType"],
    version: b.version,
    grantedAt: b.created_at,
    revoked: b.is_revoked,
    purpose: b.purpose,
    advocateId: b.advocate_id ?? undefined,
    itemsShared: b.items_shared ?? undefined,
  };
}

/**
 * Fetch authoritative DPDP consent records from the real backend.
 * LocalStorage is NOT used as the source of truth.
 */
export async function listConsents(): Promise<Consent[]> {
  try {
    const res = await api.get<ConsentStatusResponse>("/api/v1/users/me/consents");
    if (res && Array.isArray(res.consents)) {
      return res.consents.map(mapBackendConsent);
    }
    return [];
  } catch (err) {
    console.error("Failed to load DPDP consents from backend:", err);
    return [];
  }
}

/**
 * Record a statutory explicit consent grant in the backend audit ledger.
 */
export async function saveConsent(
  consent: Omit<Consent, "id" | "grantedAt" | "revoked">
): Promise<Consent> {
  const res = await api.post<BackendConsent>("/api/v1/users/me/consents", {
    consent_type: consent.consentType,
    version: consent.version || "1.0",
    purpose: consent.purpose || `Statutory authorization for ${consent.consentType}`,
    advocate_id: consent.advocateId,
    items_shared: consent.itemsShared,
  });
  return mapBackendConsent(res);
}

/**
 * Revoke an existing DPDP consent authorization.
 */
export async function revokeConsent(id: string): Promise<Consent[]> {
  await api.post(`/api/v1/users/me/consents/${id}/withdraw`, {});
  return listConsents();
}

const labels: Record<Consent["consentType"], string> = {
  terms: "Terms of Use & Service Agreement",
  privacy: "Privacy Policy & Data Processing Notice",
  dpdp: "DPDP Act Statutory Data Consent",
  share_brief: "Authorized Case Brief Transmission",
  share_documents: "Restricted Evidence Vault Access",
};

export const consentLabel = (type: Consent["consentType"]) =>
  labels[type] || "Statutory Legal Authorization";
