
import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { HeartPulse } from 'lucide-react'
import { supabase } from '../lib/supabase'

type OrganizationGateProps = {
  children: ReactNode
  requireClinic?: boolean
}

export default function OrganizationGate({
  children,
  requireClinic = true,
}: OrganizationGateProps) {
  const location = useLocation()
  const [status, setStatus] = useState<
    'loading' | 'has-clinic' | 'no-clinic' | 'error'
  >('loading')

  useEffect(() => {
    let active = true

    async function checkOrganization() {
      setStatus('loading')

      const { data: userData, error: userError } =
        await supabase.auth.getUser()

      if (!active) return

      if (userError || !userData.user) {
        setStatus('error')
        return
      }

      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', userData.user.id)
        .limit(1)

      if (!active) return

      if (error) {
        console.error('Erro ao verificar clínica:', error)
        setStatus('error')
        return
      }

      setStatus(data && data.length > 0 ? 'has-clinic' : 'no-clinic')
    }

    void checkOrganization()

    return () => {
      active = false
    }
  }, [location.pathname])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F7F9FC]">
        <HeartPulse size={42} className="animate-pulse text-teal-600" />
        <p className="text-sm font-medium text-slate-500">
          Preparando seu ambiente...
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="text-xl font-bold text-[#12304A]">
            Não foi possível verificar sua clínica
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            Confira sua conexão e tente novamente. Se sua sessão
            expirou, entre novamente.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-[#12304A] px-6 py-3 text-sm font-semibold text-white"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  if (requireClinic && status === 'no-clinic') {
    return <Navigate to="/app/criar-clinica" replace />
  }

  if (!requireClinic && status === 'has-clinic') {
    return <Navigate to="/app/dashboard" replace />
  }

  return <>{children}</>
}
