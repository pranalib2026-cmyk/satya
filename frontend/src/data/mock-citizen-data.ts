import type {
  AccessLog,
  Advocate,
  AdvocateChatMessage,
  AdvocateThread,
  Booking,
  CaseProfile,
  CaseStage,
  Citation,
  Deadline,
  DocumentShare,
  Hearing,
  NotificationItem,
  Template,
  User,
  VaultDocument,
} from '@/types/citizen'

const now = new Date("2026-11-17T10:00:00.000Z")

export function iso(daysFromNow: number, hour = 10): string {
  const d = new Date(now)
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

export function dateOnly(daysFromNow: number): string {
  return iso(daysFromNow).slice(0, 10)
}

export const languageLabels: Record<'en' | 'hi' | 'kn', string> = {
  en: 'English (India)',
  hi: 'हिन्दी (Hindi)',
  kn: 'ಕನ್ನಡ (Kannada)',
}

export const demoUser: User = {
  id: 'usr_1024',
  name: 'Rahul Kumar',
  phone: '+91 98450 12345',
  email: 'rahul.kumar@example.com',
  language: 'en',
  city: 'Bengaluru',
  state: 'Karnataka',
  role: 'citizen',
  createdAt: iso(-42),
}

export const cases: CaseProfile[] = [
  {
    id: 'case_2041',
    title: 'Security deposit not refunded by landlord',
    category: 'Tenancy',
    subCategory: 'Refund of security deposit',
    probableForum: 'Rent Controller, Bengaluru Urban',
    urgency: 'time-bound',
    complexity: 'self-help-possible',
    keyDates: [
      { label: 'Lease ended', date: dateOnly(-46), basis: 'Vacation date in rent agreement' },
      { label: 'Deposit due', date: dateOnly(-31), basis: '15 days after handover' },
      { label: 'Legal notice suggested', date: dateOnly(4), basis: 'Before filing a claim' },
    ],
    confidence: 0.86,
    status: 'active',
    summary:
      'A ₹60,000 security deposit was not returned after vacating a rented flat in HSR Layout. The landlord cites paint damage without an inspection report.',
    userGoal: 'Recover the ₹60,000 deposit without a long court process.',
    updatedAt: iso(-2),
  },
  {
    id: 'case_2042',
    title: 'Cheque bounce — ₹1,20,000 payment',
    category: 'Cheque bounce',
    subCategory: 'Section 138 NI Act notice',
    probableForum: 'Magistrate Court, Bengaluru Urban',
    urgency: 'immediate',
    complexity: 'advocate-advised',
    keyDates: [
      { label: 'Cheque returned', date: dateOnly(-12), basis: 'Bank return memo' },
      { label: 'Notice window closes', date: dateOnly(18), basis: '30 days from return memo' },
      { label: 'Complaint window', date: dateOnly(63), basis: '1 month after notice period' },
    ],
    confidence: 0.91,
    status: 'active',
    summary:
      'A client’s cheque for ₹1,20,000 was returned for insufficient funds. The 30-day notice window is running and no notice has been sent yet.',
    userGoal: 'Send a valid legal notice and recover the money.',
    updatedAt: iso(-1),
  },
  {
    id: 'case_2043',
    title: 'Defective laptop — refund request',
    category: 'Consumer',
    subCategory: 'Defective goods / refund',
    probableForum: 'District Consumer Commission, Bengaluru',
    urgency: 'routine',
    complexity: 'self-help-possible',
    keyDates: [
      { label: 'Purchase date', date: dateOnly(-98), basis: 'Invoice' },
      { label: 'Complaint filed', date: dateOnly(-20), basis: 'Consumer commission acknowledgement' },
    ],
    confidence: 0.78,
    status: 'closed',
    summary:
      'A laptop developed a keyboard fault within warranty. The seller refused a refund, so a consumer complaint was filed and the refund was settled.',
    userGoal: 'Full refund of ₹72,999.',
    updatedAt: iso(-20),
  },
]

export const citations: Record<string, Citation> = {
  tenancy: {
    id: 'cit_1',
    act: 'Transfer of Property Act, 1882',
    section: 'Section 108',
    title: 'Rights and liabilities of lessor and lessee',
    snippet:
      'The lessee is entitled to receive back the security deposit on determination of the lease, subject to lawful deductions for damage beyond reasonable wear and tear.',
    url: 'https://www.indiacode.nic.in/',
  },
  rent: {
    id: 'cit_2',
    act: 'Karnataka Rent Act, 1999',
    section: 'Section 27',
    title: 'Recovery of possession and deposits',
    snippet:
      'A tenant may apply to the Rent Controller for refund of amounts unlawfully withheld after vacating the premises.',
    url: 'https://www.indiacode.nic.in/',
  },
  cheque: {
    id: 'cit_3',
    act: 'Negotiable Instruments Act, 1881',
    section: 'Section 138',
    title: 'Dishonour of cheque for insufficiency of funds',
    snippet:
      'A demand notice must be issued within 30 days of receiving information of dishonour. The drawer gets 15 days to pay, after which a complaint may be filed within one month.',
    url: 'https://www.indiacode.nic.in/',
  },
  consumer: {
    id: 'cit_4',
    act: 'Consumer Protection Act, 2019',
    section: 'Section 35',
    title: 'Complaint before District Commission',
    snippet:
      'A consumer may file a complaint for defective goods or deficient services before the District Commission where the value of goods or services does not exceed ₹50 lakh.',
    url: 'https://www.indiacode.nic.in/',
  },
  criminal: {
    id: 'cit_5',
    act: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    section: 'Section 35',
    title: 'Arrest without warrant — safeguards',
    snippet:
      'A person arrested must be informed of the grounds of arrest, may consult a legal practitioner, and must be produced before a Magistrate within 24 hours.',
    url: 'https://www.indiacode.nic.in/',
  },
}

export const advocates: Advocate[] = [
  {
    id: 'adv_1',
    name: 'Adv. Ananya Rao',
    initials: 'AR',
    practiceAreas: ['Tenancy', 'Property', 'Civil'],
    courts: ['Bengaluru City Civil Court', 'Rent Controller, Bengaluru Urban'],
    languages: ['en', 'kn', 'hi'],
    experienceYears: 12,
    feeMin: 1500,
    feeMax: 3000,
    city: 'Bengaluru',
    distanceKm: 3.2,
    rating: 4.8,
    reviewCount: 64,
    responseRate: 96,
    verified: true,
    enrolmentNo: 'KAR/1234/2014',
    enrolmentDate: '2014-05-16',
    stateBarCouncil: 'Karnataka State Bar Council',
    gender: 'female',
    modes: ['video', 'phone', 'in-person'],
    nextAvailable: iso(1, 11),
    about:
      'Practices before the City Civil Court and Rent Controller in Bengaluru. Focuses on tenancy, deposit disputes and property possession matters.',
    casesHandled: 210,
  },
  {
    id: 'adv_2',
    name: 'Adv. Vikram Shetty',
    initials: 'VS',
    practiceAreas: ['Cheque bounce', 'Commercial', 'Civil'],
    courts: ['Magistrate Court, Bengaluru Urban', 'Karnataka High Court'],
    languages: ['en', 'kn'],
    experienceYears: 18,
    feeMin: 2500,
    feeMax: 5000,
    city: 'Bengaluru',
    distanceKm: 6.8,
    rating: 4.7,
    reviewCount: 91,
    responseRate: 88,
    verified: true,
    enrolmentNo: 'KAR/0451/2008',
    enrolmentDate: '2008-02-11',
    stateBarCouncil: 'Karnataka State Bar Council',
    gender: 'male',
    modes: ['video', 'in-person'],
    nextAvailable: iso(0, 17),
    about:
      'Handles cheque dishonour complaints and commercial recovery matters, with appearances before Magistrate Courts and the High Court of Karnataka.',
    casesHandled: 380,
  },
  {
    id: 'adv_3',
    name: 'Adv. Meera Iyer',
    initials: 'MI',
    practiceAreas: ['Family', 'Domestic violence', 'Maintenance'],
    courts: ['Family Court, Bengaluru', 'Magistrate Court, Bengaluru Urban'],
    languages: ['en', 'ta', 'hi'],
    experienceYears: 9,
    feeMin: 1200,
    feeMax: 2800,
    city: 'Bengaluru',
    distanceKm: 4.5,
    rating: 4.9,
    reviewCount: 52,
    responseRate: 94,
    verified: true,
    enrolmentNo: 'KAR/0899/2017',
    enrolmentDate: '2017-08-04',
    stateBarCouncil: 'Karnataka State Bar Council',
    gender: 'female',
    modes: ['video', 'phone'],
    nextAvailable: iso(2, 10),
    about:
      'Family law practitioner assisting with maintenance, custody and protection order applications. Consultations available in Tamil, Hindi and English.',
    casesHandled: 160,
  },
  {
    id: 'adv_4',
    name: 'Adv. Rahul Deshpande',
    initials: 'RD',
    practiceAreas: ['Consumer', 'Cyber', 'Contract'],
    courts: ['District Consumer Commission, Bengaluru', 'City Civil Court'],
    languages: ['en', 'hi', 'mr'],
    experienceYears: 7,
    feeMin: 800,
    feeMax: 2000,
    city: 'Bengaluru',
    distanceKm: 9.1,
    rating: 4.5,
    reviewCount: 43,
    responseRate: 90,
    verified: true,
    enrolmentNo: 'KAR/1102/2019',
    enrolmentDate: '2019-01-22',
    stateBarCouncil: 'Karnataka State Bar Council',
    gender: 'male',
    modes: ['video', 'phone'],
    nextAvailable: iso(1, 15),
    about:
      'Consumer and cyber disputes, including refunds, defective goods and online fraud complaints before District Commissions.',
    casesHandled: 120,
  },
  {
    id: 'adv_5',
    name: 'Adv. Fatima Khan',
    initials: 'FK',
    practiceAreas: ['Employment', 'Labour', 'Service'],
    courts: ['Labour Court, Bengaluru', 'Karnataka High Court'],
    languages: ['en', 'hi', 'ur'],
    experienceYears: 11,
    feeMin: 1800,
    feeMax: 3500,
    city: 'Bengaluru',
    distanceKm: 7.4,
    rating: 4.6,
    reviewCount: 37,
    responseRate: 85,
    verified: true,
    enrolmentNo: 'KAR/0672/2015',
    enrolmentDate: '2015-11-30',
    stateBarCouncil: 'Karnataka State Bar Council',
    gender: 'female',
    modes: ['video', 'in-person'],
    nextAvailable: iso(3, 12),
    about:
      'Employment and labour law, including wrongful termination, unpaid salary and statutory benefits claims.',
    casesHandled: 190,
  },
  {
    id: 'adv_6',
    name: 'Adv. Suresh Gowda',
    initials: 'SG',
    practiceAreas: ['Criminal', 'Police complaints', 'Bail'],
    courts: ['Magistrate Court, Bengaluru Urban', 'City Civil Court'],
    languages: ['kn', 'en'],
    experienceYears: 22,
    feeMin: 3000,
    feeMax: 6000,
    city: 'Bengaluru',
    distanceKm: 2.6,
    rating: 4.4,
    reviewCount: 118,
    responseRate: 82,
    verified: true,
    enrolmentNo: 'KAR/0198/2004',
    enrolmentDate: '2004-06-18',
    stateBarCouncil: 'Karnataka State Bar Council',
    gender: 'male',
    modes: ['in-person', 'phone'],
    nextAvailable: iso(0, 19),
    about:
      'Criminal defence and bail applications. Accepts urgent matters and provides in-person consultations near the City Civil Court complex.',
    casesHandled: 540,
  },
]

export const deadlines: Deadline[] = [
  {
    id: 'dl_1',
    caseId: 'case_2042',
    caseTitle: 'Cheque bounce — ₹1,20,000',
    title: 'Send demand notice under s.138 NI Act',
    date: dateOnly(3),
    urgency: 'immediate',
    basis: '30 days from receipt of cheque return memo (Statutory)',
    confirmed: false,
  },
  {
    id: 'dl_2',
    caseId: 'case_2041',
    caseTitle: 'Security deposit — HSR Layout',
    title: 'File civil claim for deposit refund',
    date: dateOnly(16),
    urgency: 'time-bound',
    basis: 'Limitation period under Schedule to Limitation Act, 1963',
    confirmed: false,
  },
  {
    id: 'dl_3',
    caseId: 'case_2042',
    caseTitle: 'Cheque bounce — ₹1,20,000',
    title: 'File complaint after notice period',
    date: dateOnly(33),
    urgency: 'time-bound',
    basis: 'One month from expiry of 15-day notice period',
    confirmed: true,
  },
  {
    id: 'dl_4',
    caseId: 'case_2041',
    caseTitle: 'Security deposit — HSR Layout',
    title: 'Hearing — deposit recovery',
    date: dateOnly(48),
    urgency: 'routine',
    basis: 'Court cause list entry',
    confirmed: true,
  },
]

export const documents: VaultDocument[] = [
  {
    id: 'doc_1',
    caseId: 'case_2041',
    caseTitle: 'Security deposit — HSR Layout',
    name: 'Rent Agreement 2024.pdf',
    type: 'pdf',
    sizeLabel: '2.4 MB',
    tags: ['tenancy', 'agreement'],
    uploadedAt: iso(-40),
    pages: 12,
    ocrConfidence: 0.94,
    sharedWith: ['Adv. Ananya Rao'],
  },
  {
    id: 'doc_2',
    caseId: 'case_2041',
    caseTitle: 'Security deposit — HSR Layout',
    name: 'Deposit transfer receipt.jpg',
    type: 'image',
    sizeLabel: '820 KB',
    tags: ['payment', 'bank'],
    uploadedAt: iso(-16),
    ocrConfidence: 0.78,
    sharedWith: [],
  },
  {
    id: 'doc_3',
    caseId: 'case_2041',
    caseTitle: 'Security deposit — HSR Layout',
    name: 'Handover photos.zip',
    type: 'image',
    sizeLabel: '6.1 MB',
    tags: ['evidence'],
    uploadedAt: iso(-12),
    sharedWith: [],
  },
  {
    id: 'doc_4',
    caseId: 'case_2042',
    caseTitle: 'Cheque bounce — ₹1,20,000',
    name: 'Cheque return memo.pdf',
    type: 'pdf',
    sizeLabel: '410 KB',
    tags: ['cheque', 'bank'],
    uploadedAt: iso(-11),
    pages: 2,
    ocrConfidence: 0.96,
    sharedWith: ['Adv. Vikram Shetty'],
  },
  {
    id: 'doc_5',
    caseId: 'case_2042',
    caseTitle: 'Cheque bounce — ₹1,20,000',
    name: 'Invoice INV-8842.pdf',
    type: 'pdf',
    sizeLabel: '160 KB',
    tags: ['invoice'],
    uploadedAt: iso(-11),
    pages: 1,
    ocrConfidence: 0.91,
    sharedWith: [],
  },
]

export const accessLogs: AccessLog[] = [
  {
    id: 'log_1',
    documentId: 'doc_1',
    actor: 'Adv. Ananya Rao',
    role: 'Advocate',
    action: 'Viewed document',
    at: iso(-2, 15),
  },
  {
    id: 'log_2',
    documentId: 'doc_1',
    actor: 'You',
    role: 'Owner',
    action: 'Uploaded document',
    at: iso(-40, 10),
  },
  {
    id: 'log_3',
    documentId: 'doc_1',
    actor: 'You',
    role: 'Owner',
    action: 'Shared with Adv. Ananya Rao (expires in 7 days)',
    at: iso(-2, 14),
  },
  {
    id: 'log_4',
    documentId: 'doc_4',
    actor: 'Adv. Vikram Shetty',
    role: 'Advocate',
    action: 'Downloaded document',
    at: iso(-1, 11),
  },
]

export const documentShares: DocumentShare[] = [
  {
    id: 'shr_1',
    documentId: 'doc_1',
    advocateId: 'adv_1',
    advocateName: 'Adv. Ananya Rao',
    expiresAt: iso(5),
    revoked: false,
  },
  {
    id: 'shr_2',
    documentId: 'doc_4',
    advocateId: 'adv_2',
    advocateName: 'Adv. Vikram Shetty',
    expiresAt: iso(2),
    revoked: false,
  },
]

export const caseStages: CaseStage[] = [
  {
    id: 'stg_1',
    caseId: 'case_2041',
    title: 'Case profile created',
    date: dateOnly(-30),
    status: 'done',
    plainExplanation:
      'Your facts were organized into an objective case profile. This is not a court filing — it is a structured record of your events and claims.',
    whatNext: 'Review the profile and attach supporting documents into your Vault.',
  },
  {
    id: 'stg_2',
    caseId: 'case_2041',
    title: 'Legal notice sent',
    date: dateOnly(-24),
    status: 'done',
    plainExplanation:
      'A formal written demand was sent to the landlord via Registered Post with A/D, giving 15 days to refund the deposit.',
    whatNext: 'Wait for the statutory response period.',
  },
  {
    id: 'stg_3',
    caseId: 'case_2041',
    title: 'Reply received from opposite party',
    date: dateOnly(-18),
    status: 'done',
    plainExplanation:
      'The landlord denied liability alleging painting deductions without an inspection report.',
    whatNext: 'Consult with an advocate to determine whether to file before the Rent Controller.',
  },
  {
    id: 'stg_4',
    caseId: 'case_2041',
    title: 'Awaiting filing decision',
    date: dateOnly(-2),
    status: 'current',
    plainExplanation:
      'Evaluating formal petition filing before the Rent Controller, Bengaluru Urban.',
    whatNext: 'Book a 20-minute consultation with Adv. Ananya Rao to finalize filing strategy.',
  },
  {
    id: 'stg_5',
    caseId: 'case_2041',
    title: 'First hearing & notice issued',
    status: 'upcoming',
    plainExplanation:
      'At the first hearing, the Rent Controller verifies jurisdiction, admits the petition, and summons the landlord.',
    whatNext: 'Carry original rent agreement, bank deposit receipt, and key handover memo.',
  },
]

export const hearings: Hearing[] = [
  {
    id: 'hr_1',
    caseId: 'case_2041',
    court: 'Rent Controller, Bengaluru Urban',
    date: iso(48, 11),
    purpose: 'First hearing — maintainability & notice',
    status: 'upcoming',
  },
  {
    id: 'hr_2',
    caseId: 'case_2042',
    court: 'Magistrate Court, Bengaluru Urban',
    date: iso(21, 10),
    purpose: 'Cognizance & verification of complainant affidavit',
    status: 'upcoming',
  },
]

export const bookings: Booking[] = [
  {
    id: 'bk_1001',
    advocateId: 'adv_1',
    advocateName: 'Adv. Ananya Rao',
    caseId: 'case_2041',
    date: dateOnly(1),
    time: '11:00 AM',
    mode: 'video',
    status: 'confirmed',
    amount: 1500,
    paymentId: 'pay_mock_88412',
    createdAt: iso(-1),
  },
  {
    id: 'bk_0998',
    advocateId: 'adv_3',
    advocateName: 'Adv. Meera Iyer',
    caseId: 'case_2043',
    date: dateOnly(-12),
    time: '04:00 PM',
    mode: 'phone',
    status: 'completed',
    amount: 1200,
    paymentId: 'pay_mock_77103',
    createdAt: iso(-16),
    feedbackGiven: false,
  },
]

export const threads: AdvocateThread[] = [
  {
    id: 'th_1',
    advocateId: 'adv_1',
    advocateName: 'Adv. Ananya Rao',
    initials: 'AR',
    lastMessage: 'I have reviewed the rent agreement. The deposit clause is clear.',
    lastAt: iso(0, 9),
    unread: 2,
    online: true,
  },
  {
    id: 'th_2',
    advocateId: 'adv_2',
    advocateName: 'Adv. Vikram Shetty',
    initials: 'VS',
    lastMessage: 'Please send the bank return memo before we finalize the Section 138 notice.',
    lastAt: iso(-1, 18),
    unread: 1,
    online: false,
  },
]

export const advocateChat: AdvocateChatMessage[] = [
  {
    id: 'cm_1',
    threadId: 'th_1',
    from: 'advocate',
    text: 'Namaste Rahul, I received your case brief and documents. Clause 7 of the rent agreement explicitly mandates deposit refund within 15 days.',
    at: iso(-1, 10),
  },
  {
    id: 'cm_2',
    threadId: 'th_1',
    from: 'user',
    text: 'Yes Ma\'am, I returned the keys on 15 September and have the caretaker\'s signed receipt.',
    at: iso(-1, 10),
  },
  {
    id: 'cm_3',
    threadId: 'th_1',
    from: 'advocate',
    text: 'I have reviewed the rent agreement. The deposit clause is clear. We can proceed with filing an application before the Rent Controller if he does not pay by next Tuesday.',
    at: iso(0, 9),
  },
]

export const notifications: NotificationItem[] = [
  {
    id: 'nt_1',
    title: 'Limitation Deadline in 3 days',
    body: 'Send the Section 138 NI Act statutory demand notice for your cheque bounce matter.',
    at: iso(0, 8),
    read: false,
    href: '/dashboard/deadlines',
  },
  {
    id: 'nt_2',
    title: 'Message from Adv. Ananya Rao',
    body: '“I have reviewed the rent agreement. The deposit clause is clear.”',
    at: iso(0, 9),
    read: false,
    href: '/dashboard/messages',
  },
  {
    id: 'nt_3',
    title: 'Consultation Confirmed',
    body: 'Video consultation with Adv. Ananya Rao scheduled for tomorrow at 11:00 AM.',
    at: iso(-1, 17),
    read: false,
    href: '/dashboard/bookings',
  },
]

export const templates: Template[] = [
  {
    id: 'tpl_legal_notice',
    name: 'Legal Notice for Security Deposit Refund',
    description: 'Statutory demand notice sent via Registered Post A/D before filing before the Rent Controller.',
    forum: 'Sent to Landlord / Registered Address',
    fee: '₹0 court fees for notice; Postal charges approx. ₹60–₹100',
    documents: ['Rent Agreement copy', 'Bank deposit transfer receipt', 'Handover confirmation photos/memo'],
    fields: [
      { key: 'recipient', label: 'Landlord / Recipient Name & Address' },
      { key: 'sender', label: 'Your Full Name & Current Address' },
      { key: 'facts', label: 'Tenancy Summary & Handover Details', multiline: true },
      { key: 'demand', label: 'Refund Amount & Bank Account for Transfer', multiline: true },
      { key: 'deadline', label: 'Statutory Compliance Period (e.g. 15 days)' },
    ],
    body: `LEGAL NOTICE\n\nTo,\n{{recipient}}\n\nFrom,\n{{sender}}\n\nSubject: Formal Demand Notice for Immediate Refund of Security Deposit of Rs. 60,000/-\n\nSir/Madam,\n\nUnder instructions from my client / On behalf of the undersigned, I hereby state as follows:\n\n1. That the undersigned was a bona fide tenant of the residential premises situated at {{recipient}}, under a valid rent agreement dated 01 October 2024.\n\n2. That the tenancy was lawfully determined and quiet, peaceful, vacant physical possession of the demised premises was handed over in sound condition.\n\n3. That the facts are: {{facts}}\n\n4. That in terms of Section 108 of the Transfer of Property Act, 1882 and the governing Rent Control regulations, you are legally obligated to {{demand}} within {{deadline}} from receipt hereof.\n\n5. TAKE NOTICE that if you fail to comply, proceedings before the competent Rent Controller and Civil Court shall be instituted at your entire risk, peril, and costs.\n\nDate: {{date}}\nPlace: Bengaluru\n\n(Signed)\n{{sender}}`,
  },
  {
    id: 'tpl_rti',
    name: 'RTI Application (Right to Information Act, 2005)',
    description: 'Official application under Section 6(1) to seek public records and municipal inspection reports.',
    forum: 'Public Information Officer (PIO) of the concerned department',
    fee: '₹10 Indian Postal Order (IPO) or online RTI portal fee',
    documents: ['Aadhaar / ID copy', 'Fee receipt or IPO slip'],
    fields: [
      { key: 'authority', label: 'Public Authority & Department Address' },
      { key: 'applicant', label: 'Applicant Name, Address & Contact' },
      { key: 'information', label: 'Information Required (Point-wise)', multiline: true },
      { key: 'period', label: 'Time Period of Records' },
    ],
    body: `APPLICATION UNDER SECTION 6(1) OF THE RIGHT TO INFORMATION ACT, 2005\n\nTo,\nThe Public Information Officer (PIO),\n{{authority}}\n\n1. Full Name of Applicant: {{applicant}}\n2. Particulars of Information Sought: {{information}}\n3. Period to which information pertains: {{period}}\n4. The applicant is a citizen of India.\n5. Application Fee: ₹10 attached via Postal Order / Online payment.\n\nIf the information requested pertains to another public authority, kindly transfer this application within 5 days as prescribed under Section 6(3) of the Act.\n\nDate: {{date}}\nPlace: Bengaluru\n\n(Signature)\n{{applicant}}`,
  },
  {
    id: 'tpl_consumer',
    name: 'Consumer Complaint Petition',
    description: 'Complaint under Section 35 of the Consumer Protection Act, 2019 for defective goods or deficient service.',
    forum: 'District Consumer Disputes Redressal Commission',
    fee: '₹0 for claims up to ₹5 Lakhs',
    documents: ['Purchase Invoice', 'Warranty card', 'Email communications with customer service', 'Photos/proof of defect'],
    fields: [
      { key: 'complainant', label: 'Complainant Details' },
      { key: 'opposite', label: 'Opposite Party (Seller / Manufacturer)' },
      { key: 'product', label: 'Product / Service Description & Value' },
      { key: 'defect', label: 'Details of Defect / Deficiency in Service', multiline: true },
      { key: 'relief', label: 'Relief & Compensation Claimed', multiline: true },
    ],
    body: `BEFORE THE DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION\n\nConsumer Complaint No. ________ / 2026\n\nIN THE MATTER OF:\n{{complainant}}\n... Complainant\n\nVERSUS\n\n{{opposite}}\n... Opposite Party\n\n1. That the Complainant purchased {{product}} for valuable consideration against invoice.\n2. That the goods/services suffer from gross defect: {{defect}}\n3. That the Opposite Party failed to rectify or replace despite written complaints.\n4. PRAYER: It is therefore prayed that this Hon'ble Commission direct the Opposite Party to {{relief}}.\n\nDate: {{date}}\nPlace: Bengaluru\n\n(Complainant)`,
  },
]

export const emergencyHelplines = [
  { number: '112', label: 'Police & All-India Emergency', desc: 'Immediate physical danger, unlawful detention, violence', tone: 'danger' },
  { number: '181', label: 'Women Helpline', desc: '24x7 crisis support, domestic violence, emergency shelter', tone: 'warn' },
  { number: '15100', label: 'Free Legal Aid (NALSA / DLSA)', desc: 'Free advocate representation for eligible citizens', tone: 'mint' },
]

export const emergencyRights: Record<
  string,
  {
    title: string
    summary: string
    rights: string[]
    firstSteps: string[]
    helpline: string
  }
> = {
  arrest: {
    title: 'Someone is being arrested',
    summary:
      'You have rights at the point of arrest. Stay calm, ask for the grounds, and do not sign blank papers.',
    rights: [
      'You must be told the grounds of arrest and whether the offence is bailable.',
      'You may inform a family member or friend about the arrest.',
      'You may consult a lawyer of your choice.',
      'You must be produced before a Magistrate within 24 hours.',
      'You cannot be forced to confess. A confession to police is not admissible.',
    ],
    firstSteps: [
      'Ask the officer for name, police station and grounds of arrest.',
      'Note the time of arrest.',
      'Call a family member and a lawyer.',
      'Do not resist physically or sign any blank statement.',
    ],
    helpline: '112',
  },
  domestic_violence: {
    title: 'Domestic violence',
    summary:
      'You are not alone. Protection is available under the Protection of Women from Domestic Violence Act, 2005.',
    rights: [
      'You can seek a protection order, residence order and monetary relief.',
      'You can call 181 (Women Helpline) at any time.',
      'A protection officer can help you file an application.',
      'Free legal aid is available at the District Legal Services Authority.',
      'Medical examination and a medico-legal certificate can be requested.',
    ],
    firstSteps: [
      'Move to a safe place if you are in danger.',
      'Call 181 or 112.',
      'Save evidence — messages, photos, medical records.',
      'Contact a protection officer or DLSA for a free application.',
    ],
    helpline: '181',
  },
  harassment: {
    title: 'Harassment or stalking',
    summary:
      'Harassment online or in person can be reported to police and, where applicable, to the workplace committee.',
    rights: [
      'You can file an FIR or a complaint at any police station.',
      'Online harassment can be reported on cybercrime.gov.in or by calling 1930.',
      'Workplace sexual harassment falls under the POSH Act, 2013.',
      'You can request confidentiality of your identity in sensitive cases.',
    ],
    firstSteps: [
      'Preserve messages, screenshots, call logs and emails.',
      'Do not engage with the harasser.',
      'Report online to cybercrime.gov.in or call 1930.',
      'Inform a trusted person and seek legal aid if needed.',
    ],
    helpline: '112',
  },
  threat: {
    title: 'Threat to safety',
    summary:
      'An immediate threat to life or safety is a police matter. Call 112 without waiting to gather documents.',
    rights: [
      'Police must register an FIR for a cognizable offence.',
      'You can give information at any police station, not only your local one.',
      'You can request police protection in serious threats.',
      'Free legal aid is available for victims of violence.',
    ],
    firstSteps: [
      'Call 112 if the threat is immediate.',
      'Save all threatening messages and call recordings.',
      'Give a written complaint to the nearest police station and keep a receipt.',
      'Inform a family member or neighbour.',
    ],
    helpline: '112',
  },
}
