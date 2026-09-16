import { useEffect, useState } from "react";
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { Download } from "lucide-react";
import {
  TIPOS_SACRAMENTO,
  getConfig,
  type ParishConfig,
  type TipoSacramento,
} from "../lib/db";
import {
  informeEstadistico,
  usoLibros,
  type InformeEstadistico,
  type LibroUso,
} from "../lib/estadisticas";
import { mensajeError } from "../lib/errores";

const ETIQUETAS: { tipo: TipoSacramento; label: string; punto: string }[] = [
  { tipo: "BAUTISMO", label: "Bautismos", punto: "bg-[#1D4ED8]" },
  { tipo: "COMUNION", label: "Comuniones", punto: "bg-[#065F46]" },
  { tipo: "CONFIRMACION", label: "Confirmaciones", punto: "bg-[#5B21B6]" },
  { tipo: "MATRIMONIO", label: "Matrimonios", punto: "bg-[#9D174D]" },
];

const CAPACIDAD_KEY = "iglesia_capacidad_libro";

function anioActual(): { desde: string; hasta: string } {
  const y = new Date().getFullYear();
  return { desde: `${y}-01-01`, hasta: `${y}-12-31` };
}

function mesLargo(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${meses[m - 1]} ${y}`;
}

/* ---------------- PDF ---------------- */

const pdf = StyleSheet.create({
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
      <Page size="A4" style={pdf.page}>
        <Text style={pdf.parroquia}>{cfg.parroquia}</Text>
        <Text style={pdf.sub}>{cfg.devocion} · {cfg.diocesis}</Text>
        <Text style={pdf.titulo}>Informe estadístico de sacramentos</Text>
        <Text style={pdf.rango}>Período: {inf.desde || "—"} al {inf.hasta || "—"}</Text>

        <Text style={pdf.h2}>Resumen por sacramento</Text>
        <View style={pdf.tabla}>
          <View style={pdf.fila}>
            <Text style={pdf.celdaHead}>Sacramento</Text>
            <Text style={[pdf.celdaHead, { textAlign: "right" }]}>Cantidad</Text>
          </View>
          {TIPOS_SACRAMENTO.map((t) => (
            <View style={pdf.fila} key={t}>
              <Text style={pdf.celda}>{t}</Text>
              <Text style={pdf.celdaDer}>{inf.porTipo[t]}</Text>
            </View>
          ))}
          <View style={pdf.fila}>
            <Text style={pdf.celdaHead}>TOTAL</Text>
            <Text style={[pdf.celdaHead, { textAlign: "right" }]}>{inf.total}</Text>
          </View>
        </View>

        <Text style={pdf.h2}>Detalle mensual</Text>
        <View style={pdf.tabla}>
          <View style={pdf.fila}>
            <Text style={pdf.celdaHead}>Mes</Text>
            {TIPOS_SACRAMENTO.map((t) => (
              <Text key={t} style={[pdf.celdaHead, { textAlign: "right" }]}>{t.slice(0, 4)}.</Text>
            ))}
            <Text style={[pdf.celdaHead, { textAlign: "right" }]}>Total</Text>
          </View>
          {inf.porMes.map((m) => (
            <View style={pdf.fila} key={m.mes}>
              <Text style={pdf.celda}>{m.mes}</Text>
              {TIPOS_SACRAMENTO.map((t) => (
                <Text key={t} style={pdf.celdaDer}>{m[t]}</Text>
              ))}
              <Text style={pdf.celdaDer}>{m.total}</Text>
            </View>
          ))}
        </View>

        <Text style={pdf.h2}>Edades al recibir el sacramento</Text>
        <View style={pdf.tabla}>
          <View style={pdf.fila}>
            <Text style={pdf.celdaHead}>Rango de edad</Text>
            {(["BAUTISMO", "COMUNION", "CONFIRMACION"] as const).map((t) => (
              <Text key={t} style={[pdf.celdaHead, { textAlign: "right" }]}>{t.slice(0, 4)}.</Text>
            ))}
          </View>
          {inf.edades.map((e) => (
            <View style={pdf.fila} key={e.bucket}>
              <Text style={pdf.celda}>{e.bucket}</Text>
              <Text style={pdf.celdaDer}>{e.BAUTISMO}</Text>
              <Text style={pdf.celdaDer}>{e.COMUNION}</Text>
              <Text style={pdf.celdaDer}>{e.CONFIRMACION}</Text>
            </View>
          ))}
        </View>

        <Text style={pdf.h2}>Estado de libros (acumulado, capacidad {capacidad} actas)</Text>
        <View style={pdf.tabla}>
          <View style={pdf.fila}>
            <Text style={pdf.celdaHead}>Sacramento</Text>
            <Text style={pdf.celdaHead}>Libro</Text>
            <Text style={[pdf.celdaHead, { textAlign: "right" }]}>Usadas</Text>
          </View>
          {libros.map((l, i) => (
            <View style={pdf.fila} key={i}>
              <Text style={pdf.celda}>{l.tipo}</Text>
              <Text style={pdf.celda}>{l.libro}</Text>
              <Text style={pdf.celdaDer}>{l.cantidad}/{capacidad}</Text>
            </View>
          ))}
        </View>

        <Text style={pdf.pie}>Emisión: {new Date().toLocaleString()}</Text>
      </Page>
    </Document>
  );
}

/* ---------------- CSV (abre en Excel) ---------------- */

function aCSV(inf: InformeEstadistico, libros: LibroUso[], capacidad: number): string {
  const L: string[] = [];
  const cel = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  L.push(`Informe estadístico de sacramentos;${inf.desde || ""} al ${inf.hasta || ""}`);
  L.push("");
  L.push("Sacramento;Cantidad");
  for (const t of TIPOS_SACRAMENTO) L.push(`${t};${inf.porTipo[t]}`);
  L.push(`TOTAL;${inf.total}`);
  L.push("");
  L.push(`Mes;${TIPOS_SACRAMENTO.join(";")};Total`);
  for (const m of inf.porMes) L.push(`${m.mes};${TIPOS_SACRAMENTO.map((t) => m[t]).join(";")};${m.total}`);
  L.push("");
  L.push("Rango de edad;Bautismos;Comuniones;Confirmaciones");
  for (const e of inf.edades) L.push(`${cel(e.bucket)};${e.BAUTISMO};${e.COMUNION};${e.CONFIRMACION}`);
  L.push("");
  L.push(`Libro (acumulado, capacidad ${capacidad});Sacramento;Usadas`);
  for (const l of libros) L.push(`${cel(`Libro ${l.libro}`)};${l.tipo};${l.cantidad}`);
  return "﻿" + L.join("\r\n");
}

/* ---------------- Pantalla ---------------- */

export default function Estadisticas() {
  const [rango, setRango] = useState(anioActual);
  const [inf, setInf] = useState<InformeEstadistico | null>(null);
  const [libros, setLibros] = useState<LibroUso[]>([]);
  const [capacidad, setCapacidad] = useState(() => Number(localStorage.getItem(CAPACIDAD_KEY) ?? 200) || 200);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState("");
  const [cfg, setCfg] = useState<ParishConfig | null>(null);

  async function recargar(d: string, h: string) {
    setCargando(true);
    setErr("");
    try {
      const [i, l] = await Promise.all([informeEstadistico(d, h), usoLibros()]);
      setInf(i);
      setLibros(l);
    } catch (e) {
      setErr(mensajeError(e, "No se pudo generar el informe."));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const r = anioActual();
    setRango(r);
    recargar(r.desde, r.hasta);
    getConfig().then(setCfg).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aplicar(e: React.FormEvent) {
    e.preventDefault();
    recargar(rango.desde, rango.hasta);
  }

  function bajarCSV() {
    if (!inf) return;
    const blob = new Blob([aCSV(inf, libros, capacidad)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `estadisticas-${rango.desde || "todo"}_${rango.hasta || "todo"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const maxMes = Math.max(1, ...((inf?.porMes ?? []).map((m) => m.total)));

  return (
    <div className="space-y-3">
      <form onSubmit={aplicar} className="bg-white dark:bg-noche-700 dark:text-slate-100 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-3 grid grid-cols-1 md:grid-cols-5 gap-2">
        <div>
          <label className="text-xs font-medium">Desde</label>
          <input type="date" className="mt-1 w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-2 bg-parroquia-100 dark:bg-noche-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-parroquia-700" value={rango.desde} onChange={(e) => setRango({ ...rango, desde: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-medium">Hasta</label>
          <input type="date" className="mt-1 w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-2 bg-parroquia-100 dark:bg-noche-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-parroquia-700" value={rango.hasta} onChange={(e) => setRango({ ...rango, hasta: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-medium">Capacidad por libro</label>
          <input
            type="number" min={1}
            className="mt-1 w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-2 bg-parroquia-100 dark:bg-noche-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-parroquia-700"
            value={capacidad}
            onChange={(e) => {
              const n = Number(e.target.value) || 200;
              setCapacidad(n);
              localStorage.setItem(CAPACIDAD_KEY, String(n));
            }}
          />
        </div>
        <div className="flex items-end gap-2 md:col-span-2">
          <button className="bg-parroquia-900 hover:bg-parroquia-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">Generar</button>
          {inf && cfg && (
            <PDFDownloadLink
              document={<InformeDoc inf={inf} libros={libros} capacidad={capacidad} cfg={cfg} />}
              fileName={`informe-${rango.desde || "todo"}_${rango.hasta || "todo"}.pdf`}
              className="border border-slate-300 dark:border-slate-500 rounded-lg px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5"
            >
              {({ loading }) => (<><Download size={14} />{loading ? "Generando PDF…" : "PDF"}</>)}
            </PDFDownloadLink>
          )}
          <button type="button" onClick={bajarCSV} disabled={!inf} className="border border-slate-300 dark:border-slate-500 rounded-lg px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-40">
            <Download size={14} />CSV
          </button>
        </div>
      </form>

      {err && <p className="text-sm text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded p-2">{err}</p>}

      {cargando ? (
        <p className="text-sm text-slate-500 dark:text-slate-300">Generando informe…</p>
      ) : inf && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {ETIQUETAS.map(({ tipo, label, punto }) => (
              <div key={tipo} className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-noche-700 px-3 py-2 shadow-sm">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${punto}`} />
                <span className="font-display text-xl font-bold text-parroquia-900 dark:text-slate-100 tabular-nums">{inf.porTipo[tipo]}</span>
                <span className="text-slate-500 dark:text-slate-300 text-sm">{label}</span>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-noche-700 dark:text-slate-100 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <h3 className="font-display font-bold px-4 pt-3">Detalle mensual</h3>
            {inf.porMes.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 dark:text-slate-300">Sin movimientos en el período.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-parroquia-900 dark:text-slate-300">
                    <th className="px-4 py-2 text-left font-semibold">Mes</th>
                    {TIPOS_SACRAMENTO.map((t) => <th key={t} className="px-2 py-2 text-right font-semibold">{t.slice(0, 4)}.</th>)}
                    <th className="px-4 py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                  {inf.porMes.map((m) => (
                    <tr key={m.mes} className="hover:bg-slate-100 dark:hover:bg-slate-600/50">
                      <td className="px-4 py-2 tabular-nums">{mesLargo(m.mes)}</td>
                      {TIPOS_SACRAMENTO.map((t) => (
                        <td key={t} className="px-2 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{m[t]}</td>
                      ))}
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 h-2 rounded bg-slate-100 dark:bg-slate-600 overflow-hidden">
                            <div className="h-full bg-parroquia-700 rounded" style={{ width: `${Math.round((m.total / maxMes) * 100)}%` }} />
                          </div>
                          <span className="tabular-nums font-medium w-8 text-right">{m.total}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white dark:bg-noche-700 dark:text-slate-100 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <h3 className="font-display font-bold px-4 pt-3">Edades al recibir el sacramento</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-parroquia-900 dark:text-slate-300">
                  <th className="px-4 py-2 text-left font-semibold">Rango de edad</th>
                  <th className="px-2 py-2 text-right font-semibold">Baut.</th>
                  <th className="px-2 py-2 text-right font-semibold">Com.</th>
                  <th className="px-4 py-2 text-right font-semibold">Conf.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                {inf.edades.map((e) => (
                  <tr key={e.bucket} className="hover:bg-slate-100 dark:hover:bg-slate-600/50">
                    <td className="px-4 py-2">{e.bucket}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{e.BAUTISMO}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{e.COMUNION}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{e.CONFIRMACION}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white dark:bg-noche-700 dark:text-slate-100 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <h3 className="font-display font-bold px-4 pt-3">Estado de libros <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(acumulado total · capacidad {capacidad} actas)</span></h3>
            {libros.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 dark:text-slate-300">Sin libros registrados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-parroquia-900 dark:text-slate-300">
                    <th className="px-4 py-2 text-left font-semibold">Libro</th>
                    <th className="px-2 py-2 text-left font-semibold">Sacramento</th>
                    <th className="px-4 py-2 text-right font-semibold">Usadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                  {libros.map((l, i) => {
                    const pct = Math.min(100, Math.round((l.cantidad / capacidad) * 100));
                    return (
                      <tr key={i} className="hover:bg-slate-100 dark:hover:bg-slate-600/50">
                        <td className="px-4 py-2">Libro {l.libro}</td>
                        <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{l.tipo}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 h-2 rounded bg-slate-100 dark:bg-slate-600 overflow-hidden">
                              <div className={`h-full rounded ${pct >= 100 ? "bg-red-600" : pct >= 80 ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="tabular-nums font-medium w-16 text-right">{l.cantidad}/{capacidad}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
