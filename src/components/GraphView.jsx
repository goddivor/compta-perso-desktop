import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Handle, Position, MarkerType, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Locate, Plus, Minus } from 'lucide-react'
import { fmt, fmtDate } from '../utils/format'
import { useI18n } from '../i18n'

const SIM_COLORS = ['#F59E0B', '#818CF8', '#34D399', '#F472B6', '#60A5FA', '#FB923C']
const MIN_ZOOM = 0.2
const MAX_ZOOM = 4
const FIT_MIN = 0.7     // readable floor for the automatic framing
const FIT_MAX = 1.25
const NODE_W = 170      // fixed logical width of every node wrapper
const COL_SPACING = 220 // horizontal distance between account column centers
const ROW_H = 104       // vertical distance between chronological rows
const COL0_X = 150      // x of the first column center
const HEADER_Y = 20     // y of the header nodes line
const ROWS_TOP = 150    // y of the first transaction row

// ── Custom nodes ─────────────────────────────────────────────────────────────

// Handles are only anchors for the edges: kept invisible and inert
const hiddenHandle = {
  opacity: 0, pointerEvents: 'none', border: 'none', background: 'transparent',
  width: 4, height: 4, minWidth: 0, minHeight: 0,
}

function AccountHeaderNode({ data }) {
  const color = data.account.color || '#FFD200'
  return (
    <div className="relative flex flex-col items-center gap-1.5" style={{ width: NODE_W }}>
      <span
        className="w-8 h-8 rounded-full border-2"
        style={{ background: color + '33', borderColor: color }}
      />
      <span className="px-3 py-1 rounded-lg bg-surface border border-edge text-[11px] font-bold text-ink whitespace-nowrap">
        {data.account.name}
      </span>
      <Handle id="bottom" type="source" position={Position.Bottom} style={hiddenHandle} isConnectable={false} />
    </div>
  )
}

function TxNode({ data }) {
  const tx = data.point.tx
  const credit = tx.type === 'CREDIT'
  return (
    <div className="flex justify-center" style={{ width: NODE_W }}>
      {/* Auto-sized circle/pill: the handles live INSIDE it so the edges
          anchor on its real border, whatever its measured width */}
      <div
        className="relative flex flex-col items-center justify-center rounded-full bg-surface px-4 py-2"
        style={{
          borderWidth: 2,
          borderStyle: data.simColor ? 'dashed' : 'solid',
          borderColor: data.simColor || data.color,
          minWidth: 60,
          minHeight: 54,
        }}
      >
        <span className={`text-[11px] font-bold leading-tight whitespace-nowrap ${credit ? 'text-emerald-400' : 'text-rose-400'}`}>
          {(credit ? '+' : '-') + fmt(tx.amount)}
        </span>
        <span className="text-[10px] text-muted leading-tight">{data.shortDate}</span>
        <Handle id="top" type="target" position={Position.Top} style={hiddenHandle} isConnectable={false} />
        <Handle id="bottom" type="source" position={Position.Bottom} style={hiddenHandle} isConnectable={false} />
        <Handle id="left-t" type="target" position={Position.Left} style={hiddenHandle} isConnectable={false} />
        <Handle id="right-t" type="target" position={Position.Right} style={hiddenHandle} isConnectable={false} />
        <Handle id="left-s" type="source" position={Position.Left} style={hiddenHandle} isConnectable={false} />
        <Handle id="right-s" type="source" position={Position.Right} style={hiddenHandle} isConnectable={false} />
      </div>
    </div>
  )
}

const nodeTypes = { accountHeader: AccountHeaderNode, txNode: TxNode }

// ── Flow model: chronological columns ────────────────────────────────────────
//
// One vertical column per account (ordered as received: position, id), a
// header node on a shared top line, then one global chronological row per
// transaction (time flows downwards). Both entries of a transfer pair share
// the same row and are linked by a yellow arrow (debit -> credit).

const shortDate = d => `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}`

function buildFlow(transactions, accounts, t) {
  if (!accounts?.length) return null

  // Only accounts that actually appear in the displayed transactions get a column
  const usedIds = new Set((transactions || []).map(x => x.account_id))
  const visible = accounts.filter(a => usedIds.has(a.id))
  if (!visible.length) return null

  const colOf = new Map(visible.map((a, i) => [a.id, i]))
  const colX = i => COL0_X + i * COL_SPACING - NODE_W / 2

  const nodes = []
  const edges = []
  const base = { draggable: false, selectable: false, connectable: false }

  const txLabel = tx =>
    tx.description || tx.category_name || (tx.type === 'CREDIT' ? t('common.credit') : t('common.debit'))

  const arrow = color => ({ type: MarkerType.ArrowClosed, color, width: 14, height: 14 })

  // Header nodes (account circle + name), all on the same top line
  visible.forEach((account, i) => {
    nodes.push({
      id: `head-${account.id}`, type: 'accountHeader', ...base,
      position: { x: colX(i), y: HEADER_Y },
      data: {
        account,
        point: {
          date: account.created_at || new Date().toISOString(),
          balance: account.initial_balance,
          label: t('graph.initialBalance'),
          tx: null,
        },
      },
    })
  })

  // Real transactions, merged and sorted chronologically (date ASC, created_at ASC)
  const real = transactions
    .filter(x => colOf.has(x.account_id) && !x.forecast_session_id)
    .sort((a, b) =>
      new Date(a.date) - new Date(b.date) ||
      new Date(a.created_at || 0) - new Date(b.created_at || 0) ||
      a.id - b.id
    )

  const balances = new Map(visible.map(a => [a.id, a.initial_balance]))
  const lastNodeId = new Map(visible.map(a => [a.id, `head-${a.id}`]))
  const txById = new Map(real.map(x => [x.id, x]))
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
    nodes.push({
      id, type: 'txNode', ...base,
      position: { x: colX(col), y: ROWS_TOP + r * ROW_H },
      data: {
        account, color, shortDate: shortDate(tx.date),
        point: { date: tx.date, balance: bal, label: txLabel(tx), tx },
      },
    })
    edges.push({
      id: `chain-${id}`, source: lastNodeId.get(tx.account_id), target: id,
      sourceHandle: 'bottom', targetHandle: 'top', type: 'straight',
      style: { stroke: color, strokeWidth: 1.3 }, markerEnd: arrow(color),
    })
    lastNodeId.set(tx.account_id, id)
  }

  // Transfer links (yellow, animated dashes), oriented debit -> credit, shared row
  const done = new Set()
  for (const tx of real) {
    if (!tx.transfer_pair_id) continue
    const key = [tx.id, tx.transfer_pair_id].sort((a, b) => a - b).join('-')
    if (done.has(key)) continue
    done.add(key)
    const partner = txById.get(tx.transfer_pair_id)
    if (!partner) continue
    const src = tx.type === 'DEBIT' ? tx : partner
    const dst = tx.type === 'DEBIT' ? partner : tx
    const leftToRight = colOf.get(src.account_id) <= colOf.get(dst.account_id)
    edges.push({
      id: `transfer-${key}`, source: `tx-${src.id}`, target: `tx-${dst.id}`,
      sourceHandle: leftToRight ? 'right-s' : 'left-s',
      targetHandle: leftToRight ? 'left-t' : 'right-t',
      type: 'straight', animated: true,
      style: { stroke: '#FFD200', strokeWidth: 1.3 }, markerEnd: arrow('#FFD200'),
    })
  }

  // Simulation branches (forecast sessions): appended in the account column,
  // after the last real node, on their own rows
  const simTxs = transactions.filter(x => colOf.has(x.account_id) && x.forecast_session_id)
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
      const account = visible[col]
      let bal = balances.get(accountId) // branch starts from the last real balance
      let prevId = lastNodeId.get(accountId)
      for (const tx of sessionTxs.filter(x => x.account_id === accountId)) {
        bal += tx.type === 'CREDIT' ? tx.amount : -tx.amount
        const r = row++
        const id = `tx-${tx.id}`
        nodes.push({
          id, type: 'txNode', ...base,
          position: { x: colX(col), y: ROWS_TOP + r * ROW_H },
          data: {
            account, color: account.color || '#FFD200', simColor, shortDate: shortDate(tx.date),
            point: { date: tx.date, balance: bal, label: txLabel(tx), tx },
          },
        })
        edges.push({
          id: `sim-${id}`, source: prevId, target: id,
          sourceHandle: 'bottom', targetHandle: 'top', type: 'straight',
          style: { stroke: simColor, strokeWidth: 1.3, strokeDasharray: '5 4' },
          markerEnd: arrow(simColor),
        })
        prevId = id
      }
    }
  })

  return { nodes, edges }
}

// ── Component ────────────────────────────────────────────────────────────────

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

function GraphInner({ transactions, accounts }) {
  const { t, lang } = useI18n()
  const wrapRef = useRef()
  const [tooltip, setTooltip] = useState(null)
  const { setViewport, zoomIn, zoomOut } = useReactFlow()
  const [ready, setReady] = useState(false)

  // The flow depends on the language CODE (stable string), never on a
  // function identity, so a re-render can never rebuild it by accident.
  const flow = useMemo(
    () => buildFlow(transactions, accounts, t),
    [transactions, accounts, lang] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Top-anchored framing: fit the columns width (readable floor), view at the
  // top of the graph; the user scrolls down for the rest.
  const fitTop = useCallback(() => {
    const el = wrapRef.current
    if (!el || !flow?.nodes.length) return false
    const cw = el.clientWidth
    const ch = el.clientHeight
    if (!cw || !ch) return false
    let minX = Infinity, maxX = -Infinity, minY = Infinity
    for (const { position } of flow.nodes) {
      minX = Math.min(minX, position.x)
      maxX = Math.max(maxX, position.x + NODE_W)
      minY = Math.min(minY, position.y)
    }
    const bx = minX - 40
    const bw = maxX - minX + 80
    const zoom = clamp(cw / bw, FIT_MIN, FIT_MAX)
    setViewport({
      x: bw * zoom <= cw ? (cw - bw * zoom) / 2 - bx * zoom : 8 - bx * zoom,
      y: 20 - (minY - 10) * zoom,
      zoom,
    })
    return true
  }, [flow, setViewport])

  // Automatic framing ONLY when the dataset really changes (signature guard):
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
  const fittedSigRef = useRef(null)
  useEffect(() => {
    if (!ready || fittedSigRef.current === dataSig) return
    if (fitTop()) fittedSigRef.current = dataSig
  }, [ready, dataSig, fitTop])

  const showTooltip = (event, node) =>
    setTooltip({ node: node.data, px: event.clientX, py: event.clientY })
  const hideTooltip = () => setTooltip(prev => (prev === null ? prev : null))

  if (!flow || !flow.nodes.length)
    return <div className="flex items-center justify-center h-full text-faint text-sm">{t('graph.empty')}</div>

  return (
    <div ref={wrapRef} className="relative w-full h-full bg-base">
      <ReactFlow
        nodes={flow.nodes}
        edges={flow.edges}
        nodeTypes={nodeTypes}
        onInit={() => setReady(true)}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        panOnScroll
        zoomOnScroll={false}
        zoomActivationKeyCode="Control"
        zoomOnPinch
        zoomOnDoubleClick
        panOnDrag
        onlyRenderVisibleElements
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        onNodeMouseEnter={showTooltip}
        onNodeMouseLeave={hideTooltip}
        onNodeClick={showTooltip}
        onPaneClick={hideTooltip}
        onMoveStart={hideTooltip}
        style={{ background: '#161311' }}
      >
        <Background gap={24} size={1} color="#352E2A" />
      </ReactFlow>

      {/* Gesture hint */}
      <p className="absolute bottom-3 left-3 text-[11px] text-muted pointer-events-none select-none">
        {t('graph.hint')}
      </p>

      {/* Zoom + recenter controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => zoomIn()}
          title={t('graph.zoomIn')}
          className="w-10 h-10 rounded-full bg-surface2 border border-edge text-muted hover:text-ink hover:border-primary/50 flex items-center justify-center shadow-lg transition-colors"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => zoomOut()}
          title={t('graph.zoomOut')}
          className="w-10 h-10 rounded-full bg-surface2 border border-edge text-muted hover:text-ink hover:border-primary/50 flex items-center justify-center shadow-lg transition-colors"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={fitTop}
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

export function GraphView({ transactions, accounts }) {
  return (
    <ReactFlowProvider>
      <GraphInner transactions={transactions} accounts={accounts} />
    </ReactFlowProvider>
  )
}
