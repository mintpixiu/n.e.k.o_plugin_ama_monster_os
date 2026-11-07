from __future__ import annotations

from datetime import datetime, timezone

from steam_sales import evaluate_sales


def _now(year: int, month: int, day: int, hour: int = 0) -> datetime:
    return datetime(year, month, day, hour, tzinfo=timezone.utc)


def test_before_autumn_battler_fest() -> None:
    sale = evaluate_sales(_now(2026, 11, 7))
    assert sale["current"] is None
    assert sale["next"]["id"] == "auto_battler_rpg_2026"
    assert sale["next"]["status"] == "upcoming"
    assert sale["next"]["starts_in_seconds"] > 0
    assert sale["next_seasonal"]["id"] == "winter_2026"
    assert sale["updated"] == "2026-11-07"
    assert sale["source_url"].startswith("https://partner.steamgames.com/")


def test_active_auto_battler_fest() -> None:
    sale = evaluate_sales(_now(2026, 11, 18, 12))
    assert sale["current"]["id"] == "auto_battler_rpg_2026"
    assert sale["current"]["status"] == "active"
    assert sale["next"]["id"] == "winter_2026"
    assert sale["next_seasonal"]["id"] == "winter_2026"


def test_winter_sale_is_current_and_spring_is_next() -> None:
    sale = evaluate_sales(_now(2026, 12, 20))
    assert sale["current"]["id"] == "winter_2026"
    assert sale["next"]["id"] == "spring_2027"
    assert sale["next_seasonal"]["id"] == "spring_2027"
    assert any(item["id"] == "autumn_2027" and item["tbd"] for item in sale["all"])


def test_spring_2027_is_current() -> None:
    sale = evaluate_sales(_now(2027, 3, 19))
    assert sale["current"]["id"] == "spring_2027"
    assert sale["next"]["id"] == "summer_2027"


def test_tbd_autumn_is_not_used_as_next() -> None:
    sale = evaluate_sales(_now(2027, 8, 1))
    assert sale["current"] is None
    assert sale["next"] is None
    assert sale["next_seasonal"] is None
    assert any(item["id"] == "autumn_2027" and item["status"] == "tbd" for item in sale["all"])
