from io import BytesIO
import re

from pypdf import PdfReader

from app.models import Evidence

MAX_PDF_PAGES = 50
MAX_EXTRACTED_CHARACTERS = 200_000
MAX_EVIDENCE_ITEMS = 600


def extract_evidence(data: bytes, document: str, prefix: str) -> list[Evidence]:
    if not data.startswith(b"%PDF-"):
        raise ValueError(f"{document} is not a valid PDF")
    reader = PdfReader(BytesIO(data), strict=False)
    if len(reader.pages) > MAX_PDF_PAGES:
        raise ValueError(f"{document} exceeds the {MAX_PDF_PAGES}-page limit")
    evidence: list[Evidence] = []
    counter = 1
    extracted_characters = 0
    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        extracted_characters += len(text)
        if extracted_characters > MAX_EXTRACTED_CHARACTERS:
            raise ValueError(f"{document} contains too much text")
        chunks = [chunk.strip() for chunk in re.split(r"\n+", text) if chunk.strip()]
        for chunk in chunks:
            if len(chunk) < 12:
                continue
            if len(evidence) >= MAX_EVIDENCE_ITEMS:
                raise ValueError(f"{document} contains too many evidence sections")
            evidence.append(
                Evidence(
                    id=f"{prefix}-{counter:03d}",
                    document=document,
                    page=page_number,
                    quote=chunk[:2_000],
                )
            )
            counter += 1
    if not evidence:
        raise ValueError(f"No readable text found in {document} PDF")
    return evidence
