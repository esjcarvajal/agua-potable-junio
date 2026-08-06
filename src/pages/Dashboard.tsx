import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { updateRow, insertRow } from '../lib/db'
import { useAuthStore } from '../store/useAuthStore'
import { Droplets, TrendingUp, UserPlus, ShoppingCart, Truck, X, Pencil, DollarSign } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getHorarioStatus, isFeriado } from '../lib/horario'
import { Clock, Calendar as CalendarIcon } from 'lucide-react'
import { getLocalDateString } from '../lib/dateUtils'

export default function Dashboard() {
    const navigate = useNavigate()
    const authStore = useAuthStore()
    const {
        fetchTasaBcv,
        usdToVes,
        litrosJumbo,
        litrosTanques,
        ventas,
        correcciones,
        registrarCisterna,
        registrarCorreccion
    } = useAppStore()

    const [showCisternaModal, setShowCisternaModal] = useState(false)
    const [litrosRecibidos, setLitrosRecibidos] = useState<number>(11000)
    const [showToast, setShowToast] = useState(false)
    const [toastMsg, setToastMsg] = useState('')
    const [currentTime, setCurrentTime] = useState(new Date())

    // Modal de correcciones
    const [ventaCorregir, setVentaCorregir] = useState<any>(null)
    const [formMotivo, setFormMotivo] = useState('')
    const [formCliente, setFormCliente] = useState('')
    const [formMetodoPago, setFormMetodoPago] = useState('')
    const [formNotas, setFormNotas] = useState('')

    // Deliveries
    const [showDeliveriesModal, setShowDeliveriesModal] = useState(false)
    const [confirmandoIds, setConfirmandoIds] = useState<Set<string>>(new Set())
    const store = useAppStore()

    useEffect(() => {
        fetchTasaBcv()

        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 1000)

        // Auto-refresh tasa BCV cada 4 horas
        const tasaTimer = setInterval(() => {
            fetchTasaBcv()
        }, 4 * 60 * 60 * 1000)

        return () => {
            clearInterval(timer)
            clearInterval(tasaTimer)
        }
    }, [fetchTasaBcv])

    const ventasHoyUsd = useMemo(() => {
        const hoy = getLocalDateString()
        return ventas.filter(v => v.fecha && v.fecha.startsWith(hoy)).reduce((acc, v) => acc + (parseFloat(v.total_usd) || 0), 0)
    }, [ventas])

    const litrosVendidosHoyComputed = useMemo(() => {
        const hoy = getLocalDateString()
        return ventas.filter(v => v.fecha && v.fecha.startsWith(hoy)).reduce((acc, v) => {
            let litros = 0
            try {
                const items = JSON.parse(v.items_json || '[]')
                for (const item of items) {
                    if (item.producto?.esRecarga) {
                        litros += (item.producto.litros || 0) * (item.cantidad || 1)
                    }
                }
            } catch (e) {}
            return acc + litros
        }, 0)
    }, [ventas])

    const formatUsdStore = useAppStore(s => s.formatUsd)
    const percentageMeta = Math.min((ventasHoyUsd / 500) * 100, 100)

    const abrirCorreccion = (v: any) => {
        setVentaCorregir(v)
        setFormMotivo('')
        setFormCliente(v.cliente_nombre || '')
        setFormMetodoPago(v.metodo_pago || '')
        setFormNotas(v.notas || '')
    }

    const guardarCorreccion = async () => {
        if (!formMotivo) {
            alert('Debes ingresar un motivo de corrección')
            return
        }

        const notaCorreccion = `${formNotas ? formNotas + ' | ' : ''}Motivo de Corrección: ${formMotivo} [CORREGIDO POR ADMIN]`
        
        await updateRow('ventas', ventaCorregir.id, {
            cliente_nombre: formCliente,
            metodo_pago: formMetodoPago,
            notas: notaCorreccion
        })

        registrarCorreccion(ventaCorregir.id, formMotivo, authStore.sesion?.nombre || 'Administrador')
        setVentaCorregir(null)
    }

    const handleConfirmarCisterna = async () => {
        const resultado = registrarCisterna(litrosRecibidos)
        
        await insertRow('movimientos_agua', { 
            id: window.crypto.randomUUID(), 
            fecha: new Date().toISOString(), 
            tipo: 'entrada_cisterna', 
            litros: litrosRecibidos, 
            descripcion: `Llegada de cisterna — ${litrosRecibidos.toLocaleString('es-VE')} L (${resultado.tanquesAgregado.toLocaleString('es-VE')} L a tanques, ${resultado.jumboAgregado.toLocaleString('es-VE')} L a reservorio)`, 
            usuario: 'Operario' 
        })
        
        setShowCisternaModal(false)
        const msg = resultado.sobrante > 0
            ? `Cisterna registrada — ${resultado.almacenados.toLocaleString('es-VE')} L almacenados, ${resultado.sobrante.toLocaleString('es-VE')} L exceden la capacidad`
            : `Cisterna registrada — ${resultado.almacenados.toLocaleString('es-VE')} L distribuidos correctamente`
        setToastMsg(msg)
        setShowToast(true)
        setTimeout(() => setShowToast(false), 4000)
        setLitrosRecibidos(11000)
    }

    const entregasEnTransito = useMemo(() => {
        return ventas.filter(v => v.es_delivery && v.estado_delivery === 'en_transito')
    }, [ventas])

    const handleCompletarDelivery = async (ventaId: string) => {
        // Marcar como "confirmando" para mostrar estado transitorio
        setConfirmandoIds(prev => new Set(prev).add(ventaId))
        await store.marcarDeliveryCompletado(ventaId)
        // Pequeña pausa para que el usuario vea el estado verde antes de que desaparezca
        setTimeout(() => {
            setConfirmandoIds(prev => { const s = new Set(prev); s.delete(ventaId); return s })
            setToastMsg('✓ Entrega marcada como completada')
            setShowToast(true)
            setTimeout(() => setShowToast(false), 3000)
        }, 600)
    }

    // Bug #4: Ordenar ventas por fecha+hora descendente (más reciente primero)
    const ultimasVentas = useMemo(() => {
        return [...ventas]
            .sort((a, b) => {
                const ta = new Date(`${a.fecha}T${a.hora || '00:00:00'}`).getTime()
                const tb = new Date(`${b.fecha}T${b.hora || '00:00:00'}`).getTime()
                return tb - ta
            })
            .slice(0, 5)
    }, [ventas])

    // Bug #2: Feed de actividad reciente — combina ventas, correcciones y registros
    const actividadReciente = useMemo(() => {
        const items: Array<{
            id: string
            tipo: 'venta' | 'cisterna' | 'correccion'
            texto: string
            subtexto: string
            monto?: string
            tiempo: number
            icono: string
        }> = []

        // Ventas recientes
        ventas.slice(0, 20).forEach(v => {
            const ts = new Date(`${v.fecha}T${v.hora || '00:00:00'}`).getTime()
            if (!ts) return
            let resumen = ''
            try {
                const its = JSON.parse(v.items_json || '[]')
                resumen = its.map((i: any) => `${i.cantidad}x ${i.producto?.nombre || i.tipo || '—'}`).join(', ')
            } catch { /* skip */ }
            items.push({
                id: v.id || String(ts),
                tipo: 'venta',
                texto: v.cliente_nombre || 'Cliente general',
                subtexto: resumen || 'Venta registrada',
                monto: v.total_usd ? `$${parseFloat(v.total_usd).toFixed(2)}` : undefined,
                tiempo: ts,
                icono: 'venta',
            })
        })

        // Correcciones de ventas
        correcciones.slice(0, 5).forEach(c => {
            const ts = new Date(c.fecha).getTime()
            items.push({
                id: `corr-${c.ventaId}`,
                tipo: 'correccion',
                texto: 'Correción de venta',
                subtexto: `${c.motivo} — por ${c.adminNombre}`,
                tiempo: ts,
                icono: 'correccion',
            })
        })

        // Ordenar todo por tiempo descendente y tomar los 8 más recientes
        return items.sort((a, b) => b.tiempo - a.tiempo).slice(0, 8)
    }, [ventas, correcciones])

    // Formatear tiempo relativo
    const formatTiempoRelativo = (ts: number) => {
        const diff = Date.now() - ts
        const mins = Math.floor(diff / 60000)
        if (mins < 1) return 'Ahora'
        if (mins < 60) return `Hace ${mins} min`
        const hrs = Math.floor(mins / 60)
        if (hrs < 24) return `Hace ${hrs}h`
        return `Hace ${Math.floor(hrs / 24)}d`
    }

    return (
        <div className="relative min-h-[100vh] bg-[#f7f9fc] dark:bg-[#0f1117] p-6 lg:p-8 w-full overflow-hidden">
            {/* SECCIÓN 1 — Fila de 3 metric cards */}
            <div className="flex flex-col md:flex-row gap-6 mb-6">
                {/* Card 1 */}
                <div className="w-full md:w-1/2 bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm relative">
                    <h2 className="font-manrope text-gray-600 dark:text-gray-400 font-medium mb-1">Ventas Totales Hoy</h2>
                    <div className="text-[36px] text-[#191c1e] dark:text-[#e4e6f0] font-grotesk font-bold leading-tight">
                        {formatUsdStore ? formatUsdStore(ventasHoyUsd) : `$${ventasHoyUsd.toFixed(2)} USD`}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                        {usdToVes(ventasHoyUsd)}
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-[#1a1d27] rounded-full h-2 mb-2">
                        <div 
                            className="bg-[#005e97] h-2 rounded-full transition-all duration-1000 ease-in-out" 
                            style={{ width: `${percentageMeta}%` }}
                        ></div>
                    </div>
                    <div className="text-[12px] text-gray-500 dark:text-gray-400 font-manrope font-medium tracking-wide">
                        {percentageMeta.toFixed(0)}% DE LA META DIARIA ALCANZADA
                    </div>
                    <div className="absolute top-5 right-5 text-[#005e97]">
                        <TrendingUp size={24} />
                    </div>
                </div>

                {/* Card 2 */}
                <div className="w-full md:w-1/4 bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm flex flex-col justify-center">
                    <h2 className="font-manrope text-gray-600 dark:text-gray-400 font-medium mb-2">Litros Vendidos</h2>
                    <div className="text-[32px] text-[#191c1e] dark:text-[#e4e6f0] font-grotesk font-bold leading-tight mb-2">
                        {litrosVendidosHoyComputed} L
                    </div>
                    <div>
                        <span className="inline-block bg-[#dcfce7] dark:bg-[#166534]/20 text-[#166534] dark:text-[#4ade80] text-xs px-2 py-1 rounded font-bold font-grotesk">
                            +{litrosVendidosHoyComputed} L hoy
                        </span>
                    </div>
                </div>

                {/* Card 3 - Entregas Activas */}
                <div 
                    onClick={() => entregasEnTransito.length > 0 && setShowDeliveriesModal(true)}
                    className={`w-full md:w-1/4 bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm flex flex-col justify-center transition-all ${entregasEnTransito.length > 0 ? 'cursor-pointer hover:shadow-md hover:border-primary border-2 border-transparent' : ''}`}
                >
                    <h2 className="font-manrope text-gray-600 dark:text-gray-400 font-medium mb-2 flex items-center gap-2">
                        Entregas Activas <Truck size={14} className="text-primary dark:text-[#5bb3e8]" />
                    </h2>
                    <div className="text-[32px] text-[#191c1e] dark:text-[#e4e6f0] font-grotesk font-bold leading-tight mb-2">
                        {entregasEnTransito.length}
                    </div>
                    <div>
                        <span className={`inline-block text-xs px-2 py-1 rounded font-bold font-manrope ${
                            entregasEnTransito.length > 0 
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                            : 'bg-gray-100 dark:bg-[#1a1d27] text-gray-600 dark:text-gray-400'
                        }`}>
                            {entregasEnTransito.length > 0 ? 'En ruta' : 'Sin entregas activas'}
                        </span>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 2 — Panel de Tanques */}
            <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm mb-6 flex flex-col lg:flex-row gap-6">
                {/* Panel izquierdo */}
                <div className="w-full lg:w-[30%]">
                    <h3 className="font-manrope text-lg font-bold text-[#191c1e] dark:text-[#e4e6f0] mb-4">Reservorio Maestro</h3>
                    <div className="bg-[#e8f4fd] dark:bg-[#1a1d27] rounded-[16px] h-[200px] w-full overflow-hidden relative">
                        <div 
                            className="absolute bottom-0 w-full bg-gradient-to-b from-[#0077be] to-[#005e97]"
                            style={{ height: `${Math.min((litrosJumbo / 2500) * 100, 100)}%`, transition: 'height 1s ease' }}
                        ></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-white font-grotesk font-bold text-[28px] drop-shadow-md">
                                {Math.round((litrosJumbo / 2500) * 100)}%
                            </span>
                        </div>
                    </div>
                    <div className="mt-4 text-center">
                        <div className="text-[#005e97] dark:text-[#5bb3e8] text-3xl font-grotesk font-bold">
                            {Math.round(litrosJumbo)} L
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 text-sm font-grotesk font-medium">
                            MÁX: 2,500 L
                        </div>
                    </div>
                </div>

                {/* Panel derecho */}
                <div className="w-full lg:w-[70%] relative border-t lg:border-t-0 lg:border-l border-gray-100 dark:border-[#2d3148] pt-5 lg:pt-0 lg:pl-6">
                    <div className="absolute top-0 right-0 bg-[#dcfce7] dark:bg-[#166534]/20 text-[#166534] dark:text-[#4ade80] text-[10px] px-2 py-1 rounded font-bold tracking-wider font-grotesk">
                        ● OPERANDO
                    </div>
                    <h3 className="font-manrope text-lg font-bold text-[#191c1e] dark:text-[#e4e6f0] mb-4">Red de Distribución — 11 Tanques</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                        {litrosTanques.map(t => (
                            <div key={t.id} className="flex flex-col items-center">
                                <div className="bg-[#e8f4fd] dark:bg-[#1a1d27] rounded-[8px] h-[70px] w-full overflow-hidden relative mb-1">
                                    <div 
                                        className="absolute bottom-0 w-full"
                                        style={{ 
                                            height: `${Math.min((t.litros / 1000) * 100, 100)}%`, 
                                            backgroundColor: t.litros < 200 ? '#8b4800' : '#005e97',
                                            transition: 'height 1s ease, background-color 0.5s ease'
                                        }}
                                    ></div>
                                </div>
                                <div className={`text-[10px] font-grotesk ${t.litros < 200 ? 'text-red-500 dark:text-red-400 font-bold' : 'text-gray-500 dark:text-gray-400 font-medium'}`}>
                                    {t.id}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* SECCIÓN 3 — 3 botones de acción rápida */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <button 
                    onClick={() => navigate('/pos')} 
                    className="flex-1 bg-white dark:bg-[#1e2235] rounded-[12px] p-[16px] flex items-center justify-center md:justify-start gap-[12px] cursor-pointer hover:bg-[#f2f4f7] dark:hover:bg-[#2d3148] transition-colors shadow-sm"
                >
                    <div className="text-[#005e97] dark:text-[#5bb3e8]"><ShoppingCart size={24}/></div>
                    <span className="font-manrope font-bold text-gray-800 dark:text-[#e4e6f0] text-lg">Nueva Venta</span>
                </button>
                <button 
                    onClick={() => setShowCisternaModal(true)} 
                    className="flex-1 bg-white dark:bg-[#1e2235] rounded-[12px] p-[16px] flex items-center justify-center md:justify-start gap-[12px] cursor-pointer hover:bg-[#f2f4f7] dark:hover:bg-[#2d3148] transition-colors shadow-sm"
                >
                    <div className="text-[#005e97] dark:text-[#5bb3e8]"><Truck size={24}/></div>
                    <span className="font-manrope font-bold text-gray-800 dark:text-[#e4e6f0] text-lg">Registro Cisterna</span>
                </button>
                <button 
                    onClick={() => navigate('/clientes')} 
                    className="flex-1 bg-white dark:bg-[#1e2235] rounded-[12px] p-[16px] flex items-center justify-center md:justify-start gap-[12px] cursor-pointer hover:bg-[#f2f4f7] dark:hover:bg-[#2d3148] transition-colors shadow-sm"
                >
                    <div className="text-[#005e97] dark:text-[#5bb3e8]"><UserPlus size={24}/></div>
                    <span className="font-manrope font-bold text-gray-800 dark:text-[#e4e6f0] text-lg">Nuevo Cliente</span>
                </button>
            </div>

            {/* SECCIÓN HORARIOS (Nueva) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm border-l-4 border-primary">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-primary dark:text-[#5bb3e8] rounded-lg">
                            <Clock size={20} />
                        </div>
                        <h3 className="font-manrope font-bold text-[#191c1e] dark:text-[#e4e6f0]">Horario de Operación</h3>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-inter text-gray-500 dark:text-gray-400">Lunes a Sábado</span>
                            <span className="font-grotesk font-bold text-gray-700 dark:text-[#e4e6f0]">08:00 AM / 07:00 PM</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-inter text-gray-500 dark:text-gray-400">Domingo y Feriados</span>
                            <span className="font-grotesk font-bold text-gray-700 dark:text-[#e4e6f0]">08:00 AM / 02:00 PM</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 rounded-lg">
                            <CalendarIcon size={20} />
                        </div>
                        <h3 className="font-manrope font-bold text-[#191c1e] dark:text-[#e4e6f0]">Próximos Feriados (VZLA)</h3>
                    </div>
                    <div className="text-[11px] font-inter text-gray-500 dark:text-gray-400 grid grid-cols-2 gap-x-4 gap-y-1">
                        <span>• 19 Abr: Independencia</span>
                        <span>• 1 May: Día del Trabajador</span>
                        <span>• 24 Jun: Batalla Carabobo</span>
                        <span>• 5 Jul: Independencia</span>
                    </div>
                </div>
            </div>

            {/* SECCIÓN 4 — Dos columnas */}
            <div className="flex flex-col lg:flex-row gap-6 pb-20">
                {/* Columna izquierda */}
                <div className="w-full lg:w-[60%] bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm">
                    <h3 className="font-manrope text-lg font-bold text-[#191c1e] dark:text-[#e4e6f0] mb-4">Transacciones Recientes</h3>
                    {ultimasVentas.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                            <Droplets size={48} className="mb-4 text-[#e8f4fd] dark:text-[#1a1d27]" />
                            <p className="font-manrope font-medium text-center">Sin transacciones hoy — registra la primera venta de Agua Potable La Campiña</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[500px] text-sm">
                                <thead>
                                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-[#2d3148] font-manrope">
                                        <th className="pb-3 px-2 font-medium">ID Operación</th>
                                        <th className="pb-3 px-2 font-medium">Cliente/Tipo</th>
                                        <th className="pb-3 px-2 font-medium">Volumen</th>
                                        <th className="pb-3 px-2 font-medium">Valor USD</th>
                                        <th className="pb-3 px-2 font-medium">Estado</th>
                                        {authStore.esAdmin() && <th className="pb-3 px-2 font-medium text-right">Admin</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {ultimasVentas.map((v, i) => (
                                        <tr key={v.id || i} className="border-b border-gray-50 dark:border-[#2d3148]/50 last:border-0 hover:bg-[#f7f9fc] dark:hover:bg-[#1a1d27] transition-colors">
                                            <td className="py-4 px-2 font-grotesk text-gray-600 dark:text-gray-400 font-medium">
                                                {v.numero_orden ? `#${v.numero_orden}` : (v.id ? v.id.slice(0, 8).toUpperCase() : '---')}
                                            </td>
                                            <td className="py-4 px-2 font-manrope font-medium text-gray-800 dark:text-[#e4e6f0]">
                                                {v.cliente_nombre || 'Cliente General'}
                                            </td>
                                            <td className="py-4 px-2 font-grotesk font-medium text-gray-800 dark:text-[#e4e6f0]">
                                                {(() => {
                                                    try {
                                                        const items = JSON.parse(v.items_json || '[]')
                                                        const litros = items.reduce((sum: number, it: any) => {
                                                            if (it.producto?.esRecarga) return sum + (it.producto.litros || 0) * (it.cantidad || 1)
                                                            return sum
                                                        }, 0)
                                                        return litros > 0 ? `${litros} L` : '—'
                                                    } catch { return '—' }
                                                })()}
                                            </td>
                                            <td className="py-4 px-2 font-grotesk font-medium text-gray-800 dark:text-[#e4e6f0]">
                                                {formatUsdStore ? formatUsdStore(parseFloat(v.total_usd) || 0) : `$${(parseFloat(v.total_usd) || 0).toFixed(2)}`}
                                            </td>
                                            <td className="py-4 px-2">
                                                {v.es_delivery && v.estado_delivery === 'en_transito' ? (
                                                    <span className="inline-block bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded px-2 py-1 text-[10px] font-bold font-grotesk tracking-widest">
                                                        EN TRÁNSITO
                                                    </span>
                                                ) : (
                                                    <span className="inline-block bg-[#dcfce7] dark:bg-[#166534]/20 text-[#166534] dark:text-[#4ade80] rounded px-2 py-1 text-[10px] font-bold font-grotesk tracking-widest">
                                                        COMPLETADO
                                                    </span>
                                                )}
                                                {v.notas && v.notas.includes('[CORREGIDO POR ADMIN]') && (
                                                    <span className="block mt-1 text-[9px] font-bold text-amber-600 dark:text-amber-400">CORREGIDO</span>
                                                )}
                                            </td>
                                            {authStore.esAdmin() && (
                                                <td className="py-4 px-2 text-right">
                                                    <button onClick={() => abrirCorreccion(v)} className="text-gray-400 hover:text-amber-500 transition-colors" title="Corregir">
                                                        <Pencil size={14} />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Columna derecha */}
                <div className="w-full lg:w-[40%] flex flex-col gap-6">
                    {/* Card Información del Turno */}
                    <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm flex items-center gap-4">
                        <div className="w-14 h-14 shrink-0 rounded-full bg-[#005e97] text-white flex items-center justify-center font-bold text-xl font-manrope">
                            OP
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h4 className="font-manrope font-bold text-[#191c1e] dark:text-[#e4e6f0] text-lg truncate">Operario Activo</h4>
                                <span className={`text-[10px] font-bold font-grotesk px-2 py-0.5 rounded-full ${
                                    getHorarioStatus().isOpen ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                    {getHorarioStatus().status}
                                </span>
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 font-manrope">
                                {isFeriado(new Date()) ? 'HOY ES FERIADO' : 'Día Laboral Regular'}
                            </div>
                        </div>
                        <div className="font-grotesk text-xl md:text-2xl font-bold text-[#005e97] dark:text-[#5bb3e8] shrink-0">
                            {currentTime.toLocaleTimeString('es-VE', { hour12: true, hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                        </div>
                    </div>

                    {/* Card Actividad Reciente */}
                    <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm flex-1 flex flex-col min-h-[200px]">
                        <h3 className="font-manrope text-lg font-bold text-[#191c1e] dark:text-[#e4e6f0] mb-4">Actividad Reciente</h3>
                        {actividadReciente.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-gray-400 dark:text-gray-500 font-manrope text-sm font-medium">
                                    Sin actividad reciente
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2.5 overflow-y-auto max-h-[320px] pr-1">
                                {actividadReciente.map(item => (
                                    <div key={item.id} className="flex items-start gap-3 py-2 border-b border-gray-50 dark:border-[#2d3148]/50 last:border-0">
                                        {/* Icono por tipo */}
                                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                            item.icono === 'venta'
                                                ? 'bg-blue-50 dark:bg-blue-900/20 text-primary dark:text-[#5bb3e8]'
                                                : item.icono === 'cisterna'
                                                ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                                        }`}>
                                            {item.icono === 'venta' && <DollarSign size={14} />}
                                            {item.icono === 'cisterna' && <Truck size={14} />}
                                            {item.icono === 'correccion' && <Pencil size={14} />}
                                        </div>
                                        {/* Contenido */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-inter font-bold text-xs text-[#191c1e] dark:text-[#e4e6f0] truncate">
                                                    {item.texto}
                                                </span>
                                                {item.monto && (
                                                    <span className="font-grotesk font-bold text-xs text-primary dark:text-[#5bb3e8] flex-shrink-0">
                                                        {item.monto}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between gap-2 mt-0.5">
                                                <span className="font-inter text-[11px] text-gray-400 dark:text-gray-500 truncate">
                                                    {item.subtexto}
                                                </span>
                                                <span className="font-grotesk text-[10px] text-gray-300 dark:text-gray-600 flex-shrink-0">
                                                    {formatTiempoRelativo(item.tiempo)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MODAL DE CISTERNA */}
            {showCisternaModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center min-h-[100vh]">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCisternaModal(false)}></div>
                    <div className="bg-white dark:bg-[#1e2235] rounded-[16px] p-6 w-full max-w-md shadow-2xl relative z-10 mx-4">
                        <h2 className="font-manrope text-2xl font-bold text-[#191c1e] dark:text-[#e4e6f0] mb-6">Registrar Llegada de Cisterna</h2>
                        <div className="mb-8">
                            <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-2 font-manrope">
                                Litros recibidos
                            </label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="11000" 
                                    value={litrosRecibidos}
                                    onChange={(e) => setLitrosRecibidos(Number(e.target.value))}
                                    className="w-full border-2 border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-[12px] p-4 font-grotesk font-bold text-xl text-[#005e97] dark:text-[#5bb3e8] outline-none focus:border-[#005e97] dark:focus:border-[#5bb3e8] transition-colors"
                                />
                                <span className="absolute right-6 top-1/2 -translate-y-1/2 font-grotesk font-bold text-gray-400 dark:text-gray-500">
                                    Lts
                                </span>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setShowCisternaModal(false)}
                                className="px-5 py-3 font-manrope font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2d3148] rounded-[12px] transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleConfirmarCisterna}
                                className="px-5 py-3 font-manrope font-bold bg-[#005e97] text-white rounded-[12px] hover:bg-[#004b7a] transition-colors shadow-md"
                            >
                                Confirmar Entrada
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TOAST DE ÉXITO */}
            {showToast && (
                <div className="fixed bottom-6 right-6 bg-[#166534] text-white px-6 py-4 rounded-[12px] shadow-2xl font-manrope font-bold z-[200] flex items-center gap-3 animate-bounce">
                    <div className="bg-white/20 p-1 rounded-full"><Droplets size={20} /></div>
                    {toastMsg}
                </div>
            )}
            {/* MODAL CORREGIR VENTA */}
            {ventaCorregir && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setVentaCorregir(null)} />
                    <div className="bg-white dark:bg-[#1e2235] w-full max-w-md rounded-2xl p-6 relative z-10 shadow-2xl mx-4">
                        <div className="flex items-center justify-between mb-5 border-b border-gray-100 dark:border-[#2d3148] pb-4">
                            <h2 className="font-manrope text-xl font-bold flex items-center gap-2 text-amber-600 dark:text-amber-500">
                                <Pencil size={20} /> Corregir Venta
                            </h2>
                            <button onClick={() => setVentaCorregir(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-[#e4e6f0]">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">
                                    Motivo de Corrección <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formMotivo}
                                    onChange={e => setFormMotivo(e.target.value)}
                                    placeholder="Ej: Error de tipeo, método incorrecto..."
                                    className="w-full border-2 border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3 font-inter text-sm outline-none focus:border-amber-500 text-gray-800 dark:text-[#e4e6f0]"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">Cliente</label>
                                <input type="text" value={formCliente} onChange={e => setFormCliente(e.target.value)}
                                    className="w-full border-2 border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-xl p-3 font-inter text-sm outline-none focus:border-primary text-gray-800 dark:text-[#e4e6f0]" />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">Método de Pago</label>
                                <select value={formMetodoPago} onChange={e => setFormMetodoPago(e.target.value)}
                                    className="w-full border-2 border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-xl p-3 font-inter text-sm outline-none focus:border-primary text-gray-800 dark:text-[#e4e6f0]">
                                    <option value="EFECTIVO USD">Efectivo USD</option>
                                    <option value="PAGO MÓVIL">Pago Móvil</option>
                                    <option value="PUNTO DE VENTA">Punto de Venta</option>
                                    <option value="EFECTIVO VES">Efectivo VES</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">Total USD (Inalterable)</label>
                                <input type="text" value={`$${(parseFloat(ventaCorregir.total_usd) || 0).toFixed(2)}`} disabled
                                    className="w-full border-2 border-transparent bg-gray-100 dark:bg-gray-800/50 rounded-xl p-3 font-grotesk text-sm font-bold text-gray-500 cursor-not-allowed" />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setVentaCorregir(null)} className="flex-1 py-3 rounded-xl font-manrope font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-[#2d3148]">
                                Cancelar
                            </button>
                            <button onClick={guardarCorreccion} className="w-full bg-primary hover:bg-[#004b7a] text-white rounded-xl py-3 font-manrope font-bold transition-colors">
                                Guardar Corrección
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DELIVERIES ACTIVOS */}
            {showDeliveriesModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeliveriesModal(false)} />
                    <div className="bg-white dark:bg-[#1e2235] w-full max-w-lg rounded-2xl p-6 relative z-10 shadow-2xl mx-4 max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between mb-5 border-b border-gray-100 dark:border-[#2d3148] pb-4 flex-shrink-0">
                            <h2 className="font-manrope text-xl font-bold flex items-center gap-2 text-[#191c1e] dark:text-[#e4e6f0]">
                                <Truck size={20} className="text-primary dark:text-[#5bb3e8]" /> Entregas en Tránsito
                            </h2>
                            <button onClick={() => setShowDeliveriesModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-[#e4e6f0]">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="overflow-y-auto flex-1 pr-2 space-y-3">
                            {entregasEnTransito.map(v => (
                                <div key={v.id} className="bg-gray-50 dark:bg-[#1a1d27] border border-gray-100 dark:border-[#2d3148] rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-grotesk font-bold text-gray-500 dark:text-gray-400 text-xs">#{v.numero_orden || v.id.slice(0,6)}</span>
                                            <span className="font-manrope font-bold text-[#191c1e] dark:text-[#e4e6f0] text-sm truncate">{v.cliente_nombre}</span>
                                        </div>
                                        <div className="font-inter text-xs text-gray-500 dark:text-gray-400">
                                            Hora: {v.hora} • Total: ${parseFloat(v.total_usd).toFixed(2)}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => !confirmandoIds.has(v.id) && handleCompletarDelivery(v.id)}
                                        disabled={confirmandoIds.has(v.id)}
                                        className={`px-4 py-2 rounded-lg font-manrope font-bold text-xs transition-all duration-300 flex items-center gap-2 ${
                                            confirmandoIds.has(v.id)
                                                ? 'bg-green-500 text-white scale-95 cursor-not-allowed'
                                                : 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-800/50 text-amber-700 dark:text-amber-400 hover:scale-105 cursor-pointer'
                                        }`}
                                    >
                                        {confirmandoIds.has(v.id) ? '✓ Entregado' : '🚚 Marcar Entregado'}
                                    </button>
                                </div>
                            ))}
                            {entregasEnTransito.length === 0 && (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-inter text-sm">
                                    No hay entregas pendientes en este momento.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}