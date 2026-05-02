interface Props { size?: number; className?: string }

export default function NeuralHookLogo({ size = 48, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Shield — LP protection */}
      <path
        d="M 8 7 L 40 7 L 40 27 C 40 38.5 32 44 24 47 C 16 44 8 38.5 8 27 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      {/* Hook shape inside shield — Uniswap v4 hook */}
      <path
        d="M 19 16 L 27 16 C 32 16 35 20 35 25 C 35 30 31 33 26 33 L 21 33 L 21 29 L 25 29 C 28 29 31 27.5 31 25 C 31 22.5 29 20 27 20 L 19 20"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      {/* Neural nodes — entry and exit of hook */}
      <circle cx="19" cy="16" r="2.5" fill="currentColor" />
      <circle cx="21" cy="33" r="2.5" fill="currentColor" />
    </svg>
  )
}
