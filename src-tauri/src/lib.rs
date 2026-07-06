mod csv_export;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

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

#[derive(Debug, Serialize, Deserialize)]
pub struct CsvImportResult {
    pub rows: Vec<Vec<String>>,
    pub has_header: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SettingsData {
    pub project_json: String,      // ProjectData のJSON文字列
    pub pane_widths: String,       // ペイン幅のJSON文字列
}

#[tauri::command]
fn export_csv(request: CsvExportRequest) -> Result<String, String> {
    let path = PathBuf::from(&request.path);

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
        _ => csv_text.into_bytes(),
    };

    fs::write(&path, &bytes).map_err(|e| format!("ファイル書き込みエラー: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

fn parse_csv_text(text: &str) -> Vec<Vec<String>> {
    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut current_row: Vec<String> = Vec::new();
    let mut current_field = String::new();
    let mut in_quotes = false;
    let mut chars = text.chars().peekable();

    while let Some(c) = chars.next() {
        if in_quotes {
            if c == '"' {
                if chars.peek() == Some(&'"') {
                    current_field.push('"');
                    chars.next();
                } else {
                    in_quotes = false;
                }
            } else {
                current_field.push(c);
            }
        } else {
            match c {
                '"' => in_quotes = true,
                ',' => {
                    current_row.push(std::mem::take(&mut current_field));
                }
                '\r' => {
                    if chars.peek() == Some(&'\n') {
                        chars.next();
                    }
                    current_row.push(std::mem::take(&mut current_field));
                    rows.push(std::mem::take(&mut current_row));
                }
                '\n' => {
                    current_row.push(std::mem::take(&mut current_field));
                    rows.push(std::mem::take(&mut current_row));
                }
                _ => current_field.push(c),
            }
        }
    }
    if !current_field.is_empty() || !current_row.is_empty() {
        current_row.push(current_field);
        rows.push(current_row);
    }
    rows
}

#[tauri::command]
fn import_csv(path: String) -> Result<CsvImportResult, String> {
    let bytes = fs::read(&path).map_err(|e| format!("ファイル読み込みエラー: {}", e))?;

    let text = if bytes.len() >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF {
        String::from_utf8_lossy(&bytes[3..]).to_string()
    } else {
        match String::from_utf8(bytes.clone()) {
            Ok(s) => s,
            Err(_) => {
                let (decoded, _, _) = encoding_rs::SHIFT_JIS.decode(&bytes);
                decoded.to_string()
            }
        }
    };

    let rows = parse_csv_text(&text);

    let has_header = if !rows.is_empty() {
        rows[0].iter().enumerate().all(|(i, cell)| {
            let trimmed = cell.trim();
            trimmed == format!("項目{}", i + 1)
                || (trimmed.starts_with("項目") && trimmed.len() > 2)
        })
    } else {
        false
    };

    Ok(CsvImportResult { rows, has_header })
}

#[tauri::command]
fn export_xlsx(request: CsvExportRequest) -> Result<String, String> {
    use rust_xlsxwriter::{Workbook, Format};

    let path = PathBuf::from(&request.path);
    let mut wb = Workbook::new();
    let sheet = wb.add_worksheet();

    // ヘッダ行を含めて書き込み
    let header_format = Format::new().set_bold();
    for (row_idx, row) in request.rows.iter().enumerate() {
        for (col_idx, cell) in row.cells.iter().enumerate() {
            if row_idx == 0 {
                sheet.write_with_format(row_idx as u32, col_idx as u16, cell, &header_format)
                    .map_err(|e| format!("xlsx書き込みエラー: {}", e))?;
            } else {
                sheet.write(row_idx as u32, col_idx as u16, cell)
                    .map_err(|e| format!("xlsx書き込みエラー: {}", e))?;
            }
        }
    }

    // 列幅を自動調整（大まかに）
    for col_idx in 0..request.rows.first().map(|r| r.cells.len()).unwrap_or(0) {
        sheet.set_column_width(col_idx as u16, 18)
            .map_err(|e| format!("xlsx列幅設定エラー: {}", e))?;
    }

    wb.save(&path).map_err(|e| format!("xlsx保存エラー: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn import_xlsx(path: String) -> Result<CsvImportResult, String> {
    use calamine::{Reader, open_workbook_auto, Data};

    eprintln!("[import_xlsx] path: {}", path);

    // ファイルの存在確認
    if !std::path::Path::new(&path).exists() {
        eprintln!("[import_xlsx] ファイルが存在しません");
        return Err("ファイルが存在しません".to_string());
    }

    let file_len = std::fs::metadata(&path).map_err(|e| format!("メタデータ取得エラー: {}", e))?.len();
    eprintln!("[import_xlsx] ファイルサイズ: {} bytes", file_len);

    let mut workbook = open_workbook_auto(&path)
        .map_err(|e| format!("xlsxファイル読み込みエラー: {}", e))?;

    // 最初のシートを取得
    let sheet_names = workbook.sheet_names();
    if sheet_names.is_empty() {
        return Err("シートが見つかりません".to_string());
    }
    let first_sheet = &sheet_names[0];

    let range = workbook.worksheet_range(first_sheet)
        .map_err(|e| format!("シート読み込みエラー: {}", e))?;

        // 全セルをそのまま読み込む（空セルも保持）
    // 列数は range.width() から直接取得する
    let max_cols = range.width();
    let mut rows: Vec<Vec<String>> = Vec::new();

    for row in range.rows() {
        let mut cells: Vec<String> = row.iter().map(|cell| match cell {
            Data::String(s) => s.trim().to_string(),
            Data::Int(i) => i.to_string(),
            Data::Float(f) => {
                if *f == f.trunc() {
                    format!("{}", *f as i64)
                } else {
                    format!("{}", f)
                }
            }
            Data::Bool(b) => b.to_string(),
            Data::DateTime(dt) => dt.to_string(),
            Data::DateTimeIso(s) => s.clone(),
            Data::DurationIso(s) => s.clone(),
            Data::Error(e) => format!("{:?}", e),
            Data::Empty => String::new(),
        }).collect();

        // 各セルの末尾の空白も除去
        for cell in cells.iter_mut() {
            *cell = cell.trim().to_string();
        }

        // 全セル空の行はスキップ
        let all_empty = cells.iter().all(|c| c.is_empty());
        if all_empty {
            continue;
        }

        // 列数を max_cols に統一（不足分は空文字でパディング）
        while cells.len() < max_cols {
            cells.push(String::new());
        }

        rows.push(cells);
    }

    let has_header = if !rows.is_empty() {
        rows[0].iter().enumerate().all(|(i, cell)| {
            let trimmed = cell.trim();
            trimmed == format!("項目{}", i + 1)
                || (trimmed.starts_with("項目") && trimmed.len() > 2)
        })
    } else {
        false
    };

    eprintln!("[import_xlsx] has_header: {}", has_header);

    Ok(CsvImportResult { rows, has_header })
}

#[tauri::command]
fn save_settings(project_json: String, pane_widths: String) -> Result<String, String> {
    let data = SettingsData {
        project_json,
        pane_widths,
    };
    let json = serde_json::to_string(&data).map_err(|e| format!("シリアライズエラー: {}", e))?;
    let dir = dirs_next::data_dir()
        .ok_or_else(|| "データディレクトリが見つかりません".to_string())?
        .join("marufuda-csv-studio");
    fs::create_dir_all(&dir).map_err(|e| format!("ディレクトリ作成エラー: {}", e))?;
    let path = dir.join("settings.json");
    fs::write(&path, &json).map_err(|e| format!("設定ファイル書き込みエラー: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn load_settings() -> Result<SettingsData, String> {
    let dir = dirs_next::data_dir()
        .ok_or_else(|| "データディレクトリが見つかりません".to_string())?
        .join("marufuda-csv-studio");
    let path = dir.join("settings.json");
    if !path.exists() {
        return Err("設定ファイルがありません".to_string());
    }
    let json = fs::read_to_string(&path).map_err(|e| format!("設定ファイル読み込みエラー: {}", e))?;
    let data: SettingsData = serde_json::from_str(&json).map_err(|e| format!("設定ファイルパースエラー: {}", e))?;
    Ok(data)
}

#[tauri::command]
fn save_history(name: String, project_json: String) -> Result<String, String> {
    let dir = dirs_next::data_dir()
        .ok_or_else(|| "データディレクトリが見つかりません".to_string())?
        .join("marufuda-csv-studio")
        .join("history");
    fs::create_dir_all(&dir).map_err(|e| format!("履歴ディレクトリ作成エラー: {}", e))?;
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");
    let filename = format!("{}_{}.json", timestamp, if safe_name.is_empty() { "unnamed" } else { &safe_name });
    let path = dir.join(&filename);
    // メタデータ付きで保存
    let entry = serde_json::json!({
        "name": name,
        "timestamp": timestamp,
        "project_json": project_json,
    });
    fs::write(&path, serde_json::to_string_pretty(&entry).unwrap())
        .map_err(|e| format!("履歴書き込みエラー: {}", e))?;
    Ok(filename)
}

#[tauri::command]
fn load_history_list() -> Result<Vec<serde_json::Value>, String> {
    let dir = dirs_next::data_dir()
        .ok_or_else(|| "データディレクトリが見つかりません".to_string())?
        .join("marufuda-csv-studio")
        .join("history");
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut entries: Vec<serde_json::Value> = Vec::new();
    let mut read_dir = fs::read_dir(&dir).map_err(|e| format!("履歴ディレクトリ読み込みエラー: {}", e))?;
    while let Some(entry) = read_dir.next().transpose().map_err(|e| format!("エントリ読み込みエラー: {}", e))? {
        let path = entry.path();
        if path.extension().map(|e| e == "json").unwrap_or(false) {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(mut val) = serde_json::from_str::<serde_json::Value>(&content) {
                    // ファイル名を JSON に含める（フロントエンドの削除処理で使用）
                    if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                        val["filename"] = serde_json::Value::String(filename.to_string());
                    }
                    entries.push(val);
                }
            }
        }
    }
    // タイムスタンプ降順にソート
    entries.sort_by(|a, b| {
        let ta = a["timestamp"].as_str().unwrap_or("");
        let tb = b["timestamp"].as_str().unwrap_or("");
        tb.cmp(ta)
    });
    Ok(entries)
}

#[tauri::command]
fn delete_history(filename: String) -> Result<(), String> {
    let dir = dirs_next::data_dir()
        .ok_or_else(|| "データディレクトリが見つかりません".to_string())?
        .join("marufuda-csv-studio")
        .join("history");
    let path = dir.join(&filename);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("履歴削除エラー: {}", e))?;
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            export_csv, import_csv, export_xlsx, import_xlsx,
            save_settings, load_settings, save_history, load_history_list, delete_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
