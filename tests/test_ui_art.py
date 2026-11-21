from __future__ import annotations

from urllib.parse import unquote

from ui_art import ELATION_MEDIA_TYPE, elation_art, ui_art_payload


def test_elation_art_is_a_self_contained_svg() -> None:
    uri = elation_art()
    assert uri.startswith(ELATION_MEDIA_TYPE)
    svg = unquote(uri[len(ELATION_MEDIA_TYPE):])
    assert svg.startswith("<svg")
    assert svg.rstrip().endswith("</svg>")
    # The xmlns namespace URI is not a fetch; assert no real external references.
    assert "href=" not in svg
    assert "url(http" not in svg
    assert "src=" not in svg
    assert len(uri) < 60_000


def test_ui_art_payload_keys() -> None:
    payload = ui_art_payload()
    assert set(payload) == {"elation"}
