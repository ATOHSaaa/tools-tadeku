#!/usr/bin/env python3
"""Generate Chrome extension icons for Aozora Style."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "aozora-style" / "extension" / "icons"
SIZES = (16, 48, 128)

FONT_CANDIDATES = [
    "/System/Library/Fonts/ヒラギノ角ゴシック W9.ttc",
    "/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
]

BG = "#1a1a1a"
FG = "#ffffff"


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def render_icon(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    inset = max(1, round(size * 0.04))
    draw.ellipse((inset, inset, size - inset - 1, size - inset - 1), fill=BG)

    font_size = max(7, round(size * 0.34))
    font = load_font(font_size)
    text = "Ao"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (size - text_w) / 2 - bbox[0]
    y = (size - text_h) / 2 - bbox[1] - size * 0.02
    draw.text((x, y), text, font=font, fill=FG)
    return image


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        icon = render_icon(size)
        target = OUT_DIR / f"icon{size}.png"
        icon.save(target, format="PNG", optimize=True)
        print(f"wrote {target}")


if __name__ == "__main__":
    main()
