# Adds ?v=<content hash> to local asset URLs in every page so browsers never mix old and new files.
import hashlib, re, pathlib
root = pathlib.Path(__file__).parent
pattern = re.compile(r'(src|href)="((?!https?:|mailto:|#|data:|/)[^"?#]+\.(?:css|js|jpg|jpeg|png|webp))(?:\?v=[0-9a-f]+)?"')
for page in [root / "index.html", *sorted((root / "candledeep").glob("*.html")), root / "play/index.html", root / "play/ai-dle/index.html", root / "play/scale-of-ai/index.html"]:
    html = page.read_text()
    def stamp(m):
        f = (page.parent / m.group(2)).resolve()
        if not f.is_file():
            return m.group(0)
        return f'{m.group(1)}="{m.group(2)}?v={hashlib.md5(f.read_bytes()).hexdigest()[:8]}"'
    page.write_text(pattern.sub(stamp, html))
    print(page.relative_to(root), len(re.findall(r'\?v=', page.read_text())), "stamped")
