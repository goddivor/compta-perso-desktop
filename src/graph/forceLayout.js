// Fruchterman-Reingold force-directed layout (pure JS, deterministic).
//
// nodes : [{ id, group, order }]
//   group : account index (used for the deterministic initial placement)
//   order : position of the node inside its account chain
// edges : [{ source, target, chain }]
//   chain edges (chronological links) attract 1.5x stronger
//
// Returns a Map(id -> { x, y }) of world-space positions.

export function forceLayout(nodes, edges, groupCount = 1) {
  const n = nodes.length
  const positions = new Map()
  if (!n) return positions

  const side = 1200 + n * 60
  const W = side
  const H = side
  const cx = W / 2
  const cy = H / 2
  const k = 0.9 * Math.sqrt((W * H) / n)
  const iterations = n > 150 ? 150 : 300

  // Deterministic initial placement: one angular sector per account,
  // nodes of a chain spiral outwards on concentric circles (no Math.random).
  const xs = new Float64Array(n)
  const ys = new Float64Array(n)
  const index = new Map()
  nodes.forEach((node, i) => {
    index.set(node.id, i)
    const base = (2 * Math.PI * (node.group || 0)) / Math.max(groupCount, 1)
    const angle = base + (node.order || 0) * 0.35
    const radius = 80 + (node.order || 0) * 46
    xs[i] = cx + radius * Math.cos(angle)
    ys[i] = cy + radius * Math.sin(angle)
  })

  const links = []
  for (const e of edges) {
    const s = index.get(e.source)
    const t = index.get(e.target)
    if (s == null || t == null || s === t) continue
    links.push({ s, t, w: e.chain ? 1.5 : 1 })
  }

  const dx = new Float64Array(n)
  const dy = new Float64Array(n)
  const tMax = W / 10

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 1 + (tMax - 1) * (1 - iter / iterations)
    dx.fill(0)
    dy.fill(0)

    // Repulsion: k^2 / d for every pair
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let ddx = xs[i] - xs[j]
        let ddy = ys[i] - ys[j]
        let d2 = ddx * ddx + ddy * ddy
        if (d2 < 0.0001) {
          // Deterministic tie-break for overlapping nodes
          ddx = ((i + j) % 2 ? 1 : -1) * 0.05
          ddy = ((i - j) % 3 ? 1 : -1) * 0.03
          d2 = ddx * ddx + ddy * ddy
        }
        const f = (k * k) / d2 // (k^2 / d) applied along the unit vector
        dx[i] += ddx * f
        dy[i] += ddy * f
        dx[j] -= ddx * f
        dy[j] -= ddy * f
      }
    }

    // Attraction: d^2 / k along edges (x1.5 on chronological chain edges)
    for (const { s, t, w } of links) {
      const ddx = xs[s] - xs[t]
      const ddy = ys[s] - ys[t]
      const d = Math.sqrt(ddx * ddx + ddy * ddy) || 0.01
      const f = (d / k) * w // (d^2 / k) applied along the unit vector
      dx[s] -= ddx * f
      dy[s] -= ddy * f
      dx[t] += ddx * f
      dy[t] += ddy * f
    }

    // Soft gravity towards the center (0.03 * dist)
    for (let i = 0; i < n; i++) {
      dx[i] += (cx - xs[i]) * 0.03
      dy[i] += (cy - ys[i]) * 0.03
    }

    // Move, displacement capped by the cooling temperature
    for (let i = 0; i < n; i++) {
      const len = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i])
      if (len < 0.001) continue
      const step = Math.min(len, temp)
      xs[i] += (dx[i] / len) * step
      ys[i] += (dy[i] / len) * step
    }
  }

  nodes.forEach((node, i) => positions.set(node.id, { x: xs[i], y: ys[i] }))
  return positions
}
