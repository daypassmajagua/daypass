import { classNames } from '../../lib/utils'

export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={classNames(
        'bg-white rounded-xl border border-gray-200 shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
