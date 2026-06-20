import { fmt } from '../utils/format'
import { Plus, Settings } from 'lucide-react'

export function BalanceCards({ summary, selectedAccount, onSelectAccount, onAddAccount, onSettings }) {
  const accounts = summary?.accounts || []
  const total    = (summary?.total_electronic ?? 0) + (summary?.total_physical ?? 0)

  return (
    <div className="shrink-0 border-b border-gray-800 bg-gray-900">
      <div className="flex items-stretch gap-0 overflow-x-auto">
        {/* Total */}
        <button
          onClick={() => onSelectAccount('')}
          className={`shrink-0 flex flex-col px-5 py-4 border-r border-gray-800 transition-colors text-left ${
            !selectedAccount ? 'bg-blue-600/10 border-b-2 border-b-blue-500' : 'hover:bg-gray-800/50'
          }`}
        >
          <span className="text-xs text-gray-500 mb-1">Total global</span>
          <span className="text-lg font-bold text-gray-100">{fmt(total)}</span>
        </button>

        {/* Per account */}
        {accounts.map(a => (
          <button
            key={a.id}
            onClick={() => onSelectAccount(selectedAccount === a.id ? '' : a.id)}
            className={`shrink-0 flex flex-col px-5 py-4 border-r border-gray-800 transition-colors text-left ${
              selectedAccount === a.id
                ? 'bg-gray-800 border-b-2'
                : 'hover:bg-gray-800/50'
            }`}
            style={selectedAccount === a.id ? { borderBottomColor: a.color } : {}}
          >
            <span className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
              {a.name}
              {a.provider && <span className="text-gray-700">· {a.provider}</span>}
            </span>
            <span
              className="text-base font-bold"
              style={{ color: a.current_balance >= 0 ? '#34D399' : '#F87171' }}
            >
              {fmt(a.current_balance)}
            </span>
          </button>
        ))}

        {/* Add account */}
        <button
          onClick={onAddAccount}
          className="shrink-0 flex items-center gap-1.5 px-4 py-4 text-gray-600 hover:text-gray-300 hover:bg-gray-800/50 transition-colors border-r border-gray-800"
        >
          <Plus size={14} />
          <span className="text-xs">Compte</span>
        </button>

        <div className="flex-1" />

        <button
          onClick={onSettings}
          className="shrink-0 flex items-center px-4 text-gray-600 hover:text-gray-300 hover:bg-gray-800/50 transition-colors"
        >
          <Settings size={15} />
        </button>
      </div>
    </div>
  )
}
