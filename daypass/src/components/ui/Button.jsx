import { classNames } from '../../lib/utils'

const variants = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-[0_2px_8px_rgba(74,90,232,.28)]',
  secondary: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
  danger: 'bg-[#d2322d] text-white hover:bg-[#b3261e]',
  ghost: 'text-tinta-2 hover:bg-blue-50 hover:text-blue-700',
  success: 'bg-verde-500 text-white hover:bg-verde-600',
  // Coral: reservado para acciones sobre lo pendiente y lo tardío.
  pendiente: 'bg-coral-600 text-white hover:bg-coral-700',
}

const sizes = {
  sm: 'px-3.5 py-2 text-sm rounded-[10px]',
  md: 'px-5 py-2.5 text-[15px] rounded-xl min-h-[44px]',
  lg: 'px-6 py-3 text-base rounded-xl min-h-[52px]',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  loading = false,
  ...props
}) {
  return (
    <button
      className={classNames(
        'inline-flex items-center justify-center gap-2 font-bold tracking-[-.005em] transition-[background-color,transform] active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
