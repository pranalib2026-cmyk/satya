"use client";

import { useMemo, useState } from "react";
import {
  Clock,
  Download,
  Eye,
  FileImage,
  FileText,
  FolderOpen,
  Link2,
  Lock,
  Pencil,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { accessLogs, advocates, documents as seedDocs, documentShares } from "@/data/dashboard-mock-data";
import type { AccessLog, DocumentShare, VaultDocument } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime } from "@/lib/dashboard-utils";
import { signedUrl } from "@/services/dashboard/documents";
import { Badge, Button, Chip, EmptyState, Input, Modal, Select, Tabs } from "@/components/dashboard/ui";
import { PageHeader } from "@/components/dashboard/shared";

export default function VaultPage() {
  const [docs, setDocs] = useState<VaultDocument[]>(seedDocs);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("all");
  const [active, setActive] = useState<VaultDocument | null>(null);
  const [detailTab, setDetailTab] = useState<"details" | "access" | "shares">("details");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDays, setShareDays] = useState("7");
  const [shareAdvocate, setShareAdvocate] = useState(advocates[0].id);
  const [shares, setShares] = useState<DocumentShare[]>(documentShares);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadCase, setUploadCase] = useState("case_2041");
  const [link, setLink] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<DocumentShare | null>(null);

  const tags = useMemo(() => ["all", ...new Set(docs.flatMap((d) => d.tags))], [docs]);
  const filtered = docs.filter(
    (d) =>
      (tag === "all" || d.tags.includes(tag)) &&
      (d.name.toLowerCase().includes(query.toLowerCase()) || d.caseTitle.toLowerCase().includes(query.toLowerCase()))
  );
  const grouped = useMemo(() => {
    const map = new Map<string, VaultDocument[]>();
    filtered.forEach((d) => map.set(d.caseTitle, [...(map.get(d.caseTitle) ?? []), d]));
    return [...map.entries()];
  }, [filtered]);

  const activeShares = active ? shares.filter((s) => s.documentId === active.id) : [];
  const activeLogs = active ? accessLogs.filter((l) => l.documentId === active.id) : [];

  const createShare = () => {
    if (!active) return;
    const adv = advocates.find((a) => a.id === shareAdvocate)!;
    const expires = new Date();
    expires.setDate(expires.getDate() + Number(shareDays));
    setShares((s) => [
      {
        id: `shr_${Date.now()}`,
        documentId: active.id,
        advocateId: adv.id,
        advocateName: adv.name,
        expiresAt: expires.toISOString().slice(0, 10),
        revoked: false,
      },
      ...s,
    ]);
    setShareOpen(false);
  };

  const confirmDelete = () => {
    if (!active) return;
    setDocs((all) => all.filter((x) => x.id !== active.id));
    setShares((all) => all.filter((s) => s.documentId !== active.id));
    setDeleteOpen(false);
    setActive(null);
  };

  const confirmRevoke = () => {
    if (!revokeTarget) return;
    setShares((all) => all.map((x) => (x.id === revokeTarget.id ? { ...x, revoked: true } : x)));
    setRevokeTarget(null);
  };

  const upload = () => {
    if (!uploadName.trim()) return;
    const newDoc: VaultDocument = {
      id: `doc_${Date.now()}`,
      caseId: uploadCase,
      caseTitle: uploadCase === "case_2041" ? "Security deposit — HSR Layout" : "Cheque bounce — ₹1,20,000",
      name: uploadName.trim(),
      type: /\.pdf$/i.test(uploadName) ? "pdf" : "image",
      sizeLabel: "1.2 MB",
      tags: ["new"],
      uploadedAt: new Date().toISOString(),
      ocrConfidence: 0.9,
      thumbnailTone: "bg-brand-soft",
      sharedWith: [],
    };
    setDocs((d) => [newDoc, ...d]);
    setUploadOpen(false);
    setUploadName("");
  };

  const docIcon = (d: VaultDocument) =>
    d.type === "pdf" ? <FileText className="size-5" /> : <FileImage className="size-5" />;

  return (
    <div className="space-y-6 animate-fade">
      <PageHeader
        eyebrow="Privacy & DPDP Act, 2023"
        title="Encrypted Legal Document Vault"
        subtitle="All client documents are encrypted at rest with time-delimited advocate access grants and immutable consent audit logs."
        actions={
          <Button variant="compound" size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="size-3.5 mr-1" aria-hidden /> Upload Document
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-3 shadow-[0_1px_2px_rgba(42,28,18,0.04)] flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#85725f]" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents by matter title or file keyword…"
            className="pl-9 h-10 text-xs"
            aria-label="Search documents"
          />
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            size="sm"
            value={view}
            onChange={(v) => setView(v as "grid" | "list")}
            options={[
              { value: "grid", label: "Grid View" },
              { value: "list", label: "Ledger View" },
            ]}
          />
        </div>
      </div>

      {/* Tags Filter Chips */}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <Chip key={t} active={tag === t} onClick={() => setTag(t)}>
            {t === "all" ? `All Documents (${docs.length})` : `#${t}`}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="size-5 text-[#9a6a35]" />}
          title="No Documents Match Filter"
          body="Try adjusting your search query or upload a new court paper."
          action={<Button variant="primary" size="sm" onClick={() => setUploadOpen(true)}>Upload Document</Button>}
        />
      ) : (
        <div className="space-y-7">
          {grouped.map(([caseTitle, items]) => (
            <section key={caseTitle} className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#e2d5c1]/60">
                <h2 className="flex items-center gap-2 font-serif text-[18px] sm:text-[20px] font-normal text-[#2a1c12]">
                  <FolderOpen className="size-4 text-[#9a6a35]" aria-hidden />
                  {caseTitle}
                  <span className="font-mono text-xs text-[#85725f] px-1.5 py-0.2 rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/40">
                    {items.length} Files
                  </span>
                </h2>
                <span className="text-[11px] font-mono text-[#85725f] uppercase tracking-[0.08em]">
                  Encrypted at rest · AES-256
                </span>
              </div>

              <div className={cn(view === "grid" ? "grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3" : "space-y-2")}>
                {items.map((d) => (
                  <div
                    key={d.id}
                    className={cn(
                      "group rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] cursor-pointer transition-all duration-150 hover:border-[#cfbe9e] shadow-[0_1px_2px_rgba(42,28,18,0.04)]",
                      view === "grid" ? "relative p-4 sm:p-5" : "flex items-center gap-4 p-3.5"
                    )}
                    onClick={() => {
                      setActive(d);
                      setDetailTab("details");
                      setRenaming(false);
                      setLink("");
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setActive(d)}
                  >
                    <div className={cn("flex items-start gap-3", view === "grid" && "flex-col")}>
                      <span className="grid size-10 shrink-0 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/50 text-[#9a6a35]">
                        {docIcon(d)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs sm:text-[13px] font-semibold text-[#2a1c12]">{d.name}</p>
                        <p className="mt-0.5 text-[11px] font-mono text-[#85725f]">
                          {d.sizeLabel} · {formatDate(d.uploadedAt)} {d.pages ? `· ${d.pages} pages` : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {d.tags.map((t) => (
                            <span key={t} className="rounded-[1px] border border-[#e2d5c1] bg-[#ebe1d1]/40 px-1.5 py-0.2 text-[9.5px] font-mono text-[#5b4a3b]">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={cn("flex shrink-0 gap-0.5", view === "grid" && "absolute top-3 right-3")}>
                        <button
                          type="button"
                          className="grid size-7 place-items-center rounded-[2px] text-[#85725f] hover:bg-[#ebe1d1]/50 hover:text-[#2a1c12]"
                          aria-label={`Preview ${d.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActive(d);
                            setDetailTab("details");
                          }}
                        >
                          <Eye className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Details Modal */}
      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.name ?? ""}
        description={active ? `${active.caseTitle} · ${active.sizeLabel}` : undefined}
        size="lg"
        footer={
          active && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLink(signedUrl(active.id));
                }}
              >
                <Link2 className="size-3.5 mr-1" aria-hidden /> Temporary Signed Access Link
              </Button>
              <Button size="sm" variant="primary" onClick={() => setShareOpen(true)}>
                <Share2 className="size-3.5 mr-1" aria-hidden /> Share with Verified Advocate
              </Button>
            </div>
          )
        }
      >
        {active && (
          <div className="space-y-4">
            <div className="flex gap-2 border-b border-[#e2d5c1] pb-3">
              {(["details", "access", "shares"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDetailTab(t)}
                  className={cn(
                    "rounded-[2px] px-3 py-1.5 text-xs font-sans uppercase tracking-[0.08em] font-medium transition cursor-pointer",
                    detailTab === t ? "bg-[#2a1c12] text-[#fffaf2]" : "text-[#5b4a3b] hover:bg-[#ebe1d1]/40"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {detailTab === "details" && (
              <div className="space-y-4 pt-2 text-xs">
                <div className="flex items-center gap-4">
                  <span className="grid size-14 place-items-center rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/50 text-[#9a6a35]">
                    {docIcon(active)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#2a1c12]">{active.name}</p>
                    <p className="mt-0.5 text-[#85725f] font-mono">Uploaded {formatDate(active.uploadedAt)} · {active.sizeLabel}</p>
                    <div className="mt-1.5 flex gap-1">
                      {active.tags.map((t) => (
                        <Badge key={t} tone="neutral">#{t}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 p-3">
                    <p className="text-[10px] font-sans uppercase tracking-[0.12em] text-[#85725f] font-semibold">OCR Legal Extraction</p>
                    <p className="mt-0.5 text-sm font-mono font-semibold text-[#2a1c12]">{Math.round((active.ocrConfidence ?? 0.9) * 100)}% Confidence</p>
                  </div>
                  <div className="rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 p-3">
                    <p className="text-[10px] font-sans uppercase tracking-[0.12em] text-[#85725f] font-semibold">Permission Status</p>
                    <p className="mt-0.5 flex items-center gap-1 font-semibold text-[#2a1c12]">
                      <Lock className="size-3 text-[#2e7d32]" aria-hidden /> Private · {activeShares.filter((s) => !s.revoked).length} Active Grant(s)
                    </p>
                  </div>
                </div>

                {renaming ? (
                  <div className="flex gap-2">
                    <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder="New document title" className="text-xs" />
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setDocs((all) => all.map((x) => (x.id === active.id ? { ...x, name: renameValue || x.name } : x)));
                        setActive({ ...active, name: renameValue || active.name });
                        setRenaming(false);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="secondary" onClick={() => { setRenameValue(active.name); setRenaming(true); }}>
                      <Pencil className="size-3.5 mr-1" aria-hidden /> Rename
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setLink(signedUrl(active.id))}>
                      <Download className="size-3.5 mr-1" aria-hidden /> Download Local Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="size-3.5 mr-1" aria-hidden /> Delete
                    </Button>
                  </div>
                )}

                {link && (
                  <div className="rounded-[2px] border border-[#e2d5c1] bg-[#dceada]/50 p-3 space-y-1">
                    <p className="text-xs font-semibold text-[#1e5623]">Ephemeral Signed Download Link (Valid for 5 Minutes)</p>
                    <code className="block break-all font-mono text-[11px] leading-relaxed text-[#2a1c12]">{link}</code>
                  </div>
                )}
              </div>
            )}

            {detailTab === "access" && (
              <div className="pt-2 space-y-3 text-xs">
                <p className="flex items-center gap-1.5 text-[#85725f]">
                  <Clock className="size-3.5 text-[#9a6a35]" aria-hidden />
                  DPDP Act compliant immutable access log. Every download and inspection event is recorded.
                </p>
                <div className="space-y-2 divide-y divide-[#e2d5c1]/60">
                  {(activeLogs as AccessLog[]).length === 0 && <p className="text-[#5b4a3b]">No inspection logged yet.</p>}
                  {activeLogs.map((l) => (
                    <div key={l.id} className="pt-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#2a1c12]">{l.actor} <span className="font-normal text-[#85725f]">({l.role})</span></p>
                        <p className="text-[11.5px] text-[#5b4a3b]">{l.action}</p>
                      </div>
                      <span className="font-mono text-[10.5px] text-[#85725f]">{formatDateTime(l.at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailTab === "shares" && (
              <div className="space-y-3 pt-2 text-xs">
                {activeShares.length === 0 && <p className="text-[#5b4a3b]">This file has not been shared with any advocate.</p>}
                {activeShares.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-[2px] border border-[#e2d5c1] bg-[#fffaf2] p-3">
                    <div>
                      <p className="font-semibold text-[#2a1c12]">Adv. {s.advocateName}</p>
                      <p className="font-mono text-[11px] text-[#85725f]">
                        {s.revoked ? "Access explicitly revoked" : `Expires on ${formatDate(s.expiresAt)}`}
                      </p>
                    </div>
                    {!s.revoked ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[#c0392b] hover:bg-[#fdf2f0]"
                        onClick={() => setRevokeTarget(s)}
                      >
                        <X className="size-3.5 mr-1" aria-hidden /> Revoke Access
                      </Button>
                    ) : (
                      <Badge tone="neutral">Revoked</Badge>
                    )}
                  </div>
                ))}
                <Button size="sm" variant="secondary" onClick={() => setShareOpen(true)}>
                  <Plus className="size-3.5 mr-1" aria-hidden /> Grant New Time-Limited Share
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Share Grant Modal */}
      <Modal
        open={shareOpen && Boolean(active)}
        onClose={() => setShareOpen(false)}
        title="Grant Time-Limited Advocate Access"
        description="Access is restricted strictly to this document and automatically expires upon deadline."
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShareOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={createShare}>
              <Share2 className="size-3.5 mr-1" aria-hidden /> Issue Signed Grant
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5 text-xs text-[#5b4a3b]">
          <div className="rounded-[2px] border border-[#e2d5c1] bg-[#ebe1d1]/30 p-3">
            <p className="text-[10px] font-sans uppercase tracking-[0.12em] text-[#85725f] font-semibold">Document Target</p>
            <p className="font-semibold text-[#2a1c12] text-xs mt-0.5">{active?.name}</p>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-sans uppercase tracking-[0.12em] font-medium text-[#5b4a3b]">Counsel Recipient</label>
            <Select value={shareAdvocate} onChange={(e) => setShareAdvocate(e.target.value)}>
              {advocates.filter((a) => a.verified).map((a) => (
                <option key={a.id} value={a.id}>Adv. {a.name} · {a.practiceAreas[0]}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-sans uppercase tracking-[0.12em] font-medium text-[#5b4a3b]">Access Duration</label>
            <Select value={shareDays} onChange={(e) => setShareDays(e.target.value)}>
              <option value="1">24 Hours (Preliminary Review)</option>
              <option value="7">7 Days (Consultation Scope)</option>
              <option value="14">14 Days (Pleading Drafting)</option>
              <option value="30">30 Days (Full Appearance Retainer)</option>
            </Select>
          </div>
          <p className="text-[11px] text-[#85725f] leading-relaxed pt-1">
            <ShieldCheck className="inline-block size-3.5 text-[#2e7d32] mr-1 align-text-bottom" aria-hidden />
            A statutory consent record under the DPDP Act will be archived with timestamp and cryptographic signature.
          </p>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteOpen && Boolean(active)}
        onClose={() => setDeleteOpen(false)}
        size="sm"
        title="Delete Document from Vault"
        description={active?.name}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button size="sm" variant="danger" onClick={confirmDelete}>
              <Trash2 className="size-3.5 mr-1" aria-hidden /> Confirm Permanent Deletion
            </Button>
          </div>
        }
      >
        <p className="text-xs text-[#5b4a3b] leading-relaxed">
          The document will be securely purged from vault storage. All active advocate download links will be permanently invalidated.
        </p>
      </Modal>

      {/* Revoke Confirmation Modal */}
      <Modal
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        size="sm"
        title="Revoke Advocate Access Immediately"
        description={revokeTarget ? `Adv. ${revokeTarget.advocateName}` : undefined}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRevokeTarget(null)}>Maintain Access</Button>
            <Button size="sm" variant="danger" onClick={confirmRevoke}>Revoke Access</Button>
          </div>
        }
      >
        <p className="text-xs text-[#5b4a3b] leading-relaxed">
          The advocate will no longer be able to open or download this file. Access tokens expire instantly.
        </p>
      </Modal>

      {/* Upload Modal */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload Document to Vault"
        description="Documents are stored with client-side isolation and encryption."
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={upload} disabled={!uploadName.trim()}>
              <Upload className="size-3.5 mr-1" aria-hidden /> Upload File
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-[2px] border-2 border-dashed border-[#e2d5c1] bg-[#ebe1d1]/30 px-4 py-8 text-center transition hover:border-[#9a6a35]">
            <Upload className="size-6 text-[#9a6a35]" aria-hidden />
            <span className="mt-2 text-xs font-semibold text-[#2a1c12]">Select Legal File</span>
            <span className="mt-0.5 text-[11px] text-[#85725f]">PDF, JPG, or PNG · Maximum 15 MB</span>
            <input
              type="file"
              className="hidden"
              onChange={(e) => setUploadName(e.target.files?.[0]?.name ?? "")}
            />
          </label>
          <div className="space-y-1">
            <label className="block text-xs font-sans uppercase tracking-[0.12em] font-medium text-[#5b4a3b]">Document Title</label>
            <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="e.g. Registered Tenancy Lease Agreement 2024.pdf" className="text-xs" />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-sans uppercase tracking-[0.12em] font-medium text-[#5b4a3b]">Associate with Matter</label>
            <Select value={uploadCase} onChange={(e) => setUploadCase(e.target.value)}>
              <option value="case_2041">Security deposit recovery — HSR Layout</option>
              <option value="case_2042">Cheque dishonour — NI Act ₹1,20,000</option>
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
