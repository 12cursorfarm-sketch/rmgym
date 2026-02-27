'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const analyticsTabs = [
  { name: 'Revenue', href: '/analytics/revenue' },
  { name: 'Membership', href: '/analytics/membership' },
  { name: 'Attendance', href: '/analytics/attendance' },
  { name: 'Member History', href: '/analytics/history' },
  { name: 'Attendance Log', href: '/analytics/attendance-log' },
  { name: 'Renewal Log', href: '/analytics/renewal-log' },
]

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Analytics & Reports</h1>
        <p className="page-subtitle">Deep dive into your gym's data</p>
      </div>

      <div className="tabs">
        {analyticsTabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`tab ${isActive ? 'active' : ''}`}
            >
              {tab.name}
            </Link>
          )
        })}
      </div>

      <div>{children}</div>
    </div>
  )
}
