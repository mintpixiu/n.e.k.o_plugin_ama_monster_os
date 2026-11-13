from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any

from shell_runtime import AmaOsRuntime
from system_contract import (
    CONTRACT_VERSION,
    MODE_HOSTED_PLUGIN,
    SystemPort,
    build_manifest,
    validate_manifest,
)


@dataclass
class FakePort:
    provider_id: str = "test-host"
    mode: str = MODE_HOSTED_PLUGIN
    capabilities: tuple[str, ...] = ("telemetry.environment", "activity.privacy")
    privacy: str = "visible"
    fail: bool = False
    closed: bool = False
    events: list[str] | None = None

    def __post_init__(self) -> None:
        self.events = []

    def manifest(self) -> dict[str, Any]:
        return build_manifest(
            provider_id=self.provider_id,
            mode=self.mode,
            capabilities=self.capabilities,
        )

    async def environment(self) -> dict[str, Any]:
        if self.fail:
            raise RuntimeError("environment unavailable")
        return {
            "host": "N.E.K.O",
            "host_surface": "plugin-manager",
            "platform": "Windows",
            "os_release": "11",
            "python": "3.11.0",
            "sdk": "0.1.0",
        }

    async def activity(self) -> dict[str, Any]:
        if self.fail:
            raise RuntimeError("activity unavailable")
        return {
            "available": True,
            "privacy": self.privacy,
            "category": "game" if self.privacy == "visible" else None,
            "idle_seconds": 4.2,
        }

    def record_event(self, name: str, detail: str = "") -> None:
        assert self.events is not None
        self.events.append(name)

    async def search_web(self, query: str, max_results: int = 5) -> dict[str, Any]:
        if self.fail:
            raise RuntimeError("search unavailable")
        return {
            "ok": True,
            "available": True,
            "provider": "test-search",
            "query": query,
            "count": 1,
            "results": [{
                "title": "A test result",
                "url": "https://example.com/page",
                "snippet": "A small snippet.",
                "domain": "example.com",
            }],
            "at": "2026-01-01T00:00:00Z",
        }

    async def search_game_prices(self, query: str, max_results: int = 3) -> dict[str, Any]:
        if self.fail:
            raise RuntimeError("price search unavailable")
        return {
            "ok": True,
            "available": True,
            "provider": "CheapShark",
            "currency": "USD",
            "query": query,
            "count": 1,
            "results": [{
                "game_id": "36",
                "steam_app_id": "620",
                "title": "Portal 2",
                "title_cn": "传送门2",
                "currency": "USD",
                "current": {
                    "price": "9.99",
                    "retail_price": "19.99",
                    "savings_percent": 50,
                    "store": "Steam",
                },
                "history": {
                    "lowest": "0.99",
                    "date": "2019-06-25",
                    "currency": "USD",
                },
                "gap_to_low": "+9.00",
                "is_at_low": False,
                "cn": {
                    "available": True,
                    "currency": "CNY",
                    "price": "35.00",
                    "initial": "35.00",
                    "discount_percent": 0,
                    "formatted": "¥ 35.00",
                    "source": "Steam CN",
                },
                "source": "CheapShark",
            }],
            "at": "2026-01-01T00:00:00Z",
        }

    async def fetch_steam_deals(self, max_results: int = 6) -> dict[str, Any]:
        if self.fail:
            raise RuntimeError("deal search unavailable")
        return {
            "ok": True,
            "available": True,
            "provider": "CheapShark",
            "currency": "USD",
            "count": 1,
            "results": [{
                "game_id": "88304",
                "steam_app_id": "49520",
                "title": "Borderlands 2",
                "title_cn": "无主之地2",
                "currency": "USD",
                "current": {
                    "price": "1.99",
                    "retail_price": "19.99",
                    "savings_percent": 90,
                    "store": "Steam",
                },
                "history": {
                    "lowest": "1.99",
                    "date": "2026-11-01",
                    "currency": "USD",
                },
                "gap_to_low": "+0.00",
                "is_at_low": True,
                "hoard_worthy": True,
                "cn": {
                    "available": True,
                    "currency": "CNY",
                    "price": "6.40",
                    "initial": "64.00",
                    "discount_percent": 90,
                    "formatted": "¥ 6.40",
                    "source": "Steam CN",
                },
                "deal_rating": 9.5,
                "steam_rating": "Very Positive",
                "steam_percent": 90,
                "metacritic": 89,
                "release_year": 2012,
                "store_url": "https://store.steampowered.com/app/49520/",
                "source": "CheapShark",
            }],
            "at": "2026-01-01T00:00:00Z",
        }

    async def close(self) -> None:
        self.closed = True


def test_fake_port_matches_protocol() -> None:
    assert isinstance(FakePort(), SystemPort)


def test_snapshot_is_versioned_and_serializable() -> None:
    runtime = AmaOsRuntime(FakePort())

    snapshot = asyncio.run(runtime.snapshot())

    assert snapshot["ok"] is True
    assert snapshot["shell"]["version"] == "0.5.3 Beta"
    assert snapshot["shell"]["name"] == "Ama Monster OS"
    assert snapshot["preview"] is True
    assert snapshot["bridge"]["contract_version"] == CONTRACT_VERSION
    assert snapshot["bridge"]["health"] == "ready"
    assert snapshot["bridge"]["activity"]["category"] == "game"
    assert snapshot["telemetry"]["platform"] == "Windows"
    assert len(snapshot["modules"]) == 4
    assert {module["status"] for module in snapshot["modules"]} == {"online", "reserved"}
    json.dumps(snapshot)


def test_private_activity_never_leaks_category() -> None:
    runtime = AmaOsRuntime(FakePort(privacy="private"))

    snapshot = asyncio.run(runtime.snapshot())

    assert snapshot["bridge"]["activity"]["privacy"] == "private"
    assert snapshot["bridge"]["activity"]["category"] is None
    assert snapshot["bridge"]["activity"]["idle_seconds"] is None


def test_start_records_boot_and_pulse() -> None:
    port = FakePort()

    async def scenario() -> tuple[dict[str, Any], dict[str, Any]]:
        runtime = AmaOsRuntime(port)
        await runtime.start()
        before = await runtime.snapshot()
        pulse = await runtime.pulse()
        after = await runtime.snapshot()
        await runtime.stop()
        return before, {"pulse": pulse, "after": after}

    before, rest = asyncio.run(scenario())

    assert before["shell"]["boot_count"] == 1
    assert [event["name"] for event in before["events"]] == ["bridge.attached", "shell.ready"]
    assert rest["pulse"]["ok"] is True
    assert rest["after"]["pulse"]["count"] == 1
    assert port.closed is True
    assert "shell.ready" in (port.events or [])


def test_port_failure_degrades_without_raising() -> None:
    runtime = AmaOsRuntime(FakePort(fail=True))

    snapshot = asyncio.run(runtime.snapshot())

    assert snapshot["bridge"]["health"] == "degraded"
    assert snapshot["telemetry"]["degraded"] is True
    assert snapshot["telemetry"]["platform"] == "unknown"
    assert snapshot["bridge"]["activity"]["privacy"] == "unavailable"


def test_contract_validates() -> None:
    manifest = build_manifest(provider_id="test-host", mode=MODE_HOSTED_PLUGIN)
    assert validate_manifest(manifest) == []
    assert manifest["contract_id"] == "ama.system.bridge"
    assert manifest["api_level"] == 1
    assert manifest["reserved"]
    assert manifest["entrypoints"]["context"] == "os_shell"
    assert manifest["entrypoints"]["web_search"] == "ama_web_search"
    assert manifest["entrypoints"]["steam_search"] == "ama_steam_search"
    assert manifest["entrypoints"]["steam_deals"] == "ama_steam_deals"
    assert manifest["entrypoints"]["token_prices"] == "ama_token_prices"
    assert manifest["entrypoints"]["ui_profile"] == "ama_ui_profile_save"
    assert "web.search" in manifest["capabilities"]
    assert "steam.prices" in manifest["capabilities"]
    assert "steam.deals" in manifest["capabilities"]
    assert "tokens.prices" in manifest["capabilities"]
    assert "steam.account" in manifest["capabilities"]
    assert "web.fetch" in {item["id"] for item in manifest["reserved"]}


def test_web_search_stores_last_result() -> None:
    runtime = AmaOsRuntime(FakePort())

    async def scenario() -> tuple[dict[str, Any], dict[str, Any]]:
        found = await runtime.search_web("N.E.K.O 插件", 5)
        snapshot = await runtime.snapshot()
        return found, snapshot

    found, snapshot = asyncio.run(scenario())

    assert found["ok"] is True
    assert found["count"] == 1
    assert found["results"][0]["domain"] == "example.com"
    assert snapshot["web"]["status"] == "ok"
    assert snapshot["web"]["query"] == "N.E.K.O 插件"
    assert snapshot["web"]["provider"] == "test-search"
    assert [event["name"] for event in snapshot["events"]][-1] == "web.search"


def test_web_search_rejects_empty_query() -> None:
    runtime = AmaOsRuntime(FakePort())
    result = asyncio.run(runtime.search_web("   ", 5))
    assert result["ok"] is False
    assert result["error"] == "empty_query"


def test_ui_profile_is_normalized_and_in_snapshot() -> None:
    runtime = AmaOsRuntime(FakePort())
    profile = runtime.set_ui_profile({
        "brand": "My Shell",
        "accent": "#e88aa8",
        "radius": 99,
        "theme": "dark",
    })
    snapshot = asyncio.run(runtime.snapshot())
    assert profile["brand"] == "My Shell"
    assert profile["accent"] == "#e88aa8"
    assert profile["radius"] == 28
    assert snapshot["token_radar"]["status"] == "idle"
    assert snapshot["ui_profile"]["theme"] == "dark"
    assert snapshot["ui_profile"]["brand"] == "My Shell"


def test_web_search_failure_is_reported_without_crashing() -> None:
    runtime = AmaOsRuntime(FakePort(fail=True))
    result = asyncio.run(runtime.search_web("anything", 5))
    snapshot = asyncio.run(runtime.snapshot())
    assert result["ok"] is False
    assert result["status"] == "error"
    assert snapshot["web"]["status"] == "error"


def test_steam_prices_store_history_and_snapshot() -> None:
    runtime = AmaOsRuntime(FakePort())

    async def scenario() -> tuple[dict[str, Any], dict[str, Any]]:
        found = await runtime.search_game_prices("Portal 2", 3)
        snapshot = await runtime.snapshot()
        return found, snapshot

    found, snapshot = asyncio.run(scenario())

    assert found["ok"] is True
    assert found["currency"] == "USD"
    assert found["results"][0]["history"]["lowest"] == "0.99"
    assert snapshot["steam"]["status"] == "ok"
    assert snapshot["steam"]["account_mode"] == "deferred"
    assert snapshot["steam"]["results"][0]["steam_app_id"] == "620"
    assert snapshot["steam"]["results"][0]["title_cn"] == "传送门2"
    assert snapshot["steam"]["results"][0]["cn"]["price"] == "35.00"
    assert snapshot["steam"]["sale"]["source"] == "Steamworks"
    assert snapshot["steam"]["sale"]["updated"] == "2026-11-07"
    assert [event["name"] for event in snapshot["events"]][-1] == "steam.price"


def test_steam_prices_reject_empty_query() -> None:
    runtime = AmaOsRuntime(FakePort())
    result = asyncio.run(runtime.search_game_prices("  ", 3))
    assert result["ok"] is False
    assert result["error"] == "empty_query"


def test_steam_prices_failure_is_reported_without_crashing() -> None:
    runtime = AmaOsRuntime(FakePort(fail=True))
    result = asyncio.run(runtime.search_game_prices("Portal 2", 3))
    snapshot = asyncio.run(runtime.snapshot())
    assert result["ok"] is False
    assert result["status"] == "error"
    assert snapshot["steam"]["status"] == "error"


def test_steam_deals_and_free_shelf_in_snapshot() -> None:
    runtime = AmaOsRuntime(FakePort())

    async def scenario() -> tuple[dict[str, Any], dict[str, Any]]:
        deals = await runtime.steam_deals(6)
        snapshot = await runtime.snapshot()
        return deals, snapshot

    deals, snapshot = asyncio.run(scenario())

    assert deals["ok"] is True
    assert deals["results"][0]["hoard_worthy"] is True
    assert deals["results"][0]["steam_app_id"] == "49520"
    assert snapshot["steam"]["deals"]["status"] == "ok"
    assert snapshot["steam"]["deals"]["results"][0]["history"]["lowest"] == "1.99"
    assert snapshot["steam"]["deals"]["results"][0]["title_cn"] == "无主之地2"
    assert snapshot["steam"]["deals"]["results"][0]["cn"]["price"] == "6.40"
    assert snapshot["steam"]["free_to_play_updated"] == "2026-11-13"
    assert 1 <= len(snapshot["steam"]["free_to_play"]) <= 6
    assert snapshot["steam"]["free_to_play_groups"] >= 2
    assert any(game["store_url"].startswith("https://store.steampowered.com/app/") for game in snapshot["steam"]["free_to_play"])
    assert [event["name"] for event in snapshot["events"]][-1] == "steam.deals"


def test_free_shelf_rotates_on_shuffle_only() -> None:
    runtime = AmaOsRuntime(FakePort())

    async def scenario() -> tuple[list[str], list[str], list[str], int]:
        first = await runtime.snapshot()
        second = await runtime.snapshot()
        await asyncio.to_thread(runtime.shuffle_free_shelf)
        after = await runtime.snapshot()
        return (
            [game["app_id"] for game in first["steam"]["free_to_play"]],
            [game["app_id"] for game in second["steam"]["free_to_play"]],
            [game["app_id"] for game in after["steam"]["free_to_play"]],
            int(after["steam"]["free_to_play_groups"]),
        )

    first_ids, second_ids, shuffled_ids, groups = asyncio.run(scenario())

    assert groups >= 2
    # Background refreshes keep the current group stable.
    assert first_ids == second_ids
    # The explicit shuffle moves to a different group.
    assert shuffled_ids != first_ids
    assert not set(shuffled_ids) & set(first_ids)


def test_free_shuffle_reports_group_meta() -> None:
    runtime = AmaOsRuntime(FakePort())
    first = runtime.shuffle_free_shelf()
    second = runtime.shuffle_free_shelf()

    assert first["ok"] is True
    assert first["groups"] >= 2
    assert first["group"] == 2
    assert second["group"] == 3
    assert first["results"] and second["results"]
    assert [game["app_id"] for game in first["results"]] != [game["app_id"] for game in second["results"]]


def test_deal_offsets_advance_between_refreshes() -> None:
    runtime = AmaOsRuntime(FakePort())
    seen: list[int] = []

    original = FakePort.fetch_steam_deals

    async def tracking(self, max_results: int = 6, offset: int = 0) -> dict[str, Any]:
        seen.append(offset)
        return await original(self, max_results, offset) if offset == 0 else {
            **await original(self, max_results, 0),
            "page": offset + 1,
            "groups": 3,
        }

    FakePort.fetch_steam_deals = tracking  # type: ignore[assignment]
    try:
        asyncio.run(runtime.steam_deals(6))
        asyncio.run(runtime.steam_deals(6))
        asyncio.run(runtime.steam_deals(6))
    finally:
        FakePort.fetch_steam_deals = original  # type: ignore[assignment]

    assert seen == [0, 1, 2]


def test_steam_deals_failure_is_reported_without_crashing() -> None:
    runtime = AmaOsRuntime(FakePort(fail=True))
    result = asyncio.run(runtime.steam_deals(6))
    snapshot = asyncio.run(runtime.snapshot())
    assert result["ok"] is False
    assert result["status"] == "error"
    assert snapshot["steam"]["deals"]["status"] == "error"
