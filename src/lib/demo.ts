import {
  PERSONA_VACIA,
  crearActa,
  crearLibro,
  listActas,
  type Persona,
  type SacramentoInput,
} from "./db";

const P = (sobre: Partial<Persona>): Persona => ({ ...PERSONA_VACIA, ...sobre });

/** Siembra un acta de cada sacramento (solo desarrollo, sin datos previos). */
export async function sembrarDemo(): Promise<number> {
  const existentes = await listActas({ texto: "", tipo: "TODOS", fecha: "" });
  if (existentes.length > 0) {
    throw new Error("Ya hay actas cargadas. Borralas si querés recargar la demo.");
  }

  // Las actas demo exigen libros registrados: se siembran primero.
  await crearLibro("BAUTISMO", "12", 200);
  await crearLibro("COMUNION", "4", 200);
  await crearLibro("CONFIRMACION", "6", 200);
  await crearLibro("MATRIMONIO", "3", 200);

  const base: Pick<
    SacramentoInput,
    | "ministro_celebrante"
    | "parroquia_capilla"
    | "notas_marginales"
    | "padrino"
    | "madrina"
    | "bautizado_en_parroquia"
    | "domicilio_matrimonial"
    | "referencia_folios"
  > = {
    ministro_celebrante: "",
    parroquia_capilla: "María Auxiliadora",
    notas_marginales: "",
    padrino: "",
    madrina: "",
    bautizado_en_parroquia: "",
    domicilio_matrimonial: "",
    referencia_folios: "",
  };
  const vacioBaut = {
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
    conf_padrino_sel: "" as const,
  };

  const bautismo: SacramentoInput = {
    ...base,
    ...vacioBaut,
    tipo: "BAUTISMO",
    persona: P({
      apellido_nombres: "Benítez, Thiago Ezequiel",
      documento: "55123456",
      fecha_nacimiento: "2023-04-12",
      lugar_nacimiento: "Garupá",
      domicilio: "Av. Las Américas 1234, Garupá",
      nombre_padre: "Benítez, Ramón Antonio",
      nombre_madre: "Ferreira, Lucía Mabel",
    }),
    esposo: { ...PERSONA_VACIA },
    esposa: { ...PERSONA_VACIA },
    fecha_sacramento: "2023-07-09",
    ministro_celebrante: "Pbro. Juan Carlos Méndez",
    libro: "12",
    folio: "45",
    padrino: "Cabrera, Miguel Ángel",
    madrina: "López, María Esther",
  };

  const comunion: SacramentoInput = {
    ...base,
    ...vacioBaut,
    tipo: "COMUNION",
    persona: P({
      apellido_nombres: "Ferreira, Lucía Micaela",
      documento: "58234567",
      fecha_nacimiento: "2015-02-20",
      lugar_nacimiento: "Posadas",
      domicilio: "Isolina Gallardo 567, Garupá",
      nombre_padre: "Ferreira, Pedro Ramón",
      nombre_madre: "Gómez, Ana Beatriz",
    }),
    esposo: { ...PERSONA_VACIA },
    esposa: { ...PERSONA_VACIA },
    fecha_sacramento: "2024-10-13",
    ministro_celebrante: "Pbro. Juan Carlos Méndez",
    libro: "4",
    folio: "18",
  };

  const confirmacion: SacramentoInput = {
    ...base,
    ...vacioBaut,
    tipo: "CONFIRMACION",
    persona: P({
      apellido_nombres: "Da Silva, Mateo Alejandro",
      documento: "50987654",
      fecha_nacimiento: "2009-11-03",
      lugar_nacimiento: "Garupá",
      domicilio: "Barrio Centro, Garupá",
      nombre_padre: "Da Silva, Carlos Eduardo",
      nombre_madre: "Pereira, Rosa Mabel",
    }),
    esposo: { ...PERSONA_VACIA },
    esposa: { ...PERSONA_VACIA },
    fecha_sacramento: "2024-11-24",
    ministro_celebrante: "Mons. Juan Rubén Martínez",
    libro: "6",
    folio: "72",
    conf_baut_lugar: "María Auxiliadora, Garupá",
    conf_baut_fecha: "2010-03-14",
    conf_baut_libro: "9",
    conf_baut_folio: "31",
    padrino: "Alvez, Ramón Antonio",
    madrina: "Sosa, Marta Elena",
    conf_padrino_sel: "PADRINO",
  };

  const matrimonio: SacramentoInput = {
    ...base,
    ...vacioBaut,
    tipo: "MATRIMONIO",
    persona: { ...PERSONA_VACIA },
    esposo: P({
      apellido_nombres: "Cabrera, Ramón Antonio",
      documento: "30123456",
      fecha_nacimiento: "1983-06-15",
      lugar_nacimiento: "Posadas",
      domicilio: "Rivadavia 890, Garupá",
      nombre_padre: "Cabrera, Antonio",
      nombre_madre: "Sosa, Teresa",
    }),
    esposa: P({
      apellido_nombres: "López, María Esther",
      documento: "32567890",
      fecha_nacimiento: "1986-09-28",
      lugar_nacimiento: "Garupá",
      domicilio: "Rivadavia 890, Garupá",
      nombre_padre: "López, José María",
      nombre_madre: "Acosta, Blanca",
    }),
    fecha_sacramento: "2024-12-07",
    ministro_celebrante: "Pbro. Juan Carlos Méndez",
    libro: "3",
    folio: "96",
    esposo_baut_lugar: "Catedral San José, Posadas",
    esposo_baut_fecha: "1983-08-21",
    esposo_baut_libro: "22",
    esposo_baut_folio: "140",
    esposa_baut_lugar: "María Auxiliadora, Garupá",
    esposa_baut_fecha: "1986-11-02",
    esposa_baut_libro: "5",
    esposa_baut_folio: "88",
    padrino: "Benítez, Miguel Ángel",
    madrina: "Ferreira, Ana Beatriz",
    domicilio_matrimonial: "Rivadavia 890, Garupá",
    referencia_folios: "12",
  };

  const confesion: SacramentoInput = {
    ...base,
    ...vacioBaut,
    tipo: "CONFESION",
    persona: P({
      apellido_nombres: "Gómez, Santiago Andrés",
      documento: "57345678",
      fecha_nacimiento: "2016-05-30",
      lugar_nacimiento: "Garupá",
      domicilio: "Barrio Santa Cruz, Garupá",
      nombre_padre: "Gómez, Andrés Ramón",
      nombre_madre: "Silva, Carmen Beatriz",
    }),
    esposo: { ...PERSONA_VACIA },
    esposa: { ...PERSONA_VACIA },
    fecha_sacramento: "2025-09-12",
    ministro_celebrante: "Pbro. Juan Carlos Méndez",
    libro: "",
    folio: "",
  };

  for (const acta of [bautismo, comunion, confirmacion, matrimonio, confesion]) {
    await crearActa(acta);
  }
  return 5;
}
