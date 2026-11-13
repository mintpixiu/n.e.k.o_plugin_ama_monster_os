"""Curated free-to-play shelf for the Steam room.

These are permanently free Steam titles, not limited-time giveaways. The list
is a versioned, curated pool; the window shows one rotating group at a time so
refreshing does not always show the same six titles.
"""

from __future__ import annotations

from typing import Any

FREE_TO_PLAY_UPDATED = "2026-11-13"
FREE_TO_PLAY_GROUP_SIZE = 6

FREE_TO_PLAY: tuple[dict[str, Any], ...] = (
    {"app_id": "730", "title": "Counter-Strike 2"},
    {"app_id": "570", "title": "Dota 2"},
    {"app_id": "440", "title": "Team Fortress 2"},
    {"app_id": "230410", "title": "Warframe"},
    {"app_id": "238960", "title": "Path of Exile"},
    {"app_id": "1172470", "title": "Apex Legends"},
    {"app_id": "1085660", "title": "Destiny 2"},
    {"app_id": "628890", "title": "Overwatch 2"},
    {"app_id": "252950", "title": "Rocket League"},
    {"app_id": "552990", "title": "Brawlhalla"},
    {"app_id": "1238810", "title": "THE FINALS"},
    {"app_id": "1938090", "title": "Call of Duty: Warzone"},
    {"app_id": "2235520", "title": "Genshin Impact"},
    {"app_id": "1599340", "title": "Lost Ark"},
    {"app_id": "236390", "title": "War Thunder"},
    {"app_id": "578080", "title": "PUBG: BATTLEGROUNDS"},
    {"app_id": "1203220", "title": "Naraka: Bladepoint"},
    {"app_id": "2139460", "title": "Once Human"},
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
    "Destiny 2": "命运2",
    "Overwatch 2": "守望先锋2",
    "Rocket League": "火箭联盟",
    "Brawlhalla": "英灵乱斗",
    "THE FINALS": "最终决战",
    "Call of Duty: Warzone": "使命召唤：战区",
    "Genshin Impact": "原神",
    "Lost Ark": "失落的方舟",
    "War Thunder": "战争雷霆",
    "PUBG: BATTLEGROUNDS": "绝地求生",
    "Naraka: Bladepoint": "永劫无间",
    "Once Human": "七日世界",
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


def free_to_play_entries(offset: int = 0, count: int = FREE_TO_PLAY_GROUP_SIZE) -> list[dict[str, Any]]:
    """Return one rotating group of permanently free titles.

    Groups are round-robin windows over the curated pool, so consecutive
    offsets show different titles instead of the same fixed shelf.
    """

    pool = [
        {
            **item,
            "title_cn": chinese_title(item["title"]),
            "store_url": f"https://store.steampowered.com/app/{item['app_id']}/",
            "source": "Steam",
        }
        for item in FREE_TO_PLAY
    ]
    size = max(1, min(int(count or FREE_TO_PLAY_GROUP_SIZE), len(pool)))
    if size >= len(pool):
        return pool
    start = (int(offset or 0) % len(pool) * size) % len(pool)
    rotated = pool[start:] + pool[:start]
    return rotated[:size]


__all__ = [
    "CN_TITLE_ALIASES",
    "FREE_TO_PLAY",
    "FREE_TO_PLAY_GROUP_SIZE",
    "FREE_TO_PLAY_UPDATED",
    "chinese_title",
    "free_to_play_entries",
]

