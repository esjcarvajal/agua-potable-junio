import { db } from './firebase'
import { ref, set, update, get, child, onValue, off, remove, increment, runTransaction } from 'firebase/database'

// Firebase db.ts

// ----------------------------------------------------------------------
// FIREBASE REALTIME DB ADAPTER
// ----------------------------------------------------------------------

// Helper to remove undefined values before sending to Firebase
function cleanObject(obj: any): any {
    return JSON.parse(JSON.stringify(obj))
}

export async function readSheet(sheetName: string): Promise<any[]> {
    try {
        const snapshot = await get(child(ref(db), sheetName))
        if (snapshot.exists()) {
            const data = snapshot.val()
            // Si es un objeto (como Firebase guarda listas asociativas), conviértelo a array
            return Object.values(data)
        }
        return []
    } catch (err) {
        console.error(`[readSheet - ${sheetName}] Error:`, err)
        return []
    }
}

export async function insertRow(sheetName: string, row: Record<string, any>): Promise<boolean> {
    try {
        // Asume que todos los rows tienen un id
        const id = row.id || crypto.randomUUID()
        const cleanRow = cleanObject({ ...row, id })
        await set(ref(db, `${sheetName}/${id}`), cleanRow)
        return true
    } catch (err) {
        console.error(`[insertRow - ${sheetName}] Error:`, err)
        return false
    }
}

export async function updateRow(sheetName: string, id: string, row: Record<string, any>): Promise<boolean> {
    try {
        const cleanRow = cleanObject(row)
        await update(ref(db, `${sheetName}/${id}`), cleanRow)
        return true
    } catch (err) {
        console.error(`[updateRow - ${sheetName}] Error:`, err)
        return false
    }
}

export async function deleteNode(sheetName: string): Promise<boolean> {
    try {
        await remove(ref(db, sheetName))
        return true
    } catch (err) {
        console.error(`[deleteNode - ${sheetName}] Error:`, err)
        return false
    }
}

// NUEVO: Para suscripciones en tiempo real
export function subscribeToNode(path: string, callback: (data: any[]) => void) {
    const nodeRef = ref(db, path)
    const unsubscribe = onValue(nodeRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val()
            // Convertir objeto asociativo a array
            callback(Object.values(data))
        } else {
            callback([])
        }
    })
    
    // Devolver función para desuscribirse
    return () => off(nodeRef, 'value', unsubscribe)
}

// ----------------------------------------------------------------------
// INVENTARIO: OPERACIONES ATOMICAS
// ----------------------------------------------------------------------
//
// Por que existen estas funciones:
//
// El inventario se guardaba subiendo la FOTO COMPLETA (todos los campos a
// la vez) cada vez que algo cambiaba. Con dos equipos trabajando --el del
// dueno y el de caja-- el ultimo en escribir pisaba los cambios del otro
// en TODOS los campos, no solo en el que habia tocado.
//
// Caso real: se compran 1000 tapas en un equipo (tapas pasa a 1391);
// medio minuto despues el otro equipo, que aun tenia 391 en memoria,
// registra una venta y sube su foto completa con 389. Las 1000 tapas
// desaparecen sin dejar rastro.
//
// increment() lo resuelve en el servidor: "sumale -2 a tapas" es una
// instruccion que no depende de lo que el cliente creyera que habia.

const SNAPSHOT_PATH = 'inventario_snapshot/INVENTARIO_SNAPSHOT'

/**
 * Suma (o resta, con delta negativo) a varios campos del inventario de forma
 * atomica. No pisa los campos que no se mencionan.
 */
export async function ajustarInventario(deltas: Record<string, number>): Promise<boolean> {
    try {
        const cambios: Record<string, any> = {}
        for (const [campo, delta] of Object.entries(deltas)) {
            if (!Number.isFinite(delta) || delta === 0) continue
            cambios[campo] = increment(delta)
        }
        if (Object.keys(cambios).length === 0) return true
        cambios.actualizado_en = new Date().toISOString()
        await update(ref(db, SNAPSHOT_PATH), cambios)
        return true
    } catch (err) {
        console.error('[ajustarInventario] Error:', err)
        return false
    }
}

/**
 * Fija un campo a un valor exacto. Para conteos fisicos, donde el usuario
 * dice "hay 40 tapas" y no "sumale 40".
 *
 * Usa transaccion para no perder descuentos que ocurran a la vez: si entre
 * la lectura y la escritura alguien vendio, el servidor reintenta.
 */
export async function fijarInventario(campo: string, valor: number): Promise<boolean> {
    try {
        const limpio = Math.max(0, Math.round(Number(valor) || 0))
        await runTransaction(ref(db, `${SNAPSHOT_PATH}/${campo}`), () => limpio)
        await update(ref(db, SNAPSHOT_PATH), { actualizado_en: new Date().toISOString() })
        return true
    } catch (err) {
        console.error('[fijarInventario] Error:', err)
        return false
    }
}

/**
 * Deja constancia de un movimiento de inventario.
 *
 * Antes no existia ningun historial: solo la foto actual, que se
 * sobrescribia. Cuando los numeros no cuadraban no habia forma de saber
 * por que, ni siquiera consultando la base de datos.
 *
 * No bloquea la operacion principal: si falla el registro, la venta o la
 * compra siguen adelante. Perder una linea de historial es menos grave que
 * perder una venta.
 */
export async function registrarMovimiento(mov: {
    campo: string
    delta: number
    motivo: 'venta' | 'compra' | 'ajuste' | 'conteo' | 'cortesia' | 'anulacion'
    usuario?: string
    referencia?: string
    nota?: string
}): Promise<void> {
    try {
        const id = crypto.randomUUID()
        await set(ref(db, `movimientos_inventario/${id}`), {
            id,
            campo: mov.campo,
            delta: mov.delta,
            motivo: mov.motivo,
            usuario: mov.usuario || 'desconocido',
            referencia: mov.referencia || '',
            nota: mov.nota || '',
            fecha: new Date().toISOString(),
        })
    } catch (err) {
        console.error('[registrarMovimiento] Error:', err)
    }
}
