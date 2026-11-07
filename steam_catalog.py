"""Curated free-to-play shelf for the Steam room.

These are permanently free Steam titles, not limited-time giveaways. The list
is intentionally small and versioned; it is not a live Steam catalogue.
"""

from __future__ import annotations

from typing import Any

FREE_TO_PLAY_UPDATED = "2026-11-07"

FREE_TO_PLAY: tuple[dict[str, Any], ...] = (
    {"app_id": "730", "title": "Counter-Strike 2"},
    {"app_id": "570", "title": "Dota 2"},
    {"app_id": "440", "title": "Team Fortress 2"},
    {"app_id": "230410", "title": "Warframe"},
    {"app_id": "238960", "title": "Path of Exile"},
    {"app_id": "1172470", "title": "Apex Legends"},
)

# Common Chinese names for titles whose Steam appdetails name stays English.
# Steam's localized name wins when it contains CJK; this map is the fallback.
CN_TITLE_ALIASES: dict[str, str] = {
    "Counter-Strike 2": "反恐精英2",
    "Dota 2": "刀塔2",
    "Team Fortress 2": "军团要塞2",
    "Warframe": "星际战甲",
    "Path of Exile": "流放之路",
    "Apex Legends": "Apex 英雄",
    "Portal 2": "传送门2",
    "Portal 2 - The Final Hours": "传送门2：最终时刻",
    "Sid Meier's Civilization IV": "文明4",
    "Company of Heroes": "英雄连",
    "Borderlands 2": "无主之地2",
    "Cross Blitz": "纵横命途",
    "Owlboy": "猫头鹰男孩",
    "For The King": "为了吾王",
}


def _has_cjk(text: str) -> bool:
    return any("\u4e00" <= char <= "\u9fff" for char in text)


def chinese_title(title: str, localized: str = "") -> str:
    """Return a Chinese title, preferring an official CJK Steam name."""

    candidate = str(localized or "").strip()
    if candidate and _has_cjk(candidate):
        return candidate
    return CN_TITLE_ALIASES.get(str(title or "").strip(), "")


def free_to_play_entries() -> list[dict[str, Any]]:
    """Return the static shelf with fixed Steam store links."""

    return [
        {
            **item,
            "title_cn": chinese_title(item["title"]),
            "store_url": f"https://store.steampowered.com/app/{item['app_id']}/",
            "source": "Steam",
        }
        for item in FREE_TO_PLAY
    ]


__all__ = [
    "CN_TITLE_ALIASES",
    "FREE_TO_PLAY",
    "FREE_TO_PLAY_UPDATED",
    "chinese_title",
    "free_to_play_entries",
]

