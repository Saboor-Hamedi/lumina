use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub const METADATA_DB_REL_PATH: &str = ".lumina/metadata.db";

pub fn workspace_metadata_db_path(workspace_root: &Path) -> PathBuf {
    workspace_root.join(METADATA_DB_REL_PATH)
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NoteMetadataEntry {
    pub note_id: String,
    pub key: String,
    pub prop_type: String,
    pub value: String,
    pub position: i64,
    pub updated_at: i64,
}

fn now_epoch_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub struct NoteMetadataStore {
    conn: Connection,
}

impl NoteMetadataStore {
    pub fn open(db_path: &Path) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create metadata directory: {e}"))?;
        }
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open metadata database: {e}"))?;
        let store = Self { conn };
        store.init_schema()?;
        Ok(store)
    }

    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self, String> {
        let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;
        let store = Self { conn };
        store.init_schema()?;
        Ok(store)
    }

    fn init_schema(&self) -> Result<(), String> {
        self.conn
            .execute_batch(
                r#"
                PRAGMA journal_mode = WAL;
                PRAGMA synchronous = NORMAL;
                PRAGMA busy_timeout = 5000;

                CREATE TABLE IF NOT EXISTS note_metadata (
                    note_id TEXT NOT NULL,
                    prop_key TEXT NOT NULL,
                    prop_type TEXT NOT NULL DEFAULT 'text',
                    prop_value TEXT NOT NULL DEFAULT '',
                    position INTEGER NOT NULL DEFAULT 0,
                    updated_at INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (note_id, prop_key)
                );

                CREATE INDEX IF NOT EXISTS idx_note_metadata_note_pos
                    ON note_metadata (note_id, position, prop_key);

                CREATE TABLE IF NOT EXISTS note_metadata_layout (
                    note_id TEXT PRIMARY KEY,
                    columns INTEGER NOT NULL DEFAULT 1
                );
                "#,
            )
            .map_err(|e| format!("Failed to initialize note_metadata schema: {e}"))
    }

    pub fn get_note_metadata(&self, note_id: &str) -> Result<Vec<NoteMetadataEntry>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT note_id, prop_key, prop_type, prop_value, position, updated_at
                 FROM note_metadata
                 WHERE note_id = ?1
                 ORDER BY position ASC, prop_key ASC",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![note_id], |row| {
                Ok(NoteMetadataEntry {
                    note_id: row.get(0)?,
                    key: row.get(1)?,
                    prop_type: row.get(2)?,
                    value: row.get(3)?,
                    position: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut out = Vec::new();
        for row in rows {
            out.push(row.map_err(|e| e.to_string())?);
        }
        Ok(out)
    }

    pub fn upsert_note_metadata(
        &self,
        note_id: &str,
        key: &str,
        prop_type: &str,
        value: &str,
        position: Option<i64>,
    ) -> Result<Vec<NoteMetadataEntry>, String> {
        let clean_key = key.trim();
        if note_id.trim().is_empty() || clean_key.is_empty() {
            return Err("note_id and key must not be empty".to_string());
        }

        let resolved_pos = match position {
            Some(p) => p,
            None => {
                let existing: Option<i64> = self
                    .conn
                    .query_row(
                        "SELECT position FROM note_metadata WHERE note_id = ?1 AND prop_key = ?2",
                        params![note_id, clean_key],
                        |r| r.get(0),
                    )
                    .ok();
                match existing {
                    Some(p) => p,
                    None => self
                        .conn
                        .query_row(
                            "SELECT COALESCE(MAX(position) + 1, 0) FROM note_metadata WHERE note_id = ?1",
                            params![note_id],
                            |r| r.get(0),
                        )
                        .unwrap_or(0),
                }
            }
        };

        let now = now_epoch_ms();
        self.conn
            .execute(
                "INSERT INTO note_metadata (note_id, prop_key, prop_type, prop_value, position, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(note_id, prop_key) DO UPDATE SET
                   prop_type = excluded.prop_type,
                   prop_value = excluded.prop_value,
                   position = excluded.position,
                   updated_at = excluded.updated_at",
                params![note_id, clean_key, prop_type, value, resolved_pos, now],
            )
            .map_err(|e| e.to_string())?;

        self.get_note_metadata(note_id)
    }

    pub fn delete_note_metadata(
        &self,
        note_id: &str,
        key: &str,
    ) -> Result<Vec<NoteMetadataEntry>, String> {
        self.conn
            .execute(
                "DELETE FROM note_metadata WHERE note_id = ?1 AND prop_key = ?2",
                params![note_id, key.trim()],
            )
            .map_err(|e| e.to_string())?;
        self.get_note_metadata(note_id)
    }

    pub fn clear_note_metadata(&self, note_id: &str) -> Result<usize, String> {
        let _ = self.conn.execute(
            "DELETE FROM note_metadata_layout WHERE note_id = ?1",
            params![note_id],
        );
        self.conn
            .execute("DELETE FROM note_metadata WHERE note_id = ?1", params![note_id])
            .map_err(|e| e.to_string())
    }

    pub fn reorder_note_metadata(
        &mut self,
        note_id: &str,
        ordered_keys: &[String],
    ) -> Result<Vec<NoteMetadataEntry>, String> {
        let tx = self.conn.transaction().map_err(|e| e.to_string())?;
        let now = now_epoch_ms();
        for (idx, key) in ordered_keys.iter().enumerate() {
            tx.execute(
                "UPDATE note_metadata SET position = ?1, updated_at = ?2 WHERE note_id = ?3 AND prop_key = ?4",
                params![idx as i64, now, note_id, key.trim()],
            )
            .map_err(|e| e.to_string())?;
        }
        tx.commit().map_err(|e| e.to_string())?;
        self.get_note_metadata(note_id)
    }

    pub fn get_note_layout_columns(&self, note_id: &str) -> Result<i64, String> {
        let cols: i64 = self
            .conn
            .query_row(
                "SELECT columns FROM note_metadata_layout WHERE note_id = ?1",
                params![note_id],
                |r| r.get(0),
            )
            .unwrap_or(1);
        Ok(cols.clamp(1, 3))
    }

    pub fn set_note_layout_columns(&self, note_id: &str, columns: i64) -> Result<i64, String> {
        let clamped = columns.clamp(1, 3);
        self.conn
            .execute(
                "INSERT INTO note_metadata_layout (note_id, columns)
                 VALUES (?1, ?2)
                 ON CONFLICT(note_id) DO UPDATE SET columns = excluded.columns",
                params![note_id, clamped],
            )
            .map_err(|e| e.to_string())?;
        Ok(clamped)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metadata_crud_roundtrip() {
        let store = NoteMetadataStore::open_in_memory().unwrap();
        let list = store
            .upsert_note_metadata("note-1", "author", "text", "Saboor", None)
            .unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].key, "author");
        assert_eq!(list[0].value, "Saboor");

        let list = store
            .upsert_note_metadata("note-1", "due_date", "date", "2026-12-01", None)
            .unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[1].key, "due_date");

        let list = store
            .upsert_note_metadata("note-1", "author", "text", "Saboor Hamedi", None)
            .unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].value, "Saboor Hamedi");

        let list = store.delete_note_metadata("note-1", "author").unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].key, "due_date");

        let removed = store.clear_note_metadata("note-1").unwrap();
        assert_eq!(removed, 1);
        assert!(store.get_note_metadata("note-1").unwrap().is_empty());
    }
}
