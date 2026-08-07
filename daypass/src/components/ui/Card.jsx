import { classNames } from '../../lib/utils'

export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={classNames(
        'bg-white rounded-2xl shadow-[0_1px_2px_rgba(22,24,44,.05),0_8px_24px_rgba(22,24,44,.06)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
