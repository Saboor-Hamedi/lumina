use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

const ENC_PREFIX: &str = "enc:v1:";
const KEY_FILE_NAME: &str = ".lumina_secret.key";

pub const SECRET_SETTING_KEYS: &[&str] = &[
    "deepSeekKey",
    "huggingFaceKey",
    "openaiKey",
    "anthropicKey",
    "groqKey",
    "geminiKey",
    "openrouterKey",
    "apiKey",
];

fn random_bytes(buf: &mut [u8]) {
    if getrandom::fill(buf).is_ok() {
        return;
    }
    // Defensive fallback if OS entropy source is unavailable
    let mut seed = [0u8; 32];
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let pid = std::process::id();
    let mut hasher = Sha256::new();
    hasher.update(now.to_le_bytes());
    hasher.update(pid.to_le_bytes());
    seed.copy_from_slice(&hasher.finalize());

    let mut offset = 0usize;
    let mut counter: u32 = 0;
    while offset < buf.len() {
        let mut h = Sha256::new();
        h.update(seed);
        h.update(counter.to_be_bytes());
        let block = h.finalize();
        let take = (buf.len() - offset).min(32);
        buf[offset..offset + take].copy_from_slice(&block[..take]);
        offset += take;
        counter = counter.wrapping_add(1);
    }
}

pub fn load_or_create_master_key(app_data_dir: &Path) -> [u8; 32] {
    let key_path = app_data_dir.join(KEY_FILE_NAME);
    if let Ok(raw) = fs::read_to_string(&key_path) {
        if let Ok(decoded) = STANDARD.decode(raw.trim()) {
            if decoded.len() == 32 {
                let mut key = [0u8; 32];
                key.copy_from_slice(&decoded);
                return key;
            }
        }
    }

    let mut key = [0u8; 32];
    random_bytes(&mut key);
    let _ = fs::create_dir_all(app_data_dir);
    let encoded = STANDARD.encode(key);
    if fs::write(&key_path, &encoded).is_ok() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&key_path, fs::Permissions::from_mode(0o600));
        }
    }
    key
}

fn derive_subkey(domain: &[u8], master_key: &[u8; 32]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(domain);
    hasher.update(master_key);
    let digest = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&digest);
    out
}

fn hmac_sha256(key: &[u8; 32], data: &[u8]) -> [u8; 32] {
    let mut ipad = [0x36u8; 64];
    let mut opad = [0x5cu8; 64];
    for i in 0..32 {
        ipad[i] ^= key[i];
        opad[i] ^= key[i];
    }

    let mut inner = Sha256::new();
    inner.update(ipad);
    inner.update(data);
    let inner_hash = inner.finalize();

    let mut outer = Sha256::new();
    outer.update(opad);
    outer.update(inner_hash);
    let outer_hash = outer.finalize();

    let mut out = [0u8; 32];
    out.copy_from_slice(&outer_hash);
    out
}

fn xor_keystream(enc_key: &[u8; 32], nonce: &[u8; 16], data: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(data.len());
    let mut counter: u32 = 0;
    for chunk in data.chunks(32) {
        let mut h = Sha256::new();
        h.update(enc_key);
        h.update(nonce);
        h.update(counter.to_be_bytes());
        let block = h.finalize();
        for (b, k) in chunk.iter().zip(block.iter()) {
            out.push(b ^ k);
        }
        counter = counter.wrapping_add(1);
    }
    out
}

pub fn encrypt_secret_with_key(plaintext: &str, master_key: &[u8; 32]) -> String {
    if plaintext.is_empty() || plaintext.starts_with(ENC_PREFIX) {
        return plaintext.to_string();
    }

    let enc_key = derive_subkey(b"lumina-enc-v1", master_key);
    let mac_key = derive_subkey(b"lumina-mac-v1", master_key);

    let mut nonce = [0u8; 16];
    random_bytes(&mut nonce);

    let ciphertext = xor_keystream(&enc_key, &nonce, plaintext.as_bytes());
    let mut mac_input = Vec::with_capacity(14 + 16 + ciphertext.len());
    mac_input.extend_from_slice(b"lumina-aead-v1");
    mac_input.extend_from_slice(&nonce);
    mac_input.extend_from_slice(&ciphertext);
    let tag = hmac_sha256(&mac_key, &mac_input);

    let mut payload = Vec::with_capacity(16 + 32 + ciphertext.len());
    payload.extend_from_slice(&nonce);
    payload.extend_from_slice(&tag);
    payload.extend_from_slice(&ciphertext);

    format!("{}{}", ENC_PREFIX, STANDARD.encode(payload))
}

pub fn decrypt_secret_with_key(value: &str, master_key: &[u8; 32]) -> String {
    if !value.starts_with(ENC_PREFIX) {
        return value.to_string();
    }

    let encoded = &value[ENC_PREFIX.len()..];
    let raw = match STANDARD.decode(encoded) {
        Ok(bytes) => bytes,
        Err(_) => return String::new(),
    };

    if raw.len() < 48 {
        return String::new();
    }

    let mut nonce = [0u8; 16];
    nonce.copy_from_slice(&raw[..16]);
    let tag = &raw[16..48];
    let ciphertext = &raw[48..];

    let enc_key = derive_subkey(b"lumina-enc-v1", master_key);
    let mac_key = derive_subkey(b"lumina-mac-v1", master_key);

    let mut mac_input = Vec::with_capacity(14 + 16 + ciphertext.len());
    mac_input.extend_from_slice(b"lumina-aead-v1");
    mac_input.extend_from_slice(&nonce);
    mac_input.extend_from_slice(ciphertext);
    let expected = hmac_sha256(&mac_key, &mac_input);

    let diff = expected
        .iter()
        .zip(tag.iter())
        .fold(0u8, |acc, (a, b)| acc | (a ^ b));
    if diff != 0 {
        return String::new();
    }

    let plain = xor_keystream(&enc_key, &nonce, ciphertext);
    String::from_utf8(plain).unwrap_or_default()
}

fn transform_secret_fields<F>(settings: &mut Value, transform: F)
where
    F: Fn(&str) -> String,
{
    let Some(obj) = settings.as_object_mut() else {
        return;
    };

    for key in SECRET_SETTING_KEYS {
        if let Some(val) = obj.get_mut(*key) {
            if let Some(s) = val.as_str() {
                if !s.is_empty() {
                    *val = Value::String(transform(s));
                }
            }
        }
    }

    if let Some(token_obj) = obj
        .get_mut("googleUser")
        .and_then(|u| u.as_object_mut())
        .and_then(|u| u.get_mut("token"))
        .and_then(|t| t.as_object_mut())
    {
        for field in ["access_token", "refresh_token"] {
            if let Some(val) = token_obj.get_mut(field) {
                if let Some(s) = val.as_str() {
                    if !s.is_empty() {
                        *val = Value::String(transform(s));
                    }
                }
            }
        }
    }
}

pub fn encrypt_settings_secrets(settings: &mut Value, master_key: &[u8; 32]) {
    transform_secret_fields(settings, |s| encrypt_secret_with_key(s, master_key));
}

pub fn decrypt_settings_secrets(settings: &mut Value, master_key: &[u8; 32]) {
    transform_secret_fields(settings, |s| decrypt_secret_with_key(s, master_key));
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_encrypt_decrypt_roundtrip_and_uniqueness() {
        let key = [42u8; 32];
        let secret = "sk-lumina-test-secret-UTF8-🔑-12345";

        let enc1 = encrypt_secret_with_key(secret, &key);
        let enc2 = encrypt_secret_with_key(secret, &key);

        assert!(enc1.starts_with(ENC_PREFIX));
        assert!(enc2.starts_with(ENC_PREFIX));
        assert_ne!(enc1, enc2, "each encryption must use a fresh random nonce");

        assert_eq!(decrypt_secret_with_key(&enc1, &key), secret);
        assert_eq!(decrypt_secret_with_key(&enc2, &key), secret);

        // Idempotent if encrypt is called on already encrypted payload
        assert_eq!(encrypt_secret_with_key(&enc1, &key), enc1);
    }

    #[test]
    fn test_legacy_plaintext_passes_through_decrypt() {
        let key = [7u8; 32];
        assert_eq!(decrypt_secret_with_key("sk-legacy-plain", &key), "sk-legacy-plain");
        assert_eq!(decrypt_secret_with_key("", &key), "");
    }

    #[test]
    fn test_tamper_and_wrong_key_detection() {
        let key1 = [1u8; 32];
        let key2 = [2u8; 32];
        let enc = encrypt_secret_with_key("my-api-key", &key1);

        // Wrong key must fail authentication
        assert_eq!(decrypt_secret_with_key(&enc, &key2), "");

        // Single-bit tamper in payload must fail authentication
        let mut raw = STANDARD.decode(&enc[ENC_PREFIX.len()..]).unwrap();
        let last = raw.len() - 1;
        raw[last] ^= 0x01;
        let tampered = format!("{}{}", ENC_PREFIX, STANDARD.encode(raw));
        assert_eq!(decrypt_secret_with_key(&tampered, &key1), "");
    }

    #[test]
    fn test_settings_secrets_transform() {
        let key = [99u8; 32];
        let mut settings = json!({
            "theme": "dark",
            "fontSize": 16,
            "deepSeekKey": "ds-secret",
            "openaiKey": "sk-openai",
            "googleUser": {
                "email": "user@example.com",
                "token": {
                    "access_token": "ya29.access",
                    "refresh_token": "1//refresh"
                }
            }
        });

        encrypt_settings_secrets(&mut settings, &key);
        assert_eq!(settings["theme"], "dark");
        assert_eq!(settings["fontSize"], 16);
        assert_eq!(settings["googleUser"]["email"], "user@example.com");
        assert!(settings["deepSeekKey"].as_str().unwrap().starts_with(ENC_PREFIX));
        assert!(settings["openaiKey"].as_str().unwrap().starts_with(ENC_PREFIX));
        assert!(settings["googleUser"]["token"]["access_token"]
            .as_str()
            .unwrap()
            .starts_with(ENC_PREFIX));
        assert!(settings["googleUser"]["token"]["refresh_token"]
            .as_str()
            .unwrap()
            .starts_with(ENC_PREFIX));

        decrypt_settings_secrets(&mut settings, &key);
        assert_eq!(settings["deepSeekKey"], "ds-secret");
        assert_eq!(settings["openaiKey"], "sk-openai");
        assert_eq!(settings["googleUser"]["token"]["access_token"], "ya29.access");
        assert_eq!(settings["googleUser"]["token"]["refresh_token"], "1//refresh");
    }

    #[test]
    fn test_load_or_create_master_key_persists() {
        let dir = std::env::temp_dir().join(format!(
            "lumina-secret-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let k1 = load_or_create_master_key(&dir);
        let k2 = load_or_create_master_key(&dir);
        assert_eq!(k1, k2);
        let _ = fs::remove_dir_all(&dir);
    }
}
