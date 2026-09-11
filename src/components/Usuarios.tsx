import { useEffect, useState } from "react";
import {
  cambiarPassword,
  crearUsuario,
  eliminarUsuario,
  listUsuarios,
} from "../lib/auth";
import ClaveInput from "./ClaveInput";

export default function Usuarios({ actual, onChange }: { actual: string; onChange?: () => void }) {
  const [usuarios, setUsuarios] = useState<string[]>([]);
  const [nuevo, setNuevo] = useState("");
  const [claveNueva, setClaveNueva] = useState("");
  const [cambiando, setCambiando] = useState<string | null>(null);
  const [claveCambio, setClaveCambio] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function recargar() {
    setUsuarios(await listUsuarios());
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
    setErr(e instanceof Error ? e.message : "Ocurrió un error.");
    setMsg("");
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await crearUsuario(nuevo, claveNueva);
      setNuevo("");
      setClaveNueva("");
      await recargar();
      onChange?.();
      ok("Usuario creado.");
    } catch (e) {
      fail(e);
    }
  }

  async function guardarClave(u: string) {
    try {
      await cambiarPassword(u, claveCambio);
      setCambiando(null);
      setClaveCambio("");
      onChange?.();
      ok(`Clave de "${u}" actualizada.`);
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
    if (!confirm(`¿Eliminar el usuario "${u}"?`)) return;
    try {
      await eliminarUsuario(u);
      await recargar();
      onChange?.();
      ok("Usuario eliminado.");
    } catch (e) {
      fail(e);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={agregar} className="bg-slate-50 dark:bg-slate-700 dark:text-slate-100 rounded-xl shadow p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium">Nuevo usuario</label>
          <input
            className="mt-1 w-full border rounded px-2 py-1.5 bg-slate-50 dark:bg-slate-700 dark:border-slate-500 dark:text-slate-100"
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            placeholder="Ej: secretaria"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Clave inicial</label>
          <ClaveInput
            className="mt-1 w-full border rounded px-2 py-1.5 bg-white dark:bg-slate-700 dark:border-slate-500 dark:text-slate-100"
            value={claveNueva}
            onChange={setClaveNueva}
            placeholder="Mínimo 4 caracteres"
          />
        </div>
        <div className="flex items-end">
          <button className="bg-slate-900 text-white rounded px-4 py-1.5 text-sm">Agregar usuario</button>
        </div>
      </form>

      {msg && <p className="text-sm text-green-700 dark:text-green-200 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-700 rounded p-2">{msg}</p>}
      {err && <p className="text-sm text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded p-2">{err}</p>}

      <div className="bg-slate-50 dark:bg-slate-700 dark:text-slate-100 rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-200 dark:bg-slate-600 text-left">
            <tr>
              <th className="p-2">Usuario</th>
              <th className="p-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u} className="border-t dark:border-slate-600">
                <td className="p-2 font-medium">
                  {u} {u === actual && <span className="text-xs text-slate-500 dark:text-slate-300">(vos)</span>}
                </td>
                <td className="p-2 text-right space-x-2">
                  {cambiando === u ? (
                    <span className="inline-flex gap-2 items-center">
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
                      <button className="underline" onClick={() => { setCambiando(u); setClaveCambio(""); }}>Cambiar clave</button>
                      <button className="underline text-red-600 dark:text-red-400" onClick={() => borrar(u)}>Eliminar</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-300">Los usuarios y claves se guardan solo en esta PC, junto con los registros.</p>
    </div>
  );
}
