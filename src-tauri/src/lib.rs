// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::Serialize;
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[derive(Serialize)]
struct ResguardoOk {
    ruta: String,
    bytes: u64,
}

/// Agrega una línea al log de resguardos (best-effort, nunca falla).
/// Archivo: %APPDATA%\com.iglesia.secretaria\resguardo.log
fn log_resguardo(app: &tauri::AppHandle, linea: &str) {
    let Ok(dir) = app.path().app_data_dir() else {
        return;
    };
    let _ = std::fs::create_dir_all(&dir);
    let p = dir.join("resguardo.log");
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&p) {
        use std::io::Write;
        let _ = writeln!(f, "[{:?}] {linea}", std::time::SystemTime::now());
    }
}

/// Muestra el diálogo de guardado, copia iglesia.db al destino y verifica
/// que el archivo quedó creado. Todo en un solo comando para evitar
/// idas y vueltas con el frontend.
#[tauri::command]
async fn resguardar_db(
    app: tauri::AppHandle,
    nombre: String,
    origen: Option<String>,
) -> Result<ResguardoOk, String> {
    log_resguardo(&app, "inicio resguardo");
    // 1. Ubicar la base: primero la ruta exacta que informa SQLite
    // (PRAGMA database_list), si no, las carpetas conocidas.
    let mut intentados: Vec<String> = Vec::new();
    let mut encontrado: Option<std::path::PathBuf> = None;
    if let Some(o) = origen {
        if !o.trim().is_empty() {
            intentados.push(format!("{o} (ruta de SQLite)"));
            let p = std::path::PathBuf::from(&o);
            if p.is_file() {
                encontrado = Some(p);
            }
        }
    }
    if encontrado.is_none() {
        for dir in [
            app.path().app_config_dir(),
            app.path().app_data_dir(),
            app.path().app_local_data_dir(),
        ] {
            match dir {
                Ok(d) => {
                    let p = d.join("iglesia.db");
                    intentados.push(p.display().to_string());
                    if p.is_file() {
                        encontrado = Some(p);
                        break;
                    }
                }
                Err(e) => intentados.push(format!("(carpeta no disponible: {e:?})")),
            }
        }
    }
    let Some(origen) = encontrado else {
        let m = format!("No se encontró iglesia.db. Buscado en: {}", intentados.join(" | "));
        log_resguardo(&app, &format!("ERROR origen: {m}"));
        return Err(m);
    };
    log_resguardo(&app, &format!("origen: {}", origen.display()));

    // 2. Diálogo nativo de guardado EN EL HILO PRINCIPAL (los diálogos
    // bloqueantes fuera de él se cuelgan en algunos Windows).
    let (tx, rx) = std::sync::mpsc::channel();
    let app2 = app.clone();
    let docs = app.path().document_dir().ok();
    let run = app.run_on_main_thread(move || {
        let mut dialogo = app2
            .dialog()
            .file()
            .add_filter("Base de datos", &["db"])
            .set_file_name(&nombre)
            .set_title("Guardar copia de seguridad");
        if let Some(d) = docs {
            dialogo = dialogo.set_directory(d);
        }
        dialogo.save_file(move |fp| {
            let _ = tx.send(fp.and_then(|f| f.as_path().map(|p| p.to_path_buf())));
        });
    });
    if let Err(e) = run {
        let m = format!("No se pudo abrir el diálogo de guardado: {e}");
        log_resguardo(&app, &format!("ERROR dialogo: {m}"));
        return Err(m);
    }
    log_resguardo(&app, "dialogo mostrado, esperando respuesta");
    let destino = match rx.recv() {
        Err(e) => {
            let m = format!("Diálogo interrumpido: {e}");
            log_resguardo(&app, &format!("ERROR dialogo: {m}"));
            return Err(m);
        }
        Ok(None) => {
            log_resguardo(&app, "dialogo: cancelado por el usuario");
            return Err("cancelado".to_string());
        }
        Ok(Some(d)) => d,
    };
    log_resguardo(&app, &format!("dialogo destino: {}", destino.display()));

    // 3. Copiar y verificar que el archivo quedó creado y no vacío.
    if let Some(padre) = destino.parent() {
        if !padre.as_os_str().is_empty() {
            if let Err(e) = std::fs::create_dir_all(padre) {
                let m = format!("No se pudo crear la carpeta destino ({}): {e}", padre.display());
                log_resguardo(&app, &format!("ERROR carpeta: {m}"));
                return Err(m);
            }
        }
    }
    let bytes = match std::fs::copy(&origen, &destino) {
        Err(e) => {
            let m = format!("No se pudo copiar de {} a {}: {e}", origen.display(), destino.display());
            log_resguardo(&app, &format!("ERROR copia: {m}"));
            return Err(m);
        }
        Ok(b) => b,
    };
    let tam = match std::fs::metadata(&destino) {
        Err(e) => {
            let m = format!("La copia no quedó creada en {}: {e}", destino.display());
            log_resguardo(&app, &format!("ERROR verifica: {m}"));
            return Err(m);
        }
        Ok(mt) => mt.len(),
    };
    if tam == 0 {
        let m = format!("La copia quedó vacía en {}", destino.display());
        log_resguardo(&app, &format!("ERROR vacia: {m}"));
        return Err(m);
    }
    log_resguardo(&app, &format!("ok: {} ({} bytes)", destino.display(), bytes));
    Ok(ResguardoOk {
        ruta: destino.display().to_string(),
        bytes,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, resguardar_db])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
