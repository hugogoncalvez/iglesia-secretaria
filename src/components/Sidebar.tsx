import { BookOpenText, ChartColumn, ChevronsLeft, ChevronsRight, History, Settings, Users } from "lucide-react";
import logoUrl from "../assets/logo.svg";

export type Vista = "actas" | "usuarios" | "config" | "auditoria" | "estadisticas";

const ITEMS = [
  { id: "actas", label: "Actas", icon: BookOpenText },
  { id: "usuarios", label: "Usuarios", icon: Users },
  { id: "config", label: "Configuración", icon: Settings },
  { id: "auditoria", label: "Auditoría", icon: History },
  { id: "estadisticas", label: "Estadísticas", icon: ChartColumn },
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
        {!colapsada ? (
          <>
            <img src={logoUrl} alt="Sello parroquial" className="w-8 h-11 object-contain shrink-0" />
            <div className="flex-1 whitespace-nowrap overflow-hidden">
              <p className="font-display font-bold text-sm leading-tight truncate">María Auxiliadora</p>
              <p className="text-xs text-slate-300">Secretaría</p>
            </div>
            <button
              title="Colapsar"
              onClick={onToggle}
              className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors shrink-0"
            >
              <ChevronsLeft size={18} />
            </button>
          </>
        ) : (
          <button
            title="Expandir"
            onClick={onToggle}
            className="mx-auto p-1.5 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <ChevronsRight size={18} />
          </button>
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
    </aside>
  );
}
