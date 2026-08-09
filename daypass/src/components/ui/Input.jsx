import { classNames } from '../../lib/utils'
import { forwardRef } from 'react'

const Input = forwardRef(function Input(
  { label, error, className = '', ...props },
  ref
) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-tinta">{label}</label>
      )}
      <input
        ref={ref}
        className={classNames(
          'w-full rounded-xl border px-3 py-2.5 min-h-[44px] text-sm text-tinta placeholder-tinta-3 transition-colors',
          'focus:outline-none focus:border-blue-600',
          error ? 'border-coral-400 bg-coral-50' : 'border-linea bg-white',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
})

export default Input
