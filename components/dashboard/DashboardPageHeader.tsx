import * as React from 'react'

export function DashboardPageHeader( {
  label,
  title,
  description,
  action,
}: {
  label?: React.ReactNode
  title: React.ReactNode
  description?: string
  action?: React.ReactNode
} ) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        {label && <p className="text-xs text-neutral-400">{label}</p>}
        <h1 className={`text-xl font-bold text-neutral-900 ${label ? 'mt-1' : ''}`}>{title}</h1>
        {description && <p className="mt-0.5 text-xs text-neutral-400">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
