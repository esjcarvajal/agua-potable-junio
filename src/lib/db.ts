import { db } from './firebase'
import { ref, set, update, get, child, onValue, off, remove } from 'firebase/database'

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