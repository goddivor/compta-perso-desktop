import { useRef, useEffect, useState, useMemo } from 'react'
import { fmt, fmtDate } from '../utils/format'
import { useT } from '../i18n'

const NODE_W  = 172
const NODE_H  = 74
const ARROW_H = 10
const SIM_COLORS = ['#F59E0B', '#818CF8', '#34D399', '#F472B6', '#60A5FA', '#FB923C']

// ── Shared helpers ──────────────────────────────────────────────────────────

function drawArrow(ctx, x1, y1, x2, y2, color, dashed) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.setLineDash(dashed ? [6, 4] : [])
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - ARROW_H * Math.cos(angle - Math.PI / 6), y2 - ARROW_H * Math.sin(angle - Math.PI / 6))
  ctx.lineTo(x2 - ARROW_H * Math.cos(angle + Math.PI / 6), y2 - ARROW_H * Math.sin(angle + Math.PI / 6))
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function clip(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

function drawNode(ctx, cx, cy, node, color, simColor) {
  const rx = NODE_W / 2
  const ry = NODE_H / 2
  const isSim = !!simColor

  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  ctx.fillStyle = isSim ? '#151008' : '#211C1A'
  ctx.fill()
  ctx.strokeStyle = isSim ? simColor : color
  ctx.lineWidth = isSim ? 1.5 : 2
  ctx.setLineDash(isSim ? [5, 3] : [])
  ctx.stroke()
  ctx.setLineDash([])

  const innerW = NODE_W - 24
  ctx.textAlign = 'center'

  if (node.tx) {
    const sign   = node.tx.type === 'CREDIT' ? '+' : '-'
    const amtClr = isSim ? simColor : (node.tx.type === 'CREDIT' ? '#34D399' : '#F87171')
    ctx.font = '10px system-ui,sans-serif'; ctx.fillStyle = '#A89E92'
    ctx.fillText(fmtDate(node.date), cx, cy - 22)
    ctx.font = '11px system-ui,sans-serif'; ctx.fillStyle = isSim ? '#D4C5A0' : '#F5F1EC'
    ctx.fillText(clip(ctx, node.label, innerW), cx, cy - 6)
    ctx.font = 'bold 12px system-ui,sans-serif'; ctx.fillStyle = amtClr
    ctx.fillText(sign + fmt(node.tx.amount), cx, cy + 10)
    ctx.font = '10px system-ui,sans-serif'; ctx.fillStyle = '#A89E92'
    ctx.fillText('= ' + fmt(node.balance), cx, cy + 26)
  } else {
    ctx.font = '10px system-ui,sans-serif'; ctx.fillStyle = '#A89E92'
    ctx.fillText(fmtDate(node.date), cx, cy - 16)
    ctx.font = '11px system-ui,sans-serif'; ctx.fillStyle = isSim ? '#D4C5A0' : '#F5F1EC'
    ctx.fillText(node.label, cx, cy)
    ctx.font = 'bold 12px system-ui,sans-serif'; ctx.fillStyle = isSim ? simColor : color
    ctx.fillText(fmt(node.balance), cx, cy + 18)
  }
}

function drawTransferLinks(ctx, nodes) {
  const txNodeMap = {}
  for (const n of nodes) if (n.point.tx?.id) txNodeMap[n.point.tx.id] = n
  const done = new Set()
  for (const n of nodes) {
    const pairId = n.point.tx?.transfer_pair_id
    if (!pairId) continue
    const key = [n.point.tx.id, pairId].sort((a, b) => a - b).join('-')
    if (done.has(key)) continue
    done.add(key)
    const partner = txNodeMap[pairId]
    if (!partner) continue
    const left  = n.cx <= partner.cx ? n : partner
    const right = n.cx <= partner.cx ? partner : n
    const x1 = left.cx + NODE_W / 2, y1 = left.cy
    const x2 = right.cx - NODE_W / 2, y2 = right.cy
    const mx = (x1 + x2) / 2
    ctx.beginPath(); ctx.setLineDash([5, 4])
    ctx.strokeStyle = '#FFD200'; ctx.lineWidth = 1.5
    ctx.moveTo(x1, y1)
    ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2)
    ctx.stroke(); ctx.setLineDash([])
    const ang = Math.atan2(y2 - y1, x2 - x1)
    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - 9 * Math.cos(ang - Math.PI / 6), y2 - 9 * Math.sin(ang - Math.PI / 6))
    ctx.lineTo(x2 - 9 * Math.cos(ang + Math.PI / 6), y2 - 9 * Math.sin(ang + Math.PI / 6))
    ctx.closePath(); ctx.fillStyle = '#FFD200'; ctx.fill()
  }
}

// ── Vertical layout ─────────────────────────────────────────────────────────

const V = { PAD_X: 30, PAD_Y: 54, COL_W: 220, SIM_COL: 190, ROW_H: 118, SIM_ROW_H: 110 }

function drawVertical(ctx, canvas, realSeries, simBranches, nodesRef, t) {
  let xCursor = V.PAD_X
  const simCountPerAccount = {}
  simBranches.forEach(sim =>
    sim.branches.forEach(b => { simCountPerAccount[b.accountId] = (simCountPerAccount[b.accountId] || 0) + 1 })
  )
  const realColX = realSeries.map(({ account }) => {
    const cx = xCursor + V.COL_W / 2
    xCursor += V.COL_W + (simCountPerAccount[account.id] || 0) * V.SIM_COL
    return cx
  })

  const simBranchX = {}
  simBranches.forEach(sim => {
    sim.branches.forEach(b => {
      if (!simBranchX[b.accountId]) simBranchX[b.accountId] = []
      const colIdx = realSeries.findIndex(s => s.account.id === b.accountId)
      const base = realColX[colIdx] + V.COL_W / 2
      simBranchX[b.accountId].push(base + simBranchX[b.accountId].length * V.SIM_COL + V.SIM_COL / 2)
    })
  })

  const maxRealRows = Math.max(1, ...realSeries.map(s => s.points.length))
  const maxSimRows  = simBranches.length > 0
    ? Math.max(...simBranches.flatMap(s => s.branches.map(b => b.points.length))) : 0
  canvas.width  = Math.max(xCursor + V.PAD_X, 400)
  canvas.height = Math.max(
    V.PAD_Y * 2 + maxRealRows * V.ROW_H + (maxSimRows > 0 ? maxSimRows * V.SIM_ROW_H + 60 : 0),
    300
  )

  realSeries.forEach(({ account, points }, colIdx) => {
    const cx = realColX[colIdx]
    const color = account.color || '#FFD200'
    ctx.font = 'bold 12px system-ui,sans-serif'; ctx.textAlign = 'center'
    ctx.fillStyle = color
    ctx.fillText(account.name, cx, V.PAD_Y - 14)

    points.forEach((p, rowIdx) => {
      const cy = V.PAD_Y + rowIdx * V.ROW_H + NODE_H / 2
      if (rowIdx > 0)
        drawArrow(ctx, cx, V.PAD_Y + (rowIdx - 1) * V.ROW_H + NODE_H / 2 + NODE_H / 2, cx, cy - NODE_H / 2, '#352E2A', false)
      drawNode(ctx, cx, cy, p, color, null)
      nodesRef.current.push({ cx, cy, rx: NODE_W / 2, ry: NODE_H / 2, account, point: p })
    })
  })

  drawTransferLinks(ctx, nodesRef.current)

  if (!simBranches.length) return
  const divY = V.PAD_Y + maxRealRows * V.ROW_H + 20
  ctx.strokeStyle = '#352E2A'; ctx.lineWidth = 1; ctx.setLineDash([4, 6])
  ctx.beginPath(); ctx.moveTo(V.PAD_X, divY); ctx.lineTo(canvas.width - V.PAD_X, divY); ctx.stroke()
  ctx.setLineDash([])
  ctx.font = '10px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#807669'
  ctx.fillText(t('graph.altRoutes'), canvas.width / 2, divY + 14)

  const simStartY = divY + 30
  const simIdxPerAccount = {}
  simBranches.forEach(({ simIdx, branches }) => {
    const simColor = SIM_COLORS[simIdx % SIM_COLORS.length]
    branches.forEach(({ account, points, accountId }) => {
      const colIdx = realSeries.findIndex(s => s.account.id === accountId)
      if (colIdx === -1) return
      const idx = simIdxPerAccount[accountId] || 0
      simIdxPerAccount[accountId] = idx + 1
      const cx = realColX[colIdx] + V.COL_W / 2 + idx * V.SIM_COL + V.SIM_COL / 2
      ctx.font = 'bold 11px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = simColor
      ctx.fillText(t('graph.sim', { n: simIdx + 1, name: account.name }), cx, simStartY - 6)
      const forkY = V.PAD_Y + (realSeries[colIdx].points.length - 1) * V.ROW_H + NODE_H / 2
      ctx.beginPath(); ctx.arc(realColX[colIdx], forkY, 5, 0, Math.PI * 2)
      ctx.fillStyle = simColor; ctx.fill()
      drawArrow(ctx, realColX[colIdx], forkY, cx, simStartY + NODE_H / 2 - NODE_H / 2, simColor, true)
      points.forEach((p, rowIdx) => {
        const cy = simStartY + rowIdx * V.SIM_ROW_H + NODE_H / 2
        if (rowIdx > 0)
          drawArrow(ctx, cx, simStartY + (rowIdx - 1) * V.SIM_ROW_H + NODE_H / 2 + NODE_H / 2, cx, cy - NODE_H / 2, simColor, true)
        drawNode(ctx, cx, cy, p, account.color || '#FFD200', simColor)
        nodesRef.current.push({ cx, cy, rx: NODE_W / 2, ry: NODE_H / 2, account, point: p, simColor })
      })
    })
  })
}

// ── Horizontal layout ────────────────────────────────────────────────────────

const H = { PAD_X: 20, PAD_Y: 30, LABEL_W: 82, NODE_STEP: 210, ROW_H: 114, SIM_ROW_H: 108 }

function drawHorizontal(ctx, canvas, realSeries, simBranches, nodesRef, t) {
  const maxRealCols = Math.max(1, ...realSeries.map(s => s.points.length))
  const maxSimCols  = simBranches.length > 0
    ? Math.max(...simBranches.flatMap(s => s.branches.map(b => b.points.length))) : 0

  const simCountPerAccount = {}
  simBranches.forEach(sim =>
    sim.branches.forEach(b => { simCountPerAccount[b.accountId] = (simCountPerAccount[b.accountId] || 0) + 1 })
  )

  const numSimRows = Object.values(simCountPerAccount).reduce((a, b) => a + b, 0)

  canvas.width  = Math.max(
    H.PAD_X * 2 + H.LABEL_W + maxRealCols * H.NODE_STEP + (maxSimCols > 0 ? 60 + maxSimCols * H.NODE_STEP : 0),
    500
  )
  canvas.height = Math.max(
    H.PAD_Y * 2 + realSeries.length * H.ROW_H + numSimRows * H.SIM_ROW_H + (numSimRows > 0 ? 40 : 0),
    300
  )

  const rowY = (rowIdx) => H.PAD_Y + rowIdx * H.ROW_H + NODE_H / 2
  const nodeX = (colIdx) => H.PAD_X + H.LABEL_W + colIdx * H.NODE_STEP + NODE_W / 2

  // Real rows
  realSeries.forEach(({ account, points }, rowIdx) => {
    const cy = rowY(rowIdx)
    const color = account.color || '#FFD200'

    // Account label on the left
    ctx.font = 'bold 11px system-ui,sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = color
    ctx.fillText(account.name, H.PAD_X + H.LABEL_W - 10, cy + 4)

    points.forEach((p, colIdx) => {
      const cx = nodeX(colIdx)
      if (colIdx > 0)
        drawArrow(ctx, nodeX(colIdx - 1) + NODE_W / 2, cy, cx - NODE_W / 2, cy, '#352E2A', false)
      drawNode(ctx, cx, cy, p, color, null)
      nodesRef.current.push({ cx, cy, rx: NODE_W / 2, ry: NODE_H / 2, account, point: p })
    })
  })

  drawTransferLinks(ctx, nodesRef.current)

  if (!simBranches.length) return

  // Divider after real rows
  const divY = H.PAD_Y + realSeries.length * H.ROW_H + 16
  ctx.strokeStyle = '#352E2A'; ctx.lineWidth = 1; ctx.setLineDash([4, 6])
  ctx.beginPath(); ctx.moveTo(H.PAD_X, divY); ctx.lineTo(canvas.width - H.PAD_X, divY); ctx.stroke()
  ctx.setLineDash([])
  ctx.font = '10px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#807669'
  ctx.fillText(t('graph.altRoutes'), canvas.width / 2, divY + 13)

  const simBaseY = divY + 26
  let simRowIdx = 0

  simBranches.forEach(({ simIdx, branches }) => {
    const simColor = SIM_COLORS[simIdx % SIM_COLORS.length]
    branches.forEach(({ account, points, accountId }) => {
      const colIdx = realSeries.findIndex(s => s.account.id === accountId)
      if (colIdx === -1) return
      const cy = simBaseY + simRowIdx * H.SIM_ROW_H + NODE_H / 2

      // Label
      ctx.font = 'bold 10px system-ui,sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = simColor
      ctx.fillText(t('graph.sim', { n: simIdx + 1, name: account.name }), H.PAD_X + H.LABEL_W - 10, cy + 4)

      // Fork indicator on bottom edge of last real node
      const lastRealCx = nodeX(realSeries[colIdx].points.length - 1)
      const lastRealCy = rowY(colIdx)
      ctx.beginPath(); ctx.arc(lastRealCx, lastRealCy + NODE_H / 2, 5, 0, Math.PI * 2)
      ctx.fillStyle = simColor; ctx.fill()
      // Fork arrow: bottom of last real node → left edge of first sim node
      drawArrow(ctx, lastRealCx, lastRealCy + NODE_H / 2, nodeX(0) - NODE_W / 2, cy, simColor, true)

      points.forEach((p, pIdx) => {
        const cx = nodeX(pIdx)
        if (pIdx > 0)
          drawArrow(ctx, nodeX(pIdx - 1) + NODE_W / 2, cy, cx - NODE_W / 2, cy, simColor, true)
        drawNode(ctx, cx, cy, p, account.color || '#FFD200', simColor)
        nodesRef.current.push({ cx, cy, rx: NODE_W / 2, ry: NODE_H / 2, account, point: p, simColor })
      })

      simRowIdx++
    })
  })
}

// ── Component ────────────────────────────────────────────────────────────────

export function GraphView({ transactions, accounts, layout = 'vertical' }) {
  const t = useT()
  const scrollRef = useRef()
  const canvasRef = useRef()
  const nodesRef  = useRef([])
  const [tooltip, setTooltip] = useState(null)

  const { realSeries, simBranches } = useMemo(() => {
    if (!accounts || !transactions) return { realSeries: [], simBranches: [] }

    const realSeries = accounts.map(account => {
      const txs = transactions
        .filter(t => t.account_id === account.id && !t.forecast_session_id)
        .sort((a, b) => new Date(a.date) - new Date(b.date) || a.id - b.id)
      let bal = account.initial_balance
      const points = [{ date: account.created_at || new Date().toISOString(), balance: bal, label: t('graph.initialBalance'), tx: null }]
      for (const tx of txs) {
        bal += tx.type === 'CREDIT' ? tx.amount : -tx.amount
        points.push({ date: tx.date, balance: bal, label: tx.description || tx.category_name || (tx.type === 'CREDIT' ? t('common.credit') : t('common.debit')), tx })
      }
      return { account, points }
    })

    const simTxs = transactions.filter(t => t.forecast_session_id)
    const sessionIds = [...new Set(simTxs.map(t => t.forecast_session_id))]
    const simBranches = sessionIds.map((sessionId, simIdx) => {
      const sessionTxs = simTxs.filter(t => t.forecast_session_id === sessionId)
        .sort((a, b) => new Date(a.date) - new Date(b.date) || a.id - b.id)
      const accountIds = [...new Set(sessionTxs.map(t => t.account_id))]
      const branches = accountIds.map(accountId => {
        const account = accounts.find(a => a.id === accountId)
        if (!account) return null
        const realSer = realSeries.find(s => s.account.id === accountId)
        let bal = realSer ? realSer.points[realSer.points.length - 1].balance : account.initial_balance
        const points = sessionTxs.filter(t => t.account_id === accountId).map(tx => {
          bal += tx.type === 'CREDIT' ? tx.amount : -tx.amount
          return { date: tx.date, balance: bal, label: tx.description || tx.category_name || (tx.type === 'CREDIT' ? t('common.credit') : t('common.debit')), tx }
        })
        return { account, points, accountId }
      }).filter(Boolean)
      return { sessionId, simIdx, branches }
    })

    return { realSeries, simBranches }
  }, [transactions, accounts, t])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !realSeries.length) return
    const ctx = canvas.getContext('2d')
    nodesRef.current = []
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (layout === 'horizontal') {
      drawHorizontal(ctx, canvas, realSeries, simBranches, nodesRef, t)
    } else {
      drawVertical(ctx, canvas, realSeries, simBranches, nodesRef, t)
    }
  }, [realSeries, simBranches, layout, t])

  const onMouseMove = e => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    let hit = null
    for (const n of nodesRef.current) {
      const dx = (mx - n.cx) / n.rx
      const dy = (my - n.cy) / n.ry
      if (dx * dx + dy * dy <= 1) { hit = n; break }
    }
    setTooltip(hit ? { ...hit, px: e.clientX, py: e.clientY } : null)
  }

  if (!realSeries.length)
    return <div className="flex items-center justify-center h-full text-faint text-sm">{t('graph.empty')}</div>

  return (
    <div ref={scrollRef} className="w-full h-full overflow-auto bg-base">
      <canvas ref={canvasRef} style={{ display: 'block' }} onMouseMove={onMouseMove} onMouseLeave={() => setTooltip(null)} />
      {tooltip && (
        <div className="fixed pointer-events-none bg-surface2 border border-edge rounded-lg px-3 py-2 text-xs shadow-xl z-50"
          style={{ left: tooltip.px + 14, top: tooltip.py - 60, minWidth: 160 }}>
          <p className="font-semibold mb-1" style={{ color: tooltip.simColor || tooltip.account.color }}>
            {tooltip.account.name}{tooltip.simColor ? t('graph.simulation') : ''}
          </p>
          <p className="text-muted">{fmtDate(tooltip.point.date)}</p>
          <p className="text-content mt-0.5">{tooltip.point.label}</p>
          {tooltip.point.tx && (
            <p className={`mt-0.5 font-mono ${tooltip.point.tx.type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {tooltip.point.tx.type === 'CREDIT' ? '+' : '-'}{fmt(tooltip.point.tx.amount)}
            </p>
          )}
          <p className="font-bold text-ink mt-1">{fmt(tooltip.point.balance)}</p>
        </div>
      )}
    </div>
  )
}
