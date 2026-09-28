// Documentos PDF (informe interno + planilla del Obispado).
// Este módulo se importa de forma diferida (await import(...)) desde las pantallas,
// para no cargar @react-pdf/renderer al abrir la app y acelerar el arranque.
import { pdf, Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";
import { ABREV_TIPO, ETIQUETA_TIPO, TIPOS_SACRAMENTO, type ActaDetalle, type ParishConfig } from "../lib/db";
import type {
  DatosObispado,
  InformeEstadistico,
  LibroUso,
} from "../lib/estadisticas";
import { fechaLarga, fechaLargaFormal, padrinoEnCertificado } from "./Certificado";

/* ---------------- Informe interno ---------------- */

const rep = StyleSheet.create({
  page: { paddingHorizontal: 48, paddingVertical: 44, fontSize: 10 },
  parroquia: { fontSize: 15, textAlign: "center", fontWeight: "bold" },
  sub: { fontSize: 9, textAlign: "center", color: "#555", marginBottom: 2 },
  titulo: { fontSize: 17, textAlign: "center", marginTop: 14, marginBottom: 4 },
  rango: { fontSize: 10, textAlign: "center", color: "#555", marginBottom: 14 },
  h2: { fontSize: 12, fontWeight: "bold", marginTop: 12, marginBottom: 6 },
  tabla: { borderTop: 1, borderColor: "#999" },
  fila: { flexDirection: "row", borderBottom: 1, borderColor: "#ccc", paddingVertical: 3 },
  celda: { flex: 1 },
  celdaDer: { flex: 1, textAlign: "right" },
  celdaHead: { flex: 1, fontWeight: "bold" },
  pie: { marginTop: 18, fontSize: 8, color: "#777", textAlign: "right" },
});

function InformeDoc({ inf, libros, capacidad, cfg }: { inf: InformeEstadistico; libros: LibroUso[]; capacidad: number; cfg: ParishConfig }) {
  return (
    <Document>
      <Page size="A4" style={rep.page}>
        <Text style={rep.parroquia}>{cfg.parroquia}</Text>
        <Text style={rep.sub}>{cfg.devocion} · {cfg.diocesis}</Text>
        <Text style={rep.titulo}>Informe estadístico de sacramentos</Text>
        <Text style={rep.rango}>Período: {inf.desde || "—"} al {inf.hasta || "—"}</Text>

        <Text style={rep.h2}>Resumen por sacramento</Text>
        <View style={rep.tabla}>
          <View style={rep.fila}>
            <Text style={rep.celdaHead}>Sacramento</Text>
            <Text style={[rep.celdaHead, { textAlign: "right" }]}>Cantidad</Text>
          </View>
          {TIPOS_SACRAMENTO.map((t) => (
            <View style={rep.fila} key={t}>
              <Text style={rep.celda}>{ETIQUETA_TIPO[t]}</Text>
              <Text style={rep.celdaDer}>{inf.porTipo[t]}</Text>
            </View>
          ))}
          <View style={rep.fila}>
            <Text style={rep.celdaHead}>TOTAL</Text>
            <Text style={[rep.celdaHead, { textAlign: "right" }]}>{inf.total}</Text>
          </View>
        </View>

        <Text style={rep.h2}>Detalle mensual</Text>
        <View style={rep.tabla}>
          <View style={rep.fila}>
            <Text style={rep.celdaHead}>Mes</Text>
            {TIPOS_SACRAMENTO.map((t) => (
              <Text key={t} style={[rep.celdaHead, { textAlign: "right" }]}>{ABREV_TIPO[t]}</Text>
            ))}
            <Text style={[rep.celdaHead, { textAlign: "right" }]}>Total</Text>
          </View>
          {inf.porMes.map((m) => (
            <View style={rep.fila} key={m.mes}>
              <Text style={rep.celda}>{m.mes}</Text>
              {TIPOS_SACRAMENTO.map((t) => (
                <Text key={t} style={rep.celdaDer}>{m[t]}</Text>
              ))}
              <Text style={rep.celdaDer}>{m.total}</Text>
            </View>
          ))}
        </View>

        <Text style={rep.h2}>Edades al recibir el sacramento</Text>
        <View style={rep.tabla}>
          <View style={rep.fila}>
            <Text style={rep.celdaHead}>Rango de edad</Text>
            {(["BAUTISMO", "COMUNION", "CONFIRMACION"] as const).map((t) => (
              <Text key={t} style={[rep.celdaHead, { textAlign: "right" }]}>{t.slice(0, 4)}.</Text>
            ))}
          </View>
          {inf.edades.map((e) => (
            <View style={rep.fila} key={e.bucket}>
              <Text style={rep.celda}>{e.bucket}</Text>
              <Text style={rep.celdaDer}>{e.BAUTISMO}</Text>
              <Text style={rep.celdaDer}>{e.COMUNION}</Text>
              <Text style={rep.celdaDer}>{e.CONFIRMACION}</Text>
            </View>
          ))}
        </View>

        <Text style={rep.h2}>Estado de libros (acumulado, capacidad {capacidad} actas)</Text>
        <View style={rep.tabla}>
          <View style={rep.fila}>
            <Text style={rep.celdaHead}>Sacramento</Text>
            <Text style={rep.celdaHead}>Libro</Text>
            <Text style={[rep.celdaHead, { textAlign: "right" }]}>Usadas</Text>
          </View>
          {libros.map((l, i) => (
            <View style={rep.fila} key={i}>
              <Text style={rep.celda}>{l.tipo}</Text>
              <Text style={rep.celda}>{l.libro}</Text>
              <Text style={rep.celdaDer}>{l.cantidad}/{capacidad}</Text>
            </View>
          ))}
        </View>

        <Text style={rep.pie}>Emisión: {new Date().toLocaleString()}</Text>
      </Page>
    </Document>
  );
}

export async function generarInformeBlob(
  inf: InformeEstadistico,
  libros: LibroUso[],
  capacidad: number,
  cfg: ParishConfig
): Promise<Blob> {
  return pdf(<InformeDoc inf={inf} libros={libros} capacidad={capacidad} cfg={cfg} />).toBlob();
}

/* ---------------- Planilla Obispado (réplica Datos Estadísticos) ---------------- */

const planilla = StyleSheet.create({
  page: { paddingHorizontal: 56, paddingVertical: 48, fontSize: 11, fontFamily: "Helvetica", lineHeight: 1.5 },
  header: { textAlign: "center", fontWeight: "bold", fontSize: 13 },
  headerSub: { textAlign: "center", fontSize: 9 },
  titulo: { textAlign: "center", fontWeight: "bold", fontSize: 12, textDecoration: "underline", marginTop: 20, marginBottom: 14 },
  parroquia: { fontWeight: "bold", marginBottom: 10 },
  item: { fontWeight: "bold", marginTop: 10 },
  sub: { marginLeft: 12, marginTop: 3 },
  nota: { marginTop: 16 },
  cierre: { marginTop: 26, fontWeight: "bold" },
});

/** Vacío → línea de puntos como la planilla en blanco; con dato → el número. */
function valPlanilla(v: string | number): string {
  const s = String(v ?? "").trim();
  return s === "" ? "................" : s;
}

function PlanillaDoc({ inf, datos, anio, cfg }: { inf: InformeEstadistico; datos: DatosObispado; anio: string; cfg: ParishConfig }) {
  const baut = (bucket: string): number =>
    inf.edades.find((e) => e.bucket === bucket)?.BAUTISMO ?? 0;
  const hasta1 = baut("Menor de 1 año");
  const de1a7 = baut("1 a 7 años");
  const mayores7 = baut("8 a 17 años") + baut("18 años o más");
  return (
    <Document>
      <Page size="A4" style={planilla.page}>
        <Text style={planilla.header}>OBISPADO DE POSADAS</Text>
        <Text style={planilla.headerSub}>Tel. 0376-4423221</Text>
        <Text style={planilla.headerSub}>F.de Azara 1604 - N3300LQJ - Posadas - Misiones</Text>
        <Text style={planilla.headerSub}>E-mail: diocesisdeposadas@gmail.com</Text>

        <Text style={planilla.titulo}>DATOS ESTADISTICOS</Text>

        <Text style={planilla.parroquia}>Parroquia {cfg.parroquia}</Text>

        <Text style={planilla.item}>1. BAUTIZADOS DURANTE EL AÑO {anio}</Text>
        <Text style={planilla.sub}>a) hasta 1 año: {hasta1}</Text>
        <Text style={planilla.sub}>b) de 1 a 7 años: {de1a7}</Text>
        <Text style={planilla.sub}>c) mayores de 7 años: {mayores7}</Text>

        <Text style={planilla.item}>2. MATRIMONIOS REALIZADOS DURANTE EL AÑO {anio}:</Text>
        <Text style={planilla.sub}>a) entre católicos (bautizados): {inf.matrimonios.entreCatolicos}</Text>
        <Text style={planilla.sub}>b) entre un católico y un no católico: {inf.matrimonios.mixtos}</Text>

        <Text style={planilla.item}>3. CONFIRMADOS DURANTE EL AÑO {anio}: {inf.porTipo.CONFIRMACION}</Text>

        <Text style={planilla.item}>4. PRIMERAS COMUNIONES DURANTE EL AÑO {anio} {valPlanilla(inf.porTipo.COMUNION)}</Text>

        <Text style={planilla.item}>5. Cantidad de CATEQUISTAS (Parroquia y Capillas): {valPlanilla(datos.catequistas)}</Text>

        <Text style={planilla.item}>6. Tiene en su Parroquia MISIONEROS LAICOS, Cuántos: {valPlanilla(datos.misioneros)}</Text>

        <Text style={planilla.item}>
          7. Si tienen un HOGAR DE ANCIANOS, atendido por Religiosas o pertenece a la
          Parroquia; cuántos internos: Mujeres: {valPlanilla(datos.hogarMujeres)} Varones: {valPlanilla(datos.hogarVarones)}
        </Text>

        <Text style={planilla.item}>
          8. Cantidad de Capillas y lugares donde celebran normalmente la Misa: {valPlanilla(datos.capillas)}
        </Text>

        <Text style={planilla.nota}>
          <Text style={{ fontWeight: "bold" }}>NOTA</Text>
          : Bautismos -mayores de 7 años- incluir también a los convertidos que, sin
          bautismo sub condicione, han sido admitidos en la Iglesia Católica.
        </Text>

        <Text style={planilla.cierre}>
          Recordamos que “El párroco ejerce la cura pastoral de la comunidad que le ha
          sido encomendada bajo la autoridad del obispo Diocesano” (c. 519) y debe
          colaborar con el mismo (c. 529 §2), quien tiene la obligación de remitir
          anualmente esta información a la Santa Sede, por lo que rogamos devolver esta
          misma hoja <Text style={{ textDecoration: "underline" }}>antes del 15 de marzo de {Number(anio) + 1}</Text>
        </Text>
      </Page>
    </Document>
  );
}

export async function generarPlanillaBlob(
  inf: InformeEstadistico,
  datos: DatosObispado,
  anio: string,
  cfg: ParishConfig
): Promise<Blob> {
  return pdf(<PlanillaDoc inf={inf} datos={datos} anio={anio} cfg={cfg} />).toBlob();
}

/* ---------------- Certificado (comunión / confirmación) ---------------- */

const TITULO_CERT: Record<string, string> = {
  COMUNION: "Constancia de Primera Comunión",
  CONFIRMACION: "Constancia de Confirmación",
  CONFESION: "Certificado de Mi Primera Confesión",
};

const cert = StyleSheet.create({
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

function CertificadoDoc({ a, cfg, sello }: { a: ActaDetalle; cfg: ParishConfig; sello: string | null }) {
  const p = a.persona;
  return (
    <Document>
      <Page size="A4" style={cert.page}>
        <View style={cert.membrete}>
          {sello && <Image src={sello} style={cert.sello} />}
          <Text style={cert.parroquia}>{cfg.parroquia}</Text>
          <Text style={cert.diocesis}>{cfg.devocion} · {cfg.diocesis}</Text>
          <Text style={cert.direccion}>{cfg.direccion}</Text>
        </View>
        <Text style={cert.titulo}>{TITULO_CERT[a.tipo] ?? "Constancia"}</Text>
        <Text style={cert.texto}>
          {`Se deja constancia que ${p.apellido_nombres}${p.documento ? `, DNI ${p.documento}` : ""}, recibió el sacramento el día ${fechaLarga(a.fecha_sacramento)}${a.parroquia_capilla ? ` en ${a.parroquia_capilla}` : ""}${a.ministro_celebrante ? `, celebrado por ${a.ministro_celebrante}` : ""}.`}
        </Text>
        <View style={cert.datos}>
          {a.tipo === "CONFIRMACION" && (a.conf_baut_lugar || a.conf_baut_fecha || a.conf_baut_libro || a.conf_baut_folio) && (
            <View style={cert.fila}>
              <Text><Text style={cert.label}>Bautizado/a: </Text>el {a.conf_baut_fecha || "—"} en {a.conf_baut_lugar || "—"} — Libro {a.conf_baut_libro || "—"}, Folio {a.conf_baut_folio || "—"}</Text>
            </View>
          )}
          <View>
            <Text><Text style={cert.label}>Libro / Folio: </Text>{a.libro || "—"} / {a.folio || "—"}</Text>
          </View>
        </View>
        <View style={cert.firma}>
          <View style={cert.firmaBloque}>
            <View style={{ width: 160, height: 1.5, backgroundColor: "#333", marginBottom: 4 }} />
            {cfg.parroco ? <Text>Pbro. {cfg.parroco}</Text> : null}
            <Text>Párroco — Firma y sello</Text>
          </View>
          <Text style={cert.emision}>Emisión: {new Date().toLocaleDateString()}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generarCertificadoBlob(
  a: ActaDetalle,
  cfg: ParishConfig,
  sello: string | null
): Promise<Blob> {
  if (a.tipo === "CONFESION") return pdf(<ConfesionDoc a={a} cfg={cfg} />).toBlob();
  if (a.tipo === "COMUNION") return pdf(<ComunionDoc a={a} cfg={cfg} />).toBlob();
  if (a.tipo === "CONFIRMACION") return pdf(<ConfirmacionDoc a={a} cfg={cfg} />).toBlob();
  return pdf(<CertificadoDoc a={a} cfg={cfg} sello={sello} />).toBlob();
}

/* ---------------- Primera Confesión (réplica ornamental del modelo) ---------------- */

/**
 * El fondo es la imagen extraída del certificado que se entrega actualmente
 * (public/primera-confesion-fondo.jpg, con el nombre del párroco anterior
 * ya limpiado) y los datos se sobreimprimen en los renglones.
 * Página a medida con la proporción del modelo para que todo caiga en su lugar.
 */
const FONDO_CONFESION = `${import.meta.env.BASE_URL}primera-confesion-fondo.jpg`;
const CONFESION_ANCHO = 842;
const CONFESION_ALTO = 596.75;

/** Manuscrita estilo Edwardian (clon libre del modelo): firma de la Primera Confesión. */
Font.register({
  family: "Great Vibes",
  src: `${import.meta.env.BASE_URL}fonts/GreatVibes-Regular.ttf`,
});

const confesion = StyleSheet.create({
  page: { padding: 0, backgroundColor: "#ffffff" },
  fondo: { position: "absolute", top: 0, left: 0, width: CONFESION_ANCHO, height: CONFESION_ALTO },
  nombre: {
    position: "absolute", top: 215, left: "21%", width: "59%",
    textAlign: "center", fontFamily: "Helvetica", fontStyle: "italic", fontWeight: "bold",
    color: "#1a1a1a",
  },
  renglon: {
    position: "absolute", left: "30.5%", width: "49.5%",
    textAlign: "center", fontFamily: "Helvetica", fontSize: 19, color: "#1a1a1a",
  },
  // Letra manuscrita del modelo (Great Vibes solo trae Regular: sin itálica
  // ni negrita, la forma ya es caligráfica por sí misma).
  firma: {
    position: "absolute", top: 442, left: 67,
    fontFamily: "Great Vibes", fontSize: 23, color: "#111111",
  },
  /** Rayita guía dorada bajo la firma (como el modelo). */
  lineaFirma: {
    position: "absolute", top: 466, left: 67, width: 211, height: 1.5,
    backgroundColor: "#aea35a",
  },
  cargo: {
    position: "absolute", top: 469, left: "8%", width: "25%",
    textAlign: "center", fontFamily: "Helvetica", fontSize: 10, color: "#333333",
  },
});

function ConfesionDoc({ a, cfg }: { a: ActaDetalle; cfg: ParishConfig }) {
  const nombre = a.persona.apellido_nombres || "";
  const n = nombre.trim().length;
  const fsNombre = n > 34 ? 21 : n > 26 ? 24.5 : 27.5;
  return (
    <Document>
      <Page size={[CONFESION_ANCHO, CONFESION_ALTO]} style={confesion.page}>
        <Image src={FONDO_CONFESION} style={confesion.fondo} />
        <Text style={[confesion.nombre, { fontSize: fsNombre }]}>{nombre}</Text>
        <Text style={[confesion.renglon, { top: 304 }]}>{cfg.parroquia || ""}</Text>
        <Text style={[confesion.renglon, { top: 352 }]}>{fechaLarga(a.fecha_sacramento) === "—" ? "" : fechaLarga(a.fecha_sacramento)}</Text>
        {cfg.parroco ? <Text style={confesion.firma}>Pbro. {cfg.parroco}</Text> : null}
        <View style={confesion.lineaFirma} />
        {cfg.parroquia ? (
          <Text style={confesion.cargo}>Párroco {cfg.parroquia.replace(/^parroquia\s+/i, "")}</Text>
        ) : null}
      </Page>
    </Document>
  );
}

/* ---------------- Primera Comunión (réplica ornamental del modelo) ---------------- */

const FONDO_COMUNION = `${import.meta.env.BASE_URL}primera-comunion-fondo.jpg`;
const COMUNION_ANCHO = 842;
const COMUNION_ALTO = 598;

const comunion = StyleSheet.create({
  page: { padding: 0, backgroundColor: "#ffffff" },
  fondo: { position: "absolute", top: 0, left: 0, width: COMUNION_ANCHO, height: COMUNION_ALTO },
  nombre: {
    position: "absolute", top: 159, left: "32%", width: "56%",
    textAlign: "center", fontFamily: "Times-BoldItalic", color: "#1a1a1a",
  },
  renglon: {
    position: "absolute", left: "39%", width: "35.5%",
    textAlign: "center", fontFamily: "Times-Roman", fontSize: 19, color: "#1a1a1a",
  },
  firma: {
    position: "absolute", top: 502, left: 562,
    fontFamily: "Great Vibes", fontSize: 23, color: "#111111",
  },
  /** Rayita guía dorada bajo la firma (como el modelo). */
  lineaFirma: {
    position: "absolute", top: 525, left: 556, width: 189, height: 1.5,
    backgroundColor: "#aea35a",
  },
  cargo: {
    position: "absolute", top: 530, left: "60%", width: "34%",
    textAlign: "center", fontFamily: "Helvetica", fontSize: 10, color: "#333333",
  },
});

function ComunionDoc({ a, cfg }: { a: ActaDetalle; cfg: ParishConfig }) {
  const nombre = a.persona.apellido_nombres || "";
  const n = nombre.trim().length;
  const fsNombre = n > 34 ? 21 : n > 26 ? 24.5 : 27.5;
  return (
    <Document>
      <Page size={[COMUNION_ANCHO, COMUNION_ALTO]} style={comunion.page}>
        <Image src={FONDO_COMUNION} style={comunion.fondo} />
        <Text style={[comunion.nombre, { fontSize: fsNombre }]}>{nombre}</Text>
        <Text style={[comunion.renglon, { top: 259 }]}>{cfg.parroquia || ""}</Text>
        <Text style={[comunion.renglon, { top: 286 }]}>{fechaLarga(a.fecha_sacramento) === "—" ? "" : fechaLarga(a.fecha_sacramento)}</Text>
        {cfg.parroco ? <Text style={comunion.firma}>Pbro. {cfg.parroco}</Text> : null}
        <View style={comunion.lineaFirma} />
        {cfg.parroquia ? (
          <Text style={comunion.cargo}>Párroco {cfg.parroquia.replace(/^parroquia\s+/i, "")}</Text>
        ) : null}
      </Page>
    </Document>
  );
}

/* ---------------- Confirmación (réplica ornamental del modelo) ---------------- */

const FONDO_CONFIRMACION = `${import.meta.env.BASE_URL}confirmacion-fondo.jpg`;
// Página a medida con números exactos en binario (842 × 595.5): con el A4
// flotante (841.89 × 595.28) el fondo quedaba una fracción de punto más alto
// que la hoja y el texto se escapaba a una 2ª página.
const CONFIRMACION_ANCHO = 842;
const CONFIRMACION_ALTO = 595.5;

const confirmacion = StyleSheet.create({
  page: { padding: 0, backgroundColor: "#ffffff" },
  fondo: { position: "absolute", top: 0, left: 0, width: CONFIRMACION_ANCHO, height: CONFIRMACION_ALTO },
  nombre: {
    position: "absolute", top: 156, left: "27%", width: "57%",
    textAlign: "center", fontFamily: "Times-BoldItalic", color: "#1a1a1a",
  },
  padrino: {
    position: "absolute", top: 243, left: "40.5%", width: "44%",
    textAlign: "center", fontFamily: "Times-Roman", color: "#1a1a1a",
  },
  fecha: {
    position: "absolute", top: 301, left: "30%", width: "45%",
    textAlign: "center", fontFamily: "Times-Roman", fontSize: 22, color: "#1a1a1a",
  },
  firma: {
    position: "absolute", top: 534, left: 543,
    fontFamily: "Great Vibes", fontSize: 23, color: "#111111",
  },
  /** Rayita guía dorada bajo la firma (como el modelo). */
  lineaFirma: {
    position: "absolute", top: 556, left: 539, width: 215, height: 1.5,
    backgroundColor: "#aea35a",
  },
  cargo: {
    position: "absolute", top: 560, left: "58.5%", width: "35%",
    textAlign: "center", fontFamily: "Helvetica", fontSize: 10, color: "#333333",
  },
});

function ConfirmacionDoc({ a, cfg }: { a: ActaDetalle; cfg: ParishConfig }) {
  const nombre = a.persona.apellido_nombres || "";
  const n = nombre.trim().length;
  const fsNombre = n > 34 ? 21 : n > 26 ? 24.5 : 27.5;
  const padrino = padrinoEnCertificado(a);
  const np = padrino.trim().length;
  const fsPadrino = np > 40 ? 15.5 : np > 30 ? 17 : 19;
  const fecha = fechaLargaFormal(a.fecha_sacramento);
  return (
    <Document>
      <Page size={[CONFIRMACION_ANCHO, CONFIRMACION_ALTO]} style={confirmacion.page}>
        <Image src={FONDO_CONFIRMACION} style={confirmacion.fondo} />
        <Text style={[confirmacion.nombre, { fontSize: fsNombre }]}>{nombre}</Text>
        <Text style={[confirmacion.padrino, { fontSize: fsPadrino }]}>{padrino}</Text>
        <Text style={confirmacion.fecha}>{fecha === "—" ? "" : fecha}</Text>
        {cfg.parroco ? <Text style={confirmacion.firma}>Pbro. {cfg.parroco}</Text> : null}
        <View style={confirmacion.lineaFirma} />
        {cfg.parroquia ? (
          <Text style={confirmacion.cargo}>Párroco {cfg.parroquia.replace(/^parroquia\s+/i, "")}</Text>
        ) : null}
      </Page>
    </Document>
  );
}
