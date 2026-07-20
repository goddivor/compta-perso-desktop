import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { Locate } from 'lucide-react'
import { fmt, fmtDate } from '../utils/format'
import { useT } from '../i18n'

const SIM_COLORS = ['#F59E0B', '#818CF8', '#34D399', '#F472B6', '#60A5FA', '#FB923C']
const MIN_R = 14
const MAX_R = 30
const HEADER_R = 16
const MIN_ZOOM = 0.2
const MAX_ZOOM = 4
const ARROW_H = 7
const COL_SPACING = 220 // horizontal distance between account columns
const ROW_H = 90        // vertical distance between chronological rows
const COL0_X = 150      // x of the first column center
const HEADER_Y = 40     // y of the header nodes line
const ROWS_TOP = 170    // y of the first transaction row
const MARKER_X = 16     // x of the date markers in the left margin

// ── Graph model: chronological columns ───────────────────────────────────────
//
// One vertical column per account (ordered as received: position, id), a
// header node on a shared top line, then one global chronological row per
// transaction (time flows downwards). Both entries of a transfer pair share
// the same row and are linked by a yellow arrow (debit -> credit).

function buildGraph(transactions, accounts, t) {
  if (!accounts?.length) return null

  const colOf = new Map(accounts.map((a, i) => [a.id, i]))
  const colX = i => COL0_X + i * COL_SPACING

  const nodes = []
  const edges = []
  const markers = []
  const byId = new Map()
  const addNode = n => { nodes.push(n); byId.set(n.id, n) }

  const txLabel = tx =>
    tx.description || tx.category_name || (tx.type === 'CREDIT' ? t('common.credit') : t('common.debit'))

  // Node radius: proportional to sqrt(amount), clamped to [MIN_R, MAX_R]
  const shown = transactions.filter(x => colOf.has(x.account_id))
  const maxAmount = Math.max(1, ...shown.map(x => Math.abs(x.amount)))
  const radius = amount => MIN_R + (MAX_R - MIN_R) * Math.sqrt(Math.abs(amount) / maxAmount)

  // Header nodes (account circle + name), all on the same horizontal line
  accounts.forEach((account, i) => {
    addNode({
      id: `head-${account.id}`, kind: 'header', account,
      color: account.color || '#FFD200', r: HEADER_R,
      x: colX(i), y: HEADER_Y,
      point: {
        date: account.created_at || new Date().toISOString(),
        balance: account.initial_balance,
        label: t('graph.initialBalance'),
        tx: null,
      },
    })
  })

  // Real transactions, merged and sorted chronologically (date ASC, created_at ASC)
  const real = shown
    .filter(x => !x.forecast_session_id)
    .sort((a, b) =>
      new Date(a.date) - new Date(b.date) ||
      new Date(a.created_at || 0) - new Date(b.created_at || 0) ||
      a.id - b.id
    )

  const balances = new Map(accounts.map(a => [a.id, a.initial_balance]))
  const lastNodeId = new Map(accounts.map(a => [a.id, `head-${a.id}`]))
  const rowOf = new Map() // tx.id -> global row index
  let row = 0
  let prevDay = null

  for (const tx of real) {
    // Both entries of a transfer pair share the same row
    const pairRow = tx.transfer_pair_id != null ? rowOf.get(tx.transfer_pair_id) : undefined
    let r
    if (pairRow != null) {
      r = pairRow
    } else {
      r = row++
      // Date marker in the left margin on each day change
      const day = String(tx.date).slice(0, 10)
      if (day !== prevDay) {
        prevDay = day
        markers.push({ y: ROWS_TOP + r * ROW_H, text: `${day.slice(8, 10)}/${day.slice(5, 7)}` })
      }
    }
    rowOf.set(tx.id, r)

    const bal = balances.get(tx.account_id) + (tx.type === 'CREDIT' ? tx.amount : -tx.amount)
    balances.set(tx.account_id, bal)
    const col = colOf.get(tx.account_id)
    const account = accounts[col]
    const color = account.color || '#FFD200'
    const id = `tx-${tx.id}`
    addNode({
      id, kind: 'tx', account, color, r: radius(tx.amount),
      x: colX(col), y: ROWS_TOP + r * ROW_H,
      point: { date: tx.date, balance: bal, label: txLabel(tx), tx },
    })
    edges.push({ source: lastNodeId.get(tx.account_id), target: id, color, kind: 'chain' })
    lastNodeId.set(tx.account_id, id)
  }

  // Transfer links (yellow dashed), oriented debit -> credit, on a shared row
  const done = new Set()
  for (const tx of real) {
    if (!tx.transfer_pair_id) continue
    const key = [tx.id, tx.transfer_pair_id].sort((a, b) => a - b).join('-')
    if (done.has(key)) continue
    done.add(key)
    if (!byId.has(`tx-${tx.transfer_pair_id}`)) continue
    const src = tx.type === 'DEBIT' ? `tx-${tx.id}` : `tx-${tx.transfer_pair_id}`
    const dst = tx.type === 'DEBIT' ? `tx-${tx.transfer_pair_id}` : `tx-${tx.id}`
    edges.push({ source: src, target: dst, color: '#FFD200', kind: 'transfer' })
  }

  // Simulation branches (forecast sessions): appended in the account column,
  // after the last real node, on their own rows
  const simTxs = shown.filter(x => x.forecast_session_id)
  const sessionIds = [...new Set(simTxs.map(x => x.forecast_session_id))]
  sessionIds.forEach((sessionId, simIdx) => {
    const simColor = SIM_COLORS[simIdx % SIM_COLORS.length]
    const sessionTxs = simTxs
      .filter(x => x.forecast_session_id === sessionId)
      .sort((a, b) =>
        new Date(a.date) - new Date(b.date) ||
        new Date(a.created_at || 0) - new Date(b.created_at || 0) ||
        a.id - b.id
      )
    const accountIds = [...new Set(sessionTxs.map(x => x.account_id))]
    for (const accountId of accountIds) {
      const col = colOf.get(accountId)
      const account = accounts[col]
      let bal = balances.get(accountId) // branch starts from the last real balance
      let prevId = lastNodeId.get(accountId)
      for (const tx of sessionTxs.filter(x => x.account_id === accountId)) {
        bal += tx.type === 'CREDIT' ? tx.amount : -tx.amount
        const r = row++
        const id = `tx-${tx.id}`
        addNode({
          id, kind: 'tx', account, color: account.color || '#FFD200', simColor,
          r: radius(tx.amount), x: colX(col), y: ROWS_TOP + r * ROW_H,
          point: { date: tx.date, balance: bal, label: txLabel(tx), tx },
        })
        edges.push({ source: prevId, target: id, color: simColor, kind: 'sim' })
        prevId = id
      }
    }
  })

  return { nodes, edges, markers, byId }
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

function drawPill(ctx, x, top, lines) {
  let w = 0
  for (const line of lines) {
    ctx.font = line.font
    w = Math.max(w, ctx.measureText(line.text).width)
  }
  const pw = w + 16
  const ph = lines.length * 12 + 8
  ctx.beginPath()
  ctx.roundRect(x - pw / 2, top, pw, ph, 8)
  ctx.fillStyle = '#211C1A'
  ctx.fill()
  ctx.strokeStyle = '#352E2A'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.textAlign = 'center'
  lines.forEach((line, i) => {
    ctx.font = line.font
    ctx.fillStyle = line.color
    ctx.fillText(line.text, x, top + 13 + i * 12)
  })
}

function drawNode(ctx, node) {
  const { x, y, r, color, simColor } = node
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = simColor ? simColor + '22' : color + '33'
  ctx.fill()
  ctx.setLineDash(simColor ? [5, 3] : [])
  ctx.strokeStyle = simColor || color
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.setLineDash([])

  if (node.kind === 'header') {
    drawPill(ctx, x, y + r + 5, [
      { text: node.account.name, font: 'bold 11px system-ui,sans-serif', color: '#F5F1EC' },
    ])
    return
  }

  const tx = node.point.tx
  const amountText = (tx.type === 'CREDIT' ? '+' : '-') + fmt(tx.amount)
  const amountColor = tx.type === 'CREDIT' ? '#34D399' : '#F87171'
  drawPill(ctx, x, y + r + 5, [
    { text: amountText, font: 'bold 11px system-ui,sans-serif', color: amountColor },
    { text: fmtDate(node.point.date), font: '10px system-ui,sans-serif', color: '#A89E92' },
  ])
}

// ── Component ────────────────────────────────────────────────────────────────

export function GraphView({ transactions, accounts }) {
  const t = useT()
  const containerRef = useRef()
  const canvasRef = useRef()
  const viewRef = useRef({ scale: 1, ox: 0, oy: 0 })
  const dragRef = useRef(null)
  const rafRef = useRef(0)
  const [tooltip, setTooltip] = useState(null)

  const graph = useMemo(
    () => buildGraph(transactions, accounts, t),
    [transactions, accounts, t]
  )

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !graph) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const { scale, ox, oy } = viewRef.current

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy)

    // Date markers in the left margin
    ctx.font = '10px system-ui,sans-serif'
    ctx.fillStyle = '#A89E92'
    ctx.textAlign = 'left'
    for (const m of graph.markers) ctx.fillText(m.text, MARKER_X, m.y + 3)

    for (const e of graph.edges) {
      const n1 = graph.byId.get(e.source)
      const n2 = graph.byId.get(e.target)
      if (!n1 || !n2) continue
      drawEdge(ctx, n1.x, n1.y, n2.x, n2.y, n1.r, n2.r, e.color, e.kind !== 'chain')
    }
    for (const node of graph.nodes) drawNode(ctx, node)
  }, [graph])

  const scheduleDraw = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => { rafRef.current = 0; draw() })
  }, [draw])

  const zoomToFit = useCallback(() => {
    const container = containerRef.current
    if (!container || !graph?.nodes.length) return
    const cw = container.clientWidth
    const ch = container.clientHeight
    if (!cw || !ch) return
    let minX = MARKER_X - 20, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const { x, y } of graph.nodes) {
      minX = Math.min(minX, x - MAX_R - 60)
      maxX = Math.max(maxX, x + MAX_R + 60)
      minY = Math.min(minY, y - MAX_R - 20)
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
  }, [graph, scheduleDraw])

  // Fit the view whenever the dataset changes
  useEffect(() => { zoomToFit() }, [zoomToFit])

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
      const dx = wx - node.x
      const dy = wy - node.y
      if (dx * dx + dy * dy <= node.r * node.r) return node
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
    dragRef.current = { mx, my }
    canvasRef.current.style.cursor = 'grabbing'
    setTooltip(null)
  }

  const onMouseMove = e => {
    const { mx, my } = localXY(e)
    const drag = dragRef.current
    if (drag) {
      const v = viewRef.current
      v.ox += mx - drag.mx
      v.oy += my - drag.my
      drag.mx = mx
      drag.my = my
      scheduleDraw()
      return
    }
    const hit = hitNode(mx, my)
    canvasRef.current.style.cursor = hit ? 'pointer' : 'grab'
    setTooltip(hit ? { node: hit, px: e.clientX, py: e.clientY } : null)
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
