// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Copia el archivo iglesia.db (SQLite local) al destino elegido.
/// Devuelve la cantidad de bytes copiados.
#[tauri::command]
fn backup_db(app: tauri::AppHandle, destino: String) -> Result<u64, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No se pudo ubicar la carpeta de datos: {e:?}"))?;
    let origen = dir.join("iglesia.db");
    std::fs::copy(&origen, &destino).map_err(|e| format!("No se pudo copiar la base de datos: {e}"))
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
