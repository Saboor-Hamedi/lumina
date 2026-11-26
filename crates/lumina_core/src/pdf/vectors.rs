//! Compact Int8 vector quantization and Reciprocal Rank Fusion (RRF) utilities
//! for Lumina's hybrid PDF retrieval engine.
//!
//! Storing 384-dimensional MiniLM embeddings as symmetric Int8 + a single `f32`
//! scale factor reduces disk and memory footprint by ~4x (384 bytes vs 1,536 bytes
//! per chunk) while preserving >99.5% cosine similarity fidelity.

use std::collections::HashMap;

/// Default Reciprocal Rank Fusion constant (Cormack et al., 2009).
pub const RRF_K: f64 = 60.0;

/// Quantizes an `f32` embedding vector into symmetric signed `i8` bytes (stored
/// as raw `u8` for SQLite BLOB compatibility) plus a scalar `f32` scale factor.
pub fn quantize_f32_to_i8(values: &[f32]) -> (Vec<u8>, f32) {
    if values.is_empty() {
        return (Vec::new(), 1.0);
    }

    let max_abs = values
        .iter()
        .copied()
        .filter(|v| v.is_finite())
        .fold(0.0_f32, |acc, v| acc.max(v.abs()));

    if max_abs <= f32::EPSILON {
        return (vec![0u8; values.len()], 1.0);
    }

    let scale = max_abs / 127.0;
    let inv_scale = 127.0 / max_abs;
    let mut bytes = Vec::with_capacity(values.len());

    for &v in values {
        let clamped = if v.is_finite() {
            (v * inv_scale).round().clamp(-127.0, 127.0) as i8
        } else {
            0i8
        };
        bytes.push(clamped as u8);
    }

    (bytes, scale)
}

/// Computes cosine similarity between a quantized Int8 vector blob and an `f32`
/// query vector. Returns a value in `[-1.0, 1.0]`, or `0.0` on mismatch/zero norm.
pub fn cosine_similarity_i8_vs_f32(quantized: &[u8], scale: f32, query: &[f32]) -> f32 {
    if quantized.is_empty() || quantized.len() != query.len() || !scale.is_finite() || scale <= 0.0
    {
        return 0.0;
    }

    let mut dot = 0.0_f64;
    let mut norm_q = 0.0_f64;
    let mut norm_v = 0.0_f64;
    let s = scale as f64;

    for (&byte, &qv) in quantized.iter().zip(query.iter()) {
        let dv = (byte as i8) as f64 * s;
        let qf = if qv.is_finite() { qv as f64 } else { 0.0 };
        dot += dv * qf;
        norm_v += dv * dv;
        norm_q += qf * qf;
    }

    let denom = norm_v.sqrt() * norm_q.sqrt();
    if denom <= 1e-12 {
        return 0.0;
    }

    (dot / denom).clamp(-1.0, 1.0) as f32
}

/// Computes a single Reciprocal Rank Fusion contribution for a 1-based rank.
#[inline]
pub fn rrf_score(rank_1_based: usize, k: f64) -> f64 {
    1.0 / (k + rank_1_based as f64)
}

/// Match provenance returned by hybrid RRF fusion.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FusionMatchKind {
    Keyword,
    Semantic,
    Hybrid,
}

impl FusionMatchKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            FusionMatchKind::Keyword => "keyword",
            FusionMatchKind::Semantic => "semantic",
            FusionMatchKind::Hybrid => "hybrid",
        }
    }
}

/// Fuses ranked chunk IDs from keyword (BM25) and semantic (vector) retrieval
/// using Reciprocal Rank Fusion. Returns `(chunk_id, fused_score, match_kind)`
/// sorted by descending score.
pub fn fuse_ranked_lists(
    keyword_ids: &[i64],
    semantic_ids: &[i64],
    limit: usize,
) -> Vec<(i64, f64, FusionMatchKind)> {
    let mut scores: HashMap<i64, (f64, bool, bool)> = HashMap::new();

    for (idx, &id) in keyword_ids.iter().enumerate() {
        let entry = scores.entry(id).or_insert((0.0, false, false));
        entry.0 += rrf_score(idx + 1, RRF_K);
        entry.1 = true;
    }

    for (idx, &id) in semantic_ids.iter().enumerate() {
        let entry = scores.entry(id).or_insert((0.0, false, false));
        entry.0 += rrf_score(idx + 1, RRF_K);
        entry.2 = true;
    }

    let mut merged: Vec<(i64, f64, FusionMatchKind)> = scores
        .into_iter()
        .map(|(id, (score, has_kw, has_sem))| {
            let kind = match (has_kw, has_sem) {
                (true, true) => FusionMatchKind::Hybrid,
                (true, false) => FusionMatchKind::Keyword,
                _ => FusionMatchKind::Semantic,
            };
            (id, score, kind)
        })
        .collect();

    merged.sort_by(|a, b| {
        b.1.partial_cmp(&a.1)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.0.cmp(&b.0))
    });
    merged.truncate(limit);
    merged
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quantize_and_cosine_preserves_direction() {
        let v: Vec<f32> = (0..384)
            .map(|i| ((i as f32 * 0.13).sin() * 0.5) + ((i as f32 * 0.07).cos() * 0.25))
            .collect();
        let (bytes, scale) = quantize_f32_to_i8(&v);
        assert_eq!(bytes.len(), 384);
        let sim = cosine_similarity_i8_vs_f32(&bytes, scale, &v);
        assert!(sim > 0.995, "Expected >0.995 cosine similarity, got {sim}");
    }

    #[test]
    fn cosine_handles_mismatch_and_zero_vectors() {
        let (bytes, scale) = quantize_f32_to_i8(&[0.0, 0.0, 0.0]);
        assert_eq!(cosine_similarity_i8_vs_f32(&bytes, scale, &[1.0, 0.0, 0.0]), 0.0);
        assert_eq!(cosine_similarity_i8_vs_f32(&bytes, scale, &[1.0, 0.0]), 0.0);
    }

    #[test]
    fn rrf_fusion_boosts_items_matching_both_signals() {
        let kw = vec![10, 20, 30];
        let sem = vec![20, 40, 10];
        let fused = fuse_ranked_lists(&kw, &sem, 5);
        assert_eq!(fused[0].0, 20);
        assert_eq!(fused[0].2, FusionMatchKind::Hybrid);
        assert_eq!(fused[1].0, 10);
        assert_eq!(fused[1].2, FusionMatchKind::Hybrid);
    }
}
