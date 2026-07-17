import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Field, Input } from './ui/Field'
import { CloudUpload, CloudDownload, RefreshCw, CheckCircle2, AlertCircle, Save } from 'lucide-react'

const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('fr-FR') : '—'

export function SyncModal({ isOpen, onClose, onSave }) {
  const [cfg, setCfg]         = useState({ api_url: '', token: '' })
  const [meta, setMeta]       = useState(null)
  const [busy, setBusy]       = useState(null)   // 'push' | 'pull' | 'status' | 'save'
  const [message, setMessage] = useState(null)   // { type: 'ok'|'error', text }

  useEffect(() => {
    if (!isOpen) return
    setMessage(null)
    setMeta(null)
    ;(async () => {
      const c = await window.api.sync.getConfig()
      setCfg({ api_url: c.api_url || '', token: c.token || '', last_push: c.last_push, last_pull: c.last_pull })
      if (c.api_url && c.token) refreshStatus()
    })()
  }, [isOpen])

  const refreshStatus = async () => {
    setBusy('status')
    const r = await window.api.sync.status()
    setBusy(null)
    if (r.ok) setMeta(r.meta)
  }

  const saveConfig = async () => {
    setBusy('save')
    await window.api.sync.setConfig({ api_url: cfg.api_url.trim(), token: cfg.token.trim() })
    setBusy(null)
    setMessage({ type: 'ok', text: 'Configuration enregistrée' })
    if (cfg.api_url && cfg.token) refreshStatus()
  }

  const doPush = async () => {
    setBusy('push')
    setMessage(null)
    const r = await window.api.sync.push()
    setBusy(null)
    if (r.ok) {
      setMeta(r.meta)
      setMessage({ type: 'ok', text: 'Données envoyées vers le cloud' })
    } else {
      setMessage({ type: 'error', text: r.error })
    }
  }

  const doPull = async () => {
    if (!confirm('Récupérer du cloud ? Les données locales seront REMPLACÉES par celles du cloud.')) return
    setBusy('pull')
    setMessage(null)
    const r = await window.api.sync.pull()
    setBusy(null)
    if (r.ok) {
      setMeta(r.meta)
      setMessage({ type: 'ok', text: 'Données récupérées du cloud' })
      onSave?.()
    } else {
      setMessage({ type: 'error', text: r.error })
    }
  }

  const configured = cfg.api_url && cfg.token

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Synchronisation cloud">
      <div className="space-y-5">

        {/* Configuration */}
        <div className="space-y-3">
          <Field label="URL de l'API">
            <Input
              value={cfg.api_url}
              onChange={e => setCfg(c => ({ ...c, api_url: e.target.value }))}
              placeholder="https://compta-perso-sync-api.vercel.app"
            />
          </Field>
          <Field label="Token de sécurité">
            <Input
              type="password"
              value={cfg.token}
              onChange={e => setCfg(c => ({ ...c, token: e.target.value }))}
              placeholder="Token secret partagé avec l'API"
            />
          </Field>
          <Button variant="secondary" size="sm" onClick={saveConfig} disabled={busy === 'save'}>
            <Save size={13} />
            Enregistrer la configuration
          </Button>
        </div>

        {/* Etat du cloud */}
        <div className="bg-surface2 rounded-lg px-4 py-3 text-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted font-medium">État du cloud</span>
            <button
              onClick={refreshStatus}
              disabled={!configured || busy === 'status'}
              className="text-muted hover:text-content transition-colors disabled:opacity-40"
              title="Rafraîchir"
            >
              <RefreshCw size={13} className={busy === 'status' ? 'animate-spin' : ''} />
            </button>
          </div>
          {meta ? (
            <>
              <p className="text-muted text-xs">
                Dernier envoi : <span className="text-content">{fmtDateTime(meta.pushed_at)}</span>
                {' '}depuis <span className="text-content">{meta.device}</span>
              </p>
              <p className="text-muted text-xs">
                {meta.counts && Object.entries(meta.counts).map(([t, n]) => `${n} ${t}`).join(' · ')}
              </p>
            </>
          ) : (
            <p className="text-faint text-xs">
              {configured ? 'Aucun snapshot dans le cloud (ou API injoignable)' : 'Configurez l\'API pour voir l\'état'}
            </p>
          )}
          <p className="text-faint text-xs pt-1 border-t border-edge/50">
            Local — dernier envoi : {fmtDateTime(cfg.last_push)} · dernière récupération : {fmtDateTime(cfg.last_pull)}
          </p>
        </div>

        {/* Message résultat */}
        {message && (
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
            message.type === 'ok' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'
          }`}>
            {message.type === 'ok' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {message.text}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={doPush} disabled={!configured || !!busy} className="flex-1">
            <CloudUpload size={14} className={busy === 'push' ? 'animate-pulse' : ''} />
            {busy === 'push' ? 'Envoi…' : 'Envoyer vers le cloud'}
          </Button>
          <Button variant="secondary" onClick={doPull} disabled={!configured || !!busy} className="flex-1">
            <CloudDownload size={14} className={busy === 'pull' ? 'animate-pulse' : ''} />
            {busy === 'pull' ? 'Récupération…' : 'Récupérer du cloud'}
          </Button>
        </div>

        <p className="text-xs text-faint">
          « Envoyer » remplace le contenu du cloud par tes données locales.
          « Récupérer » remplace tes données locales par celles du cloud.
        </p>
      </div>
    </Modal>
  )
}
