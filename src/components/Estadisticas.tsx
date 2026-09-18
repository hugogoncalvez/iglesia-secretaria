import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import {
  TIPOS_SACRAMENTO,
  getConfig,
  isTauri,
  type ParishConfig,
  type TipoSacramento,
} from "../lib/db";
import {
  OBISPADO_VACIO,
  informeEstadistico,
  leerObispado,
  obispadoKey,
  usoLibros,
  type DatosObispado,
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

/* Los documentos PDF viven en DocumentosPdf.tsx y se cargan de forma diferida
   (await import) para no frenar el arranque con @react-pdf/renderer. */

/* ---------------- Planilla Obispado: datos manuales 5–8 (ver lib/estadisticas) ---------------- */

/* ---------------- CSV (abre en Excel) ---------------- */

function aCSV(inf: InformeEstadistico, libros: LibroUso[], capacidad: number, datos: DatosObispado, anio: string): string {
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
  L.push("");
  L.push(`Planilla Obispado año ${anio};Cantidad`);
  const baut = (b: string) => inf.edades.find((e) => e.bucket === b)?.BAUTISMO ?? 0;
  L.push(`1a Bautismos hasta 1 año;${baut("Menor de 1 año")}`);
  L.push(`1b Bautismos de 1 a 7 años;${baut("1 a 7 años")}`);
  L.push(`1c Bautismos mayores de 7 años;${baut("8 a 17 años") + baut("18 años o más")}`);
  L.push(`2a Matrimonios entre católicos;${inf.matrimonios.entreCatolicos}`);
  L.push(`2b Matrimonios católico + no católico;${inf.matrimonios.mixtos}`);
  L.push(`2 Matrimonios sin dato de bautismo;${inf.matrimonios.sinDato}`);
  L.push(`3 Confirmados;${inf.porTipo.CONFIRMACION}`);
  L.push(`4 Primeras comuniones;${inf.porTipo.COMUNION}`);
  L.push(`5 Catequistas;${datos.catequistas || 0}`);
  L.push(`6 Misioneros laicos;${datos.misioneros || 0}`);
  L.push(`7 Hogar ancianos mujeres;${datos.hogarMujeres || 0}`);
  L.push(`7 Hogar ancianos varones;${datos.hogarVarones || 0}`);
  L.push(`8 Capillas;${datos.capillas || 0}`);
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
  const [okMsg, setOkMsg] = useState("");
  const [generando, setGenerando] = useState<"informe" | "planilla" | null>(null);
  const [cfg, setCfg] = useState<ParishConfig | null>(null);
  const anio = (rango.desde || String(new Date().getFullYear())).slice(0, 4);
  const [datos, setDatos] = useState<DatosObispado>(OBISPADO_VACIO);

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
    setDatos(leerObispado(r.desde.slice(0, 4)));
    recargar(r.desde, r.hasta);
    getConfig().then(setCfg).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Los datos manuales 5–8 se guardan por año.
  useEffect(() => {
    setDatos(leerObispado(anio));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio]);

  function setDato(k: keyof DatosObispado) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setDatos((d) => {
        const n = { ...d, [k]: v };
        try {
          localStorage.setItem(obispadoKey(anio), JSON.stringify(n));
        } catch {
          /* almacenamiento opcional */
        }
        return n;
      });
    };
  }

  function aplicar(e: React.FormEvent) {
    e.preventDefault();
    setOkMsg("");
    recargar(rango.desde, rango.hasta);
  }

  /** Salta la planilla a un año calendario completo (01/01–31/12) y recalcula. */
  function irAAnio(a: string) {
    if (!/^\d{4}$/.test(a)) return;
    const n = Number(a);
    if (n < 1900 || n > 2100) return;
    const d = `${a}-01-01`;
    const h = `${a}-12-31`;
    setRango({ desde: d, hasta: h });
    recargar(d, h);
  }

  function bajarCSV() {
    if (!inf) return;
    const blob = new Blob([aCSV(inf, libros, capacidad, datos, anio)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `estadisticas-${rango.desde || "todo"}_${rango.hasta || "todo"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /**
   * Descarga del PDF.
   * - En navegador: descarga directa por blob (como antes).
   * - En la app instalada (Tauri): el WebView no maneja descargas por blob,
   *   así que se genera el archivo y se guarda con diálogo "Guardar como".
   */
  async function bajarPDF(cual: "informe" | "planilla") {
    if (!inf || !cfg || generando) return;
    setErr("");
    setOkMsg("");
    setGenerando(cual);
    try {
      const nombre =
        cual === "informe"
          ? `informe-${rango.desde || "todo"}_${rango.hasta || "todo"}.pdf`
          : `planilla-obispado-${anio}.pdf`;
      // Carga diferida: el motor PDF no viaja en el arranque, baja al primer uso.
      const { generarInformeBlob, generarPlanillaBlob } = await import("./DocumentosPdf");
      const blob =
        cual === "informe"
          ? await generarInformeBlob(inf, libros, capacidad, cfg)
          : await generarPlanillaBlob(inf, datos, anio, cfg);
      if (!isTauri()) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = nombre;
        a.click();
        URL.revokeObjectURL(a.href);
        return;
      }
      const destino = await save({
        defaultPath: nombre,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!destino) return; // usuario canceló
      await writeFile(destino, new Uint8Array(await blob.arrayBuffer()));
      setOkMsg(`PDF guardado en ${destino}.`);
    } catch (e) {
      setErr(mensajeError(e, "No se pudo generar el PDF."));
    } finally {
      setGenerando(null);
    }
  }

  const maxMes = Math.max(1, ...((inf?.porMes ?? []).map((m) => m.total)));
  const bautSinDato = inf?.edades.find((e) => e.bucket === "Sin dato")?.BAUTISMO ?? 0;
  const numCls = "mt-1 w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-2 bg-parroquia-100 dark:bg-noche-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-parroquia-700";

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
          <button
            type="button"
            onClick={() => void bajarPDF("informe")}
            disabled={!inf || !cfg || generando !== null}
            className="border border-slate-300 dark:border-slate-500 rounded-lg px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <Download size={14} />{generando === "informe" ? "Generando…" : "Informe PDF"}
          </button>
          <button
            type="button"
            onClick={() => void bajarPDF("planilla")}
            disabled={!inf || !cfg || generando !== null}
            className="bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <Download size={14} />{generando === "planilla" ? "Generando…" : "Planilla Obispado"}
          </button>
          {false && (
            <button type="button" onClick={bajarCSV} disabled={!inf} className="border border-slate-300 dark:border-slate-500 rounded-lg px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-40">
              <Download size={14} />CSV
            </button>
          )}
        </div>
      </form>

      {err && <p className="text-sm text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded p-2">{err}</p>}
      {okMsg && <p className="text-sm text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700 rounded p-2">{okMsg}</p>}

      {cargando ? (
        <p className="text-sm text-slate-500 dark:text-slate-300">Generando informe…</p>
      ) : inf && (
        <>
          {(inf.matrimonios.sinDato > 0 || bautSinDato > 0) && (
            <div className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 rounded p-2 space-y-1">
              {inf.matrimonios.sinDato > 0 && (
                <p>Hay {inf.matrimonios.sinDato} matrimonio(s) sin dato de bautismo: no entran en 2a/2b. Revisá las actas (tildá “No bautizado” donde corresponda).</p>
              )}
              {bautSinDato > 0 && (
                <p>Hay {bautSinDato} bautismo(s) sin fecha de nacimiento: no entran en 1a/1b/1c.</p>
              )}
            </div>
          )}

          <div className="bg-white dark:bg-noche-700 dark:text-slate-100 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display font-bold">Planilla del Obispado</h3>
              <input
                type="number" min={1900} max={2100}
                title="Año de la planilla (pone el rango en 01/01–31/12)"
                className="w-24 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 bg-parroquia-100 dark:bg-noche-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-parroquia-700 tabular-nums"
                value={anio}
                onChange={(e) => irAAnio(e.target.value)}
              />
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(puntos 1–4 automáticos del rango · 5–8 a completar)</span>
            </div>
            <p className="text-sm mt-1 text-slate-600 dark:text-slate-300">
              2a entre católicos: <b className="tabular-nums">{inf.matrimonios.entreCatolicos}</b>
              {" · "}2b mixtos: <b className="tabular-nums">{inf.matrimonios.mixtos}</b>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
              <div>
                <label className="text-xs font-medium">Catequistas (5)</label>
                <input type="number" min={0} className={numCls} value={datos.catequistas} onChange={setDato("catequistas")} />
              </div>
              <div>
                <label className="text-xs font-medium">Misioneros (6)</label>
                <input type="number" min={0} className={numCls} value={datos.misioneros} onChange={setDato("misioneros")} />
              </div>
              <div>
                <label className="text-xs font-medium">Hogar mujeres (7)</label>
                <input type="number" min={0} className={numCls} value={datos.hogarMujeres} onChange={setDato("hogarMujeres")} />
              </div>
              <div>
                <label className="text-xs font-medium">Hogar varones (7)</label>
                <input type="number" min={0} className={numCls} value={datos.hogarVarones} onChange={setDato("hogarVarones")} />
              </div>
              <div>
                <label className="text-xs font-medium">Capillas (8)</label>
                <input type="number" min={0} className={numCls} value={datos.capillas} onChange={setDato("capillas")} />
              </div>
            </div>
          </div>

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
