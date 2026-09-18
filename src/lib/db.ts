import Database from "@tauri-apps/plugin-sql";
import { esNoSqlite, mensajeError } from "./errores";

// Modelo según actas de los libros:
// - personas: registro único de personas (niño/a, contrayentes, etc.)
// - sacramentos: actas unificadas BAUTISMO / COMUNION / CONFIRMACION / MATRIMONIO
// Certificado imprimible por sistema: solo COMUNION y CONFIRMACION.

export type TipoSacramento =
  | "BAUTISMO"
  | "COMUNION"
  | "CONFIRMACION"
  | "MATRIMONIO";

export const TIPOS_SACRAMENTO: TipoSacramento[] = [
  "BAUTISMO",
  "COMUNION",
  "CONFIRMACION",
  "MATRIMONIO",
];

export const CON_CERTIFICADO: TipoSacramento[] = ["COMUNION", "CONFIRMACION"];

export interface Persona {
  id?: number;
  apellido_nombres: string;
  documento: string;
  fecha_nacimiento: string;
  lugar_nacimiento: string;
  nacionalidad: string;
  domicilio: string;
  telefono: string;
  nombre_padre: string;
  nombre_madre: string;
}

export const PERSONA_VACIA: Persona = {
  apellido_nombres: "",
  documento: "",
  fecha_nacimiento: "",
  lugar_nacimiento: "",
  nacionalidad: "Argentina",
  domicilio: "",
  telefono: "",
  nombre_padre: "",
  nombre_madre: "",
};

/** Fila de acta con nombres ya resueltos (joins) para listado y búsqueda. */
export interface ActaRow {
  id: number;
  tipo: TipoSacramento;
  fecha_sacramento: string;
  ministro_celebrante: string;
  libro: string;
  folio: string;
  parroquia_capilla: string;
  persona_id: number | null;
  esposo_persona_id: number | null;
  esposa_persona_id: number | null;
  titular_nombre: string | null;
  titular_doc: string | null;
  esposo_nombre: string | null;
  esposo_doc: string | null;
  esposa_nombre: string | null;
  esposa_doc: string | null;
}

export interface FiltrosActas {
  texto: string;
  tipo: TipoSacramento | "TODOS";
  fecha: string; // YYYY-MM-DD exacto, "" = todas
}

export interface SacramentoInput {
  tipo: TipoSacramento;
  persona: Persona; // titular (bautismo/comunión/confirmación)
  esposo: Persona; // matrimonio
  esposa: Persona; // matrimonio
  fecha_sacramento: string;
  ministro_celebrante: string;
  libro: string;
  folio: string;
  parroquia_capilla: string;
  padrino: string; // bautismo y matrimonio
  madrina: string; // bautismo y matrimonio
  notas_marginales: string;
  bautizado_en_parroquia: string; // confirmación (+ dato previo en matrimonio)
  domicilio_matrimonial: string; // matrimonio: "El matrimonio se domiciliará en"
  referencia_folios: string; // matrimonio: "Ver nota(s) en folio(s) N°"
  esposo_baut_lugar: string; // matrimonio: bautismo del esposo
  esposo_baut_fecha: string;
  esposo_baut_libro: string;
  esposo_baut_folio: string;
  esposa_baut_lugar: string; // matrimonio: bautismo de la esposa
  esposa_baut_fecha: string;
  esposa_baut_libro: string;
  esposa_baut_folio: string;
  esposo_no_baut: boolean; // matrimonio: "No bautizado" explícito (distingue de sin dato)
  esposa_no_baut: boolean;
  conf_baut_lugar: string; // confirmación: bautismo previo
  conf_baut_fecha: string;
  conf_baut_libro: string;
  conf_baut_folio: string;
}

export const SACRAMENTO_VACIO: SacramentoInput = {
  tipo: "BAUTISMO",
  persona: { ...PERSONA_VACIA },
  esposo: { ...PERSONA_VACIA },
  esposa: { ...PERSONA_VACIA },
  fecha_sacramento: "",
  ministro_celebrante: "",
  libro: "",
  folio: "",
  parroquia_capilla: "",
  padrino: "",
  madrina: "",
  notas_marginales: "",
  bautizado_en_parroquia: "",
  domicilio_matrimonial: "",
  referencia_folios: "",
  esposo_baut_lugar: "",
  esposo_baut_fecha: "",
  esposo_baut_libro: "",
  esposo_baut_folio: "",
  esposa_baut_lugar: "",
  esposa_baut_fecha: "",
  esposa_baut_libro: "",
  esposa_baut_folio: "",
  esposo_no_baut: false,
  esposa_no_baut: false,
  conf_baut_lugar: "",
  conf_baut_fecha: "",
  conf_baut_libro: "",
  conf_baut_folio: "",
};

export interface ActaDetalle extends SacramentoInput {
  id: number;
}

export function nombreActa(r: ActaRow): string {
  if (r.tipo === "MATRIMONIO") {
    return `${r.esposo_nombre ?? "—"} y ${r.esposa_nombre ?? "—"}`;
  }
  return r.titular_nombre ?? "—";
}

export function docActa(r: ActaRow): string {
  if (r.tipo === "MATRIMONIO") {
    return [r.esposo_doc, r.esposa_doc].filter(Boolean).join(" / ") || "—";
  }
  return r.titular_doc || "—";
}

type Mode = "sqlite" | "local";
let mode: Mode = "local";
let db: Database | null = null;
let initialized = false;
/** Por qué se cayó a modo local (visible en Configuración → Acerca de). */
let motivoLocal: string | null = null;

const LS_PERSONAS = "iglesia_personas";
const LS_ACTAS = "iglesia_sacramentos";
const LS_IDS = "iglesia_ids";
const LS_CONFIG = "iglesia_config";
const LS_USUARIOS_WEB = "iglesia_usuarios"; // misma clave que auth.ts (sin importar: evita ciclo)
const LS_AUDITORIA_WEB = "iglesia_auditoria"; // misma clave que auditoria.ts
const LS_MIGRADO = "iglesia_migrado_sqlite";

/** Claves de localStorage (modo web) para resguardo/restauración. */
export const LS_KEYS = {
  personas: LS_PERSONAS,
  actas: LS_ACTAS,
  ids: LS_IDS,
  config: LS_CONFIG,
};

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return "__TAURI__" in w || "__TAURI_INTERNALS__" in w;
}

function lsRead<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
}
function lsWrite(key: string, rows: unknown[]) {
  localStorage.setItem(key, JSON.stringify(rows));
}
function lsNextId(): number {
  const cur = Number(localStorage.getItem(LS_IDS) ?? "0") + 1;
  localStorage.setItem(LS_IDS, String(cur));
  return cur;
}

const SELECT_ACTAS = `
  SELECT s.id, s.tipo, s.fecha_sacramento, s.ministro_celebrante,
         s.libro, s.folio, s.parroquia_capilla,
         s.persona_id, s.esposo_persona_id, s.esposa_persona_id,
         p.apellido_nombres AS titular_nombre, p.documento AS titular_doc,
         pe.apellido_nombres AS esposo_nombre, pe.documento AS esposo_doc,
         pa.apellido_nombres AS esposa_nombre, pa.documento AS esposa_doc
  FROM sacramentos s
  LEFT JOIN personas p ON p.id = s.persona_id
  LEFT JOIN personas pe ON pe.id = s.esposo_persona_id
  LEFT JOIN personas pa ON pa.id = s.esposa_persona_id
`;

/** Agrega columnas nuevas a bases ya creadas (etapa de desarrollo). */
async function ensureColumnas() {
  if (!db) return;
  const info = await db.select<{ name: string }[]>("PRAGMA table_info(sacramentos)");
  const tiene = new Set(info.map((c) => c.name));
  const nuevas: string[] = [
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
  for (const col of nuevas) {
    if (!tiene.has(col)) {
      await db.execute(`ALTER TABLE sacramentos ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
    }
  }
  for (const col of ["esposo_no_baut", "esposa_no_baut"]) {
    if (!tiene.has(col)) {
      await db.execute(`ALTER TABLE sacramentos ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`);
    }
  }
  // Usuarios: flag de cambio de clave pendiente en primer login
  const infoU = await db.select<{ name: string }[]>("PRAGMA table_info(usuarios)");
  if (!new Set(infoU.map((c) => c.name)).has("debe_cambiar")) {
    await db.execute("ALTER TABLE usuarios ADD COLUMN debe_cambiar INTEGER NOT NULL DEFAULT 0");
  }
}

export async function initDb(): Promise<Mode> {
  if (initialized) return mode;
  initialized = true;

  if (!isTauri()) {
    mode = "local";
    motivoLocal = "navegador web (sin Tauri)";
    return mode;
  }

  try {
    db = await Database.load("sqlite:iglesia.db");
    await db.execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario TEXT UNIQUE NOT NULL,
        hash TEXT NOT NULL,
        creado_en TEXT NOT NULL,
        debe_cambiar INTEGER NOT NULL DEFAULT 0
      );
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS personas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        apellido_nombres TEXT NOT NULL,
        documento TEXT NOT NULL DEFAULT '',
        fecha_nacimiento TEXT NOT NULL DEFAULT '',
        lugar_nacimiento TEXT NOT NULL DEFAULT '',
        nacionalidad TEXT NOT NULL DEFAULT '',
        domicilio TEXT NOT NULL DEFAULT '',
        telefono TEXT NOT NULL DEFAULT '',
        nombre_padre TEXT NOT NULL DEFAULT '',
        nombre_madre TEXT NOT NULL DEFAULT ''
      );
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS sacramentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        persona_id INTEGER NULL REFERENCES personas(id),
        esposo_persona_id INTEGER NULL REFERENCES personas(id),
        esposa_persona_id INTEGER NULL REFERENCES personas(id),
        tipo TEXT NOT NULL,
        fecha_sacramento TEXT NOT NULL DEFAULT '',
        ministro_celebrante TEXT NOT NULL DEFAULT '',
        libro TEXT NOT NULL DEFAULT '',
        folio TEXT NOT NULL DEFAULT '',
        parroquia_capilla TEXT NOT NULL DEFAULT '',
        padrino TEXT NOT NULL DEFAULT '',
        madrina TEXT NOT NULL DEFAULT '',
        notas_marginales TEXT NOT NULL DEFAULT '',
        bautizado_en_parroquia TEXT NOT NULL DEFAULT '',
        domicilio_matrimonial TEXT NOT NULL DEFAULT '',
        referencia_folios TEXT NOT NULL DEFAULT '',
        esposo_baut_lugar TEXT NOT NULL DEFAULT '',
        esposo_baut_fecha TEXT NOT NULL DEFAULT '',
        esposo_baut_libro TEXT NOT NULL DEFAULT '',
        esposo_baut_folio TEXT NOT NULL DEFAULT '',
        esposa_baut_lugar TEXT NOT NULL DEFAULT '',
        esposa_baut_fecha TEXT NOT NULL DEFAULT '',
        esposa_baut_libro TEXT NOT NULL DEFAULT '',
        esposa_baut_folio TEXT NOT NULL DEFAULT '',
        esposo_no_baut INTEGER NOT NULL DEFAULT 0,
        esposa_no_baut INTEGER NOT NULL DEFAULT 0,
        conf_baut_lugar TEXT NOT NULL DEFAULT '',
        conf_baut_fecha TEXT NOT NULL DEFAULT '',
        conf_baut_libro TEXT NOT NULL DEFAULT '',
        conf_baut_folio TEXT NOT NULL DEFAULT ''
      );
    `);
    await ensureColumnas();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS config (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL DEFAULT ''
      );
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS auditoria (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha_hora TEXT NOT NULL DEFAULT '',
        usuario TEXT NOT NULL DEFAULT '',
        accion TEXT NOT NULL DEFAULT '',
        detalle TEXT NOT NULL DEFAULT ''
      );
    `);
    await migrarLocalASqlite();
    mode = "sqlite";
    motivoLocal = null;
  } catch (e) {
    // Sin plugin o sin permiso: modo local (los datos quedan en el equipo)
    db = null;
    mode = "local";
    motivoLocal = mensajeError(e, "SQLite no disponible");
  }
  return mode;
}

const strV = (v: unknown): string => (v == null ? "" : String(v));
const numV = (v: unknown): number | null => {
  if (v == null || v === "") return null; // Number(null) es 0: no convertir nulos en 0
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const COLS_PERSONA_MIG = [
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

const COLS_ACTA_MIG = [
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
  "esposo_no_baut",
  "esposa_no_baut",
  "conf_baut_lugar",
  "conf_baut_fecha",
  "conf_baut_libro",
  "conf_baut_folio",
];

/**
 * Migración única (reintentable): si hay datos en localStorage y SQLite
 * todavía no los tiene, los importa con INSERT OR REPLACE. No borra el
 * localStorage. La marca con versión permite reejecutarla tras una
 * migración parcial de versiones anteriores.
 */
async function migrarLocalASqlite(): Promise<void> {
  if (!db || localStorage.getItem(LS_MIGRADO) === "2") return;
  const personas = lsRead<Record<string, unknown>>(LS_PERSONAS);
  const actas = lsRead<Record<string, unknown>>(LS_ACTAS);
  const usuarios = lsRead<Record<string, unknown>>(LS_USUARIOS_WEB);
  if (personas.length === 0 && actas.length === 0 && usuarios.length === 0) {
    localStorage.setItem(LS_MIGRADO, "2");
    return;
  }
  const idsPersonas = new Set<number>();
  for (const r of personas) {
    const id = numV(r.id);
    const vals = COLS_PERSONA_MIG.map((c) => (c === "id" ? id : strV(r[c])));
    const res = await db.execute(
      `INSERT OR REPLACE INTO personas (${COLS_PERSONA_MIG.join(",")}) VALUES (${COLS_PERSONA_MIG.map((_, i) => `$${i + 1}`).join(",")})`,
      vals
    );
    // Personas sin id previo reciben autoincrement: remapear para las actas
    if (id != null) idsPersonas.add(id);
    else if (res.lastInsertId != null) idsPersonas.add(res.lastInsertId);
  }
  const ids = new Set(["id", "persona_id", "esposo_persona_id", "esposa_persona_id"]);
  const flags = new Set(["esposo_no_baut", "esposa_no_baut"]);
  const refs = ["persona_id", "esposo_persona_id", "esposa_persona_id"];
  for (const r of actas) {
    const normalizada: Record<string, unknown> = { ...r };
    if (!strV(normalizada.padrino) && normalizada.testigo_1 != null) {
      normalizada.padrino = normalizada.testigo_1;
    }
    if (!strV(normalizada.madrina) && normalizada.testigo_2 != null) {
      normalizada.madrina = normalizada.testigo_2;
    }
    // Referencias a personas inexistentes se anulan en vez de romper la FK
    for (const k of refs) {
      const v = numV(normalizada[k]);
      normalizada[k] = v != null && idsPersonas.has(v) ? v : null;
    }
    const vals = COLS_ACTA_MIG.map((c) =>
      ids.has(c) ? numV(normalizada[c]) : flags.has(c) ? (normalizada[c] ? 1 : 0) : strV(normalizada[c])
    );
    await db.execute(
      `INSERT OR REPLACE INTO sacramentos (${COLS_ACTA_MIG.join(",")}) VALUES (${COLS_ACTA_MIG.map((_, i) => `$${i + 1}`).join(",")})`,
      vals
    );
  }
  for (const r of usuarios) {
    await db.execute(
      "INSERT OR REPLACE INTO usuarios (id, usuario, hash, creado_en, debe_cambiar) VALUES ($1,$2,$3,$4,$5)",
      [numV(r.id), strV(r.usuario), strV(r.hash), strV(r.creado_en) || new Date().toISOString(), numV(r.debe_cambiar) ?? 0]
    );
  }
  try {
    const cfg = JSON.parse(localStorage.getItem(LS_CONFIG) ?? "{}") as Record<string, unknown>;
    for (const [clave, valor] of Object.entries(cfg)) {
      await db.execute("INSERT OR REPLACE INTO config (clave, valor) VALUES ($1,$2)", [clave, String(valor ?? "")]);
    }
  } catch {
    /* config opcional */
  }
  localStorage.setItem(LS_MIGRADO, "2");
}

export function getMode(): Mode {
  return mode;
}

/** Modo, ruta real y motivo del modo local (para diagnóstico en Configuración). */
export async function infoBase(): Promise<{ modo: Mode; ruta: string; motivo: string | null }> {
  await initDb();
  if (mode === "sqlite" && db) {
    try {
      const rows = await db.select<{ name: string; file: string | null }[]>(
        "PRAGMA database_list"
      );
      const main = rows.find((r) => r.name === "main");
      return { modo: mode, ruta: main?.file || "(ruta no informada por SQLite)", motivo: null };
    } catch {
      return { modo: mode, ruta: "(no se pudo leer la ruta)", motivo: null };
    }
  }
  return { modo: mode, ruta: "localStorage del equipo (modo web)", motivo: motivoLocal };
}

export async function listActas(f: FiltrosActas): Promise<ActaRow[]> {
  await initDb();
  const q = f.texto.trim().toLowerCase();

  if (mode === "sqlite" && db) {
    const like = `%${q}%`;
    return db.select<ActaRow[]>(
      `${SELECT_ACTAS}
       WHERE ($1 = 'TODOS' OR s.tipo = $1)
         AND ($2 = '' OR s.fecha_sacramento = $2)
         AND ($3 = '' OR lower(
           coalesce(p.apellido_nombres,'') || ' ' || coalesce(p.documento,'') || ' ' ||
           coalesce(pe.apellido_nombres,'') || ' ' || coalesce(pe.documento,'') || ' ' ||
           coalesce(pa.apellido_nombres,'') || ' ' || coalesce(pa.documento,'') || ' ' ||
           coalesce(s.libro,'') || ' ' || coalesce(s.folio,'')
         ) LIKE $3)
       ORDER BY s.fecha_sacramento DESC, s.id DESC LIMIT 500`,
      [f.tipo, f.fecha, q ? like : ""]
    );
  }

  // Modo local
  interface LocalActa {
    id: number;
    tipo: TipoSacramento;
    persona_id: number | null;
    esposo_persona_id: number | null;
    esposa_persona_id: number | null;
    fecha_sacramento: string;
    ministro_celebrante: string;
    libro: string;
    folio: string;
    parroquia_capilla: string;
  }
  const personas = lsRead<Persona>(LS_PERSONAS);
  const actas = lsRead<LocalActa>(LS_ACTAS);
  const porId = new Map(personas.map((p) => [p.id, p]));
  const rows: ActaRow[] = actas.map((s) => ({
    id: s.id,
    tipo: s.tipo,
    fecha_sacramento: s.fecha_sacramento,
    ministro_celebrante: s.ministro_celebrante,
    libro: s.libro,
    folio: s.folio,
    parroquia_capilla: s.parroquia_capilla,
    persona_id: s.persona_id ?? null,
    esposo_persona_id: s.esposo_persona_id ?? null,
    esposa_persona_id: s.esposa_persona_id ?? null,
    titular_nombre: porId.get(s.persona_id ?? -1)?.apellido_nombres ?? null,
    titular_doc: porId.get(s.persona_id ?? -1)?.documento ?? null,
    esposo_nombre: porId.get(s.esposo_persona_id ?? -1)?.apellido_nombres ?? null,
    esposo_doc: porId.get(s.esposo_persona_id ?? -1)?.documento ?? null,
    esposa_nombre: porId.get(s.esposa_persona_id ?? -1)?.apellido_nombres ?? null,
    esposa_doc: porId.get(s.esposa_persona_id ?? -1)?.documento ?? null,
  }));
  return rows
    .filter(
      (r) =>
        (f.tipo === "TODOS" || r.tipo === f.tipo) &&
        (!f.fecha || r.fecha_sacramento === f.fecha) &&
        (!q ||
          [r.titular_nombre, r.titular_doc, r.esposo_nombre, r.esposo_doc,
           r.esposa_nombre, r.esposa_doc, r.libro, r.folio]
            .join(" ")
            .toLowerCase()
            .includes(q))
    )
    .sort((a, b) =>
      b.fecha_sacramento.localeCompare(a.fecha_sacramento) || b.id - a.id
    )
    .slice(0, 500);
}

export async function getDetalle(id: number): Promise<ActaDetalle | null> {
  await initDb();
  if (mode === "sqlite" && db) {
    const s = await db.select<
      {
        id: number; tipo: TipoSacramento; persona_id: number | null;
        esposo_persona_id: number | null; esposa_persona_id: number | null;
        fecha_sacramento: string; ministro_celebrante: string; libro: string;
        folio: string; parroquia_capilla: string; padrino: string; madrina: string;
        notas_marginales: string; bautizado_en_parroquia: string;
        domicilio_matrimonial: string; referencia_folios: string;
        esposo_baut_lugar: string; esposo_baut_fecha: string;
        esposo_baut_libro: string; esposo_baut_folio: string;
        esposa_baut_lugar: string; esposa_baut_fecha: string;
        esposa_baut_libro: string; esposa_baut_folio: string;
        esposo_no_baut: number | null; esposa_no_baut: number | null;
        conf_baut_lugar: string; conf_baut_fecha: string;
        conf_baut_libro: string; conf_baut_folio: string;
      }[]
    >("SELECT * FROM sacramentos WHERE id = $1", [id]);
    if (s.length === 0) return null;
    const a = s[0];
    const legacy = a as unknown as Record<string, unknown>;
    const leg = (k: string): string => (legacy[k] == null ? "" : String(legacy[k]));
    const leer = async (pid: number | null): Promise<Persona> => {
      if (!pid) return { ...PERSONA_VACIA };
      const r = await db!.select<Persona[]>("SELECT * FROM personas WHERE id = $1", [pid]);
      return r[0] ?? { ...PERSONA_VACIA };
    };
    return {
      id: a.id, tipo: a.tipo,
      persona: await leer(a.persona_id),
      esposo: await leer(a.esposo_persona_id),
      esposa: await leer(a.esposa_persona_id),
      fecha_sacramento: a.fecha_sacramento,
      ministro_celebrante: a.ministro_celebrante,
      libro: a.libro, folio: a.folio,
      parroquia_capilla: a.parroquia_capilla,
      padrino: a.padrino || leg("testigo_1"), madrina: a.madrina || leg("testigo_2"),
      notas_marginales: a.notas_marginales,
      bautizado_en_parroquia: a.bautizado_en_parroquia,
      domicilio_matrimonial: a.domicilio_matrimonial ?? "",
      referencia_folios: a.referencia_folios ?? "",
      esposo_baut_lugar: a.esposo_baut_lugar ?? "",
      esposo_baut_fecha: a.esposo_baut_fecha ?? "",
      esposo_baut_libro: a.esposo_baut_libro ?? "",
      esposo_baut_folio: a.esposo_baut_folio ?? "",
      esposa_baut_lugar: a.esposa_baut_lugar ?? "",
      esposa_baut_fecha: a.esposa_baut_fecha ?? "",
      esposa_baut_libro: a.esposa_baut_libro ?? "",
      esposa_baut_folio: a.esposa_baut_folio ?? "",
      esposo_no_baut: Number(a.esposo_no_baut) === 1,
      esposa_no_baut: Number(a.esposa_no_baut) === 1,
      conf_baut_lugar: a.conf_baut_lugar ?? "",
      conf_baut_fecha: a.conf_baut_fecha ?? "",
      conf_baut_libro: a.conf_baut_libro ?? "",
      conf_baut_folio: a.conf_baut_folio ?? "",
    };
  }

  const actas = lsRead<{
    id: number; tipo: TipoSacramento; persona_id: number | null;
    esposo_persona_id: number | null; esposa_persona_id: number | null;
    fecha_sacramento: string; ministro_celebrante: string; libro: string;
    folio: string; parroquia_capilla: string; padrino: string; madrina: string;
    notas_marginales: string; bautizado_en_parroquia: string;
    domicilio_matrimonial: string; referencia_folios: string;
    esposo_baut_lugar: string; esposo_baut_fecha: string;
    esposo_baut_libro: string; esposo_baut_folio: string;
    esposa_baut_lugar: string; esposa_baut_fecha: string;
    esposa_baut_libro: string; esposa_baut_folio: string;
    esposo_no_baut?: boolean | number | null; esposa_no_baut?: boolean | number | null;
    conf_baut_lugar: string; conf_baut_fecha: string;
    conf_baut_libro: string; conf_baut_folio: string;
  }>(LS_ACTAS);
  const a = actas.find((x) => x.id === id);
  if (!a) return null;
  const legacyL = a as unknown as Record<string, unknown>;
  const legL = (k: string): string => (legacyL[k] == null ? "" : String(legacyL[k]));
  const personas = lsRead<Persona>(LS_PERSONAS);
  const leer = (pid: number | null): Persona =>
    personas.find((p) => p.id === pid) ?? { ...PERSONA_VACIA };
  return {
    id: a.id, tipo: a.tipo,
    persona: { ...leer(a.persona_id) },
    esposo: { ...leer(a.esposo_persona_id) },
    esposa: { ...leer(a.esposa_persona_id) },
    fecha_sacramento: a.fecha_sacramento,
    ministro_celebrante: a.ministro_celebrante,
    libro: a.libro, folio: a.folio,
    parroquia_capilla: a.parroquia_capilla,
    padrino: a.padrino || legL("testigo_1"), madrina: a.madrina || legL("testigo_2"),
    notas_marginales: a.notas_marginales,
    bautizado_en_parroquia: a.bautizado_en_parroquia,
    domicilio_matrimonial: a.domicilio_matrimonial ?? "",
    referencia_folios: a.referencia_folios ?? "",
    esposo_baut_lugar: a.esposo_baut_lugar ?? "",
    esposo_baut_fecha: a.esposo_baut_fecha ?? "",
    esposo_baut_libro: a.esposo_baut_libro ?? "",
    esposo_baut_folio: a.esposo_baut_folio ?? "",
    esposa_baut_lugar: a.esposa_baut_lugar ?? "",
    esposa_baut_fecha: a.esposa_baut_fecha ?? "",
    esposa_baut_libro: a.esposa_baut_libro ?? "",
    esposa_baut_folio: a.esposa_baut_folio ?? "",
    esposo_no_baut: a.esposo_no_baut === true || a.esposo_no_baut === 1,
    esposa_no_baut: a.esposa_no_baut === true || a.esposa_no_baut === 1,
    conf_baut_lugar: a.conf_baut_lugar ?? "",
    conf_baut_fecha: a.conf_baut_fecha ?? "",
    conf_baut_libro: a.conf_baut_libro ?? "",
    conf_baut_folio: a.conf_baut_folio ?? "",
  };
}

export interface LegajoItem {
  actaId: number;
  tipo: TipoSacramento;
  fecha_sacramento: string;
  libro: string;
  folio: string;
  parroquia_capilla: string;
  ministro_celebrante: string;
  padrino: string;
  madrina: string;
  rol: "TITULAR" | "ESPOSO" | "ESPOSA";
  conyugeNombre?: string;
}

export interface LegajoPersona {
  persona: Persona;
  hitos: LegajoItem[];
  /** Cónyuges distintos (de sus matrimonios) para las pestañas del legajo. */
  conyuges: { id: number; nombre: string }[];
}

/** Obtiene el legajo/historial de sacramentos de una persona por su ID (o por el ID de un acta). */
export async function getLegajoPersona(personaId: number): Promise<LegajoPersona | null> {
  await initDb();
  if (mode === "sqlite" && db) {
    const pRows = await db.select<Persona[]>("SELECT * FROM personas WHERE id = $1", [personaId]);
    if (pRows.length === 0) return null;
    const persona = pRows[0];

    const sRows = await db.select<
      {
        id: number;
        tipo: TipoSacramento;
        persona_id: number | null;
        esposo_persona_id: number | null;
        esposa_persona_id: number | null;
        fecha_sacramento: string;
        libro: string;
        folio: string;
        parroquia_capilla: string;
        ministro_celebrante: string;
        padrino: string;
        madrina: string;
      }[]
    >(
      `SELECT id, tipo, persona_id, esposo_persona_id, esposa_persona_id,
              fecha_sacramento, libro, folio, parroquia_capilla,
              ministro_celebrante, padrino, madrina
       FROM sacramentos
       WHERE persona_id = $1 OR esposo_persona_id = $1 OR esposa_persona_id = $1
       ORDER BY fecha_sacramento ASC`,
      [personaId]
    );

    const hitos: LegajoItem[] = [];
    const conyuges = new Map<number, string>();
    for (const r of sRows) {
      let rol: "TITULAR" | "ESPOSO" | "ESPOSA" = "TITULAR";
      let conyugeNombre: string | undefined;

      if (r.tipo === "MATRIMONIO") {
        if (r.esposo_persona_id === personaId) {
          rol = "ESPOSO";
          if (r.esposa_persona_id) {
            const cony = await db.select<{ apellido_nombres: string }[]>(
              "SELECT apellido_nombres FROM personas WHERE id = $1",
              [r.esposa_persona_id]
            );
            conyugeNombre = cony[0]?.apellido_nombres;
            conyuges.set(r.esposa_persona_id, conyugeNombre ?? "Cónyuge");
          }
        } else if (r.esposa_persona_id === personaId) {
          rol = "ESPOSA";
          if (r.esposo_persona_id) {
            const cony = await db.select<{ apellido_nombres: string }[]>(
              "SELECT apellido_nombres FROM personas WHERE id = $1",
              [r.esposo_persona_id]
            );
            conyugeNombre = cony[0]?.apellido_nombres;
            conyuges.set(r.esposo_persona_id, conyugeNombre ?? "Cónyuge");
          }
        }
      }

      hitos.push({
        actaId: r.id,
        tipo: r.tipo,
        fecha_sacramento: r.fecha_sacramento,
        libro: r.libro,
        folio: r.folio,
        parroquia_capilla: r.parroquia_capilla,
        ministro_celebrante: r.ministro_celebrante,
        padrino: r.padrino,
        madrina: r.madrina,
        rol,
        conyugeNombre,
      });
    }

    return {
      persona,
      hitos,
      conyuges: [...conyuges].map(([id, nombre]) => ({ id, nombre })),
    };
  }

  // Fallback modo local (localStorage)
  const personas = lsRead<Persona>(LS_PERSONAS);
  const persona = personas.find((p) => p.id === personaId);
  if (!persona) return null;

  const actas = lsRead<{
    id: number;
    tipo: TipoSacramento;
    persona_id: number | null;
    esposo_persona_id: number | null;
    esposa_persona_id: number | null;
    fecha_sacramento: string;
    libro: string;
    folio: string;
    parroquia_capilla: string;
    ministro_celebrante: string;
    padrino: string;
    madrina: string;
  }>(LS_ACTAS);

  const misActas = actas
    .filter(
      (a) =>
        a.persona_id === personaId ||
        a.esposo_persona_id === personaId ||
        a.esposa_persona_id === personaId
    )
    .sort((a, b) => a.fecha_sacramento.localeCompare(b.fecha_sacramento));

  const conyuges = new Map<number, string>();
  const hitos: LegajoItem[] = misActas.map((r) => {
    let rol: "TITULAR" | "ESPOSO" | "ESPOSA" = "TITULAR";
    let conyugeNombre: string | undefined;

    if (r.tipo === "MATRIMONIO") {
      if (r.esposo_persona_id === personaId) {
        rol = "ESPOSO";
        if (r.esposa_persona_id) {
          conyugeNombre = personas.find((p) => p.id === r.esposa_persona_id)?.apellido_nombres;
          conyuges.set(r.esposa_persona_id, conyugeNombre ?? "Cónyuge");
        }
      } else if (r.esposa_persona_id === personaId) {
        rol = "ESPOSA";
        if (r.esposo_persona_id) {
          conyugeNombre = personas.find((p) => p.id === r.esposo_persona_id)?.apellido_nombres;
          conyuges.set(r.esposo_persona_id, conyugeNombre ?? "Cónyuge");
        }
      }
    }

    return {
      actaId: r.id,
      tipo: r.tipo,
      fecha_sacramento: r.fecha_sacramento,
      libro: r.libro,
      folio: r.folio,
      parroquia_capilla: r.parroquia_capilla,
      ministro_celebrante: r.ministro_celebrante,
      padrino: r.padrino,
      madrina: r.madrina,
      rol,
      conyugeNombre,
    };
  });

  return {
    persona,
    hitos,
    conyuges: [...conyuges].map(([id, nombre]) => ({ id, nombre })),
  };
}


const PERSONA_COLS =
  "apellido_nombres, documento, fecha_nacimiento, lugar_nacimiento, nacionalidad, domicilio, telefono, nombre_padre, nombre_madre";
function personaVals(p: Persona): unknown[] {
  return [
    p.apellido_nombres, p.documento, p.fecha_nacimiento, p.lugar_nacimiento,
    p.nacionalidad, p.domicilio, p.telefono, p.nombre_padre, p.nombre_madre,
  ];
}

export async function crearActa(input: SacramentoInput): Promise<number> {
  await initDb();
  if (mode === "sqlite" && db) {
    const insertPersona = async (p: Persona): Promise<number> => {
      const r = await db!.execute(
        `INSERT INTO personas (${PERSONA_COLS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        personaVals(p)
      );
      if (r.lastInsertId == null) throw new Error("No se pudo guardar la persona.");
      return r.lastInsertId;
    };
    let personaId: number | null = null;
    let esposoId: number | null = null;
    let esposaId: number | null = null;
    if (input.tipo === "MATRIMONIO") {
      esposoId = await insertPersona(input.esposo);
      esposaId = await insertPersona(input.esposa);
    } else {
      personaId = await insertPersona(input.persona);
    }
    const res = await db.execute(
      `INSERT INTO sacramentos
       (persona_id, esposo_persona_id, esposa_persona_id, tipo, fecha_sacramento,
        ministro_celebrante, libro, folio, parroquia_capilla, padrino, madrina,
        notas_marginales, bautizado_en_parroquia,
        domicilio_matrimonial, referencia_folios,
        esposo_baut_lugar, esposo_baut_fecha, esposo_baut_libro, esposo_baut_folio,
        esposa_baut_lugar, esposa_baut_fecha, esposa_baut_libro, esposa_baut_folio,
        esposo_no_baut, esposa_no_baut,
        conf_baut_lugar, conf_baut_fecha, conf_baut_libro, conf_baut_folio)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
               $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)`,
      [
        personaId, esposoId, esposaId, input.tipo, input.fecha_sacramento,
        input.ministro_celebrante, input.libro, input.folio, input.parroquia_capilla,
        input.padrino, input.madrina, input.notas_marginales,
        input.bautizado_en_parroquia,
        input.domicilio_matrimonial, input.referencia_folios,
        input.esposo_baut_lugar, input.esposo_baut_fecha,
        input.esposo_baut_libro, input.esposo_baut_folio,
        input.esposa_baut_lugar, input.esposa_baut_fecha,
        input.esposa_baut_libro, input.esposa_baut_folio,
        input.esposo_no_baut ? 1 : 0, input.esposa_no_baut ? 1 : 0,
        input.conf_baut_lugar, input.conf_baut_fecha,
        input.conf_baut_libro, input.conf_baut_folio,
      ]
    );
    if (res.lastInsertId == null) throw new Error("No se pudo guardar el acta.");
    return res.lastInsertId;
  }

  // Modo local
  const personas = lsRead<Persona>(LS_PERSONAS);
  const actas = lsRead<Record<string, unknown>>(LS_ACTAS);
  const nuevaPersona = (p: Persona): number => {
    const id = lsNextId();
    personas.push({ ...p, id });
    return id;
  };
  let personaId: number | null = null;
  let esposoId: number | null = null;
  let esposaId: number | null = null;
  if (input.tipo === "MATRIMONIO") {
    esposoId = nuevaPersona(input.esposo);
    esposaId = nuevaPersona(input.esposa);
  } else {
    personaId = nuevaPersona(input.persona);
  }
  const id = lsNextId();
  actas.push({
    id, tipo: input.tipo, persona_id: personaId,
    esposo_persona_id: esposoId, esposa_persona_id: esposaId,
    fecha_sacramento: input.fecha_sacramento,
    ministro_celebrante: input.ministro_celebrante,
    libro: input.libro, folio: input.folio,
    parroquia_capilla: input.parroquia_capilla,
    padrino: input.padrino, madrina: input.madrina,
    notas_marginales: input.notas_marginales,
    bautizado_en_parroquia: input.bautizado_en_parroquia,
    domicilio_matrimonial: input.domicilio_matrimonial,
    referencia_folios: input.referencia_folios,
    esposo_baut_lugar: input.esposo_baut_lugar,
    esposo_baut_fecha: input.esposo_baut_fecha,
    esposo_baut_libro: input.esposo_baut_libro,
    esposo_baut_folio: input.esposo_baut_folio,
    esposa_baut_lugar: input.esposa_baut_lugar,
    esposa_baut_fecha: input.esposa_baut_fecha,
    esposa_baut_libro: input.esposa_baut_libro,
    esposa_baut_folio: input.esposa_baut_folio,
    esposo_no_baut: input.esposo_no_baut,
    esposa_no_baut: input.esposa_no_baut,
    conf_baut_lugar: input.conf_baut_lugar,
    conf_baut_fecha: input.conf_baut_fecha,
    conf_baut_libro: input.conf_baut_libro,
    conf_baut_folio: input.conf_baut_folio,
  });
  lsWrite(LS_PERSONAS, personas);
  lsWrite(LS_ACTAS, actas);
  return id;
}

export async function actualizarActa(id: number, input: SacramentoInput): Promise<void> {
  await initDb();
  const det = await getDetalle(id);
  if (!det) throw new Error("Acta no encontrada.");
  if (det.tipo !== input.tipo) throw new Error("No se puede cambiar el tipo de sacramento. Borrá el acta y creala de nuevo.");

  if (mode === "sqlite" && db) {
    const updPersona = async (pid: number | null, p: Persona) => {
      if (!pid) return;
      await db!.execute(
        `UPDATE personas SET apellido_nombres=$1, documento=$2, fecha_nacimiento=$3,
         lugar_nacimiento=$4, nacionalidad=$5, domicilio=$6, telefono=$7,
         nombre_padre=$8, nombre_madre=$9 WHERE id=$10`,
        [...personaVals(p), pid]
      );
    };
    if (input.tipo === "MATRIMONIO") {
      const ids = await db.select<{ esposo_persona_id: number; esposa_persona_id: number }[]>(
        "SELECT esposo_persona_id, esposa_persona_id FROM sacramentos WHERE id=$1", [id]
      );
      await updPersona(ids[0].esposo_persona_id, input.esposo);
      await updPersona(ids[0].esposa_persona_id, input.esposa);
    } else {
      const ids = await db.select<{ persona_id: number }[]>(
        "SELECT persona_id FROM sacramentos WHERE id=$1", [id]
      );
      await updPersona(ids[0].persona_id, input.persona);
    }
    await db.execute(
      `UPDATE sacramentos SET fecha_sacramento=$1, ministro_celebrante=$2, libro=$3,
       folio=$4, parroquia_capilla=$5, padrino=$6, madrina=$7, notas_marginales=$8,
       bautizado_en_parroquia=$9,
       domicilio_matrimonial=$10, referencia_folios=$11,
       esposo_baut_lugar=$12, esposo_baut_fecha=$13, esposo_baut_libro=$14, esposo_baut_folio=$15,
       esposa_baut_lugar=$16, esposa_baut_fecha=$17, esposa_baut_libro=$18, esposa_baut_folio=$19,
       esposo_no_baut=$20, esposa_no_baut=$21,
       conf_baut_lugar=$22, conf_baut_fecha=$23, conf_baut_libro=$24, conf_baut_folio=$25
       WHERE id=$26`,
      [
        input.fecha_sacramento, input.ministro_celebrante, input.libro, input.folio,
        input.parroquia_capilla, input.padrino, input.madrina, input.notas_marginales,
        input.bautizado_en_parroquia,
        input.domicilio_matrimonial, input.referencia_folios,
        input.esposo_baut_lugar, input.esposo_baut_fecha,
        input.esposo_baut_libro, input.esposo_baut_folio,
        input.esposa_baut_lugar, input.esposa_baut_fecha,
        input.esposa_baut_libro, input.esposa_baut_folio,
        input.esposo_no_baut ? 1 : 0, input.esposa_no_baut ? 1 : 0,
        input.conf_baut_lugar, input.conf_baut_fecha,
        input.conf_baut_libro, input.conf_baut_folio, id,
      ]
    );
    return;
  }

  // Modo local
  const personas = lsRead<Persona>(LS_PERSONAS);
  const actas = lsRead<{
    id: number; tipo: TipoSacramento; persona_id: number | null;
    esposo_persona_id: number | null; esposa_persona_id: number | null;
    fecha_sacramento: string; ministro_celebrante: string; libro: string;
    folio: string; parroquia_capilla: string; padrino: string; madrina: string;
    notas_marginales: string; bautizado_en_parroquia: string;
    domicilio_matrimonial: string; referencia_folios: string;
    esposo_baut_lugar: string; esposo_baut_fecha: string;
    esposo_baut_libro: string; esposo_baut_folio: string;
    esposa_baut_lugar: string; esposa_baut_fecha: string;
    esposa_baut_libro: string; esposa_baut_folio: string;
    esposo_no_baut?: boolean | number | null; esposa_no_baut?: boolean | number | null;
    conf_baut_lugar: string; conf_baut_fecha: string;
    conf_baut_libro: string; conf_baut_folio: string;
  }>(LS_ACTAS);
  const upd = (pid: number | null | undefined, p: Persona) => {
    const i = personas.findIndex((x) => x.id === pid);
    if (i >= 0) personas[i] = { ...p, id: pid ?? undefined };
  };
  if (input.tipo === "MATRIMONIO") {
    upd(det.esposo.id, input.esposo);
    upd(det.esposa.id, input.esposa);
  } else {
    upd(det.persona.id, input.persona);
  }
  const i = actas.findIndex((x) => x.id === id);
  if (i >= 0) {
    actas[i] = {
      ...actas[i],
      fecha_sacramento: input.fecha_sacramento,
      ministro_celebrante: input.ministro_celebrante,
      libro: input.libro, folio: input.folio,
      parroquia_capilla: input.parroquia_capilla,
      padrino: input.padrino, madrina: input.madrina,
      notas_marginales: input.notas_marginales,
      bautizado_en_parroquia: input.bautizado_en_parroquia,
      domicilio_matrimonial: input.domicilio_matrimonial,
      referencia_folios: input.referencia_folios,
      esposo_baut_lugar: input.esposo_baut_lugar,
      esposo_baut_fecha: input.esposo_baut_fecha,
      esposo_baut_libro: input.esposo_baut_libro,
      esposo_baut_folio: input.esposo_baut_folio,
      esposa_baut_lugar: input.esposa_baut_lugar,
      esposa_baut_fecha: input.esposa_baut_fecha,
      esposa_baut_libro: input.esposa_baut_libro,
      esposa_baut_folio: input.esposa_baut_folio,
      esposo_no_baut: input.esposo_no_baut,
      esposa_no_baut: input.esposa_no_baut,
      conf_baut_lugar: input.conf_baut_lugar,
      conf_baut_fecha: input.conf_baut_fecha,
      conf_baut_libro: input.conf_baut_libro,
      conf_baut_folio: input.conf_baut_folio,
    };
  }
  lsWrite(LS_PERSONAS, personas);
  lsWrite(LS_ACTAS, actas);
}

export async function eliminarActa(id: number): Promise<void> {
  await initDb();
  if (mode === "sqlite" && db) {
    await db.execute("DELETE FROM sacramentos WHERE id=$1", [id]);
    // Limpia personas que quedaron sin actas que las referencien
    await db.execute(
      `DELETE FROM personas WHERE id NOT IN (
         SELECT persona_id FROM sacramentos WHERE persona_id IS NOT NULL
         UNION SELECT esposo_persona_id FROM sacramentos WHERE esposo_persona_id IS NOT NULL
         UNION SELECT esposa_persona_id FROM sacramentos WHERE esposa_persona_id IS NOT NULL
       )`
    );
    return;
  }
  const actas = lsRead<{
    id: number; persona_id: number | null;
    esposo_persona_id: number | null; esposa_persona_id: number | null;
  }>(LS_ACTAS).filter((x) => x.id !== id);
  const usados = new Set<number>();
  for (const a of actas) {
    if (a.persona_id) usados.add(a.persona_id);
    if (a.esposo_persona_id) usados.add(a.esposo_persona_id);
    if (a.esposa_persona_id) usados.add(a.esposa_persona_id);
  }
  lsWrite(LS_ACTAS, actas);
  lsWrite(LS_PERSONAS, lsRead<Persona>(LS_PERSONAS).filter((p) => usados.has(p.id ?? -1)));
}

/** Cantidad de actas por sacramento (panel resumen). */
export async function contarActas(): Promise<Record<TipoSacramento, number>> {
  const base: Record<TipoSacramento, number> = {
    BAUTISMO: 0,
    COMUNION: 0,
    CONFIRMACION: 0,
    MATRIMONIO: 0,
  };
  await initDb();
  if (mode === "sqlite" && db) {
    const rows = await db.select<{ tipo: string; n: number }[]>(
      "SELECT tipo, COUNT(*) AS n FROM sacramentos GROUP BY tipo"
    );
    for (const r of rows) {
      if (r.tipo in base) base[r.tipo as TipoSacramento] = r.n;
    }
    return base;
  }
  for (const a of lsRead<{ tipo: TipoSacramento }>(LS_ACTAS)) {
    if (a.tipo in base) base[a.tipo]++;
  }
  return base;
}

// Expuestos para el módulo de auth (misma conexión)
export async function sqlSelect<T>(sql: string, params?: unknown[]): Promise<T> {
  await initDb();
  if (mode === "sqlite" && db) return db.select<T>(sql, params);
  throw new Error("no-sqlite");
}

export async function sqlExecute(sql: string, params?: unknown[]): Promise<void> {
  await initDb();
  if (mode === "sqlite" && db) {
    await db.execute(sql, params);
    return;
  }
  throw new Error("no-sqlite");
}

// --- Configuración de la parroquia (membrete y firma de certificados) ---

export interface ParishConfig {
  parroquia: string;
  devocion: string;
  diocesis: string;
  direccion: string;
  parroco: string;
}

export const DEFAULT_PARISH: ParishConfig = {
  parroquia: "Parroquia María Auxiliadora",
  devocion: "Patrona de Garupá",
  diocesis: "Diócesis de Posadas",
  direccion: "Isolina Gallardo y Rivadavia — Barrio Centro, Garupá, Misiones",
  parroco: "",
};

export async function getConfig(): Promise<ParishConfig> {
  try {
    const rows = await sqlSelect<{ clave: string; valor: string }[]>(
      "SELECT clave, valor FROM config"
    );
    const cfg = { ...DEFAULT_PARISH };
    for (const r of rows) {
      if (r.clave in cfg) (cfg as Record<string, string>)[r.clave] = r.valor;
    }
    return cfg;
  } catch {
    try {
      return {
        ...DEFAULT_PARISH,
        ...(JSON.parse(localStorage.getItem(LS_CONFIG) ?? "{}") as Partial<ParishConfig>),
      };
    } catch {
      return { ...DEFAULT_PARISH };
    }
  }
}

export async function saveConfig(cfg: ParishConfig): Promise<void> {
  try {
    for (const [clave, valor] of Object.entries(cfg)) {
      await sqlExecute("INSERT OR REPLACE INTO config (clave, valor) VALUES ($1, $2)", [
        clave,
        valor,
      ]);
    }
  } catch (e) {
    if (!esNoSqlite(e)) throw e;
    localStorage.setItem(LS_CONFIG, JSON.stringify(cfg));
  }
}

/** Volcado JSON para resguardo en modo local (en SQLite se copia el .db). */
export async function dumpLocalJSON(): Promise<string> {
  return JSON.stringify(
    {
      app: "secretaria-iglesia",
      exported_at: new Date().toISOString(),
      config: await getConfig(),
      personas: lsRead<Persona>(LS_PERSONAS),
      sacramentos: lsRead<Record<string, unknown>>(LS_ACTAS),
      auditoria: lsRead<Record<string, unknown>>(LS_AUDITORIA_WEB),
    },
    null,
    2
  );
}
