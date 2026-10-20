import { Link } from 'react-router-dom'
import { Lock, MapPin, Phone } from 'lucide-react'
import ola from '../imagenes/ola-footer.webp'
import LogoCampina from '../componentes/LogoCampina'
import { IconoInstagram, IconoTikTok, IconoWhatsApp } from '../iconos-marca'
import { CONTACTO, NAVEGACION, PIE, enlaceWhatsApp } from '../contenido'

const TITULO_COLUMNA = 'text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-white'

export default function PiePagina() {
  const anio = new Date().getFullYear()

  return (
    <footer>
      <div className="lc-pie__ola" aria-hidden="true">
        <img src={ola} alt="" width={1920} height={164} loading="lazy" decoding="async" />
      </div>

      <div className="lc-pie__cuerpo">
        <div className="mx-auto grid max-w-[1200px] gap-10 px-5 pb-12 pt-8 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-8 lg:pt-4">
          <div>
            <LogoCampina variante="oscuro" grande />
            <p className="lc-eslogan mt-5 text-[1.3rem] text-[#9fd0ff]">{PIE.eslogan}</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed">{PIE.descripcion}</p>
          </div>

          <nav aria-label="Secciones de la página">
            <p className={TITULO_COLUMNA}>Navegación</p>
            <ul className="mt-4 space-y-2.5 text-[0.95rem]">
              {NAVEGACION.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className="lc-pie__enlace">
                    {item.etiqueta}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className={TITULO_COLUMNA}>Contacto</p>
            <ul className="mt-4 space-y-3 text-[0.95rem]">
              <li>
                <a href={enlaceWhatsApp()} target="_blank" rel="noopener noreferrer" className="lc-pie__enlace inline-flex items-center gap-2.5">
                  <IconoWhatsApp className="h-4 w-4 text-[#5fd68f]" />
                  WhatsApp
                </a>
              </li>
              <li>
                <a href={CONTACTO.telefonoEnlace} className="lc-pie__enlace inline-flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-[#9fd0ff]" aria-hidden="true" />
                  {CONTACTO.telefonoVisible}
                </a>
              </li>
              <li>
                <a href={CONTACTO.mapa} target="_blank" rel="noopener noreferrer" className="lc-pie__enlace inline-flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 text-[#9fd0ff]" aria-hidden="true" />
                  Cómo llegar
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className={TITULO_COLUMNA}>Síguenos</p>
            <div className="mt-4 flex gap-3">
              <a
                href={CONTACTO.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Instagram ${CONTACTO.usuarioRedes}`}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <IconoInstagram className="h-[18px] w-[18px]" />
              </a>
              <a
                href={CONTACTO.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`TikTok ${CONTACTO.usuarioRedes}`}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <IconoTikTok className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-2 text-sm">{CONTACTO.usuarioRedes}</p>

            <Link to="/app" rel="nofollow" className="lc-pie__enlace mt-8 inline-flex items-center gap-2 text-sm font-semibold">
              <Lock className="h-4 w-4" aria-hidden="true" />
              Administración
            </Link>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-5 py-5 pr-20 text-[0.8rem] sm:pr-24 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:pr-24">
            <p>
              © {anio} {PIE.razonSocial} · Naguanagua, Carabobo.
            </p>
            <p>
              {PIE.credito.texto} │{' '}
              <a href={PIE.credito.enlace} target="_blank" rel="noopener noreferrer" className="font-bold text-white transition hover:text-[#9fd0ff]">
                {PIE.credito.etiqueta}
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
