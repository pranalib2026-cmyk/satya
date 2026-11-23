"""End-to-End Integration Tests for Document Scanner & Legal Explainer.

Covers:
1. Selectable digital PDF processing and statutory explanation.
2. Scanned PDF (image-based) page rasterization and OCR.
3. Image (PNG/JPEG) optical character extraction and legal analysis.
4. Unrelated non-legal document (statutory grounding failure handling).
5. Corrupt and unsupported document upload safety.
6. Document containing zero readable text.
7. Cross-tenant authorization and document privacy.
8. Engine and provider failure handling.
"""

import io
import uuid
from typing import Dict
from unittest.mock import patch

from PIL import Image, ImageDraw
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.modules.documents.models import Document
from app.modules.documents.ocr import DocumentOCREngine
from app.modules.users.models import User


def create_selectable_pdf(text_lines: list[str]) -> bytes:
    """Create a valid PDF byte string with real selectable text stream."""
    stream_content = "BT\n/F1 12 Tf\n50 700 Td\n"
    for i, line in enumerate(text_lines):
        # Escape parenthesis
        safe_line = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        if i == 0:
            stream_content += f"({safe_line}) Tj\n"
        else:
            stream_content += f"0 -20 Td\n({safe_line}) Tj\n"
    stream_content += "ET"

    stream_bytes = stream_content.encode("latin-1")
    length = len(stream_bytes)

    pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
        b"4 0 obj\n<< /Length " + str(length).encode("ascii") + b" >>\nstream\n"
        + stream_bytes +
        b"\nendstream\nendobj\n"
        b"5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
        b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000229 00000 n \n0000000418 00000 n \n"
        b"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n498\n%%EOF"
    )
    return pdf


def create_image_with_text(text: str, fmt: str = "PNG") -> bytes:
    """Generate image bytes with drawn high-contrast black text on white background."""
    img = Image.new("RGB", (900, 350), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((25, 30), text, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def create_scanned_pdf(text: str) -> bytes:
    """Generate a scanned (image-only) PDF containing no embedded font text."""
    img = Image.new("RGB", (900, 350), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((25, 30), text, fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PDF")
    return buf.getvalue()


@pytest_asyncio.fixture
async def user_a(async_client: AsyncClient, db_session: AsyncSession):
    """Fixture for authenticated Citizen User A."""
    password = "UserAPassword123!"
    user = User(
        email=f"user_a_{uuid.uuid4().hex[:8]}@example.com",
        phone=f"+9198{uuid.uuid4().hex[:8]}",
        password_hash=hash_password(password),
        full_name="Vikramaditya Roy",
        role="CITIZEN",
        is_verified=True,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": password},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"user": user, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest_asyncio.fixture
async def user_b(async_client: AsyncClient, db_session: AsyncSession):
    """Fixture for authenticated Citizen User B."""
    password = "UserBPassword123!"
    user = User(
        email=f"user_b_{uuid.uuid4().hex[:8]}@example.com",
        phone=f"+9197{uuid.uuid4().hex[:8]}",
        password_hash=hash_password(password),
        full_name="Ananya Sen",
        role="CITIZEN",
        is_verified=True,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    res = await async_client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": password},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"user": user, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.mark.asyncio
async def test_selectable_pdf_scan_and_explanation(async_client: AsyncClient, user_a: Dict):
    """Test 1: PDF containing selectable text extracted via pypdf and explained with grounded citations."""
    pdf_bytes = create_selectable_pdf([
        "LEGAL DEMAND NOTICE UNDER SECTION 138 NEGOTIABLE INSTRUMENTS ACT",
        "To, Dinesh Patel, 502 Marine Lines, Mumbai",
        "Cheque No. 409122 dated 10-10-2026 for Rs. 85,000 was dishonoured with memo funds insufficient.",
        "You are hereby called upon to pay Rs. 85,000 within 15 days of this notice, failing which legal proceedings will be initiated.",
        "Issued by: Advocate K. Mehta",
    ])

    files = {"file": ("demand_notice_sec138.pdf", pdf_bytes, "application/pdf")}
    res = await async_client.post(
        "/api/v1/documents/scan",
        headers=user_a["headers"],
        files=files,
    )
    assert res.status_code == 201
    scan_data = res.json()
    assert scan_data["status"] == "completed"
    assert scan_data["ocr_engine"] == "pdf_embedded"
    assert scan_data["confidence"] >= 0.90
    assert "SECTION 138" in scan_data["text"]
    assert "85,000" in scan_data["text"]
    doc_id = scan_data["document_id"]

    # Now explain document
    explain_res = await async_client.post(
        f"/api/v1/documents/{doc_id}/explain",
        headers=user_a["headers"],
    )
    assert explain_res.status_code == 200
    exp = explain_res.json()
    assert exp["document_id"] == doc_id
    assert "138" in exp["document_type"] or "Negotiable Instruments" in exp["document_type"] or "Notice" in exp["document_type"]
    assert any("85,000" in a["value"] for a in exp["amounts"])
    assert any("Dinesh Patel" in p or "Mehta" in p for p in exp["parties"])
    assert exp["sources_found"] is True
    assert len(exp["citations"]) > 0
    assert any("138" in (c.get("section_or_paragraph") or "") for c in exp["citations"])
    assert "NyayaSetu" in exp["disclaimer"]


@pytest.mark.asyncio
async def test_scanned_pdf_rendering_and_ocr(async_client: AsyncClient, user_a: Dict):
    """Test 2: Scanned PDF with no embedded font text rasterized with pypdfium2 and OCRed with RapidOCR."""
    scanned_text = "SCANNED DEMAND NOTICE\nTo, Rajesh Khanna\nPayment of Rs 150000 due within 30 days\nDated 20 November 2026"
    pdf_bytes = create_scanned_pdf(scanned_text)

    files = {"file": ("scanned_loan_notice.pdf", pdf_bytes, "application/pdf")}
    res = await async_client.post(
        "/api/v1/documents/scan",
        headers=user_a["headers"],
        files=files,
    )
    assert res.status_code == 201
    scan_data = res.json()
    assert scan_data["status"] == "completed"
    assert scan_data["ocr_engine"] in ["rapidocr", "gemini_vision", "tesseract"]
    assert "DEMAND NOTICE" in scan_data["text"] or "150000" in scan_data["text"]
    doc_id = scan_data["document_id"]

    # Explain scanned document
    explain_res = await async_client.post(
        f"/api/v1/documents/{doc_id}/explain",
        headers=user_a["headers"],
    )
    assert explain_res.status_code == 200
    exp = explain_res.json()
    assert "Notice" in exp["document_type"] or "Demand" in exp["document_type"]


@pytest.mark.asyncio
async def test_image_with_readable_text_ocr(async_client: AsyncClient, user_a: Dict):
    """Test 3: Image containing readable text (PNG) extracted using real OCR engine."""
    image_text = "TENANCY NOTICE\nTo, Sunita Rao\nPay outstanding rent of Rs. 35,000 within 15 days\nDated: 12-10-2026\nIssued by Landlord"
    png_bytes = create_image_with_text(image_text, fmt="PNG")

    files = {"file": ("tenancy_notice.png", png_bytes, "image/png")}
    res = await async_client.post(
        "/api/v1/documents/scan",
        headers=user_a["headers"],
        files=files,
    )
    assert res.status_code == 201
    scan_data = res.json()
    assert scan_data["status"] == "completed"
    assert scan_data["ocr_engine"] in ["rapidocr", "gemini_vision", "tesseract"]
    assert "TENANCY" in scan_data["text"] or "Sunita" in scan_data["text"] or "35,000" in scan_data["text"]
    doc_id = scan_data["document_id"]

    # Explain image document
    explain_res = await async_client.post(
        f"/api/v1/documents/{doc_id}/explain",
        headers=user_a["headers"],
    )
    assert explain_res.status_code == 200
    exp = explain_res.json()
    assert "Tenancy" in exp["document_type"] or "Notice" in exp["document_type"]
    assert any("35,000" in a["value"] for a in exp["amounts"])


@pytest.mark.asyncio
async def test_unrelated_non_legal_document(async_client: AsyncClient, user_a: Dict):
    """Test 4: Unrelated non-legal document (e.g. recipe) does not invent legal sections."""
    recipe_pdf = create_selectable_pdf([
        "CHOCOLATE CAKE RECIPE",
        "Ingredients: 2 cups flour, 1 cup sugar, 3 eggs, 100g butter, 50g cocoa powder.",
        "Bake in an oven preheated to 180 degrees Celsius for 35 minutes.",
        "Serve warm with vanilla ice cream.",
    ])

    files = {"file": ("chocolate_cake_recipe.pdf", recipe_pdf, "application/pdf")}
    res = await async_client.post(
        "/api/v1/documents/scan",
        headers=user_a["headers"],
        files=files,
    )
    assert res.status_code == 201
    scan_data = res.json()
    assert "CHOCOLATE CAKE" in scan_data["text"]
    doc_id = scan_data["document_id"]

    explain_res = await async_client.post(
        f"/api/v1/documents/{doc_id}/explain",
        headers=user_a["headers"],
    )
    assert explain_res.status_code == 200
    exp = explain_res.json()
    # Grounding must indicate sources could not be verified in Indian statutory Bare Acts
    assert exp["sources_found"] is False
    assert len(exp["citations"]) == 0
    # Must NOT invent fake Section 138 or ₹60,000 notice
    assert "₹60,000" not in str(exp["amounts"])
    assert "Mr. S. Rao" not in str(exp["parties"])


@pytest.mark.asyncio
async def test_unsupported_or_corrupt_file_rejected(async_client: AsyncClient, user_a: Dict):
    """Test 5: Corrupt, disguised, or unsupported files are rejected safely."""
    # 1. Corrupt PDF bytes (violates magic byte signature)
    corrupt_pdf = b"NOT_A_REAL_PDF_JUST_RANDOM_DATA_BYTES"
    files = {"file": ("corrupt.pdf", corrupt_pdf, "application/pdf")}
    res = await async_client.post(
        "/api/v1/documents/scan",
        headers=user_a["headers"],
        files=files,
    )
    assert res.status_code == 400
    assert "signature" in res.json()["error"]["message"].lower() or "corrupt" in res.json()["error"]["message"].lower()

    # 2. Unsupported extension (e.g. .exe)
    files = {"file": ("malware.exe", b"MZ\x90\x00\x03\x00\x00\x00", "application/octet-stream")}
    res = await async_client.post(
        "/api/v1/documents/scan",
        headers=user_a["headers"],
        files=files,
    )
    assert res.status_code == 400
    assert "extension" in res.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_document_with_no_readable_text(async_client: AsyncClient, user_a: Dict):
    """Test 6: Blank image with zero text does not invent OCR output and fails safely on explanation."""
    # Blank 600x300 pure white image
    blank_img = Image.new("RGB", (600, 300), color=(255, 255, 255))
    buf = io.BytesIO()
    blank_img.save(buf, format="PNG")
    blank_bytes = buf.getvalue()

    files = {"file": ("blank_sheet.png", blank_bytes, "image/png")}
    res = await async_client.post(
        "/api/v1/documents/scan",
        headers=user_a["headers"],
        files=files,
    )
    assert res.status_code == 201
    scan_data = res.json()
    assert scan_data["confidence"] == 0.0
    assert scan_data["low_confidence"] is True
    assert scan_data["text"] == ""
    doc_id = scan_data["document_id"]

    # Explaining blank document fails safely with 400 Bad Request
    explain_res = await async_client.post(
        f"/api/v1/documents/{doc_id}/explain",
        headers=user_a["headers"],
    )
    assert explain_res.status_code == 400
    assert "no readable text" in explain_res.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_unauthorized_user_cross_tenant_access_forbidden(
    async_client: AsyncClient, user_a: Dict, user_b: Dict
):
    """Test 7: User B cannot access, OCR, explain, or delete User A's private document."""
    pdf_bytes = create_selectable_pdf(["CONFIDENTIAL SEPARATION AGREEMENT", "Between User A and Company XYZ"])
    files = {"file": ("private_agreement.pdf", pdf_bytes, "application/pdf")}
    upload_res = await async_client.post(
        "/api/v1/documents/scan",
        headers=user_a["headers"],
        files=files,
    )
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["document_id"]

    # 1. User B attempts GET metadata
    res = await async_client.get(f"/api/v1/documents/{doc_id}", headers=user_b["headers"])
    assert res.status_code == 403

    # 2. User B attempts OCR trigger
    res = await async_client.post(f"/api/v1/documents/{doc_id}/ocr", headers=user_b["headers"])
    assert res.status_code == 403

    # 3. User B attempts explain
    res = await async_client.post(f"/api/v1/documents/{doc_id}/explain", headers=user_b["headers"])
    assert res.status_code == 403

    # 4. User B attempts DELETE
    res = await async_client.delete(f"/api/v1/documents/{doc_id}", headers=user_b["headers"])
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_ocr_failure_handling_and_recovery(async_client: AsyncClient, user_a: Dict, db_session: AsyncSession):
    """Test 8: Engine failure updates document status to 'failed' safely without orphan state."""
    pdf_bytes = create_selectable_pdf(["TEST NOTICE FOR SIMULATED OCR FAILURE"])
    files = {"file": ("fail_notice.pdf", pdf_bytes, "application/pdf")}

    # Upload document first without immediate scan
    upload_res = await async_client.post(
        "/api/v1/documents/upload",
        headers=user_a["headers"],
        files=files,
    )
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    # Simulate OCR engine failure
    with patch.object(DocumentOCREngine, "process_document", side_effect=RuntimeError("Simulated OCR engine failure")):
        ocr_res = await async_client.post(
            f"/api/v1/documents/{doc_id}/ocr",
            headers=user_a["headers"],
        )
        assert ocr_res.status_code == 200
        data = ocr_res.json()
        assert data["status"] == "failed"
        assert "Simulated OCR engine failure" in data["processing_error"]

    # Verify database record persisted the failure status
    doc_query = await async_client.get(f"/api/v1/documents/{doc_id}/ocr", headers=user_a["headers"])
    assert doc_query.status_code == 200
    assert doc_query.json()["status"] == "failed"
    assert "Simulated OCR engine failure" in doc_query.json()["processing_error"]
