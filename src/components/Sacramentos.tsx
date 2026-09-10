import { useEffect, useId, useState } from "react";
import { Eye, FileText, Pencil, Trash2 } from "lucide-react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import {
  CON_CERTIFICADO,
  DEFAULT_PARISH,
  SACRAMENTO_VACIO,
  TIPOS_SACRAMENTO,
  actualizarActa,
  crearActa,
  docActa,
  eliminarActa,
  getConfig,
  getDetalle,
  listActas,
  nombreActa,
  type ActaDetalle,
  type ActaRow,
  type FiltrosActas,
  type ParishConfig,
  type Persona,
  type SacramentoInput,
  type TipoSacramento,
} from "../lib/db";
import { CertificadoDoc, CertificadoPrintable } from "./Certificado";
import { selloPng } from "../lib/sello";
import { sembrarDemo } from "../lib/demo";

const inputCls = "mt-1 w-full border rounded px-2 py-1.5 bg-slate-50 dark:bg-slate-700 dark:border-slate-500 dark:text-slate-100";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}

const NACIONALIDADES = [
  "Argentina",
  "Brasil",
  "Paraguay",
  "Bolivia",
  "Chile",
  "Uruguay",
  "Perú",
  "Colombia",
  "Venezuela",
  "Ecuador",
];

/** Select con búsqueda y escritura libre (datalist), por defecto Argentina. */
function NacionalidadInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <>
      <input
        className={inputCls}
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Argentina"
      />
      <datalist id={id}>
        {NACIONALIDADES.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </>
  );
}

function PersonaForm({
  titulo,
  value,
  onChange,
}: {
  titulo: string;
  value: Persona;
  onChange: (p: Persona) => void;
}) {
  const set = (k: keyof Persona) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });
  return (
    <fieldset className="border dark:border-slate-500 rounded-lg p-3 grid grid-cols-1 md:grid-cols-6 gap-3">
      <legend className="text-sm font-bold px-1">{titulo}</legend>
      <div className="md:col-span-4">
        <Campo label="Apellido y nombres *">
          <input className={inputCls} value={value.apellido_nombres} onChange={set("apellido_nombres")} required />
        </Campo>
      </div>
      <div className="md:col-span-2">
        <Campo label="DNI">
          <input className={inputCls} value={value.documento} onChange={set("documento")} />
        </Campo>
      </div>
      <div className="md:col-span-2">
        <Campo label="Fecha nacimiento">
          <input type="date" className={inputCls} value={value.fecha_nacimiento} onChange={set("fecha_nacimiento")} />
        </Campo>
      </div>
      <div className="md:col-span-4">
        <Campo label="Lugar nacimiento">
          <input className={inputCls} value={value.lugar_nacimiento} onChange={set("lugar_nacimiento")} />
        </Campo>
      </div>
      <div className="md:col-span-3">
        <Campo label="Nacionalidad">
          <NacionalidadInput value={value.nacionalidad} onChange={(v) => onChange({ ...value, nacionalidad: v })} />
        </Campo>
      </div>
      <div className="md:col-span-3">
        <Campo label="Teléfono">
          <input className={inputCls} value={value.telefono} onChange={set("telefono")} />
        </Campo>
      </div>
      <div className="md:col-span-6">
        <Campo label="Domicilio">
          <input className={inputCls} value={value.domicilio} onChange={set("domicilio")} />
        </Campo>
      </div>
      <div className="md:col-span-3">
        <Campo label="Padre">
          <input className={inputCls} value={value.nombre_padre} onChange={set("nombre_padre")} />
        </Campo>
      </div>
      <div className="md:col-span-3">
        <Campo label="Madre">
          <input className={inputCls} value={value.nombre_madre} onChange={set("nombre_madre")} />
        </Campo>
      </div>
    </fieldset>
  );
}

/** Bautismo previo de un contrayente: "Bautizado en ... el ... Libro N° ... Folio ..." */
function BautismoPrevio({
  titulo,
  form,
  prefijo,
  onChange,
}: {
  titulo: string;
  form: SacramentoInput;
  prefijo: "esposo_baut" | "esposa_baut" | "conf_baut";
  onChange: (patch: Partial<SacramentoInput>) => void;
}) {
  const v = (k: "lugar" | "fecha" | "libro" | "folio"): string =>
    String(form[`${prefijo}_${k}` as keyof SacramentoInput] ?? "");
  const set = (k: "lugar" | "fecha" | "libro" | "folio") => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ [`${prefijo}_${k}`]: e.target.value } as Partial<SacramentoInput>);
  return (
    <fieldset className="border dark:border-slate-500 rounded-lg p-3 grid grid-cols-1 md:grid-cols-6 gap-3">
      <legend className="text-sm font-bold px-1">{titulo}</legend>
      <div className="md:col-span-2">
        <Campo label="Bautizado en">
          <input className={inputCls} value={v("lugar")} onChange={set("lugar")} />
        </Campo>
      </div>
      <div className="md:col-span-2">
        <Campo label="Fecha de bautismo">
          <input type="date" className={inputCls} value={v("fecha")} onChange={set("fecha")} />
        </Campo>
      </div>
      <div className="md:col-span-1">
        <Campo label="Libro N°">
          <input className={inputCls} value={v("libro")} onChange={set("libro")} />
        </Campo>
      </div>
      <div className="md:col-span-1">
        <Campo label="Folio">
          <input className={inputCls} value={v("folio")} onChange={set("folio")} />
        </Campo>
      </div>
    </fieldset>
  );
}

export default function Sacramentos() {
  const [filtros, setFiltros] = useState<FiltrosActas>({ texto: "", tipo: "TODOS", fecha: "" });
  const [filas, setFilas] = useState<ActaRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<SacramentoInput>({ ...SACRAMENTO_VACIO, fecha_sacramento: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState("");
  const [viendo, setViendo] = useState<ActaDetalle | null>(null);
  const [imprimiendo, setImprimiendo] = useState<ActaDetalle | null>(null);
  const [cfg, setCfg] = useState<ParishConfig>(DEFAULT_PARISH);
  const [sello, setSello] = useState<string | null>(null);
  const [demoMsg, setDemoMsg] = useState("");

  async function recargar(f: FiltrosActas) {
    setCargando(true);
    try {
      setFilas(await listActas(f));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar({ texto: "", tipo: "TODOS", fecha: "" });
    getConfig().then(setCfg).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => recargar(filtros), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros]);

  function abrirNuevo() {
    setEditId(null);
    setForm({
      ...SACRAMENTO_VACIO,
      persona: { ...SACRAMENTO_VACIO.persona },
      esposo: { ...SACRAMENTO_VACIO.esposo },
      esposa: { ...SACRAMENTO_VACIO.esposa },
      fecha_sacramento: new Date().toISOString().slice(0, 10),
      parroquia_capilla: cfg.parroquia,
    });
    setError("");
    setFormAbierto(true);
  }

  async function abrirEditar(id: number) {
    const d = await getDetalle(id);
    if (!d) return;
    setEditId(id);
    setForm({ ...d });
    setError("");
    setFormAbierto(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (form.tipo === "MATRIMONIO") {
        if (!form.esposo.apellido_nombres.trim() || !form.esposa.apellido_nombres.trim())
          throw new Error("Cargá apellido y nombres de ambos contrayentes.");
      } else if (!form.persona.apellido_nombres.trim()) {
        throw new Error("Cargá apellido y nombres.");
      }
      if (!form.fecha_sacramento) throw new Error("Cargá la fecha del sacramento.");
      if (editId) await actualizarActa(editId, form);
      else await crearActa(form);
      setFormAbierto(false);
      recargar(filtros);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error.");
    }
  }

  async function borrar(r: ActaRow) {
    if (!confirm(`¿Eliminar el acta de "${nombreActa(r)}"?`)) return;
    await eliminarActa(r.id);
    recargar(filtros);
  }

  async function ver(id: number) {
    setViendo(await getDetalle(id));
  }

  async function certificado(id: number) {
    const d = await getDetalle(id);
    if (!d) return;
    setImprimiendo(d);
    getConfig().then(setCfg).catch(() => undefined);
    selloPng().then(setSello).catch(() => setSello(null));
  }

  async function cargarDemo() {
    setDemoMsg("");
    try {
      const n = await sembrarDemo();
      setDemoMsg(`Se cargaron ${n} actas de prueba (una por sacramento).`);
      recargar({ texto: "", tipo: "TODOS", fecha: "" });
    } catch (e) {
      setDemoMsg(e instanceof Error ? e.message : "No se pudo cargar la demo.");
    }
  }

  const f = form;
  const setF = (k: keyof SacramentoInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-3">
      {/* Búsqueda */}
      <div className="bg-slate-50 dark:bg-slate-700 dark:text-slate-100 rounded-xl shadow p-3 grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          className="border rounded px-3 py-2 md:col-span-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-500 dark:text-slate-100"
          placeholder="Buscar por apellido, nombre o DNI…"
          value={filtros.texto}
          onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })}
        />
        <select
          className="border rounded px-2 py-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-500 dark:text-slate-100"
          value={filtros.tipo}
          onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value as FiltrosActas["tipo"] })}
        >
          <option value="TODOS">Todos los sacramentos</option>
          {TIPOS_SACRAMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex gap-2">
          <input
            type="date"
            title="Fecha del sacramento"
            className="border rounded px-2 py-2 flex-1 bg-slate-50 dark:bg-slate-700 dark:border-slate-500 dark:text-slate-100"
            value={filtros.fecha}
            onChange={(e) => setFiltros({ ...filtros, fecha: e.target.value })}
          />
          <button onClick={abrirNuevo} className="text-sm bg-slate-900 text-white rounded px-3 py-1.5 whitespace-nowrap">+ Acta</button>
        </div>
      </div>

      {/* Listado */}
      <div className="bg-slate-50 dark:bg-slate-700 dark:text-slate-100 rounded-xl shadow overflow-hidden">
        {cargando ? (
          <p className="p-4 text-sm text-slate-500 dark:text-slate-300">Cargando…</p>
        ) : filas.length === 0 ? (
          <div className="p-4 space-y-2">
            <p className="text-sm text-slate-500 dark:text-slate-300">Sin actas. Creá la primera con “+ Acta”.</p>
            {import.meta.env.DEV && (
              <button onClick={cargarDemo} className="text-sm border dark:border-slate-500 rounded px-3 py-1.5">
                Cargar datos de prueba (4 actas)
              </button>
            )}
            {demoMsg && <p className="text-sm text-slate-600 dark:text-slate-300">{demoMsg}</p>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-600 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                <th className="px-4 py-3 text-left font-semibold">Persona(s)</th>
                <th className="px-4 py-3 text-left font-semibold">Sacramento</th>
                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                <th className="px-4 py-3 text-left font-semibold">Libro / Folio</th>
                <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
              {filas.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-slate-100 dark:hover:bg-slate-600/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800 dark:text-slate-100">{nombreActa(r)}</span>
                    <span className="block text-xs text-slate-400 dark:text-slate-400 mt-0.5">DNI: {docActa(r)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                      r.tipo === "BAUTISMO"      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" :
                      r.tipo === "COMUNION"      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" :
                      r.tipo === "CONFIRMACION"  ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" :
                      r.tipo === "MATRIMONIO"    ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {r.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">
                    {r.fecha_sacramento}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">
                    {r.libro}/{r.folio}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        title="Ver detalle"
                        onClick={() => ver(r.id)}
                        className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-500 text-slate-500 dark:text-slate-300 transition-colors"
                      >
                        <Eye size={15} />
                      </button>
                      {(CON_CERTIFICADO as string[]).includes(r.tipo) && (
                        <button
                          title="Certificado"
                          onClick={() => certificado(r.id)}
                          className="p-1.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 transition-colors"
                        >
                          <FileText size={15} />
                        </button>
                      )}
                      <button
                        title="Editar"
                        onClick={() => abrirEditar(r.id)}
                        className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        title="Eliminar"
                        onClick={() => borrar(r)}
                        className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Formulario adaptativo */}
      {formAbierto && (
        <div className="no-print fixed inset-0 bg-black/40 flex items-start justify-center p-4 overflow-auto">
          <form onSubmit={guardar} className="bg-slate-50 dark:bg-slate-700 dark:text-slate-100 rounded-xl shadow max-w-3xl w-full p-4 space-y-4 my-6">
            <h3 className="font-bold">{editId ? "Editar acta" : "Nueva acta"}</h3>

            <Campo label="Sacramento">
              <select
                className={inputCls}
                value={f.tipo}
                disabled={editId !== null}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoSacramento })}
              >
                {TIPOS_SACRAMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Campo>

            {f.tipo === "MATRIMONIO" ? (
              <>
                <PersonaForm titulo="Esposo" value={f.esposo} onChange={(p) => setForm({ ...form, esposo: p })} />
                <BautismoPrevio
                  titulo="Bautismo del esposo"
                  form={form}
                  prefijo="esposo_baut"
                  onChange={(patch) => setForm({ ...form, ...patch })}
                />
                <PersonaForm titulo="Esposa" value={f.esposa} onChange={(p) => setForm({ ...form, esposa: p })} />
                <BautismoPrevio
                  titulo="Bautismo de la esposa"
                  form={form}
                  prefijo="esposa_baut"
                  onChange={(patch) => setForm({ ...form, ...patch })}
                />
              </>
            ) : (
              <PersonaForm
                titulo={f.tipo === "BAUTISMO" || f.tipo === "COMUNION" ? "Niño/a" : f.tipo === "CONFIRMACION" ? "Confirmando" : "Persona"}
                value={f.persona}
                onChange={(p) => setForm({ ...form, persona: p })}
              />
            )}

            <fieldset className="border dark:border-slate-500 rounded-lg p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <legend className="text-sm font-bold px-1">Datos del acta</legend>
              <Campo label="Fecha del sacramento *">
                <input type="date" className={inputCls} value={f.fecha_sacramento} onChange={setF("fecha_sacramento")} required />
              </Campo>
              <Campo label={
                f.tipo === "MATRIMONIO"
                  ? "Celebrante (Diácono / Presbítero / Obispo)"
                  : f.tipo === "CONFIRMACION"
                    ? "Ungido/a con el Santo Crisma por (Ministro)"
                    : "Ministro / Celebrante"
              }>
                <input className={inputCls} value={f.ministro_celebrante} onChange={setF("ministro_celebrante")} />
              </Campo>
              <Campo label="Parroquia / Capilla">
                <input className={inputCls} value={f.parroquia_capilla} onChange={setF("parroquia_capilla")} />
              </Campo>
              <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <Campo label="Libro">
                  <input className={inputCls} value={f.libro} onChange={setF("libro")} />
                </Campo>
                <Campo label="Folio">
                  <input className={inputCls} value={f.folio} onChange={setF("folio")} />
                </Campo>
              </div>
              {f.tipo === "CONFIRMACION" && (
                <div className="md:col-span-3">
                  <BautismoPrevio
                    titulo="Bautismo previo"
                    form={form}
                    prefijo="conf_baut"
                    onChange={(patch) => setForm({ ...form, ...patch })}
                  />
                </div>
              )}
              {f.tipo === "BAUTISMO" && (
                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Campo label="Padrino">
                    <input className={inputCls} value={f.padrino} onChange={setF("padrino")} />
                  </Campo>
                  <Campo label="Madrina">
                    <input className={inputCls} value={f.madrina} onChange={setF("madrina")} />
                  </Campo>
                </div>
              )}
              {f.tipo === "MATRIMONIO" && (
                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Campo label="Testigo 1 (Padrino)">
                    <input className={inputCls} value={f.testigo_1} onChange={setF("testigo_1")} />
                  </Campo>
                  <Campo label="Testigo 2 (Madrina)">
                    <input className={inputCls} value={f.testigo_2} onChange={setF("testigo_2")} />
                  </Campo>
                </div>
              )}
              {f.tipo === "MATRIMONIO" && (
                <div className="md:col-span-3">
                  <Campo label="Domicilio del matrimonio (se domiciliará en)">
                    <input className={inputCls} value={f.domicilio_matrimonial} onChange={setF("domicilio_matrimonial")} />
                  </Campo>
                </div>
              )}
              <div className="md:col-span-3">
                <Campo label="Notas marginales">
                  <input className={inputCls} value={f.notas_marginales} onChange={setF("notas_marginales")} />
                </Campo>
              </div>
              {f.tipo === "MATRIMONIO" && (
                <div className="md:col-span-3">
                  <Campo label="Referencia documental (Ver nota(s) en folio(s) N°)">
                    <input className={inputCls} value={f.referencia_folios} onChange={setF("referencia_folios")} />
                  </Campo>
                </div>
              )}
            </fieldset>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button className="bg-slate-900 text-white rounded px-4 py-1.5 text-sm">{editId ? "Guardar cambios" : "Guardar acta"}</button>
              <button type="button" className="border dark:border-slate-500 rounded px-4 py-1.5 text-sm" onClick={() => setFormAbierto(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Detalle */}
      {viendo && (
        <DetalleModal
          a={viendo}
          onClose={() => setViendo(null)}
          onCertificado={() => { const id = viendo.id; setViendo(null); certificado(id); }}
        />
      )}

      {/* Certificado */}
      {imprimiendo && (CON_CERTIFICADO as string[]).includes(imprimiendo.tipo) && (
        <div className="no-print fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-slate-50 dark:bg-slate-700 dark:text-slate-100 rounded-xl shadow max-w-2xl w-full p-4 space-y-3 max-h-[90vh] overflow-auto">
            <h3 className="font-bold">Certificado — {imprimiendo.persona.apellido_nombres}</h3>
            <CertificadoPrintable a={imprimiendo} cfg={cfg} />
            <div className="flex flex-wrap gap-2">
              <button className="bg-slate-900 text-white rounded px-4 py-1.5 text-sm" onClick={() => window.print()}>Imprimir</button>
              <PDFDownloadLink
                document={<CertificadoDoc a={imprimiendo} cfg={cfg} sello={sello} />}
                fileName={`certificado-${imprimiendo.tipo.toLowerCase()}-${imprimiendo.id}.pdf`}
                className="border dark:border-slate-500 rounded px-4 py-1.5 text-sm"
              >
                {({ loading }) => (loading ? "Generando PDF…" : "Descargar PDF")}
              </PDFDownloadLink>
              <button className="border dark:border-slate-500 rounded px-4 py-1.5 text-sm" onClick={() => setImprimiendo(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden print:block">
        {imprimiendo && <CertificadoPrintable a={imprimiendo} cfg={cfg} />}
      </div>
    </div>
  );
}

function textoBautismo(a: ActaDetalle, prefijo: "esposo_baut" | "esposa_baut" | "conf_baut"): string {
  const g = (k: "lugar" | "fecha" | "libro" | "folio"): string =>
    String(a[`${prefijo}_${k}` as keyof ActaDetalle] ?? "");
  const lugar = g("lugar"), fecha = g("fecha"), libro = g("libro"), folio = g("folio");
  if (!lugar && !fecha && !libro && !folio) return "—";
  return `Bautizado en ${lugar || "—"} el ${fecha || "—"} — Libro ${libro || "—"}, Folio ${folio || "—"}`;
}

function DetalleModal({ a, onClose, onCertificado }: { a: ActaDetalle; onClose: () => void; onCertificado: () => void }) {
  const tituloPersona = a.tipo === "BAUTISMO" || a.tipo === "COMUNION" ? "Niño/a" : a.tipo === "CONFIRMACION" ? "Confirmando" : "Persona";
  const personas = a.tipo === "MATRIMONIO" ? [ ["Esposo", a.esposo], ["Esposa", a.esposa] ] as const : [[tituloPersona, a.persona]] as const;
  const Filas: [string, string][] = [
    ["Fecha del sacramento", a.fecha_sacramento || "—"],
    [
      a.tipo === "MATRIMONIO"
        ? "Celebrante (Diácono / Presbítero / Obispo)"
        : a.tipo === "CONFIRMACION"
          ? "Ungido/a con el Santo Crisma por (Ministro)"
          : "Ministro / Celebrante",
      a.ministro_celebrante || "—",
    ],
    ["Parroquia / Capilla", a.parroquia_capilla || "—"],
    ["Libro / Folio", `${a.libro || "—"} / ${a.folio || "—"}`],
  ];
  if (a.tipo === "BAUTISMO") Filas.push(["Padrinos", `${a.padrino || "—"} / ${a.madrina || "—"}`]);
  if (a.tipo === "CONFIRMACION") Filas.push(["Bautismo previo", textoBautismo(a, "conf_baut")]);
  if (a.tipo === "MATRIMONIO") {
    Filas.push(["Bautismo del esposo", textoBautismo(a, "esposo_baut")]);
    Filas.push(["Bautismo de la esposa", textoBautismo(a, "esposa_baut")]);
  }
  if (a.tipo === "MATRIMONIO") {
    Filas.push(["Testigo 1 (Padrino)", a.testigo_1 || "—"]);
    Filas.push(["Testigo 2 (Madrina)", a.testigo_2 || "—"]);
    Filas.push(["Domicilio del matrimonio", a.domicilio_matrimonial || "—"]);
  }
  Filas.push(["Notas marginales", a.notas_marginales || "—"]);
  if (a.tipo === "MATRIMONIO") Filas.push(["Referencia documental", a.referencia_folios || "—"]);

  return (
    <div className="no-print fixed inset-0 bg-black/40 flex items-start justify-center p-4 overflow-auto">
      <div className="bg-slate-50 dark:bg-slate-700 dark:text-slate-100 rounded-xl shadow max-w-2xl w-full p-4 space-y-3 my-6">
        <h3 className="font-bold">Acta de {a.tipo} — Libro {a.libro || "—"}, Folio {a.folio || "—"}</h3>
        {personas.map(([titulo, p]) => (
          <div key={titulo} className="border dark:border-slate-500 rounded-lg p-3 text-sm grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
            <p className="md:col-span-2 font-bold">{titulo}: {p.apellido_nombres}</p>
            <p><b>DNI:</b> {p.documento || "—"}</p>
            <p><b>Nacimiento:</b> {p.fecha_nacimiento || "—"} {p.lugar_nacimiento}</p>
            <p><b>Nacionalidad:</b> {p.nacionalidad || "—"}</p>
            <p><b>Teléfono:</b> {p.telefono || "—"}</p>
            <p className="md:col-span-2"><b>Domicilio:</b> {p.domicilio || "—"}</p>
            <p><b>Padre:</b> {p.nombre_padre || "—"}</p>
            <p><b>Madre:</b> {p.nombre_madre || "—"}</p>
          </div>
        ))}
        <div className="text-sm space-y-1">
          {Filas.map(([k, v]) => <p key={k}><b>{k}:</b> {v}</p>)}
        </div>
        <div className="flex gap-2">
          {(CON_CERTIFICADO as string[]).includes(a.tipo) && (
            <button className="bg-slate-900 text-white rounded px-4 py-1.5 text-sm" onClick={onCertificado}>Certificado</button>
          )}
          <button className="border dark:border-slate-500 rounded px-4 py-1.5 text-sm" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
