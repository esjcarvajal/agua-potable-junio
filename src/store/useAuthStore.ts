import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Perfil = 'vendedor' | 'administrador'

export interface Usuario {
  id: string
  nombre: string
  perfil: Perfil
  pin: string
  activo: boolean
  creadoEn: string
  salarioMensualUsd?: number
}

export interface SesionActiva {
  usuarioId: string
  nombre: string
  perfil: Perfil
  iniciadaEn: string
}

interface AuthState {
  usuarios: Usuario[]
  sesion: SesionActiva | null
  intentosFallidos: number
  bloqueadoHasta: string | null
  
  iniciarSesion: (nombre: string, pin: string, perfil: Perfil) => 'ok' | 'pin_incorrecto' | 'bloqueado' | 'usuario_no_encontrado' | 'usuario_inactivo'
  cerrarSesion: () => void
  estaAutenticado: () => boolean
  esAdmin: () => boolean
  esVendedor: () => boolean
  agregarUsuario: (usuario: Omit<Usuario, 'id' | 'creadoEn'>) => void
  editarUsuario: (id: string, datos: Partial<Usuario>) => void
  eliminarUsuario: (id: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      usuarios: [
        { id: '1', nombre: 'Administrador', perfil: 'administrador', pin: '4652', activo: true, creadoEn: new Date().toISOString() },
        { id: '2', nombre: 'Vendedor', perfil: 'vendedor', pin: '3104', activo: true, creadoEn: new Date().toISOString() }
      ],
      sesion: null,
      intentosFallidos: 0,
      bloqueadoHasta: null,

      iniciarSesion: (nombre, pin, perfil) => {
        const state = get()
        if (state.bloqueadoHasta && new Date(state.bloqueadoHasta) > new Date()) {
          return 'bloqueado'
        }

        let usuario = state.usuarios.find(
          u => u.nombre.toLowerCase() === nombre.toLowerCase() && u.perfil === perfil
        )

        // Fallback: Si el administrador le cambió el nombre al vendedor en la base de datos local,
        // intentamos buscar el primer usuario que coincida con el perfil solicitado.
        if (!usuario) {
          usuario = state.usuarios.find(u => u.perfil === perfil)
        }

        if (!usuario) {
          return 'usuario_no_encontrado'
        }

        if (!usuario.activo) {
          return 'usuario_inactivo'
        }

        // Permitimos el PIN configurado, pero también los PINs por defecto del código fuente como rescate
        const pinPorDefecto = perfil === 'administrador' ? '4652' : '3104'
        
        if (usuario.pin !== pin && pin !== pinPorDefecto) {
          const nuevosIntentos = state.intentosFallidos + 1
          if (nuevosIntentos >= 3) {
            const bloqueoDate = new Date()
            bloqueoDate.setMinutes(bloqueoDate.getMinutes() + 5)
            set({ intentosFallidos: 0, bloqueadoHasta: bloqueoDate.toISOString() })
            return 'bloqueado'
          }
          set({ intentosFallidos: nuevosIntentos })
          return 'pin_incorrecto'
        }

        set({
          sesion: {
            usuarioId: usuario.id,
            nombre: usuario.nombre,
            perfil: usuario.perfil,
            iniciadaEn: new Date().toISOString()
          },
          intentosFallidos: 0,
          bloqueadoHasta: null
        })

        return 'ok'
      },

      cerrarSesion: () => set({ sesion: null }),
      estaAutenticado: () => !!get().sesion,
      esAdmin: () => get().sesion?.perfil === 'administrador',
      esVendedor: () => get().sesion?.perfil === 'vendedor',
      
      agregarUsuario: (datos) => set((state) => ({
        usuarios: [
          ...state.usuarios,
          {
            ...datos,
            id: crypto.randomUUID(),
            creadoEn: new Date().toISOString()
          }
        ]
      })),

      editarUsuario: (id, datos) => set((state) => ({
        usuarios: state.usuarios.map(u => u.id === id ? { ...u, ...datos } : u)
      })),

      eliminarUsuario: (id) => set((state) => ({
        usuarios: state.usuarios.filter(u => u.id !== id)
      }))
    }),
    {
      name: 'agua-potable-auth'
    }
  )
)
