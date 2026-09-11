import { BookOpenText, ChevronsLeft, ChevronsRight, Settings, Users } from "lucide-react";
import logoUrl from "../assets/logo.svg";

export type Vista = "actas" | "usuarios" | "config";

const ITEMS = [
  { id: "actas", label: "Actas", icon: BookOpenText },
  { id: "usuarios", label: "Usuarios", icon: Users },
  { id: "config", label: "Configuración", icon: Settings },
] as const;

export default function Sidebar({
  vista,
  onVista,
  colapsada,
  onToggle,
}: {
  vista: Vista;
  onVista: (v: Vista) => void;
  colapsada: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={`no-print flex flex-col shrink-0 overflow-hidden bg-parroquia-900 dark:bg-noche-700 text-white transition-[width] duration-200 ${
        colapsada ? "w-16" : "w-60"
      }`}
    >
      <div className="flex items-center gap-2 px-3 h-16 border-b border-white/10 shrink-0">
        <img src={logoUrl} alt="Sello parroquial" className="w-8 h-11 object-contain shrink-0" />
        {!colapsada && (
          <div className="whitespace-nowrap overflow-hidden">
            <p className="font-display font-bold leading-tight">María Auxiliadora</p>
            <p className="text-xs text-slate-300">Secretaría</p>
          </div>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const activo = vista === id;
          return (
            <button
              key={id}
              title={label}
              onClick={() => onVista(id)}
              className={`relative flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm transition-colors ${
                activo
                  ? "bg-white/15 text-white font-medium"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {activo && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-dorado-400" />
              )}
              <Icon size={18} className="shrink-0" />
              {!colapsada && <span className="whitespace-nowrap overflow-hidden">{label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="p-2 border-t border-white/10 shrink-0">
        <button
          title={colapsada ? "Expandir" : "Colapsar"}
          onClick={onToggle}
          className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          {colapsada ? <ChevronsRight size={18} className="shrink-0" /> : <ChevronsLeft size={18} className="shrink-0" />}
          {!colapsada && <span className="whitespace-nowrap overflow-hidden">Colapsar</span>}
        </button>
      </div>
    </aside>
  );
}
