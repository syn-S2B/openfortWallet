import { useId } from 'react'

/** Decorative metalwork; the connection glyph is not a Bluetooth control. */
export default function WalletCardArtwork() {
  const id = useId()
  const bronze = `${id}-bronze`
  const edge = `${id}-edge`
  const relief = `${id}-relief`
  return <svg className="onli-card-artwork" viewBox="0 0 436 275" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={bronze} x1="194" y1="64" x2="383" y2="283" gradientUnits="userSpaceOnUse">
        <stop stopColor="#58442f" /><stop offset=".22" stopColor="#ab9171" /><stop offset=".46" stopColor="#f4e6d0" /><stop offset=".57" stopColor="#d4b791" /><stop offset=".8" stopColor="#80684e" /><stop offset="1" stopColor="#c4a681" />
      </linearGradient>
      <linearGradient id={edge} x1="167" y1="305" x2="406" y2="51" gradientUnits="userSpaceOnUse">
        <stop stopColor="#e6d0af" /><stop offset=".3" stopColor="#755637" /><stop offset=".55" stopColor="#c6a782" /><stop offset="1" stopColor="#5c432b" />
      </linearGradient>
      <filter id={relief} x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="-.6" dy="-.8" stdDeviation=".45" floodColor="#44311e" floodOpacity=".65" />
        <feDropShadow dx=".7" dy="1.4" stdDeviation=".65" floodColor="#fff7e9" floodOpacity=".95" />
      </filter>
    </defs>
    <g transform="translate(76 -1) scale(.76)" filter={`url(#${relief})`}>
      <circle cx="285" cy="174" r="103" stroke={`url(#${bronze})`} strokeWidth="23" />
      <circle cx="285" cy="174" r="115" stroke="#765f46" strokeOpacity=".5" strokeWidth=".7" />
      <circle cx="285" cy="174" r="91" stroke="#fff5e4" strokeOpacity=".8" strokeWidth=".8" />
      <path d="M161 311 401 37 187 291Z" fill={`url(#${edge})`} stroke="#82694e" strokeWidth=".7" strokeLinejoin="round" />
      <path d="M161 311 401 37" stroke="#fff3df" strokeOpacity=".8" strokeWidth=".8" />
    </g>
    <path d="m55 110 27 28-16 17V94l16 16-27 29" stroke="#836b4c" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${relief})`} />
    <circle cx="98" cy="124" r="3" fill="#fff7e5" stroke="#d6b888" strokeWidth=".5" />
  </svg>
}
