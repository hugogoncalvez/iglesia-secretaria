import Database from "@tauri-apps/plugin-sql";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { LS_KEYS, getMode, initDb, isTauri, sqlExecute } from "./db";
import { LS_USUARIOS_KEY, clearSession, getSession } from "./auth";
import { logAccion } from "./auditoria";
import { mensajeError } from "./errores";

type Fila = Record<string, unknown>;

export interface DatosResguardo {
  personas: Fila[];
  sacramentos: Fila[];
  usuarios: Fila[];
  config: Record<string, string>;
  fecha?: string;
}

export interface ResumenCopia {
  nombre: string;
  actas: number;
  personas: number;
  usuarios: number;
  fecha?: string;
}

const str = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Lee una copia .db con una conexión secundaria (no toca la base en uso). */
async function leerDb(path: string): Promise<DatosResguardo> {
  const variantes = [`sqlite:${path}`, `sqlite:///${path.replace(/\\/g, "/")}`];
  let db2: Database | null = null;
  let ultimoError: unknown = null;
  for (const url of variantes) {
    try {
      const c = await Database.load(url);
      await c.select("SELECT 1");
      db2 = c;
      break;
    } catch (e) {
      ultimoError = e;
    }
  }
  if (!db2) {
    throw new Error(
      `No se pudo leer la copia (${mensajeError(ultimoError, "formato no reconocido")}).`
    );
  }
  const tablas = await db2.select<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('personas','sacramentos','usuarios','config')"
  );
  const tiene = new Set(tablas.map((t) => t.name));
  for (const t of ["personas", "sacramentos", "usuarios", "config"]) {
    if (!tiene.has(t)) throw new Error(`La copia no es válida: falta la tabla ${t}.`);
  }
  const [personas, sacramentos, usuarios, config] = await Promise.all([
    db2.select<Fila[]>("SELECT * FROM personas"),
    db2.select<Fila[]>("SELECT * FROM sacramentos"),
    db2.select<Fila[]>("SELECT * FROM usuarios"),
    db2.select<{ clave: string; valor: string }[]>("SELECT clave, valor FROM config"),
  ]);
  const cfg: Record<string, string> = {};
  for (const r of config) cfg[String(r.clave)] = String(r.valor ?? "");
  return { personas, sacramentos, usuarios, config: cfg };
}

/** Valida un JSON de resguardo (modo web o archivo .json). */
export function validarJsonResguardo(texto: string): DatosResguardo {
  let obj: unknown;
  try {
    obj = JSON.parse(texto);
  } catch {
    throw new Error("El archivo no es un JSON válido.");
  }
  if (typeof obj !== "object" || obj === null) {
    throw new Error("El archivo no es un resguardo válido.");
  }
  const o = obj as Record<string, unknown>;
  if (o.app !== "secretaria-iglesia") {
    throw new Error("El archivo no es un resguardo de Scriptorium.");
  }
  const arr = (k: string): Fila[] =>
    Array.isArray(o[k]) ? (o[k] as Fila[]) : [];
  const cfg: Record<string, string> = {};
  if (typeof o.config === "object" && o.config !== null) {
    for (const [k, v] of Object.entries(o.config as Record<string, unknown>)) {
      cfg[k] = String(v ?? "");
    }
  }
  return {
    personas: arr("personas"),
    sacramentos: arr("sacramentos"),
    usuarios: arr("usuarios"),
    config: cfg,
    fecha: typeof o.exported_at === "string" ? o.exported_at : undefined,
  };
}

function resumir(d: DatosResguardo, nombre: string): ResumenCopia {
  return {
    nombre,
    actas: d.sacramentos.length,
    personas: d.personas.length,
    usuarios: d.usuarios.length,
    fecha: d.fecha,
  };
}

function elegirArchivoWeb(): Promise<File | null> {
  return new Promise((resolve) => {
    let listo = false;
    const done = (f: File | null) => {
      if (!listo) {
        listo = true;
        resolve(f);
      }
    };
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => done(input.files?.[0] ?? null);
    input.oncancel = () => done(null);
    // Respaldo: al volver el foco (diálogo cerrado) resolver con lo que haya
    window.addEventListener(
      "focus",
      () => setTimeout(() => done(input.files?.[0] ?? null), 300),
      { once: true }
    );
    input.click();
  });
}

const nombreArchivo = (path: string) => path.split(/[/\\]/).pop() ?? path;

/**
 * Elige una copia y devuelve datos + resumen para mostrar antes de confirmar.
 * Devuelve null si el usuario cancela. En la app acepta .db y .json; en web .json.
 */
export async function elegirCopia(): Promise<{
  datos: DatosResguardo;
  resumen: ResumenCopia;
} | null> {
  if (isTauri()) {
    const sel = await open({
      multiple: false,
      filters: [{ name: "Resguardo", extensions: ["db", "json"] }],
    });
    if (!sel) return null;
    const path = sel as string;
    if (path.toLowerCase().endsWith(".json")) {
      const datos = validarJsonResguardo(await readTextFile(path));
      return { datos, resumen: resumir(datos, nombreArchivo(path)) };
    }
    const datos = await leerDb(path);
    return { datos, resumen: resumir(datos, nombreArchivo(path)) };
  }
  const file = await elegirArchivoWeb();
  if (!file) return null;
  const datos = validarJsonResguardo(await file.text());
  return { datos, resumen: resumir(datos, file.name) };
}

const COLS_PERSONA = [
  "id",
  "apellido_nombres",
  "documento",
  "fecha_nacimiento",
  "lugar_nacimiento",
  "nacionalidad",
  "domicilio",
  "telefono",
  "nombre_padre",
  "nombre_madre",
];

const COLS_ACTA = [
  "id",
  "persona_id",
  "esposo_persona_id",
  "esposa_persona_id",
  "tipo",
  "fecha_sacramento",
  "ministro_celebrante",
  "libro",
  "folio",
  "parroquia_capilla",
  "padrino",
  "madrina",
  "notas_marginales",
  "bautizado_en_parroquia",
  "domicilio_matrimonial",
  "referencia_folios",
  "esposo_baut_lugar",
  "esposo_baut_fecha",
  "esposo_baut_libro",
  "esposo_baut_folio",
  "esposa_baut_lugar",
  "esposa_baut_fecha",
  "esposa_baut_libro",
  "esposa_baut_folio",
  "conf_baut_lugar",
  "conf_baut_fecha",
  "conf_baut_libro",
  "conf_baut_folio",
];

/**
 * Reemplaza TODOS los datos actuales por los de la copia y recarga la app.
 * Se niega si la copia no trae usuarios (evita quedarse sin acceso).
 */
export async function aplicarRestauracion(d: DatosResguardo): Promise<void> {
  if (d.usuarios.length === 0) {
    throw new Error(
      "La copia no trae usuarios. Hacé un resguardo nuevo e intentá de nuevo."
    );
  }
  await initDb();

  if (getMode() === "sqlite") {
    await sqlExecute("DELETE FROM sacramentos");
    await sqlExecute("DELETE FROM personas");
    await sqlExecute("DELETE FROM usuarios");
    await sqlExecute("DELETE FROM config");

    for (const r of d.personas) {
      const vals = COLS_PERSONA.map((c) =>
        c === "id" ? num(r[c]) : str(r[c])
      );
      await sqlExecute(
        `INSERT INTO personas (${COLS_PERSONA.join(",")}) VALUES (${COLS_PERSONA.map(
          (_, i) => `$${i + 1}`
        ).join(",")})`,
        vals
      );
    }
    for (const r of d.sacramentos) {
      // Compat: copias viejas guardaban padrinos de matrimonio en testigo_1/2
      const normalizada: Fila = { ...r };
      if (!str(normalizada.padrino) && normalizada.testigo_1 != null) {
        normalizada.padrino = normalizada.testigo_1;
      }
      if (!str(normalizada.madrina) && normalizada.testigo_2 != null) {
        normalizada.madrina = normalizada.testigo_2;
      }
      const vals = COLS_ACTA.map((c) =>
        ["id", "persona_id", "esposo_persona_id", "esposa_persona_id"].includes(c)
          ? num(normalizada[c])
          : str(normalizada[c])
      );
      await sqlExecute(
        `INSERT INTO sacramentos (${COLS_ACTA.join(",")}) VALUES (${COLS_ACTA.map(
          (_, i) => `$${i + 1}`
        ).join(",")})`,
        vals
      );
    }
    for (const r of d.usuarios) {
      await sqlExecute(
        "INSERT INTO usuarios (id, usuario, hash, creado_en, debe_cambiar) VALUES ($1,$2,$3,$4,$5)",
        [num(r.id), str(r.usuario), str(r.hash), str(r.creado_en) || new Date().toISOString(), num(r.debe_cambiar) ?? 0]
      );
    }
    for (const [clave, valor] of Object.entries(d.config)) {
      await sqlExecute("INSERT OR REPLACE INTO config (clave, valor) VALUES ($1,$2)", [
        clave,
        valor,
      ]);
    }
  } else {
    const sacramentosNorm = d.sacramentos.map((r) => {
      const n: Fila = { ...r };
      if (!str(n.padrino) && n.testigo_1 != null) n.padrino = n.testigo_1;
      if (!str(n.madrina) && n.testigo_2 != null) n.madrina = n.testigo_2;
      delete n.testigo_1;
      delete n.testigo_2;
      return n;
    });
    localStorage.setItem(LS_KEYS.personas, JSON.stringify(d.personas));
    localStorage.setItem(LS_KEYS.actas, JSON.stringify(sacramentosNorm));
    localStorage.setItem(LS_USUARIOS_KEY, JSON.stringify(d.usuarios));
    localStorage.setItem(LS_KEYS.config, JSON.stringify(d.config));
    let maxId = 0;
    for (const r of [...d.personas, ...d.sacramentos, ...d.usuarios]) {
      const n = num((r as Fila).id);
      if (n != null && n > maxId) maxId = n;
    }
    localStorage.setItem(LS_KEYS.ids, String(maxId));
  }

  await logAccion(
    getSession() ?? "?",
    "RESTAURAR",
    `${d.sacramentos.length} actas · ${d.personas.length} personas · ${d.usuarios.length} usuarios`
  );

  clearSession();
  window.location.reload();
}
