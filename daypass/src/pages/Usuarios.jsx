import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { UserPlus, Users as IconoUsuarios, ShieldCheck, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePerfil } from '../hooks/usePerfil'
import { ROLES, ETIQUETA_ROL } from '../lib/navegacion'
import { classNames, hora12 } from '../lib/utils'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import PageHeader from '../components/layout/PageHeader'
import { ListaDelDia, ConfirmarAccion } from '../components/patrones'

/**
 * Quién entra y qué ve.
 *
 * ── Por qué son dos pasos y no uno ──────────────────────────────────────────
 *
 * Crear la cuenta y darle un rol pasan en sitios distintos:
 *
 *   1. La **cuenta** se crea en Supabase (Auth → Users). Hacerlo desde aquí
 *      exigiría la clave de servicio, y esa no puede vivir en el navegador:
 *      quien abra las herramientas de desarrollo la vería.
 *   2. El **rol** se asigna aquí.
 *
 * Entre los dos pasos, esa persona puede iniciar sesión pero no ve nada — le
 * sale "tu usuario todavía no está en el equipo". Por eso las cuentas
 * pendientes aparecen arriba y en coral: alguien está esperando del otro lado.
 *
 * Desactivar en vez de borrar: un perfil borrado deja huérfano lo que esa
 * persona firmó en la bitácora, y la bitácora no se toca.
 */

function FilaPerfil({ perfil, esYo, onEditar, onAlternar }) {
  return (
    <div className={classNames(
      'bg-white rounded-2xl px-4 py-3.5 flex items-center gap-4 flex-wrap shadow-[0_1px_2px_rgba(22,24,44,.05)]',
      !perfil.activo && 'opacity-55'
    )}>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-[15px] text-tinta truncate">
          {perfil.nombre}
          {esYo && <span className="ml-2 text-[13px] font-bold text-blue-700">tú</span>}
        </p>
        <p className="text-[13px] text-tinta-2">
          {ETIQUETA_ROL[perfil.rol] || perfil.rol}
          {!perfil.activo && ' · desactivado'}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="ghost" onClick={() => onEditar(perfil)}>
          Cambiar
        </Button>
        {/* Nadie se desactiva a sí mismo: sería quedarse afuera sin que quede
            otra persona que pueda volver a entrar. */}
        {!esYo && (
          <Button
            size="sm"
            variant={perfil.activo ? 'ghost' : 'secondary'}
            onClick={() => onAlternar(perfil)}
          >
            {perfil.activo ? 'Desactivar' : 'Reactivar'}
          </Button>
        )}
      </div>
    </div>
  )
}

export default function Usuarios() {
  const { perfil: yo, recargar: recargarMiPerfil } = usePerfil()
  const [perfiles, setPerfiles] = useState([])
  const [pendientes, setPendientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [editando, setEditando] = useState(null)
  const [alternando, setAlternando] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    const [{ data: filas, error: err }, { data: sinPerfil }] = await Promise.all([
      supabase.from('perfiles').select('*').order('nombre'),
      supabase.rpc('cuentas_sin_perfil'),
    ])
    if (err) setError(err)
    else setPerfiles(filas || [])
    setPendientes(sinPerfil || [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function guardar(datos) {
    const esNuevo = !perfiles.some(p => p.user_id === datos.user_id)
    const { error: err } = esNuevo
      ? await supabase.from('perfiles').insert({
          user_id: datos.user_id,
          nombre: datos.nombre.trim(),
          rol: datos.rol,
          creado_por: yo?.user_id,
        })
      : await supabase.from('perfiles')
          .update({ nombre: datos.nombre.trim(), rol: datos.rol })
          .eq('user_id', datos.user_id)

    if (err) { toast.error('No se pudo guardar. ' + err.message); return }
    toast.success(esNuevo ? `${datos.nombre} ya puede entrar` : 'Guardado')
    setEditando(null)
    await cargar()
    // Si me cambié a mí misma, el menú tiene que reflejarlo de una.
    if (datos.user_id === yo?.user_id) recargarMiPerfil()
  }

  async function alternar() {
    const { error: err } = await supabase.from('perfiles')
      .update({ activo: !alternando.activo })
      .eq('user_id', alternando.user_id)
    if (err) { toast.error('No se pudo cambiar. ' + err.message); return }
    toast.success(alternando.activo
      ? `${alternando.nombre} ya no puede entrar`
      : `${alternando.nombre} vuelve a entrar`)
    setAlternando(null)
    cargar()
  }

  return (
    <div className="marco py-6">
      <PageHeader
        title="Usuarios"
        subtitle="Quién entra y qué ve"
      />

      {/* Alguien creado en Supabase que todavía no puede hacer nada. Va
          arriba porque hay una persona esperando del otro lado. */}
      {pendientes.length > 0 && (
        <Card className="p-5 mb-5 ring-1 ring-coral-100 bg-coral-50">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-coral-700 mb-1">
            <UserPlus size={18} />
            {pendientes.length === 1
              ? 'Una cuenta espera que le des un rol'
              : `${pendientes.length} cuentas esperan que les des un rol`}
          </h2>
          <p className="text-[13px] text-coral-700/80 mb-3">
            Pueden iniciar sesión, pero todavía no ven nada.
          </p>
          <ul className="flex flex-col gap-2">
            {pendientes.map(c => (
              <li key={c.user_id} className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-[15px] text-tinta truncate">{c.email}</span>
                  <span className="block text-[13px] text-tinta-2">
                    Cuenta creada {hora12(c.creada_at) ? `a las ${hora12(c.creada_at)}` : ''}
                  </span>
                </span>
                <Button
                  size="sm"
                  onClick={() => setEditando({
                    user_id: c.user_id,
                    nombre: c.email.split('@')[0],
                    rol: 'asesora_comercial',
                    email: c.email,
                  })}
                >
                  Darle acceso
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ListaDelDia
        items={perfiles}
        clave={p => p.user_id}
        cargando={cargando}
        error={error}
        onReintentar={cargar}
        vacio={{
          icono: IconoUsuarios,
          titulo: 'Todavía no hay nadie en el equipo',
          detalle: 'Las cuentas se crean en Supabase, en Auth → Users. Aquí se les asigna qué ven.',
        }}
      >
        {p => (
          <FilaPerfil
            perfil={p}
            esYo={p.user_id === yo?.user_id}
            onEditar={setEditando}
            onAlternar={setAlternando}
          />
        )}
      </ListaDelDia>

      <div className="mt-6 flex items-start gap-2.5 text-[13px] text-tinta-2">
        <ShieldCheck size={16} className="shrink-0 mt-0.5 text-tinta-2" />
        <p>
          Las cuentas se crean en el panel de Supabase, en <b>Auth → Users</b>. Desde ahí no se
          puede hacer porque haría falta la clave de servicio, y esa no puede estar en el
          navegador. Cuando la cuenta exista, aparece arriba para darle su rol.
          {' '}
          <a
            href="https://supabase.com/dashboard/project/_/auth/users"
            target="_blank"
            rel="noreferrer"
            className="text-blue-700 font-bold inline-flex items-center gap-1"
          >
            Abrir Supabase <ExternalLink size={13} />
          </a>
        </p>
      </div>

      {editando && (
        <FormularioPerfil
          datos={editando}
          onCerrar={() => setEditando(null)}
          onGuardar={guardar}
        />
      )}

      <ConfirmarAccion
        abierto={Boolean(alternando)}
        titulo={alternando?.activo ? 'Quitarle el acceso' : 'Devolverle el acceso'}
        etiquetaConfirmar={alternando?.activo ? 'Quitar acceso' : 'Devolver acceso'}
        variante={alternando?.activo ? 'danger' : 'primary'}
        onConfirmar={alternar}
        onCancelar={() => setAlternando(null)}
      >
        <p>
          <b>{alternando?.nombre}</b>{' '}
          {alternando?.activo
            ? 'deja de ver nada al entrar. La cuenta sigue existiendo y lo que ya hizo queda en la bitácora.'
            : 'vuelve a ver lo suyo.'}
        </p>
      </ConfirmarAccion>
    </div>
  )
}

function FormularioPerfil({ datos, onCerrar, onGuardar }) {
  const [nombre, setNombre] = useState(datos.nombre || '')
  const [rol, setRol] = useState(datos.rol)
  const [guardando, setGuardando] = useState(false)
  const esNuevo = Boolean(datos.email)

  return (
    <Modal open onClose={onCerrar} title={esNuevo ? 'Darle acceso' : 'Cambiar el acceso'}>
      <div className="flex flex-col gap-4">
        {esNuevo && (
          <p className="text-[15px] text-tinta-2">
            Cuenta <b className="text-tinta">{datos.email}</b>
          </p>
        )}

        <Input
          label="Nombre completo"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
        />
        <p className="text-[13px] text-tinta-2 -mt-2">
          Con este nombre quedan firmados los cierres en la bitácora, así que conviene el real
          y completo.
        </p>

        <Select
          label="Qué hace"
          value={rol}
          onChange={setRol}
          options={ROLES.map(r => ({ value: r, label: ETIQUETA_ROL[r] }))}
        />
      </div>

      <div className="flex gap-3 justify-end mt-5">
        <Button variant="ghost" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button
          loading={guardando}
          disabled={!nombre.trim()}
          onClick={async () => {
            setGuardando(true)
            await onGuardar({ user_id: datos.user_id, nombre, rol })
            setGuardando(false)
          }}
        >
          {esNuevo ? 'Darle acceso' : 'Guardar'}
        </Button>
      </div>
    </Modal>
  )
}
