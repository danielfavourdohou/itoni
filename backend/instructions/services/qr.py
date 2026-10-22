"""QR codes for the patient link, rendered locally (no external service)."""

import qrcode
import qrcode.image.svg


def svg(data: str) -> str:
    """Single-path SVG with a viewBox, so the frontend can size it freely with CSS."""
    img = qrcode.make(data, image_factory=qrcode.image.svg.SvgPathImage, border=2)
    return img.to_string(encoding="unicode")
