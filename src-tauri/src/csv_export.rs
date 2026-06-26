/// RFC 4180 準拠の CSV フィールド エスケープ
pub fn escape_csv_field(s: &str) -> String {
    let needs_quote = s.contains(',') || s.contains('"') || s.contains('\n') || s.contains('\r');

    if !needs_quote {
        return s.to_string();
    }

    // " を "" に置換し、全体を " で囲む
    let escaped = s.replace('"', "\"\"");
    format!("\"{}\"", escaped)
}
