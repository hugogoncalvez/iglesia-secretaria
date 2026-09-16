import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { dumpLocalJSON, getMode, isTauri, sqlExecute, sqlSelect } from "./db";
import { volcarUsuarios } from "./auth";

interface ResguardoOk {
  ruta: string;
  bytes: number;
}

async function volcadoJSON(): Promise<string> {
  const datos = JSON.parse(await dumpLocalJSON()) as Record<string, unknown>;
  datos.usuarios = volcarUsuarios();
  return JSON.stringify(datos, null, 2);
}

/**
 * Resguardo de datos.
 * - En la app instalada (Tauri) con SQLite: un solo comando nativo muestra
 *   el diálogo, copia iglesia.db y verifica que el archivo quedó creado.
 * - En modo local (web o fallback): guarda un JSON con todo el contenido.
 * Lanza Error("cancelado") si el usuario cierra el diálogo.
 */
export async function hacerBackup(): Promise<string> {
  const fecha = new Date().toISOString().slice(0, 10);

  if (!isTauri()) {
    const json = await volcadoJSON();
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `iglesia-resguardo-${fecha}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    return "Resguardo descargado (modo web). En la app instalada se copia el archivo iglesia.db.";
  }

  if (getMode() === "local") {
    // Sin SQLite no hay .db que copiar: se guarda el JSON en la ruta elegida.
    // El diálogo otorga permiso de escritura sobre el destino.
    const destino = await save({
      defaultPath: `iglesia-resguardo-${fecha}.json`,
      filters: [{ name: "Resguardo JSON", extensions: ["json"] }],
    });
    if (!destino) throw new Error("cancelado");
    await writeTextFile(destino, await volcadoJSON());
    return `Resguardo JSON guardado en ${destino}.`;
  }

  // Asegura consistencia del archivo antes de copiarlo
  try {
    await sqlExecute("PRAGMA wal_checkpoint(TRUNCATE);");
  } catch {
    /* sigue igual: el modo por defecto ya es consistente */
  }

  // Ruta exacta del archivo (no adivinar: en algunos Windows está en
  // Local y en otros en Roaming según cómo resuelva el plugin SQL).
  let origen: string | null = null;
  try {
    const rows = await sqlSelect<{ seq: number; name: string; file: string | null }[]>(
      "PRAGMA database_list"
    );
    const main = rows.find((r) => r.name === "main");
    if (main?.file) origen = main.file;
  } catch {
    /* Rust intentará ubicarla por las carpetas conocidas */
  }

  const r = await invoke<ResguardoOk>("resguardar_db", {
    nombre: `iglesia-resguardo-${fecha}.db`,
    origen,
  });
  const kb = Math.max(1, Math.round(r.bytes / 1024));
  return `Resguardo guardado en ${r.ruta} (${kb} KB).`;
}
