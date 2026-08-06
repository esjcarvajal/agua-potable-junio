import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { useAuthStore } from '../store/useAuthStore'
import { updateRow } from '../lib/db'
import { useConfig } from '../lib/useConfig'
import { useProductos } from '../lib/useProductos'
import { toPng } from 'html-to-image'
import {
  Plus, Minus, Trash2, X, Search, ShoppingCart,
  Truck, CreditCard, Smartphone, Banknote, Wallet, Users, ChevronUp, Clock
} from 'lucide-react'
import { getLocalDateString } from '../lib/dateUtils'

/* ════════════════════════════════════════════════════════════════════
   TOAST COMPONENT
   ════════════════════════════════════════════════════════════════════ */
interface ToastState {
  mensaje: string
  tipo: 'success' | 'error' | 'warning'
  visible: boolean
}

const TOAST_COLORS = {
  success: '#16a34a',
  error: '#dc2626',
  warning: '#d97706',
}

function Toast({ toast }: { toast: ToastState }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        zIndex: 100,
        background: TOAST_COLORS[toast.tipo],
        color: 'white',
        padding: '14px 22px',
        borderRadius: 12,
        fontFamily: 'Inter, sans-serif',
        fontSize: 14,
        fontWeight: 600,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        opacity: toast.visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: toast.visible ? 'auto' : 'none',
        maxWidth: 360,
      }}
    >
      {toast.mensaje}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   TYPES & DATA
   ════════════════════════════════════════════════════════════════════ */
interface Producto {
  id: string
  nombre: string
  precio: number
  litros: number
  esRecarga: boolean
}

interface CarritoItem {
  producto: Producto
  cantidad: number
  usarPrepago: boolean
}

const PRODUCTOS_DEFAULT_POS: Producto[] = [
  { id: 'p1',  nombre: 'Recarga 19L',        precio: 0.80, litros: 19, esRecarga: true },
  { id: 'p2',  nombre: 'Recarga 12L',        precio: 0.75, litros: 12, esRecarga: true },
  { id: 'p3',  nombre: 'Recarga 8L',         precio: 0.60, litros: 8,  esRecarga: true },
  { id: 'p4',  nombre: 'Recarga 5L',         precio: 0.50, litros: 5,  esRecarga: true },
  { id: 'p5',  nombre: 'Botellón Nuevo 19L', precio: 8.00, litros: 0,  esRecarga: false },
  { id: 'p6',  nombre: 'Bolsa de Hielo',     precio: 2.00, litros: 0,  esRecarga: false },
  { id: 'p7',  nombre: 'Helado',             precio: 3.50, litros: 0,  esRecarga: false },
  { id: 'p8',  nombre: 'Botellón Nuevo 12L', precio: 0,    litros: 0,  esRecarga: false },
  { id: 'p9',  nombre: 'Botellón Nuevo 5L',  precio: 0,    litros: 0,  esRecarga: false },
  { id: 'p10', nombre: 'Tapas Reusables',    precio: 0,    litros: 0,  esRecarga: false },
  { id: 'p11', nombre: 'Dispensador de Agua', precio: 0,   litros: 0,  esRecarga: false },
  { id: 'p12', nombre: 'Agarraderos Manuales', precio: 0,  litros: 0,  esRecarga: false },
  { id: 'p13', nombre: 'Cepillos de Lavado', precio: 0,    litros: 0,  esRecarga: false },
]

const TIPOS_BOTELLON_DEFAULT = [
  { litros: 19, label: '19L', precioDefault: 0.80 },
  { litros: 12, label: '12L', precioDefault: 0.75 },
  { litros: 8,  label: '8L',  precioDefault: 0.60 },
  { litros: 5,  label: '5L',  precioDefault: 0.50 },
]

type MetodoPago = 'efectivo_usd' | 'pago_movil' | 'punto_venta' | 'efectivo_ves' | 'prepago_cliente' | 'pago_mixto' | 'post_pago'

const METODOS_PAGO: { id: MetodoPago; label: string; icon: typeof Banknote }[] = [
  { id: 'efectivo_usd',   label: 'EFECTIVO USD',    icon: Banknote },
  { id: 'pago_movil',     label: 'PAGO MÓVIL',      icon: Smartphone },
  { id: 'punto_venta',    label: 'PUNTO DE VENTA',   icon: CreditCard },
  { id: 'efectivo_ves',   label: 'EFECTIVO VES',     icon: Wallet },
  { id: 'prepago_cliente', label: 'PREPAGO CLIENTE', icon: Users },
  { id: 'post_pago',      label: 'POST-PAGO / CRÉDITO', icon: Clock },
  { id: 'pago_mixto',     label: 'PAGO MIXTO',       icon: ShoppingCart },
]

const METODOS_PAGO_BASICOS = METODOS_PAGO.filter(m => ['efectivo_usd', 'pago_movil', 'punto_venta', 'efectivo_ves', 'post_pago'].includes(m.id))

const METODO_LABELS_RECIBO: Record<string, string> = {
  efectivo_usd:    'Efectivo USD',
  pago_movil:      'Pago Móvil',
  punto_venta:     'Punto de Venta',
  efectivo_ves:    'Efectivo VES',
  prepago_cliente: 'Prepago Cliente',
  pago_mixto:      'Pago Mixto',
  post_pago:       'Crédito / Post-Pago',
}

/* ════════════════════════════════════════════════════════════════════
   RECIBO TÉRMICO — 80mm thermal receipt format
   ════════════════════════════════════════════════════════════════════ */
interface ReciboData {
  numeroSerie: string
  fecha: string
  hora: string
  vendedor: string
  cliente: string
  items: CarritoItem[]
  totalUsd: number
  totalVes: string
  metodoPago: string
  referencia?: string
  tasaBcv: number
  negocio: string
  sucursal: string
  isDelivery: boolean
  costoDelivery: number
}

function ReciboTermico({ data, logo }: { data: ReciboData; logo?: string }) {
  const subtotal = data.items.reduce((s, i) => s + (i.usarPrepago ? 0 : i.producto.precio) * i.cantidad, 0)

  return (
    <div id="recibo-termico" style={{
      width: '72mm',
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: '11px',
      color: '#000',
      background: '#fff',
      padding: '4mm 2mm',
      margin: '0 auto',
    }}>
      {/* LOGO */}
      {logo && (
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <img src={logo} alt="Logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
        </div>
      )}

      {/* Encabezado */}
      <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '13px', letterSpacing: '0.5px' }}>
          {data.negocio.toUpperCase()}
        </div>
        <div style={{ fontSize: '10px', marginTop: '2px' }}>{data.sucursal}</div>
      </div>

      {/* Meta del recibo */}
      <div style={{ marginBottom: '6px', fontSize: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>N° Serie:</span><span style={{ fontWeight: 'bold' }}>{data.numeroSerie}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Fecha:</span><span>{data.fecha}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Hora:</span><span>{data.hora}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Atendido por:</span><span>{data.vendedor}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Cliente:</span><span>{data.cliente}</span>
        </div>
      </div>

      {/* Línea separadora */}
      <div style={{ borderTop: '1px dashed #000', marginBottom: '6px' }} />

      {/* Encabezado tabla */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '10px', marginBottom: '3px' }}>
        <span style={{ flex: 2 }}>DESCRIPCIÓN</span>
        <span style={{ flex: 1, textAlign: 'center' }}>CANT</span>
        <span style={{ flex: 1, textAlign: 'right' }}>P.UNIT</span>
        <span style={{ flex: 1, textAlign: 'right' }}>TOTAL</span>
      </div>

      {/* Items */}
      {data.items.map((item, i) => {
        const precioUnit = item.usarPrepago ? 0 : item.producto.precio
        const totalItem = precioUnit * item.cantidad
        return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
            <span style={{ flex: 2, whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '28mm' }}>
              {item.producto.nombre}{item.usarPrepago ? ' *' : ''}
            </span>
            <span style={{ flex: 1, textAlign: 'center' }}>{item.cantidad}</span>
            <span style={{ flex: 1, textAlign: 'right' }}>${precioUnit.toFixed(2)}</span>
            <span style={{ flex: 1, textAlign: 'right' }}>${totalItem.toFixed(2)}</span>
          </div>
        )
      })}
      {data.items.some(i => i.usarPrepago) && (
        <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>* Pagado con prepago</div>
      )}

      {/* Delivery */}
      {data.isDelivery && data.costoDelivery > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginTop: '2px' }}>
          <span style={{ flex: 2 }}>Envío a domicilio</span>
          <span style={{ flex: 1, textAlign: 'center' }}>1</span>
          <span style={{ flex: 1, textAlign: 'right' }}>${data.costoDelivery.toFixed(2)}</span>
          <span style={{ flex: 1, textAlign: 'right' }}>${data.costoDelivery.toFixed(2)}</span>
        </div>
      )}

      {/* Totales */}
      <div style={{ borderTop: '1px dashed #000', marginTop: '6px', paddingTop: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
          <span>Subtotal:</span><span>${subtotal.toFixed(2)}</span>
        </div>
        {data.isDelivery && data.costoDelivery > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
            <span>Envío:</span><span>${data.costoDelivery.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', marginTop: '4px' }}>
          <span>TOTAL:</span><span>${data.totalUsd.toFixed(2)} USD</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#444' }}>
          <span>Equivalente:</span><span>{data.totalVes}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#666', marginTop: '2px' }}>
          <span>Tasa BCV:</span><span>{data.tasaBcv.toFixed(2)} VES/USD</span>
        </div>
      </div>

      {/* Pago */}
      <div style={{ borderTop: '1px dashed #000', marginTop: '6px', paddingTop: '6px', fontSize: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Método de pago:</span>
          <span style={{ fontWeight: 'bold' }}>{METODO_LABELS_RECIBO[data.metodoPago] || data.metodoPago}</span>
        </div>
        {data.referencia && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Referencia:</span><span>{data.referencia}</span>
          </div>
        )}
      </div>

      {/* Pie de página */}
      <div style={{ borderTop: '1px dashed #000', marginTop: '8px', paddingTop: '6px', textAlign: 'center', fontSize: '9px' }}>
        <div style={{ marginBottom: '4px' }}>¡Gracias por su compra!</div>
        <div style={{ lineHeight: '1.4', color: '#444' }}>
          Este documento es un comprobante informativo de entrega y no constituye una factura fiscal
          válida ni está homologado por el SENIAT.
        </div>
        <div style={{ marginTop: '6px', fontSize: '8px', color: '#888' }}>
          {data.negocio} — {data.sucursal}
        </div>
      </div>
    </div>
  )
}

function imprimirRecibo(data: ReciboData, logo?: string) {
  const win = window.open('', '_blank', 'width=340,height=700,scrollbars=yes')
  if (!win) return
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Recibo ${data.numeroSerie}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#fff; }
    @media print {
      @page { margin:0; size:80mm auto; }
      body { width:80mm; }
    }
  </style>
</head>
<body>
  <div style="width:72mm;font-family:'Courier New',Courier,monospace;font-size:11px;color:#000;background:#fff;padding:4mm 2mm;margin:0 auto;">
    ${logo ? `<div style="text-align:center;margin-bottom:4px"><img src="${logo}" style="width:48px;height:48px;object-fit:contain"/></div>` : ''}
    <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px">
      <div style="font-weight:bold;font-size:13px">${data.negocio.toUpperCase()}</div>
      <div style="font-size:10px;margin-top:2px">${data.sucursal}</div>
    </div>
    <div style="margin-bottom:6px;font-size:10px">
      <div style="display:flex;justify-content:space-between"><span>N° Serie:</span><span style="font-weight:bold">${data.numeroSerie}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Fecha:</span><span>${data.fecha}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Hora:</span><span>${data.hora}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Atendido por:</span><span>${data.vendedor}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Cliente:</span><span>${data.cliente}</span></div>
    </div>
    <div style="border-top:1px dashed #000;margin-bottom:6px"></div>
    <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:10px;margin-bottom:3px">
      <span style="flex:2">DESCRIPCIÓN</span><span style="flex:1;text-align:center">CANT</span><span style="flex:1;text-align:right">P.UNIT</span><span style="flex:1;text-align:right">TOTAL</span>
    </div>
    ${data.items.map(item => {
      const p = item.usarPrepago ? 0 : item.producto.precio
      return `<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px">
        <span style="flex:2;overflow:hidden;max-width:28mm">${item.producto.nombre}${item.usarPrepago ? ' *' : ''}</span>
        <span style="flex:1;text-align:center">${item.cantidad}</span>
        <span style="flex:1;text-align:right">$${p.toFixed(2)}</span>
        <span style="flex:1;text-align:right">$${(p * item.cantidad).toFixed(2)}</span>
      </div>`
    }).join('')}
    ${data.isDelivery && data.costoDelivery > 0 ? `<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px"><span style="flex:2">Envío a domicilio</span><span style="flex:1;text-align:center">1</span><span style="flex:1;text-align:right">$${data.costoDelivery.toFixed(2)}</span><span style="flex:1;text-align:right">$${data.costoDelivery.toFixed(2)}</span></div>` : ''}
    <div style="border-top:1px dashed #000;margin-top:6px;padding-top:6px">
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;margin-top:4px"><span>TOTAL:</span><span>$${data.totalUsd.toFixed(2)} USD</span></div>
      <div style="display:flex;justify-content:space-between;font-size:10px"><span>Equivalente:</span><span>${data.totalVes}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:9px;color:#666;margin-top:2px"><span>Tasa BCV:</span><span>${data.tasaBcv.toFixed(2)} VES/USD</span></div>
    </div>
    <div style="border-top:1px dashed #000;margin-top:6px;padding-top:6px;font-size:10px">
      <div style="display:flex;justify-content:space-between"><span>Método de pago:</span><span style="font-weight:bold">${METODO_LABELS_RECIBO[data.metodoPago] || data.metodoPago}</span></div>
      ${data.referencia ? `<div style="display:flex;justify-content:space-between"><span>Referencia:</span><span>${data.referencia}</span></div>` : ''}
    </div>
    <div style="border-top:1px dashed #000;margin-top:8px;padding-top:6px;text-align:center;font-size:9px">
      <div style="margin-bottom:4px">¡Gracias por su compra!</div>
      <div style="line-height:1.4;color:#444">Este documento es un comprobante informativo de entrega y no constituye una factura fiscal válida ni está homologado por el SENIAT.</div>
      <div style="margin-top:6px;font-size:8px;color:#888">${data.negocio} — ${data.sucursal}</div>
    </div>
  </div>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}<\/script>
</body>
</html>`
  win.document.write(html)
  win.document.close()
}

/* ════════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function POS() {
  const navigate = useNavigate()
  const store = useAppStore()
  const { usdToVes, litrosJumbo, tapas, precintos, clientes, prepagos } = store
  const config = useConfig()
  const sesion = useAuthStore(s => s.sesion)

  // ── Local state ─────────────────────────────────────────────────
  const [carrito, setCarrito] = useState<CarritoItem[]>([])
  const [isDelivery, setIsDelivery] = useState(false)
  const [incluirEtiquetas, setIncluirEtiquetas] = useState(false)
  const [costoDelivery, setCostoDelivery] = useState(0)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [metodoPago, setMetodoPago] = useState<MetodoPago | ''>('')
  const [referenciaPagoMovil, setReferenciaPagoMovil] = useState('')
  // ── Precios sincronizados desde Firebase (reactivo entre dispositivos) ──
  const productosSync = useProductos()

  // Derived state
  const ventasHoy = store.ventas.filter((v: any) => v.fecha === getLocalDateString())
  const nextOrdenNumero = String(ventasHoy.length + 1).padStart(3, '0')

  // Sincronizar lista de productos del POS cuando cambien los precios (Firebase → POS)
  const productosList = useMemo(() => {
    return PRODUCTOS_DEFAULT_POS.map(p => {
      const found = productosSync.find(s => s.id === p.id)
      return found ? { ...p, precio: found.precioUsd } : p
    })
  }, [productosSync])

  const tiposBotellonList = useMemo(() => {
    return TIPOS_BOTELLON_DEFAULT.map(t => {
      const found = productosSync.find(p => p.nombre.includes(`${t.litros}L`))
      return found ? { ...t, precioDefault: found.precioUsd } : t
    })
  }, [productosSync])
  const [showExitoModal, setShowExitoModal] = useState(false)
  const [ultimaVenta, setUltimaVenta] = useState<any>(null)
  const [ventaSynced, setVentaSynced] = useState(false)
  const [toast, setToast] = useState<ToastState>({ mensaje: '', tipo: 'success', visible: false })
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualNombre, setManualNombre] = useState('')
  const [manualPrecio, setManualPrecio] = useState('')
  const [showDrawer, setShowDrawer] = useState(false)

  // ── Prepago modal state ───────────────────────────────────────
  const [showPrepago, setShowPrepago] = useState(false)
  const [prepagoTipoLitros, setPrepagoTipoLitros] = useState(19)
  const [prepagoCantidad, setPrepagoCantidad] = useState(1)
  const [prepagoPrecio, setPrepagoPrecio] = useState('1.50')
  const [prepagoMetodo, setPrepagoMetodo] = useState<MetodoPago | ''>('')

  // ── Toast helper ───────────────────────────────────────────────
  const showToast = useCallback((mensaje: string, tipo: 'success' | 'error' | 'warning') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ mensaje, tipo, visible: true })
    toastTimer.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }))
    }, 3000)
  }, [])

  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current) }
  }, [])

  // ── Derived ────────────────────────────────────────────────────
  const clientePrepagos = useMemo(() => {
    if (!clienteSeleccionado) return []
    return prepagos.filter(
      (p: any) => p.cliente_id === clienteSeleccionado.id && (p.recargas_usadas ?? 0) < (p.recargas_compradas ?? 0)
    )
  }, [clienteSeleccionado, prepagos])

  const clientePrepagosCount = clientePrepagos.length

  // Desglose de prepagos activos por tipo de botellón
  const clientePrepagosDetalle = useMemo(() => {
    if (!clientePrepagos.length) return []
    const porTipo: Record<string, number> = {}
    clientePrepagos.forEach((p: any) => {
      const tipo = p.tipo_botellon || 'Botellón'
      const disponibles = (p.recargas_compradas ?? 0) - (p.recargas_usadas ?? 0)
      porTipo[tipo] = (porTipo[tipo] || 0) + disponibles
    })
    return Object.entries(porTipo).map(([tipo, qty]) => ({ tipo, qty }))
  }, [clientePrepagos])

  // Nivel del cliente basado en ventas históricas
  const clienteNivel = useMemo(() => {
    if (!clienteSeleccionado) return null
    const ventasCliente = store.ventas.filter((v: any) => v.cliente_id === clienteSeleccionado.id)
    const totalCompras = ventasCliente.reduce((sum: number, v: any) => sum + (parseFloat(v.total_usd) || 0), 0)
    if (totalCompras >= 200) return { label: 'VIP', color: '#ca8a04', bg: '#fef9c3' }
    if (totalCompras >= 50) return { label: 'ELITE', color: '#005e97', bg: '#dbeafe' }
    return { label: 'REGULAR', color: '#6b7280', bg: '#f3f4f6' }
  }, [clienteSeleccionado, store.ventas])

  const clientesFilterResults = useMemo(() => {
    if (!busquedaCliente.trim()) return []
    const q = busquedaCliente.toLowerCase()
    return (clientes || []).filter((c: any) => {
      if (!c) return false;
      const nombre = String(c.nombre || '').toLowerCase();
      const telefono = String(c.telefono || '').toLowerCase();
      return nombre.includes(q) || telefono.includes(q);
    }).slice(0, 5)
  }, [busquedaCliente, clientes])

  const subtotalUsd = useMemo(() =>
    carrito.reduce((sum, item) => {
      const precio = item.usarPrepago ? 0 : item.producto.precio
      return sum + precio * item.cantidad
    }, 0)
  , [carrito])

  const totalUsd = subtotalUsd + (isDelivery ? costoDelivery : 0)

  const tankCapacity = 2500
  const tankPercent = Math.min((litrosJumbo / tankCapacity) * 100, 100)
  const showInventoryAlert = tapas < 500 || precintos < 500

  const alertItems: string[] = []
  if (tapas < 500) alertItems.push(`Tapas: ${tapas}`)
  if (precintos < 500) alertItems.push(`Precintos: ${precintos}`)

  // ── Handlers ───────────────────────────────────────────────────
  const agregarAlCarrito = (producto: Producto) => {
    setCarrito(prev => {
      const existente = prev.find(i => i.producto.id === producto.id)
      if (existente) {
        return prev.map(i =>
          i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      }
      return [...prev, { producto, cantidad: 1, usarPrepago: false }]
    })
  }

  const cambiarCantidad = (productoId: string, delta: number) => {
    setCarrito(prev =>
      prev.map(i =>
        i.producto.id === productoId
          ? { ...i, cantidad: Math.max(1, i.cantidad + delta) }
          : i
      )
    )
  }

  const eliminarItem = (productoId: string) => {
    setCarrito(prev => prev.filter(i => i.producto.id !== productoId))
  }

  const togglePrepago = (productoId: string) => {
    setCarrito(prev =>
      prev.map(i =>
        i.producto.id === productoId ? { ...i, usarPrepago: !i.usarPrepago } : i
      )
    )
  }

  const itemTienePrepago = (item: CarritoItem): boolean => {
    if (!item.producto.esRecarga || !clienteSeleccionado) return false
    // Match by litros: check if there's a prepago for this bottle type
    return clientePrepagos.some((p: any) => {
      const tipoStr = p.tipo_botellon || ''
      const litrosMatch = parseInt(tipoStr) || 0
      return litrosMatch === item.producto.litros
    })
  }

  const getPrepagoDisponibles = (item: CarritoItem): number => {
    if (!item.producto.esRecarga || !clienteSeleccionado) return 0
    return clientePrepagos
      .filter((p: any) => {
        const litrosMatch = parseInt(p.tipo_botellon || '') || 0
        return litrosMatch === item.producto.litros
      })
      .reduce((sum: number, p: any) => sum + ((p.recargas_compradas ?? 0) - (p.recargas_usadas ?? 0)), 0)
  }

  const agregarManual = () => {
    if (!manualNombre.trim() || !manualPrecio) return
    const producto: Producto = {
      id: `manual-${Date.now()}`,
      nombre: manualNombre.trim(),
      precio: parseFloat(manualPrecio) || 0,
      litros: 0,
      esRecarga: false,
    }
    agregarAlCarrito(producto)
    setManualNombre('')
    setManualPrecio('')
    setShowManualModal(false)
  }

  // ── Registrar Prepago ──────────────────────────────────────────
  const registrarPrepago = async () => {
    if (!clienteSeleccionado) {
      showToast('Selecciona un cliente primero', 'error')
      return
    }
    if (!prepagoMetodo) {
      showToast('Selecciona un método de pago', 'error')
      return
    }
    if (prepagoCantidad < 1) {
      showToast('La cantidad debe ser al menos 1', 'error')
      return
    }

    const precioUnitario = parseFloat(prepagoPrecio) || 0
    const totalPrepago = precioUnitario * prepagoCantidad
    const tipoLabel = `${prepagoTipoLitros}L`

    const prepago = {
      id: crypto.randomUUID(),
      cliente_id: clienteSeleccionado.id,
      tipo_botellon: tipoLabel,
      recargas_compradas: prepagoCantidad,
      recargas_usadas: 0,
      precio_usd: precioUnitario,
      fecha_compra: new Date().toISOString(),
      activo: true,
    }

    await store.agregarPrepago(prepago)

    // Registrar como venta tipo ABONO_PREPAGO
    const ventaAbono = {
      id: crypto.randomUUID(),
      fecha: getLocalDateString(),
      hora: new Date().toLocaleTimeString(),
      cliente_id: clienteSeleccionado.id,
      cliente_nombre: clienteSeleccionado.nombre || 'Cliente',
      items_json: JSON.stringify([{ tipo: 'ABONO_PREPAGO', tipo_botellon: tipoLabel, cantidad: prepagoCantidad, precio_usd: precioUnitario }]),
      total_usd: totalPrepago,
      tasa_bcv: store.tasaBcv.valor,
      metodo_pago: prepagoMetodo,
      es_delivery: false,
      costo_delivery_usd: 0,
      notas: `ABONO PREPAGO: ${prepagoCantidad} recargas de ${tipoLabel}`,
    }
    await store.agregarVenta(ventaAbono)

    showToast(`Prepago registrado — ${prepagoCantidad} recargas de ${tipoLabel} para ${clienteSeleccionado.nombre}`, 'success')

    // Reset modal state
    setShowPrepago(false)
    setPrepagoTipoLitros(19)
    setPrepagoCantidad(1)
    setPrepagoPrecio('1.50')
    setPrepagoMetodo('')
  }

  const completarTransaccion = async () => {
    // 1. Validar carrito
    if (!carrito.length) {
      showToast('Agrega al menos un producto al carrito', 'error')
      return
    }
    // 2. Validar método de pago
    if (!metodoPago) {
      showToast('Selecciona un método de pago', 'error')
      return
    }

    // 3. Calcular totalLitros
    const totalLitros = carrito.reduce((sum, item) =>
      item.producto.esRecarga ? sum + item.producto.litros * item.cantidad : sum
    , 0)



    // 4.5. Validar Post-Pago Status & Limite
    if (metodoPago === 'post_pago') {
      if (!clienteSeleccionado || !clienteSeleccionado.esPostpago) {
        showToast('El cliente no tiene habilitado el post-pago', 'error')
        return
      }
      const limite = clienteSeleccionado.configPostpago?.limiteCredito || 0
      const actual = clienteSeleccionado.deudaTotalUsd || 0
      if (actual + totalUsd > limite) {
        showToast(`Límite de crédito excedido. Monto máximo disponible: $${Math.max(0, limite - actual).toFixed(2)}`, 'error')
        return
      }
    }

    // Generar número de orden secuencial diario
    const ventasHoy = store.ventas.filter((v: any) => v.fecha === getLocalDateString())
    const nuevoOrden = String(ventasHoy.length + 1).padStart(3, '0')

    // 5. Crear objeto venta
    const venta = {
      id: crypto.randomUUID(),
      numero_orden: nuevoOrden,
      fecha: getLocalDateString(),
      hora: new Date().toLocaleTimeString(),
      cliente_id: clienteSeleccionado?.id || '',
      cliente_nombre: clienteSeleccionado?.nombre || 'Cliente general',
      items_json: JSON.stringify(carrito),
      total_usd: totalUsd,
      tasa_bcv: store.tasaBcv.valor,
      metodo_pago: metodoPago,
      es_delivery: isDelivery,
      estado_delivery: isDelivery ? 'en_transito' : 'completado',
      costo_delivery_usd: costoDelivery,
      notas: referenciaPagoMovil ? `Ref: ${referenciaPagoMovil}` : '',
    }

    // 6. Guardar venta en store
    try {
      await store.agregarVenta(venta)
      // Check if sync succeeded (not in pendientesSync after call)
      const synced = !store.pendientesSync.some((p: any) => p.data?.id === venta.id)
      setVentaSynced(synced)
      if (!synced) {
        showToast('Venta guardada localmente — pendiente de sincronización', 'warning')
      }
    } catch {
      setVentaSynced(false)
      showToast('Error al sincronizar con Sheets', 'warning')
    }

    // 7. Descontar litros
    if (totalLitros > 0) store.descontarLitros(totalLitros)

    // 8. Descontar insumos con reglas de negocio correctas:
    //    - Tapas: solo botellones de 19L y 12L (no 8L ni 5L)
    //    - Precintos: solo si es delivery, y solo para 19L y 12L
    //    - Etiquetas: opcional desde el UI
    const tapasUsadas = carrito
      .filter(item => item.producto.esRecarga &&
        (item.producto.litros === 19 || item.producto.litros === 12))
      .reduce((sum, item) => sum + item.cantidad, 0)
    const precintosUsados = isDelivery ? tapasUsadas : 0
    const etiquetasUsadas = (isDelivery || incluirEtiquetas) ? tapasUsadas : 0
    if (tapasUsadas > 0 || precintosUsados > 0 || etiquetasUsadas > 0) {
      store.descontarInsumos(tapasUsadas, precintosUsados, etiquetasUsadas)
    }

    // 8.5 Descontar productos del inventario
    const productosADescontar: Record<string, number> = {}
    const PROD_TO_STORE_KEY: Record<string, string> = {
      'p5': 'botellonNuevo19L',
      'p8': 'botellonNuevo12L',
      'p9': 'botellonNuevo5L',
      'p10': 'tapasReusables',
      'p6': 'hielo',
      'p7': 'helado',
      'p11': 'dispensadorAgua',
      'p12': 'agarraderosManuales',
      'p13': 'cepillosLavado',
    }
    for (const item of carrito) {
      const storeKey = PROD_TO_STORE_KEY[item.producto.id]
      if (storeKey) {
        productosADescontar[storeKey] = (productosADescontar[storeKey] || 0) + item.cantidad
      }
    }
    if (Object.keys(productosADescontar).length > 0) {
      store.descontarProductos(productosADescontar)
    }

    // 9. Actualizar prepagos usados
    const itemsPrepago = carrito.filter(item => item.usarPrepago && item.producto.esRecarga)
    for (const item of itemsPrepago) {
      const litrosItem = item.producto.litros
      let recargasPendientes = item.cantidad
      // Find matching prepagos for this bottle type
      const matchingPrepagos = prepagos
        .filter((p: any) => p.cliente_id === clienteSeleccionado?.id
          && (parseInt(p.tipo_botellon || '') || 0) === litrosItem
          && (p.recargas_usadas ?? 0) < (p.recargas_compradas ?? 0))
      for (const p of matchingPrepagos) {
        if (recargasPendientes <= 0) break
        const disponibles = (p.recargas_compradas ?? 0) - (p.recargas_usadas ?? 0)
        const usar = Math.min(disponibles, recargasPendientes)
        const nuevoUsadas = (p.recargas_usadas ?? 0) + usar
        // Update locally in store
        const updatedPrepagos = store.prepagos.map((sp: any) =>
          sp.id === p.id ? { ...sp, recargas_usadas: nuevoUsadas } : sp
        )
        useAppStore.setState({ prepagos: updatedPrepagos })
        // Sync to Sheets
        updateRow('prepagos', p.id, { recargas_usadas: nuevoUsadas })
        recargasPendientes -= usar
      }
    }

    // 9.5 Registrar Deuda Post-Pago si aplica
    let vencimientoStr = ''
    if (metodoPago === 'post_pago' && clienteSeleccionado) {
        const ciclo = clienteSeleccionado.configPostpago?.ciclo || 7
        const vfechaObj = new Date(Date.now() + ciclo * 86400000)
        vencimientoStr = vfechaObj.toLocaleDateString('es-ES')
        const deuda = {
            id: crypto.randomUUID(),
            clienteId: clienteSeleccionado.id,
            clienteNombre: clienteSeleccionado.nombre,
            ventaId: venta.id,
            montoUsd: totalUsd,
            fechaVenta: new Date().toISOString(),
            fechaVencimiento: vfechaObj.toISOString(),
            ciclo: ciclo as 7 | 15 | 30,
            estado: 'pendiente' as const
        }
        store.agregarDeuda(deuda)
        store.actualizarCliente(clienteSeleccionado.id, { deudaTotalUsd: (clienteSeleccionado.deudaTotalUsd || 0) + totalUsd })
    }

    // 10. Preparar modal de éxito
    setUltimaVenta({
      orden: nuevoOrden,
      totalUsd,
      totalVes: usdToVes(totalUsd),
      metodo: metodoPago,
      vencimiento: vencimientoStr,
      // Datos del recibo
      items: [...carrito],
      vendedor: sesion?.nombre || 'Operador',
      cliente: clienteSeleccionado?.nombre || 'Cliente general',
      referencia: referenciaPagoMovil || undefined,
      tasaBcv: store.tasaBcv.valor,
      isDelivery,
      costoDelivery,
    })

    // 10. Limpiar carrito y estados
    setCarrito([])
    setClienteSeleccionado(null)
    setMetodoPago('')
    setIsDelivery(false)
    setBusquedaCliente('')
    setReferenciaPagoMovil('')
    setCostoDelivery(0)
    setShowDrawer(false)

    // 11. Mostrar éxito
    setShowExitoModal(true)
    showToast(`¡Venta registrada — $${totalUsd.toFixed(2)} USD`, 'success')
  }

  const limpiarTodo = () => {
    setCarrito([])
    setClienteSeleccionado(null)
    setBusquedaCliente('')
    setMetodoPago('')
    setIsDelivery(false)
    setReferenciaPagoMovil('')
    setCostoDelivery(0)
    setShowExitoModal(false)
    setShowDrawer(false)
  }

  /* ══════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="relative flex h-[calc(100vh-57px)] -m-6 overflow-hidden">
      {/* ──────────────────────── PANEL IZQUIERDO ─────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 pb-24 md:pb-6 bg-surface dark:bg-[#0f1117]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 md:mb-6 gap-4">
          <div className="hidden md:block">
            <h1 className="font-manrope text-2xl font-bold text-onSurface dark:text-[#e4e6f0]">Punto de Venta</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-inter mt-0.5">Agua Potable La Campiña — {config.nombreEstacion}</p>
          </div>
          {/* Toggles (Delivery / Etiquetas) */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-3 bg-white dark:bg-[#1e2235] rounded-xl px-4 py-2.5 shadow-sm border border-gray-100 dark:border-[#2d3148]">
              <span className="text-xs font-manrope font-bold text-gray-500 dark:text-gray-400 tracking-wider">¿ES DELIVERY?</span>
              <button
                onClick={() => setIsDelivery(!isDelivery)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                  isDelivery ? 'bg-primary' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
                    isDelivery ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
              {isDelivery && <Truck size={16} className="text-primary" />}
            </div>

            <div className={`flex items-center gap-3 bg-white dark:bg-[#1e2235] rounded-xl px-4 py-2.5 shadow-sm border border-gray-100 dark:border-[#2d3148] ${isDelivery ? 'opacity-50 pointer-events-none' : ''}`}>
              <span className="text-xs font-manrope font-bold text-gray-500 dark:text-gray-400 tracking-wider">INCLUIR ETIQUETAS</span>
              <button
                onClick={() => !isDelivery && setIncluirEtiquetas(!incluirEtiquetas)}
                disabled={isDelivery}
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                  (isDelivery || incluirEtiquetas) ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
                    (isDelivery || incluirEtiquetas) ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Grid de productos */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {productosList.map(p => (
            <button
              key={p.id}
              onClick={() => agregarAlCarrito(p)}
              className="bg-white dark:bg-[#1e2235] rounded-xl p-4 text-left cursor-pointer border-2 border-transparent
                hover:border-primary dark:hover:border-[#5bb3e8] hover:bg-[#f0f7ff] dark:hover:bg-[#1a1d27] transition-all duration-200 shadow-sm
                active:scale-[0.97] group"
            >
              <div className="font-inter font-bold text-sm text-onSurface dark:text-[#e4e6f0] mb-2 group-hover:text-primary dark:group-hover:text-[#5bb3e8] transition-colors">
                {p.nombre}
              </div>
              <div className="font-grotesk text-[22px] font-bold text-primary dark:text-[#5bb3e8] leading-tight">
                ${p.precio.toFixed(2)}
              </div>
              <div className="font-grotesk text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {usdToVes(p.precio)}
              </div>
              {p.esRecarga && (
                <div className="mt-2">
                  <span className="inline-block bg-blue-50 dark:bg-[#1a1d27] text-primary dark:text-[#5bb3e8] text-[10px] font-bold font-grotesk px-2 py-0.5 rounded-full tracking-wide">
                    {p.litros}L
                  </span>
                </div>
              )}
            </button>
          ))}

          {/* Card Entrada Manual */}
          <button
            onClick={() => setShowManualModal(true)}
            className="bg-white dark:bg-[#1e2235] rounded-xl p-4 text-left cursor-pointer border-2 border-dashed border-gray-200 dark:border-[#2d3148]
              hover:border-primary dark:hover:border-[#5bb3e8] hover:bg-[#f0f7ff] dark:hover:bg-[#1a1d27] transition-all duration-200 shadow-sm
              flex flex-col items-center justify-center gap-2 min-h-[120px]"
          >
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-[#1a1d27] flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20">
              <Plus size={20} className="text-gray-400 dark:text-gray-500" />
            </div>
            <span className="font-inter font-bold text-sm text-gray-400 dark:text-gray-500">Entrada Manual</span>
          </button>
        </div>

        {/* Cards de estado */}
        <div className="flex flex-col gap-4">
          {/* Card tanque */}
          <div className="bg-primary rounded-xl p-5 text-white shadow-md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-manrope font-bold text-base">Estado del Tanque Principal</h3>
              <span className="font-grotesk text-sm font-bold opacity-80">{tankPercent.toFixed(0)}% capacidad</span>
            </div>
            <div className="font-grotesk text-2xl font-bold mb-3">
              {litrosJumbo.toLocaleString('es-VE')} L <span className="text-sm font-normal opacity-70">disponibles</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${tankPercent}%` }}
              />
            </div>
          </div>

          {/* Card alerta inventario */}
          {showInventoryAlert && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠</span>
                <div>
                  <h3 className="font-manrope font-bold text-amber-800 dark:text-amber-500 text-base mb-1">Alerta de Inventario</h3>
                  <p className="text-amber-700 dark:text-amber-600 text-sm font-inter">
                    Stock bajo: {alertItems.join(' · ')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ──────────────────────── PANEL DERECHO (DESKTOP) ─────────────── */}
      <div className="hidden md:flex flex-col w-[380px] bg-white dark:bg-[#1e2235] border-l border-gray-100 dark:border-[#2d3148] flex-shrink-0 overflow-y-auto">
        <OrderPanel
          carrito={carrito}
          ordenNumero={nextOrdenNumero as any}
          busquedaCliente={busquedaCliente}
          setBusquedaCliente={setBusquedaCliente}
          clientesFilterResults={clientesFilterResults}
          clienteSeleccionado={clienteSeleccionado}
          setClienteSeleccionado={setClienteSeleccionado}
          clientePrepagosCount={clientePrepagosCount}
          clientePrepagosDetalle={clientePrepagosDetalle}
          clienteNivel={clienteNivel}
          onShowPrepago={() => setShowPrepago(true)}
          getPrepagoDisponibles={getPrepagoDisponibles}
          cambiarCantidad={cambiarCantidad}
          eliminarItem={eliminarItem}
          togglePrepago={togglePrepago}
          itemTienePrepago={itemTienePrepago}
          subtotalUsd={subtotalUsd}
          totalUsd={totalUsd}
          isDelivery={isDelivery}
          costoDelivery={costoDelivery}
          setCostoDelivery={setCostoDelivery}
          metodoPago={metodoPago}
          setMetodoPago={setMetodoPago}
          referenciaPagoMovil={referenciaPagoMovil}
          setReferenciaPagoMovil={setReferenciaPagoMovil}
          completarTransaccion={completarTransaccion}
          usdToVes={usdToVes}
        />
      </div>

      {/* ──────────────────────── BOTÓN FLOTANTE MÓVIL ────────────────── */}
      {!showDrawer && (
        <button
          onClick={() => setShowDrawer(true)}
          className="md:hidden fixed bottom-[60px] left-0 right-0 z-40
            text-white font-manrope font-bold text-base py-4 px-6
            flex items-center justify-center gap-3 shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
        >
          <ShoppingCart size={20} />
          Ver Carrito (${totalUsd.toFixed(2)})
          <ChevronUp size={18} />
        </button>
      )}

      {/* ──────────────────────── DRAWER MÓVIL ────────────────────────── */}
      {showDrawer && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col">
          <div className="flex-shrink-0 bg-black/50" onClick={() => setShowDrawer(false)} style={{ height: '60px' }} />
          <div className="flex-1 bg-white dark:bg-[#0f1117] rounded-t-2xl overflow-y-auto animate-slide-up shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-[#2d3148] sticky top-0 bg-white dark:bg-[#1e2235] z-10 rounded-t-2xl">
              <span className="font-manrope font-bold text-lg text-onSurface dark:text-[#e4e6f0]">Carrito</span>
              <button onClick={() => setShowDrawer(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-[#5bb3e8]">
                <X size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <OrderPanel
                carrito={carrito}
                ordenNumero={nextOrdenNumero as any}
                busquedaCliente={busquedaCliente}
                setBusquedaCliente={setBusquedaCliente}
                clientesFilterResults={clientesFilterResults}
                clienteSeleccionado={clienteSeleccionado}
                setClienteSeleccionado={setClienteSeleccionado}
                clientePrepagosCount={clientePrepagosCount}
                clientePrepagosDetalle={clientePrepagosDetalle}
                clienteNivel={clienteNivel}
                onShowPrepago={() => setShowPrepago(true)}
                getPrepagoDisponibles={getPrepagoDisponibles}
                cambiarCantidad={cambiarCantidad}
                eliminarItem={eliminarItem}
                togglePrepago={togglePrepago}
                itemTienePrepago={itemTienePrepago}
                subtotalUsd={subtotalUsd}
                totalUsd={totalUsd}
                isDelivery={isDelivery}
                costoDelivery={costoDelivery}
                setCostoDelivery={setCostoDelivery}
                metodoPago={metodoPago}
                setMetodoPago={setMetodoPago}
                referenciaPagoMovil={referenciaPagoMovil}
                setReferenciaPagoMovil={setReferenciaPagoMovil}
                completarTransaccion={completarTransaccion}
                usdToVes={usdToVes}
              />
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────── MODAL ENTRADA MANUAL ────────────────── */}
      {showManualModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowManualModal(false)} />
          <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-6 w-full max-w-sm shadow-2xl relative z-10 mx-4">
            <h2 className="font-manrope text-xl font-bold text-onSurface dark:text-[#e4e6f0] mb-5">Entrada Manual</h2>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">Nombre del producto</label>
                <input
                  type="text"
                  value={manualNombre}
                  onChange={e => setManualNombre(e.target.value)}
                  placeholder="Ej: Dispensador"
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-xl p-3 font-inter text-sm text-gray-800 dark:text-[#e4e6f0] outline-none
                    focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">Precio (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualPrecio}
                  onChange={e => setManualPrecio(e.target.value)}
                  placeholder="0.00"
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-xl p-3 font-grotesk text-lg font-bold text-primary dark:text-[#5bb3e8]
                    outline-none focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowManualModal(false)}
                className="flex-1 py-3 rounded-xl font-manrope font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2d3148] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={agregarManual}
                className="flex-1 py-3 rounded-xl font-manrope font-bold text-white shadow-md transition-colors"
                style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────── MODAL PREPAGO ─────────────────────────── */}
      {showPrepago && clienteSeleccionado && (() => {
        const precioNum = parseFloat(prepagoPrecio) || 0
        const totalPrepago = precioNum * prepagoCantidad
        return (
          <div className="absolute inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPrepago(false)} />
            <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-6 w-full max-w-md shadow-2xl relative z-10 mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-manrope text-xl font-bold text-onSurface dark:text-[#e4e6f0]">Registrar Prepago</h2>
                <button onClick={() => setShowPrepago(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-[#5bb3e8]">
                  <X size={20} />
                </button>
              </div>

              {/* Cliente */}
              <div className="bg-blue-50 dark:bg-[#1a1d27] rounded-xl px-4 py-2.5 mb-5 border border-blue-100 dark:border-[#2d3148]">
                <span className="font-inter font-bold text-sm text-primary dark:text-[#5bb3e8]">{clienteSeleccionado.nombre}</span>
              </div>

              {/* Tipo de botellón */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-2 font-manrope">Tipo de botellón</label>
                <div className="flex gap-2">
                  {tiposBotellonList.map(t => (
                    <button
                      key={t.litros}
                      onClick={() => {
                        setPrepagoTipoLitros(t.litros)
                        setPrepagoPrecio(t.precioDefault.toFixed(2))
                      }}
                      className={`flex-1 py-2.5 rounded-full text-sm font-manrope font-bold transition-all duration-200 ${
                        prepagoTipoLitros === t.litros
                          ? 'text-white shadow-md'
                          : 'bg-gray-100 dark:bg-[#1a1d27] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#2d3148]'
                      }`}
                      style={prepagoTipoLitros === t.litros ? { background: 'linear-gradient(135deg, #005e97, #0077be)' } : {}}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Precio por recarga */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-600 mb-1.5 font-manrope">Precio por recarga (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={prepagoPrecio}
                  onChange={e => setPrepagoPrecio(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 font-grotesk text-lg font-bold text-primary
                    outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Cantidad de recargas */}
              <div className="mb-5">
                <label className="block text-sm font-bold text-gray-600 mb-1.5 font-manrope">Cantidad de recargas</label>
                <input
                  type="number"
                  min="1"
                  value={prepagoCantidad}
                  onChange={e => setPrepagoCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 font-grotesk text-lg font-bold text-onSurface
                    outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Resumen */}
              <div className="bg-gray-50 dark:bg-[#1a1d27] rounded-xl p-4 mb-5 border border-gray-100 dark:border-[#2d3148]">
                <p className="text-xs font-manrope font-bold text-gray-400 dark:text-gray-500 tracking-wider mb-2">RESUMEN</p>
                <div className="font-inter text-sm text-gray-700 dark:text-[#e4e6f0] mb-1">
                  Total: <span className="font-bold">{prepagoCantidad}</span> recargas × <span className="font-grotesk font-bold text-primary dark:text-[#5bb3e8]">${precioNum.toFixed(2)}</span>
                </div>
                <div className="font-grotesk text-2xl font-bold text-onSurface dark:text-[#e4e6f0]">
                  ${totalPrepago.toFixed(2)} USD
                </div>
                <div className="font-grotesk text-sm text-gray-500 dark:text-gray-400">
                  {usdToVes(totalPrepago)}
                </div>
              </div>

              {/* Método de pago */}
              <div className="mb-5">
                <p className="text-xs font-manrope font-bold text-gray-400 tracking-wider mb-2.5">MÉTODO DE PAGO</p>
                <div className="grid grid-cols-2 gap-2">
                  {METODOS_PAGO_BASICOS.map(m => {
                    const isActive = prepagoMetodo === m.id
                    return (
                      <button
                        key={m.id}
                        onClick={() => setPrepagoMetodo(isActive ? '' : m.id)}
                        className={`rounded-xl px-3 py-2.5 text-left border-2 transition-all duration-200 flex items-center gap-2 cursor-pointer
                          ${isActive
                            ? 'border-primary dark:border-[#5bb3e8] bg-[#f0f7ff] dark:bg-[#1a1d27] '
                            : 'border-gray-100 dark:border-[#2d3148] bg-white dark:bg-[#1e2235] hover:border-gray-200 dark:hover:border-gray-600'
                          }`}
                      >
                        <m.icon size={14} className={isActive ? 'text-primary dark:text-[#5bb3e8]' : 'text-gray-400 dark:text-gray-500'} />
                        <span className={`text-[11px] font-manrope font-bold leading-tight ${
                          isActive ? 'text-primary dark:text-[#e4e6f0]' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {m.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPrepago(false)}
                  className="flex-1 py-3 rounded-xl font-manrope font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2d3148] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={registrarPrepago}
                  className="flex-1 py-3 rounded-xl font-manrope font-bold text-white shadow-md transition-colors"
                  style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
                >
                  Registrar Prepago
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ──────────────────────── MODAL ÉXITO ─────────────────────────── */}
      {showExitoModal && ultimaVenta && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.65)',
          }}
        >
          <div
            className="bg-white dark:bg-[#1e2235]"
            style={{ borderRadius: 16, padding: 32, maxWidth: 380, width: '90%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
          >
            {/* Checkmark */}
            <div style={{ width: 64, height: 64, background: '#16a34a', borderRadius: '50%', color: 'white', fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 'bold' }}>
              ✓
            </div>

            <div className="font-manrope text-[20px] font-bold text-[#1a1a2e] dark:text-[#e4e6f0] mb-1">¡Venta Registrada!</div>

            {ultimaVenta.metodo === 'post_pago' && (
              <div className="inline-block bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-manrope font-bold text-xs px-3 py-1 rounded-full mb-3">
                Cobro diferido — vence el {ultimaVenta.vencimiento}
              </div>
            )}

            <div className="font-inter text-sm text-[#9ca3af] dark:text-gray-400 mb-5">Orden #{ultimaVenta.orden}</div>
            <div className="font-grotesk text-2xl font-bold text-[#005e97] dark:text-[#5bb3e8] mb-0.5">${ultimaVenta.totalUsd.toFixed(2)}</div>
            <div className="font-grotesk text-sm text-[#9ca3af] dark:text-gray-400 mb-5">{ultimaVenta.totalVes}</div>

            <div className={`font-inter text-[13px] font-semibold mb-4 flex items-center justify-center gap-1.5 ${ventaSynced ? 'text-[#16a34a] dark:text-green-500' : 'text-[#d97706] dark:text-amber-500'}`}>
              {ventaSynced ? '✓ Guardado en Agua Potable La Campiña' : '○ Pendiente de sincronización'}
            </div>

            {/* Bug #7 — Imprimir (impresora térmica / PDF nativo) */}
            <button
              id="btn-imprimir-recibo"
              onClick={() => {
                const logoEl = document.querySelector('img[alt="logo"]') as HTMLImageElement | null
                imprimirRecibo({
                  numeroSerie: `APC-${String(ultimaVenta.orden).padStart(6, '0')}`,
                  fecha: new Date().toLocaleDateString('es-VE'),
                  hora: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
                  vendedor: ultimaVenta.vendedor || sesion?.nombre || 'Operador',
                  cliente: ultimaVenta.cliente || 'Cliente general',
                  items: ultimaVenta.items || [],
                  totalUsd: ultimaVenta.totalUsd,
                  totalVes: ultimaVenta.totalVes,
                  metodoPago: ultimaVenta.metodo,
                  referencia: ultimaVenta.referencia,
                  tasaBcv: ultimaVenta.tasaBcv || store.tasaBcv.valor,
                  negocio: 'Agua Potable La Campiña',
                  sucursal: config.nombreEstacion || 'Sucursal - Naguanagua',
                  isDelivery: ultimaVenta.isDelivery || false,
                  costoDelivery: ultimaVenta.costoDelivery || 0,
                }, logoEl?.src)
              }}
              className="w-full mb-2 py-2.5 rounded-xl font-manrope font-bold text-sm flex items-center justify-center gap-2
                bg-gray-50 dark:bg-[#1a1d27] text-gray-700 dark:text-gray-200
                border-2 border-gray-200 dark:border-[#2d3148] hover:border-primary dark:hover:border-[#5bb3e8]
                hover:text-primary dark:hover:text-[#5bb3e8] transition-all cursor-pointer"
            >
              🖨️ Imprimir Recibo
            </button>

            {/* Bug #7 — Guardar / Compartir como imagen (Web Share API en móvil, descarga en desktop) */}
            <button
              id="btn-guardar-recibo"
              onClick={async () => {
                const el = document.getElementById('recibo-preview-hidden')
                if (!el) return
                try {
                  const dataUrl = await toPng(el, { pixelRatio: 2 })
                  const nombreArchivo = `recibo-APC-${String(ultimaVenta.orden).padStart(6, '0')}.png`
                  if (navigator.canShare) {
                    const res = await fetch(dataUrl)
                    const blob = await res.blob()
                    const file = new File([blob], nombreArchivo, { type: 'image/png' })
                    if (navigator.canShare({ files: [file] })) {
                      await navigator.share({ files: [file], title: 'Recibo Agua Potable La Campiña' })
                      return
                    }
                  }
                  const a = document.createElement('a')
                  a.href = dataUrl
                  a.download = nombreArchivo
                  a.click()
                } catch (err) {
                  console.error('Error generando recibo:', err)
                }
              }}
              className="w-full mb-3 py-2.5 rounded-xl font-manrope font-bold text-sm flex items-center justify-center gap-2
                bg-blue-50 dark:bg-blue-900/20 text-primary dark:text-[#5bb3e8]
                border-2 border-blue-200 dark:border-[#2d3148] hover:bg-blue-100 dark:hover:bg-[#2d3148]
                transition-all cursor-pointer"
            >
              📲 Guardar / Compartir
            </button>

            {/* Acciones */}
            <div className="flex gap-3">
              <button
                onClick={limpiarTodo}
                className="flex-1 py-3 rounded-xl font-manrope font-bold text-[14px] text-primary dark:text-[#5bb3e8] bg-transparent border-2 border-primary dark:border-[#5bb3e8] cursor-pointer transition-colors hover:bg-[#f0f7ff] dark:hover:bg-[#1a1d27]"
              >
                Nueva Venta
              </button>
              <button
                onClick={() => { limpiarTodo(); navigate('/app') }}
                className="flex-1 py-3 rounded-xl font-manrope font-bold text-[14px] text-white bg-gradient-to-br from-[#005e97] to-[#0077be] border-none cursor-pointer hover:scale-[1.02] transition-transform shadow-[0_4px_14px_rgba(0,94,151,0.3)] dark:shadow-none"
              >
                Ver Dashboard
              </button>
            </div>
          </div>

          {/* Recibo oculto para html-to-image — se renderiza pero no se muestra en pantalla */}
          <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
            <div id="recibo-preview-hidden" style={{ background: '#fff', padding: '4px' }}>
              <ReciboTermico
                data={{
                  numeroSerie: `APC-${String(ultimaVenta.orden).padStart(6, '0')}`,
                  fecha: new Date().toLocaleDateString('es-VE'),
                  hora: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
                  vendedor: ultimaVenta.vendedor || sesion?.nombre || 'Operador',
                  cliente: ultimaVenta.cliente || 'Cliente general',
                  items: ultimaVenta.items || [],
                  totalUsd: ultimaVenta.totalUsd,
                  totalVes: ultimaVenta.totalVes,
                  metodoPago: ultimaVenta.metodo,
                  referencia: ultimaVenta.referencia,
                  tasaBcv: ultimaVenta.tasaBcv || store.tasaBcv.valor,
                  negocio: 'Agua Potable La Campiña',
                  sucursal: config.nombreEstacion || 'Sucursal - Naguanagua',
                  isDelivery: ultimaVenta.isDelivery || false,
                  costoDelivery: ultimaVenta.costoDelivery || 0,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────── TOAST NOTIFICATION ────────────────── */}
      <Toast toast={toast} />

      {/* Inline animation keyframes */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════
   ORDER PANEL SUB-COMPONENT
   ════════════════════════════════════════════════════════════════════════ */
interface OrderPanelProps {
  carrito: CarritoItem[]
  ordenNumero: string | number
  busquedaCliente: string
  setBusquedaCliente: (v: string) => void
  clientesFilterResults: any[]
  clienteSeleccionado: any
  setClienteSeleccionado: (c: any) => void
  clientePrepagosCount: number
  clientePrepagosDetalle: { tipo: string; qty: number }[]
  clienteNivel: { label: string; color: string; bg: string } | null
  onShowPrepago: () => void
  getPrepagoDisponibles: (item: CarritoItem) => number
  cambiarCantidad: (id: string, delta: number) => void
  eliminarItem: (id: string) => void
  togglePrepago: (id: string) => void
  itemTienePrepago: (item: CarritoItem) => boolean
  subtotalUsd: number
  totalUsd: number
  isDelivery: boolean
  costoDelivery: number
  setCostoDelivery: (n: number) => void
  metodoPago: MetodoPago | ''
  setMetodoPago: (m: MetodoPago | '') => void
  referenciaPagoMovil: string
  setReferenciaPagoMovil: (v: string) => void
  completarTransaccion: () => void
  usdToVes: (n: number) => string
}

function OrderPanel({
  carrito, ordenNumero, busquedaCliente, setBusquedaCliente,
  clientesFilterResults, clienteSeleccionado, setClienteSeleccionado,
  clientePrepagosCount, clientePrepagosDetalle, clienteNivel,
  onShowPrepago, getPrepagoDisponibles,
  cambiarCantidad, eliminarItem, togglePrepago,
  itemTienePrepago, subtotalUsd, totalUsd, isDelivery, costoDelivery,
  setCostoDelivery, metodoPago, setMetodoPago, referenciaPagoMovil,
  setReferenciaPagoMovil, completarTransaccion, usdToVes,
}: OrderPanelProps) {
  const canComplete = carrito.length > 0 && metodoPago !== ''
  const prepagoDisponible = clientePrepagosCount > 0

  return (
    <div className="flex flex-col p-5 gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-manrope text-lg font-bold text-onSurface dark:text-[#e4e6f0]">Orden Actual</h2>
        <span className="bg-gray-100 dark:bg-[#1a1d27] text-gray-500 dark:text-gray-400 text-xs font-grotesk font-bold px-2.5 py-1 rounded-lg tracking-wider">
          ORDEN #{ordenNumero}
        </span>
      </div>

      {/* Buscador de cliente */}
      <div className="relative">
        {clienteSeleccionado ? (
          <div>
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-[#1a1d27] border border-blue-100 dark:border-[#2d3148] rounded-xl px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-inter font-bold text-sm text-primary dark:text-[#5bb3e8] truncate">
                    {clienteSeleccionado.nombre}
                  </span>
                  {clienteNivel && (
                    <span className="text-[9px] font-bold font-grotesk px-1.5 py-0.5 rounded-full"
                      style={{ color: clienteNivel.color, background: clienteNivel.bg }}>
                      {clienteNivel.label}
                    </span>
                  )}
                </div>
              </div>
              {/* Botón + Prepago */}
              <button
                onClick={onShowPrepago}
                className="text-[11px] font-manrope font-bold text-primary dark:text-[#5bb3e8] bg-white dark:bg-[#1e2235] border border-blue-200 dark:border-[#2d3148] rounded-lg px-2 py-1
                  hover:bg-blue-100 dark:hover:bg-[#2d3148] transition-colors flex items-center gap-1 flex-shrink-0"
              >
                <Plus size={12} /> Prepago
              </button>
              <button
                onClick={() => { setClienteSeleccionado(null); setBusquedaCliente('') }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>
            {/* Badges debajo del chip */}
            {(clientePrepagosDetalle.length > 0 || (clienteSeleccionado.saldo_usd && parseFloat(clienteSeleccionado.saldo_usd) > 0)) && (
              <div className="flex flex-wrap gap-1.5 mt-2 px-1">
                {clientePrepagosDetalle.map(d => (
                  <span key={d.tipo} className="text-[10px] font-bold font-grotesk px-2 py-0.5 rounded-full text-white"
                    style={{ background: '#16a34a' }}>
                    PREPAGO: {d.qty} recargas de {d.tipo}
                  </span>
                ))}
                {clienteSeleccionado.saldo_usd && parseFloat(clienteSeleccionado.saldo_usd) > 0 && (
                  <span className="text-[10px] font-bold font-grotesk px-2 py-0.5 rounded-full text-white"
                    style={{ background: '#005e97' }}>
                    SALDO: ${parseFloat(clienteSeleccionado.saldo_usd).toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={busquedaCliente}
                onChange={e => setBusquedaCliente(e.target.value)}
                placeholder="Buscar cliente por nombre o teléfono..."
                className="w-full border-2 border-gray-100 dark:border-[#2d3148] rounded-xl pl-10 pr-4 py-3 text-sm font-inter outline-none
                  focus:border-primary dark:focus:border-[#5bb3e8] transition-colors bg-gray-50 dark:bg-[#1a1d27] focus:bg-white dark:focus:bg-[#1e2235]
                  text-gray-800 dark:text-[#e4e6f0]"
              />
            </div>
            {clientesFilterResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1e2235] rounded-xl shadow-lg border border-gray-100 dark:border-[#2d3148] z-20 overflow-hidden outline-none">
                {clientesFilterResults.filter(Boolean).map((c: any) => (
                  <button
                    key={c.id || Math.random()}
                    onClick={() => { setClienteSeleccionado(c); setBusquedaCliente('') }}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-[#1a1d27] transition-colors border-b border-gray-50 dark:border-[#2d3148] last:border-0"
                  >
                    <span className="font-inter font-bold text-sm text-gray-800 dark:text-[#e4e6f0] block">{c.nombre}</span>
                    {c.telefono && <span className="font-grotesk text-xs text-gray-400 dark:text-gray-500">{c.telefono}</span>}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Lista de ítems del carrito */}
      <div className="flex-1 min-h-0">
        {carrito.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-300 dark:text-gray-600">
            <ShoppingCart size={40} className="mb-3" />
            <p className="font-inter text-sm text-gray-400 dark:text-gray-500">Carrito vacío</p>
          </div>
        ) : (
          <div className="space-y-3">
            {carrito.map(item => {
              const precioUnitario = item.usarPrepago ? 0 : item.producto.precio
              const precioTotal = precioUnitario * item.cantidad
              const hasPrepago = itemTienePrepago(item)
              return (
                <div
                  key={item.producto.id}
                  className="bg-gray-50 dark:bg-[#1a1d27] rounded-xl p-3.5 border border-gray-100 dark:border-[#2d3148]"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-inter font-bold text-sm text-onSurface dark:text-[#e4e6f0] truncate">
                          {item.producto.nombre}
                        </span>
                        {item.usarPrepago && (
                          <span className="text-[9px] font-bold font-grotesk px-1.5 py-0.5 rounded-full bg-blue-100 text-primary">
                            PREPAGO
                          </span>
                        )}
                      </div>
                      <span className="font-grotesk text-xs text-gray-400 dark:text-gray-500">
                        ${item.producto.precio.toFixed(2)} c/u
                      </span>
                    </div>
                    <button
                      onClick={() => eliminarItem(item.producto.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors ml-2"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => cambiarCantidad(item.producto.id, -1)}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-[#1e2235] border border-gray-200 dark:border-[#2d3148] flex items-center justify-center
                          hover:border-primary dark:hover:border-[#5bb3e8] hover:text-primary dark:hover:text-[#5bb3e8] transition-colors dark:text-[#e4e6f0]"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="font-grotesk font-bold text-sm w-6 text-center text-onSurface dark:text-[#e4e6f0]">{item.cantidad}</span>
                      <button
                        onClick={() => cambiarCantidad(item.producto.id, 1)}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-[#1e2235] border border-gray-200 dark:border-[#2d3148] flex items-center justify-center
                          hover:border-primary dark:hover:border-[#5bb3e8] hover:text-primary dark:hover:text-[#5bb3e8] transition-colors dark:text-[#e4e6f0]"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className={`font-grotesk font-bold text-base ${item.usarPrepago ? 'text-green-600 dark:text-green-500' : 'text-onSurface dark:text-[#e4e6f0]'}`}>
                      ${precioTotal.toFixed(2)}
                    </span>
                  </div>
                  {/* Toggle prepago */}
                  {hasPrepago && (
                    <button
                      onClick={() => togglePrepago(item.producto.id)}
                      className={`mt-2 w-full text-center text-xs font-bold font-manrope py-1.5 rounded-lg transition-colors ${
                        item.usarPrepago
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-[#1e2235] text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-[#2d3148] hover:text-primary dark:hover:text-[#5bb3e8] border border-transparent dark:border-[#2d3148]'
                      }`}
                    >
                      {item.usarPrepago
                        ? '✓ Prepago aplicado'
                        : `Usar prepago (${getPrepagoDisponibles(item)} disponibles)`}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Separador */}
      <div className="border-t border-gray-100 dark:border-[#2d3148]" />

      {/* Totales */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm font-inter">
          <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
          <span className="font-grotesk font-bold text-gray-700 dark:text-[#e4e6f0]">${subtotalUsd.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-sm font-inter">
          <span className="text-gray-500 dark:text-gray-400">Costo de Envío</span>
          {isDelivery ? (
            <input
              type="number"
              min="0"
              step="0.5"
              value={costoDelivery}
              onChange={e => setCostoDelivery(parseFloat(e.target.value) || 0)}
              className="w-20 text-right border border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-lg px-2 py-1 font-grotesk font-bold text-sm
                outline-none focus:border-primary dark:focus:border-[#5bb3e8] text-gray-800 dark:text-[#e4e6f0]"
            />
          ) : (
            <span className="font-inter font-bold text-green-600 dark:text-green-500 text-sm">Gratis</span>
          )}
        </div>
        <div className="border-t border-gray-200 dark:border-[#2d3148] pt-3 mt-3">
          <div className="flex justify-between items-baseline mb-1">
            <span className="font-manrope font-bold text-base text-gray-600 dark:text-gray-300">TOTAL A PAGAR</span>
          </div>
          <div className="font-grotesk text-[28px] font-bold text-onSurface dark:text-[#e4e6f0] leading-tight">
            ${totalUsd.toFixed(2)}
          </div>
          <div className="font-grotesk text-base text-primary dark:text-[#5bb3e8] font-medium">
            {usdToVes(totalUsd)}
          </div>
        </div>
      </div>

      {/* Métodos de pago */}
      <div>
        <p className="text-xs font-manrope font-bold text-gray-400 dark:text-gray-500 tracking-wider mb-2.5">MÉTODO DE PAGO</p>
        <div className="grid grid-cols-2 gap-2">
          {METODOS_PAGO.map(m => {
            const isDisabled = (m.id === 'prepago_cliente' && !prepagoDisponible) || (m.id === 'post_pago' && !clienteSeleccionado?.esPostpago)
            const isActive = metodoPago === m.id
            return (
              <button
                key={m.id}
                disabled={isDisabled}
                onClick={() => setMetodoPago(isActive ? '' : m.id)}
                title={m.id === 'post_pago' && isDisabled ? "Este cliente no tiene crédito habilitado" : ""}
                className={`rounded-xl px-3 py-2.5 text-left border-2 transition-all duration-200 flex items-center gap-2
                  ${isActive
                    ? 'border-primary dark:border-[#5bb3e8] bg-[#f0f7ff] dark:bg-[#1a1d27]/80'
                    : 'border-gray-100 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] hover:border-gray-200 dark:hover:border-gray-600'
                  }
                  ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <m.icon size={14} className={isActive ? 'text-primary dark:text-[#5bb3e8]' : 'text-gray-400 dark:text-gray-500'} />
                <span className={`text-[11px] font-manrope font-bold leading-tight ${
                  isActive ? 'text-primary dark:text-[#5bb3e8]' : 'text-gray-500 dark:text-[#e4e6f0]'
                }`}>
                  {m.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Pago móvil: referencia */}
        {metodoPago === 'pago_movil' && (
          <input
            type="text"
            value={referenciaPagoMovil}
            onChange={e => setReferenciaPagoMovil(e.target.value)}
            placeholder="Referencia (opcional)"
            className="w-full mt-3 border-2 border-gray-100 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] text-gray-800 dark:text-[#e4e6f0] rounded-xl px-4 py-2.5 text-sm font-grotesk outline-none
              focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
          />
        )}

        {/* Pago mixto: inputs */}
        {metodoPago === 'pago_mixto' && (
          <div className="mt-3 space-y-2">
            <p className="text-[10px] font-manrope font-bold text-gray-400 dark:text-gray-500 tracking-wider">DISTRIBUCIÓN DEL PAGO</p>
            {['Efectivo USD', 'Pago Móvil', 'Punto de Venta', 'Efectivo VES'].map(label => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs font-inter text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">{label}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="flex-1 border border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] text-gray-800 dark:text-[#e4e6f0] rounded-lg px-3 py-1.5 text-sm font-grotesk font-bold outline-none
                    focus:border-primary dark:focus:border-[#5bb3e8] transition-colors"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Botón completar */}
      <button
        disabled={!canComplete}
        onClick={completarTransaccion}
        className={`w-full h-14 rounded-xl font-manrope font-bold text-base text-white
          transition-all duration-300 shadow-lg
          ${canComplete
            ? 'hover:shadow-xl hover:scale-[1.01] active:scale-[0.99]'
            : 'opacity-40 cursor-not-allowed'
          }`}
        style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
      >
        COMPLETAR TRANSACCIÓN
      </button>
    </div>
  )
}