// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Copia el archivo iglesia.db (SQLite local) al destino elegido.
/// Devuelve la cantidad de bytes copiados.
/// El plugin SQL guarda el archivo en app_config_dir (no en app_data_dir),
/// así que se busca en ambas ubicaciones para que funcione en Windows/Linux/macOS.
#[tauri::command]
fn backup_db(app: tauri::AppHandle, destino: String) -> Result<u64, String> {
    let mut intentados: Vec<String> = Vec::new();
    let mut origen_encontrado: Option<std::path::PathBuf> = None;

    for dir in [app.path().app_config_dir(), app.path().app_data_dir()] {
        match dir {
            Ok(d) => {
                let p = d.join("iglesia.db");
                intentados.push(p.display().to_string());
                if p.is_file() {
                    origen_encontrado = Some(p);
                    break;
                }
            }
            Err(e) => intentados.push(format!("(no se pudo ubicar carpeta: {e:?})")),
        }
    }

    let origen = origen_encontrado.ok_or_else(|| {
        format!(
            "No se encontró iglesia.db. Buscado en: {}",
            intentados.join(" | ")
        )
    })?;

    if let Some(padre) = std::path::Path::new(&destino).parent() {
        if !padre.as_os_str().is_empty() {
            std::fs::create_dir_all(padre).map_err(|e| {
                format!("No se pudo crear la carpeta destino ({}): {e}", padre.display())
            })?;
        }
    }

    std::fs::copy(&origen, &destino).map_err(|e| {
        format!(
            "No se pudo copiar de {} a {}: {e}",
            origen.display(),
            destino
        )
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, backup_db])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
