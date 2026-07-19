import { useState } from 'react'
import { Select, Input } from './ui/Field'
import { Button } from './ui/Button'
import { useT } from '../i18n'
import { Plus, ArrowLeftRight, TrendingUp, Table2, GitBranch, SlidersHorizontal, X, CalendarDays, Percent } from 'lucide-react'

const hasActiveFilters = f => f.type || f.category_id || f.date_from || f.date_to

export function Controls({
  filters, setF,
  showForecast, setShowForecast,
  viewMode, setViewMode,
  categories, accounts,
  onAddTx, onTransfer, onForecast, onFeeRule,
}) {
  const t = useT()
  const [showFilters, setShowFilters] = useState(false)
  const active = hasActiveFilters(filters)

  const clearFilters = () => {
    setF('type', '')
    setF('category_id', '')
    setF('date_from', '')
    setF('date_to', '')
  }

  return (
    <div className="shrink-0 border-b border-edge bg-base">
      {/* Barre principale — une seule ligne */}
      <div className="flex items-center gap-3 px-4 py-2">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onAddTx}>
            <Plus size={13} />
            {t('controls.transaction')}
          </Button>
          <Button size="sm" variant="secondary" onClick={onTransfer}>
            <ArrowLeftRight size={13} />
            {t('controls.withdrawal')}
          </Button>
          <Button size="sm" variant="secondary" onClick={onForecast}>
            <TrendingUp size={13} />
            {t('controls.simulations')}
          </Button>
        </div>

        <div className="w-px h-5 bg-surface2" />

        {/* Bouton Filtres avec badge si actif */}
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
            active
              ? 'border-primary text-primary bg-primary/10 hover:bg-primary/20'
              : showFilters
              ? 'border-edge text-content bg-surface2'
              : 'border-edge text-muted hover:text-content hover:border-edge'
          }`}
        >
          <SlidersHorizontal size={13} />
          {t('controls.filters')}
          {active && (
            <span className="bg-primary text-primaryInk rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
              {[filters.type, filters.category_id, filters.date_from, filters.date_to].filter(Boolean).length}
            </span>
          )}
        </button>

        {active && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-faint hover:text-content transition-colors"
          >
            <X size={11} />
            {t('controls.clear')}
          </button>
        )}

        {/* Bouton règle de frais — visible uniquement si un compte est sélectionné */}
        {filters.account_id && (() => {
          const acct = (accounts || []).find(a => String(a.id) === String(filters.account_id))
          const hasRule = acct?.fees_rate != null
          return (
            <button
              onClick={() => onFeeRule?.(acct)}
              title={hasRule ? t('controls.feeRuleCurrent', { rate: acct.fees_rate }) : t('controls.feeRuleDefine')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                hasRule
                  ? 'border-amber-500/50 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                  : 'border-edge text-muted hover:text-content hover:border-edge'
              }`}
            >
              <Percent size={12} />
              {hasRule ? `${acct.fees_rate}%` : t('controls.fees')}
            </button>
          )
        })()}

        <div className="flex-1" />

        {/* Toggle previsionnel */}
        <label className="flex items-center gap-2 cursor-pointer text-xs text-muted select-none">
          <div
            onClick={() => setShowForecast(v => !v)}
            className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${showForecast ? 'bg-primary' : 'bg-edge'}`}
          >
            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${showForecast ? 'left-4' : 'left-0.5'}`} />
          </div>
          {t('controls.forecast')}
        </label>

        <div className="w-px h-5 bg-surface2" />

        {/* Toggle vue */}
        <div className="flex items-center bg-surface2 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setViewMode('tableau')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'tableau' ? 'bg-edge text-ink' : 'text-muted hover:text-content'
            }`}
          >
            <Table2 size={13} />
            {t('controls.table')}
          </button>
          <button
            onClick={() => setViewMode('graphe')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'graphe' ? 'bg-edge text-ink' : 'text-muted hover:text-content'
            }`}
          >
            <GitBranch size={13} />
            {t('controls.graph')}
          </button>
          <button
            onClick={() => setViewMode('rapport')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'rapport' ? 'bg-edge text-ink' : 'text-muted hover:text-content'
            }`}
          >
            <CalendarDays size={13} />
            {t('controls.report')}
          </button>
        </div>
      </div>

      {/* Panneau filtres — apparait sous la barre */}
      {showFilters && (
        <div className="flex items-center gap-3 px-4 pb-2 border-t border-edge/60 pt-2">
          <select
            value={filters.type}
            onChange={e => setF('type', e.target.value)}
            className="bg-surface2 border border-edge rounded-lg px-2 py-1.5 text-ink text-xs focus:outline-none focus:border-primary"
          >
            <option value="">{t('controls.allTypes')}</option>
            <option value="CREDIT">{t('common.credit')}</option>
            <option value="DEBIT">{t('common.debit')}</option>
          </select>

          <select
            value={filters.category_id}
            onChange={e => setF('category_id', e.target.value)}
            className="bg-surface2 border border-edge rounded-lg px-2 py-1.5 text-ink text-xs focus:outline-none focus:border-primary"
          >
            <option value="">{t('controls.allCategories')}</option>
            {(categories || []).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <span className="text-xs text-faint">{t('controls.dateFrom')}</span>
          <input
            type="date"
            value={filters.date_from}
            onChange={e => setF('date_from', e.target.value)}
            className="bg-surface2 border border-edge rounded-lg px-2 py-1.5 text-ink text-xs focus:outline-none focus:border-primary"
          />
          <span className="text-xs text-faint">{t('controls.dateTo')}</span>
          <input
            type="date"
            value={filters.date_to}
            onChange={e => setF('date_to', e.target.value)}
            className="bg-surface2 border border-edge rounded-lg px-2 py-1.5 text-ink text-xs focus:outline-none focus:border-primary"
          />
        </div>
      )}
    </div>
  )
}
