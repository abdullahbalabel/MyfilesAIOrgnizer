import { useState, useEffect } from 'react'
import { Key, Save, CheckCircle2, XCircle, Loader2, Info } from 'lucide-react'
import { testApiKey } from '../services/geminiService'

export default function Settings({ settings, onSave, showToast }) {
  const [apiKey, setApiKey] = useState(settings.apiKey || '')
  const [customRules, setCustomRules] = useState(settings.customRules || '')
  const [testing, setTesting] = useState(false)
  const [keyValid, setKeyValid] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setApiKey(settings.apiKey || '')
    setCustomRules(settings.customRules || '')
  }, [settings])

  async function handleTestKey() {
    if (!apiKey) return
    setTesting(true)
    setKeyValid(null)
    const valid = await testApiKey(apiKey)
    setTesting(false)
    setKeyValid(valid)
    showToast(valid ? '✅ API key is valid!' : '❌ Invalid API key', valid ? 'success' : 'error')
  }

  async function handleSave() {
    setSaving(true)
    await onSave({ apiKey, customRules })
    setSaving(false)
    showToast('Settings saved!', 'success')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Fixed header */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <h2>Settings</h2>
        <p>Configure your Gemini API key and custom organization rules.</p>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        <div style={{ maxWidth: 640 }}>

          {/* API Key */}
          <div className="card mb-6">
            <div className="card-title mb-3">
              <Key size={16} style={{ color: 'var(--purple)' }} />
              Gemini API Key
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.7 }}>
              Get your free API key from{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--purple-light)', textDecoration: 'none' }}
              >
                Google AI Studio ↗
              </a>
              . The key is stored locally on your machine only.
            </div>

            <div className="input-group">
              <label className="input-label">API Key</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  className="input input-password"
                  placeholder="AIza…"
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setKeyValid(null) }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={handleTestKey}
                  disabled={!apiKey || testing}
                  style={{ flexShrink: 0 }}
                >
                  {testing
                    ? <Loader2 size={14} className="animate-spin" />
                    : keyValid === true
                    ? <CheckCircle2 size={14} style={{ color: 'var(--green)' }} />
                    : keyValid === false
                    ? <XCircle size={14} style={{ color: 'var(--red)' }} />
                    : 'Test'}
                </button>
              </div>
            </div>

            {keyValid === true && (
              <div className="chip chip-green" style={{ marginTop: 4 }}>
                <CheckCircle2 size={11} /> Key is valid and working
              </div>
            )}
            {keyValid === false && (
              <div className="chip chip-red" style={{ marginTop: 4 }}>
                <XCircle size={11} /> Invalid key — check and try again
              </div>
            )}
          </div>

          {/* Custom Rules */}
          <div className="card mb-6">
            <div className="card-title mb-3">
              <Info size={16} style={{ color: 'var(--cyan)' }} />
              Custom Organization Rules
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.7 }}>
              Write plain-English rules for the AI to follow. Click an example to add it:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {[
                'Put all invoices and receipts in "Finance/Invoices"',
                'Screenshots should go to "Images/Screenshots"',
                'Group files by year inside each category',
              ].map((example, i) => (
                <div
                  key={i}
                  style={{
                    padding: '6px 12px', background: 'var(--bg-base)',
                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                    fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic',
                    cursor: 'pointer',
                  }}
                  onClick={() => setCustomRules((r) => r ? r + '\n' + example : example)}
                >
                  + {example}
                </div>
              ))}
            </div>
            <textarea
              className="input"
              style={{ minHeight: 120, resize: 'vertical', lineHeight: 1.7 }}
              placeholder="Add your custom rules here…"
              value={customRules}
              onChange={(e) => setCustomRules(e.target.value)}
            />
          </div>

          {/* Save button */}
          <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
              : <><Save size={16} /> Save Settings</>}
          </button>

        </div>
      </div>
    </div>
  )
}
