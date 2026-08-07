import { create } from 'zustand'
import { hoyLocal } from '../lib/utils'

const useAppStore = create((set) => ({
  fechaActiva: hoyLocal(),
  setFechaActiva: (fecha) => set({ fechaActiva: fecha }),

  filtroLancha: '',
  setFiltroLancha: (id) => set({ filtroLancha: id }),

  filtroEstado: '',
  setFiltroEstado: (estado) => set({ filtroEstado: estado }),

  filtroCanal: '',
  setFiltroCanal: (id) => set({ filtroCanal: id }),
}))

export default useAppStore
