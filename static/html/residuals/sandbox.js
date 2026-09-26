// "Break the model": drag penguins or load a problem dataset, and watch the
// line re-fit and the three diagnostic plots respond.

;(function sandbox() {
  const lin = x => model.predict(x)
  const base = data
    .map(d => ({ x: d.predictor, obs: d.observed, e0: d.residual, z0: d.residual_z }))
    .sort((a, b) => a.x - b.x)
  const heaviest = base.length - 1
  const t = x => (x - 4250) / 1300 // roughly -1..1 across the mass range

  // each preset is built from the real penguins' own noise (e0, z0), so it stays reproducible
  const PRESETS = {
    original: {
      y: p => p.obs,
      note: "These are the real penguins. The residuals-vs-fitted plot is a flat, shapeless cloud and the Q–Q dots stay close to the line. Nothing to worry about."
    },
    curved: {
      y: p => 44 + 7 * t(p.x) - 6.5 * t(p.x) ** 2 + 0.5 * p.e0,
      note: "<strong>Nonlinearity.</strong> The true relationship bends, but we're still fitting a straight line. The residuals-vs-fitted plot shows an arch: the line predicts too high at both ends and too low in the middle. Try adding a curved (squared) term or transforming a variable."
    },
    funnel: {
      y: p => lin(p.x) + p.e0 * (0.1 + 1.2 * (t(p.x) + 1)),
      note: "<strong>Non-constant variance (heteroscedasticity).</strong> Big penguins are harder to predict than small ones, so the residuals fan out as the fitted values grow. The line itself is fine, but the standard errors and p-values aren't. Try transforming the outcome or using robust standard errors."
    },
    skewed: {
      y: p => lin(p.x) + 2 * (Math.exp(p.z0) - 1.65),
      note: "<strong>Skewed errors.</strong> Most penguins sit a little below the line, and a few sit far above it. The histogram leans to one side and the Q–Q plot curves up at the right end. A log transform often helps."
    },
    outlier: {
      y: (p, i) => (i === heaviest ? 33 : p.obs),
      note: "<strong>An influential outlier.</strong> One very heavy penguin with a short bill. Because it's far from the others on the x-axis (high <em>leverage</em>), it pulls the whole line toward itself. It stands out in every diagnostic plot. Look into it before you trust the model."
    }
  }
  const DRAG_NOTE = "You're in control now. Pull a penguin at the far right, then one in the middle. The edges have more <em>leverage</em>, so they move the line much more."

  const pts = base.map(p => ({ ...p, y: p.obs }))
  const n = pts.length
  const YDOM = [26, 62]
  const clampY = v => Math.max(YDOM[0], Math.min(YDOM[1], v))

  function fit() {
    const mx = d3.mean(pts, p => p.x), my = d3.mean(pts, p => p.y)
    let sxy = 0, sxx = 0, syy = 0
    for (const p of pts) {
      sxy += (p.x - mx) * (p.y - my)
      sxx += (p.x - mx) ** 2
      syy += (p.y - my) ** 2
    }
    const slope = sxy / sxx
    const intercept = my - slope * mx
    let sse = 0
    for (const p of pts) {
      p.f = intercept + slope * p.x
      p.r = p.y - p.f
      sse += p.r ** 2
    }
    const sd = d3.deviation(pts, p => p.r)
    const ranked = [...pts].sort((a, b) => a.r - b.r)
    ranked.forEach((p, i) => {
      p.z = p.r / sd
      p.q = stats.qnorm((i + 0.5) / n)
      p.rank = i
    })
    return { slope, intercept, r2: 1 - sse / syy }
  }

  // ---------- plot scaffolding ----------

  function panel(sel, W, H, M) {
    const svg = d3.select(sel).attr("viewBox", [0, 0, W, H])
    const g = svg.append("g").attr("transform", `translate(${M.l},${M.t})`)
    return { svg, g, w: W - M.l - M.r, h: H - M.t - M.b }
  }
  function axisTitle(g, text, attrs) {
    const el = g.append("text").attr("class", "axis-title").text(text)
    for (const [k, v] of Object.entries(attrs)) el.attr(k, v)
  }
  const pm = v => (v === 0 ? "0" : d3.format("+")(v))

  // main scatter
  const narrow = window.innerWidth < 700
  const S = panel("#sb-scatter", narrow ? 480 : 900, narrow ? 400 : 360, { t: 12, r: 16, b: 46, l: 56 })
  const sx = d3.scaleLinear().domain([2800, 5700]).range([0, S.w])
  const sy = d3.scaleLinear().domain(YDOM).range([S.h, 0])
  S.g.append("g").attr("class", "axis").attr("transform", `translate(0,${S.h})`)
    .call(d3.axisBottom(sx).ticks(narrow ? 4 : 8).tickFormat(d3.format(",")))
    .call(g => axisTitle(g, "Body mass (g) →", { x: S.w, y: 38, "text-anchor": "end" }))
  S.g.append("g").attr("class", "axis")
    .call(d3.axisLeft(sy).ticks(6))
    .call(g => axisTitle(g, "Bill length (mm) →", { transform: "translate(-42,0) rotate(-90)", "text-anchor": "end" }))
  const sLines = S.g.append("g").selectAll("line").data(pts).join("line").attr("stroke-width", 2)
  const sFit = S.g.append("line").attr("stroke", COLORS.line).attr("stroke-width", 3.5).attr("stroke-linecap", "round")
  const sDots = S.g.append("g").selectAll("circle").data(pts).join("circle")
    .attr("class", "sb-point")
    .attr("r", 6.5)
    .attr("stroke", "#fff").attr("stroke-width", 1.5)
    .style("touch-action", "none")
  // generous invisible hit targets for dragging (fingers included)
  const sHits = S.g.append("g").selectAll("circle").data(pts).join("circle")
    .attr("r", 14)
    .attr("fill", "transparent")
    .style("cursor", "ns-resize")
    .style("touch-action", "none")

  // small multiples
  const SM = { t: 10, r: 10, b: 40, l: 40 }
  const ZLIM = 4

  const Hh = panel("#sb-hist", 320, 300, SM)
  const hx = d3.scaleLinear().domain([-ZLIM, ZLIM]).range([0, Hh.w])
  const hy = d3.scaleLinear().range([Hh.h, 0])
  Hh.g.append("g").attr("class", "axis").attr("transform", `translate(0,${Hh.h})`)
    .call(d3.axisBottom(hx).ticks(5).tickFormat(pm))
    .call(g => axisTitle(g, "Standardized residual", { x: Hh.w / 2, y: 34, "text-anchor": "middle" }))
  const hAxisY = Hh.g.append("g").attr("class", "axis")
  const hBars = Hh.g.append("g")
  const hKde = Hh.g.append("path").attr("fill", "none").attr("stroke", COLORS.ours).attr("stroke-width", 2.5)
  const hCurve = Hh.g.append("path").attr("fill", "none").attr("stroke", COLORS.ink).attr("stroke-width", 2)
  Hh.g.append("text").attr("class", "vase-mini").attr("x", Hh.w).attr("y", 6)
    .style("text-anchor", "end").style("fill", COLORS.ours).text("ours")
  Hh.g.append("text").attr("class", "vase-mini").attr("x", Hh.w).attr("y", 20)
    .style("text-anchor", "end").text("normal")

  // Q–Q with its two vases, like the story: the residuals' dot histogram on
  // the side, the normal curve below, and a Pour button to fill them
  const Q = panel("#sb-qq", 320, 300, { t: 8, r: 8, b: 8, l: 8 })
  const QV = 64 // vase depth
  const QG = 28 // room for tick labels
  const qx = d3.scaleLinear().domain([-3, 3]).range([QV + QG, Q.w])
  const qy = d3.scaleLinear().domain([-ZLIM, ZLIM]).range([Q.h - QV - QG, 0])
  const qB = Q.h - QV // bottom vase rim
  const qL = QV // side vase rim
  const qCell = qy(0) - qy(0.5) // one bin, in pixels
  Q.g.append("g").attr("class", "axis").attr("transform", `translate(0,${qy(-ZLIM)})`)
    .call(d3.axisBottom(qx).ticks(5).tickFormat(pm))
  Q.g.append("g").attr("class", "axis").attr("transform", `translate(${qx(-3)},0)`)
    .call(d3.axisLeft(qy).ticks(5).tickFormat(pm))
  Q.g.append("line")
    .attr("x1", qx(-3)).attr("y1", qy(-3)).attr("x2", qx(3)).attr("y2", qy(3))
    .attr("stroke", COLORS.muted).attr("stroke-width", 1.5).attr("stroke-dasharray", "5 4")

  const qDefs = Q.svg.append("defs")
  const qClipN = qDefs.append("clipPath").attr("id", "sb-clip-n").append("rect")
  const qClipE = qDefs.append("clipPath").attr("id", "sb-clip-e").append("rect")
  const vasePaths = clipId => {
    const g = Q.g.append("g")
    return {
      back: g.append("path").attr("fill", "#efe9df"),
      water: g.append("path").attr("fill", "#789FBC").attr("clip-path", `url(#${clipId})`),
      edge: g.append("path").attr("fill", "none").attr("stroke", COLORS.ink).attr("stroke-width", 1.5)
    }
  }
  const vaseN = vasePaths("sb-clip-n")
  const vaseE = vasePaths("sb-clip-e")
  Q.g.append("text").attr("class", "vase-mini").attr("x", qL / 2).attr("y", qB + 16).text("residuals ↑")
  Q.g.append("text").attr("class", "vase-mini").attr("x", qL / 2).attr("y", qB + 34).text("normal →")

  const qGuides = Q.g.append("g").style("opacity", 0)
  const qTracer = qGuides.append("path").attr("fill", "none").attr("stroke", COLORS.line).attr("stroke-width", 1.5)
  const qGuideN = qGuides.append("line")
  const qGuideE = qGuides.append("line")
  qGuides.selectAll("line").attr("stroke", COLORS.line).attr("stroke-width", 1.2).attr("stroke-dasharray", "3 3")
  const qMarker = qGuides.append("circle").attr("r", 4).attr("fill", COLORS.line)
  const qPourText = qGuides.append("text").attr("class", "vase-mini")
    .attr("x", qx(-3) + 6).attr("y", 10).style("text-anchor", "start")
  const qDots = Q.g.append("g").selectAll("circle").data(pts).join("circle").attr("r", 4)

  const R = panel("#sb-rvf", 320, 300, SM)
  const rx = d3.scaleLinear().domain([30, 56]).range([0, R.w])
  const ryS = d3.scaleLinear().range([R.h, 0])
  R.g.append("g").attr("class", "axis").attr("transform", `translate(0,${R.h})`)
    .call(d3.axisBottom(rx).ticks(5))
    .call(g => axisTitle(g, "Fitted (mm)", { x: R.w / 2, y: 34, "text-anchor": "middle" }))
  const rAxisY = R.g.append("g").attr("class", "axis")
  const rZero = R.g.append("line")
    .attr("x1", 0).attr("x2", R.w)
    .attr("stroke", COLORS.muted).attr("stroke-width", 1.5).attr("stroke-dasharray", "5 4")
  const rDots = R.g.append("g").selectAll("circle").data(pts).join("circle").attr("r", 4)

  // ---------- render ----------

  const statsEl = document.getElementById("sb-stats")
  const noteEl = document.getElementById("sb-note")
  const clampZ = z => Math.max(-ZLIM + 0.01, Math.min(ZLIM - 0.01, z))

  function render(dur) {
    const m = fit()
    if (REDUCED) dur = 0
    const T = sel => (dur ? sel.transition().duration(dur).ease(d3.easeCubicInOut) : sel.interrupt())
    const col = p => signColor(p.r)

    statsEl.textContent = `bill = ${m.intercept.toFixed(1)} + ${m.slope.toFixed(5)} × mass · R² = ${m.r2.toFixed(3)}`

    // scatter
    const [x0, x1] = sx.domain()
    T(sFit)
      .attr("x1", sx(x0)).attr("y1", sy(m.intercept + m.slope * x0))
      .attr("x2", sx(x1)).attr("y2", sy(m.intercept + m.slope * x1))
    T(sLines)
      .attr("x1", p => sx(p.x)).attr("x2", p => sx(p.x))
      .attr("y1", p => sy(p.y)).attr("y2", p => sy(p.f))
      .attr("stroke", col)
    T(sDots).attr("cx", p => sx(p.x)).attr("cy", p => sy(p.y)).attr("fill", col)
    sHits.attr("cx", p => sx(p.x)).attr("cy", p => sy(p.y))

    // histogram (bins of half an SD, like the story) with the normal benchmark
    const bins = d3.bin().domain(hx.domain()).thresholds(d3.range(-ZLIM, ZLIM + 0.01, 0.5))(pts.map(p => clampZ(p.z)))
    hy.domain([0, Math.max(10, d3.max(bins, b => b.length))]).nice()
    T(hAxisY).call(d3.axisLeft(hy).ticks(4))
    T(hBars.selectAll("rect").data(bins).join("rect"))
      .attr("x", b => hx(b.x0) + 1)
      .attr("width", b => Math.max(0, hx(b.x1) - hx(b.x0) - 2))
      .attr("y", b => hy(b.length))
      .attr("height", b => hy(0) - hy(b.length))
      .attr("fill", b => (b.x0 >= 0 ? COLORS.pos : COLORS.neg))
      .attr("opacity", 0.85)
    const curve = d3.range(-ZLIM, ZLIM + 0.01, 0.1).map(z => [hx(z), hy(n * 0.5 * stats.dnorm(z))])
    T(hCurve).attr("d", d3.line().curve(d3.curveBasis)(curve))
    const kde = d3.range(-ZLIM, ZLIM + 0.01, 0.1)
      .map(z => [hx(z), hy(n * 0.5 * d3.mean(pts, p => kernel(z - clampZ(p.z))))])
    T(hKde).attr("d", d3.line().curve(d3.curveBasis)(kde))

    renderQQ(dur)

    // residuals vs fitted
    const rMax = Math.max(6, d3.max(pts, p => Math.abs(p.r)) * 1.15)
    ryS.domain([-rMax, rMax]).nice()
    T(rAxisY).call(d3.axisLeft(ryS).ticks(5).tickFormat(pm))
    T(rZero).attr("y1", ryS(0)).attr("y2", ryS(0))
    T(rDots).attr("cx", p => rx(Math.max(30, Math.min(56, p.f)))).attr("cy", p => ryS(p.r)).attr("fill", col)
  }

  // ---------- Q–Q vases ----------

  let pour = 1 // share of the water poured; 1 = both vases full
  // same Gaussian kernel as the story's residual curve
  const BW = 0.28 // bandwidth, in SDs
  const kernel = u => stats.dnorm(u / BW) / BW
  let vase = null // current vase geometry, rebuilt on every fit

  function buildVases() {
    // stack residuals into half-SD bins, lowest first
    const counts = new Array(2 * ZLIM / 0.5).fill(0)
    const ranked = [...pts].sort((a, b) => a.rank - b.rank)
    for (const p of ranked) {
      p.bin = Math.min(counts.length - 1, Math.floor((clampZ(p.z) + ZLIM) / 0.5))
      p.stack = counts[p.bin]++
    }
    const maxC = d3.max(counts)
    // one dot's width, sized so the pile, the bell curve and the residuals'
    // density all fit their vases
    const kdePeak = d3.max(d3.range(-ZLIM, ZLIM + 0.001, 0.05), z => d3.mean(ranked, p => kernel(z - clampZ(p.z))))
    const dx = Math.min(qCell, QV / Math.max(maxC, 8.2, n * 0.5 * kdePeak))
    const binY = b => qy(-ZLIM + b * 0.5)

    // both vases are smooth densities in dot units, like the histogram panel's curve
    const depthN = z => n * 0.5 * stats.dnorm(z) * dx
    const depthE = z => n * 0.5 * d3.mean(ranked, p => kernel(z - clampZ(p.z))) * dx
    const grid = d3.range(-3, 3.001, 0.05)
    const sideGrid = d3.range(-ZLIM, ZLIM + 0.001, 0.05)
    const zLo = clampZ(ranked[0].z) - 3 * BW, zHi = clampZ(ranked[n - 1].z) + 3 * BW
    const quantPts = [[0, Math.max(-ZLIM, zLo)], ...ranked.map(p => [(p.rank + 0.5) / n, clampZ(p.z)]), [1, Math.min(ZLIM, zHi)]]
    const empQ = q => {
      const i = Math.min(quantPts.length - 1, Math.max(1, d3.bisector(d => d[0]).right(quantPts, q)))
      const [p0, z0] = quantPts[i - 1], [p1, z1] = quantPts[i]
      return z0 + ((q - p0) / (p1 - p0)) * (z1 - z0)
    }
    vase = {
      dx, depthN, depthE, empQ, binY,
      side: d3.area().curve(d3.curveBasis).y(z => qy(z)).x0(qL).x1(z => Math.max(0, qL - depthE(z)))(sideGrid),
      bottom: d3.area().curve(d3.curveBasis).x(z => qx(z)).y0(qB).y1(z => qB + depthN(z))(grid),
      bottomEdge: d3.line().curve(d3.curveBasis)(grid.map(z => [qx(z), qB + depthN(z)]))
    }
  }

  const normQ = q => Math.max(-3, Math.min(3, stats.qnorm(Math.min(1 - 1e-9, Math.max(1e-9, q)))))
  const isOut = p => (p.rank + 0.5) / n <= pour + 1e-9
  const dotAt = p => (isOut(p)
    ? { cx: qx(p.q), cy: qy(clampZ(p.z)), r: 4 }
    : { cx: qL - (p.stack + 0.5) * vase.dx, cy: vase.binY(p.bin + 0.5), r: Math.min(vase.dx, qCell) * 0.46 })

  // dur: transition everything (new fit); fly: only move dots whose side changed (pouring)
  function renderQQ(dur, fly = false) {
    if (!fly) buildVases()
    const T = sel => (dur ? sel.transition().duration(dur).ease(d3.easeCubicInOut) : sel)
    const { side, bottom, bottomEdge, empQ, depthN, depthE } = vase

    T(vaseE.back).attr("d", side)
    T(vaseE.water).attr("d", side)
    T(vaseE.edge).attr("d", side)
    T(vaseN.back).attr("d", bottom)
    T(vaseN.water).attr("d", bottom)
    T(vaseN.edge).attr("d", bottomEdge)

    const ln = normQ(pour), le = empQ(pour)
    const mx = qx(ln), my = qy(le)
    qClipN.attr("x", qx(-3)).attr("y", qB - 1).attr("width", Math.max(0, mx - qx(-3))).attr("height", QV + 2)
    qClipE.attr("x", 0).attr("width", qL + 1).attr("y", my).attr("height", Math.max(0, qy(-ZLIM) - my))

    const pFirst = 0.5 / n, pLast = 1 - 0.5 / n
    qGuides.style("opacity", pour < 1 ? 1 : 0)
    qGuides.selectAll("line, circle").style("opacity", pour >= pFirst && pour <= pLast ? 1 : 0)
    qGuideN.attr("x1", mx).attr("x2", mx).attr("y1", my).attr("y2", qB + depthN(ln))
    qGuideE.attr("x1", mx).attr("x2", Math.max(0, qL - depthE(le))).attr("y1", my).attr("y2", my)
    qMarker.attr("cx", mx).attr("cy", my)
    const ps = pour > pFirst ? [...d3.range(pFirst, Math.min(pour, pLast), 0.004), Math.min(pour, pLast)] : []
    qTracer.attr("d", ps.length > 1 ? d3.line()(ps.map(q => [qx(normQ(q)), qy(empQ(q))])) : null)
    qPourText.text(`${Math.round(pour * 100)}% poured`)

    if (fly) {
      qDots.each(function (p) {
        const out = isOut(p)
        if (out === this.__out) return
        this.__out = out
        const P = dotAt(p)
        d3.select(this).transition().duration(out ? 500 : 350).ease(d3.easeCubicOut)
          .attr("cx", P.cx).attr("cy", P.cy).attr("r", P.r)
      })
    } else {
      qDots.each(function (p) { this.__out = isOut(p) })
      T(qDots.interrupt())
        .attr("cx", p => dotAt(p).cx).attr("cy", p => dotAt(p).cy).attr("r", p => dotAt(p).r)
        .attr("fill", p => signColor(p.r))
    }
  }

  d3.select("#sb-pour").on("click", () => {
    // empty both vases (the dots fly home), then pour
    Q.svg.interrupt("pour")
    pour = 0
    renderQQ(0, true)
    Q.svg.transition("pour").delay(600).duration(5000).ease(d3.easeLinear)
      .tween("pour", () => t => { pour = t; renderQQ(0, true) })
  })

  // ---------- interaction ----------

  const buttons = d3.selectAll(".presets button")

  function loadPreset(name) {
    const preset = PRESETS[name]
    pts.forEach((p, i) => { p.y = clampY(preset.y(p, i)) })
    buttons.classed("active", function () { return this.dataset.preset === name })
    noteEl.innerHTML = preset.note
    render(900)
  }

  buttons.on("click", function () { loadPreset(this.dataset.preset) })

  sHits.call(d3.drag()
    .subject((event, p) => ({ x: sx(p.x), y: sy(p.y) }))
    .on("start", function (event, p) {
      buttons.classed("active", false)
      noteEl.innerHTML = DRAG_NOTE
      sDots.filter(q => q === p).attr("r", 9)
    })
    .on("drag", (event, p) => {
      p.y = clampY(sy.invert(event.y))
      render(0)
    })
    .on("end", (event, p) => {
      sDots.filter(q => q === p).attr("r", 6.5)
    }))

  noteEl.innerHTML = PRESETS.original.note
  render(0)
})()
