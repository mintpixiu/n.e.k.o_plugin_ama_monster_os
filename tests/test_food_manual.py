from __future__ import annotations

import asyncio
import json
import random
import re

from food_manual import (
    BRANDS,
    DISH_CATEGORIES,
    DISHES,
    PLATFORMS,
    draw_meal,
    food_manual_payload,
)
from shell_runtime import AmaOsRuntime
from system_contract import ENTRYPOINTS, build_manifest, validate_manifest

PLATFORM_IDS = {"meituan", "eleme", "jd", "taobao", "douyin"}
ALLOWED_URL_PREFIXES = (
    "https://www.meituan.com/",
    "https://www.ele.me/",
    "https://www.jd.com/",
    "https://www.taobao.com/",
    "https://www.douyin.com/",
    "https://cook.yunyoujun.cn/",
    "https://docs.yunyoujun.cn/",
)


class FakePort:
    provider_id = "test-host"
    mode = "hosted-plugin"
    capabilities = ()

    def __init__(self) -> None:
        self.events: list[tuple[str, str]] = []
        self.closed = False

    def manifest(self):
        return build_manifest(provider_id=self.provider_id, mode=self.mode, capabilities=["telemetry.environment"])

    async def environment(self):
        return {"platform": "Windows", "python": "3.11", "sdk": "0.1.0"}

    async def activity(self):
        return None

    def record_event(self, name: str, detail: str = "") -> None:
        self.events.append((name, detail))

    async def close(self) -> None:
        self.closed = True


def test_platforms_cover_the_configured_marketplaces() -> None:
    assert {platform["id"] for platform in PLATFORMS} == PLATFORM_IDS
    for platform in PLATFORMS:
        assert platform["name"]
        assert platform["entry"]
        assert platform["caution"]
        assert platform["url"].startswith("https://")
        coupons = platform["coupons"]
        assert len(coupons) >= 4
        for coupon in coupons:
            assert coupon["title"] and coupon["how"]
            assert isinstance(coupon.get("note", ""), str)
        codes = platform["codes"]
        assert len(codes) >= 2
        for code in codes:
            assert code["code"] and code["how"]
            assert isinstance(code.get("note", ""), str)


def test_brands_and_dishes_reference_known_platforms() -> None:
    assert BRANDS and DISHES
    for entry in (*BRANDS, *DISHES):
        assert entry["id"] and entry["name"]
        assert entry["coupon"] and entry["arrival"]
        assert set(entry["platforms"]) <= PLATFORM_IDS
        assert entry["platforms"]
    for dish in DISHES:
        assert dish["category"] in DISH_CATEGORIES


def test_payload_is_offline_and_serializable() -> None:
    payload = food_manual_payload()
    assert payload["ok"] is True
    assert payload["name"] == "食用手册"
    assert payload["version"] and payload["updated"] == "2026-11-22"
    assert payload["disclaimer"]
    assert payload["coupon_code_note"]
    assert payload["summary"] == {
        "platforms": len(PLATFORMS),
        "brands": len(BRANDS),
        "dishes": len(DISHES),
    }
    assert len(payload["platforms"]) == len(PLATFORMS)
    assert len(payload["brands"]) == len(BRANDS)
    assert len(payload["dishes"]) == len(DISHES)
    # Only the documented platform entries and the original manual links are
    # allowed; the manual never embeds arbitrary URLs or real store addresses.
    text = json.dumps(payload, ensure_ascii=False)
    urls = set(re.findall(r"https?://[^\s\"'<>]+", text))
    assert urls
    for url in urls:
        assert any(url.startswith(prefix) for prefix in ALLOWED_URL_PREFIXES), url
    json.dumps(payload)


def test_original_manual_usage_is_documented() -> None:
    original = food_manual_payload()["original"]
    assert original["name"] == "隔离食用手册"
    assert "云游君" in original["author"]
    assert original["url"] == "https://cook.yunyoujun.cn/"
    assert original["docs_url"].startswith("https://docs.yunyoujun.cn/")
    assert original["summary"] and original["note"]
    assert len(original["steps"]) >= 3
    assert all(step for step in original["steps"])


def test_draw_returns_consistent_choice() -> None:
    result = draw_meal(rng=random.Random(7))
    assert result["ok"] is True
    dish = result["dish"]
    platform = result["platform"]
    assert dish["id"] in {item["id"] for item in DISHES}
    assert platform["id"] in dish["platforms"]
    assert result["arrival"] == dish["arrival"]
    assert result["coupon"]["title"]

    platform_data = next(item for item in PLATFORMS if item["id"] == platform["id"])
    coupon_titles = {coupon["title"] for coupon in platform_data["coupons"]}
    assert result["coupon"]["title"] in coupon_titles


def test_draw_respects_category_and_avoid() -> None:
    category = DISH_CATEGORIES[0]
    for seed in range(12):
        result = draw_meal(category=category, rng=random.Random(seed))
        assert result["dish"]["category"] == category

    dish_ids = [item["id"] for item in DISHES]
    first = draw_meal(rng=random.Random(3))
    second = draw_meal(avoid=first["dish"]["id"], rng=random.Random(3))
    assert second["dish"]["id"] != first["dish"]["id"]
    assert second["dish"]["id"] in dish_ids

    # A recent-history list is honoured as well, so the picker keeps rotating.
    excluded = random.Random(11).sample(dish_ids, 10)
    third = draw_meal(avoid=excluded, rng=random.Random(5))
    assert third["dish"]["id"] not in excluded

    unknown = draw_meal(category="不存在的分类", rng=random.Random(3))
    assert unknown["dish"]["id"] in dish_ids


def test_runtime_snapshot_and_draw_food() -> None:
    port = FakePort()
    runtime = AmaOsRuntime(port)
    runtime.set_food(food_manual_payload())

    snapshot = asyncio.run(runtime.snapshot())

    assert snapshot["food"]["name"] == "食用手册"
    assert snapshot["food"]["summary"]["platforms"] == len(PLATFORMS)
    assert len(snapshot["food"]["platforms"]) == len(PLATFORMS)

    result = runtime.draw_food()
    assert result["ok"] is True
    assert any(name == "food.draw" for name, _detail in port.events)

    # The runtime remembers the previous eight dishes, so eight consecutive
    # draws cannot repeat a name even with a fresh random source.
    drawn = [result["dish"]["id"]]
    for _ in range(7):
        drawn.append(runtime.draw_food()["dish"]["id"])
    assert len(drawn) == len(set(drawn)) == 8


def test_contract_lists_food_entrypoints() -> None:
    assert ENTRYPOINTS["food_manual"] == "ama_food_manual"
    assert ENTRYPOINTS["food_draw"] == "ama_food_draw"
    manifest = build_manifest(
        provider_id="test-host",
        mode="hosted-plugin",
        capabilities=["telemetry.environment"],
    )
    assert validate_manifest(manifest) == []
