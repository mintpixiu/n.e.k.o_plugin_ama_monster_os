from __future__ import annotations

from steam_catalog import (
    FREE_TO_PLAY,
    FREE_TO_PLAY_UPDATED,
    chinese_title,
    free_to_play_entries,
)


def test_free_shelf_has_fixed_store_links() -> None:
    entries = free_to_play_entries()
    assert FREE_TO_PLAY_UPDATED == "2026-11-07"
    assert len(entries) == len(FREE_TO_PLAY)
    assert {entry["app_id"] for entry in entries} >= {"730", "570", "440"}
    assert all(entry["store_url"].startswith("https://store.steampowered.com/app/") for entry in entries)
    assert all(entry["source"] == "Steam" for entry in entries)
    assert next(entry for entry in entries if entry["app_id"] == "730")["title_cn"] == "反恐精英2"


def test_chinese_title_prefers_official_cjk_name() -> None:
    assert chinese_title("Borderlands 2") == "无主之地2"
    assert chinese_title("Unknown Game") == ""
    assert chinese_title("Borderlands 2", "无主之地 2") == "无主之地 2"
    assert chinese_title("Borderlands 2", "Borderlands 2") == "无主之地2"
