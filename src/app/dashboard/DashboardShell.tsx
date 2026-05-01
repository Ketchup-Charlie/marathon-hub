"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useMemo } from "react"
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
import { calcPaces } from "@/lib/pace"

/* ─── Nav data ──────────────────────────────────────────── */

const PRIMARY_NAV = [
  { label: "DASHBOARD",       href: "/dashboard",                 icon: LayoutDashboard },
  { label: "TRAINING_BLOCKS", href: "/dashboard/training-blocks", icon: CalendarDays    },
  { label: "RUN_ANALYSIS",    href: "/dashboard/run-analysis",    icon: TrendingUp      },
  { label: "BIOMETRIC_LOG",   href: "/dashboard/biometric-log",   icon: Activity        },
  { label: "GEAR_LAB",        href: "/dashboard/gear-lab",        icon: Package         },
  { label: "RECOVERY_SCORE",  href: "/dashboard/recovery-score",  icon: Zap             },
  { label: "SCHEDULE_ENGINE", href: "/dashboard/schedule-engine", icon: CalendarClock   },
]

const BOTTOM_NAV = [
  { label: "SETTINGS",     href: "/dashboard/settings",     icon: Settings    },
  { label: "SYSTEM_LOGS",  href: "/dashboard/system-logs",  icon: ScrollText  },
  { label: "DIAGNOSTICS",  href: "/dashboard/diagnostics",  icon: Stethoscope },
]

const TOP_TABS = [
  { label: "LIVE_METRICS",    href: "/dashboard"                  },
  { label: "TRAINING_PLAN",   href: "/dashboard/training-blocks"  },
  { label: "RUN_ANALYSIS",    href: "/dashboard/run-analysis"     },
  { label: "GEAR_LAB",        href: "/dashboard/gear-lab"         },
  { label: "SCHEDULE_ENGINE", href: "/dashboard/schedule-engine"  },
]

/* ─── Readiness helpers ─────────────────────────────────── */

type ReadinessLevel = "HIGH" | "MODERATE" | "LOW" | null

function statusLabel(level: ReadinessLevel): string {
  if (level === "MODERATE") return "NOMINAL"
  if (level === "LOW")      return "CAUTION"
  return "OPTIMAL"
}

function statusColor(level: ReadinessLevel): string {
  if (level === "MODERATE" || level === "LOW") return "var(--amber)"
  return "var(--teal)"
}

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

/* ─── Shell ─────────────────────────────────────────────── */

export default function DashboardShell({
  children,
  readinessLevel,
  readinessScore,
  raceConfig,
}: {
  children: React.ReactNode
  readinessLevel: ReadinessLevel
  readinessScore: number | null
  raceConfig: { target_time: string } | null
}) {
  const pathname = usePathname()
  const [targetTime, setTargetTime] = useState(raceConfig?.target_time ?? "4:15:00")
  const paces = useMemo(() => calcPaces(targetTime), [targetTime])

  const activeTop = TOP_TABS.reduce<(typeof TOP_TABS)[0] | null>((best, tab) => {
    if (!pathname.startsWith(tab.href)) return best
    if (!best || tab.href.length > best.href.length) return tab
    return best
  }, null)

  const color = statusColor(readinessLevel)

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
              className="inline-block flex-shrink-0"
              style={{ width: 6, height: 6, backgroundColor: color }}
            />
            <span className="text-[10px] uppercase tracking-wide" style={{ color }}>
              STATUS: {statusLabel(readinessLevel)}
            </span>
          </div>
          {readinessScore != null && (
            <div className="text-[9px] text-[var(--on-surface-variant)] uppercase tracking-widest mt-0.5 pl-[10px]">
              READINESS: {readinessScore}
            </div>
          )}
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
        <main className="flex-1 overflow-auto min-h-0">
          {children}
        </main>

        {/* ── PACE_CALC_V2 footer ──────────────────────────── */}
        <div
          className="flex items-center gap-6 px-4 flex-shrink-0"
          style={{
            height: 40,
            backgroundColor: "var(--surface-container-low)",
            borderTop: "1px solid var(--outline-variant)",
          }}
        >
          <span className="label-caps flex-shrink-0" style={{ color: "var(--teal)" }}>
            PACE_CALC_V2
          </span>

          <div className="flex items-center gap-2">
            <span className="label-caps text-[var(--on-surface-variant)]">TARGET_TIME:</span>
            <input
              type="text"
              value={targetTime}
              onChange={(e) => setTargetTime(e.target.value)}
              className="code-data text-[var(--teal)] bg-transparent outline-none w-24"
              style={{
                borderBottom: "1px solid var(--outline-variant)",
                caretColor: "var(--teal)",
              }}
              placeholder="h:mm:ss"
              spellCheck={false}
            />
          </div>

          <div className="flex items-center gap-6 ml-auto">
            {paces && (
              <>
                <span className="label-caps text-[var(--on-surface-variant)]">
                  MP: <span className="text-[var(--on-surface)]">{paces.mp}</span>
                </span>
                <span className="label-caps text-[var(--on-surface-variant)]">
                  TEMPO: <span className="text-[var(--on-surface)]">{paces.tempo}</span>
                </span>
                <span className="label-caps text-[var(--on-surface-variant)]">
                  INT: <span className="text-[var(--amber)]">{paces.int}</span>
                </span>
                <span className="label-caps text-[var(--on-surface-variant)]">
                  EASY: <span className="text-[var(--on-surface)]">{paces.easy}</span>
                </span>
              </>
            )}
            <div
              className="flex items-center gap-4 pl-4"
              style={{ borderLeft: "1px solid var(--outline-variant)" }}
            >
              <span className="text-[9px] uppercase tracking-widest text-[var(--on-surface-variant)]">
                PACE_CALCULATOR_V1.0
              </span>
              <span className="text-[9px] uppercase tracking-widest text-[var(--on-surface-variant)]">
                LATENCY: 12MS
              </span>
              <span className="text-[9px] uppercase tracking-widest text-[var(--on-surface-variant)]">
                CORE_TEMP: 36.5C
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
