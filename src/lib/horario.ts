/**
 * Utilidades para el manejo de horarios y feriados venezolanos
 */

interface HorarioInfo {
    isOpen: boolean
    status: string
    color: string
}

const FERIADOS_FIJOS = [
    { m: 0, d: 1 },  // 1 Ene
    { m: 3, d: 19 }, // 19 Abr
    { m: 4, d: 1 },  // 1 May
    { m: 5, d: 24 }, // 24 Jun
    { m: 6, d: 5 },  // 5 Jul
    { m: 6, d: 24 }, // 24 Jul
    { m: 9, d: 12 }, // 12 Oct
    { m: 11, d: 24 }, // 24 Dic
    { m: 11, d: 25 }, // 25 Dic
    { m: 11, d: 31 }, // 31 Dic
]

/**
 * Calcula el Domingo de Resurrección (Algoritmo de Butcher)
 */
function getEaster(year: number): Date {
    const a = year % 19
    const b = Math.floor(year / 100)
    const c = year % 100
    const d = Math.floor(b / 4)
    const e = b % 4
    const f = Math.floor((b + 8) / 25)
    const g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4)
    const k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451)
    const month = Math.floor((h + l - 7 * m + 114) / 31)
    const day = ((h + l - 7 * m + 114) % 31) + 1
    return new Date(year, month - 1, day)
}

export function isFeriado(date: Date): boolean {
    const y = date.getFullYear()
    const m = date.getMonth()
    const d = date.getDate()

    // Fijos
    if (FERIADOS_FIJOS.some(f => f.m === m && f.d === d)) return true

    // Variables (Carnaval y Semana Santa)
    const easter = getEaster(y)
    
    // Jueves Santo (-3 días) y Viernes Santo (-2 días)
    const juevesSanto = new Date(easter); juevesSanto.setDate(easter.getDate() - 3)
    const viernesSanto = new Date(easter); viernesSanto.setDate(easter.getDate() - 2)
    if (m === juevesSanto.getMonth() && d === juevesSanto.getDate()) return true
    if (m === viernesSanto.getMonth() && d === viernesSanto.getDate()) return true

    // Carnaval (Lunes -48 días, Martes -47 días antes de Pascua)
    const lunesCarnaval = new Date(easter); lunesCarnaval.setDate(easter.getDate() - 48)
    const martesCarnaval = new Date(easter); martesCarnaval.setDate(easter.getDate() - 47)
    if (m === lunesCarnaval.getMonth() && d === lunesCarnaval.getDate()) return true
    if (m === martesCarnaval.getMonth() && d === martesCarnaval.getDate()) return true

    return false
}

export function getHorarioStatus(now: Date = new Date()): HorarioInfo {
    const day = now.getDay() // 0 = Dom, 1 = Lun, ..., 6 = Sab
    const hour = now.getHours()
    const min = now.getMinutes()
    const timeNum = hour * 100 + min // 0830 = 8:30 AM
    
    const feriado = isFeriado(now)
    const isSpecialDay = day === 0 || feriado // Domingo o Feriado

    // Horarios en formato numérico (HHmm)
    const start = 800
    const endNormal = 1900
    const endSpecial = 1400

    const currentEnd = isSpecialDay ? endSpecial : endNormal
    const isOpen = timeNum >= start && timeNum < currentEnd

    if (isOpen) {
        // Verificar si cierra pronto (faltan menos de 30 min)
        const currentEndHour = Math.floor(currentEnd / 100)
        const diffMin = (currentEndHour * 60) - (hour * 60 + min)
        
        if (diffMin <= 30) {
            return {
                isOpen: true,
                status: 'CIERRA PRONTO',
                color: '#d97706' // Ámbar
            }
        }
        return {
            isOpen: true,
            status: 'ABIERTO',
            color: '#16a34a' // Verde
        }
    }

    return {
        isOpen: false,
        status: 'CERRADO',
        color: '#dc2626' // Rojo
    }
}

export function getHorarioTexto(isSpecial: boolean): string {
    if (isSpecial) return '08:00 AM / 02:00 PM (Domingos y Feriados)'
    return '08:00 AM / 07:00 PM (Lunes a Sábado)'
}
