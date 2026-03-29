import { useMemo } from 'react'

/**
 * PasswordStrengthBar
 * Props:
 *   password: string  — the current password value
 */
export default function PasswordStrengthBar({ password }) {
  const score = useMemo(() => {
    if (!password) return 0
    let s = 0
    if (password.length >= 8)  s++
    if (password.length >= 14) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    return s
  }, [password])

  const labels = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong']
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4']
  const widths = [0, 20, 40, 60, 80, 100]

  if (!password) return null

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{
        height: 4,
        borderRadius: 9999,
        background: 'var(--border)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${widths[score]}%`,
          background: colors[score],
          borderRadius: 9999,
          transition: 'width 0.3s ease, background 0.3s ease',
        }} />
      </div>
      <div style={{
        fontSize: 11,
        color: colors[score],
        marginTop: 4,
        fontWeight: 600,
        transition: 'color 0.3s ease',
      }}>
        {labels[score]}
      </div>
    </div>
  )
}
