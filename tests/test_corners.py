"""Static guards for the continuous-curvature (G2) corner rule.

The window draws every rounded rectangle with ``corner-shape: squircle`` so the
straight edges flow into the corners with continuous curvature (G2) instead of a
circular arc butt-joined at the seam (G1).  Two invariants are easy to break by
accident and are checked here:

* every ``corner-shape`` declaration stays behind ``@supports``, so hosts
  without the property (Firefox, older Chromium/WebKit) keep their arcs;
* every circle or pill in ``STYLES`` is reset to ``corner-shape: round`` -- a
  superellipse would square a round shape off instead of smoothing it.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PANEL = ROOT / "ui" / "panel.tsx"


def _styles() -> str:
    text = PANEL.read_text(encoding="utf-8")
    start = text.index("const STYLES = `")
    end = text.index("\n`\n", start)
    css = text[start:end]
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def _split_selectors(text: str) -> list[str]:
    out: list[str] = []
    depth = 0
    current = ""
    for char in text:
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        if char == "," and depth == 0:
            out.append(" ".join(current.split()))
            current = ""
        else:
            current += char
    if current.strip():
        out.append(" ".join(current.split()))
    return [item for item in out if item]


def _rules(css: str) -> list[tuple[str, str]]:
    return [(sel, body) for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", css)]


def _round_reset_selectors(css: str) -> list[str]:
    block = css[css.index("@supports (corner-shape: squircle)") :]
    selectors: list[str] = []
    for selector, body in _rules(block):
        if "corner-shape: round" not in body:
            continue
        for part in _split_selectors(selector):
            where = re.match(r"^(.*?):where\((.*)\)(.*)$", part)
            if where:
                for inner in _split_selectors(where.group(2)):
                    selectors.append(" ".join(f"{where.group(1)} {inner} {where.group(3)}".split()))
            else:
                selectors.append(part)
    return selectors


def _circular_selectors(css: str) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    for selector, body in _rules(css):
        for match in re.finditer(r"border-radius\s*:\s*([^;]+);", body):
            value = match.group(1).strip()
            numbers = value.replace("/", " ").split()
            circle = any(item.endswith("%") and float(item[:-1]) >= 50 for item in numbers)
            pill = any(item.endswith("px") and float(item[:-2]) >= 100 for item in numbers)
            if circle or pill:
                found.extend((part, value) for part in _split_selectors(selector))
    return found


def _covered(selector: str, reset: list[str]) -> bool:
    if any(item == selector or item.endswith(f" {selector}") for item in reset):
        return True
    classes = set(re.findall(r"\.([A-Za-z0-9_-]+)", selector))
    for item in reset:
        pattern = re.fullmatch(r'.*\[class\*="([^"]+)"\].*', item)
        if pattern and any(name.endswith(pattern.group(1)) for name in classes):
            return True
    return False


def test_corner_shape_stays_behind_supports() -> None:
    text = PANEL.read_text(encoding="utf-8")
    guarded_start = text.index("@supports (corner-shape: squircle)")
    guarded_end = text.index("\n`\n", guarded_start)
    outside = text[:guarded_start] + text[guarded_end:]
    # comments may document the rule; only real declarations must be guarded
    outside = re.sub(r"/\*.*?\*/", "", outside, flags=re.S)
    assert "corner-shape" not in outside


def test_continuous_curvature_rule_is_wired() -> None:
    css = _styles()
    assert "@supports (corner-shape: squircle)" in css
    assert "--ui-corner-curve: squircle;" in css
    assert ".ama-root *::before" in css and ".ama-root *::after" in css
    assert "corner-shape: var(--ui-corner-curve);" in css


def test_every_circle_and_pill_is_reset_to_round() -> None:
    css = _styles()
    circular = _circular_selectors(css)
    reset = _round_reset_selectors(css)
    assert len(circular) > 30, "STYLES parser lost circular/pill rules"
    assert len(reset) > 15, "STYLES parser lost corner-shape resets"
    missing = [f"{selector} ({value})" for selector, value in circular if not _covered(selector, reset)]
    assert missing == [], "circles/pills missing a corner-shape: round reset: " + ", ".join(missing)


def test_corner_radius_stays_a_studio_setting() -> None:
    css = _styles()
    assert "corner-shape" in css
    # curvature is fixed; only the size comes from the Studio radius slider
    assert "calc(var(--ui-radius) + 6px)" in css
    profile = (ROOT / "ui_profile.py").read_text(encoding="utf-8")
    assert "corner" not in profile
