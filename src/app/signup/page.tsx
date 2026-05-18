'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('PASSWORDS_DO_NOT_MATCH')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface)]">
      <div className="w-full px-4" style={{ maxWidth: 360 }}>

        {/* Header */}
        <div className="mb-8">
          <div className="label-caps tracking-widest mb-1" style={{ color: 'var(--teal)', fontSize: 11 }}>
            MARATHON_OS
          </div>
          <div className="label-caps" style={{ color: 'var(--on-surface)', fontSize: 18, fontWeight: 700 }}>
            CREATE_ACCOUNT
          </div>
          <div className="label-caps mt-1" style={{ color: 'var(--on-surface-variant)', fontSize: 10 }}>
            REGISTER NEW ATHLETE PROFILE
          </div>
        </div>

        {/* Card */}
        <div
          className="p-6"
          style={{
            border: '1px solid var(--outline-variant)',
            backgroundColor: 'var(--surface-container-lowest)',
          }}
        >
          {success ? (
            <div className="label-caps text-center py-4" style={{ color: 'var(--teal)', fontSize: 11, lineHeight: 1.8 }}>
              CHECK_YOUR_EMAIL
              <br />
              <span style={{ color: 'var(--on-surface-variant)' }}>CONFIRMATION LINK SENT</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              <label className="flex flex-col gap-1.5">
                <span className="label-caps" style={{ color: 'var(--on-surface-variant)', fontSize: 10 }}>
                  EMAIL_ADDRESS
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="code-data bg-transparent outline-none w-full px-3 py-2"
                  style={{
                    border: '1px solid var(--outline-variant)',
                    color: 'var(--on-surface)',
                    fontSize: 14,
                    caretColor: 'var(--teal)',
                  }}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="label-caps" style={{ color: 'var(--on-surface-variant)', fontSize: 10 }}>
                  PASSWORD
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="code-data bg-transparent outline-none w-full px-3 py-2"
                  style={{
                    border: '1px solid var(--outline-variant)',
                    color: 'var(--on-surface)',
                    fontSize: 14,
                    caretColor: 'var(--teal)',
                  }}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="label-caps" style={{ color: 'var(--on-surface-variant)', fontSize: 10 }}>
                  CONFIRM_PASSWORD
                </span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="code-data bg-transparent outline-none w-full px-3 py-2"
                  style={{
                    border: '1px solid var(--outline-variant)',
                    color: 'var(--on-surface)',
                    fontSize: 14,
                    caretColor: 'var(--teal)',
                  }}
                />
              </label>

              {error && (
                <div className="label-caps" style={{ color: 'var(--error)', fontSize: 10 }}>
                  ERR: {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="label-caps w-full py-2.5 mt-1 transition-opacity"
                style={{
                  backgroundColor: 'var(--teal)',
                  color: 'var(--on-teal)',
                  fontSize: 11,
                  opacity: loading ? 0.5 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  border: 'none',
                }}
              >
                {loading ? 'CREATING_ACCOUNT…' : 'CREATE_ACCOUNT →'}
              </button>
            </form>
          )}
        </div>

        {/* Footer link */}
        <div className="mt-4 text-center">
          <Link
            href="/login"
            className="label-caps transition-colors"
            style={{ color: 'var(--on-surface-variant)', fontSize: 10 }}
          >
            ALREADY_HAVE_ACCOUNT? <span style={{ color: 'var(--teal)' }}>SIGN_IN →</span>
          </Link>
        </div>

      </div>
    </div>
  )
}
