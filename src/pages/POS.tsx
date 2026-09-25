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
  Truck, CreditCard, Smartphone, Banknote, Wallet, Users, ChevronUp, Clock, Gift
} from 'lucide-react'
import { getLocalDateString } from '../lib/dateUtils'
import { expandirLineasRecibo, subtotalCarritoUsd } from '../lib/carritoUtils'
import ImagenProducto from '../components/ImagenProducto'

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
  /** Servicio de desinfección: incluye la recarga en el precio.
      Descuenta agua, y ademas tapa y precinto en 19L y 12L.
      El precio es LIBRE: se indica en cada venta. */
  esDesinfeccion?: boolean
}

interface CarritoItem {
  producto: Producto
  cantidad: number
  /** Unidades de esta línea cubiertas por recargas prepagadas (0 … cantidad) */
  cantidadPrepago: number
}

/* Orden de presentacion en el grid del POS (3 columnas).
   Los IDs NO cambian: se conservan p1..p13 para no romper el historico
   de ventas ni la asociacion con las fotos /productos/{id}.webp
     Fila 1: Recarga 19L      | Recarga 12L          | Recarga 8L
     Fila 2: Recarga 5L       | Botellon Nuevo 19L   | Botellon Nuevo 12L
     Fila 3: Botellon Nuevo 5L| Bolsa de Hielo       | Helado
     Fila 4: Tapas Reusables  | Agarraderos Manuales | Dispensador de Agua
     Fila 5: Cepillos de Lavado | Entrada Manual                          */
const PRODUCTOS_DEFAULT_POS: Producto[] = [
  { id: 'p1',  nombre: 'Recarga 19L',        precio: 0.80, litros: 19, esRecarga: true },
  { id: 'p2',  nombre: 'Recarga 12L',        precio: 0.75, litros: 12, esRecarga: true },
  { id: 'p3',  nombre: 'Recarga 8L',         precio: 0.60, litros: 8,  esRecarga: true },
  { id: 'p4',  nombre: 'Recarga 5L',         precio: 0.50, litros: 5,  esRecarga: true },
  { id: 'p5',  nombre: 'Botellón Nuevo 19L', precio: 8.00, litros: 0,  esRecarga: false },
  { id: 'p8',  nombre: 'Botellón Nuevo 12L', precio: 0,    litros: 0,  esRecarga: false },
  { id: 'p9',  nombre: 'Botellón Nuevo 5L',  precio: 0,    litros: 0,  esRecarga: false },
  { id: 'p6',  nombre: 'Bolsa de Hielo',     precio: 2.00, litros: 0,  esRecarga: false },
  { id: 'p7',  nombre: 'Helado',             precio: 3.50, litros: 0,  esRecarga: false },
  { id: 'p10', nombre: 'Tapas Reusables',    precio: 0,    litros: 0,  esRecarga: false },
  { id: 'p12', nombre: 'Agarraderos Manuales', precio: 0,  litros: 0,  esRecarga: false },
  { id: 'p11', nombre: 'Dispensador de Agua', precio: 0,   litros: 0,  esRecarga: false },
  { id: 'p13', nombre: 'Cepillos de Lavado', precio: 0,    litros: 0,  esRecarga: false },
  // Desinfección: la recarga va incluida en el precio del servicio
  { id: 'p14', nombre: 'Desinfección 19L',   precio: 0,    litros: 19, esRecarga: false, esDesinfeccion: true },
  { id: 'p15', nombre: 'Desinfección 12L',   precio: 0,    litros: 12, esRecarga: false, esDesinfeccion: true },
  { id: 'p16', nombre: 'Desinfección 8L',    precio: 0,    litros: 8,  esRecarga: false, esDesinfeccion: true },
]

const TIPOS_BOTELLON_DEFAULT = [
  { litros: 19, label: '19L', precioDefault: 0.80 },
  { litros: 12, label: '12L', precioDefault: 0.75 },
  { litros: 8,  label: '8L',  precioDefault: 0.60 },
  { litros: 5,  label: '5L',  precioDefault: 0.50 },
]

type MetodoPago = 'efectivo_usd' | 'pago_movil' | 'punto_venta' | 'efectivo_ves' | 'prepago_cliente' | 'pago_mixto' | 'post_pago' | 'cortesia'

const METODOS_PAGO: { id: MetodoPago; label: string; icon: typeof Banknote }[] = [
  { id: 'efectivo_usd',   label: 'EFECTIVO USD',    icon: Banknote },
  { id: 'pago_movil',     label: 'PAGO MÓVIL',      icon: Smartphone },
  { id: 'punto_venta',    label: 'PUNTO DE VENTA',   icon: CreditCard },
  { id: 'efectivo_ves',   label: 'EFECTIVO VES',     icon: Wallet },
  { id: 'prepago_cliente', label: 'PREPAGO CLIENTE', icon: Users },
  { id: 'post_pago',      label: 'POST-PAGO / CRÉDITO', icon: Clock },
  { id: 'pago_mixto',     label: 'PAGO MIXTO',       icon: ShoppingCart },
  { id: 'cortesia',       label: 'CORTESÍA / DONACIÓN', icon: Gift },
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
  cortesia:        'Cortesía / Donación',
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
  const subtotal = subtotalCarritoUsd(data.items)
  const lineasRecibo = expandirLineasRecibo(data.items)

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
      {lineasRecibo.map((linea, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
          <span style={{ flex: 2, whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '28mm' }}>
            {linea.nombre}
          </span>
          <span style={{ flex: 1, textAlign: 'center' }}>{linea.cantidad}</span>
          <span style={{ flex: 1, textAlign: 'right' }}>${linea.precioUnit.toFixed(2)}</span>
          <span style={{ flex: 1, textAlign: 'right' }}>${linea.total.toFixed(2)}</span>
        </div>
      ))}
      {lineasRecibo.some(l => l.esPrepago) && (
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
    ${expandirLineasRecibo(data.items).map(linea => {
      return `<div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:2px">
        <span style="flex:2;overflow:hidden;max-width:28mm">${linea.nombre}</span>
        <span style="flex:1;text-align:center">${linea.cantidad}</span>
        <span style="flex:1;text-align:right">$${linea.precioUnit.toFixed(2)}</span>
        <span style="flex:1;text-align:right">$${linea.total.toFixed(2)}</span>
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
  const { usdToVes, tapas, precintos, clientes, prepagos } = store
  const config = useConfig()
  const sesion = useAuthStore(s => s.sesion)

  // ── Local state ─────────────────────────────────────────────────
  const [carrito, setCarrito] = useState<CarritoItem[]>([])
  const [isDelivery, setIsDelivery] = useState(false)
  const [costoDelivery, setCostoDelivery] = useState(0)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [metodoPago, setMetodoPago] = useState<MetodoPago | ''>('')
  const [referenciaPagoMovil, setReferenciaPagoMovil] = useState('')
  /** Motivo de la cortesia. Opcional, pero queda registrado en la venta
      para que toda salida de inventario sin cobro sea trazable. */
  const [motivoCortesia, setMotivoCortesia] = useState('')
  /** Desinfección: el precio es libre y se indica al agregarla al carrito */
  const [desinfeccionPendiente, setDesinfeccionPendiente] = useState<Producto | null>(null)
  const [desinfeccionPrecio, setDesinfeccionPrecio] = useState('')
  /** Evita repetir el aviso de recarga redundante en el segundo intento */
  const [confirmoRecargaExtra, setConfirmoRecargaExtra] = useState(false)
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
  /** Precio del delivery por botellón en el prepago. Vacío o 0 = sin delivery.
      Los deliveries se cuentan aparte de las recargas: si el cliente busca
      su botellón, gasta recarga pero no delivery. */
  const [prepagoDeliveryPrecio, setPrepagoDeliveryPrecio] = useState('')

  // ── Saldo a favor: modal y aplicacion en el cobro ─────────────
  const [showSaldoFavor, setShowSaldoFavor] = useState(false)
  const [showCompensarDeuda, setShowCompensarDeuda] = useState(false)
  const [saldoFavorMonto, setSaldoFavorMonto] = useState('')
  const [saldoFavorMetodo, setSaldoFavorMetodo] = useState<MetodoPago | ''>('')
  /** USD del saldo a favor que se aplican a la venta en curso */
  const [saldoAplicado, setSaldoAplicado] = useState(0)
  /** Monto que el cliente entrega (para calcular el vuelto) */
  const [montoRecibido, setMontoRecibido] = useState('')
  /** Bolivares realmente recibidos cuando el pago es en Bs.
      Se guarda tal cual, sin recalcular: la tasa cambia durante el dia
      y el arqueo debe cuadrar con los billetes, no con una conversion. */
  const [montoRecibidoVes, setMontoRecibidoVes] = useState('')
  /** Vuelto de la venta que el cliente decide dejar a favor */
  const [guardarVuelto, setGuardarVuelto] = useState(false)

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
      // Solo se cobran las unidades NO cubiertas por prepago
      const pagadas = Math.max(0, item.cantidad - item.cantidadPrepago)
      return sum + item.producto.precio * pagadas
    }, 0)
  , [carrito])

  const totalUsd = subtotalUsd + (isDelivery ? costoDelivery : 0)

  // Saldo a favor disponible del cliente seleccionado
  const saldoDisponible = clienteSeleccionado
    ? Math.max(0, parseFloat(clienteSeleccionado.saldo_usd) || 0)
    : 0
  /* ── Resumen de saldos del cliente, agrupado por litraje ──────────
     Recargas y deliveries son contadores INDEPENDIENTES: si el cliente
     busca su botellón gasta recarga pero no delivery, y ese delivery
     le queda disponible (convertible a saldo a favor). */
  const resumenSaldos = useMemo(() => {
    if (!clienteSeleccionado) return { lineas: [] as any[], deliveriesSueltos: 0, valorDeliveriesSueltos: 0 }
    const porLitraje: Record<number, any> = {}
    let deliveriesSueltos = 0
    let valorDeliveriesSueltos = 0

    for (const p of clientePrepagos) {
      const litros = parseInt(p.tipo_botellon || '') || 0
      if (!litros) continue
      const recargas = Math.max(0, (p.recargas_compradas ?? 0) - (p.recargas_usadas ?? 0))
      const deliveries = Math.max(0, (p.deliveries_comprados ?? 0) - (p.deliveries_usados ?? 0))
      if (recargas <= 0 && deliveries <= 0) continue

      if (!porLitraje[litros]) porLitraje[litros] = { litros, conDelivery: 0, sinDelivery: 0 }
      // Las recargas que tienen delivery reservado van a "con delivery"
      const conDeliv = Math.min(recargas, deliveries)
      porLitraje[litros].conDelivery += conDeliv
      porLitraje[litros].sinDelivery += recargas - conDeliv

      // Deliveries que sobran sin recarga que los acompañe
      const sobrantes = Math.max(0, deliveries - recargas)
      if (sobrantes > 0) {
        deliveriesSueltos += sobrantes
        valorDeliveriesSueltos += sobrantes * (parseFloat(p.precio_delivery_usd) || 0)
      }
    }
    const lineas = Object.values(porLitraje).sort((a: any, b: any) => b.litros - a.litros)
    return { lineas, deliveriesSueltos, valorDeliveriesSueltos: parseFloat(valorDeliveriesSueltos.toFixed(2)) }
  }, [clienteSeleccionado?.id, clientePrepagos])

  // Deuda pendiente del cliente seleccionado
  const deudaCliente = clienteSeleccionado
    ? Math.max(0, parseFloat(clienteSeleccionado.deudaTotalUsd) || 0)
    : 0
  // El cliente tiene saldo Y deuda a la vez: hay que preguntarle
  // si quiere usar uno para cancelar el otro.
  const hayDeudaCompensable = saldoDisponible > 0 && deudaCliente > 0
  // Cuanto de la deuda se puede cubrir con el saldo actual
  const deudaCubrible = Math.min(saldoDisponible, deudaCliente)

  // En una cortesia el producto se entrega sin cobrar nada
  const esCortesia = metodoPago === 'cortesia'
  // Total a cobrar despues de aplicar el saldo a favor
  const totalACobrar = esCortesia ? 0 : Math.max(0, totalUsd - saldoAplicado)
  // Vuelto: solo tiene sentido si el cliente entrego mas de lo que debe
  const vueltoDisponible = (() => {
    const recibido = parseFloat(montoRecibido) || 0
    return recibido > totalACobrar ? recibido - totalACobrar : 0
  })()


  // ── Alerta de inventario: dos niveles ─────────────────────────
  //   AVISO   (ambar)  : por debajo de 500 unidades
  //   CRITICO (rojo)   : 200 unidades o menos -> la tarjeta parpadea
  //                      hasta que se reponga el inventario
  const UMBRAL_AVISO = 500
  const UMBRAL_CRITICO = 200

  const showInventoryAlert = tapas < UMBRAL_AVISO || precintos < UMBRAL_AVISO

  const criticoItems: string[] = []
  const avisoItems: string[] = []
  if (tapas <= UMBRAL_CRITICO) criticoItems.push(`Tapas: ${tapas}`)
  else if (tapas < UMBRAL_AVISO) avisoItems.push(`Tapas: ${tapas}`)
  if (precintos <= UMBRAL_CRITICO) criticoItems.push(`Precintos: ${precintos}`)
  else if (precintos < UMBRAL_AVISO) avisoItems.push(`Precintos: ${precintos}`)

  const hayCritico = criticoItems.length > 0

  // ── Handlers ───────────────────────────────────────────────────
  /** Confirma el precio libre de una desinfección y la agrega al carrito */
  const confirmarDesinfeccion = () => {
    if (!desinfeccionPendiente) return
    const precio = parseFloat(desinfeccionPrecio) || 0
    if (precio <= 0) {
      showToast('Indica el precio de la desinfección', 'error')
      return
    }
    agregarAlCarrito({ ...desinfeccionPendiente, precio })
    setDesinfeccionPendiente(null)
    setDesinfeccionPrecio('')
  }

  /** Punto de entrada del grid: la desinfección pide precio antes de entrar */
  const seleccionarProducto = (producto: Producto) => {
    if (producto.esDesinfeccion) {
      setDesinfeccionPendiente(producto)
      setDesinfeccionPrecio(producto.precio > 0 ? String(producto.precio) : '')
      return
    }
    agregarAlCarrito(producto)
  }

  const agregarAlCarrito = (producto: Producto) => {
    setCarrito(prev => {
      // Cada desinfección lleva su propio precio: nunca se agrupa con otra
      if (producto.esDesinfeccion) {
        return [...prev, {
          producto: { ...producto, id: `${producto.id}#${Date.now()}` },
          cantidad: 1,
          cantidadPrepago: 0,
        }]
      }
      const existente = prev.find(i => i.producto.id === producto.id)
      if (existente) {
        return prev.map(i =>
          i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      }
      return [...prev, { producto, cantidad: 1, cantidadPrepago: 0 }]
    })
  }

  const cambiarCantidad = (productoId: string, delta: number) => {
    setCarrito(prev =>
      prev.map(i => {
        if (i.producto.id !== productoId) return i
        const nuevaCantidad = Math.max(1, i.cantidad + delta)
        // El prepago nunca puede superar la cantidad de la línea
        return {
          ...i,
          cantidad: nuevaCantidad,
          cantidadPrepago: Math.min(i.cantidadPrepago, nuevaCantidad),
        }
      })
    )
  }

  const eliminarItem = (productoId: string) => {
    setCarrito(prev => prev.filter(i => i.producto.id !== productoId))
  }

  const aplicarPrepago = (productoId: string) => {
    setCarrito(prev =>
      prev.map(i => {
        if (i.producto.id !== productoId) return i

        // Desactivar: vuelve a cobrarse la línea completa
        if (i.cantidadPrepago > 0) return { ...i, cantidadPrepago: 0 }

        const disponibles = getPrepagoDisponibles(i)
        if (disponibles <= 0) {
          showToast('El cliente no tiene recargas prepagadas de este tipo', 'error')
          return i
        }

        // Cubre hasta donde alcance — el resto se cobra normal
        const cubiertas = Math.min(i.cantidad, disponibles)
        if (cubiertas < i.cantidad) {
          showToast(
            `${cubiertas} recarga(s) con prepago · ${i.cantidad - cubiertas} se cobran normal`,
            'warning'
          )
        }
        return { ...i, cantidadPrepago: cubiertas }
      })
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

  // Si cambia el carrito, volver a avisar sobre recargas redundantes
  useEffect(() => { setConfirmoRecargaExtra(false) }, [carrito.length])

  // Al cambiar de cliente, el saldo aplicado deja de ser válido
  useEffect(() => {
    setSaldoAplicado(0)
    setGuardarVuelto(false)
  }, [clienteSeleccionado?.id])

  // Avisar cuando el cliente tiene saldo a favor Y deuda pendiente,
  // para que el vendedor pueda preguntarle si desea compensarlos.
  useEffect(() => {
    if (!clienteSeleccionado) return
    const saldo = Math.max(0, parseFloat(clienteSeleccionado.saldo_usd) || 0)
    const deuda = Math.max(0, parseFloat(clienteSeleccionado.deudaTotalUsd) || 0)
    if (saldo > 0 && deuda > 0) {
      showToast(
        `${clienteSeleccionado.nombre} tiene $${saldo.toFixed(2)} a favor y una deuda de $${deuda.toFixed(2)} — pregúntale si desea usarlo para pagarla`,
        'warning'
      )
    }
  }, [clienteSeleccionado?.id])

  // Al cambiar de cliente, el prepago marcado deja de ser válido
  useEffect(() => {
    setCarrito(prev =>
      prev.some(i => i.cantidadPrepago > 0)
        ? prev.map(i => (i.cantidadPrepago > 0 ? { ...i, cantidadPrepago: 0 } : i))
        : prev
    )
  }, [clienteSeleccionado?.id])

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

  // ── Saldo a favor ──────────────────────────────────────────────
  /** Aplica el saldo del cliente a la venta en curso (o lo retira) */
  const toggleAplicarSaldo = () => {
    if (saldoAplicado > 0) { setSaldoAplicado(0); return }
    if (!clienteSeleccionado) {
      showToast('Selecciona un cliente primero', 'error'); return
    }
    if (saldoDisponible <= 0) {
      showToast('Este cliente no tiene saldo a favor', 'error'); return
    }
    if (totalUsd <= 0) {
      showToast('Agrega productos al carrito primero', 'error'); return
    }
    // Se aplica hasta donde alcance: nunca mas que el total ni que el saldo
    const aplicar = Math.min(saldoDisponible, totalUsd)
    setSaldoAplicado(aplicar)
    if (aplicar < totalUsd) {
      showToast(`Saldo aplicado: ${aplicar.toFixed(2)} · Restan ${(totalUsd - aplicar).toFixed(2)} por cobrar`, 'warning')
    } else {
      showToast(`Saldo aplicado: ${aplicar.toFixed(2)} — venta cubierta`, 'success')
    }
  }

  /** Aplica el saldo a favor del cliente a sus deudas pendientes */
  const compensarDeudaConSaldo = async () => {
    if (!clienteSeleccionado) return

    // Releer del store: el saldo pudo cambiar desde otra caja
    const clienteActual = store.clientes.find((c: any) => c.id === clienteSeleccionado.id)
    const saldoActual = Math.max(0, parseFloat(clienteActual?.saldo_usd) || 0)
    if (saldoActual <= 0) {
      showToast('El cliente ya no tiene saldo a favor', 'error')
      setShowCompensarDeuda(false)
      return
    }

    // Deudas pendientes, de la mas antigua a la mas reciente
    const pendientes = store.getDeudasCliente(clienteSeleccionado.id)
      .filter((d: any) => d.estado === 'pendiente')
      .sort((a: any, b: any) => String(a.fechaVencimiento).localeCompare(String(b.fechaVencimiento)))

    if (pendientes.length === 0) {
      showToast('Este cliente no tiene deudas pendientes', 'error')
      setShowCompensarDeuda(false)
      return
    }

    let restante = saldoActual
    let saldadas = 0
    let abonadas = 0
    let totalAplicado = 0

    // Se abona de la mas antigua a la mas reciente. Si el saldo no cubre
    // una deuda completa, se abona parcialmente y esa deuda sigue
    // pendiente con el resto.
    for (const d of pendientes) {
      if (restante <= 0.001) break
      const total = Math.max(0, Number(d.montoUsd) || 0)
      const yaPagado = Math.max(0, Number(d.montoPagadoUsd) || 0)
      const pendiente = Math.max(0, total - yaPagado)
      if (pendiente <= 0) continue

      const aAplicar = Math.min(restante, pendiente)
      const aplicado = await store.abonarDeuda(
        d.id, aAplicar, 'SALDO A FAVOR', 'Aplicado desde saldo a favor del cliente'
      )
      if (aplicado <= 0) continue

      await store.consumirSaldoFavor(clienteSeleccionado.id, aplicado)
      restante -= aplicado
      totalAplicado += aplicado
      if (aplicado >= pendiente - 0.001) saldadas++
      else abonadas++
    }

    setShowCompensarDeuda(false)

    if (totalAplicado <= 0) {
      showToast('No se pudo aplicar el saldo a ninguna deuda', 'warning')
      return
    }

    const partes = []
    if (saldadas > 0) partes.push(`${saldadas} deuda(s) saldada(s)`)
    if (abonadas > 0) partes.push(`${abonadas} con abono parcial`)
    showToast(
      `${partes.join(' · ')} por $${totalAplicado.toFixed(2)} · Saldo restante: $${restante.toFixed(2)}`,
      'success'
    )
  }

  /** Convierte los deliveries no usados en saldo a favor del cliente.
      Ocurre cuando el cliente busca su botellón en vez de pedir entrega:
      el delivery ya pagado queda disponible y puede transformarse en dinero. */
  const convertirDeliveriesEnSaldo = async () => {
    if (!clienteSeleccionado) return
    const { deliveriesSueltos, valorDeliveriesSueltos } = resumenSaldos
    if (deliveriesSueltos <= 0 || valorDeliveriesSueltos <= 0) {
      showToast('No hay deliveries sin usar para convertir', 'error')
      return
    }

    // Marcar como usados los deliveries que no tienen recarga asociada
    for (const p of clientePrepagos) {
      const recargas = Math.max(0, (p.recargas_compradas ?? 0) - (p.recargas_usadas ?? 0))
      const deliveries = Math.max(0, (p.deliveries_comprados ?? 0) - (p.deliveries_usados ?? 0))
      const sobrantes = Math.max(0, deliveries - recargas)
      if (sobrantes <= 0) continue
      const nuevoUsados = (p.deliveries_usados ?? 0) + sobrantes
      const actualizados = store.prepagos.map((sp: any) =>
        sp.id === p.id ? { ...sp, deliveries_usados: nuevoUsados } : sp
      )
      useAppStore.setState({ prepagos: actualizados })
      updateRow('prepagos', p.id, { deliveries_usados: nuevoUsados })
    }

    await store.abonarSaldoFavor(clienteSeleccionado.id, valorDeliveriesSueltos)
    showToast(
      `${deliveriesSueltos} delivery(s) convertido(s) en $${valorDeliveriesSueltos.toFixed(2)} de saldo a favor`,
      'success'
    )
  }

  /** Registra un abono directo al saldo a favor, sin comprar producto */
  const registrarSaldoFavor = async () => {
    if (!clienteSeleccionado) {
      showToast('Selecciona un cliente primero', 'error'); return
    }
    const monto = parseFloat(saldoFavorMonto) || 0
    if (monto <= 0) {
      showToast('Ingresa un monto mayor a cero', 'error'); return
    }
    if (!saldoFavorMetodo) {
      showToast('Selecciona un método de pago', 'error'); return
    }

    await store.abonarSaldoFavor(clienteSeleccionado.id, monto)

    // Se registra como venta para que aparezca en el cierre de caja:
    // es dinero que entro fisicamente a la caja.
    await store.agregarVenta({
      id: crypto.randomUUID(),
      fecha: getLocalDateString(),
      hora: new Date().toLocaleTimeString(),
      cliente_id: clienteSeleccionado.id,
      cliente_nombre: clienteSeleccionado.nombre || 'Cliente',
      items_json: JSON.stringify([{ tipo: 'ABONO_SALDO', monto_usd: monto }]),
      total_usd: monto,
      tasa_bcv: store.tasaBcv.valor,
      metodo_pago: saldoFavorMetodo,
      es_delivery: false,
      costo_delivery_usd: 0,
      notas: `ABONO A SALDO A FAVOR: $${monto.toFixed(2)}`,
    })

    showToast(`Saldo a favor registrado — $${monto.toFixed(2)} para ${clienteSeleccionado.nombre}`, 'success')
    setShowSaldoFavor(false)
    setSaldoFavorMonto('')
    setSaldoFavorMetodo('')
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
    const precioDelivery = parseFloat(prepagoDeliveryPrecio) || 0
    const conDelivery = precioDelivery > 0
    // El delivery se cobra POR BOTELLÓN, no por viaje
    const totalRecargas = precioUnitario * prepagoCantidad
    const totalDeliveries = precioDelivery * prepagoCantidad
    const totalPrepago = totalRecargas + totalDeliveries
    const tipoLabel = `${prepagoTipoLitros}L`

    const prepago = {
      id: crypto.randomUUID(),
      cliente_id: clienteSeleccionado.id,
      tipo_botellon: tipoLabel,
      recargas_compradas: prepagoCantidad,
      recargas_usadas: 0,
      // Contadores de delivery, independientes de las recargas
      deliveries_comprados: conDelivery ? prepagoCantidad : 0,
      deliveries_usados: 0,
      precio_usd: precioUnitario,
      precio_delivery_usd: precioDelivery,
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
      items_json: JSON.stringify([{
        tipo: 'ABONO_PREPAGO', tipo_botellon: tipoLabel, cantidad: prepagoCantidad,
        precio_usd: precioUnitario,
        deliveries: conDelivery ? prepagoCantidad : 0,
        precio_delivery_usd: precioDelivery,
      }]),
      total_usd: totalPrepago,
      tasa_bcv: store.tasaBcv.valor,
      metodo_pago: prepagoMetodo,
      es_delivery: false,
      costo_delivery_usd: 0,
      notas: conDelivery
        ? `ABONO PREPAGO: ${prepagoCantidad} recargas de ${tipoLabel} ($${totalRecargas.toFixed(2)}) + ${prepagoCantidad} deliveries ($${totalDeliveries.toFixed(2)})`
        : `ABONO PREPAGO: ${prepagoCantidad} recargas de ${tipoLabel}`,
    }
    await store.agregarVenta(ventaAbono)

    showToast(
      conDelivery
        ? `Prepago registrado — ${prepagoCantidad} recargas de ${tipoLabel} con delivery · $${totalPrepago.toFixed(2)}`
        : `Prepago registrado — ${prepagoCantidad} recargas de ${tipoLabel} para ${clienteSeleccionado.nombre}`,
      'success'
    )

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
    // La desinfección incluye la recarga, así que también consume agua
    const totalLitros = carrito.reduce((sum, item) =>
      (item.producto.esRecarga || item.producto.esDesinfeccion)
        ? sum + item.producto.litros * item.cantidad
        : sum
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

    // 4.55. Avisar si hay desinfección Y recarga del mismo litraje:
    // la desinfección ya incluye la recarga en su precio.
    const litrajesDesinfectados = new Set(
      carrito.filter(i => i.producto.esDesinfeccion).map(i => i.producto.litros)
    )
    const recargaRedundante = carrito.find(
      i => i.producto.esRecarga && litrajesDesinfectados.has(i.producto.litros)
    )
    if (recargaRedundante && !confirmoRecargaExtra) {
      showToast(
        `La desinfección de ${recargaRedundante.producto.litros}L ya incluye la recarga. Pulsa cobrar otra vez si aun así quieres añadirla.`,
        'warning'
      )
      setConfirmoRecargaExtra(true)
      return
    }

    // 4.6. Validar prepagos contra disponibilidad ACTUAL
    // (otra caja pudo consumirlos mientras esta línea estaba abierta)
    for (const item of carrito) {
      if (item.cantidadPrepago > 0) {
        const disponibles = getPrepagoDisponibles(item)
        if (item.cantidadPrepago > disponibles) {
          showToast(
            `Prepagos insuficientes para ${item.producto.nombre}: ${disponibles} disponible(s)`,
            'error'
          )
          return
        }
      }
    }

    // 4.7. Validar saldo a favor contra la disponibilidad ACTUAL
    // (otra caja pudo consumirlo mientras esta venta estaba abierta)
    if (saldoAplicado > 0) {
      if (!clienteSeleccionado) {
        showToast('Selecciona un cliente para aplicar su saldo', 'error')
        return
      }
      const disponibleAhora = Math.max(0, parseFloat(clienteSeleccionado.saldo_usd) || 0)
      if (saldoAplicado > disponibleAhora) {
        showToast(`Saldo insuficiente: $${disponibleAhora.toFixed(2)} disponible(s)`, 'error')
        setSaldoAplicado(0)
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
      // En cortesia el total facturado es 0: no entra dinero.
      // El inventario SI se descuenta (pasos 7, 8 y 8.5 mas abajo).
      total_usd: esCortesia ? 0 : totalUsd,
      // Valor de lo entregado, para saber cuanto se regalo
      valor_cortesia_usd: esCortesia ? parseFloat(totalUsd.toFixed(2)) : 0,
      // Bolivares realmente recibidos. Si el vendedor no los teclea,
      // se usa la conversion a la tasa de ESTE momento (no la de cierre).
      total_ves: (() => {
        const esEnBs = metodoPago === 'efectivo_ves' || metodoPago === 'pago_movil' || metodoPago === 'punto_venta'
        if (!esEnBs) return 0
        const tecleado = parseFloat(montoRecibidoVes) || 0
        return tecleado > 0
          ? parseFloat(tecleado.toFixed(2))
          : parseFloat((totalACobrar * (store.tasaBcv.valor || 0)).toFixed(2))
      })(),
      // Porcion del total cubierta con saldo a favor del cliente
      saldo_aplicado_usd: saldoAplicado,
      tasa_bcv: store.tasaBcv.valor,
      metodo_pago: metodoPago,
      es_delivery: isDelivery,
      estado_delivery: isDelivery ? 'en_transito' : 'completado',
      costo_delivery_usd: costoDelivery,
      notas: [
        referenciaPagoMovil ? `Ref: ${referenciaPagoMovil}` : '',
        saldoAplicado > 0 ? `Saldo a favor aplicado: $${saldoAplicado.toFixed(2)}` : '',
        esCortesia
          ? `CORTESÍA${motivoCortesia.trim() ? `: ${motivoCortesia.trim()}` : ' (sin motivo indicado)'} · Valor entregado: $${totalUsd.toFixed(2)}`
          : '',
      ].filter(Boolean).join(' · '),
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
      showToast('Error al sincronizar con la nube', 'warning')
    }

    // 7. Descontar litros
    if (totalLitros > 0) store.descontarLitros(totalLitros)

    // 8. Descontar insumos con reglas de negocio correctas:
    //    - Tapas:     solo recargas de 19L y 12L (no 8L ni 5L)
    //    - Precintos: solo en delivery, y solo para 19L y 12L
    //    - Etiquetas: solo en delivery, y solo para 19L y 12L
    // Tapas: recargas y desinfecciones de 19L y 12L (no 8L ni 5L)
    const esTapable = (p: Producto) =>
      (p.esRecarga || p.esDesinfeccion) && (p.litros === 19 || p.litros === 12)
    const tapasUsadas = carrito
      .filter(item => esTapable(item.producto))
      .reduce((sum, item) => sum + item.cantidad, 0)

    // Precintos:
    //   - Recargas: solo en delivery
    //   - Desinfecciones 19L y 12L: SIEMPRE (el botellón se entrega sellado)
    const precintosRecarga = carrito
      .filter(item => item.producto.esRecarga &&
        (item.producto.litros === 19 || item.producto.litros === 12))
      .reduce((sum, item) => sum + item.cantidad, 0)
    const precintosDesinfeccion = carrito
      .filter(item => item.producto.esDesinfeccion &&
        (item.producto.litros === 19 || item.producto.litros === 12))
      .reduce((sum, item) => sum + item.cantidad, 0)
    const precintosUsados = (isDelivery ? precintosRecarga : 0) + precintosDesinfeccion
    const etiquetasUsadas = isDelivery ? precintosRecarga : 0
    if (tapasUsadas > 0 || precintosUsados > 0 || etiquetasUsadas > 0) {
      // Se pasa el numero de orden para poder rastrear cada movimiento
      // hasta la venta que lo origino.
      store.descontarInsumos(tapasUsadas, precintosUsados, etiquetasUsadas, `Orden ${nuevoOrden}`, sesion?.nombre || '')
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
      store.descontarProductos(productosADescontar, `Orden ${nuevoOrden}`, sesion?.nombre || '')
    }

    // 9. Actualizar prepagos usados
    const itemsPrepago = carrito.filter(item => item.cantidadPrepago > 0 && item.producto.esRecarga)
    for (const item of itemsPrepago) {
      const litrosItem = item.producto.litros
      let recargasPendientes = item.cantidadPrepago
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

        // El delivery se consume APARTE y solo si la entrega es a domicilio.
        // Si el cliente busca su botellón, gasta recarga pero no delivery:
        // ese delivery le queda disponible para otra entrega.
        const delivDisponibles = (p.deliveries_comprados ?? 0) - (p.deliveries_usados ?? 0)
        const usarDeliv = isDelivery ? Math.min(delivDisponibles, usar) : 0
        const nuevoDelivUsados = (p.deliveries_usados ?? 0) + usarDeliv

        const cambios: any = { recargas_usadas: nuevoUsadas }
        if (usarDeliv > 0) cambios.deliveries_usados = nuevoDelivUsados

        const updatedPrepagos = store.prepagos.map((sp: any) =>
          sp.id === p.id ? { ...sp, ...cambios } : sp
        )
        useAppStore.setState({ prepagos: updatedPrepagos })
        updateRow('prepagos', p.id, cambios)
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
        // agregarDeuda ya suma al total del cliente de forma atomica.
        // Aqui habia una segunda escritura (total viejo + monto) que competia
        // con esa suma y podia duplicar o pisar la deuda.
        store.agregarDeuda(deuda)
    }

    // 9.7. Consumir el saldo a favor aplicado
    // (en cortesia no se consume: no se cobro nada)
    if (!esCortesia && saldoAplicado > 0 && clienteSeleccionado) {
      await store.consumirSaldoFavor(clienteSeleccionado.id, saldoAplicado)
    }

    // 9.8. Guardar el vuelto como saldo a favor (si se marco)
    if (guardarVuelto && vueltoDisponible > 0 && clienteSeleccionado) {
      await store.abonarSaldoFavor(clienteSeleccionado.id, vueltoDisponible)
      showToast(`Vuelto guardado a favor de ${clienteSeleccionado.nombre}: $${vueltoDisponible.toFixed(2)}`, 'success')
    }

    // 10. Preparar modal de éxito
    setUltimaVenta({
      orden: nuevoOrden,
      totalUsd: esCortesia ? 0 : totalUsd,
      totalVes: usdToVes(esCortesia ? 0 : totalUsd),
      esCortesia,
      valorCortesia: esCortesia ? totalUsd : 0,
      motivoCortesia: esCortesia ? motivoCortesia.trim() : '',
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
    setSaldoAplicado(0)
    setGuardarVuelto(false)
    setMontoRecibido('')
    setMontoRecibidoVes('')
    setMotivoCortesia('')

    // 11. Mostrar éxito
    setShowExitoModal(true)
    showToast(
      esCortesia
        ? `Cortesía registrada — valor entregado $${totalUsd.toFixed(2)}`
        : `¡Venta registrada — $${totalUsd.toFixed(2)} USD`,
      'success'
    )
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
          {/* Toggle de delivery */}
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
          </div>
        </div>

        {/* Grid de productos */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 mb-6">
          {productosList.map(p => (
            <button
              key={p.id}
              onClick={() => seleccionarProducto(p)}
              className="bg-white dark:bg-[#1e2235] rounded-xl p-4 text-left cursor-pointer border-2 border-transparent
                hover:border-primary dark:hover:border-[#5bb3e8] hover:bg-[#f0f7ff] dark:hover:bg-[#1a1d27] transition-all duration-200 shadow-sm
                active:scale-[0.97] group"
            >
              <ImagenProducto id={p.esDesinfeccion ? 'desinfeccion' : p.id} nombre={p.nombre} esRecarga={p.esRecarga} />
              <div className="font-inter font-bold text-sm text-onSurface dark:text-[#e4e6f0] mb-2 group-hover:text-primary dark:group-hover:text-[#5bb3e8] transition-colors">
                {p.nombre}
              </div>
              {p.esDesinfeccion ? (
                <div className="font-grotesk text-[15px] font-bold text-tertiary dark:text-amber-500 leading-tight py-[5px]">
                  Precio libre
                </div>
              ) : (
                <>
                  <div className="font-grotesk text-[22px] font-bold text-primary dark:text-[#5bb3e8] leading-tight">
                    ${p.precio.toFixed(2)}
                  </div>
                  <div className="font-grotesk text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {usdToVes(p.precio)}
                  </div>
                </>
              )}
              {(p.esRecarga || p.esDesinfeccion) && (
                <div className="mt-2">
                  <span className={`inline-block text-[10px] font-bold font-grotesk px-2 py-0.5 rounded-full tracking-wide ${
                    p.esDesinfeccion
                      ? 'bg-amber-50 dark:bg-amber-900/20 text-tertiary dark:text-amber-500'
                      : 'bg-blue-50 dark:bg-[#1a1d27] text-primary dark:text-[#5bb3e8]'
                  }`}>
                    {p.litros}L{p.esDesinfeccion ? ' · incluye recarga' : ''}
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
          {/* Card alerta inventario — rojo parpadeante si es critico */}
          {showInventoryAlert && (
            <div
              role="alert"
              aria-live={hayCritico ? 'assertive' : 'polite'}
              className={
                hayCritico
                  ? 'bg-red-50 dark:bg-red-900/25 border-2 border-red-500 dark:border-red-500 rounded-xl p-5 shadow-sm animate-parpadeoAlerta motion-reduce:animate-none'
                  : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-5 shadow-sm'
              }
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{hayCritico ? '🚨' : '⚠'}</span>
                <div>
                  <h3 className={`font-manrope font-bold text-base mb-1 ${
                    hayCritico
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-amber-800 dark:text-amber-500'
                  }`}>
                    {hayCritico ? 'Stock Crítico' : 'Alerta de Inventario'}
                  </h3>
                  {criticoItems.length > 0 && (
                    <p className="text-red-700 dark:text-red-400 text-sm font-inter font-bold">
                      Reponer ya: {criticoItems.join(' · ')}
                    </p>
                  )}
                  {avisoItems.length > 0 && (
                    <p className={`text-sm font-inter ${
                      hayCritico
                        ? 'text-amber-700 dark:text-amber-500 mt-0.5'
                        : 'text-amber-700 dark:text-amber-600'
                    }`}>
                      Stock bajo: {avisoItems.join(' · ')}
                    </p>
                  )}
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
          onShowSaldoFavor={() => setShowSaldoFavor(true)}
          resumenSaldos={resumenSaldos}
          onConvertirDeliveries={convertirDeliveriesEnSaldo}
          hayDeudaCompensable={hayDeudaCompensable}
          deudaCliente={deudaCliente}
          deudaCubrible={deudaCubrible}
          onCompensarDeuda={() => setShowCompensarDeuda(true)}
          saldoDisponible={saldoDisponible}
          saldoAplicado={saldoAplicado}
          onToggleSaldo={toggleAplicarSaldo}
          montoRecibido={montoRecibido}
          setMontoRecibido={setMontoRecibido}
          montoRecibidoVes={montoRecibidoVes}
          setMontoRecibidoVes={setMontoRecibidoVes}
          vueltoDisponible={vueltoDisponible}
          guardarVuelto={guardarVuelto}
          setGuardarVuelto={setGuardarVuelto}
          totalACobrar={totalACobrar}
          getPrepagoDisponibles={getPrepagoDisponibles}
          cambiarCantidad={cambiarCantidad}
          eliminarItem={eliminarItem}
          aplicarPrepago={aplicarPrepago}
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
          motivoCortesia={motivoCortesia}
          setMotivoCortesia={setMotivoCortesia}
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
                onShowSaldoFavor={() => setShowSaldoFavor(true)}
                resumenSaldos={resumenSaldos}
                onConvertirDeliveries={convertirDeliveriesEnSaldo}
                hayDeudaCompensable={hayDeudaCompensable}
                deudaCliente={deudaCliente}
                deudaCubrible={deudaCubrible}
                onCompensarDeuda={() => setShowCompensarDeuda(true)}
                saldoDisponible={saldoDisponible}
                saldoAplicado={saldoAplicado}
                onToggleSaldo={toggleAplicarSaldo}
                montoRecibido={montoRecibido}
                setMontoRecibido={setMontoRecibido}
                montoRecibidoVes={montoRecibidoVes}
                setMontoRecibidoVes={setMontoRecibidoVes}
                vueltoDisponible={vueltoDisponible}
                guardarVuelto={guardarVuelto}
                setGuardarVuelto={setGuardarVuelto}
                totalACobrar={totalACobrar}
                getPrepagoDisponibles={getPrepagoDisponibles}
                cambiarCantidad={cambiarCantidad}
                eliminarItem={eliminarItem}
                aplicarPrepago={aplicarPrepago}
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
                motivoCortesia={motivoCortesia}
                setMotivoCortesia={setMotivoCortesia}
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

      {/* ──────────────────── MODAL PRECIO DESINFECCIÓN ─────────────────── */}
      {desinfeccionPendiente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setDesinfeccionPendiente(null); setDesinfeccionPrecio('') }} />
          <div className="relative bg-white dark:bg-[#1e2235] rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-manrope font-bold text-lg text-onSurface dark:text-[#e4e6f0]">
                  {desinfeccionPendiente.nombre}
                </h3>
                <p className="font-inter text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Precio según el trabajo requerido
                </p>
              </div>
              <button onClick={() => { setDesinfeccionPendiente(null); setDesinfeccionPrecio('') }} className="text-gray-400 hover:text-gray-600 dark:hover:text-[#5bb3e8]">
                <X size={20} />
              </button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl px-3 py-2.5 mb-4">
              <p className="font-inter text-[11px] text-amber-800 dark:text-amber-500">
                Incluye la recarga de <span className="font-grotesk font-bold">{desinfeccionPendiente.litros} L</span>
                {(desinfeccionPendiente.litros === 19 || desinfeccionPendiente.litros === 12)
                  ? ' · descuenta tapa y precinto'
                  : ' · sin tapa ni precinto'}
              </p>
            </div>

            <label className="block text-xs font-manrope font-bold text-gray-400 dark:text-gray-500 tracking-wider mb-2">
              PRECIO DEL SERVICIO (USD)
            </label>
            <input
              type="number" min="0" step="0.01" placeholder="0.00" autoFocus
              value={desinfeccionPrecio}
              onChange={e => setDesinfeccionPrecio(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmarDesinfeccion() }}
              className="w-full border border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-xl px-4 py-3 font-grotesk font-bold text-lg
                outline-none focus:border-primary dark:focus:border-[#5bb3e8] text-gray-800 dark:text-[#e4e6f0]"
            />
            {(parseFloat(desinfeccionPrecio) || 0) > 0 && (
              <p className="font-grotesk text-sm text-primary dark:text-[#5bb3e8] mt-1.5">
                {usdToVes(parseFloat(desinfeccionPrecio) || 0)}
              </p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setDesinfeccionPendiente(null); setDesinfeccionPrecio('') }}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-[#2d3148] font-manrope font-bold text-sm text-gray-600 dark:text-gray-400
                  hover:bg-gray-50 dark:hover:bg-[#2d3148] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarDesinfeccion}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-manrope font-bold text-sm hover:bg-primaryContainer transition-colors"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────── MODAL COMPENSAR DEUDA CON SALDO ────────────────── */}
      {showCompensarDeuda && clienteSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCompensarDeuda(false)} />
          <div className="relative bg-white dark:bg-[#1e2235] rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-manrope font-bold text-lg text-onSurface dark:text-[#e4e6f0]">Pagar deuda con saldo</h3>
                <p className="font-inter text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {clienteSeleccionado.nombre}
                </p>
              </div>
              <button onClick={() => setShowCompensarDeuda(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-[#5bb3e8]">
                <X size={20} />
              </button>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl px-4 py-3 mb-4">
              <p className="font-inter text-sm text-amber-800 dark:text-amber-500">
                Confirma con el cliente antes de continuar. Esta acción usa su
                dinero a favor para cancelar deudas pendientes.
              </p>
            </div>

            <div className="space-y-2 mb-5">
              <div className="flex justify-between items-center text-sm font-inter">
                <span className="text-gray-500 dark:text-gray-400">Saldo a favor</span>
                <span className="font-grotesk font-bold text-green-700 dark:text-green-400">
                  ${saldoDisponible.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm font-inter">
                <span className="text-gray-500 dark:text-gray-400">Deuda pendiente</span>
                <span className="font-grotesk font-bold text-red-600 dark:text-red-400">
                  ${deudaCliente.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm font-inter pt-2 border-t border-gray-100 dark:border-[#2d3148]">
                <span className="text-gray-600 dark:text-gray-300 font-bold">Se aplicará hasta</span>
                <span className="font-grotesk font-bold text-primary dark:text-[#5bb3e8]">
                  ${deudaCubrible.toFixed(2)}
                </span>
              </div>
            </div>

            <p className="font-inter text-[11px] text-gray-400 dark:text-gray-500 mb-5">
              El saldo se aplica de la deuda más antigua a la más reciente.
              Si no alcanza para cubrir una deuda completa, se registra como
              abono parcial y esa deuda sigue pendiente por el resto.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCompensarDeuda(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-[#2d3148] font-manrope font-bold text-sm text-gray-600 dark:text-gray-400
                  hover:bg-gray-50 dark:hover:bg-[#2d3148] transition-colors"
              >
                No, cancelar
              </button>
              <button
                onClick={compensarDeudaConSaldo}
                className="flex-1 py-3 rounded-xl bg-amber-600 text-white font-manrope font-bold text-sm hover:bg-amber-700 transition-colors"
              >
                Sí, pagar deuda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────── MODAL SALDO A FAVOR ───────────────────── */}
      {showSaldoFavor && clienteSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSaldoFavor(false)} />
          <div className="relative bg-white dark:bg-[#1e2235] rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-manrope font-bold text-lg text-onSurface dark:text-[#e4e6f0]">Saldo a Favor</h3>
                <p className="font-inter text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {clienteSeleccionado.nombre}
                </p>
              </div>
              <button onClick={() => setShowSaldoFavor(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-[#5bb3e8]">
                <X size={20} />
              </button>
            </div>

            <p className="font-inter text-sm text-gray-500 dark:text-gray-400 mb-4">
              Registra dinero a favor del cliente sin asignarlo a ningún producto.
              Podrá usarlo en cualquier compra futura.
            </p>

            {saldoDisponible > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl px-4 py-3 mb-4">
                <span className="font-inter text-sm text-green-700 dark:text-green-400">
                  Saldo actual: <span className="font-grotesk font-bold">${saldoDisponible.toFixed(2)}</span>
                </span>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-manrope font-bold text-gray-400 dark:text-gray-500 tracking-wider mb-2">
                MONTO A ABONAR (USD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={saldoFavorMonto}
                onChange={e => setSaldoFavorMonto(e.target.value)}
                className="w-full border border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-xl px-4 py-3 font-grotesk font-bold text-lg
                  outline-none focus:border-primary dark:focus:border-[#5bb3e8] text-gray-800 dark:text-[#e4e6f0]"
              />
              {(parseFloat(saldoFavorMonto) || 0) > 0 && (
                <p className="font-grotesk text-sm text-primary dark:text-[#5bb3e8] mt-1.5">
                  {usdToVes(parseFloat(saldoFavorMonto) || 0)}
                </p>
              )}
            </div>

            <div className="mb-5">
              <label className="block text-xs font-manrope font-bold text-gray-400 dark:text-gray-500 tracking-wider mb-2">
                MÉTODO DE PAGO
              </label>
              <div className="grid grid-cols-2 gap-2">
                {METODOS_PAGO.filter(m => ['efectivo_usd', 'pago_movil', 'punto_venta', 'efectivo_ves'].includes(m.id)).map(m => {
                  const isActive = saldoFavorMetodo === m.id
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSaldoFavorMetodo(m.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-manrope font-bold transition-colors ${
                        isActive
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white dark:bg-[#1a1d27] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-[#2d3148] hover:border-primary'
                      }`}
                    >
                      <m.icon size={14} /> {m.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSaldoFavor(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-[#2d3148] font-manrope font-bold text-sm text-gray-600 dark:text-gray-400
                  hover:bg-gray-50 dark:hover:bg-[#2d3148] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={registrarSaldoFavor}
                className="flex-1 py-3 rounded-xl bg-primary text-white font-manrope font-bold text-sm hover:bg-primaryContainer transition-colors"
              >
                Registrar Saldo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────── MODAL PREPAGO ─────────────────────────── */}
      {showPrepago && clienteSeleccionado && (() => {
        const precioNum = parseFloat(prepagoPrecio) || 0
        const delivNum = parseFloat(prepagoDeliveryPrecio) || 0
        const totalRecargasModal = precioNum * prepagoCantidad
        const totalDeliveriesModal = delivNum * prepagoCantidad
        const totalPrepago = totalRecargasModal + totalDeliveriesModal
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

              {/* Precio del delivery por botellón (opcional) */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-600 dark:text-gray-400 mb-1.5 font-manrope">
                  Delivery por botellón (USD) — opcional
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={prepagoDeliveryPrecio}
                  onChange={e => setPrepagoDeliveryPrecio(e.target.value)}
                  className="w-full border-2 border-gray-200 dark:border-[#2d3148] dark:bg-[#1a1d27] dark:text-[#e4e6f0] rounded-xl p-3 font-grotesk text-lg font-bold text-primary dark:text-[#5bb3e8]
                    outline-none focus:border-primary transition-colors"
                />
                <p className="font-inter text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                  Déjalo vacío si el prepago no incluye entregas. El delivery se
                  cuenta por botellón y se descuenta solo cuando hay entrega a domicilio.
                </p>
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
                  <span className="font-bold">{prepagoCantidad}</span> recargas × <span className="font-grotesk font-bold text-primary dark:text-[#5bb3e8]">${precioNum.toFixed(2)}</span>
                  <span className="font-grotesk float-right">${totalRecargasModal.toFixed(2)}</span>
                </div>
                {delivNum > 0 && (
                  <div className="font-inter text-sm text-gray-700 dark:text-[#e4e6f0] mb-1">
                    <span className="font-bold">{prepagoCantidad}</span> deliveries × <span className="font-grotesk font-bold text-primary dark:text-[#5bb3e8]">${delivNum.toFixed(2)}</span>
                    <span className="font-grotesk float-right">${totalDeliveriesModal.toFixed(2)}</span>
                  </div>
                )}
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
  onShowSaldoFavor: () => void
  resumenSaldos: { lineas: any[]; deliveriesSueltos: number; valorDeliveriesSueltos: number }
  onConvertirDeliveries: () => void
  hayDeudaCompensable: boolean
  deudaCliente: number
  deudaCubrible: number
  onCompensarDeuda: () => void
  saldoDisponible: number
  saldoAplicado: number
  onToggleSaldo: () => void
  montoRecibido: string
  setMontoRecibido: (v: string) => void
  montoRecibidoVes: string
  setMontoRecibidoVes: (v: string) => void
  vueltoDisponible: number
  guardarVuelto: boolean
  setGuardarVuelto: (v: boolean) => void
  totalACobrar: number
  getPrepagoDisponibles: (item: CarritoItem) => number
  cambiarCantidad: (id: string, delta: number) => void
  eliminarItem: (id: string) => void
  aplicarPrepago: (id: string) => void
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
  motivoCortesia: string
  setMotivoCortesia: (v: string) => void
  completarTransaccion: () => void
  usdToVes: (n: number) => string
}

function OrderPanel({
  carrito, ordenNumero, busquedaCliente, setBusquedaCliente,
  clientesFilterResults, clienteSeleccionado, setClienteSeleccionado,
  clientePrepagosCount, clientePrepagosDetalle, clienteNivel,
  onShowPrepago, onShowSaldoFavor, saldoDisponible, saldoAplicado, onToggleSaldo,
  resumenSaldos, onConvertirDeliveries,
  hayDeudaCompensable, deudaCliente, deudaCubrible, onCompensarDeuda,
  montoRecibido, setMontoRecibido, montoRecibidoVes, setMontoRecibidoVes,
  vueltoDisponible, guardarVuelto, setGuardarVuelto,
  totalACobrar, getPrepagoDisponibles,
  cambiarCantidad, eliminarItem, aplicarPrepago,
  itemTienePrepago, subtotalUsd, totalUsd, isDelivery, costoDelivery,
  setCostoDelivery, metodoPago, setMetodoPago, referenciaPagoMovil,
  setReferenciaPagoMovil, motivoCortesia, setMotivoCortesia, completarTransaccion, usdToVes,
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
                onClick={onShowSaldoFavor}
                title="Registrar saldo a favor sin comprar producto"
                className="text-[11px] font-manrope font-bold text-green-700 dark:text-green-400 bg-white dark:bg-[#1e2235] border border-green-200 dark:border-[#2d3148] rounded-lg px-2 py-1
                  hover:bg-green-50 dark:hover:bg-[#2d3148] transition-colors flex items-center gap-1 flex-shrink-0"
              >
                <Plus size={12} /> Saldo
              </button>
              <button
                onClick={() => { setClienteSeleccionado(null); setBusquedaCliente('') }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>
            {/* Badges debajo del chip */}
            {/* Se incluye la deuda en la condicion. Antes el bloque solo
                aparecia si habia prepago o saldo a favor, asi que un cliente
                que unicamente debia dinero no mostraba ningun aviso. */}
            {(clientePrepagosDetalle.length > 0
              || (clienteSeleccionado.saldo_usd && parseFloat(clienteSeleccionado.saldo_usd) > 0)
              || deudaCliente > 0) && (
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
                {deudaCliente > 0 && (
                  <span className="text-[10px] font-bold font-grotesk px-2 py-0.5 rounded-full text-white"
                    style={{ background: '#dc2626' }}>
                    DEUDA: ${deudaCliente.toFixed(2)}
                  </span>
                )}
              </div>
            )}

            {/* Resumen de saldos del cliente por litraje */}
            {clienteSeleccionado && (resumenSaldos.lineas.length > 0 || deudaCliente > 0) && (
              <div className="mt-2 mx-1 rounded-xl border border-gray-200 dark:border-[#2d3148] bg-gray-50 dark:bg-[#1a1d27] overflow-hidden">
                <div className="px-3 pt-2 pb-1">
                  <p className="font-manrope font-bold text-[10px] text-gray-400 dark:text-gray-500 tracking-wider">
                    SALDOS DEL CLIENTE
                  </p>
                </div>

                {/* Recargas prepagadas, agrupadas por litraje */}
                {resumenSaldos.lineas.map((l: any) => (
                  <div key={l.litros} className="px-3 py-1">
                    {l.conDelivery > 0 && (
                      <div className="flex items-center justify-between gap-2 py-[3px]">
                        <span className="font-inter text-[11px] text-gray-600 dark:text-gray-400 truncate">
                          Recargas {l.litros}L <span className="text-green-700 dark:text-green-500 font-bold">con delivery</span>
                        </span>
                        <span className="font-grotesk font-bold text-sm text-green-700 dark:text-green-400 tabular-nums flex-shrink-0">
                          {l.conDelivery}
                        </span>
                      </div>
                    )}
                    {l.sinDelivery > 0 && (
                      <div className="flex items-center justify-between gap-2 py-[3px]">
                        <span className="font-inter text-[11px] text-gray-600 dark:text-gray-400 truncate">
                          Recargas {l.litros}L
                        </span>
                        <span className="font-grotesk font-bold text-sm text-green-700 dark:text-green-400 tabular-nums flex-shrink-0">
                          {l.sinDelivery}
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Deliveries sin recarga: convertibles a saldo a favor */}
                {resumenSaldos.deliveriesSueltos > 0 && (
                  <div className="px-3 py-1 border-t border-gray-200 dark:border-[#2d3148]">
                    <div className="flex items-center justify-between gap-2 py-[3px]">
                      <span className="font-inter text-[11px] text-gray-600 dark:text-gray-400 truncate">
                        Deliveries sin usar
                      </span>
                      <span className="font-grotesk font-bold text-sm text-primary dark:text-[#5bb3e8] tabular-nums flex-shrink-0">
                        {resumenSaldos.deliveriesSueltos}
                      </span>
                    </div>
                    {resumenSaldos.valorDeliveriesSueltos > 0 && (
                      <button
                        onClick={onConvertirDeliveries}
                        className="mt-1 mb-1 w-full text-center text-[10px] font-bold font-manrope py-1.5 rounded-lg
                          bg-blue-50 dark:bg-[#1e2235] text-primary dark:text-[#5bb3e8] hover:bg-blue-100 dark:hover:bg-[#2d3148] transition-colors"
                      >
                        Pasar ${resumenSaldos.valorDeliveriesSueltos.toFixed(2)} a saldo a favor
                      </button>
                    )}
                  </div>
                )}

                {/* Deuda pendiente */}
                {deudaCliente > 0 && (
                  <div className="px-3 py-1 border-t border-gray-200 dark:border-[#2d3148]">
                    <div className="flex items-center justify-between gap-2 py-[3px]">
                      <span className="font-inter text-[11px] text-gray-600 dark:text-gray-400 truncate">
                        Por pagar
                      </span>
                      <span className="font-grotesk font-bold text-sm text-red-600 dark:text-red-400 tabular-nums flex-shrink-0">
                        ${deudaCliente.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Saldo a favor en dinero */}
                {saldoDisponible > 0 && (
                  <div className="px-3 py-1 pb-2 border-t border-gray-200 dark:border-[#2d3148]">
                    <div className="flex items-center justify-between gap-2 py-[3px]">
                      <span className="font-inter text-[11px] text-gray-600 dark:text-gray-400 truncate">
                        Saldo a favor
                      </span>
                      <span className="font-grotesk font-bold text-sm text-green-700 dark:text-green-400 tabular-nums flex-shrink-0">
                        ${saldoDisponible.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cliente con saldo Y deuda: preguntarle si desea compensar */}
            {hayDeudaCompensable && (
              <div className="mt-2 mx-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 rounded-xl px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5">⚠</span>
                  <div className="min-w-0">
                    <p className="font-manrope font-bold text-xs text-amber-800 dark:text-amber-500">
                      Este cliente tiene deuda pendiente
                    </p>
                    <p className="font-inter text-[11px] text-amber-700 dark:text-amber-600 mt-0.5">
                      Tiene ${saldoDisponible.toFixed(2)} a favor y debe ${deudaCliente.toFixed(2)}.
                      Pregúntale si desea usar su saldo para pagarla.
                    </p>
                    <button
                      onClick={onCompensarDeuda}
                      className="mt-2 w-full text-center text-[11px] font-bold font-manrope py-1.5 rounded-lg
                        bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                    >
                      Pagar deuda con su saldo (${deudaCubrible.toFixed(2)})
                    </button>
                  </div>
                </div>
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
              const pagadas = Math.max(0, item.cantidad - item.cantidadPrepago)
              const precioTotal = item.producto.precio * pagadas
              const hasPrepago = itemTienePrepago(item)
              const coberturaTotal = item.cantidadPrepago > 0 && item.cantidadPrepago >= item.cantidad
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
                        {item.cantidadPrepago > 0 && (
                          <span className="text-[9px] font-bold font-grotesk px-1.5 py-0.5 rounded-full bg-blue-100 text-primary">
                            {coberturaTotal ? 'PREPAGO' : `${item.cantidadPrepago}/${item.cantidad} PREPAGO`}
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
                    <span className={`font-grotesk font-bold text-base ${coberturaTotal ? 'text-green-600 dark:text-green-500' : 'text-onSurface dark:text-[#e4e6f0]'}`}>
                      ${precioTotal.toFixed(2)}
                    </span>
                  </div>
                  {/* Toggle prepago */}
                  {hasPrepago && (
                    <button
                      onClick={() => aplicarPrepago(item.producto.id)}
                      className={`mt-2 w-full text-center text-xs font-bold font-manrope py-1.5 rounded-lg transition-colors ${
                        item.cantidadPrepago > 0
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-gray-100 dark:bg-[#1e2235] text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-[#2d3148] hover:text-primary dark:hover:text-[#5bb3e8] border border-transparent dark:border-[#2d3148]'
                      }`}
                    >
                      {item.cantidadPrepago > 0
                        ? (coberturaTotal
                            ? '✓ Prepago aplicado'
                            : `✓ ${item.cantidadPrepago} con prepago · ${item.cantidad - item.cantidadPrepago} se cobran`)
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
        {/* Saldo a favor aplicado */}
        {saldoAplicado > 0 && (
          <div className="flex justify-between items-center text-sm font-inter">
            <span className="text-green-700 dark:text-green-400">Saldo a favor aplicado</span>
            <span className="font-grotesk font-bold text-green-700 dark:text-green-400">
              −${saldoAplicado.toFixed(2)}
            </span>
          </div>
        )}
        <div className="border-t border-gray-200 dark:border-[#2d3148] pt-3 mt-3">
          <div className="flex justify-between items-baseline mb-1">
            <span className="font-manrope font-bold text-base text-gray-600 dark:text-gray-300">TOTAL A PAGAR</span>
          </div>
          <div className="font-grotesk text-[28px] font-bold text-onSurface dark:text-[#e4e6f0] leading-tight">
            ${totalACobrar.toFixed(2)}
          </div>
          <div className="font-grotesk text-base text-primary dark:text-[#5bb3e8] font-medium">
            {usdToVes(totalACobrar)}
          </div>

          {/* Botón para aplicar el saldo a favor del cliente */}
          {saldoDisponible > 0 && totalUsd > 0 && (
            <button
              onClick={onToggleSaldo}
              className={`mt-3 w-full text-center text-xs font-bold font-manrope py-2 rounded-lg transition-colors ${
                saldoAplicado > 0
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-[#1e2235] text-gray-600 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-[#2d3148] hover:text-green-700 border border-transparent dark:border-[#2d3148]'
              }`}
            >
              {saldoAplicado > 0
                ? `✓ Saldo aplicado ($${saldoAplicado.toFixed(2)}) — quitar`
                : `Usar saldo a favor ($${saldoDisponible.toFixed(2)} disponible)`}
            </button>
          )}

          {/* Bolivares recibidos — solo para pagos en Bs */}
          {totalACobrar > 0 && ['efectivo_ves', 'pago_movil', 'punto_venta'].includes(metodoPago) && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#2d3148]">
              <div className="flex justify-between items-center text-sm font-inter mb-1">
                <span className="text-gray-500 dark:text-gray-400">Bolívares recibidos</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={usdToVes(totalACobrar).replace(/[^\d,.]/g, '')}
                  value={montoRecibidoVes}
                  onChange={e => setMontoRecibidoVes(e.target.value)}
                  className="w-28 text-right border border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-lg px-2 py-1 font-grotesk font-bold text-sm
                    outline-none focus:border-primary dark:focus:border-[#5bb3e8] text-gray-800 dark:text-[#e4e6f0]"
                />
              </div>
              <p className="font-inter text-[10px] text-gray-400 dark:text-gray-500">
                Si se deja vacío se usa la conversión del momento
              </p>
            </div>
          )}

          {/* Monto recibido y vuelto */}
          {totalACobrar > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#2d3148]">
              <div className="flex justify-between items-center text-sm font-inter mb-1">
                <span className="text-gray-500 dark:text-gray-400">Monto recibido</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={montoRecibido}
                  onChange={e => setMontoRecibido(e.target.value)}
                  className="w-24 text-right border border-gray-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] rounded-lg px-2 py-1 font-grotesk font-bold text-sm
                    outline-none focus:border-primary dark:focus:border-[#5bb3e8] text-gray-800 dark:text-[#e4e6f0]"
                />
              </div>
              {vueltoDisponible > 0 && (
                <>
                  <div className="flex justify-between items-center text-sm font-inter">
                    <span className="text-gray-500 dark:text-gray-400">Vuelto</span>
                    <span className="font-grotesk font-bold text-amber-600 dark:text-amber-500">
                      ${vueltoDisponible.toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={() => setGuardarVuelto(!guardarVuelto)}
                    disabled={!clienteSeleccionado}
                    title={!clienteSeleccionado ? 'Selecciona un cliente para guardar el vuelto' : ''}
                    className={`mt-2 w-full text-center text-xs font-bold font-manrope py-2 rounded-lg transition-colors ${
                      guardarVuelto
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-[#1e2235] text-gray-600 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-[#2d3148] disabled:opacity-40 disabled:cursor-not-allowed border border-transparent dark:border-[#2d3148]'
                    }`}
                  >
                    {guardarVuelto
                      ? `✓ Se guardará a favor del cliente`
                      : `Dejar $${vueltoDisponible.toFixed(2)} a favor del cliente`}
                  </button>
                </>
              )}
            </div>
          )}
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

        {/* Cortesía: aviso y motivo */}
        {metodoPago === 'cortesia' && (
          <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-3">
            <p className="font-manrope font-bold text-xs text-amber-800 dark:text-amber-500 mb-1">
              Entrega sin cobro
            </p>
            <p className="font-inter text-[11px] text-amber-700 dark:text-amber-600 mb-2.5">
              El producto se descuenta del inventario y el total facturado es
              $0.00. Valor de lo entregado: <span className="font-grotesk font-bold">${totalUsd.toFixed(2)}</span>
            </p>
            <input
              type="text"
              value={motivoCortesia}
              onChange={e => setMotivoCortesia(e.target.value)}
              placeholder="Motivo (opcional): donación, cortesía, reposición…"
              className="w-full border border-amber-200 dark:border-[#2d3148] bg-white dark:bg-[#1a1d27] text-gray-800 dark:text-[#e4e6f0]
                rounded-lg px-3 py-2 text-xs font-inter outline-none focus:border-amber-500 transition-colors"
            />
          </div>
        )}

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