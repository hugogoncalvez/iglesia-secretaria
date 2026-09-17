# Memoria del proyecto — Secretaría Iglesia

- Estado: EN DESARROLLO. La BD final está VACÍA, sin cargas reales. Se puede cambiar esquema/libremente sin migraciones de datos históricos.
- Cliente: Obispado de Posadas. Planilla modelo: `Datos Estadísticos-2025-Planilla.pdf`.
- PDF de estadísticas actual (`src/components/Estadisticas.tsx` `InformeDoc`) es informe interno, NO la planilla oficial. Pendiente: nuevo PDF réplica de la planilla + inputs manuales (catequistas, misioneros, hogar, capillas).
- Matrimonios planilla 2a/2b: se infiere de `esposo_baut_*` / `esposa_baut_*` + flags `esposo_no_baut` / `esposa_no_baut` (checkbox "No bautizado" en el form). Vacío sin tilde = "sin dato" (aviso en pantalla, no entra en 2a/2b).
- Planilla Obispado: `PlanillaDoc` en `Estadisticas.tsx` (réplica hoja oficial) + `DatosObispado` manual 5–8 guardado por año en `localStorage` (`iglesia_obispado_AAAA`). Botón "Planilla Obispado". El informe interno (`InformeDoc`) se mantiene.
- Descargas PDF (informes + certificado): NO usar `PDFDownloadLink` (el WebView de Tauri ignora descargas blob). Usar `pdf(doc).toBlob()` + descarga directa en web / diálogo "Guardar como" + `writeFile` en instalada. Botón CSV oculto (`{false && ...}` en `Estadisticas.tsx`), código intacto.
