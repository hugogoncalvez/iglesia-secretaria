import { useEffect, useState } from "react";
import Login from "./components/Login";
import Sacramentos from "./components/Sacramentos";
import Usuarios from "./components/Usuarios";
import Configuracion from "./components/Configuracion";
import CambioClaveObligatorio from "./components/CambioClaveObligatorio";
import logoUrl from "./assets/logo.svg";
import { initDb, getMode } from "./lib/db";
import {
  ensureDefaultUser,
  getSession,
  clearSession,
  tieneClaveDefecto,
  adminConClaveDefecto,
} from "./lib/auth";

export default function App() {
  const [lista, setLista] = useState(false);
  const [usuario, setUsuario] = useState<string | null>(null);
  const [primerArranque, setPrimerArranque] = useState(false);
  const [vista, setVista] = useState<"actas" | "usuarios" | "config">("actas");
  const [debeCambiarClave, setDebeCambiarClave] = useState(false);
  const [avisoAdmin, setAvisoAdmin] = useState(false);

  async function entrar(u: string) {
    setUsuario(u);
    setDebeCambiarClave(await tieneClaveDefecto(u));
    setAvisoAdmin(await adminConClaveDefecto());
  }

  async function recheckAviso() {
    setAvisoAdmin(await adminConClaveDefecto());
  }

  useEffect(() => {
    (async () => {
      await initDb();
      setPrimerArranque(await ensureDefaultUser());
      const s = getSession();
      if (s) {
        setUsuario(s);
        setDebeCambiarClave(await tieneClaveDefecto(s));
        setAvisoAdmin(await adminConClaveDefecto());
      }
      setLista(true);
    })();
  }, []);

  if (!lista) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-parroquia-50 dark:bg-noche-800">
        <p className="text-sm text-slate-500 dark:text-slate-300">Iniciando base local…</p>
      </div>
    );
  }

  if (!usuario) {
    return (
      <Login
        esPrimerArranque={primerArranque}
        onOk={(u) => entrar(u)}
      />
    );
  }

  if (debeCambiarClave) {
    return (
      <CambioClaveObligatorio
        usuario={usuario}
        onOk={() => {
          setDebeCambiarClave(false);
          recheckAviso();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-parroquia-50 dark:bg-noche-800">
      <header className="no-print bg-slate-50 dark:bg-slate-700 border-b dark:border-slate-600 px-4 py-3 flex items-center gap-3">
        <img src={logoUrl} alt="Sello parroquial" className="w-10 h-14 object-contain" />
        <div className="flex-1">
          <h1 className="font-display font-bold text-slate-800 dark:text-slate-100">Secretaría · María Auxiliadora</h1>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            {usuario} · {getMode() === "sqlite" ? "Base local SQLite" : "Modo web temporal (en Tauri usa SQLite)"}
          </p>
        </div>
        <nav className="flex gap-1 text-sm">
          <button
            onClick={() => setVista("actas")}
            className={`rounded px-3 py-1.5 ${vista === "actas" ? "bg-slate-900 text-white" : "border dark:border-slate-500 dark:text-slate-200"}`}
          >
            Actas
          </button>
          <button
            onClick={() => setVista("usuarios")}
            className={`rounded px-3 py-1.5 ${vista === "usuarios" ? "bg-slate-900 text-white" : "border dark:border-slate-500 dark:text-slate-200"}`}
          >
            Usuarios
          </button>
          <button
            onClick={() => setVista("config")}
            className={`rounded px-3 py-1.5 ${vista === "config" ? "bg-slate-900 text-white" : "border dark:border-slate-500 dark:text-slate-200"}`}
          >
            Config
          </button>
        </nav>
        <button
          onClick={() => {
            clearSession();
            setUsuario(null);
            setDebeCambiarClave(false);
          }}
          className="text-sm border dark:border-slate-500 dark:text-slate-200 rounded px-3 py-1.5"
        >
          Salir
        </button>
      </header>

      {avisoAdmin && (
        <div className="no-print bg-amber-50 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-700 px-4 py-2 text-sm text-amber-900 dark:text-amber-100 flex items-center gap-3">
          <p className="flex-1">
            El usuario provisorio <b>admin</b> sigue con la clave de fábrica. Creá el usuario real y eliminalo.
          </p>
          <button onClick={() => setVista("usuarios")} className="underline font-medium">
            Ir a Usuarios
          </button>
        </div>
      )}

      <main className="no-print max-w-5xl mx-auto p-4 animate-fade-in">
        {vista === "actas" ? (
          <Sacramentos />
        ) : vista === "usuarios" ? (
          <Usuarios actual={usuario} onChange={recheckAviso} />
        ) : (
          <Configuracion />
        )}
      </main>
    </div>
  );
}
