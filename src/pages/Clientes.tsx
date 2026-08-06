import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useLocation } from 'react-router-dom'
import { Search, Plus, X, Phone, MapPin, User, Edit2, ChevronRight } from 'lucide-react'
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

  const procesarPagoDeuda = async () => {
    if (!pagoDeudaId) return
    await store.marcarDeudaPagada(pagoDeudaId, pagoMetodo)
    showToast('Pago registrado correctamente', 'success')
    setPagoDeudaId(null)
    setPagoMetodo('EFECTIVO USD')
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
                        <span className="font-manrope font-bold text-sm text-blue-900 dark:text-blue-300">Registrar Pago</span>
                        <button onClick={() => setPagoDeudaId(null)} className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400"><X size={16} /></button>
                      </div>
                          <select value={pagoMetodo} onChange={e => setPagoMetodo(e.target.value)}
                            className="w-full border-2 border-blue-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-lg p-2 text-sm outline-none focus:border-blue-500 text-gray-800 dark:text-[#e4e6f0] mb-2">
                            <option value="EFECTIVO USD">Efectivo USD</option>
                            <option value="PAGO MÓVIL">Pago Móvil</option>
                            <option value="PUNTO DE VENTA">Punto de Venta</option>
                            <option value="EFECTIVO VES">Efectivo VES</option>
                          </select>
                          <button onClick={procesarPagoDeuda} className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors">
                            Confirmar Cobro
                          </button>
                        </div>
                      )}
                      
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
                                      <span className="font-inter font-bold text-sm text-onSurface dark:text-[#e4e6f0]">Factura: {d.ventaId.split('-')[0]}</span>
                                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${d.estado === 'pagada' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : isVencida ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                        {d.estado.toUpperCase()}
                                      </span>
                                    </div>
                                    <span className="font-inter text-xs text-gray-500 dark:text-gray-400 block">Diferido: {new Date(d.fechaVencimiento).toLocaleDateString()}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-grotesk font-bold text-lg text-primary dark:text-[#5bb3e8] block">${d.montoUsd.toFixed(2)}</span>
                                  </div>
                                </div>
                                {d.estado === 'pendiente' && !pagoDeudaId && (
                                  <button onClick={() => setPagoDeudaId(d.id)} className="mt-2 w-full py-1.5 text-xs font-bold font-manrope text-white bg-green-600 rounded-lg focus:outline-none hover:bg-green-700 transition">
                                    Registrar Pago
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

      <Toast toast={toast} />
    </div>
  )
}