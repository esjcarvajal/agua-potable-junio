/**
 * useCierreAutomatico — Lógica para generar un cierre de caja automático
 * cuando la jornada laboral termina según el horario configurado.
 *
 * Se dispara desde Layout.tsx cuando detecta la transición ABIERTO → CERRADO.
 * Garantiza que solo se genera UN cierre por día (flag en localStorage).
 */
import { getConfig } from './useConfig'
import { insertRow, readSheet } from './db'
import { useAppStore } from '../store/useAppStore'

import { getLocalDateString } from './dateUtils'
import { precioLineaUsd } from './carritoUtils'

const FLAG_KEY_PREFIX = 'agua-potable-cierre-auto-'

function hoyStr(): string {
  return getLocalDateString()
}

/** Retorna true si ya se generó un cierre automático hoy */
export function cierreAutomaticoYaGenerado(): boolean {
  return localStorage.getItem(FLAG_KEY_PREFIX + hoyStr()) === '1'
}

/** Marca el cierre automático del día como generado */
function marcarCierreGenerado(): void {
  localStorage.setItem(FLAG_KEY_PREFIX + hoyStr(), '1')
}

const COSTO_AGUA_POR_LITRO = 0.05

/**
 * Genera el cierre de caja automático del día con los datos actuales del store.
 * Retorna el objeto cierre generado o null si ya existía uno para hoy.
 */
export async function generarCierreAutomatico(): Promise<Record<string, unknown> | null> {
  if (cierreAutomaticoYaGenerado()) return null

  const store = useAppStore.getState()
  const config = getConfig()
  const hoy = hoyStr()

  // Filtrar ventas del día
  const ventasHoy = store.ventas.filter((v: any) => (v.fecha || '').startsWith(hoy))
  if (ventasHoy.length === 0) {
    // No hay ventas — marcar igualmente para no reintentar
    marcarCierreGenerado()
    return null
  }

  // Métricas
  let ingresosUsd = 0
  let litrosVendidos = 0
  let tapasUsadas = 0
  let precintosUsados = 0
  let pagoMovilUsd = 0
  let puntoVentaUsd = 0

  // ── Flujo de caja: separar lo cobrado HOY de lo despachado sin cobro ──
  // Un pago con saldo a favor o prepago se cobro en dias previos; una venta
  // a credito se cobrara despues. Ninguno entra a la caja de hoy.
  let cajaEfectivoUsd = 0     // dolares fisicos
  let cajaEfectivoVes = 0     // bolivares fisicos (monto REAL recibido)
  let cajaBancoVes = 0        // pago movil + punto de venta, en Bs
  let sinCobroCreditoUsd = 0
  let sinCobroSaldoUsd = 0
  let sinCobroPrepagoUsd = 0
  let sinCobroCortesiaUsd = 0
  const desgloseProductosMap: Record<string, { nombre: string; cantidad: number; totalUsd: number }> = {}
  const desglosePagosMap: Record<string, number> = {}

  ventasHoy.forEach((v: any) => {
    const monto = parseFloat(v.total_usd) || 0
    ingresosUsd += monto

    // Desglose por método de pago
    const metodo = v.metodo_pago || 'otro'
    desglosePagosMap[metodo] = (desglosePagosMap[metodo] || 0) + monto
    if (metodo === 'pago_movil') pagoMovilUsd += monto
    if (metodo === 'punto_venta') puntoVentaUsd += monto

    // Clasificar por naturaleza del cobro
    const ves = parseFloat(v.total_ves) || 0
    const saldoAplicado = parseFloat(v.saldo_aplicado_usd) || 0
    if (metodo === 'efectivo_usd') {
      cajaEfectivoUsd += monto - saldoAplicado
    } else if (metodo === 'efectivo_ves') {
      cajaEfectivoVes += ves
    } else if (metodo === 'pago_movil' || metodo === 'punto_venta') {
      cajaBancoVes += ves
    } else if (metodo === 'post_pago') {
      sinCobroCreditoUsd += monto
    } else if (metodo === 'prepago_cliente') {
      sinCobroPrepagoUsd += monto
    } else if (metodo === 'cortesia') {
      // El total facturado es 0; lo que importa es el valor entregado
      sinCobroCortesiaUsd += parseFloat(v.valor_cortesia_usd) || 0
    }
    // El saldo a favor no es ingreso de hoy: se cobro cuando se abono
    if (saldoAplicado > 0) sinCobroSaldoUsd += saldoAplicado

    try {
      const items = JSON.parse(v.items_json || '[]')
      items.forEach((item: any) => {
        if (item.producto?.esRecarga) {
          litrosVendidos += (item.producto.litros || 0) * (item.cantidad || 1)
          // Tapas: SOLO recargas de 19L y 12L (misma regla que el POS)
          const litros = item.producto.litros
          if (litros === 19 || litros === 12) {
            tapasUsadas += item.cantidad || 1
            // Precintos y etiquetas: solo en delivery
            if (v.es_delivery) precintosUsados += item.cantidad || 1
          }
        }
        if (item.producto) {
          const key = item.producto.id || item.producto.nombre
          if (!desgloseProductosMap[key]) {
            desgloseProductosMap[key] = { nombre: item.producto.nombre, cantidad: 0, totalUsd: 0 }
          }
          desgloseProductosMap[key].cantidad += item.cantidad || 1
          desgloseProductosMap[key].totalUsd += precioLineaUsd(item)
        }
      })
    } catch { /* skip */ }
  })

  const desgloseProductos = Object.values(desgloseProductosMap)
  const desglosePagos = Object.entries(desglosePagosMap).map(([metodo, value]) => ({
    name: metodo, value: parseFloat(value.toFixed(2))
  }))

  // ── Inicial de insumos: heredado del ultimo cierre guardado ──
  // Si no hay cierre previo (primer dia o dia sin cierre), se asume
  // inicial = restante + usado, que es lo mismo pero sin poder detectar mermas.
  const cierresPrevios: any[] = await readSheet('cierres_caja').catch(() => [])
  const cierreAnterior: any = cierresPrevios
    .filter((c: any) => c.fecha && c.fecha < hoy)
    .sort((a: any, b: any) => String(b.fecha).localeCompare(String(a.fecha)))[0]
  const insumosIniciales = {
    tapas: cierreAnterior ? (Number(cierreAnterior.tapas_restantes) || 0) : store.tapas + tapasUsadas,
    precintos: cierreAnterior ? (Number(cierreAnterior.precintos_restantes) || 0) : store.precintos + precintosUsados,
    etiquetas: cierreAnterior
      ? (Number(cierreAnterior.etiquetas_restantes) || 0)
      : (store.etiquetas ?? 0) + precintosUsados,
  }

  // Tasa de apertura: la del primer movimiento del dia
  const tasaApertura = (() => {
    const primera = [...ventasHoy].sort((a: any, b: any) =>
      String(a.hora || '').localeCompare(String(b.hora || '')))[0]
    return parseFloat(primera?.tasa_bcv) || store.tasaBcv.valor
  })()

  // Saldos a favor: obligacion pendiente de la empresa
  const conSaldo = (store.clientes || []).filter(
    (c: any) => (parseFloat(c.saldo_usd) || 0) > 0
  )
  const saldoFavorTotal = conSaldo.reduce(
    (s: number, c: any) => s + (parseFloat(c.saldo_usd) || 0), 0
  )
  const clientesConSaldo = conSaldo.length

  const utilidadEstimada = ingresosUsd - litrosVendidos * COSTO_AGUA_POR_LITRO

  // Egresos de proveedores (solo diarios)
  const egresosProveedoresDiarios = config.proveedores
    .filter(p => p.frecuencia === 'diario')
    .map(p => ({ nombre: p.nombre, monto: p.montoPorPago, frecuencia: p.frecuencia }))
  const totalProveedoresDiarios = egresosProveedoresDiarios.reduce((s, p) => s + p.monto, 0)

  const utilidadNeta = utilidadEstimada - totalProveedoresDiarios

  const cierre = {
    id: crypto.randomUUID(),
    fecha: hoy,
    hora_cierre: new Date().toLocaleTimeString('es-VE'),
    tipo_cierre: 'diario',
    ingresos_usd: parseFloat(ingresosUsd.toFixed(2)),
    ingresos_pago_movil_usd: parseFloat(pagoMovilUsd.toFixed(2)),
    ingresos_punto_venta_usd: parseFloat(puntoVentaUsd.toFixed(2)),
    ingresos_banco_usd: parseFloat((pagoMovilUsd + puntoVentaUsd).toFixed(2)),
    litros_vendidos: litrosVendidos,
    // Agua FILTRADA disponible para venta (reservorio jumbo)
    litros_restantes: store.litrosJumbo,
    // Agua CRUDA pendiente de filtrar (tanques de 1.000 L)
    litros_crudos: (store.litrosTanques || []).reduce(
      (s: number, t: any) => s + (t.litros || 0), 0
    ),
    utilidad_estimada_usd: parseFloat(utilidadEstimada.toFixed(2)),
    utilidad_neta_usd: parseFloat(utilidadNeta.toFixed(2)),
    total_ventas: ventasHoy.length,
    // ── Flujo de caja separado por moneda ──────────────────
    caja_efectivo_usd: parseFloat(cajaEfectivoUsd.toFixed(2)),
    caja_efectivo_ves: parseFloat(cajaEfectivoVes.toFixed(2)),
    caja_banco_ves: parseFloat(cajaBancoVes.toFixed(2)),
    // ── Despachado sin cobro hoy ───────────────────────────
    sin_cobro_credito_usd: parseFloat(sinCobroCreditoUsd.toFixed(2)),
    sin_cobro_saldo_usd: parseFloat(sinCobroSaldoUsd.toFixed(2)),
    sin_cobro_prepago_usd: parseFloat(sinCobroPrepagoUsd.toFixed(2)),
    sin_cobro_cortesia_usd: parseFloat(sinCobroCortesiaUsd.toFixed(2)),
    // ── Tasas del dia (para explicar la diferencia cambiaria) ──
    tasa_apertura: tasaApertura,
    tasa_cierre: store.tasaBcv.valor,
    // ── Saldos a favor: obligacion de la empresa ───────────
    saldo_favor_total_usd: parseFloat(saldoFavorTotal.toFixed(2)),
    saldo_favor_clientes: clientesConSaldo,
    // ── Insumos: inicial heredado del cierre anterior ──────
    tapas_iniciales: insumosIniciales.tapas,
    tapas_usadas: tapasUsadas,
    tapas_restantes: store.tapas,
    precintos_iniciales: insumosIniciales.precintos,
    precintos_usados: precintosUsados,
    precintos_restantes: store.precintos,
    etiquetas_iniciales: insumosIniciales.etiquetas,
    etiquetas_usadas: precintosUsados,
    etiquetas_restantes: store.etiquetas ?? 0,
    desglose_productos_json: JSON.stringify(desgloseProductos),
    desglose_pagos_json: JSON.stringify(desglosePagos),
    raw_ventas_json: JSON.stringify(ventasHoy),
    operario: config.operario,
    estacion: config.nombreEstacion,
    deudas_pendientes_usd: store.getTotalDeudaPendiente(),
    cobros_postpago_usd: 0,
    egresos_salarios_usd: 0,
    egresos_alquiler_usd: 0,
    egresos_proveedores_json: JSON.stringify(egresosProveedoresDiarios),
    notas_credito_json: '[]',
    es_automatico: true,
  }

  // Guardar en Sheets (bg)
  insertRow('cierres_caja', cierre).catch(() => {
    useAppStore.setState(s => ({
      pendientesSync: [...s.pendientesSync, { tipo: 'cierres_caja', data: cierre }]
    }))
  })

  marcarCierreGenerado()
  return cierre
}
