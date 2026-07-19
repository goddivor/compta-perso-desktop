import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input, Select } from './ui/Field'
import { Spinner } from './ui/Spinner'
import { useAsync } from '../hooks/useAsync'
import { useT, useI18n } from '../i18n'
import { Plus, Trash2, Pencil, Check, X, Globe, Github, RefreshCw, Download, RotateCcw } from 'lucide-react'

const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#F97316','#6B7280','#84CC16']
const emptyForm = { name: '', flow: 'DEBIT', color: '#3B82F6' }

function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {COLORS.map(c => (
        <button
          key={c} type="button"
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full border-2 transition-all ${value === c ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'}`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}

function CategoryCard({ cat, onSaved, onDeleted }) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: cat.name, flow: cat.flow, color: cat.color || '#6B7280' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    await window.api.categories.update({ id: cat.id, ...form })
    setEditing(false)
    onSaved()
  }
  const remove = async () => {
    if (!confirm(t('settings.confirmDeleteCat', { name: cat.name }))) return
    await window.api.categories.remove(cat.id)
    onDeleted()
  }

  if (editing) {
    return (
      <div className="bg-surface2 rounded-xl p-3 border border-primary/40 space-y-2 col-span-1">
        <Input value={form.name} onChange={e => set('name', e.target.value)} className="text-xs w-full" />
        <Select value={form.flow} onChange={e => set('flow', e.target.value)} className="text-xs w-full">
          <option value="DEBIT">DEBIT</option>
          <option value="CREDIT">CREDIT</option>
          <option value="BOTH">BOTH</option>
        </Select>
        <ColorPicker value={form.color} onChange={v => set('color', v)} />
        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={!form.name}
            className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-40 transition-colors">
            <Check size={12} className="mr-1" />{t('common.save')}
          </button>
          <button onClick={() => setEditing(false)}
            className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-xs font-medium bg-edge text-muted hover:text-content transition-colors">
            <X size={12} className="mr-1" />{t('common.cancel')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group bg-surface2/60 hover:bg-surface2 rounded-xl p-3 border border-edge/40 hover:border-edge transition-all flex flex-col gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#6B7280' }} />
        <span className="text-sm text-content font-medium truncate">{cat.name}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
          cat.flow === 'DEBIT'  ? 'bg-rose-900/40 text-rose-400' :
          cat.flow === 'CREDIT' ? 'bg-emerald-900/40 text-emerald-400' :
          'bg-edge text-muted'
        }`}>{cat.flow}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="p-1 text-muted hover:text-primary transition-colors">
            <Pencil size={12} />
          </button>
          <button onClick={remove} className="p-1 text-muted hover:text-rose-400 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

function LanguageSection() {
  const { t, pref, setLanguage } = useI18n()
  return (
    <div className="mt-6 pt-4 border-t border-edge flex items-center justify-between gap-4">
      <div>
        <p className="text-xs text-muted font-medium uppercase tracking-wide">{t('settings.language')}</p>
      </div>
      <Select value={pref} onChange={e => setLanguage(e.target.value)} className="w-44 text-sm">
        <option value="system">{t('settings.langSystem')}</option>
        <option value="fr">Français</option>
        <option value="en">English</option>
      </Select>
    </div>
  )
}

function AboutSection() {
  const t = useT()
  const [version, setVersion] = useState('')
  const [upd, setUpd] = useState({ step: 'idle' })
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    window.api.app?.getVersion().then(setVersion).catch(() => {})
  }, [])

  useEffect(() => {
    const off = window.api.updates?.onProgress(p => setPercent(p.percent))
    return off
  }, [])

  const check = async () => {
    setUpd({ step: 'checking' })
    const r = await window.api.updates.check()
    if (r.available)   setUpd({ step: 'available', version: r.version, notes: r.notes })
    else if (r.error)  setUpd({ step: 'error', error: r.error })
    else               setUpd({ step: 'uptodate' })
  }

  const download = async () => {
    setPercent(0)
    setUpd(s => ({ ...s, step: 'downloading' }))
    const r = await window.api.updates.download()
    if (r.ok) setUpd(s => ({ ...s, step: 'downloaded' }))
    else      setUpd({ step: 'error', error: r.error })
  }

  const open = url => window.api.app.openExternal(url)

  return (
    <div className="mt-6 pt-4 border-t border-edge">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted font-medium uppercase tracking-wide">{t('about.title')}</p>
          <p className="text-sm text-content mt-1">
            Compta Perso <span className="text-faint">v{version || '…'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => open('https://goddivor.github.io/compta-perso/')}
            title={t('about.website')}
            className="p-2 rounded-lg text-muted hover:text-ink hover:bg-surface2 transition-colors">
            <Globe size={15} />
          </button>
          <button
            onClick={() => open('https://github.com/goddivor/compta-perso-desktop')}
            title={t('about.sourceCode')}
            className="p-2 rounded-lg text-muted hover:text-ink hover:bg-surface2 transition-colors">
            <Github size={15} />
          </button>
          {(upd.step === 'idle' || upd.step === 'error' || upd.step === 'uptodate' || upd.step === 'checking') && (
            <Button variant="secondary" size="sm" onClick={check} disabled={upd.step === 'checking'}>
              <RefreshCw size={13} className={upd.step === 'checking' ? 'animate-spin' : ''} />
              {upd.step === 'checking' ? t('about.checking') : t('about.checkUpdates')}
            </Button>
          )}
        </div>
      </div>

      {upd.step === 'uptodate' && (
        <p className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
          <Check size={12} />{t('about.upToDate')}
        </p>
      )}
      {upd.step === 'error' && (
        <p className="mt-2 text-xs text-rose-400">{t('about.checkFailed', { error: upd.error })}</p>
      )}

      {(upd.step === 'available' || upd.step === 'downloading' || upd.step === 'downloaded') && (
        <div className="mt-3 bg-surface2/60 border border-edge/60 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-content font-medium">
              {t('about.versionAvailable', { version: upd.version })}
            </p>
            {upd.step === 'available' && (
              <Button size="sm" onClick={download}>
                <Download size={13} />{t('about.download')}
              </Button>
            )}
            {upd.step === 'downloaded' && (
              <Button size="sm" onClick={() => window.api.updates.install()}>
                <RotateCcw size={13} />{t('about.restartInstall')}
              </Button>
            )}
          </div>
          {upd.step === 'downloading' && (
            <div>
              <div className="h-1.5 bg-edge rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-xs text-faint mt-1">{t('about.downloading', { percent })}</p>
            </div>
          )}
          {upd.notes && (
            <div className="max-h-28 overflow-y-auto text-xs text-muted whitespace-pre-wrap bg-base/40 rounded-lg p-2 border border-edge/40">
              {upd.notes.replace(/<[^>]+>/g, '')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function SettingsModal({ isOpen, onClose, onSave }) {
  const t = useT()
  const { data: categories, loading, refetch } = useAsync(() => window.api.categories.getAll())
  const [form, setForm] = useState(emptyForm)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const refresh = () => { refetch(); onSave?.() }

  const addCategory = async () => {
    if (!form.name) return
    await window.api.categories.create({ ...form, icon: '' })
    setForm(emptyForm)
    refresh()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('settings.title')} wide="xl">
      <div className="flex gap-6">
        {/* Panneau gauche : grille des catégories */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted font-medium uppercase tracking-wide mb-3">{t('settings.existing')}</p>
          {loading ? <Spinner /> : (
            <div className="grid grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto pr-1">
              {(categories || []).map(cat => (
                <CategoryCard key={cat.id} cat={cat} onSaved={refresh} onDeleted={refresh} />
              ))}
            </div>
          )}
        </div>

        {/* Séparateur */}
        <div className="w-px bg-edge self-stretch" />

        {/* Panneau droit : formulaire nouvelle catégorie */}
        <div className="w-56 shrink-0 space-y-3">
          <p className="text-xs text-muted font-medium uppercase tracking-wide">{t('settings.newCategory')}</p>
          <Input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder={t('common.name')}
            className="text-xs w-full"
          />
          <Select value={form.flow} onChange={e => set('flow', e.target.value)} className="text-xs w-full">
            <option value="DEBIT">DEBIT</option>
            <option value="CREDIT">CREDIT</option>
            <option value="BOTH">BOTH</option>
          </Select>
          <div>
            <p className="text-xs text-faint mb-2">{t('common.color')}</p>
            <ColorPicker value={form.color} onChange={v => set('color', v)} />
          </div>
          {/* Apercu */}
          {form.name && (
            <div className="flex items-center gap-2 bg-surface2 rounded-lg px-3 py-2">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: form.color }} />
              <span className="text-sm text-content truncate">{form.name}</span>
              <span className={`ml-auto text-xs px-1.5 py-0.5 rounded font-medium ${
                form.flow === 'DEBIT'  ? 'bg-rose-900/40 text-rose-400' :
                form.flow === 'CREDIT' ? 'bg-emerald-900/40 text-emerald-400' :
                'bg-edge text-muted'
              }`}>{form.flow}</span>
            </div>
          )}
          <Button onClick={addCategory} disabled={!form.name} className="w-full">
            <Plus size={13} />{t('common.add')}
          </Button>
        </div>
      </div>

      <LanguageSection />
      <AboutSection />
    </Modal>
  )
}
