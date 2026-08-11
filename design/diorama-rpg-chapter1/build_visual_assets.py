#!/usr/bin/env python3
"""Build optimized runtime textures from the preserved ImageGen sources."""

from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps


ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "source"
OUTPUT = ROOT / "public" / "game-assets" / "diorama-rpg-ch1"


def save_square(image: Image.Image, name: str) -> None:
    image = ImageOps.fit(image.convert("RGB"), (768, 768), Image.Resampling.LANCZOS)
    image = ImageEnhance.Contrast(image).enhance(1.04)
    image.save(OUTPUT / name, "JPEG", quality=88, optimize=True, progressive=True)


def save_portrait(image: Image.Image, name: str) -> None:
    # Keep the handmade model in frame while producing a compact 4:5 UI portrait.
    image = ImageOps.fit(
        image.convert("RGB"),
        (480, 600),
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.43),
    )
    image.save(OUTPUT / name, "JPEG", quality=90, optimize=True, progressive=True)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)

    atlas = Image.open(SOURCE / "material-atlas-source-v1.png")
    mid_x, mid_y = atlas.width // 2, atlas.height // 2
    panels = {
        "texture-meadow-v1.jpg": (0, 0, mid_x, mid_y),
        "texture-path-v1.jpg": (mid_x, 0, atlas.width, mid_y),
        "texture-stone-v1.jpg": (0, mid_y, mid_x, atlas.height),
        "texture-roof-v1.jpg": (mid_x, mid_y, atlas.width, atlas.height),
    }
    for filename, box in panels.items():
        save_square(atlas.crop(box), filename)

    sheet = Image.open(SOURCE / "party-portraits-source-v1.png")
    boundaries = (0, sheet.width // 3, (sheet.width * 2) // 3, sheet.width)
    portraits = ("portrait-towa-v1.jpg", "portrait-mina-v1.jpg", "portrait-sui-v1.jpg")
    for index, filename in enumerate(portraits):
        left = boundaries[index] + (4 if index else 0)
        right = boundaries[index + 1] - (4 if index < 2 else 0)
        save_portrait(sheet.crop((left, 0, right, sheet.height)), filename)


if __name__ == "__main__":
    main()
