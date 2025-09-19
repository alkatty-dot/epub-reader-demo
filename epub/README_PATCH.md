
# EPUB Reader Patch (non-breaking)

This patch helps your current bundle work without changing core logic.

## What it does
1) Adds `viewer_event` overlay inside `#viewer` so your swipe handlers in `index.js` won't crash when the element is missing.
2) Calls `EPUBReader.init('viewer', <bookUrl>)` automatically. It reads `?book=...` from the query string; otherwise defaults to `外公睡著了.epub` in the same folder.
3) Adds minimal CSS (`overlay.css`) so the overlay is positioned correctly.

## How to apply (safe)
- Upload `bootstrap.js` and `overlay.css` into the same folder as `epub.html`.
- In `epub.html`, before `</head>` add:
  <link rel="stylesheet" href="overlay.css" />

- In `epub.html`, before `</body>` add:
  <script defer src="bootstrap.js"></script>

## Optional (clean-up / recommended)
- If `../data.js` and `../get_data.js` are not actually used, remove those two `<script>` tags to avoid 404s in the console.
- Make sure your `.epub` asset is in the same directory (or provide `?book=path/to/book.epub` in the URL).
- If hosting on GitHub Pages, keep the book path within the repo (no `../` parent paths) to avoid CORS/404 issues.
