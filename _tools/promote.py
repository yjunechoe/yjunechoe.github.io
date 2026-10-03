# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml"]
# ///
"""Convert a distill post's Rmd source into a live Quarto post.

    uv run _tools/promote.py <slug>            # -> posts/<slug>/index.qmd
    uv run _tools/promote.py <slug> --draft    # -> drafts/<slug>/index.qmd
    uv run _tools/promote.py --all-drafts      # every unpublished post -> drafts/

The source is _posts/<slug>/*.Rmd. Promoting a published post replaces its
generated wrapper (see _distill/wrap.py); from then on the post renders from
its own index.qmd. The distill snapshot in _distill/posts/ stays as it is.

drafts/ holds parked drafts and is outside the render list, because Quarto
still runs a `draft: true` post's code during a full render. To work on one,
move its folder into posts/ (it keeps `draft: true`, so it stays hidden) and
preview it; delete `draft: true` to publish. See WRITING.md.

Conversions: distill YAML -> Quarto YAML, <aside> -> .column-margin,
layout="l-*" -> `#| column:`, xaringanExtra panelsets -> .panel-tabset,
`r Sys.Date()` dates -> the published date or the folder date.
"""

import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "_posts"
SNAPSHOT = ROOT / "_distill" / "posts"
MARKER = ".gitignore"

LAYOUT_TO_COLUMN = {
    "l-body-outset": "body-outset",
    "l-page": "page",
    "l-page-outset": "page",
    "l-screen": "screen",
    "l-screen-inset": "screen-inset",
}


def parse_date(x):
    x = str(x).strip().strip('"')
    for fmt in ("%m-%d-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(x, fmt).date().isoformat()
        except ValueError:
            pass
    return None


def folder_date(slug):
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", slug)
    return "-".join(m.groups()) if m else None


def from_r_json(x):
    if not isinstance(x, dict) or "type" not in x:
        return x
    vals = [from_r_json(v) for v in x.get("value", [])]
    names = x.get("attributes", {}).get("names", {}).get("value")
    if names:
        return dict(zip(names, vals))
    if x["type"] != "list" and len(vals) == 1:
        return vals[0]
    return vals


def split_front_matter(text):
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.S)
    return yaml.safe_load(m.group(1)), text[m.end():]


def dump_front_matter(d):
    class Dumper(yaml.SafeDumper):
        pass

    def str_rep(dumper, s):
        style = "|" if "\n" in s else None
        return dumper.represent_scalar("tag:yaml.org,2002:str", s, style=style)

    Dumper.add_representer(str, str_rep)
    out = yaml.dump(d, Dumper=Dumper, sort_keys=False, allow_unicode=True, width=1000)
    return f"---\n{out}---\n"


def convert_author(a):
    if isinstance(a, str):
        return a
    out = {"name": a["name"]}
    if a.get("orcid_id"):
        out["orcid"] = a["orcid_id"]
    if a.get("affiliation"):
        aff = {"name": a["affiliation"]}
        if a.get("affiliation_url"):
            aff["url"] = a["affiliation_url"]
        out["affiliations"] = [aff]
    return out


def convert_post_rmd(rmd, date, draft):
    meta, body = split_front_matter(rmd.read_text(encoding="utf8"))
    dist_opts = (meta.get("output") or {}).get("distill::distill_article") or {}

    fm = {"title": meta["title"]}
    if meta.get("description"):
        fm["description"] = str(meta["description"]).strip()
    if meta.get("author"):
        fm["author"] = [convert_author(a) for a in meta["author"]]
    fm["date"] = date
    if meta.get("categories"):
        fm["categories"] = meta["categories"]
    if meta.get("preview"):
        fm["image"] = meta["preview"]
    if draft:
        fm["draft"] = True
    for k in ("bibliography", "csl", "link-citations", "citation_url"):
        if k in meta:
            fm[k] = meta[k]
    after = dist_opts.get("include-after-body")
    if after and (rmd.parent / after).exists():
        fm["include-after-body"] = after
    if dist_opts.get("toc") is False:
        fm["toc"] = False

    return dump_front_matter(fm) + "\n" + convert_body(body).lstrip("\n")


CHUNK_OPEN = re.compile(r"^(\s*)(`{3,})\s*\{(\w+)(.*)\}\s*$")
FENCE = re.compile(r"^(\s*)(`{3,}|~{3,})")
DIV_OPEN = re.compile(r"^(:{3,})\s*\{?\s*\.?([\w-]+)?[^}]*\}?\s*$")
DIV_CLOSE = re.compile(r"^:{3,}\s*$")
LAYOUT_OPT = re.compile(r",?\s*layout\s*=\s*[\"'](l-[\w-]+)[\"']")


def convert_body(body):
    out = []
    in_code = None  # the fence string that closes the current code block
    stack = []  # open fenced divs: "panelset", "panel", or "other"
    last_heading = 1
    panel_pending = False

    for line in body.split("\n"):
        if in_code:
            if re.match(rf"^\s*{re.escape(in_code)}\s*$", line):
                in_code = None
            out.append(re.sub(r"^(\s*)(xaringanExtra::use_)", r"\1# \2", line))
            continue

        m = CHUNK_OPEN.match(line)
        if m:
            in_code = m.group(2)
            header = m.group(4)
            lm = LAYOUT_OPT.search(header)
            if lm:
                header = LAYOUT_OPT.sub("", header, count=1)
                out.append(f"{m.group(1)}{m.group(2)}{{{m.group(3)}{header}}}")
                col = LAYOUT_TO_COLUMN.get(lm.group(1))
                if col:
                    out.append(f"#| column: {col}")
            else:
                out.append(line)
            continue
        m = FENCE.match(line)
        if m:
            in_code = m.group(2)
            out.append(line)
            continue

        h = re.match(r"^(#{1,6})\s", line)
        if h:
            last_heading = len(h.group(1))

        # xaringanExtra panelsets -> Quarto tabsets
        if DIV_CLOSE.match(line) and stack:
            if stack.pop() != "panel":
                out.append(line)
            continue
        m = DIV_OPEN.match(line)
        if m and not DIV_CLOSE.match(line):
            cls = m.group(2)
            if cls == "panelset":
                stack.append("panelset")
                out.append(f"{m.group(1)} {{.panel-tabset}}")
                continue
            if cls == "panel" and stack and stack[-1] == "panelset":
                stack.append("panel")
                panel_pending = True
                continue
            stack.append("other")
            out.append(line)
            continue
        pm = re.match(r"^\s*\[(.+)\]\{\.panel-name\}\s*$", line)
        if pm and panel_pending:
            out.append("#" * min(last_heading + 1, 6) + " " + pm.group(1))
            panel_pending = False
            continue

        # distill asides -> margin content
        line = re.sub(r"<aside>", "\n::: {.column-margin}\n", line)
        line = re.sub(r"</aside>", "\n:::\n", line)
        out.append(line)

    return "\n".join(out)


def promote(slug, draft, force=False):
    src = SRC / slug
    rmds = sorted(src.glob("*.Rmd"), key=lambda p: (p.stem == "scratch-paper", p.name))
    if not rmds:
        sys.exit(f"No Rmd in {src}")
    rmd = rmds[0]
    dst = ROOT / ("drafts" if draft else "posts") / slug

    if dst.exists():
        generated = (dst / MARKER).is_file()
        if not generated and not force:
            sys.exit(f"{dst} already exists and is not generated. Use --force to overwrite.")
        shutil.rmtree(dst)

    published = SNAPSHOT / slug / "index.html"
    date = None
    if published.exists():
        html = published.read_text(encoding="utf8")
        m = re.search(r'id="radix-rmarkdown-metadata">\s*(\{.*?\})\s*</script>', html, re.S)
        date = parse_date(from_r_json(json.loads(m.group(1))).get("date"))
    if not date:
        meta, _ = split_front_matter(rmd.read_text(encoding="utf8"))
        date = parse_date(meta.get("date")) or folder_date(slug) or "2025-01-01"

    # Source assets, minus the Rmds and their distill render products
    skip = {r.name for r in rmds} | {f"{r.stem}.html" for r in rmds} | {f"{r.stem}_files" for r in rmds}
    dst.mkdir(parents=True)
    for p in src.iterdir():
        if p.name in skip:
            continue
        if p.is_dir():
            shutil.copytree(p, dst / p.name)
        else:
            shutil.copy2(p, dst / p.name)

    (dst / "index.qmd").write_text(convert_post_rmd(rmd, date, draft), encoding="utf8")
    print(f"{rmd.relative_to(ROOT).as_posix()} -> {(dst / 'index.qmd').relative_to(ROOT).as_posix()}")


def main(argv):
    force = "--force" in argv
    if "--all-drafts" in argv:
        for d in sorted(p for p in SRC.iterdir() if p.is_dir()):
            if not (SNAPSHOT / d.name).is_dir() and any(d.glob("*.Rmd")):
                promote(d.name, draft=True, force=force)
        return
    slugs = [a for a in argv if not a.startswith("--")]
    if len(slugs) != 1:
        sys.exit(__doc__)
    promote(slugs[0], draft="--draft" in argv, force=force)


if __name__ == "__main__":
    main(sys.argv[1:])
