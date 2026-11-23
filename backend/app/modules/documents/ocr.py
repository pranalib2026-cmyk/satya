"""Real OCR and Text Extraction Pipeline for Documents.

Provides hybrid extraction for Indian legal documents:
1. Native PDF embedded text stream extraction via pypdf.
2. Scanned PDF page rasterization via pypdfium2.
3. Optical Character Recognition via RapidOCR (offline CPU-based ONNX)
   or Gemini Vision multimodal API when configured.
4. Tesseract OCR integration fallback.
Never returns invented or fake OCR text on failure.
"""

from dataclasses import dataclass
import io
import os
import re
from typing import List, Optional, Tuple

import numpy as np
from PIL import Image

from app.core.config import settings
from app.core.errors import BadRequestException
from app.core.logging import logger

# Lazy global instance for RapidOCR to avoid reload overhead
_RAPID_OCR_INSTANCE = None


def get_rapid_ocr_engine():
    """Retrieve or lazily initialize the shared RapidOCR engine."""
    global _RAPID_OCR_INSTANCE
    if _RAPID_OCR_INSTANCE is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            _RAPID_OCR_INSTANCE = RapidOCR()
            logger.info("RapidOCR ONNX engine initialized successfully.")
        except Exception as exc:
            logger.warning(f"Could not initialize RapidOCR: {exc}")
            _RAPID_OCR_INSTANCE = False
    return _RAPID_OCR_INSTANCE if _RAPID_OCR_INSTANCE is not False else None


@dataclass
class OCRExtractionResult:
    """Standardized output of OCR extraction."""

    text: str
    confidence: float
    engine_name: str
    low_confidence: bool
    page_count: int
    char_count: int


class DocumentOCREngine:
    """Document text extraction engine supporting selectable PDFs, scanned PDFs, and images."""

    MIN_EMBEDDED_TEXT_LENGTH = 50

    @classmethod
    def clean_text(cls, raw: str) -> str:
        """Normalize line breaks and whitespace without modifying statutory content."""
        if not raw:
            return ""
        # Remove non-printable control characters except newline and tab
        cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", raw)
        # Normalize carriage returns
        cleaned = cleaned.replace("\r\n", "\n").replace("\r", "\n")
        # Collapse excessive blank lines
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        return cleaned.strip()

    @classmethod
    def extract_from_pdf_embedded(cls, content: bytes) -> Tuple[str, int]:
        """Extract selectable embedded text from PDF using pypdf.
        
        Returns tuple of (extracted_text, page_count).
        """
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content))
        except Exception as exc:
            raise BadRequestException(message=f"Failed to parse PDF document: {exc}")

        if reader.is_encrypted:
            try:
                # Attempt empty password decryption
                decrypted = reader.decrypt("")
                if decrypted == 0:
                    raise BadRequestException(message="PDF document is password-protected and cannot be read.")
            except Exception:
                raise BadRequestException(message="PDF document is password-protected and cannot be read.")

        page_texts = []
        page_count = len(reader.pages)
        for page in reader.pages:
            try:
                txt = page.extract_text() or ""
                if txt.strip():
                    page_texts.append(txt.strip())
            except Exception as exc:
                logger.warning(f"Error extracting page text: {exc}")
                continue

        full_text = cls.clean_text("\n\n".join(page_texts))
        return full_text, page_count

    @classmethod
    def extract_from_image_rapidocr(cls, img: Image.Image) -> Tuple[str, float]:
        """Run RapidOCR on a PIL image.
        
        Returns tuple of (extracted_text, average_confidence).
        """
        engine = get_rapid_ocr_engine()
        if not engine:
            return "", 0.0

        try:
            # Ensure RGB format
            if img.mode != "RGB":
                img = img.convert("RGB")
            img_array = np.array(img)
            result, _ = engine(img_array)
            if not result:
                return "", 0.0

            text_lines = []
            scores = []
            for item in result:
                # Item format: [box, text, score]
                if len(item) >= 3 and item[1]:
                    text_lines.append(item[1].strip())
                    scores.append(float(item[2]))

            joined = cls.clean_text("\n".join(text_lines))
            avg_conf = float(sum(scores) / len(scores)) if scores else 0.0
            return joined, round(avg_conf, 3)
        except Exception as exc:
            logger.warning(f"RapidOCR execution failed: {exc}")
            return "", 0.0

    @classmethod
    def extract_from_image_pytesseract(cls, img: Image.Image) -> Tuple[str, float]:
        """Run pytesseract on a PIL image if system binary is installed."""
        try:
            import pytesseract
            # Check if tesseract is executable
            text = pytesseract.image_to_string(img)
            cleaned = cls.clean_text(text)
            # Estimate confidence based on data if available
            try:
                data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
                confs = [float(c) for c in data.get("conf", []) if str(c).replace("-", "").isdigit() and float(c) >= 0]
                avg_conf = (sum(confs) / len(confs) / 100.0) if confs else (0.85 if cleaned else 0.0)
            except Exception:
                avg_conf = 0.85 if cleaned else 0.0
            return cleaned, round(avg_conf, 3)
        except Exception as exc:
            logger.debug(f"Pytesseract not available or failed: {exc}")
            return "", 0.0

    @classmethod
    def extract_from_image_gemini(cls, content: bytes, mime_type: str) -> Optional[Tuple[str, float]]:
        """Run Gemini Vision multimodal OCR if API key is configured and AI_PROVIDER is gemini."""
        if not settings.GEMINI_API_KEY or not settings.GEMINI_API_KEY.strip():
            return None
        if settings.AI_PROVIDER != "gemini":
            return None

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            part = types.Part.from_bytes(data=content, mime_type=mime_type)
            prompt = (
                "You are an optical document text transcriber for legal records. "
                "Transcribe all visible printed and handwritten text from this document accurately and verbatim. "
                "Preserve section titles, names, dates, amounts, and paragraph breaks. "
                "Do not summarize, do not comment, and do not add preamble. Return only the raw transcribed text."
            )
            response = client.models.generate_content(
                model=settings.GEMINI_LLM_MODEL,
                contents=[part, prompt],
            )
            raw_text = response.text or ""
            cleaned = cls.clean_text(raw_text)
            if cleaned:
                return cleaned, 0.95
        except Exception as exc:
            logger.warning(f"Gemini Vision OCR extraction failed: {exc}")
        return None

    @classmethod
    def extract_from_scanned_pdf(cls, content: bytes) -> Tuple[str, float, str]:
        """Rasterize scanned PDF pages with pypdfium2 and execute OCR.
        
        Returns (text, confidence, engine_name).
        """
        try:
            import pypdfium2 as pdfium
            pdf = pdfium.PdfDocument(content)
        except Exception as exc:
            logger.warning(f"Failed to rasterize scanned PDF with pypdfium2: {exc}")
            return "", 0.0, "scanned_pdf_raster_failed"

        page_texts = []
        page_confs = []
        engine_used = "rapidocr"

        # Check if Gemini Vision can process PDF directly
        gemini_res = cls.extract_from_image_gemini(content, "application/pdf")
        if gemini_res and gemini_res[0]:
            return gemini_res[0], gemini_res[1], "gemini_vision"

        # Limit page rendering to max 10 pages for safety and speed
        max_pages = min(len(pdf), 10)
        for i in range(max_pages):
            try:
                page = pdf[i]
                pil_image = page.render(scale=2).to_pil()
                # Run RapidOCR first
                txt, conf = cls.extract_from_image_rapidocr(pil_image)
                if not txt:
                    # Fallback to pytesseract
                    txt, conf = cls.extract_from_image_pytesseract(pil_image)
                    if txt:
                        engine_used = "tesseract"

                if txt:
                    page_texts.append(f"--- Page {i+1} ---\n" + txt)
                    page_confs.append(conf)
            except Exception as page_exc:
                logger.warning(f"Error processing scanned page {i+1}: {page_exc}")
                continue

        combined_text = cls.clean_text("\n\n".join(page_texts))
        avg_conf = float(sum(page_confs) / len(page_confs)) if page_confs else 0.0
        return combined_text, round(avg_conf, 3), engine_used

    @classmethod
    def process_document(
        cls,
        content: bytes,
        file_name: str,
        mime_type: str,
    ) -> OCRExtractionResult:
        """Process document bytes and extract text with confidence and provenance metadata.
        
        Never returns invented text.
        """
        if not content:
            raise BadRequestException(message="Document content is empty.")

        ext = os.path.splitext(file_name.lower())[1]

        # 1. PDF Processing
        if mime_type == "application/pdf" or ext == ".pdf":
            # Step A: Check for selectable embedded text
            embedded_text, page_count = cls.extract_from_pdf_embedded(content)
            if len(embedded_text) >= cls.MIN_EMBEDDED_TEXT_LENGTH:
                return OCRExtractionResult(
                    text=embedded_text,
                    confidence=0.98,
                    engine_name="pdf_embedded",
                    low_confidence=False,
                    page_count=page_count,
                    char_count=len(embedded_text),
                )

            # Step B: Scanned PDF fallback
            scanned_text, confidence, engine_name = cls.extract_from_scanned_pdf(content)
            low_conf = confidence < 0.70 or len(scanned_text) < cls.MIN_EMBEDDED_TEXT_LENGTH
            return OCRExtractionResult(
                text=scanned_text,
                confidence=confidence,
                engine_name=engine_name,
                low_confidence=low_conf,
                page_count=page_count,
                char_count=len(scanned_text),
            )

        # 2. Image Processing (JPEG, PNG)
        elif mime_type in {"image/jpeg", "image/png"} or ext in {".jpg", ".jpeg", ".png"}:
            try:
                pil_image = Image.open(io.BytesIO(content))
                pil_image.verify()  # verify integrity
                # Reopen since verify closes internal file pointer
                pil_image = Image.open(io.BytesIO(content))
            except Exception as exc:
                raise BadRequestException(message=f"Corrupt or invalid image file: {exc}")

            # Try Gemini Vision if operational
            gemini_res = cls.extract_from_image_gemini(content, mime_type)
            if gemini_res and gemini_res[0]:
                text, conf = gemini_res
                return OCRExtractionResult(
                    text=text,
                    confidence=conf,
                    engine_name="gemini_vision",
                    low_confidence=False,
                    page_count=1,
                    char_count=len(text),
                )

            # RapidOCR (offline CPU)
            text, conf = cls.extract_from_image_rapidocr(pil_image)
            engine_name = "rapidocr"

            # Fallback to Tesseract if RapidOCR produced nothing
            if not text:
                tess_text, tess_conf = cls.extract_from_image_pytesseract(pil_image)
                if tess_text:
                    text = tess_text
                    conf = tess_conf
                    engine_name = "tesseract"

            low_conf = conf < 0.70 or len(text) < cls.MIN_EMBEDDED_TEXT_LENGTH
            return OCRExtractionResult(
                text=text,
                confidence=conf,
                engine_name=engine_name,
                low_confidence=low_conf,
                page_count=1,
                char_count=len(text),
            )

        else:
            raise BadRequestException(
                message=f"Unsupported document format '{mime_type}'. Supported: PDF, JPEG, PNG."
            )
