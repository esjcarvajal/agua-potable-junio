import { useState, useEffect } from 'react'
import { insertRow, subscribeToNode } from './db'

const PRODUCTOS_KEY = 'agua-potable-productos'

export interface ProductoConfig {
  id: string
  nombre: string
  precioUsd: number
  costoUsd: number
}

export const PRODUCTOS_DEFAULT: ProductoConfig[] = [
  { id: 'p1',  nombre: 'Recarga 19L',        precioUsd: 0.80, costoUsd: 0.30 },
  { id: 'p2',  nombre: 'Recarga 12L',        precioUsd: 0.75, costoUsd: 0.22 },
  { id: 'p3',  nombre: 'Recarga 8L',         precioUsd: 0.60, costoUsd: 0.18 },
  { id: 'p4',  nombre: 'Recarga 5L',         precioUsd: 0.50, costoUsd: 0.12 },
  { id: 'p5',  nombre: 'Botellón Nuevo 19L', precioUsd: 8.00, costoUsd: 4.00 },
  { id: 'p6',  nombre: 'Bolsa de Hielo',     precioUsd: 2.00, costoUsd: 0.80 },
  { id: 'p7',  nombre: 'Helado',             precioUsd: 3.50, costoUsd: 1.50 },
  { id: 'p8',  nombre: 'Botellón Nuevo 12L', precioUsd: 0,    costoUsd: 0 },
  { id: 'p9',  nombre: 'Botellón Nuevo 5L',  precioUsd: 0,    costoUsd: 0 },
  { id: 'p10', nombre: 'Tapas Reusables',    precioUsd: 0,    costoUsd: 0 },
  { id: 'p11', nombre: 'Dispensador de Agua', precioUsd: 0,   costoUsd: 0 },
  { id: 'p12', nombre: 'Agarraderos Manuales', precioUsd: 0,  costoUsd: 0 },
  { id: 'p13', nombre: 'Cepillos de Lavado', precioUsd: 0,    costoUsd: 0 },
]

/** Lee los productos desde localStorage (síncrono) */
export function getProductos(): ProductoConfig[] {
  try {
    const saved = localStorage.getItem(PRODUCTOS_KEY)
    if (!saved) return PRODUCTOS_DEFAULT
    const parsed: ProductoConfig[] = JSON.parse(saved)
    // Merge: si hay productos nuevos en DEFAULTS que no están guardados, los añade
    return PRODUCTOS_DEFAULT.map(def => {
      const found = parsed.find(p => p.id === def.id)
      return found ? { ...def, ...found } : def
    })
  } catch {
    return PRODUCTOS_DEFAULT
  }
}

/** Guarda los productos en localStorage Y en Firebase */
export function saveProductos(productos: ProductoConfig[]): void {
  localStorage.setItem(PRODUCTOS_KEY, JSON.stringify(productos))
  // Notificar otras pestañas del mismo navegador
  window.dispatchEvent(new StorageEvent('storage', { key: PRODUCTOS_KEY }))
  // Guardar en Firebase como un único documento con todos los productos
  insertRow('productos', { id: 'GLOBAL_PRODUCTOS', lista: JSON.stringify(productos) })
}

/**
 * Hook reactivo: devuelve siempre los precios actualizados.
 * Se actualiza cuando Admin guarda cambios (mismo o distinto dispositivo).
 */
export function useProductos(): ProductoConfig[] {
  const [productos, setProductos] = useState<ProductoConfig[]>(getProductos)

  useEffect(() => {
    // 1. Escuchar cambios en la misma pestaña/navegador
    const onStorage = (e: StorageEvent) => {
      if (e.key === PRODUCTOS_KEY) setProductos(getProductos())
    }
    window.addEventListener('storage', onStorage)

    // 2. Escuchar Firebase para sincronización entre dispositivos
    const unsubscribe = subscribeToNode('productos', (data) => {
      const globalProductos = data.find((p: any) => p.id === 'GLOBAL_PRODUCTOS') || data[0]
      if (globalProductos?.lista) {
        try {
          const parsed: ProductoConfig[] = JSON.parse(globalProductos.lista)
          // Guardar silenciosamente para persistencia offline
          localStorage.setItem(PRODUCTOS_KEY, JSON.stringify(parsed))
          setProductos(parsed)
        } catch {
          // Ignorar datos malformados
        }
      }
    })

    return () => {
      window.removeEventListener('storage', onStorage)
      unsubscribe()
    }
  }, [])

  return productos
}
