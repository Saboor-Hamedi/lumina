#![deny(clippy::all)]

pub mod graph;
pub mod scanner;
pub mod search;

use napi_derive::napi;
pub use graph::{build_graph_data_impl, GraphData, GraphLink, GraphNode, NoteInput};
pub use scanner::{scan_vault_impl, ScanResult, ScannedNote};
pub use search::{search_notes_impl, SearchHit, SearchIndexItem};

#[napi]
pub fn get_core_version() -> String {
    "lumina-core-rust/0.1.0".to_string()
}

/// Scan an entire vault directory using multithreaded Rayon parallelism
#[napi]
pub fn scan_vault(vault_path: String, max_bytes: Option<u32>) -> ScanResult {
    let limit = max_bytes.unwrap_or(5 * 1024 * 1024) as usize;
    scan_vault_impl(&vault_path, limit)
}

/// Perform sub-millisecond in-memory fuzzy search across note metadata & contents
#[napi]
pub fn fuzzy_search(items: Vec<SearchIndexItem>, query: String, limit: Option<u32>) -> Vec<SearchHit> {
    let max_hits = limit.unwrap_or(30) as usize;
    search_notes_impl(&items, &query, max_hits)
}

/// Construct 2D/3D knowledge graph nodes & links from note wikilinks in < 1ms
#[napi]
pub fn build_graph_data(notes: Vec<NoteInput>) -> GraphData {
    build_graph_data_impl(&notes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_core_version() {
        assert_eq!(get_core_version(), "lumina-core-rust/0.1.0");
    }

    #[test]
    fn test_fuzzy_search_ranking() {
        let items = vec![
            SearchIndexItem {
                id: "1".to_string(),
                title: "Rust Architecture".to_string(),
                relative_path: "architecture/rust.md".to_string(),
                tags: "rust, core".to_string(),
                content: "High performance native engine for Lumina.".to_string(),
            },
            SearchIndexItem {
                id: "2".to_string(),
                title: "Daily Notes".to_string(),
                relative_path: "daily/2026-09-25.md".to_string(),
                tags: "daily".to_string(),
                content: "Meeting notes and plans.".to_string(),
            },
        ];

        let results = fuzzy_search(items, "Rust Architecture".to_string(), Some(10));
        assert!(!results.is_empty());
        assert_eq!(results[0].id, "1");
        assert!(results[0].score > 50.0);
    }

    #[test]
    fn test_graph_data_builder() {
        let notes = vec![
            NoteInput {
                id: "a".to_string(),
                title: "Alpha".to_string(),
                wikilinks: vec!["Beta".to_string()],
            },
            NoteInput {
                id: "b".to_string(),
                title: "Beta".to_string(),
                wikilinks: vec!["Alpha".to_string()],
            },
            NoteInput {
                id: "c".to_string(),
                title: "Gamma".to_string(),
                wikilinks: vec![],
            },
        ];

        let graph = build_graph_data(notes);
        assert_eq!(graph.nodes.len(), 3);
        assert_eq!(graph.links.len(), 2);
        assert_eq!(graph.links[0].source, "a");
        assert_eq!(graph.links[0].target, "b");
    }

    #[test]
    fn test_extract_and_strip_frontmatter_standard() {
        let text = "---\nid: note-123\ntitle: Test Note\ntags: [tag1, tag2]\nisPinned: true\nisLearned: true\n---\n\n# Body Heading\nSome content here.";
        let (fm, body) = scanner::extract_and_strip_frontmatter(text);
        assert_eq!(fm.id.unwrap(), "note-123");
        assert_eq!(fm.title.unwrap(), "Test Note");
        assert_eq!(fm.tags, vec!["tag1", "tag2"]);
        assert!(fm.is_pinned);
        assert!(fm.is_learned);
        assert_eq!(body, "# Body Heading\nSome content here.");
    }

    #[test]
    fn test_extract_and_strip_frontmatter_loose_metadata() {
        let text = "id: note-8d3d6107b16733948969e617573d2ac6\ntitle: installing git\nlanguage: markdown\ntags: ''\nselection: null\nisPinned: false\nisLearned: false\ncustomIcon: null\ncreatedAt: '2026-09-25T05:02:06.906Z'\ntimestamp: 1790312526897\n\n# Installing Git Guide\nRun winget install git.";
        let (fm, body) = scanner::extract_and_strip_frontmatter(text);
        assert_eq!(fm.id.unwrap(), "note-8d3d6107b16733948969e617573d2ac6");
        assert_eq!(fm.title.unwrap(), "installing git");
        assert_eq!(fm.language.unwrap(), "markdown");
        assert_eq!(fm.created_at.unwrap(), "2026-09-25T05:02:06.906Z");
        assert_eq!(fm.timestamp.unwrap(), 1790312526897.0);
        assert!(!fm.is_pinned);
        assert!(!fm.is_learned);
        assert_eq!(body, "# Installing Git Guide\nRun winget install git.");
    }
}

