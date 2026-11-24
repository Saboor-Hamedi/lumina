# Lumina Smart Links, Hover Previews, Grids & Cinema Player

Lumina turns external URLs — websites, YouTube videos, Pinterest pins, X/Twitter posts, Reddit threads, TikToks, Spotify tracks, GitHub repos, and more — into fast, zero-bloat interactive previews without leaving your note.

---

## 1. Named Links (`[Google](url)`) in Paragraphs, Lines & Tables (Smart Hover Dropdown)

Whenever you write a named Markdown link like `[Google](https://www.google.com)` or `[Twitter](https://x.com/...)` — whether inside a paragraph, on its own line, or inside a **Table column** — it stays as a clean clickable word (**Google** / **Twitter**), never hijacked into a card:

```markdown
Check out [Google](https://www.google.com) or this thread on [Twitter](https://x.com/BenjaminDEKR/status/2124981146136072686).
```

- **Smart Hover Dropdown Card**: Hovering over **Google**, **Twitter**, or **YouTube** (including bold `**[Google](url)**` and links inside **Tables**) shows a pointer cursor and opens a clean, flat, high-contrast floating preview card strictly inside the editor bounds (never bleeding over sidebars). It automatically flips above or below the text based on available space and stays open when you move into the card to **Copy**, **Open**, **Peek**, or **Play**.
- **Tables**: Pasting `[Youtube](https://www.youtube.com/watch?v=...)`, `[Google](https://www.google.com)`, or a bare `https://...` URL into any table cell renders cleanly without breaking column widths, supports the **Smart Hover Dropdown Card** on hover, and opens YouTube links in the **Borderless 16:9 Cinema Modal**.
- **Click behavior**:
  - Clicking a **YouTube** link opens the **Borderless 16:9 Cinema Modal** (unless disabled in Settings).
  - Clicking any other link opens it in your default browser.

---

## 2. Standalone Bare URLs (Smart Link Strips — Mermaid-Style Lock)

Place a bare URL or autolink on its own line:

```markdown
https://www.pinterest.com/pin/123456789/
<https://github.com/tauri-apps/tauri>
```

- Renders as a **full-width, zero-jump Smart Link Strip** with platform accent, favicon/badge, title, source/author, hover actions (**Peek**, **Copy**, **Open**, **Edit Source**), and a right-aligned thumbnail.
- **Mermaid-Style Preview Lock**: Clicking on or near the preview strip will **never** accidentally flip it back to raw source. Click the **Edit Source** button on the strip to edit the raw URL; moving your cursor away (or pressing `Esc`) smoothly returns it to preview with zero layout jump.
- **Visual Media Peek**: Clicking the thumbnail (or the eye **Peek** button) on a Pinterest pin, social post, or article with a preview image opens a **borderless high-resolution image lightbox** right inside Lumina (`Esc` or click backdrop to close).

---

## 3. Side-by-Side Link Grids (1, 2, or 3 Columns Max)

To display 1, 2, or 3 link cards side-by-side (great for moodboards, YouTube playlists, research dashboards, or social bookmark shelves), use a `links` fenced block with an optional column count (`1`, `2`, or `3`):

````markdown
```links 3
https://www.youtube.com/watch?v=dQw4w9WgXcQ
[Twitter](https://x.com/BenjaminDEKR/status/2124981146136072686)
https://www.pinterest.com/pin/123456789/
```
````

- ` ```links ` (no number) automatically picks `1–3` columns based on the number of links inside, using the **exact same flat card layout** as standalone pasted URLs.
- Flexible header syntax: ` ```link 2 `, ` ```links 2 `, ` ``` links 3 `, ` ```link-grid 2 `, and ` ```links-grid 3 ` all work.
- Any number above `3` (e.g., ` ```links 100 `) safely clamps to **3 columns** (and `0` clamps to `1`).
- Click the hover **Edit** icon on the top-right of the grid to enter Source mode; click **Preview** or press `Esc` when finished.
- **Global Grid Mode**: You can also set **Settings → Look & Feel → Link & YouTube Cards → Grid Columns** to `2` or `3` to automatically group consecutive standalone link lines into side-by-side cards.

---

## 4. Borderless 16:9 YouTube Cinema Player

Any valid YouTube URL works (`youtube.com/watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`, `/live/`), including timestamps (`?t=90`, `?t=1m30s`, `?start=45`):

- Opens in a large, borderless 16:9 cinema iframe modal using privacy-enhanced `youtube-nocookie.com`.
- Hover the top-right corner for subtle **Open on YouTube** and **Close** buttons.
- Press `Esc` or click outside to close — audio stops immediately.

---

## 5. Supported Social & Media Platforms

Lumina fetches metadata natively in Rust (CORS-free) using official oEmbed endpoints and OpenGraph preview headers:

| Platform | Metadata & Preview |
| --- | --- |
| **YouTube** | Real video title, channel author, HQ thumbnail, borderless 16:9 cinema modal |
| **Pinterest** (`pinterest.*`, `pin.it`) | Pin title, author, high-res pin thumbnail, borderless Visual Media Peek |
| **X / Twitter** (`x.com`, `twitter.com`) | Post author, title/excerpt, oEmbed & preview card |
| **Instagram / Threads** | Title, description, preview image & Visual Media Peek |
| **Reddit** | Post title, subreddit/author, preview card |
| **TikTok / Vimeo / Spotify** | Title, creator, thumbnail via oEmbed |
| **Any Website** | `og:title`, `og:description`, `og:image`, `og:site_name`, favicon |

---

## 6. Customization (`Settings → Look & Feel → Link & YouTube Cards`)

Users can customize every aspect live with zero lag:

- **Rich Link Preview Cards**: Master toggle on/off.
- **Link Style**: `Smart Strip (Default)` · `Compact Card` · `Minimal Bar`.
- **Grid Columns**: `1` (Full-Width Strips) · `2` · `3` · `4`.
- **Card Width**: `Full Width (100%)` · `Medium (680px)` · `Compact (520px)`.
- **Card Size**: `Compact` · `Default` · `Large`.
- **Thumbnail Position**: `Right (Default)` · `Left` · `Hidden`.
- **Show Description**: Show or hide the secondary description/path line.
- **YouTube Borderless Player**: Toggle between the in-app cinema modal and opening in the default browser.

---

## 7. URL Validation & Safety

- Only well-formed `http://` and `https://` URLs with valid domains are rendered or fetched.
- Malformed/shorthand hosts (`https://00`, `https://0.0.0.0`, `https://123456`), embedded credentials (`user@host`), control characters/`%00`, URLs over **2048 characters**, and URLs with over **64 path segments** are safely ignored and remain plain text.
