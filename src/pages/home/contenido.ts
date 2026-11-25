/**
 * Contenido de la portada pública (aguapotablelacampina.com).
 *
 * Textos, datos de contacto y enlaces en un solo lugar: para cambiar un
 * horario, un número o una frase no hace falta tocar el diseño.
 * Misión, visión, objetivo, cifras, servicios por tipo de cliente y proceso
 * de atención vienen de la presentación ejecutiva del negocio.
 */
import {
  BadgeCheck,
  Building2,
  ChartColumn,
  Droplet,
  Eye,
  Handshake,
  Heart,
  House,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Truck,
  Users,
  UsersRound,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ─── CONTACTO ────────────────────────────────────────────────────────────────
export const CONTACTO = {
  telefonoVisible: '0412-747.80.17',
  telefonoEnlace: 'tel:+584127478017',
  whatsapp: '584127478017',
  direccionLineas: [
    'Urb. La Campiña 2, Avenida Principal,',
    'Calle 106, Casa 193-40,',
    'Naguanagua 2005, Carabobo.',
  ],
  mapa: 'https://share.google/pPFSP0oyQTcaPqj9q',
  usuarioRedes: '@aguapotablelacampina',
  instagram: 'https://www.instagram.com/aguapotablelacampina/',
  tiktok: 'https://www.tiktok.com/@aguapotablelacampina',
} as const

export const HORARIO = [
  { dias: 'Lunes a sábado', horas: '8:00 a.m. – 7:00 p.m.' },
  { dias: 'Domingos y feriados', horas: '8:00 a.m. – 2:00 p.m.' },
] as const

/** Mensajes con los que se abre WhatsApp. El de pedido es el mismo de la
 *  versión anterior del sitio, para no romper respuestas automáticas. */
export const MENSAJES = {
  pedido: '¡Hola! Me gustaría solicitar un servicio para recargar de botellón.',
  productos: '¡Hola! Quisiera consultar precios y disponibilidad de sus productos.',
  hogar: '¡Hola! Quisiera información del servicio para mi hogar.',
  comercio: '¡Hola! Me interesa un plan de suministro para mi comercio u oficina.',
  institucion: '¡Hola! Me interesa el suministro por volumen para mi empresa o institución.',
} as const

export function enlaceWhatsApp(mensaje: string = MENSAJES.pedido): string {
  return `https://wa.me/${CONTACTO.whatsapp}?text=${encodeURIComponent(mensaje)}`
}

// ─── AVISO TEMPORAL ──────────────────────────────────────────────────────────
export interface Aviso {
  texto: string
  boton?: string
  /** Si se indica, el botón abre WhatsApp con este mensaje. */
  mensajeWhatsApp?: string
}

/**
 * Banda de aviso sobre el menú (feriados, donaciones, cambios de horario).
 * null = no se muestra. Ejemplo:
 *   { texto: 'El 24 y 31 de diciembre atendemos hasta las 12:00 m.' }
 */
export const AVISO: Aviso | null = null

// ─── MENÚ ────────────────────────────────────────────────────────────────────
export const NAVEGACION = [
  { id: 'inicio', etiqueta: 'Inicio' },
  { id: 'equipo', etiqueta: 'Nosotros' },
  { id: 'compromiso', etiqueta: 'Misión y visión' },
  { id: 'servicios', etiqueta: 'Servicios' },
  { id: 'como-pedir', etiqueta: 'Cómo pedir' },
  { id: 'contacto', etiqueta: 'Contacto' },
] as const

/** Secciones que observa el menú para marcar dónde está el visitante. */
export const SECCIONES = ['inicio', 'equipo', 'nosotros', 'compromiso', 'servicios', 'como-pedir', 'contacto'] as const

/** "Un negocio familiar" (#nosotros) se marca en el menú como "Nosotros". */
export const GRUPO_MENU: Record<string, string> = { nosotros: 'equipo' }

// ─── SECCIONES ───────────────────────────────────────────────────────────────
export interface ItemIcono {
  Icono: LucideIcon
  titulo: string
  detalle?: string
}

export const HERO = {
  antetitulo: 'Recarga de botellones en Naguanagua',
  titular: 'Agua purificada que inspira',
  destacado: 'confianza',
  texto:
    'Ofrecemos servicio de limpieza, desinfección y recarga de botellones de agua, con delivery a toda Naguanagua y la zona norte de Valencia.',
  ventajas: [
    { Icono: Droplet, titulo: 'Agua purificada', detalle: 'de gran calidad' },
    { Icono: Truck, titulo: 'Delivery rápido', detalle: 'en tu zona' },
    { Icono: ShieldCheck, titulo: 'Atención confiable', detalle: 'siempre para ti' },
  ] satisfies ItemIcono[],
}

export const EQUIPO = {
  antetitulo: 'Nuestro equipo',
  titulo: 'Conoce a nuestro equipo',
  texto:
    'Contamos con un equipo comprometido, responsable y con amplia experiencia, que trabaja cada día para ofrecerte un servicio de calidad y la mejor atención.',
  puntos: [
    { Icono: Users, titulo: 'Personal capacitado', detalle: 'y con experiencia' },
    { Icono: BadgeCheck, titulo: 'Compromiso con la calidad', detalle: 'en cada proceso' },
    { Icono: Heart, titulo: 'Siempre listos para atenderte' },
  ] satisfies ItemIcono[],
  boton: 'Personas que hacen la diferencia',
}

/** Cifras de la presentación ejecutiva. Actualizarlas cuando cambien. */
export const CIFRAS = [
  { valor: '3', etiqueta: 'años de servicio' },
  { valor: '1.150', etiqueta: 'clientes activos' },
  { valor: '6.000', etiqueta: 'botellones al mes' },
] as const

export const FAMILIA = {
  antetitulo: 'Nuestras raíces',
  titulo: 'Un negocio familiar',
  texto:
    'Agua Potable La Campiña es un negocio familiar construido sobre valores que trascienden: trabajo, servicio y compromiso. Creemos en la importancia de brindar agua de calidad para el bienestar de cada hogar, con el mismo compromiso y dedicación con el que cuidamos a nuestra propia familia.',
  valores: [
    { Icono: Heart, titulo: 'Confianza', detalle: 'en cada servicio' },
    { Icono: UsersRound, titulo: 'Valores familiares', detalle: 'que nos guían' },
    { Icono: Star, titulo: 'Compromiso', detalle: 'con nuestra comunidad' },
  ] satisfies ItemIcono[],
}

export const COMPROMISO = {
  antetitulo: 'Nuestro compromiso',
  titulo: 'Misión, visión y objetivo',
  texto: 'Trabajamos cada día para llevar bienestar a más hogares.',
  tarjetas: [
    {
      Icono: Target,
      titulo: 'Misión',
      tono: 'azul',
      texto:
        'Llevar agua potable de calidad, segura y accesible a cada hogar de nuestra comunidad, con un equipo humano que cuida la salud, la higiene y el bienestar de las familias, y con una atención cercana y responsable que asegure la confianza y la satisfacción de nuestros clientes.',
    },
    {
      Icono: Eye,
      titulo: 'Visión',
      tono: 'verde',
      texto:
        'Desarrollar la empresa preferida en el suministro de agua potable por la calidad de nuestro recurso, la accesibilidad de nuestro servicio y la cercanía con nuestros clientes, contribuyendo activamente al bienestar y la salud de la comunidad.',
    },
    {
      Icono: ChartColumn,
      titulo: 'Objetivo',
      tono: 'azul',
      texto:
        'Brindar a nuestros clientes un servicio confiable de distribución de agua potable de calidad, accesible y segura, mediante un equipo comprometido con la salud, la higiene y el bienestar familiar, garantizando una atención responsable y orientada a la satisfacción de la comunidad.',
    },
  ] as const,
}

export const SERVICIOS = {
  antetitulo: 'Nuestros servicios',
  titulo: 'Todo para tu agua potable',
  texto: 'Soluciones completas con la calidad y confianza que tu familia merece.',
  tarjetas: [
    { clave: 'recarga', Icono: Droplet, titulo: 'Recarga de botellones', texto: 'Agua purificada lista para tu hogar u oficina.' },
    { clave: 'limpieza', Icono: Sparkles, titulo: 'Limpieza de botellones', texto: 'Lavado profesional con equipos especializados.' },
    { clave: 'desinfeccion', Icono: ShieldCheck, titulo: 'Desinfección', texto: 'Máxima higiene para tu tranquilidad.' },
    { clave: 'delivery', Icono: Truck, titulo: 'Delivery a domicilio', texto: 'Llevamos tu agua hasta la puerta de tu casa u oficina.' },
  ] as const,
}

export const SEGMENTOS = {
  titulo: 'Soluciones para cada tipo de cliente',
  grupos: [
    {
      Icono: House,
      tipo: 'Residencial',
      titulo: 'Hogares y familias',
      items: ['Venta de botellones', 'Delivery a domicilio', 'Recarga y reposición'],
      mensaje: MENSAJES.hogar,
    },
    {
      Icono: Building2,
      tipo: 'Comercial',
      titulo: 'Comercios y oficinas',
      items: ['Planes de suministro semanal', 'Dispensadores en comodato', 'Facturación mensual'],
      mensaje: MENSAJES.comercio,
    },
    {
      Icono: Handshake,
      tipo: 'Institucional',
      titulo: 'Empresas y aliados',
      items: ['Suministro por volumen', 'Atención a cadenas comerciales', 'Ejecutivo de cuenta asignado'],
      mensaje: MENSAJES.institucion,
    },
  ] as const,
}

/** Productos del catálogo del punto de venta. Las fotos son las mismas del
 *  POS (public/productos/{id}.webp): si se cambia una allá, cambia aquí. */
export const PRODUCTOS = {
  titulo: 'También tenemos',
  texto: 'Consulta precios y disponibilidad por WhatsApp.',
  items: [
    { id: 'p5', nombre: 'Botellones nuevos', detalle: '5, 12 y 19 litros' },
    { id: 'p6', nombre: 'Bolsas de hielo' },
    { id: 'p11', nombre: 'Dispensadores de agua' },
    { id: 'p10', nombre: 'Tapas reusables' },
    { id: 'p12', nombre: 'Agarraderos' },
    { id: 'p7', nombre: 'Helados' },
  ] as { id: string; nombre: string; detalle?: string }[],
}

export const COMO_PEDIR = {
  antetitulo: 'Cómo pedir',
  titulo: 'Del pedido a la puerta en cinco pasos',
  pasos: [
    { titulo: 'Pedido', texto: 'Recepción por teléfono, WhatsApp o en el local.' },
    { titulo: 'Verificación', texto: 'Confirmación de datos, dirección y forma de pago.' },
    { titulo: 'Preparación', texto: 'Revisión, limpieza y sellado de botellones.' },
    { titulo: 'Entrega', texto: 'Despacho en el horario acordado.' },
    { titulo: 'Seguimiento', texto: 'Confirmación de satisfacción y próximo pedido.' },
  ],
  pagos: ['Pago móvil', 'Transferencia', 'Efectivo en bolívares o dólares'],
}

export const CONTACTO_SECCION = {
  antetitulo: 'Contáctanos',
  titulo: 'Estamos listos para atenderte',
  texto: 'Haz tu pedido, resuelve tus dudas o visítanos. ¡Será un gusto atenderte!',
}

export const PIE = {
  eslogan: 'Agua Pura, Salud para Todos',
  descripcion:
    'Agua purificada, limpieza y desinfección de botellones. Delivery a Naguanagua y la zona norte de Valencia.',
  razonSocial: 'Agua Potable La Campiña C.A.',
  credito: {
    texto: 'Desarrollado por Leopoldo Carvajal',
    etiqueta: 'Contacto WhatsApp +5841240872589',
    enlace: 'https://wa.me/5841240872589',
  },
}
