import { useEffect, useState } from "react";
import { SearchX } from "lucide-react";
import {
  ACCIONES_AUDITORIA,
  ETIQUETAS_ACCION,
  FILTROS_AUDITORIA_VACIOS,
  listAuditoria,
  usuariosAuditoria,
  type FiltrosAuditoria,
  type RegistroAuditoria,
} from "../lib/auditoria";

function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  return d.toLocaleString();
}

export default function Auditoria() {
  const [filtros, setFiltros] = useState<FiltrosAuditoria>(FILTROS_AUDITORIA_VACIOS);
  const [filas, setFilas] = useState<RegistroAuditoria[]>([]);
  const [usuarios, setUsuarios] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);

  async function recargar(f: FiltrosAuditoria) {
    setCargando(true);
    try {
      setFilas(await listAuditoria(f));
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    usuariosAuditoria().then(setUsuarios).catch(() => undefined);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => recargar(filtros), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros]);

  const hayFiltros =
    filtros.texto !== "" || filtros.usuario !== "" || filtros.accion !== "" || filtros.desde !== "" || filtros.hasta !== "";

  function limpiar() {
    setFiltros(FILTROS_AUDITORIA_VACIOS);
  }

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-noche-700 dark:text-slate-100 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-3 grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 md:col-span-2 bg-parroquia-100 dark:bg-noche-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-parroquia-700"
          placeholder="Buscar en usuario, acción o detalle…"
          value={filtros.texto}
          onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })}
        />
        <select
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-2 bg-parroquia-100 dark:bg-noche-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-parroquia-700"
          value={filtros.usuario}
          onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })}
        >
          <option value="">Todos los usuarios</option>
          {usuarios.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-2 bg-parroquia-100 dark:bg-noche-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-parroquia-700"
          value={filtros.accion}
          onChange={(e) => setFiltros({ ...filtros, accion: e.target.value })}
        >
          <option value="">Todas las acciones</option>
          {ACCIONES_AUDITORIA.map((a) => <option key={a} value={a}>{ETIQUETAS_ACCION[a]}</option>)}
        </select>
        <input
          type="date"
          title="Desde"
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-2 bg-parroquia-100 dark:bg-noche-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-parroquia-700"
          value={filtros.desde}
          onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
        />
        <input
          type="date"
          title="Hasta"
          className="border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-2 bg-parroquia-100 dark:bg-noche-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-parroquia-700"
          value={filtros.hasta}
          onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })}
        />
        <div className="md:col-span-2 flex items-center">
          {hayFiltros && (
            <button onClick={limpiar} className="text-sm border dark:border-slate-500 rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-noche-700 dark:text-slate-100 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        {cargando ? (
          <p className="p-4 text-sm text-slate-500 dark:text-slate-300">Cargando…</p>
        ) : filas.length === 0 ? (
          <div className="p-6 space-y-3 text-center">
            <SearchX size={28} className="mx-auto text-slate-300 dark:text-slate-500" />
            <p className="text-sm text-slate-500 dark:text-slate-300">Sin movimientos registrados con esos filtros.</p>
            {hayFiltros && (
              <button onClick={limpiar} className="text-sm border dark:border-slate-500 rounded px-3 py-1.5">
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-parroquia-100 dark:bg-noche-600 text-xs uppercase tracking-wide text-parroquia-900 dark:text-slate-300">
                <th className="px-4 py-3 text-left font-semibold">Fecha y hora</th>
                <th className="px-4 py-3 text-left font-semibold">Usuario</th>
                <th className="px-4 py-3 text-left font-semibold">Acción</th>
                <th className="px-4 py-3 text-left font-semibold">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
              {filas.map((r) => (
                <tr key={r.id} className="hover:bg-slate-100 dark:hover:bg-slate-600/50 transition-colors">
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                    {fechaCorta(r.fecha_hora)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.usuario}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-600 dark:text-slate-200">
                      {ETIQUETAS_ACCION[r.accion as keyof typeof ETIQUETAS_ACCION] ?? r.accion}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
