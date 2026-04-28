interface Props { size?: number; className?: string }

export default function NeuralHookLogo({ size = 48, className = '' }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Outer ring */}
      <circle cx="24" cy="24" r="22" stroke="white" strokeWidth="1.5" strokeDasharray="4 2" />
      {/* Neural nodes */}
      {[[24,4],[44,24],[24,44],[4,24],[38,10],[38,38],[10,38],[10,10]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r={i < 4 ? 3 : 2} fill="white" />
      ))}
      {/* Connections */}
      {[[24,4,44,24],[44,24,24,44],[24,44,4,24],[4,24,24,4],
        [24,4,38,10],[44,24,38,10],[44,24,38,38],[24,44,38,38],
        [4,24,10,38],[24,44,10,38],[4,24,10,10],[24,4,10,10]].map(([x1,y1,x2,y2],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="0.5" strokeOpacity="0.4" />
      ))}
      {/* Center node */}
      <circle cx="24" cy="24" r="4" fill="white" />
      {/* Hook curve */}
      <path d="M 26 14 C 30 14 33 17 33 21 C 33 25 30 28 26 28 L 22 28 L 22 24 L 25 24 C 27 24 29 23 29 21 C 29 19 27.5 18 26 18 L 20 18"
        stroke="black" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}
