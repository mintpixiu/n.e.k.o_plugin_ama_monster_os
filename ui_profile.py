"""User-customizable shell appearance profile.

The profile is intentionally small and declarative: it changes CSS variables
and a few labels, never loads remote assets or executes user CSS.  The same
schema is used by the Hosted UI (for live preview) and by the Python plugin
(for persistence and import validation).
"""

from __future__ import annotations

import base64
import json
import re
from datetime import datetime, timezone
from typing import Any, Mapping

UI_PROFILE_FORMAT = "ama.ui.profile"
UI_PROFILE_VERSION = 1
MAX_UI_PROFILE_BYTES = 3_000_000
MAX_WINDOW_IMAGE_BYTES = 1_200_000
WALLPAPERS = ("grid", "dots", "aurora", "stars", "plain")
WINDOW_BACKGROUNDS = ("paper", "mist", "sakura", "glass", "image", "custom")
DENSITIES = ("comfortable", "compact")
THEMES = ("light", "dark")
_ACCENT_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
_IMAGE_RE = re.compile(r"^data:image/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=\s]+)$")

DEFAULT_UI_PROFILE: dict[str, Any] = {
    "version": UI_PROFILE_VERSION,
    "name": "Cloud",
    "brand": "Ama Monster OS",
    "glyph": "✦",
    "accent": "#44b8f2",
    "wallpaper": "grid",
    "window_bg": "paper",
    "window_color": "#ffffff",
    "window_image": "",
    "radius": 16,
    "density": "comfortable",
    "theme": "light",
}


def _text(value: Any, fallback: str, limit: int) -> str:
    if not isinstance(value, str):
        return fallback
    text = value.strip()
    if not text:
        return fallback
    return text[:limit]


def _window_image(value: Any) -> str:
    """Accept only a bounded, real image data URL (no remote URLs)."""

    if not isinstance(value, str):
        return ""
    raw = value.strip()
    if not raw or len(raw) > int(MAX_WINDOW_IMAGE_BYTES * 1.4) + 256:
        return ""
    match = _IMAGE_RE.match(raw)
    if not match:
        return ""
    try:
        payload = base64.b64decode(match.group(2), validate=True)
    except (ValueError, TypeError):
        return ""
    if not payload or len(payload) > MAX_WINDOW_IMAGE_BYTES:
        return ""
    kind = match.group(1)
    if kind == "png" and not payload.startswith(b"\x89PNG\r\n\x1a\n"):
        return ""
    if kind in ("jpeg", "jpg") and not payload.startswith(b"\xff\xd8\xff"):
        return ""
    if kind == "gif" and not payload.startswith(b"GIF8"):
        return ""
    if kind == "webp" and not (payload.startswith(b"RIFF") and payload[8:12] == b"WEBP"):
        return ""
    return raw


def normalize_ui_profile(value: Any = None) -> dict[str, Any]:
    """Return a safe profile, clamping every field to the supported range."""

    source = value if isinstance(value, Mapping) else {}
    accent = str(source.get("accent") or "").strip()
    if not _ACCENT_RE.match(accent):
        accent = str(DEFAULT_UI_PROFILE["accent"])
    try:
        radius = int(source.get("radius", DEFAULT_UI_PROFILE["radius"]))
    except (TypeError, ValueError):
        radius = int(DEFAULT_UI_PROFILE["radius"])
    radius = max(8, min(28, radius))
    wallpaper = str(source.get("wallpaper") or "").strip().lower()
    if wallpaper not in WALLPAPERS:
        wallpaper = str(DEFAULT_UI_PROFILE["wallpaper"])
    window_bg = str(source.get("window_bg") or "").strip().lower()
    if window_bg not in WINDOW_BACKGROUNDS:
        window_bg = str(DEFAULT_UI_PROFILE["window_bg"])
    window_color = str(source.get("window_color") or "").strip()
    if not _ACCENT_RE.match(window_color):
        window_color = str(DEFAULT_UI_PROFILE["window_color"])
    window_image = _window_image(source.get("window_image"))
    if window_bg == "image" and not window_image:
        window_bg = "paper"
    density = str(source.get("density") or "").strip().lower()
    if density not in DENSITIES:
        density = str(DEFAULT_UI_PROFILE["density"])
    theme = str(source.get("theme") or "").strip().lower()
    if theme not in THEMES:
        theme = str(DEFAULT_UI_PROFILE["theme"])
    return {
        "version": UI_PROFILE_VERSION,
        "name": _text(source.get("name"), str(DEFAULT_UI_PROFILE["name"]), 32),
        "brand": _text(source.get("brand"), str(DEFAULT_UI_PROFILE["brand"]), 24),
        "glyph": _text(source.get("glyph"), str(DEFAULT_UI_PROFILE["glyph"]), 2),
        "accent": accent.lower(),
        "wallpaper": wallpaper,
        "window_bg": window_bg,
        "window_color": window_color.lower(),
        "window_image": window_image,
        "radius": radius,
        "density": density,
        "theme": theme,
    }


def export_ui_profile(profile: Any = None) -> dict[str, Any]:
    normalized = normalize_ui_profile(profile)
    return {
        "format": UI_PROFILE_FORMAT,
        "version": UI_PROFILE_VERSION,
        "exported_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "profile": normalized,
    }


def parse_ui_profile_payload(payload: Any) -> tuple[dict[str, Any] | None, str]:
    """Parse a direct profile or an exported envelope.

    Returns ``(profile, "")`` on success or ``(None, reason)`` when the payload
    is not a profile envelope.  Field-level problems are clamped, not rejected.
    """

    data = payload
    if isinstance(payload, str):
        if len(payload.encode("utf-8", errors="ignore")) > MAX_UI_PROFILE_BYTES:
            return None, "profile_too_large"
        try:
            data = json.loads(payload)
        except (TypeError, ValueError):
            return None, "invalid_json"
    if not isinstance(data, Mapping):
        return None, "invalid_profile"
    if "format" in data and str(data.get("format")) != UI_PROFILE_FORMAT:
        return None, "unsupported_format"
    candidate = data.get("profile") if isinstance(data.get("profile"), Mapping) else data
    if not isinstance(candidate, Mapping):
        return None, "invalid_profile"
    return normalize_ui_profile(candidate), ""


__all__ = [
    "DEFAULT_UI_PROFILE",
    "DENSITIES",
    "MAX_UI_PROFILE_BYTES",
    "MAX_WINDOW_IMAGE_BYTES",
    "THEMES",
    "UI_PROFILE_FORMAT",
    "UI_PROFILE_VERSION",
    "WALLPAPERS",
    "WINDOW_BACKGROUNDS",
    "export_ui_profile",
    "normalize_ui_profile",
    "parse_ui_profile_payload",
]
