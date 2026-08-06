import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, type Perfil } from '../store/useAuthStore'
import logo from '../assets/logo.png'
import { Lock } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const store = useAuthStore()
  const [nombre, setNombre] = useState('Vendedor') // Default selection
  const [perfil, setPerfil] = useState<Perfil>('vendedor')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)

  // Countdown timer for lockout
  useEffect(() => {
    if (!store.bloqueadoHasta) return
    const targetDate = new Date(store.bloqueadoHasta).getTime()
    
    const count = () => {
      const remaining = Math.max(0, targetDate - Date.now())
      setCountdown(remaining)
      if (remaining <= 0 && store.bloqueadoHasta !== null) {
        // We do a passive clear when time runs out
        // The store handles validating the time on next login attempt anyway
      }
    }
    
    count()
    const interval = setInterval(count, 1000)
    return () => clearInterval(interval)
  }, [store.bloqueadoHasta])

  // Auto-verify when 4 digits entered
  useEffect(() => {
    if (pin.length !== 4) return
    
    // Slight delay to see the last dot
    const timer = setTimeout(() => {
      const res = store.iniciarSesion(nombre, pin, perfil)
      if (res === 'ok') {
        // Let component unmount inside Layout
      } else {
        if (res === 'bloqueado') setError('Sistema bloqueado por varios intentos')
        else if (res === 'usuario_no_encontrado') setError('Usuario o perfil incorrecto')
        else if (res === 'usuario_inactivo') setError('Este usuario está desactivado')
        else if (res === 'pin_incorrecto') setError('PIN incorrecto. Intenta de nuevo')
        
        setTimeout(() => { setError(''); setPin('') }, 1000)
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [pin, nombre, perfil, store])

  const pressDigit = (d: string) => {
    if (store.bloqueadoHasta && new Date(store.bloqueadoHasta) > new Date() || pin.length >= 4) return
    setPin((prev: string) => prev + d)
  }

  const pressDelete = () => {
    if (store.bloqueadoHasta && new Date(store.bloqueadoHasta) > new Date()) return
    setPin((prev: string) => prev.slice(0, -1))
  }

  const formatCountdown = (ms: number) => {
    const totalSec = Math.ceil(ms / 1000)
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}:${String(sec).padStart(2, '0')}`
  }

  const isLocked = store.bloqueadoHasta && new Date(store.bloqueadoHasta) > new Date()

  // Opciones de usuarios rápidos
  const handleSelectUser = (n: string, p: Perfil) => {
    setNombre(n)
    setPerfil(p)
    setPin('')
    setError('')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f7f9fc] dark:bg-[#0f1117] p-6 absolute inset-0 z-[100]">
      {/* Botón para volver al inicio */}
      <button 
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 md:top-8 md:left-8 flex items-center justify-center text-gray-600 hover:text-primary dark:text-gray-400 dark:hover:text-[#5bb3e8] transition-colors font-manrope font-bold text-sm bg-white dark:bg-[#1e2235] px-4 py-2.5 rounded-full shadow-sm hover:shadow-md"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Volver al Inicio
      </button>

      <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-8 w-full max-w-sm shadow-sm text-center">
        {/* Lock icon */}
        <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-[#1a1d27] flex items-center justify-center mx-auto mb-4">
          <Lock size={28} className={`${isLocked ? 'text-[#dc2626]' : 'text-primary dark:text-[#5bb3e8]'}`} />
        </div>

        <img src={logo} alt="Agua Potable La Campiña" className="h-24 mx-auto mb-4 object-contain" />

        {/* User Selection */}
        <div className="flex gap-2 mb-6">
            <button 
                onClick={() => handleSelectUser('Vendedor', 'vendedor')}
                className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-bold transition-all ${perfil === 'vendedor' ? 'border-primary text-primary bg-blue-50 dark:bg-[#1a1d27] dark:text-[#5bb3e8] dark:border-[#5bb3e8]' : 'border-gray-200 text-gray-400 hover:border-gray-300 dark:border-[#2d3148] dark:hover:border-gray-500'}`}
            >
                Vendedor
            </button>
            <button 
                onClick={() => handleSelectUser('Administrador', 'administrador')}
                className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-bold transition-all ${perfil === 'administrador' ? 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-500' : 'border-gray-200 text-gray-400 hover:border-gray-300 dark:border-[#2d3148] dark:hover:border-gray-500'}`}
            >
                Admin
            </button>
        </div>

        {isLocked ? (
          <div className="text-center py-4 bg-red-50 dark:bg-red-900/20 rounded-xl mb-6">
            <p className="font-manrope font-bold text-red-600 dark:text-red-400 mb-2">Sistema Bloqueado</p>
            <div className="font-grotesk text-3xl font-bold text-red-600 dark:text-red-400">
              {formatCountdown(countdown)}
            </div>
            <p className="text-xs text-red-500 mt-2 font-inter">Inténtalo más tarde</p>
          </div>
        ) : (
          <>
            <div className={`h-6 mb-2 flex items-center justify-center`}>
              <span className={`text-sm font-manrope font-bold transition-opacity ${error ? 'text-[#dc2626] opacity-100' : 'opacity-0'}`}>
                {error || 'X'}
              </span>
            </div>

            {/* PIN Circles */}
            <div className="flex justify-center gap-4 mb-8">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                    pin.length > i
                      ? 'bg-primary dark:bg-[#5bb3e8] border-primary dark:border-[#5bb3e8]'
                      : 'bg-transparent border-gray-300 dark:border-[#424761]'
                  } ${error ? 'animate-shake border-[#dc2626] bg-[#dc2626]' : ''}`}
                />
              ))}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  onClick={() => pressDigit(num.toString())}
                  disabled={!!isLocked}
                  className="bg-gray-50 dark:bg-[#1a1d27] text-[#191c1e] dark:text-[#e4e6f0] rounded-xl py-4 font-grotesk font-bold text-xl active:bg-gray-200 dark:active:bg-[#2d3148] transition-colors disabled:opacity-50"
                >
                  {num}
                </button>
              ))}
              <div aria-hidden></div>
              <button
                onClick={() => pressDigit('0')}
                disabled={!!isLocked}
                className="bg-gray-50 dark:bg-[#1a1d27] text-[#191c1e] dark:text-[#e4e6f0] rounded-xl py-4 font-grotesk font-bold text-xl active:bg-gray-200 dark:active:bg-[#2d3148] transition-colors disabled:opacity-50"
              >
                0
              </button>
              <button
                onClick={pressDelete}
                disabled={!!isLocked || pin.length === 0}
                className="bg-gray-50 dark:bg-[#1a1d27] text-gray-500 rounded-xl py-4 font-inter font-bold text-sm active:bg-gray-200 dark:active:bg-[#2d3148] transition-colors flex items-center justify-center disabled:opacity-30"
              >
                Borrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
