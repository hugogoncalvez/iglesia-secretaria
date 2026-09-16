import { getMode, initDb, sqlExecute, sqlSelect } from "./db";

/** Acciones registradas en la auditoría. */
export const ACCIONES_AUDITORIA = [
  "LOGIN_OK",
  "LOGIN_FALLIDO",
  "LOGOUT",
  "ACTA_CREAR",
  "ACTA_EDITAR",
  "ACTA_ELIMINAR",
  "USUARIO_CREAR",
  "USUARIO_ELIMINAR",
  "CLAVE_CAMBIAR",
  "RESGUARDO",
  "RESTAURAR",
  "CONFIG",
] as const;

export type AccionAuditoria = (typeof ACCIONES_AUDITORIA)[number];

export const ETIQUETAS_ACCION: Record<AccionAuditoria, string> = {
  LOGIN_OK: "Ingreso",
  LOGIN_FALLIDO: "Ingreso fallido",
  LOGOUT: "Salida",
  ACTA_CREAR: "Acta creada",
  ACTA_EDITAR: "Acta editada",
  ACTA_ELIMINAR: "Acta eliminada",
  USUARIO_CREAR: "Usuario creado",
  USUARIO_ELIMINAR: "Usuario eliminado",
  CLAVE_CAMBIAR: "Clave cambiada",
  RESGUARDO: "Resguardo",
  RESTAURAR: "Restauración",
  CONFIG: "Configuración",
};

export interface RegistroAuditoria {
  id: number;
  fecha_hora: string; // ISO
  usuario: string;
  accion: AccionAuditoria | string;
  detalle: string;
}

export interface FiltrosAuditoria {
  texto: string;
  usuario: string; // "" = todos
  accion: string; // "" = todas
  desde: string; // YYYY-MM-DD, "" = sin límite
  hasta: string; // YYYY-MM-DD, "" = sin límite
}

export const FILTROS_AUDITORIA_VACIOS: FiltrosAuditoria = {
  texto: "",
  usuario: "",
  accion: "",
  desde: "",
  hasta: "",
};

const LS_AUDITORIA = "iglesia_auditoria";

function lsRead(): RegistroAuditoria[] {
  try {
    return JSON.parse(localStorage.getItem(LS_AUDITORIA) ?? "[]") as RegistroAuditoria[];
  } catch {
    return [];
  }
}

/**
 * Registra un evento. Nunca lanza: la auditoría no debe romper el flujo principal.
 */
export async function logAccion(
  usuario: string,
  accion: AccionAuditoria,
  detalle: string
): Promise<void> {
  try {
    await initDb();
    const fh = new Date().toISOString();
    if (getMode() === "sqlite") {
      await sqlExecute(
        "INSERT INTO auditoria (fecha_hora, usuario, accion, detalle) VALUES ($1,$2,$3,$4)",
        [fh, usuario, accion, detalle]
      );
      return;
    }
    const rows = lsRead();
    const id = rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
    rows.push({ id, fecha_hora: fh, usuario, accion, detalle });
    localStorage.setItem(LS_AUDITORIA, JSON.stringify(rows));
  } catch {
    /* auditoría best-effort */
  }
}

export async function listAuditoria(f: FiltrosAuditoria): Promise<RegistroAuditoria[]> {
  await initDb();
  const q = f.texto.trim().toLowerCase();

  if (getMode() === "sqlite") {
    try {
      return await sqlSelect<RegistroAuditoria[]>(
        `SELECT id, fecha_hora, usuario, accion, detalle FROM auditoria
         WHERE ($1 = '' OR usuario = $1)
           AND ($2 = '' OR accion = $2)
           AND ($3 = '' OR substr(fecha_hora, 1, 10) >= $3)
           AND ($4 = '' OR substr(fecha_hora, 1, 10) <= $4)
           AND ($5 = '' OR lower(usuario || ' ' || accion || ' ' || detalle) LIKE $5)
         ORDER BY id DESC LIMIT 500`,
        [f.usuario, f.accion, f.desde, f.hasta, q ? `%${q}%` : ""]
      );
    } catch {
      return [];
    }
  }

  return lsRead()
    .filter(
      (r) =>
        (!f.usuario || r.usuario === f.usuario) &&
        (!f.accion || r.accion === f.accion) &&
        (!f.desde || r.fecha_hora.slice(0, 10) >= f.desde) &&
        (!f.hasta || r.fecha_hora.slice(0, 10) <= f.hasta) &&
        (!q || `${r.usuario} ${r.accion} ${r.detalle}`.toLowerCase().includes(q))
    )
    .sort((a, b) => b.id - a.id)
    .slice(0, 500);
}

/** Usuarios distintos presentes en la auditoría (para el filtro). */
export async function usuariosAuditoria(): Promise<string[]> {
  await initDb();
  if (getMode() === "sqlite") {
    try {
      const rows = await sqlSelect<{ usuario: string }[]>(
        "SELECT DISTINCT usuario FROM auditoria ORDER BY usuario"
      );
      return rows.map((r) => r.usuario);
    } catch {
      return [];
    }
  }
  return [...new Set(lsRead().map((r) => r.usuario))].sort();
}
