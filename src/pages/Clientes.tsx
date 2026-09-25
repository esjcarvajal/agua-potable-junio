import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useLocation } from 'react-router-dom'
import { Search, Plus, X, Phone, MapPin, User, Edit2, ChevronRight, PackagePlus, FileText, Printer, Mail, MessageCircle, Minus } from 'lucide-react'
import { CATALOGO_PRODUCTOS, PRODUCTOS_ENTREGA_CREDITO } from '../lib/catalogoProductos'
import { useProductos } from '../lib/useProductos'
import { useAuthStore } from '../store/useAuthStore'
import { getLocalDateString } from '../lib/dateUtils'

/* ════════════════════════════════════════════════════════════════════
   TOAST (reusable inline)
   ════════════════════════════════════════════════════════════════════ */
interface ToastState { mensaje: string; tipo: 'success' | 'error' | 'warning'; visible: boolean }
const TOAST_COLORS = { success: '#16a34a', error: '#dc2626', warning: '#d97706' }

function Toast({ toast }: { toast: ToastState }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: TOAST_COLORS[toast.tipo], color: 'white',
      padding: '14px 22px', borderRadius: 12,
      fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600,
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      opacity: toast.visible ? 1 : 0, transition: 'opacity 0.3s ease',
      pointerEvents: toast.visible ? 'auto' : 'none', maxWidth: 360,
    }}>
      {toast.mensaje}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   CLIENTES PAGE
   ════════════════════════════════════════════════════════════════════ */
export default function Clientes() {
  const store = useAppStore()
  const location = useLocation()
  const { clientes, ventas, prepagos } = store

  // ── State ──
  const [busqueda, setBusqueda] = useState('')
  const [showNuevoModal, setShowNuevoModal] = useState(false)
  const [showDetalleModal, setShowDetalleModal] = useState(false)
  const [clienteDetalle, setClienteDetalle] = useState<any>(null)

  // ── Entrega a crédito ──────────────────────────────────────────
  // Reemplaza el metodo anterior de escribir una cifra a mano. Crea una
  // venta real por debajo: factura, descuento de inventario y deuda.
  const [showEntrega, setShowEntrega] = useState(false)
  const [entregaCantidades, setEntregaCantidades] = useState<Record<string, number>>({})
  const [entregaCiclo, setEntregaCiclo] = useState<7 | 15 | 30>(30)
  const [guardandoEntrega, setGuardandoEntrega] = useState(false)
  // Fecha real de la entrega. Sirve para poner al dia entregas de dias
  // pasados que se habian anotado a mano y nunca se registraron.
  const [entregaFecha, setEntregaFecha] = useState(getLocalDateString())
  // Precio por unidad de esta entrega concreta. El precio de lista es solo
  // el punto de partida: a las empresas se les factura delivery, y ese
  // precio cambia con el tiempo. Sin esto los montos saldrian mal.
  const [entregaPrecios, setEntregaPrecios] = useState<Record<string, string>>({})
  // Empresa o sucursal que recibe el despacho. Un mismo pagador (Hasibi)
  // puede tener varias empresas (JACIDI, Navicu...): cada una recibe por
  // separado pero la factura la paga una sola. El desglose se agrupa por
  // este campo para poder mostrarle el detalle de cada una.
  const [entregaNota, setEntregaNota] = useState('')
  const [showEstadoCuenta, setShowEstadoCuenta] = useState(false)

  const preciosConfig = useProductos()
  const sesionActual = useAuthStore(st => st.sesion)

  // Ficha tecnica + precio configurado, para los productos que tiene
  // sentido entregar a una empresa.
  const productosEntrega = useMemo(() => {
    return PRODUCTOS_ENTREGA_CREDITO
      .map(id => {
        const ficha = CATALOGO_PRODUCTOS.find(f => f.id === id)
        const cfg = preciosConfig.find(c => c.id === id)
        if (!ficha) return null
        return {
          id: ficha.id,
          nombre: cfg?.nombre || ficha.nombre,
          precio: cfg?.precioUsd ?? 0,
          litros: ficha.litros,
          esRecarga: ficha.esRecarga,
          esDesinfeccion: ficha.esDesinfeccion,
        }
      })
      .filter(Boolean) as any[]
  }, [preciosConfig])
  const [editMode, setEditMode] = useState(false)

  // Form state
  const [formNombre, setFormNombre] = useState('')
  const [formTelefono, setFormTelefono] = useState('')
  const [formDireccion, setFormDireccion] = useState('')
  const [formZona, setFormZona] = useState('')
  const [formNotas, setFormNotas] = useState('')
  const [formEsPostpago, setFormEsPostpago] = useState(false)
  const [formCiclo, setFormCiclo] = useState<7|15|30>(7)
  const [formLimite, setFormLimite] = useState('')
  const [activeTab, setActiveTab] = useState<'datos'|'cobrar'>('datos')
  const [pagoDeudaId, setPagoDeudaId] = useState<string | null>(null)
  const [pagoMetodo, setPagoMetodo] = useState('EFECTIVO USD')
  /** Monto a abonar. Vacio = pagar la deuda completa. */
  const [pagoMonto, setPagoMonto] = useState('')
  
  // Toast
  const [toast, setToast] = useState<ToastState>({ mensaje: '', tipo: 'success', visible: false })
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((mensaje: string, tipo: 'success' | 'error' | 'warning') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ mensaje, tipo, visible: true })
    toastTimer.current = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000)
  }, [])
  useEffect(() => { return () => { if (toastTimer.current) clearTimeout(toastTimer.current) } }, [])

  useEffect(() => {
    if (location.state?.preseleccionarClienteId && clientes.length > 0) {
      const c = clientes.find((cx: any) => cx.id === location.state.preseleccionarClienteId)
      if (c) {
        abrirDetalle(c)
        setActiveTab('cobrar')
        window.history.replaceState({}, document.title)
      }
    }
  }, [location.state, clientes])

  // ── Filtered list ──
  const clientesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return clientes
    const q = busqueda.toLowerCase()
    return clientes.filter(
      (c: any) => String(c.nombre || '').toLowerCase().includes(q) || String(c.telefono || '').toLowerCase().includes(q)
    )
  }, [busqueda, clientes])

  // ── Stats for a client ──
  const getClienteStats = (clienteId: string) => {
    const ventasCliente = ventas.filter((v: any) => v.cliente_id === clienteId)
    const totalUsd = ventasCliente.reduce((sum: number, v: any) => sum + (parseFloat(v.total_usd) || 0), 0)
    const prepagosActivos = prepagos.filter(
      (p: any) => p.cliente_id === clienteId && (p.recargas_usadas ?? 0) < (p.recargas_compradas ?? 0)
    )
    const recargasDisponibles = prepagosActivos.reduce(
      (sum: number, p: any) => sum + ((p.recargas_compradas ?? 0) - (p.recargas_usadas ?? 0)), 0
    )
    return { totalCompras: ventasCliente.length, totalUsd, recargasDisponibles }
  }

  const getNivel = (totalUsd: number) => {
    if (totalUsd >= 200) return { label: 'VIP', color: '#ca8a04', bg: '#fef9c3' }
    if (totalUsd >= 50) return { label: 'ELITE', color: '#005e97', bg: '#dbeafe' }
    return { label: 'REGULAR', color: '#6b7280', bg: '#f3f4f6' }
  }

  // ── Handlers ──
  const resetForm = () => {
    setFormNombre(''); setFormTelefono(''); setFormDireccion(''); setFormZona(''); setFormNotas('');
    setFormEsPostpago(false); setFormCiclo(7); setFormLimite('')
  }

  const handleCrear = async () => {
    if (!formNombre.trim()) {
      showToast('El nombre es obligatorio', 'error')
      return
    }

    const nuevoCliente = {
      id: crypto.randomUUID(),
      nombre: formNombre.trim(),
      telefono: formTelefono.trim(),
      direccion: formDireccion.trim(),
      zona_delivery: formZona.trim(),
      notas: formNotas.trim(),
      saldo_usd: 0,
      deudaTotalUsd: 0,
      esPostpago: formEsPostpago,
      configPostpago: formEsPostpago ? { ciclo: formCiclo, limiteCredito: parseFloat(formLimite) || 0, activo: true } : undefined,
      fecha_registro: getLocalDateString(),
      activo: true,
    }

    await store.agregarCliente(nuevoCliente)
    showToast(`Cliente "${nuevoCliente.nombre}" registrado exitosamente`, 'success')
    resetForm()
    setShowNuevoModal(false)
  }


  // ── Entrega a crédito ────────────────────────────────────────────
  /** Precio que se aplica: el escrito a mano, o el de lista si no se tocó. */
  const precioDe = useCallback((prod: any) => {
    const escrito = entregaPrecios[prod.id]
    if (escrito === undefined || escrito.trim() === '') return prod.precio
    const n = parseFloat(escrito.replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? n : prod.precio
  }, [entregaPrecios])

  const totalEntrega = useMemo(() =>
    productosEntrega.reduce((t, p) => t + precioDe(p) * (entregaCantidades[p.id] || 0), 0),
    [productosEntrega, entregaCantidades, precioDe])

  const cambiarCantidad = (id: string, delta: number) => {
    setEntregaCantidades(prev => {
      const n = Math.max(0, (prev[id] || 0) + delta)
      const copia = { ...prev }
      if (n === 0) delete copia[id]
      else copia[id] = n
      return copia
    })
  }

  const confirmarEntrega = async () => {
    if (!clienteDetalle) return
    const items = productosEntrega
      .filter(p => (entregaCantidades[p.id] || 0) > 0)
      .map(p => ({
        // Se guarda el precio realmente cobrado, no el de lista: es lo que
        // sale luego en el desglose que se le manda al cliente.
        producto: { ...p, precio: precioDe(p) },
        cantidad: entregaCantidades[p.id],
      }))

    if (items.length === 0) {
      showToast('Agregue al menos un producto', 'warning')
      return
    }

    setGuardandoEntrega(true)
    const res = await store.registrarEntregaCredito({
      clienteId: clienteDetalle.id,
      clienteNombre: clienteDetalle.nombre,
      items,
      ciclo: entregaCiclo,
      usuario: sesionActual?.nombre || '',
      fecha: entregaFecha,
      nota: entregaNota.trim(),
    })
    setGuardandoEntrega(false)

    if (!res.ok) {
      showToast(res.error || 'No se pudo registrar la entrega', 'error')
      return
    }
    showToast(`Entrega registrada — Orden ${res.numeroOrden}`, 'success')
    setEntregaCantidades({})
    setEntregaPrecios({})
    setEntregaNota('')
    setEntregaFecha(getLocalDateString())
    setShowEntrega(false)
  }

  // ── Estado de cuenta ─────────────────────────────────────────────
  // El POS guardaba el vencimiento como ISO completo y aqui se le pegaba
  // 'T00:00:00' encima: de ahi el "Vence Invalid Date".
  const fmtFechaCuenta = (f: any): string => {
    const base = String(f || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return '—'
    const d = new Date(base + 'T00:00:00')
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-VE')
  }
  // Une cada deuda con los productos de su venta. El detalle siempre
  // estuvo guardado en items_json; simplemente no se mostraba.
  const detalleCuenta = useMemo(() => {
    if (!clienteDetalle) return []
    return store.getDeudasCliente(clienteDetalle.id)
      .filter(d => d.estado !== 'pagada')
      .map(d => {
        const venta: any = ventas.find((v: any) => v.id === d.ventaId)
        let items: any[] = []
        try { items = JSON.parse(venta?.items_json || '[]') } catch { items = [] }
        const pagado = Number((d as any).montoPagadoUsd) || 0
        const delivery = venta?.es_delivery ? (parseFloat(venta?.costo_delivery_usd) || 0) : 0
        return {
          ...d,
          delivery,
          orden: venta?.numero_orden || '—',
          empresa: (venta?.nota || '').trim(),
          fecha: venta?.fecha || d.fechaVenta,
          items,
          pagado,
          pendiente: Math.max(0, d.montoUsd - pagado),
        }
      })
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
  }, [clienteDetalle, ventas, store])

  const totalPendiente = useMemo(
    () => detalleCuenta.reduce((t, d) => t + d.pendiente, 0), [detalleCuenta])

  // Lo que dice la ficha del cliente (lo que muestra el POS como DEUDA)
  // frente a lo que se puede respaldar venta por venta. Si no cuadran,
  // se avisa en pantalla (no en lo que se imprime ni se envia).
  const conciliacionCuenta = useMemo(() => {
    if (!clienteDetalle) return null
    const ficha = Math.max(0, parseFloat((clienteDetalle as any).deudaTotalUsd) || 0)
    const idsConDeuda = new Set(store.deudas.map((d: any) => d.ventaId))
    const ventasSinFicha = ventas.filter((v: any) =>
      v.cliente_id === clienteDetalle.id &&
      v.metodo_pago === 'post_pago' &&
      !idsConDeuda.has(v.id))
    const diferencia = parseFloat((ficha - totalPendiente).toFixed(2))
    return { ficha, diferencia, ventasSinFicha }
  }, [clienteDetalle, ventas, store.deudas, totalPendiente])

  /** Agrupa por empresa receptora. Si ninguna entrega la trae, devuelve un
   *  solo grupo sin título y el desglose se ve como una lista corrida. */
  const gruposCuenta = useMemo(() => {
    const hayEmpresas = detalleCuenta.some(d => d.empresa)
    if (!hayEmpresas) return [{ empresa: '', deudas: detalleCuenta, total: totalPendiente }]
    const mapa = new Map<string, any[]>()
    for (const d of detalleCuenta) {
      const k = d.empresa || 'Sin especificar'
      if (!mapa.has(k)) mapa.set(k, [])
      mapa.get(k)!.push(d)
    }
    return Array.from(mapa.entries()).map(([empresa, deudas]) => ({
      empresa,
      deudas,
      total: deudas.reduce((t, d) => t + d.pendiente, 0),
    }))
  }, [detalleCuenta, totalPendiente])

  /** Texto plano del desglose, para WhatsApp y correo. */
  const textoEstadoCuenta = useCallback(() => {
    if (!clienteDetalle) return ''
    const L: string[] = []
    L.push(`*ESTADO DE CUENTA*`)
    L.push(`Agua Potable La Campiña C.A.`)
    L.push(`Cliente: ${clienteDetalle.nombre}`)
    L.push(`Fecha: ${new Date().toLocaleDateString('es-VE')}`)
    L.push('')
    for (const g of gruposCuenta) {
      if (g.empresa) {
        L.push(`──────────────`)
        L.push(`*${g.empresa.toUpperCase()}*`)
      }
      for (const d of g.deudas) {
        L.push(`${fmtFechaCuenta(d.fecha)} — Orden ${d.orden}`)
        for (const it of d.items) {
          L.push(`   ${it.cantidad} x ${it.producto?.nombre || '?'} .... $${((it.producto?.precio || 0) * it.cantidad).toFixed(2)}`)
        }
        if (d.delivery > 0) L.push(`   Delivery .... $${d.delivery.toFixed(2)}`)
        if (d.pagado > 0) L.push(`   Abonado: -$${d.pagado.toFixed(2)}`)
        L.push(`   Subtotal: $${d.pendiente.toFixed(2)}`)
        L.push('')
      }
      if (g.empresa) {
        L.push(`Subtotal ${g.empresa}: $${g.total.toFixed(2)}`)
        L.push('')
      }
    }
    L.push(`*TOTAL PENDIENTE: $${totalPendiente.toFixed(2)}*`)
    return L.join('\n')
  }, [clienteDetalle, gruposCuenta, totalPendiente])

  const enviarPorWhatsApp = () => {
    const tel = String(clienteDetalle?.telefono || '').replace(/\D/g, '')
    const texto = encodeURIComponent(textoEstadoCuenta())
    // Sin telefono, WhatsApp abre el selector de contactos.
    window.open(tel ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`, '_blank')
  }

  const enviarPorCorreo = () => {
    const asunto = encodeURIComponent(`Estado de cuenta — ${clienteDetalle?.nombre || ''}`)
    const cuerpo = encodeURIComponent(textoEstadoCuenta().replace(/\*/g, ''))
    window.location.href = `mailto:${clienteDetalle?.email || ''}?subject=${asunto}&body=${cuerpo}`
  }


  const handleEditar = async () => {
    console.log('[handleEditar] Iniciando', { clienteDetalle, formNombre, formEsPostpago, formCiclo, formLimite })
    if (!clienteDetalle || !formNombre.trim()) {
      showToast('El nombre del cliente es obligatorio', 'error')
      return
    }

    // Construir objeto COMPLETO del cliente (no un merge parcial)
    // Esto es necesario porque Firebase update() ignora undefined
    const clienteActualizado = {
      ...clienteDetalle,               // mantiene id, fecha_registro, saldo_usd, etc.
      nombre: String(formNombre).trim(),
      telefono: String(formTelefono).trim(),
      direccion: String(formDireccion).trim(),
      zona_delivery: String(formZona).trim(),
      notas: String(formNotas).trim(),
      esPostpago: formEsPostpago,
      configPostpago: formEsPostpago
        ? { ciclo: formCiclo, limiteCredito: parseFloat(String(formLimite)) || 0, activo: true }
        : null,   // null en vez de undefined: Firebase puede borrarlo
    }

    // Actualizar estado local del store y base de datos simultáneamente
    store.actualizarCliente(clienteDetalle.id, {
      nombre: clienteActualizado.nombre,
      telefono: clienteActualizado.telefono,
      direccion: clienteActualizado.direccion,
      zona_delivery: clienteActualizado.zona_delivery,
      notas: clienteActualizado.notas,
      esPostpago: clienteActualizado.esPostpago,
      configPostpago: clienteActualizado.configPostpago,
    })

    // Actualizar el detalle que está abierto en el modal
    setClienteDetalle(clienteActualizado)
    setEditMode(false)

    const msg = formEsPostpago
      ? `✓ Cliente actualizado — Crédito post-pago habilitado (${formCiclo} días, límite $${parseFloat(formLimite || '0').toFixed(2)})`
      : '✓ Cliente actualizado correctamente'
    showToast(msg, 'success')
  }

  const abrirDetalle = (c: any) => {
    setClienteDetalle(c)
    setFormNombre(c.nombre || '')
    setFormTelefono(c.telefono || '')
    setFormDireccion(c.direccion || '')
    setFormZona(c.zona_delivery || '')
    setFormNotas(c.notas || '')
    setFormEsPostpago(c.esPostpago || false)
    setFormCiclo(c.configPostpago?.ciclo || 7)
    setFormLimite(c.configPostpago?.limiteCredito ? c.configPostpago.limiteCredito.toString() : '')
    setEditMode(false)
    setActiveTab('datos')
    setShowDetalleModal(true)
  }

  /** Cuanto queda por pagar de una deuda (descontando abonos previos) */
  const pendienteDeuda = (d: any) => {
    if (!d) return 0
    const total = Math.max(0, Number(d.montoUsd) || 0)
    const pagado = Math.max(0, Number(d.montoPagadoUsd) || 0)
    return Math.max(0, total - pagado)
  }

  const procesarPagoDeuda = async () => {
    if (!pagoDeudaId) return
    const deuda = store.deudas.find((d: any) => d.id === pagoDeudaId)
    if (!deuda) return

    const pendiente = pendienteDeuda(deuda)
    if (pendiente <= 0) {
      showToast('Esta deuda ya está saldada', 'error')
      setPagoDeudaId(null)
      return
    }

    // Monto vacio = pagar todo lo pendiente
    const solicitado = pagoMonto.trim() === '' ? pendiente : (parseFloat(pagoMonto) || 0)
    if (solicitado <= 0) {
      showToast('Ingresa un monto mayor a cero', 'error')
      return
    }
    if (solicitado > pendiente + 0.001) {
      showToast(`El monto excede lo pendiente ($${pendiente.toFixed(2)})`, 'error')
      return
    }

    // Pago con saldo a favor: verificar disponibilidad
    if (pagoMetodo === 'SALDO A FAVOR') {
      const cliente = store.clientes.find((c: any) => c.id === deuda.clienteId)
      const disponible = Math.max(0, parseFloat(cliente?.saldo_usd) || 0)
      if (disponible < solicitado) {
        showToast(
          `Saldo insuficiente: $${disponible.toFixed(2)} disponible(s) para abonar $${solicitado.toFixed(2)}`,
          'error'
        )
        return
      }
    }

    const aplicado = await store.abonarDeuda(pagoDeudaId, solicitado, pagoMetodo)
    if (aplicado <= 0) {
      showToast('No se pudo registrar el abono', 'error')
      return
    }

    if (pagoMetodo === 'SALDO A FAVOR') {
      await store.consumirSaldoFavor(deuda.clienteId, aplicado)
    }

    const restante = pendiente - aplicado
    showToast(
      restante <= 0.001
        ? `Deuda saldada — $${aplicado.toFixed(2)} registrado`
        : `Abono de $${aplicado.toFixed(2)} registrado · Restan $${restante.toFixed(2)}`,
      'success'
    )
    setPagoDeudaId(null)
    setPagoMetodo('EFECTIVO USD')
    setPagoMonto('')
  }

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <div className="relative min-h-[calc(100vh-57px)] -m-6 bg-surface dark:bg-[#0f1117] p-6 overflow-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div>
          <h1 className="font-manrope text-2xl font-bold text-onSurface dark:text-[#e4e6f0]">Clientes</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-inter mt-0.5">
            {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} registrado{clientes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowNuevoModal(true) }}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-manrope font-bold text-white text-sm shadow-md
            hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
        >
          <Plus size={18} /> Nuevo Cliente
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o teléfono..."
          className="w-full bg-white dark:bg-[#1e2235] border-2 border-gray-100 dark:border-[#2d3148] rounded-xl pl-12 pr-4 py-3.5 text-sm font-inter text-gray-800 dark:text-[#e4e6f0]
            outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors shadow-sm"
        />
      </div>

      {/* Client list */}
      {clientesFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <User size={48} className="mb-4 text-gray-200" />
          <p className="font-manrope font-bold text-lg text-gray-400 mb-1">
            {busqueda ? 'Sin resultados' : 'Sin clientes registrados'}
          </p>
          <p className="font-inter text-sm text-gray-400">
            {busqueda ? 'Intenta con otro término' : 'Registra tu primer cliente con el botón de arriba'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientesFiltrados.map((c: any) => {
            const stats = getClienteStats(c.id)
            const nivel = getNivel(stats.totalUsd)
            return (
              <button
                key={c.id}
                onClick={() => abrirDetalle(c)}
                className="bg-white dark:bg-[#1e2235] rounded-xl p-5 text-left border-2 border-transparent shadow-sm
                  hover:border-primary dark:hover:border-[#5bb3e8] hover:shadow-md transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-manrope font-bold text-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}>
                    {(c.nombre || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-manrope font-bold text-sm text-onSurface dark:text-[#e4e6f0] truncate">
                        {c.nombre}
                      </span>
                      <span className="text-[9px] font-bold font-grotesk px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ color: nivel.color, background: nivel.bg }}>
                        {nivel.label}
                      </span>
                      {c.esPostpago && (() => {
                        const deudasCliente = store.getDeudasCliente(c.id)
                        const deudasVencidas = deudasCliente.filter(d => d.estado === 'pendiente' && d.fechaVencimiento < new Date().toISOString())
                        return (
                          <span className={`text-[9px] font-bold font-grotesk px-1.5 py-0.5 rounded-full flex-shrink-0 ${deudasVencidas.length > 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
                            {deudasVencidas.length > 0 ? 'DEUDA VENCIDA' : 'CRÉDITO ACTIVO'}
                          </span>
                        )
                      })()}
                    </div>
                    {c.telefono && (
                      <span className="text-xs text-gray-400 font-grotesk flex items-center gap-1 mt-0.5">
                        <Phone size={10} /> {c.telefono}
                      </span>
                    )}
                  </div>
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-primary transition-colors flex-shrink-0" />
                </div>

                <div className="flex gap-3 text-xs">
                  <div className="bg-gray-50 dark:bg-[#1a1d27] rounded-lg px-2.5 py-1.5 flex-1 border border-transparent dark:border-[#2d3148]">
                    <span className="text-gray-400 dark:text-gray-500 font-inter block">Compras</span>
                    <span className="font-grotesk font-bold text-onSurface dark:text-[#e4e6f0]">{stats.totalCompras}</span>
                  </div>
                  <div className="bg-gray-50 dark:bg-[#1a1d27] rounded-lg px-2.5 py-1.5 flex-1 border border-transparent dark:border-[#2d3148]">
                    <span className="text-gray-400 dark:text-gray-500 font-inter block">Total</span>
                    <span className="font-grotesk font-bold text-primary dark:text-[#5bb3e8]">${stats.totalUsd.toFixed(2)}</span>
                  </div>
                  {stats.recargasDisponibles > 0 && (
                    <div className="rounded-lg px-2.5 py-1.5 flex-1" style={{ background: '#f0fdf4' }}>
                      <span className="text-gray-400 font-inter block">Prepago</span>
                      <span className="font-grotesk font-bold" style={{ color: '#16a34a' }}>{stats.recargasDisponibles}</span>
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ──────────────── MODAL NUEVO CLIENTE ──────────────── */}
      {showNuevoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowNuevoModal(false)} />
          <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-6 w-full max-w-md shadow-2xl relative z-10 mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-manrope text-xl font-bold text-onSurface dark:text-[#e4e6f0]">Nuevo Cliente</h2>
              <button onClick={() => setShowNuevoModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-[#5bb3e8]">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">
                  Nombre completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" value={formNombre} onChange={e => setFormNombre(e.target.value)}
                  placeholder="Ej: María García"
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-xl p-3 font-inter text-sm text-gray-800 dark:text-[#e4e6f0] outline-none
                    focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">Teléfono</label>
                <input
                  type="tel" value={formTelefono} onChange={e => setFormTelefono(e.target.value)}
                  placeholder="0424-1234567"
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-xl p-3 font-inter text-sm text-gray-800 dark:text-[#e4e6f0] outline-none
                    focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">Dirección</label>
                <input
                  type="text" value={formDireccion} onChange={e => setFormDireccion(e.target.value)}
                  placeholder="Calle 5, Casa 12..."
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-xl p-3 font-inter text-sm text-gray-800 dark:text-[#e4e6f0] outline-none
                    focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">Zona de delivery</label>
                <input
                  type="text" value={formZona} onChange={e => setFormZona(e.target.value)}
                  placeholder="Ej: La Campiña, Sector 3"
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-xl p-3 font-inter text-sm text-gray-800 dark:text-[#e4e6f0] outline-none
                    focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">Notas</label>
                <textarea
                  value={formNotas} onChange={e => setFormNotas(e.target.value)}
                  placeholder="Observaciones..."
                  rows={2}
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-xl p-3 font-inter text-sm text-gray-800 dark:text-[#e4e6f0] outline-none
                    focus:border-primary dark:focus:border-[#5bb3e8] transition-colors resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowNuevoModal(false)}
                className="flex-1 py-3 rounded-xl font-manrope font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2d3148] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCrear}
                className="flex-1 py-3 rounded-xl font-manrope font-bold text-white shadow-md transition-colors"
                style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
              >
                Registrar Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── MODAL DETALLE CLIENTE ──────────────── */}
      {showDetalleModal && clienteDetalle && (() => {
        const stats = getClienteStats(clienteDetalle.id)
        const nivel = getNivel(stats.totalUsd)
        const ventasCliente = ventas.filter((v: any) => v.cliente_id === clienteDetalle.id).slice(0, 10)
        const prepagosCliente = prepagos.filter((p: any) => p.cliente_id === clienteDetalle.id)

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDetalleModal(false)} />
            <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-6 w-full max-w-lg shadow-2xl relative z-10 mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-manrope text-xl font-bold text-onSurface dark:text-[#e4e6f0]">
                  {editMode ? 'Editar Cliente' : 'Detalle del Cliente'}
                </h2>
                <div className="flex items-center gap-2">
                  {!editMode && (
                    <button onClick={() => setEditMode(true)}
                      className="text-gray-400 hover:text-primary dark:hover:text-[#5bb3e8] transition-colors">
                      <Edit2 size={18} />
                    </button>
                  )}
                  <button onClick={() => setShowDetalleModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-[#5bb3e8]">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {editMode ? (
                <>
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">Nombre</label>
                      <input type="text" value={formNombre} onChange={e => setFormNombre(e.target.value)}
                        className="w-full border-2 border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] text-gray-800 dark:text-[#e4e6f0] rounded-xl p-3 font-inter text-sm outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">Teléfono</label>
                      <input type="tel" value={formTelefono} onChange={e => setFormTelefono(e.target.value)}
                        className="w-full border-2 border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] text-gray-800 dark:text-[#e4e6f0] rounded-xl p-3 font-inter text-sm outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">Dirección</label>
                      <input type="text" value={formDireccion} onChange={e => setFormDireccion(e.target.value)}
                        className="w-full border-2 border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] text-gray-800 dark:text-[#e4e6f0] rounded-xl p-3 font-inter text-sm outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">Zona delivery</label>
                      <input type="text" value={formZona} onChange={e => setFormZona(e.target.value)}
                        className="w-full border-2 border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] text-gray-800 dark:text-[#e4e6f0] rounded-xl p-3 font-inter text-sm outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">Notas</label>
                      <textarea value={formNotas} onChange={e => setFormNotas(e.target.value)} rows={2}
                        className="w-full border-2 border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] text-gray-800 dark:text-[#e4e6f0] rounded-xl p-3 font-inter text-sm outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors resize-none" />
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-[#2d3148]">
                      <label className="flex items-center gap-3 cursor-pointer mb-4">
                        <div className="relative">
                          <input type="checkbox" className="sr-only" checked={formEsPostpago} onChange={e => setFormEsPostpago(e.target.checked)} />
                          <div className={`block w-10 h-6 rounded-full transition-colors ${formEsPostpago ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                          <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formEsPostpago ? 'translate-x-4' : ''}`}></div>
                        </div>
                        <span className="font-manrope font-bold text-sm text-gray-700 dark:text-[#e4e6f0]">Habilitar Crédito (Post-pago)</span>
                      </label>
                      {formEsPostpago && (
                        <div className="grid grid-cols-2 gap-3 pl-2 border-l-2 border-primary/20">
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Días de crédito</label>
                            <select value={formCiclo} onChange={e => setFormCiclo(Number(e.target.value) as any)}
                              className="w-full border-2 border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-xl p-2.5 font-inter text-sm outline-none focus:border-primary text-gray-800 dark:text-[#e4e6f0]">
                              <option value={7}>7 días</option>
                              <option value={15}>15 días</option>
                              <option value={30}>30 días</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Límite (USD)</label>
                            <input type="number" min="0" step="0.01" value={formLimite} onChange={e => setFormLimite(e.target.value)}
                              placeholder="Ej: 50.00"
                              className="w-full border-2 border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-xl p-2.5 font-inter text-sm outline-none focus:border-primary text-gray-800 dark:text-[#e4e6f0]" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setEditMode(false)}
                      className="flex-1 py-3 rounded-xl font-manrope font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2d3148] transition-colors">
                      Cancelar
                    </button>
                    <button onClick={handleEditar}
                      className="flex-1 py-3 rounded-xl font-manrope font-bold text-white shadow-md"
                      style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}>
                      Guardar Cambios
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Client info header */}
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-manrope font-bold text-xl flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}>
                      {(clienteDetalle.nombre || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-manrope font-bold text-lg text-onSurface dark:text-[#e4e6f0] truncate">{clienteDetalle.nombre}</span>
                        <span className="text-[10px] font-bold font-grotesk px-2 py-0.5 rounded-full"
                          style={{ color: nivel.color, background: nivel.bg }}>{nivel.label}</span>
                      </div>
                      {clienteDetalle.telefono && (
                        <span className="text-sm text-gray-500 font-grotesk flex items-center gap-1">
                          <Phone size={12} /> {clienteDetalle.telefono}
                        </span>
                      )}
                      {clienteDetalle.direccion && (
                        <span className="text-sm text-gray-400 font-inter flex items-center gap-1 mt-0.5">
                          <MapPin size={12} /> {clienteDetalle.direccion}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* TABS */}
                  <div className="flex gap-4 border-b border-gray-100 dark:border-[#2d3148] mb-5">
                    <button onClick={() => setActiveTab('datos')} className={`pb-2 text-sm font-manrope font-bold border-b-2 transition-colors ${activeTab==='datos' ? 'border-primary text-primary dark:text-[#5bb3e8]' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-[#e4e6f0]'}`}>Datos y Estadísticas</button>
                    {clienteDetalle.esPostpago && (
                      <button onClick={() => setActiveTab('cobrar')} className={`pb-2 text-sm font-manrope font-bold border-b-2 transition-colors ${activeTab==='cobrar' ? 'border-primary text-primary dark:text-[#5bb3e8]' : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-[#e4e6f0]'}`}>Cuentas por Cobrar</button>
                    )}
                  </div>

                  {activeTab === 'datos' ? (
                    <>
                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="bg-gray-50 dark:bg-[#1a1d27] rounded-xl p-3 text-center border border-transparent dark:border-[#2d3148]">
                      <div className="text-xs text-gray-400 dark:text-gray-500 font-inter mb-1">Compras</div>
                      <div className="font-grotesk font-bold text-lg text-onSurface dark:text-[#e4e6f0]">{stats.totalCompras}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-[#1a1d27] rounded-xl p-3 text-center border border-transparent dark:border-[#2d3148]">
                      <div className="text-xs text-gray-400 dark:text-gray-500 font-inter mb-1">Total USD</div>
                      <div className="font-grotesk font-bold text-lg text-primary dark:text-[#5bb3e8]">${stats.totalUsd.toFixed(2)}</div>
                    </div>
                    <div className={`rounded-xl p-3 text-center border border-transparent ${stats.recargasDisponibles > 0 ? 'bg-[#f0fdf4] dark:bg-green-900/20 dark:border-green-800' : 'bg-[#f9fafb] dark:bg-[#1a1d27] dark:border-[#2d3148]'}`}>
                      <div className="text-xs text-gray-400 dark:text-gray-500 font-inter mb-1">Prepago</div>
                      <div className={`font-grotesk font-bold text-lg ${stats.recargasDisponibles > 0 ? 'text-[#16a34a] dark:text-[#22c55e]' : 'text-[#6b7280] dark:text-gray-500'}`}>
                        {stats.recargasDisponibles}
                      </div>
                    </div>
                  </div>

                  {/* Prepagos activos */}
                  {prepagosCliente.length > 0 && (
                    <div className="mb-5">
                      <p className="text-xs font-manrope font-bold text-gray-400 tracking-wider mb-2">PREPAGOS</p>
                      <div className="space-y-2">
                        {prepagosCliente.map((p: any) => {
                          const usadas = p.recargas_usadas ?? 0
                          const compradas = p.recargas_compradas ?? 0
                          const restantes = compradas - usadas
                          const pct = compradas > 0 ? (usadas / compradas) * 100 : 0
                          return (
                            <div key={p.id} className="bg-gray-50 dark:bg-[#1a1d27] rounded-xl p-3 border border-gray-100 dark:border-[#2d3148]">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-inter font-bold text-sm text-onSurface dark:text-[#e4e6f0]">
                                  {p.tipo_botellon || 'Botellón'}
                                </span>
                                <span className={`text-xs font-grotesk font-bold ${restantes > 0 ? 'text-green-600 dark:text-green-500' : 'text-gray-400'}`}>
                                  {restantes} / {compradas} restantes
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, background: restantes > 0 ? '#16a34a' : '#9ca3af' }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Últimas compras */}
                  <div>
                    <p className="text-xs font-manrope font-bold text-gray-400 tracking-wider mb-2">ÚLTIMAS COMPRAS</p>
                    {ventasCliente.length === 0 ? (
                      <p className="text-sm text-gray-400 font-inter py-4 text-center">Sin compras registradas</p>
                    ) : (
                      <div className="space-y-2">
                        {ventasCliente.map((v: any) => (
                          <div key={v.id} className="flex items-center justify-between bg-gray-50 dark:bg-[#1a1d27] rounded-xl px-4 py-3 border border-gray-100 dark:border-[#2d3148]">
                            <div>
                              <span className="font-inter text-sm text-gray-600 dark:text-gray-400 block">{(v.fecha || '').slice(0, 10)}</span>
                              <span className="font-grotesk text-xs text-gray-400 dark:text-gray-500">{v.metodo_pago}</span>
                            </div>
                            <span className="font-grotesk font-bold text-primary dark:text-[#5bb3e8]">${(parseFloat(v.total_usd) || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* CUENTAS POR COBRAR TAB */}
                  {pagoDeudaId && (
                    <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-manrope font-bold text-sm text-blue-900 dark:text-blue-300">Registrar Pago o Abono</span>
                        <button onClick={() => { setPagoDeudaId(null); setPagoMonto('') }} className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400"><X size={16} /></button>
                      </div>
                          {(() => {
                            const dSel = store.deudas.find((x: any) => x.id === pagoDeudaId)
                            const pend = pendienteDeuda(dSel)
                            return (
                              <>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-inter text-xs text-blue-800 dark:text-blue-400">Pendiente de esta factura</span>
                                  <span className="font-grotesk font-bold text-sm text-blue-900 dark:text-blue-300">${pend.toFixed(2)}</span>
                                </div>
                                <label className="block font-inter text-xs text-blue-800 dark:text-blue-400 mb-1">
                                  Monto a abonar (vacío = pagar todo)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder={pend.toFixed(2)}
                                  value={pagoMonto}
                                  onChange={e => setPagoMonto(e.target.value)}
                                  className="w-full border-2 border-blue-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-lg p-2 text-sm outline-none focus:border-blue-500 text-gray-800 dark:text-[#e4e6f0] mb-1 font-grotesk font-bold"
                                />
                                {(parseFloat(pagoMonto) || 0) > 0 && (parseFloat(pagoMonto) || 0) < pend && (
                                  <p className="font-inter text-[11px] text-amber-700 dark:text-amber-500 mb-2">
                                    Abono parcial · restarán ${(pend - (parseFloat(pagoMonto) || 0)).toFixed(2)}
                                  </p>
                                )}
                                {(parseFloat(pagoMonto) || 0) > pend && (
                                  <p className="font-inter text-[11px] text-red-600 dark:text-red-400 mb-2">
                                    El monto excede lo pendiente
                                  </p>
                                )}
                              </>
                            )
                          })()}
                          <select value={pagoMetodo} onChange={e => setPagoMetodo(e.target.value)}
                            className="w-full border-2 border-blue-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-lg p-2 text-sm outline-none focus:border-blue-500 text-gray-800 dark:text-[#e4e6f0] mb-2">
                            <option value="EFECTIVO USD">Efectivo USD</option>
                            <option value="PAGO MÓVIL">Pago Móvil</option>
                            <option value="PUNTO DE VENTA">Punto de Venta</option>
                            <option value="EFECTIVO VES">Efectivo VES</option>
                            <option value="SALDO A FAVOR">Saldo a Favor del Cliente</option>
                          </select>
                          <button onClick={procesarPagoDeuda} className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors">
                            {pagoMonto.trim() === '' ? 'Confirmar Cobro Total' : `Registrar Abono de $${(parseFloat(pagoMonto) || 0).toFixed(2)}`}
                          </button>
                        </div>
                      )}
                      
                      {/* Entregar a crédito: sustituye el metodo de escribir
                          una cifra a mano, que no creaba venta ni descontaba
                          inventario. */}
                      <div className="flex gap-2 mb-4">
                        <button
                          onClick={() => { setEntregaCantidades({}); setShowEntrega(true) }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                            font-manrope font-bold text-sm text-white shadow-sm transition-opacity hover:opacity-90"
                          style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
                        >
                          <PackagePlus size={16} /> Entregar a crédito
                        </button>
                        <button
                          onClick={() => setShowEstadoCuenta(true)}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                            font-manrope font-bold text-sm text-primary dark:text-[#5bb3e8]
                            bg-blue-50 dark:bg-[#1a1d27] hover:bg-blue-100 dark:hover:bg-[#232735] transition-colors"
                        >
                          <FileText size={16} /> Desglose
                        </button>
                      </div>

                      <div className="space-y-3">
                        {store.getDeudasCliente(clienteDetalle.id).length === 0 ? (
                          <p className="text-sm text-gray-400 font-inter py-4 text-center">No hay cuentas por cobrar registradas</p>
                        ) : (
                          store.getDeudasCliente(clienteDetalle.id).map(d => {
                            const isVencida = d.fechaVencimiento < new Date().toISOString() && d.estado === 'pendiente'
                            return (
                              <div key={d.id} className="flex flex-col bg-gray-50 dark:bg-[#1a1d27] rounded-xl px-4 py-3 border border-gray-100 dark:border-[#2d3148]">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-inter font-bold text-sm text-onSurface dark:text-[#e4e6f0]">
                                        {(() => {
                                          const v: any = ventas.find((x: any) => x.id === d.ventaId)
                                          return v?.numero_orden ? `Orden ${v.numero_orden}` : `Factura: ${d.ventaId.split('-')[0]}`
                                        })()}
                                      </span>
                                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${d.estado === 'pagada' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : isVencida ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                        {d.estado.toUpperCase()}
                                      </span>
                                    </div>
                                    <span className="font-inter text-xs text-gray-500 dark:text-gray-400 block">Diferido: {new Date(d.fechaVencimiento).toLocaleDateString()}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-grotesk font-bold text-lg text-primary dark:text-[#5bb3e8] block">${pendienteDeuda(d).toFixed(2)}</span>
                                    {(Number((d as any).montoPagadoUsd) || 0) > 0 && d.estado === 'pendiente' && (
                                      <span className="font-inter text-[10px] text-gray-400 dark:text-gray-500 block">
                                        de ${d.montoUsd.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {/* Progreso del abono */}
                                {(Number((d as any).montoPagadoUsd) || 0) > 0 && d.estado === 'pendiente' && (
                                  <div className="mt-2">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="font-inter text-[10px] text-green-700 dark:text-green-400">
                                        Abonado: ${(Number((d as any).montoPagadoUsd) || 0).toFixed(2)}
                                      </span>
                                      <span className="font-grotesk text-[10px] text-gray-400 dark:text-gray-500">
                                        {Math.round(((Number((d as any).montoPagadoUsd) || 0) / (d.montoUsd || 1)) * 100)}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-[#2d3148] rounded-full h-1.5 overflow-hidden">
                                      <div
                                        className="bg-green-600 h-full rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min(100, ((Number((d as any).montoPagadoUsd) || 0) / (d.montoUsd || 1)) * 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                                {d.estado === 'pendiente' && !pagoDeudaId && (
                                  <button onClick={() => { setPagoDeudaId(d.id); setPagoMonto('') }} className="mt-2 w-full py-1.5 text-xs font-bold font-manrope text-white bg-green-600 rounded-lg focus:outline-none hover:bg-green-700 transition">
                                    {(Number((d as any).montoPagadoUsd) || 0) > 0 ? 'Registrar Otro Abono' : 'Registrar Pago o Abono'}
                                  </button>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </>
                  )}

                  <button
                    onClick={() => setShowDetalleModal(false)}
                    className="w-full mt-5 py-3 rounded-xl font-manrope font-bold text-gray-500 dark:text-gray-400 border-2 border-gray-200 dark:border-[#2d3148]
                      hover:bg-gray-50 dark:hover:bg-[#2d3148] transition-colors"
                  >
                    Cerrar
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })()}


      {/* ═══ ENTREGAR A CRÉDITO ═══════════════════════════════════════ */}
      {showEntrega && clienteDetalle && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowEntrega(false)} />
          <div className="relative bg-white dark:bg-[#1e2235] rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-[#2d3148]">
              <div>
                <h3 className="font-manrope font-bold text-lg text-onSurface dark:text-[#e4e6f0]">Entregar a crédito</h3>
                <p className="font-inter text-xs text-gray-500 dark:text-gray-400 mt-0.5">{clienteDetalle.nombre}</p>
              </div>
              <button onClick={() => setShowEntrega(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-1">
              {productosEntrega.map(prod => {
                const cant = entregaCantidades[prod.id] || 0
                return (
                  <div key={prod.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    cant > 0 ? 'bg-blue-50 dark:bg-[#1a1d27]' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-inter text-sm text-onSurface dark:text-[#e4e6f0] truncate">{prod.nombre}</div>
                      {cant > 0 ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="font-inter text-xs text-gray-400">$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={entregaPrecios[prod.id] ?? ''}
                            placeholder={prod.precio.toFixed(2)}
                            onChange={e => setEntregaPrecios(prev => ({ ...prev, [prod.id]: e.target.value }))}
                            className="w-16 px-1.5 py-0.5 rounded border border-gray-200 dark:border-[#2d3148]
                              bg-white dark:bg-[#1e2235] font-grotesk text-xs text-onSurface dark:text-[#e4e6f0]"
                          />
                          <span className="font-inter text-xs text-gray-400">c/u</span>
                        </div>
                      ) : (
                        <div className="font-inter text-xs text-gray-500 dark:text-gray-400">${prod.precio.toFixed(2)} c/u</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => cambiarCantidad(prod.id, -1)} disabled={cant === 0}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-[#2d3148]
                          text-gray-600 dark:text-gray-300 disabled:opacity-30">
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-grotesk font-bold text-sm text-onSurface dark:text-[#e4e6f0]">{cant}</span>
                      <button onClick={() => cambiarCantidad(prod.id, 1)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary text-white">
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="w-16 text-right font-grotesk font-bold text-sm text-onSurface dark:text-[#e4e6f0]">
                      {cant > 0 ? `$${(precioDe(prod) * cant).toFixed(2)}` : ''}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-5 border-t border-gray-100 dark:border-[#2d3148] space-y-4">
              <div>
                <label className="block font-inter text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Fecha de la entrega
                </label>
                <input
                  type="date"
                  value={entregaFecha}
                  max={getLocalDateString()}
                  onChange={e => setEntregaFecha(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#1a1d27]
                    border border-gray-200 dark:border-[#2d3148]
                    font-inter text-sm text-onSurface dark:text-[#e4e6f0]"
                />
                {entregaFecha !== getLocalDateString() && (
                  <p className="font-inter text-[11px] text-amber-600 dark:text-amber-500 mt-1">
                    Registrando una entrega de una fecha anterior.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-inter text-xs text-gray-500 dark:text-gray-400 mb-2">Plazo de pago</label>
                <div className="flex gap-2">
                  {([7, 15, 30] as const).map(c => (
                    <button key={c} onClick={() => setEntregaCiclo(c)}
                      className={`flex-1 py-2 rounded-lg font-manrope font-bold text-sm transition-colors ${
                        entregaCiclo === c
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 dark:bg-[#2d3148] text-gray-600 dark:text-gray-300'}`}>
                      {c} días
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-inter text-sm text-gray-500 dark:text-gray-400">Total a crédito</span>
                <span className="font-grotesk font-bold text-2xl text-onSurface dark:text-[#e4e6f0]">
                  ${totalEntrega.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block font-inter text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Empresa o sucursal que recibe (opcional)
                </label>
                <input
                  type="text"
                  value={entregaNota}
                  onChange={e => setEntregaNota(e.target.value)}
                  placeholder="Ej: JACIDI, Navicu…"
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-[#1a1d27]
                    border border-gray-200 dark:border-[#2d3148]
                    font-inter text-sm text-onSurface dark:text-[#e4e6f0]"
                />
              </div>

              <p className="font-inter text-[11px] text-gray-400 dark:text-gray-500">
                Se descuenta del inventario al confirmar, igual que una venta normal.
                El precio en blanco usa el de lista.
              </p>

              <button onClick={confirmarEntrega} disabled={guardandoEntrega || totalEntrega === 0}
                className="w-full py-3 rounded-xl font-manrope font-bold text-white shadow-md
                  disabled:opacity-40 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}>
                {guardandoEntrega ? 'Registrando…' : 'Confirmar entrega'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ESTADO DE CUENTA ═════════════════════════════════════════ */}
      {showEstadoCuenta && clienteDetalle && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm print:hidden" onClick={() => setShowEstadoCuenta(false)} />
          <div className="relative bg-white dark:bg-[#1e2235] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col print:max-h-none print:shadow-none">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-[#2d3148] print:hidden">
              <h3 className="font-manrope font-bold text-lg text-onSurface dark:text-[#e4e6f0]">Estado de cuenta</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} title="Imprimir"
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-[#2d3148]"><Printer size={18} /></button>
                <button onClick={enviarPorWhatsApp} title="Enviar por WhatsApp"
                  className="p-2 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-[#2d3148]"><MessageCircle size={18} /></button>
                <button onClick={enviarPorCorreo} title="Enviar por correo"
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-[#2d3148]"><Mail size={18} /></button>
                <button onClick={() => setShowEstadoCuenta(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
            </div>

            <div className="overflow-y-auto p-6 print:overflow-visible" id="estado-cuenta-imprimible">
              <div className="mb-5">
                <div className="font-manrope font-bold text-lg text-primary dark:text-[#5bb3e8]">
                  Agua Potable La Campiña C.A.
                </div>
                <div className="font-inter text-sm text-onSurface dark:text-[#e4e6f0] mt-2">
                  Cliente: <strong>{clienteDetalle.nombre}</strong>
                </div>
                <div className="font-inter text-xs text-gray-500 dark:text-gray-400">
                  Emitido el {new Date().toLocaleDateString('es-VE')}
                </div>
              </div>

              {detalleCuenta.length === 0 ? (
                <p className="font-inter text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  Este cliente no tiene cuentas pendientes.
                </p>
              ) : (
                <>
                  {gruposCuenta.map(g => (
                  <div key={g.empresa || 'unico'}>
                  {g.empresa && (
                    <div className="flex items-center justify-between mb-2 mt-4 pb-1 border-b-2 border-primary/30">
                      <span className="font-manrope font-bold text-sm text-primary dark:text-[#5bb3e8] uppercase">
                        {g.empresa}
                      </span>
                      <span className="font-grotesk font-bold text-sm text-primary dark:text-[#5bb3e8]">
                        ${g.total.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {g.deudas.map(d => (
                    <div key={d.id} className="mb-4 pb-4 border-b border-gray-100 dark:border-[#2d3148]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-inter font-bold text-sm text-onSurface dark:text-[#e4e6f0]">
                          {fmtFechaCuenta(d.fecha)} · Orden {d.orden}
                        </span>
                        <span className="font-inter text-xs text-gray-400 dark:text-gray-500">
                          Vence {fmtFechaCuenta(d.fechaVencimiento)}
                        </span>
                      </div>

                      {d.items.length === 0 ? (
                        <div className="font-inter text-xs text-gray-400 dark:text-gray-500 italic pl-3">
                          Sin desglose de productos (registrada antes de esta mejora)
                        </div>
                      ) : (
                        <table className="w-full">
                          <tbody>
                            {d.items.map((it: any, i: number) => (
                              <tr key={i}>
                                <td className="font-inter text-xs text-gray-600 dark:text-gray-300 py-0.5 pl-3">
                                  {it.cantidad} × {it.producto?.nombre || '—'}
                                </td>
                                <td className="font-grotesk text-xs text-right text-gray-600 dark:text-gray-300">
                                  ${((it.producto?.precio || 0) * it.cantidad).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                            {d.delivery > 0 && (
                              <tr>
                                <td className="font-inter text-xs text-gray-600 dark:text-gray-300 py-0.5 pl-3">Delivery</td>
                                <td className="font-grotesk text-xs text-right text-gray-600 dark:text-gray-300">${d.delivery.toFixed(2)}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      )}

                      <div className="flex items-center justify-between mt-2 pl-3">
                        {d.pagado > 0 && (
                          <span className="font-inter text-xs text-green-600 dark:text-green-400">
                            Abonado: −${d.pagado.toFixed(2)}
                          </span>
                        )}
                        <span className="font-grotesk font-bold text-sm text-onSurface dark:text-[#e4e6f0] ml-auto">
                          ${d.pendiente.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                  </div>
                  ))}

                  <div className="flex items-center justify-between pt-2 mt-2 border-t-2 border-gray-200 dark:border-[#2d3148]">
                    <span className="font-manrope font-bold text-base text-onSurface dark:text-[#e4e6f0]">
                      TOTAL PENDIENTE
                    </span>
                    <span className="font-grotesk font-bold text-2xl text-primary dark:text-[#5bb3e8]">
                      ${totalPendiente.toFixed(2)}
                    </span>
                  </div>
                  {conciliacionCuenta && (Math.abs(conciliacionCuenta.diferencia) >= 0.01 || conciliacionCuenta.ventasSinFicha.length > 0) && (
                    <div className="no-print mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 font-inter text-xs text-amber-800 dark:text-amber-300">
                      <b>Revisar antes de cobrar.</b> La ficha del cliente registra una deuda de ${conciliacionCuenta.ficha.toFixed(2)},
                      pero solo ${totalPendiente.toFixed(2)} está respaldado por órdenes pendientes.
                      {Math.abs(conciliacionCuenta.diferencia) >= 0.01 && <> Diferencia sin desglose: <b>${conciliacionCuenta.diferencia.toFixed(2)}</b>.</>}
                      {conciliacionCuenta.ventasSinFicha.length > 0 && (
                        <div className="mt-2">
                          Ventas a crédito sin ficha de deuda:
                          {conciliacionCuenta.ventasSinFicha.map((v: any) => (
                            <div key={v.id} className="pl-2">· {fmtFechaCuenta(v.fecha)} · Orden {v.numero_orden} · ${(parseFloat(v.total_usd) || 0).toFixed(2)}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  )
}