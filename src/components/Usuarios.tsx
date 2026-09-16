import { useEffect, useState } from "react";
import {
  cambiarPassword,
  crearUsuario,
  eliminarUsuario,
  listUsuariosDetalle,
} from "../lib/auth";
import ClaveInput from "./ClaveInput";
import { logAccion } from "../lib/auditoria";
import { mensajeError } from "../lib/errores";
import { KeyRound, Trash2 } from "lucide-react";

export default function Usuarios({ actual, onChange }: { actual: string; onChange?: () => void }) {
  const [usuarios, setUsuarios] = useState<{ usuario: string; debeCambiar: boolean }[]>([]);
  const [nuevo, setNuevo] = useState("");
  const [claveNueva, setClaveNueva] = useState("");
  const [cambiando, setCambiando] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [claveCambio, setClaveCambio] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function recargar() {
    setUsuarios(await listUsuariosDetalle());
  }

  useEffect(() => {
    recargar();
  }, []);

  function ok(m: string) {
    setMsg(m);
    setErr("");
    setTimeout(() => setMsg(""), 3000);
  }
  function fail(e: unknown) {
    setErr(mensajeError(e));
    setMsg("");
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await crearUsuario(nuevo, claveNueva);
      void logAccion(actual, "USUARIO_CREAR", `Usuario "${nuevo.trim()}" creado.`);
      setNuevo("");
      setClaveNueva("");
      await recargar();
      onChange?.();
      ok("Usuario creado. Deberá cambiar su clave al entrar.");
    } catch (e) {
      fail(e);
    }
  }

  async function guardarClave(u: string) {
    if (u !== actual) {
      fail("Solo podés cambiar tu propia clave.");
      return;
    }
    try {
      await cambiarPassword(u, claveCambio);
      void logAccion(actual, "CLAVE_CAMBIAR", `El usuario "${u}" cambió su clave.`);
      setCambiando(null);
      setClaveCambio("");
      await recargar();
      onChange?.();
      ok("Tu clave fue actualizada.");
    } catch (e) {
      fail(e);
    }
  }

  async function borrar(u: string) {
    if (u === actual) {
      fail("No podés eliminar tu propio usuario mientras lo estás usando.");
      return;
    }
    if (usuarios.length <= 1) {
      fail("Debe quedar al menos un usuario.");
      return;
    }
    setEliminando(u);
  }

  async function confirmarBorrado() {
    if (!eliminando) return;
    const u = eliminando;
    setEliminando(null);
    try {
      await eliminarUsuario(u);
      void logAccion(actual, "USUARIO_ELIMINAR", `Usuario "${u}" eliminado.`);
      await recargar();
      onChange?.();
      ok("Usuario eliminado.");
    } catch (e) {
      fail(e);
    }
  }

  return (
    <div className="space-y-3 max-w-md mx-auto">
      <form onSubmit={agregar} className="bg-white dark:bg-noche-700 dark:text-slate-100 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 space-y-3 max-w-md">
        <h3 className="font-display font-bold">Nuevo usuario</h3>
        <div>
          <label className="text-xs font-medium">Usuario</label>
          <input
            className="mt-1 w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-parroquia-100 dark:bg-noche-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-parroquia-700 focus:border-transparent transition-colors"
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            placeholder="Ej: secretaria"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Clave inicial</label>
          <ClaveInput
            className="mt-1 w-full border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-parroquia-100 dark:bg-noche-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-parroquia-700 focus:border-transparent transition-colors"
            value={claveNueva}
            onChange={setClaveNueva}
            placeholder="Mínimo 4 caracteres"
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">El usuario deberá cambiarla al entrar por primera vez.</p>
        </div>
        <button className="w-full bg-parroquia-900 hover:bg-parroquia-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors">Agregar usuario</button>
      </form>

      {msg && <p className="text-sm text-green-700 dark:text-green-200 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-700 rounded p-2">{msg}</p>}
      {err && <p className="text-sm text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded p-2">{err}</p>}

      <div className="bg-white dark:bg-noche-700 dark:text-slate-100 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-parroquia-100 dark:bg-noche-600 text-xs uppercase tracking-wide text-parroquia-900 dark:text-slate-300">
              <th className="px-4 py-3 text-left font-semibold">Usuario</th>
              <th className="px-4 py-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
            {usuarios.map(({ usuario: u, debeCambiar }) => (
              <tr key={u} className="hover:bg-slate-100 dark:hover:bg-slate-600/50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                  {u} {u === actual && <span className="text-xs text-slate-400 dark:text-slate-400 font-normal">(vos)</span>}
                  {debeCambiar && (
                    <span className="ml-2 inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                      Cambio pendiente
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {cambiando === u ? (
                      <span className="inline-flex flex-wrap gap-2 items-center justify-end">
                        <ClaveInput
                          className="border rounded px-2 py-1 text-sm bg-white dark:bg-slate-700 dark:border-slate-500 dark:text-slate-100"
                          value={claveCambio}
                          onChange={setClaveCambio}
                          placeholder="Nueva clave"
                        />
                        <button className="underline" onClick={() => guardarClave(u)}>Guardar</button>
                        <button className="underline text-slate-500 dark:text-slate-300" onClick={() => { setCambiando(null); setClaveCambio(""); }}>Cancelar</button>
                      </span>
                    ) : (
                      <>
                        {u === actual && (
                          <button
                            title="Cambiar mi clave"
                            onClick={() => { setCambiando(u); setClaveCambio(""); }}
                            className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 transition-colors"
                          >
                            <KeyRound size={15} />
                          </button>
                        )}
                        <button
                          title="Eliminar"
                          onClick={() => borrar(u)}
                          className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {eliminando && (
        <div className="no-print fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={() => setEliminando(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-noche-700 dark:text-slate-100 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 max-w-md w-full p-5 space-y-3 animate-modal-in"
          >
            <h3 className="font-display font-bold text-lg">Eliminar usuario</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              ¿Eliminar el usuario <b>{eliminando}</b>?
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEliminando(null)}
                className="border border-slate-300 dark:border-slate-500 rounded-lg px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarBorrado}
                className="bg-red-700 hover:bg-red-800 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
