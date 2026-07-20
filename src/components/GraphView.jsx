import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { Locate, Plus, Minus } from 'lucide-react'
import { fmt, fmtDate, getFormatLocale } from '../utils/format'
import { useI18n } from '../i18n'

const SIM_COLORS = ['#F59E0B', '#818CF8', '#34D399', '#F472B6', '#60A5FA', '#FB923C']
const MIN_R = 20
const MAX_R = 30
const HEADER_R = 16
const MIN_ZOOM = 0.2
const MAX_ZOOM = 4
const FIT_MIN = 0.7     // readable floor for the automatic framing
const FIT_MAX = 1.25
const ARROW_H = 7
const COL_SPACING = 220 // horizontal distance between account columns
const ROW_H = 90        // vertical distance between chronological rows
const COL0_X = 150      // x of the first column center
const HEADER_Y = 40     // y of the header nodes line
const ROWS_TOP = 170    // y of the first transaction row
const CULL_MARGIN = 300 // extra world px drawn above/below the viewport
const KEY_PAN = 80      // arrow keys pan step (screen px)

// ── Graph model: chronological columns ───────────────────────────────────────
//
// One vertical column per account (ordered as received: position, id), a
// header node on a shared top line, then one global chronological row per
// transaction (time flows downwards). Both entries of a transfer pair share
// the same row and are linked by a yellow arrow (debit -> credit).

function buildGraph(transactions, accounts, t) {
  if (!accounts?.length) return null

  // Only accounts that actually appear in the displayed transactions get a column
  const usedIds = new Set((transactions || []).map(x => x.account_id))
  const visible = accounts.filter(a => usedIds.has(a.id))
  if (!visible.length) return null

  const colOf = new Map(visible.map((a, i) => [a.id, i]))
  const colX = i => COL0_X + i * COL_SPACING

  const nodes = []
  const edges = []
  const byId = new Map()
  const addNode = n => { nodes.push(n); byId.set(n.id, n) }

  const txLabel = tx =>
    tx.description || tx.category_name || (tx.type === 'CREDIT' ? t('common.credit') : t('common.debit'))

  // Node radius: proportional to sqrt(amount), clamped to [MIN_R, MAX_R]
  const shown = transactions.filter(x => colOf.has(x.account_id))
  const maxAmount = Math.max(1, ...shown.map(x => Math.abs(x.amount)))
  const radius = amount => MIN_R + (MAX_R - MIN_R) * Math.sqrt(Math.abs(amount) / maxAmount)

  // Header nodes (account circle + name), all on the same horizontal line
  visible.forEach((account, i) => {
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

  const balances = new Map(visible.map(a => [a.id, a.initial_balance]))
  const lastNodeId = new Map(visible.map(a => [a.id, `head-${a.id}`]))
  const rowOf = new Map() // tx.id -> global row index
  let row = 0

  for (const tx of real) {
    // Both entries of a transfer pair share the same row
    const pairRow = tx.transfer_pair_id != null ? rowOf.get(tx.transfer_pair_id) : undefined
    const r = pairRow != null ? pairRow : row++
    rowOf.set(tx.id, r)

    const bal = balances.get(tx.account_id) + (tx.type === 'CREDIT' ? tx.amount : -tx.amount)
    balances.set(tx.account_id, bal)
    const col = colOf.get(tx.account_id)
    const account = visible[col]
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
    const accountIds = [...new Set(sessionTxs.map(x => x.account_id))].filter(id => colOf.has(id))
    for (const accountId of accountIds) {
      const col = colOf.get(accountId)
      const account = visible[col]
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

// Locale-aware compact notation: "12,5 k" / "1,2 M" (fr), "12.5K" / "1.2M" (en)
const compactAmount = v =>
  new Intl.NumberFormat(getFormatLocale(), { notation: 'compact', maximumFractionDigits: 1 })
    .format(Math.round(v))
    .replace(/\s/g, '')

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

  // Signed amount INSIDE the circle, compact notation when too wide
  const tx = node.point.tx
  const sign = tx.type === 'CREDIT' ? '+' : '-'
  const maxW = 2 * r - 8
  ctx.font = 'bold 10px system-ui,sans-serif'
  let text = sign + new Intl.NumberFormat(getFormatLocale()).format(Math.round(tx.amount))
  if (ctx.measureText(text).width > maxW) {
    text = sign + compactAmount(tx.amount)
    if (ctx.measureText(text).width > maxW) ctx.font = 'bold 9px system-ui,sans-serif'
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = tx.type === 'CREDIT' ? '#34D399' : '#F87171'
  ctx.fillText(text, x, y + 0.5)
  ctx.textBaseline = 'alphabetic'
}

// ── Component ────────────────────────────────────────────────────────────────

export function GraphView({ transactions, accounts }) {
  const { t, lang } = useI18n()
  const containerRef = useRef()
  const canvasRef = useRef()
  const viewRef = useRef({ scale: 1, ox: 0, oy: 0 })
  const rafRef = useRef(0)
  const pointersRef = useRef(new Map()) // pointerId -> { x, y } (canvas coords)
  const gestureRef = useRef(null)       // { mode:'pan', x, y } | { mode:'pinch', d, cx, cy }
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 })
  const [tooltip, setTooltip] = useState(null)

  // The graph depends on the language CODE (stable string), never on a
  // function identity, so a re-render can never rebuild it by accident.
  const graph = useMemo(
    () => buildGraph(transactions, accounts, t),
    [transactions, accounts, lang] // eslint-disable-line react-hooks/exhaustive-deps
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

    // Windowed rendering: only draw what falls in the visible y range
    const wyMin = (0 - oy) / scale - CULL_MARGIN
    const wyMax = (canvas.height / dpr - oy) / scale + CULL_MARGIN

    for (const e of graph.edges) {
      const n1 = graph.byId.get(e.source)
      const n2 = graph.byId.get(e.target)
      if (!n1 || !n2) continue
      if (Math.max(n1.y, n2.y) < wyMin || Math.min(n1.y, n2.y) > wyMax) continue
      drawEdge(ctx, n1.x, n1.y, n2.x, n2.y, n1.r, n2.r, e.color, e.kind !== 'chain')
    }
    for (const node of graph.nodes) {
      if (node.y < wyMin || node.y > wyMax) continue
      drawNode(ctx, node)
    }
  }, [graph])

  const scheduleDraw = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => { rafRef.current = 0; draw() })
  }, [draw])

  const hideTooltip = () => setTooltip(prev => (prev === null ? prev : null))

  // Top-anchored framing: fit the columns width (readable floor), view at the
  // top of the graph; the user scrolls down for the rest. Returns success.
  const zoomToFit = useCallback(() => {
    const container = containerRef.current
    if (!container || !graph?.nodes.length) return false
    const cw = container.clientWidth
    const ch = container.clientHeight
    if (!cw || !ch) return false
    let minX = Infinity, maxX = -Infinity, minY = Infinity
    for (const { x, y } of graph.nodes) {
      minX = Math.min(minX, x - MAX_R - 40)
      maxX = Math.max(maxX, x + MAX_R + 40)
      minY = Math.min(minY, y - MAX_R - 10)
    }
    const bw = Math.max(maxX - minX, 1)
    const scale = clamp(cw / bw, FIT_MIN, FIT_MAX)
    viewRef.current = {
      scale,
      ox: bw * scale <= cw ? (cw - bw * scale) / 2 - minX * scale : 8 - minX * scale,
      oy: 16 - minY * scale,
    }
    scheduleDraw()
    return true
  }, [graph, scheduleDraw])

  // Auto-framing ONLY when the dataset really changes (signature guard):
  // re-renders and function identity churn can never recenter the view.
  const dataSig = useMemo(() => {
    const ids = (transactions || []).map(x => x.id)
    return [
      ids.length,
      ids.length ? Math.min(...ids) : 0,
      ids.length ? Math.max(...ids) : 0,
      (accounts || []).map(a => a.id).join('.'),
    ].join('|')
  }, [transactions, accounts])
  const dataSigRef = useRef(dataSig)
  dataSigRef.current = dataSig
  const fittedSigRef = useRef(null)
  const fitIfNeeded = useCallback(() => {
    if (fittedSigRef.current === dataSigRef.current) return
    if (zoomToFit()) fittedSigRef.current = dataSigRef.current
  }, [zoomToFit])
  useEffect(() => { fitIfNeeded() }, [dataSig, fitIfNeeded])

  // Canvas sizing (DPR aware) + redraw on resize
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(container.clientWidth * dpr))
      canvas.height = Math.max(1, Math.round(container.clientHeight * dpr))
      fitIfNeeded()
      draw()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()
    return () => ro.disconnect()
  }, [draw, fitIfNeeded])

  const zoomAt = useCallback((mx, my, factor) => {
    const v = viewRef.current
    const ns = clamp(v.scale * factor, MIN_ZOOM, MAX_ZOOM)
    v.ox = mx - ((mx - v.ox) * ns) / v.scale
    v.oy = my - ((my - v.oy) * ns) / v.scale
    v.scale = ns
    scheduleDraw()
  }, [scheduleDraw])

  const zoomAtCenter = useCallback(factor => {
    const c = containerRef.current
    if (c) zoomAt(c.clientWidth / 2, c.clientHeight / 2, factor)
  }, [zoomAt])

  // Wheel, attached through a callback ref so the native listener
  // (passive:false, required for preventDefault) is ALWAYS bound as soon as
  // the canvas exists. Two-finger scroll = pan; ctrl+wheel (incl. touchpad
  // pinch, which Chromium reports as ctrl+wheel) = zoom around the cursor.
  const wheelImplRef = useRef()
  wheelImplRef.current = e => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const norm = d => (e.deltaMode === 1 ? d * 32 : e.deltaMode === 2 ? d * 400 : d)
    if (e.ctrlKey) {
      const rect = canvas.getBoundingClientRect()
      const dy = clamp(norm(e.deltaY), -50, 50)
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-dy * 0.01))
    } else {
      const v = viewRef.current
      v.ox -= norm(e.deltaX)
      v.oy -= norm(e.deltaY)
      scheduleDraw()
    }
    hideTooltip()
  }
  const wheelProxyRef = useRef(e => wheelImplRef.current?.(e))
  const setCanvasRef = useCallback(node => {
    if (canvasRef.current) canvasRef.current.removeEventListener('wheel', wheelProxyRef.current)
    canvasRef.current = node
    if (node) node.addEventListener('wheel', wheelProxyRef.current, { passive: false })
  }, [])

  // Keyboard: ctrl +/- zoom, ctrl 0 recenter, arrows / PageUp / PageDown pan
  useEffect(() => {
    const isEditable = el =>
      !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
    const onKey = e => {
      if (isEditable(document.activeElement)) return
      const v = viewRef.current
      const page = (containerRef.current?.clientHeight || 600) * 0.85
      let handled = true
      if (e.ctrlKey && (e.key === '+' || e.key === '=')) zoomAtCenter(1.35)
      else if (e.ctrlKey && e.key === '-') zoomAtCenter(1 / 1.35)
      else if (e.ctrlKey && e.key === '0') zoomToFit()
      else if (e.key === 'ArrowUp') { v.oy += KEY_PAN; scheduleDraw() }
      else if (e.key === 'ArrowDown') { v.oy -= KEY_PAN; scheduleDraw() }
      else if (e.key === 'ArrowLeft') { v.ox += KEY_PAN; scheduleDraw() }
      else if (e.key === 'ArrowRight') { v.ox -= KEY_PAN; scheduleDraw() }
      else if (e.key === 'PageUp') { v.oy += page; scheduleDraw() }
      else if (e.key === 'PageDown') { v.oy -= page; scheduleDraw() }
      else handled = false
      if (handled) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomAtCenter, zoomToFit, scheduleDraw])

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

  // ── Pointer Events: mouse drag + touch (1 finger pan, 2 finger pinch) ──────

  const pinchState = () => {
    const pts = [...pointersRef.current.values()]
    const dx = pts[1].x - pts[0].x
    const dy = pts[1].y - pts[0].y
    return {
      d: Math.max(Math.sqrt(dx * dx + dy * dy), 1),
      cx: (pts[0].x + pts[1].x) / 2,
      cy: (pts[0].y + pts[1].y) / 2,
    }
  }

  const onPointerDown = e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const { mx, my } = localXY(e)
    canvasRef.current.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: mx, y: my })
    const count = pointersRef.current.size
    if (count === 1) {
      gestureRef.current = { mode: 'pan', x: mx, y: my }
      // Double-tap = zoom x2 (touch counterpart of the mouse double-click)
      if (e.pointerType === 'touch') {
        const tap = lastTapRef.current
        const now = performance.now()
        if (now - tap.time < 300 && Math.hypot(mx - tap.x, my - tap.y) < 30) {
          zoomAt(mx, my, 2)
          lastTapRef.current = { time: 0, x: 0, y: 0 }
        } else {
          lastTapRef.current = { time: now, x: mx, y: my }
        }
      }
    } else if (count === 2) {
      gestureRef.current = { mode: 'pinch', ...pinchState() }
    }
    canvasRef.current.style.cursor = 'grabbing'
    hideTooltip()
  }

  const onPointerMove = e => {
    const { mx, my } = localXY(e)
    const pointers = pointersRef.current
    const g = gestureRef.current

    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: mx, y: my })

    if (g?.mode === 'pinch' && pointers.size >= 2) {
      // Continuous zoom on the finger distance ratio, anchored at the midpoint
      const s = pinchState()
      const v = viewRef.current
      const ns = clamp(v.scale * (s.d / g.d), MIN_ZOOM, MAX_ZOOM)
      v.ox = s.cx - ((g.cx - v.ox) * ns) / v.scale
      v.oy = s.cy - ((g.cy - v.oy) * ns) / v.scale
      v.scale = ns
      gestureRef.current = { mode: 'pinch', ...s } // rebase the gesture
      scheduleDraw()
      return
    }
    if (g?.mode === 'pan' && pointers.has(e.pointerId)) {
      const v = viewRef.current
      v.ox += mx - g.x
      v.oy += my - g.y
      g.x = mx
      g.y = my
      scheduleDraw()
      return
    }
    if (e.pointerType === 'mouse' && pointers.size === 0) {
      // Plain hover: tooltip + cursor
      const hit = hitNode(mx, my)
      canvasRef.current.style.cursor = hit ? 'pointer' : 'grab'
      setTooltip(prev => (hit ? { node: hit, px: e.clientX, py: e.clientY } : prev === null ? prev : null))
    }
  }

  const onPointerEnd = e => {
    const pointers = pointersRef.current
    if (!pointers.has(e.pointerId)) return
    pointers.delete(e.pointerId)
    try { canvasRef.current?.releasePointerCapture(e.pointerId) } catch (_) { /* already released */ }
    if (pointers.size === 1) {
      // Pinch -> pan handoff: rebase on the remaining finger
      const rest = [...pointers.values()][0]
      gestureRef.current = { mode: 'pan', x: rest.x, y: rest.y }
    } else if (pointers.size === 0) {
      gestureRef.current = null
      if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
    }
  }

  const onDoubleClick = e => {
    const { mx, my } = localXY(e)
    zoomAt(mx, my, 2)
  }

  if (!graph || !graph.nodes.length)
    return <div className="flex items-center justify-center h-full text-faint text-sm">{t('graph.empty')}</div>

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-base">
      <canvas
        ref={setCanvasRef}
        className="absolute inset-0 w-full h-full block cursor-grab"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={() => { if (!gestureRef.current) hideTooltip() }}
        onDoubleClick={onDoubleClick}
      />

      {/* Gesture hint */}
      <p className="absolute bottom-3 left-3 text-[11px] text-muted pointer-events-none select-none">
        {t('graph.hint')}
      </p>

      {/* Zoom + recenter controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => zoomAtCenter(1.35)}
          title={t('graph.zoomIn')}
          className="w-10 h-10 rounded-full bg-surface2 border border-edge text-muted hover:text-ink hover:border-primary/50 flex items-center justify-center shadow-lg transition-colors"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => zoomAtCenter(1 / 1.35)}
          title={t('graph.zoomOut')}
          className="w-10 h-10 rounded-full bg-surface2 border border-edge text-muted hover:text-ink hover:border-primary/50 flex items-center justify-center shadow-lg transition-colors"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={zoomToFit}
          title={t('graph.recenter')}
          className="w-10 h-10 rounded-full bg-surface2 border border-edge text-muted hover:text-ink hover:border-primary/50 flex items-center justify-center shadow-lg transition-colors"
        >
          <Locate size={16} />
        </button>
      </div>

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
