import { Select, Input } from './ui/Field'
import { Button } from './ui/Button'
import { Plus, ArrowLeftRight, TrendingUp, Table2, GitBranch, Minus } from 'lucide-react'

export function Controls({
  filters, setF,
  showForecast, setShowForecast,
  viewMode, setViewMode,
  graphMode, setGraphMode,
  categories,
  onAddTx, onTransfer, onForecast,
}) {
  return (
    <div className="shrink-0 border-b border-gray-800 bg-gray-950 flex items-center gap-3 px-4 py-2 flex-wrap">
      {/* Actions */}
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

      {/* Filters */}
      <Select
        value={filters.type}
        onChange={e => setF('type', e.target.value)}
        className="w-28 text-xs"
      >
        <option value="">Tous types</option>
        <option value="CREDIT">Credit</option>
        <option value="DEBIT">Debit</option>
      </Select>

      <Select
        value={filters.category_id}
        onChange={e => setF('category_id', e.target.value)}
        className="w-32 text-xs"
      >
        <option value="">Toutes cats.</option>
        {(categories || []).map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>

      <Input
        type="date"
        value={filters.date_from}
        onChange={e => setF('date_from', e.target.value)}
        className="w-36 text-xs"
        title="Depuis"
      />
      <Input
        type="date"
        value={filters.date_to}
        onChange={e => setF('date_to', e.target.value)}
        className="w-36 text-xs"
        title="Jusqu'au"
      />

      {(filters.type || filters.category_id || filters.date_from || filters.date_to) && (
        <button
          onClick={() => { setF('type',''); setF('category_id',''); setF('date_from',''); setF('date_to','') }}
          className="text-xs text-gray-600 hover:text-gray-300 flex items-center gap-1 transition-colors"
        >
          <Minus size={11} />
          Effacer
        </button>
      )}

      <div className="flex-1" />

      {/* Forecast toggle */}
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

      {/* View mode */}
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

      {/* Graph sub-mode (visible only in graph mode) */}
      {viewMode === 'graphe' && (
        <div className="flex items-center bg-gray-800 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setGraphMode('nuage')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              graphMode === 'nuage' ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Nuage
          </button>
          <button
            onClick={() => setGraphMode('parcours')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              graphMode === 'parcours' ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Parcours
          </button>
        </div>
      )}
    </div>
  )
}
