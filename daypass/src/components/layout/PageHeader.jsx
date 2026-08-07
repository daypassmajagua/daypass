export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-[-.02em] text-tinta">{title}</h1>
        {subtitle && <div className="text-sm text-tinta-2 mt-0.5 first-letter:uppercase">{subtitle}</div>}
      </div>
      {/* En iPad las acciones bajan a su propia línea y pueden envolverse:
          nunca deben empujar el título ni salirse de la pantalla. */}
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}
