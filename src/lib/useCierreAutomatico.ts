/**
 * useCierreAutomatico — Lógica para generar un cierre de caja automático
 * cuando la jornada laboral termina según el horario configurado.
 *
 * Se dispara desde Layout.tsx cuando detecta la transición ABIERTO → CERRADO.
 * Garantiza que solo se genera UN cierre por día (flag en localStorage).
 */
import { getConfig } from './useConfig'
import { insertRow } from './db'
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
  let pagoMovilUsd = 0
  let puntoVentaUsd = 0
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

    try {
      const items = JSON.parse(v.items_json || '[]')
      items.forEach((item: any) => {
        if (item.producto?.esRecarga) {
          litrosVendidos += (item.producto.litros || 0) * (item.cantidad || 1)
          tapasUsadas += item.cantidad || 1
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
    litros_restantes: store.litrosJumbo,
    utilidad_estimada_usd: parseFloat(utilidadEstimada.toFixed(2)),
    utilidad_neta_usd: parseFloat(utilidadNeta.toFixed(2)),
    total_ventas: ventasHoy.length,
    tapas_usadas: tapasUsadas,
    tapas_restantes: store.tapas,
    precintos_usados: tapasUsadas,
    precintos_restantes: store.precintos,
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
