import { useState } from "react";
import { Lock, User } from "lucide-react";
import { validateLogin, setSession } from "../lib/auth";
import logoUrl from "../assets/logo.svg";
import ClaveInput from "./ClaveInput";

const inputCls =
  "mt-1 w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2.5 bg-white dark:bg-noche-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-parroquia-700 focus:border-transparent transition-colors";

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
    <div className="min-h-screen flex bg-parroquia-50 dark:bg-noche-800 animate-fade-in">
      {/* Panel institucional */}
      <div className="hidden md:flex md:w-[35%] relative overflow-hidden bg-parroquia-900 text-white flex-col p-10">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -left-20 w-60 h-60 rounded-full bg-dorado-400/10" />
        <p className="relative text-sm tracking-widest uppercase text-slate-300">
          Secretaría Parroquial
        </p>
        <div className="relative flex-1 flex flex-col items-center justify-center text-center">
          <img src={logoUrl} alt="Sello parroquial" className="w-36 mx-auto drop-shadow-xl" />
          <h1 className="font-display text-3xl font-bold mt-4">María Auxiliadora</h1>
          <p className="text-sm text-slate-300 mt-1">Patrona de Garupá · Diócesis de Posadas</p>
          <div className="mx-auto w-16 h-0.5 bg-dorado-400 mt-4" />
        </div>
      </div>

      {/* Formulario */}
      <div className="flex-1 flex items-center justify-center p-6">
        <form onSubmit={entrar} className="w-full max-w-sm space-y-4">
          <div className="md:hidden text-center">
            <img src={logoUrl} alt="Sello parroquial" className="w-20 mx-auto" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-800 dark:text-slate-100">Ingresar</h2>
          </div>
          {esPrimerArranque && (
            <p className="text-xs bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-100 rounded-lg p-3">
              Primer arranque: usuario <b>admin</b> / clave <b>admin123</b>. El sistema te va a pedir cambiarla.
            </p>
          )}
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Usuario</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <User size={16} />
              </span>
              <input
                className={`${inputCls} pl-10`}
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Contraseña</label>
            <ClaveInput
              className={inputCls}
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              icon={<Lock size={16} />}
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            disabled={cargando}
            className="w-full bg-parroquia-900 hover:bg-parroquia-700 text-white rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {cargando ? "Verificando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
