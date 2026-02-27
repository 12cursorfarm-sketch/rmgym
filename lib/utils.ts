export type MembershipType = '1day' | 'weekly' | 'monthly'
export type MemberStatus = 'active' | 'suspended'

export interface Member {
  id: string
  name: string
  email: string | null
  photo: string | null
  membership_type: MembershipType
  start_date: string
  end_date: string
  status: MemberStatus
  payment: number
  created_at: string
}

export interface Attendance {
  id: string
  member_id: string
  date: string
  check_in_time: string
}

export interface Renewal {
  id: string
  member_id: string
  amount: number
  membership_type: MembershipType
  before_end_date: string
  after_end_date: string
  created_at: string
}

export type CheckInResult = 'valid' | 'already_used' | 'expired' | 'suspended' | 'not_found'

export function getMembershipLabel(type: MembershipType): string {
  switch (type) {
    case '1day': return '1 Day'
    case 'weekly': return 'Weekly'
    case 'monthly': return 'Monthly'
  }
}

export function getMembershipDays(type: MembershipType): number {
  switch (type) {
    case '1day': return 0
    case 'weekly': return 7
    case 'monthly': return 30
  }
}

export function computeEndDate(startDate: string, type: MembershipType): string {
  const start = new Date(startDate)
  start.setDate(start.getDate() + getMembershipDays(type))
  return start.toISOString().split('T')[0]
}

export function getEffectiveStatus(member: Member): 'active' | 'expired' | 'suspended' {
  if (member.status === 'suspended') return 'suspended'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDate = new Date(member.end_date + 'T23:59:59')
  if (today > endDate) return 'expired'
  return 'active'
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function getTodayStr(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getWeekDays(): { label: string; date: string }[] {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))

  const days = []
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    days.push({ label: labels[i], date: `${year}-${month}-${day}` })
  }
  return days
}
