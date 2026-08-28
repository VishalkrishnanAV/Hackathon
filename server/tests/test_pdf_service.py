from io import BytesIO

from pypdf import PdfWriter

from app.pdf_service import extract_evidence


def test_blank_pdf_is_rejected():
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    stream = BytesIO()
    writer.write(stream)
    try:
        extract_evidence(stream.getvalue(), "resume", "CV")
        assert False, "Expected blank PDF rejection"
    except ValueError as exc:
        assert "No readable text" in str(exc)

