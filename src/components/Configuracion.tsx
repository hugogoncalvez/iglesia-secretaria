import { useEffect, useState } from "react";
import { getConfig, saveConfig, type ParishConfig } from "../lib/db";
import { hacerBackup } from "../lib/backup";

const inputCls = "mt-1 w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-parroquia-100 dark:bg-noche-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-parroquia-700 focus:border-transparent transition-colors";

export default function Configuracion() {
  const [cfg, setCfg] = useState<ParishConfig | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [backupMsg, setBackupMsg] = useState("");
  const [respaldando, setRespaldando] = useState(false);

  useEffect(() => {
    getConfig().then(setCfg);
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!cfg) return;
    setErr("");
    try {
      await saveConfig(cfg);
      setMsg("Datos guardados. Se usan en el membrete y la firma de los certificados.");
      setTimeout(() => setMsg(""), 4000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ocurrió un error.");
    }
  }

  async function respaldar() {
    setBackupMsg("");
    setRespaldando(true);
    try {
      setBackupMsg(await hacerBackup());
    } catch (e) {
      if (e instanceof Error && e.message !== "cancelado") {
        setBackupMsg(`No se pudo hacer el resguardo: ${e.message}`);
      }
    } finally {
      setRespaldando(false);
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

      <div className="bg-white dark:bg-noche-700 dark:text-slate-100 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 space-y-3">
        <h3 className="font-display font-bold">Resguardo de datos</h3>
        <p className="text-xs text-slate-500 dark:text-slate-300">
          Copia la base de datos completa (actas, personas y usuarios) a la carpeta o pendrive que elijas.
          Hacelo periódicamente.
        </p>
        <button
          onClick={respaldar}
          disabled={respaldando}
          className="bg-parroquia-900 hover:bg-parroquia-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {respaldando ? "Copiando…" : "Hacer copia de seguridad"}
        </button>
        {backupMsg && <p className="text-sm text-slate-700 dark:text-slate-200 bg-parroquia-100 dark:bg-noche-600 border border-slate-200 dark:border-slate-600 rounded-lg p-2 break-all">{backupMsg}</p>}
      </div>
    </div>
  );
}
