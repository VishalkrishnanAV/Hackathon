from io import BytesIO
import re

from pypdf import PdfReader

from app.models import Evidence


def extract_evidence(data: bytes, document: str, prefix: str) -> list[Evidence]:
    reader = PdfReader(BytesIO(data))
    evidence: list[Evidence] = []
    counter = 1
    for page_number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        chunks = [chunk.strip() for chunk in re.split(r"\n+", text) if chunk.strip()]
        for chunk in chunks:
            if len(chunk) < 12:
                continue
            evidence.append(
                Evidence(
                    id=f"{prefix}-{counter:03d}",
                    document=document,
                    page=page_number,
                    quote=chunk,
                )
            )
            counter += 1
    if not evidence:
        raise ValueError(f"No readable text found in {document} PDF")
    return evidence

