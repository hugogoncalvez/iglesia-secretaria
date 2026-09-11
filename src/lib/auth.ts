import { sqlSelect, sqlExecute } from "./db";

const LS_USUARIOS = "iglesia_usuarios";
const LS_SESSION = "iglesia_session";

export const DEFAULT_USER = "admin";
export const DEFAULT_PASS = "admin123";

interface UsuarioRow {
  id: number;
  usuario: string;
  hash: string;
}

/** Usuarios para incluir en el resguardo (solo modo web; en Tauri se copia el .db). */
export function volcarUsuarios(): UsuarioRow[] {
  return lsReadUsers();
}

function lsReadUsers(): UsuarioRow[] {
  try {
    return JSON.parse(localStorage.getItem(LS_USUARIOS) ?? "[]") as UsuarioRow[];
  } catch {
    return [];
  }
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Crea admin/admin123 si no existe ningún usuario. Devuelve true si es primer arranque. */
export async function ensureDefaultUser(): Promise<boolean> {
  try {
    const rows = await sqlSelect<UsuarioRow[]>("SELECT * FROM usuarios LIMIT 1");
    if (rows.length > 0) return false;
    await sqlExecute(
      "INSERT INTO usuarios (usuario, hash, creado_en) VALUES ($1,$2,$3)",
      [DEFAULT_USER, await sha256(DEFAULT_PASS), new Date().toISOString()]
    );
    return true;
  } catch {
    // Modo local (web dev sin Tauri)
    const users = lsReadUsers();
    if (users.length > 0) return false;
    users.push({ id: 1, usuario: DEFAULT_USER, hash: await sha256(DEFAULT_PASS) });
    localStorage.setItem(LS_USUARIOS, JSON.stringify(users));
    return true;
  }
}

export async function validateLogin(
  usuario: string,
  password: string
): Promise<boolean> {
  const u = usuario.trim();
  if (!u || !password) return false;
  const hash = await sha256(password);
  try {
    const rows = await sqlSelect<UsuarioRow[]>(
      "SELECT * FROM usuarios WHERE usuario = $1 LIMIT 1",
      [u]
    );
    return rows.length === 1 && rows[0].hash === hash;
  } catch {
    const users = lsReadUsers();
    return users.some((x) => x.usuario === u && x.hash === hash);
  }
}

export function setSession(usuario: string) {
  localStorage.setItem(LS_SESSION, usuario);
}
export function getSession(): string | null {
  return localStorage.getItem(LS_SESSION);
}
export function clearSession() {
  localStorage.removeItem(LS_SESSION);
}

export async function listUsuarios(): Promise<string[]> {
  try {
    const rows = await sqlSelect<UsuarioRow[]>(
      "SELECT usuario FROM usuarios ORDER BY usuario"
    );
    return rows.map((r) => r.usuario);
  } catch {
    return lsReadUsers().map((u) => u.usuario).sort();
  }
}

export async function crearUsuario(usuario: string, password: string): Promise<void> {
  const u = usuario.trim();
  if (u.length < 3) throw new Error("El usuario debe tener al menos 3 caracteres.");
  if (password.length < 4) throw new Error("La clave debe tener al menos 4 caracteres.");
  const hash = await sha256(password);
  try {
    const rows = await sqlSelect<UsuarioRow[]>(
      "SELECT id FROM usuarios WHERE usuario = $1 LIMIT 1",
      [u]
    );
    if (rows.length > 0) throw new Error("Ese usuario ya existe.");
    await sqlExecute(
      "INSERT INTO usuarios (usuario, hash, creado_en) VALUES ($1,$2,$3)",
      [u, hash, new Date().toISOString()]
    );
  } catch (e) {
    if (e instanceof Error && e.message !== "no-sqlite") throw e;
    // Modo local
    const users = lsReadUsers();
    if (users.some((x) => x.usuario === u)) throw new Error("Ese usuario ya existe.");
    const id = users.length > 0 ? Math.max(...users.map((x) => x.id)) + 1 : 1;
    users.push({ id, usuario: u, hash });
    localStorage.setItem(LS_USUARIOS, JSON.stringify(users));
  }
}

export async function cambiarPassword(usuario: string, nueva: string): Promise<void> {
  if (nueva.length < 4) throw new Error("La clave debe tener al menos 4 caracteres.");
  const hash = await sha256(nueva);
  try {
    await sqlExecute("UPDATE usuarios SET hash=$1 WHERE usuario=$2", [hash, usuario]);
  } catch (e) {
    if (e instanceof Error && e.message !== "no-sqlite") throw e;
    const users = lsReadUsers().map((x) =>
      x.usuario === usuario ? { ...x, hash } : x
    );
    localStorage.setItem(LS_USUARIOS, JSON.stringify(users));
  }
}
export async function eliminarUsuario(usuario: string): Promise<void> {
  try {
    await sqlExecute("DELETE FROM usuarios WHERE usuario=$1", [usuario]);
  } catch (e) {
    if (e instanceof Error && e.message !== "no-sqlite") throw e;
    localStorage.setItem(
      LS_USUARIOS,
      JSON.stringify(lsReadUsers().filter((x) => x.usuario !== usuario))
    );
  }
}

/** true si el usuario todavía usa la clave de fábrica (admin123). */
export async function tieneClaveDefecto(usuario: string): Promise<boolean> {
  const defecto = await sha256(DEFAULT_PASS);
  try {
    const rows = await sqlSelect<UsuarioRow[]>(
      "SELECT hash FROM usuarios WHERE usuario=$1 LIMIT 1",
      [usuario]
    );
    return rows.length === 1 && rows[0].hash === defecto;
  } catch {
    const u = lsReadUsers().find((x) => x.usuario === usuario);
    return !!u && u.hash === defecto;
  }
}

/** true si el usuario provisorio "admin" existe y conserva la clave de fábrica. */
export async function adminConClaveDefecto(): Promise<boolean> {
  try {
    const rows = await sqlSelect<UsuarioRow[]>(
      "SELECT hash FROM usuarios WHERE usuario=$1 LIMIT 1",
      [DEFAULT_USER]
    );
    if (rows.length === 0) return false;
    return rows[0].hash === (await sha256(DEFAULT_PASS));
  } catch {
    const u = lsReadUsers().find((x) => x.usuario === DEFAULT_USER);
    return !!u && u.hash === (await sha256(DEFAULT_PASS));
  }
}
