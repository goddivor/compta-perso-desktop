import { useRef, useState } from 'react'
import { fmt } from '../utils/format'
import { Plus, Settings, Cloud } from 'lucide-react'

const LONG_PRESS_MS = 400

export function BalanceCards({ summary, selectedAccount, onSelectAccount, onAddAccount, onSettings, onSync, onReorder }) {
  const rawAccounts = summary?.accounts || []
  const total = (summary?.total_electronic ?? 0) + (summary?.total_physical ?? 0)

  const [order, setOrder]     = useState(null)   // null = use rawAccounts order
  const [dragIdx, setDragIdx] = useState(null)   // index being dragged
  const [overIdx, setOverIdx] = useState(null)   // current drop target
  const timerRef  = useRef(null)
  const startXRef = useRef(null)
  const activeRef = useRef(false)
  const containerRef = useRef(null)

  const accounts = order
    ? order.map(id => rawAccounts.find(a => a.id === id)).filter(Boolean)
    : rawAccounts

  const cancelLongPress = () => {
    clearTimeout(timerRef.current)
    timerRef.current = null
  }

  const getCardRects = () => {
    if (!containerRef.current) return []
    return [...containerRef.current.querySelectorAll('[data-acct]')].map(el => el.getBoundingClientRect())
  }

  const findOverIdx = (clientX) => {
    const rects = getCardRects()
    for (let i = 0; i < rects.length; i++) {
      if (clientX < rects[i].right) return i
    }
    return rects.length - 1
  }

  const onPointerDown = (idx, e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    startXRef.current = e.clientX
    activeRef.current = false
    timerRef.current = setTimeout(() => {
      activeRef.current = true
      setDragIdx(idx)
      setOverIdx(idx)
      setOrder(accounts.map(a => a.id))
      e.target.setPointerCapture?.(e.pointerId)
    }, LONG_PRESS_MS)
  }

  const onPointerMove = (e) => {
    // Cancel long press if moved too much before activation
    if (!activeRef.current) {
      if (Math.abs(e.clientX - startXRef.current) > 6) cancelLongPress()
      return
    }
    const idx = findOverIdx(e.clientX)
    setOverIdx(idx)
  }

  const onPointerUp = (e) => {
    cancelLongPress()
    if (!activeRef.current) { activeRef.current = false; return }
    activeRef.current = false

    setOrder(prev => {
      if (prev === null || dragIdx === null || overIdx === null) return prev
      const next = [...prev]
      const [moved] = next.splice(dragIdx, 1)
      next.splice(overIdx, 0, moved)
      window.api.accounts.reorder(next).then(() => onReorder?.())
      return next
    })
    setDragIdx(null)
    setOverIdx(null)
  }

  const onPointerCancel = () => {
    cancelLongPress()
    activeRef.current = false
    setDragIdx(null)
    setOverIdx(null)
  }

  return (
    <div className="shrink-0 border-b border-edge bg-surface">
      <div
        ref={containerRef}
        className="flex items-stretch gap-0 overflow-x-auto"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {/* Total */}
        <button
          onClick={() => onSelectAccount('')}
          className={`shrink-0 flex flex-col px-5 py-4 border-r border-edge transition-colors text-left ${
            !selectedAccount ? 'bg-blue-600/10 border-b-2 border-b-blue-500' : 'hover:bg-gray-800/50'
          }`}
        >
          <span className="text-xs text-gray-500 mb-1">Total global</span>
          <span className="text-lg font-bold text-gray-100">{fmt(total)}</span>
        </button>

        {/* Per account — draggable */}
        {accounts.map((a, idx) => {
          const isDragging = dragIdx === idx && activeRef.current
          const isOver     = overIdx === idx && dragIdx !== null && dragIdx !== idx

          return (
            <button
              key={a.id}
              data-acct={a.id}
              onPointerDown={e => onPointerDown(idx, e)}
              onClick={() => {
                if (activeRef.current) return
                onSelectAccount(selectedAccount === a.id ? '' : a.id)
              }}
              className={`shrink-0 flex flex-col px-5 py-4 border-r transition-all text-left select-none
                ${isOver ? 'border-l-2 border-l-blue-400' : 'border-edge'}
                ${isDragging ? 'opacity-40 scale-95' : ''}
                ${dragIdx !== null ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}
                ${selectedAccount === a.id && !dragIdx ? 'bg-gray-800 border-b-2' : 'hover:bg-gray-800/50'}
              `}
              style={{
                ...(selectedAccount === a.id && !dragIdx ? { borderBottomColor: a.color } : {}),
                touchAction: 'none',
              }}
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
          )
        })}

        {/* Add account */}
        <button
          onClick={onAddAccount}
          className="shrink-0 flex items-center gap-1.5 px-4 py-4 text-gray-600 hover:text-gray-300 hover:bg-gray-800/50 transition-colors border-r border-edge"
        >
          <Plus size={14} />
          <span className="text-xs">Compte</span>
        </button>

        <div className="flex-1" />

        <button
          onClick={onSync}
          title="Synchronisation cloud"
          className="shrink-0 flex items-center px-3 text-gray-600 hover:text-gray-300 hover:bg-gray-800/50 transition-colors"
        >
          <Cloud size={15} />
        </button>

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
