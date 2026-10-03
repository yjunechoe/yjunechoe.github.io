# /// script
# requires-python = ">=3.10"
# dependencies = ["beautifulsoup4==4.13.4"]
# ///
"""Check that every distill-era post made it into the rendered site.

Runs as the Quarto `post-render` hook on full renders (see _quarto.yml), or by
hand from the repo root:  uv run _distill/check.py

Fails (exit 1) if a post in _distill/posts/ has no page in the output, or if a
wrapped post's article text differs from the distill original by more than
1% of its words. Live posts (promoted to their own index.qmd) are reported but
never fail, since they are expected to change. Broken local links are listed
as warnings.
"""

import os
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / "_distill" / "posts"
SITE = ROOT / os.environ.get("QUARTO_PROJECT_OUTPUT_DIR", "docs")
TOLERANCE = 0.01


def words(el):
    return len(el.get_text(" ", strip=True).split()) if el else 0


def main():
    # Quarto sets QUARTO_PROJECT_RENDER_ALL=1 on full renders and leaves it unset
    # on partial ones (a single post, preview), when the output dir is incomplete.
    # Run by hand (no Quarto variables at all), always check.
    from_quarto = "QUARTO_PROJECT_OUTPUT_DIR" in os.environ
    if from_quarto and os.environ.get("QUARTO_PROJECT_RENDER_ALL") != "1":
        return 0

    failures, notes = [], []
    for old in sorted(SNAPSHOT.glob("*/index.html")):
        slug = old.parent.name
        new = SITE / "posts" / slug / "index.html"
        if not new.exists():
            failures.append(f"missing    {slug}")
            continue
        live = not (ROOT / "posts" / slug / ".gitignore").is_file()
        a = BeautifulSoup(old.read_text(encoding="utf8"), "html.parser").select_one("div.d-article")
        for sel in ("div.d-contents", "div.article-footer"):
            for t in a.select(sel):
                t.decompose()
        b = BeautifulSoup(new.read_text(encoding="utf8"), "html.parser").select_one("#quarto-document-content")
        # Quarto's citation/reuse/copyright appendix sections are not article text
        # (footnotes also move into the appendix, so keep the rest of it)
        for sel in ("#title-block-header", "nav#TOC", ".code-copy-button",
                    "#quarto-citation", "#quarto-reuse", "#quarto-copyright"):
            for t in b.select(sel):
                t.decompose()
        wa, wb = words(a), words(b)
        drift = abs(wa - wb) / max(wa, 1)
        if live:
            notes.append(f"live       {slug}: {wa} -> {wb} words")
        elif drift > TOLERANCE:
            failures.append(f"drift      {slug}: {wa} -> {wb} words")

    missing = []
    for page in sorted(SITE.rglob("*.html")):
        soup = BeautifulSoup(page.read_text(encoding="utf8"), "html.parser")
        for t in soup.find_all(["img", "script", "link", "a", "source", "iframe"]):
            ref = t.get("src") or t.get("href")
            if not ref or re.match(r"^(https?:|mailto:|#|data:|javascript:|//)", ref):
                continue
            path = unquote(urlparse(ref).path)
            target = (SITE / path.lstrip("/")) if ref.startswith("/") else (page.parent / path)
            target = target.resolve()
            if target.is_dir():
                target = target / "index.html"
            if not target.exists():
                missing.append(f"{page.relative_to(SITE).as_posix()} -> {ref}")

    n = len(list(SNAPSHOT.glob("*/index.html")))
    print(f"_distill/check.py: {n - len(failures)}/{n} distill-era posts OK")
    for line in notes:
        print(f"  {line}")
    for line in missing:
        print(f"  warning: broken local link {line}")
    for line in failures:
        print(f"  FAIL {line}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
