import { useState, useEffect } from 'react'
import { insertRow, subscribeToNode } from './db'

const CONFIG_KEY = 'agua-potable-config'

export interface Proveedor {
  id: string
  nombre: string
  montoPorPago: number
  frecuencia: 'diario' | 'semanal' | 'mensual'
}

export interface ConfigNegocio {
  nombreEstacion: string
  operario: string
  capacidadJumbo: number
  metaDiaria: number
  alquilerMensualUsd: number
  proveedores: Proveedor[]
}

const DEFAULTS: ConfigNegocio = {
  nombreEstacion: 'Sucursal - Naguanagua',
  operario: 'Operario',
  capacidadJumbo: 2500,
  metaDiaria: 500,
  alquilerMensualUsd: 0,
  proveedores: [
    { id: 'prov-cisterna', nombre: 'Cisterna de Agua', montoPorPago: 0, frecuencia: 'semanal' },
    { id: 'prov-tapas',    nombre: 'Tapas y Precintos', montoPorPago: 0, frecuencia: 'mensual' },
    { id: 'prov-etiquetas', nombre: 'Etiquetas',        montoPorPago: 0, frecuencia: 'mensual' },
  ],
}

/** Lee la config actual del localStorage (síncrono) */
export function getConfig(): ConfigNegocio {
  try {
    const saved = localStorage.getItem(CONFIG_KEY)
    if (!saved) return DEFAULTS
    const parsed = JSON.parse(saved)
    return {
      ...DEFAULTS,
      ...parsed,
      proveedores: parsed.proveedores ?? DEFAULTS.proveedores,
    }
  } catch {
    return DEFAULTS
  }
}

/** Guarda la config en localStorage y en Firebase */
export function saveConfig(config: ConfigNegocio): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  // Despachar evento para que otras partes de la app se enteren
  window.dispatchEvent(new StorageEvent('storage', { key: CONFIG_KEY }))
  // Guardar en Firebase (asíncrono fire and forget)
  insertRow('configuraciones', { id: 'GLOBAL_CONFIG', ...config })
}

/** Hook reactivo: se actualiza cuando Admin guarda cambios o llegan de Firebase */
export function useConfig(): ConfigNegocio {
  const [config, setConfig] = useState<ConfigNegocio>(getConfig)

  useEffect(() => {
    // 1. Escuchar eventos locales (por si Admin guarda en la misma pantalla)
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONFIG_KEY) setConfig(getConfig())
    }
    window.addEventListener('storage', onStorage)

    // 2. Escuchar Firebase para sincronización en tiempo real entre equipos
    const unsubscribe = subscribeToNode('configuraciones', (data) => {
      const globalConfig = data.find((c: any) => c.id === 'GLOBAL_CONFIG') || data[0]
      if (globalConfig) {
        // Combinamos para asegurar estructura
        const nuevaConfig = {
          ...DEFAULTS,
          ...globalConfig,
          proveedores: globalConfig.proveedores ?? DEFAULTS.proveedores,
        }
        delete nuevaConfig.id // Limpiar el id de firebase si se coló
        
        // Guardar silenciosamente en localStorage para persistencia
        localStorage.setItem(CONFIG_KEY, JSON.stringify(nuevaConfig))
        setConfig(nuevaConfig)
      }
    })

    return () => {
      window.removeEventListener('storage', onStorage)
      unsubscribe()
    }
  }, [])

  return config
}
