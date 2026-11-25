import { useEffect, useMemo, useRef, useState } from 'react'

// ── Simulated market data ──────────────────────────────────────────────
// Reference prices are plausible EGP levels for well-known EGX names.
// The feed itself is a client-side random-walk simulation for demo purposes.

const SEED = [
  { sym: 'COMI', name: 'Commercial International Bank', ref: 78.4, vol: 4_210_000 },
  { sym: 'ETEL', name: 'Telecom Egypt', ref: 41.15, vol: 1_870_000 },
  { sym: 'SWDY', name: 'Elsewedy Electric', ref: 62.3, vol: 1_240_000 },
  { sym: 'HRHO', name: 'EFG Hermes Holding', ref: 18.62, vol: 6_530_000 },
  { sym: 'TMGH', name: 'Talaat Moustafa Group', ref: 60.75, vol: 3_980_000 },
  { sym: 'ABUK', name: 'Abu Qir Fertilizers', ref: 58.9, vol: 910_000 },
  { sym: 'MFPC', name: 'Misr Fertilizers (MOPCO)', ref: 96.2, vol: 640_000 },
  { sym: 'ESRS', name: 'Ezz Steel', ref: 77.85, vol: 1_120_000 },
  { sym: 'FWRY', name: 'Fawry', ref: 9.84, vol: 8_760_000 },
  { sym: 'ORAS', name: 'Orascom Construction', ref: 281.5, vol: 210_000 },
  { sym: 'CLHO', name: 'Cleopatra Hospital', ref: 8.92, vol: 2_340_000 },
  { sym: 'AMOC', name: 'Alexandria Mineral Oils', ref: 12.46, vol: 3_150_000 },
  { sym: 'ISPH', name: 'Ibnsina Pharma', ref: 3.18, vol: 5_480_000 },
  { sym: 'JUFO', name: 'Juhayna Food Industries', ref: 21.37, vol: 1_690_000 },
]

const HISTORY_LEN = 80
const TICK_MS = 1200
const WATCH_KEY = 'egx-watch:watchlist'

function seedHistory(ref) {
  // Random-walk backwards from the reference price so the chart opens with shape.
  const pts = [ref]
  let p = ref
  for (let i = 0; i < HISTORY_LEN - 1; i++) {
    p = p * (1 + (Math.random() - 0.5) * 0.004)
    pts.unshift(p)
  }
  return pts
}

function initMarket() {
  const rows = {}
  for (const s of SEED) {
    const hist = seedHistory(s.ref)
    const open = hist[0]
    rows[s.sym] = {
      ...s,
      open,
      prevClose: open * (1 + (Math.random() - 0.5) * 0.01),
      last: s.ref,
      high: Math.max(...hist),
      low: Math.min(...hist),
      hist,
      dir: 0,
      tick: 0,
    }
  }
  return rows
}

function tickMarket(market, tick) {
  const next = {}
  for (const sym of Object.keys(market)) {
    const r = market[sym]
    // Mean-reverting random walk so prices stay near their reference level.
    const drift = (r.ref - r.last) / r.ref * 0.02
    const shock = (Math.random() - 0.5) * 0.006
    const last = Math.max(0.01, r.last * (1 + drift + shock))
    next[sym] = {
      ...r,
      last,
      high: Math.max(r.high, last),
      low: Math.min(r.low, last),
      hist: [...r.hist.slice(-(HISTORY_LEN - 1)), last],
      vol: r.vol + Math.round(Math.random() * 40_000),
      dir: last > r.last ? 1 : last < r.last ? -1 : 0,
      tick,
    }
  }
  return next
}

const chg = (r) => (r.last - r.prevClose) / r.prevClose

// ── Market session (Cairo time, Sun-Thu 10:00-14:30) ───────────────────

function cairoNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }))
}

function marketOpen() {
  const d = cairoNow()
  const day = d.getDay() // 5 = Fri, 6 = Sat
  const mins = d.getHours() * 60 + d.getMinutes()
  return day !== 5 && day !== 6 && mins >= 600 && mins < 870
}

// ── Small components ───────────────────────────────────────────────────

function Spark({ points, up, width = 88, height = 26 }) {
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const step = width / (points.length - 1)
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - 3 - ((p - min) / span) * (height - 6)).toFixed(1)}`)
    .join(' ')
  const color = up ? 'var(--color-up)' : 'var(--color-down)'
  return (
    <svg width={width} height={height} className="block" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function BigChart({ points, up }) {
  const width = 560
  const height = 190
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const step = width / (points.length - 1)
  const y = (p) => height - 8 - ((p - min) / span) * (height - 16)
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  const color = up ? 'var(--color-up)' : 'var(--color-down)'
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44" aria-hidden="true">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={width} y1={height * f} y2={height * f} stroke="var(--color-line)" strokeDasharray="3 5" strokeWidth="0.6" />
      ))}
      <path d={area} fill="url(#chartFill)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={y(points[points.length - 1])} r="3.5" fill={color} className="pulse-dot" />
    </svg>
  )
}

function fmt(n, dp = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

function fmtVol(v) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'K'
  return String(v)
}

// ── App ────────────────────────────────────────────────────────────────

export default function App() {
  const [market, setMarket] = useState(initMarket)
  const [tick, setTick] = useState(0)
  const [selected, setSelected] = useState('COMI')
  const [sortKey, setSortKey] = useState('chg')
  const [sortDir, setSortDir] = useState(-1)
  const [open, setOpen] = useState(marketOpen)
  const [watch, setWatch] = useState(() => {
    try {
      const raw = localStorage.getItem(WATCH_KEY)
      return raw ? JSON.parse(raw) : ['COMI', 'FWRY', 'TMGH']
    } catch {
      return ['COMI', 'FWRY', 'TMGH']
    }
  })

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => {
        setMarket((m) => tickMarket(m, t + 1))
        return t + 1
      })
      setOpen(marketOpen())
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    localStorage.setItem(WATCH_KEY, JSON.stringify(watch))
  }, [watch])

  const rows = useMemo(() => {
    const list = Object.values(market)
    const key = { sym: (r) => r.sym, last: (r) => r.last, chg: chg, vol: (r) => r.vol }[sortKey]
    return list.sort((a, b) => {
      const d = key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0
      return d * sortDir
    })
  }, [market, sortKey, sortDir])

  const breadth = useMemo(() => {
    let up = 0, down = 0, flat = 0
    for (const r of Object.values(market)) {
      const c = chg(r)
      if (c > 0.0005) up++
      else if (c < -0.0005) down++
      else flat++
    }
    return { up, down, flat }
  }, [market])

  const egx30 = useMemo(() => {
    // Synthetic index: normalized average of the board, scaled to a plausible EGX30 level.
    const avg = Object.values(market).reduce((s, r) => s + r.last / r.prevClose, 0) / SEED.length
    return { value: 30_750 * avg, chg: avg - 1 }
  }, [market])

  const sel = market[selected]
  const selUp = chg(sel) >= 0

  function toggleWatch(sym) {
    setWatch((w) => (w.includes(sym) ? w.filter((s) => s !== sym) : [...w, sym]))
  }

  function headerSort(key) {
    if (sortKey === key) setSortDir((d) => -d)
    else {
      setSortKey(key)
      setSortDir(key === 'sym' ? 1 : -1)
    }
  }

  const now = cairoNow()
  const clock = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="min-h-screen bg-terminal text-ink">
      {/* Ticker tape header */}
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-amber-glow font-mono text-sm font-bold text-terminal">⌁</span>
            <h1 className="text-lg font-bold tracking-tight">EGX Watch</h1>
          </div>
          <div className="num text-sm">
            <span className="mr-2 text-ink-dim">EGX30</span>
            <span className="font-semibold">{fmt(egx30.value, 0)}</span>
            <span className={`ml-2 ${egx30.chg >= 0 ? 'text-up' : 'text-down'}`}>
              {egx30.chg >= 0 ? '▲' : '▼'} {fmt(Math.abs(egx30.chg) * 100)}%
            </span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${open ? 'border-up/40 text-up' : 'border-line text-ink-dim'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-up pulse-dot' : 'bg-ink-dim'}`} />
              {open ? 'MARKET OPEN' : 'MARKET CLOSED'}
            </span>
            <span className="num text-xs text-ink-dim">{clock} CAI</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4">
        {/* Breadth + movers strip */}
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-line bg-panel p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-dim">Market breadth</div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-panel-2">
              <div className="bg-up transition-all duration-500" style={{ width: `${(breadth.up / SEED.length) * 100}%` }} />
              <div className="bg-line transition-all duration-500" style={{ width: `${(breadth.flat / SEED.length) * 100}%` }} />
              <div className="bg-down transition-all duration-500" style={{ width: `${(breadth.down / SEED.length) * 100}%` }} />
            </div>
            <div className="num mt-2 flex justify-between text-xs">
              <span className="text-up">{breadth.up} advancing</span>
              <span className="text-ink-dim">{breadth.flat} flat</span>
              <span className="text-down">{breadth.down} declining</span>
            </div>
          </div>
          <Movers title="Top gainers" rows={rows} pick={(r) => chg(r) > 0} sort={(a, b) => chg(b) - chg(a)} tone="up" />
          <Movers title="Top losers" rows={rows} pick={(r) => chg(r) < 0} sort={(a, b) => chg(a) - chg(b)} tone="down" />
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          {/* Market table */}
          <section className="overflow-hidden rounded-lg border border-line bg-panel lg:col-span-3">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <h2 className="text-sm font-semibold">Market board</h2>
              <span className="text-xs text-ink-dim">simulated live feed · ticks every {TICK_MS / 1000}s</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-dim">
                  <Th label="Symbol" k="sym" sortKey={sortKey} sortDir={sortDir} onSort={headerSort} />
                  <Th label="Last" k="last" sortKey={sortKey} sortDir={sortDir} onSort={headerSort} right />
                  <Th label="Chg%" k="chg" sortKey={sortKey} sortDir={sortDir} onSort={headerSort} right />
                  <th className="px-3 py-2 text-right font-medium">Trend</th>
                  <Th label="Volume" k="vol" sortKey={sortKey} sortDir={sortDir} onSort={headerSort} right />
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const c = chg(r)
                  const up = c >= 0
                  const flash = r.dir > 0 ? 'flash-up' : r.dir < 0 ? 'flash-down' : ''
                  return (
                    <tr
                      key={r.sym + '-' + r.tick}
                      onClick={() => setSelected(r.sym)}
                      className={`cursor-pointer border-b border-line/60 transition-colors hover:bg-panel-2 ${selected === r.sym ? 'bg-panel-2' : ''} ${flash}`}
                    >
                      <td className="px-3 py-2">
                        <div className="num font-semibold">{r.sym}</div>
                        <div className="max-w-40 truncate text-xs text-ink-dim">{r.name}</div>
                      </td>
                      <td className="num px-3 py-2 text-right font-medium">{fmt(r.last)}</td>
                      <td className={`num px-3 py-2 text-right font-semibold ${up ? 'text-up' : 'text-down'}`}>
                        {up ? '+' : ''}{fmt(c * 100)}%
                      </td>
                      <td className="px-3 py-2"><div className="flex justify-end"><Spark points={r.hist.slice(-30)} up={up} /></div></td>
                      <td className="num px-3 py-2 text-right text-ink-dim">{fmtVol(r.vol)}</td>
                      <td className="pr-2 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleWatch(r.sym) }}
                          aria-label={watch.includes(r.sym) ? `Remove ${r.sym} from watchlist` : `Add ${r.sym} to watchlist`}
                          className={`text-base leading-none transition-transform hover:scale-125 ${watch.includes(r.sym) ? 'text-amber-glow' : 'text-line hover:text-ink-dim'}`}
                        >
                          {watch.includes(r.sym) ? '★' : '☆'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          {/* Detail + watchlist */}
          <aside className="space-y-4 lg:col-span-2">
            <section className="rounded-lg border border-line bg-panel p-4">
              <div className="mb-1 flex items-start justify-between">
                <div>
                  <div className="num text-lg font-bold">{sel.sym}</div>
                  <div className="text-xs text-ink-dim">{sel.name}</div>
                </div>
                <div className="text-right">
                  <div className="num text-2xl font-bold">{fmt(sel.last)}</div>
                  <div className={`num text-sm font-semibold ${selUp ? 'text-up' : 'text-down'}`}>
                    {selUp ? '▲' : '▼'} {fmt(Math.abs(chg(sel)) * 100)}% today
                  </div>
                </div>
              </div>
              <BigChart points={sel.hist} up={selUp} />
              <div className="num mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                <Stat label="Open" value={fmt(sel.open)} />
                <Stat label="High" value={fmt(sel.high)} tone="up" />
                <Stat label="Low" value={fmt(sel.low)} tone="down" />
                <Stat label="Prev close" value={fmt(sel.prevClose)} />
              </div>
            </section>

            <section className="rounded-lg border border-line bg-panel">
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <h2 className="text-sm font-semibold">Watchlist</h2>
                <span className="text-xs text-ink-dim">saved in your browser · star any row</span>
              </div>
              {watch.length === 0 ? (
                <p className="px-3 py-4 text-sm text-ink-dim">Nothing starred yet. Hit ☆ on any ticker to track it here.</p>
              ) : (
                <ul>
                  {watch.map((sym) => {
                    const r = market[sym]
                    if (!r) return null
                    const c = chg(r)
                    const up = c >= 0
                    return (
                      <li key={sym}>
                        <button
                          onClick={() => setSelected(sym)}
                          className={`flex w-full items-center gap-3 border-b border-line/60 px-3 py-2 text-left transition-colors hover:bg-panel-2 ${selected === sym ? 'bg-panel-2' : ''}`}
                        >
                          <span className="num w-14 font-semibold">{sym}</span>
                          <Spark points={r.hist.slice(-30)} up={up} width={70} height={22} />
                          <span className="num ml-auto text-sm">{fmt(r.last)}</span>
                          <span className={`num w-16 text-right text-sm font-semibold ${up ? 'text-up' : 'text-down'}`}>
                            {up ? '+' : ''}{fmt(c * 100)}%
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <p className="px-1 text-xs leading-relaxed text-ink-dim">
              Educational demo. Prices are a client-side simulation seeded with real EGX tickers,
              not investment advice and not connected to a live market data feed.
            </p>
          </aside>
        </div>
      </main>

      <footer className="border-t border-line px-4 py-3 text-center text-xs text-ink-dim">
        Built by Malak Mohamed · React, Tailwind CSS · <a className="underline hover:text-ink" href="https://github.com/malakmo7amed309/egx-watch">Source on GitHub</a>
      </footer>
    </div>
  )
}

function Th({ label, k, sortKey, sortDir, onSort, right }) {
  const active = sortKey === k
  return (
    <th className={`px-3 py-2 font-medium ${right ? 'text-right' : ''}`}>
      <button onClick={() => onSort(k)} className={`uppercase tracking-wider hover:text-ink ${active ? 'text-amber-glow' : ''}`}>
        {label} {active ? (sortDir > 0 ? '↑' : '↓') : ''}
      </button>
    </th>
  )
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded border border-line bg-panel-2 px-1 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-ink-dim">{label}</div>
      <div className={tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : ''}>{value}</div>
    </div>
  )
}

function Movers({ title, rows, pick, sort, tone }) {
  const list = rows.filter(pick).sort(sort).slice(0, 3)
  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-dim">{title}</div>
      {list.length === 0 ? (
        <div className="text-sm text-ink-dim">None right now</div>
      ) : (
        <ul className="space-y-1.5">
          {list.map((r) => (
            <li key={r.sym} className="num flex items-baseline justify-between text-sm">
              <span className="font-semibold">{r.sym}</span>
              <span className={tone === 'up' ? 'text-up' : 'text-down'}>
                {chg(r) > 0 ? '+' : ''}{fmt(chg(r) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
