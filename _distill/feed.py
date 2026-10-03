"""Keep RSS item IDs the same as the distill feed.

Runs as a Quarto `post-render` hook (see _quarto.yml). Distill wrote each
item's <guid> as https://yjunechoe.github.io/posts/<slug> and Quarto writes
https://yjunechoe.github.io/posts/<slug>/. Feed readers use the guid to
recognize items they have already seen, so without this every post would show
up again as new. New posts get the same form, so the feed stays consistent.
"""

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FEED = ROOT / os.environ.get("QUARTO_PROJECT_OUTPUT_DIR", "docs") / "blog.xml"


def main():
    if not FEED.exists():
        return 0
    text = FEED.read_text(encoding="utf8")
    fixed = re.sub(r"(<guid>[^<]*/posts/[^<]*?)/(</guid>)", r"\1\2", text)
    if fixed != text:
        FEED.write_text(fixed, encoding="utf8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
