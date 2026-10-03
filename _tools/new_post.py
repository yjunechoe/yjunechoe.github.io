"""Start a new blog post with the site's front matter.

    uv run _tools/new_post.py "Post title" --categories ggplot2 tutorial
    uv run _tools/new_post.py "Post title" --draft    # hidden until you delete `draft: true`
    uv run _tools/new_post.py "Post title" --julia    # also set up {julia} chunks

Creates posts/YYYY-MM-DD-<slug>/index.qmd and prints the preview command.
Refuses to overwrite an existing folder.
"""

import argparse
import datetime
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FRONT_MATTER = """\
---
title: {title}
description: ""
author:
- name: June Choe
  orcid: 0000-0002-0701-921X
date: '{date}'
categories:
{categories}
# image: thumbnail.png    # your own thumbnail for the listing and share cards
{draft}---
"""

DRAFT = """\
# Hidden from the blog listing, search, sitemap and feed until you delete this line
draft: true
"""

JULIA_SETUP = """
```{r}
#| include: false
# Run {julia} chunks with JuliaConnectoR, using this folder's Project.toml
source("../../_tools/julia.R")
```
"""

BODY = """
Write the post here.

```{r}
1 + 1
```
"""

JULIA_BODY = """
```{julia}
1 + 1
```
"""


def slugify(title):
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug or "post"


def yaml_string(s):
    # Quote titles so colons, braces and the like don't break the YAML
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("title")
    parser.add_argument("--categories", nargs="*", default=[])
    parser.add_argument("--draft", action="store_true", help="add `draft: true` so the post stays hidden")
    parser.add_argument("--julia", action="store_true", help="add a Project.toml and the {julia} engine setup")
    parser.add_argument("--date", default=datetime.date.today().isoformat(), help="YYYY-MM-DD (default: today)")
    args = parser.parse_args()

    folder = ROOT / "posts" / f"{args.date}-{slugify(args.title)}"
    if folder.exists():
        sys.exit(f"{folder.relative_to(ROOT)} already exists")
    folder.mkdir(parents=True)

    categories = "\n".join(f"- {c}" for c in args.categories) or "- uncategorized"
    text = FRONT_MATTER.format(title=yaml_string(args.title), date=args.date, categories=categories,
                               draft=DRAFT if args.draft else "")
    if args.julia:
        text += JULIA_SETUP
        (folder / "Project.toml").write_text("[deps]\n", encoding="utf8")
    text += BODY + (JULIA_BODY if args.julia else "")
    (folder / "index.qmd").write_text(text, encoding="utf8")

    rel = (folder / "index.qmd").relative_to(ROOT).as_posix()
    print(f"Created {rel}")
    if args.julia:
        print(f"Add Julia packages with: julia --project={folder.relative_to(ROOT).as_posix()} -e \"using Pkg; Pkg.add(\\\"DataFrames\\\")\"")
    print(f"Preview while writing:  quarto preview {rel}")


if __name__ == "__main__":
    main()
