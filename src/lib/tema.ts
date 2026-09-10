export type Tema = "claro" | "oscuro";

const KEY = "iglesia_tema";

export function getTema(): Tema {
  return localStorage.getItem(KEY) === "oscuro" ? "oscuro" : "claro";
}

export function aplicarTema(t: Tema) {
  localStorage.setItem(KEY, t);
  document.documentElement.classList.toggle("dark", t === "oscuro");
}

/** Aplica el tema guardado antes del primer render (evita parpadeo). */
export function initTema() {
  aplicarTema(getTema());
}
