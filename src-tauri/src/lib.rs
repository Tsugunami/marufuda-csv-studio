mod csv_export;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct CsvRow {
    pub cells: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CsvExportRequest {
    pub rows: Vec<CsvRow>,
    pub encoding: String, // "shift_jis" | "utf8" | "utf8_bom"
    pub path: String,
}

#[tauri::command]
fn export_csv(request: CsvExportRequest) -> Result<String, String> {
    let path = PathBuf::from(&request.path);

    // CSV文字列を構築
    let mut csv_text = String::new();
    for (i, row) in request.rows.iter().enumerate() {
        if i > 0 {
            csv_text.push_str("\r\n");
        }
        let line: Vec<String> = row
            .cells
            .iter()
            .map(|c| csv_export::escape_csv_field(c))
            .collect();
        csv_text.push_str(&line.join(","));
    }
    csv_text.push_str("\r\n");

    // エンコーディング変換して書き込み
    let bytes = match request.encoding.as_str() {
        "shift_jis" => {
            let (encoded, _, _) = encoding_rs::SHIFT_JIS.encode(&csv_text);
            encoded.into_owned()
        }
        "utf8_bom" => {
            let mut bytes = vec![0xEF, 0xBB, 0xBF];
            bytes.extend_from_slice(csv_text.as_bytes());
            bytes
        }
        _ => csv_text.into_bytes(), // utf8
    };

    fs::write(&path, &bytes).map_err(|e| format!("ファイル書き込みエラー: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![export_csv])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
