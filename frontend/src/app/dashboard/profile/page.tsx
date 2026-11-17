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
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { consentLabel, listConsents, revokeConsent } from "@/services/dashboard/consent";
import { deleteAccount, downloadMyData } from "@/services/dashboard/auth";
import { languageLabels } from "@/data/dashboard-mock-data";
import { formatDate, formatDateTime } from "@/lib/dashboard-utils";
import type { Consent, Language } from "@/types/dashboard";
import { Button, Card, Badge, Input, Field, Modal, Avatar } from "@/components/dashboard/ui";
import { PageHeader, Disclaimer } from "@/components/dashboard/shared";

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, updateUser, setLanguage } = useAuth();
  const language = user?.language ?? "en";
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [saved, setSaved] = useState(false);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Consent | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => setConsents(listConsents()));
  }, []);

  const save = () => {
    updateUser({ name, email, city });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const changeLanguage = (lang: Language) => {
    setLanguage(lang);
  };

  const revoke = async (id: string) => {
    const next = await revokeConsent(id);
    setConsents(next);
  };

  return (
    <div className="animate-fade">
      <PageHeader
        eyebrow="Profile & privacy"
        title="Your account"
        subtitle="Manage your details, language, consents and data. You stay in control of what is shared."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              logout();
              router.push("/login");
            }}
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* Profile */}
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar initials={(user?.name ?? "R K").split(" ").map((n) => n[0]).slice(0, 2).join("")} size="lg" />
              <div>
                <h2 className="text-[15px] font-bold">{user?.name ?? "Rahul Kumar"}</h2>
                <p className="text-[11.5px] text-body">{user?.phone} · Member since {user ? formatDate(user.createdAt, { month: "short", year: "numeric" }) : "—"}</p>
              </div>
              <Badge tone="mint" className="ml-auto"><ShieldCheck className="size-3" /> Verified number</Badge>
            </div>

            <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
              <Field label="Full name" htmlFor="name">
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Mobile number" htmlFor="phone" hint="Used for OTP sign-in. Contact support to change.">
                <div className="relative">
                  <Phone className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
                  <Input id="phone" value={user?.phone ?? ""} disabled className="pl-9" />
                </div>
              </Field>
              <Field label="Email" htmlFor="email">
                <div className="relative">
                  <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" />
                </div>
              </Field>
              <Field label="City" htmlFor="city">
                <div className="relative">
                  <MapPin className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="pl-9" />
                </div>
              </Field>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button size="sm" onClick={save}>Save changes</Button>
              {saved && <span className="flex items-center gap-1 text-[11.5px] font-semibold text-dot"><Check className="size-3.5" aria-hidden /> Saved</span>}
            </div>
          </Card>

          {/* Language */}
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Globe2 className="size-4 text-brand" aria-hidden />
              <h2 className="text-[14px] font-bold">Language</h2>
            </div>
            <p className="mt-1 text-[11.5px] text-body">Changes the app, AI answers and notifications. Documents may need separate translation.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(Object.keys(languageLabels) as Language[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => changeLanguage(l)}
                  className={`flex h-11 cursor-pointer items-center justify-between rounded-xl border px-3.5 text-[12.5px] font-semibold transition ${
                    language === l ? "border-brand bg-brand-soft text-brand-dark ring-4 ring-brand/10" : "border-line text-body hover:border-brand/40"
                  }`}
                >
                  {languageLabels[l]}
                  {language === l && <Check className="size-4" aria-hidden />}
                </button>
              ))}
            </div>
          </Card>

          {/* Consent history */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[14px] font-bold">
                <ShieldCheck className="size-4 text-brand" aria-hidden /> Consent history
              </h2>
              <span className="text-[10.5px] text-muted">Every grant is versioned and timestamped</span>
            </div>
            <div className="mt-3 divide-y divide-line">
              {consents.map((c) => (
                <div key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-ink">{consentLabel(c.consentType)}</p>
                    <p className="mt-0.5 text-[10.5px] text-muted">
                      Version {c.version} · {formatDateTime(c.grantedAt)}
                      {c.advocateId && " · Advocate " + c.advocateId}
                    </p>
                    {c.itemsShared && (
                      <p className="mt-0.5 text-[10px] text-muted">Shared: {c.itemsShared.join(", ")}</p>
                    )}
                  </div>
                  {c.revoked ? (
                    <Badge tone="neutral">Revoked</Badge>
                  ) : (
                    <button type="button" onClick={() => setRevokeTarget(c)} className="cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold text-danger hover:bg-danger-soft">
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="flex items-center gap-1.5 text-[13.5px] font-bold">
              <Download className="size-4 text-brand" aria-hidden /> Your data
            </h2>
            <p className="mt-1 text-[11px] leading-5 text-body">
              Download a JSON copy of your profile, consents and account data. In production this is generated
              server-side and expires after 24 hours.
            </p>
            <Button
              variant="secondary"
              fullWidth
              className="mt-3"
              loading={exporting}
              onClick={async () => {
                setExporting(true);
                await downloadMyData();
                setExporting(false);
              }}
            >
              <Download className="size-4" aria-hidden /> Download my data
            </Button>
          </Card>

          <Card className="border-danger/20 p-5">
            <h2 className="flex items-center gap-1.5 text-[13.5px] font-bold text-danger">
              <Trash2 className="size-4" aria-hidden /> Delete my account
            </h2>
            <p className="mt-1 text-[11px] leading-5 text-body">
              Soft-deletes your account and starts the retention process. Active bookings must be closed first.
            </p>
            <Button variant="danger" fullWidth className="mt-3" onClick={() => setConfirmDelete(true)}>
              Delete account
            </Button>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-1.5 text-[13.5px] font-bold">
              <UserRound className="size-4 text-brand" aria-hidden /> Grievance officer
            </h2>
            <p className="mt-1.5 text-[11px] leading-5 text-body">
              For complaints about content, privacy or an advocate:
            </p>
            <div className="mt-2 space-y-1 text-[11.5px]">
              <p className="font-semibold text-ink">Ms. Nandini Rao</p>
              <p className="text-body">Grievance Officer, Legal</p>
              <a href="mailto:grievance@legal.in" className="block text-brand hover:underline">grievance@legal.in</a>
              <p className="text-muted">Response within 15 days, as required under the IT Rules.</p>
            </div>
          </Card>

          <Disclaimer variant="banner" text="Legal information only. Not legal advice. Consent records are stored with version and timestamp." />
        </aside>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete your account?"
        description="This is a soft delete in the demo. Your case data becomes inaccessible immediately."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={async () => {
                setDeleting(true);
                await deleteAccount();
                logout();
                setDeleting(false);
                router.push("/login");
              }}
            >
              <Trash2 className="size-4" aria-hidden /> Delete my account
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-2.5 rounded-xl bg-danger-soft p-3.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <p className="text-[12px] leading-5 text-danger">
            This removes access to your chats, case profiles, documents and bookings. Data required for legal or audit
            obligations may be retained in a restricted archive. This cannot be undone from the app.
          </p>
        </div>
      </Modal>

      <Modal
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        size="sm"
        title="Revoke this consent?"
        description={revokeTarget ? consentLabel(revokeTarget.consentType) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!revokeTarget) return;
                void revoke(revokeTarget.id);
                setRevokeTarget(null);
              }}
            >
              Revoke consent
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-6 text-body">
          Access that depends on this consent stops immediately. The consent history keeps the original
          grant with a timestamp so you can see what was shared and when.
        </p>
      </Modal>
    </div>
  );
}
