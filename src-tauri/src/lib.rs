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

#[derive(Debug, Serialize, Deserialize)]
pub struct CsvImportResult {
    pub rows: Vec<Vec<String>>,
    pub has_header: bool,
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

    let mut rows: Vec<Vec<String>> = Vec::new();
    for row in range.rows() {
        let cells: Vec<String> = row.iter().map(|cell| {
            match cell {
                Data::String(s) => s.clone(),
                Data::Int(i) => i.to_string(),
                Data::Float(f) => {
                    // 整数の場合は小数点以下を表示しない
                    if *f == f.trunc() {
                        format!("{}", *f as i64)
                    } else {
                        format!("{}", f)
                    }
                }
                Data::Bool(b) => b.to_string(),
                Data::DateTime(dt) => dt.to_string(),
                Data::Error(e) => format!("{:?}", e),
                Data::Empty => String::new(),
                _ => String::new(),
            }
        }).collect();
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

    Ok(CsvImportResult { rows, has_header })
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![export_csv, import_csv, export_xlsx, import_xlsx])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
