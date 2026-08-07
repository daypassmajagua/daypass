import { create } from 'zustand'
import { hoyLocal } from '../lib/utils'

const useAppStore = create((set) => ({
  fechaActiva: hoyLocal(),
  setFechaActiva: (fecha) => set({ fechaActiva: fecha }),

  // El día operativo vive aquí: una sola suscripción alimenta a toda la app.
  dia: null,
  setDia: (dia) => set({ dia }),

  // Puntos conectados ahora mismo (oficina / muelle / isla).
  puntosEnLinea: [],
  setPuntosEnLinea: (puntos) => set({ puntosEnLinea: puntos }),

  filtroLancha: '',
  setFiltroLancha: (id) => set({ filtroLancha: id }),

  filtroEstado: '',
  setFiltroEstado: (estado) => set({ filtroEstado: estado }),

  filtroCanal: '',
  setFiltroCanal: (id) => set({ filtroCanal: id }),
}))

export default useAppStore
