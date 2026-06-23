import { useState } from 'react'
import { Select, Input } from './ui/Field'
import { Button } from './ui/Button'
import { Plus, ArrowLeftRight, TrendingUp, Table2, GitBranch, SlidersHorizontal, X, AlignStartVertical, AlignStartHorizontal } from 'lucide-react'

const hasActiveFilters = f => f.type || f.category_id || f.date_from || f.date_to

export function Controls({
  filters, setF,
  showForecast, setShowForecast,
  viewMode, setViewMode,
  graphLayout, setGraphLayout,
  categories,
  onAddTx, onTransfer, onForecast,
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

        <div className="w-px h-5 bg-gray-800" />

        {/* Bouton Filtres avec badge si actif */}
        <button
          onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
            active
              ? 'border-blue-500 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20'
              : showFilters
              ? 'border-gray-600 text-gray-200 bg-gray-800'
              : 'border-edge text-gray-500 hover:text-gray-300 hover:border-gray-600'
          }`}
        >
          <SlidersHorizontal size={13} />
          Filtres
          {active && (
            <span className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
              {[filters.type, filters.category_id, filters.date_from, filters.date_to].filter(Boolean).length}
            </span>
          )}
        </button>

        {active && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-300 transition-colors"
          >
            <X size={11} />
            Effacer
          </button>
        )}

        <div className="flex-1" />

        {/* Toggle previsionnel */}
        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 select-none">
          <div
            onClick={() => setShowForecast(v => !v)}
            className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${showForecast ? 'bg-amber-500' : 'bg-gray-700'}`}
          >
            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${showForecast ? 'left-4' : 'left-0.5'}`} />
          </div>
          Previsionnel
        </label>

        <div className="w-px h-5 bg-gray-800" />

        {/* Toggle orientation graphe */}
        {viewMode === 'graphe' && (
          <div className="flex items-center bg-gray-800 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setGraphLayout('vertical')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                graphLayout === 'vertical' ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Vue verticale"
            >
              <AlignStartVertical size={13} />
            </button>
            <button
              onClick={() => setGraphLayout('horizontal')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                graphLayout === 'horizontal' ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300'
              }`}
              title="Vue horizontale"
            >
              <AlignStartHorizontal size={13} />
            </button>
          </div>
        )}

        {/* Toggle vue */}
        <div className="flex items-center bg-gray-800 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setViewMode('tableau')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'tableau' ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Table2 size={13} />
            Tableau
          </button>
          <button
            onClick={() => setViewMode('graphe')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              viewMode === 'graphe' ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <GitBranch size={13} />
            Graphe
          </button>
        </div>
      </div>

      {/* Panneau filtres — apparait sous la barre */}
      {showFilters && (
        <div className="flex items-center gap-3 px-4 pb-2 border-t border-edge/60 pt-2">
          <select
            value={filters.type}
            onChange={e => setF('type', e.target.value)}
            className="bg-gray-800 border border-edge rounded-lg px-2 py-1.5 text-gray-100 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="">Tous types</option>
            <option value="CREDIT">Credit</option>
            <option value="DEBIT">Debit</option>
          </select>

          <select
            value={filters.category_id}
            onChange={e => setF('category_id', e.target.value)}
            className="bg-gray-800 border border-edge rounded-lg px-2 py-1.5 text-gray-100 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="">Toutes categories</option>
            {(categories || []).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <span className="text-xs text-gray-600">Du</span>
          <input
            type="date"
            value={filters.date_from}
            onChange={e => setF('date_from', e.target.value)}
            className="bg-gray-800 border border-edge rounded-lg px-2 py-1.5 text-gray-100 text-xs focus:outline-none focus:border-blue-500"
          />
          <span className="text-xs text-gray-600">au</span>
          <input
            type="date"
            value={filters.date_to}
            onChange={e => setF('date_to', e.target.value)}
            className="bg-gray-800 border border-edge rounded-lg px-2 py-1.5 text-gray-100 text-xs focus:outline-none focus:border-blue-500"
          />
        </div>
      )}
    </div>
  )
}
