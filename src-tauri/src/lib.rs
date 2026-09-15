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

/// Muestra el diálogo de guardado, copia iglesia.db al destino y verifica
/// que el archivo quedó creado. Todo en un solo comando para evitar
/// idas y vueltas con el frontend.
#[tauri::command]
async fn resguardar_db(app: tauri::AppHandle, nombre: String) -> Result<ResguardoOk, String> {
    // 1. Ubicar la base (el plugin SQL la guarda en app_config_dir).
    let mut intentados: Vec<String> = Vec::new();
    let mut origen: Option<std::path::PathBuf> = None;
    for dir in [app.path().app_config_dir(), app.path().app_data_dir()] {
        match dir {
            Ok(d) => {
                let p = d.join("iglesia.db");
                intentados.push(p.display().to_string());
                if p.is_file() {
                    origen = Some(p);
                    break;
                }
            }
            Err(e) => intentados.push(format!("(carpeta no disponible: {e:?})")),
        }
    }
    let origen = origen.ok_or_else(|| {
        format!(
            "No se encontró iglesia.db. Buscado en: {}",
            intentados.join(" | ")
        )
    })?;

    // 2. Diálogo nativo de guardado (arranca en Documentos).
    let mut dialogo = app
        .dialog()
        .file()
        .add_filter("Base de datos", &["db"])
        .set_file_name(&nombre)
        .set_title("Guardar copia de seguridad");
    if let Ok(docs) = app.path().document_dir() {
        dialogo = dialogo.set_directory(docs);
    }
    let destino = dialogo
        .blocking_save_file()
        .and_then(|f| f.as_path().map(|p| p.to_path_buf()))
        .ok_or_else(|| "cancelado".to_string())?;

    // 3. Copiar y verificar que el archivo quedó creado y no vacío.
    if let Some(padre) = destino.parent() {
        if !padre.as_os_str().is_empty() {
            std::fs::create_dir_all(padre).map_err(|e| {
                format!(
                    "No se pudo crear la carpeta destino ({}): {e}",
                    padre.display()
                )
            })?;
        }
    }
    let bytes = std::fs::copy(&origen, &destino).map_err(|e| {
        format!(
            "No se pudo copiar de {} a {}: {e}",
            origen.display(),
            destino.display()
        )
    })?;
    let tam = std::fs::metadata(&destino)
        .map_err(|e| format!("La copia no quedó creada en {}: {e}", destino.display()))?
        .len();
    if tam == 0 {
        return Err(format!("La copia quedó vacía en {}", destino.display()));
    }
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
