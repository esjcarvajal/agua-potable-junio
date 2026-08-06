import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import { AlertTriangle, X, CheckCircle, Clock, DollarSign, ChevronDown } from 'lucide-react'

/* ════════════════════════════════════════════════════════════════════
   TOAST (inline)
   ════════════════════════════════════════════════════════════════════ */
interface ToastState { mensaje: string; tipo: 'success' | 'error'; visible: boolean }
function Toast({ toast }: { toast: ToastState }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 99999,
      background: toast.tipo === 'success' ? '#16a34a' : '#dc2626', color: 'white',
      padding: '14px 22px', borderRadius: 12,
      fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600,
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      opacity: toast.visible ? 1 : 0, transition: 'opacity 0.3s ease',
      pointerEvents: toast.visible ? 'auto' : 'none', maxWidth: 400,
    }}>
      {toast.mensaje}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   ALERTA DEUDAS — Botón + Dropdown rápido + Modal de Gestión
   ════════════════════════════════════════════════════════════════════ */
export default function AlertaDeudas() {
  const store = useAppStore()
  const [isOpen, setIsOpen] = useState(false)         // dropdown rápido
  const [showPanel, setShowPanel] = useState(false)    // modal completo de gestión
  const [pagoEnProceso, setPagoEnProceso] = useState<string | null>(null)
  const [pagoMetodo, setPagoMetodo] = useState('EFECTIVO USD')
  const [confirmando, setConfirmando] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Toast
  const [toast, setToast] = useState<ToastState>({ mensaje: '', tipo: 'success', visible: false })
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((mensaje: string, tipo: 'success' | 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ mensaje, tipo, visible: true })
    toastTimer.current = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000)
  }, [])
  useEffect(() => { return () => { if (toastTimer.current) clearTimeout(toastTimer.current) } }, [])

  const deudasVencidas = store.getDeudasVencidas()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  if (deudasVencidas.length === 0 && !showPanel) return null

  // Calcular días de atraso
  const getDiasAtraso = (fechaVencimiento: string) => {
    const ms = Date.now() - new Date(fechaVencimiento).getTime()
    return Math.max(0, Math.floor(ms / 86400000))
  }

  const deudasPendientesTotalUsd = deudasVencidas.reduce((s, d) => s + d.montoUsd, 0)

  // Agrupar deudas vencidas por cliente
  const deudasPorCliente = deudasVencidas.reduce((acc, d) => {
    if (!acc[d.clienteId]) {
      acc[d.clienteId] = {
        clienteId: d.clienteId,
        clienteNombre: d.clienteNombre,
        deudas: [],
        totalUsd: 0,
        maxDiasAtraso: 0,
      }
    }
    const dias = getDiasAtraso(d.fechaVencimiento)
    acc[d.clienteId].deudas.push(d)
    acc[d.clienteId].totalUsd += d.montoUsd
    acc[d.clienteId].maxDiasAtraso = Math.max(acc[d.clienteId].maxDiasAtraso, dias)
    return acc
  }, {} as Record<string, { clienteId: string; clienteNombre: string; deudas: typeof deudasVencidas; totalUsd: number; maxDiasAtraso: number }>)

  // Ordenar por mayor atraso primero
  const clientesConDeuda = Object.values(deudasPorCliente).sort((a, b) => b.maxDiasAtraso - a.maxDiasAtraso)

  const procesarPago = async (deudaId: string) => {
    setConfirmando(true)
    try {
      await store.marcarDeudaPagada(deudaId, pagoMetodo)
      showToast('✓ Pago registrado correctamente', 'success')
      setPagoEnProceso(null)
      setPagoMetodo('EFECTIVO USD')
    } catch {
      showToast('Error al procesar el pago', 'error')
    } finally {
      setConfirmando(false)
    }
  }

  const getUrgenciaColor = (dias: number) => {
    if (dias >= 30) return { bg: 'bg-red-600', text: 'text-white', label: 'CRÍTICO' }
    if (dias >= 15) return { bg: 'bg-red-500', text: 'text-white', label: 'URGENTE' }
    if (dias >= 7)  return { bg: 'bg-orange-500', text: 'text-white', label: 'ATENCIÓN' }
    return { bg: 'bg-amber-500', text: 'text-white', label: 'PENDIENTE' }
  }

  return (
    <>
      {/* ──── BOTÓN DE ALERTA EN HEADER ──── */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors mx-1"
          title="Alertas de Deudas Vencidas"
        >
          <AlertTriangle size={20} />
          {deudasVencidas.length > 0 && (
            <span className="absolute top-0 right-0 w-4 h-4 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-[#1e2235]">
              {deudasVencidas.length}
            </span>
          )}
        </button>

        {/* ──── DROPDOWN RÁPIDO (resumen) ──── */}
        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-[#1e2235] rounded-xl shadow-2xl border border-red-100 dark:border-red-900/30 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="bg-red-50 dark:bg-red-900/20 px-4 py-3 border-b border-red-100 dark:border-red-900/30 flex items-center justify-between">
              <div>
                <p className="text-sm font-manrope font-bold text-red-800 dark:text-red-400">
                  Deudas Vencidas
                </p>
                <p className="text-xs text-red-600 dark:text-red-500 font-inter font-medium">
                  Total: ${deudasPendientesTotalUsd.toFixed(2)}
                </p>
              </div>
              <span className="text-xs font-bold text-red-700 bg-red-100 dark:bg-red-900/50 dark:text-red-300 px-2 py-0.5 rounded-full">
                {deudasVencidas.length} avisos
              </span>
            </div>

            <div className="max-h-[280px] overflow-y-auto">
              {clientesConDeuda.slice(0, 5).map(grupo => (
                <div key={grupo.clienteId} className="p-4 border-b border-gray-50 dark:border-[#2d3148]">
                  <div className="flex items-start justify-between">
                    <div className="truncate pr-2">
                      <p className="font-manrope font-bold text-sm text-gray-800 dark:text-[#e4e6f0] truncate">
                        {grupo.clienteNombre}
                      </p>
                      <p className="text-xs font-inter text-red-600 dark:text-red-400 mt-0.5 font-medium">
                        {grupo.maxDiasAtraso} días de atraso · {grupo.deudas.length} factura{grupo.deudas.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <p className="font-grotesk font-bold text-sm text-red-600 dark:text-red-400">
                      ${grupo.totalUsd.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Botón para abrir panel completo */}
            <button
              onClick={() => {
                setIsOpen(false)
                setShowPanel(true)
              }}
              className="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-manrope font-bold transition-colors flex items-center justify-center gap-2"
            >
              <DollarSign size={16} />
              Gestionar Cobros ({deudasVencidas.length})
            </button>
          </div>
        )}
      </div>

      {/* ──── MODAL PANEL COMPLETO DE GESTIÓN DE DEUDAS ──── */}
      {showPanel && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPanel(false)} />
          <div className="bg-white dark:bg-[#1e2235] rounded-2xl shadow-2xl relative z-10 mx-4 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

            {/* Header del modal */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-manrope text-xl font-bold text-white flex items-center gap-2">
                  <AlertTriangle size={22} />
                  Gestión de Cobranzas
                </h2>
                <p className="text-red-200 text-sm font-inter mt-1">
                  {clientesConDeuda.length} cliente{clientesConDeuda.length !== 1 ? 's' : ''} con deudas vencidas · Total: <span className="font-bold text-white">${deudasPendientesTotalUsd.toFixed(2)}</span>
                </p>
              </div>
              <button
                onClick={() => setShowPanel(false)}
                className="text-white/70 hover:text-white transition-colors p-1"
              >
                <X size={24} />
              </button>
            </div>

            {/* Lista de clientes con deudas */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {clientesConDeuda.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <CheckCircle size={48} className="mb-4 text-green-400" />
                  <p className="font-manrope font-bold text-lg text-green-600 dark:text-green-400">¡Sin deudas vencidas!</p>
                  <p className="font-inter text-sm text-gray-400 mt-1">Todos los clientes están al día</p>
                </div>
              ) : (
                clientesConDeuda.map(grupo => {
                  const urgencia = getUrgenciaColor(grupo.maxDiasAtraso)
                  return (
                    <div
                      key={grupo.clienteId}
                      className="bg-gray-50 dark:bg-[#1a1d27] rounded-xl border border-gray-100 dark:border-[#2d3148] overflow-hidden transition-all hover:shadow-md"
                    >
                      {/* Encabezado del cliente */}
                      <div className="px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-manrope font-bold text-sm flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #dc2626, #ef4444)' }}>
                            {(grupo.clienteNombre || '?')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-manrope font-bold text-sm text-gray-800 dark:text-[#e4e6f0] truncate">
                              {grupo.clienteNombre}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${urgencia.bg} ${urgencia.text}`}>
                                {urgencia.label}
                              </span>
                              <span className="text-xs font-inter text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Clock size={11} />
                                {grupo.maxDiasAtraso} días de atraso
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="font-grotesk font-bold text-lg text-red-600 dark:text-red-400">
                            ${grupo.totalUsd.toFixed(2)}
                          </p>
                          <p className="text-[10px] text-gray-400 font-inter">
                            {grupo.deudas.length} factura{grupo.deudas.length > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {/* Listado de facturas individuales de este cliente */}
                      <div className="border-t border-gray-100 dark:border-[#2d3148]">
                        {grupo.deudas.map(d => {
                          const diasAtraso = getDiasAtraso(d.fechaVencimiento)
                          const isPagoActivo = pagoEnProceso === d.id
                          return (
                            <div
                              key={d.id}
                              className="px-5 py-3 border-b border-gray-50 dark:border-[#2d3148]/50 last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-inter text-xs text-gray-600 dark:text-gray-300 font-medium">
                                      Factura: {d.ventaId.split('-')[0]}
                                    </span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                      {diasAtraso}d
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-gray-400 font-inter">
                                    Vencía: {new Date(d.fechaVencimiento).toLocaleDateString('es-VE')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="font-grotesk font-bold text-sm text-gray-700 dark:text-[#e4e6f0]">
                                    ${d.montoUsd.toFixed(2)}
                                  </span>
                                  {!isPagoActivo ? (
                                    <button
                                      onClick={() => {
                                        setPagoEnProceso(d.id)
                                        setPagoMetodo('EFECTIVO USD')
                                      }}
                                      className="px-3 py-1.5 rounded-lg text-xs font-bold font-manrope text-white bg-green-600 hover:bg-green-700 transition-colors flex items-center gap-1"
                                    >
                                      <CheckCircle size={13} />
                                      Cobrar
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setPagoEnProceso(null)}
                                      className="px-2 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                                    >
                                      <X size={14} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Panel inline de confirmación de pago */}
                              {isPagoActivo && (
                                <div className="mt-3 bg-green-50 dark:bg-green-900/15 border border-green-200 dark:border-green-800/40 rounded-xl p-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                  <p className="text-xs font-manrope font-bold text-green-800 dark:text-green-300 mb-2">
                                    Confirmar cobro de ${d.montoUsd.toFixed(2)}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                      <select
                                        value={pagoMetodo}
                                        onChange={e => setPagoMetodo(e.target.value)}
                                        className="w-full appearance-none border-2 border-green-200 dark:border-green-800/50 bg-white dark:bg-[#1a1d27] rounded-lg px-3 py-2 text-sm font-inter outline-none focus:border-green-500 text-gray-800 dark:text-[#e4e6f0] pr-8"
                                      >
                                        <option value="EFECTIVO USD">Efectivo USD</option>
                                        <option value="PAGO MÓVIL">Pago Móvil</option>
                                        <option value="PUNTO DE VENTA">Punto de Venta</option>
                                        <option value="EFECTIVO VES">Efectivo VES</option>
                                        <option value="TRANSFERENCIA">Transferencia</option>
                                        <option value="ZELLE">Zelle</option>
                                      </select>
                                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                    </div>
                                    <button
                                      onClick={() => procesarPago(d.id)}
                                      disabled={confirmando}
                                      className="px-4 py-2 rounded-lg text-sm font-bold font-manrope text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                                    >
                                      {confirmando ? 'Procesando...' : '✓ Confirmar'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer del modal */}
            <div className="border-t border-gray-100 dark:border-[#2d3148] px-6 py-4 flex items-center justify-between bg-gray-50 dark:bg-[#1a1d27] flex-shrink-0">
              <p className="text-xs text-gray-400 font-inter">
                Los pagos registrados se reflejan automáticamente en ventas
              </p>
              <button
                onClick={() => setShowPanel(false)}
                className="px-5 py-2.5 rounded-xl font-manrope font-bold text-sm text-gray-500 dark:text-gray-400 border-2 border-gray-200 dark:border-[#2d3148] hover:bg-gray-100 dark:hover:bg-[#2d3148] transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </>
  )
}
