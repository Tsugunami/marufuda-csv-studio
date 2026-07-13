use serde::Serialize;
use std::io::Write;

/// ラベル屋さんテンプレート情報
#[derive(Debug, Clone)]
pub struct AlymTemplate {
    pub format_code: &'static str,
    pub product_code: &'static str,
    pub product_name: &'static str,
    pub product_id: u32,
    pub label_width_mm: f64,
    pub label_height_mm: f64,
    pub left_margin: f64,
    pub top_margin: f64,
    pub horizontal_padding: f64,
    pub vertical_padding: f64,
    pub cols: u32,
    pub rows: u32,
    pub corner_radius: f64,
}

/// 5つのフォーマットに対応するテンプレート定義
pub fn get_template_by_grid(cols: u32, rows: u32) -> Option<&'static AlymTemplate> {
    match (cols, rows) {
        (5, 8) => Some(&TEMPLATE_40),
        (7, 10) => Some(&TEMPLATE_70),
        (5, 19) => Some(&TEMPLATE_95),
        (5, 25) => Some(&TEMPLATE_125),
        (8, 25) => Some(&TEMPLATE_200),
        _ => None,
    }
}

const TEMPLATE_40: AlymTemplate = AlymTemplate {
    format_code: "F40A4-1",
    product_code: "31553",
    product_name: "A4 40面 四辺余白付 角丸",
    product_id: 186,
    label_width_mm: 30.0,
    label_height_mm: 30.0,
    left_margin: 13.5,
    top_margin: 16.5,
    horizontal_padding: 2.0,
    vertical_padding: 2.0,
    cols: 5,
    rows: 8,
    corner_radius: 2.0,
};

const TEMPLATE_70: AlymTemplate = AlymTemplate {
    format_code: "F70A4-1",
    product_code: "31555",
    product_name: "A4判 70面 四辺余白付 角丸",
    product_id: 568,
    label_width_mm: 20.0,
    label_height_mm: 20.0,
    left_margin: 23.0,
    top_margin: 30.5,
    horizontal_padding: 4.0,
    vertical_padding: 4.0,
    cols: 7,
    rows: 10,
    corner_radius: 2.0,
};

const TEMPLATE_95: AlymTemplate = AlymTemplate {
    format_code: "F95A4-1",
    product_code: "28790",
    product_name: "A4 95面 四辺余白付角丸",
    product_id: 186,
    label_width_mm: 35.0,
    label_height_mm: 12.0,
    left_margin: 13.5,
    top_margin: 16.5,
    horizontal_padding: 2.0,
    vertical_padding: 2.0,
    cols: 5,
    rows: 19,
    corner_radius: 2.0,
};

const TEMPLATE_125: AlymTemplate = AlymTemplate {
    format_code: "F125A4-1",
    product_code: "72125",
    product_name: "A4 125面 四辺余白付 角丸",
    product_id: 186,
    label_width_mm: 35.0,
    label_height_mm: 8.0,
    left_margin: 13.5,
    top_margin: 16.5,
    horizontal_padding: 2.0,
    vertical_padding: 2.0,
    cols: 5,
    rows: 25,
    corner_radius: 2.0,
};

const TEMPLATE_200: AlymTemplate = AlymTemplate {
    format_code: "F200A4-1",
    product_code: "72200",
    product_name: "A4 200面 四辺余白付 角丸",
    product_id: 186,
    label_width_mm: 20.0,
    label_height_mm: 8.0,
    left_margin: 13.5,
    top_margin: 16.5,
    horizontal_padding: 2.0,
    vertical_padding: 2.0,
    cols: 8,
    rows: 25,
    corner_radius: 2.0,
};

/// フォントサイズを計算（行高さに対して隙間なく最大化）
fn calc_font_size(label_height_mm: f64, items_per_label: u32) -> f64 {
    let row_height = label_height_mm / items_per_label as f64;
    // 行高の85%をフォントサイズ（pt）として計算、1pt≈0.3528mm
    let pt = row_height * 0.85 / 0.3528;
    // 小数点以下1桁で丸め、最小4pt、最大20pt
    (pt * 10.0).round() / 10.0
}

/// テキストレイヤー1つ分のJSONを生成（元テンプレートに合わせ autoSize=false, 隙間なし）
fn make_text_layer(
    index: u32,
    text: &str,
    items_per_label: u32,
    label_width: f64,
    label_height: f64,
    font_size: f64,
) -> serde_json::Value {
    let row_height = label_height / items_per_label as f64;
    let object_width = label_width - 0.66 * 2.0; // 元テンプレと同等の左右余白
    let object_height = row_height; // 隙間なし（= 行高全体）
    let object_y = index as f64 * row_height; // 上端から隙間なく配置

    serde_json::json!({
        "autoSize": false,
        "autoNewLine": false,
        "lineSpacing": 120,
        "textOrientation": 0,
        "horizontalAlignment": 1,
        "verticalAlignment": 0,
        "prefix": "",
        "suffix": "",
        "profileKey": "",
        "baseTextInfo": {
            "fontId": "noto-sans-jp-400",
            "fontSize": font_size,
            "textColor": { "r": 0, "g": 0, "b": 0 },
            "letterSpacing": 0,
            "bold": false,
            "italic": false,
            "underline": false,
            "letterWidth": 100,
            "isHorizontalInVertical": false,
            "isEmQuad": false,
            "isShadow": false,
            "shadowColor": { "r": 102, "g": 102, "b": 102 },
            "shadowDistance": 10,
            "shadowRotate": 45,
            "shadowBlur": 50,
            "shadowIntensity": 50,
            "isOutline": false,
            "outlineColor": { "r": 255, "g": 102, "b": 0 },
            "outlineThickness": 50,
            "outlineIntensity": 50
        },
        "autoFontSize": font_size,
        "autoLineText": "",
        "text": text,
        "opacity": 100,
        "objectX": 0.66,
        "objectY": object_y,
        "objectWidth": object_width,
        "objectHeight": object_height,
        "objectRotate": 0,
        "layerType": "simpleText",
        "id": format!("text-{:08x}", index),
        "insertionId": format!("ins-{:08x}", index),
        "name": "通常文字_1",
        "isLocked": false
    })
}

/// document.data のJSON全体を構築
pub fn build_document_json(
    tmpl: &AlymTemplate,
    items_per_label: u32,
    label_data: &[Vec<String>],
) -> serde_json::Value {
    let total_labels = tmpl.cols * tmpl.rows;
    let font_size = calc_font_size(tmpl.label_height_mm, items_per_label);

    // テキストレイヤー生成
    let mut layers = Vec::new();
    let mut column_data = Vec::new();
    let col_headers = ["A", "B", "C", "D", "E", "F", "G", "H"];
    for i in 0..items_per_label {
        let layer = make_text_layer(i, &format!("項目{}", i + 1), items_per_label, tmpl.label_width_mm, tmpl.label_height_mm, font_size);
        layers.push(layer);
        column_data.push(serde_json::json!({
            "headerText": col_headers.get(i as usize).unwrap_or(&"X"),
            "insertionId": format!("ins-{:08x}", i),
            "prefix": "",
            "suffix": ""
        }));
    }

    // rowDataArray 生成（グリッドデータ → alym形式）
    // isFirstRowAsColumnName=true により、先頭行がラベル屋さんの列名行として扱われる
    let mut row_data = Vec::new();
    // 最初の1行: 列名行（isPrint=false で印刷されない）
    let mut header_cells = Vec::new();
    for i in 0..items_per_label {
        header_cells.push(serde_json::json!({
            "type": 0,
            "content": format!("項目{}", i + 1)
        }));
    }
    row_data.push(serde_json::json!({
        "isPrint": false,
        "printCount": 1,
        "cellDataArray": header_cells
    }));

    // 実際のラベルデータ
    for row in label_data {
        let mut cells = Vec::new();
        for cell in row {
            cells.push(serde_json::json!({
                "type": 0,
                "content": cell
            }));
        }
        // itemsPerLabel に満たない分は空欄で埋める
        while cells.len() < items_per_label as usize {
            cells.push(serde_json::json!({
                "type": 0,
                "content": ""
            }));
        }
        row_data.push(serde_json::json!({
            "isPrint": true,
            "printCount": 1,
            "cellDataArray": cells
        }));
    }

    // 残りを空行で埋める（isFirstRowAsColumnName=true なので total_labels + 1 行まで）
    while row_data.len() < total_labels as usize + 1 {
        let mut cells = Vec::new();
        for _ in 0..items_per_label {
            cells.push(serde_json::json!({
                "type": 0,
                "content": ""
            }));
        }
        row_data.push(serde_json::json!({
            "isPrint": true,
            "printCount": 1,
            "cellDataArray": cells
        }));
    }

    // グループレイヤー
    let group_id = format!("grp-{:08x}", 0u32);
    serde_json::json!({
        "fileVersion": 6,
        "fileEnvironment": "1.5.4",
        "fileVersionLabel9": "",
        "unloadedFonts": [],
        "backgroundTypeLabel9": 0,
        "openedFileName": "",
        "productCategoryId": 4,
        "productCode": tmpl.product_code,
        "productId": tmpl.product_id,
        "productName": tmpl.product_name,
        "productRegion": "JP",
        "paperCode": tmpl.product_code,
        "paperFormatCode": tmpl.format_code,
        "surfaceNumber": 1,
        "frameNumber": total_labels,
        "rotate": 0,
        "pageWidth": 210,
        "pageHeight": 297,
        "useInsertion": true,
        "insertionData": {
            "isFirstRowAsColumnName": true,
            "insertionDirection": 0,
            "startRow": 0,
            "endRow": total_labels,
            "offset": 0,
            "printCount": 1,
            "columnDataArray": column_data,
            "rowDataArray": row_data
        },
        "pageList": [{
            "width": 210,
            "height": 297,
            "designMaxNumber": total_labels,
            "surfaces": [{
                "width": 210,
                "height": 297,
                "frameArray": [{
                    "leftMargin": tmpl.left_margin,
                    "topMargin": tmpl.top_margin,
                    "horizontalPadding": tmpl.horizontal_padding,
                    "verticalPadding": tmpl.vertical_padding,
                    "width": tmpl.label_width_mm,
                    "height": tmpl.label_height_mm,
                    "col": tmpl.cols,
                    "row": tmpl.rows,
                    "shape": {
                        "type": 0,
                        "cornerRadius": tmpl.corner_radius,
                        "innerCircleRadius": 0,
                        "hasFaceImage": false,
                        "faceImage": "",
                        "hasReverseImage": false,
                        "reverseImage": ""
                    }
                }],
                "designMap": {
                    "0": {
                        "width": tmpl.label_width_mm,
                        "height": tmpl.label_height_mm,
                        "rotate": 0,
                        "layer": {
                            "isExpanded": true,
                            "layers": layers,
                            "groupRotate": 0,
                            "layerType": "group",
                            "id": group_id,
                            "insertionId": "",
                            "name": format!("オブジェクト_{}", group_id),
                            "isLocked": false
                        },
                        "unit": 0
                    }
                },
                "printableArray": []
            }]
        }],
        "frameArray": [{
            "leftMargin": tmpl.left_margin,
            "topMargin": tmpl.top_margin,
            "horizontalPadding": tmpl.horizontal_padding,
            "verticalPadding": tmpl.vertical_padding,
            "width": tmpl.label_width_mm,
            "height": tmpl.label_height_mm,
            "col": tmpl.cols,
            "row": tmpl.rows,
            "shape": {
                "type": 0,
                "cornerRadius": tmpl.corner_radius,
                "innerCircleRadius": 0,
                "hasFaceImage": false,
                "faceImage": "",
                "hasReverseImage": false,
                "reverseImage": ""
            }
        }]
    })
}

/// alymファイル（ZIP）を出力
pub fn write_alym(path: &str, document_json: &serde_json::Value) -> Result<(), String> {
    let json_bytes = serde_json::to_vec_pretty(document_json).map_err(|e| format!("JSONシリアライズエラー: {}", e))?;

    let file = std::fs::File::create(path).map_err(|e| format!("ファイル作成エラー: {}", e))?;
    let mut zip_writer = zip::ZipWriter::new(file);
    let options = zip::write::FileOptions::<()>::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    zip_writer.start_file("document/document.data", options)
        .map_err(|e| format!("ZIPエントリ作成エラー: {}", e))?;
    zip_writer.write_all(&json_bytes)
        .map_err(|e| format!("ZIP書き込みエラー: {}", e))?;

    zip_writer.finish().map_err(|e| format!("ZIP完了エラー: {}", e))?;
    Ok(())
}