from __future__ import annotations

from steam_catalog import FREE_TO_PLAY, FREE_TO_PLAY_UPDATED, free_to_play_entries


def test_free_shelf_has_fixed_store_links() -> None:
    entries = free_to_play_entries()
    assert FREE_TO_PLAY_UPDATED == "2026-11-07"
    assert len(entries) == len(FREE_TO_PLAY)
    assert {entry["app_id"] for entry in entries} >= {"730", "570", "440"}
    assert all(entry["store_url"].startswith("https://store.steampowered.com/app/") for entry in entries)
    assert all(entry["source"] == "Steam" for entry in entries)
