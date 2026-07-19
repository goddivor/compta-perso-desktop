import { useRef, useEffect } from 'react'
import { fmt, fmtDate } from '../utils/format'
import { Badge } from './ui/Badge'
import { Spinner, Empty } from './ui/Spinner'
import { Edit2, Trash2, ArrowLeftRight } from 'lucide-react'
import { useT } from '../i18n'

export function TableView({ transactions, loading, onEdit, onDelete }) {
  const t = useT()
  const bottomRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [transactions])

  if (loading) return <Spinner />
  if (!transactions?.length) return <Empty label={t('table.empty')} />

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-base z-10">
          <tr className="border-b border-edge text-xs text-muted uppercase tracking-wide">
            <th className="px-4 py-3 text-left">{t('common.date')}</th>
            <th className="px-3 py-3 text-left">{t('common.description')}</th>
            <th className="px-3 py-3 text-left">{t('common.account')}</th>
            <th className="px-3 py-3 text-left">{t('common.category')}</th>
            <th className="px-4 py-3 text-right">{t('common.amount')}</th>
            <th className="px-3 py-3 w-16" />
          </tr>
        </thead>
        <tbody>
          {transactions.map(tx => {
            const isForecast = !!tx.forecast_session_id
            return (
              <tr
                key={tx.id}
                className={`border-b group transition-colors ${
                  isForecast
                    ? 'border-amber-900/30 bg-amber-950/10 hover:bg-amber-950/20'
                    : 'border-edge/50 hover:bg-surface2/60'
                }`}
              >
                <td className="px-4 py-2.5 text-ink whitespace-nowrap text-xs">
                  {fmtDate(tx.date)}
                </td>
                <td className="px-3 py-2.5 text-content max-w-[180px]">
                  <div className="flex items-center gap-1.5">
                    {tx.transfer_pair_id && (
                      <ArrowLeftRight size={11} className="text-primary shrink-0" />
                    )}
                    <span className="truncate block">
                      {tx.description || '—'}
                    </span>
                  </div>
                  {isForecast && (
                    <span className="text-xs text-amber-500 block">
                      {tx.forecast_session_name || t('table.forecast')}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: tx.account_color || '#807669' }}
                    />
                    {tx.account_name}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {tx.category_name
                    ? <Badge color={tx.category_color}>{tx.category_name}</Badge>
                    : <span className="text-faint text-xs">—</span>}
                </td>
                <td className={`px-4 py-2.5 text-right font-mono font-medium whitespace-nowrap ${
                  tx.type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {tx.type === 'CREDIT' ? '+' : '-'}{fmt(tx.amount)}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                    <button
                      onClick={() => onEdit(tx)}
                      className="p-1.5 rounded text-faint hover:text-ink hover:bg-edge transition-colors"
                      title={tx.transfer_pair_id ? t('table.editTransfer') : t('common.edit')}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => onDelete(tx.id)}
                      className="p-1.5 rounded text-faint hover:text-rose-400 hover:bg-edge transition-colors"
                      title={t('common.delete')}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div ref={bottomRef} />
    </div>
  )
}
