#!/usr/bin/env python3
"""Split transparent character sheets into isolated, equal-canvas sprites."""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "public/game-assets/brawler-2d"


def connected_components(mask: np.ndarray):
    height, width = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    components = []
    for y, x in zip(*np.nonzero(mask & ~seen)):
        if seen[y, x]:
            continue
        queue = deque([(int(y), int(x))])
        seen[y, x] = True
        points = []
        while queue:
            cy, cx = queue.popleft()
            points.append((cy, cx))
            for ny in range(max(0, cy - 1), min(height, cy + 2)):
                for nx in range(max(0, cx - 1), min(width, cx + 2)):
                    if mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
        components.append(points)
    return components


def split_sheet(source_name: str, prefix: str, expected: int, join_size: int):
    source = Image.open(ASSETS / source_name).convert("RGBA")
    alpha = source.getchannel("A")
    scale = 4
    small_size = ((source.width + scale - 1) // scale, (source.height + scale - 1) // scale)
    small = alpha.resize(small_size, Image.Resampling.BOX).filter(ImageFilter.MaxFilter(join_size))
    mask = np.asarray(small) > 18
    components = connected_components(mask)
    components.sort(key=len, reverse=True)
    figures = sorted(components[:expected], key=lambda points: sum(x for _, x in points) / len(points))
    if len(figures) != expected:
        raise RuntimeError(f"Expected {expected} figures in {source_name}, found {len(figures)}")

    rgba = np.asarray(source).copy()
    crops = []
    for points in figures:
        component_mask = np.zeros(mask.shape, dtype=np.uint8)
        ys, xs = zip(*points)
        component_mask[np.asarray(ys), np.asarray(xs)] = 255
        full_mask = Image.fromarray(component_mask, "L").resize(source.size, Image.Resampling.NEAREST)
        keep = np.asarray(full_mask) > 0
        isolated = rgba.copy()
        isolated[~keep, 3] = 0
        visible = isolated[:, :, 3] > 18
        py, px = np.nonzero(visible)
        if not len(px):
            raise RuntimeError(f"Empty component while splitting {source_name}")
        pad = 12
        box = (
            max(0, int(px.min()) - pad),
            max(0, int(py.min()) - pad),
            min(source.width, int(px.max()) + pad + 1),
            min(source.height, int(py.max()) + pad + 1),
        )
        crops.append(Image.fromarray(isolated, "RGBA").crop(box))

    canvas_width = max(crop.width for crop in crops) + 32
    canvas_height = max(crop.height for crop in crops) + 24
    output_paths = []
    for index, crop in enumerate(crops):
        canvas = Image.new("RGBA", (canvas_width, canvas_height), (0, 0, 0, 0))
        x = (canvas_width - crop.width) // 2
        y = canvas_height - crop.height - 8
        canvas.alpha_composite(crop, (x, y))
        output = ASSETS / f"{prefix}-{index}-v2.png"
        canvas.save(output, optimize=True)
        output_paths.append(output)
    print(f"{source_name}: {len(output_paths)} sprites, canvas={canvas_width}x{canvas_height}")
    return output_paths


if __name__ == "__main__":
    split_sheet("mina-sprites-v1.png", "mina", 6, 5)
    split_sheet("guardians-sprites-v1.png", "guardian", 4, 3)
