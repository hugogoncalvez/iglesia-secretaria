import { useState } from "react";
import { validateLogin, setSession } from "../lib/auth";
import logoUrl from "../assets/logo.svg";

export default function Login({ onOk, esPrimerArranque }: { onOk: (u: string) => void; esPrimerArranque: boolean }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const ok = await validateLogin(usuario, password);
      if (!ok) {
        setError("Usuario o contraseña incorrectos.");
        return;
      }
      setSession(usuario.trim());
      onOk(usuario.trim());
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-200 dark:bg-slate-800 p-4">
      <form onSubmit={entrar} className="w-full max-w-sm bg-slate-50 dark:bg-slate-700 dark:text-slate-100 rounded-xl shadow p-6 space-y-4">
        <div className="text-center">
          <img src={logoUrl} alt="Sello parroquial" className="w-20 h-28 object-contain mx-auto" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-2">María Auxiliadora · Garupá</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">Acceso local — los datos quedan en esta PC</p>
        </div>
        {esPrimerArranque && (
          <p className="text-xs bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-100 rounded p-2">
            Primer arranque: usuario <b>admin</b> / clave <b>admin123</b>. Cambiala luego desde la base.
          </p>
        )}
        <div>
          <label className="text-sm font-medium">Usuario</label>
          <input
            className="mt-1 w-full border rounded px-3 py-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-500 dark:text-slate-100"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Contraseña</label>
          <input
            type="password"
            className="mt-1 w-full border rounded px-3 py-2 bg-slate-50 dark:bg-slate-700 dark:border-slate-500 dark:text-slate-100"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          disabled={cargando}
          className="w-full bg-slate-900 text-white rounded py-2 disabled:opacity-50"
        >
          {cargando ? "Verificando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
