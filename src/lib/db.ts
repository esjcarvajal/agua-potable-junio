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
 * Descuenta litros de forma ATOMICA sobre el estado del servidor.
 *
 * Antes el descuento se calculaba sobre la copia en memoria del navegador y
 * luego se subia el snapshot completo. Con dos equipos abiertos, el segundo
 * en escribir pisaba al primero: una caja registraba la cisterna, otra
 * vendia sin haber recibido ese dato, y al subir su foto borraba los miles
 * de litros recien cargados. De ahi venia el "nunca descuenta nada".
 *
 * Ahora la resta ocurre DENTRO de la transaccion, sobre lo que hay en el
 * servidor en ese instante. Si alguien escribe en medio, Firebase reintenta
 * con el valor nuevo.
 *
 * Orden de descuento: primero los tanques de agua cruda (del ultimo al
 * primero), y solo si no alcanza se toca el reservorio filtrado.
 */
export async function descontarLitrosServidor(litros: number): Promise<{
    ok: boolean
    litrosJumbo: number
    litrosTanques: any[]
} | null> {
    const pedido = Math.max(0, Number(litros) || 0)
    if (pedido <= 0) return null
    try {
        const resultado = await runTransaction(ref(db, SNAPSHOT_PATH), (actual) => {
            // Nodo inexistente: abortar en vez de crearlo con datos inventados
            if (!actual) return
            let tanques: any[] = []
            try { tanques = JSON.parse(actual.litros_tanques_json || '[]') } catch { tanques = [] }

            let faltante = pedido
            for (let i = tanques.length - 1; i >= 0 && faltante > 0; i--) {
                const disponible = Math.max(0, Number(tanques[i].litros) || 0)
                const quitar = Math.min(disponible, faltante)
                tanques[i].litros = disponible - quitar
                faltante -= quitar
            }
            const jumbo = Math.max(0, Number(actual.litros_jumbo) || 0)
            const nuevoJumbo = Math.max(0, jumbo - faltante)

            return {
                ...actual,
                litros_jumbo: nuevoJumbo,
                litros_tanques_json: JSON.stringify(tanques),
                actualizado_en: new Date().toISOString(),
            }
        })
        if (!resultado.committed || !resultado.snapshot.exists()) return null
        const val = resultado.snapshot.val()
        let tanques: any[] = []
        try { tanques = JSON.parse(val.litros_tanques_json || '[]') } catch { tanques = [] }
        return { ok: true, litrosJumbo: Number(val.litros_jumbo) || 0, litrosTanques: tanques }
    } catch (err) {
        console.error('[descontarLitrosServidor] Error:', err)
        return null
    }
}

/**
 * Suma litros de forma ATOMICA (llegada de cisterna).
 *
 * Llena primero el reservorio filtrado hasta su tope y reparte el resto
 * entre los tanques de agua cruda. Lo que no cabe se devuelve como sobrante.
 */
export async function agregarLitrosServidor(litros: number, topeJumbo = 2500): Promise<{
    ok: boolean
    litrosJumbo: number
    litrosTanques: any[]
    jumboAgregado: number
    tanquesAgregado: number
    sobrante: number
} | null> {
    const pedido = Math.max(0, Number(litros) || 0)
    if (pedido <= 0) return null
    let jumboAgregado = 0
    let tanquesAgregado = 0
    let sobrante = 0
    try {
        const resultado = await runTransaction(ref(db, SNAPSHOT_PATH), (actual) => {
            if (!actual) return
            // Reiniciar acumuladores: la transaccion puede reintentarse
            jumboAgregado = 0; tanquesAgregado = 0; sobrante = 0

            let tanques: any[] = []
            try { tanques = JSON.parse(actual.litros_tanques_json || '[]') } catch { tanques = [] }

            const jumbo = Math.max(0, Number(actual.litros_jumbo) || 0)
            let restante = pedido

            const espacioJumbo = Math.max(0, topeJumbo - jumbo)
            jumboAgregado = Math.min(restante, espacioJumbo)
            restante -= jumboAgregado

            for (let i = 0; i < tanques.length && restante > 0; i++) {
                const cap = Number(tanques[i].capacidad) || 1000
                const lit = Math.max(0, Number(tanques[i].litros) || 0)
                const agregar = Math.min(restante, Math.max(0, cap - lit))
                tanques[i].litros = lit + agregar
                tanquesAgregado += agregar
                restante -= agregar
            }
            sobrante = restante

            return {
                ...actual,
                litros_jumbo: jumbo + jumboAgregado,
                litros_tanques_json: JSON.stringify(tanques),
                actualizado_en: new Date().toISOString(),
            }
        })
        if (!resultado.committed || !resultado.snapshot.exists()) return null
        const val = resultado.snapshot.val()
        let tanques: any[] = []
        try { tanques = JSON.parse(val.litros_tanques_json || '[]') } catch { tanques = [] }
        return {
            ok: true,
            litrosJumbo: Number(val.litros_jumbo) || 0,
            litrosTanques: tanques,
            jumboAgregado, tanquesAgregado, sobrante,
        }
    } catch (err) {
        console.error('[agregarLitrosServidor] Error:', err)
        return null
    }
}

/**
 * Suma (o resta) al total adeudado de un cliente de forma ATOMICA.
 *
 * Antes las ventas a credito guardaban la deuda en su propia tabla pero
 * nunca tocaban deudaTotalUsd del cliente, mientras que los abonos SI lo
 * restaban. Esa asimetria hacia que el saldo derivara a cero: el cliente
 * podia llevarse mercancia indefinidamente sin que el limite de credito
 * lo detuviera.
 */
export async function ajustarDeudaCliente(clienteId: string, delta: number): Promise<number | null> {
    const cambio = Number(delta) || 0
    if (!clienteId || cambio === 0) return null
    try {
        const resultado = await runTransaction(
            ref(db, `clientes/${clienteId}/deudaTotalUsd`),
            (actual) => {
                const base = Number(actual) || 0
                return Math.max(0, parseFloat((base + cambio).toFixed(2)))
            }
        )
        return resultado.committed ? (Number(resultado.snapshot.val()) || 0) : null
    } catch (err) {
        console.error('[ajustarDeudaCliente] Error:', err)
        return null
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
