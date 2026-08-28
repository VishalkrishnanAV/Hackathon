from fastapi.testclient import TestClient

from app.main import app


def test_health():
    response = TestClient(app).get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"


def test_unknown_evaluation_is_not_found():
    response = TestClient(app).get("/api/evaluations/does-not-exist")
    assert response.status_code == 404


def test_upload_requires_three_real_pdfs():
    fake = ("fake.pdf", b"not a pdf", "application/pdf")
    response = TestClient(app).post(
        "/api/evaluations",
        files={"job_description": fake, "resume": fake, "transcript": fake},
    )
    assert response.status_code == 400
    assert "not a valid PDF" in response.json()["detail"]


def test_upload_rejects_wrong_content_type():
    fake = ("fake.txt", b"plain text", "text/plain")
    response = TestClient(app).post(
        "/api/evaluations",
        files={"job_description": fake, "resume": fake, "transcript": fake},
    )
    assert response.status_code == 400

