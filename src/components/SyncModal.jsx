import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { useT } from '../i18n'
import { fmtDateTime } from '../utils/format'
import { CloudUpload, CloudDownload, RefreshCw, CheckCircle2, AlertCircle, CloudCog } from 'lucide-react'

export function SyncModal({ isOpen, onClose, onSave }) {
  const t = useT()
  const [cfg, setCfg]         = useState(null)   // { configured, config_fetched_at, last_push, last_pull }
  const [meta, setMeta]       = useState(null)
  const [busy, setBusy]       = useState(null)   // 'fetch' | 'push' | 'pull' | 'status'
  const [message, setMessage] = useState(null)   // { type: 'ok'|'error', text }

  const loadConfig = async () => {
    const c = await window.api.sync.getConfig()
    setCfg(c)
    return c
  }

  useEffect(() => {
    if (!isOpen) return
    setMessage(null)
    setMeta(null)
    loadConfig().then(c => { if (c.configured) refreshStatus() })
  }, [isOpen])

  const refreshStatus = async () => {
    setBusy('status')
    const r = await window.api.sync.status()
    setBusy(null)
    if (r.ok) setMeta(r.meta)
  }

  const errorText = (r) => {
    if (r.code === 'no_key')       return t('sync.errNoKey')
    if (r.code === 'unauthorized') return t('sync.errUnauthorized')
    if (r.code === 'network')      return t('sync.errNetwork')
    return r.error
  }

  const fetchConfig = async () => {
    setBusy('fetch')
    setMessage(null)
    const r = await window.api.sync.fetchConfig()
    setBusy(null)
    if (r.ok) {
      await loadConfig()
      setMessage({ type: 'ok', text: t('sync.configFetched') })
      refreshStatus()
    } else {
      setMessage({ type: 'error', text: errorText(r) })
    }
  }

  const resetConfig = async () => {
    if (!confirm(t('sync.confirmReset'))) return
    await window.api.sync.resetConfig()
    setMeta(null)
    setMessage(null)
    await loadConfig()
  }

  const doPush = async () => {
    setBusy('push')
    setMessage(null)
    const r = await window.api.sync.push()
    setBusy(null)
    if (r.ok) {
      setMeta(r.meta)
      setMessage({ type: 'ok', text: t('sync.pushed') })
      loadConfig()
    } else {
      setMessage({ type: 'error', text: r.error })
    }
  }

  const doPull = async () => {
    if (!confirm(t('sync.confirmPull'))) return
    setBusy('pull')
    setMessage(null)
    const r = await window.api.sync.pull()
    setBusy(null)
    if (r.ok) {
      setMeta(r.meta)
      setMessage({ type: 'ok', text: t('sync.pulled') })
      loadConfig()
      onSave?.()
    } else {
      setMessage({ type: 'error', text: r.error })
    }
  }

  const configured = !!cfg?.configured

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('sync.title')}>
      <div className="space-y-5">

        {!configured ? (
          /* ── Etat NON configure : texte + un seul bouton ─────────────── */
          <div className="space-y-4">
            <p className="text-sm text-muted">{t('sync.notConfiguredText')}</p>

            {message && (
              <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                message.type === 'ok' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'
              }`}>
                {message.type === 'ok' ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
                {message.text}
              </div>
            )}

            <Button onClick={fetchConfig} disabled={!!busy} className="w-full">
              <CloudCog size={14} className={busy === 'fetch' ? 'animate-pulse' : ''} />
              {busy === 'fetch' ? t('sync.fetching') : t('sync.fetchConfig')}
            </Button>
          </div>
        ) : (
          /* ── Etat configure ──────────────────────────────────────────── */
          <>
            {/* Carte configuration (sans jamais afficher URL/token) */}
            <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-4 py-3 flex items-center gap-3">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-emerald-400 font-medium">{t('sync.configOk')}</p>
                {cfg.config_fetched_at && (
                  <p className="text-xs text-muted mt-0.5">
                    {t('sync.configFetchedAt', { date: fmtDateTime(cfg.config_fetched_at) })}
                  </p>
                )}
              </div>
            </div>

            {/* Etat du cloud */}
            <div className="bg-surface2 rounded-lg px-4 py-3 text-sm space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted font-medium">{t('sync.cloudState')}</span>
                <button
                  onClick={refreshStatus}
                  disabled={!!busy}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-content transition-colors disabled:opacity-40"
                  title={t('sync.checkState')}
                >
                  <RefreshCw size={12} className={busy === 'status' ? 'animate-spin' : ''} />
                  {t('sync.checkState')}
                </button>
              </div>
              {meta ? (
                <>
                  <p className="text-muted text-xs">
                    {t('sync.lastPush')} <span className="text-content">{fmtDateTime(meta.pushed_at)}</span>
                    {' '}{t('sync.fromDevice')} <span className="text-content">{meta.device}</span>
                  </p>
                  <p className="text-muted text-xs">
                    {meta.counts && Object.entries(meta.counts).map(([tb, n]) => `${n} ${tb}`).join(' · ')}
                  </p>
                </>
              ) : (
                <p className="text-faint text-xs">{t('sync.noSnapshot')}</p>
              )}
              <p className="text-faint text-xs pt-1 border-t border-edge/50">
                {t('sync.localInfo', { push: fmtDateTime(cfg.last_push), pull: fmtDateTime(cfg.last_pull) })}
              </p>
            </div>

            {/* Message resultat */}
            {message && (
              <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                message.type === 'ok' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'
              }`}>
                {message.type === 'ok' ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
                {message.text}
              </div>
            )}

            {/* Actions push / pull */}
            <div className="flex gap-2">
              <Button onClick={doPush} disabled={!!busy} className="flex-1">
                <CloudUpload size={14} className={busy === 'push' ? 'animate-pulse' : ''} />
                {busy === 'push' ? t('sync.pushing') : t('sync.push')}
              </Button>
              <Button variant="secondary" onClick={doPull} disabled={!!busy} className="flex-1">
                <CloudDownload size={14} className={busy === 'pull' ? 'animate-pulse' : ''} />
                {busy === 'pull' ? t('sync.pulling') : t('sync.pull')}
              </Button>
            </div>

            <p className="text-xs text-faint">{t('sync.helpText')}</p>

            {/* Actions discretes */}
            <div className="flex items-center justify-between pt-1 border-t border-edge/50">
              <button
                onClick={fetchConfig}
                disabled={!!busy}
                className="text-xs text-faint hover:text-content transition-colors disabled:opacity-40"
              >
                {busy === 'fetch' ? t('sync.fetching') : t('sync.refreshConfig')}
              </button>
              <button
                onClick={resetConfig}
                disabled={!!busy}
                className="text-xs text-faint hover:text-rose-400 transition-colors disabled:opacity-40"
              >
                {t('sync.reset')}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
