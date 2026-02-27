'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { getMembershipLabel } from '@/lib/utils'
import type { Renewal } from '@/lib/utils'
import Link from 'next/link'

interface RenewalEntry extends Renewal {
  member_name: string
}

export default function RenewalLogAnalytics() {
  const [renewals, setRenewals] = useState<Renewal[]>([])
  const [membersMap, setMembersMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [renewalsRes, memRes] = await Promise.all([
        supabase.from('renewals').select('*').order('created_at', { ascending: false }),
        supabase.from('members').select('id, name')
      ])

      setRenewals((renewalsRes.data || []) as Renewal[])
      
      const map: Record<string, string> = {}
      ;(memRes.data || []).forEach(m => {
        map[m.id] = m.name
      })
      setMembersMap(map)
    } catch (err) {
      console.error('Error loading renewals log:', err)
    } finally {
      setLoading(false)
    }
  }

  const tableData = useMemo(() => {
    return renewals.map(r => ({
      ...r,
      member_name: membersMap[r.member_id] || 'Unknown Member'
    })).filter(r => 
      r.member_name.toLowerCase().includes(search.toLowerCase())
    )
  }, [renewals, membersMap, search])

  const exportCSV = () => {
    const headers = ['Date', 'Member Name', 'Type', 'Amount', 'Before End Date', 'After End Date']
    const rows = tableData.map(r => [
      new Date(r.created_at).toLocaleDateString(),
      `"${r.member_name}"`,
      getMembershipLabel(r.membership_type),
      r.amount,
      r.before_end_date,
      r.after_end_date
    ])
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'renewal_log.csv'
    link.click()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <div style={{ color: 'var(--muted)', fontSize: 16 }}>Loading renewal log...</div>
      </div>
    )
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Renewal History Log</h3>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search member..."
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
          <div className="table-header" style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 1fr 1.5fr 1.5fr', padding: '12px 20px', borderBottom: '2px solid var(--border-color)' }}>
            <div>Date</div>
            <div>Member Name</div>
            <div>Type</div>
            <div>Amount Paid</div>
            <div>Valid From</div>
            <div>Valid Until</div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {tableData.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>No renewals found.</div>
            ) : (
              tableData.map((r) => (
                <div 
                  key={r.id} 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1.5fr 2fr 1fr 1fr 1.5fr 1.5fr', 
                    alignItems: 'center', 
                    padding: '16px 20px', 
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ color: 'var(--muted)' }}>
                    {new Date(r.created_at).toLocaleString('en-US', { 
                      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                    })}
                  </div>
                  <div>
                    <Link href={`/analytics/${r.member_id}`} style={{ fontWeight: 600, color: 'var(--foreground)', textDecoration: 'none' }}>
                      {r.member_name}
                    </Link>
                  </div>
                  <div>{getMembershipLabel(r.membership_type)}</div>
                  <div style={{ fontWeight: 600, color: 'var(--success)' }}>P{Number(r.amount).toLocaleString()}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>{r.before_end_date}</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{r.after_end_date}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
