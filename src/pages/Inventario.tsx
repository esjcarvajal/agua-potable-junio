import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAppStore } from '../store/useAppStore'
import { insertRow, readSheet } from '../lib/db'
import {
  Droplets, Filter, ArrowRight, Plus, Minus, Package,
  Download, Truck, X, AlertTriangle, Waves, Clock,
  ShieldCheck, Tag, CircleDot, Box, Snowflake, IceCream,
  GlassWater, Grip, Brush
} from 'lucide-react'
import { getLocalDateString } from '../lib/dateUtils'

/* ════════════════════════════════════════════════════════════════════
   TOAST
   ════════════════════════════════════════════════════════════════════ */
interface ToastState { mensaje: string; tipo: 'success' | 'error' | 'warning'; visible: boolean }
const TOAST_COLORS = { success: '#16a34a', error: '#dc2626', warning: '#d97706' }

function Toast({ toast }: { toast: ToastState }) {
  return (
    <div
      style={{
        position: 'absolute', bottom: 24, right: 24, zIndex: 100,
        background: TOAST_COLORS[toast.tipo], color: 'white',
        padding: '14px 22px', borderRadius: 12,
        fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        opacity: toast.visible ? 1 : 0, transition: 'opacity 0.3s ease',
        pointerEvents: toast.visible ? 'auto' : 'none', maxWidth: 360,
      }}
    >
      {toast.mensaje}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   TYPES
   ════════════════════════════════════════════════════════════════════ */
interface Movimiento {
  id: string
  fecha: string
  hora: string
  tipo: string
  descripcion: string
  litros: number
  estado: string
}

type InsumoTipo = 'tapas' | 'precintos' | 'etiquetas'

const INSUMO_CONFIG: Record<InsumoTipo, { label: string; icon: typeof Package; minimo: number; maximo: number; unidad: string }> = {
  tapas:     { label: 'Tapas de Plástico',       icon: CircleDot,   minimo: 500, maximo: 5000,  unidad: 'unidades' },
  precintos: { label: 'Precintos de Seguridad',  icon: ShieldCheck, minimo: 500, maximo: 5000,  unidad: 'unidades' },
  etiquetas: { label: 'Etiquetas',               icon: Tag,         minimo: 200, maximo: 2000,  unidad: 'unidades' },
}

type ProductoInvTipo = 'botellonNuevo19L' | 'botellonNuevo12L' | 'botellonNuevo5L' | 'tapasReusables' | 'hielo' | 'helado' | 'dispensadorAgua' | 'agarraderosManuales' | 'cepillosLavado'

const PRODUCTO_CONFIG: Record<ProductoInvTipo, { label: string; icon: typeof Package; minimo: number; maximo: number; unidad: string; esInterno: boolean }> = {
  botellonNuevo19L:    { label: 'Botellón Nuevo 19L',  icon: Box,        minimo: 10, maximo: 200, unidad: 'unidades', esInterno: false },
  botellonNuevo12L:    { label: 'Botellón Nuevo 12L',  icon: Box,        minimo: 10, maximo: 200, unidad: 'unidades', esInterno: false },
  botellonNuevo5L:     { label: 'Botellón Nuevo 5L',   icon: Box,        minimo: 10, maximo: 200, unidad: 'unidades', esInterno: false },
  tapasReusables:      { label: 'Tapas Reusables',     icon: CircleDot,  minimo: 50, maximo: 500, unidad: 'unidades', esInterno: false },
  hielo:               { label: 'Bolsa de Hielo',      icon: Snowflake,  minimo: 10, maximo: 100, unidad: 'unidades', esInterno: false },
  helado:              { label: 'Helado',              icon: IceCream,   minimo: 10, maximo: 100, unidad: 'unidades', esInterno: false },
  dispensadorAgua:     { label: 'Dispensador de Agua',  icon: GlassWater, minimo: 2,  maximo: 20,  unidad: 'unidades', esInterno: true },
  agarraderosManuales: { label: 'Agarraderos Manuales', icon: Grip,      minimo: 5,  maximo: 50,  unidad: 'unidades', esInterno: true },
  cepillosLavado:      { label: 'Cepillos de Lavado',  icon: Brush,      minimo: 5,  maximo: 50,  unidad: 'unidades', esInterno: true },
}

/* ════════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function Inventario() {
  const store = useAppStore()
  const {
    litrosJumbo, litrosTanques, tapas, precintos, etiquetas,
    botellonNuevo19L, botellonNuevo12L, botellonNuevo5L,
    tapasReusables, hielo, helado,
    dispensadorAgua, agarraderosManuales, cepillosLavado,
    usdToVes, formatUsd, pushInventario
  } = store

  // ── Movimientos ────────────────────────────────────────────────
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [isLoadingMovimientos, setIsLoadingMovimientos] = useState(true)

  // ── Cisterna ───────────────────────────────────────────────────
  const [litrosCisterna, setLitrosCisterna] = useState(11000)
  const [costoCisterna, setCostoCisterna] = useState(30)

  // ── Agua de rechazo ────────────────────────────────────────────
  const [litrosRechazo, setLitrosRechazo] = useState(100)

  // ── Insumo modal ───────────────────────────────────────────────
  const [showInsumoModal, setShowInsumoModal] = useState(false)
  const [insumoActivo, setInsumoActivo] = useState<InsumoTipo>('tapas')
  const [inputCantidad, setInputCantidad] = useState('')
  const [inputCosto, setInputCosto] = useState('')

  // ── Producto modal ─────────────────────────────────────────────
  const [showProductoModal, setShowProductoModal] = useState(false)
  const [productoActivo, setProductoActivo] = useState<ProductoInvTipo>('botellonNuevo19L')
  const [inputProductoCantidad, setInputProductoCantidad] = useState('')
  const [inputProductoCosto, setInputProductoCosto] = useState('')

  // ── Toast ──────────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastState>({ mensaje: '', tipo: 'success', visible: false })
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((mensaje: string, tipo: 'success' | 'error' | 'warning') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ mensaje, tipo, visible: true })
    const duracion = tipo === 'error' ? 5000 : tipo === 'warning' ? 4000 : 3000
    toastTimer.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }))
    }, duracion)
  }, [])

  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current) }
  }, [])

  // ── Cargar movimientos de Sheets ───────────────────────────────
  useEffect(() => {
    setIsLoadingMovimientos(true)
    readSheet('movimientos_agua').then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setMovimientos(data.map((d: any) => ({
          id: d.id || crypto.randomUUID(),
          fecha: d.fecha || '',
          hora: d.hora || '',
          tipo: d.tipo || '',
          descripcion: d.descripcion || '',
          litros: parseFloat(d.litros) || 0,
          estado: d.estado || 'completado',
        })))
      }
    }).finally(() => setIsLoadingMovimientos(false))
  }, [])

  // ── Helpers ────────────────────────────────────────────────────
  const insumoValues: Record<InsumoTipo, number> = { tapas, precintos, etiquetas }

  const productoValues: Record<ProductoInvTipo, number> = {
    botellonNuevo19L, botellonNuevo12L, botellonNuevo5L,
    tapasReusables, hielo, helado,
    dispensadorAgua, agarraderosManuales, cepillosLavado
  }

  const agregarMovimiento = (mov: Movimiento) => {
    setMovimientos(prev => [mov, ...prev])
  }

  /** ID del tanque que se está consumiendo ahora mismo */
  const tanqueEnConsumoId = useMemo(() => {
    const conAgua = (litrosTanques || []).filter((t: any) => (t.litros || 0) > 0)
    return conAgua.length > 0 ? conAgua[0].id : null
  }, [litrosTanques])

  const tankPercent = Math.min((litrosJumbo / 2500) * 100, 100)

  // ── HANDLERS ───────────────────────────────────────────────────

    const handleRegistrarCisterna = async () => {
        if (litrosCisterna <= 0) {
            showToast('Ingresa una cantidad válida de litros', 'error')
            return
        }

        const resultado = store.registrarCisterna(litrosCisterna)

        const mov: Movimiento = {
            id: crypto.randomUUID(),
            fecha: getLocalDateString(),
            hora: new Date().toLocaleTimeString('es-VE'),
            tipo: 'entrada_cisterna',
            descripcion: `Llegada de cisterna — ${litrosCisterna.toLocaleString('es-VE')} L recibidos`,
            litros: litrosCisterna,
            estado: 'completado',
        }

    agregarMovimiento(mov)

    // Registrar como egreso la compra de cisterna
    // const movEgreso = {
    //   ...mov,
    //   id: crypto.randomUUID(),
    //   tipo: 'egreso_cisterna',
    //   descripcion: `Compra de cisterna — ${formatUsd(costoCisterna)} por ${litrosCisterna.toLocaleString('es-VE')} L`,
    //   costo_usd: costoCisterna,
    // }

    const ok = await insertRow('movimientos_agua', { ...mov, costo_usd: costoCisterna })
    if (!ok) {
      useAppStore.setState(s => ({
        pendientesSync: [...s.pendientesSync, { tipo: 'movimientos_agua', data: { ...mov, costo_usd: costoCisterna } }]
      }))
      showToast('Cisterna registrada localmente — pendiente de sincronización', 'warning')
    } else {
        if (resultado.sobrante > 0) {
            showToast(`Registrado: ${resultado.almacenados.toLocaleString('es-VE')}L | Descartado por capacidad: ${resultado.sobrante.toLocaleString('es-VE')}L`, 'warning')
        } else {
            showToast(`Cisterna registrada — ${litrosCisterna.toLocaleString('es-VE')} L distribuidos correctamente`, 'success')
        }
    }

    setLitrosCisterna(11000)
    setCostoCisterna(30)
  }

  const handleRegistrarRechazo = async () => {
    if (litrosRechazo <= 0) {
      showToast('Ingresa una cantidad válida', 'error')
      return
    }
    if (litrosRechazo > litrosJumbo) {
      showToast('No hay suficiente agua en el Reservorio Maestro', 'error')
      return
    }

    useAppStore.setState(state => ({
      litrosJumbo: Math.max(0, state.litrosJumbo - litrosRechazo),
      litrosMermaHoy: state.litrosMermaHoy + litrosRechazo,
    }))

    const mov: Movimiento = {
      id: crypto.randomUUID(),
      fecha: getLocalDateString(),
      hora: new Date().toLocaleTimeString('es-VE'),
      tipo: 'agua_rechazo',
      descripcion: `Agua de rechazo / lavado — ${litrosRechazo} L descartados`,
      litros: -litrosRechazo,
      estado: 'completado',
    }

    agregarMovimiento(mov)

    const ok = await insertRow('movimientos_agua', mov)
    if (!ok) {
      useAppStore.setState(s => ({
        pendientesSync: [...s.pendientesSync, { tipo: 'movimientos_agua', data: mov }]
      }))
      showToast('Rechazo registrado localmente — pendiente de sincronización', 'warning')
    } else {
      showToast(`${litrosRechazo} L de agua de rechazo registrados`, 'success')
    }

    setLitrosRechazo(100)
  }

  const handleRegistrarInsumo = async () => {
    const cantidad = parseInt(inputCantidad) || 0
    const costo = parseFloat(inputCosto) || 0

    if (cantidad <= 0) {
      showToast('La cantidad debe ser mayor a cero', 'error')
      return
    }

    // Actualizar store
    useAppStore.setState(state => ({
      [insumoActivo]: (state[insumoActivo] as number) + cantidad
    }))
    // Publicar snapshot al cloud
    setTimeout(() => pushInventario(), 500)

    const registro = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      tipo: insumoActivo,
      cantidad,
      costo_usd: costo,
      descripcion: `Compra de ${INSUMO_CONFIG[insumoActivo].label}: ${cantidad} ${INSUMO_CONFIG[insumoActivo].unidad}`,
    }

    const ok = await insertRow('inventario_insumos', registro)
    if (!ok) {
      useAppStore.setState(s => ({
        pendientesSync: [...s.pendientesSync, { tipo: 'inventario_insumos', data: registro }]
      }))
      showToast('Insumo registrado localmente — pendiente de sincronización', 'warning')
    } else {
      showToast(`${cantidad} ${INSUMO_CONFIG[insumoActivo].unidad} de ${INSUMO_CONFIG[insumoActivo].label} registradas`, 'success')
    }

    // Registrar movimiento también
    const mov: Movimiento = {
      id: crypto.randomUUID(),
      fecha: getLocalDateString(),
      hora: new Date().toLocaleTimeString('es-VE'),
      tipo: 'compra_insumo',
      descripcion: `Compra de ${INSUMO_CONFIG[insumoActivo].label} — ${cantidad} uds por ${formatUsd(costo)}`,
      litros: 0,
      estado: 'completado',
    }
    agregarMovimiento(mov)

    setInputCantidad('')
    setInputCosto('')
    setShowInsumoModal(false)
  }

  const handleRegistrarProducto = async () => {
    const cantidad = parseInt(inputProductoCantidad) || 0
    const costo = parseFloat(inputProductoCosto) || 0

    if (cantidad <= 0) {
      showToast('La cantidad debe ser mayor a cero', 'error')
      return
    }

    // Actualizar store
    useAppStore.setState(state => ({
      [productoActivo]: ((state as any)[productoActivo] as number) + cantidad
    }))
    // Publicar snapshot al cloud
    setTimeout(() => pushInventario(), 500)

    const config = PRODUCTO_CONFIG[productoActivo]
    const registro = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      tipo: productoActivo,
      cantidad,
      costo_usd: costo,
      descripcion: `Compra de ${config.label}: ${cantidad} ${config.unidad}`,
    }

    const ok = await insertRow('inventario_productos', registro)
    if (!ok) {
      useAppStore.setState(s => ({
        pendientesSync: [...s.pendientesSync, { tipo: 'inventario_productos', data: registro }]
      }))
      showToast('Producto registrado localmente — pendiente de sincronización', 'warning')
    } else {
      showToast(`${cantidad} ${config.unidad} de ${config.label} registradas`, 'success')
    }

    // Registrar movimiento
    const mov: Movimiento = {
      id: crypto.randomUUID(),
      fecha: getLocalDateString(),
      hora: new Date().toLocaleTimeString('es-VE'),
      tipo: 'compra_producto',
      descripcion: `Compra de ${config.label} — ${cantidad} uds por ${formatUsd(costo)}`,
      litros: 0,
      estado: 'completado',
    }
    agregarMovimiento(mov)

    setInputProductoCantidad('')
    setInputProductoCosto('')
    setShowProductoModal(false)
  }

  const exportarCSV = () => {
    if (movimientos.length === 0) {
      showToast('No hay movimientos para exportar', 'warning')
      return
    }

    const headers = ['Fecha', 'Hora', 'Tipo', 'Descripción', 'Litros', 'Estado']
    const rows = movimientos.map(m => [
      m.fecha, m.hora, m.tipo, m.descripcion, String(m.litros), m.estado
    ])

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `movimientos_agua_${getLocalDateString()}.csv`
    link.click()
    URL.revokeObjectURL(url)

    showToast('Archivo CSV descargado correctamente', 'success')
  }

  const tipoLabels: Record<string, string> = {
    entrada_cisterna: 'Entrada Cisterna',
    agua_rechazo: 'Agua de Rechazo',
    compra_insumo: 'Compra de Insumo',
    venta: 'Venta',
    ajuste: 'Ajuste',
    compra_producto: 'Compra de Producto',
  }

  const tipoColors: Record<string, { bg: string; text: string; darkBg: string; darkText: string }> = {
    entrada_cisterna: { bg: '#dcfce7', text: '#166534', darkBg: '#14532d', darkText: '#86efac' },
    agua_rechazo:     { bg: '#fef3c7', text: '#92400e', darkBg: '#78350f', darkText: '#fde68a' },
    compra_insumo:    { bg: '#dbeafe', text: '#1e40af', darkBg: '#1e3a5f', darkText: '#93c5fd' },
    compra_producto:  { bg: '#ede9fe', text: '#5b21b6', darkBg: '#4c1d95', darkText: '#c4b5fd' },
    venta:            { bg: '#f3e8ff', text: '#6b21a8', darkBg: '#4c1d95', darkText: '#c4b5fd' },
    ajuste:           { bg: '#f3f4f6', text: '#374151', darkBg: '#374151', darkText: '#d1d5db' },
  }

  /* ══════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="relative min-h-[calc(100vh-57px)] -m-6 bg-[#f7f9fc] dark:bg-[#0f1117] p-6 overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-manrope text-2xl font-bold text-[#191c1e] dark:text-[#e4e6f0]">
          Control de Inventario
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm font-inter mt-0.5">
          Agua Potable La Campiña — Flujo de producción, insumos y movimientos
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
         SECCIÓN 1 — FLUJO DE PRODUCCIÓN
         ═══════════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <h2 className="font-manrope text-base font-bold text-gray-500 dark:text-gray-400 tracking-wider mb-4 uppercase text-xs">
          Flujo de Producción
        </h2>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* ── Etapa 1: Grid de Tanques de Almacenamiento ───────── */}
          {/* El sistema vacía los tanques crudos en orden: el que se está
              consumiendo ahora mismo es el primero que aún tiene agua. */}
          <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <Droplets size={16} className="text-primary dark:text-[#5bb3e8]" />
              <span className="font-manrope font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]">
                Red de Tanques
              </span>
              <span className="text-[10px] font-grotesk font-bold text-gray-400 dark:text-gray-500 ml-auto bg-gray-100 dark:bg-[#1a1d27] px-2 py-0.5 rounded-full">
                11 TANQUES
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {litrosTanques.map(t => {
                const pct = Math.min(t.litros / t.capacidad, 1)
                const pctNum = Math.round(pct * 100)
                const isLow = t.litros < 200
                // El tanque en consumo es el primero con agua: el sistema
                // vacía los tanques crudos en orden antes de filtrar.
                const enConsumo = t.id === tanqueEnConsumoId
                return (
                  <div
                    key={t.id}
                    className={`rounded-lg p-1.5 transition-all ${
                      enConsumo
                        ? 'bg-blue-50 dark:bg-[#1a2740] ring-2 ring-primary dark:ring-[#5bb3e8]'
                        : 'bg-gray-50 dark:bg-[#1a1d27]'
                    }`}
                    title={`${t.nombre}: ${Math.round(t.litros)}L / ${t.capacidad}L`}
                  >
                    <div className="relative">
                      <img
                        src="/tanques/tanque-1000.webp"
                        alt={t.nombre}
                        loading="lazy"
                        className="w-full h-auto object-contain"
                        style={{ opacity: pct < 0.05 ? 0.35 : 1 }}
                      />
                      {enConsumo && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 motion-reduce:hidden" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary dark:bg-[#5bb3e8]" />
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-center leading-none">
                      <span className="font-grotesk text-[9px] font-bold text-gray-400 dark:text-gray-500">
                        {t.id.replace('TK-', 'T')}
                      </span>
                      <span className={`font-grotesk text-[10px] font-bold ml-1 ${
                        isLow ? 'text-tertiary dark:text-amber-500' : 'text-primary dark:text-[#5bb3e8]'
                      }`}>
                        {pctNum}%
                      </span>
                    </div>
                    {/* Barra de nivel */}
                    <div className="mt-1 h-1 w-full rounded-full bg-gray-200 dark:bg-[#2d3148] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{
                          width: `${pctNum}%`,
                          backgroundColor: isLow ? '#8b4800' : '#005e97',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 text-center">
              <span className="font-grotesk text-xs text-gray-400 dark:text-gray-500">
                Total: <span className="font-bold text-[#191c1e] dark:text-[#e4e6f0]">
                  {Math.round(litrosTanques.reduce((s, t) => s + t.litros, 0)).toLocaleString('es-VE')} L
                </span>
                <span className="text-gray-300 dark:text-gray-600"> / 11,000 L</span>
              </span>
            </div>
          </div>

          {/* ── Flecha con filtro ─────────────────────────────────── */}
          <div className="flex lg:flex-col items-center justify-center gap-1 py-2 lg:py-0 lg:px-2">
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-[#1a1d27] flex items-center justify-center">
              <Filter size={16} className="text-primary dark:text-[#5bb3e8]" />
            </div>
            <ArrowRight size={20} className="text-gray-300 dark:text-gray-600 rotate-90 lg:rotate-0" />
          </div>

          {/* ── Etapa 2: Reservorio Maestro ────────────────────── */}
          <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <Waves size={16} className="text-primary dark:text-[#5bb3e8]" />
              <span className="font-manrope font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]">
                Reservorio Maestro
              </span>
              <span className="text-[10px] font-grotesk font-bold text-gray-400 dark:text-gray-500 ml-auto bg-gray-100 dark:bg-[#1a1d27] px-2 py-0.5 rounded-full">
                MÁX 2,500 L
              </span>
            </div>
            {/* Reservorio: foto real con nivel de llenado */}
            <div className="rounded-[16px] bg-gray-50 dark:bg-[#1a1d27] p-3 flex items-center gap-4">
              <img
                src="/tanques/tanque-2500.webp"
                alt="Reservorio Maestro 2.500 L"
                loading="lazy"
                className="h-[150px] w-auto object-contain flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="font-grotesk font-bold text-[34px] leading-none text-primary dark:text-[#5bb3e8]">
                  {Math.round(tankPercent)}%
                </div>
                <p className="font-inter text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 mb-2">
                  de su capacidad
                </p>
                <div className="h-2.5 w-full rounded-full bg-gray-200 dark:bg-[#2d3148] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0077be] to-[#005e97] transition-all duration-1000 ease-out"
                    style={{ width: `${tankPercent}%` }}
                  />
                </div>
                <p className="font-inter text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                  Agua filtrada lista para despacho
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="font-grotesk text-2xl font-bold text-primary dark:text-[#5bb3e8]">
                {Math.round(litrosJumbo).toLocaleString('es-VE')} L
              </span>
              <span className={`text-[10px] font-grotesk font-bold px-2 py-0.5 rounded-full ${
                tankPercent > 50
                  ? 'bg-[#dcfce7] text-[#166534] dark:bg-[#14532d] dark:text-[#86efac]'
                  : tankPercent > 20
                    ? 'bg-[#fef3c7] text-[#92400e] dark:bg-[#78350f] dark:text-[#fde68a]'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {tankPercent > 50 ? '● ÓPTIMO' : tankPercent > 20 ? '● MEDIO' : '● BAJO'}
              </span>
            </div>
          </div>

          {/* ── Flecha ────────────────────────────────────────────── */}
          <div className="flex lg:flex-col items-center justify-center gap-1 py-2 lg:py-0 lg:px-2">
            <ArrowRight size={20} className="text-gray-300 dark:text-gray-600 rotate-90 lg:rotate-0" />
          </div>

          {/* ── Etapa 3: Panel de Acciones ─────────────────────── */}
          <div className="flex flex-col gap-4 flex-1 min-w-0">
            {/* Card: Registrar Cisterna */}
            <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Truck size={16} className="text-primary dark:text-[#5bb3e8]" />
                <span className="font-manrope font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]">
                  Registrar Llegada de Cisterna
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="1"
                    max="13500"
                    value={litrosCisterna}
                    onChange={e => setLitrosCisterna(Number(e.target.value))}
                    className="w-full border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-3 font-grotesk
                      text-lg font-bold text-primary dark:text-[#5bb3e8] outline-none
                      focus:border-primary dark:focus:border-[#5bb3e8] transition-colors
                      bg-white dark:bg-[#1a1d27]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-grotesk font-bold text-gray-400 dark:text-gray-500 text-sm">
                    Lts
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-grotesk text-gray-400 dark:text-gray-500 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={costoCisterna}
                    onChange={e => setCostoCisterna(Number(e.target.value))}
                    className="w-full pl-7 border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-3 font-grotesk
                      text-sm font-bold text-[#191c1e] dark:text-[#e4e6f0] outline-none
                      focus:border-primary dark:focus:border-[#5bb3e8] transition-colors
                      bg-white dark:bg-[#1a1d27]"
                    placeholder="Costo USD"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-inter text-gray-400 dark:text-gray-500 text-[10px]">
                    Costo
                  </span>
                </div>
              </div>
              <button
                onClick={handleRegistrarCisterna}
                className="w-full py-2.5 rounded-xl font-manrope font-bold text-white text-sm
                  shadow-md hover:shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
              >
                Confirmar Entrada
              </button>
            </div>

            {/* Card: Agua de Rechazo */}
            <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm flex-1">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-[#8b4800] dark:text-[#e8a060]" />
                <span className="font-manrope font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]">
                  Agua de Rechazo / Lavado
                </span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setLitrosRechazo(prev => Math.max(0, prev - 50))}
                  className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-[#1a1d27] flex items-center justify-center
                    hover:bg-gray-200 dark:hover:bg-[#2d3148] transition-colors text-gray-600 dark:text-gray-400"
                >
                  <Minus size={16} />
                </button>
                <input
                  type="number"
                  min="0"
                  value={litrosRechazo}
                  onChange={e => setLitrosRechazo(Math.max(0, Number(e.target.value)))}
                  className="flex-1 text-center border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-2.5
                    font-grotesk text-lg font-bold text-[#8b4800] dark:text-[#e8a060] outline-none
                    focus:border-[#8b4800] dark:focus:border-[#e8a060] transition-colors
                    bg-white dark:bg-[#1a1d27]"
                />
                <button
                  onClick={() => setLitrosRechazo(prev => prev + 50)}
                  className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-[#1a1d27] flex items-center justify-center
                    hover:bg-gray-200 dark:hover:bg-[#2d3148] transition-colors text-gray-600 dark:text-gray-400"
                >
                  <Plus size={16} />
                </button>
              </div>
              <button
                onClick={handleRegistrarRechazo}
                className="w-full py-2.5 rounded-xl font-manrope font-bold text-sm
                  bg-[#fef3c7] dark:bg-[#78350f] text-[#92400e] dark:text-[#fde68a]
                  hover:bg-[#fde68a] dark:hover:bg-[#92400e] transition-colors"
              >
                Registrar Descarte
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
         SECCIÓN 2 — INSUMOS
         ═══════════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <h2 className="font-manrope text-base font-bold text-gray-500 dark:text-gray-400 tracking-wider mb-4 uppercase text-xs">
          Insumos
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.keys(INSUMO_CONFIG) as InsumoTipo[]).map(tipo => {
            const config = INSUMO_CONFIG[tipo]
            const valor = insumoValues[tipo]
            const esBajo = valor < config.minimo
            const pct = Math.min((valor / config.maximo) * 100, 100)
            const Icon = config.icon

            return (
              <div
                key={tipo}
                className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm relative"
              >
                {/* Badge STOCK BAJO */}
                {esBajo && (
                  <div className="absolute top-4 right-4">
                    <span className="text-[10px] font-grotesk font-bold px-2 py-0.5 rounded-full
                      bg-[#fef3c7] text-[#92400e] dark:bg-[#78350f] dark:text-[#fde68a]
                      flex items-center gap-1">
                      <AlertTriangle size={10} />
                      STOCK BAJO
                    </span>
                  </div>
                )}

                {/* Ícono + Título */}
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    esBajo
                      ? 'bg-[#fef3c7] dark:bg-[#78350f]'
                      : 'bg-blue-50 dark:bg-[#1a1d27]'
                  }`}>
                    <Icon size={18} className={
                      esBajo
                        ? 'text-[#92400e] dark:text-[#fde68a]'
                        : 'text-primary dark:text-[#5bb3e8]'
                    } />
                  </div>
                  <span className="font-manrope font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]">
                    {config.label}
                  </span>
                </div>

                {/* Valor grande */}
                <div className="font-grotesk text-[32px] font-bold text-[#191c1e] dark:text-[#e4e6f0] leading-tight mb-1">
                  {valor.toLocaleString('es-VE')}
                </div>
                <div className="font-grotesk text-xs text-gray-400 dark:text-gray-500 mb-3">
                  {config.unidad} · mínimo: {config.minimo.toLocaleString('es-VE')}
                </div>

                {/* Barra de progreso */}
                <div className="w-full bg-gray-100 dark:bg-[#1a1d27] rounded-full h-2 mb-4 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: esBajo ? '#d97706' : '#005e97',
                    }}
                  />
                </div>

                {/* Botón + */}
                <button
                  onClick={() => { setInsumoActivo(tipo); setInputCantidad(''); setInputCosto(''); setShowInsumoModal(true) }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-manrope font-bold text-sm
                    border-2 border-gray-200 dark:border-[#2d3148] text-gray-600 dark:text-gray-300
                    hover:border-primary dark:hover:border-[#5bb3e8] hover:text-primary dark:hover:text-[#5bb3e8]
                    hover:bg-blue-50 dark:hover:bg-[#1a1d27] transition-all cursor-pointer"
                >
                  <Plus size={16} />
                  Registrar Compra
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
         SECCIÓN 2.5 — PRODUCTOS DE INVENTARIO
         ═══════════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <h2 className="font-manrope text-base font-bold text-gray-500 dark:text-gray-400 tracking-wider mb-4 uppercase text-xs">
          Productos de Inventario
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {(Object.keys(PRODUCTO_CONFIG) as ProductoInvTipo[]).map(tipo => {
            const config = PRODUCTO_CONFIG[tipo]
            const valor = productoValues[tipo]
            const esBajo = valor < config.minimo
            const pct = Math.min((valor / config.maximo) * 100, 100)
            const Icon = config.icon

            return (
              <div
                key={tipo}
                className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm relative"
              >
                {/* Badge STOCK BAJO */}
                {esBajo && (
                  <div className="absolute top-4 right-4">
                    <span className="text-[10px] font-grotesk font-bold px-2 py-0.5 rounded-full
                      bg-[#fef3c7] text-[#92400e] dark:bg-[#78350f] dark:text-[#fde68a]
                      flex items-center gap-1">
                      <AlertTriangle size={10} />
                      BAJO
                    </span>
                  </div>
                )}

                {/* Ícono + Título */}
                <div className="flex items-center gap-2 mb-4 pr-16">
                  <div className={`w-9 h-9 rounded-xl flex shrink-0 items-center justify-center ${
                    esBajo
                      ? 'bg-[#fef3c7] dark:bg-[#78350f]'
                      : 'bg-blue-50 dark:bg-[#1a1d27]'
                  }`}>
                    <Icon size={18} className={
                      esBajo
                        ? 'text-[#92400e] dark:text-[#fde68a]'
                        : 'text-primary dark:text-[#5bb3e8]'
                    } />
                  </div>
                  <span className="font-manrope font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0] leading-tight">
                    {config.label}
                  </span>
                </div>

                {/* Valor grande */}
                <div className="font-grotesk text-[32px] font-bold text-[#191c1e] dark:text-[#e4e6f0] leading-tight mb-1">
                  {valor.toLocaleString('es-VE')}
                </div>
                <div className="font-grotesk text-xs text-gray-400 dark:text-gray-500 mb-3">
                  {config.unidad} · mínimo: {config.minimo.toLocaleString('es-VE')}
                </div>

                {/* Barra de progreso */}
                <div className="w-full bg-gray-100 dark:bg-[#1a1d27] rounded-full h-2 mb-4 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: esBajo ? '#d97706' : '#005e97',
                    }}
                  />
                </div>

                {/* Botón + */}
                <button
                  onClick={() => { setProductoActivo(tipo); setInputProductoCantidad(''); setInputProductoCosto(''); setShowProductoModal(true) }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-manrope font-bold text-sm
                    border-2 border-gray-200 dark:border-[#2d3148] text-gray-600 dark:text-gray-300
                    hover:border-primary dark:hover:border-[#5bb3e8] hover:text-primary dark:hover:text-[#5bb3e8]
                    hover:bg-blue-50 dark:hover:bg-[#1a1d27] transition-all cursor-pointer"
                >
                  <Plus size={16} />
                  Registrar
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
         SECCIÓN 3 — HISTORIAL DE MOVIMIENTOS
         ═══════════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-manrope text-base font-bold text-gray-500 dark:text-gray-400 tracking-wider uppercase text-xs">
            Historial de Movimientos
          </h2>
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-manrope font-bold text-sm
              bg-white dark:bg-[#1e2235] border-2 border-gray-200 dark:border-[#2d3148]
              text-gray-600 dark:text-gray-300 hover:border-primary dark:hover:border-[#5bb3e8]
              hover:text-primary dark:hover:text-[#5bb3e8] transition-all cursor-pointer shadow-sm"
          >
            <Download size={14} />
            Exportar CSV
          </button>
        </div>

        <div className="bg-white dark:bg-[#1e2235] rounded-[12px] shadow-sm overflow-hidden">
          {isLoadingMovimientos ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <Droplets size={40} className="mb-3 opacity-30 animate-pulse" />
              <p className="font-inter text-sm">Cargando movimientos...</p>
            </div>
          ) : movimientos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <Clock size={48} className="mb-4 opacity-20" />
              <p className="font-manrope font-bold text-lg text-gray-400 dark:text-gray-500 mb-1">
                Sin movimientos registrados
              </p>
              <p className="font-inter text-sm text-gray-400 dark:text-gray-500 text-center max-w-xs">
                Registra la primera entrada de cisterna o movimiento de inventario en Agua Potable La Campiña
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-[#2d3148] font-manrope">
                    <th className="py-3 px-4 font-medium">Fecha / Hora</th>
                    <th className="py-3 px-4 font-medium">Tipo</th>
                    <th className="py-3 px-4 font-medium">Descripción</th>
                    <th className="py-3 px-4 font-medium text-right">Litros</th>
                    <th className="py-3 px-4 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.slice(0, 25).map((m) => {
                    const colors = tipoColors[m.tipo] || tipoColors.ajuste
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-gray-50 dark:border-[#2d3148]/50 last:border-0
                          hover:bg-[#f7f9fc] dark:hover:bg-[#1a1d27] transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-grotesk font-medium text-[#191c1e] dark:text-[#e4e6f0]">
                            {m.fecha}
                          </div>
                          <div className="font-grotesk text-xs text-gray-400 dark:text-gray-500">
                            {m.hora}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className="text-[10px] font-grotesk font-bold px-2 py-0.5 rounded-full tracking-wider inline-block"
                            style={{
                              background: colors.bg,
                              color: colors.text,
                            }}
                          >
                            {(tipoLabels[m.tipo] || m.tipo).toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-inter text-[#191c1e] dark:text-[#e4e6f0] max-w-[260px] truncate">
                          {m.descripcion}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className={`font-grotesk font-bold ${
                            m.litros > 0
                              ? 'text-[#166534] dark:text-[#86efac]'
                              : m.litros < 0
                                ? 'text-[#dc2626] dark:text-[#fca5a5]'
                                : 'text-gray-400 dark:text-gray-500'
                          }`}>
                            {m.litros > 0 ? '+' : ''}{m.litros !== 0 ? `${m.litros.toLocaleString('es-VE')} L` : '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-[10px] font-grotesk font-bold px-2 py-0.5 rounded-full tracking-widest
                            bg-[#dcfce7] text-[#166534] dark:bg-[#14532d] dark:text-[#86efac] inline-block">
                            COMPLETADO
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
         MODAL — REGISTRAR COMPRA DE INSUMO
         ═══════════════════════════════════════════════════════════════ */}
      {showInsumoModal && (() => {
        const config = INSUMO_CONFIG[insumoActivo]
        const Icon = config.icon
        const cantidadNum = parseInt(inputCantidad) || 0
        const costoNum = parseFloat(inputCosto) || 0

        return (
          <div className="absolute inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowInsumoModal(false)} />
            <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-6 w-full max-w-md relative z-10 mx-4 max-h-[90vh] overflow-y-auto"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-manrope text-xl font-bold text-[#191c1e] dark:text-[#e4e6f0]">
                  Registrar Compra
                </h2>
                <button onClick={() => setShowInsumoModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X size={20} />
                </button>
              </div>

              {/* Insumo seleccionado */}
              <div className="bg-blue-50 dark:bg-[#1a1d27] rounded-xl px-4 py-3 mb-5 flex items-center gap-3 border border-blue-100 dark:border-[#2d3148]">
                <Icon size={20} className="text-primary dark:text-[#5bb3e8]" />
                <div>
                  <span className="font-manrope font-bold text-sm text-primary dark:text-[#5bb3e8]">
                    {config.label}
                  </span>
                  <div className="font-grotesk text-xs text-gray-500 dark:text-gray-400">
                    Stock actual: {insumoValues[insumoActivo].toLocaleString('es-VE')} {config.unidad}
                  </div>
                </div>
              </div>

              {/* Cantidad */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">
                  Cantidad ({config.unidad})
                </label>
                <input
                  type="number"
                  min="1"
                  value={inputCantidad}
                  onChange={e => setInputCantidad(e.target.value)}
                  placeholder="Ej: 1000"
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-3 font-grotesk text-lg font-bold
                    text-[#191c1e] dark:text-[#e4e6f0] outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors
                    bg-white dark:bg-[#1a1d27]"
                />
              </div>

              {/* Costo */}
              <div className="mb-5">
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">
                  Costo (USD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={inputCosto}
                  onChange={e => setInputCosto(e.target.value)}
                  placeholder="0.00"
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-3 font-grotesk text-lg font-bold
                    text-primary dark:text-[#5bb3e8] outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors
                    bg-white dark:bg-[#1a1d27]"
                />
              </div>

              {/* Resumen */}
              {cantidadNum > 0 && (
                <div className="bg-gray-50 dark:bg-[#1a1d27] rounded-xl p-4 mb-5 border border-gray-100 dark:border-[#2d3148]">
                  <p className="text-xs font-manrope font-bold text-gray-400 dark:text-gray-500 tracking-wider mb-2">
                    RESUMEN
                  </p>
                  <div className="font-inter text-sm text-gray-700 dark:text-gray-300 mb-1">
                    Nuevo stock: <span className="font-grotesk font-bold text-[#191c1e] dark:text-[#e4e6f0]">
                      {(insumoValues[insumoActivo] + cantidadNum).toLocaleString('es-VE')}
                    </span> {config.unidad}
                  </div>
                  {costoNum > 0 && (
                    <div className="font-inter text-sm text-gray-700 dark:text-gray-300">
                      Inversión: <span className="font-grotesk font-bold text-primary dark:text-[#5bb3e8]">
                        {formatUsd(costoNum)}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 ml-1 font-grotesk text-xs">
                        ({usdToVes(costoNum)})
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowInsumoModal(false)}
                  className="flex-1 py-3 rounded-xl font-manrope font-bold text-gray-500 dark:text-gray-400
                    hover:bg-gray-100 dark:hover:bg-[#1a1d27] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRegistrarInsumo}
                  className="flex-1 py-3 rounded-xl font-manrope font-bold text-white shadow-md transition-colors"
                  style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
                >
                  Registrar Compra
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ═══════════════════════════════════════════════════════════════
         MODAL — REGISTRAR COMPRA DE PRODUCTO
         ═══════════════════════════════════════════════════════════════ */}
      {showProductoModal && (() => {
        const config = PRODUCTO_CONFIG[productoActivo]
        const Icon = config.icon
        const cantidadNum = parseInt(inputProductoCantidad) || 0
        const costoNum = parseFloat(inputProductoCosto) || 0

        return (
          <div className="absolute inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowProductoModal(false)} />
            <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-6 w-full max-w-md relative z-10 mx-4 max-h-[90vh] overflow-y-auto"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-manrope text-xl font-bold text-[#191c1e] dark:text-[#e4e6f0]">
                  Registrar Compra
                </h2>
                <button onClick={() => setShowProductoModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X size={20} />
                </button>
              </div>

              {/* Producto seleccionado */}
              <div className="bg-blue-50 dark:bg-[#1a1d27] rounded-xl px-4 py-3 mb-5 flex items-center gap-3 border border-blue-100 dark:border-[#2d3148]">
                <Icon size={20} className="text-primary dark:text-[#5bb3e8]" />
                <div>
                  <span className="font-manrope font-bold text-sm text-primary dark:text-[#5bb3e8]">
                    {config.label}
                  </span>
                  <div className="font-grotesk text-xs text-gray-500 dark:text-gray-400">
                    Stock actual: {productoValues[productoActivo].toLocaleString('es-VE')} {config.unidad}
                  </div>
                </div>
              </div>

              {/* Cantidad */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">
                  Cantidad ({config.unidad})
                </label>
                <input
                  type="number"
                  min="1"
                  value={inputProductoCantidad}
                  onChange={e => setInputProductoCantidad(e.target.value)}
                  placeholder="Ej: 50"
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-3 font-grotesk text-lg font-bold
                    text-[#191c1e] dark:text-[#e4e6f0] outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors
                    bg-white dark:bg-[#1a1d27]"
                />
              </div>

              {/* Costo */}
              <div className="mb-5">
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">
                  Costo (USD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={inputProductoCosto}
                  onChange={e => setInputProductoCosto(e.target.value)}
                  placeholder="0.00"
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-3 font-grotesk text-lg font-bold
                    text-primary dark:text-[#5bb3e8] outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors
                    bg-white dark:bg-[#1a1d27]"
                />
              </div>

              {/* Resumen */}
              {cantidadNum > 0 && (
                <div className="bg-gray-50 dark:bg-[#1a1d27] rounded-xl p-4 mb-5 border border-gray-100 dark:border-[#2d3148]">
                  <p className="text-xs font-manrope font-bold text-gray-400 dark:text-gray-500 tracking-wider mb-2">
                    RESUMEN
                  </p>
                  <div className="font-inter text-sm text-gray-700 dark:text-gray-300 mb-1">
                    Nuevo stock: <span className="font-grotesk font-bold text-[#191c1e] dark:text-[#e4e6f0]">
                      {(productoValues[productoActivo] + cantidadNum).toLocaleString('es-VE')}
                    </span> {config.unidad}
                  </div>
                  {costoNum > 0 && (
                    <div className="font-inter text-sm text-gray-700 dark:text-gray-300">
                      Inversión: <span className="font-grotesk font-bold text-primary dark:text-[#5bb3e8]">
                        {formatUsd(costoNum)}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500 ml-1 font-grotesk text-xs">
                        ({usdToVes(costoNum)})
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowProductoModal(false)}
                  className="flex-1 py-3 rounded-xl font-manrope font-bold text-gray-500 dark:text-gray-400
                    hover:bg-gray-100 dark:hover:bg-[#1a1d27] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRegistrarProducto}
                  className="flex-1 py-3 rounded-xl font-manrope font-bold text-white shadow-md transition-colors"
                  style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
                >
                  Registrar Compra
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── TOAST ──────────────────────────────────────────────────── */}
      <Toast toast={toast} />
    </div>
  )
}