# Plan — Registro de libros de actas (IMPLEMENTADO, primera aproximación)

> Simplificación acordada: la sección es solo alta de libros
> (Tipo + N° + Hojas). Sin precargas, sin año de inicio, sin notas,
> sin actas por hoja. Tipos: Bautismo, Casamiento, Confirmación y Comunión.

## Contexto

- La parroquia tiene **3 libros físicos** comprados por ellos e **intervenidos por el Obispado**
  (firmados y sellados por la curia antes de usar). Falta que la secretaria pase por cada uno:
  sacramento, N° de libro, cantidad de hojas y actas por hoja.
- La secretaria **es técnica y capaz**: se le puede pedir carga ordenada.
- El histórico a cargar es de **~1 año, poco volumen**. La tabla de actas se ordena por
  **fecha del sacramento**, así que la carga histórica no se mezcla con la actual.
- BD final **vacía, en desarrollo**: se puede crear el esquema sin migraciones de datos reales.

## Objetivo

Solo valen los libros registrados en el sistema. El form de actas exige elegir un libro
registrado y **abierto**; el "Estado de libros" muestra capacidad real por libro
(hojas × actas por hoja) en vez de un número global.
**Sin libros cargados, el sistema no deja guardar sacramentos con libro**
(Bautismo, Matrimonio, Confirmación). **Exentas**: Primera Confesión y Comunión,
que no tienen libro físico.

## 1. Modelo de datos — `LibroFisico`

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | autoincrement | — |
| `tipo` | BAUTISMO / COMUNION / CONFIRMACION / MATRIMONIO | obligatorio |
| `numero` | texto (ej. "3") | obligatorio, **único por tipo** (normalizar: sin ceros a la izquierda) |
| `hojas` | entero > 0 | obligatorio |
| `actas_por_hoja` | entero > 0 | obligatorio |
| `capacidad` | entero | calculada (hojas × actas_por_hoja), editable como excepción |
| `anio_inicio` | entero, opcional | año en que se empezó a usar |
| `estado` | `en_uso` / `cerrado` | default `en_uso` |
| `notas` | texto libre, opcional | ej. "Intervenido por curia 03/2024" |

- **SQLite**: nueva tabla `libros` (modo instalada).
- **Modo local/web**: `localStorage` clave `iglesia_libros`.
- **Resguardo/restauración**: incluir `libros` en `dumpLocalJSON`, `restore.ts` y `migrarLocalASqlite`.
- **Borrado**: prohibido si el libro tiene actas; en su lugar se **cierra** (estado `cerrado`).

## 2. Configuración — sección "Libros de actas"

- Tabla con altas, edición y cierre de libros + validaciones (único por tipo, hojas > 0,
  actas_por_hoja > 0, capacidad > 0).
- Orden sugerido de trabajo para la secretaria:
  1. Registrar los 3 libros con los datos reales (apenas los pase).
  2. Recién después, cargar las actas (históricas primero, con su fecha real).

## 3. Form de actas — Libro como lista + bloqueo

- El campo **Libro (texto libre) pasa a ser una lista** filtrada por sacramento y estado:
  solo libros `en_uso` del tipo del acta.
- **Bloqueo al guardar**: si el tipo lleva libro (BAUTISMO, MATRIMONIO, CONFIRMACION)
  y no hay ningún libro registrado y abierto de ese tipo, **no se puede guardar** el acta.
  Mensaje claro: "Registrá el libro en Configuración → Libros de actas".
- **Exentas del bloqueo**: CONFESION y COMUNION (sin libro físico; Confesión ya guarda
  Libro/Folio vacíos).
- **Folio** sigue libre, pero con aviso si supera las **hojas** del libro elegido
  (el folio es el N° de hoja: las 2 actas de la misma página comparten folio).
- **Folios usados automáticos**: cada acta guardada con libro + folio marca ese folio
  como usado, sin tildar nada a mano. Vale igual para la carga histórica (cualquier orden).
  El folio repetido cuenta una sola vez (2 actas por hoja es normal, no se protesta).
- Al crear un acta nueva, el sistema **sugiere el siguiente folio libre**.
- Actas demo (`demo.ts`): registrar sus libros o sembrar libros demo equivalentes.

## 4. Carga histórica (~1 año)

1. Registrar los 3 libros.
2. Cargar actas con **fecha del sacramento real** (el orden por fecha evita mezclas).
3. Verificar en Estadísticas → Estado de libros que el uso coincide con el avance real
   de cada libro físico.

## 5. Estadísticas — Estado de libros

- Fuente: el **registro** (muestra todos los libros, incluso con 0 actas), no solo los que
  aparecen en actas.
- Columnas: Libro, Sacramento, Usadas / Capacidad, Estado, barra (verde / ámbar ≥ 80% /
  rojo lleno o superado).
- El avance sale de los **folios usados detectados solos** (último folio ocupado,
  siguiente libre sugerido, huecos por folios salteados/anulados).
- La **capacidad global** actual (`iglesia_capacidad_libro`) queda solo como fallback
  transitorio y luego se elimina.
- Aviso "libro sin registrar" deja de existir (ya no puede pasar).

## 6. Casos borde

- Libro que se llena → se cierra y se registra el continuador (mismo tipo, N° nuevo).
- Acta vieja en libro histórico fuera de los 3 actuales → se registra ese libro como
  `cerrado` (conserva la referencia Libro/Folio sin permitir actas nuevas).
- Libro de difuntos: fuera de alcance (no es sacramento); si lo piden, módulo aparte.
- Números con distinto formato ("3" vs "03"): normalizar al guardar y al comparar.

## 7. Criterios de aceptación

- [x] Sin libro registrado y abierto del tipo, no se puede guardar el acta (salvo
  Confesión, exenta; Comunión lleva libro si se registra uno de ese tipo).
- [x] No se puede borrar un libro con actas (solo cerrar).
- [x] Estado de libros muestra los libros del registro con folios usados / hojas.
- [x] El folio de cada acta cargada aparece como usado sin acción manual; el alta
  nueva sugiere el siguiente folio libre (autocompleta si el folio está vacío).
- [x] Resguardo/restauración incluye los libros y no rompe copias viejas (sin tabla = lista vacía).
- [x] `tsc` + `pnpm build` verdes; funciona en web e instalada.
- [ ] Probar en instalada: alta de los 3 libros reales + carga de un acta.

## 8. Datos pendientes (secretaria)

Recibido 18/09/2026 (fotos en la raíz del repo). Los 3 libros arrancaron en **2025**.

- [x] **Libro Matrimonio**: 500 hojas × 2 actas por hoja = **capacidad 1000**.
  Foto `WhatsApp Image 2026-09-18 at 18.23.09.jpeg` (página 3, se ven las 2 actas).
  Falta: N° de libro, año de inicio.
- [x] **Libro Bautismo**: 500 hojas × 2 actas por hoja = **capacidad 1000** ("lo mismo").
  Foto `WhatsApp Image 2026-09-18 at 18.24.00.jpeg` (página 91, se ven las 2 actas;
  lo de "Confirmación/Matrimonio" que se ve a la izquierda son secciones de notas
  marginales dentro del propio libro de Bautismo, no libros aparte).
  Falta: N° de libro, año de inicio.
- [ ] **Libro Confirmación**: pendiente — N°, hojas, actas por hoja, año inicio
  (se asume 2025 como los otros).
- [ ] ¿Hay libros históricos cerrados con actas que también haya que registrar?
