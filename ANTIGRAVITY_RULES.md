# Reglas del Proyecto — Agua Potable La Campiña
## Para Antigravity / Google Gemini Agent

---

## 1. IDENTIDAD DEL PROYECTO

- **Nombre del proyecto (código):** `agua-potable`
- **Nombre visible en pantalla:** `Agua Potable La Campiña`
- **Nombre del sistema:** `Hydro-Logic` (logo en el sidebar)
- **Estación:** `#042`
- **Idioma de la interfaz:** **100% español**. Ningún texto visible para el usuario puede estar en inglés. Esto incluye labels, placeholders, mensajes de error, toasts, tooltips, títulos, subtítulos, botones y badges. Los nombres de variables en el código pueden ser en inglés.

---

## 2. STACK TECNOLÓGICO — NO MODIFICAR

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | React + Vite | 19 / 8 |
| Lenguaje | TypeScript | — |
| Estilos | TailwindCSS | 3 |
| Estado global | Zustand (con persist) | 5 |
| Routing | React Router DOM | 7 |
| Base de datos | Firebase Realtime Database | 10 |
| Iconos | Lucide React | — |
| Gráficos | Recharts | 3 |

**PROHIBIDO:** instalar librerías no listadas aquí sin autorización explícita. No usar CSS-in-JS, styled-components, ni otros sistemas de estilos alternativos a Tailwind.

---

## 3. ARCHIVOS PROTEGIDOS — NUNCA MODIFICAR

Estos archivos están completos y no deben tocarse salvo instrucción explícita:

- `src/App.tsx`
- `src/components/Layout.tsx`
- `src/lib/db.ts`
- `src/store/useAppStore.ts`
- `src/pages/Dashboard.tsx`
- `src/pages/POS.tsx`
- `src/pages/Clientes.tsx`
- `tailwind.config.js`
- `public/.htaccess`

Cuando se pida modificar un archivo existente, **editar solo las secciones indicadas**, no reescribir el archivo completo.

---

## 4. DESIGN SYSTEM — Industrial Hydro-Logic

### Colores (modo claro — por defecto)
```
primary:              #005e97
primaryContainer:     #0077be
secondary:            #455f88
tertiary:             #8b4800   ← solo para alertas críticas
surface:              #f7f9fc
surfaceContainerLow:  #f2f4f7
surfaceContainerLowest: #ffffff
onSurface:            #191c1e
```

### Colores (modo oscuro)
```
primary:              #5bb3e8
primaryContainer:     #0077be
secondary:            #8aafd4
tertiary:             #e8a060
surface:              #0f1117
surfaceContainerLow:  #1a1d27
surfaceContainerLowest: #212435
onSurface:            #e4e6f0
cardBackground:       #1e2235
borderColor:          #2d3148
```

### Tipografía (tri-font system)
- **Manrope** → Títulos de sección, números hero grandes, headings
- **Inter** → Todo el texto de UI: labels, descripciones, navegación
- **Space Grotesk** → **TODOS** los valores numéricos sin excepción: litros, USD, VES, cantidades, porcentajes, fechas numéricas

### Reglas de diseño
- `border-radius: 12px` en todas las cards
- CERO bordes 1px sólidos para separar secciones — usar diferencia de background
- Botones primarios: `linear-gradient(135deg, #005e97, #0077be)`
- Sombra solo para modales: `box-shadow: 0 8px 32px rgba(0,0,0,0.06)`
- **PROHIBIDO** usar `position: fixed` — usar wrappers con `position: absolute` e `inset: 0`

---

## 5. MODO CLARO / MODO OSCURO

La aplicación **debe soportar ambos modos** con un switch visible en el header.

### Implementación
- Usar una clase CSS `dark` en el elemento `<html>` (estrategia de Tailwind: `darkMode: 'class'`)
- El estado del modo se guarda en `localStorage` bajo la clave `'tema'`
- Al cargar la app, leer `localStorage.getItem('tema')` y aplicar la clase `dark` si corresponde
- El switch en el header alterna entre modo claro (ícono Sol ☀️) y modo oscuro (ícono Luna 🌙)
- **Todos** los componentes nuevos deben incluir variantes `dark:` de Tailwind para colores de fondo, texto y bordes

### Clases Tailwind dark mode obligatorias en cada componente
```
Fondos de cards:    bg-white dark:bg-[#1e2235]
Fondos de página:   bg-[#f7f9fc] dark:bg-[#0f1117]
Texto principal:    text-[#191c1e] dark:text-[#e4e6f0]
Texto secundario:   text-gray-500 dark:text-gray-400
Bordes:             border-gray-100 dark:border-[#2d3148]
Inputs:             bg-white dark:bg-[#1a1d27] text-[#191c1e] dark:text-[#e4e6f0]
Sidebar:            bg-white dark:bg-[#1e2235]
Header:             bg-white dark:bg-[#1e2235]
```

---

## 6. TASA BCV — REGLAS DE NEGOCIO

- La tasa del dólar (USD → VES) se obtiene automáticamente de `https://pydolarve.org/api/v2/dollar?page=bcv`
- Se actualiza cada **60 minutos** automáticamente
- Siempre se muestra en el header: `$1 = XX.XX VES`
- Si la API falla: usar la última tasa guardada en localStorage y mostrar badge ámbar de advertencia
- El usuario administrador puede ingresar la tasa manualmente desde el header (click en el pill)
- **Todas** las cifras en VES se calculan en tiempo real multiplicando el valor USD por la tasa actual
- Los montos se almacenan en Google Sheets **siempre en USD** — la conversión a VES es solo visual
- Formato de presentación: `$1,234.56` para USD / `45,123.50 VES` para bolívares

---

## 7. IDIOMA — VOCABULARIO DEL NEGOCIO

Usar siempre estos términos en pantalla:

| Concepto | Término correcto en pantalla |
|---------|---------------------------|
| Dashboard | Panel Principal |
| POS | Punto de Venta |
| Inventory | Inventario |
| Reports | Reportes |
| Settings/Admin | Administración |
| Clients | Clientes |
| Refill | Recarga |
| Delivery | Envío a domicilio |
| Tank | Tanque |
| Jumbo tank | Reservorio Maestro |
| Cistern truck | Cisterna |
| Reject water | Agua de rechazo / Agua de lavado |
| Prepaid | Prepago |
| Balance | Saldo a favor |
| Caps | Tapas |
| Seals | Precintos |
| Labels | Etiquetas |
| Daily close | Cierre de caja |
| Profit | Utilidad |
| Sync | Sincronización |
| Pending sync | Pendiente de sincronización |
| Offline | Sin conexión |

---

## 8. FIREBASE REALTIME DATABASE — BASE DE DATOS

La conexión con Firebase se hace a través de `src/lib/db.ts`. Las operaciones principales son:

```typescript
// Leer toda la data de un nodo (Promesa)
readSheet(nodeName: string): Promise<any[]>

// Inyectar / Crear nuevo registro
insertRow(nodeName: string, row: object): Promise<boolean>

// Actualizar registro existente
updateRow(nodeName: string, id: string, row: object): Promise<boolean>

// Escuchar cambios en tiempo real
subscribeToNode(path: string, callback: (data: any[]) => void): () => void
```

### Nodos disponibles
- `ventas`
- `clientes`
- `prepagos`
- `movimientos_agua`
- `inventario_insumos`
- `cierres_caja`
- `tasas_bcv`
- `configuraciones`

**Regla:** Toda escritura de datos debe ir directamente a Firebase a través de `insertRow` o `updateRow`. La sincronización es automática gracias a `subscribeToNode`, por lo que el estado local (Zustand) se actualizará reactivamente. No es necesario manejar colas de `pendientesSync`.

---

## 9. DEPLOY — HOSTINGER CON CPANEL

- El proyecto se despliega subiendo **solo el contenido de la carpeta `dist/`** al servidor
- El archivo `public/.htaccess` es crítico para que el routing de React funcione — nunca eliminarlo
- Comando de build: `npm run build`
- El `dist/` generado contiene: `index.html`, `.htaccess`, carpeta `assets/`
- No usar SSR, Next.js ni ningún servidor Node en producción — es una SPA estática
- La URL base es la raíz del dominio (`base: '/'` en `vite.config.ts`)
- Variables de entorno de producción van en `.env.production`

---

## 10. PATRONES DE CÓDIGO OBLIGATORIOS

### Modales
```tsx
// CORRECTO — sin position:fixed
<div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
  <div className="bg-white dark:bg-[#1e2235] rounded-2xl p-8 max-w-md w-full mx-4">
    {/* contenido */}
  </div>
</div>

// INCORRECTO — nunca usar
<div className="fixed inset-0 ..."> ❌
```

### Toasts
- Siempre en la esquina inferior derecha en desktop
- En móvil: parte superior central
- Duración: SUCCESS 3s / ERROR 5s / WARNING 4s
- Colores: SUCCESS #16a34a / ERROR #dc2626 / WARNING #d97706

### Números en pantalla
```tsx
// Siempre usar Space Grotesk para números
<span className="font-grotesk">$1,234.56</span>

// Siempre formatear con toFixed o toLocaleString — nunca mostrar números crudos
{(valor).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
```

### Estados vacíos (empty states)
Cada lista o tabla debe tener un estado vacío con:
- Ícono de Lucide React relacionado con el contenido
- Mensaje descriptivo en español mencionando "Agua Potable La Campiña"
- Botón de acción principal cuando aplique

### Responsive
- Mobile first: diseñar primero para móvil, luego desktop con prefijos `md:` y `lg:`
- Breakpoint principal: `768px` (prefijo `md:`)
- En móvil: sidebar oculto, bottom navigation visible
- En desktop: sidebar visible, bottom navigation oculto

---

## 11. COMPONENTES COMPARTIDOS DISPONIBLES

| Componente | Ruta | Uso |
|-----------|------|-----|
| `Layout` | `components/Layout.tsx` | Wrapper de todas las páginas |
| Toast (inline) | En cada página | Notificaciones — pendiente extraer a componente compartido |

---

## 12. CHECKLIST ANTES DE ENTREGAR CADA MÓDULO

Antes de dar por completado cualquier módulo, verificar:

- [ ] Todo el texto visible está en español
- [ ] Los valores numéricos usan font Space Grotesk
- [ ] Los títulos usan Manrope
- [ ] El componente tiene variantes `dark:` en todos los colores
- [ ] No hay `position: fixed` en el código
- [ ] Los modales usan el patrón `absolute inset-0`
- [ ] Hay un empty state para listas vacías
- [ ] Las acciones que escriben datos llaman a `insertRow` o `updateRow` de `db.ts`
- [ ] La sincronización en tiempo real se maneja mediante `subscribeToNode` en el Store.
- [ ] `npm run dev` corre sin errores TypeScript
- [ ] La vista se ve correctamente en móvil (< 768px) y desktop

---

*Estas reglas aplican a todos los prompts del proyecto agua-potable.*
*Última actualización: 15 de abril de 2026*
