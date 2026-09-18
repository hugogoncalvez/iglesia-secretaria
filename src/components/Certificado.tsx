import type { ActaDetalle, ParishConfig } from "../lib/db";
import { selloSvgRaw } from "../lib/sello";

const TITULO: Record<string, string> = {
  COMUNION: "Constancia de Primera Comunión",
  CONFIRMACION: "Constancia de Confirmación",
};

export function fechaLarga(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${d} de ${meses[m - 1]} de ${y}`;
}

/** Versión HTML imprimible con el sello SVG vectorial puro (ideal para papel y PDF). */
export function CertificadoPrintable({ a, cfg }: { a: ActaDetalle; cfg: ParishConfig }) {
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
          {a.tipo === "CONFIRMACION" && (a.conf_baut_lugar || a.conf_baut_fecha || a.conf_baut_libro || a.conf_baut_folio) && (
            <p><b>Bautizado/a:</b> el {a.conf_baut_fecha || "—"} en {a.conf_baut_lugar || "—"} — Libro {a.conf_baut_libro || "—"}, Folio {a.conf_baut_folio || "—"}</p>
          )}
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
