import { createClient } from '@supabase/supabase-js'
import { createMockClient } from './mockSupabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isMock =
  !supabaseUrl ||
  supabaseUrl === 'your_supabase_project_url' ||
  supabaseUrl.trim() === ''

if (isMock) {
  console.info('%c[DayPASS] Modo demo — usando datos de muestra', 'color: #1e2045; font-weight: bold')
}

export const supabase = isMock
  ? createMockClient()
  : createClient(supabaseUrl, supabaseAnonKey)
