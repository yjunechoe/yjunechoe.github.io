// The life of residuals: scroll-driven story
//
// Each step of the story is a declarative "stage": where every dot, residual
// line and label should be, and which guides/axes are visible. Moving between
// steps just transitions to the target stage, so scrolling up, down, or
// skipping several steps at once all behave. A few hand-picked step changes
// play a multi-stage choreography instead (see SEQUENCES).

const stats = {
  // inverse standard normal CDF (Acklam's rational approximation)
  qnorm(p) {
    const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924]
    const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857]
    const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878]
    const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742]
    const lo = 0.02425, hi = 1 - lo
    let q, r
    if (p < lo) {
      q = Math.sqrt(-2 * Math.log(p))
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    }
    if (p > hi) {
      q = Math.sqrt(-2 * Math.log(1 - p))
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    }
    q = p - 0.5
    r = q * q
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  },
  dnorm(z) {
    return Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI)
  }
}

// the story is the animation, so it always runs; ?motion=reduced opts out
// (every transition becomes an instant cut)
const REDUCED = new URLSearchParams(location.search).get("motion") === "reduced"

const COLORS = {
  ink: "#2b2d42",
  pos: "#2a9d8f",
  neg: "#e76f51",
  line: "#3d5a80",
  ours: "#3b82c4", // the residuals' own density curve
  muted: "#9a958b"
}
const signColor = r => (r >= 0 ? COLORS.pos : COLORS.neg)
const signed = v => (v > 0 ? "+" : "") + d3.format(".2f")(v)

// shared arrowhead markers
function addArrowDefs(svg, prefix, color) {
  svg.append("defs")
    .selectAll("marker")
    .data(["start", "end"])
    .join("marker")
    .attr("id", d => `${prefix}-${d}`)
    .attr("viewBox", [0, -5, 10, 10])
    .attr("refX", 5)
    .attr("markerWidth", 4)
    .attr("markerHeight", 4)
    .attr("orient", "auto")
    .append("path")
    .attr("fill", color)
    .attr("d", d => (d === "start" ? "M10,-5L0,0L10,5" : "M0,-5L10,0L0,5"))
}

;(function story() {
  // ---------- data ----------

  const n = data.length
  const sd = d3.deviation(data, d => d.residual)
  const BIN = 0.5 // histogram bin width, in SDs

  data.sort((a, b) => a.residual - b.residual)
  const binFill = new Map()
  data.forEach((d, i) => {
    d.id = i
    d.z = d.residual / sd
    d.q = stats.qnorm((i + 0.5) / n) // theoretical quantile for the i-th smallest
    d.bin = Math.floor(d.z / BIN)
    d.stack = binFill.get(d.bin) || 0
    binFill.set(d.bin, d.stack + 1)
  })
  const maxCount = d3.max(binFill.values())

  // ---------- dimensions & scales ----------

  const W = 1000, H = 1000
  const M = { t: 30, r: 30, b: 110, l: 110 }
  const pw = W - M.l - M.r
  const ph = H - M.t - M.b
  const MID = ph * 0.5 // y of the 1D number line
  const BASE = ph * 0.92 // histogram baseline
  const ZMAX = 3.2

  const x = d3.scaleLinear().domain([2800, 5700]).range([0, pw])
  const y = d3.scaleLinear().domain([30, 52]).range([ph, 0])

  // residual (mm) and z scales share pixels: standardizing never moves a dot
  const rx = d3.scaleLinear().domain([-ZMAX * sd, ZMAX * sd]).range([0, pw])
  const zx = d3.scaleLinear().domain([-ZMAX, ZMAX]).range([0, pw])

  const unit = Math.min(zx(BIN) - zx(0), (BASE - 40) / (maxCount + 1))
  const countY = d3.scaleLinear().domain([0, maxCount + 1]).range([BASE, BASE - (maxCount + 1) * unit])

  // Q–Q panel sits top-right, leaving room below and to the left for the
  // two "vases". Its bins are one dot tall, so the dot histogram fits the side.
  const QZ = 3
  const QS = 520 // side of the Q–Q panel
  const GAP = 50 // room for tick labels between axis and vase
  const Q = { x0: pw - QS, x1: pw, y0: 0, y1: QS }
  const qx = d3.scaleLinear().domain([-QZ, QZ]).range([Q.x0, Q.x1])
  const qy = d3.scaleLinear().domain([-QZ, QZ]).range([Q.y1, Q.y0])
  // once the vases have done their job, the Q–Q plot takes the whole panel
  const qxF = d3.scaleLinear().domain([-QZ, QZ]).range([0, pw])
  const qyF = d3.scaleLinear().domain([-QZ, QZ]).range([ph, 0])
  const RV_W = pw - 130 // residuals vs. fitted leaves room on the right for the bell
  const fx = d3.scaleLinear().domain([34, 51]).range([0, RV_W])
  const ry = d3.scaleLinear().domain([-ZMAX * sd, ZMAX * sd]).range([ph, 0])

  // ---------- svg scaffold ----------

  const svg = d3.select("#canvas").attr("viewBox", [0, 0, W, H])
  addArrowDefs(svg, "arrow", COLORS.ink)
  const root = svg.append("g").attr("transform", `translate(${M.l},${M.t})`)
  const L = {
    axes: root.append("g"),
    guides: root.append("g"),
    lines: root.append("g"),
    dots: root.append("g"),
    labels: root.append("g"),
    over: root.append("g")
  }

  // every toggleable element, keyed by name; stages list the ones they show
  const els = {}

  function makeAxis(key, axis, transform, title, titleAttrs) {
    const g = L.axes.append("g")
      .attr("class", "axis")
      .attr("transform", transform)
      .style("opacity", 0)
      .call(axis)
    g.append("text").attr("class", "axis-title").call(sel => {
      for (const [k, v] of Object.entries(titleAttrs)) sel.attr(k, v)
    }).text(title)
    els[key] = g
    return g
  }
  const bottomTitle = { x: pw, y: 80, "text-anchor": "end" }
  const leftTitle = { transform: "translate(-85,0) rotate(-90)", "text-anchor": "end" }

  makeAxis("sx", d3.axisBottom(x).ticks(6).tickFormat(d3.format(",")), `translate(0,${ph})`, "Body mass (g) →", bottomTitle)
  makeAxis("sy", d3.axisLeft(y).ticks(6), "", "Bill length (mm) →", leftTitle)

  const axisMM = d3.axisBottom(rx).ticks(7).tickFormat(v => (v === 0 ? "0" : d3.format("+")(v)))
  const axisZ = d3.axisBottom(zx).ticks(7).tickFormat(v => (v === 0 ? "0" : d3.format("+")(v)))
  const a1 = makeAxis("a1", axisMM, `translate(0,${MID})`, "Residual (mm)", { x: pw / 2, y: 80, "text-anchor": "middle" })
  a1.classed("axis--line", true)
  const a1Title = a1.select(".axis-title")

  makeAxis("count", d3.axisLeft(countY).ticks(maxCount + 1).tickFormat(d3.format("d")), "", "Count →",
    { transform: `translate(-70,${BASE}) rotate(-90)`, "text-anchor": "start" })
  makeAxis("qqx", d3.axisBottom(qx).ticks(7).tickFormat(v => (v === 0 ? "0" : d3.format("+")(v))), `translate(0,${Q.y1})`, "", {})
  makeAxis("qqy", d3.axisLeft(qy).ticks(7).tickFormat(v => (v === 0 ? "0" : d3.format("+")(v))), `translate(${Q.x0},0)`, "", {})
  makeAxis("qqxF", d3.axisBottom(qxF).ticks(7).tickFormat(v => (v === 0 ? "0" : d3.format("+")(v))), `translate(0,${ph})`, "Theoretical normal quantile →", bottomTitle)
  makeAxis("qqyF", d3.axisLeft(qyF).ticks(7).tickFormat(v => (v === 0 ? "0" : d3.format("+")(v))), "", "Standardized residual →", leftTitle)
  makeAxis("rvx", d3.axisBottom(fx).ticks(6), `translate(0,${ph})`, "Fitted bill length (mm) →", { ...bottomTitle, x: RV_W })
  makeAxis("rvy", d3.axisLeft(ry).ticks(7).tickFormat(v => (v === 0 ? "0" : d3.format("+")(v))), "", "Residual (mm) →", leftTitle)

  // guides
  els.arrows = L.guides.append("line")
    .attr("x1", -8).attr("x2", pw + 8)
    .attr("y1", MID).attr("y2", MID)
    .attr("stroke", COLORS.ink).attr("stroke-width", 3)
    .attr("marker-start", "url(#arrow-start)")
    .attr("marker-end", "url(#arrow-end)")
    .style("opacity", 0)

  els.zeroTick = L.guides.append("line")
    .attr("x1", rx(0)).attr("x2", rx(0))
    .attr("y1", MID - 60).attr("y2", MID + 14)
    .attr("stroke", COLORS.ink).attr("stroke-width", 2)
    .attr("stroke-dasharray", "4 4")
    .style("opacity", 0)

  const sdPx = zx(1) - zx(0)
  els.sd = L.over.append("g")
    .attr("transform", `translate(${zx(0)},${MID - 130})`)
    .style("opacity", 0)
    .call(g => {
      g.append("line")
        .attr("x2", sdPx - 6)
        .attr("stroke", COLORS.ink).attr("stroke-width", 3)
        .attr("marker-end", "url(#arrow-end)")
      g.append("circle").attr("r", 6).attr("fill", COLORS.ink)
      g.append("text").attr("class", "sd-label")
        .attr("x", sdPx / 2).attr("y", -20)
        .text(`1 SD = ${sd.toFixed(2)} mm`)
    })

  // Two curves drape the histogram: the residuals' own (empirical) density
  // and the normal benchmark. Each is one path that later morphs into its
  // Q–Q vase, so both shapes are built from the same grid (same path structure)
  const normalGrid = d3.range(-ZMAX, ZMAX + 0.001, 0.05)
  const cell = qy(0) - qy(BIN) // a residual dot in the side vase: one bin tall
  const yB = Q.y1 + GAP // bottom vase rim
  const xL = Q.x0 - GAP // side vase rim
  // a Gaussian kernel, narrow enough to follow the dot pile's steps
  const BW = 0.28 // bandwidth, in SDs
  const kernel = u => stats.dnorm(u / BW) / BW
  const kdeZ = z => d3.mean(data, d => kernel(z - d.z))
  // both densities in "dot units": counts per bin, like the histogram
  const vaseDepthN = z => n * BIN * stats.dnorm(z) * cell
  const vaseDepthE = z => n * BIN * kdeZ(z) * cell
  const smooth = d3.line().curve(d3.curveBasis)

  // a curve that draws itself in over the histogram and later moves to a vase
  // (drawn twice: a wide white halo underneath so it reads over the dots)
  function morphCurve(color, histPts, vasePts) {
    const g = L.over.append("g")
    g.append("path").attr("stroke", "#fff").attr("stroke-width", 10).attr("stroke-linejoin", "round")
    g.append("path").attr("stroke", color).attr("stroke-width", 4)
    const path = g.selectAll("path").attr("fill", "none").style("opacity", 0)
    const hist = smooth(histPts), vase = smooth(vasePts)
    const len = Math.max(
      path.attr("d", vase).node().getTotalLength(),
      path.attr("d", hist).node().getTotalLength()
    ) + 10
    path.attr("stroke-dasharray", `${len} ${len}`).attr("stroke-dashoffset", len)
    return { path, hist, vase, len }
  }
  const curves = {
    normal: morphCurve(COLORS.ink,
      normalGrid.map(z => [zx(z), countY(n * BIN * stats.dnorm(z))]),
      normalGrid.map(z => [qx(z), yB + vaseDepthN(z)])),
    kde: morphCurve(COLORS.ours,
      normalGrid.map(z => [zx(z), countY(n * BIN * kdeZ(z))]),
      normalGrid.map(z => [xL - vaseDepthE(z), qy(z)]))
  }

  // direct labels for the two curves on the histogram step
  els.curveLabels = L.over.append("g").style("opacity", 0)
  els.curveLabels.append("text").attr("class", "curve-label")
    .attr("x", zx(-1.45) - 14).attr("y", countY(n * BIN * stats.dnorm(-1.45)))
    .attr("text-anchor", "end").style("fill", COLORS.ink)
    .text("normal")
  els.curveLabels.append("text").attr("class", "curve-label")
    .attr("x", zx(1.6) + 14).attr("y", countY(n * BIN * kdeZ(1.6)))
    .attr("text-anchor", "start").style("fill", COLORS.ours)
    .text("our residuals")

  const diagonal = (key, xs, ys) => {
    els[key] = L.guides.append("line")
      .attr("x1", xs(-QZ)).attr("y1", ys(-QZ))
      .attr("x2", xs(QZ)).attr("y2", ys(QZ))
      .attr("stroke", COLORS.muted).attr("stroke-width", 3)
      .attr("stroke-dasharray", "10 8")
      .style("opacity", 0)
  }
  diagonal("qqline", qx, qy)
  diagonal("qqlineF", qxF, qyF)

  // ---------- Q–Q vases (after Stine, 2016) ----------
  //
  // The normal curve hangs below the x axis; along the y axis lies a smooth
  // density of the residuals, with their dots stacked inside it. Both curves
  // are drawn in "dot units" (like the normal benchmark over the histogram)
  // with the same pixels per unit on each axis, so the two vases hold the
  // same amount of water. Pour p of it into each and the water lines sit at matching
  // quantiles. Where they cross traces the Q–Q plot, and each residual
  // leaves the side vase for its Q–Q spot as the water reaches it.

  const clampQ = v => Math.max(-QZ, Math.min(QZ, v))
  const normQ = p => clampQ(stats.qnorm(Math.min(1 - 1e-9, Math.max(1e-9, p))))
  const bLo = data[0].bin
  const maxDepthE = d3.max(normalGrid, vaseDepthE)
  // empirical quantile: linear between order statistics at (i + 0.5) / n,
  // running out to the edges of the density at p = 0 and p = 1
  const quantPts = [
    [0, clampQ(data[0].z - 3 * BW)],
    ...data.map(d => [(d.id + 0.5) / n, d.z]),
    [1, clampQ(data[n - 1].z + 3 * BW)]
  ]
  const empQ = p => {
    const i = Math.min(quantPts.length - 1, Math.max(1, d3.bisector(d => d[0]).right(quantPts, p)))
    const [p0, z0] = quantPts[i - 1], [p1, z1] = quantPts[i]
    return z0 + ((p - p0) / (p1 - p0)) * (z1 - z0)
  }
  const pFirst = 0.5 / n, pLast = 1 - 0.5 / n

  const WATER = "#789FBC", WATER_DARK = COLORS.line
  const defs = svg.select("defs")
  const clipN = defs.append("clipPath").attr("id", "clip-normal").append("rect")
  const clipE = defs.append("clipPath").attr("id", "clip-resid").append("rect")

  const sideVase = d3.area().curve(d3.curveBasis)
    .y(d => qy(d)).x0(xL).x1(d => xL - vaseDepthE(d))(normalGrid)
  const bottomVase = d3.area().curve(d3.curveBasis)
    .x(d => qx(d)).y0(yB).y1(d => yB + vaseDepthN(d))(normalGrid)

  els.vases = L.guides.append("g").style("opacity", 0)
  els.vases.append("path").attr("d", bottomVase).attr("fill", "#efe9df")
  els.vases.append("path").attr("d", bottomVase).attr("fill", WATER).attr("clip-path", "url(#clip-normal)")
  els.vases.append("line") // rim; the outline itself is the morphed normal curve
    .attr("x1", qx(-ZMAX)).attr("x2", qx(ZMAX)).attr("y1", yB).attr("y2", yB)
    .attr("stroke", COLORS.ink).attr("stroke-width", 2.5)
  els.vases.append("path").attr("d", sideVase).attr("fill", "#efe9df")
  els.vases.append("path").attr("d", sideVase).attr("fill", WATER).attr("clip-path", "url(#clip-resid)")
  els.vases.append("line") // rim; the outline is the morphed blue density curve
    .attr("x1", xL).attr("x2", xL).attr("y1", qy(ZMAX)).attr("y2", qy(-ZMAX))
    .attr("stroke", COLORS.ours).attr("stroke-width", 2.5)
  els.vases.append("text").attr("class", "vase-label")
    .attr("x", qx(0)).attr("y", yB + vaseDepthN(0) + 40)
    .text("Normal distribution →")
  els.vases.append("text").attr("class", "vase-label")
    .attr("transform", `translate(${xL - Math.max(maxDepthE, maxCount * cell) - 30},${qy(0)}) rotate(-90)`)
    .style("fill", COLORS.ours)
    .text("Our residuals (SDs) →")

  els.guides = L.guides.append("g").style("opacity", 0)
  const tracer = els.guides.append("path")
    .attr("fill", "none").attr("stroke", WATER_DARK).attr("stroke-width", 3)
  const guideN = els.guides.append("line")
  const guideE = els.guides.append("line")
  els.guides.selectAll("line")
    .attr("stroke", WATER_DARK).attr("stroke-width", 2.5).attr("stroke-dasharray", "7 6")
  const marker = els.guides.append("circle")
    .attr("r", 9).attr("fill", WATER_DARK).attr("stroke", "#fff").attr("stroke-width", 2)
  const pourText = els.guides.append("text").attr("class", "pour-label")
    .attr("x", Q.x0 + 16).attr("y", 24)

  let fillP = 0
  let pouring = false // in the pouring step, dots leave the vase as the water reaches them

  function setFill(p) {
    fillP = p
    const ln = normQ(p), le = empQ(p)
    const mx = qx(ln), my = qy(le)
    clipN.attr("x", qx(-ZMAX)).attr("y", yB - 2).attr("height", vaseDepthN(0) + 6)
      .attr("width", Math.max(0, mx - qx(-ZMAX)))
    clipE.attr("x", xL - maxDepthE - 4).attr("width", maxDepthE + 6)
      .attr("y", my).attr("height", Math.max(0, qy(-ZMAX) - my))

    const active = p >= pFirst && p <= pLast
    guideN.attr("x1", mx).attr("x2", mx).attr("y1", my).attr("y2", yB + vaseDepthN(ln))
    guideE.attr("y1", my).attr("y2", my).attr("x1", mx)
      .attr("x2", xL - vaseDepthE(le))
    marker.attr("cx", mx).attr("cy", my)
    els.guides.selectAll("line, circle").style("opacity", active ? 1 : 0)

    const ps = p > pFirst ? [...d3.range(pFirst, Math.min(p, pLast), 0.002), Math.min(p, pLast)] : []
    tracer.attr("d", ps.length > 1 ? d3.line()(ps.map(q => [qx(normQ(q)), qy(empQ(q))])) : null)
    // pouring moves in 1/40 notches; show the nearest notch while it animates
    pourText.text(`${d3.format(".1~f")(Math.round(p * n) * (100 / n))}% poured`)

    if (pouring) flyDots()
  }

  // where a residual sits: stacked in the side vase, or at its Q–Q spot
  const inVase = d => ({
    cx: xL - (d.stack + 0.5) * cell, cy: qy((d.bin + 0.5) * BIN),
    r: cell * 0.44, fill: signColor(d.residual), o: 0.9
  })
  const onQQ = d => ({ cx: qx(d.q), cy: qy(d.z), r: 11, fill: signColor(d.residual), o: 0.9 })
  const poured = d => (d.id + 0.5) / n <= fillP

  function flyDots() {
    dots.each(function (d) {
      const out = poured(d)
      if (out === this.__out) return
      this.__out = out
      const P = out ? onQQ(d) : inVase(d)
      d3.select(this).transition("pop")
        .duration(REDUCED ? 0 : out ? 650 : 400)
        .ease(out ? d3.easeCubicOut : d3.easeCubicInOut)
        .attr("cx", P.cx).attr("cy", P.cy).attr("r", P.r)
    })
  }

  let fillTarget = 0
  function tweenFill(target, delay, dur, ease = d3.easeCubicInOut) {
    const from = fillP
    fillTarget = target
    els.vases.interrupt("fill")
    if (from === target) return
    els.vases.transition("fill").delay(delay).duration(dur).ease(ease)
      .tween("fill", () => t => setFill(from + (target - from) * t))
  }
  setFill(0)

  els.zero = L.guides.append("line")
    .attr("x1", 0).attr("x2", RV_W + 30)
    .attr("y1", ry(0)).attr("y2", ry(0))
    .attr("stroke", COLORS.muted).attr("stroke-width", 3)
    .attr("stroke-dasharray", "10 8")
    .style("opacity", 0)

  // the assumption behind residuals vs. fitted: at every prediction, the
  // misses come from the same bell curve centered on zero. The bell sits in
  // the margin; the band shows where it puts most misses (±2 SD) all the way
  // across, so a funnel or a curve would visibly break out of it.
  const bellGrid = d3.range(-3, 3.001, 0.05)
  const bellRim = RV_W + 30
  const bellX = z => bellRim + 85 * stats.dnorm(z) / stats.dnorm(0)
  els.bells = L.guides.append("g").style("opacity", 0)
  els.bells.append("rect")
    .attr("x", 0).attr("width", bellRim)
    .attr("y", ry(2 * sd)).attr("height", ry(-2 * sd) - ry(2 * sd))
    .attr("fill", "#789FBC").attr("fill-opacity", 0.12)
  els.bells.append("path")
    .attr("d", d3.area().curve(d3.curveBasis).y(z => ry(z * sd)).x0(bellRim).x1(bellX)(bellGrid))
    .attr("fill", "#789FBC").attr("fill-opacity", 0.35)
  els.bells.append("path")
    .attr("d", d3.line().curve(d3.curveBasis)(bellGrid.map(z => [bellX(z), ry(z * sd)])))
    .attr("fill", "none").attr("stroke", "#789FBC").attr("stroke-width", 2.5)
  els.bells.append("line")
    .attr("x1", bellRim).attr("x2", bellRim).attr("y1", ry(3 * sd)).attr("y2", ry(-3 * sd))
    .attr("stroke", "#789FBC").attr("stroke-width", 1.5)
  els.bells.append("text").attr("class", "band-label")
    .attr("x", bellRim - 8).attr("y", ry(2 * sd) - 10)
    .text("±2 SD")

  // regression line (its endpoints are part of each stage)
  const lm = L.guides.append("line")
    .attr("stroke", COLORS.line)
    .attr("stroke-width", 5)
    .attr("stroke-linecap", "round")
    .style("opacity", 0)

  // per-penguin marks
  const lines = L.lines.selectAll("line").data(data).join("line")
    .attr("stroke", d => signColor(d.residual))
    .attr("stroke-width", 3.5)
    .style("opacity", 0)

  const dots = L.dots.selectAll("circle").data(data).join("circle")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .attr("r", 0)
    .style("opacity", 0)

  const labels = L.labels.selectAll("text").data(data).join("text")
    .attr("class", "residual-text")
    .attr("fill", d => signColor(d.residual))
    .text(d => signed(d.residual))
    .style("opacity", 0)

  // ---------- stages ----------

  const px = d => x(d.predictor)
  const py = d => y(d.observed)
  const fy = d => y(d.fitted)
  const lmFull = {
    x1: 0, y1: y(model.predict(x.domain()[0])),
    x2: pw, y2: y(model.predict(x.domain()[1]))
  }
  const lmCollapsed = { x1: 0, y1: lmFull.y1, x2: 0, y2: lmFull.y1 }
  const lmFlat = { x1: 0, y1: MID, x2: pw, y2: MID }

  const at = (cx, cy) => ({ x1: cx, y1: cy, x2: cx, y2: cy, o: 0 }) // collapsed line
  const labelAt = d => ({ x: px(d), y: py(d) + (d.residual > 0 ? -22 : 34), o: 0 })

  const stage = {}

  stage.intro = {
    show: [], lm: lmCollapsed,
    dot: d => ({ cx: px(d), cy: py(d), r: 0, fill: COLORS.ink, o: 0 }),
    line: d => at(px(d), py(d)),
    label: labelAt
  }
  stage.scatter = {
    show: ["sx", "sy"], lm: lmCollapsed,
    dot: d => ({ cx: px(d), cy: py(d), r: 10, fill: COLORS.ink, o: 1 }),
    line: d => at(px(d), py(d)),
    label: labelAt,
    stagger: d => d.predictor / 8 - 350
  }
  stage.line = { ...stage.scatter, show: ["sx", "sy", "lm"], lm: lmFull, stagger: null }
  stage.residuals = {
    ...stage.line,
    line: d => ({ x1: px(d), y1: py(d), x2: px(d), y2: fy(d), o: 1 })
  }
  stage.labels = {
    ...stage.residuals,
    label: d => ({ ...labelAt(d), o: 1 }),
    stagger: (d, i) => i * 12
  }
  // keyframes used when collapsing into one dimension
  const lifted = d => MID + (py(d) - fy(d))
  stage.lift = {
    show: ["lm"], lm: lmFlat,
    dot: d => ({ cx: px(d), cy: lifted(d), r: 10, fill: COLORS.ink, o: 1 }),
    line: d => ({ x1: px(d), y1: lifted(d), x2: px(d), y2: MID, o: 1 }),
    label: d => ({ x: px(d), y: lifted(d) + (d.residual > 0 ? -22 : 34), o: 0 })
  }
  stage.slide = {
    ...stage.lift,
    show: ["a1", "arrows"],
    dot: d => ({ cx: rx(d.residual), cy: lifted(d), r: 10, fill: COLORS.ink, o: 1 }),
    line: d => ({ x1: rx(d.residual), y1: lifted(d), x2: rx(d.residual), y2: MID, o: 1 }),
    label: d => ({ x: rx(d.residual), y: lifted(d), o: 0 }),
    ease: d3.easeCubicOut
  }
  stage.numberline = {
    show: ["a1", "arrows", "zeroTick"], lm: lmFlat, axis: "mm",
    dot: d => ({ cx: rx(d.residual), cy: MID - 22, r: 13, fill: signColor(d.residual), o: 0.75 }),
    line: d => at(rx(d.residual), MID - 22),
    label: d => ({ x: rx(d.residual), y: MID - 22, o: 0 })
  }
  stage.z = { ...stage.numberline, show: ["a1", "arrows", "zeroTick", "sd"], axis: "z" }
  const stacked = d => ({
    cx: zx((d.bin + 0.5) * BIN),
    cy: countY(d.stack + 0.5),
    r: unit * 0.46,
    fill: signColor(d.residual),
    o: 0.9
  })
  stage.stack = {
    ...stage.z,
    show: ["a1", "count"], axisY: BASE,
    dot: stacked,
    line: d => { const s = stacked(d); return at(s.cx, s.cy) },
    stagger: d => d.stack * 90 + Math.abs(d.bin) * 25,
    ease: d3.easeBounceOut,
    dur: 900
  }
  stage.normal = { ...stage.stack, show: ["a1", "count", "normal", "kde", "curveLabels"], stagger: null, ease: null, dur: null }
  const qqDot = out => d => (out(d) ? onQQ(d) : inVase(d))
  // the dot histogram tips over onto its side and the bell curve drops below
  stage.qqVases = {
    show: ["qqx", "qqy", "vases", "normal", "kde"], normalAt: "vase",
    lm: lmFlat, axisY: BASE, axis: "z", fill: 0,
    dot: qqDot(() => false),
    line: d => { const v = inVase(d); return at(v.cx, v.cy) },
    label: d => ({ x: qx(d.q), y: qy(d.z), o: 0 }),
    stagger: d => d.stack * 40 + (d.bin - bLo) * 30,
    dur: 1400
  }
  stage.qqFill = {
    ...stage.qqVases,
    show: ["qqx", "qqy", "vases", "normal", "kde", "guides", "qqline"], fill: "scrub",
    dot: qqDot(poured),
    stagger: null, dur: null
  }
  // reading it: back to the abstraction. The vases clear away and the
  // Q–Q plot grows to fill the panel.
  const onQQFull = d => ({ cx: qxF(d.q), cy: qyF(d.z), r: 11, fill: signColor(d.residual), o: 0.9 })
  stage.qq = {
    ...stage.qqVases,
    show: ["qqxF", "qqyF", "qqlineF"], fill: 1,
    dot: onQQFull,
    line: d => { const q = onQQFull(d); return at(q.cx, q.cy) },
    stagger: (d, i) => i * 12, dur: null
  }
  stage.rvf = {
    show: ["rvx", "rvy", "zero", "bells"], lm: lmFlat, axisY: BASE, axis: "z",
    dot: d => ({ cx: fx(d.fitted), cy: ry(d.residual), r: 11, fill: signColor(d.residual), o: 0.9 }),
    line: d => ({ x1: fx(d.fitted), y1: ry(d.residual), x2: fx(d.fitted), y2: ry(0), o: 0.6 }),
    label: d => ({ x: fx(d.fitted), y: ry(d.residual), o: 0 }),
    stagger: (d, i) => i * 12
  }

  stage.rvfDots = {
    ...stage.rvf,
    line: d => at(fx(d.fitted), ry(d.residual)),
    stagger: d => (fx(d.fitted) / pw) * 500
  }

  // ---------- closer: the three diagnostic plots, side by side ----------

  els.closer = L.guides.append("g").style("opacity", 0)
  function closerPanel(x0, y0, w, h, title, blurb, xDom, yDom, xTicks = 5) {
    const xs = d3.scaleLinear().domain(xDom).range([x0, x0 + w])
    const ys = d3.scaleLinear().domain(yDom).range([y0 + h, y0])
    const g = els.closer.append("g")
    g.append("text").attr("class", "closer-q").attr("x", x0).attr("y", y0 - 34).text(title)
    g.append("text").attr("class", "closer-name").attr("x", x0).attr("y", y0 - 10).text(blurb)
    g.append("g").attr("class", "axis axis--mini").attr("transform", `translate(0,${y0 + h})`)
      .call(d3.axisBottom(xs).ticks(xTicks).tickFormat(v => (v > 0 && xDom[0] < 0 ? "+" : "") + v))
    const refLine = (x1, y1, x2, y2) => g.append("line")
      .attr("x1", xs(x1)).attr("y1", ys(y1)).attr("x2", xs(x2)).attr("y2", ys(y2))
      .attr("stroke", COLORS.muted).attr("stroke-width", 2.5).attr("stroke-dasharray", "8 6")
    return { g, xs, ys, refLine }
  }

  // 1. histogram: just the stacked dots
  const cH = closerPanel(20, 70, 380, 290, "Histogram", "The overall shape at a glance", [-ZMAX, ZMAX], [0, maxCount + 1])
  const cUnit = Math.min(cH.xs(BIN) - cH.xs(0), cH.ys(0) - cH.ys(1))
  cH.g.append("g").selectAll("circle").data(data).join("circle")
    .attr("cx", d => cH.xs((d.bin + 0.5) * BIN))
    .attr("cy", d => cH.ys(0) - (d.stack + 0.5) * cUnit)
    .attr("r", cUnit * 0.44)
    .attr("fill", d => signColor(d.residual)).attr("opacity", 0.9)

  // 2. Q–Q: the dots along the diagonal
  const cQ = closerPanel(480, 70, 380, 290, "Q–Q plot", "A close check against the bell curve", [-QZ, QZ], [-QZ, QZ])
  cQ.refLine(-QZ, -QZ, QZ, QZ)
  cQ.g.append("g").selectAll("circle").data(data).join("circle")
    .attr("cx", d => cQ.xs(d.q)).attr("cy", d => cQ.ys(d.z)).attr("r", 6.5)
    .attr("fill", d => signColor(d.residual)).attr("stroke", "#fff").attr("stroke-width", 1.5)

  // 3. residuals vs. fitted: the story's own dots land here
  const cR = closerPanel(20, 510, 840, 300, "Residuals vs. fitted", "The misses across the model's predictions", [34, 51], [-ZMAX * sd, ZMAX * sd], 8)
  cR.g.insert("rect", ":first-child")
    .attr("x", cR.xs(34)).attr("width", cR.xs(51) - cR.xs(34))
    .attr("y", cR.ys(2 * sd)).attr("height", cR.ys(-2 * sd) - cR.ys(2 * sd))
    .attr("fill", "#789FBC").attr("fill-opacity", 0.12)
  cR.refLine(34, 0, 51, 0)

  stage.closer = {
    ...stage.rvf,
    show: ["closer"],
    dot: d => ({ cx: cR.xs(d.fitted), cy: cR.ys(d.residual), r: 7.5, fill: signColor(d.residual), o: 0.9 }),
    line: d => at(cR.xs(d.fitted), cR.ys(d.residual)),
    label: d => ({ x: cR.xs(d.fitted), y: cR.ys(d.residual), o: 0 }),
    stagger: (d, i) => i * 8
  }

  const STEPS = ["intro", "scatter", "line", "residuals", "labels", "numberline", "z", "stack", "normal", "qqVases", "qqFill", "qq", "rvf", "closer"]

  // choreographed transitions between neighbouring steps: [stage, duration]
  const SEQUENCES = {
    "4>5": [["lift", 1000], ["slide", 1200], ["numberline", 700]],
    "5>4": [["slide", 500], ["lift", 900], ["labels", 900]],
    // to residuals vs. fitted: move the dots, then grow the sticks
    "11>12": [["rvfDots", 1100], ["rvf", 700]],
    "12>11": [["rvfDots", 500], ["qq", 1100]]
  }

  // ---------- rendering ----------

  let currentAxis = "mm"

  function apply(st, delay, dur) {
    dur = REDUCED ? 0 : st.dur || dur
    const ease = st.ease || d3.easeCubicInOut
    const tg = sel => sel.transition().delay(delay).duration(dur).ease(ease)
    const td = sel => sel.transition()
      .delay(st.stagger && !REDUCED ? (d, i) => delay + Math.max(0, st.stagger(d, i)) : delay)
      .duration(dur).ease(ease)

    for (const [key, el] of Object.entries(els)) {
      if (key === "a1") continue // handled below
      tg(el).style("opacity", st.show.includes(key) ? 1 : 0)
    }

    // the density curves draw themselves in, and later move to become vases
    for (const [key, c] of Object.entries(curves)) {
      const on = st.show.includes(key)
      tg(c.path)
        .style("opacity", on ? 1 : 0)
        .attr("stroke-dashoffset", on ? 0 : c.len)
        .attr("d", st.normalAt === "vase" ? c.vase : c.hist)
        .duration(REDUCED ? 0 : on ? 1400 : 400)
    }

    const lmOn = st.show.includes("lm")
    tg(lm)
      .attr("x1", st.lm.x1).attr("y1", st.lm.y1)
      .attr("x2", st.lm.x2).attr("y2", st.lm.y2)
      .style("opacity", lmOn ? 1 : 0)

    // the number line: rescaled (mm -> z) and dropped to the histogram baseline
    const axisY = st.axisY || MID
    const axisKind = st.axis || "mm"
    // (one transition per element: a second unnamed one would cancel the first)
    const a1t = tg(a1)
      .attr("transform", `translate(0,${axisY})`)
      .style("opacity", st.show.includes("a1") ? 1 : 0)
    a1t.call(axisKind === "z" ? axisZ : axisMM)
    if (axisKind !== currentAxis) {
      a1t.duration(REDUCED ? 0 : 1600)
      a1Title.transition().delay(delay).duration(300).style("opacity", 0)
        .transition().duration(0).text(axisKind === "z" ? "Standardized residual (SDs)" : "Residual (mm)")
        .transition().duration(600).style("opacity", 1)
      currentAxis = axisKind
    }
    els.arrows.attr("y1", axisY).attr("y2", axisY)

    // Q–Q water level: tweened to a fixed level, or left to the scroll position
    dots.interrupt("pop")
    pouring = st.fill === "scrub"
    if (typeof st.fill === "number") tweenFill(st.fill, delay, dur)
    else if (pouring) els.vases.interrupt("fill")

    const D = data.map(st.dot)
    dots.each(function (d) { this.__out = st.fill === "scrub" ? poured(d) : st.fill === 1 })
    td(dots)
      .attr("cx", d => D[d.id].cx)
      .attr("cy", d => D[d.id].cy)
      .attr("r", d => D[d.id].r)
      .attr("fill", d => D[d.id].fill)
      .style("opacity", d => D[d.id].o)

    const Ln = data.map(st.line)
    td(lines)
      .attr("x1", d => Ln[d.id].x1).attr("y1", d => Ln[d.id].y1)
      .attr("x2", d => Ln[d.id].x2).attr("y2", d => Ln[d.id].y2)
      .style("opacity", d => Ln[d.id].o)

    const Lb = data.map(st.label)
    td(labels)
      .attr("x", d => Lb[d.id].x).attr("y", d => Lb[d.id].y)
      .style("opacity", d => Lb[d.id].o)

    return delay + dur
  }

  let current = 0
  apply(stage.intro, 0, 0)

  function goTo(index) {
    if (index === current) return
    const seq = SEQUENCES[`${current}>${index}`]
    if (seq && !REDUCED) {
      let t = 0
      for (const [name, dur] of seq) t = apply(stage[name], t, dur)
    } else {
      // skipping steps? move straight there, a bit quicker
      apply(stage[STEPS[index]], 0, Math.abs(index - current) > 1 ? 800 : 1000)
    }
    current = index
  }


  // ---------- scroll triggers ----------
  //
  // Scrolling down, a step starts when its card's top reaches 60% of the way
  // down the screen. Scrolling up is the mirror image: we step back once the
  // previous card's bottom has come 40% of the way down, i.e. as soon as that
  // card is back in view, rather than waiting for it to reach the same line.

  const DOWN_LINE = 0.6, UP_LINE = 0.4
  const figure = d3.select("#scrolly figure")
  const figLabel = d3.select("#fig-label-text")
  const steps = d3.selectAll("#scrolly .step")
  const stepEls = steps.nodes()
  const canvas = d3.select("#canvas").attr("role", "img")
  const bar = document.getElementById("progress")

  function enterStep(index) {
    const el = stepEls[index]
    steps.classed("is-active", (d, i) => i === index)
    figure.classed("show-intro", index === 0)
    figLabel.text(el.dataset.label)
    canvas.attr("aria-label", el.dataset.alt)
    goTo(index)
  }

  let lastY = window.scrollY
  function onScroll() {
    const y = window.scrollY, vh = window.innerHeight
    const down = y >= lastY
    lastY = y
    const rects = stepEls.map(el => el.getBoundingClientRect())

    let next
    if (down) {
      next = current
      rects.forEach((r, i) => { if (r.top <= vh * DOWN_LINE) next = Math.max(next, i) })
    } else {
      const i = rects.findIndex(r => r.bottom >= vh * UP_LINE)
      next = Math.min(current, i === -1 ? current : i)
    }
    if (next !== current) enterStep(next)

    // the pouring step is scroll-scrubbed, with a little slack at each end.
    // It snaps to 1/40 notches (2.5%), so each notch releases one residual,
    // and each notch animates in quickly rather than tracking every pixel.
    if (STEPS[current] === "qqFill") {
      const r = rects[current]
      const progress = (vh * DOWN_LINE - r.top) / r.height
      const raw = Math.max(0, Math.min(1, (progress - 0.1) / 0.75))
      const notch = Math.round(raw * n) / n
      if (notch !== fillTarget) tweenFill(notch, 0, REDUCED ? 0 : 280, d3.easeCubicOut)
    }

    // reading progress bar
    const max = document.documentElement.scrollHeight - vh
    bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`
  }

  let ticking = false
  const requestScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => { ticking = false; onScroll() })
  }
  window.addEventListener("scroll", requestScroll, { passive: true })
  window.addEventListener("resize", requestScroll)

  steps.classed("is-active", (d, i) => i === 0)
  figure.classed("show-intro", true)
  figLabel.text(stepEls[0].dataset.label)
  canvas.attr("aria-label", stepEls[0].dataset.alt)
  onScroll() // in case the page loads part-way down

  // math typesetting (katex is deferred, so wait for it)
  document.addEventListener("DOMContentLoaded", () => {
    if (!window.katex) return
    document.querySelectorAll(".tex").forEach(el => {
      katex.render(el.dataset.tex, el, { throwOnError: false, displayMode: el.tagName === "P" })
    })
  })
})()
