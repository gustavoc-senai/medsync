import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no arquivo .env.local na raiz do projeto.')
export const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
