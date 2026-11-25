/**
 * Portada pública — aguapotablelacampina.com
 *
 * Textos, contacto y horario: src/pages/home/contenido.ts
 * Secciones:                  src/pages/home/secciones/
 * Estilos propios:            src/pages/home/home.css (todo bajo .lc-home)
 */
import './home/home.css'
import BandaAviso from './home/componentes/BandaAviso'
import Encabezado from './home/componentes/Encabezado'
import Hero from './home/secciones/Hero'
import Equipo from './home/secciones/Equipo'
import Familia from './home/secciones/Familia'
import Compromiso from './home/secciones/Compromiso'
import Servicios from './home/secciones/Servicios'
import ComoPedir from './home/secciones/ComoPedir'
import Contacto from './home/secciones/Contacto'
import PiePagina from './home/secciones/PiePagina'
import { IconoWhatsApp } from './home/iconos-marca'
import { AVISO, enlaceWhatsApp } from './home/contenido'

export default function Home() {
  return (
    <div className="lc-home min-h-screen">
      <a href="#contenido" className="lc-saltar">
        Saltar al contenido
      </a>

      {AVISO && <BandaAviso aviso={AVISO} />}
      <Encabezado />

      <main id="contenido" tabIndex={-1} className="outline-none">
        <Hero />
        <Equipo />
        <Familia />
        <Compromiso />
        <Servicios />
        <ComoPedir />
        <Contacto />
      </main>

      <PiePagina />

      <a
        href={enlaceWhatsApp()}
        target="_blank"
        rel="noopener noreferrer"
        className="lc-wa-flotante"
        aria-label="Escríbenos por WhatsApp"
      >
        <IconoWhatsApp className="h-7 w-7" />
      </a>
    </div>
  )
}
