'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Member, Attendance } from '@/lib/utils'

interface LogEntry extends Attendance {
  member_name: string
}

export default function AttendanceLogAnalytics() {
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [membersMap, setMembersMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [attRes, memRes] = await Promise.all([
        supabase.from('attendance').select('*').order('check_in_time', { ascending: false }),
        supabase.from('members').select('id, name')
      ])

      setAttendance((attRes.data || []) as Attendance[])
      
      const map: Record<string, string> = {}
      ;(memRes.data || []).forEach(m => {
        map[m.id] = m.name
      })
      setMembersMap(map)
    } catch (err) {
      console.error('Error loading attendance log:', err)
    } finally {
      setLoading(false)
    }
  }

  const tableData = useMemo(() => {
    return attendance.map(a => ({
      ...a,
      member_name: membersMap[a.member_id] || 'Unknown Member'
    })).filter(a => {
      const matchSearch = a.member_name.toLowerCase().includes(search.toLowerCase())
      const matchDate = dateFilter ? a.date === dateFilter : true
      return matchSearch && matchDate
    })
  }, [attendance, membersMap, search, dateFilter])

  const exportCSV = () => {
    const headers = ['Date', 'Time', 'Member Name', 'Member ID']
    const rows = tableData.map(a => [
      a.date,
      a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString() : '',
      `"${a.member_name}"`,
      a.member_id
    ])
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'attendance_log.csv'
    link.click()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <div style={{ color: 'var(--muted)', fontSize: 16 }}>Loading attendance log...</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Attendance Log</h3>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="input"
            style={{ width: '160px', padding: '8px 16px' }}
          />
          <input
            type="text"
            placeholder="Search member..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            style={{ width: '220px', padding: '8px 16px' }}
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
        <div style={{ minWidth: '700px' }}>
          <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 3fr 3fr', padding: '12px 20px', borderBottom: '2px solid var(--border-color)' }}>
            <div>Date</div>
            <div>Time</div>
            <div>Member Name</div>
            <div>Member ID</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tableData.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>No records found.</div>
            ) : (
              tableData.map((a) => (
                <div 
                  key={a.id} 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1.5fr 3fr 3fr', 
                    alignItems: 'center', 
                    padding: '16px 20px', 
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{a.date}</div>
                  <div style={{ color: 'var(--muted)' }}>
                    {a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </div>
                  <div style={{ fontWeight: 600 }}>{a.member_name}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'monospace' }}>{a.member_id}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
