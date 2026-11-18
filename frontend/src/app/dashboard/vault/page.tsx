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
  UserRound,
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
  const [docs, setDocs] = useState<VaultDocument[]>(seedDocs)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('all')
  const [active, setActive] = useState<VaultDocument | null>(null)
  const [detailTab, setDetailTab] = useState<'details' | 'access' | 'shares'>('details')
  const [shareOpen, setShareOpen] = useState(false)
  const [shareDays, setShareDays] = useState('7')
  const [shareAdvocate, setShareAdvocate] = useState(advocates[0].id)
  const [shares, setShares] = useState<DocumentShare[]>(documentShares)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [uploadCase, setUploadCase] = useState('case_2041')
  const [link, setLink] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<DocumentShare | null>(null)

  const tags = useMemo(() => ['all', ...new Set(docs.flatMap((d) => d.tags))], [docs])
  const filtered = docs.filter(
    (d) =>
      (tag === 'all' || d.tags.includes(tag)) &&
      (d.name.toLowerCase().includes(query.toLowerCase()) || d.caseTitle.toLowerCase().includes(query.toLowerCase())),
  )
  const grouped = useMemo(() => {
    const map = new Map<string, VaultDocument[]>()
    filtered.forEach((d) => map.set(d.caseTitle, [...(map.get(d.caseTitle) ?? []), d]))
    return [...map.entries()]
  }, [filtered])

  const activeShares = active ? shares.filter((s) => s.documentId === active.id) : []
  const activeLogs = active ? accessLogs.filter((l) => l.documentId === active.id) : []

  const createShare = () => {
    if (!active) return
    const adv = advocates.find((a) => a.id === shareAdvocate)!
    const expires = new Date()
    expires.setDate(expires.getDate() + Number(shareDays))
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
    ])
    setShareOpen(false)
  }

  const confirmDelete = () => {
    if (!active) return
    setDocs((all) => all.filter((x) => x.id !== active.id))
    setShares((all) => all.filter((s) => s.documentId !== active.id))
    setDeleteOpen(false)
    setActive(null)
  }

  const confirmRevoke = () => {
    if (!revokeTarget) return
    setShares((all) => all.map((x) => (x.id === revokeTarget.id ? { ...x, revoked: true } : x)))
    setRevokeTarget(null)
  }

  const upload = () => {
    if (!uploadName.trim()) return
    const newDoc: VaultDocument = {
      id: `doc_${Date.now()}`,
      caseId: uploadCase,
      caseTitle: uploadCase === 'case_2041' ? 'Security deposit — HSR Layout' : 'Cheque bounce — ₹1,20,000',
      name: uploadName.trim(),
      type: /\.pdf$/i.test(uploadName) ? 'pdf' : 'image',
      sizeLabel: '1.2 MB',
      tags: ['new'],
      uploadedAt: new Date().toISOString(),
      ocrConfidence: 0.9,
      thumbnailTone: 'bg-brand-soft',
      sharedWith: [],
    }
    setDocs((d) => [newDoc, ...d])
    setUploadOpen(false)
    setUploadName('')
  }

  const docIcon = (d: VaultDocument) =>
    d.type === 'pdf' ? <FileText className="size-5" /> : <FileImage className="size-5" />

  return (
    <div className="animate-fade">
      <PageHeader
        eyebrow="Document vault"
        title="Your files, grouped by case"
        subtitle="Every file is private by default. Sharing creates time-limited access for one advocate, and you can revoke it at any time."
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="size-4" aria-hidden /> Upload document
          </Button>
        }
      />

      <div className="card mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files or cases"
            className="pl-9"
            aria-label="Search documents"
          />
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'grid', label: 'Grid' },
              { value: 'list', label: 'List' },
            ]}
          />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <Chip key={t} active={tag === t} onClick={() => setTag(t)}>
            {t === 'all' ? `All files (${docs.length})` : `#${t}`}
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="size-5" />}
          title="No documents match"
          body="Try another tag or search term, or upload a new file."
          action={<Button onClick={() => setUploadOpen(true)}>Upload document</Button>}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([caseTitle, items]) => (
            <section key={caseTitle}>
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[13.5px] font-bold text-ink">
                  <FolderOpen className="size-4 text-brand" aria-hidden />
                  {caseTitle}
                  <span className="rounded-full bg-secondary-bg px-1.5 py-0.5 text-[10px] font-bold text-body">{items.length}</span>
                </h2>
                <span className="text-[10.5px] text-muted">Encrypted at rest</span>
              </div>

              <div className={cn(view === 'grid' ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-2')}>
                {items.map((d) => (
                  <div
                    key={d.id}
                    className={cn(
                      'group card cursor-pointer transition hover:border-brand/30 hover:shadow-pop',
                      view === 'grid' ? 'relative p-3.5' : 'flex items-center gap-3 p-3',
                    )}
                    onClick={() => {
                      setActive(d)
                      setDetailTab('details')
                      setRenaming(false)
                      setLink('')
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setActive(d)}
                  >
                    <div className={cn('flex items-start gap-3', view === 'grid' && 'flex-col')}>
                      <span className={cn('grid shrink-0 place-items-center rounded-xl text-brand-dark', d.thumbnailTone, view === 'grid' ? 'size-10' : 'size-9')}>
                        {docIcon(d)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-bold text-ink">{d.name}</p>
                        <p className="mt-0.5 text-[10.5px] text-muted">
                          {d.sizeLabel} · {formatDate(d.uploadedAt)} {d.pages ? `· ${d.pages} pages` : ''}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {d.tags.map((t) => (
                            <span key={t} className="rounded bg-brand-tint px-1.5 py-0.5 text-[9.5px] font-semibold text-body">#{t}</span>
                          ))}
                        </div>
                      </div>
                      <div className={cn('flex shrink-0 gap-0.5', view === 'grid' && 'absolute top-2.5 right-2.5 rounded-lg bg-card-bg/90 backdrop-blur-sm')}>
                        <button
                          type="button"
                          className="grid size-7 place-items-center rounded-lg text-muted hover:bg-secondary-bg hover:text-ink"
                          aria-label={`Preview ${d.name}`}
                          onClick={(e) => { e.stopPropagation(); setActive(d); setDetailTab('details') }}
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

      {/* Details modal */}
      <Modal
        open={!!active}
        onClose={() => setActive(null)}
        title={active?.name ?? ''}
        description={active ? `${active.caseTitle} · ${active.sizeLabel}` : undefined}
        size="lg"
        footer={
          active && (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setLink(signedUrl(active.id))
                }}
              >
                <Link2 className="size-4" aria-hidden /> Get short-lived link
              </Button>
              <Button onClick={() => setShareOpen(true)}>
                <Share2 className="size-4" aria-hidden /> Share with advocate
              </Button>
            </>
          )
        }
      >
        {active && (
          <>
            <div className="flex gap-2 border-b border-line pb-3">
              {(['details', 'access', 'shares'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDetailTab(t)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-[12px] font-semibold capitalize transition',
                    detailTab === t ? 'bg-brand-soft text-brand-dark' : 'text-body hover:bg-brand-tint',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {detailTab === 'details' && (
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-4">
                  <span className={cn('grid size-16 place-items-center rounded-2xl text-brand-dark', active.thumbnailTone)}>
                    {docIcon(active)}
                  </span>
                  <div>
                    <p className="text-[13px] font-bold">{active.name}</p>
                    <p className="mt-0.5 text-[11.5px] text-muted">Uploaded {formatDate(active.uploadedAt)} · {active.sizeLabel}</p>
                    <div className="mt-1.5 flex gap-1">
                      {active.tags.map((t) => <Badge key={t} tone="neutral">#{t}</Badge>)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-brand-tint p-3">
                    <p className="text-[10.5px] font-semibold text-muted uppercase">OCR confidence</p>
                    <p className="mt-0.5 text-[14px] font-bold">{Math.round((active.ocrConfidence ?? 0.9) * 100)}%</p>
                  </div>
                  <div className="rounded-xl bg-brand-tint p-3">
                    <p className="text-[10.5px] font-semibold text-muted uppercase">Access</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[12px] font-semibold text-ink">
                      <Lock className="size-3.5 text-dot" aria-hidden /> Private · {activeShares.filter((s) => !s.revoked).length} active share(s)
                    </p>
                  </div>
                </div>

                {renaming ? (
                  <div className="flex gap-2">
                    <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder="New file name" />
                    <Button
                      size="md"
                      onClick={() => {
                        setDocs((all) => all.map((x) => (x.id === active.id ? { ...x, name: renameValue || x.name } : x)))
                        setActive({ ...active, name: renameValue || active.name })
                        setRenaming(false)
                      }}
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => { setRenameValue(active.name); setRenaming(true) }}>
                      <Pencil className="size-3.5" aria-hidden /> Rename
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setLink(signedUrl(active.id))}>
                      <Download className="size-3.5" aria-hidden /> Download
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger hover:bg-danger-soft"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="size-3.5" aria-hidden /> Delete
                    </Button>
                  </div>
                )}

                {link && (
                  <div className="rounded-xl border border-dot/30 bg-mint-soft p-3">
                    <p className="text-[11px] font-bold text-dot">Short-lived signed URL (5 minutes)</p>
                    <code className="mt-1 block break-all text-[10.5px] leading-5 text-body">{link}</code>
                    <p className="mt-1 text-[10px] text-muted">Mock token. Production signs URLs server-side after an access check.</p>
                  </div>
                )}
              </div>
            )}

            {detailTab === 'access' && (
              <div className="pt-4">
                <p className="mb-3 flex items-center gap-1.5 text-[11px] text-muted">
                  <Clock className="size-3.5" aria-hidden /> Who viewed what, and when. Every access is logged.
                </p>
                <div className="space-y-2">
                  {(activeLogs as AccessLog[]).length === 0 && <p className="text-[12px] text-body">No access recorded yet.</p>}
                  {activeLogs.map((l) => (
                    <div key={l.id} className="flex items-start gap-3 rounded-xl border border-line px-3 py-2.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-tint text-body">
                        <UserRound className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-ink">{l.actor} <span className="font-normal text-muted">· {l.role}</span></p>
                        <p className="text-[11px] text-body">{l.action}</p>
                      </div>
                      <span className="shrink-0 text-[10.5px] text-muted">{formatDateTime(l.at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailTab === 'shares' && (
              <div className="space-y-2 pt-4">
                {activeShares.length === 0 && <p className="text-[12px] text-body">This file has not been shared.</p>}
                {activeShares.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                    <div>
                      <p className="text-[12px] font-semibold text-ink">Adv. {s.advocateName}</p>
                      <p className="text-[10.5px] text-muted">
                        {s.revoked ? 'Access revoked' : `Expires ${formatDate(s.expiresAt)}`}
                      </p>
                    </div>
                    {!s.revoked ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        onClick={() => setRevokeTarget(s)}
                      >
                        <X className="size-3.5" aria-hidden /> Revoke
                      </Button>
                    ) : (
                      <Badge tone="neutral">Revoked</Badge>
                    )}
                  </div>
                ))}
                <Button size="sm" variant="secondary" onClick={() => setShareOpen(true)}>
                  <Plus className="size-3.5" aria-hidden /> New share
                </Button>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Share modal */}
      <Modal
        open={shareOpen && !!active}
        onClose={() => setShareOpen(false)}
        title="Share with an advocate"
        description="Access is time-limited and can be revoked at any time. The advocate sees only this file."
        footer={
          <>
            <Button variant="ghost" onClick={() => setShareOpen(false)}>Cancel</Button>
            <Button onClick={createShare}>
              <Share2 className="size-4" aria-hidden /> Create share link
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-brand-tint p-3">
            <p className="text-[10.5px] font-semibold text-muted uppercase">File</p>
            <p className="mt-0.5 text-[13px] font-semibold">{active?.name}</p>
          </div>
          <div>
            <label className="label">Advocate</label>
            <Select value={shareAdvocate} onChange={(e) => setShareAdvocate(e.target.value)}>
              {advocates.filter((a) => a.verified).map((a) => (
                <option key={a.id} value={a.id}>Adv. {a.name} · {a.practiceAreas[0]}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label">Access expires in</label>
            <Select value={shareDays} onChange={(e) => setShareDays(e.target.value)}>
              <option value="1">24 hours</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </Select>
          </div>
          <p className="flex items-start gap-1.5 text-[11px] leading-5 text-muted">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-dot" aria-hidden />
            A consent record is written with the advocate, purpose and expiry. Revoking stops new signed URLs.
          </p>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={deleteOpen && !!active}
        onClose={() => setDeleteOpen(false)}
        size="sm"
        title="Delete this document?"
        description={active?.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}>
              <Trash2 className="size-4" aria-hidden /> Delete document
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-6 text-body">
          The file will be removed from your vault and every active share will be revoked. Downloaded
          copies you already hold are not affected. This cannot be undone.
        </p>
        <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-[11.5px] leading-5 text-danger">
          If this document is needed for a case, download a copy first.
        </p>
      </Modal>

      {/* Revoke confirmation */}
      <Modal
        open={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        size="sm"
        title="Revoke access?"
        description={revokeTarget ? `Adv. ${revokeTarget.advocateName}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevokeTarget(null)}>Keep access</Button>
            <Button variant="danger" onClick={confirmRevoke}>Revoke now</Button>
          </>
        }
      >
        <p className="text-[13px] leading-6 text-body">
          New signed URLs stop working immediately and the advocate can no longer open this file. The
          consent record keeps a note that access was revoked.
        </p>
      </Modal>

      {/* Upload modal */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload a document"
        description="Uploads are mocked in this build. Files are grouped by case and private by default."
        footer={
          <>
            <Button variant="ghost" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button onClick={upload} disabled={!uploadName.trim()}>
              <Upload className="size-4" aria-hidden /> Upload
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-brand-tint px-4 py-8 text-center transition hover:border-brand/40">
            <Upload className="size-6 text-brand" aria-hidden />
            <span className="mt-2 text-[12.5px] font-semibold">Choose a file</span>
            <span className="mt-0.5 text-[11px] text-muted">PDF, JPG or PNG · up to 10 MB</span>
            <input
              type="file"
              className="hidden"
              onChange={(e) => setUploadName(e.target.files?.[0]?.name ?? '')}
            />
          </label>
          <div>
            <label className="label">File name</label>
            <Input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="e.g. Rent agreement 2026.pdf" />
          </div>
          <div>
            <label className="label">Add to case</label>
            <Select value={uploadCase} onChange={(e) => setUploadCase(e.target.value)}>
              <option value="case_2041">Security deposit — HSR Layout</option>
              <option value="case_2042">Cheque bounce — ₹1,20,000</option>
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  )
}
