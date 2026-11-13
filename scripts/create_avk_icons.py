"""Create the AVK application icon in PNG and ICO formats."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]

def font(size):
    for path in (r"C:\Windows\Fonts\arialbd.ttf", r"C:\Windows\Fonts\segoeuib.ttf"):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

def make_icon(size):
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    margin = max(3, size // 24)
    radius = size // 4
    draw.rounded_rectangle((margin, margin, size - margin, size - margin), radius, fill="#4A154B", outline="#ECB22E", width=max(2, size // 32))
    draw.rounded_rectangle((margin * 2, margin * 2, size - margin * 2, size - margin * 2), radius - margin, outline="#8f5b8f", width=max(1, size // 64))
    label = "AVK"
    label_font = font(int(size * 0.37))
    box = draw.textbbox((0, 0), label, font=label_font)
    x = (size - (box[2] - box[0])) / 2
    y = (size - (box[3] - box[1])) / 2 - box[1] - size * 0.02
    draw.text((x + size * 0.012, y + size * 0.018), label, font=label_font, fill="#231025")
    draw.text((x, y), label, font=label_font, fill="#FFD36B")
    return image

icon = make_icon(512)
for output in (ROOT / "desktop" / "assets" / "icon.png", ROOT / "client" / "public" / "favicon.png"):
    output.parent.mkdir(parents=True, exist_ok=True)
    icon.save(output)
for output in (ROOT / "desktop" / "assets" / "icon.ico", ROOT / "client" / "public" / "favicon.ico"):
    icon.save(output, sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
