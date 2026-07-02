'use client'

/**
 * IvyVine — the living organism at the heart of the Living Vine language.
 *
 * A bioluminescent ivy grown from the user's real cycle data:
 *   • one leaf per kept day (armed / complete / grace), alternating sides up the stem
 *   • a forfeited day is a fallen leaf — a bare, dimmed stub on the stem
 *   • today (pending) is the unfurling bud at the growing tip
 *   • upcoming days are not drawn — the vine only shows what has been lived
 *
 * Pure SVG, sized by its container. The whole plant breathes (vine-breathe
 * keyframes in globals.css); the newest leaf ignites on mount; the bud pulses.
 */

import { useMemo } from 'react'
import type { StakeDayStatus } from '@/lib/api'

export interface VineDay {
  label: string
  status: StakeDayStatus
  isToday: boolean
}

interface IvyVineProps {
  days: VineDay[]
  /** Extra class on the wrapping svg (sizing). */
  className?: string
}

const KEPT: StakeDayStatus[] = ['armed', 'complete', 'grace']

/**
 * The stem is a fixed gentle S-curve; leaf anchor points are precomputed at
 * even intervals along it (bottom → top), alternating left/right. Seven
 * stations cover the longest cycle; shorter cycles simply use the lowest N.
 */
const STATIONS = [
  { x: 150, y: 228, side: -1, size: 1.0 },
  { x: 143, y: 192, side: 1, size: 0.93 },
  { x: 142, y: 152, side: -1, size: 0.86 },
  { x: 146, y: 114, side: 1, size: 0.78 },
  { x: 148, y: 82, side: -1, size: 0.7 },
  { x: 149, y: 56, side: 1, size: 0.62 },
  { x: 149, y: 38, side: -1, size: 0.55 },
] as const

/** Ivy leaf: a pointed teardrop with a midrib, drawn pointing up-and-out. */
function Leaf({
  x, y, side, size, dim, ignite,
}: {
  x: number; y: number; side: 1 | -1; size: number; dim?: boolean; ignite?: boolean
}) {
  const s = side * size
  return (
    <g
      transform={`translate(${x},${y}) rotate(${side * 34})`}
      style={ignite ? { animation: 'leaf-ignite 900ms cubic-bezier(0.22,1,0.36,1) both' } : undefined}
      opacity={dim ? 0.28 : 1}
    >
      <path
        d={`M0 0 C ${-30 * s} ${-6 * size}, ${-46 * s} ${-28 * size}, ${-44 * s} ${-50 * size} C ${-22 * s} ${-46 * size}, ${-4 * s} ${-28 * size}, 0 0 Z`}
        fill={dim ? 'none' : 'url(#vineLeaf)'}
        stroke={dim ? 'rgba(107,157,148,0.5)' : '#46f0c8'}
        strokeWidth={1.4}
        strokeDasharray={dim ? '3 4' : undefined}
      />
      {!dim && (
        <path
          d={`M0 0 C ${-16 * s} ${-14 * size}, ${-30 * s} ${-30 * size}, ${-40 * s} ${-46 * size}`}
          fill="none"
          stroke="#9ffbe4"
          strokeWidth={1}
          opacity={0.8}
        />
      )}
    </g>
  )
}

export function IvyVine({ days, className }: IvyVineProps) {
  const drawn = useMemo(() => {
    // Only past + today stations exist on the plant.
    const lived = days.filter((d) => d.status !== 'upcoming' || d.isToday)
    return lived.slice(0, STATIONS.length).map((d, i) => ({ ...d, station: STATIONS[i] }))
  }, [days])

  const keptCount = drawn.filter((d) => KEPT.includes(d.status)).length
  const newestKeptIdx = (() => {
    for (let i = drawn.length - 1; i >= 0; i--) {
      if (KEPT.includes(drawn[i].status)) return i
    }
    return -1
  })()

  // Growing tip sits just above the last drawn station.
  const tipStation = STATIONS[Math.min(drawn.length, STATIONS.length - 1)]
  const today = drawn.find((d) => d.isToday)
  const todayPending = today ? !KEPT.includes(today.status) && today.status !== 'forfeited' : false

  return (
    <svg
      viewBox="0 0 300 285"
      className={className}
      style={{ animation: 'vine-breathe 6s ease-in-out infinite', transformOrigin: '50% 90%' }}
      role="img"
      aria-label={`Your ivy has ${keptCount} ${keptCount === 1 ? 'leaf' : 'leaves'}`}
    >
      <defs>
        <linearGradient id="vineStem" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#0d4a3e" />
          <stop offset="55%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#46f0c8" />
        </linearGradient>
        <radialGradient id="vineLeaf" cx="30%" cy="30%">
          <stop offset="0%" stopColor="#9ffbe4" stopOpacity="0.9" />
          <stop offset="55%" stopColor="#46f0c8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#0d4a3e" stopOpacity="0.25" />
        </radialGradient>
        <radialGradient id="vineSoil" cx="50%" cy="0%">
          <stop offset="0%" stopColor="#46f0c8" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#46f0c8" stopOpacity="0" />
        </radialGradient>
        <filter id="vineGlow">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ground light */}
      <ellipse cx="150" cy="262" rx="98" ry="16" fill="url(#vineSoil)" />
      <path d="M 92 262 Q 150 248 208 262" fill="none" stroke="#46f0c8" strokeWidth="1" opacity="0.35" />

      <g filter="url(#vineGlow)">
        {/* stem: grows to just past the last lived station */}
        <path
          d={`M 150 262 C 158 220, 132 190, 142 150 C 150 118, 138 92, ${tipStation.x} ${Math.max(tipStation.y - 22, 28)}`}
          fill="none"
          stroke="url(#vineStem)"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* one station per lived day */}
        {drawn.map((d, i) => {
          const { x, y, side, size } = d.station
          if (KEPT.includes(d.status)) {
            return (
              <Leaf key={d.label + i} x={x} y={y} side={side as 1 | -1} size={size} ignite={i === newestKeptIdx} />
            )
          }
          if (d.status === 'forfeited') {
            // fallen leaf: bare dimmed outline drooping off the stem
            return (
              <Leaf key={d.label + i} x={x} y={y} side={side as 1 | -1} size={size * 0.8} dim />
            )
          }
          // today, still pending → drawn as the bud below
          return null
        })}

        {/* growing tip + tomorrow's (or tonight's) bud */}
        <path
          d={`M ${tipStation.x} ${Math.max(tipStation.y - 22, 28)} C ${tipStation.x + 2} ${Math.max(tipStation.y - 34, 20)}, ${tipStation.x - 2} ${Math.max(tipStation.y - 42, 14)}, ${tipStation.x + 2} ${Math.max(tipStation.y - 52, 10)}`}
          fill="none"
          stroke="#46f0c8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="1 6"
          opacity="0.9"
        />
        <g
          transform={`translate(${tipStation.x + 2},${Math.max(tipStation.y - 52, 10)}) rotate(-18)`}
          style={{ animation: todayPending ? 'bud-pulse 2.4s ease-in-out infinite' : undefined }}
          opacity="0.75"
        >
          <path
            d="M0 0 C -13 -3, -20 -12, -19 -23 C -9 -21, -2 -12, 0 0 Z"
            fill="none"
            stroke="#46f0c8"
            strokeWidth="1.2"
            strokeDasharray="3 3"
          />
        </g>
        <circle cx={tipStation.x + 2} cy={Math.max(tipStation.y - 52, 10)} r="2.6" fill="#d7f7ef" />
      </g>
    </svg>
  )
}

export default IvyVine
