import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import LogoCampina from './LogoCampina'
import { IconoWhatsApp } from '../iconos-marca'
import { GRUPO_MENU, NAVEGACION, SECCIONES, enlaceWhatsApp } from '../contenido'

/** Devuelve el id de la sección que el visitante tiene a media pantalla. */
function useSeccionActiva(): string {
  const [activa, setActiva] = useState<string>('inicio')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            const id = entrada.target.id
            setActiva(GRUPO_MENU[id] ?? id)
          }
        }
      },
      // Franja delgada a media altura: la sección que la cruza es la activa
      { rootMargin: '-42% 0px -54% 0px' },
    )
    for (const id of SECCIONES) {
      const seccion = document.getElementById(id)
      if (seccion) observador.observe(seccion)
    }
    return () => observador.disconnect()
  }, [])

  return activa
}

export default function Encabezado() {
  const activa = useSeccionActiva()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [conSombra, setConSombra] = useState(() => typeof window !== 'undefined' && window.scrollY > 8)

  useEffect(() => {
    const alDesplazar = () => setConSombra(window.scrollY > 8)
    window.addEventListener('scroll', alDesplazar, { passive: true })
    return () => window.removeEventListener('scroll', alDesplazar)
  }, [])

  useEffect(() => {
    if (!menuAbierto) return
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbierto(false)
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [menuAbierto])

  const cerrarMenu = () => setMenuAbierto(false)

  return (
    <header className={`lc-encabezado sticky top-0 z-40 ${conSombra || menuAbierto ? 'lc-encabezado--sombra' : ''}`}>
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center justify-between gap-4 px-5 lg:h-[78px] lg:px-8">
        <a href="#inicio" className="shrink-0 rounded-lg" aria-label="Agua Potable La Campiña, ir al inicio">
          <LogoCampina />
        </a>

        <nav aria-label="Principal" className="hidden xl:block">
          <ul className="flex items-center gap-7">
            {NAVEGACION.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="lc-menu-enlace whitespace-nowrap"
                  aria-current={activa === item.id ? 'location' : undefined}
                >
                  {item.etiqueta}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          {/* El contenedor oculta el botón en móvil (.lc-btn fija su propio display) */}
          <span className="hidden sm:inline-flex">
            <a
              href={enlaceWhatsApp()}
              target="_blank"
              rel="noopener noreferrer"
              className="lc-btn lc-btn--wa lc-btn--pequeno whitespace-nowrap"
            >
              <IconoWhatsApp className="h-[18px] w-[18px]" />
              Pedir por WhatsApp
            </a>
          </span>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[#0b2551] transition hover:bg-[#eef5ff] xl:hidden"
            aria-expanded={menuAbierto}
            aria-controls="lc-menu-movil"
            onClick={() => setMenuAbierto((abierto) => !abierto)}
          >
            {menuAbierto ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
            <span className="sr-only">{menuAbierto ? 'Cerrar menú' : 'Abrir menú'}</span>
          </button>
        </div>
      </div>

      {menuAbierto && (
        <nav id="lc-menu-movil" aria-label="Principal" className="border-t border-[#0b2551]/5 bg-white xl:hidden">
          <ul className="mx-auto flex max-w-[1200px] flex-col px-5 py-3">
            {NAVEGACION.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={cerrarMenu}
                  aria-current={activa === item.id ? 'location' : undefined}
                  className={`flex items-center rounded-xl px-3 py-3 text-base font-semibold transition hover:bg-[#eef5ff] ${
                    activa === item.id ? 'text-[#1660d6]' : 'text-[#0b2551]'
                  }`}
                >
                  {item.etiqueta}
                </a>
              </li>
            ))}
            <li className="pt-2 sm:hidden">
              <a
                href={enlaceWhatsApp()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={cerrarMenu}
                className="lc-btn lc-btn--wa w-full"
              >
                <IconoWhatsApp className="h-5 w-5" />
                Pedir por WhatsApp
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
