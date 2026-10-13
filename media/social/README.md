# Social and site brand assets

Designed in Paper: Rovn file, **Social Media** page. `export/` holds the files to upload; `src/` holds inputs.

| File | Use |
|---|---|
| `mark-400.png` | LinkedIn logo, X avatar |
| `ph-thumb-240.png` | Product Hunt thumbnail |
| `x-header-1500x500.jpg` | X header |
| `linkedin-cover-4200x700.jpg` | LinkedIn company cover |
| `og-1200x630.png` | Open Graph / Twitter card (site uses a quantized copy) |
| `ph-gallery-1…5-*.png` | Product Hunt gallery, 1270×760, in order (UI elements from the Rovn Decks file, no phones) |
| `icon.svg`, `favicon.ico`, `icon-*.png`, `apple-touch-icon.png`, `logo-512.png` | Website icons (copied into rovn-j01 `apps/www/public`) |

- Paper exports are Display P3: convert with `sips -m "/System/Library/ColorSync/Profiles/sRGB Profile.icc"` before uploading.
- Icons: edit `export/icon.svg` (rounded tile) or `src/icon-square.svg` (full bleed), then `node prototypes/media/social/render_icons.mjs`.

**Photo** (OG, X header, LinkedIn cover, PH gallery 1): Thirdman, Pexels License, https://www.pexels.com/photo/medical-professionals-looking-at-the-screen-of-the-cellphone-5327867/ (sandbox `media/photos/team-phone`, graded warm in `src/photo-team-phone-warm.jpg`).
