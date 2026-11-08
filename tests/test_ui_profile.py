from __future__ import annotations

import json

from ui_profile import (
    DEFAULT_UI_PROFILE,
    export_ui_profile,
    normalize_ui_profile,
    parse_ui_profile_payload,
)


def test_default_profile_is_safe() -> None:
    profile = normalize_ui_profile(None)
    assert profile == DEFAULT_UI_PROFILE
    assert profile["accent"] == "#44b8f2"
    assert profile["radius"] == 16


def test_profile_fields_are_clamped() -> None:
    profile = normalize_ui_profile({
        "name": "  My Shell  ",
        "brand": "A" * 80,
        "glyph": "✦✦✦",
        "accent": "red",
        "wallpaper": "unknown",
        "window_bg": "unknown",
        "window_color": "white",
        "radius": 99,
        "density": "tiny",
        "theme": "sepia",
    })
    assert profile["name"] == "My Shell"
    assert len(profile["brand"]) == 24
    assert profile["glyph"] == "✦✦"
    assert profile["accent"] == DEFAULT_UI_PROFILE["accent"]
    assert profile["wallpaper"] == "grid"
    assert profile["window_bg"] == "paper"
    assert profile["window_color"] == "#ffffff"
    assert profile["radius"] == 28
    assert profile["density"] == "comfortable"
    assert profile["theme"] == "light"


def test_custom_window_background_round_trip() -> None:
    profile = normalize_ui_profile({
        "window_bg": "custom",
        "window_color": "#F4E6FF",
        "brand": "Window Only",
    })
    assert profile["window_bg"] == "custom"
    assert profile["window_color"] == "#f4e6ff"
    exported = export_ui_profile(profile)
    parsed, error = parse_ui_profile_payload(json.dumps(exported))
    assert error == ""
    assert parsed["window_color"] == "#f4e6ff"


def test_window_image_data_url_is_validated() -> None:
    png = (
        "data:image/png;base64,"
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
    )
    profile = normalize_ui_profile({"window_bg": "image", "window_image": png})
    assert profile["window_bg"] == "image"
    assert profile["window_image"] == png

    fallback = normalize_ui_profile({"window_bg": "image", "window_image": "https://example.com/bg.png"})
    assert fallback["window_bg"] == "paper"
    assert fallback["window_image"] == ""

    bad_magic = "data:image/png;base64,aGVsbG8="
    assert normalize_ui_profile({"window_bg": "image", "window_image": bad_magic})["window_bg"] == "paper"


def test_export_round_trip() -> None:
    profile = normalize_ui_profile({
        "name": "Sakura",
        "brand": "Ama 樱",
        "glyph": "❀",
        "accent": "#e88aa8",
        "wallpaper": "dots",
        "radius": 20,
        "density": "compact",
        "theme": "dark",
    })
    exported = export_ui_profile(profile)
    parsed, error = parse_ui_profile_payload(json.dumps(exported))
    assert error == ""
    assert parsed == profile


def test_direct_profile_and_invalid_payloads() -> None:
    parsed, error = parse_ui_profile_payload({"accent": "#4fc3a1", "theme": "dark"})
    assert error == ""
    assert parsed["accent"] == "#4fc3a1"
    assert parsed["theme"] == "dark"

    parsed, error = parse_ui_profile_payload("{not json")
    assert parsed is None
    assert error == "invalid_json"

    parsed, error = parse_ui_profile_payload({"format": "other", "profile": {}})
    assert parsed is None
    assert error == "unsupported_format"
