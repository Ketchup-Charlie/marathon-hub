import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ run_id: string }>
}) {
  const { run_id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: 'var(--surface)' }}>
        <span className="label-caps text-[var(--on-surface-variant)]">NOT_AUTHENTICATED</span>
      </div>
    )
  }

  const { data: run } = await supabase
    .from('completed_runs')
    .select('id, date, title, total_distance, avg_pace, avg_hr, total_time, run_type_tag')
    .eq('id', run_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!run) {
    return (
      <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--surface)' }}>
        <div
          className="flex items-center px-4 flex-shrink-0"
          style={{
            height: 36,
            backgroundColor: 'var(--surface-container-low)',
            borderBottom: '1px solid var(--outline-variant)',
          }}
        >
          <span className="label-caps text-[var(--teal)]">RUN_ANALYSIS</span>
          <span className="label-caps text-[var(--on-surface-variant)] ml-2">:: RUN_NOT_FOUND</span>
        </div>
        <div className="flex items-center justify-center flex-1 gap-4">
          <span className="label-caps text-[var(--on-surface-variant)]">RUN_NOT_FOUND</span>
          <Link
            href="/dashboard/run-analysis"
            className="label-caps px-3 py-1.5 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors"
            style={{ border: '1px solid var(--outline-variant)', textDecoration: 'none' }}
          >
            ← BACK_TO_LOG
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--surface)' }}>

      {/* Status bar */}
      <div
        className="flex items-center justify-between px-4 flex-shrink-0"
        style={{
          height: 36,
          backgroundColor: 'var(--surface-container-low)',
          borderBottom: '1px solid var(--outline-variant)',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="label-caps text-[var(--teal)]">RUN_ANALYSIS</span>
          <span className="label-caps text-[var(--on-surface-variant)]">::</span>
          <span className="label-caps text-[var(--on-surface)]">{run.date}</span>
          {run.title && (
            <span className="label-caps text-[var(--on-surface-variant)]">{run.title}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {run.total_distance != null && (
            <span className="label-caps text-[var(--on-surface-variant)]">
              DIST: <span className="text-[var(--on-surface)]">{run.total_distance.toFixed(2)} km</span>
            </span>
          )}
          {run.avg_pace && (
            <span className="label-caps text-[var(--on-surface-variant)]">
              PACE: <span className="text-[var(--on-surface)]">{run.avg_pace}</span>
            </span>
          )}
          {run.avg_hr != null && (
            <span className="label-caps text-[var(--on-surface-variant)]">
              HR: <span className="text-[var(--on-surface)]">{Math.round(run.avg_hr)} bpm</span>
            </span>
          )}
          <Link
            href="/dashboard/run-analysis"
            className="label-caps px-3 py-1 text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors"
            style={{ border: '1px solid var(--outline-variant)', textDecoration: 'none' }}
          >
            ← LOG
          </Link>
        </div>
      </div>

      {/* Placeholder content */}
      <div className="flex items-center justify-center flex-1">
        <span className="label-caps text-[var(--on-surface-variant)]" style={{ opacity: 0.4 }}>
          DEEP_DIVE_COMING_SOON
        </span>
      </div>

    </div>
  )
}
