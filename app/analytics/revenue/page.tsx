'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getMembershipLabel } from '@/lib/utils'
import type { Member, Renewal } from '@/lib/utils'
import {
  BarChart,
  Bar,
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

const COLORS = ['#10b981', '#18181b', '#f59e0b', '#8884d8', '#82ca9d']

export default function RevenueAnalytics() {
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
        supabase.from('renewals').select('*') // Might fail if table not created, ignore error for now
      ])

      setMembers((membersRes.data || []) as Member[])
      setRenewals((renewalsRes.data || []) as Renewal[])
    } catch (err) {
      console.error('Error loading revenue data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <div style={{ color: 'var(--muted)', fontSize: 16 }}>Loading revenue data...</div>
      </div>
    )
  }

  // Calculate total revenue from new members
  const newRevenue = members.reduce((sum, m) => sum + Number(m.payment || 0), 0)
  // Calculate total revenue from renewals
  const renewalRevenue = renewals.reduce((sum, r) => sum + Number(r.amount || 0), 0)
  const totalRevenue = newRevenue + renewalRevenue

  // Source breakdown
  const sourceData = [
    { name: 'New Signups', value: newRevenue },
    { name: 'Renewals', value: renewalRevenue }
  ].filter(d => d.value > 0)

  // Membership type breakdown (combining new + renewals)
  const typeMap: Record<string, number> = {}
  members.forEach(m => {
    const label = getMembershipLabel(m.membership_type)
    typeMap[label] = (typeMap[label] || 0) + Number(m.payment || 0)
  })
  renewals.forEach(r => {
    const label = getMembershipLabel(r.membership_type)
    typeMap[label] = (typeMap[label] || 0) + Number(r.amount || 0)
  })
  const typeData = Object.keys(typeMap).map(k => ({ name: k, value: typeMap[k] }))

  // Month-over-month (simple aggregation based on created_at dates)
  const monthMap: Record<string, number> = {}
  members.forEach(m => {
    const month = m.created_at.substring(0, 7) // YYYY-MM
    monthMap[month] = (monthMap[month] || 0) + Number(m.payment || 0)
  })
  renewals.forEach(r => {
    const month = r.created_at.substring(0, 7)
    monthMap[month] = (monthMap[month] || 0) + Number(r.amount || 0)
  })
  const momData = Object.keys(monthMap).sort().map(k => ({
    month: k,
    revenue: monthMap[k]
  }))

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-label">Total Lifetime Revenue</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            P{totalRevenue.toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">New Signups Revenue</div>
          <div className="stat-value">
            P{newRevenue.toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Renewals Revenue</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>
            P{renewalRevenue.toLocaleString()}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>Month-over-Month Revenue</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={momData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--muted)" fontSize={12} tickMargin={10} />
              <YAxis stroke="var(--muted)" fontSize={12} tickFormatter={(val) => `P${val}`} />
              <Tooltip 
                cursor={{ fill: 'var(--surface-hover)' }}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} 
                formatter={(value: any) => [`P${Number(value).toLocaleString()}`, 'Revenue']}
              />
              <Bar dataKey="revenue" fill="var(--success)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>Revenue Breakdown</h3>
          <div style={{ display: 'flex', flex: 1, gap: 16 }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginBottom: 8 }}>By Source</h4>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={sourceData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} dataKey="value" stroke="none">
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `P${Number(value).toLocaleString()}`} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginBottom: 8 }}>By Plan</h4>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={typeData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} dataKey="value" stroke="none">
                    {typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `P${Number(value).toLocaleString()}`} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
