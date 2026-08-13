import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { insertRow, updateRow, subscribeToNode, deleteNode } from '../lib/db'

export interface DeudaPostpago {
    id: string
    clienteId: string
    clienteNombre: string
    ventaId: string
    montoUsd: number
    /** Acumulado abonado. Ausente en deudas anteriores a esta version. */
    montoPagadoUsd?: number
    fechaVenta: string
    fechaVencimiento: string
    ciclo: 7 | 15 | 30
    estado: 'pendiente' | 'vencida' | 'pagada'
    fechaPago?: string
    notas?: string
}

interface Correccion {
    ventaId: string
    motivo: string
    adminNombre: string
    fecha: string
}

export interface ConfigPostpago {
    ciclo: 7 | 15 | 30
    limiteCredito: number
    activo: boolean
}

interface TasaBcv {
    valor: number
    fecha: string
    fuente: 'api' | 'manual'
}

interface Tanque {
    id: string
    nombre: string
    litros: number
    capacidad: number
}

interface RegistroCisternaResult {
    almacenados: number
    sobrante: number
    jumboAgregado: number
    tanquesAgregado: number
}

interface AppState {
    // TASA BCV
    tasaBcv: TasaBcv
    isFetchingTasa: boolean
    setTasaManual: (valor: number) => void
    fetchTasaBcv: (force?: boolean) => Promise<void>

    // AGUA
    litrosJumbo: number
    litrosTanques: Tanque[]
    litrosVendidosHoy: number
    litrosMermaHoy: number
    setLitrosJumbo: (litros: number) => void
    descontarLitros: (litros: number) => void
    registrarCisterna: (litros: number) => RegistroCisternaResult

    // VENTAS
    ventas: any[]
    pendientesSync: any[]
    isSyncing: boolean
    agregarVenta: (venta: any) => Promise<void>

    // CLIENTES
    clientes: any[]
    agregarCliente: (cliente: any) => Promise<void>
    actualizarCliente: (id: string, datos: any) => Promise<void>

    // PREPAGOS
    prepagos: any[]
    agregarPrepago: (prepago: any) => Promise<void>

    // POST-PAGO DEUDAS
    deudas: DeudaPostpago[]
    agregarDeuda: (deuda: DeudaPostpago) => Promise<void>
    /** Suma dinero al saldo a favor del cliente (abono o vuelto guardado) */
    abonarSaldoFavor: (clienteId: string, montoUsd: number) => Promise<number>
    /** Abono parcial a una deuda. Devuelve lo realmente aplicado. */
    abonarDeuda: (deudaId: string, montoUsd: number, metodoPago?: string, notas?: string) => Promise<number>
    /** Descuenta del saldo a favor. Devuelve lo realmente consumido. */
    consumirSaldoFavor: (clienteId: string, montoUsd: number) => Promise<number>
    marcarDeudaPagada: (deudaId: string, metodoPago?: string, notas?: string) => Promise<void>
    getDeudasCliente: (clienteId: string) => DeudaPostpago[]
    getDeudasVencidas: () => DeudaPostpago[]
    getTotalDeudaPendiente: () => number

    // CORRECCIONES
    correcciones: Correccion[]
    registrarCorreccion: (ventaId: string, motivo: string, adminNombre: string) => void

    // INSUMOS
    tapas: number
    precintos: number
    etiquetas: number
    descontarInsumos: (tapasUsadas: number, precintosUsados: number, etiquetasUsadas: number) => void

    // PRODUCTOS DE INVENTARIO
    botellonNuevo19L: number
    botellonNuevo12L: number
    botellonNuevo5L: number
    tapasReusables: number
    hielo: number
    helado: number
    dispensadorAgua: number
    agarraderosManuales: number
    cepillosLavado: number
    descontarProductos: (productos: Partial<Record<'botellonNuevo19L' | 'botellonNuevo12L' | 'botellonNuevo5L' | 'tapasReusables' | 'hielo' | 'helado' | 'dispensadorAgua' | 'agarraderosManuales' | 'cepillosLavado', number>>) => void

    // ENTREGAS
    marcarDeliveryCompletado: (ventaId: string) => Promise<void>

    // INVENTARIO SYNC
    ultimoSyncInventario: string | null
    pushInventario: () => Promise<void>

    // SYNC (Realtime)
    initFirebaseSubscriptions: () => void

    // UTILS
    usdToVes: (monto: number) => string
    formatUsd: (monto: number) => string
    resetLocalDataExceptClientes: () => Promise<void>
}

const TANQUES_INICIALES: Tanque[] = Array.from({ length: 11 }, (_, i) => ({
    id: `TK-${String(i + 1).padStart(2, '0')}`,
    nombre: `Tanque ${i + 1}`,
    litros: 0,
    capacidad: 1000
}))

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            tasaBcv: { valor: 478.00, fecha: new Date().toISOString(), fuente: 'manual' },
            isFetchingTasa: false,

            setTasaManual: (valor) => {
                const tasa = { valor, fecha: new Date().toISOString(), fuente: 'manual' as const }
                set({ tasaBcv: tasa })
                insertRow('tasas_bcv', { id: crypto.randomUUID(), fecha: new Date().toISOString(), tasa: valor, fuente: 'manual' })
            },

            fetchTasaBcv: async (force = false) => {
                const currentFuente = get().tasaBcv.fuente;
                if (currentFuente === 'manual' && !force) {
                    return;
                }

                set({ isFetchingTasa: true })
                try {
                    // Intento 1: Endpoint directo (más rápido, respuesta single object)
                    let valor: number | null = null

                    try {
                        const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial')
                        if (res.ok) {
                            const data = await res.json()
                            valor = data?.promedio || data?.venta || data?.compra || null
                        }
                    } catch {
                        // Silently fall through to fallback
                    }

                    // Intento 2: Endpoint general con filtro
                    if (!valor) {
                        try {
                            const res = await fetch('https://ve.dolarapi.com/v1/dolares')
                            const data = await res.json()
                            const oficial = Array.isArray(data) ? data.find((d: any) => d.fuente === 'oficial') : null
                            valor = oficial?.promedio || oficial?.venta || oficial?.compra || null
                        } catch {
                            // Silently fall through
                        }
                    }

                    if (valor) {
                        const tasaNum = typeof valor === 'string' ? parseFloat(valor) : valor
                        if (tasaNum > 0) {
                            const tasa = { valor: tasaNum, fecha: new Date().toISOString(), fuente: 'api' as const }
                            set({ tasaBcv: tasa })
                            insertRow('tasas_bcv', { id: crypto.randomUUID(), fecha: new Date().toISOString(), tasa: tasaNum, fuente: 'api' })
                        }
                    }
                } catch {
                    console.log('BCV API no disponible, usando tasa guardada')
                } finally {
                    set({ isFetchingTasa: false })
                }
            },

            litrosJumbo: 0,
            litrosTanques: TANQUES_INICIALES,
            litrosVendidosHoy: 0,
            litrosMermaHoy: 0,
            setLitrosJumbo: (litros) => set({ litrosJumbo: Math.min(litros, 2500) }),
            descontarLitros: (litros) => {
                const s = get()
                let faltante = litros
                const nuevosTanques = [...s.litrosTanques].map(t => ({ ...t }))
                
                // Descontar primero de los tanques de 1000L (empezando por el último con agua)
                for (let i = nuevosTanques.length - 1; i >= 0 && faltante > 0; i--) {
                    const quitar = Math.min(nuevosTanques[i].litros, faltante)
                    nuevosTanques[i].litros -= quitar
                    faltante -= quitar
                }

                // Si aún falta por descontar, se quita del Jumbo (2500L)
                const nuevoJumbo = Math.max(0, s.litrosJumbo - faltante)

                set({
                    litrosTanques: nuevosTanques,
                    litrosJumbo: nuevoJumbo,
                    litrosVendidosHoy: s.litrosVendidosHoy + litros
                })
                // Publicar snapshot al cloud después de cada venta
                setTimeout(() => get().pushInventario(), 500)
            },

            /**
             * Registra la llegada de una cisterna distribuyendo los litros de forma
             * secuencial SIN pérdida:
             *   1. Llena los 11 tanques de almacenamiento (1,000L c/u) en orden
             *   2. El sobrante va al Reservorio Maestro (hasta 2,500L)
             *   3. Si aún queda, se reporta como sobrante
             */
            registrarCisterna: (litros: number): RegistroCisternaResult => {
                const state = get()
                let restante = litros

                // Paso 1: Llenar el Jumbo (Reservorio Maestro) de 2500L primero
                const espacioJumbo = 2500 - state.litrosJumbo
                const jumboAgregado = Math.min(restante, Math.max(0, espacioJumbo))
                restante -= jumboAgregado

                // Paso 2: El resto va a los 11 tanques de 1000L secuencialmente
                const nuevosTanques = state.litrosTanques.map(t => ({ ...t }))
                let tanquesAgregado = 0
                for (let i = 0; i < nuevosTanques.length && restante > 0; i++) {
                    const espacio = nuevosTanques[i].capacidad - nuevosTanques[i].litros
                    const agregar = Math.min(restante, espacio)
                    nuevosTanques[i].litros += agregar
                    tanquesAgregado += agregar
                    restante -= agregar
                }

                // Aplicar cambios al store
                set({
                    litrosTanques: nuevosTanques,
                    litrosJumbo: state.litrosJumbo + jumboAgregado,
                })
                // Publicar snapshot al cloud
                setTimeout(() => get().pushInventario(), 500)

                return {
                    almacenados: litros - restante,
                    sobrante: restante,
                    jumboAgregado,
                    tanquesAgregado,
                }
            },

            ventas: [],
            pendientesSync: [],
            isSyncing: false,

            agregarVenta: async (venta) => {
                set((s) => ({ ventas: [venta, ...s.ventas] }))
                insertRow('ventas', venta)
            },

            clientes: [],
            agregarCliente: async (cliente) => {
                set((s) => ({ clientes: [...s.clientes, cliente] }))
                insertRow('clientes', cliente)
            },
            actualizarCliente: async (id, datos) => {
                set((s) => ({ clientes: s.clientes.map(c => c.id === id ? { ...c, ...datos } : c) }))
                updateRow('clientes', id, datos)
            },

            prepagos: [],
            agregarPrepago: async (prepago) => {
                set((s) => ({ prepagos: [...s.prepagos, prepago] }))
                insertRow('prepagos', prepago)
            },

            // ── Saldo a favor del cliente ─────────────────────────
            // Dinero del cliente sin producto asignado. A diferencia del
            // prepago (que son N recargas de un litraje), el saldo es un
            // monto en USD aplicable a cualquier compra o a su deuda.
            abonarSaldoFavor: async (clienteId, montoUsd) => {
                const monto = Math.max(0, Number(montoUsd) || 0)
                if (monto <= 0) return 0
                const s = get()
                const cliente = s.clientes.find(c => c.id === clienteId)
                if (!cliente) return 0
                const nuevoSaldo = (parseFloat(cliente.saldo_usd) || 0) + monto
                set((st) => ({
                    clientes: st.clientes.map(c =>
                        c.id === clienteId ? { ...c, saldo_usd: nuevoSaldo } : c)
                }))
                updateRow('clientes', clienteId, { saldo_usd: nuevoSaldo })
                return nuevoSaldo
            },
            consumirSaldoFavor: async (clienteId, montoUsd) => {
                const solicitado = Math.max(0, Number(montoUsd) || 0)
                if (solicitado <= 0) return 0
                const s = get()
                const cliente = s.clientes.find(c => c.id === clienteId)
                if (!cliente) return 0
                const disponible = parseFloat(cliente.saldo_usd) || 0
                // Nunca consumir mas de lo que hay: evita saldos negativos
                const consumido = Math.min(disponible, solicitado)
                if (consumido <= 0) return 0
                const nuevoSaldo = Math.max(0, disponible - consumido)
                set((st) => ({
                    clientes: st.clientes.map(c =>
                        c.id === clienteId ? { ...c, saldo_usd: nuevoSaldo } : c)
                }))
                updateRow('clientes', clienteId, { saldo_usd: nuevoSaldo })
                return consumido
            },

            deudas: [],
            agregarDeuda: async (deuda) => {
                set((s) => ({ deudas: [deuda, ...s.deudas] }))
                insertRow('deudas_postpago', deuda)
            },
            // ── Abono parcial a deuda ─────────────────────────────
            // Permite amortizar una deuda por partes. Si el abono cubre
            // el pendiente, la deuda pasa a 'pagada'; si no, sigue
            // pendiente con el acumulado actualizado.
            abonarDeuda: async (deudaId, montoUsd, metodoPago = 'EFECTIVO USD', notas = '') => {
                const s = get()
                const deuda = s.deudas.find(d => d.id === deudaId)
                if (!deuda || deuda.estado === 'pagada') return 0

                const total = Math.max(0, Number(deuda.montoUsd) || 0)
                // Deudas antiguas no tienen el campo: se asume 0 abonado
                const yaPagado = Math.max(0, Number(deuda.montoPagadoUsd) || 0)
                const pendiente = Math.max(0, total - yaPagado)
                if (pendiente <= 0) return 0

                const solicitado = Math.max(0, Number(montoUsd) || 0)
                // Nunca abonar mas de lo que se debe
                const abonado = Math.min(solicitado, pendiente)
                if (abonado <= 0) return 0

                const nuevoPagado = yaPagado + abonado
                const quedaSaldada = nuevoPagado >= total - 0.001
                const nuevaFecha = new Date().toISOString()

                const updated = {
                    ...deuda,
                    montoPagadoUsd: nuevoPagado,
                    estado: quedaSaldada ? ('pagada' as const) : deuda.estado,
                    ...(quedaSaldada ? { fechaPago: nuevaFecha } : {}),
                    notas: [deuda.notas, notas].filter(Boolean).join(' · '),
                }
                set((st) => ({ deudas: st.deudas.map(d => d.id === deudaId ? updated : d) }))

                // Descontar del total adeudado del cliente SOLO lo abonado
                const cliente = s.clientes.find(c => c.id === deuda.clienteId)
                if (cliente) {
                    const nuevaDeudaTotal = Math.max(0, (Number(cliente.deudaTotalUsd) || 0) - abonado)
                    set((st) => ({
                        clientes: st.clientes.map(c =>
                            c.id === cliente.id ? { ...c, deudaTotalUsd: nuevaDeudaTotal } : c)
                    }))
                    updateRow('clientes', cliente.id, { deudaTotalUsd: nuevaDeudaTotal })
                }

                // Registrar el abono como venta: es dinero que entra a caja
                const abonoVenta = {
                    id: crypto.randomUUID(),
                    fecha: nuevaFecha.split('T')[0],
                    hora: new Date(nuevaFecha).toLocaleTimeString(),
                    cliente_id: deuda.clienteId,
                    cliente_nombre: deuda.clienteNombre,
                    items_json: JSON.stringify([{ tipo: 'ABONO_POSTPAGO', ref_deuda: deudaId, monto: abonado }]),
                    total_usd: abonado,
                    tasa_bcv: s.tasaBcv.valor,
                    metodo_pago: metodoPago,
                    es_delivery: false,
                    costo_delivery_usd: 0,
                    notas: `ABONO POST-PAGO (Factura: ${deuda.ventaId}) $${abonado.toFixed(2)} de $${total.toFixed(2)}${quedaSaldada ? ' — SALDADA' : ` — restan $${(total - nuevoPagado).toFixed(2)}`} ${notas}`,
                }
                set((st) => ({ ventas: [abonoVenta, ...st.ventas] }))

                updateRow('deudas_postpago', deudaId, {
                    montoPagadoUsd: nuevoPagado,
                    estado: updated.estado,
                    ...(quedaSaldada ? { fecha_pago: nuevaFecha } : {}),
                })
                insertRow('ventas', abonoVenta)

                return abonado
            },

            marcarDeudaPagada: async (deudaId, metodoPago = 'EFECTIVO USD', notas = '') => {
                const s = get()
                const deuda = s.deudas.find(d => d.id === deudaId)
                if (!deuda) return

                const nuevaFecha = new Date().toISOString()
                // Si ya hubo abonos parciales, solo queda por cobrar el resto
                const yaPagado = Math.max(0, Number(deuda.montoPagadoUsd) || 0)
                const pendiente = Math.max(0, (Number(deuda.montoUsd) || 0) - yaPagado)
                const updatedDeuda = {
                    ...deuda,
                    estado: 'pagada' as const,
                    montoPagadoUsd: Number(deuda.montoUsd) || 0,
                    fechaPago: nuevaFecha,
                    notas,
                }

                // Actualizar estado local de la deuda
                set((s) => ({ deudas: s.deudas.map(d => d.id === deudaId ? updatedDeuda : d) }))

                // Actualizar estado local del cliente restándole a su deuda
                const cliente = s.clientes.find(c => c.id === deuda.clienteId)
                if (cliente) {
                    const nuevaDeudaTotal = Math.max(0, (cliente.deudaTotalUsd || 0) - pendiente)
                    set((s) => ({ clientes: s.clientes.map(c => c.id === cliente.id ? { ...c, deudaTotalUsd: nuevaDeudaTotal } : c) }))
                    updateRow('clientes', cliente.id, { deudaTotalUsd: nuevaDeudaTotal })
                }

                // Generar cobro como venta
                const cobroVenta = {
                    id: crypto.randomUUID(),
                    fecha: nuevaFecha.split('T')[0],
                    hora: new Date(nuevaFecha).toLocaleTimeString(),
                    cliente_id: deuda.clienteId,
                    cliente_nombre: deuda.clienteNombre,
                    items_json: JSON.stringify([{ tipo: 'COBRO_POSTPAGO', ref_deuda: deudaId, monto: pendiente }]),
                    total_usd: pendiente,
                    tasa_bcv: s.tasaBcv.valor,
                    metodo_pago: metodoPago,
                    es_delivery: false,
                    costo_delivery_usd: 0,
                    notas: `COBRO POST-PAGO (Factura: ${deuda.ventaId}) ${notas}`,
                }
                set((s) => ({ ventas: [cobroVenta, ...s.ventas] }))
                
                // Disparar las promesas en bg
                updateRow('deudas_postpago', deudaId, { estado: 'pagada', montoPagadoUsd: Number(deuda.montoUsd) || 0, fecha_pago: nuevaFecha, notas })
                insertRow('ventas', cobroVenta)
            },
            getDeudasCliente: (clienteId) => get().deudas.filter(d => d.clienteId === clienteId),
            getDeudasVencidas: () => {
                const hoy = new Date().toISOString()
                return get().deudas.filter(d => d.estado === 'pendiente' && d.fechaVencimiento < hoy)
            },
            getTotalDeudaPendiente: () => get().deudas.filter(d => d.estado === 'pendiente').reduce((sum, d) => sum + d.montoUsd, 0),

            correcciones: [],
            registrarCorreccion: (ventaId, motivo, adminNombre) => {
                set(state => ({
                    correcciones: [...state.correcciones, {
                        ventaId,
                        motivo,
                        adminNombre,
                        fecha: new Date().toISOString()
                    }]
                }))
            },

            tapas: 0,
            precintos: 0,
            etiquetas: 0,
            descontarInsumos: (tapasUsadas, precintosUsados, etiquetasUsadas) => {
                set((s) => ({
                    tapas: Math.max(0, s.tapas - tapasUsadas),
                    precintos: Math.max(0, s.precintos - precintosUsados),
                    etiquetas: Math.max(0, s.etiquetas - etiquetasUsadas)
                }))
                // Publicar snapshot al cloud
                setTimeout(() => get().pushInventario(), 500)
            },

            // PRODUCTOS DE INVENTARIO
            botellonNuevo19L: 0,
            botellonNuevo12L: 0,
            botellonNuevo5L: 0,
            tapasReusables: 0,
            hielo: 0,
            helado: 0,
            dispensadorAgua: 0,
            agarraderosManuales: 0,
            cepillosLavado: 0,
            descontarProductos: (productos) => {
                set((s) => {
                    const updates: any = {}
                    for (const [key, qty] of Object.entries(productos)) {
                        if (qty && qty > 0 && key in s) {
                            updates[key] = Math.max(0, (s as any)[key] - qty)
                        }
                    }
                    return updates
                })
                setTimeout(() => get().pushInventario(), 500)
            },

            marcarDeliveryCompletado: async (ventaId) => {
                // FIX: actualizar estado_delivery (campo que usa el filtro de entregas activas)
                set((s) => ({
                    ventas: s.ventas.map(v =>
                        v.id === ventaId
                            ? { ...v, estado_delivery: 'completado', estado: 'completado' }
                            : v
                    )
                }))
                await updateRow('ventas', ventaId, { estado_delivery: 'completado', estado: 'completado' })
            },

            ultimoSyncInventario: null,

            pushInventario: async () => {
                const s = get()
                const snapshot = {
                    id: 'INVENTARIO_SNAPSHOT',
                    litros_jumbo: s.litrosJumbo,
                    litros_tanques_json: JSON.stringify(s.litrosTanques),
                    tapas: s.tapas,
                    precintos: s.precintos,
                    etiquetas: s.etiquetas,
                    botellon_nuevo_19l: s.botellonNuevo19L,
                    botellon_nuevo_12l: s.botellonNuevo12L,
                    botellon_nuevo_5l: s.botellonNuevo5L,
                    tapas_reusables: s.tapasReusables,
                    hielo: s.hielo,
                    helado: s.helado,
                    dispensador_agua: s.dispensadorAgua,
                    agarraderos_manuales: s.agarraderosManuales,
                    cepillos_lavado: s.cepillosLavado,
                    actualizado_en: new Date().toISOString(),
                }
                await updateRow('inventario_snapshot', 'INVENTARIO_SNAPSHOT', snapshot)
            },

            initFirebaseSubscriptions: () => {
                set({ isSyncing: true })
                
                // Suscripción a Ventas
                subscribeToNode('ventas', (data) => {
                    // Ordenar por fecha descendente o como se requiera
                    set({ ventas: data.reverse() })
                })

                // Suscripción a Clientes
                subscribeToNode('clientes', (data) => set({ clientes: data }))

                // Suscripción a Prepagos
                subscribeToNode('prepagos', (data) => set({ prepagos: data }))

                // Suscripción a Deudas Postpago
                subscribeToNode('deudas_postpago', (data) => {
                    const deudasMapeadas = data.map((d: any) => ({
                        id: d.id,
                        clienteId: d.clienteId || d.cliente_id,
                        clienteNombre: d.clienteNombre || d.cliente_nombre,
                        ventaId: d.ventaId || d.venta_id,
                        montoUsd: parseFloat(d.montoUsd || d.monto_usd) || 0,
                        fechaVenta: d.fechaVenta || d.fecha_venta,
                        fechaVencimiento: d.fechaVencimiento || d.fecha_vencimiento,
                        ciclo: (parseInt(d.ciclo) || 7) as 7 | 15 | 30,
                        estado: d.estado,
                        fechaPago: d.fechaPago || d.fecha_pago,
                        notas: d.notas || ''
                    }))
                    set({ deudas: deudasMapeadas.reverse() })
                })

                // Suscripción al Inventario Global
                subscribeToNode('inventario_snapshot', (data) => {
                    if (!Array.isArray(data) || data.length === 0) return
                    const row = data.find(r => r.id === 'INVENTARIO_SNAPSHOT') || data[0]
                    if (!row) return

                    const jumboSnap = parseFloat(row.litros_jumbo) || 0
                    let tanquesSnap = TANQUES_INICIALES
                    try {
                        const parsed = JSON.parse(row.litros_tanques_json || '[]')
                        if (parsed.length > 0) tanquesSnap = parsed
                    } catch { /* keep defaults */ }
                    
                    const s = get()
                    set({
                        litrosJumbo: jumboSnap,
                        litrosTanques: tanquesSnap,
                        tapas: parseInt(row.tapas) || s.tapas,
                        precintos: parseInt(row.precintos) || s.precintos,
                        etiquetas: parseInt(row.etiquetas) || s.etiquetas,
                        botellonNuevo19L: parseInt(row.botellon_nuevo_19l) || s.botellonNuevo19L,
                        botellonNuevo12L: parseInt(row.botellon_nuevo_12l) || s.botellonNuevo12L,
                        botellonNuevo5L: parseInt(row.botellon_nuevo_5l) || s.botellonNuevo5L,
                        tapasReusables: parseInt(row.tapas_reusables) || s.tapasReusables,
                        hielo: parseInt(row.hielo) || s.hielo,
                        helado: parseInt(row.helado) || s.helado,
                        dispensadorAgua: parseInt(row.dispensador_agua) || s.dispensadorAgua,
                        agarraderosManuales: parseInt(row.agarraderos_manuales) || s.agarraderosManuales,
                        cepillosLavado: parseInt(row.cepillos_lavado) || s.cepillosLavado,
                        ultimoSyncInventario: row.actualizado_en || new Date().toISOString(),
                        isSyncing: false
                    })
                })
            },

            usdToVes: (monto) => {
                const { tasaBcv } = get()
                return (monto * tasaBcv.valor).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' VES'
            },
            formatUsd: (monto) => '$' + monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            resetLocalDataExceptClientes: async () => {
                // 1. Borrar nodos en Firebase (excepto clientes y tasas_bcv)
                const nodosABorrar = [
                    'ventas',
                    'prepagos',
                    'deudas_postpago',
                    'cierres_caja',
                    'movimientos_agua',
                    'inventario_snapshot'
                ]
                await Promise.all(nodosABorrar.map(nodo => deleteNode(nodo)))

                // 2. Limpiar estado local de Zustand
                set({
                    litrosJumbo: 0,
                    litrosTanques: Array.from({ length: 11 }, (_, i) => ({
                        id: `TK-${String(i + 1).padStart(2, '0')}`,
                        nombre: `Tanque ${i + 1}`,
                        litros: 0,
                        capacidad: 1000
                    })),
                    litrosVendidosHoy: 0,
                    litrosMermaHoy: 0,
                    ventas: [],
                    prepagos: [],
                    deudas: [],
                    correcciones: [],
                    tapas: 0,
                    precintos: 0,
                    etiquetas: 0,
                    botellonNuevo19L: 0,
                    botellonNuevo12L: 0,
                    botellonNuevo5L: 0,
                    tapasReusables: 0,
                    hielo: 0,
                    helado: 0,
                    dispensadorAgua: 0,
                    agarraderosManuales: 0,
                    cepillosLavado: 0,
                    ultimoSyncInventario: null,
                    pendientesSync: []
                })
            }
        }),
        { name: 'agua-potable-store' }
    )
)