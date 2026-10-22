import html
import io
import re
import zipfile
from pathlib import Path

from pypdf import PdfReader

MAX_TEXT_CHARS = 200_000  # enough for search and classification; keeps rows small
_TAG = re.compile(r"<[^>]+>")


def _xml_text(xml: str, paragraph_tag: str) -> str:
    """Strip OOXML markup, keeping paragraph breaks."""
    xml = xml.replace(f"</{paragraph_tag}>", "\n")
    return html.unescape(_TAG.sub("", xml))


def _from_pdf(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    parts = []
    size = 0
    for page in reader.pages:
        text = page.extract_text() or ""
        parts.append(text)
        size += len(text)
        if size >= MAX_TEXT_CHARS:
            break
    return "\n".join(parts)


def _from_office(data: bytes, members: str, paragraph_tag: str) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        names = sorted(n for n in zf.namelist() if re.fullmatch(members, n))
        return "\n".join(_xml_text(zf.read(n).decode("utf-8", "ignore"), paragraph_tag) for n in names)


def extract_text(path: Path, name: str) -> str:
    """Best-effort plain text of a stored document; empty string when unsupported or unreadable."""
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    data = path.read_bytes()
    try:
        if ext == "pdf":
            text = _from_pdf(data)
        elif ext == "docx":
            text = _from_office(data, r"word/document\.xml", "w:p")
        elif ext == "pptx":
            text = _from_office(data, r"ppt/slides/slide\d+\.xml", "a:p")
        elif ext == "xlsx":
            text = _from_office(data, r"xl/sharedStrings\.xml", "si")
        elif ext in ("txt", "csv"):
            text = data.decode("utf-8", "ignore")
        else:
            return ""
    except Exception:  # corrupt or encrypted files simply have no searchable text
        return ""
    return re.sub(r"[ \t]+", " ", text).strip()[:MAX_TEXT_CHARS]
