"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  CalendarDays,
  TrendingUp,
  Activity,
  Package,
  Zap,
  CalendarClock,
  ScrollText,
  Stethoscope,
  Bell,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

/* ─── Nav data ──────────────────────────────────────────── */

const PRIMARY_NAV = [
  { label: "DASHBOARD",       href: "/dashboard",                icon: LayoutDashboard },
  { label: "TRAINING_BLOCKS", href: "/dashboard/training-blocks",icon: CalendarDays    },
  { label: "RUN_ANALYSIS",    href: "/dashboard/run-analysis",   icon: TrendingUp      },
  { label: "BIOMETRIC_LOG",   href: "/dashboard/biometric-log",  icon: Activity        },
  { label: "GEAR_LAB",        href: "/dashboard/gear-lab",       icon: Package         },
  { label: "RECOVERY_SCORE",  href: "/dashboard/recovery-score", icon: Zap             },
  { label: "SCHEDULE_ENGINE", href: "/dashboard/schedule-engine",icon: CalendarClock   },
]

const BOTTOM_NAV = [
  { label: "SYSTEM_LOGS",  href: "/dashboard/system-logs",  icon: ScrollText   },
  { label: "DIAGNOSTICS",  href: "/dashboard/diagnostics",  icon: Stethoscope  },
]

const TOP_TABS = [
  { label: "LIVE_METRICS",    href: "/dashboard"                 },
  { label: "TRAINING_PLAN",   href: "/dashboard/training-blocks" },
  { label: "RUN_ANALYSIS",    href: "/dashboard/run-analysis"    },
  { label: "GEAR_LAB",        href: "/dashboard/gear-lab"        },
  { label: "SCHEDULE_ENGINE", href: "/dashboard/schedule-engine" },
]

/* ─── Sidebar item ──────────────────────────────────────── */

function SidebarItem({
  label,
  href,
  icon: Icon,
  active,
}: {
  label: string
  href: string
  icon: React.ElementType
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 label-caps transition-colors",
        active
          ? "bg-[var(--teal)] text-[var(--on-teal)]"
          : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container)]"
      )}
    >
      <Icon size={14} strokeWidth={1.5} />
      <span>{label}</span>
    </Link>
  )
}

/* ─── Top tab ───────────────────────────────────────────── */

function TopTab({
  label,
  href,
  active,
}: {
  label: string
  href: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "label-caps px-4 py-3 border-b-2 transition-colors whitespace-nowrap",
        active
          ? "border-[var(--teal)] text-[var(--teal)]"
          : "border-transparent text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]"
      )}
    >
      {label}
    </Link>
  )
}

/* ─── Layout ────────────────────────────────────────────── */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const activeTop = TOP_TABS.reduce<(typeof TOP_TABS)[0] | null>((best, tab) => {
    if (!pathname.startsWith(tab.href)) return best
    if (!best || tab.href.length > best.href.length) return tab
    return best
  }, null)

  return (
    <div className="flex h-full bg-[var(--surface)] text-[var(--on-surface)]">

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className="flex flex-col flex-shrink-0 border-r border-[var(--outline-variant)]"
        style={{ width: 164, backgroundColor: "var(--surface-container-lowest)" }}
      >
        {/* Logo / app name */}
        <div className="px-3 pt-4 pb-3 border-b border-[var(--outline-variant)]">
          <div className="label-caps text-[var(--teal)] tracking-widest">MARATHON_OS</div>
          <div className="mt-1 text-[10px] text-[var(--on-surface-variant)] uppercase tracking-wide">
            ATHLETE_ID_01
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span
              className="inline-block"
              style={{ width: 6, height: 6, backgroundColor: "var(--teal)", flexShrink: 0 }}
            />
            <span className="text-[10px] text-[var(--teal)] uppercase tracking-wide">
              STATUS: OPTIMAL
            </span>
          </div>
        </div>

        {/* Primary nav */}
        <nav className="flex-1 flex flex-col gap-px py-2">
          {PRIMARY_NAV.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href)
            return (
              <SidebarItem
                key={item.href}
                label={item.label}
                href={item.href}
                icon={item.icon}
                active={active}
              />
            )
          })}
        </nav>

        {/* Bottom nav */}
        <div className="flex flex-col gap-px border-t border-[var(--outline-variant)] py-2">
          {BOTTOM_NAV.map((item) => (
            <SidebarItem
              key={item.href}
              label={item.label}
              href={item.href}
              icon={item.icon}
              active={pathname.startsWith(item.href)}
            />
          ))}
        </div>

        {/* Status footer */}
        <div
          className="px-3 py-2 border-t border-[var(--outline-variant)]"
          style={{ backgroundColor: "var(--surface-container-lowest)" }}
        >
          <span className="text-[9px] uppercase tracking-widest text-[var(--on-surface-variant)]">
            SYSTEM_V0.1&nbsp;// PAGE_CALC_READY
          </span>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Top nav bar */}
        <header
          className="flex items-stretch border-b border-[var(--outline-variant)] flex-shrink-0"
          style={{ backgroundColor: "var(--surface-container-lowest)", height: 44 }}
        >
          {/* Tabs */}
          <nav className="flex items-stretch flex-1">
            {TOP_TABS.map((tab) => (
              <TopTab
                key={tab.href}
                label={tab.label}
                href={tab.href}
                active={activeTop?.href === tab.href}
              />
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1 px-3 border-l border-[var(--outline-variant)]">
            <button
              aria-label="Notifications"
              className="p-1.5 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors"
            >
              <Bell size={16} strokeWidth={1.5} />
            </button>
            <button
              aria-label="Settings"
              className="p-1.5 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors"
            >
              <Settings size={16} strokeWidth={1.5} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>

      </div>
    </div>
  )
}
