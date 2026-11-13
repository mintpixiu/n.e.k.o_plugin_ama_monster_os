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
MAX_UI_PROFILE_BYTES = 4_000_000
MAX_WINDOW_IMAGE_BYTES = 1_200_000
MAX_SOUND_BYTES = 1_000_000
WALLPAPERS = ("grid", "dots", "aurora", "stars", "plain")
WINDOW_BACKGROUNDS = ("paper", "mist", "sakura", "glass", "gradient", "image", "custom")
SOUND_MODES = ("steam", "soft", "mechanical", "custom")
DENSITIES = ("comfortable", "compact")
THEMES = ("light", "dark")
MATERIALS = ("glass", "solid")
_ACCENT_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
_IMAGE_RE = re.compile(r"^data:image/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=\s]+)$")
_AUDIO_RE = re.compile(r"^data:audio/(wav|mpeg|mp3|ogg);base64,([A-Za-z0-9+/=\s]+)$")

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
    "gradient_colors": ["#44b8f2", "#9b8ad9", "#e88aa8"],
    "gradient_angle": 135,
    "sound_enabled": True,
    "sound_mode": "steam",
    "sound_volume": 0.55,
    "sound_data": "",
    "sound_name": "",
    "material": "glass",
    "glass_blur": 24,
    "glass_alpha": 58,
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


def _sound_data(value: Any) -> str:
    """Accept only a bounded WAV/MP3/OGG data URL, never a remote URL."""

    if not isinstance(value, str):
        return ""
    raw = value.strip()
    if not raw or len(raw) > int(MAX_SOUND_BYTES * 1.4) + 256:
        return ""
    match = _AUDIO_RE.match(raw)
    if not match:
        return ""
    try:
        payload = base64.b64decode(match.group(2), validate=True)
    except (ValueError, TypeError):
        return ""
    if not payload or len(payload) > MAX_SOUND_BYTES:
        return ""
    kind = match.group(1)
    if kind == "wav" and not (payload.startswith(b"RIFF") and payload[8:12] == b"WAVE"):
        return ""
    if kind in ("mpeg", "mp3") and not (payload.startswith(b"ID3") or payload[0] == 0xFF):
        return ""
    if kind == "ogg" and not payload.startswith(b"OggS"):
        return ""
    return raw


def _gradient_colors(value: Any) -> list[str]:
    if not isinstance(value, (list, tuple)):
        return list(DEFAULT_UI_PROFILE["gradient_colors"])
    colors: list[str] = []
    for item in value:
        text = str(item or "").strip().lower()
        if _ACCENT_RE.match(text) and text not in colors:
            colors.append(text)
        if len(colors) >= 30:
            break
    if len(colors) < 2:
        return list(DEFAULT_UI_PROFILE["gradient_colors"])
    return colors


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
    gradient_colors = _gradient_colors(source.get("gradient_colors"))
    try:
        gradient_angle = int(source.get("gradient_angle", DEFAULT_UI_PROFILE["gradient_angle"]))
    except (TypeError, ValueError):
        gradient_angle = int(DEFAULT_UI_PROFILE["gradient_angle"])
    gradient_angle = max(0, min(360, gradient_angle))
    sound_enabled = bool(source.get("sound_enabled", DEFAULT_UI_PROFILE["sound_enabled"]))
    sound_mode = str(source.get("sound_mode") or "").strip().lower()
    if sound_mode not in SOUND_MODES:
        sound_mode = str(DEFAULT_UI_PROFILE["sound_mode"])
    try:
        sound_volume = float(source.get("sound_volume", DEFAULT_UI_PROFILE["sound_volume"]))
    except (TypeError, ValueError):
        sound_volume = float(DEFAULT_UI_PROFILE["sound_volume"])
    sound_volume = round(max(0.0, min(1.0, sound_volume)), 2)
    sound_data = _sound_data(source.get("sound_data"))
    if sound_mode == "custom" and not sound_data:
        sound_mode = "steam"
    sound_name = _text(
        source.get("sound_name"),
        "Custom sound" if sound_mode == "custom" else "",
        80,
    )
    material = str(source.get("material") or "").strip().lower()
    if material not in MATERIALS:
        material = str(DEFAULT_UI_PROFILE["material"])
    try:
        glass_blur = int(source.get("glass_blur", DEFAULT_UI_PROFILE["glass_blur"]))
    except (TypeError, ValueError):
        glass_blur = int(DEFAULT_UI_PROFILE["glass_blur"])
    glass_blur = max(6, min(40, glass_blur))
    try:
        glass_alpha = int(source.get("glass_alpha", DEFAULT_UI_PROFILE["glass_alpha"]))
    except (TypeError, ValueError):
        glass_alpha = int(DEFAULT_UI_PROFILE["glass_alpha"])
    glass_alpha = max(28, min(92, glass_alpha))
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
        "gradient_colors": gradient_colors,
        "gradient_angle": gradient_angle,
        "sound_enabled": sound_enabled,
        "sound_mode": sound_mode,
        "sound_volume": sound_volume,
        "sound_data": sound_data,
        "sound_name": sound_name,
        "material": material,
        "glass_blur": glass_blur,
        "glass_alpha": glass_alpha,
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
    "MAX_SOUND_BYTES",
    "MATERIALS",
    "MAX_WINDOW_IMAGE_BYTES",
    "SOUND_MODES",
    "THEMES",
    "UI_PROFILE_FORMAT",
    "UI_PROFILE_VERSION",
    "WALLPAPERS",
    "WINDOW_BACKGROUNDS",
    "export_ui_profile",
    "normalize_ui_profile",
    "parse_ui_profile_payload",
]
