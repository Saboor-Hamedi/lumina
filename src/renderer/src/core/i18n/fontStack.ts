/**
 * fontStack.ts
 *
 * Composes a full CSS font-family cascade for any user-selected font,
 * always appending the multilingual fallback chain (Persian/Arabic + CJK)
 * so glyphs render correctly even when the user's chosen font has no
 * coverage for those scripts.
 *
 * Note: the multilingual fallback fonts (Vazirmatn, PingFang SC, etc.) are
 * NOT monospace, but they're still appended in the `isMono` stack — a
 * monospace code font typically has zero Persian/Arabic/CJK glyph
 * coverage, so falling back to a proportional multilingual font is
 * strictly better than falling back to tofu boxes.
 */

const MULTILINGUAL_FALLBACK_STACK = [
  "'Vazirmatn'", // Persian/Arabic (modern, Notion-quality)
  "'Geeza Pro'", // Arabic on macOS
  "'Tahoma'", // Arabic/Persian on Windows fallback
  "'PingFang SC'", // Simplified Chinese on macOS
  "'Hiragino Sans'", // Japanese on macOS
  "'Microsoft YaHei'", // Simplified Chinese on Windows
  "'Yu Gothic UI'", // Japanese on Windows
  "'Malgun Gothic'", // Korean on Windows
];

const SYSTEM_UI_STACK = [
  "-apple-system",
  "BlinkMacSystemFont",
  "'Segoe UI Variable Text'",
  "'Segoe UI'",
  "Roboto",
];

const GENERIC_TAIL_SANS = "sans-serif";
const GENERIC_TAIL_MONO = "monospace";

/**
 * Builds a full font-family CSS value:
 *   [userFont] -> [system UI fonts, only for the non-mono stack]
 *              -> multilingual fallback chain -> generic family
 *
 * @param userFont  The user's selected font name (unquoted display name),
 *                   or undefined/empty to use "System Default".
 * @param isMono     Whether this is the monospace/editor-code stack.
 */
export function buildFontFamilyStack(
  userFont: string | undefined,
  isMono: boolean
): string {
  const parts: string[] = [];

  if (userFont && userFont.trim() && userFont !== "System Default") {
    const quoted = userFont.includes(" ") ? `'${userFont}'` : userFont;
    parts.push(quoted);
  }

  if (!isMono) {
    parts.push(...SYSTEM_UI_STACK);
  } else {
    // Keep a couple of common monospace fallbacks ahead of the
    // multilingual stack for code rendering.
    parts.push("'Cascadia Code'", "'Fira Code'", "Consolas");
  }

  parts.push(...MULTILINGUAL_FALLBACK_STACK);
  parts.push(isMono ? GENERIC_TAIL_MONO : GENERIC_TAIL_SANS);

  // De-duplicate while preserving order (in case userFont collides with a
  // fallback entry).
  const seen = new Set<string>();
  const deduped = parts.filter((p) => {
    const key = p.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.join(", ");
}
