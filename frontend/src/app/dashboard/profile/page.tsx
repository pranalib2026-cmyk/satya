"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Download,
  Globe2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { consentLabel, listConsents, revokeConsent } from "@/services/dashboard/consent";
import { deleteAccount, downloadMyData } from "@/services/dashboard/auth";
import { languageLabels } from "@/data/dashboard-mock-data";
import { formatDate, formatDateTime } from "@/lib/dashboard-utils";
import type { Consent, Language } from "@/types/dashboard";
import { Button, Card, Badge, Input, Field, Modal, Avatar } from "@/components/dashboard/ui";
import { PageHeader, Disclaimer } from "@/components/dashboard/shared";

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, refreshProfile, setLanguage } = useAuth();
  const language = user?.language ?? "en";
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [prevUserId, setPrevUserId] = useState(user?.id);

  if (user && user.id !== prevUserId) {
    setPrevUserId(user.id);
    setName(user.name ?? "");
    setEmail(user.email ?? "");
    setCity(user.city ?? "");
  }

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [consents, setConsents] = useState<Consent[]>([]);
  const [loadingConsents, setLoadingConsents] = useState(true);

  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Consent | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;
    listConsents()
      .then((items) => {
        if (mounted) setConsents(items);
      })
      .catch((err) => {
        console.error("Failed to load DPDP consents", err);
      })
      .finally(() => {
        if (mounted) setLoadingConsents(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.put("/api/v1/users/me", {
        full_name: name.trim(),
        email: email.trim(),
        city: city.trim() || undefined,
      });
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update profile record.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const changeLanguage = async (lang: Language) => {
    setLanguage(lang);
    try {
      await api.put("/api/v1/users/me", { preferred_language: lang });
      await refreshProfile();
    } catch (err) {
      console.error("Failed to synchronize language preference with backend", err);
    }
  };

  const revoke = async (id: string) => {
    setRevoking(true);
    setError(null);
    try {
      const next = await revokeConsent(id);
      setConsents(next);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to revoke DPDP consent.";
      setError(msg);
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await downloadMyData();
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate statutory data export archive.";
      setError(msg);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount("CONFIRM_DELETE_NYAYASETU_ACCOUNT");
      logout();
      router.push("/login");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to purge citizen account.";
      setError(msg);
      setDeleting(false);
    }
  };

  return (
    <div className="animate-fade space-y-6">
      <PageHeader
        eyebrow="SECURITY & GOVERNANCE"
        title="Citizen Dossier & Privacy"
        subtitle="Manage your personal credentials, linguistic preferences, and DPDP consent authorizations."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              logout();
              router.push("/login");
            }}
          >
            <LogOut className="size-4" aria-hidden /> Terminate Session
          </Button>
        }
      />

      {error && (
        <div className="flex items-center justify-between rounded-[2px] border border-[#9a3424]/40 bg-[#fbf2ef] p-4 text-[#7a2517] animate-fade">
          <div className="flex items-center gap-3">
            <XCircle className="size-5 shrink-0 text-[#9a3424]" aria-hidden />
            <p className="text-[13px] font-medium">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="cursor-pointer text-[12px] font-mono uppercase tracking-wider text-[#9a3424] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Profile */}
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Avatar initials={(user?.name ?? "R K").split(" ").map((n) => n[0]).slice(0, 2).join("")} size="lg" />
              <div>
                <h2 className="font-serif text-[20px] font-normal text-[#2a1c12]">{user?.name ?? "Rahul Kumar"}</h2>
                <p className="font-mono text-[11px] text-[#85725f]">{user?.phone} · Enrolled since {user ? formatDate(user.createdAt, { month: "short", year: "numeric" }) : "—"}</p>
              </div>
              <Badge tone="mint" className="ml-auto"><ShieldCheck className="size-3" /> Aadhaar / Mobile Verified</Badge>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 pt-6 border-t border-[#e2d5c1]">
              <Field label="Full Legal Name" htmlFor="name">
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Primary Mobile Identifier" htmlFor="phone" hint="Bound to OTP authentication gateway.">
                <div className="relative">
                  <Phone className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#85725f]" aria-hidden />
                  <Input id="phone" value={user?.phone ?? ""} disabled className="pl-9 font-mono opacity-80" />
                </div>
              </Field>
              <Field label="Official Communication Email" htmlFor="email">
                <div className="relative">
                  <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#85725f]" aria-hidden />
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" />
                </div>
              </Field>
              <Field label="Jurisdictional City / District" htmlFor="city">
                <div className="relative">
                  <MapPin className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#85725f]" aria-hidden />
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="pl-9" />
                </div>
              </Field>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Button size="sm" onClick={save} loading={saving}>Update Dossier</Button>
              {saved && (
                <span className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-[#2a6b3b]">
                  <Check className="size-3.5" aria-hidden /> Updated & Synced
                </span>
              )}
            </div>
          </Card>

          {/* Language */}
          <Card className="p-6">
            <div className="flex items-center gap-2 border-b border-[#e2d5c1] pb-3">
              <Globe2 className="size-4 text-[#9a6a35]" aria-hidden />
              <h2 className="font-serif text-[18px] font-normal text-[#2a1c12]">Official Language Preference</h2>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#5b4a3b]">Governs statutory assessments, assistant explanations, and formal notices.</p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              {(Object.keys(languageLabels) as Language[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => changeLanguage(l)}
                  className={`flex h-11 cursor-pointer items-center justify-between rounded-[2px] border px-4 text-[13px] font-medium transition-colors ${
                    language === l ? "border-[#2a1c12] bg-[#2a1c12] text-[#fffaf2]" : "border-[#e2d5c1] bg-[#fffaf2] text-[#2a1c12] hover:border-[#9a6a35]"
                  }`}
                >
                  {languageLabels[l]}
                  {language === l && <Check className="size-4 text-[#d1a46a]" aria-hidden />}
                </button>
              ))}
            </div>
          </Card>

          {/* Consent history */}
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2d5c1] pb-3">
              <h2 className="flex items-center gap-2 font-serif text-[18px] font-normal text-[#2a1c12]">
                <ShieldCheck className="size-4 text-[#2a6b3b]" aria-hidden /> Digital Personal Data Protection (DPDP) Ledger
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#85725f]">Statutory Notice & Consent (§6)</span>
            </div>
            {loadingConsents ? (
              <div className="py-8 text-center font-mono text-[12px] text-[#85725f]">
                Synchronizing consent ledger from backend...
              </div>
            ) : consents.length === 0 ? (
              <div className="py-8 text-center font-mono text-[12px] text-[#85725f]">
                No explicit DPDP consent authorizations recorded.
              </div>
            ) : (
              <div className="mt-4 divide-y divide-[#e2d5c1]">
                {consents.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-[14px] font-normal text-[#2a1c12]">{consentLabel(c.consentType)}</p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[#85725f]">
                        Version {c.version} · {formatDateTime(c.grantedAt)}
                        {c.advocateId && " · Authorized Counsel: " + c.advocateId}
                      </p>
                      {c.purpose && (
                        <p className="mt-1 text-[11.5px] italic text-[#5b4a3b]">Purpose: {c.purpose}</p>
                      )}
                      {c.itemsShared && (
                        <p className="mt-1 text-[11px] text-[#5b4a3b]">Transmitted records: {c.itemsShared.join(", ")}</p>
                      )}
                    </div>
                    {c.revoked ? (
                      <Badge tone="neutral">WITHDRAWN</Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRevokeTarget(c)}
                        className="cursor-pointer rounded-[2px] border border-[#9a3424]/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-[#9a3424] hover:bg-[#fbf2ef] transition-colors"
                      >
                        Revoke Grant
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card className="p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Data Portability</p>
            <h2 className="mt-1 flex items-center gap-2 font-serif text-[16px] font-normal text-[#2a1c12]">
              <Download className="size-4 text-[#9a6a35]" aria-hidden /> Statutory Data Export
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[#5b4a3b]">
              Receive a cryptographically signed JSON archive of your personal dossier, DPDP grants, case filings, and court schedules under Indian data sovereignty mandates.
            </p>
            <Button
              variant="secondary"
              fullWidth
              className="mt-4"
              loading={exporting}
              onClick={handleExport}
            >
              <Download className="size-4" aria-hidden /> Request Signed Archive
            </Button>
            {exportSuccess && (
              <p className="mt-2 text-center font-mono text-[10.5px] font-medium text-[#2a6b3b]">
                ✓ Signed archive generated and downloaded.
              </p>
            )}
          </Card>

          <Card className="border-[#9a3424]/30 bg-[#fbf2ef]/40 p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#9a3424]">Right to Erasure</p>
            <h2 className="mt-1 flex items-center gap-2 font-serif text-[16px] font-normal text-[#9a3424]">
              <Trash2 className="size-4" aria-hidden /> Purge Citizen Account
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[#5b4a3b]">
              Initiates permanent removal of all personal records, active sessions, and DPDP authorizations in compliance with Section 12 of the DPDP Act.
            </p>
            <Button variant="danger" fullWidth className="mt-4" onClick={() => setConfirmDelete(true)}>
              Purge Account
            </Button>
          </Card>

          <Card className="p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#85725f]">Statutory Redressal</p>
            <h2 className="mt-1 flex items-center gap-2 font-serif text-[16px] font-normal text-[#2a1c12]">
              <UserRound className="size-4 text-[#9a6a35]" aria-hidden /> Grievance Officer
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[#5b4a3b]">
              Designated pursuant to IT (Intermediary Guidelines and Digital Media Ethics Code) Rules:
            </p>
            <div className="mt-3 space-y-1.5 text-[12px] rounded-[2px] border border-[#e2d5c1] bg-[#f4efe6] p-3.5">
              <p className="font-serif text-[14px] font-normal text-[#2a1c12]">Ms. Nandini Rao</p>
              <p className="text-[#5b4a3b]">Grievance Officer, NyayaSetu</p>
              <a href="mailto:grievance@nyayasetu.in" className="block font-mono text-[11px] text-[#9a6a35] underline hover:text-[#2a1c12]">grievance@nyayasetu.in</a>
              <p className="font-mono text-[10px] text-[#85725f]">Statutory resolution within 15 days.</p>
            </div>
          </Card>

          <Disclaimer variant="banner" text="NyayaSetu operates under Section 5 & 6 of the Digital Personal Data Protection Act, 2023. Notice and consent logs are maintained in an immutable backend ledger." />
        </aside>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Purge Citizen Records?"
        description="Irreversible operation under Section 12 of the DPDP Act."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={handleDeleteAccount}
            >
              <Trash2 className="size-4" aria-hidden /> Confirm Immediate Purge
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3 rounded-[2px] border border-[#9a3424]/30 bg-[#fbf2ef] p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#9a3424]" aria-hidden />
          <p className="text-[12.5px] leading-relaxed text-[#7a2517]">
            This operation severs access to active matters, stored legal notices, consultation transcripts, and advocate dispatches. In accordance with Section 12(3) of the DPDP Act and the Limitation Act 1963, active court proceedings and tax records are sealed in restricted statutory escrow while personal identifiers and active credentials are permanently purged.
          </p>
        </div>
      </Modal>

      <Modal
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        size="sm"
        title="Revoke DPDP Consent Grant?"
        description={revokeTarget ? consentLabel(revokeTarget.consentType) : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={revoking}
              onClick={() => {
                if (!revokeTarget) return;
                void revoke(revokeTarget.id);
              }}
            >
              Revoke Authorization
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-[#5b4a3b]">
          All external read permissions for this grant terminate immediately. The audit log preserves the original timestamped record verifying historical authorization and subsequent revocation pursuant to DPDP Section 6.
        </p>
      </Modal>
    </div>
  );
}
