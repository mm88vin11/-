# -*- coding: utf-8 -*-
"""Re-pack component.dc.html into the single-file bundle.

    python3 build/bundle.py [out.html] [src.html]

The source is a packed bundle: the image sequence, the logos and the
dc-runtime all live in its JSON manifest, and only the template island is
replaced. Any previous build output works as the source, so rebuilds chain
off the last one. Every step below is idempotent.
"""

import base64
import gzip
import io
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "baza.html")
SRC = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "baza.html")
TPL = os.path.join(ROOT, "component.dc.html")

SITE = "https://lllbaza.ru"
TITLE = "БАЗА — сайты, CRM и боты для бизнеса, который держится на владельце"
DESC = (
    "Делаем сайты, автоматизацию и ИИ-ботов, чтобы бизнес продавал без вашего "
    "участия. Разбор за три дня — 25 000 ₽. Работали с брендами одежды, "
    "барбершопами, оптом и доставкой."
)
FAVICON = (
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E"
    "%3Crect width='64' height='64' rx='14' fill='%230a0a0a'/%3E"
    "%3Ctext x='32' y='45' text-anchor='middle'"
    " font-family='Helvetica Neue,Helvetica,Arial,sans-serif'"
    " font-size='38' font-weight='700' fill='%23f2ebdd'%3E%D0%91%3C/text%3E%3C/svg%3E"
)

SEO_START = "  <!-- seo:start -->\n"
SEO_END = "  <!-- seo:end -->\n"
OLD_TITLE = "  <title>БАЗА — разработка × креатив</title>\n"

# The image-slot component this uuid carries is the vendored omelette starter.
SLOT_UUID = "76e43c03-d2bc-4186-9efd-fb02518ad329"


def island(value, **kw):
    """JSON for a <script> island. "</" must never appear raw inside one:
    the HTML parser would close the tag at that point and the rest of the
    payload would land in the document as markup."""
    return json.dumps(value, **kw).replace("</", "<\\/")


def find_island(lines, kind):
    """Index of the line holding the payload of <script type="__bundler/kind">."""
    tag = '<script type="__bundler/%s">' % kind
    for i, line in enumerate(lines):
        if tag in line:
            return i + 1
    raise SystemExit("island not found: " + kind)


def schema():
    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": SITE + "/#org",
                "name": "БАЗА",
                "alternateName": "ЭТО БАЗА",
                "url": SITE,
                "description": DESC,
                "sameAs": [
                    "https://t.me/lllbaza",
                    "https://vk.com/lllbaza",
                    "https://www.tiktok.com/@lllbaza",
                ],
                "founder": {"@type": "Person", "name": "Владислав Мирошниченко"},
                "contactPoint": [
                    {
                        "@type": "ContactPoint",
                        "contactType": "sales",
                        "url": "https://t.me/lllbaza",
                        "availableLanguage": ["ru"],
                    }
                ],
            },
            {
                "@type": "WebSite",
                "@id": SITE + "/#site",
                "url": SITE,
                "name": "БАЗА",
                "inLanguage": "ru-RU",
                "publisher": {"@id": SITE + "/#org"},
            },
            {
                "@type": "Service",
                "@id": SITE + "/#service",
                "name": "Разработка сайтов и автоматизация бизнеса",
                "serviceType": "Веб-разработка, CRM, ИИ-боты, брендинг",
                "provider": {"@id": SITE + "/#org"},
                "areaServed": ["RU", "KZ", "BY", "AM", "GE", "AE", "US", "CY", "UZ", "KG"],
                "hasOfferCatalog": {
                    "@type": "OfferCatalog",
                    "name": "Форматы работы",
                    "itemListElement": [
                        {
                            "@type": "Offer",
                            "name": "Экспресс-разбор",
                            "price": "25000",
                            "priceCurrency": "RUB",
                            "description": "Карта потерь в деньгах и часах плюс план на первые 30 дней. Три дня.",
                        },
                        {
                            "@type": "Offer",
                            "name": "Сайт",
                            "priceCurrency": "RUB",
                            "priceSpecification": {
                                "@type": "PriceSpecification",
                                "minPrice": "250000",
                                "priceCurrency": "RUB",
                            },
                            "description": "Структура, дизайн, разработка, аналитика и месяц поддержки. 3–5 недель.",
                        },
                        {
                            "@type": "Offer",
                            "name": "Система под ключ",
                            "priceCurrency": "RUB",
                            "priceSpecification": {
                                "@type": "PriceSpecification",
                                "minPrice": "900000",
                                "priceCurrency": "RUB",
                            },
                            "description": "Сайт, CRM, интеграции, бот и обучение команды. 2–4 месяца.",
                        },
                        {
                            "@type": "Offer",
                            "name": "Полное сопровождение",
                            "priceCurrency": "RUB",
                            "priceSpecification": {
                                "@type": "PriceSpecification",
                                "minPrice": "2500000",
                                "priceCurrency": "RUB",
                            },
                            "description": "Свой отдел разработки и маркетинга на аутсорсе. От шести месяцев.",
                        },
                    ],
                },
            },
        ],
    }


def head_block(pad="  "):
    """The SEO head. It goes in twice: into the raw file, where link scrapers
    that never run JS can read it, and into the template's <helmet>, because
    the unpacker swaps the whole documentElement for the parsed template and
    the raw <head> is gone by the time a rendering crawler looks."""
    body = """  <title>{title}</title>
  <meta name="description" content="{desc}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <meta name="theme-color" content="#0a0a0a">
  <meta name="color-scheme" content="dark">
  <meta name="author" content="БАЗА">
  <link rel="canonical" href="{site}/">
  <link rel="icon" href="{favi}">
  <link rel="apple-touch-icon" href="{favi}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="БАЗА">
  <meta property="og:locale" content="ru_RU">
  <meta property="og:url" content="{site}/">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:image" content="{site}/og.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="БАЗА — разработка и креатив">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="{site}/og.jpg">
  <script type="application/ld+json">{ld}</script>
""".format(
        title=TITLE,
        desc=DESC,
        site=SITE,
        favi=FAVICON,
        ld=json.dumps(schema(), ensure_ascii=False, separators=(",", ":")),
    )
    if pad != "  ":
        body = "".join(pad + ln[2:] if ln.startswith("  ") else ln
                       for ln in body.splitlines(True))
    return pad + SEO_START.strip() + "\n" + body + pad + SEO_END.strip() + "\n"


def shrink_logos(manifest, extres):
    """The four brand PNGs are ~930 KB of the payload. Lossless WebP keeps
    every pixel and gives about a third of that back."""
    names = {e["uuid"] for e in extres if e["id"].startswith("assets/") and e["id"].endswith(".png")}
    names.add("86b5cd41-0fb6-4d8f-a75c-24f08e558f06")  # header wordmark, template-inlined
    saved = 0
    for uuid in names:
        entry = manifest.get(uuid)
        if not entry or entry["mime"] != "image/png":
            continue
        blob = base64.b64decode(entry["data"])
        buf = io.BytesIO()
        Image.open(io.BytesIO(blob)).save(buf, "WEBP", lossless=True, method=6)
        packed = buf.getvalue()
        if len(packed) < len(blob):
            saved += len(blob) - len(packed)
            manifest[uuid] = {
                "mime": "image/webp",
                "compressed": False,
                "data": base64.b64encode(packed).decode("ascii"),
            }
    return saved


def guard_image_slot(manifest):
    """On file:// the sidecar the image-slot component looks for cannot exist,
    and asking for it prints a console error. Ask only where an answer is
    possible."""
    entry = manifest.get(SLOT_UUID)
    if not entry:
        return False
    raw = base64.b64decode(entry["data"])
    if entry["compressed"]:
        raw = gzip.decompress(raw)
    src = raw.decode("utf-8")
    old = "    loadP = fetch(STATE_FILE)\n"
    new = (
        "    loadP = (/^https?:$/.test(location.protocol)\n"
        "      ? fetch(STATE_FILE)\n"
        "      : Promise.resolve({ ok: false, json: function () { return null; } }))\n"
    )
    if new in src:
        return False
    if src.count(old) != 1:
        raise SystemExit("image-slot anchor missing")
    src = src.replace(old, new, 1)
    manifest[SLOT_UUID] = {
        "mime": entry["mime"],
        "compressed": True,
        "data": base64.b64encode(gzip.compress(src.encode("utf-8"), 9)).decode("ascii"),
    }
    return True


def patch_loader(out):
    """Two hot spots in the unpacker, both fixable without losing anything."""
    old_b64 = """        const binaryStr = atob(entry.data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
"""
    new_b64 = """        // 15 MB of base64 through charCodeAt in a loop costs hundreds of
        // milliseconds at start. Use the native decoder where it exists.
        let bytes;
        if (Uint8Array.fromBase64) {
          bytes = Uint8Array.fromBase64(entry.data);
        } else {
          const binaryStr = atob(entry.data);
          bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        }
"""
    old_sub = """    for (const uuid of uuids) {
      if (pageSet.has(uuid)) continue;
      template = template.split(uuid).join(blobUrls[uuid]);
    }
"""
    new_sub = """    // One pass instead of one pass per asset: with 274 assets over a
    // half-megabyte template that is hundreds of milliseconds.
    const UUID_ALL = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
    template = template.replace(UUID_ALL, (m) => (
      (!pageSet.has(m) && blobUrls[m]) ? blobUrls[m] : m
    ));
"""
    for old, new in ((old_b64, new_b64), (old_sub, new_sub)):
        if new in out:
            continue
        if out.count(old) != 1:
            raise SystemExit("loader anchor missing")
        out = out.replace(old, new, 1)
    return out


def inject_head(text, pad="  "):
    block = head_block(pad)
    start, end = pad + SEO_START.strip() + "\n", pad + SEO_END.strip() + "\n"
    if start in text and end in text:
        a = text.index(start)
        b = text.index(end) + len(end)
        return text[:a] + block + text[b:]
    # First build off the untouched bundle: no markers yet, only the old title.
    if text.count(OLD_TITLE) == 1:
        return text.replace(OLD_TITLE, block, 1)
    raise SystemExit("head markers missing")


def main():
    raw = io.open(SRC, encoding="utf-8").read()
    lines = raw.split("\n")

    i_manifest = find_island(lines, "manifest")
    i_ext = find_island(lines, "ext_resources")
    i_template = find_island(lines, "template")

    manifest = json.loads(lines[i_manifest])
    extres = json.loads(lines[i_ext])
    template = inject_head(io.open(TPL, encoding="utf-8").read(), "")

    saved = shrink_logos(manifest, extres)
    if saved:
        print("logos: %.2f MB saved" % (saved / 1e6))
    if guard_image_slot(manifest):
        print("image-slot: sidecar fetch guarded")

    lines[i_manifest] = island(manifest, ensure_ascii=False, separators=(",", ":"))
    lines[i_ext] = island(extres, ensure_ascii=False, separators=(",", ":"))
    lines[i_template] = island(template, ensure_ascii=False)

    out = patch_loader(inject_head("\n".join(lines)))
    io.open(OUT, "w", encoding="utf-8").write(out)
    print("%s: %.2f MB" % (OUT, os.path.getsize(OUT) / 1e6))


if __name__ == "__main__":
    main()
