import { useRef, useEffect, useState, useMemo } from 'react'
import { fmt, fmtDate } from '../utils/format'

const PAD = { top: 24, right: 24, bottom: 44, left: 90 }
const NODE_R = 5

export function GraphView({ transactions, accounts, graphMode }) {
  const containerRef = useRef()
  const canvasRef    = useRef()
  const nodesRef     = useRef([])
  const [tooltip, setTooltip] = useState(null)

  const series = useMemo(() => {
    if (!accounts || !transactions) return []
    return accounts
      .map(account => {
        const txs = transactions
          .filter(t => t.account_id === account.id)
          .sort((a, b) => new Date(a.date) - new Date(b.date))

        let bal = account.initial_balance
        const points = [{ date: account.created_at, balance: bal, tx: null, isForecast: false }]
        for (const tx of txs) {
          bal += tx.type === 'CREDIT' ? tx.amount : -tx.amount
          points.push({ date: tx.date, balance: bal, tx, isForecast: !!tx.forecast_session_id })
        }
        return { account, points }
      })
      .filter(s => s.points.length >= 1)
  }, [transactions, accounts])

  const draw = () => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const W = container.clientWidth
    const H = container.clientHeight
    if (!W || !H) return
    canvas.width  = W
    canvas.height = H

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, W, H)

    if (!series.length) return

    const allPoints = series.flatMap(s => s.points)
    const dates    = allPoints.map(p => new Date(p.date).getTime())
    const balances = allPoints.map(p => p.balance)
    const minDate  = Math.min(...dates)
    const maxDate  = Math.max(...dates)
    const minBal   = Math.min(...balances)
    const maxBal   = Math.max(...balances)
    const dateRng  = maxDate - minDate || 1
    const balRng   = maxBal  - minBal  || 1

    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top  - PAD.bottom

    const xOf = d => PAD.left + ((new Date(d).getTime() - minDate) / dateRng) * plotW
    const yOf = b => PAD.top  + plotH - ((b - minBal) / balRng) * plotH

    // Axes
    ctx.strokeStyle = '#374151'
    ctx.lineWidth   = 1
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(PAD.left, PAD.top)
    ctx.lineTo(PAD.left, H - PAD.bottom)
    ctx.lineTo(W - PAD.right, H - PAD.bottom)
    ctx.stroke()

    // Y grid + labels
    ctx.font      = '11px system-ui, sans-serif'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 4; i++) {
      const b = minBal + balRng * (i / 4)
      const y = yOf(b)
      ctx.fillStyle   = '#4B5563'
      ctx.fillText(Math.round(b).toLocaleString('fr-FR'), PAD.left - 8, y + 4)
      ctx.strokeStyle = '#1F2937'
      ctx.lineWidth   = 1
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      ctx.moveTo(PAD.left, y)
      ctx.lineTo(W - PAD.right, y)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // X labels
    ctx.fillStyle = '#4B5563'
    ctx.textAlign = 'center'
    const d0 = new Date(minDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    const d1 = new Date(maxDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    ctx.fillText(d0, PAD.left, H - PAD.bottom + 18)
    ctx.fillText(d1, W - PAD.right, H - PAD.bottom + 18)

    // Series
    nodesRef.current = []

    for (const { account, points } of series) {
      const color = account.color || '#3B82F6'

      if (graphMode === 'parcours' && points.length > 1) {
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1]
          const curr = points[i]
          ctx.beginPath()
          ctx.strokeStyle = color
          ctx.lineWidth   = 2
          ctx.setLineDash(curr.isForecast ? [6, 4] : [])
          ctx.moveTo(xOf(prev.date), yOf(prev.balance))
          ctx.lineTo(xOf(curr.date), yOf(curr.balance))
          ctx.stroke()
        }
        ctx.setLineDash([])
      }

      for (const p of points) {
        const x = xOf(p.date)
        const y = yOf(p.balance)
        ctx.beginPath()
        ctx.arc(x, y, NODE_R, 0, Math.PI * 2)
        if (p.isForecast) {
          ctx.strokeStyle = color
          ctx.lineWidth   = 2
          ctx.fillStyle   = '#030712'
          ctx.fill()
          ctx.stroke()
        } else {
          ctx.fillStyle   = color
          ctx.strokeStyle = '#030712'
          ctx.lineWidth   = 1.5
          ctx.fill()
          ctx.stroke()
        }
        nodesRef.current.push({ x, y, account, point: p })
      }
    }

    // Legend
    let lx = PAD.left
    const ly = H - PAD.bottom + 30
    ctx.textAlign = 'left'
    for (const { account } of series) {
      ctx.fillStyle = account.color || '#3B82F6'
      ctx.beginPath()
      ctx.arc(lx + 6, ly - 3, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#9CA3AF'
      ctx.fillText(account.name, lx + 14, ly)
      lx += ctx.measureText(account.name).width + 28
    }
  }

  useEffect(() => { draw() }, [series, graphMode])

  useEffect(() => {
    const obs = new ResizeObserver(() => draw())
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [series, graphMode])

  const onMouseMove = e => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    let best = null
    let bestD = 16
    for (const n of nodesRef.current) {
      const d = Math.hypot(n.x - mx, n.y - my)
      if (d < bestD) { bestD = d; best = n }
    }
    setTooltip(best ? { ...best, cx: mx, cy: my } : null)
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ cursor: 'crosshair' }}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
      {!series.length && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
          Aucune donnee a afficher
        </div>
      )}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl z-10"
          style={{ left: tooltip.cx + 14, top: Math.max(4, tooltip.cy - 50), minWidth: 160 }}
        >
          <p className="font-semibold mb-1" style={{ color: tooltip.account.color }}>
            {tooltip.account.name}
          </p>
          <p className="text-gray-400">{fmtDate(tooltip.point.date)}</p>
          {tooltip.point.tx && (
            <p className="text-gray-300 mt-0.5">
              {tooltip.point.tx.description || tooltip.point.tx.category_name || '—'}
            </p>
          )}
          <p className="font-bold text-gray-100 mt-1">{fmt(tooltip.point.balance)}</p>
          {tooltip.point.isForecast && (
            <p className="text-amber-400 mt-0.5">Previsionnel</p>
          )}
        </div>
      )}
    </div>
  )
}
