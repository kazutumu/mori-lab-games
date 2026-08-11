#!/usr/bin/env python3
"""Build individual production PNGs from the generated pixel-art source sheets."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent / "source"
OUTPUT = ROOT / "public/game-assets/rpg2d-ch1"
OUTPUT.mkdir(parents=True, exist_ok=True)


def cell(image: Image.Image, columns: int, rows: int, column: int, row: int) -> Image.Image:
    left = round(image.width * column / columns)
    right = round(image.width * (column + 1) / columns)
    top = round(image.height * row / rows)
    bottom = round(image.height * (row + 1) / rows)
    return image.crop((left, top, right, bottom))


def row_sprites(image: Image.Image, rows: int) -> list[Image.Image]:
    sprites: list[Image.Image] = []
    alpha = image.getchannel("A")
    for row in range(rows):
        top = round(image.height * row / rows)
        bottom = round(image.height * (row + 1) / rows)
        row_alpha = alpha.crop((0, top, image.width, bottom))
        occupied = [row_alpha.crop((x, 0, x + 1, bottom - top)).getbbox() is not None for x in range(image.width)]
        runs: list[tuple[int, int]] = []
        start = None
        for x, visible in enumerate(occupied + [False]):
            if visible and start is None:
                start = x
            elif not visible and start is not None:
                if x - start > 20:
                    runs.append((start, x))
                start = None
        for left, right in runs:
            sprites.append(image.crop((left, top, right, bottom)))
    return sprites


def alpha_crop(image: Image.Image, padding: int = 5) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.point(lambda value: 255 if value > 18 else 0).getbbox()
    if not bbox:
        raise RuntimeError("Sprite cell is empty")
    left, top, right, bottom = bbox
    return image.crop((max(0, left - padding), max(0, top - padding), min(image.width, right + padding), min(image.height, bottom + padding)))


def normalize(image: Image.Image, size: tuple[int, int], bottom_padding: int = 3) -> Image.Image:
    target_width, target_height = size
    sprite = alpha_crop(image)
    scale = min((target_width - 6) / sprite.width, (target_height - 6 - bottom_padding) / sprite.height)
    resized = sprite.resize((max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (target_width - resized.width) // 2
    y = target_height - bottom_padding - resized.height
    canvas.alpha_composite(resized, (x, y))
    return canvas


def save(image: Image.Image, name: str) -> None:
    image.save(OUTPUT / name, optimize=True)


def build_characters() -> None:
    sheet = Image.open(SOURCE / "characters-alpha-v1.png").convert("RGBA")
    names = [
        "mina-down", "mina-up", "mina-left", "mina-right",
        "npc-fuka", "npc-nagi", "npc-keeper", "npc-merchant",
    ]
    sprites = row_sprites(sheet, 2)
    if len(sprites) != len(names):
        raise RuntimeError(f"Expected {len(names)} character sprites, found {len(sprites)}")
    for sprite, name in zip(sprites, names):
        save(normalize(sprite, (96, 128), 4), f"{name}-v1.png")


def build_enemies() -> None:
    sheet = Image.open(SOURCE / "enemies-alpha-v1.png").convert("RGBA")
    names = ["sumi-mori", "toge-tsugumi", "garasu-ga", "ori-kemono", "yohaku-kurai"]
    sprites = row_sprites(sheet, 1)
    if len(sprites) != len(names):
        raise RuntimeError(f"Expected {len(names)} enemy sprites, found {len(sprites)}")
    for index, (sprite, name) in enumerate(zip(sprites, names)):
        size = (192, 192) if index == 4 else (128, 128)
        save(normalize(sprite, size, 4), f"enemy-{name}-v1.png")


def build_tiles() -> None:
    sheet = Image.open(SOURCE / "tiles-source-v1.png").convert("RGB")
    names = [
        "grass", "path", "flower-grass", "forest-floor",
        "water", "stone-floor", "wood-floor", "lab-floor",
        "cliff", "plaster-wall", "slate-roof", "forest-canopy",
        "bush", "standing-stone", "wood-door", "stone-stairs",
    ]
    for index, name in enumerate(names):
        tile = cell(sheet, 4, 4, index % 4, index // 4).resize((64, 64), Image.Resampling.NEAREST)
        save(tile, f"tile-{name}-v1.png")


def build_props() -> None:
    sheet = Image.open(SOURCE / "props-alpha-v1.png").convert("RGBA")
    specs = [
        ("cottage", (192, 160)), ("laboratory", (192, 160)), ("evergreen", (128, 160)), ("broadleaf", (128, 160)),
        ("bookshelf", (128, 128)), ("research-desk", (160, 112)), ("bed", (96, 128)), ("chest", (96, 80)),
        ("signpost", (72, 96)), ("lantern", (72, 96)), ("save-monument", (144, 112)), ("bridge", (144, 96)),
    ]
    sprites = row_sprites(sheet, 3)
    if len(sprites) != len(specs):
        raise RuntimeError(f"Expected {len(specs)} prop sprites, found {len(sprites)}")
    for sprite, (name, size) in zip(sprites, specs):
        save(normalize(sprite, size, 3), f"prop-{name}-v1.png")


if __name__ == "__main__":
    build_characters()
    build_enemies()
    build_tiles()
    build_props()
    print(f"Built {len(list(OUTPUT.glob('*-v1.png')))} pixel-art assets in {OUTPUT}")
