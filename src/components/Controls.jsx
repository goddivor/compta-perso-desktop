import { useState } from 'react'
import { Select, Input } from './ui/Field'
import { Button } from './ui/Button'
import { Plus, ArrowLeftRight, TrendingUp, Table2, GitBranch, SlidersHorizontal, X, AlignStartVertical, AlignStartHorizontal, CalendarDays, Percent } from 'lucide-react'

const hasActiveFilters = f => f.type || f.category_id || f.date_from || f.date_to

export function Controls({
  filters, setF,
  showForecast, setShowForecast,
  viewMode, setViewMode,
  graphLayout, setGraphLayout,
  categories, accounts,
  onAddTx, onTransfer, onForecast, onFeeRule,
}) {
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
            Transaction
          </Button>
          <Button size="sm" variant="secondary" onClick={onTransfer}>
            <ArrowLeftRight size={13} />
            Retrait
          </Button>
          <Button size="sm" variant="secondary" onClick={onForecast}>
            <TrendingUp size={13} />
            Simulations
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
          Filtres
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
            Effacer
          </button>
        )}

        {/* Bouton règle de frais — visible uniquement si un compte est sélectionné */}
        {filters.account_id && (() => {
          const acct = (accounts || []).find(a => String(a.id) === String(filters.account_id))
          const hasRule = acct?.fees_rate != null
          return (
            <button
              onClick={() => onFeeRule?.(acct)}
              title={hasRule ? `Règle de frais : ${acct.fees_rate}%` : 'Définir une règle de frais'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                hasRule
                  ? 'border-amber-500/50 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                  : 'border-edge text-muted hover:text-content hover:border-edge'
              }`}
            >
              <Percent size={12} />
              {hasRule ? `${acct.fees_rate}%` : 'Frais'}
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
          Previsionnel
        </label>

        <div className="w-px h-5 bg-surface2" />

        {/* Toggle orientation graphe */}
        {viewMode === 'graphe' && (
          <div className="flex items-center bg-surface2 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setGraphLayout('vertical')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                graphLayout === 'vertical' ? 'bg-edge text-ink' : 'text-muted hover:text-content'
              }`}
              title="Vue verticale"
            >
              <AlignStartVertical size={13} />
            </button>
            <button
              onClick={() => setGraphLayout('horizontal')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                graphLayout === 'horizontal' ? 'bg-edge text-ink' : 'text-muted hover:text-content'
              }`}
              title="Vue horizontale"
            >
              <AlignStartHorizontal size={13} />
            </button>
          </div>
        )}

        {/* Toggle vue */}
        <div className="flex items-center bg-surface2 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setViewMode('tableau')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'tableau' ? 'bg-edge text-ink' : 'text-muted hover:text-content'
            }`}
          >
            <Table2 size={13} />
            Tableau
          </button>
          <button
            onClick={() => setViewMode('graphe')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'graphe' ? 'bg-edge text-ink' : 'text-muted hover:text-content'
            }`}
          >
            <GitBranch size={13} />
            Graphe
          </button>
          <button
            onClick={() => setViewMode('rapport')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'rapport' ? 'bg-edge text-ink' : 'text-muted hover:text-content'
            }`}
          >
            <CalendarDays size={13} />
            Rapport
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
            <option value="">Tous types</option>
            <option value="CREDIT">Credit</option>
            <option value="DEBIT">Debit</option>
          </select>

          <select
            value={filters.category_id}
            onChange={e => setF('category_id', e.target.value)}
            className="bg-surface2 border border-edge rounded-lg px-2 py-1.5 text-ink text-xs focus:outline-none focus:border-primary"
          >
            <option value="">Toutes categories</option>
            {(categories || []).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <span className="text-xs text-faint">Du</span>
          <input
            type="date"
            value={filters.date_from}
            onChange={e => setF('date_from', e.target.value)}
            className="bg-surface2 border border-edge rounded-lg px-2 py-1.5 text-ink text-xs focus:outline-none focus:border-primary"
          />
          <span className="text-xs text-faint">au</span>
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
