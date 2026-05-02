'use client'
import type { ILRisk } from '@/lib/types'

interface Props {
  risk: ILRisk
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const labels: Record<ILRisk, string> = {
  LOW:      'Low Risk',
  MEDIUM:   'Medium Risk',
  HIGH:     'High Risk',
  CRITICAL: 'Critical',
}

export default function ILRiskBadge({ risk, size = 'md', showLabel = true }: Props) {
  const sizeCls = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : size === 'lg' ? 'px-5 py-2 text-sm' : 'px-3 py-1 text-[13px]'
  const dotSz   = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'

  return (
    <span className={`risk-badge risk-badge-${risk} ${sizeCls}`}>
      <span className={`${dotSz} rounded-full bg-current ${risk === 'CRITICAL' ? 'animate-ping absolute' : ''} inline-block flex-shrink-0`} />
      {showLabel && labels[risk]}
    </span>
  )
}
