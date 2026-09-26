# Adds ?v=<content hash> to local asset URLs in index.html so browsers never mix old and new files.
import hashlib, re, pathlib
root = pathlib.Path(__file__).parent
page = root / "index.html"
html = page.read_text()
def stamp(m):
    attr, path = m.group(1), m.group(2)
    f = root / path
    if not f.is_file():
        return m.group(0)
    v = hashlib.md5(f.read_bytes()).hexdigest()[:8]
    return f'{attr}="{path}?v={v}"'
html = re.sub(r'(src|href)="((?!https?:|mailto:|#|data:|/)[^"?#]+\.(?:css|js|jpg|jpeg|png|webp))(?:\?v=[0-9a-f]+)?"', stamp, html)
page.write_text(html)
print("\n".join(sorted(set(re.findall(r'"([^"]+\?v=[0-9a-f]+)"', html)))))
