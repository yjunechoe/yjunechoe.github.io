# Distill-era archive

This folder keeps the blog posts that were published with distill (2020 to 2025), so the Quarto site can serve them as they were rendered at the time. Quarto ignores this folder because its name starts with `_`.

- `posts/<slug>/`: the rendered distill output for each published post (a copy of `docs/posts/` from the last distill build, before `docs/` switched to the Quarto output).
- `site_libs/`: the shared JavaScript and CSS libraries those pages load (htmlwidgets, panelsets, paged tables).
- `wrap.py`: runs before every render (the `pre-render` hook in `_quarto.yml`). It rebuilds `posts/<slug>/index.qmd` for each post here, by placing the distill article HTML inside a Quarto page.
- `feed.py`: runs after every render (`post-render`). It rewrites RSS item IDs to the distill form (no trailing slash), so feed readers don't show old posts again as new.
- `check.py`: runs after every full render (the `post-render` hook). The render fails if a post here has no page in the site, or if a wrapped post's text differs from the distill original by more than 1% of its words.

Every file in a snapshot post folder is published, including figures no page shows any more, so URLs that worked on the distill site keep working. The only distill-era files not published are distill's own `site_libs/` and its `posts.json` listing data.

Treat the snapshot and `wrap.py` as frozen. Changing either one changes how every legacy post looks.

## Generated folders

Each `posts/<slug>/` folder made by `wrap.py` contains a `.gitignore` with `*`, so git ignores the whole folder. `distill_libs/` works the same way. Delete them at any time; the next render rebuilds them.

A `posts/<slug>/` folder without that `.gitignore` is a live post. `wrap.py` never touches it.

## Moving a post to live rendering

```bash
uv run _tools/promote.py 2024-06-09-ave-for-the-average
```

This converts `_posts/<slug>/*.Rmd` into `posts/<slug>/index.qmd`. From then on the post renders from source. The snapshot here stays as it is, and `check.py` reports the live post's word count without failing on it.
