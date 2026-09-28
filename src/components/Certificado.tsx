import { useEffect } from "react";
import type { ActaDetalle, ParishConfig } from "../lib/db";
import { selloSvgRaw } from "../lib/sello";

const TITULO: Record<string, string> = {
  COMUNION: "Constancia de Primera Comunión",
  CONFIRMACION: "Constancia de Confirmación",
  CONFESION: "Certificado de Mi Primera Confesión",
};

export function fechaLarga(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${d} de ${meses[m - 1]} de ${y}`;
}

/** Estilo del modelo de Confirmación: "1 de Noviembre del 2026" (mes con mayúscula + "del"). */
export function fechaLargaFormal(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${d} de ${meses[m - 1]} del ${y}`;
}

/** Confirmación: padrino o madrina según el check "Va en el certificado" ("": ninguno). */
export function padrinoEnCertificado(a: ActaDetalle): string {
  if (a.conf_padrino_sel === "PADRINO") return a.padrino || "";
  if (a.conf_padrino_sel === "MADRINA") return a.madrina || "";
  return "";
}

/** Versión HTML imprimible con el sello SVG vectorial puro (ideal para papel y PDF). */
export function CertificadoPrintable({ a, cfg }: { a: ActaDetalle; cfg: ParishConfig }) {
  if (a.tipo === "CONFESION") return <PrimeraConfesionPrintable a={a} cfg={cfg} />;
  if (a.tipo === "COMUNION") return <ComunionPrintable a={a} cfg={cfg} />;
  if (a.tipo === "CONFIRMACION") return <ConfirmacionPrintable a={a} cfg={cfg} />;
  const p = a.persona;
  return (
    <>
      <style>{`@media print { #certificado-printable { padding: 2cm; max-width: none; } }`}</style>
      <div id="certificado-printable" className="bg-white p-10 max-w-2xl mx-auto text-slate-900">
        <div className="text-center border-b-2 border-slate-300 pb-4 mb-6">
          <div className="w-28 mx-auto drop-shadow-sm" dangerouslySetInnerHTML={{ __html: selloSvgRaw() }} />
          <h1 className="font-display text-xl font-bold tracking-wide text-slate-800 mt-2">{cfg.parroquia}</h1>
          <p className="text-xs text-slate-500 tracking-wide">{cfg.devocion} · {cfg.diocesis}</p>
          <p className="text-xs text-slate-500 tracking-wide">{cfg.direccion}</p>
        </div>
        <h2 className="font-display text-3xl font-semibold text-center mb-8 text-slate-700">{TITULO[a.tipo] ?? "Constancia"}</h2>
        <div className="mx-auto w-16 h-0.5 bg-slate-400 mb-8" />
        <p className="leading-relaxed mb-4 text-justify text-slate-800">
          Se deja constancia que <b>{p.apellido_nombres}</b>
          {p.documento ? <>, DNI {p.documento}</> : null}, recibió el sacramento
          el día {fechaLarga(a.fecha_sacramento)}
          {a.parroquia_capilla ? <> en {a.parroquia_capilla}</> : null}
          {a.ministro_celebrante ? <>, celebrado por {a.ministro_celebrante}</> : null}.
        </p>
        <div className="bg-slate-50 rounded p-4 text-sm text-slate-700 mb-4 border border-slate-200">
          <p><b>Libro / Folio:</b> {a.libro || "—"} / {a.folio || "—"}</p>
        </div>
        <div className="flex justify-between mt-20 text-sm text-center">
          <span><div className="w-40 h-0.5 bg-slate-500 mx-auto mb-1" />{cfg.parroco ? <>Pbro. {cfg.parroco}<br /></> : null}Párroco — Firma y sello</span>
          <span className="text-xs text-slate-400 self-end">Emisión: {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </>
  );
}

/* ---------------- Primera Confesión (réplica ornamental) ---------------- */

/** Fondo extraído de la planilla entregada actualmente (va en public/). */
export const FONDO_CONFESION_URL = `${import.meta.env.BASE_URL}primera-confesion-fondo.jpg`;
export const FONDO_COMUNION_URL = `${import.meta.env.BASE_URL}primera-comunion-fondo.jpg`;
export const FONDO_CONFIRMACION_URL = `${import.meta.env.BASE_URL}confirmacion-fondo.jpg`;

/** Great Vibes (clon libre de la letra del modelo) para pantalla e impresión. */
const FUENTE_FIRMA_URL = `${import.meta.env.BASE_URL}fonts/GreatVibes-Regular.ttf`;

/** Letra manuscrita para la firma (primero la del modelo; el resto, respaldo). */
const LETRA_FIRMA = `"Great Vibes","Brush Script MT","Segoe Script","Lucida Handwriting","Monotype Corsiva",cursive`;

/** Estilo común de los ornamentales: fuente manuscrita + hoja apaisada. */
const ESTILO_ORNAMENTAL = `@font-face { font-family: "Great Vibes"; src: url("${FUENTE_FIRMA_URL}") format("truetype"); font-display: swap; } @page { size: A4 landscape; } @media print { #certificado-printable { padding: 0; max-width: none; } }`;

/** Achica el nombre si es largo para que no se salga del renglón. */
function fsNombre(nombre: string): number {
  const n = nombre.trim().length;
  if (n > 34) return 2.5;
  if (n > 26) return 2.9;
  return 3.3;
}

/** Achica el padrino/madrina si es largo (renglón más corto que el del nombre). */
function fsPadrino(nombre: string): number {
  const n = nombre.trim().length;
  if (n > 40) return 1.7;
  if (n > 30) return 1.9;
  return 2.2;
}

/** Firma y cargo desde Configuración (cargo sin el "Parroquia" duplicado). */
function firmaCargo(cfg: ParishConfig): { firma: string; cargo: string } {
  return {
    firma: cfg.parroco ? `Pbro. ${cfg.parroco}` : "",
    cargo: `Párroco ${cfg.parroquia.replace(/^parroquia\s+/i, "")}`,
  };
}

/**
 * Réplica del certificado "Mi Primera Confesión": el fondo es la imagen del
 * modelo y los datos (nombre, parroquia, fecha y firma desde Configuración)
 * se sobreimprimen en los renglones. Todo en unidades del viewBox (0–100)
 * para que escale exacto a cualquier tamaño e impresión apaisada.
 */
export function PrimeraConfesionPrintable({ a, cfg }: { a: ActaDetalle; cfg: ParishConfig }) {
  const nombre = a.persona.apellido_nombres || "";
  // "En la ...": siempre la parroquia de Configuración (dato institucional fijo).
  const lugar = cfg.parroquia || "";
  const fecha = fechaLarga(a.fecha_sacramento) === "—" ? "" : fechaLarga(a.fecha_sacramento);
  const firma = cfg.parroco ? `Pbro. ${cfg.parroco}` : "";
  const cargo = `Párroco ${cfg.parroquia.replace(/^parroquia\s+/i, "")}`;
  // Precarga la manuscrita para que ya esté lista al dar Imprimir.
  useEffect(() => {
    document.fonts?.load('20px "Great Vibes"').catch(() => undefined);
  }, []);
  return (
    <>
      <style>{ESTILO_ORNAMENTAL}</style>
      <div
        id="certificado-printable"
        className="relative w-full mx-auto bg-white text-slate-900"
        style={{ aspectRatio: "2200 / 1559" }}
      >
        <img
          src={FONDO_CONFESION_URL}
          alt=""
          className="absolute inset-0 w-full h-full"
          draggable={false}
        />
        <svg
          viewBox="0 0 100 70.86"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          aria-hidden
        >
          <text x="50.5" y="28.05" textAnchor="middle" fontSize={fsNombre(nombre)} fontStyle="italic" fontWeight="bold" fontFamily="Georgia,'Times New Roman',serif" fill="#1a1a1a">
            {nombre}
          </text>
          <text x="55.2" y="37.9" textAnchor="middle" fontSize="2.2" fontFamily="Georgia,'Times New Roman',serif" fill="#1a1a1a">
            {lugar}
          </text>
          <text x="55.2" y="43.55" textAnchor="middle" fontSize="2.2" fontFamily="Georgia,'Times New Roman',serif" fill="#1a1a1a">
            {fecha}
          </text>
          <text x="8" y="54.9" textAnchor="start" fontSize="2.7" fontStyle="italic" fontFamily={LETRA_FIRMA} fill="#111">
            {firma}
          </text>
          <line x1="8" y1="55.33" x2="33" y2="55.33" stroke="#aea35a" strokeWidth="0.18" />
          <text x="20.5" y="56.6" textAnchor="middle" fontSize="1.25" fontFamily="Georgia,'Times New Roman',serif" fill="#333">
            {cfg.parroquia ? cargo : ""}
          </text>
        </svg>
      </div>
    </>
  );
}

/* ---------------- Primera Comunión (réplica ornamental) ---------------- */

/**
 * Réplica del modelo (con "primera vez" ya corregido en el fondo):
 * nombre, comunidad, fecha y firma desde Configuración sobreimpresos.
 */
export function ComunionPrintable({ a, cfg }: { a: ActaDetalle; cfg: ParishConfig }) {
  const nombre = a.persona.apellido_nombres || "";
  // Comunidad: siempre la parroquia de Configuración (dato institucional fijo).
  const comunidad = cfg.parroquia || "";
  const fecha = fechaLarga(a.fecha_sacramento) === "—" ? "" : fechaLarga(a.fecha_sacramento);
  const { firma, cargo } = firmaCargo(cfg);
  useEffect(() => {
    document.fonts?.load('20px "Great Vibes"').catch(() => undefined);
  }, []);
  return (
    <>
      <style>{ESTILO_ORNAMENTAL}</style>
      <div
        id="certificado-printable"
        className="relative w-full mx-auto bg-white text-slate-900"
        style={{ aspectRatio: "2200 / 1563" }}
      >
        <img
          src={FONDO_COMUNION_URL}
          alt=""
          className="absolute inset-0 w-full h-full"
          draggable={false}
        />
        <svg
          viewBox="0 0 100 71.05"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          aria-hidden
        >
          <text x="60" y="21.6" textAnchor="middle" fontSize={fsNombre(nombre)} fontStyle="italic" fontWeight="bold" fontFamily="Georgia,'Times New Roman',serif" fill="#1a1a1a">
            {nombre}
          </text>
          <text x="56.7" y="32.61" textAnchor="middle" fontSize="2.2" fontFamily="Georgia,'Times New Roman',serif" fill="#1a1a1a">
            {comunidad}
          </text>
          <text x="56.7" y="35.74" textAnchor="middle" fontSize="2.2" fontFamily="Georgia,'Times New Roman',serif" fill="#1a1a1a">
            {fecha}
          </text>
          <text x="66.7" y="62.02" textAnchor="start" fontSize="2.7" fontStyle="italic" fontFamily={LETRA_FIRMA} fill="#111">
            {firma}
          </text>
          <line x1="66" y1="62.45" x2="88.5" y2="62.45" stroke="#aea35a" strokeWidth="0.18" />
          <text x="77" y="63.94" textAnchor="middle" fontSize="1.25" fontFamily="Georgia,'Times New Roman',serif" fill="#333">
            {cfg.parroquia ? cargo : ""}
          </text>
        </svg>
      </div>
    </>
  );
}

/* ---------------- Confirmación (réplica ornamental) ---------------- */

/**
 * Réplica del modelo: nombre, padrino/madrina (según el check del acta),
 * fecha formal ("1 de Noviembre del 2026") y firma desde Configuración.
 */
export function ConfirmacionPrintable({ a, cfg }: { a: ActaDetalle; cfg: ParishConfig }) {
  const nombre = a.persona.apellido_nombres || "";
  const padrino = padrinoEnCertificado(a);
  const fecha = fechaLargaFormal(a.fecha_sacramento) === "—" ? "" : fechaLargaFormal(a.fecha_sacramento);
  const { firma, cargo } = firmaCargo(cfg);
  useEffect(() => {
    document.fonts?.load('20px "Great Vibes"').catch(() => undefined);
  }, []);
  return (
    <>
      <style>{ESTILO_ORNAMENTAL}</style>
      <div
        id="certificado-printable"
        className="relative w-full mx-auto bg-white text-slate-900"
        style={{ aspectRatio: "2200 / 1556" }}
      >
        <img
          src={FONDO_CONFIRMACION_URL}
          alt=""
          className="absolute inset-0 w-full h-full"
          draggable={false}
        />
        <svg
          viewBox="0 0 100 70.73"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          aria-hidden
        >
          <text x="55.5" y="21.13" textAnchor="middle" fontSize={fsNombre(nombre)} fontStyle="italic" fontWeight="bold" fontFamily="Georgia,'Times New Roman',serif" fill="#1a1a1a">
            {nombre}
          </text>
          <text x="62.5" y="30.69" textAnchor="middle" fontSize={fsPadrino(padrino)} fontFamily="Georgia,'Times New Roman',serif" fill="#1a1a1a">
            {padrino}
          </text>
          <text x="52.5" y="37.81" textAnchor="middle" fontSize="2.6" fontFamily="Georgia,'Times New Roman',serif" fill="#1a1a1a">
            {fecha}
          </text>
          <text x="64.5" y="65.78" textAnchor="start" fontSize="2.7" fontStyle="italic" fontFamily={LETRA_FIRMA} fill="#111">
            {firma}
          </text>
          <line x1="64" y1="66.06" x2="89.5" y2="66.06" stroke="#aea35a" strokeWidth="0.18" />
          <text x="76" y="67.41" textAnchor="middle" fontSize="1.25" fontFamily="Georgia,'Times New Roman',serif" fill="#333">
            {cfg.parroquia ? cargo : ""}
          </text>
        </svg>
      </div>
    </>
  );
}
