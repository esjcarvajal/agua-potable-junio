import { useState, useEffect, useRef, useCallback } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Droplets, Users, Package, BarChart3, Settings, Bell, ShoppingCart, Sun, Moon, LogOut, RefreshCw } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useAuthStore } from '../store/useAuthStore'
import { tienePermiso } from '../lib/permisos'
import { getHorarioStatus, getHorarioTexto } from '../lib/horario'
import AlertaDeudas from './AlertaDeudas'
import Login from './Login'
import { useConfig } from '../lib/useConfig'

const navItems = [
    { to: '/app', icon: LayoutDashboard, label: 'Panel Principal', permiso: 'verDashboard' },
    { to: '/app/pos', icon: ShoppingCart, label: 'Punto de Venta', permiso: 'verPOS' },
    { to: '/app/clientes', icon: Users, label: 'Clientes', permiso: 'verClientes' },
    { to: '/app/inventario', icon: Package, label: 'Inventario', permiso: 'verInventario' },
    { to: '/app/reportes', icon: BarChart3, label: 'Reportes', permiso: 'verReportes' },
    { to: '/app/admin', icon: Settings, label: 'Administración', permiso: 'verAdmin' },
]

export default function Layout() {
    const navigate = useNavigate()
    const tasaBcv = useAppStore(s => s.tasaBcv)
    const storeAuth = useAuthStore()
    const { sesion, cerrarSesion } = storeAuth
    const config = useConfig()

    // ── Horario de Trabajo ──────────────────────────────────────
    const [horario, setHorario] = useState(() => getHorarioStatus())
    const prevIsOpen = useRef<boolean | null>(null)

    const checkHorario = useCallback(async () => {
        const nuevo = getHorarioStatus()
        setHorario(nuevo)
        prevIsOpen.current = nuevo.isOpen
    }, [])

    useEffect(() => {
        checkHorario()
        const interval = setInterval(checkHorario, 30000)
        return () => clearInterval(interval)
    }, [checkHorario])
    // ── Sync en tiempo real (Firebase) ────────────────
    const initFirebaseSubscriptions = useAppStore(s => s.initFirebaseSubscriptions)
    const isSyncing = useAppStore(s => s.isSyncing)
    const ultimoSyncInventario = useAppStore(s => s.ultimoSyncInventario)
    
    // Bandera para evitar suscripciones múltiples en React StrictMode
    const initialized = useRef(false)

    useEffect(() => {
        if (!initialized.current) {
            initFirebaseSubscriptions()
            initialized.current = true
        }
    }, [initFirebaseSubscriptions])

    const syncLabel = ultimoSyncInventario
        ? `Sync ${new Date(ultimoSyncInventario).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`
        : 'Sincronizar'

    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

    const toggleTema = () => {
        const dark = !isDark
        setIsDark(dark)
        if (dark) {
            document.documentElement.classList.add('dark')
            localStorage.setItem('tema', 'oscuro')
        } else {
            document.documentElement.classList.remove('dark')
            localStorage.setItem('tema', 'claro')
        }
    }

    if (!sesion) {
        return <Login />
    }

    const navItemsFiltrados = navItems.filter(item => tienePermiso(sesion.perfil as any, item.permiso as any))

    // Título dinámico basado en la ruta actual
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const location = useLocation()
    const paginaActual = navItemsFiltrados.find(n =>
        n.to === '/app' ? location.pathname === '/app' : location.pathname.startsWith(n.to)
    )
    const tituloHeader = paginaActual?.label || 'Agua Potable La Campiña'

    return (
        <div className="flex h-[100dvh] bg-surface dark:bg-[#0f1117] overflow-hidden">
            {/* SIDEBAR DESKTOP */}
            <aside className="hidden md:flex flex-col w-[220px] bg-white dark:bg-[#1e2235] border-r border-gray-100 dark:border-[#2d3148] flex-shrink-0">
                <div className="p-5 border-b border-gray-100 dark:border-[#2d3148]">
                    <div className="text-primary dark:text-[#5bb3e8] font-manrope font-bold text-xl">Agua Potable</div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs mt-1 font-inter font-bold">La Campiña</div>
                    <div className="text-gray-400 dark:text-gray-500 text-xs mt-0.5 font-inter">{config.nombreEstacion}</div>
                </div>
                <nav className="flex-1 p-3 space-y-1">
                    {navItemsFiltrados.map(({ to, icon: Icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/app'}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-inter transition-colors ${isActive
                                    ? 'bg-blue-50 dark:bg-[#1a1d27] text-primary dark:text-[#5bb3e8] font-medium'
                                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1a1d27] hover:text-gray-700 dark:hover:text-gray-200'
                                }`
                            }
                        >
                            <Icon size={18} />
                            {label}
                        </NavLink>
                    ))}
                </nav>
                <div className="p-3 border-t border-gray-100 dark:border-[#2d3148]">
                    <button
                        onClick={() => { cerrarSesion(); navigate('/') }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-inter text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <LogOut size={18} />
                        Salir al Inicio
                    </button>
                </div>
                <div className="p-3">
                    <button
                        onClick={() => navigate('/app/pos')}
                        className="w-full py-3 px-4 rounded-xl text-white text-sm font-inter font-medium flex items-center justify-center gap-2 cursor-pointer hover:shadow-lg transition-shadow"
                        style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}>
                        <Droplets size={16} />
                        + Nueva Recarga
                    </button>
                </div>
            </aside>

            {/* MAIN */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* HEADER */}
                <header className="bg-white dark:bg-[#1e2235] border-b border-gray-100 dark:border-[#2d3148] px-4 md:px-6 py-2.5 flex items-center justify-between flex-shrink-0 gap-2">
                    {/* Título de página (dinámico) */}
                    <div className="text-base md:text-lg font-manrope font-semibold text-onSurface dark:text-[#e4e6f0] truncate flex-shrink min-w-0">
                        {tituloHeader}
                    </div>

                    <div className="flex items-center gap-1.5 md:gap-3 flex-shrink-0">
                        {/* Horario — oculto en móvil pequeño */}
                        <div className="hidden sm:flex items-center gap-1.5 bg-gray-100 dark:bg-[#1a1d27] px-2.5 py-1.5 rounded-full" title={getHorarioTexto(new Date().getDay() === 0 || horario.status.includes('FERIADO'))}>
                            <div className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: horario.color }} />
                            <span className="text-[10px] font-grotesk font-bold" style={{ color: horario.color }}>
                                {horario.status}
                            </span>
                        </div>

                        {/* Horario dot solo en móvil */}
                        <div className="sm:hidden w-2.5 h-2.5 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: horario.color }} title={horario.status} />

                        {/* Tasa BCV — solo desktop */}
                        <div className="hidden sm:block bg-gray-100 dark:bg-[#1a1d27] text-gray-600 dark:text-gray-300 text-sm font-grotesk px-3 py-1.5 rounded-full">
                            $1 = {tasaBcv.valor.toFixed(2)} VES
                        </div>

                        {/* Botón sync manual (ya no es necesario, pero lo dejamos visualmente por feedback) */}
                        {sesion?.perfil === 'administrador' && (
                            <button
                                disabled={isSyncing}
                                title={`Conectado en tiempo real. ${syncLabel}`}
                                className="flex items-center gap-1 bg-blue-50 dark:bg-[#1a1d27] px-2 py-1.5 rounded-full
                                    text-primary dark:text-[#5bb3e8] transition-colors cursor-default"
                            >
                                <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                                <span className="text-[10px] font-grotesk font-bold hidden sm:block">
                                    {isSyncing ? 'Sync...' : 'En línea'}
                                </span>
                            </button>
                        )}

                        {/* Dark mode toggle */}
                        <button
                            onClick={toggleTema}
                            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-[#5bb3e8] transition-colors cursor-pointer"
                            title={isDark ? 'Modo claro' : 'Modo oscuro'}
                        >
                            {isDark ? <Sun size={18} /> : <Moon size={18} />}
                        </button>

                        <AlertaDeudas />

                        {/* Campana — solo desktop */}
                        <button className="hidden sm:block text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                            <Bell size={18} />
                        </button>

                        {/* Usuario — solo desktop */}
                        <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-gray-200 dark:border-[#2d3148]">
                            <div className="text-right">
                                <p className="text-xs font-manrope font-bold text-[#191c1e] dark:text-[#e4e6f0]">{sesion.nombre}</p>
                                <p className={`text-[9px] font-grotesk font-bold px-1.5 py-0.5 rounded-sm inline-block ${
                                    sesion.perfil === 'administrador'
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                                }`}>
                                    {sesion.perfil.toUpperCase()}
                                </p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* PAGE CONTENT */}
                <main className="flex-1 overflow-auto p-6">
                    <Outlet />
                </main>

                {/* BOTTOM NAV MÓVIL — muestra todos los ítems permitidos */}
                <nav className="md:hidden flex border-t border-gray-100 dark:border-[#2d3148] bg-white dark:bg-[#1e2235] overflow-x-auto no-scrollbar flex-shrink-0 mobile-nav-safe">
                    {navItemsFiltrados.map(({ to, icon: Icon, label }) => {
                        // Abreviaciones para el menú móvil
                        const labelCorto = {
                            'Panel Principal': 'Panel',
                            'Punto de Venta': 'POS',
                            'Clientes': 'Clientes',
                            'Inventario': 'Stock',
                            'Reportes': 'Reportes',
                            'Administración': 'Admin',
                        }[label] || label.split(' ')[0]

                        return (
                            <NavLink
                                key={to}
                                to={to}
                                end={to === '/app'}
                                className={({ isActive }) =>
                                    `flex-1 min-w-[60px] flex flex-col items-center justify-center py-2 gap-0.5 font-inter transition-colors ${
                                        isActive
                                            ? 'text-primary dark:text-[#5bb3e8]'
                                            : 'text-gray-500 dark:text-white hover:text-gray-600 dark:hover:text-gray-200'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                        <span className="text-[9px] leading-tight text-center font-bold">{labelCorto}</span>
                                    </>
                                )}
                            </NavLink>
                        )
                    })}
                {/* Botón de cerrar sesión — solo móvil */}
                    <button
                        onClick={() => { cerrarSesion(); navigate('/') }}
                        className="flex-1 min-w-[60px] flex flex-col items-center justify-center py-2 gap-0.5 font-inter transition-colors text-red-400 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
                        title="Cerrar sesión"
                    >
                        <LogOut size={18} strokeWidth={2} />
                        <span className="text-[9px] leading-tight text-center font-bold">Salir</span>
                    </button>
                </nav>
            </div>
        </div>
    )
}