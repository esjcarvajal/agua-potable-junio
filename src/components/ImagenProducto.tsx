import { useState, useEffect } from 'react'
import { Droplets, Package } from 'lucide-react'

/* ════════════════════════════════════════════════════════════════════
   IMAGEN DE PRODUCTO
   ════════════════════════════════════════════════════════════════════
   Las fotos se cargan por CONVENCIÓN desde /productos/{id}.webp
   (carpeta public/productos/ del repositorio).

   Ventaja: para cambiar o añadir una foto NO hace falta recompilar.
   Basta con subir el archivo a public_html/productos/ en el servidor.

   Si no existe la foto, se muestra un ícono de respaldo del mismo
   tamaño, de modo que la tarjeta nunca cambia de altura.
   ════════════════════════════════════════════════════════════════════ */

interface Props {
  /** ID del producto (p1, p2, …). Determina el nombre del archivo. */
  id: string
  /** Nombre del producto — se usa como texto alternativo */
  nombre: string
  /** Recargas muestran ícono de gota; el resto, ícono de paquete */
  esRecarga?: boolean
}

/** Extensiones que se intentan, en orden */
const EXTENSIONES = ['webp', 'png']

export default function ImagenProducto({ id, nombre, esRecarga = false }: Props) {
  const [intento, setIntento] = useState(0)

  // Si cambia el producto (ej. al reordenar la lista), reiniciar la búsqueda
  useEffect(() => { setIntento(0) }, [id])

  const agotado = intento >= EXTENSIONES.length
  const IconoRespaldo = esRecarga ? Droplets : Package

  return (
    <div
      className="w-full h-24 mb-2.5 rounded-lg bg-[#f7f9fc] dark:bg-[#1a1d27] overflow-hidden
        flex items-center justify-center"
    >
      {agotado ? (
        <IconoRespaldo
          size={28}
          className="text-gray-300 dark:text-gray-600"
          aria-hidden="true"
        />
      ) : (
        <img
          src={`/productos/${id}.${EXTENSIONES[intento]}`}
          alt={nombre}
          loading="lazy"
          decoding="async"
          onError={() => setIntento(n => n + 1)}
          className="max-w-full max-h-full object-contain"
        />
      )}
    </div>
  )
}
