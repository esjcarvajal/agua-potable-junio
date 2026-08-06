import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useAuthStore } from '../store/useAuthStore'
import { insertRow, readSheet } from '../lib/db'
import { useConfig } from '../lib/useConfig'
import {
  TrendingUp, Droplets, DollarSign, BarChart3, Calendar,
  Printer, X, Clock, FileText, ChevronRight,
  Package, ShieldCheck, AlertTriangle, Loader2, AlertCircle
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Legend, Tooltip as ReTooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid
} from 'recharts'
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
   CONSTANTS
   ════════════════════════════════════════════════════════════════════ */
const COSTO_AGUA_POR_LITRO = 0.015 // USD por litro — costo promedio del agua

const PIE_COLORS = ['#005e97', '#0077be', '#455f88', '#8b4800', '#16a34a', '#6b7280']

// Color semántico fijo por método de pago (coincide con los puntos de la leyenda)
const METODO_COLORES: Record<string, string> = {
  efectivo_usd:    '#16a34a',   // verde — efectivo
  efectivo_ves:    '#84cc16',   // lima — bolívares
  pago_movil:      '#f59e0b',   // ámbar — móvil
  punto_venta:     '#0077be',   // azul — punto de venta
  prepago_cliente: '#8b5cf6',   // púrpura — prepago
  pago_mixto:      '#ec4899',   // rosa — mixto
  post_pago:       '#ef4444',   // rojo — crédito
  otro:            '#6b7280',   // gris — otro
}

const METODO_LABELS: Record<string, string> = {
  efectivo_usd: 'Efectivo USD',
  pago_movil: 'Pago Móvil',
  punto_venta: 'Punto de Venta',
  efectivo_ves: 'Efectivo VES',
  prepago_cliente: 'Prepago Cliente',
  pago_mixto: 'Pago Mixto',
}

interface NotaCredito {
  id: string
  concepto: string
  montoUsd: number
  tipo: 'egreso_extraordinario' | 'donacion' | 'descuento'
}

interface CierreData {
  id: string
  fecha: string
  hora_cierre: string
  tipo_cierre?: 'diario' | 'semanal' | 'mensual'
  ingresos_usd: number
  ingresos_pago_movil_usd?: number
  ingresos_punto_venta_usd?: number
  ingresos_banco_usd?: number
  litros_vendidos: number
  litros_restantes: number
  utilidad_estimada_usd: number
  utilidad_neta_usd?: number
  total_ventas: number
  tapas_usadas: number
  tapas_restantes: number
  precintos_usados: number
  precintos_restantes: number
  desglose_productos_json: string
  desglose_pagos_json: string
  raw_ventas_json: string
  operario: string
  estacion: string
  deudas_pendientes_usd?: number
  cobros_postpago_usd?: number
  egresos_salarios_usd?: number
  egresos_alquiler_usd?: number
  egresos_proveedores_json?: string
  notas_credito_json?: string
  es_automatico?: boolean
}

/* ════════════════════════════════════════════════════════════════════
   DATE UTILS
   ════════════════════════════════════════════════════════════════════ */
function hoyStr(): string {
  return getLocalDateString()
}

function ayerStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return getLocalDateString(d)
}

function inicioSemanaStr(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1 // Monday = start
  d.setDate(d.getDate() - diff)
  return getLocalDateString(d)
}

function inicioMesStr(): string {
  const d = new Date()
  return getLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1))
}

function formatFechaCorta(fecha: string): string {
  if (!fecha) return '—'
  // Handle full ISO strings like 2026-04-18T04:00:00.000Z
  const datePart = fecha.split('T')[0]
  const [, m, d] = datePart.split('-')
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${parseInt(d)} ${meses[parseInt(m) - 1] || m}`
}

function normalizarFecha(fecha: string): string {
  if (!fecha) return '—'
  // Strips time part from ISO strings
  return fecha.split('T')[0]
}

/* ════════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function Reportes() {
  const store = useAppStore()
  const { ventas, litrosJumbo, tapas, precintos, tasaBcv, usdToVes, formatUsd } = store
  const config = useConfig()
  const { usuarios } = useAuthStore()

  // ── Dark mode detection for Recharts ───────────────────────────
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // ── Cierres ────────────────────────────────────────────────────
  const [cierres, setCierres] = useState<CierreData[]>([])
  const [isLoadingCierres, setIsLoadingCierres] = useState(true)
  const [showCierreModal, setShowCierreModal] = useState(false)
  const [cierreActual, setCierreActual] = useState<CierreData | null>(null)
  const [tabCierre, setTabCierre] = useState<'acumulado' | 'detallado'>('acumulado')
  const [isGeneratingCierre, setIsGeneratingCierre] = useState(false)

  // ── Notas de crédito (estado temporal del modal) ───────────────────
  const [notasCredito, setNotasCredito] = useState<NotaCredito[]>([])
  const [showNotaModal, setShowNotaModal] = useState(false)
  const [notaConcepto, setNotaConcepto] = useState('')
  const [notaMonto, setNotaMonto] = useState('')
  const [notaTipo, setNotaTipo] = useState<NotaCredito['tipo']>('egreso_extraordinario')

  // ── Date range ─────────────────────────────────────────────────
  const [fechaInicio, setFechaInicio] = useState(hoyStr())
  const [fechaFin, setFechaFin] = useState(hoyStr())
  const [rangoActivo, setRangoActivo] = useState<string>('hoy')

  const setRango = (tipo: string) => {
    setRangoActivo(tipo)
    const hoy = hoyStr()
    switch (tipo) {
      case 'hoy':
        setFechaInicio(hoy); setFechaFin(hoy); break
      case 'ayer': {
        const a = ayerStr()
        setFechaInicio(a); setFechaFin(a); break
      }
      case 'semana':
        setFechaInicio(inicioSemanaStr()); setFechaFin(hoy); break
      case 'mes':
        setFechaInicio(inicioMesStr()); setFechaFin(hoy); break
    }
  }

  const handleFechaInput = (fecha: string) => {
    setFechaInicio(fecha)
    setFechaFin(fecha)
    setRangoActivo('')
  }

  useEffect(() => {
    setIsLoadingCierres(true)
    readSheet('cierres_caja').then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setCierres(data.map((d: any) => ({
          id: d.id || '',
          fecha: d.fecha || '',
          hora_cierre: d.hora_cierre || '',
          tipo_cierre: d.tipo_cierre || 'diario',
          ingresos_usd: parseFloat(d.ingresos_usd) || 0,
          ingresos_pago_movil_usd: parseFloat(d.ingresos_pago_movil_usd) || 0,
          ingresos_punto_venta_usd: parseFloat(d.ingresos_punto_venta_usd) || 0,
          ingresos_banco_usd: parseFloat(d.ingresos_banco_usd) || 0,
          litros_vendidos: parseFloat(d.litros_vendidos) || 0,
          litros_restantes: parseFloat(d.litros_restantes) || 0,
          utilidad_estimada_usd: parseFloat(d.utilidad_estimada_usd) || 0,
          utilidad_neta_usd: parseFloat(d.utilidad_neta_usd) || 0,
          total_ventas: parseInt(d.total_ventas) || 0,
          tapas_usadas: parseInt(d.tapas_usadas) || 0,
          tapas_restantes: parseInt(d.tapas_restantes) || 0,
          precintos_usados: parseInt(d.precintos_usados) || 0,
          precintos_restantes: parseInt(d.precintos_restantes) || 0,
          desglose_productos_json: d.desglose_productos_json || '[]',
          desglose_pagos_json: d.desglose_pagos_json || '[]',
          raw_ventas_json: d.raw_ventas_json || '[]',
          operario: d.operario || 'Operario',
          estacion: d.estacion || config.nombreEstacion,
          deudas_pendientes_usd: parseFloat(d.deudas_pendientes_usd) || 0,
          cobros_postpago_usd: parseFloat(d.cobros_postpago_usd) || 0,
          egresos_salarios_usd: parseFloat(d.egresos_salarios_usd) || 0,
          egresos_alquiler_usd: parseFloat(d.egresos_alquiler_usd) || 0,
          egresos_proveedores_json: d.egresos_proveedores_json || '[]',
          notas_credito_json: d.notas_credito_json || '[]',
          es_automatico: d.es_automatico === 'true' || d.es_automatico === true,
        })))
      }
    }).finally(() => setIsLoadingCierres(false))
  }, [])

  // ── Toast ──────────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastState>({ mensaje: '', tipo: 'success', visible: false })
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((mensaje: string, tipo: 'success' | 'error' | 'warning') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ mensaje, tipo, visible: true })
    const dur = tipo === 'error' ? 5000 : tipo === 'warning' ? 4000 : 3000
    toastTimer.current = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), dur)
  }, [])
  useEffect(() => { return () => { if (toastTimer.current) clearTimeout(toastTimer.current) } }, [])

  // ══════════════════════════════════════════════════════════════════
  // DERIVED DATA
  // ══════════════════════════════════════════════════════════════════

  const ventasFiltradas = useMemo(() =>
    ventas.filter((v: any) => {
      const f = (v.fecha || '').slice(0, 10)
      return f >= fechaInicio && f <= fechaFin
    })
  , [ventas, fechaInicio, fechaFin])

  // ── Métricas Hero ──────────────────────────────────────────────
  const metricas = useMemo(() => {
    let ingresosUsd = 0
    let litrosVendidos = 0
    ventasFiltradas.forEach((v: any) => {
      ingresosUsd += parseFloat(v.total_usd) || 0
      try {
        const items = JSON.parse(v.items_json || '[]')
        items.forEach((item: any) => {
          if (item.producto?.esRecarga) {
            litrosVendidos += (item.producto.litros || 0) * (item.cantidad || 1)
          }
        })
      } catch { /* skip */ }
    })
    const utilidadEstimada = ingresosUsd - (litrosVendidos * COSTO_AGUA_POR_LITRO)
    return { ingresosUsd, litrosVendidos, litrosRestantes: litrosJumbo, utilidadEstimada }
  }, [ventasFiltradas, litrosJumbo])

  // ── Desglose por Producto ──────────────────────────────────────
  const desgloseProductos = useMemo(() => {
    const map: Record<string, { nombre: string; cantidad: number; totalUsd: number }> = {}
    ventasFiltradas.forEach((v: any) => {
      try {
        const items = JSON.parse(v.items_json || '[]')
        items.forEach((item: any) => {
          if (item.tipo === 'ABONO_PREPAGO') {
            const key = `prepago_${item.tipo_botellon || 'gen'}`
            if (!map[key]) map[key] = { nombre: `Prepago ${item.tipo_botellon || ''}`, cantidad: 0, totalUsd: 0 }
            map[key].cantidad += item.cantidad || 1
            map[key].totalUsd += (item.precio_usd || 0) * (item.cantidad || 1)
          } else if (item.producto) {
            const key = item.producto.id || item.producto.nombre
            if (!map[key]) map[key] = { nombre: item.producto.nombre, cantidad: 0, totalUsd: 0 }
            map[key].cantidad += item.cantidad || 1
            const precio = item.usarPrepago ? 0 : (item.producto.precio || 0)
            map[key].totalUsd += precio * (item.cantidad || 1)
          }
        })
      } catch { /* skip */ }
    })
    const arr = Object.values(map).filter(p => p.cantidad > 0)
    const total = arr.reduce((s, p) => s + p.totalUsd, 0)
    return arr.map(p => ({
      ...p,
      porcentaje: total > 0 ? (p.totalUsd / total) * 100 : 0,
    })).sort((a, b) => b.totalUsd - a.totalUsd)
  }, [ventasFiltradas])

  // ── Desglose por Método de Pago ────────────────────────────────
  const desglosePagos = useMemo(() => {
    const map: Record<string, number> = {}
    ventasFiltradas.forEach((v: any) => {
      const metodo = v.metodo_pago || 'otro'
      map[metodo] = (map[metodo] || 0) + (parseFloat(v.total_usd) || 0)
    })
    const total = Object.values(map).reduce((s, v) => s + v, 0)
    return Object.entries(map)
      .map(([metodo, value]) => ({
        metodo,                                          // ← clave para el color
        name: METODO_LABELS[metodo] || metodo,
        value: parseFloat(value.toFixed(2)),
        porcentaje: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [ventasFiltradas])

  // ── Datos LineChart — Ahora usa ventas directas para evitar vacíos si no hay cierre ──
  const datosLineChart = useMemo(() => {
    // Construir mapa de ventas: fecha -> total ingresos del día
    const mapVentas: Record<string, number> = {}
    store.ventas.forEach((v: any) => {
      const fecha = normalizarFecha(v.fecha)
      if (fecha && fecha !== '—') {
        mapVentas[fecha] = (mapVentas[fecha] || 0) + (parseFloat(v.total_usd) || 0)
      }
    })

    // Generar los últimos 30 días
    const dias: { fecha: string; ingresos: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const fechaStr = getLocalDateString(d)
      dias.push({
        fecha: fechaStr,
        ingresos: parseFloat((mapVentas[fechaStr] || 0).toFixed(2))
      })
    }
    return dias
  }, [store.ventas])

  // ── Insumos usados hoy (estimación por recargas) ───────────────
  const insumosUsados = useMemo(() => {
    let recargasHoy = 0
    ventasFiltradas.forEach((v: any) => {
      try {
        const items = JSON.parse(v.items_json || '[]')
        items.forEach((item: any) => {
          if (item.producto?.esRecarga) {
            recargasHoy += item.cantidad || 1
          }
        })
      } catch { /* skip */ }
    })
    return { tapasUsadas: recargasHoy, precintosUsados: recargasHoy }
  }, [ventasFiltradas])


  // Detectar tipo de cierre según rango
  const tipoCierre = useMemo((): 'diario' | 'semanal' | 'mensual' => {
    if (fechaInicio === fechaFin) return 'diario'
    const diasDiff = Math.round((new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / 86400000)
    if (diasDiff >= 28) return 'mensual'
    if (diasDiff >= 6) return 'semanal'
    return 'diario'
  }, [fechaInicio, fechaFin])

  // ── Enriquecer filas del historial con datos calculados en vivo ──
  // Corrige: utilidad_estimada_usd y total_ventas almacenados como 0 en Sheets
  const productosConfTabla: any[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('agua-potable-productos') || '[]') } catch { return [] }
  }, [])
  const costoMapTabla = useMemo(() =>
    Object.fromEntries(productosConfTabla.map((p: any) => [p.id, parseFloat(p.costoUsd) || 0]))
  , [productosConfTabla])

  const cierresEnriquecidos = useMemo(() => {
    return cierres
      .filter((c: any) => {
        const f = (c.fecha || '').slice(0, 10)
        return f >= fechaInicio && f <= fechaFin
      })
      .map(c => {
        const fechaC = (c.fecha || '').slice(0, 10)
      const ventasC = ventas.filter((v: any) => (v.fecha || '').slice(0, 10) === fechaC)
      const totalVentasVivo = ventasC.length || c.total_ventas

      // Calcular utilidad viva
      let utilidadViva = 0
      if (ventasC.length > 0) {
        ventasC.forEach((v: any) => {
          const ingreso = parseFloat(v.total_usd) || 0
          let costo = 0
          try {
            const items = JSON.parse(v.items_json || '[]')
            items.forEach((item: any) => {
              const cu = costoMapTabla[item.producto?.id] ?? parseFloat(item.producto?.costoUsd || 0)
              const litros = (item.producto?.litros || 0) * (item.cantidad || 1)
              costo += cu > 0 ? cu * (item.cantidad || 1) : litros * 0.015
            })
          } catch { costo = ingreso * 0.35 }
          utilidadViva += ingreso - costo
        })
      }

      const storedUtil = c.utilidad_neta_usd ?? c.utilidad_estimada_usd ?? 0
      const utilidad = ventasC.length > 0 ? parseFloat(utilidadViva.toFixed(2)) : storedUtil

      return { ...c, _totalVentas: totalVentasVivo, _utilidad: utilidad }
    })
  }, [cierres, ventas, costoMapTabla])


  // ── HANDLERS ───────────────────────────────────────────────────

  const generarCierre = async () => {
    if (ventasFiltradas.length === 0) {
      showToast('No hay ventas registradas en el período seleccionado', 'warning')
      return
    }

    setIsGeneratingCierre(true)
    await new Promise(resolve => setTimeout(resolve, 1000))

    // ── Desglose por método de pago (incluye banco) ─────────────
    let pagoMovilUsd = 0
    let puntoVentaUsd = 0
    ventasFiltradas.forEach((v: any) => {
      const monto = parseFloat(v.total_usd) || 0
      const metodo = v.metodo_pago || ''
      if (metodo === 'pago_movil') pagoMovilUsd += monto
      if (metodo === 'punto_venta') puntoVentaUsd += monto
    })
    const ingresosbancoUsd = pagoMovilUsd + puntoVentaUsd

    // ── Egresos proveedores según frecuencia del cierre ─────────
    const provFiltrados = config.proveedores.filter(p => {
      if (p.frecuencia === 'diario') return true
      if (p.frecuencia === 'semanal') return tipoCierre === 'semanal' || tipoCierre === 'mensual'
      if (p.frecuencia === 'mensual') return tipoCierre === 'mensual'
      return false
    })
    const egresosProveedores = provFiltrados.map(p => ({
      nombre: p.nombre, monto: p.montoPorPago, frecuencia: p.frecuencia
    }))
    const totalProveedores = egresosProveedores.reduce((s, p) => s + p.monto, 0)

    // ── Egresos salarios + alquiler (solo mensual) ───────────────
    let egSalarios = 0
    let egAlquiler = 0
    if (tipoCierre === 'mensual') {
      egSalarios = usuarios
        .filter(u => u.activo && u.perfil === 'vendedor')
        .reduce((s, u) => s + (u.salarioMensualUsd || 0), 0)
      egAlquiler = config.alquilerMensualUsd
    }

    // ── Notas de crédito actuales (del estado del modal) ─────────
    const totalNotas = notasCredito.reduce((s, n) => s + n.montoUsd, 0)

    // ── Utilidad neta ─────────────────────────────────────────────
    const utilidadEstimada = metricas.utilidadEstimada
    const utilidadNeta = utilidadEstimada - totalProveedores - egSalarios - egAlquiler - totalNotas

    const cobrosPostpago = ventasFiltradas.reduce((sum: number, v: any) => {
      let esCobro = false
      try {
        const items = JSON.parse(v.items_json || '[]')
        esCobro = items.some((i: any) => i.tipo === 'COBRO_POSTPAGO')
      } catch {}
      return esCobro ? sum + (parseFloat(v.total_usd) || 0) : sum
    }, 0)

    const cierre: CierreData = {
      id: crypto.randomUUID(),
      fecha: fechaFin,
      hora_cierre: new Date().toLocaleTimeString('es-VE'),
      tipo_cierre: tipoCierre,
      ingresos_usd: parseFloat(metricas.ingresosUsd.toFixed(2)),
      ingresos_pago_movil_usd: parseFloat(pagoMovilUsd.toFixed(2)),
      ingresos_punto_venta_usd: parseFloat(puntoVentaUsd.toFixed(2)),
      ingresos_banco_usd: parseFloat(ingresosbancoUsd.toFixed(2)),
      litros_vendidos: metricas.litrosVendidos,
      litros_restantes: metricas.litrosRestantes,
      utilidad_estimada_usd: parseFloat(utilidadEstimada.toFixed(2)),
      utilidad_neta_usd: parseFloat(utilidadNeta.toFixed(2)),
      total_ventas: ventasFiltradas.length,
      tapas_usadas: insumosUsados.tapasUsadas,
      tapas_restantes: tapas,
      precintos_usados: insumosUsados.precintosUsados,
      precintos_restantes: precintos,
      desglose_productos_json: JSON.stringify(desgloseProductos),
      desglose_pagos_json: JSON.stringify(desglosePagos),
      raw_ventas_json: JSON.stringify(ventasFiltradas),
      operario: config.operario,
      estacion: config.nombreEstacion,
      deudas_pendientes_usd: store.getTotalDeudaPendiente(),
      cobros_postpago_usd: cobrosPostpago,
      egresos_salarios_usd: parseFloat(egSalarios.toFixed(2)),
      egresos_alquiler_usd: parseFloat(egAlquiler.toFixed(2)),
      egresos_proveedores_json: JSON.stringify(egresosProveedores),
      notas_credito_json: JSON.stringify(notasCredito),
    }

    setCierres(prev => [cierre, ...prev])
    setCierreActual(cierre)

    const ok = await insertRow('cierres_caja', cierre)
    if (!ok) {
      useAppStore.setState(s => ({
        pendientesSync: [...s.pendientesSync, { tipo: 'cierres_caja', data: cierre }]
      }))
      showToast('Cierre guardado localmente — pendiente de sincronización', 'warning')
    } else {
      showToast('Cierre de caja generado y sincronizado correctamente', 'success')
    }

    setIsGeneratingCierre(false)
    setShowCierreModal(true)
  }

  const agregarNotaCredito = () => {
    if (!notaConcepto || !notaMonto || parseFloat(notaMonto) <= 0) return
    const nota: NotaCredito = {
      id: crypto.randomUUID(),
      concepto: notaConcepto,
      montoUsd: parseFloat(notaMonto),
      tipo: notaTipo
    }
    setNotasCredito(prev => [...prev, nota])
    setNotaConcepto('')
    setNotaMonto('')
    setShowNotaModal(false)
  }

  const abrirCierreHistorico = (cierre: CierreData) => {
    setCierreActual(cierre)
    try { setNotasCredito(JSON.parse(cierre.notas_credito_json || '[]')) } catch { setNotasCredito([]) }
    setShowCierreModal(true)
  }

  const imprimirCierre = () => {
    window.print()
  }


  // ── Chart colors ───────────────────────────────────────────────
  const chartTextColor = isDark ? '#e4e6f0' : '#6b7280'
  const chartGridColor = isDark ? '#2d3148' : '#e5e7eb'
  const chartLineColor = isDark ? '#5bb3e8' : '#005e97'
  const chartBg = isDark ? '#1e2235' : '#ffffff'

  // ── Custom Recharts tooltip ────────────────────────────────────
  const CustomTooltipLine = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div style={{
          background: chartBg, border: `1px solid ${chartGridColor}`,
          borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          <p style={{ fontFamily: 'Inter', fontSize: 12, color: chartTextColor, marginBottom: 4 }}>
            {formatFechaCorta(label)}
          </p>
          <p style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 700, color: chartLineColor }}>
            ${payload[0].value.toFixed(2)}
          </p>
        </div>
      )
    }
    return null
  }

  const CustomTooltipPie = ({ active, payload }: any) => {
    if (active && payload?.length) {
      return (
        <div style={{
          background: chartBg, border: `1px solid ${chartGridColor}`,
          borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          <p style={{ fontFamily: 'Inter', fontSize: 12, color: chartTextColor, marginBottom: 4 }}>
            {payload[0].name}
          </p>
          <p style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 700, color: chartLineColor }}>
            ${payload[0].value.toFixed(2)}
          </p>
        </div>
      )
    }
    return null
  }

  const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)
    return (
      <text
        x={x}
        y={y}
        fill="#ffffff"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 700 }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  // ── Rango label ────────────────────────────────────────────────
  const rangoLabel = useMemo(() => {
    if (fechaInicio === fechaFin) return formatFechaCorta(fechaInicio)
    return `${formatFechaCorta(fechaInicio)} — ${formatFechaCorta(fechaFin)}`
  }, [fechaInicio, fechaFin])

  /* ══════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="relative min-h-[calc(100vh-57px)] -m-6 bg-[#f7f9fc] dark:bg-[#0f1117] p-6 overflow-auto">

      {/* ═══════ HEADER ═══════════════════════════════════════════════ */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 no-print">
        <div>
          <h1 className="font-manrope text-2xl font-bold text-[#191c1e] dark:text-[#e4e6f0]">
            Reportes — Cierre de Caja
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-inter mt-0.5 font-bold">
            Agua Potable La Campiña — {config.nombreEstacion} · {rangoLabel}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Date picker */}
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="date"
              value={fechaInicio}
              onChange={e => handleFechaInput(e.target.value)}
              className="pl-9 pr-3 py-2.5 rounded-xl border-2 border-gray-200 dark:border-[#2d3148]
                bg-white dark:bg-[#1a1d27] text-[#191c1e] dark:text-[#e4e6f0]
                font-grotesk text-sm font-bold outline-none focus:border-primary dark:focus:border-[#5bb3e8]
                transition-colors cursor-pointer"
            />
          </div>

          {/* Quick buttons */}
          <div className="flex gap-1.5">
            {[
              { id: 'hoy', label: 'Hoy' },
              { id: 'ayer', label: 'Ayer' },
              { id: 'semana', label: 'Semana' },
              { id: 'mes', label: 'Mes' },
            ].map(r => (
              <button
                key={r.id}
                onClick={() => setRango(r.id)}
                className={`px-3 py-2 rounded-xl text-xs font-manrope font-bold transition-all cursor-pointer ${
                  rangoActivo === r.id
                    ? 'text-white shadow-md'
                    : 'bg-white dark:bg-[#1e2235] text-gray-500 dark:text-gray-400 border-2 border-gray-200 dark:border-[#2d3148] hover:border-primary dark:hover:border-[#5bb3e8]'
                }`}
                style={rangoActivo === r.id ? { background: 'linear-gradient(135deg, #005e97, #0077be)' } : {}}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════ 4 MÉTRICAS HERO ══════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 no-print">
        {/* Ingresos Totales */}
        <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} className="text-primary dark:text-[#5bb3e8]" />
            <span className="font-inter text-sm text-gray-500 dark:text-gray-400">Ingresos Totales</span>
          </div>
          <div className="font-grotesk text-[28px] font-bold text-[#191c1e] dark:text-[#e4e6f0] leading-tight">
            {formatUsd(metricas.ingresosUsd)}
          </div>
          <div className="font-grotesk text-sm text-primary dark:text-[#5bb3e8] font-medium mt-0.5">
            {usdToVes(metricas.ingresosUsd)}
          </div>
        </div>

        {/* Litros Vendidos */}
        <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Droplets size={16} className="text-primary dark:text-[#5bb3e8]" />
            <span className="font-inter text-sm text-gray-500 dark:text-gray-400">Litros Vendidos</span>
          </div>
          <div className="font-grotesk text-[28px] font-bold text-[#191c1e] dark:text-[#e4e6f0] leading-tight">
            {metricas.litrosVendidos.toLocaleString('es-VE')} L
          </div>
          <div className="font-grotesk text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            {ventasFiltradas.length} transacciones
          </div>
        </div>

        {/* Litros Restantes */}
        <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={16} className="text-primary dark:text-[#5bb3e8]" />
            <span className="font-inter text-sm text-gray-500 dark:text-gray-400">Litros Restantes</span>
          </div>
          <div className="font-grotesk text-[28px] font-bold text-[#191c1e] dark:text-[#e4e6f0] leading-tight">
            {Math.round(metricas.litrosRestantes).toLocaleString('es-VE')} L
          </div>
          <div className="font-grotesk text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            {Math.round((metricas.litrosRestantes / 2500) * 100)}% del Reservorio
          </div>
        </div>

        {/* Utilidad Estimada */}
        <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-[#16a34a]" />
            <span className="font-inter text-sm text-gray-500 dark:text-gray-400">Utilidad Estimada</span>
          </div>
          <div className="font-grotesk text-[28px] font-bold text-[#16a34a] leading-tight">
            {formatUsd(Math.max(0, metricas.utilidadEstimada))}
          </div>
          <div className="font-grotesk text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            Costo agua: {formatUsd(metricas.litrosVendidos * COSTO_AGUA_POR_LITRO)}/L
          </div>
        </div>
      </div>

      {/* ═══════ DESGLOSE + PIE CHART ═════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6 no-print">
        {/* Desglose por Producto */}
        <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm flex-1 min-w-0">
          <h3 className="font-manrope font-bold text-base text-[#191c1e] dark:text-[#e4e6f0] mb-4">
            Desglose por Producto
          </h3>
          {desgloseProductos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
              <FileText size={36} className="mb-3 opacity-30" />
              <p className="font-inter text-sm">Sin productos vendidos en este período</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-[#2d3148] font-manrope">
                    <th className="pb-3 px-2 font-medium">Producto</th>
                    <th className="pb-3 px-2 font-medium text-center">Cantidad</th>
                    <th className="pb-3 px-2 font-medium text-right">Total USD</th>
                    <th className="pb-3 px-2 font-medium text-right">% del Total</th>
                  </tr>
                </thead>
                <tbody>
                  {desgloseProductos.map((p, i) => (
                    <tr key={i} className="border-b border-gray-50 dark:border-[#2d3148]/50 last:border-0">
                      <td className="py-3 px-2 font-inter font-medium text-[#191c1e] dark:text-[#e4e6f0]">
                        {p.nombre}
                      </td>
                      <td className="py-3 px-2 text-center font-grotesk font-bold text-[#191c1e] dark:text-[#e4e6f0]">
                        {p.cantidad}
                      </td>
                      <td className="py-3 px-2 text-right font-grotesk font-bold text-primary dark:text-[#5bb3e8]">
                        {formatUsd(p.totalUsd)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-100 dark:bg-[#1a1d27] rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${p.porcentaje}%`, backgroundColor: '#005e97' }}
                            />
                          </div>
                          <span className="font-grotesk font-bold text-xs text-gray-500 dark:text-gray-400 w-10 text-right">
                            {p.porcentaje.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 dark:border-[#2d3148]">
                    <td className="pt-3 px-2 font-manrope font-bold text-[#191c1e] dark:text-[#e4e6f0]">Total</td>
                    <td className="pt-3 px-2 text-center font-grotesk font-bold text-[#191c1e] dark:text-[#e4e6f0]">
                      {desgloseProductos.reduce((s, p) => s + p.cantidad, 0)}
                    </td>
                    <td className="pt-3 px-2 text-right font-grotesk font-bold text-primary dark:text-[#5bb3e8]">
                      {formatUsd(desgloseProductos.reduce((s, p) => s + p.totalUsd, 0))}
                    </td>
                    <td className="pt-3 px-2 text-right font-grotesk font-bold text-xs text-gray-500 dark:text-gray-400">
                      100%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Pie Chart: Métodos de Pago */}
        <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm w-full lg:w-[380px] flex-shrink-0">
          <h3 className="font-manrope font-bold text-base text-[#191c1e] dark:text-[#e4e6f0] mb-4">
            Métodos de Pago
          </h3>
          {desglosePagos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
              <BarChart3 size={36} className="mb-3 opacity-30" />
              <p className="font-inter text-sm">Sin datos de pago</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={desglosePagos}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={renderPieLabel}
                  labelLine={false}
                  style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 700 }}
                >
                  {desglosePagos.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={METODO_COLORES[entry.metodo] ?? PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <ReTooltip content={<CustomTooltipPie />} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span style={{ fontFamily: 'Inter', fontSize: 11, color: chartTextColor, fontWeight: 500 }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ═══════ LINE CHART — INGRESOS ÚLTIMOS 30 DÍAS ════════════════ */}
      <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm mb-6 no-print">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-manrope font-bold text-base text-[#191c1e] dark:text-[#e4e6f0]">
            Ingresos — Últimos 30 Días
          </h3>
          <span className="text-[10px] font-grotesk font-bold text-gray-400 dark:text-gray-500
            bg-gray-100 dark:bg-[#1a1d27] px-2 py-0.5 rounded-full">
            USD
          </span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={datosLineChart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGridColor} />
            <XAxis
              dataKey="fecha"
              tickFormatter={formatFechaCorta}
              tick={{ fontSize: 10, fontFamily: 'Space Grotesk', fill: chartTextColor }}
              stroke={chartGridColor}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: 'Space Grotesk', fill: chartTextColor }}
              stroke={chartGridColor}
              tickFormatter={(v: number) => `$${v}`}
            />
            <ReTooltip content={<CustomTooltipLine />} />
            <Line
              type="monotone"
              dataKey="ingresos"
              stroke={chartLineColor}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: chartLineColor, strokeWidth: 2, stroke: chartBg }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ═══════ ESTADO DE INSUMOS AL CIERRE ══════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 no-print">
        {/* Tapas */}
        <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Package size={16} className="text-primary dark:text-[#5bb3e8]" />
            <span className="font-manrope font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]">
              Tapas de Plástico
            </span>
            {tapas < 500 && (
              <span className="text-[10px] font-grotesk font-bold px-2 py-0.5 rounded-full
                bg-[#fef3c7] text-[#92400e] dark:bg-[#78350f] dark:text-[#fde68a] ml-auto flex items-center gap-1">
                <AlertTriangle size={10} /> BAJO
              </span>
            )}
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="font-inter text-xs text-gray-500 dark:text-gray-400 mb-0.5">Usadas en período</div>
              <div className="font-grotesk text-2xl font-bold text-[#191c1e] dark:text-[#e4e6f0]">
                {insumosUsados.tapasUsadas.toLocaleString('es-VE')}
              </div>
            </div>
            <div className="text-right">
              <div className="font-inter text-xs text-gray-500 dark:text-gray-400 mb-0.5">Restantes</div>
              <div className={`font-grotesk text-2xl font-bold ${
                tapas < 500 ? 'text-[#d97706]' : 'text-primary dark:text-[#5bb3e8]'
              }`}>
                {tapas.toLocaleString('es-VE')}
              </div>
            </div>
          </div>
          <div className="w-full bg-gray-100 dark:bg-[#1a1d27] rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min((tapas / 5000) * 100, 100)}%`,
                backgroundColor: tapas < 500 ? '#d97706' : '#005e97',
              }}
            />
          </div>
        </div>

        {/* Precintos */}
        <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={16} className="text-primary dark:text-[#5bb3e8]" />
            <span className="font-manrope font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]">
              Precintos de Seguridad
            </span>
            {precintos < 500 && (
              <span className="text-[10px] font-grotesk font-bold px-2 py-0.5 rounded-full
                bg-[#fef3c7] text-[#92400e] dark:bg-[#78350f] dark:text-[#fde68a] ml-auto flex items-center gap-1">
                <AlertTriangle size={10} /> BAJO
              </span>
            )}
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="font-inter text-xs text-gray-500 dark:text-gray-400 mb-0.5">Usados en período</div>
              <div className="font-grotesk text-2xl font-bold text-[#191c1e] dark:text-[#e4e6f0]">
                {insumosUsados.precintosUsados.toLocaleString('es-VE')}
              </div>
            </div>
            <div className="text-right">
              <div className="font-inter text-xs text-gray-500 dark:text-gray-400 mb-0.5">Restantes</div>
              <div className={`font-grotesk text-2xl font-bold ${
                precintos < 500 ? 'text-[#d97706]' : 'text-primary dark:text-[#5bb3e8]'
              }`}>
                {precintos.toLocaleString('es-VE')}
              </div>
            </div>
          </div>
          <div className="w-full bg-gray-100 dark:bg-[#1a1d27] rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min((precintos / 5000) * 100, 100)}%`,
                backgroundColor: precintos < 500 ? '#d97706' : '#005e97',
              }}
            />
          </div>
        </div>
      </div>

      {/* ═══════ BOTÓN GENERAR CIERRE ═════════════════════════════════ */}
      <div className="mb-6 no-print">
        {/* Tipo de cierre detectado */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-grotesk font-bold text-gray-500 dark:text-gray-400">Tipo de cierre detectado:</span>
            <span className={`text-[10px] font-grotesk font-bold px-2 py-0.5 rounded-full text-white ${
              tipoCierre === 'mensual' ? 'bg-amber-500' : tipoCierre === 'semanal' ? 'bg-purple-500' : 'bg-primary'
            }`}>
              {tipoCierre.toUpperCase()}
            </span>
            {tipoCierre === 'mensual' && (
              <span className="text-[10px] font-inter text-amber-600 dark:text-amber-400">
                · Incluye salarios y alquiler
              </span>
            )}
          </div>
          {notasCredito.length > 0 && (
            <span className="text-[10px] font-grotesk font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {notasCredito.length} nota{notasCredito.length !== 1 ? 's' : ''} de crédito
            </span>
          )}
        </div>

        <div className="flex gap-3">
          {/* Botón Nota de Crédito */}
          <button
            onClick={() => setShowNotaModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-[12px] font-manrope font-bold text-sm
              border-2 border-dashed border-gray-300 dark:border-[#2d3148]
              text-gray-600 dark:text-gray-300 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400
              transition-all cursor-pointer"
          >
            <AlertCircle size={16} />
            + Nota de Crédito
            {notasCredito.length > 0 && (
              <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-full text-[10px] px-1.5 font-bold">
                {notasCredito.length}
              </span>
            )}
          </button>

          {/* Botón Generar Cierre */}
          <button
            onClick={generarCierre}
            disabled={isGeneratingCierre}
            className={`flex-1 py-3 rounded-[12px] font-manrope font-bold text-base text-white
              transition-all duration-300 shadow-lg flex items-center justify-center gap-3
              ${!isGeneratingCierre ? 'hover:shadow-xl hover:scale-[1.005] active:scale-[0.995] cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}
            style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
          >
            {isGeneratingCierre ? (
              <><Loader2 className="animate-spin" size={20} />Generando Cierre...</>
            ) : (
              <><FileText size={20} />Generar Cierre Oficial</>
            )}
          </button>
        </div>
      </div>

      {/* ═══════ MODAL NOTA DE CRÉDITO ════════════════════════════════ */}
      {showNotaModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center no-print">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNotaModal(false)} />
          <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-6 w-full max-w-sm relative z-10 mx-4" style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-manrope text-lg font-bold text-[#191c1e] dark:text-[#e4e6f0]">Nueva Nota de Crédito</h3>
              <button onClick={() => setShowNotaModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 font-manrope">Tipo de Nota</label>
                <select value={notaTipo} onChange={e => setNotaTipo(e.target.value as NotaCredito['tipo'])}
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-2.5 text-sm font-inter
                    text-[#191c1e] dark:text-[#e4e6f0] bg-white dark:bg-[#1a1d27] outline-none focus:border-primary transition-colors">
                  <option value="egreso_extraordinario">Egreso Extraordinario</option>
                  <option value="donacion">Donación</option>
                  <option value="descuento">Descuento / Ajuste</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 font-manrope">Concepto</label>
                <input type="text" value={notaConcepto} onChange={e => setNotaConcepto(e.target.value)}
                  placeholder="Descripción del movimiento..."
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-2.5 text-sm font-inter
                    text-[#191c1e] dark:text-[#e4e6f0] bg-white dark:bg-[#1a1d27] outline-none focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 font-manrope">Monto (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-grotesk text-sm">$</span>
                  <input type="number" min="0" step="0.01" value={notaMonto} onChange={e => setNotaMonto(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-2.5 border-2 border-gray-200 dark:border-[#2d3148] rounded-xl font-grotesk font-bold text-sm text-red-600
                      bg-white dark:bg-[#1a1d27] outline-none focus:border-primary transition-colors" />
                </div>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-inter">
                La nota de crédito se descontará del total de ingresos y reducirá la utilidad neta del cierre.
              </p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNotaModal(false)} className="flex-1 py-2.5 rounded-xl font-manrope font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-[#1a1d27]">Cancelar</button>
              <button onClick={agregarNotaCredito} className="flex-1 py-2.5 rounded-xl font-manrope font-bold text-white shadow-md" style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}>
                Agregar Nota
              </button>
            </div>
            {/* Lista de notas ya agregadas */}
            {notasCredito.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#2d3148] space-y-2">
                <p className="text-xs font-manrope font-bold text-gray-500 dark:text-gray-400">Notas agregadas:</p>
                {notasCredito.map(n => (
                  <div key={n.id} className="flex items-center justify-between bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-2">
                    <div>
                      <span className="font-inter text-xs font-bold text-[#191c1e] dark:text-[#e4e6f0]">{n.concepto}</span>
                      <span className="text-[10px] text-gray-400 ml-2">{n.tipo.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-grotesk font-bold text-sm text-red-600">-${n.montoUsd.toFixed(2)}</span>
                      <button onClick={() => setNotasCredito(prev => prev.filter(x => x.id !== n.id))} className="text-gray-400 hover:text-red-500">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ HISTORIAL DE CIERRES ═════════════════════════════════ */}
      <div className="no-print">
        <h2 className="font-manrope text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider uppercase mb-4">
          Historial de Cierres de Caja
        </h2>
        <div className="bg-white dark:bg-[#1e2235] rounded-[12px] shadow-sm overflow-hidden">
          {isLoadingCierres ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
              <Clock size={36} className="mb-3 opacity-30 animate-pulse" />
              <p className="font-inter text-sm">Cargando cierres...</p>
            </div>
          ) : cierres.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <FileText size={48} className="mb-4 opacity-20" />
              <p className="font-manrope font-bold text-lg text-gray-400 dark:text-gray-500 mb-1">
                Sin cierres registrados
              </p>
              <p className="font-inter text-sm text-gray-400 dark:text-gray-500 text-center max-w-xs">
                Genera el primer cierre de caja para Agua Potable La Campiña
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-[#2d3148] font-manrope">
                    <th className="py-3 px-4 font-medium">Fecha</th>
                    <th className="py-3 px-4 font-medium">Hora Cierre</th>
                    <th className="py-3 px-4 font-medium text-right">Ingresos USD</th>
                    <th className="py-3 px-4 font-medium text-right">Litros</th>
                    <th className="py-3 px-4 font-medium text-right">Utilidad</th>
                    <th className="py-3 px-4 font-medium text-center">Ventas</th>
                    <th className="py-3 px-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {cierresEnriquecidos.map(c => (
                    <tr
                      key={c.id}
                      onClick={() => abrirCierreHistorico(c)}
                      className="border-b border-gray-50 dark:border-[#2d3148]/50 last:border-0
                        hover:bg-[#f7f9fc] dark:hover:bg-[#1a1d27] transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-grotesk font-bold text-[#191c1e] dark:text-[#e4e6f0]">{normalizarFecha(c.fecha)}</div>
                        {c.tipo_cierre && c.tipo_cierre !== 'diario' && (
                          <span className={`text-[9px] font-grotesk font-bold px-1.5 py-0.5 rounded-full text-white ${
                            c.tipo_cierre === 'mensual' ? 'bg-amber-500' : 'bg-purple-500'
                          }`}>{c.tipo_cierre.toUpperCase()}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-grotesk text-gray-500 dark:text-gray-400">
                        {c.hora_cierre}
                      </td>
                      <td className="py-3.5 px-4 text-right font-grotesk font-bold text-primary dark:text-[#5bb3e8]">
                        {formatUsd(c.ingresos_usd)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-grotesk font-bold text-[#191c1e] dark:text-[#e4e6f0]">
                        {c.litros_vendidos.toLocaleString('es-VE')} L
                      </td>
                      <td className={`py-3.5 px-4 text-right font-grotesk font-bold ${
                        (c._utilidad ?? 0) >= 0 ? 'text-[#16a34a]' : 'text-red-500'
                      }`}>
                        {formatUsd(c._utilidad ?? 0)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-grotesk font-bold text-[#191c1e] dark:text-[#e4e6f0]">
                        {c._totalVentas ?? 0}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 group-hover:text-primary dark:group-hover:text-[#5bb3e8] transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ═══════ MODAL CIERRE (imprimible) ════════════════════════════ */}
      {showCierreModal && cierreActual && (() => {
        // ── Reconstruir datos desde ventas vivas del store (nunca truncados) ──
        const fechaCierre = normalizarFecha(cierreActual.fecha)
        const ventasDelCierre: any[] = ventas.filter(
          (v: any) => normalizarFecha(v.fecha || '') === fechaCierre
        )

        // Desglose por producto (reconstruido desde ventas del store)
        const mapProductos: Record<string, { nombre: string; cantidad: number; totalUsd: number }> = {}
        ventasDelCierre.forEach((v: any) => {
          try {
            const items = JSON.parse(v.items_json || '[]')
            items.forEach((item: any) => {
              if (item.producto) {
                const key = item.producto.id || item.producto.nombre
                if (!mapProductos[key]) mapProductos[key] = { nombre: item.producto.nombre, cantidad: 0, totalUsd: 0 }
                mapProductos[key].cantidad += item.cantidad || 1
                const precio = item.usarPrepago ? 0 : (item.producto.precio || 0)
                mapProductos[key].totalUsd += precio * (item.cantidad || 1)
              }
            })
          } catch { /* skip */ }
        })
        const productosDetalle: any[] = Object.values(mapProductos)
          .filter(p => p.cantidad > 0)
          .sort((a, b) => b.totalUsd - a.totalUsd)
        // Fallback al JSON guardado si no hay datos vivos
        if (productosDetalle.length === 0) {
          try { productosDetalle.push(...JSON.parse(cierreActual.desglose_productos_json || '[]')) } catch { /* skip */ }
        }

        // Desglose por método de pago (reconstruido desde ventas del store)
        const mapPagos: Record<string, { monto: number; conteo: number }> = {}
        ventasDelCierre.forEach((v: any) => {
          const m = v.metodo_pago || 'otro'
          if (!mapPagos[m]) mapPagos[m] = { monto: 0, conteo: 0 }
          mapPagos[m].monto += parseFloat(v.total_usd) || 0
          mapPagos[m].conteo += 1
        })
        const totalPagos = Object.values(mapPagos).reduce((s, p) => s + p.monto, 0)
        const pagosDetalle: { id: string; name: string; monto: number; conteo: number; pct: number }[] =
          Object.entries(mapPagos)
            .map(([id, { monto, conteo }]) => ({
              id,
              name: METODO_LABELS[id] || id,
              monto: parseFloat(monto.toFixed(2)),
              conteo,
              pct: totalPagos > 0 ? (monto / totalPagos) * 100 : 0,
            }))
            .sort((a, b) => b.monto - a.monto)
        // Fallback al JSON guardado si no hay datos vivos
        if (pagosDetalle.length === 0) {
          try {
            const stored = JSON.parse(cierreActual.desglose_pagos_json || '[]')
            pagosDetalle.push(...stored.map((p: any) => ({ id: p.name, name: p.name, monto: p.value, conteo: 0, pct: totalPagos > 0 ? (p.value / totalPagos) * 100 : 0 })))
          } catch { /* skip */ }
        }

        // Total de transacciones: priorizar count vivo
        const totalTransacciones = ventasDelCierre.length || cierreActual.total_ventas
        const totalDeliveries = ventasDelCierre.filter((v: any) => v.es_delivery).length

        // Utilidad: calcular en vivo desde ventasDelCierre con costos de la config
        const productosConf: any[] = (() => {
          try { return JSON.parse(localStorage.getItem('agua-potable-productos') || '[]') } catch { return [] }
        })()
        const costoMapConf: Record<string, number> = Object.fromEntries(
          productosConf.map((p: any) => [p.id, parseFloat(p.costoUsd) || 0])
        )
        const COSTO_LITRO_DEFECTO = 0.015

        let utilidadViva = 0
        if (ventasDelCierre.length > 0) {
          ventasDelCierre.forEach((v: any) => {
            const ingreso = parseFloat(v.total_usd) || 0
            let costo = 0
            try {
              const items = JSON.parse(v.items_json || '[]')
              items.forEach((item: any) => {
                // Costo: 1º desde config del admin, 2º desde el item, 3º fallback litros*tarifa
                const costoUnit = costoMapConf[item.producto?.id]
                  ?? parseFloat(item.producto?.costoUsd || item.producto?.costo || 0)
                const litrosItem = (item.producto?.litros || 0) * (item.cantidad || 1)
                costo += costoUnit > 0
                  ? costoUnit * (item.cantidad || 1)
                  : litrosItem * COSTO_LITRO_DEFECTO
              })
            } catch { costo = ingreso * 0.35 } // fallback: 35% costo
            utilidadViva += ingreso - costo
          })
        }

        // Si hay egresos registrados, descontarlos de la utilidad viva
        const egProv0: any[] = (() => { try { return JSON.parse(cierreActual.egresos_proveedores_json || '[]') } catch { return [] } })()
        const egNotas0: NotaCredito[] = (() => { try { return JSON.parse(cierreActual.notas_credito_json || '[]') } catch { return [] } })()
        const egSal0 = cierreActual.egresos_salarios_usd || 0
        const egAlq0 = cierreActual.egresos_alquiler_usd || 0
        const totalEgresosModal = egProv0.reduce((s: number, p: any) => s + (p.monto || 0), 0)
          + egNotas0.reduce((s: number, n: NotaCredito) => s + n.montoUsd, 0)
          + egSal0 + egAlq0
        utilidadViva -= totalEgresosModal

        // Elegir entre utilidad viva (calculada) o almacenada
        const storedUtil = cierreActual.utilidad_neta_usd ?? cierreActual.utilidad_estimada_usd ?? 0
        const utilidadMostrar = ventasDelCierre.length > 0 ? parseFloat(utilidadViva.toFixed(2)) : storedUtil

        // Iconos por método de pago
        const METODO_ICONS: Record<string, string> = {
          efectivo_usd: '💵',
          pago_movil: '📱',
          punto_venta: '💳',
          efectivo_ves: '🇻🇪',
          prepago_cliente: '🔄',
          pago_mixto: '🛝',
          post_pago: '⏱️',
        }

        return (
          <div className="absolute inset-0 z-50 flex items-center justify-center print-cierre-backdrop">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm no-print" onClick={() => setShowCierreModal(false)} />
            <div
              className="bg-white dark:bg-[#1e2235] rounded-2xl w-full max-w-lg relative z-10 mx-4 max-h-[90vh] overflow-y-auto print-cierre-content"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}
            >
              {/* Print-only header */}
              <div className="hidden print-header-visible text-center py-6 border-b-2 border-gray-300">
                <h1 style={{ fontFamily: 'Manrope', fontSize: 24, fontWeight: 800, color: '#005e97' }}>
                  Agua Potable La Campiña
                </h1>
                <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  Estación #042 · Agua Potable
                </p>
              </div>

              <div className="p-6">
                {/* Modal header */}
                <div className="flex items-center justify-between mb-5 no-print">
                  <h2 className="font-manrope text-xl font-bold text-[#191c1e] dark:text-[#e4e6f0]">
                    Cierre de Caja
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={imprimirCierre}
                      className="text-gray-400 hover:text-primary dark:hover:text-[#5bb3e8] transition-colors"
                      title="Imprimir"
                    >
                      <Printer size={20} />
                    </button>
                    <button onClick={() => setShowCierreModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Fecha + Hora */}
                <div className="bg-blue-50 dark:bg-[#1a1d27] rounded-xl px-4 py-3 mb-5 flex items-center justify-between border border-blue-100 dark:border-[#2d3148]">
                  <div>
                    <span className="font-inter text-xs text-gray-500 dark:text-gray-400 block">Fecha del cierre</span>
                    <span className="font-grotesk font-bold text-primary dark:text-[#5bb3e8]">{normalizarFecha(cierreActual.fecha)}</span>
                    {cierreActual.tipo_cierre && (
                      <span className={`ml-2 text-[9px] font-grotesk font-bold px-1.5 py-0.5 rounded-full text-white ${
                        cierreActual.tipo_cierre === 'mensual' ? 'bg-amber-500' : cierreActual.tipo_cierre === 'semanal' ? 'bg-purple-500' : 'bg-primary'
                      }`}>{cierreActual.tipo_cierre?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-inter text-xs text-gray-500 dark:text-gray-400 block">Hora</span>
                    <span className="font-grotesk font-bold text-[#191c1e] dark:text-[#e4e6f0]">{cierreActual.hora_cierre}</span>
                  </div>
                </div>

                {/* ═══ BALANCE FINANCIERO PRINCIPAL ═══ */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-gray-50 dark:bg-[#1a1d27] rounded-xl p-3 text-center border border-gray-100 dark:border-[#2d3148]">
                    <div className="font-inter text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 font-bold">INGRESOS BRUTOS</div>
                    <div className="font-grotesk text-xl font-bold text-primary dark:text-[#5bb3e8]">
                      {formatUsd(cierreActual.ingresos_usd)}
                    </div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-3 text-center border border-green-100 dark:border-green-900/30">
                    <div className="font-inter text-[10px] uppercase tracking-wider text-green-600 dark:text-green-400 mb-1 font-bold">UTILIDAD NETA</div>
                    <div className={`font-grotesk text-xl font-bold ${
                      utilidadMostrar >= 0 ? 'text-[#16a34a]' : 'text-red-500'
                    }`}>
                      {formatUsd(utilidadMostrar)}
                    </div>
                  </div>
                </div>

                {/* ═══ OPERACIONES Y ENTREGAS ═══ */}
                <div className="mb-5 break-inside-avoid">
                  <p className="text-xs font-manrope font-bold text-gray-400 dark:text-gray-500 tracking-wider mb-2">
                    OPERACIONES Y ENTREGAS
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 text-center border border-blue-100 dark:border-blue-900/30">
                      <div className="font-inter text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-bold mb-1">Deliverys Realizados</div>
                      <div className="font-grotesk text-2xl font-bold text-blue-700 dark:text-[#5bb3e8]">
                        {totalDeliveries} <span className="text-xs font-normal text-blue-500">viajes</span>
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-[#1a1d27] rounded-lg p-3 text-center border border-gray-100 dark:border-[#2d3148]">
                      <div className="font-inter text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold mb-1">Total Transacciones</div>
                      <div className="font-grotesk text-2xl font-bold text-[#191c1e] dark:text-[#e4e6f0]">
                        {totalTransacciones} <span className="text-xs font-normal text-gray-400">ventas</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ═══ BALANCE DE AGUA E INVENTARIO ═══ */}
                <div className="mb-5 break-inside-avoid">
                  <p className="text-xs font-manrope font-bold text-gray-400 dark:text-gray-500 tracking-wider mb-2">
                    BALANCE DE AGUA
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-cyan-50 dark:bg-cyan-900/10 rounded-lg p-3 text-center border border-cyan-100 dark:border-cyan-900/30">
                      <div className="font-inter text-[10px] uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold mb-1">Agua Cruda (Stock Restante)</div>
                      <div className="font-grotesk text-lg font-bold text-cyan-700 dark:text-cyan-400">
                        {cierreActual.litros_restantes.toLocaleString('es-VE')} L
                      </div>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-lg p-3 text-center border border-indigo-100 dark:border-indigo-900/30">
                      <div className="font-inter text-[10px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold mb-1">Agua Procesada / Vendida</div>
                      <div className="font-grotesk text-lg font-bold text-indigo-700 dark:text-indigo-400">
                        {cierreActual.litros_vendidos.toLocaleString('es-VE')} L
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cuentas por cobrar / Abonos */}
                <div className="grid grid-cols-2 gap-3 mb-5 break-inside-avoid">
                  <div className="bg-gray-50 dark:bg-[#1a1d27] rounded-xl p-3 text-center border border-transparent dark:border-[#2d3148]">
                    <div className="font-inter text-xs text-gray-400 dark:text-gray-500 mb-1">Cuentas por Cobrar</div>
                    <div className="font-grotesk text-lg font-bold text-red-500">
                      {formatUsd(cierreActual.deudas_pendientes_usd || 0)}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-[#1a1d27] rounded-xl p-3 text-center border border-transparent dark:border-[#2d3148]">
                    <div className="font-inter text-xs text-gray-400 dark:text-gray-500 mb-1">Abonos a Deuda</div>
                    <div className="font-grotesk text-lg font-bold text-primary dark:text-[#5bb3e8]">
                      {formatUsd(cierreActual.cobros_postpago_usd || 0)}
                    </div>
                  </div>
                </div>
                {/* Ingresos bancarios destacados */}
                {(cierreActual.ingresos_banco_usd ?? 0) > 0 && (
                  <div className="mb-5 bg-blue-50 dark:bg-[#1a1d27] rounded-xl p-4 border border-blue-100 dark:border-[#2d3148]">
                    <p className="text-xs font-manrope font-bold text-blue-700 dark:text-[#5bb3e8] tracking-wider mb-3">
                      🏦 INGRESOS AL BANCO
                    </p>
                    <div className="space-y-1.5">
                      {(cierreActual.ingresos_pago_movil_usd ?? 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="font-inter text-sm text-gray-600 dark:text-gray-300">Pago Móvil</span>
                          <span className="font-grotesk font-bold text-sm text-primary dark:text-[#5bb3e8]">{formatUsd(cierreActual.ingresos_pago_movil_usd ?? 0)}</span>
                        </div>
                      )}
                      {(cierreActual.ingresos_punto_venta_usd ?? 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="font-inter text-sm text-gray-600 dark:text-gray-300">Punto de Venta</span>
                          <span className="font-grotesk font-bold text-sm text-primary dark:text-[#5bb3e8]">{formatUsd(cierreActual.ingresos_punto_venta_usd ?? 0)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-blue-200 dark:border-[#2d3148] pt-2 mt-2">
                        <span className="font-manrope font-bold text-sm text-blue-700 dark:text-[#5bb3e8]">Total al Banco</span>
                        <span className="font-grotesk font-bold text-base text-blue-700 dark:text-[#5bb3e8]">{formatUsd(cierreActual.ingresos_banco_usd ?? 0)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* CONTROLES DE PESTAÑAS (NO IMPRIMIBLES) */}
                <div className="flex bg-gray-100 dark:bg-[#1a1d27] rounded-lg p-1 mb-5 no-print">
                  <button
                    onClick={() => setTabCierre('acumulado')}
                    className={`flex-1 py-1.5 text-sm font-manrope font-bold rounded-md transition-colors ${
                      tabCierre === 'acumulado'
                        ? 'bg-white dark:bg-[#2d3148] text-[#005e97] dark:text-[#5bb3e8] shadow-sm'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    Resumen Acumulado
                  </button>
                  <button
                    onClick={() => setTabCierre('detallado')}
                    className={`flex-1 py-1.5 text-sm font-manrope font-bold rounded-md transition-colors ${
                      tabCierre === 'detallado'
                        ? 'bg-white dark:bg-[#2d3148] text-[#005e97] dark:text-[#5bb3e8] shadow-sm'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    Detalle de Transacciones
                  </button>
                </div>

                {/* VISTA: ACUMULADO */}
                <div className={tabCierre === 'acumulado' ? 'block print:block' : 'hidden print:block'}>

                  {/* ═══ INGRESOS POR MÉTODO DE PAGO (sección principal) */}
                  <div className="mb-5">
                    <p className="text-xs font-manrope font-bold text-gray-400 dark:text-gray-500 tracking-wider mb-3">
                      INGRESOS POR MÉTODO DE PAGO
                    </p>
                    {pagosDetalle.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="font-inter text-sm text-gray-400 dark:text-gray-500">Sin datos de pagos para esta fecha.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {pagosDetalle.map((p) => (
                          <div key={p.id} className="bg-gray-50 dark:bg-[#1a1d27] rounded-xl px-4 py-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{METODO_ICONS[p.id] || '💰'}</span>
                                <span className="font-inter text-sm font-medium text-[#191c1e] dark:text-[#e4e6f0]">{p.name}</span>
                                <span className="text-[10px] font-grotesk font-bold bg-blue-50 dark:bg-blue-900/20 text-primary dark:text-[#5bb3e8] px-1.5 py-0.5 rounded-full">
                                  {p.conteo} venta{p.conteo !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <span className="font-grotesk font-bold text-base text-primary dark:text-[#5bb3e8]">
                                {formatUsd(p.monto)}
                              </span>
                            </div>
                            {/* Barra de progreso proporcional */}
                            <div className="w-full bg-gray-200 dark:bg-[#2d3148] rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${p.pct.toFixed(1)}%`, backgroundColor: '#005e97' }}
                              />
                            </div>
                            <div className="text-[9px] font-grotesk text-gray-400 dark:text-gray-500 mt-0.5 text-right">
                              {p.pct.toFixed(1)}% del total
                            </div>
                          </div>
                        ))}
                        {/* Total general */}
                        <div className="flex items-center justify-between border-t-2 border-gray-200 dark:border-[#2d3148] pt-3 mt-1">
                          <span className="font-manrope font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]">
                            Total Ingresos
                          </span>
                          <span className="font-grotesk font-bold text-lg text-primary dark:text-[#5bb3e8]">
                            {formatUsd(totalPagos)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ═══ DESGLOSE POR PRODUCTO */}
                  {productosDetalle.length > 0 && (
                    <div className="mb-5">
                      <p className="text-xs font-manrope font-bold text-gray-400 dark:text-gray-500 tracking-wider mb-2">
                        DESGLOSE TOTAL DE PRODUCTOS (INGRESOS AL SISTEMA)
                      </p>
                      <div className="space-y-1.5 break-inside-avoid">
                        {productosDetalle.map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-[#1a1d27] rounded-lg px-3 py-2">
                            <span className="font-inter text-sm text-[#191c1e] dark:text-[#e4e6f0]">{p.nombre}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-grotesk text-xs text-gray-400 dark:text-gray-500">{p.cantidad} uds</span>
                              <span className="font-grotesk font-bold text-sm text-primary dark:text-[#5bb3e8]">
                                {formatUsd(p.totalUsd)}
                              </span>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center justify-between border-t border-gray-200 dark:border-[#2d3148] pt-2 mt-1">
                          <span className="font-manrope font-bold text-xs text-gray-500 dark:text-gray-400">Total productos</span>
                          <span className="font-grotesk font-bold text-sm text-primary dark:text-[#5bb3e8]">
                            {formatUsd(productosDetalle.reduce((s: number, p: any) => s + (p.totalUsd || 0), 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── EGRESOS DEL PERÍODO ─────────────────────────── */}
                  {(() => {
                    let egProv: any[] = []
                    let egNotas: NotaCredito[] = []
                    try { egProv = JSON.parse(cierreActual.egresos_proveedores_json || '[]') } catch {}
                    try { egNotas = JSON.parse(cierreActual.notas_credito_json || '[]') } catch {}
                    const egSalarios = cierreActual.egresos_salarios_usd || 0
                    const egAlquiler = cierreActual.egresos_alquiler_usd || 0
                    const totalProv = egProv.reduce((s: number, p: any) => s + (p.monto || 0), 0)
                    const totalNotas = egNotas.reduce((s, n) => s + n.montoUsd, 0)
                    const totalEgresos = totalProv + egSalarios + egAlquiler + totalNotas
                    if (totalEgresos === 0) return null
                    return (
                      <div className="mb-5 break-inside-avoid">
                        <p className="text-xs font-manrope font-bold text-red-500 tracking-wider mb-2">
                          EGRESOS DEL PERÍODO
                        </p>
                        <div className="space-y-1.5">
                          {egProv.map((p: any, i: number) => (
                            <div key={i} className="flex items-center justify-between bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-2">
                              <div>
                                <span className="font-inter text-sm text-[#191c1e] dark:text-[#e4e6f0]">{p.nombre}</span>
                                <span className="text-[10px] text-gray-400 ml-2">({p.frecuencia})</span>
                              </div>
                              <span className="font-grotesk font-bold text-sm text-red-600">-{formatUsd(p.monto)}</span>
                            </div>
                          ))}
                          {egSalarios > 0 && (
                            <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-2">
                              <span className="font-inter text-sm text-[#191c1e] dark:text-[#e4e6f0]">Salarios Operadores</span>
                              <span className="font-grotesk font-bold text-sm text-red-600">-{formatUsd(egSalarios)}</span>
                            </div>
                          )}
                          {egAlquiler > 0 && (
                            <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/10 rounded-lg px-3 py-2">
                              <span className="font-inter text-sm text-[#191c1e] dark:text-[#e4e6f0]">Alquiler del Local</span>
                              <span className="font-grotesk font-bold text-sm text-red-600">-{formatUsd(egAlquiler)}</span>
                            </div>
                          )}
                          {egNotas.map(n => (
                            <div key={n.id} className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/10 rounded-lg px-3 py-2">
                              <div>
                                <span className="font-inter text-sm text-[#191c1e] dark:text-[#e4e6f0]">{n.concepto}</span>
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-2 font-bold uppercase">NC</span>
                              </div>
                              <span className="font-grotesk font-bold text-sm text-amber-700 dark:text-amber-400">-{formatUsd(n.montoUsd)}</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between border-t-2 border-red-200 dark:border-red-900/50 pt-2 mt-1">
                            <span className="font-manrope font-bold text-sm text-red-700 dark:text-red-400">Total Egresos</span>
                            <span className="font-grotesk font-bold text-base text-red-700 dark:text-red-400">-{formatUsd(totalEgresos)}</span>
                          </div>
                        </div>
                        {/* Utilidad neta final */}
                        <div className="mt-3 bg-green-50 dark:bg-green-900/10 rounded-xl px-4 py-3 border border-green-100 dark:border-green-900/30 flex justify-between items-center">
                          <span className="font-manrope font-bold text-sm text-[#16a34a]">Utilidad Neta del Período</span>
                          <span className={`font-grotesk font-bold text-lg ${(cierreActual.utilidad_neta_usd ?? cierreActual.utilidad_estimada_usd) >= 0 ? 'text-[#16a34a]' : 'text-red-600'}`}>
                            {formatUsd(cierreActual.utilidad_neta_usd ?? cierreActual.utilidad_estimada_usd)}
                          </span>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* VISTA: DETALLADO */}
                <div className={tabCierre === 'detallado' ? 'block print:block' : 'hidden print:block'}>
                  <div className="mb-5">
                    <p className="text-xs font-manrope font-bold text-gray-400 dark:text-gray-500 tracking-wider mb-2">
                      TRANSACCIONES DETALLADAS
                    </p>
                    {(() => {
                      // Bug #9a: Reconstruir desde ventas del store (siempre fresco, nunca truncado)
                      // Filtramos por la fecha del cierre actual
                      const fechaCierre = normalizarFecha(cierreActual.fecha)
                      let ventasDetalle: any[] = ventas.filter(
                        (v: any) => normalizarFecha(v.fecha || '') === fechaCierre
                      )

                      // Fallback: si no hay ventas en el store para ese día, intentar raw_ventas_json
                      if (ventasDetalle.length === 0) {
                        try { ventasDetalle = JSON.parse(cierreActual.raw_ventas_json || '[]') } catch { /* skip */ }
                      }

                      // Ordenar por hora descendente
                      ventasDetalle = [...ventasDetalle].sort((a, b) => {
                        const ta = new Date(`${a.fecha || ''}T${a.hora || '00:00:00'}`).getTime()
                        const tb = new Date(`${b.fecha || ''}T${b.hora || '00:00:00'}`).getTime()
                        return tb - ta
                      })

                      if (ventasDetalle.length === 0) {
                        return (
                          <div className="py-8 text-center">
                            <p className="font-inter text-sm text-gray-400 dark:text-gray-500">
                              No hay transacciones registradas para esta fecha.
                            </p>
                            <p className="font-inter text-xs text-gray-300 dark:text-gray-600 mt-1">
                              Los datos históricos anteriores a la sincronización pueden no estar disponibles.
                            </p>
                          </div>
                        )
                      }

                      return (
                        <div className="overflow-x-auto print:overflow-visible">
                          <table className="w-full text-[11px] font-inter">
                            <thead>
                              <tr className="border-b-2 border-gray-200 dark:border-[#2d3148] text-left text-gray-500 dark:text-gray-400 font-manrope">
                                <th className="py-2 px-1 w-12">Hora</th>
                                <th className="py-2 px-1">Cliente / Detalle</th>
                                <th className="py-2 px-1 text-right w-20">Método</th>
                                <th className="py-2 px-1 text-right w-16">USD</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-[#2d3148]">
                              {ventasDetalle.map((v: any, idx: number) => {
                                // Hora: preferir campo hora, si no derivar de fecha ISO
                                const hora = v.hora
                                  ? v.hora.slice(0, 5)
                                  : (v.fecha && v.fecha.includes('T')
                                    ? new Date(v.fecha).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
                                    : '--:--')

                                // Resumen de productos
                                let resItems = ''
                                try {
                                  const its = JSON.parse(v.items_json || '[]')
                                  resItems = its.map((i: any) =>
                                    `${i.cantidad}x ${i.producto?.nombre || i.tipo || '?'}`
                                  ).join(', ')
                                } catch { /* skip */ }

                                // Método de pago
                                const metodoLabel = METODO_LABELS[v.metodo_pago || ''] || v.metodo_pago || '—'

                                // Tipo: delivery, post-pago
                                const badges = []
                                if (v.es_delivery) badges.push('Delivery')
                                if (v.metodo_pago === 'post_pago') badges.push('Crédito')

                                return (
                                  <tr key={v.id || idx} className="break-inside-avoid hover:bg-gray-50 dark:hover:bg-[#1a1d27]">
                                    <td className="py-2 px-1 text-gray-500 dark:text-gray-400 whitespace-nowrap font-grotesk">
                                      {hora}
                                    </td>
                                    <td className="py-2 px-1">
                                      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                                        <span className="text-[#191c1e] dark:text-[#e4e6f0] font-medium break-words">
                                          {v.cliente_nombre || 'General'}
                                        </span>
                                        {badges.map(b => (
                                          <span key={b} className="text-[9px] font-grotesk font-bold bg-blue-100 dark:bg-blue-900/30 text-primary dark:text-[#5bb3e8] px-1 py-0.5 rounded shrink-0">
                                            {b}
                                          </span>
                                        ))}
                                      </div>
                                      <div className="text-gray-500 dark:text-gray-400 text-[10px] break-words leading-tight">{resItems}</div>
                                    </td>
                                    <td className="py-2 px-1 text-right text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                      {metodoLabel}
                                    </td>
                                    <td className="py-2 px-1 text-right font-grotesk font-bold text-[#005e97] dark:text-[#5bb3e8] whitespace-nowrap">
                                      {formatUsd(parseFloat(v.total_usd) || 0)}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-gray-200 dark:border-[#2d3148]">
                                <td colSpan={2} className="py-2 px-1 font-manrope font-bold text-xs text-gray-500 dark:text-gray-400">
                                  {ventasDetalle.length} transacción{ventasDetalle.length !== 1 ? 'es' : ''}
                                </td>
                                <td className="py-2 px-1 text-right font-manrope font-bold text-xs text-gray-500 dark:text-gray-400">TOTAL</td>
                                <td className="py-2 px-1 text-right font-grotesk font-bold text-sm text-primary dark:text-[#5bb3e8]">
                                  {formatUsd(ventasDetalle.reduce((s, v) => s + (parseFloat(v.total_usd) || 0), 0))}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Insumos al cierre */}
                <div className="mb-5 break-inside-avoid">
                  <p className="text-xs font-manrope font-bold text-gray-400 dark:text-gray-500 tracking-wider mb-2">
                    ESTADO DE INSUMOS AL CORTE
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 dark:bg-[#1a1d27] rounded-lg px-3 py-2">
                      <span className="font-inter text-xs text-gray-400 dark:text-gray-500 block">Tapas usadas / restantes</span>
                      <span className="font-grotesk font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]">
                        {cierreActual.tapas_usadas} / {cierreActual.tapas_restantes.toLocaleString('es-VE')}
                      </span>
                    </div>
                    <div className="bg-gray-50 dark:bg-[#1a1d27] rounded-lg px-3 py-2">
                      <span className="font-inter text-xs text-gray-400 dark:text-gray-500 block">Precintos usados / restantes</span>
                      <span className="font-grotesk font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]">
                        {cierreActual.precintos_usados} / {cierreActual.precintos_restantes.toLocaleString('es-VE')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Operario y firmas */}
                <div className="bg-gray-50 dark:bg-[#1a1d27] rounded-xl px-4 py-3 flex items-center justify-between border border-gray-100 dark:border-[#2d3148] break-inside-avoid">
                  <div>
                    <span className="font-inter text-xs text-gray-400 dark:text-gray-500 block">Operario Cajero</span>
                    <span className="font-manrope font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]">{cierreActual.operario}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-inter text-xs text-gray-400 dark:text-gray-500 block">Estación de Trabajo</span>
                    <span className="font-grotesk font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]">{cierreActual.estacion}</span>
                  </div>
                </div>

                <div className="mt-12 mb-4 hidden print-header-visible break-inside-avoid">
                   <div className="flex justify-between items-end border-t-2 border-gray-800 pt-2 mx-10 mt-20">
                       <div className="text-center w-1/2 font-manrope font-bold text-sm uppercase">Firma Operario</div>
                       <div className="text-center w-1/2 font-manrope font-bold text-sm uppercase">Firma Supervisor</div>
                   </div>
                </div>

                {/* Tasa BCV al cierre */}
                <div className="text-center mt-4">
                  <span className="font-grotesk text-xs text-gray-400 dark:text-gray-500">
                    Tasa Oficial BCV Calculada en Cierre: $1 = {tasaBcv.valor.toFixed(2)} VES
                  </span>
                </div>

                {/* Print button */}
                <button
                  onClick={imprimirCierre}
                  className="w-full mt-5 py-3 rounded-xl font-manrope font-bold text-white shadow-md
                    transition-all no-print flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
                >
                  <Printer size={18} />
                  Imprimir Cierre
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Toast */}
      <Toast toast={toast} />

      {/* ═══════ PRINT STYLES ═════════════════════════════════════════ */}
      <style>{`
        @media print {
          /* Hide everything outside the modal */
          aside, header, nav, .no-print,
          footer, [class*="bottom-nav"] {
            display: none !important;
          }

          /* Make main content full width, no padding */
          main {
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }

          /* Hide the modal backdrop */
          .print-cierre-backdrop {
            position: static !important;
            background: transparent !important;
          }

          .print-cierre-backdrop > .bg-black\\/50 {
            display: none !important;
          }

          /* Show the print-only header */
          .print-header-visible {
            display: block !important;
          }

          /* Style the modal content for print */
          .print-cierre-content {
            max-width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: white !important;
            color: #191c1e !important;
            margin: 0 !important;
          }

          /* Override dark mode colors for print */
          .print-cierre-content * {
            color: #191c1e !important;
            background-color: transparent !important;
            border-color: #e5e7eb !important;
          }

          .print-cierre-content .bg-gray-50,
          .print-cierre-content .bg-blue-50,
          .print-cierre-content [class*="bg-\\[#1a1d27\\]"] {
            background-color: #f9fafb !important;
          }

          /* Force print page settings */
          @page {
            size: letter portrait;
            margin: 1cm;
          }

          body {
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  )
}