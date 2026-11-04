"""Gera os ícones do split-pix (dois anéis sobrepostos) em assets/images.

Uso: python3 scripts/make-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "assets" / "images"
BLUE = (37, 99, 235, 255)
LIGHT = (147, 197, 253, 255)
SOFT = (191, 219, 254, 255)
WHITE = (255, 255, 255, 255)
SCALE = 4  # desenha grande e reduz, para bordas suaves


def rings(size, ring1, ring2, extent=0.62, bg=None):
    big = size * SCALE
    img = Image.new("RGBA", (big, big), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Proporções do logo (viewBox 88x64: círculos r=26 em x=30 e x=58).
    w = big * extent
    unit = w / 88
    r = 26 * unit
    stroke = max(1, round(7 * unit))
    cx0 = (big - w) / 2
    cy = big / 2
    for cx, color in ((30, ring1), (58, ring2)):
        x = cx0 + cx * unit
        d.ellipse([x - r, cy - r, x + r, cy + r], outline=color, width=stroke)
    return img.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rings(1024, WHITE, SOFT, 0.62, BLUE).save(OUT / "icon.png")
    # Ícone adaptativo do Android: o sistema recorta ~66% centrais.
    Image.new("RGBA", (1024, 1024), BLUE).save(OUT / "android-icon-background.png")
    rings(1024, WHITE, SOFT, 0.46).save(OUT / "android-icon-foreground.png")
    rings(1024, WHITE, WHITE, 0.46).save(OUT / "android-icon-monochrome.png")
    rings(512, WHITE, SOFT, 0.9).save(OUT / "splash-icon.png")
    rings(48, BLUE, LIGHT, 0.9, WHITE).save(OUT / "favicon.png")
    print("ícones gerados em", OUT)


if __name__ == "__main__":
    main()
