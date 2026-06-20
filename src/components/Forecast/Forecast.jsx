import { useState } from 'react'
import { useAsync } from '../../hooks/useAsync'
import { fmt, fmtDate } from '../../utils/format'
import { Spinner, Empty } from '../ui/Spinner'
import { Button } from '../ui/Button'
import { ForecastSessionModal } from './ForecastSessionModal'
import { ForecastDetail } from './ForecastDetail'
import { Plus, CheckCircle, Clock, ChevronRight, Trash2 } from 'lucide-react'

export function Forecast() {
  const { data: sessions, loading, refetch } = useAsync(() => window.api.forecast.getSessions())
  const [showModal, setShowModal] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  const deleteSession = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Supprimer cette simulation et ses transactions ?')) return
    await window.api.forecast.deleteSession(id)
    refetch()
  }

  if (selectedId) {
    return (
      <div className="p-6">
        <ForecastDetail
          sessionId={selectedId}
          onBack={() => setSelectedId(null)}
          onChanged={refetch}
        />
      </div>
    )
  }

  if (loading) return <Spinner />

  const pending   = (sessions || []).filter(s => !s.validated_at)
  const validated = (sessions || []).filter(s =>  s.validated_at)

  const SessionCard = ({ s }) => {
    const netColor = s.net >= 0 ? 'text-emerald-400' : 'text-rose-400'
    return (
      <div
        onClick={() => setSelectedId(s.id)}
        className="bg-gray-900 rounded-xl border border-gray-800 p-5 cursor-pointer hover:border-gray-700 transition-all group flex items-center gap-4"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {s.validated_at
              ? <CheckCircle size={14} className="text-emerald-400 shrink-0" />
              : <Clock size={14} className="text-amber-400 shrink-0" />
            }
            <p className="font-medium text-gray-100 truncate">{s.name}</p>
          </div>
          <p className="text-xs text-gray-500">
            {fmtDate(s.created_at)} · {s.tx_count} transaction{s.tx_count !== 1 ? 's' : ''}
            {s.validated_at && ` · Validée le ${fmtDate(s.validated_at)}`}
          </p>
        </div>
        <p className={`text-base font-bold ${netColor} shrink-0`}>
          {s.net >= 0 ? '+' : ''}{fmt(s.net)}
        </p>
        <div className="flex items-center gap-1">
          {!s.validated_at && (
            <button onClick={(e) => deleteSession(e, s.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-gray-500 hover:text-rose-400 hover:bg-gray-800 transition-all">
              <Trash2 size={13} />
            </button>
          )}
          <ChevronRight size={16} className="text-gray-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Prévisionnel</h1>
          <p className="text-sm text-gray-500 mt-0.5">Simulez des dépenses et visualisez leur impact avant de les réaliser.</p>
        </div>
        <Button onClick={() => setShowModal(true)}><Plus size={14} />Nouvelle simulation</Button>
      </div>

      {(sessions || []).length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-dashed border-gray-700 p-12 text-center">
          <p className="text-4xl mb-3">🔮</p>
          <p className="text-gray-400 font-medium mb-1">Aucune simulation</p>
          <p className="text-sm text-gray-600">Créez une simulation pour prévoir l'impact de vos dépenses.</p>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">En attente</p>
              {pending.map(s => <SessionCard key={s.id} s={s} />)}
            </div>
          )}
          {validated.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Validées</p>
              {validated.map(s => <SessionCard key={s.id} s={s} />)}
            </div>
          )}
        </>
      )}

      <ForecastSessionModal isOpen={showModal} onClose={() => setShowModal(false)} onSave={refetch} />
    </div>
  )
}
