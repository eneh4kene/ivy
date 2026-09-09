# Ivy brand marks

The vine mark. Ivy has no face — her form is the vine (see `docs/ivy-canon.md` §6),
so these carry the whole visual identity.

- `vine-avatar.html` → `ivy-avatar-512.png` (512×512, X profile picture)
- `vine-header.html` → `ivy-header-1500x500.png` (1500×500, X header)

Both are hand-authored SVG on the design-constitution palette: lumen `#46f0c8` /
`#9ffbe4` on abyss `#010507`, one accent, no gold. The avatar's four leaves
brighten toward the crown (oldest dimmest) and the tip is a bud — kept days and
today's unkept day, the same grammar the product uses. The header is deliberately
focal-object-free so it survives X's crops at every viewport.

## Regenerate

    NODE_PATH=<repo>/frontend/node_modules node docs/content/brand/render.js docs/content/brand

Playwright lives in `frontend/node_modules`, not the root — hence the NODE_PATH.
