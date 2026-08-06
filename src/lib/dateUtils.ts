export function getLocalDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getLocalTimeString(d: Date = new Date()): string {
  return d.toLocaleTimeString('es-VE')
}
