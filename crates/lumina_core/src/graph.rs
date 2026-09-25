use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[napi(object)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub val: u32,
    pub color: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[napi(object)]
pub struct GraphLink {
    pub source: String,
    pub target: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[napi(object)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub links: Vec<GraphLink>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[napi(object)]
pub struct NoteInput {
    pub id: String,
    pub title: String,
    pub wikilinks: Vec<String>,
}

/// Compute complete 2D/3D graph data from notes in < 1ms
pub fn build_graph_data_impl(notes: &[NoteInput]) -> GraphData {
    let mut title_to_id: HashMap<String, String> = HashMap::with_capacity(notes.len());
    for n in notes {
        title_to_id.insert(n.title.to_lowercase(), n.id.clone());
        // Also map title without extension
        if let Some(pos) = n.title.rfind('.') {
            title_to_id.insert(n.title[..pos].to_lowercase(), n.id.clone());
        }
    }

    let mut link_counts: HashMap<String, u32> = HashMap::with_capacity(notes.len());
    let mut links: Vec<GraphLink> = Vec::new();
    let mut seen_pairs: HashSet<(String, String)> = HashSet::new();

    for n in notes {
        for target_title in &n.wikilinks {
            let key = target_title.to_lowercase();
            if let Some(target_id) = title_to_id.get(&key) {
                if target_id != &n.id {
                    let pair = (n.id.clone(), target_id.clone());
                    if !seen_pairs.contains(&pair) {
                        seen_pairs.insert(pair);
                        links.push(GraphLink {
                            source: n.id.clone(),
                            target: target_id.clone(),
                        });
                        *link_counts.entry(n.id.clone()).or_insert(1) += 1;
                        *link_counts.entry(target_id.clone()).or_insert(1) += 1;
                    }
                }
            }
        }
    }

    let nodes = notes
        .iter()
        .map(|n| {
            let val = *link_counts.get(&n.id).unwrap_or(&1);
            GraphNode {
                id: n.id.clone(),
                label: n.title.clone(),
                val,
                color: None,
            }
        })
        .collect();

    GraphData { nodes, links }
}
