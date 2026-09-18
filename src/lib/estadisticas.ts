import {
  LS_KEYS,
  TIPOS_SACRAMENTO,
  getMode,
  initDb,
  sqlSelect,
  type Persona,
  type TipoSacramento,
} from "./db";

export type ConteoPorTipo = Record<TipoSacramento, number>;

export const CONTEO_VACIO: ConteoPorTipo = {
  BAUTISMO: 0,
  COMUNION: 0,
  CONFIRMACION: 0,
  MATRIMONIO: 0,
};

export interface MesFila extends ConteoPorTipo {
  mes: string; // YYYY-MM
  total: number;
}

export const EDADES_BUCKETS = [
  "Menor de 1 año",
  "1 a 7 años",
  "8 a 17 años",
  "18 años o más",
  "Sin dato",
] as const;

export type EdadBucket = (typeof EDADES_BUCKETS)[number];

export interface EdadFila {
  bucket: EdadBucket;
  BAUTISMO: number;
  COMUNION: number;
  CONFIRMACION: number;
}

type ConEdad = "BAUTISMO" | "COMUNION" | "CONFIRMACION";

function esConEdad(t: TipoSacramento): t is ConEdad {
  return t === "BAUTISMO" || t === "COMUNION" || t === "CONFIRMACION";
}

export interface LibroUso {
  tipo: TipoSacramento;
  libro: string;
  cantidad: number;
}

/** Desglose de matrimonios para la planilla del Obispado (punto 2). */
export interface DesgloseMatrimonios {
  entreCatolicos: number; // 2a: ambos contrayentes con dato de bautismo
  mixtos: number; // 2b: solo uno con dato de bautismo
  sinDato: number; // ninguno con dato ni "No bautizado" explícito
}

export const DESGLOSE_VACIO: DesgloseMatrimonios = {
  entreCatolicos: 0,
  mixtos: 0,
  sinDato: 0,
};

/** Datos manuales 5–8 de la planilla del Obispado (los puntos 1–4 son automáticos). */
export interface DatosObispado {
  catequistas: string;
  misioneros: string;
  hogarMujeres: string;
  hogarVarones: string;
  capillas: string;
}

export const OBISPADO_VACIO: DatosObispado = {
  catequistas: "",
  misioneros: "",
  hogarMujeres: "",
  hogarVarones: "",
  capillas: "",
};

/** Guardado por año en este equipo (no es dato sacramental: no va a la BD). */
export const obispadoKey = (anio: string) => `iglesia_obispado_${anio}`;

export function leerObispado(anio: string): DatosObispado {
  try {
    return { ...OBISPADO_VACIO, ...(JSON.parse(localStorage.getItem(obispadoKey(anio)) ?? "{}") as Partial<DatosObispado>) };
  } catch {
    return { ...OBISPADO_VACIO };
  }
}

export interface InformeEstadistico {
  desde: string;
  hasta: string;
  porTipo: ConteoPorTipo;
  total: number;
  porMes: MesFila[];
  edades: EdadFila[];
  matrimonios: DesgloseMatrimonios;
}

/** Edad en años cumplidos entre dos fechas ISO (YYYY-MM-DD). null si falta alguna. */
export function edadAnios(nacimientoISO: string, sacramentoISO: string): number | null {
  const [yn, mn, dn] = nacimientoISO.split("-").map(Number);
  const [ys, ms, ds] = sacramentoISO.split("-").map(Number);
  if (!yn || !mn || !dn || !ys || !ms || !ds) return null;
  let edad = ys - yn;
  if (ms < mn || (ms === mn && ds < dn)) edad--;
  return edad < 0 ? null : edad;
}

export function bucketEdad(edad: number | null): EdadBucket {
  if (edad == null) return "Sin dato";
  if (edad < 1) return "Menor de 1 año";
  if (edad <= 7) return "1 a 7 años";
  if (edad <= 17) return "8 a 17 años";
  return "18 años o más";
}

function lsRead<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as T[];
  } catch {
    return [];
  }
}

interface ActaPlana {
  tipo: TipoSacramento;
  fecha_sacramento: string;
  libro: string;
  persona_id: number | null;
  esposo_persona_id?: number | null;
  esposa_persona_id?: number | null;
  esposo_baut_lugar?: string;
  esposo_baut_fecha?: string;
  esposo_baut_libro?: string;
  esposo_baut_folio?: string;
  esposa_baut_lugar?: string;
  esposa_baut_fecha?: string;
  esposa_baut_libro?: string;
  esposa_baut_folio?: string;
  esposo_no_baut?: boolean | number | null;
  esposa_no_baut?: boolean | number | null;
}

/** true si el contrayente figura como bautizado (dato cargado y sin tilde "No bautizado"). */
export function contrayenteBautizado(
  lugar: string | undefined,
  fecha: string | undefined,
  libro: string | undefined,
  folio: string | undefined,
  noBaut: boolean | number | null | undefined
): boolean {
  if (Number(noBaut) === 1) return false;
  return !!(lugar || fecha || libro || folio);
}

function clasificarMatrimonio(a: ActaPlana, d: DesgloseMatrimonios): void {
  const esposo = contrayenteBautizado(
    a.esposo_baut_lugar, a.esposo_baut_fecha, a.esposo_baut_libro, a.esposo_baut_folio, a.esposo_no_baut
  );
  const esposa = contrayenteBautizado(
    a.esposa_baut_lugar, a.esposa_baut_fecha, a.esposa_baut_libro, a.esposa_baut_folio, a.esposa_no_baut
  );
  if (esposo && esposa) d.entreCatolicos++;
  else if (esposo || esposa) d.mixtos++;
  else d.sinDato++;
}

function enRango(fecha: string, desde: string, hasta: string): boolean {
  if (!fecha) return false;
  if (desde && fecha < desde) return false;
  if (hasta && fecha > hasta) return false;
  return true;
}

function armarInforme(
  actas: ActaPlana[],
  nacPorId: Map<number, string>,
  desde: string,
  hasta: string
): InformeEstadistico {
  const porTipo: ConteoPorTipo = { ...CONTEO_VACIO };
  const meses = new Map<string, MesFila>();
  const matrimonios: DesgloseMatrimonios = { ...DESGLOSE_VACIO };
  const edades = new Map<EdadBucket, EdadFila>();
  for (const b of EDADES_BUCKETS) {
    edades.set(b, { bucket: b, BAUTISMO: 0, COMUNION: 0, CONFIRMACION: 0 });
  }

  for (const a of actas) {
    if (!TIPOS_SACRAMENTO.includes(a.tipo)) continue;
    if (!enRango(a.fecha_sacramento, desde, hasta)) continue;
    porTipo[a.tipo]++;
    if (a.tipo === "MATRIMONIO") clasificarMatrimonio(a, matrimonios);

    const mes = a.fecha_sacramento.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(mes)) {
      let f = meses.get(mes);
      if (!f) {
        f = { mes, ...CONTEO_VACIO, total: 0 };
        meses.set(mes, f);
      }
      f[a.tipo]++;
      f.total++;
    }

    if (esConEdad(a.tipo)) {
      const nac = a.persona_id != null ? (nacPorId.get(a.persona_id) ?? "") : "";
      const fila = edades.get(bucketEdad(edadAnios(nac, a.fecha_sacramento)));
      if (fila) fila[a.tipo]++;
    }
  }

  const porMes = [...meses.values()].sort((x, y) => x.mes.localeCompare(y.mes));
  return {
    desde,
    hasta,
    porTipo,
    total: porTipo.BAUTISMO + porTipo.COMUNION + porTipo.CONFIRMACION + porTipo.MATRIMONIO,
    porMes,
    edades: EDADES_BUCKETS.map((b) => edades.get(b)!),
    matrimonios,
  };
}

export async function informeEstadistico(desde: string, hasta: string): Promise<InformeEstadistico> {
  await initDb();

  if (getMode() === "sqlite") {
    const [conteo, mensual, bautismos, matris] = await Promise.all([
      sqlSelect<{ tipo: TipoSacramento; n: number }[]>(
        `SELECT tipo, COUNT(*) AS n FROM sacramentos
         WHERE fecha_sacramento >= $1 AND ($2 = '' OR fecha_sacramento <= $2)
         GROUP BY tipo`,
        [desde || "0000-00-00", hasta]
      ),
      sqlSelect<{ mes: string; tipo: TipoSacramento; n: number }[]>(
        `SELECT substr(fecha_sacramento, 1, 7) AS mes, tipo, COUNT(*) AS n FROM sacramentos
         WHERE fecha_sacramento >= $1 AND ($2 = '' OR fecha_sacramento <= $2)
           AND fecha_sacramento GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
         GROUP BY mes, tipo ORDER BY mes`,
        [desde || "0000-00-00", hasta]
      ),
      sqlSelect<{ tipo: TipoSacramento; fecha_sacramento: string; fecha_nacimiento: string | null }[]>(
        `SELECT s.tipo, s.fecha_sacramento, p.fecha_nacimiento FROM sacramentos s
         LEFT JOIN personas p ON p.id = s.persona_id
         WHERE s.tipo IN ('BAUTISMO','COMUNION','CONFIRMACION')
           AND s.fecha_sacramento >= $1 AND ($2 = '' OR s.fecha_sacramento <= $2)`,
        [desde || "0000-00-00", hasta]
      ),
      sqlSelect<{
        esposo_baut_lugar: string | null; esposo_baut_fecha: string | null;
        esposo_baut_libro: string | null; esposo_baut_folio: string | null;
        esposo_no_baut: number | null;
        esposa_baut_lugar: string | null; esposa_baut_fecha: string | null;
        esposa_baut_libro: string | null; esposa_baut_folio: string | null;
        esposa_no_baut: number | null;
      }[]>(
        `SELECT esposo_baut_lugar, esposo_baut_fecha, esposo_baut_libro, esposo_baut_folio, esposo_no_baut,
                esposa_baut_lugar, esposa_baut_fecha, esposa_baut_libro, esposa_baut_folio, esposa_no_baut
         FROM sacramentos
         WHERE tipo = 'MATRIMONIO'
           AND fecha_sacramento >= $1 AND ($2 = '' OR fecha_sacramento <= $2)`,
        [desde || "0000-00-00", hasta]
      ),
    ]);

    const meses = new Map<string, MesFila>();
    for (const r of mensual) {
      if (!TIPOS_SACRAMENTO.includes(r.tipo)) continue;
      let f = meses.get(r.mes);
      if (!f) {
        f = { mes: r.mes, ...CONTEO_VACIO, total: 0 };
        meses.set(r.mes, f);
      }
      f[r.tipo] += r.n;
      f.total += r.n;
    }
    const porTipo: ConteoPorTipo = { ...CONTEO_VACIO };
    for (const r of conteo) {
      if (TIPOS_SACRAMENTO.includes(r.tipo)) porTipo[r.tipo] = r.n;
    }
    const edades = new Map<EdadBucket, EdadFila>();
    for (const b of EDADES_BUCKETS) {
      edades.set(b, { bucket: b, BAUTISMO: 0, COMUNION: 0, CONFIRMACION: 0 });
    }
    for (const r of bautismos) {
      if (!esConEdad(r.tipo)) continue;
      const fila = edades.get(bucketEdad(edadAnios(r.fecha_nacimiento ?? "", r.fecha_sacramento)));
      if (fila) fila[r.tipo]++;
    }
    const matrimonios: DesgloseMatrimonios = { ...DESGLOSE_VACIO };
    for (const r of matris) {
      clasificarMatrimonio(
        {
          tipo: "MATRIMONIO",
          fecha_sacramento: "",
          libro: "",
          persona_id: null,
          esposo_baut_lugar: r.esposo_baut_lugar ?? "",
          esposo_baut_fecha: r.esposo_baut_fecha ?? "",
          esposo_baut_libro: r.esposo_baut_libro ?? "",
          esposo_baut_folio: r.esposo_baut_folio ?? "",
          esposa_baut_lugar: r.esposa_baut_lugar ?? "",
          esposa_baut_fecha: r.esposa_baut_fecha ?? "",
          esposa_baut_libro: r.esposa_baut_libro ?? "",
          esposa_baut_folio: r.esposa_baut_folio ?? "",
          esposo_no_baut: r.esposo_no_baut,
          esposa_no_baut: r.esposa_no_baut,
        },
        matrimonios
      );
    }
    return {
      desde,
      hasta,
      porTipo,
      total: porTipo.BAUTISMO + porTipo.COMUNION + porTipo.CONFIRMACION + porTipo.MATRIMONIO,
      porMes: [...meses.values()],
      edades: EDADES_BUCKETS.map((b) => edades.get(b)!),
      matrimonios,
    };
  }

  const personas = lsRead<Persona>(LS_KEYS.personas);
  const nacPorId = new Map<number, string>();
  for (const p of personas) {
    if (p.id != null) nacPorId.set(p.id, p.fecha_nacimiento ?? "");
  }
  const todas = lsRead<ActaPlana>(LS_KEYS.actas);
  return armarInforme(todas, nacPorId, desde, hasta);
}

/** Uso acumulado por libro (sin filtro de fechas: los libros se completan con los años). */
export async function usoLibros(): Promise<LibroUso[]> {
  await initDb();
  if (getMode() === "sqlite") {
    return sqlSelect<{ tipo: TipoSacramento; libro: string; n: number }[]>(
      `SELECT tipo, libro, COUNT(*) AS n FROM sacramentos
       GROUP BY tipo, libro ORDER BY tipo, LENGTH(libro), libro`
    ).then((rows) =>
      rows.map((r) => ({ tipo: r.tipo, libro: r.libro || "—", cantidad: r.n }))
    );
  }
  const mapa = new Map<string, LibroUso>();
  for (const a of lsRead<ActaPlana>(LS_KEYS.actas)) {
    if (!TIPOS_SACRAMENTO.includes(a.tipo)) continue;
    const libro = a.libro || "—";
    const k = `${a.tipo}||${libro}`;
    const e = mapa.get(k);
    if (e) e.cantidad++;
    else mapa.set(k, { tipo: a.tipo, libro, cantidad: 1 });
  }
  return [...mapa.values()].sort((x, y) =>
    x.tipo === y.tipo ? x.libro.localeCompare(y.libro, undefined, { numeric: true }) : x.tipo.localeCompare(y.tipo)
  );
}
