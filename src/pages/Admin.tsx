import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'

import {
  Settings, Database, Download, Upload, AlertTriangle, RefreshCw, FileText,
  Save, TrendingUp, Loader2, Home, Truck, Plus, Trash2
} from 'lucide-react'
import GestionUsuarios from '../components/GestionUsuarios'
import { getConfig, saveConfig, type Proveedor } from '../lib/useConfig'
import { saveProductos, getProductos, type ProductoConfig } from '../lib/useProductos'
import { getLocalDateString } from '../lib/dateUtils'

/* ════════════════════════════════════════════════════════════════════
   TOAST
   ════════════════════════════════════════════════════════════════════ */
interface ToastState { mensaje: string; tipo: 'success' | 'error' | 'warning'; visible: boolean }
const TOAST_COLORS = { success: '#16a34a', error: '#dc2626', warning: '#d97706' }

function Toast({ toast }: { toast: ToastState }) {
  return (
    <div style={{
      position: 'absolute', bottom: 24, right: 24, zIndex: 100,
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






const CONFIG_KEY = 'agua-potable-config'
const PRODUCTOS_KEY = 'agua-potable-productos'
const LAST_BACKUP_KEY = 'agua-potable-last-backup'

/* ════════════════════════════════════════════════════════════════════
   ADMIN PANEL COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function Admin() {
  const store = useAppStore()
  const { tasaBcv, usdToVes, ventas } = store

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

  // ── Products ───────────────────────────────────────────────────
  const [productos, setProductos] = useState<ProductoConfig[]>(() => getProductos())

  const [isSavingPrecios, setIsSavingPrecios] = useState(false)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [isSavingTasa, setIsSavingTasa] = useState(false)

  const updateProducto = (id: string, field: 'precioUsd' | 'costoUsd', value: number) => {
    setProductos(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  const guardarPrecios = async () => {
    setIsSavingPrecios(true)
    await new Promise(resolve => setTimeout(resolve, 800))
    saveProductos(productos)
    setIsSavingPrecios(false)
    showToast('¡Éxito! Precios actualizados en todos los dispositivos', 'success')
  }

  // ── Config ─────────────────────────────────────────────────────
  const [config, setConfig] = useState(() => {
    const c = getConfig()
    return {
      nombreEstacion: c.nombreEstacion,
      operario: c.operario,
      capacidadJumbo: c.capacidadJumbo,
      metaDiaria: c.metaDiaria,
    }
  })

  // Egresos fijos
  const [alquiler, setAlquiler] = useState(() => getConfig().alquilerMensualUsd)
  const [proveedores, setProveedores] = useState<Proveedor[]>(() => getConfig().proveedores)

  const guardarConfig = async () => {
    setIsSavingConfig(true)
    await new Promise(resolve => setTimeout(resolve, 600))
    const current = getConfig()
    saveConfig({
      ...current,
      nombreEstacion: config.nombreEstacion,
      operario: config.operario,
      capacidadJumbo: config.capacidadJumbo,
      metaDiaria: config.metaDiaria,
      alquilerMensualUsd: alquiler,
      proveedores,
    })
    setIsSavingConfig(false)
    showToast('Configuración guardada correctamente', 'success')
  }

  const agregarProveedor = () => {
    setProveedores(prev => [
      ...prev,
      { id: crypto.randomUUID(), nombre: 'Nuevo Proveedor', montoPorPago: 0, frecuencia: 'mensual' }
    ])
  }

  const actualizarProveedor = (id: string, campo: keyof Proveedor, valor: string | number) => {
    setProveedores(prev => prev.map(p => p.id === id ? { ...p, [campo]: valor } : p))
  }

  const eliminarProveedor = (id: string) => {
    setProveedores(prev => prev.filter(p => p.id !== id))
  }



  // ── BCV ────────────────────────────────────────────────────────
  const [tasaManualInput, setTasaManualInput] = useState('')

  const setTasaManual = async () => {
    const valor = parseFloat(tasaManualInput)
    if (!valor || valor <= 0) {
      showToast('Ingresa un valor válido para la tasa', 'error')
      return
    }
    setIsSavingTasa(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    store.setTasaManual(valor)
    setIsSavingTasa(false)
    setTasaManualInput('')
    showToast(`Tasa actualizada a $1 = ${valor.toFixed(2)} VES`, 'success')
  }

  const fetchTasa = async () => {
    await store.fetchTasaBcv(true)
    showToast('Tasa BCV actualizada desde la API', 'success')
  }

  // ── Backup ─────────────────────────────────────────────────────
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [importData, setImportData] = useState<string | null>(null)
  const [fechaExportInicio, setFechaExportInicio] = useState(() => getLocalDateString())
  const [fechaExportFin, setFechaExportFin] = useState(() => getLocalDateString())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const lastBackup = localStorage.getItem(LAST_BACKUP_KEY)
  const diasSinBackup = lastBackup
    ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24))
    : null

  const exportarBackup = () => {
    const storeData = localStorage.getItem('agua-potable-store')
    if (!storeData) {
      showToast('No hay datos para exportar', 'warning')
      return
    }

    const backup = {
      version: '1.0',
      fecha: new Date().toISOString(),
      app: 'Agua Potable La Campiña',
      data: JSON.parse(storeData),
      config: config,
      productos: productos,
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `agua-potable-backup-${getLocalDateString()}.json`
    link.click()
    URL.revokeObjectURL(url)

    localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString())
    showToast('Backup descargado correctamente', 'success')
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      try {
        JSON.parse(content) // validate
        setImportData(content)
        setShowImportConfirm(true)
      } catch {
        showToast('El archivo no es un backup válido', 'error')
      }
    }
    reader.readAsText(file)
    e.target.value = '' // reset input
  }

  const confirmarImport = () => {
    if (!importData) return
    try {
      const backup = JSON.parse(importData)
      if (backup.data) {
        localStorage.setItem('agua-potable-store', JSON.stringify({ state: backup.data, version: 0 }))
      }
      if (backup.config) {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(backup.config))
      }
      if (backup.productos) {
        localStorage.setItem(PRODUCTOS_KEY, JSON.stringify(backup.productos))
      }
      setShowImportConfirm(false)
      setImportData(null)
      showToast('Backup importado — recargando la aplicación...', 'success')
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      showToast('Error al importar el backup', 'error')
    }
  }

  const confirmarReset = async () => {
    setShowResetConfirm(false)
    showToast('Reiniciando sistema... borrando datos en Firebase', 'warning')
    await store.resetLocalDataExceptClientes()
    showToast('Sistema reiniciado correctamente. Recargando...', 'success')
    setTimeout(() => window.location.reload(), 2500)
  }

    const exportarVentasCSV = () => {
      const ventasFiltradas = ventas.filter((v: any) => {
        const f = v.fecha || ''
        return f >= fechaExportInicio && f <= fechaExportFin
      })
      if (ventasFiltradas.length === 0) {
        showToast('No hay ventas en el rango seleccionado', 'warning')
        return
      }
  
      const headers = ['ID', 'Fecha', 'Hora', 'Cliente', 'Total USD', 'Método Pago', 'Delivery', 'Notas']
      const rows = ventasFiltradas.map((v: any) => [
        v.id || '', v.fecha || '', v.hora || '', v.cliente_nombre || '',
        String(v.total_usd || 0), v.metodo_pago || '', v.es_delivery ? 'Sí' : 'No', v.notas || ''
      ])
      const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `ventas-${fechaExportInicio}-a-${fechaExportFin}.csv`
      link.click()
      URL.revokeObjectURL(url)
      showToast(`${ventasFiltradas.length} ventas exportadas`, 'success')
    }

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════

  return (
    <div className="relative min-h-[calc(100vh-57px)] -m-6 bg-[#f7f9fc] dark:bg-[#0f1117] p-6 overflow-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-manrope text-2xl font-bold text-[#191c1e] dark:text-[#e4e6f0]">
            Administración
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-inter mt-0.5">
            Agua Potable La Campiña — Panel protegido
          </p>
        </div>
      </div>

      {/* Alerta de backup */}
      {(diasSinBackup === null || diasSinBackup >= 7) && (
        <div className="bg-[#fef3c7] dark:bg-[#78350f] rounded-[12px] p-4 mb-6 flex items-start gap-3 border border-[#fde68a] dark:border-[#92400e]">
          <AlertTriangle size={20} className="text-[#92400e] dark:text-[#fde68a] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-manrope font-bold text-sm text-[#92400e] dark:text-[#fde68a]">
              {diasSinBackup === null ? 'Nunca se ha realizado un backup' : `Último backup hace ${diasSinBackup} días`}
            </p>
            <p className="font-inter text-xs text-[#92400e]/70 dark:text-[#fde68a]/70 mt-0.5">
              Se recomienda exportar un respaldo al menos cada 7 días
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         GESTIÓN DE PRECIOS
         ═══════════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <h2 className="font-manrope text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider uppercase mb-4">
          Gestión de Precios
        </h2>
        <div className="bg-white dark:bg-[#1e2235] rounded-[12px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-[#2d3148] font-manrope">
                  <th className="py-3 px-4 font-medium">Producto</th>
                  <th className="py-3 px-4 font-medium">Precio USD</th>
                  <th className="py-3 px-4 font-medium">Equivalente VES</th>
                  <th className="py-3 px-4 font-medium">Costo USD</th>
                  <th className="py-3 px-4 font-medium text-right">Margen %</th>
                </tr>
              </thead>
              <tbody>
                {productos.map(p => {
                  const margen = p.precioUsd > 0 ? ((p.precioUsd - p.costoUsd) / p.precioUsd) * 100 : 0
                  return (
                    <tr key={p.id} className="border-b border-gray-50 dark:border-[#2d3148]/50 last:border-0
                      hover:bg-[#f7f9fc] dark:hover:bg-[#1a1d27] transition-colors">
                      <td className="py-3 px-4 font-inter font-medium text-[#191c1e] dark:text-[#e4e6f0]">
                        {p.nombre}
                      </td>
                      <td className="py-3 px-4">
                        <div className="relative w-28">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-grotesk text-gray-400 dark:text-gray-500 text-sm">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={p.precioUsd}
                            onChange={e => updateProducto(p.id, 'precioUsd', parseFloat(e.target.value) || 0)}
                            className="w-full pl-7 pr-2 py-2 rounded-lg border-2 border-gray-200 dark:border-[#2d3148]
                              bg-white dark:bg-[#1a1d27] font-grotesk font-bold text-sm text-primary dark:text-[#5bb3e8]
                              outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-grotesk text-sm text-gray-500 dark:text-gray-400">
                          {usdToVes(p.precioUsd)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="relative w-28">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-grotesk text-gray-400 dark:text-gray-500 text-sm">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={p.costoUsd}
                            onChange={e => updateProducto(p.id, 'costoUsd', parseFloat(e.target.value) || 0)}
                            className="w-full pl-7 pr-2 py-2 rounded-lg border-2 border-gray-200 dark:border-[#2d3148]
                              bg-white dark:bg-[#1a1d27] font-grotesk font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]
                              outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-grotesk font-bold text-sm ${
                          margen >= 50 ? 'text-[#16a34a]' : margen >= 30 ? 'text-[#d97706]' : 'text-[#dc2626]'
                        }`}>
                          {margen.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-gray-100 dark:border-[#2d3148] flex justify-end">
              <button
                onClick={guardarPrecios}
                disabled={isSavingPrecios}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-manrope font-bold text-sm text-white shadow-md
                  hover:shadow-lg transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
              >
                {isSavingPrecios ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Guardar Cambios
                  </>
                )}
              </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
         CONFIGURACIÓN + TASA BCV (two columns)
         ═══════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        {/* ── Configuración ──────────────────────────────────────── */}
        <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm flex-1">
          <div className="flex items-center gap-2 mb-4">
            <Settings size={16} className="text-primary dark:text-[#5bb3e8]" />
            <h3 className="font-manrope font-bold text-base text-[#191c1e] dark:text-[#e4e6f0]">
              Configuración
            </h3>
          </div>

          <div className="space-y-4 mb-5">
            <div>
              <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">
                Nombre de la estación
              </label>
              <input
                type="text"
                value={config.nombreEstacion}
                onChange={e => setConfig({ ...config, nombreEstacion: e.target.value })}
                className="w-full border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-3 font-inter text-sm
                  text-[#191c1e] dark:text-[#e4e6f0] bg-white dark:bg-[#1a1d27]
                  outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">
                Operario activo
              </label>
              <input
                type="text"
                value={config.operario}
                onChange={e => setConfig({ ...config, operario: e.target.value })}
                className="w-full border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-3 font-inter text-sm
                  text-[#191c1e] dark:text-[#e4e6f0] bg-white dark:bg-[#1a1d27]
                  outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">
                  Capacidad Jumbo (L)
                </label>
                <input
                  type="number"
                  min="100"
                  value={config.capacidadJumbo}
                  onChange={e => setConfig({ ...config, capacidadJumbo: parseInt(e.target.value) || 2500 })}
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-3 font-grotesk text-sm font-bold
                    text-primary dark:text-[#5bb3e8] bg-white dark:bg-[#1a1d27]
                    outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">
                  Meta diaria (USD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={config.metaDiaria}
                  onChange={e => setConfig({ ...config, metaDiaria: parseInt(e.target.value) || 500 })}
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-3 font-grotesk text-sm font-bold
                    text-primary dark:text-[#5bb3e8] bg-white dark:bg-[#1a1d27]
                    outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={guardarConfig}
              disabled={isSavingConfig}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-manrope font-bold text-sm text-white shadow-md cursor-pointer disabled:opacity-70"
              style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
            >
              {isSavingConfig ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={14} />
                  Guardar
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Tasa BCV ───────────────────────────────────────────── */}
        <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm flex-1">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-primary dark:text-[#5bb3e8]" />
            <h3 className="font-manrope font-bold text-base text-[#191c1e] dark:text-[#e4e6f0]">
              Tasa BCV
            </h3>
          </div>

          {/* Current rate */}
          <div className="bg-blue-50 dark:bg-[#1a1d27] rounded-xl p-4 mb-4 border border-blue-100 dark:border-[#2d3148]">
            <div className="flex items-center justify-between mb-1">
              <span className="font-inter text-xs text-gray-500 dark:text-gray-400">Tasa actual</span>
              <span className={`text-[10px] font-grotesk font-bold px-2 py-0.5 rounded-full ${
                tasaBcv.fuente === 'api'
                  ? 'bg-[#dcfce7] text-[#166534] dark:bg-[#14532d] dark:text-[#86efac]'
                  : 'bg-[#fef3c7] text-[#92400e] dark:bg-[#78350f] dark:text-[#fde68a]'
              }`}>
                {tasaBcv.fuente === 'api' ? 'API BCV' : 'MANUAL'}
              </span>
            </div>
            <div className="font-grotesk text-3xl font-bold text-primary dark:text-[#5bb3e8]">
              {tasaBcv.valor.toFixed(2)} <span className="text-sm font-medium text-gray-400">VES</span>
            </div>
            <div className="font-grotesk text-xs text-gray-400 dark:text-gray-500 mt-1">
              Actualizada: {new Date(tasaBcv.fecha).toLocaleString('es-VE')}
            </div>
          </div>

          {/* Manual input */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">
              Ingreso manual de tasa
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={tasaManualInput}
                onChange={e => setTasaManualInput(e.target.value)}
                placeholder="Ej: 38.50"
                className="flex-1 border-2 border-gray-200 dark:border-[#2d3148] rounded-xl p-3 font-grotesk text-sm font-bold
                  text-[#191c1e] dark:text-[#e4e6f0] bg-white dark:bg-[#1a1d27]
                  outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
              />
                <button
                onClick={setTasaManual}
                disabled={isSavingTasa || !tasaManualInput}
                className="px-4 rounded-xl font-manrope font-bold text-sm text-white shadow-md cursor-pointer disabled:opacity-70 flex items-center justify-center min-w-[100px]"
                style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
              >
                {isSavingTasa ? <Loader2 size={16} className="animate-spin" /> : 'Aplicar'}
              </button>
            </div>
          </div>

          {/* Fetch from API */}
          <button
            onClick={fetchTasa}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-manrope font-bold text-sm
              border-2 border-gray-200 dark:border-[#2d3148] text-gray-600 dark:text-gray-300
              hover:border-primary dark:hover:border-[#5bb3e8] hover:text-primary dark:hover:text-[#5bb3e8]
              transition-all cursor-pointer mb-4"
          >
            <RefreshCw size={14} />
            Actualizar desde API del BCV
          </button>

          {/* History hint */}
          <div className="bg-gray-50 dark:bg-[#1a1d27] rounded-xl p-3 border border-gray-100 dark:border-[#2d3148]">
            <p className="text-xs font-manrope font-bold text-gray-400 dark:text-gray-500 tracking-wider mb-2">
              ÚLTIMAS TASAS
            </p>
            <p className="font-inter text-xs text-gray-400 dark:text-gray-500">
              El historial completo de tasas se registra automáticamente en Google Sheets (hoja: tasas_bcv)
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
         RESPALDO DE DATOS
         ═══════════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <h2 className="font-manrope text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider uppercase mb-4">
          Respaldo de Datos
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Exportar backup JSON */}
          <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Database size={16} className="text-primary dark:text-[#5bb3e8]" />
              <span className="font-manrope font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]">
                Backup Completo
              </span>
            </div>
            <p className="font-inter text-xs text-gray-500 dark:text-gray-400 mb-4">
              Descarga todos los datos del sistema como archivo JSON
            </p>
            {lastBackup && (
              <p className="font-grotesk text-xs text-gray-400 dark:text-gray-500 mb-3">
                Último: {new Date(lastBackup).toLocaleDateString('es-VE')}
              </p>
            )}
            <button
              onClick={exportarBackup}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-manrope font-bold text-sm text-white shadow-md cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
            >
              <Download size={14} />
              Exportar .json
            </button>
          </div>

          {/* Importar backup */}
          <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Upload size={16} className="text-primary dark:text-[#5bb3e8]" />
              <span className="font-manrope font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]">
                Importar Backup
              </span>
            </div>
            <p className="font-inter text-xs text-gray-500 dark:text-gray-400 mb-4">
              Restaurar datos desde un archivo de respaldo
            </p>
            <p className="font-inter text-xs text-[#dc2626] dark:text-[#fca5a5] mb-3">
              ⚠ Esto reemplazará todos los datos actuales
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-manrope font-bold text-sm
                border-2 border-gray-200 dark:border-[#2d3148] text-gray-600 dark:text-gray-300
                hover:border-primary dark:hover:border-[#5bb3e8] hover:text-primary dark:hover:text-[#5bb3e8]
                transition-all cursor-pointer"
            >
              <Upload size={14} />
              Seleccionar Archivo
            </button>
          </div>

          {/* Exportar ventas CSV */}
          <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={16} className="text-primary dark:text-[#5bb3e8]" />
              <span className="font-manrope font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]">
                Exportar Ventas
              </span>
            </div>
            <div className="space-y-2 mb-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 font-manrope">Desde</label>
                <input
                  type="date"
                  value={fechaExportInicio}
                  onChange={e => setFechaExportInicio(e.target.value)}
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] rounded-lg p-2 font-grotesk text-xs font-bold
                    text-[#191c1e] dark:text-[#e4e6f0] bg-white dark:bg-[#1a1d27]
                    outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 font-manrope">Hasta</label>
                <input
                  type="date"
                  value={fechaExportFin}
                  onChange={e => setFechaExportFin(e.target.value)}
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] rounded-lg p-2 font-grotesk text-xs font-bold
                    text-[#191c1e] dark:text-[#e4e6f0] bg-white dark:bg-[#1a1d27]
                    outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
                />
              </div>
            </div>
            <button
              onClick={exportarVentasCSV}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-manrope font-bold text-sm text-white shadow-md cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
            >
              <Download size={14} />
              Exportar .csv
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
         EGRESOS FIJOS
         ═══════════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <h2 className="font-manrope text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider uppercase mb-4">
          Egresos Fijos
        </h2>
        <div className="bg-white dark:bg-[#1e2235] rounded-[12px] p-5 shadow-sm">

          {/* Alquiler */}
          <div className="flex items-center gap-2 mb-3">
            <Home size={16} className="text-primary dark:text-[#5bb3e8]" />
            <h3 className="font-manrope font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]">Alquiler del Local</h3>
          </div>
          <div className="mb-5">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 font-manrope">Monto mensual (USD)</label>
            <div className="relative w-48">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-grotesk text-gray-400 text-sm">$</span>
              <input
                type="number" min="0" step="0.01"
                value={alquiler}
                onChange={e => setAlquiler(parseFloat(e.target.value) || 0)}
                className="w-full pl-7 pr-3 py-2.5 border-2 border-gray-200 dark:border-[#2d3148] rounded-xl
                  font-grotesk font-bold text-sm text-primary dark:text-[#5bb3e8]
                  bg-white dark:bg-[#1a1d27] outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
              />
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 font-inter">Se registrará como egreso en el cierre mensual</p>
          </div>

          {/* Proveedores */}
          <div className="border-t border-gray-100 dark:border-[#2d3148] pt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-primary dark:text-[#5bb3e8]" />
                <h3 className="font-manrope font-bold text-sm text-[#191c1e] dark:text-[#e4e6f0]">Proveedores</h3>
              </div>
              <button
                onClick={agregarProveedor}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm hover:scale-105 transition-transform"
                style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
              >
                <Plus size={12} /> Agregar
              </button>
            </div>
            <div className="space-y-3">
              {proveedores.map(prov => (
                <div key={prov.id} className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={prov.nombre}
                    onChange={e => actualizarProveedor(prov.id, 'nombre', e.target.value)}
                    placeholder="Nombre del proveedor"
                    className="flex-1 min-w-[140px] border-2 border-gray-200 dark:border-[#2d3148] rounded-xl px-3 py-2
                      font-inter text-sm text-[#191c1e] dark:text-[#e4e6f0] bg-white dark:bg-[#1a1d27]
                      outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
                  />
                  <div className="relative w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-grotesk text-gray-400 text-xs">$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={prov.montoPorPago}
                      onChange={e => actualizarProveedor(prov.id, 'montoPorPago', parseFloat(e.target.value) || 0)}
                      className="w-full pl-6 pr-2 py-2 border-2 border-gray-200 dark:border-[#2d3148] rounded-xl
                        font-grotesk font-bold text-sm text-primary dark:text-[#5bb3e8]
                        bg-white dark:bg-[#1a1d27] outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
                    />
                  </div>
                  <select
                    value={prov.frecuencia}
                    onChange={e => actualizarProveedor(prov.id, 'frecuencia', e.target.value)}
                    className="border-2 border-gray-200 dark:border-[#2d3148] rounded-xl px-3 py-2
                      font-inter text-sm text-[#191c1e] dark:text-[#e4e6f0] bg-white dark:bg-[#1a1d27]
                      outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors cursor-pointer"
                  >
                    <option value="diario">Diario</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                  <button
                    onClick={() => eliminarProveedor(prov.id)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {proveedores.length === 0 && (
                <p className="text-sm font-inter text-gray-400 dark:text-gray-500 text-center py-4">
                  Sin proveedores configurados
                </p>
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={guardarConfig}
                disabled={isSavingConfig}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-manrope font-bold text-sm text-white shadow-md
                  hover:shadow-lg transition-all cursor-pointer disabled:opacity-70"
                style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
              >
                {isSavingConfig ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Guardar Egresos Fijos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
         ZONA DE PELIGRO
         ═══════════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <h2 className="font-manrope text-xs font-bold text-red-500 dark:text-red-400 tracking-wider uppercase mb-4">
          Zona de Peligro
        </h2>
        <div className="bg-red-50 dark:bg-red-900/10 rounded-[12px] p-5 shadow-sm border border-red-200 dark:border-red-900/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={18} className="text-red-600 dark:text-red-500" />
                <h3 className="font-manrope font-bold text-base text-red-700 dark:text-red-400">Restablecer Sistema de Fábrica</h3>
              </div>
              <p className="font-inter text-sm text-red-600/80 dark:text-red-400/80 max-w-xl">
                Esta acción borrará todas las ventas, inventario, deudas y cierres locales para que la aplicación inicie desde cero. <br/>
                <strong className="text-red-700 dark:text-red-400">El listado de Clientes y la configuración NO se borrarán.</strong>
              </p>
            </div>
            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' })
                setShowResetConfirm(true)
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-manrope font-bold text-sm text-white shadow-md bg-red-600 hover:bg-red-700 transition-colors whitespace-nowrap"
            >
              <Trash2 size={16} />
              Restablecer Sistema
            </button>
          </div>
        </div>
      </div>

      {/* USUARIOS */}

      <GestionUsuarios />

      {/* ═══════════════════════════════════════════════════════════════
         MODAL — CONFIRMAR IMPORTACIÓN
         ═══════════════════════════════════════════════════════════════ */}
      {showImportConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowImportConfirm(false)} />
          <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-6 w-full max-w-sm relative z-10 mx-4"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={24} className="text-[#dc2626]" />
              </div>
              <div>
                <h2 className="font-manrope text-lg font-bold text-[#191c1e] dark:text-[#e4e6f0]">
                  ¿Importar backup?
                </h2>
                <p className="font-inter text-sm text-gray-500 dark:text-gray-400">
                  Esta acción reemplazará todos los datos actuales
                </p>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 mb-5 border border-red-200 dark:border-red-800/30">
              <p className="font-inter text-sm text-[#dc2626] dark:text-[#fca5a5]">
                Los datos actuales se perderán permanentemente. Asegúrate de tener un backup reciente antes de continuar.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowImportConfirm(false); setImportData(null) }}
                className="flex-1 py-3 rounded-xl font-manrope font-bold text-gray-500 dark:text-gray-400
                  hover:bg-gray-100 dark:hover:bg-[#1a1d27] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarImport}
                className="flex-1 py-3 rounded-xl font-manrope font-bold text-white shadow-md"
                style={{ background: '#dc2626' }}
              >
                Sí, Importar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
         MODAL — CONFIRMAR RESET
         ═══════════════════════════════════════════════════════════════ */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowResetConfirm(false)} />
          <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-6 w-full max-w-md relative z-10 mx-4"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={24} className="text-[#dc2626]" />
              </div>
              <div>
                <h2 className="font-manrope text-lg font-bold text-[#191c1e] dark:text-[#e4e6f0]">
                  ¿Estás completamente seguro?
                </h2>
                <p className="font-inter text-sm text-gray-500 dark:text-gray-400">
                  Todo volverá a 0 (excepto clientes y configuración)
                </p>
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 mb-5 border border-red-200 dark:border-red-800/30 space-y-3">
              <p className="font-inter text-sm text-[#dc2626] dark:text-[#fca5a5] font-semibold">
                ⚠️ PASO ADICIONAL REQUERIDO:
              </p>
              <p className="font-inter text-sm text-[#dc2626] dark:text-[#fca5a5]">
                Esta acción limpiará la memoria local de la aplicación. Sin embargo, para que funcione correctamente, <strong>debes abrir Google Sheets y borrar manualmente todo el contenido de las hojas:</strong>
              </p>
              <ul className="list-disc pl-5 font-inter text-xs text-[#dc2626] dark:text-[#fca5a5]">
                <li>ventas</li>
                <li>prepagos</li>
                <li>deudas_postpago</li>
                <li>cierres_caja</li>
                <li>movimientos_agua</li>
                <li>inventario_snapshot</li>
              </ul>
              <p className="font-inter text-sm text-[#dc2626] dark:text-[#fca5a5] font-bold">
                (NO borres la hoja "clientes" ni "tasas_bcv")
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 rounded-xl font-manrope font-bold text-gray-500 dark:text-gray-400
                  hover:bg-gray-100 dark:hover:bg-[#1a1d27] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarReset}
                className="flex-1 py-3 rounded-xl font-manrope font-bold text-white shadow-md bg-red-600 hover:bg-red-700 transition-colors"
              >
                Sí, Reiniciar Todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <Toast toast={toast} />
    </div>
  )
}