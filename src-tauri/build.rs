use std::fs;
use std::path::PathBuf;

fn resolve_build_google_client_secret() -> Option<String> {
    for key in ["GOOGLE_CLIENT_SECRET", "VITE_GOOGLE_CLIENT_SECRET"] {
        if let Ok(val) = std::env::var(key) {
            let trimmed = val.trim().to_string();
            if !trimmed.is_empty() {
                return Some(trimmed);
            }
        }
    }

    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default());
    let mut candidates = vec![
        manifest_dir.join(".env"),
        manifest_dir.join(".env.local"),
    ];
    if let Some(root) = manifest_dir.parent() {
        candidates.push(root.join(".env"));
        candidates.push(root.join(".env.local"));
    }

    for env_path in candidates {
        if env_path.exists() {
            println!("cargo:rerun-if-changed={}", env_path.display());
            if let Ok(content) = fs::read_to_string(&env_path) {
                for line in content.lines() {
                    let line = line.trim();
                    if line.is_empty() || line.starts_with('#') {
                        continue;
                    }
                    if let Some((k, v)) = line.split_once('=') {
                        let k = k.trim();
                        if k == "GOOGLE_CLIENT_SECRET" || k == "VITE_GOOGLE_CLIENT_SECRET" {
                            let v = v.trim().trim_matches('"').trim_matches('\'').to_string();
                            if !v.is_empty() {
                                return Some(v);
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

fn main() {
    println!("cargo:rerun-if-env-changed=GOOGLE_CLIENT_SECRET");
    println!("cargo:rerun-if-env-changed=VITE_GOOGLE_CLIENT_SECRET");

    if let Some(secret) = resolve_build_google_client_secret() {
        println!("cargo:rustc-env=LUMINA_GOOGLE_CLIENT_SECRET={}", secret);
    }

    tauri_build::build()
}
