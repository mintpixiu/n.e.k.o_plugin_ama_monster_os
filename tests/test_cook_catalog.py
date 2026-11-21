from __future__ import annotations

import random

import cook_catalog
from food_manual import food_manual_payload
from shell_runtime import AmaOsRuntime
from system_contract import ENTRYPOINTS, build_manifest, validate_manifest


class FakePort:
    provider_id = "test-host"
    mode = "hosted-plugin"
    capabilities = ()

    def __init__(self) -> None:
        self.events: list[tuple[str, str]] = []

    def manifest(self):
        return build_manifest(provider_id=self.provider_id, mode=self.mode, capabilities=["telemetry.environment"])

    async def environment(self):
        return {"platform": "Windows", "python": "3.11", "sdk": "0.1.0"}

    async def activity(self):
        return None

    def record_event(self, name: str, detail: str = "") -> None:
        self.events.append((name, detail))

    async def close(self) -> None:
        return None


def test_catalog_is_bundled_and_normalized() -> None:
    assert len(cook_catalog.RECIPES) >= 800
    assert int(cook_catalog.CATALOG.get("recipe_count") or 0) == len(cook_catalog.RECIPES)
    sections = cook_catalog.FOOD_SECTIONS
    assert len(sections["vegetable"]) >= 30
    assert len(sections["meat"]) >= 10
    assert len(sections["staple"]) >= 5
    assert len(cook_catalog.TOOLS) >= 6
    tool_names = set(cook_catalog.TOOLS)
    for recipe in cook_catalog.RECIPES:
        assert recipe["name"]
        assert recipe["stuff"]
        assert set(recipe["tools"]) <= tool_names
        if recipe["url"]:
            assert str(recipe["url"]).startswith("https://")


def test_cook_payload_shape() -> None:
    payload = cook_catalog.cook_payload()
    assert payload["recipe_count"] == len(cook_catalog.RECIPES)
    assert set(payload["foods"]) == {"vegetable", "meat", "staple"}
    assert len(payload["tools"]) == len(cook_catalog.TOOLS)
    assert [mode["id"] for mode in payload["modes"]] == ["loose", "strict", "survival"]
    for section in payload["foods"].values():
        for food in section:
            assert food["name"]


def test_search_modes_are_ordered_and_consistent() -> None:
    recipe = next(item for item in cook_catalog.RECIPES if len(item["stuff"]) == 1)
    ingredient = recipe["stuff"][0]

    loose = cook_catalog.search_recipes([ingredient], mode="loose")
    strict = cook_catalog.search_recipes([ingredient], mode="strict")
    survival = cook_catalog.search_recipes([ingredient], mode="survival")

    assert loose["count"] >= survival["count"] >= 1
    assert strict["count"] >= 1
    for item in survival["results"]:
        assert item["missing"] == []
    for item in strict["results"]:
        assert ingredient in item["stuff"]
    for item in loose["results"]:
        assert len(item["missing"]) <= 2
        assert item["matched"]


def test_tool_filter_limit_and_empty_selection() -> None:
    recipe = next(item for item in cook_catalog.RECIPES if item["tools"])
    tool = recipe["tools"][0]
    result = cook_catalog.search_recipes([recipe["stuff"][0]], tool=tool, mode="loose", limit=5)
    assert result["returned"] <= 5
    assert result["returned"] == len(result["results"])
    for item in result["results"]:
        assert tool in item["tools"]

    empty = cook_catalog.search_recipes([])
    assert empty["count"] == 0
    assert empty["error"] == "empty_selection"

    unknown_mode = cook_catalog.search_recipes([recipe["stuff"][0]], mode="wat")
    assert unknown_mode["mode"] == "loose"


def test_random_recipe_is_serializable() -> None:
    result = cook_catalog.random_recipe(random.Random(5))
    assert result["ok"] is True
    recipe = result["recipe"]
    assert recipe["name"]
    assert recipe["matched"] == recipe["stuff"]


def test_food_payload_includes_cook_metadata() -> None:
    payload = food_manual_payload()
    cook = payload["cook"]
    assert cook["recipe_count"] == len(cook_catalog.RECIPES)
    assert cook["foods"]["vegetable"]
    assert cook["tools"]


def test_runtime_cook_search_and_random() -> None:
    port = FakePort()
    runtime = AmaOsRuntime(port)
    recipe = cook_catalog.RECIPES[0]
    ingredient = recipe["stuff"][0]

    result = runtime.search_recipes([ingredient])
    assert result["ok"] is True
    assert any(name == "cook.search" for name, _detail in port.events)

    random_result = runtime.random_recipe()
    assert random_result["ok"] is True
    assert any(name == "cook.random" for name, _detail in port.events)


def test_contract_lists_cook_entrypoints() -> None:
    assert ENTRYPOINTS["cook_search"] == "ama_cook_search"
    assert ENTRYPOINTS["cook_random"] == "ama_cook_random"
    manifest = build_manifest(
        provider_id="test-host",
        mode="hosted-plugin",
        capabilities=["telemetry.environment"],
    )
    assert validate_manifest(manifest) == []
