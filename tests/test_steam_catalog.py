from __future__ import annotations

from steam_catalog import (
    FREE_TO_PLAY,
    FREE_TO_PLAY_GROUP_SIZE,
    FREE_TO_PLAY_UPDATED,
    chinese_title,
    free_to_play_entries,
)


def test_free_shelf_has_fixed_store_links() -> None:
    entries = free_to_play_entries()
    assert FREE_TO_PLAY_UPDATED == "2026-11-13"
    assert len(entries) == FREE_TO_PLAY_GROUP_SIZE
    assert len(entries) <= len(FREE_TO_PLAY)
    assert {entry["app_id"] for entry in entries} <= {item["app_id"] for item in FREE_TO_PLAY}
    assert all(entry["store_url"].startswith("https://store.steampowered.com/app/") for entry in entries)
    assert all(entry["source"] == "Steam" for entry in entries)
    assert next(entry for entry in entries if entry["app_id"] == "730")["title_cn"] == "反恐精英2"


def test_free_shelf_rotates_between_groups() -> None:
    first = [entry["app_id"] for entry in free_to_play_entries(0)]
    second = [entry["app_id"] for entry in free_to_play_entries(1)]
    third = [entry["app_id"] for entry in free_to_play_entries(2)]

    assert first != second
    assert second != third
    assert first != third
    assert not set(first) & set(second)
    assert not set(second) & set(third)


def test_free_shelf_groups_cover_whole_pool() -> None:
    total = len(FREE_TO_PLAY)
    size = FREE_TO_PLAY_GROUP_SIZE
    groups = (total + size - 1) // size
    seen: set[str] = set()
    for offset in range(groups):
        seen.update(entry["app_id"] for entry in free_to_play_entries(offset, size))
    assert seen == {item["app_id"] for item in FREE_TO_PLAY}


def test_chinese_title_prefers_official_cjk_name() -> None:
    assert chinese_title("Borderlands 2") == "无主之地2"
    assert chinese_title("Unknown Game") == ""
    assert chinese_title("Borderlands 2", "无主之地 2") == "无主之地 2"
    assert chinese_title("Borderlands 2", "Borderlands 2") == "无主之地2"
    assert chinese_title("Genshin Impact") == "原神"
    assert chinese_title("Naraka: Bladepoint") == "永劫无间"