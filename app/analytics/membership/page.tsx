'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getMembershipLabel, getEffectiveStatus } from '@/lib/utils'
import type { Member, Renewal } from '@/lib/utils'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE']

export default function MembershipAnalytics() {
  const [members, setMembers] = useState<Member[]>([])
  const [renewals, setRenewals] = useState<Renewal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [membersRes, renewalsRes] = await Promise.all([
        supabase.from('members').select('*'),
        supabase.from('renewals').select('*')
      ])

      setMembers((membersRes.data || []) as Member[])
      setRenewals((renewalsRes.data || []) as Renewal[])
    } catch (err) {
      console.error('Error loading membership data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <div style={{ color: 'var(--muted)', fontSize: 16 }}>Loading membership data...</div>
      </div>
    )
  }

  // Key Metrics
  const totalMembers = members.length
  const activeMembers = members.filter(m => getEffectiveStatus(m) === 'active').length
  const expiredMembers = members.filter(m => getEffectiveStatus(m) === 'expired').length
  const suspendedMembers = members.filter(m => getEffectiveStatus(m) === 'suspended').length

  const churnRate = totalMembers > 0 ? (expiredMembers / totalMembers) * 100 : 0
  const uniqueRenewedMembers = new Set(renewals.map(r => r.member_id)).size
  const renewalRate = totalMembers > 0 ? (uniqueRenewedMembers / totalMembers) * 100 : 0

  // Growth over time (cumulative members based on start_date)
  const growthMap: Record<string, number> = {}
  members.forEach(m => {
    const month = m.start_date.substring(0, 7)
    growthMap[month] = (growthMap[month] || 0) + 1
  })
  
  const sortedMonths = Object.keys(growthMap).sort()
  let runningTotal = 0
  const growthData = sortedMonths.map(month => {
    runningTotal += growthMap[month]
    return { month, cumulative: runningTotal, new: growthMap[month] }
  })

  // Membership Type Distribution
  const typeMap: Record<string, number> = {}
  members.forEach(m => {
    const label = getMembershipLabel(m.membership_type)
    typeMap[label] = (typeMap[label] || 0) + 1
  })
  const typeData = Object.keys(typeMap).map(k => ({ name: k, value: typeMap[k] }))

  // Status Distribution
  const statusData = [
    { name: 'Active', value: activeMembers },
    { name: 'Expired', value: expiredMembers },
    { name: 'Suspended', value: suspendedMembers },
  ].filter(d => d.value > 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-label">Total Members</div>
          <div className="stat-value">{totalMembers}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Members</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{activeMembers}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Churn Rate</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{churnRate.toFixed(1)}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Renewal Rate</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{renewalRate.toFixed(1)}%</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>Membership Growth</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={growthData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--muted)" fontSize={12} tickMargin={10} />
            <YAxis stroke="var(--muted)" fontSize={12} allowDecimals={false} />
            <Tooltip 
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="cumulative" name="Total Members" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="new" name="New Signups" stroke="var(--success)" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        <div className="card">
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, textAlign: 'center' }}>By Type</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={typeData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" stroke="none">
                {typeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, textAlign: 'center' }}>By Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" stroke="none">
                <Cell fill="var(--success)" />
                <Cell fill="var(--danger)" />
                <Cell fill="var(--warning)" />
              </Pie>
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
