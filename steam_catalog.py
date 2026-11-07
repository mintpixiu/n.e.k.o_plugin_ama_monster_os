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


def free_to_play_entries() -> list[dict[str, Any]]:
    """Return the static shelf with fixed Steam store links."""

    return [
        {
            **item,
            "store_url": f"https://store.steampowered.com/app/{item['app_id']}/",
            "source": "Steam",
        }
        for item in FREE_TO_PLAY
    ]


__all__ = ["FREE_TO_PLAY", "FREE_TO_PLAY_UPDATED", "free_to_play_entries"]
