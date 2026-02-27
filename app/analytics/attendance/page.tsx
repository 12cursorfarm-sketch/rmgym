'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Attendance } from '@/lib/utils'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'

export default function AttendanceAnalytics() {
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const { data } = await supabase.from('attendance').select('*').order('date', { ascending: true })
      setAttendance((data || []) as Attendance[])
    } catch (err) {
      console.error('Error loading attendance data:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <div style={{ color: 'var(--muted)', fontSize: 16 }}>Loading attendance data...</div>
      </div>
    )
  }

  // Calculate Daily Trends
  const dailyMap: Record<string, number> = {}
  attendance.forEach(a => {
    dailyMap[a.date] = (dailyMap[a.date] || 0) + 1
  })
  
  // Get last 30 days
  const sortedDates = Object.keys(dailyMap).sort()
  const recentDates = sortedDates.slice(-30)
  const dailyData = recentDates.map(date => ({
    date,
    checkIns: dailyMap[date]
  }))

  // Busiest Day of Week
  const dayOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dowMap: Record<string, number> = {}
  dayOfWeekNames.forEach(d => dowMap[d] = 0)
  
  attendance.forEach(a => {
    const dow = new Date(a.date).getDay()
    dowMap[dayOfWeekNames[dow]] += 1
  })
  const dowData = dayOfWeekNames.map(d => ({ day: d.substring(0, 3), count: dowMap[d] }))
  
  // Find busiest day
  let busiestDay = { name: '-', count: 0 }
  Object.keys(dowMap).forEach(d => {
    if (dowMap[d] > busiestDay.count) {
      busiestDay = { name: d, count: dowMap[d] }
    }
  })

  // Hourly Distribution
  const hourlyMap: Record<number, number> = {}
  for (let i = 5; i <= 23; i++) hourlyMap[i] = 0 // Assume gym open 5 AM to 11 PM
  
  attendance.forEach(a => {
    if (a.check_in_time) {
      const dbDate = new Date(a.check_in_time)
      const hour = dbDate.getHours()
      if (hourlyMap[hour] !== undefined) {
        hourlyMap[hour] += 1
      }
    }
  })
  
  const hourlyData = Object.keys(hourlyMap).map(h => {
    const hour = parseInt(h)
    const label = `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'pm' : 'am'}`
    return { hour: label, count: hourlyMap[hour] }
  })

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div className="stat-card">
          <div className="stat-label">Total Lifetime Visits</div>
          <div className="stat-value">{attendance.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Daily Visits</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>
            {sortedDates.length > 0 ? Math.round(attendance.length / sortedDates.length) : 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Busiest Day</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {busiestDay.name} <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>({busiestDay.count})</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>Daily Checking Trends (Last 30 Active Days)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
            <XAxis dataKey="date" stroke="var(--muted)" fontSize={12} tickMargin={10} 
                   tickFormatter={(val) => {
                     const d = new Date(val);
                     return `${d.getMonth()+1}/${d.getDate()}`
                   }} />
            <YAxis stroke="var(--muted)" fontSize={12} allowDecimals={false} />
            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
            <Line type="monotone" dataKey="checkIns" name="Check-ins" stroke="var(--accent)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>
        <div className="card">
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>Visits by Day of Week</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted)" fontSize={12} tickMargin={10} />
              <YAxis stroke="var(--muted)" fontSize={12} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'var(--surface-hover)' }} contentStyle={{ borderRadius: 8 }} />
              <Bar dataKey="count" name="Visits" fill="#8884d8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600 }}>Hourly Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="hour" stroke="var(--muted)" fontSize={11} tickMargin={10} interval={1} />
              <YAxis stroke="var(--muted)" fontSize={12} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'var(--surface-hover)' }} contentStyle={{ borderRadius: 8 }} />
              <Bar dataKey="count" name="Visits" fill="#82ca9d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
