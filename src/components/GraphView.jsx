import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { Locate } from 'lucide-react'
import { fmt, fmtDate } from '../utils/format'
import { useT } from '../i18n'
import { forceLayout } from '../graph/forceLayout'

const SIM_COLORS = ['#F59E0B', '#818CF8', '#34D399', '#F472B6', '#60A5FA', '#FB923C']
const MIN_R = 14
const MAX_R = 30
const MIN_ZOOM = 0.2
const MAX_ZOOM = 4
const ARROW_H = 7

// ── Graph model ──────────────────────────────────────────────────────────────

function buildGraph(transactions, accounts, t) {
  if (!accounts?.length) return null

  const nodes = []
  const edges = []
  const byId = new Map()

  const addNode = node => { nodes.push(node); byId.set(node.id, node) }

  // Real chains: one "initial balance" node per account + one node per transaction
  const lastRealId = {}
  accounts.forEach((account, group) => {
    const color = account.color || '#FFD200'
    const txs = transactions
      .filter(x => x.account_id === account.id && !x.forecast_session_id)
      .sort((a, b) => new Date(a.date) - new Date(b.date) || a.id - b.id)

    let bal = account.initial_balance
    const initId = `init-${account.id}`
    addNode({
      id: initId, group, order: 0, account, color,
      point: { date: account.created_at || new Date().toISOString(), balance: bal, label: t('graph.initialBalance'), tx: null },
    })
    let prevId = initId
    txs.forEach((tx, i) => {
      bal += tx.type === 'CREDIT' ? tx.amount : -tx.amount
      const id = `tx-${tx.id}`
      addNode({
        id, group, order: i + 1, account, color,
        point: {
          date: tx.date, balance: bal,
          label: tx.description || tx.category_name || (tx.type === 'CREDIT' ? t('common.credit') : t('common.debit')),
          tx,
        },
      })
      edges.push({ source: prevId, target: id, chain: true, color, kind: 'chain' })
      prevId = id
    })
    lastRealId[account.id] = prevId
  })

  // Simulation branches (forecast sessions), forked from the last real node
  const simTxs = transactions.filter(x => x.forecast_session_id)
  const sessionIds = [...new Set(simTxs.map(x => x.forecast_session_id))]
  sessionIds.forEach((sessionId, simIdx) => {
    const simColor = SIM_COLORS[simIdx % SIM_COLORS.length]
    const sessionTxs = simTxs
      .filter(x => x.forecast_session_id === sessionId)
      .sort((a, b) => new Date(a.date) - new Date(b.date) || a.id - b.id)
    const accountIds = [...new Set(sessionTxs.map(x => x.account_id))]
    for (const accountId of accountIds) {
      const account = accounts.find(a => a.id === accountId)
      if (!account) continue
      const group = accounts.indexOf(account)
      const anchor = byId.get(lastRealId[accountId])
      let bal = anchor ? anchor.point.balance : account.initial_balance
      let prevId = lastRealId[accountId]
      let order = (anchor?.order ?? 0) + 1
      for (const tx of sessionTxs.filter(x => x.account_id === accountId)) {
        bal += tx.type === 'CREDIT' ? tx.amount : -tx.amount
        const id = `tx-${tx.id}`
        addNode({
          id, group, order: order++, account, color: account.color || '#FFD200', simColor,
          point: {
            date: tx.date, balance: bal,
            label: tx.description || tx.category_name || (tx.type === 'CREDIT' ? t('common.credit') : t('common.debit')),
            tx,
          },
        })
        edges.push({ source: prevId, target: id, chain: true, color: simColor, kind: 'sim' })
        prevId = id
      }
    }
  })

  // Transfer links (yellow dashed), oriented debit -> credit
  const done = new Set()
  for (const node of nodes) {
    const tx = node.point.tx
    const pairId = tx?.transfer_pair_id
    if (!pairId) continue
    const key = [tx.id, pairId].sort((a, b) => a - b).join('-')
    if (done.has(key)) continue
    done.add(key)
    const partner = byId.get(`tx-${pairId}`)
    if (!partner) continue
    const src = tx.type === 'DEBIT' ? node : partner
    const dst = tx.type === 'DEBIT' ? partner : node
    edges.push({ source: src.id, target: dst.id, chain: false, color: '#FFD200', kind: 'transfer' })
  }

  // Node radius: proportional to sqrt(amount), clamped to [MIN_R, MAX_R]
  const amountOf = n => Math.abs(n.point.tx ? n.point.tx.amount : n.point.balance)
  const maxAmount = Math.max(1, ...nodes.map(amountOf))
  for (const n of nodes)
    n.r = MIN_R + (MAX_R - MIN_R) * Math.sqrt(amountOf(n) / maxAmount)

  return { nodes, edges, byId }
}

// ── Canvas helpers ───────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

function drawEdge(ctx, x1, y1, x2, y2, r1, r2, color, dashed) {
  const dx = x2 - x1
  const dy = y2 - y1
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d < r1 + r2 + 4) return
  const ux = dx / d
  const uy = dy / d
  const sx = x1 + ux * (r1 + 2)
  const sy = y1 + uy * (r1 + 2)
  const ex = x2 - ux * (r2 + 3)
  const ey = y2 - uy * (r2 + 3)
  ctx.beginPath()
  ctx.setLineDash(dashed ? [5, 4] : [])
  ctx.moveTo(sx, sy)
  ctx.lineTo(ex, ey)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.3
  ctx.stroke()
  ctx.setLineDash([])
  const ang = Math.atan2(ey - sy, ex - sx)
  ctx.beginPath()
  ctx.moveTo(ex, ey)
  ctx.lineTo(ex - ARROW_H * Math.cos(ang - Math.PI / 6), ey - ARROW_H * Math.sin(ang - Math.PI / 6))
  ctx.lineTo(ex - ARROW_H * Math.cos(ang + Math.PI / 6), ey - ARROW_H * Math.sin(ang + Math.PI / 6))
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function drawNode(ctx, node, x, y) {
  const { r, color, simColor } = node
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = simColor ? simColor + '22' : color + '33'
  ctx.fill()
  ctx.setLineDash(simColor ? [5, 3] : [])
  ctx.strokeStyle = simColor || color
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.setLineDash([])

  // Pill under the node: signed amount + short date
  const tx = node.point.tx
  const amountText = tx
    ? (tx.type === 'CREDIT' ? '+' : '-') + fmt(tx.amount)
    : fmt(node.point.balance)
  const amountColor = tx ? (tx.type === 'CREDIT' ? '#34D399' : '#F87171') : '#F5F1EC'
  const dateText = fmtDate(node.point.date)

  ctx.font = 'bold 11px system-ui,sans-serif'
  const w1 = ctx.measureText(amountText).width
  ctx.font = '10px system-ui,sans-serif'
  const w2 = ctx.measureText(dateText).width
  const pw = Math.max(w1, w2) + 16
  const ph = 32
  const px = x - pw / 2
  const py = y + r + 5

  ctx.beginPath()
  ctx.roundRect(px, py, pw, ph, 8)
  ctx.fillStyle = '#211C1A'
  ctx.fill()
  ctx.strokeStyle = '#352E2A'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.font = 'bold 11px system-ui,sans-serif'
  ctx.fillStyle = amountColor
  ctx.fillText(amountText, x, py + 13)
  ctx.font = '10px system-ui,sans-serif'
  ctx.fillStyle = '#A89E92'
  ctx.fillText(dateText, x, py + 25)
}

// ── Component ────────────────────────────────────────────────────────────────

export function GraphView({ transactions, accounts }) {
  const t = useT()
  const containerRef = useRef()
  const canvasRef = useRef()
  const posRef = useRef(new Map()) // id -> { x, y } (mutable: node drag)
  const viewRef = useRef({ scale: 1, ox: 0, oy: 0 })
  const dragRef = useRef(null)
  const rafRef = useRef(0)
  const [tooltip, setTooltip] = useState(null)

  const graph = useMemo(
    () => buildGraph(transactions, accounts, t),
    [transactions, accounts, t]
  )

  // Layout computed once per dataset
  const layout = useMemo(
    () => (graph ? forceLayout(graph.nodes, graph.edges, accounts?.length || 1) : null),
    [graph, accounts]
  )

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !graph) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const { scale, ox, oy } = viewRef.current
    const pos = posRef.current

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy)

    for (const e of graph.edges) {
      const p1 = pos.get(e.source)
      const p2 = pos.get(e.target)
      if (!p1 || !p2) continue
      const n1 = graph.byId.get(e.source)
      const n2 = graph.byId.get(e.target)
      drawEdge(ctx, p1.x, p1.y, p2.x, p2.y, n1.r, n2.r, e.color, e.kind !== 'chain')
    }
    for (const node of graph.nodes) {
      const p = pos.get(node.id)
      if (p) drawNode(ctx, node, p.x, p.y)
    }
  }, [graph])

  const scheduleDraw = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => { rafRef.current = 0; draw() })
  }, [draw])

  const zoomToFit = useCallback(() => {
    const container = containerRef.current
    const pos = posRef.current
    if (!container || !pos.size) return
    const cw = container.clientWidth
    const ch = container.clientHeight
    if (!cw || !ch) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const { x, y } of pos.values()) {
      minX = Math.min(minX, x - MAX_R - 60)
      maxX = Math.max(maxX, x + MAX_R + 60)
      minY = Math.min(minY, y - MAX_R - 30)
      maxY = Math.max(maxY, y + MAX_R + 70) // room for the pill below
    }
    const bw = Math.max(maxX - minX, 1)
    const bh = Math.max(maxY - minY, 1)
    const scale = clamp(Math.min(cw / bw, ch / bh), MIN_ZOOM, 1.25)
    viewRef.current = {
      scale,
      ox: (cw - bw * scale) / 2 - minX * scale,
      oy: (ch - bh * scale) / 2 - minY * scale,
    }
    scheduleDraw()
  }, [scheduleDraw])

  // Reset positions + fit whenever the dataset (layout) changes
  useEffect(() => {
    if (!layout) return
    const pos = new Map()
    for (const [id, p] of layout) pos.set(id, { x: p.x, y: p.y })
    posRef.current = pos
    zoomToFit()
  }, [layout, zoomToFit])

  // Canvas sizing (DPR aware) + redraw on resize
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(container.clientWidth * dpr))
      canvas.height = Math.max(1, Math.round(container.clientHeight * dpr))
      draw()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()
    return () => ro.disconnect()
  }, [draw])

  // Wheel zoom around the cursor (native listener: preventDefault needs passive:false)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = e => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const v = viewRef.current
      const ns = clamp(v.scale * Math.exp(-e.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM)
      v.ox = mx - ((mx - v.ox) * ns) / v.scale
      v.oy = my - ((my - v.oy) * ns) / v.scale
      v.scale = ns
      setTooltip(null)
      scheduleDraw()
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [scheduleDraw])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const hitNode = (mx, my) => {
    if (!graph) return null
    const { scale, ox, oy } = viewRef.current
    const wx = (mx - ox) / scale
    const wy = (my - oy) / scale
    for (let i = graph.nodes.length - 1; i >= 0; i--) {
      const node = graph.nodes[i]
      const p = posRef.current.get(node.id)
      if (!p) continue
      const dx = wx - p.x
      const dy = wy - p.y
      if (dx * dx + dy * dy <= node.r * node.r) return { node, wx, wy }
    }
    return null
  }

  const localXY = e => {
    const rect = canvasRef.current.getBoundingClientRect()
    return { mx: e.clientX - rect.left, my: e.clientY - rect.top }
  }

  const onMouseDown = e => {
    if (e.button !== 0) return
    const { mx, my } = localXY(e)
    const hit = hitNode(mx, my)
    if (hit) {
      const p = posRef.current.get(hit.node.id)
      dragRef.current = { mode: 'node', id: hit.node.id, dx: hit.wx - p.x, dy: hit.wy - p.y }
    } else {
      dragRef.current = { mode: 'pan', mx, my }
    }
    canvasRef.current.style.cursor = 'grabbing'
    setTooltip(null)
  }

  const onMouseMove = e => {
    const { mx, my } = localXY(e)
    const drag = dragRef.current
    if (drag?.mode === 'pan') {
      const v = viewRef.current
      v.ox += mx - drag.mx
      v.oy += my - drag.my
      drag.mx = mx
      drag.my = my
      scheduleDraw()
      return
    }
    if (drag?.mode === 'node') {
      const { scale, ox, oy } = viewRef.current
      const p = posRef.current.get(drag.id)
      if (p) {
        p.x = (mx - ox) / scale - drag.dx
        p.y = (my - oy) / scale - drag.dy
        scheduleDraw()
      }
      return
    }
    const hit = hitNode(mx, my)
    canvasRef.current.style.cursor = hit ? 'pointer' : 'grab'
    setTooltip(hit ? { node: hit.node, px: e.clientX, py: e.clientY } : null)
  }

  const endDrag = () => {
    dragRef.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
  }

  const onDoubleClick = e => {
    const { mx, my } = localXY(e)
    const v = viewRef.current
    const ns = clamp(v.scale * 2, MIN_ZOOM, MAX_ZOOM)
    v.ox = mx - ((mx - v.ox) * ns) / v.scale
    v.oy = my - ((my - v.oy) * ns) / v.scale
    v.scale = ns
    scheduleDraw()
  }

  if (!graph || !graph.nodes.length)
    return <div className="flex items-center justify-center h-full text-faint text-sm">{t('graph.empty')}</div>

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-base">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block cursor-grab"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={() => { endDrag(); setTooltip(null) }}
        onDoubleClick={onDoubleClick}
      />

      {/* Account legend */}
      <div className="absolute top-3 left-3 flex flex-col gap-1 pointer-events-none">
        {(accounts || []).map(a => (
          <div key={a.id} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color || '#FFD200' }} />
            {a.name}
          </div>
        ))}
      </div>

      {/* Recenter button */}
      <button
        onClick={zoomToFit}
        title={t('graph.recenter')}
        className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-surface2 border border-edge text-muted hover:text-ink hover:border-primary/50 flex items-center justify-center shadow-lg transition-colors"
      >
        <Locate size={16} />
      </button>

      {tooltip && (
        <div
          className="fixed pointer-events-none bg-surface2 border border-edge rounded-lg px-3 py-2 text-xs shadow-xl z-50"
          style={{ left: tooltip.px + 14, top: tooltip.py - 60, minWidth: 160 }}
        >
          <p className="font-semibold mb-1" style={{ color: tooltip.node.simColor || tooltip.node.account.color }}>
            {tooltip.node.account.name}{tooltip.node.simColor ? t('graph.simulation') : ''}
          </p>
          <p className="text-muted">{fmtDate(tooltip.node.point.date)}</p>
          <p className="text-content mt-0.5">{tooltip.node.point.label}</p>
          {tooltip.node.point.tx && (
            <p className={`mt-0.5 font-mono ${tooltip.node.point.tx.type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {tooltip.node.point.tx.type === 'CREDIT' ? '+' : '-'}{fmt(tooltip.node.point.tx.amount)}
            </p>
          )}
          <p className="font-bold text-ink mt-1">{fmt(tooltip.node.point.balance)}</p>
        </div>
      )}
    </div>
  )
}
