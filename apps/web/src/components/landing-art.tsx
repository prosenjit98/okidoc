/* Landing-page artwork: phone frames around real app screenshots, and hand-drawn SVG illustrations. */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** A phone with a real Okidoc screenshot (status bar replaced by a clean one). */
export function PhoneShot({ src, alt, className, tilt = 0, glow = false }: { src: string; alt: string; className?: string; tilt?: number; glow?: boolean }) {
  return (
    <figure className={cx(!className?.includes('absolute') && 'relative', 'w-[250px] shrink-0', className)} style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}>
      {glow && <div className="absolute -inset-8 rounded-full bg-teal-400/25 blur-3xl" />}
      <div className="relative rounded-[40px] bg-gradient-to-b from-slate-700 to-slate-900 p-[9px] shadow-[0_40px_70px_-30px_rgba(2,20,30,0.75)] ring-1 ring-white/10">
        <div className="relative overflow-hidden rounded-[32px] bg-[#0b2a3a]">
          <div className="flex h-7 items-center justify-between px-6 text-[10px] font-semibold text-white/85">
            <span>9:41</span>
            <span className="absolute left-1/2 top-1.5 h-4 w-20 -translate-x-1/2 rounded-full bg-black/80" />
            <span className="flex items-center gap-1">
              <svg viewBox="0 0 16 10" className="h-2.5 w-3.5 fill-white/85" aria-hidden><rect x="0" y="6" width="3" height="4" rx="0.5" /><rect x="4.3" y="4" width="3" height="6" rx="0.5" /><rect x="8.6" y="2" width="3" height="8" rx="0.5" /><rect x="12.9" y="0" width="3" height="10" rx="0.5" /></svg>
              <svg viewBox="0 0 22 10" className="h-2.5 w-5" aria-hidden><rect x="0.5" y="0.5" width="18" height="9" rx="2" fill="none" stroke="rgba(255,255,255,.85)" /><rect x="2" y="2" width="13" height="6" rx="1" fill="rgba(255,255,255,.85)" /><rect x="19.5" y="3" width="1.5" height="4" rx="0.5" fill="rgba(255,255,255,.85)" /></svg>
            </span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} width={540} height={1146} loading="lazy" decoding="async" className="block h-auto w-full" />
        </div>
      </div>
    </figure>
  );
}

/** Animated heartbeat line used across hero and section dividers. */
export function PulseLine({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className={cx('pointer-events-none', className)} aria-hidden>
      <defs>
        <linearGradient id="pl" x1="0" x2="1">
          <stop offset="0" stopColor="#5eead4" stopOpacity="0" />
          <stop offset="0.5" stopColor="#5eead4" stopOpacity="0.7" />
          <stop offset="1" stopColor="#5eead4" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        className="lp-pulse"
        d="M0 70 H330 L360 70 L380 30 L405 108 L430 12 L455 92 L470 70 H760 L780 70 L795 45 L812 95 L828 58 L840 70 H1200"
        fill="none"
        stroke="url(#pl)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SKIN = ['#C68B59', '#8D5524', '#E0AC69', '#A0673A', '#F1C27D'];
const CLOTH = ['#F59E0B', '#EF4444', '#6366F1', '#0EA5E9', '#EC4899', '#84CC16', '#A855F7'];

function Person({ x, y, i, slump = false }: { x: number; y: number; i: number; slump?: boolean }) {
  const skin = SKIN[i % SKIN.length];
  const cloth = CLOTH[i % CLOTH.length];
  return (
    <g transform={`translate(${x} ${y}) ${slump ? 'rotate(6)' : ''}`}>
      <rect x="-15" y="0" width="30" height="40" rx="13" fill={cloth} />
      <circle cx="0" cy="-12" r="11" fill={skin} />
      <path d="M-11 -15 Q0 -30 11 -15 Q8 -22 0 -23 Q-8 -22 -11 -15Z" fill="#1f2937" />
      {slump && <path d="M-4 -10 h8" stroke="#1f2937" strokeWidth="1.6" strokeLinecap="round" />}
    </g>
  );
}

/** Before: a crowded waiting room and a long wait. */
export function WaitingRoomArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 300" className={className} role="img" aria-label="A crowded clinic waiting room">
      <rect width="480" height="300" rx="28" fill="#FFF7ED" />
      <rect x="0" y="210" width="480" height="90" fill="#FED7AA" opacity="0.55" />
      {/* wall clock */}
      <g transform="translate(395 70)">
        <circle r="34" fill="#fff" stroke="#FB923C" strokeWidth="5" />
        <path d="M0 0 V-20 M0 0 L15 9" stroke="#9A3412" strokeWidth="4" strokeLinecap="round" />
      </g>
      <g transform="translate(300 34)">
        <rect width="62" height="28" rx="14" fill="#9A3412" />
        <text x="31" y="19" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">2h 15m</text>
      </g>
      {/* notice board */}
      <rect x="40" y="40" width="150" height="70" rx="10" fill="#fff" stroke="#FDBA74" strokeWidth="3" />
      <text x="115" y="68" textAnchor="middle" fontSize="13" fontWeight="800" fill="#9A3412">SERIAL NO.</text>
      <text x="115" y="96" textAnchor="middle" fontSize="22" fontWeight="900" fill="#7C2D12">#7</text>
      {/* bench + people */}
      <rect x="24" y="200" width="432" height="14" rx="7" fill="#C2410C" opacity="0.75" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <Person key={i} x={55 + i * 53} y={158} i={i} slump={i % 3 === 1} />
      ))}
      {[0, 1, 2].map((i) => (
        <Person key={`s${i}`} x={120 + i * 120} y={232} i={i + 4} />
      ))}
      <text x="240" y="292" textAnchor="middle" fontSize="12" fontWeight="700" fill="#9A3412" opacity="0.8">Everyone came at 5 PM for a 5 PM sitting</text>
    </svg>
  );
}

/** After: waiting at home with the queue on the phone. */
export function AtHomeArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 480 300" className={className} role="img" aria-label="A patient waiting comfortably at home, following the queue on the phone">
      <rect width="480" height="300" rx="28" fill="#ECFDF5" />
      {/* window */}
      <rect x="40" y="36" width="120" height="96" rx="10" fill="#CCFBF1" stroke="#5EEAD4" strokeWidth="4" />
      <path d="M100 36 V132 M40 84 H160" stroke="#5EEAD4" strokeWidth="4" />
      <circle cx="132" cy="62" r="12" fill="#FDE68A" />
      {/* plant */}
      <rect x="398" y="160" width="34" height="40" rx="6" fill="#0D9488" />
      <path d="M415 160 C400 130 380 128 384 112 C402 118 410 132 415 160 C420 128 432 116 448 116 C446 134 430 140 415 160Z" fill="#34D399" />
      {/* sofa */}
      <rect x="150" y="160" width="230" height="70" rx="22" fill="#0F766E" />
      <rect x="138" y="140" width="40" height="92" rx="18" fill="#115E59" />
      <rect x="352" y="140" width="40" height="92" rx="18" fill="#115E59" />
      <rect x="160" y="226" width="10" height="26" rx="4" fill="#134E4A" />
      <rect x="360" y="226" width="10" height="26" rx="4" fill="#134E4A" />
      {/* person relaxing */}
      <g transform="translate(250 112)">
        <rect x="-20" y="10" width="40" height="52" rx="16" fill="#F59E0B" />
        <circle cx="0" cy="-6" r="15" fill="#C68B59" />
        <path d="M-15 -10 Q0 -32 15 -10 Q10 -20 0 -22 Q-10 -20 -15 -10Z" fill="#1f2937" />
        <path d="M-6 -2 q6 5 12 0" stroke="#1f2937" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* phone */}
        <rect x="16" y="14" width="26" height="44" rx="5" fill="#0B2A3A" />
        <rect x="19" y="20" width="20" height="28" rx="3" fill="#14B8A6" />
        <text x="29" y="38" textAnchor="middle" fontSize="9" fontWeight="900" fill="#fff">#7</text>
      </g>
      {/* tea */}
      <g transform="translate(96 214)">
        <rect x="-18" y="0" width="70" height="8" rx="4" fill="#99F6E4" />
        <rect x="6" y="-22" width="20" height="22" rx="5" fill="#fff" stroke="#14B8A6" strokeWidth="3" />
        <path d="M12 -30 q3 -6 0 -10 M20 -30 q3 -6 0 -10" stroke="#5EEAD4" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
      {/* notification bubble */}
      <g transform="translate(300 28)">
        <rect width="150" height="54" rx="16" fill="#fff" stroke="#99F6E4" strokeWidth="2" />
        <circle cx="26" cy="27" r="13" fill="#14B8A6" />
        <path d="M21 27 l4 4 l8 -9" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x="46" y="24" fontSize="11.5" fontWeight="800" fill="#0B2A3A">Leave in 15 min</text>
        <text x="46" y="40" fontSize="10" fontWeight="600" fill="#64748B">3 patients ahead of #7</text>
      </g>
      <text x="240" y="288" textAnchor="middle" fontSize="12" fontWeight="700" fill="#0F766E" opacity="0.85">Leave home when the app says your turn is near</text>
    </svg>
  );
}
