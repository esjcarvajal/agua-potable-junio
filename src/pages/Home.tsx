import { useNavigate } from 'react-router-dom'
import logo from '../assets/logo.png'
import heroImg from '../assets/hero-foto.png'

// ─── CONSTANTES ─────────────────────────────────────────────────────────────
const WHATSAPP_NUMBER = '584127478017'
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('¡Hola! Me gustaría solicitar un servicio para recargar de botellón.')}`
const MAPS_URL = 'https://share.google/pPFSP0oyQTcaPqj9q'

// ─── ICONS SVG ───────────────────────────────────────────────────────────────
function IconWhatsApp({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function IconMapPin({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function IconPhone({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.60 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.64a16 16 0 0 0 6 6l.95-1.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function IconClock({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconShield({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────────────────
export default function Home() {
  const navigate = useNavigate()

  const bannerText = "En Agua Potable La Campiña estamos donando agua potable para los rescatistas, voluntarios y victimas del terremoto, comunicate conmigo para recibir la donacion:"
  const bannerWhatsAppUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hola, me comunico por la donación de agua potable')}`

  return (
    <div className="min-h-screen flex flex-col font-inter bg-white" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── BANNER DE DONACIÓN ─────────────────────────────────────────── */}
      <div 
        className="w-full text-center py-2.5 px-4 flex flex-col sm:flex-row items-center justify-center gap-3 z-50 relative"
        style={{ background: 'linear-gradient(135deg, #e65c00, #F9D423)', color: 'white' }}
      >
        <span className="text-sm font-medium leading-tight">
          <span className="text-lg mr-2">📢</span>
          {bannerText}
        </span>
        <button
          onClick={() => window.open(bannerWhatsAppUrl, '_blank')}
          className="flex items-center gap-1.5 bg-white text-sm font-bold px-4 py-1.5 rounded-full shadow-sm hover:scale-105 active:scale-95 transition-all"
          style={{ color: '#e65c00', flexShrink: 0 }}
        >
          <IconWhatsApp size={16} />
          Contactar
        </button>
      </div>

      {/* ── NAVBAR ───────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-5 py-3"
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0,94,151,0.08)',
          boxShadow: '0 2px 20px rgba(0,94,151,0.06)',
        }}
      >
        {/* Logo + nombre */}
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo Agua Potable La Campiña" className="h-10 w-10 object-contain" />
          <div>
            <div
              className="font-bold text-sm leading-tight"
              style={{ color: '#005e97', fontFamily: 'Manrope, sans-serif' }}
            >
              Agua Potable La Campiña
            </div>
            <div className="text-[10px] text-gray-400 font-medium hidden sm:block">Naguanagua · Carabobo</div>
          </div>
        </div>

        {/* Nav links desktop */}
        <nav className="hidden md:flex items-center gap-6">
          <a
            href="#inicio"
            className="text-sm font-medium transition-colors"
            style={{ color: '#005e97', borderBottom: '2px solid #005e97', paddingBottom: 2 }}
          >
            Inicio
          </a>
          <button
            onClick={() => navigate('/app')}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors bg-transparent border-none cursor-pointer"
          >
            Administración
          </button>
        </nav>

        {/* CTA desktop */}
        <button
          onClick={() => window.open(WHATSAPP_URL, '_blank')}
          className="hidden md:flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-full transition-all hover:shadow-lg hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #005e97, #0077be)' }}
        >
          <IconWhatsApp size={16} />
          Pedir Ahora
        </button>

        {/* Hamburguesa móvil (solo decorativa, el FAB es suficiente) */}
        <button
          onClick={() => navigate('/app')}
          className="md:hidden text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
          style={{ background: '#005e97' }}
        >
          Admin
        </button>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        id="inicio"
        className="relative flex items-center justify-center text-white overflow-hidden"
        style={{ minHeight: '88vh' }}
      >
        {/* Fondo: imagen de la tienda + overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${heroImg})`,
            filter: 'brightness(0.45)',
          }}
        />
        {/* Overlay degradado adicional */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg, rgba(0,40,80,0.55) 0%, rgba(0,94,151,0.35) 100%)' }}
        />

        {/* Contenido centrado */}
        <div className="relative z-10 flex flex-col items-center text-center px-5 max-w-2xl mx-auto">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
            style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)' }}
          >
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Delivery a domicilio disponible
          </div>

          <h1
            className="font-bold leading-tight mb-4"
            style={{ fontFamily: 'Manrope, sans-serif', fontSize: 'clamp(2rem, 6vw, 3.5rem)' }}
          >
            Agua Potable<br />La Campiña
          </h1>

          <p
            className="text-base md:text-lg text-blue-100 mb-8 leading-relaxed"
            style={{ maxWidth: 480 }}
          >
            Ofrecemos servicio de Limpieza, Desinfección y Recargas de Botellones de Agua, con Delivery a toda naguanagua y la zona norte de Valencia.
          </p>

          {/* Botones */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {/* Solicita tu recarga */}
            <button
              onClick={() => window.open(WHATSAPP_URL, '_blank')}
              className="flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full font-semibold text-white text-sm transition-all hover:shadow-2xl hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #005e97, #25d366)', boxShadow: '0 4px 24px rgba(0,94,151,0.4)' }}
            >
              <IconWhatsApp size={18} />
              Solicita tu recarga
            </button>

            {/* Ven a nuestro negocio */}
            <button
              onClick={() => window.open(MAPS_URL, '_blank')}
              className="flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full font-semibold text-sm transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)',
                border: '2px solid rgba(255,255,255,0.5)',
                color: 'white',
              }}
            >
              <IconMapPin size={18} />
              Ven a nuestro negocio
            </button>
          </div>

          {/* Mini stats */}
          <div className="flex items-center gap-6 mt-10 text-sm text-blue-200">
            <div className="flex items-center gap-1.5">
              <span className="text-green-400">✓</span> Agua purificada
            </div>
            <div className="w-px h-4 bg-white/20" />
            <div className="flex items-center gap-1.5">
              <span className="text-green-400">✓</span> Delivery rápido
            </div>
            <div className="w-px h-4 bg-white/20" />
            <div className="flex items-center gap-1.5">
              <span className="text-green-400">✓</span> Servicio confiable
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-60 animate-bounce"
        >
          <div className="w-px h-8 bg-white/50 rounded-full" />
          <svg width="12" height="8" viewBox="0 0 12 8" fill="white">
            <path d="M1 1l5 5 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      </section>

      {/* ── SECCIÓN ADMINISTRACIÓN ────────────────────────────────────────── */}
      <section className="py-8 px-5" style={{ background: '#f0f6fb' }}>
        <div className="max-w-4xl mx-auto">
          <div
            className="flex flex-col sm:flex-row items-center gap-4 p-5 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #005e97 0%, #0077be 100%)',
              boxShadow: '0 8px 32px rgba(0,94,151,0.2)',
            }}
          >
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0">
                <IconShield size={20} />
              </div>
              <div className="text-white">
                <div className="font-bold text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Acceso Administrativo
                </div>
                <div className="text-blue-100 text-xs mt-0.5">
                  Sistema de gestión de ventas e inventario
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/app')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm transition-all hover:scale-105 active:scale-95 flex-shrink-0 w-full sm:w-auto justify-center"
              style={{ background: 'white', color: '#005e97' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Administración
            </button>
          </div>
        </div>
      </section>

      {/* ── INFORMACIÓN DE CONTACTO ───────────────────────────────────────── */}
      <section className="py-16 px-5" style={{ background: '#f7f9fc' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2
              className="font-bold text-3xl text-gray-800 mb-2"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Información de Contacto
            </h2>
            <p className="text-gray-500 text-sm">Estamos listos para atenderte.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Teléfono */}
            <div
              className="flex flex-col items-center text-center p-7 rounded-2xl bg-white transition-all hover:shadow-lg hover:-translate-y-1"
              style={{ boxShadow: '0 2px 16px rgba(0,94,151,0.06)', border: '1px solid rgba(0,94,151,0.08)' }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'linear-gradient(135deg, #e8f4fd, #cce7f8)' }}
              >
                <span style={{ color: '#005e97' }}><IconPhone size={22} /></span>
              </div>
              <h3 className="font-bold text-gray-800 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Teléfono
              </h3>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                className="font-semibold transition-colors hover:opacity-80"
                style={{ color: '#005e97', fontFamily: 'Space Grotesk, sans-serif' }}
              >
                0412-7478017
              </a>
            </div>

            {/* Dirección */}
            <div
              className="flex flex-col items-center text-center p-7 rounded-2xl bg-white transition-all hover:shadow-lg hover:-translate-y-1"
              style={{ boxShadow: '0 2px 16px rgba(0,94,151,0.06)', border: '1px solid rgba(0,94,151,0.08)' }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'linear-gradient(135deg, #e8f4fd, #cce7f8)' }}
              >
                <span style={{ color: '#005e97' }}><IconMapPin size={22} /></span>
              </div>
              <h3 className="font-bold text-gray-800 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Dirección
              </h3>
              <a
                href={MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 text-sm leading-relaxed hover:text-blue-600 transition-colors"
              >
                Urb. La Campiña 2, avenida principal, calle 106 casa 193-40 Av. Principal de,
                Naguanagua 2005, Carabobo.
              </a>
            </div>

            {/* Horario */}
            <div
              className="flex flex-col items-center text-center p-7 rounded-2xl bg-white transition-all hover:shadow-lg hover:-translate-y-1"
              style={{ boxShadow: '0 2px 16px rgba(0,94,151,0.06)', border: '1px solid rgba(0,94,151,0.08)' }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'linear-gradient(135deg, #e8f4fd, #cce7f8)' }}
              >
                <span style={{ color: '#005e97' }}><IconClock size={22} /></span>
              </div>
              <h3 className="font-bold text-gray-800 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Horario
              </h3>
              <div className="text-sm text-gray-500 space-y-1 w-full">
                <div className="flex justify-between gap-4">
                  <span className="font-medium text-gray-600">Lunes a Sábado</span>
                  <span style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#005e97', fontWeight: 600 }}>
                    8:00 a.m. – 7:00 p.m.
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="font-medium text-gray-600">Domingo</span>
                  <span style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#005e97', fontWeight: 600 }}>
                    8:00 a.m. – 2:00 p.m.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer
        className="px-5 py-10"
        style={{ background: '#003d63', color: 'white' }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between gap-8">
            {/* Marca */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <img src={logo} alt="Logo" className="h-8 w-8 object-contain rounded-lg" style={{ background: 'white', padding: 2 }} />
                <span
                  className="font-bold text-base"
                  style={{ fontFamily: 'Manrope, sans-serif', color: '#62bfeb' }}
                >
                  Agua Potable La Campiña
                </span>
              </div>
              <p className="text-blue-200 text-xs leading-relaxed" style={{ maxWidth: 240 }}>
                © 2024 Agua Potable La Campiña. Urb. La Campiña 2, Naguanagua.
              </p>
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 gap-x-12 gap-y-2">
              <div className="flex flex-col gap-2">
                <a href="#inicio" className="text-sm text-blue-200 hover:text-white transition-colors">Inicio</a>
                <button
                  onClick={() => navigate('/app')}
                  className="text-sm text-blue-200 hover:text-white transition-colors text-left bg-transparent border-none cursor-pointer p-0"
                >
                  Administración
                </button>
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-200 hover:text-white transition-colors"
                >
                  0412-7478017
                </a>
              </div>
              <div className="flex flex-col gap-2">
                <a
                  href={MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-200 hover:text-white transition-colors"
                >
                  Ubicación
                </a>
                <a href="#" className="text-sm text-blue-200 hover:text-white transition-colors">
                  Privacidad
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* ── CRÉDITOS DESARROLLADOR ───────────────────────────────────────── */}
      <div 
        className="w-full py-4 px-5 text-center text-xs"
        style={{ background: '#002842', color: '#8ebfda', fontFamily: 'Inter, sans-serif' }}
      >
        <span className="opacity-90">Desarrollado por Leopoldo Carvajal │ Contacto WhatsApp </span>
        <a 
          href="https://wa.me/5841240872589" 
          target="_blank" 
          rel="noopener noreferrer"
          className="font-bold text-white hover:text-[#62bfeb] transition-colors inline-block ml-1"
        >
          +5841240872589
        </a>
      </div>

      {/* ── FAB WHATSAPP (solo móvil) ─────────────────────────────────────── */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="md:hidden fixed bottom-6 right-5 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95"
        style={{ background: '#25d366', color: 'white', boxShadow: '0 8px 32px rgba(37,211,102,0.45)' }}
        aria-label="Contactar por WhatsApp"
      >
        <IconWhatsApp size={28} />
      </a>

    </div>
  )
}
