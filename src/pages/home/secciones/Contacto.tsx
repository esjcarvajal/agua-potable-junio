import { ArrowRight, Clock, MapPin, Phone } from 'lucide-react'
import { IconoInstagram, IconoTikTok, IconoWhatsApp } from '../iconos-marca'
import { CONTACTO, CONTACTO_SECCION, HORARIO, enlaceWhatsApp } from '../contenido'

export default function Contacto() {
  return (
    <section id="contacto" aria-labelledby="lc-titulo-contacto" className="relative bg-white pb-16 pt-20 lg:pb-20 lg:pt-28">
      <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="lc-antetitulo">{CONTACTO_SECCION.antetitulo}</p>
            <h2 id="lc-titulo-contacto" className="lc-titulo mt-4">
              {CONTACTO_SECCION.titulo}
            </h2>
            <p className="mt-4 text-[1.03rem] leading-relaxed text-[#56657e]">{CONTACTO_SECCION.texto}</p>
          </div>

          <div className="shrink-0">
            <p className="text-[0.78rem] font-extrabold uppercase tracking-[0.14em] text-[#0b2551]">Síguenos</p>
            <div className="mt-3 flex items-center gap-3">
              <a
                href={CONTACTO.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Instagram ${CONTACTO.usuarioRedes}`}
                className="grid h-11 w-11 place-items-center rounded-full bg-[#eef5ff] text-[#0c47b0] transition hover:bg-[#1660d6] hover:text-white"
              >
                <IconoInstagram className="h-5 w-5" />
              </a>
              <a
                href={CONTACTO.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`TikTok ${CONTACTO.usuarioRedes}`}
                className="grid h-11 w-11 place-items-center rounded-full bg-[#eef5ff] text-[#0c47b0] transition hover:bg-[#1660d6] hover:text-white"
              >
                <IconoTikTok className="h-[18px] w-[18px]" />
              </a>
              <span className="text-[0.92rem] font-semibold text-[#3b4a63]">{CONTACTO.usuarioRedes}</span>
            </div>
          </div>
        </div>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-12 lg:grid-cols-4">
          {/* WhatsApp */}
          <li className="lc-tarjeta flex flex-col p-6">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#1fa855] text-white">
              <IconoWhatsApp className="h-6 w-6" />
            </span>
            <h3 className="mt-5 text-lg font-extrabold text-[#0b2551]">WhatsApp</h3>
            <p className="mt-1 text-[0.9rem] text-[#56657e]">Haz tu pedido ahora</p>
            <div className="mt-auto pt-5">
              <a
                href={enlaceWhatsApp()}
                target="_blank"
                rel="noopener noreferrer"
                className="lc-btn lc-btn--wa lc-btn--pequeno whitespace-nowrap"
              >
                {CONTACTO.telefonoVisible}
              </a>
            </div>
          </li>

          {/* Teléfono */}
          <li className="lc-tarjeta flex flex-col p-6">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#1660d6] text-white">
              <Phone className="h-[22px] w-[22px]" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-lg font-extrabold text-[#0b2551]">Teléfono</h3>
            <p className="mt-1 text-[0.9rem] text-[#56657e]">Llámanos directamente</p>
            <a
              href={CONTACTO.telefonoEnlace}
              className="mt-auto whitespace-nowrap pt-5 text-[1.2rem] font-extrabold text-[#0c47b0] transition hover:text-[#1660d6]"
            >
              {CONTACTO.telefonoVisible}
            </a>
          </li>

          {/* Dirección */}
          <li className="lc-tarjeta flex flex-col p-6">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#1660d6] text-white">
              <MapPin className="h-[22px] w-[22px]" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-lg font-extrabold text-[#0b2551]">Dirección</h3>
            <address className="mt-1 text-[0.9rem] not-italic leading-relaxed text-[#3b4a63]">
              {CONTACTO.direccionLineas.join(' ')}
            </address>
            <a
              href={CONTACTO.mapa}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto inline-flex items-center gap-2 self-start pt-4 text-[0.95rem] font-bold text-[#0c47b0] transition hover:gap-3"
            >
              Cómo llegar
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </li>

          {/* Horario */}
          <li className="lc-tarjeta flex flex-col p-6">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#1660d6] text-white">
              <Clock className="h-[22px] w-[22px]" aria-hidden="true" />
            </span>
            <h3 className="mt-5 text-lg font-extrabold text-[#0b2551]">Horario de atención</h3>
            <dl className="mt-3 space-y-3">
              {HORARIO.map((h) => (
                <div key={h.dias}>
                  <dt className="text-[0.92rem] font-bold text-[#1660d6]">{h.dias}</dt>
                  <dd className="text-[0.92rem] text-[#3b4a63]">{h.horas}</dd>
                </div>
              ))}
            </dl>
          </li>
        </ul>
      </div>
    </section>
  )
}
