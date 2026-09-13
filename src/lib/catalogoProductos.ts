/**
 * Ficha técnica de cada producto: litros, si es recarga y si es desinfección.
 *
 * Estos tres datos deciden cuánta agua, cuántas tapas, precintos y etiquetas
 * consume una venta. Estaban escritos solo dentro de POS.tsx, así que
 * cualquier otra pantalla que registrara una entrega tenía que copiarlos —
 * y una copia que se desactualice descuenta mal el inventario sin avisar.
 *
 * Los PRECIOS no viven aquí: se configuran desde Administración y se leen
 * con useProductos(). Aquí solo está lo que no cambia.
 */

export interface FichaProducto {
    id: string
    nombre: string
    litros: number
    esRecarga: boolean
    esDesinfeccion?: boolean
}

export const CATALOGO_PRODUCTOS: FichaProducto[] = [
    { id: 'p1', nombre: 'Recarga 19L', litros: 19, esRecarga: true },
    { id: 'p2', nombre: 'Recarga 12L', litros: 12, esRecarga: true },
    { id: 'p3', nombre: 'Recarga 8L', litros: 8, esRecarga: true },
    { id: 'p4', nombre: 'Recarga 5L', litros: 5, esRecarga: true },
    { id: 'p5', nombre: 'Botellón Nuevo 19L', litros: 0, esRecarga: false },
    { id: 'p8', nombre: 'Botellón Nuevo 12L', litros: 0, esRecarga: false },
    { id: 'p9', nombre: 'Botellón Nuevo 5L', litros: 0, esRecarga: false },
    { id: 'p6', nombre: 'Bolsa de Hielo', litros: 0, esRecarga: false },
    { id: 'p7', nombre: 'Helado', litros: 0, esRecarga: false },
    { id: 'p10', nombre: 'Tapas Reusables', litros: 0, esRecarga: false },
    { id: 'p12', nombre: 'Agarraderos Manuales', litros: 0, esRecarga: false },
    { id: 'p11', nombre: 'Dispensador de Agua', litros: 0, esRecarga: false },
    { id: 'p13', nombre: 'Cepillos de Lavado', litros: 0, esRecarga: false },
    { id: 'p14', nombre: 'Desinfección 19L', litros: 19, esRecarga: false, esDesinfeccion: true },
    { id: 'p15', nombre: 'Desinfección 12L', litros: 12, esRecarga: false, esDesinfeccion: true },
    { id: 'p16', nombre: 'Desinfección 8L', litros: 8, esRecarga: false, esDesinfeccion: true },
]

/** Los que tiene sentido entregar a una empresa a crédito. */
export const PRODUCTOS_ENTREGA_CREDITO = [
    'p1', 'p2', 'p3', 'p4',   // recargas: el grueso del negocio
    'p5', 'p8', 'p9',         // botellones nuevos
    'p6', 'p7',               // hielo y helado
    'p10', 'p12', 'p11', 'p13',
]

export function fichaDe(id: string): FichaProducto | undefined {
    return CATALOGO_PRODUCTOS.find(p => p.id === id)
}
