/**
 * Mensaje legible para cualquier rechazo.
 * Los comandos Tauri devuelven el error serializado (texto crudo, no
 * necesariamente un `Error`), así que `e instanceof Error` solo no alcanza.
 */
export function mensajeError(e: unknown, defecto = "Ocurrió un error."): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e) return e;
  try {
    const s = JSON.stringify(e);
    if (s && s !== "{}" && s !== "null" && s !== '""') return s;
  } catch {
    /* ignora */
  }
  return defecto;
}

/** true solo para el centinela de modo web (llega como Error o texto crudo). */
export function esNoSqlite(e: unknown): boolean {
  return e instanceof Error ? e.message === "no-sqlite" : e === "no-sqlite";
}
