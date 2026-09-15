import { useState } from "react";
import { cambiarPassword } from "../lib/auth";
import { logAccion } from "../lib/auditoria";
import ClaveInput from "./ClaveInput";

/** Pantalla bloqueante: obliga a cambiar la clave de fábrica antes de usar la app. */
export default function CambioClaveObligatorio({
  usuario,
  onOk,
}: {
  usuario: string;
  onOk: () => void;
}) {
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState("");

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (nueva !== repetir) {
      setError("Las claves no coinciden.");
      return;
    }
    try {
      await cambiarPassword(usuario, nueva);
      void logAccion(usuario, "CLAVE_CAMBIAR", `El usuario "${usuario}" definió su clave.`);
      onOk();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-parroquia-50 dark:bg-noche-800 p-4">
      <form onSubmit={guardar} className="w-full max-w-sm bg-slate-50 dark:bg-slate-700 dark:text-slate-100 rounded-xl shadow p-6 space-y-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-800 dark:text-slate-100">Cambiá tu clave</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Por seguridad, definí una nueva clave para <b>{usuario}</b> antes de continuar.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium">Nueva clave</label>
          <ClaveInput
            className="mt-1 w-full border rounded px-3 py-2 bg-white dark:bg-slate-700 dark:border-slate-500 dark:text-slate-100"
            value={nueva}
            onChange={setNueva}
            autoFocus
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Repetir nueva clave</label>
          <ClaveInput
            className="mt-1 w-full border rounded px-3 py-2 bg-white dark:bg-slate-700 dark:border-slate-500 dark:text-slate-100"
            value={repetir}
            onChange={setRepetir}
            autoComplete="new-password"
          />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button className="w-full bg-slate-900 text-white rounded py-2">
          Guardar y continuar
        </button>
      </form>
    </div>
  );
}
