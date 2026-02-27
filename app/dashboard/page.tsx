'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getTodayStr, getWeekDays, getEffectiveStatus } from '@/lib/utils'
import type { Member, Attendance } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface WeekData {
  day: string
  count: number
}

export default function DashboardPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [weeklyAttendance, setWeeklyAttendance] = useState<WeekData[]>([])
  const [weeklySales, setWeeklySales] = useState<WeekData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [membersRes, attendanceRes] = await Promise.all([
        supabase.from('members').select('*'),
        supabase.from('attendance').select('*'),
      ])

      const membersData = (membersRes.data || []) as Member[]
      const attendanceData = (attendanceRes.data || []) as Attendance[]

      setMembers(membersData)
      setAttendance(attendanceData)

      // Calculate weekly data
      const weekDays = getWeekDays()

      const weekAttData = weekDays.map((wd) => {
        const dayAtt = attendanceData.filter((a) => a.date === wd.date)
        let dayCount = 0
        let weeklyCount = 0
        let monthlyCount = 0

        dayAtt.forEach((a) => {
          const m = membersData.find((mem) => mem.id === a.member_id)
          if (m) {
            if (m.membership_type === '1day') dayCount++
            if (m.membership_type === 'weekly') weeklyCount++
            if (m.membership_type === 'monthly') monthlyCount++
          }
        })

        return {
          day: wd.label,
          count: dayAtt.length,
          dayCount,
          weeklyCount,
          monthlyCount,
        }
      })
      setWeeklyAttendance(weekAttData)

      const weekSalesData = weekDays.map((wd) => {
        const dayMembers = membersData.filter((m) =>
          m.created_at.startsWith(wd.date)
        )
        
        let total = 0
        let dayCount = 0
        let weeklyCount = 0
        let monthlyCount = 0

        dayMembers.forEach((m) => {
          const pay = Number(m.payment)
          total += pay
          if (m.membership_type === '1day') dayCount += pay
          if (m.membership_type === 'weekly') weeklyCount += pay
          if (m.membership_type === 'monthly') monthlyCount += pay
        })

        return {
          day: wd.label,
          count: total,
          dayCount,
          weeklyCount,
          monthlyCount,
        }
      })
      setWeeklySales(weekSalesData)
    } catch (err) {
      console.error('Error loading dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  const today = getTodayStr()

  const activeMembers = members.filter(
    (m) => getEffectiveStatus(m) === 'active'
  )

  const expiringIn7Days = members.filter((m) => {
    const status = getEffectiveStatus(m)
    if (status !== 'active') return false
    const endDate = new Date(m.end_date)
    const now = new Date()
    const diffDays = Math.ceil(
      (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
    return diffDays >= 0 && diffDays <= 7
  })

  const todayCheckins = attendance.filter((a) => a.date === today)

  const todayRevenue = members
    .filter((m) => m.created_at.startsWith(today))
    .reduce((sum, m) => sum + Number(m.payment), 0)

  // Monthly revenue: members created this month
  const currentMonth = today.substring(0, 7)
  const monthlyRevenue = members
    .filter((m) => m.created_at.startsWith(currentMonth))
    .reduce((sum, m) => sum + Number(m.payment), 0)

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ color: 'var(--muted)', fontSize: 16 }}>Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Overview of your gym activity</p>
      </div>

      {/* Stat Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        <div className="stat-card">
          <div className="stat-label">Active Members</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {activeMembers.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Expiring in 7 Days</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>
            {expiringIn7Days.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Today&apos;s Check-ins</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>
            {todayCheckins.length}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Today&apos;s Revenue</div>
          <div className="stat-value">
            P{todayRevenue.toLocaleString()}
          </div>

          <div className="stat-label">Monthly Revenue</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            P{monthlyRevenue.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: 24,
        }}
      >
        {/* Weekly Attendance Chart */}
        <div className="card">
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>
            Weekly Attendance
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyAttendance}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="day" stroke="var(--muted)" fontSize={12} />
              <YAxis stroke="var(--muted)" fontSize={12} allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 8,
                          padding: '12px',
                          color: 'var(--foreground)',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                          minWidth: '150px',
                        }}
                      >
                        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
                          {label}
                        </p>
                        <div
                          style={{
                            paddingBottom: '8px',
                            marginBottom: '8px',
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '24px',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>Total Check-ins:</span>
                          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                            {data.count}
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            fontSize: '13px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--muted)' }}>1 Day:</span>
                            <span style={{ color: '#8884d8' }}>{data?.dayCount || 0}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--muted)' }}>Weekly:</span>
                            <span style={{ color: '#82ca9d' }}>{data?.weeklyCount || 0}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--muted)' }}>Monthly:</span>
                            <span style={{ color: '#ffc658' }}>{data?.monthlyCount || 0}</span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="dayCount" stackId="a" fill="#8884d8" name="1 Day" />
              <Bar dataKey="weeklyCount" stackId="a" fill="#82ca9d" name="Weekly" />
              <Bar dataKey="monthlyCount" stackId="a" fill="#ffc658" name="Monthly" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Sales Chart */}
        <div className="card">
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>
            Weekly Sales
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklySales}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="day" stroke="var(--muted)" fontSize={12} />
              <YAxis stroke="var(--muted)" fontSize={12} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 8,
                          padding: '12px',
                          color: 'var(--foreground)',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                          minWidth: '150px',
                        }}
                      >
                        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
                          {label}
                        </p>
                        <div
                          style={{
                            paddingBottom: '8px',
                            marginBottom: '8px',
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '24px',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>Total Revenue:</span>
                          <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                            P{data.count.toLocaleString()}
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            fontSize: '13px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--muted)' }}>1 Day:</span>
                            <span style={{ color: '#8884d8' }}>P{(data?.dayCount || 0).toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--muted)' }}>Weekly:</span>
                            <span style={{ color: '#82ca9d' }}>P{(data?.weeklyCount || 0).toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--muted)' }}>Monthly:</span>
                            <span style={{ color: '#ffc658' }}>P{(data?.monthlyCount || 0).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar dataKey="dayCount" stackId="a" fill="#8884d8" name="1 Day" />
              <Bar dataKey="weeklyCount" stackId="a" fill="#82ca9d" name="Weekly" />
              <Bar dataKey="monthlyCount" stackId="a" fill="#ffc658" name="Monthly" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
