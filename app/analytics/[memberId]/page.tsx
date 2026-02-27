'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getMembershipLabel, getEffectiveStatus } from '@/lib/utils'
import type { Member, Attendance, Renewal } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export default function MemberDrillDownAnalytics({
  params,
}: {
  params: Promise<{ memberId: string }>
}) {
  const { memberId } = use(params)
  const router = useRouter()

  const [member, setMember] = useState<Member | null>(null)
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [renewals, setRenewals] = useState<Renewal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [memberId])

  async function loadData() {
    try {
      const [memberRes, attendanceRes, renewalsRes] = await Promise.all([
        supabase.from('members').select('*').eq('id', memberId).single(),
        supabase.from('attendance').select('*').eq('member_id', memberId).order('date', { ascending: true }),
        supabase.from('renewals').select('*').eq('member_id', memberId).order('created_at', { ascending: false }),
      ])

      if (memberRes.data) {
        setMember(memberRes.data as Member)
      }
      setAttendance((attendanceRes.data || []) as Attendance[])
      setRenewals((renewalsRes.data || []) as Renewal[])
    } catch (err) {
      console.error('Error loading member drilldown:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <div style={{ color: 'var(--muted)', fontSize: 16 }}>Loading member data...</div>
      </div>
    )
  }

  if (!member) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <h2 style={{ fontSize: 20 }}>Member Not Found</h2>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => router.push('/analytics/history')}>
          Back to History
        </button>
      </div>
    )
  }

  // Visit Frequency data (by month)
  const monthlyVisits: Record<string, number> = {}
  attendance.forEach(a => {
    const month = a.date.substring(0, 7) // YYYY-MM
    monthlyVisits[month] = (monthlyVisits[month] || 0) + 1
  })
  
  const visitData = Object.keys(monthlyVisits).sort().map(month => ({
    month,
    visits: monthlyVisits[month]
  }))

  const status = getEffectiveStatus(member)
  const totalPaid = Number(member.payment) + renewals.reduce((sum, r) => sum + Number(r.amount), 0)

  return (
    <div>
      <button
        onClick={() => router.push('/analytics/history')}
        style={{
          background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
          fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, padding: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Member History
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) 2fr', gap: 24, marginBottom: 24 }}>
        {/* Profile Summary */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          {member.photo ? (
            <img src={member.photo} alt={member.name} className="avatar" style={{ width: 100, height: 100 }} />
          ) : (
            <div className="avatar-placeholder" style={{ width: 100, height: 100, fontSize: 32 }}>
              {member.name.charAt(0).toUpperCase()}
            </div>
          )}
          
          <h2 style={{ fontSize: 22, fontWeight: 700, marginTop: 16, marginBottom: 4 }}>{member.name}</h2>
          {member.email && <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 16px' }}>{member.email}</p>}
          
          <span className={`badge badge-${status}`} style={{ marginBottom: 24 }}>{status}</span>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>Current Plan</span>
              <span style={{ fontWeight: 600 }}>{getMembershipLabel(member.membership_type)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>Joined Date</span>
              <span style={{ fontWeight: 500 }}>{member.start_date}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>Total Visits</span>
              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{attendance.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>Total LTV</span>
              <span style={{ fontWeight: 600, color: 'var(--success)' }}>P{totalPaid.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Charts & Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Visit Frequency Chart */}
          <div className="card">
            <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>Visit Frequency (Monthly)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={visitData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--muted)" fontSize={12} tickMargin={10} />
                <YAxis stroke="var(--muted)" fontSize={12} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'var(--surface-hover)' }} contentStyle={{ borderRadius: 8 }} />
                <Bar dataKey="visits" name="Visits" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)', gap: 24 }}>
        {/* Payment & Renewal History */}
        <div className="card">
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Payment & Renewal History</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '12px 16px', background: 'var(--background)', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>Initial Signup</span>
                <span style={{ fontWeight: 600, color: 'var(--success)' }}>P{Number(member.payment).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{new Date(member.created_at).toLocaleDateString()}</span>
                <span>{getMembershipLabel(member.membership_type)}</span>
              </div>
            </div>

            {renewals.map(r => (
              <div key={r.id} style={{ padding: '12px 16px', background: 'var(--background)', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>Renewal</span>
                  <span style={{ fontWeight: 600, color: 'var(--success)' }}>P{Number(r.amount).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                  <span>{getMembershipLabel(r.membership_type)} (Until {r.after_end_date})</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Attendance */}
        <div className="card">
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Recent Check-ins</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
            {[...attendance].reverse().map(a => (
              <div key={a.id} style={{ padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 500 }}>{a.date}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                </div>
              </div>
            ))}
            {attendance.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>No visits yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
