use flate2::{write::DeflateEncoder, Compression};
use std::collections::HashSet;
use std::io::Write;

#[derive(Debug, Clone)]
pub struct ZipEntry {
    pub name: String,
    pub data: Vec<u8>,
}

/// Sanitizes an archive entry path to prevent zip-slip (`..`, leading slashes, drive prefixes).
fn sanitize_zip_entry_name(raw: &str) -> String {
    let normalized = raw.replace('\\', "/");
    let mut parts: Vec<String> = Vec::new();

    for (idx, seg) in normalized.split('/').enumerate() {
        let mut s = seg.trim();
        // Strip Windows drive prefix like "C:" on the first segment
        if idx == 0 {
            let bytes = s.as_bytes();
            if bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' {
                s = &s[2..];
            }
        }
        if s.is_empty() || s == "." || s == ".." {
            continue;
        }
        let cleaned: String = s
            .chars()
            .filter(|&ch| ch != '\0' && (ch as u32) >= 32)
            .collect();
        if !cleaned.is_empty() && cleaned != "." && cleaned != ".." {
            parts.push(cleaned);
        }
    }

    if parts.is_empty() {
        "file".to_string()
    } else {
        parts.join("/")
    }
}

fn deduplicate_entry_name(sanitized: &str, used: &mut HashSet<String>) -> String {
    if used.insert(sanitized.to_string()) {
        return sanitized.to_string();
    }

    let (dir, filename) = match sanitized.rsplit_once('/') {
        Some((d, f)) => (Some(d), f),
        None => (None, sanitized),
    };
    let (stem, ext) = match filename.rsplit_once('.') {
        Some((s, e)) if !s.is_empty() => (s, Some(e)),
        _ => (filename, None),
    };

    let mut counter: usize = 1;
    loop {
        let new_file = match ext {
            Some(e) => format!("{stem} ({counter}).{e}"),
            None => format!("{stem} ({counter})"),
        };
        let candidate = match dir {
            Some(d) => format!("{d}/{new_file}"),
            None => new_file,
        };
        if used.insert(candidate.clone()) {
            return candidate;
        }
        counter += 1;
    }
}

struct CentralDirRecord {
    name_bytes: Vec<u8>,
    method: u16,
    crc32: u32,
    compressed_size: u32,
    uncompressed_size: u32,
    local_header_offset: u32,
}

/// Builds a standard PKZIP archive in memory with DEFLATE (fallback STORE) and UTF-8 filenames.
pub fn build_zip_bytes(entries: &[ZipEntry]) -> Result<Vec<u8>, String> {
    if entries.len() > u16::MAX as usize {
        return Err("Too many entries for standard ZIP archive".to_string());
    }

    let mut out = Vec::new();
    let mut central_records = Vec::with_capacity(entries.len());
    let mut used_names = HashSet::with_capacity(entries.len());

    // DOS timestamp for a valid fixed date: 2026-01-01 00:00:00
    const DOS_TIME: u16 = 0;
    const DOS_DATE: u16 = ((2026 - 1980) << 9) | (1 << 5) | 1;
    const UTF8_FLAG: u16 = 0x0800;

    for entry in entries {
        let sanitized = sanitize_zip_entry_name(&entry.name);
        let final_name = deduplicate_entry_name(&sanitized, &mut used_names);
        let name_bytes = final_name.into_bytes();
        let name_len = u16::try_from(name_bytes.len())
            .map_err(|_| "ZIP entry filename exceeds 65535 bytes".to_string())?;

        let uncompressed_size = u32::try_from(entry.data.len())
            .map_err(|_| "ZIP entry exceeds 4 GiB standard limit".to_string())?;
        let crc32 = crc32fast::hash(&entry.data);

        let mut encoder = DeflateEncoder::new(Vec::new(), Compression::best());
        encoder
            .write_all(&entry.data)
            .map_err(|e| format!("Failed to compress ZIP entry: {e}"))?;
        let deflated = encoder
            .finish()
            .map_err(|e| format!("Failed to finish ZIP deflate stream: {e}"))?;

        let (method, payload): (u16, &[u8]) = if !entry.data.is_empty()
            && deflated.len() < entry.data.len()
        {
            (8, &deflated)
        } else {
            (0, &entry.data)
        };
        let compressed_size = u32::try_from(payload.len())
            .map_err(|_| "Compressed ZIP entry exceeds 4 GiB limit".to_string())?;

        let local_header_offset = u32::try_from(out.len())
            .map_err(|_| "ZIP archive exceeds 4 GiB standard limit".to_string())?;

        // Local File Header (30 bytes + filename)
        out.extend_from_slice(&0x0403_4b50u32.to_le_bytes());
        out.extend_from_slice(&20u16.to_le_bytes()); // Version needed: 2.0
        out.extend_from_slice(&UTF8_FLAG.to_le_bytes());
        out.extend_from_slice(&method.to_le_bytes());
        out.extend_from_slice(&DOS_TIME.to_le_bytes());
        out.extend_from_slice(&DOS_DATE.to_le_bytes());
        out.extend_from_slice(&crc32.to_le_bytes());
        out.extend_from_slice(&compressed_size.to_le_bytes());
        out.extend_from_slice(&uncompressed_size.to_le_bytes());
        out.extend_from_slice(&name_len.to_le_bytes());
        out.extend_from_slice(&0u16.to_le_bytes()); // Extra field length
        out.extend_from_slice(&name_bytes);
        out.extend_from_slice(payload);

        central_records.push(CentralDirRecord {
            name_bytes,
            method,
            crc32,
            compressed_size,
            uncompressed_size,
            local_header_offset,
        });
    }

    let cd_offset = u32::try_from(out.len())
        .map_err(|_| "ZIP central directory offset exceeds 4 GiB limit".to_string())?;

    for rec in &central_records {
        let name_len = rec.name_bytes.len() as u16;
        // Central Directory File Header (46 bytes + filename)
        out.extend_from_slice(&0x0201_4b50u32.to_le_bytes());
        out.extend_from_slice(&20u16.to_le_bytes()); // Version made by
        out.extend_from_slice(&20u16.to_le_bytes()); // Version needed
        out.extend_from_slice(&UTF8_FLAG.to_le_bytes());
        out.extend_from_slice(&rec.method.to_le_bytes());
        out.extend_from_slice(&DOS_TIME.to_le_bytes());
        out.extend_from_slice(&DOS_DATE.to_le_bytes());
        out.extend_from_slice(&rec.crc32.to_le_bytes());
        out.extend_from_slice(&rec.compressed_size.to_le_bytes());
        out.extend_from_slice(&rec.uncompressed_size.to_le_bytes());
        out.extend_from_slice(&name_len.to_le_bytes());
        out.extend_from_slice(&0u16.to_le_bytes()); // Extra length
        out.extend_from_slice(&0u16.to_le_bytes()); // Comment length
        out.extend_from_slice(&0u16.to_le_bytes()); // Disk number start
        out.extend_from_slice(&0u16.to_le_bytes()); // Internal attrs
        out.extend_from_slice(&0u32.to_le_bytes()); // External attrs
        out.extend_from_slice(&rec.local_header_offset.to_le_bytes());
        out.extend_from_slice(&rec.name_bytes);
    }

    let cd_size = u32::try_from(out.len() - cd_offset as usize)
        .map_err(|_| "ZIP central directory exceeds 4 GiB limit".to_string())?;
    let entry_count = central_records.len() as u16;

    // End of Central Directory Record (22 bytes)
    out.extend_from_slice(&0x0605_4b50u32.to_le_bytes());
    out.extend_from_slice(&0u16.to_le_bytes()); // Number of this disk
    out.extend_from_slice(&0u16.to_le_bytes()); // Disk where central dir starts
    out.extend_from_slice(&entry_count.to_le_bytes());
    out.extend_from_slice(&entry_count.to_le_bytes());
    out.extend_from_slice(&cd_size.to_le_bytes());
    out.extend_from_slice(&cd_offset.to_le_bytes());
    out.extend_from_slice(&0u16.to_le_bytes()); // Comment length

    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::read::DeflateDecoder;
    use std::io::Read;

    fn read_u16_le(bytes: &[u8], off: usize) -> u16 {
        u16::from_le_bytes([bytes[off], bytes[off + 1]])
    }

    fn read_u32_le(bytes: &[u8], off: usize) -> u32 {
        u32::from_le_bytes([bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]])
    }

    #[test]
    fn test_zip_roundtrip_deflate_and_store() {
        let long_text = "Lumina export markdown line.\n".repeat(40);
        let empty: Vec<u8> = Vec::new();
        let tiny_bin = vec![0x89, b'P', b'N', b'G'];
        let unicode_text = "Hello 世界 🚀";

        let entries = vec![
            ZipEntry {
                name: "notes/readme.md".to_string(),
                data: long_text.as_bytes().to_vec(),
            },
            ZipEntry {
                name: "empty.txt".to_string(),
                data: empty.clone(),
            },
            ZipEntry {
                name: "assets/tiny.png".to_string(),
                data: tiny_bin.clone(),
            },
            ZipEntry {
                name: "notes/café-📝.md".to_string(),
                data: unicode_text.as_bytes().to_vec(),
            },
        ];

        let archive = build_zip_bytes(&entries).expect("build_zip_bytes should succeed");
        assert_eq!(read_u32_le(&archive, 0), 0x0403_4b50);

        let eocd_off = archive.len() - 22;
        assert_eq!(read_u32_le(&archive, eocd_off), 0x0605_4b50);
        assert_eq!(read_u16_le(&archive, eocd_off + 10), 4);

        let cd_offset = read_u32_le(&archive, eocd_off + 16) as usize;
        assert_eq!(read_u32_le(&archive, cd_offset), 0x0201_4b50);

        // Parse local entries & verify exact payload decompression
        let mut cursor = 0usize;
        let expected_names = [
            "notes/readme.md",
            "empty.txt",
            "assets/tiny.png",
            "notes/café-📝.md",
        ];
        let expected_payloads: [&[u8]; 4] = [
            long_text.as_bytes(),
            &empty,
            &tiny_bin,
            unicode_text.as_bytes(),
        ];

        for idx in 0..4 {
            assert_eq!(read_u32_le(&archive, cursor), 0x0403_4b50);
            let flags = read_u16_le(&archive, cursor + 6);
            assert_eq!(flags & 0x0800, 0x0800);
            let method = read_u16_le(&archive, cursor + 8);
            let crc = read_u32_le(&archive, cursor + 14);
            let comp_size = read_u32_le(&archive, cursor + 18) as usize;
            let uncomp_size = read_u32_le(&archive, cursor + 22) as usize;
            let name_len = read_u16_le(&archive, cursor + 26) as usize;
            let extra_len = read_u16_le(&archive, cursor + 28) as usize;

            let name_start = cursor + 30;
            let name = std::str::from_utf8(&archive[name_start..name_start + name_len]).unwrap();
            assert_eq!(name, expected_names[idx]);

            let data_start = name_start + name_len + extra_len;
            let raw_payload = &archive[data_start..data_start + comp_size];

            let recovered = match method {
                0 => raw_payload.to_vec(),
                8 => {
                    let mut dec = DeflateDecoder::new(raw_payload);
                    let mut buf = Vec::new();
                    dec.read_to_end(&mut buf).unwrap();
                    buf
                }
                other => panic!("unexpected compression method {other}"),
            };

            assert_eq!(recovered.len(), uncomp_size);
            assert_eq!(recovered, expected_payloads[idx]);
            assert_eq!(crc, crc32fast::hash(expected_payloads[idx]));

            if idx == 0 {
                assert_eq!(method, 8, "repetitive text must use DEFLATE");
            }
            if idx == 1 {
                assert_eq!(method, 0, "empty entry must use STORE");
            }

            cursor = data_start + comp_size;
        }
        assert_eq!(cursor, cd_offset);
    }

    #[test]
    fn test_zip_sanitizes_traversal_entry_names() {
        let entries = vec![
            ZipEntry {
                name: "../evil.txt".to_string(),
                data: b"a".to_vec(),
            },
            ZipEntry {
                name: "/abs/path.txt".to_string(),
                data: b"b".to_vec(),
            },
            ZipEntry {
                name: r"C:\win\dir\note.md".to_string(),
                data: b"c".to_vec(),
            },
            ZipEntry {
                name: "evil.txt".to_string(),
                data: b"d".to_vec(),
            },
        ];

        let archive = build_zip_bytes(&entries).expect("build_zip_bytes should succeed");
        let mut cursor = 0usize;
        let mut names = Vec::new();

        for _ in 0..4 {
            assert_eq!(read_u32_le(&archive, cursor), 0x0403_4b50);
            let comp_size = read_u32_le(&archive, cursor + 18) as usize;
            let name_len = read_u16_le(&archive, cursor + 26) as usize;
            let extra_len = read_u16_le(&archive, cursor + 28) as usize;
            let name_start = cursor + 30;
            let name = std::str::from_utf8(&archive[name_start..name_start + name_len]).unwrap();
            names.push(name.to_string());
            cursor = name_start + name_len + extra_len + comp_size;
        }

        assert_eq!(
            names,
            vec!["evil.txt", "abs/path.txt", "win/dir/note.md", "evil (1).txt"]
        );
    }
}
