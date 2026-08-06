import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { tienePermiso } from '../lib/permisos'

interface Props {
  permiso: string
  children: React.ReactNode
}

export default function ProtectedRoute({ permiso, children }: Props) {
  const { sesion } = useAuthStore()
  
  if (!sesion) return <Navigate to="/" replace />
  
  if (!tienePermiso(sesion.perfil as any, permiso as any)) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <div className="text-6xl mb-2">🔒</div>
        <h2 className="font-manrope text-2xl font-bold text-[#191c1e] dark:text-[#e4e6f0]">
          Acceso restringido
        </h2>
        <p className="text-gray-500 text-center max-w-sm font-inter">
          Tu perfil de {sesion.perfil} no tiene acceso a esta sección. Contacta al administrador.
        </p>
      </div>
    )
  }
  
  return <>{children}</>
}
