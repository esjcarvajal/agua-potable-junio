/* ════════════════════════════════════════════════════════════════════
   UTILIDADES DE CARRITO — Cobertura parcial de prepago
   ════════════════════════════════════════════════════════════════════
   El carrito usa `cantidadPrepago` (número de unidades cubiertas por
   recargas prepagadas). Las ventas registradas antes de este cambio
   guardaron `usarPrepago` (booleano) dentro de `items_json`, por lo que
   toda lectura del histórico debe pasar por `normalizarItemCarrito`.
   ════════════════════════════════════════════════════════════════════ */

/** Unidades de la línea cubiertas por prepago (acepta formato viejo y nuevo) */
export function getPrepagadas(raw: any): number {
  if (!raw) return 0
  const cantidad = Number(raw.cantidad) || 0
  // Formato nuevo
  if (typeof raw.cantidadPrepago === 'number') {
    return Math.max(0, Math.min(raw.cantidadPrepago, cantidad))
  }
  // Formato histórico: el booleano cubría la línea completa
  return raw.usarPrepago ? cantidad : 0
}

/** Unidades de la línea que sí se cobran */
export function getPagadas(raw: any): number {
  const cantidad = Number(raw?.cantidad) || 0
  return Math.max(0, cantidad - getPrepagadas(raw))
}

/** Monto en USD que realmente se cobra por la línea */
export function precioLineaUsd(raw: any): number {
  const precio = Number(raw?.producto?.precio) || 0
  return precio * getPagadas(raw)
}

/** Convierte un ítem histórico al formato nuevo */
export function normalizarItemCarrito(raw: any) {
  if (!raw) return raw
  if (typeof raw.cantidadPrepago === 'number') return raw
  return { ...raw, cantidadPrepago: raw.usarPrepago ? (Number(raw.cantidad) || 0) : 0 }
}

export interface LineaRecibo {
  nombre: string
  cantidad: number
  precioUnit: number
  total: number
  esPrepago: boolean
}

/**
 * Expande el carrito en líneas de recibo. Una línea con cobertura parcial
 * se imprime como dos renglones (cobradas + prepagadas), de modo que
 * cantidad × precio unitario siempre cuadre con el total del renglón.
 */
export function expandirLineasRecibo(items: any[]): LineaRecibo[] {
  const lineas: LineaRecibo[] = []
  for (const item of items || []) {
    const nombre = item?.producto?.nombre ?? 'Producto'
    const precio = Number(item?.producto?.precio) || 0
    const pagadas = getPagadas(item)
    const prepagadas = getPrepagadas(item)

    if (pagadas > 0) {
      lineas.push({ nombre, cantidad: pagadas, precioUnit: precio, total: precio * pagadas, esPrepago: false })
    }
    if (prepagadas > 0) {
      lineas.push({ nombre: `${nombre} *`, cantidad: prepagadas, precioUnit: 0, total: 0, esPrepago: true })
    }
    // Línea con cantidad 0 (caso degenerado): mostrarla igual para no perder el ítem
    if (pagadas === 0 && prepagadas === 0) {
      lineas.push({ nombre, cantidad: 0, precioUnit: precio, total: 0, esPrepago: false })
    }
  }
  return lineas
}

/** Subtotal en USD de un carrito completo */
export function subtotalCarritoUsd(items: any[]): number {
  return (items || []).reduce((sum, item) => sum + precioLineaUsd(item), 0)
}
