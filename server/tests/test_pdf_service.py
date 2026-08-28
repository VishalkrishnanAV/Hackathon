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


def test_non_pdf_is_rejected_before_parsing():
    try:
        extract_evidence(b"not a pdf", "resume", "CV")
        assert False, "Expected invalid PDF rejection"
    except ValueError as exc:
        assert "not a valid PDF" in str(exc)
