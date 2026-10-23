"""Seed a self-contained demo room on startup (DEMO_SEED=1).

Free hosting tiers have no persistent disk, so every restart starts empty. Seeding a
realistic room — folders, documents, a share link with viewer activity and a buyer
question — keeps the public demo useful without anyone setting it up by hand.
"""
import io
import uuid
from datetime import datetime, timedelta, timezone

from flask import Flask
from pypdf import PageObject, PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from app import db
from app.models import File, Folder, Question, ShareAccess, ShareLink, SharePageView, User
from app.services.file_service import storage_dir
from app.services.insights import analyze_file

DEMO_EMAIL = "demo@acmecorp.dev"
DEMO_PASSWORD = "DataRoomDemo2026"
DEMO_SHARE_TOKEN = "acme-investor-demo"

DOCUMENTS = {
    "1. Corporate": [
        ("Articles of Association.pdf", "Articles of Association of Acme Corp", [
            "These articles of incorporation and bylaws govern Acme Corp, a Delaware corporation.",
            "The board of directors consists of five members elected annually by the shareholders.",
            "Share transfers require approval of the board and are subject to a right of first refusal.",
        ]),
        ("Cap Table March 2026.pdf", "Capitalization Table", [
            "Cap table as of 31 March 2026. Fully diluted shares outstanding: 12,400,000.",
            "Founders hold 48%, Series A investors 31%, Series B investors 14%, option pool 7%.",
            "The shareholder register is maintained by the company secretary.",
        ]),
    ],
    "2. Financial": [
        ("Audited Financial Statements FY2025.pdf", "Audited Financial Statements FY2025", [
            "Financial statements audited by Deloitte LLP for the year ended 31 December 2025.",
            "Revenue grew 42% to USD 18.6 million. EBITDA margin improved to 14%.",
            "The balance sheet shows cash of USD 6.2 million and no bank debt.",
            "The auditor issued an unqualified opinion.",
        ]),
        ("Management Accounts Q2 2026.pdf", "Management Accounts Q2 2026", [
            "Management accounts for the quarter ended 30 June 2026 compared with budget.",
            "Recurring revenue reached USD 5.4 million for the quarter, 6% ahead of budget.",
            "The forecast for FY2026 projects revenue of USD 24 million.",
        ]),
    ],
    "3. Legal & Contracts": [
        ("Master Services Agreement - Globex.pdf", "Master Services Agreement", [
            "This master services agreement between Acme Corp and Globex Inc. runs for three years.",
            "Either party may terminate for convenience with 180 days written notice.",
            "A change of control of Acme Corp requires notice to Globex within 30 days.",
        ]),
        ("Office Lease - Berlin.pdf", "Office Lease", [
            "Lease between Spree Properties GmbH as landlord and Acme Corp as tenant.",
            "The lease term is five years from 1 January 2024. Rent is reviewed annually by CPI.",
            "The tenant may sublet up to 30% of the premises with landlord consent.",
        ]),
    ],
    "4. HR": [
        ("Employee Option Plan.pdf", "Equity Incentive Plan", [
            "The stock option plan reserves 7% of fully diluted shares for employees.",
            "Options vest over four years with a one-year cliff.",
        ]),
        ("Key Employee Compensation.pdf", "Key Employee Compensation", [
            "Confidential. Salary and bonus of key employees for 2026.",
            "Chief Technology Officer: salary EUR 185,000, bonus up to 30%.",
            "Payroll account IBAN DE89 3704 0044 0532 0130 00.",
        ]),
    ],
}


def _pdf(title: str, paragraphs: list[str]) -> bytes:
    """A small text PDF (Helvetica, wrapped lines) without extra dependencies."""
    writer = PdfWriter()
    page = PageObject.create_blank_page(width=612, height=792)
    font = DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
    })
    page[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)}),
    })

    def esc(text: str) -> str:
        return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    lines = [f"BT /F1 20 Tf 72 720 Td ({esc(title)}) Tj ET"]
    y = 680
    for para in paragraphs:
        words, line = para.split(), ""
        for w in words:
            if len(line) + len(w) > 85:
                lines.append(f"BT /F1 11 Tf 72 {y} Td ({esc(line)}) Tj ET")
                y, line = y - 16, ""
            line = f"{line} {w}".strip()
        lines.append(f"BT /F1 11 Tf 72 {y} Td ({esc(line)}) Tj ET")
        y -= 28
    content = DecodedStreamObject()
    content.set_data("\n".join(lines).encode("latin-1"))
    page[NameObject("/Contents")] = writer._add_object(content)
    writer.add_page(page)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def seed_demo(app: Flask) -> None:
    if User.query.filter_by(email=DEMO_EMAIL).first():
        return

    user = User(name="Alex Morgan", email=DEMO_EMAIL, location="Berlin")
    user.set_password(DEMO_PASSWORD)
    db.session.add(user)
    db.session.flush()

    files: dict[str, File] = {}
    colors = ["#3e90f0", "#8e55ea", "#3fdd78", "#d84c10"]
    for (folder_name, docs), color in zip(DOCUMENTS.items(), colors):
        folder = Folder(name=folder_name, color=color, user_id=user.id)
        db.session.add(folder)
        db.session.flush()
        for filename, title, paragraphs in docs:
            path = storage_dir(user.id) / f"{uuid.uuid4().hex}_{filename.replace(' ', '_')}"
            data = _pdf(title, paragraphs)
            path.write_bytes(data)
            record = File(name=path.name.split("_", 1)[1], original_name=filename, mime_type="application/pdf",
                          size=len(data), path=str(path), folder_id=f"folder:{folder.id}", user_id=user.id)
            db.session.add(record)
            db.session.flush()
            files[filename] = record
    db.session.commit()

    for record in files.values():
        analyze_file(record.id)

    # A live investor link with some history so Sharing analytics and Q&A are not empty
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    link = ShareLink(token=DEMO_SHARE_TOKEN, user_id=user.id, name="Project Falcon — investor access",
                     allow_download=False, created_at=now - timedelta(days=6))
    db.session.add(link)
    db.session.flush()

    audited = files["Audited Financial Statements FY2025.pdf"]
    lease = files["Office Lease - Berlin.pdf"]
    msa = files["Master Services Agreement - Globex.pdf"]
    history = [
        ("partner@northwind.vc", "opened", None, 5), ("partner@northwind.vc", "viewed", audited, 5),
        ("partner@northwind.vc", "viewed", msa, 4), ("analyst@northwind.vc", "opened", None, 3),
        ("analyst@northwind.vc", "viewed", audited, 3), ("analyst@northwind.vc", "viewed", lease, 2),
        ("cfo@contoso-capital.com", "opened", None, 1), ("cfo@contoso-capital.com", "viewed", audited, 1),
    ]
    for email, action, record, days_ago in history:
        db.session.add(ShareAccess(link_id=link.id, viewer_email=email, action=action, ip="203.0.113.10",
                                   file_id=record.id if record else None,
                                   file_name=record.original_name if record else None,
                                   created_at=now - timedelta(days=days_ago, hours=2)))
    for email, record, seconds in [("partner@northwind.vc", audited, 214), ("analyst@northwind.vc", audited, 486),
                                   ("analyst@northwind.vc", lease, 95), ("cfo@contoso-capital.com", audited, 158),
                                   ("partner@northwind.vc", msa, 132)]:
        db.session.add(SharePageView(link_id=link.id, viewer_email=email, file_id=record.id,
                                     file_name=record.original_name, page=1, seconds=seconds))

    db.session.add(Question(link_id=link.id, user_id=user.id, viewer_email="analyst@northwind.vc",
                            file_id=msa.id, file_name=msa.original_name, page=1,
                            body="Does the Globex agreement allow termination on a change of control?",
                            created_at=now - timedelta(days=2)))
    db.session.add(Question(link_id=link.id, user_id=user.id, viewer_email="partner@northwind.vc",
                            body="Who audited the FY2025 financial statements?",
                            answer="Deloitte LLP — the audit opinion is unqualified (see Audited Financial Statements FY2025).",
                            answered_at=now - timedelta(days=4), created_at=now - timedelta(days=5)))
    db.session.commit()
    app.logger.info("Demo room seeded: %s / share token %s", DEMO_EMAIL, DEMO_SHARE_TOKEN)
