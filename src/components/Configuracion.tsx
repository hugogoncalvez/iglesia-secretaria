import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ETIQUETA_TIPO, TIPOS_CON_LIBRO, crearLibro, eliminarLibro, getConfig, infoBase, listLibros, saveConfig, setEstadoLibro, type LibroFisico, type ParishConfig, type TipoSacramento } from "../lib/db";
import { hacerBackup } from "../lib/backup";
import { logAccion } from "../lib/auditoria";
import { mensajeError } from "../lib/errores";
import { version } from "../../package.json";
import {
  aplicarRestauracion,
  elegirCopia,
  type DatosResguardo,
  type ResumenCopia,
} from "../lib/restore";

const inputCls = "mt-1 w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-parroquia-100 dark:bg-noche-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-parroquia-700 focus:border-transparent transition-colors";

export default function Configuracion({ actual }: { actual: string }) {
  const [cfg, setCfg] = useState<ParishConfig | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [backupMsg, setBackupMsg] = useState("");
  const [respaldando, setRespaldando] = useState(false);
  const [copia, setCopia] = useState<{
    datos: DatosResguardo;
    resumen: ResumenCopia;
  } | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [restErr, setRestErr] = useState("");
  const [baseInfo, setBaseInfo] = useState("Consultando…");

  useEffect(() => {
    getConfig().then(setCfg);
    infoBase()
      .then((b) =>
        setBaseInfo(
          b.modo === "sqlite"
            ? `SQLite — ${b.ruta}`
            : b.motivo
              ? `localStorage — motivo: ${b.motivo}`
              : b.ruta
        )
      )
      .catch(() => setBaseInfo("No se pudo determinar."));
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!cfg) return;
    setErr("");
    try {
      await saveConfig(cfg);
      void logAccion(actual, "CONFIG", "Datos de la parroquia actualizados.");
      setMsg("Datos guardados. Se usan en el membrete y la firma de los certificados.");
      setTimeout(() => setMsg(""), 4000);
    } catch (e) {
      setErr(mensajeError(e));
    }
  }

  async function respaldar() {
    setBackupMsg("");
    setRespaldando(true);
    try {
      const msg = await hacerBackup();
      void logAccion(actual, "RESGUARDO", msg);
      setBackupMsg(msg);
    } catch (e) {
      const m = mensajeError(e);
      setBackupMsg(m === "cancelado" ? "Resguardo cancelado: no se eligió destino." : `No se pudo hacer el resguardo: ${m}`);
    } finally {
      setRespaldando(false);
    }
  }

  async function elegir() {
    setRestErr("");
    setEligiendo(true);
    try {
      const sel = await elegirCopia();
      if (sel) setCopia(sel);
    } catch (e) {
      setRestErr(mensajeError(e, "No se pudo leer la copia."));
    } finally {
      setEligiendo(false);
    }
  }

  async function restaurar() {
    if (!copia) return;
    setRestErr("");
    setRestaurando(true);
    try {
      await aplicarRestauracion(copia.datos);
    } catch (e) {
      setRestErr(mensajeError(e, "No se pudo restaurar."));
      setRestaurando(false);
    }
  }

  if (!cfg) return <p className="text-sm text-slate-500 dark:text-slate-300">Cargando…</p>;

  const set = (k: keyof ParishConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCfg({ ...cfg, [k]: e.target.value });

  return (
    <div className="space-y-3">
      <form onSubmit={guardar} className="bg-white dark:bg-noche-700 dark:text-slate-100 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <h3 className="font-display font-bold">Datos de la parroquia</h3>
        <p className="text-xs text-slate-500 dark:text-slate-300">Aparecen en el membrete y la firma de los certificados.</p>
        <div>
          <label className="text-xs font-medium">Parroquia</label>
          <input className={inputCls} value={cfg.parroquia} onChange={set("parroquia")} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium">Advocación / Patrona</label>
            <input className={inputCls} value={cfg.devocion} onChange={set("devocion")} />
          </div>
          <div>
            <label className="text-xs font-medium">Diócesis</label>
            <input className={inputCls} value={cfg.diocesis} onChange={set("diocesis")} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium">Dirección</label>
          <input className={inputCls} value={cfg.direccion} onChange={set("direccion")} />
        </div>
        <div>
          <label className="text-xs font-medium">Párroco (firma)</label>
          <input className={inputCls} value={cfg.parroco} onChange={set("parroco")} placeholder="Ej: Juan Pérez" />
        </div>
        {msg && <p className="text-sm text-green-700 dark:text-green-200 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-700 rounded p-2">{msg}</p>}
        {err && <p className="text-sm text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded p-2">{err}</p>}
        <button className="bg-parroquia-900 hover:bg-parroquia-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">Guardar</button>
      </form>

      <LibrosSection />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="bg-white dark:bg-noche-700 dark:text-slate-100 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <h3 className="font-display font-bold">Resguardo de datos</h3>
        <p className="text-xs text-slate-500 dark:text-slate-300">
          Copia la base de datos completa (actas, personas y usuarios) a la carpeta o pendrive que elijas.
          Hacelo periódicamente.
        </p>
        <button
          onClick={respaldar}
          disabled={respaldando}
          className="bg-parroquia-900 hover:bg-parroquia-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {respaldando && <Loader2 size={14} className="animate-spin" />}
          {respaldando ? "Copiando…" : "Hacer copia de seguridad"}
        </button>
        {backupMsg && <p className="text-sm text-slate-700 dark:text-slate-200 bg-parroquia-100 dark:bg-noche-600 border border-slate-200 dark:border-slate-600 rounded-lg p-2 break-all">{backupMsg}</p>}
      </div>

      <div className="bg-white dark:bg-noche-700 dark:text-slate-100 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <h3 className="font-display font-bold">Restaurar copia</h3>
        <p className="text-xs text-slate-500 dark:text-slate-300">
          Reemplaza todos los datos actuales por los de una copia de seguridad.
        </p>
        {!copia ? (
          <button
            onClick={elegir}
            disabled={eligiendo}
            className="bg-parroquia-900 hover:bg-parroquia-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {eligiendo && <Loader2 size={14} className="animate-spin" />}
            {eligiendo ? "Leyendo…" : "Elegir copia…"}
          </button>
        ) : (
          <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/40 p-3 space-y-2 text-sm">
            <p><b>Archivo:</b> <span className="break-all">{copia.resumen.nombre}</span></p>
            <p>
              {copia.resumen.actas} actas · {copia.resumen.personas} personas · {copia.resumen.usuarios} usuarios
              {copia.resumen.fecha ? <> · {new Date(copia.resumen.fecha).toLocaleString()}</> : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={restaurar}
                disabled={restaurando}
                className="bg-red-700 hover:bg-red-800 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {restaurando && <Loader2 size={14} className="animate-spin" />}
                {restaurando ? "Restaurando…" : "Confirmar restauración"}
              </button>
              <button
                onClick={() => setCopia(null)}
                disabled={restaurando}
                className="border border-slate-300 dark:border-slate-500 rounded-lg px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        {restErr && <p className="text-sm text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded p-2">{restErr}</p>}
        </div>
      </div>

      <div className="bg-white dark:bg-noche-700 dark:text-slate-100 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 space-y-1 max-w-md">
        <h3 className="font-display font-bold">Acerca de</h3>
        <p className="text-sm font-medium">Scriptorium</p>
        <p className="text-xs text-slate-500 dark:text-slate-300">Versión {version}</p>
        <p className="text-xs text-slate-500 dark:text-slate-300 break-all">Base: {baseInfo}</p>
        <p className="text-xs text-slate-500 dark:text-slate-300">Desarrollador: Hugo Goncalvez</p>
        <p className="text-xs text-slate-500 dark:text-slate-300">hugogoncalvez@gmail.com</p>
      </div>
    </div>
  );
}

/** Alta y cierre de libros físicos. Sin libro abierto del tipo, no se guardan actas. */
function LibrosSection() {
  const [libros, setLibros] = useState<LibroFisico[]>([]);
  const [tipo, setTipo] = useState<TipoSacramento>("BAUTISMO");
  const [numero, setNumero] = useState("");
  const [hojas, setHojas] = useState("");
  const [err, setErr] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [operando, setOperando] = useState<number | null>(null);

  async function recargar() {
    try {
      setLibros(await listLibros());
    } catch (e) {
      setErr(mensajeError(e, "No se pudieron leer los libros."));
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (agregando) return;
    setErr("");
    setAgregando(true);
    try {
      await crearLibro(tipo, numero, Number(hojas));
      setNumero("");
      setHojas("");
      await recargar();
    } catch (e) {
      setErr(mensajeError(e));
    } finally {
      setAgregando(false);
    }
  }

  async function cambiarEstado(l: LibroFisico) {
    setErr("");
    setOperando(l.id);
    try {
      await setEstadoLibro(l.id, l.estado === "abierto" ? "cerrado" : "abierto");
      await recargar();
    } catch (e) {
      setErr(mensajeError(e));
    } finally {
      setOperando(null);
    }
  }

  async function borrar(l: LibroFisico) {
    if (!window.confirm(`¿Eliminar el libro N° ${l.numero} de ${ETIQUETA_TIPO[l.tipo]}? Solo se puede si no tiene actas.`)) return;
    setErr("");
    setOperando(l.id);
    try {
      await eliminarLibro(l.id);
      await recargar();
    } catch (e) {
      setErr(mensajeError(e));
    } finally {
      setOperando(null);
    }
  }

  return (
    <div className="bg-white dark:bg-noche-700 dark:text-slate-100 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 space-y-3">
      <div>
        <h3 className="font-display font-bold">Libros de actas</h3>
        <p className="text-xs text-slate-500 dark:text-slate-300">
          Sin libro registrado y abierto del tipo, el sistema no deja guardar actas (Primera Confesión no lleva libro).
        </p>
      </div>
      <form onSubmit={agregar} className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
        <div>
          <label className="text-xs font-medium">Tipo</label>
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value as TipoSacramento)}>
            {TIPOS_CON_LIBRO.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">N° de libro</label>
          <input className={inputCls} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ej: 3" />
        </div>
        <div>
          <label className="text-xs font-medium">Hojas</label>
          <input type="number" min={1} className={inputCls} value={hojas} onChange={(e) => setHojas(e.target.value)} placeholder="Ej: 500" />
        </div>
        <div>
          <button
            disabled={agregando}
            className="w-full bg-parroquia-900 hover:bg-parroquia-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {agregando && <Loader2 size={14} className="animate-spin" />}
            {agregando ? "Agregando…" : "Agregar"}
          </button>
        </div>
      </form>
      {err && <p className="text-sm text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded p-2">{err}</p>}
      {libros.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-300">Todavía no hay libros cargados.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-parroquia-900 dark:text-slate-300">
              <th className="px-2 py-2 text-left font-semibold">Tipo</th>
              <th className="px-2 py-2 text-left font-semibold">N°</th>
              <th className="px-2 py-2 text-right font-semibold">Hojas</th>
              <th className="px-2 py-2 text-left font-semibold">Estado</th>
              <th className="px-2 py-2 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
            {libros.map((l) => (
              <tr key={l.id} className="hover:bg-slate-100 dark:hover:bg-slate-600/50">
                <td className="px-2 py-2">{ETIQUETA_TIPO[l.tipo]}</td>
                <td className="px-2 py-2 tabular-nums">{l.numero}</td>
                <td className="px-2 py-2 text-right tabular-nums">{l.hojas}</td>
                <td className="px-2 py-2">
                  <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${l.estado === "abierto" ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200" : "bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300"}`}>
                    {l.estado === "abierto" ? "Abierto" : "Cerrado"}
                  </span>
                </td>
                <td className="px-2 py-2">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => void cambiarEstado(l)}
                      disabled={operando !== null}
                      className="text-xs underline disabled:opacity-40"
                    >
                      {l.estado === "abierto" ? "Cerrar" : "Reabrir"}
                    </button>
                    <button
                      onClick={() => void borrar(l)}
                      disabled={operando !== null}
                      className="text-xs underline text-red-700 dark:text-red-300 disabled:opacity-40"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
