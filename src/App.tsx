import { useEffect, useState, type CSSProperties } from "react";
import { LogOut, Moon, Sun } from "lucide-react";
import Login from "./components/Login";
import Sacramentos from "./components/Sacramentos";
import Usuarios from "./components/Usuarios";
import Configuracion from "./components/Configuracion";
import Auditoria from "./components/Auditoria";
import Estadisticas from "./components/Estadisticas";
import CambioClaveObligatorio from "./components/CambioClaveObligatorio";
import Sidebar, { type Vista } from "./components/Sidebar";
import { ToastHost, useToasts } from "./components/Toasts";
import { initDb, getMode, isTauri, infoBase } from "./lib/db";
import {
  ensureDefaultUser,
  getSession,
  clearSession,
  debeCambiarClave as debeCambiarClaveCheck,
  adminConClaveDefecto,
} from "./lib/auth";
import { aplicarTema, getTema, type Tema } from "./lib/tema";
import { logAccion } from "./lib/auditoria";

const TITULOS: Record<Vista, string> = {
  actas: "Actas",
  usuarios: "Usuarios",
  config: "Configuración",
  auditoria: "Auditoría",
  estadisticas: "Estadísticas",
};

export default function App() {
  const [lista, setLista] = useState(false);
  const [usuario, setUsuario] = useState<string | null>(null);
  const [primerArranque, setPrimerArranque] = useState(false);
  const [vista, setVista] = useState<Vista>("actas");
  const [debeCambiarClave, setDebeCambiarClave] = useState(false);
  const [avisoAdmin, setAvisoAdmin] = useState(false);
  const [avisoLocal, setAvisoLocal] = useState<string | null>(null);
  const { items: avisosApp, push: avisarApp } = useToasts();
  const [colapsada, setColapsada] = useState(
    () => localStorage.getItem("iglesia_sidebar") === "colapsada"
  );
  const [tema, setTema] = useState<Tema>(() => getTema());

  function cambiarTema() {
    const n: Tema = tema === "oscuro" ? "claro" : "oscuro";
    setTema(n);
    aplicarTema(n);
  }

  async function entrar(u: string) {
    setUsuario(u);
    void logAccion(u, "LOGIN_OK", "Ingreso a la app.");
    setDebeCambiarClave(await debeCambiarClaveCheck(u));
    setAvisoAdmin(await adminConClaveDefecto());
  }

  async function recheckAviso() {
    setAvisoAdmin(await adminConClaveDefecto());
  }

  function toggleSidebar() {
    setColapsada((c) => {
      localStorage.setItem("iglesia_sidebar", c ? "expandida" : "colapsada");
      return !c;
    });
  }

  useEffect(() => {
    (async () => {
      await initDb();
      setPrimerArranque(await ensureDefaultUser());
      const s = getSession();
      if (s) {
        setUsuario(s);
        setDebeCambiarClave(await debeCambiarClaveCheck(s));
      }
      setLista(true);
      // Chequeos secundarios en segundo plano: no bloquean el login.
      try {
        const b = await infoBase();
        if (isTauri() && b.modo === "local") {
          setAvisoLocal(
            `La base de datos no está disponible (${b.motivo ?? "SQLite no disponible"}). Los datos se guardan solo en este equipo. Avisá al desarrollador.`
          );
        }
      } catch {
        /* sin aviso */
      }
      if (s) {
        try {
          setAvisoAdmin(await adminConClaveDefecto());
        } catch {
          /* sin aviso */
        }
      }
    })();
  }, []);

  // Toast al entrar a la app (el host vive en la pantalla principal)
  useEffect(() => {
    if (usuario && avisoLocal) avisarApp(avisoLocal, "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

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
    <div className="min-h-screen bg-parroquia-50 dark:bg-noche-800 flex">
      <Sidebar vista={vista} onVista={setVista} colapsada={colapsada} onToggle={toggleSidebar} />

      <div
        className="flex-1 flex flex-col min-w-0"
        style={{ "--sidebar-w": colapsada ? "4rem" : "15rem" } as CSSProperties}
      >
        <header className="no-print bg-white dark:bg-noche-700 border-b border-slate-200 dark:border-slate-700 px-4 h-16 flex items-center gap-3 shrink-0">
          <div className="flex-1">
            <h1 className="font-display font-bold text-lg text-slate-800 dark:text-slate-100">{TITULOS[vista]}</h1>
            {import.meta.env.DEV && (
              <p className="text-xs text-slate-500 dark:text-slate-300">
                {usuario} · {getMode() === "sqlite" ? "Base local SQLite" : "Modo web temporal (en Tauri usa SQLite)"}
              </p>
            )}
          </div>
          <button
            title={tema === "oscuro" ? "Modo claro" : "Modo oscuro"}
            onClick={cambiarTema}
            className="p-2 rounded-lg border border-slate-300 dark:border-slate-500 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {tema === "oscuro" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            title="Salir"
            onClick={() => {
              if (usuario) void logAccion(usuario, "LOGOUT", "Salida de la app.");
              clearSession();
              setUsuario(null);
              setDebeCambiarClave(false);
            }}
            className="p-2 rounded-lg border border-slate-300 dark:border-slate-500 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <LogOut size={17} />
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

        {avisoLocal && (
          <div className="no-print bg-red-50 dark:bg-red-900/40 border-b border-red-200 dark:border-red-700 px-4 py-2 text-sm text-red-900 dark:text-red-100 flex items-center gap-3">
            <p className="flex-1">
              {avisoLocal} Contacto soporte: hugogoncalvez@gmail.com
            </p>
            <button onClick={() => setVista("config")} className="underline font-medium">
              Ver base
            </button>
          </div>
        )}

        <main className="no-print max-w-5xl w-full mx-auto p-4 animate-fade-in" key={vista}>
          {vista === "actas" ? (
            <Sacramentos actual={usuario} />
          ) : vista === "usuarios" ? (
            <Usuarios actual={usuario} onChange={recheckAviso} />
          ) : vista === "auditoria" ? (
            <Auditoria />
          ) : vista === "estadisticas" ? (
            <Estadisticas />
          ) : (
            <Configuracion actual={usuario} />
          )}
        </main>
        <ToastHost items={avisosApp} />
      </div>
    </div>
  );
}
