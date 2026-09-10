import { Document, Image, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ActaDetalle, ParishConfig } from "../lib/db";
import { selloSvgRaw } from "../lib/sello";

const TITULO: Record<string, string> = {
  COMUNION: "Constancia de Primera Comunión",
  CONFIRMACION: "Constancia de Confirmación",
};

const styles = StyleSheet.create({
  page: { paddingHorizontal: 56, paddingVertical: 60, fontSize: 12 },
  membrete: { borderBottom: 1, borderColor: "#999", paddingBottom: 12, marginBottom: 8 },
  sello: { width: 95, alignSelf: "center", marginBottom: 8 },
  parroquia: { fontSize: 18, textAlign: "center", fontWeight: "bold" },
  diocesis: { fontSize: 11, textAlign: "center", marginBottom: 2, color: "#555" },
  direccion: { fontSize: 9, textAlign: "center", marginBottom: 4, color: "#777" },
  titulo: { fontSize: 22, textAlign: "center", marginTop: 20, marginBottom: 20 },
  texto: { marginBottom: 12, lineHeight: 1.8, textAlign: "justify" },
  datos: { backgroundColor: "#f5f5f5", padding: 8, borderRadius: 4, marginBottom: 12 },
  fila: { marginBottom: 8 },
  label: { color: "#555" },
  firma: { marginTop: 72, flexDirection: "row", justifyContent: "space-between" },
  firmaBloque: { textAlign: "center", fontSize: 11, alignItems: "center" },
  emision: { alignSelf: "flex-end", fontSize: 9, color: "#777" },
});

function fechaLarga(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${d} de ${meses[m - 1]} de ${y}`;
}

export function CertificadoDoc({ a, cfg, sello }: { a: ActaDetalle; cfg: ParishConfig; sello: string | null }) {
  const p = a.persona;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.membrete}>
          {sello && <Image src={sello} style={styles.sello} />}
          <Text style={styles.parroquia}>{cfg.parroquia}</Text>
          <Text style={styles.diocesis}>{cfg.devocion} · {cfg.diocesis}</Text>
          <Text style={styles.direccion}>{cfg.direccion}</Text>
        </View>
        <Text style={styles.titulo}>{TITULO[a.tipo] ?? "Constancia"}</Text>
        <Text style={styles.texto}>
          {`Se deja constancia que ${p.apellido_nombres}${p.documento ? `, DNI ${p.documento}` : ""}, recibió el sacramento el día ${fechaLarga(a.fecha_sacramento)}${a.parroquia_capilla ? ` en ${a.parroquia_capilla}` : ""}${a.ministro_celebrante ? `, celebrado por ${a.ministro_celebrante}` : ""}.`}
        </Text>
        <View style={styles.datos}>
          {a.tipo === "CONFIRMACION" && (a.conf_baut_lugar || a.conf_baut_fecha || a.conf_baut_libro || a.conf_baut_folio) && (
            <View style={styles.fila}>
              <Text><Text style={styles.label}>Bautizado/a: </Text>el {a.conf_baut_fecha || "—"} en {a.conf_baut_lugar || "—"} — Libro {a.conf_baut_libro || "—"}, Folio {a.conf_baut_folio || "—"}</Text>
            </View>
          )}
          <View>
            <Text><Text style={styles.label}>Libro / Folio: </Text>{a.libro || "—"} / {a.folio || "—"}</Text>
          </View>
        </View>
        <View style={styles.firma}>
          <View style={styles.firmaBloque}>
            <View style={{ width: 160, height: 1.5, backgroundColor: "#333", marginBottom: 4 }} />
            {cfg.parroco ? <Text>Pbro. {cfg.parroco}</Text> : null}
            <Text>Párroco — Firma y sello</Text>
          </View>
          <Text style={styles.emision}>Emisión: {new Date().toLocaleDateString()}</Text>
        </View>
      </Page>
    </Document>
  );
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
          <h1 className="text-xl font-bold tracking-wide text-slate-800 mt-2">{cfg.parroquia}</h1>
          <p className="text-xs text-slate-500 tracking-wide">{cfg.devocion} · {cfg.diocesis}</p>
          <p className="text-xs text-slate-500 tracking-wide">{cfg.direccion}</p>
        </div>
        <h2 className="text-3xl font-semibold text-center mb-8 text-slate-700">{TITULO[a.tipo] ?? "Constancia"}</h2>
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
