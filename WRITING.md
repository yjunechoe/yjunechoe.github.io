# Writing a blog post

How to write and publish a post on the Quarto site. Tested with Quarto 1.10.18, R 4.6.1 and Julia 1.10.5 on Windows.

## One-time setup

- Quarto 1.10 or newer, R, and [uv](https://docs.astral.sh/uv/) (the build hooks in `_distill/` are Python scripts run with `uv run`).
- If R is not on your PATH, create `_environment.local` (gitignored) with `QUARTO_R=C:/Program Files/R/R-4.6.1/bin`.

## New post

1. Start it with the script, which makes `posts/YYYY-MM-DD-<slug>/index.qmd` with the front matter below. The folder name becomes the URL.

   ```bash
   uv run _tools/new_post.py "Post title" --categories ggplot2 tutorial
   ```

   Add `--draft` to start it in `drafts/` instead, or `--julia` to also set up Julia chunks. Or make the folder and `index.qmd` by hand:

   ````markdown
   ---
   title: "Post title"
   description: One line shown under the title and in the blog listing
   author:
   - name: June Choe
     orcid: 0000-0002-0701-921X
   date: '2026-10-02'
   categories:
   - ggplot2
   - tutorial
   image: thumbnail.png
   ---

   Text and code chunks go here.

   ```{r}
   1 + 1
   ```
   ````

2. Put images, data and a `refs.bib` in the same folder and refer to them by plain relative paths.
3. Preview while you write: `quarto preview posts/YYYY-MM-DD-short-slug/index.qmd`. It re-runs the code and reloads the page on every save.
4. Publish: `quarto render` (the whole site), then commit the post folder, `_freeze/`, and `docs/`. GitHub Pages serves `docs/`.

You don't need the old setup chunk. `posts/_metadata.yml` sets knitr options for every post: no messages, no warnings, `width = 80`. Output lines have no `##` prefix, which is Quarto's default. Don't add `comment` to `_metadata.yml`: Quarto treats its value as a relative path and turns `" "` into `"../ "`.

Keep `author` in each post's front matter. Putting it in `posts/_metadata.yml` instead lists the author twice in the citation for posts that set their own.

## How code execution works

- `freeze: auto` stores each post's results in `_freeze/`. A full `quarto render` reuses them and only re-runs a post whose `index.qmd` changed. Any change counts, including a typo fix in the prose.
- Rendering or previewing a single post always re-runs its code. For a slow chunk you're not changing, add `#| cache: true` to skip it on later runs.
- Because `_freeze/` is committed, the site builds on a machine without R, Julia, or the post's packages.

## Front matter you might use

| Need | Front matter or syntax |
|---|---|
| Thumbnail in the listing and social cards | `image: thumbnail.png`. Without it, Quarto uses the first image in the post. |
| Citations | `bibliography: refs.bib`, then `[@key]` in text. |
| No table of contents | `toc: false` |
| Extra CSS for one post | `css: style.css`, or a `{css}` chunk |
| Hide a post while working on it | `draft: true` (see Drafts below). |

## Distill habits and their Quarto versions

| Distill | Quarto |
|---|---|
| `<aside>` | `::: {.column-margin}` ... `:::` |
| `layout="l-body-outset"` / `l-page` / `l-screen` | `#| column: body-outset` / `page` / `screen` |
| xaringanExtra panelset | `::: {.panel-tabset}` with `###` headings for the tabs |
| xaringanExtra clipboard | Built in (copy button on every code block) |
| `preview: x.png` | `image: x.png` |
| Footnotes `^[...]` | Same, and they show on hover |

New things that distill didn't have: callouts (`::: {.callout-note}`), cross-references (`#| label: fig-x` then `@fig-x`), and code folding (`#| code-fold: true`).

## R and Julia in the same post

Use the normal knitr engine and run `{julia}` chunks through JuliaConnectoR:

1. Add a `Project.toml` to the post folder listing the Julia packages, then install them once:
   `julia --project=posts/YYYY-MM-DD-short-slug -e "using Pkg; Pkg.instantiate()"`
2. In the post, load the engine before the first Julia chunk:

   ````markdown
   ```{r}
   #| include: false
   source("../../_tools/julia.R")
   ```
   ````

3. Write ```` ```{julia} ```` chunks as usual. Variables persist across chunks. A chunk shows its printed output plus the value of its last line. End the last line with `;` to hide the value.
4. Pass data from R to Julia with `JuliaConnectoR::juliaLet("global mpg = x", x = mtcars$mpg)`.
5. `#| error: true` works in Julia chunks and shows the Julia error in the post. `_tools/julia.R` has to handle this itself, because knitr only catches errors in R chunks ([knitr#2389](https://github.com/yihui/knitr/issues/2389)).

`_tools/julia.R` shows text output only. Plots made in Julia are not supported.

Why a custom engine: Quarto runs R through knitr, and a document can use only one engine. knitr's built-in `{julia}` engine uses JuliaCall. No package provides a JuliaConnectoR engine yet ([JuliaConnectoR#28](https://github.com/stefan-m-lenz/JuliaConnectoR/issues/28) is an open request).

### A post that is all Julia

Use Quarto's native Julia engine instead. Put `engine: julia` in the front matter and a `Project.toml` in the post folder. Quarto installs its runner the first time.

On Quarto 1.10.18, a cell that shows an image and also returns a value crashes the render with `textPlain.some is not a function`. End such cells with `;`. This is a Quarto bug.

### What didn't work

- **JuliaCall** (used by the 2022 DataFrames.jl post). `julia_setup()` hung inside the R process.
- **R cells inside the native Julia engine** (through RCall). Every R plot hits the bug above, and the `;` workaround isn't available in R cells. An htmlwidget prints as a raw Julia dictionary.

## Runnable R in the reader's browser (optional)

The [quarto-live](https://r-wasm.github.io/quarto-live/) extension runs R in the reader's browser through webR, with no server. It is not installed yet. Tested 2026-10-03 inside this site's blog setup with quarto-live 0.1.3-dev:

1. Once: `quarto add r-wasm/quarto-live` from the repo root. This adds `_extensions/`, which you commit.
2. In the post's front matter: `format: live-html` and, for R packages the reader's browser should load, `webr: {packages: [ggplot2]}`.
3. Right after the front matter: `{{< include ../../_extensions/r-wasm/live/_knitr.qmd >}}`.
4. Write ```` ```{webr} ```` chunks. Readers can edit and run them. Add `#| autorun: true` to run one on page load. Normal ```` ```{r} ```` chunks still run at render time.

The first visit downloads webR, which took about 25 seconds here.

## Pages built from data

- **Software** cards come from `software.yml`, drawn by `software.ejs`.
- **Research** publication and talk lists come from `research.yml`, drawn by `research.ejs`. Each entry's `section` picks its list, and "June Choe" is bolded automatically.

To add a package, paper or talk, add an entry to the YAML file. You don't need to edit the page.

## Drafts

There are two places for unfinished posts.

**A post you're working on** lives in `posts/` with `draft: true` in its front matter (`uv run _tools/new_post.py "Title" --draft` adds it). This is Quarto's own draft feature:

- `quarto preview posts/<slug>/index.qmd` shows it like any post, with a draft banner.
- A full `quarto render` leaves only an empty placeholder page in `docs/`, and keeps it out of the blog listing, search, sitemap and feed.
- To publish, delete the `draft: true` line and render.

A full render still runs a draft's code (and freezes it), so the draft's code must run without errors.

**Parked drafts** live in `drafts/<slug>/`, which is outside the render list, so nothing there runs or gets published. The 8 drafts converted from distill are there; some depend on things that no longer exist (for example, a scraped web page that's gone). To pick one back up, move its folder into `posts/` (it already has `draft: true`) and preview it.

## Known quirks

- Code annotations (`# <1>` markers) and `code-line-numbers` don't work together with `code-link: true`, which the site turns on. To use either in a post, set `code-link: false` in its front matter.
- A full render rebuilds the 37 distill-era posts from `_distill/`. See `_distill/README.md`.
- On Windows, a full render can fail with `os error 1224` ("a file with a user-mapped section open") if another program holds a file in `docs/` open, such as a separate local web server serving `docs/`. Stop it and render again. `quarto preview` itself doesn't cause this.
