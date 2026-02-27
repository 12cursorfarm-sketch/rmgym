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

      const weekAttData = weekDays.map((wd) => ({
        day: wd.label,
        count: attendanceData.filter((a) => a.date === wd.date).length,
      }))
      setWeeklyAttendance(weekAttData)

      const weekSalesData = weekDays.map((wd) => ({
        day: wd.label,
        count: membersData
          .filter((m) => m.created_at.startsWith(wd.date))
          .reduce((sum, m) => sum + Number(m.payment), 0),
      }))
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
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  color: 'var(--foreground)',
                }}
              />
              <Bar dataKey="count" fill="var(--accent)" radius={[6, 6, 0, 0]} name="Check-ins" />
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
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  color: 'var(--foreground)',
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`P${Number(value).toLocaleString()}`, 'Revenue']}
              />
              <Bar dataKey="count" fill="var(--success)" radius={[6, 6, 0, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
