export interface CoverWallpaperPreset {
  id: string
  label: string
  value: string
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`
}

export const COVER_WALLPAPERS: CoverWallpaperPreset[] = [
  {
    id: 'sonoma-horizon',
    label: 'Sonoma Horizon',
    value: svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fde68a"/>
            <stop offset="45%" stop-color="#fda4af"/>
            <stop offset="100%" stop-color="#818cf8"/>
          </linearGradient>
          <linearGradient id="h1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#6366f1" stop-opacity="0.55"/>
            <stop offset="100%" stop-color="#312e81" stop-opacity="0.92"/>
          </linearGradient>
          <linearGradient id="h2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f472b6" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#4c1d95" stop-opacity="0.8"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="400" fill="url(#bg)"/>
        <circle cx="880" cy="115" r="90" fill="#fffbeb" fill-opacity="0.55"/>
        <path d="M0,255 C220,175 420,305 680,220 C910,145 1070,225 1200,190 L1200,400 L0,400 Z" fill="url(#h2)"/>
        <path d="M0,305 C260,235 480,340 760,265 C960,210 1090,265 1200,245 L1200,400 L0,400 Z" fill="url(#h1)"/>
      </svg>
    `)
  },
  {
    id: 'silk-ribbon',
    label: 'Silk Ribbon',
    value: svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#e0e7ff"/>
            <stop offset="50%" stop-color="#c7d2fe"/>
            <stop offset="100%" stop-color="#a5b4fc"/>
          </linearGradient>
          <linearGradient id="w1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.85"/>
            <stop offset="50%" stop-color="#8b5cf6" stop-opacity="0.72"/>
            <stop offset="100%" stop-color="#ec4899" stop-opacity="0.65"/>
          </linearGradient>
          <linearGradient id="w2" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.75"/>
            <stop offset="100%" stop-color="#e0f2fe" stop-opacity="0.25"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="400" fill="url(#bg)"/>
        <path d="M-40,290 C180,90 460,360 760,150 C960,10 1100,170 1240,95 L1240,420 L-40,420 Z" fill="url(#w1)"/>
        <path d="M-40,210 C220,340 520,60 820,235 C1010,345 1130,210 1240,260 L1240,420 L-40,420 Z" fill="url(#w2)"/>
      </svg>
    `)
  },
  {
    id: 'glacier-glass',
    label: 'Glacier Glass',
    value: svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f0f9ff"/>
            <stop offset="50%" stop-color="#bae6fd"/>
            <stop offset="100%" stop-color="#38bdf8"/>
          </linearGradient>
          <linearGradient id="c1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0284c7" stop-opacity="0.55"/>
            <stop offset="100%" stop-color="#0369a1" stop-opacity="0.85"/>
          </linearGradient>
          <linearGradient id="c2" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
            <stop offset="100%" stop-color="#e0f2fe" stop-opacity="0.15"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="400" fill="url(#bg)"/>
        <path d="M0,120 Q340,260 660,140 T1200,190 L1200,400 L0,400 Z" fill="url(#c2)"/>
        <path d="M0,260 Q320,170 680,295 T1200,220 L1200,400 L0,400 Z" fill="url(#c1)"/>
      </svg>
    `)
  },
  {
    id: 'dusk-dunes',
    label: 'Dusk Dunes',
    value: svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fef3c7"/>
            <stop offset="55%" stop-color="#fdba74"/>
            <stop offset="100%" stop-color="#fb7185"/>
          </linearGradient>
          <linearGradient id="d1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ea580c" stop-opacity="0.62"/>
            <stop offset="100%" stop-color="#9a3412" stop-opacity="0.9"/>
          </linearGradient>
          <linearGradient id="d2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f97316" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="#be123c" stop-opacity="0.75"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="400" fill="url(#bg)"/>
        <circle cx="290" cy="110" r="68" fill="#fff7ed" fill-opacity="0.78"/>
        <path d="M0,240 C260,165 540,290 840,210 C1020,162 1120,205 1200,185 L1200,400 L0,400 Z" fill="url(#d2)"/>
        <path d="M0,310 C310,235 610,350 920,275 C1060,242 1140,272 1200,260 L1200,400 L0,400 Z" fill="url(#d1)"/>
      </svg>
    `)
  },
  {
    id: 'emerald-mist',
    label: 'Emerald Mist',
    value: svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ecfdf5"/>
            <stop offset="50%" stop-color="#a7f3d0"/>
            <stop offset="100%" stop-color="#2dd4bf"/>
          </linearGradient>
          <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0d9488" stop-opacity="0.55"/>
            <stop offset="100%" stop-color="#115e59" stop-opacity="0.9"/>
          </linearGradient>
          <linearGradient id="m2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="#065f46" stop-opacity="0.75"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="400" fill="url(#bg)"/>
        <path d="M0,220 C240,150 480,280 760,195 C980,130 1100,190 1200,165 L1200,400 L0,400 Z" fill="url(#m2)"/>
        <path d="M0,295 C280,235 560,340 860,260 C1040,212 1130,260 1200,245 L1200,400 L0,400 Z" fill="url(#m1)"/>
      </svg>
    `)
  },
  {
    id: 'violet-silk',
    label: 'Violet Silk',
    value: svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#2e1065"/>
            <stop offset="52%" stop-color="#6d28d9"/>
            <stop offset="100%" stop-color="#c084fc"/>
          </linearGradient>
          <linearGradient id="s1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f5d0fe" stop-opacity="0.52"/>
            <stop offset="100%" stop-color="#a855f7" stop-opacity="0.1"/>
          </linearGradient>
          <linearGradient id="s2" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ddd6fe" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#4c1d95" stop-opacity="0.65"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="400" fill="url(#bg)"/>
        <path d="M0,95 C290,260 560,30 890,195 C1030,265 1130,210 1200,185 L1200,400 L0,400 Z" fill="url(#s1)"/>
        <path d="M0,265 C280,145 590,335 910,215 C1060,160 1140,220 1200,205 L1200,400 L0,400 Z" fill="url(#s2)"/>
      </svg>
    `)
  },
  {
    id: 'coastal-dawn',
    label: 'Coastal Dawn',
    value: svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="0.8">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="48%" stop-color="#1d4ed8"/>
            <stop offset="100%" stop-color="#38bdf8"/>
          </linearGradient>
          <linearGradient id="o1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="#e0f2fe" stop-opacity="0.72"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="400" fill="url(#bg)"/>
        <path d="M0,250 C250,175 490,310 780,200 C980,125 1110,190 1200,155 L1200,400 L0,400 Z" fill="url(#o1)"/>
        <path d="M0,320 C310,255 620,360 940,280 C1070,248 1145,280 1200,270 L1200,400 L0,400 Z" fill="#0c4a6e" fill-opacity="0.58"/>
      </svg>
    `)
  },
  {
    id: 'rose-quartz',
    label: 'Rose Quartz',
    value: svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fff1f2"/>
            <stop offset="50%" stop-color="#fecdd3"/>
            <stop offset="100%" stop-color="#f9a8d4"/>
          </linearGradient>
          <linearGradient id="r1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fb7185" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#db2777" stop-opacity="0.65"/>
          </linearGradient>
          <linearGradient id="r2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.82"/>
            <stop offset="100%" stop-color="#ffe4e6" stop-opacity="0.25"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="400" fill="url(#bg)"/>
        <path d="M0,180 C260,80 540,295 860,165 C1030,96 1130,165 1200,145 L1200,400 L0,400 Z" fill="url(#r2)"/>
        <path d="M0,275 C320,195 620,340 940,240 C1075,198 1145,245 1200,235 L1200,400 L0,400 Z" fill="url(#r1)"/>
      </svg>
    `)
  },
  {
    id: 'alpine-night',
    label: 'Alpine Night',
    value: svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0b1120"/>
            <stop offset="55%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#334155"/>
          </linearGradient>
          <radialGradient id="moon" cx="76%" cy="28%" r="32%">
            <stop offset="0%" stop-color="#e0f2fe" stop-opacity="0.72"/>
            <stop offset="40%" stop-color="#7dd3fc" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="#0b1120" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="1200" height="400" fill="url(#bg)"/>
        <rect width="1200" height="400" fill="url(#moon)"/>
        <polygon points="0,310 190,190 360,265 560,160 770,255 980,175 1200,250 1200,400 0,400" fill="#1e293b" fill-opacity="0.82"/>
        <polygon points="0,350 240,240 460,315 690,220 920,305 1200,230 1200,400 0,400" fill="#0f172a"/>
      </svg>
    `)
  },
  {
    id: 'amber-glass',
    label: 'Amber Glass',
    value: svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fffbeb"/>
            <stop offset="48%" stop-color="#fde68a"/>
            <stop offset="100%" stop-color="#f59e0b"/>
          </linearGradient>
          <linearGradient id="a1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fb923c" stop-opacity="0.58"/>
            <stop offset="100%" stop-color="#b45309" stop-opacity="0.82"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="400" fill="url(#bg)"/>
        <path d="M0,155 C280,275 560,65 880,210 C1030,278 1135,215 1200,190 L1200,400 L0,400 Z" fill="#ffffff" fill-opacity="0.45"/>
        <path d="M0,285 C300,200 620,345 940,250 C1070,212 1145,255 1200,240 L1200,400 L0,400 Z" fill="url(#a1)"/>
      </svg>
    `)
  },
  {
    id: 'monochrome-wave',
    label: 'Monochrome Wave',
    value: svgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#f8fafc"/>
            <stop offset="52%" stop-color="#e2e8f0"/>
            <stop offset="100%" stop-color="#94a3b8"/>
          </linearGradient>
          <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#64748b" stop-opacity="0.45"/>
            <stop offset="100%" stop-color="#1e293b" stop-opacity="0.82"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="400" fill="url(#bg)"/>
        <path d="M0,210 C250,120 530,295 830,185 C1010,120 1125,180 1200,160 L1200,400 L0,400 Z" fill="#ffffff" fill-opacity="0.62"/>
        <path d="M0,295 C300,220 600,345 910,255 C1060,210 1140,255 1200,240 L1200,400 L0,400 Z" fill="url(#g1)"/>
      </svg>
    `)
  }
]
