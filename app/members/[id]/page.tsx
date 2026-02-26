'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  getMembershipLabel,
  getMembershipDays,
  getEffectiveStatus,
  formatDate,
  getTodayStr,
} from '@/lib/utils'
import type { Member, Attendance } from '@/lib/utils'
import QRCode from 'qrcode'

export default function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const [member, setMember] = useState<Member | null>(null)
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [showQR, setShowQR] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [renewing, setRenewing] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)

  useEffect(() => {
    loadMember()
  }, [id])

  async function loadMember() {
    try {
      const [memberRes, attendanceRes] = await Promise.all([
        supabase.from('members').select('*').eq('id', id).single(),
        supabase.from('attendance').select('*').eq('member_id', id).order('date', { ascending: false }),
      ])

      if (memberRes.data) {
        setMember(memberRes.data as Member)
        // Generate QR
        const qr = await QRCode.toDataURL(memberRes.data.id, {
          width: 300,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        })
        setQrDataUrl(qr)
      }
      setAttendance((attendanceRes.data || []) as Attendance[])
    } catch (err) {
      console.error('Error loading member:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCheckIn() {
    if (!member) return
    setCheckingIn(true)
    try {
      if (getEffectiveStatus(member) !== 'active') {
        alert('Cannot check in: Membership is not active.')
        return
      }

      const today = getTodayStr()
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('member_id', member.id)
        .eq('date', today)
        .single()
        
      if (existing) {
        alert('Already checked in today.')
        return
      }

      const { error } = await supabase.from('attendance').insert({
        member_id: member.id,
        date: today,
      })
      if (error) throw error
      
      alert('Check-in successful!')
      loadMember()
    } catch (err) {
      console.error('Error checking in:', err)
      alert('Failed to check in.')
    } finally {
      setCheckingIn(false)
    }
  }

  async function handleRenew() {
    if (!member) return
    setRenewing(true)
    try {
      const currentEnd = new Date(member.end_date)
      const now = new Date()
      // If expired, renew from today; otherwise extend from end_date
      const baseDate = currentEnd < now ? now : currentEnd
      const days = getMembershipDays(member.membership_type)
      baseDate.setDate(baseDate.getDate() + (days === 0 ? 1 : days))
      const newEndDate = baseDate.toISOString().split('T')[0]

      const { error } = await supabase
        .from('members')
        .update({
          end_date: newEndDate,
          status: 'active',
        })
        .eq('id', member.id)

      if (error) throw error
      setMember({ ...member, end_date: newEndDate, status: 'active' })
    } catch (err) {
      console.error('Error renewing:', err)
      alert('Failed to renew membership.')
    } finally {
      setRenewing(false)
    }
  }

  async function handleToggleStatus() {
    if (!member) return
    const newStatus = member.status === 'active' ? 'suspended' : 'active'
    try {
      const { error } = await supabase
        .from('members')
        .update({ status: newStatus })
        .eq('id', member.id)

      if (error) throw error
      setMember({ ...member, status: newStatus })
    } catch (err) {
      console.error('Error toggling status:', err)
    }
  }

  function downloadQR() {
    if (!qrDataUrl || !member) return
    const link = document.createElement('a')
    link.download = `${member.name.replace(/\s+/g, '_')}_QR.png`
    link.href = qrDataUrl
    link.click()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ color: 'var(--muted)', fontSize: 16 }}>Loading member...</div>
      </div>
    )
  }

  if (!member) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 80 }}>
        <h2 style={{ fontSize: 22, marginBottom: 8 }}>Member Not Found</h2>
        <p style={{ color: 'var(--muted)', marginBottom: 24 }}>This member does not exist.</p>
        <button className="btn btn-primary" onClick={() => router.push('/members')}>
          Back to Members
        </button>
      </div>
    )
  }

  const status = getEffectiveStatus(member)
  const totalVisits = attendance.length

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => router.push('/members')}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--muted)',
          cursor: 'pointer',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 24,
          padding: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Members
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left: Profile Info */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          {member.photo ? (
            <img src={member.photo} alt={member.name} className="avatar" />
          ) : (
            <div className="avatar-placeholder">
              {member.name.charAt(0).toUpperCase()}
            </div>
          )}

          <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 16, marginBottom: 4 }}>
            {member.name}
          </h2>
          {member.email && (
            <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 8px' }}>
              {member.email}
            </p>
          )}

          <div style={{ 
            fontSize: 12, 
            color: 'var(--muted)', 
            background: 'var(--surface-hover)', 
            padding: '4px 8px', 
            borderRadius: 6, 
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{ userSelect: 'all', fontFamily: 'monospace' }}>{member.id}</span>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(member.id);
                alert('ID copied to clipboard');
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--accent)', display: 'flex' }}
              title="Copy ID"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>

          <span className={`badge badge-${status}`} style={{ marginBottom: 24 }}>
            {status}
          </span>

          <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="stat-card" style={{ padding: 16 }}>
              <div className="stat-label" style={{ fontSize: 11 }}>Type</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                {getMembershipLabel(member.membership_type)}
              </div>
            </div>
            <div className="stat-card" style={{ padding: 16 }}>
              <div className="stat-label" style={{ fontSize: 11 }}>Total Visits</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
                {totalVisits}
              </div>
            </div>
            <div className="stat-card" style={{ padding: 16 }}>
              <div className="stat-label" style={{ fontSize: 11 }}>Start Date</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {formatDate(member.start_date)}
              </div>
            </div>
            <div className="stat-card" style={{ padding: 16 }}>
              <div className="stat-label" style={{ fontSize: 11 }}>End Date</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {formatDate(member.end_date)}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Actions + Attendance */}
        <div>
          {/* Actions */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, marginTop: 0 }}>Actions</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={handleCheckIn}
                disabled={checkingIn}
              >
                {checkingIn ? 'Checking in...' : 'Check In'}
              </button>
              <button
                className="btn btn-success"
                onClick={handleRenew}
                disabled={renewing}
              >
                {renewing ? 'Renewing...' : 'Renew Membership'}
              </button>
              <button
                className={`btn ${member.status === 'active' ? 'btn-warning' : 'btn-primary'}`}
                onClick={handleToggleStatus}
              >
                {member.status === 'active' ? 'Suspend' : 'Activate'}
              </button>
              <button className="btn btn-outline" onClick={() => setShowQR(true)}>
                Show QR
              </button>
            </div>
          </div>

          {/* Recent Attendance */}
          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, marginTop: 0 }}>
              Recent Check-ins
            </h3>
            {attendance.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>No check-ins yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {attendance.slice(0, 10).map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--background)',
                      borderRadius: 10,
                      fontSize: 14,
                    }}
                  >
                    <span>{formatDate(a.date)}</span>
                    <span style={{ color: 'var(--muted)' }}>
                      {new Date(a.check_in_time).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR Modal */}
      {showQR && (
        <div className="modal-overlay" onClick={() => setShowQR(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, marginTop: 0 }}>
              {member.name}
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20, marginTop: 0 }}>
              Scan this QR code for check-in
            </p>
            {qrDataUrl && (
              <div style={{ background: 'white', borderRadius: 16, padding: 24, display: 'inline-block', marginBottom: 20 }}>
                <img src={qrDataUrl} alt="QR Code" style={{ width: 220, height: 220 }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={downloadQR}>
                Download
              </button>
              <button className="btn btn-primary" onClick={() => setShowQR(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
