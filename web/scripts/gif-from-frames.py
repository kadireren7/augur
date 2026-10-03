"""Create a compact presentation GIF from actual browser screenshots."""
import argparse
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument("frames", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
paths = sorted(args.frames.glob("showcase-*.png"))
if not paths:
    raise SystemExit("No captured frames; refusing to create an empty GIF")
frames = []
for path in paths:
    with Image.open(path) as original:
        image = original.convert("RGB")
        image.thumbnail((1000, 720), Image.Resampling.LANCZOS)
        frames.append(image.convert("P", palette=Image.Palette.ADAPTIVE, colors=128))
args.output.parent.mkdir(parents=True, exist_ok=True)
frames[0].save(args.output, save_all=True, append_images=frames[1:], duration=400, loop=0, optimize=True)
print(f"Saved {len(frames)} real browser frames")
