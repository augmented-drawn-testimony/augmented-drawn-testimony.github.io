#!/usr/bin/env python3
"""Lossily compress raster images embedded in SVG files without changing layout."""

from __future__ import annotations

import argparse
import base64
import io
import re
from pathlib import Path

try:
    from PIL import Image
except ImportError as error:
    raise SystemExit(
        "Pillow is required. Install it with: python3 -m pip install Pillow"
    ) from error


DATA_IMAGE = re.compile(
    rb"data:image/(?P<format>png|jpe?g);base64,(?P<data>[A-Za-z0-9+/=\r\n\t ]+)"
)


def encode_webp(match: re.Match[bytes], quality: int) -> bytes:
    source = base64.b64decode(re.sub(rb"\s+", b"", match.group("data")))

    with Image.open(io.BytesIO(source)) as image:
        image.load()
        output = io.BytesIO()
        image.save(
            output,
            format="WEBP",
            quality=quality,
            method=6,
            exact=True,
        )

    encoded = base64.b64encode(output.getvalue())
    return b"data:image/webp;base64," + encoded


def optimize_svg(path: Path, quality: int) -> tuple[int, int, int]:
    original = path.read_bytes()
    converted = 0

    def replace(match: re.Match[bytes]) -> bytes:
        nonlocal converted
        replacement = encode_webp(match, quality)

        # Never replace an image if this encoder happens to make it larger.
        if len(replacement) >= len(match.group(0)):
            return match.group(0)

        converted += 1
        return replacement

    optimized = DATA_IMAGE.sub(replace, original)
    if converted:
        path.write_bytes(optimized)

    return converted, len(original), len(optimized)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert embedded PNG/JPEG SVG images to WebP while preserving SVG geometry."
    )
    parser.add_argument(
        "paths",
        nargs="*",
        type=Path,
        default=[Path("public/images")],
        help="SVG files or directories to process (default: public/images)",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=82,
        choices=range(1, 101),
        metavar="1-100",
        help="WebP quality (default: 82)",
    )
    args = parser.parse_args()

    svg_paths: set[Path] = set()
    for path in args.paths:
        if path.is_dir():
            svg_paths.update(path.rglob("*.svg"))
        elif path.suffix.lower() == ".svg":
            svg_paths.add(path)
        else:
            parser.error(f"not an SVG file or directory: {path}")

    total_images = 0
    total_before = 0
    total_after = 0
    for path in sorted(svg_paths):
        images, before, after = optimize_svg(path, args.quality)
        if images:
            saved = 100 * (before - after) / before
            print(f"{path}: {images} image(s), {saved:.1f}% smaller")
        total_images += images
        total_before += before
        total_after += after

    saved = 100 * (total_before - total_after) / total_before if total_before else 0
    print(f"Converted {total_images} image(s); SVG files are {saved:.1f}% smaller overall")


if __name__ == "__main__":
    main()
