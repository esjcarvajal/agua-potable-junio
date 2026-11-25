import { ArrowRight, Check } from 'lucide-react'
import imgRecarga from '../imagenes/serv-recarga.webp'
import imgLimpieza from '../imagenes/serv-limpieza.webp'
import imgDesinfeccion from '../imagenes/serv-desinfeccion.webp'
import imgDelivery from '../imagenes/serv-delivery.webp'
import { IconoWhatsApp } from '../iconos-marca'
import { MENSAJES, PRODUCTOS, SEGMENTOS, SERVICIOS, enlaceWhatsApp } from '../contenido'

const IMAGENES: Record<string, { src: string; alt: string }> = {
  recarga: { src: imgRecarga, alt: 'Botellones de agua purificada listos para entregar' },
  limpieza: { src: imgLimpieza, alt: 'Limpieza interna de un botellón con cepillo' },
  desinfeccion: { src: imgDesinfeccion, alt: 'Botellones en la línea de desinfección' },
  delivery: { src: imgDelivery, alt: 'Moto de reparto cargada de botellones' },
}

export default function Servicios() {
  return (
    <section id="servicios" aria-labelledby="lc-titulo-servicios" className="relative bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-[1200px] px-5 lg:px-8">
        {/* Servicios principales */}
        <div className="grid gap-10 xl:grid-cols-[270px_minmax(0,1fr)] xl:items-center xl:gap-12">
          <div className="max-w-xl">
            <p className="lc-antetitulo">{SERVICIOS.antetitulo}</p>
            <h2 id="lc-titulo-servicios" className="lc-titulo mt-4">
              {SERVICIOS.titulo}
            </h2>
            <p className="mt-4 text-[1.03rem] leading-relaxed text-[#56657e]">{SERVICIOS.texto}</p>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {SERVICIOS.tarjetas.map(({ clave, Icono, titulo, texto }) => (
              <li key={clave} className="lc-tarjeta lc-tarjeta--interactiva overflow-hidden">
                <div className="aspect-[4/3] overflow-hidden bg-[#eef5ff]">
                  <img
                    src={IMAGENES[clave].src}
                    alt={IMAGENES[clave].alt}
                    width={560}
                    height={420}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="relative px-4 pb-5 pt-8 sm:px-5 sm:pb-6 sm:pt-9">
                  <span className="absolute -top-6 left-4 grid h-12 w-12 place-items-center rounded-full border-4 border-white bg-[#1660d6] text-white shadow-[0_10px_20px_-10px_rgba(22,96,214,0.9)] sm:left-5">
                    <Icono className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-[0.95rem] font-extrabold leading-snug text-[#0b2551] sm:text-[1.02rem]">{titulo}</h3>
                  <p className="mt-1.5 text-[0.85rem] leading-relaxed text-[#56657e] sm:mt-2 sm:text-[0.92rem]">{texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Por tipo de cliente */}
        <div className="mt-20 lg:mt-24">
          <h3 className="text-center text-2xl font-extrabold tracking-tight text-[#0b2551] sm:text-[1.75rem]">
            {SEGMENTOS.titulo}
          </h3>
          <ul className="mt-10 grid gap-5 md:grid-cols-3 lg:gap-7">
            {SEGMENTOS.grupos.map(({ Icono, tipo, titulo, items, mensaje }) => (
              <li key={tipo} className="lc-tarjeta flex flex-col p-7">
                <div className="flex items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#eef5ff] text-[#1660d6]">
                    <Icono className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.14em] text-[#1660d6]">{tipo}</p>
                    <h4 className="text-lg font-extrabold leading-tight text-[#0b2551]">{titulo}</h4>
                  </div>
                </div>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[0.96rem]">
                      <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#12873d]" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={enlaceWhatsApp(mensaje)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 self-start text-[0.95rem] font-bold text-[#0c47b0] transition hover:gap-3"
                >
                  Consultar por WhatsApp
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Productos */}
        <div className="mt-16 rounded-[1.5rem] bg-[#f3f8ff] px-5 py-10 sm:px-8 lg:mt-20 lg:px-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-2xl font-extrabold tracking-tight text-[#0b2551]">{PRODUCTOS.titulo}</h3>
              <p className="mt-1 text-[#56657e]">{PRODUCTOS.texto}</p>
            </div>
            <a
              href={enlaceWhatsApp(MENSAJES.productos)}
              target="_blank"
              rel="noopener noreferrer"
              className="lc-btn lc-btn--wa lc-btn--pequeno self-start sm:self-auto"
            >
              <IconoWhatsApp className="h-[18px] w-[18px]" />
              Consultar precios
            </a>
          </div>
          <ul className="mt-8 grid grid-cols-3 gap-3 sm:gap-4 lg:grid-cols-6">
            {PRODUCTOS.items.map((p) => (
              <li
                key={p.id}
                className="flex flex-col items-center rounded-2xl bg-white p-3 text-center shadow-[0_12px_28px_-22px_rgba(11,37,81,0.5)] sm:p-4"
              >
                <img
                  src={`/productos/${p.id}.webp`}
                  alt=""
                  width={120}
                  height={120}
                  loading="lazy"
                  decoding="async"
                  className="h-16 w-16 object-contain sm:h-24 sm:w-24"
                  onError={(e) => {
                    e.currentTarget.style.visibility = 'hidden'
                  }}
                />
                <p className="mt-3 text-[0.82rem] font-bold leading-tight text-[#0b2551] sm:text-[0.92rem]">{p.nombre}</p>
                {p.detalle && <p className="mt-1 text-[0.74rem] text-[#56657e] sm:text-[0.8rem]">{p.detalle}</p>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
