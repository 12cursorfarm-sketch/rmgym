'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  getMembershipLabel,
  getEffectiveStatus,
  formatDate,
} from '@/lib/utils'
import type { Member } from '@/lib/utils'

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMembers()
  }, [])

  async function loadMembers() {
    try {
      const { data } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false })
      setMembers((data || []) as Member[])
    } catch (err) {
      console.error('Error loading members:', err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.email && m.email.toLowerCase().includes(search.toLowerCase()))
    const matchesType =
      filterType === 'all' || m.membership_type === filterType
    const effectiveStatus = getEffectiveStatus(m)
    const matchesStatus =
      filterStatus === 'all' || effectiveStatus === filterStatus
    return matchesSearch && matchesType && matchesStatus
  })

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ color: 'var(--muted)', fontSize: 16 }}>Loading members...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Members</h1>
          <p className="page-subtitle">{members.length} total members</p>
        </div>
        <Link href="/members/add" className="btn btn-primary">
          + Add Member
        </Link>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          type="text"
          className="input"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <select
          className="input"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ maxWidth: 160 }}
        >
          <option value="all">All Types</option>
          <option value="1day">1 Day</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <select
          className="input"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ maxWidth: 160 }}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-row table-header">
          <div>Name</div>
          <div>Email</div>
          <div>Type</div>
          <div>End Date</div>
          <div>Status</div>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            {members.length === 0 ? 'No members yet. Add your first member!' : 'No members match your filters.'}
          </div>
        ) : (
          filtered.map((member) => {
            const status = getEffectiveStatus(member)
            return (
              <Link
                key={member.id}
                href={`/members/${member.id}`}
                className="table-row"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {member.photo ? (
                    <img
                      src={member.photo}
                      alt={member.name}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: 'var(--surface-hover)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--muted)',
                        fontSize: 14,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span style={{ fontWeight: 500 }}>{member.name}</span>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 14 }}>
                  {member.email || '-'}
                </div>
                <div>
                  <span className={`badge badge-${member.membership_type}`}>
                    {getMembershipLabel(member.membership_type)}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--muted)' }}>
                  {formatDate(member.end_date)}
                </div>
                <div>
                  <span className={`badge badge-${status}`}>{status}</span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
