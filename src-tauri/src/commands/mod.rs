//! Tauri IPC command registry for Lumina.
//!
//! Commands are organized by domain so each subsystem remains focused,
//! auditable, and easy to maintain:
//!
//! - `common`       — Shared path resolution, atomic I/O, blocking runner, and workspace watcher.
//! - `workspace`    — Notes/snippets CRUD, folders, file moves, OS reveal, and workspace picker.
//! - `assets`       — Image/media storage, external file imports, orphan cleanup, and ZIP backups.
//! - `settings`     — Encrypted persistent application settings and AI memory store.
//! - `search`       — Full-text/fuzzy search, knowledge graph builder, and workspace file I/O.
//! - `terminal`     — Native ConPTY / PTY shell engine.
//! - `google_oauth` — Google OAuth loopback flow, token refresh, and email attachment picker.
//! - `updater`      — In-app GitHub release downloader and cross-platform installer runner.

pub mod assets;
pub mod common;
pub mod google_oauth;
pub mod search;
pub mod settings;
pub mod terminal;
pub mod updater;
pub mod workspace;

// Re-export every Tauri command and public helper so `lib.rs` stays flat.
pub use assets::*;
pub use common::{mark_internal_workspace_write, resolve_workspace_path, start_workspace_watcher};
pub use google_oauth::*;
pub use search::*;
pub use settings::*;
pub use terminal::*;
pub use updater::*;
pub use workspace::*;
