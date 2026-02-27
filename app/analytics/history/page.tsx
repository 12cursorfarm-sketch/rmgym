'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { getMembershipLabel, getEffectiveStatus } from '@/lib/utils'
import type { Member, Attendance, Renewal } from '@/lib/utils'
import Link from 'next/link'

export default function MemberHistoryAnalytics() {
  const [members, setMembers] = useState<Member[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [renewals, setRenewals] = useState<Renewal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [membersRes, attendanceRes, renewalsRes] = await Promise.all([
        supabase.from('members').select('*').order('created_at', { ascending: false }),
        supabase.from('attendance').select('*'),
        supabase.from('renewals').select('*')
      ])

      setMembers((membersRes.data || []) as Member[])
      setAttendance((attendanceRes.data || []) as Attendance[])
      setRenewals((renewalsRes.data || []) as Renewal[])
    } catch (err) {
      console.error('Error loading history data:', err)
    } finally {
      setLoading(false)
    }
  }

  const tableData = useMemo(() => {
    return members.map(m => {
      const visits = attendance.filter(a => a.member_id === m.id).length
      
      const memberRenewals = renewals.filter(r => r.member_id === m.id)
      const totalRenewals = memberRenewals.length
      const renewalAmount = memberRenewals.reduce((sum, r) => sum + Number(r.amount), 0)
      const totalPaid = Number(m.payment) + renewalAmount

      return {
        ...m,
        visits,
        totalRenewals,
        totalPaid
      }
    }).filter(m => 
      m.name.toLowerCase().includes(search.toLowerCase()) || 
      (m.email && m.email.toLowerCase().includes(search.toLowerCase()))
    )
  }, [members, attendance, renewals, search])

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Type', 'Status', 'Start Date', 'Total Visits', 'Renewals', 'Total Paid (P)']
    const rows = tableData.map(m => [
      `"${m.name}"`,
      `"${m.email || ''}"`,
      getMembershipLabel(m.membership_type),
      getEffectiveStatus(m),
      m.start_date,
      m.visits,
      m.totalRenewals,
      m.totalPaid
    ])
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'member_history.csv'
    link.click()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <div style={{ color: 'var(--muted)', fontSize: 16 }}>Loading member history...</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Member History Log</h3>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            style={{ width: '250px', padding: '8px 16px' }}
          />
          <button className="btn btn-outline" onClick={exportCSV} style={{ padding: '8px 16px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: '900px' }}>
          <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '12px 20px', borderBottom: '2px solid var(--border-color)' }}>
            <div>Member</div>
            <div>Type</div>
            <div>Status</div>
            <div>Start Date</div>
            <div>Total Visits</div>
            <div>Renewals</div>
            <div>Total Paid</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tableData.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>No members found.</div>
            ) : (
              tableData.map((m) => {
                const status = getEffectiveStatus(m)
                return (
                  <Link 
                    key={m.id} 
                    href={`/analytics/${m.id}`}
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', 
                      alignItems: 'center', 
                      padding: '16px 20px', 
                      borderBottom: '1px solid var(--border-color)',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{m.name}</div>
                      {m.email && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{m.email}</div>}
                    </div>
                    <div>{getMembershipLabel(m.membership_type)}</div>
                    <div>
                      <span className={`badge badge-${status}`}>
                        {status}
                      </span>
                    </div>
                    <div>{m.start_date}</div>
                    <div style={{ fontWeight: 600 }}>{m.visits}</div>
                    <div>{m.totalRenewals}</div>
                    <div style={{ fontWeight: 600, color: 'var(--success)' }}>P{m.totalPaid.toLocaleString()}</div>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
