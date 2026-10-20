import { Megaphone } from 'lucide-react'
import { enlaceWhatsApp } from '../contenido'
import type { Aviso } from '../contenido'
import { IconoWhatsApp } from '../iconos-marca'

/** Banda temporal sobre el menú. Se activa desde AVISO en contenido.ts. */
export default function BandaAviso({ aviso }: { aviso: Aviso }) {
  return (
    <div className="relative z-50 bg-[#0b2551] px-5 py-2.5 text-center text-sm text-white">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-center gap-2 sm:flex-row sm:gap-4">
        <p className="flex items-center gap-2 leading-snug">
          <Megaphone className="h-4 w-4 shrink-0 text-[#9fd0ff]" aria-hidden="true" />
          <span>{aviso.texto}</span>
        </p>
        {aviso.mensajeWhatsApp && (
          <a
            href={enlaceWhatsApp(aviso.mensajeWhatsApp)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-sm font-bold text-[#0b2551] transition hover:bg-[#e8f1ff]"
          >
            <IconoWhatsApp className="h-4 w-4 text-[#12873d]" />
            {aviso.boton ?? 'Escríbenos'}
          </a>
        )}
      </div>
    </div>
  )
}
