#!/usr/bin/env python3
"""Draw classroom wall posters for the VNR202 1954 migration lesson."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "public" / "vnr-gallery"
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1280, 960
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

INK = (53, 92, 94)
CREAM = (255, 248, 230)
MINT = (201, 232, 214)
CORAL = (224, 130, 110)
TEAL = (71, 122, 118)
GOLD = (236, 196, 110)
SEA = (142, 196, 204)
LAND = (126, 176, 132)
PAPER = (255, 252, 242)


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def wrap(draw, text, fnt, width):
    words = text.split()
    lines, current = [], ""
    for word in words:
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=fnt) <= width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def base(kicker, title, caption):
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, W, 210), fill=MINT)
    d.rectangle((0, 210, W, 218), fill=GOLD)
    d.rounded_rectangle((48, 36, 210, 92), 18, fill=CORAL)
    d.text((78, 48), "VNR202", font=font(28, True), fill=PAPER)
    d.text((230, 44), kicker, font=font(22, True), fill=TEAL)
    for i, line in enumerate(wrap(d, title, font(46, True), 1120)):
        d.text((60, 108 + i * 52), line, font=font(46, True), fill=INK)
    d.text((60, H - 78), caption, font=font(22), fill=TEAL)
    d.rectangle((48, H - 92, 220, H - 86), fill=GOLD)
    return img, d


def poster_geneva(img, d):
    d.rounded_rectangle((90, 270, 560, 820), 28, fill=PAPER, outline=GOLD, width=8)
    d.text((150, 310), "GIƠNEVƠ", font=font(42, True), fill=INK)
    d.text((150, 370), "21 · 7 · 1954", font=font(28), fill=CORAL)
    for y in (450, 510, 570, 630, 690):
        d.line((150, y, 500, y), fill=(214, 200, 168), width=4)
    d.ellipse((620, 300, 1180, 820), fill=SEA)
    d.polygon([(790, 430), (900, 360), (1010, 450), (980, 640), (820, 700), (740, 560)], fill=LAND)
    d.line((740, 300, 1180, 820), fill=CORAL, width=10)
    d.text((820, 540), "vĩ tuyến 17", font=font(24, True), fill=PAPER)


def poster_article(img, d):
    d.rounded_rectangle((100, 280, 560, 820), 40, fill=TEAL)
    d.text((160, 430), "ĐIỀU", font=font(36, True), fill=GOLD)
    d.text((160, 490), "14(d)", font=font(86, True), fill=PAPER)
    d.text((160, 620), "Quyền chuyển vùng\ncủa thường dân", font=font(28), fill=CREAM)
    d.polygon([(680, 430), (1120, 430), (1120, 610), (980, 610), (1040, 720), (860, 610), (680, 610)], fill=CORAL)
    d.text((760, 490), "BẮC  →  NAM", font=font(32, True), fill=PAPER)


def poster_300(img, d):
    d.rounded_rectangle((180, 280, 1100, 800), 36, fill=PAPER, outline=TEAL, width=10)
    d.text((W / 2, 360), "300", font=font(180, True), fill=CORAL, anchor="mm")
    d.text((W / 2, 530), "NGÀY", font=font(48, True), fill=INK, anchor="mm")
    d.text((W / 2, 620), "Thời hạn tập kết và chuyển quân", font=font(28), fill=TEAL, anchor="mm")
    d.text((W / 2, 690), "cũng là thời kỳ thường dân được chuyển vùng", font=font(24), fill=TEAL, anchor="mm")


def poster_direction(img, d):
    d.ellipse((160, 280, 520, 780), fill=SEA)
    d.polygon([(250, 390), (330, 330), (410, 400), (390, 560), (280, 610), (230, 500)], fill=LAND)
    d.text((250, 800), "MIỀN BẮC", font=font(26, True), fill=INK)
    d.ellipse((760, 280, 1120, 780), fill=(232, 210, 150))
    d.polygon([(850, 390), (930, 330), (1010, 400), (990, 560), (880, 610), (830, 500)], fill=(176, 138, 92))
    d.text((850, 800), "MIỀN NAM", font=font(26, True), fill=INK)
    d.polygon([(540, 470), (760, 470), (760, 530), (830, 500), (760, 470), (760, 530)], fill=CORAL)
    d.rectangle((540, 488, 760, 528), fill=CORAL)


def poster_ship(img, d):
    d.rectangle((0, 620, W, H - 100), fill=SEA)
    d.polygon([(280, 430), (980, 430), (900, 560), (360, 560)], fill=(90, 116, 132))
    d.rectangle((430, 250, 470, 430), fill=PAPER)
    d.polygon([(470, 250), (690, 310), (470, 360)], fill=CORAL)
    d.ellipse((240, 660, 360, 710), fill=PAPER)
    d.ellipse((900, 680, 1040, 730), fill=PAPER)
    d.text((W / 2, 800), "OPERATION PASSAGE TO FREEDOM", font=font(28, True), fill=INK, anchor="mm")


def poster_broadcast(img, d):
    d.rounded_rectangle((180, 300, 520, 760), 30, fill=TEAL)
    d.ellipse((250, 360, 450, 560), fill=GOLD)
    d.ellipse((300, 410, 400, 510), fill=TEAL)
    d.rectangle((310, 560, 390, 700), fill=CORAL)
    for i, radius in enumerate((80, 130, 180)):
        d.arc((620 - radius, 420 - radius, 620 + radius + 180, 420 + radius + 80), start=300, end=60, fill=GOLD, width=10)
    d.text((620, 700), "Tôn giáo · Tài sản · An toàn", font=font(28, True), fill=INK)
    d.text((620, 750), "Nhà ở · Đất đai · Sinh kế", font=font(26), fill=TEAL)


def poster_million(img, d):
    d.text((W / 2, 360), "~ 1 TRIỆU", font=font(72, True), fill=CORAL, anchor="mm")
    d.text((W / 2, 450), "người Bắc vào Nam, 1954–1955", font=font(30), fill=INK, anchor="mm")
    colors = [TEAL, CORAL, GOLD, LAND, (110, 150, 168)]
    index = 0
    for row in range(4):
        for col in range(14):
            x = 160 + col * 72
            y = 540 + row * 80
            d.ellipse((x, y, x + 36, y + 36), fill=colors[index % len(colors)])
            d.rounded_rectangle((x + 6, y + 34, x + 30, y + 66), 10, fill=colors[index % len(colors)])
            index += 1


def poster_settlement(img, d):
    d.rounded_rectangle((90, 280, 600, 820), 28, fill=PAPER, outline=CORAL, width=8)
    d.text((140, 320), "Mục tiêu chính quyền", font=font(28, True), fill=CORAL)
    for i, line in enumerate(["Củng cố lực lượng", "Thu hút người chống cộng", "Tổ chức vận chuyển", "Tuyên truyền vận động"]):
        d.ellipse((140, 400 + i * 80, 168, 428 + i * 80), fill=CORAL)
        d.text((190, 396 + i * 80), line, font=font(26), fill=INK)
    d.rounded_rectangle((680, 280, 1190, 820), 28, fill=PAPER, outline=TEAL, width=8)
    d.text((730, 320), "Động cơ người dân", font=font(28, True), fill=TEAL)
    for i, line in enumerate(["Tôn giáo, gia đình", "Chính trị, sinh kế", "Tự nguyện hoặc sức ép", "Khó khăn nhà ở, đất đai"]):
        d.ellipse((730, 400 + i * 80, 758, 428 + i * 80), fill=TEAL)
        d.text((780, 396 + i * 80), line, font=font(26), fill=INK)


POSTERS = [
    ("01-geneva.png", "BỐI CẢNH 1954", "Hiệp định Giơnevơ", "Đình chỉ chiến sự · tập kết quân đội · chuyển vùng", poster_geneva),
    ("02-dieu-14d.png", "CƠ SỞ PHÁP LÝ", "Điều 14(d)", "Thường dân được phép và giúp đỡ khi chuyển vùng", poster_article),
    ("03-300-ngay.png", "THỜI HẠN", "300 ngày chuyển quân", "Cửa sổ pháp lý cho cuộc di cư 1954–1955", poster_300),
    ("04-bac-nam.png", "HƯỚNG DI CHUYỂN", "Từ miền Bắc vào miền Nam", "Một bộ phận lớn dân cư chọn vào Nam", poster_direction),
    ("05-tau-bay.png", "VẬN CHUYỂN", "Passage to Freedom", "Hải quân Mỹ dùng tàu biển và máy bay", poster_ship),
    ("06-tuyen-truyen.png", "VẬN ĐỘNG", "Tuyên truyền và lời hứa", "Lo ngại tôn giáo, tài sản, an toàn và đất đai", poster_broadcast),
    ("07-mot-trieu.png", "QUY MÔ", "Gần một triệu người", "Số liệu thay đổi tùy nguồn thống kê", poster_million),
    ("08-danh-gia.png", "CÁCH ĐỌC", "Phân biệt hai mặt", "Mục tiêu chính trị không trùng hết động cơ cá nhân", poster_settlement),
]


def main():
    for name, kicker, title, caption, draw_art in POSTERS:
        img, d = base(kicker, title, caption)
        draw_art(img, d)
        path = OUT / name
        img.save(path, "PNG")
        print(path)


if __name__ == "__main__":
    main()
