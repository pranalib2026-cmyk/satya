import { delay, DEMO_OTP } from './api'
import { api, clearStoredTokens } from '@/lib/api-client'
import { demoUser } from '@/data/dashboard-mock-data'
import type { Language, User } from '@/types/dashboard'

export { DEMO_OTP }

export interface AuthSession {
  token: string
  user: User
}

const STORAGE_KEY = 'legal_token'
const USER_KEY = 'legal_user'
const ONBOARDED_KEY = 'legal_onboarded'

/** Mock OTP request. TODO: replace with SMS provider (Twilio / Gupshup). */
export async function requestOtp(phone: string): Promise<{ sent: true; demoOtp: string }> {
  await delay(700)
  if (!/^(\+91)?[6-9]\d{9}$/.test(phone.replace(/\s/g, ''))) {
    throw new Error('Enter a valid 10-digit Indian mobile number.')
  }
  // TODO: call SMS service with the generated OTP. Demo OTP is fixed for now.
  return { sent: true, demoOtp: DEMO_OTP }
}

/** Mock OTP verification that issues a JWT-shaped token. TODO: real backend JWT. */
export async function verifyOtp(phone: string, otp: string): Promise<AuthSession> {
  await delay(600)
  if (otp !== DEMO_OTP) throw new Error('That OTP is not correct. Try 123456 for the demo.')

  const token = `mock.jwt.${btoa(JSON.stringify({ sub: demoUser.id, phone, iat: Date.now() }))}`
  const user = { ...demoUser, phone }
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  }
  return { token, user }
}

export function loadSession(): AuthSession | null {
  if (typeof window === 'undefined') return null
  const token = localStorage.getItem(STORAGE_KEY)
  const rawUser = localStorage.getItem(USER_KEY)
  if (!token || !rawUser) return null
  try {
    return { token, user: JSON.parse(rawUser) as User }
  } catch {
    return null
  }
}

export function saveUser(user: User) {
  if (typeof window !== 'undefined') localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function updateLanguage(language: Language) {
  const session = loadSession()
  if (session) saveUser({ ...session.user, language })
}

export function isOnboarded(): boolean {
  return typeof window !== 'undefined' && localStorage.getItem(ONBOARDED_KEY) === 'true'
}

export function setOnboarded() {
  if (typeof window !== 'undefined') localStorage.setItem(ONBOARDED_KEY, 'true')
}

export function logout() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(ONBOARDED_KEY)
}

/** Real account deletion via DELETE /api/v1/users/me */
export async function deleteAccount(confirmation: string = 'CONFIRM_DELETE_NYAYASETU_ACCOUNT') {
  await api.delete('/api/v1/users/me', {
    body: JSON.stringify({ confirmation }),
  })
  logout()
  clearStoredTokens()
}

/** Real DPDP statutory data export via POST /api/v1/users/me/data-export */
export async function downloadMyData() {
  const exportRes = await api.post<{
    export_id: string
    status: string
    user_id: string
    exported_at: string
    download_url?: string
    data: Record<string, unknown>
  }>('/api/v1/users/me/data-export', {})

  if (!exportRes || !exportRes.data) {
    throw new Error('Server returned an empty data export')
  }

  const blob = new Blob([JSON.stringify(exportRes.data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nyayasetu-statutory-export-${exportRes.export_id}.json`
  if (typeof document !== 'undefined') {
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
  URL.revokeObjectURL(url)
}
