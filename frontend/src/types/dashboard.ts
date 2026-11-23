export type Language = 'en' | 'hi' | 'kn'

export type SpokenLanguage =
  | 'en'
  | 'hi'
  | 'kn'
  | 'ta'
  | 'te'
  | 'mr'
  | 'ml'
  | 'ur'
  | 'bn'

export type Role = 'user' | 'advocate' | 'admin'

export interface User {
  id: string
  name: string
  phone: string
  email?: string
  language: Language
  city: string
  state: string
  role: Role
  createdAt: string
}

export interface Consent {
  id: string
  userId: string
  consentType: 'terms' | 'privacy' | 'dpdp' | 'share_brief' | 'share_documents'
  version: string
  grantedAt: string
  revoked: boolean
  purpose?: string
  advocateId?: string
  itemsShared?: string[]
}

export type Urgency = 'immediate' | 'time-bound' | 'routine'
export type Complexity = 'self-help-possible' | 'advocate-advised' | 'specialist-needed'

export interface KeyDate {
  label: string
  date: string
  basis?: string
}

export interface CaseProfile {
  id: string
  title: string
  category: string
  subCategory: string
  probableForum: string
  urgency: Urgency
  complexity: Complexity
  keyDates: KeyDate[]
  confidence: number
  status: 'draft' | 'active' | 'closed'
  summary: string
  userGoal: string
  updatedAt: string
}

export interface Citation {
  id: string
  act: string
  section: string
  title: string
  snippet: string
  url: string
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  citations?: Citation[]
  disclaimer?: string
  createdAt: string
  pending?: boolean
}

export interface Advocate {
  id: string
  name: string
  initials: string
  practiceAreas: string[]
  courts: string[]
  languages: SpokenLanguage[]
  experienceYears: number
  feeMin: number
  feeMax: number
  city: string
  distanceKm: number
  rating: number
  reviewCount: number
  responseRate: number
  verified: boolean
  enrolmentNo: string
  enrolmentDate: string
  stateBarCouncil: string
  gender: 'female' | 'male' | 'other'
  modes: Array<'phone' | 'video' | 'in-person'>
  nextAvailable: string
  about: string
  casesHandled: number
}

export interface MatchScore {
  practiceFit: number
  courtProximity: number
  experience: number
  language: number
  ratingResponse: number
  budgetAvailability: number
  total: number
}

export interface AdvocateMatch {
  advocate: Advocate
  score: MatchScore
  reason: string
}

export interface AdvocateSlot {
  id: string
  advocateId: string
  date: string
  time: string
  mode: 'phone' | 'video' | 'in-person'
  available: boolean
}

export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'refunded'

export interface Booking {
  id: string
  advocateId: string
  advocateName: string
  caseId: string
  date: string
  time: string
  mode: 'phone' | 'video' | 'in-person'
  status: BookingStatus
  amount: number
  paymentId?: string
  createdAt: string
  feedbackGiven?: boolean
}

export interface VaultDocument {
  id: string
  caseId: string
  caseTitle: string
  name: string
  type: 'pdf' | 'image'
  sizeLabel: string
  tags: string[]
  uploadedAt: string
  pages?: number
  ocrConfidence?: number
  thumbnailTone: string
  sharedWith?: string[]
}

export interface AccessLog {
  id: string
  documentId: string
  actor: string
  role: string
  action: string
  at: string
}

export interface DocumentShare {
  id: string
  documentId: string
  advocateId: string
  advocateName: string
  expiresAt: string
  revoked: boolean
}

export interface Deadline {
  id: string
  caseId: string
  caseTitle: string
  title: string
  date: string
  urgency: Urgency
  basis: string
  confirmed: boolean
  completed?: boolean
}

export interface CaseStage {
  id: string
  caseId: string
  title: string
  date?: string
  status: 'done' | 'current' | 'upcoming'
  plainExplanation: string
  whatNext: string
}

export interface Hearing {
  id: string
  caseId: string
  court: string
  date: string
  purpose: string
  status: 'upcoming' | 'completed'
}

export interface Template {
  id: string
  name: string
  description: string
  forum: string
  fee: string
  documents: string[]
  fields: Array<{ key: string; label: string; multiline?: boolean }>
  body: string
}

export interface GeneratedDocument {
  id: string
  templateId: string
  caseId: string
  title: string
  createdAt: string
  status: 'draft' | 'review_requested'
}

export interface OcrResult {
  documentId?: string
  text: string
  confidence: number
  lowConfidence: boolean
  status?: string
  ocrEngine?: string
  processingError?: string | null
}

export interface DocumentExplanation {
  documentId?: string
  documentType: string
  summary: string
  parties: string[]
  dates: Array<{ label: string; value: string }>
  amounts: Array<{ label: string; value: string }>
  obligations: string[]
  risks: string[]
  citations?: Array<{
    source_title: string
    source_type?: string
    section_or_paragraph?: string
    clause_heading?: string
    official_source_url?: string
  }>
  sourcesFound?: boolean
  disclaimer: string
}

export interface TriagePath {
  key: 'self-help' | 'legal-aid' | 'advocate' | 'emergency'
  title: string
  description: string
  recommended: boolean
  reason: string
  cta: string
  icon: string
}

export interface TriageResult {
  recommended: TriagePath['key']
  confidence: number
  rules: string[]
  paths: TriagePath[]
}

export interface NotificationItem {
  id: string
  title: string
  body: string
  at: string
  read: boolean
  href?: string
}

export interface DashboardSummary {
  activeCases: number
  unreadMessages: number
  pendingActions: number
  deadlines: Deadline[]
  recentCase?: CaseProfile
  active_cases?: number
  pending_cases?: number
  completed_cases?: number
  total_cases?: number
}

export interface AdvocateChatMessage {
  id: string
  threadId: string
  from: 'user' | 'advocate' | 'system'
  text: string
  at: string
  attachmentName?: string
}

export interface Thread {
  id: string
  advocateId: string
  advocateName: string
  initials: string
  lastMessage: string
  lastAt: string
  unread: number
  online: boolean
}

export interface FeedbackEntry {
  id: string
  bookingId: string
  advocateId: string
  rating: number
  tags: string[]
  comment: string
  resolved: 'yes' | 'no' | 'in_progress'
  createdAt: string
}
