import { invoke } from "@tauri-apps/api/core";
import { dumpLocalJSON, isTauri, sqlExecute } from "./db";
import { volcarUsuarios } from "./auth";

interface ResguardoOk {
  ruta: string;
  bytes: number;
}

/**
 * Resguardo de datos.
 * - En la app instalada (Tauri): un solo comando nativo muestra el diálogo,
 *   copia iglesia.db y verifica que el archivo quedó creado.
 *   Devuelve mensaje con la ruta.
 * - En modo web (pnpm dev): descarga un JSON con todo el contenido.
 * Lanza Error("cancelado") si el usuario cierra el diálogo.
 */
export async function hacerBackup(): Promise<string> {
  const fecha = new Date().toISOString().slice(0, 10);

  if (!isTauri()) {
    const datos = JSON.parse(await dumpLocalJSON()) as Record<string, unknown>;
    datos.usuarios = volcarUsuarios();
    const json = JSON.stringify(datos, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `iglesia-resguardo-${fecha}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    return "Resguardo descargado (modo web). En la app instalada se copia el archivo iglesia.db.";
  }

  // Asegura consistencia del archivo antes de copiarlo
  try {
    await sqlExecute("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch {
    /* sigue igual: el modo por defecto ya es consistente */
  }

  const r = await invoke<ResguardoOk>("resguardar_db", {
    nombre: `iglesia-resguardo-${fecha}.db`,
  });
  const kb = Math.max(1, Math.round(r.bytes / 1024));
  return `Resguardo guardado en ${r.ruta} (${kb} KB).`;
}
