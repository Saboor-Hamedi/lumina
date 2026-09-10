/**
 * textNormalization.ts
 *
 * Centralized Unicode / script normalization + bidi direction detection for
 * Lumina. Two normalization "strengths" are exposed on purpose:
 *
 *   - matching strength  -> used for search / autocomplete filtering
 *   - canonical strength  -> used for wikilink target keys / graph identity
 *
 * IMPORTANT: canonical normalization produces a *lookup key* only. Never use
 * its output to overwrite a user-visible title.
 */

// ---------------------------------------------------------------------------
// Unicode ranges
// ---------------------------------------------------------------------------

// Strong RTL scripts: Hebrew, Arabic, Arabic Supplement, Arabic Extended-A,
// Arabic Presentation Forms A/B, Syriac, Thaana (Urdu uses Arabic script).
const RTL_RANGES: [number, number][] = [
  [0x0590, 0x05ff], // Hebrew
  [0x0600, 0x06ff], // Arabic
  [0x0700, 0x074f], // Syriac
  [0x0750, 0x077f], // Arabic Supplement
  [0x0780, 0x07bf], // Thaana
  [0x08a0, 0x08ff], // Arabic Extended-A
  [0xfb1d, 0xfb4f], // Hebrew Presentation Forms
  [0xfb50, 0xfdff], // Arabic Presentation Forms-A
  [0xfe70, 0xfeff], // Arabic Presentation Forms-B
];

// Weak/neutral: whitespace, punctuation, and BOTH ASCII and
// Arabic-Indic / Extended Arabic-Indic digits. Digits do not carry strong
// directionality on their own.
const WEAK_RANGES: [number, number][] = [
  [0x0009, 0x000d], // tab/newline/CR
  [0x0020, 0x0040], // space, punctuation, ASCII digits 0-9
  [0x005b, 0x0060], // [ \ ] ^ _ `
  [0x007b, 0x007e], // { | } ~
  [0x0660, 0x0669], // Arabic-Indic digits
  [0x06f0, 0x06f9], // Extended Arabic-Indic digits (Persian digits)
  [0x200e, 0x200f], // LRM/RLM marks themselves are directional controls, not content
  [0x2000, 0x206f], // general punctuation
];

// Strong LTR: treat Latin, Greek, Cyrillic, and CJK ideographs/kana/hangul
// as strong-LTR for the purposes of line-level direction detection (this
// matches how browsers resolve dir="auto" in practice for mixed content).
const LTR_RANGES: [number, number][] = [
  [0x0041, 0x005a],
  [0x0061, 0x007a], // Basic Latin letters
  [0x00c0, 0x02af], // Latin extended
  [0x0370, 0x03ff], // Greek
  [0x0400, 0x04ff], // Cyrillic
  [0x3040, 0x30ff], // Hiragana/Katakana
  [0x3400, 0x4dbf], // CJK ext A
  [0x4e00, 0x9fff], // CJK unified
  [0xac00, 0xd7af], // Hangul
  [0xf900, 0xfaff], // CJK compatibility ideographs
];

function inRanges(code: number, ranges: [number, number][]): boolean {
  for (const [start, end] of ranges) {
    if (code >= start && code <= end) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Character classification
// ---------------------------------------------------------------------------

export type CharDirection = "rtl" | "ltr" | "weak";

export function isRTLChar(char: string): boolean {
  if (!char) return false;
  const code = char.codePointAt(0);
  if (code === undefined) return false;
  return inRanges(code, RTL_RANGES);
}

export function isStrongLTRChar(char: string): boolean {
  if (!char) return false;
  const code = char.codePointAt(0);
  if (code === undefined) return false;
  return inRanges(code, LTR_RANGES);
}

function isWeakChar(char: string): boolean {
  if (!char) return false;
  const code = char.codePointAt(0);
  if (code === undefined) return true;
  if (inRanges(code, WEAK_RANGES)) return true;
  // Combining marks / diacritics (tashkeel etc.) are weak for direction
  // purposes even though they're not in the punctuation ranges above.
  if (code >= 0x064b && code <= 0x0652) return true; // Arabic tashkeel
  if (code === 0x0670) return true; // superscript alef
  if (code >= 0x06d6 && code <= 0x06ed) return true; // Quranic annotation marks
  return false;
}

export function isRTLText(text: string): boolean {
  const dir = getFirstStrongDirection(text);
  return dir === "rtl";
}

/**
 * Scans `text` left-to-right (in logical/source order) and returns the
 * direction of the first STRONG character, skipping:
 *  - wikilink syntax `[[` / `]]`
 *  - inline code spans delimited by `` ` ``
 *  - digits (ASCII, Arabic-Indic, Extended Arabic-Indic)
 *  - punctuation/whitespace/diacritics
 *
 * Falls back to "weak" (caller should treat as LTR) if no strong character
 * is found.
 */
export function getFirstStrongDirection(text: string): CharDirection {
  if (!text) return "weak";

  let i = 0;
  const len = text.length;
  let inInlineCode = false;

  while (i < len) {
    // Skip wikilink bracket syntax entirely.
    if (text[i] === "[" && text[i + 1] === "[") {
      i += 2;
      continue;
    }
    if (text[i] === "]" && text[i + 1] === "]") {
      i += 2;
      continue;
    }

    // Toggle through inline code spans without inspecting their content
    // for direction (code is conventionally LTR-neutral punctuation-heavy;
    // let the surrounding prose decide the line direction).
    if (text[i] === "`") {
      inInlineCode = !inInlineCode;
      i += 1;
      continue;
    }
    if (inInlineCode) {
      i += 1;
      continue;
    }

    const char = [...text.slice(i, i + 2)][0]; // handle surrogate pairs
    const charLen = char.length;

    if (isRTLChar(char)) return "rtl";
    if (isStrongLTRChar(char)) return "ltr";
    // else weak (digit, punctuation, whitespace, diacritic) -> keep scanning

    i += charLen;
  }

  return "weak";
}

// ---------------------------------------------------------------------------
// Unicode normalization
// ---------------------------------------------------------------------------

export function normalizeUnicode(str: string): string {
  return str.normalize("NFC");
}

export interface PersianArabicNormalizeOptions {
  /** Unify Arabic ي/ك to Persian ی/ک. Default true. */
  unifyToPersianForms?: boolean;
  /** Strip tashkeel/diacritics (fatha, kasra, damma, sukun, shadda...). Default true. */
  stripDiacritics?: boolean;
  /** Strip tatweel/kashida (ـ, U+0640). Default true. */
  stripTatweel?: boolean;
  /** Remove ZWNJ (U+200C) rather than treating it as a real character. Default true. */
  stripZWNJ?: boolean;
  /** Fold Teh Marbuta (ة) to Heh (ه). Default false — often meaning-changing;
   *  opt-in only for fuzzy matching, never for canonical keys by default. */
  foldTehMarbuta?: boolean;
  /** Case-fold Latin characters too, for mixed-script titles. Default true. */
  caseFoldLatin?: boolean;
}

const DEFAULT_NORMALIZE_OPTIONS: Required<PersianArabicNormalizeOptions> = {
  unifyToPersianForms: true,
  stripDiacritics: true,
  stripTatweel: true,
  stripZWNJ: true,
  foldTehMarbuta: false,
  caseFoldLatin: true,
};

/**
 * Normalizes Persian/Arabic script variance so that visually/semantically
 * equivalent strings compare equal. Deterministic direction: Arabic forms
 * fold TO Persian forms (never the reverse), so canonical keys converge
 * regardless of which variant the user typed.
 */
export function normalizePersianArabic(
  str: string,
  options: PersianArabicNormalizeOptions = {}
): string {
  const opts = { ...DEFAULT_NORMALIZE_OPTIONS, ...options };
  let out = normalizeUnicode(str);

  if (opts.unifyToPersianForms) {
    out = out
      .replace(/\u064A/g, "\u06CC") // Arabic Yeh ي -> Persian Yeh ی
      .replace(/\u0649/g, "\u06CC") // Alef Maksura ى -> Persian Yeh ی
      .replace(/\u0643/g, "\u06A9"); // Arabic Kaf ك -> Persian Keheh ک
  }

  if (opts.foldTehMarbuta) {
    out = out.replace(/\u0629/g, "\u0647"); // ة -> ه
  }

  if (opts.stripDiacritics) {
    // Tashkeel block + superscript alef + Quranic annotation marks.
    out = out.replace(/[\u064B-\u0652\u0670\u06D6-\u06ED]/g, "");
  }

  if (opts.stripTatweel) {
    out = out.replace(/\u0640/g, "");
  }

  if (opts.stripZWNJ) {
    out = out.replace(/\u200C/g, "");
  } else {
    // Normalize ZWNJ surrounded by whitespace variance but keep it present.
  }

  // Collapse runs of whitespace produced by stripping, trim ends.
  out = out.replace(/\s+/g, " ").trim();

  if (opts.caseFoldLatin) {
    out = out.toLowerCase();
  }

  return out;
}

// ---------------------------------------------------------------------------
// Matching (search / autocomplete) — aggressive, fuzzy-friendly
// ---------------------------------------------------------------------------

/**
 * Normalizes a string for MATCHING purposes only (search/autocomplete).
 * More aggressive than the canonical key: also folds Teh Marbuta, since
 * fuzzy search benefits from collapsing more variance than link identity
 * should.
 */
export function normalizeForMatching(str: string): string {
  return normalizePersianArabic(str, {
    unifyToPersianForms: true,
    stripDiacritics: true,
    stripTatweel: true,
    stripZWNJ: true,
    foldTehMarbuta: true,
    caseFoldLatin: true,
  });
}

/**
 * Substring/fuzzy match used by search ranking and wikilink autocomplete.
 * Returns true if `query` normalized is a substring of `target` normalized,
 * OR if all whitespace-separated query tokens appear in order (loose fuzzy).
 */
export function matchesNormalized(target: string, query: string): boolean {
  const nTarget = normalizeForMatching(target);
  const nQuery = normalizeForMatching(query);
  if (nQuery.length === 0) return true;
  if (nTarget.includes(nQuery)) return true;

  // Loose token-subsequence fallback for multi-word queries.
  const tokens = nQuery.split(" ").filter(Boolean);
  if (tokens.length <= 1) return false;
  let cursor = 0;
  for (const token of tokens) {
    const idx = nTarget.indexOf(token, cursor);
    if (idx === -1) return false;
    cursor = idx + token.length;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Canonical wikilink target key — deterministic, used for identity
// ---------------------------------------------------------------------------

/**
 * Produces a canonical LOOKUP KEY for a wikilink target / note title.
 *
 * This is NOT a display value. Never write this back over a user's title.
 * Store it as a separate `normalizedKey` field and index/resolve links by
 * it, so `[[یادداشت فارسی]]` and `[[يادداشت فارسي]]` resolve to the same
 * note without either title being silently rewritten.
 */
export function normalizeWikilinkTarget(target: string): string {
  const trimmed = target.trim();
  return normalizePersianArabic(trimmed, {
    unifyToPersianForms: true,
    stripDiacritics: true,
    stripTatweel: true,
    stripZWNJ: true,
    foldTehMarbuta: false, // identity should not collapse ة/ه distinction
    caseFoldLatin: true,
  });
}
