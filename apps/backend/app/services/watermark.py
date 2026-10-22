import io
import math

from pypdf import PageObject, PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, FloatObject, NameObject


def _escape(text: str) -> str:
    safe = text.encode("latin-1", "replace").decode("latin-1")
    return safe.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _stamp(writer: PdfWriter, width: float, height: float, text: str) -> PageObject:
    """A transparent page with the text tiled diagonally across it."""
    stamp = PageObject.create_blank_page(width=width, height=height)
    font = DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
    })
    alpha = DictionaryObject({
        NameObject("/Type"): NameObject("/ExtGState"),
        NameObject("/ca"): FloatObject(0.12),
    })
    stamp[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)}),
        NameObject("/ExtGState"): DictionaryObject({NameObject("/GS1"): writer._add_object(alpha)}),
    })

    # Rotate the whole coordinate system, then lay a regular grid in it so the
    # diagonal rows cover the page evenly whatever its size or orientation
    size = max(10.0, min(width, height) / 30)
    cos, sin = math.cos(math.radians(35)), math.sin(math.radians(35))
    step_x, step_y = size * len(text) * 0.55 + size * 4, size * 5
    reach = math.hypot(width, height)
    ops = [f"q /GS1 gs 0.3 0.3 0.3 rg {cos:.4f} {sin:.4f} {-sin:.4f} {cos:.4f} 0 0 cm BT", f"/F1 {size:.1f} Tf"]
    row = 0
    y = -reach
    while y < reach:
        x = -reach + (step_x / 2 if row % 2 else 0)
        while x < reach:
            ops.append(f"1 0 0 1 {x:.1f} {y:.1f} Tm ({_escape(text)}) Tj")
            x += step_x
        y += step_y
        row += 1
    ops.append("ET Q")

    content = DecodedStreamObject()
    content.set_data("\n".join(ops).encode("latin-1"))
    stamp[NameObject("/Contents")] = writer._add_object(content)
    return stamp


def watermark_pdf(data: bytes, text: str) -> bytes:
    """Burn `text` into every page so a leaked copy identifies who downloaded it."""
    reader = PdfReader(io.BytesIO(data))
    writer = PdfWriter()
    for page in reader.pages:
        width, height = float(page.mediabox.width), float(page.mediabox.height)
        page.merge_page(_stamp(writer, width, height, text))
        writer.add_page(page)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
