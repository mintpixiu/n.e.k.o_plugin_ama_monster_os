from __future__ import annotations

import json
from pathlib import Path

from arknights_codex import codex_operators, codex_payload, merge_operators
from arknights_sync import (
    NATION_ZH,
    PROFESSION_ZH,
    load_index,
    normalize_tables,
    read_index_operators,
    sync_index,
)

ZH = {
    "char_1": {
        "name": "测试近卫",
        "profession": "WARRIOR",
        "rarity": "TIER_6",
        "nationId": "rhodes",
    },
    "char_2": {
        "name": "测试狙击",
        "profession": "SNIPER",
        "rarity": "TIER_4",
        "nationId": "penguin",
    },
    "char_token": {
        "name": "召唤物",
        "profession": "TOKEN",
        "rarity": "TIER_1",
        "nationId": "",
    },
    "char_bad": {
        "name": "",
        "profession": "MEDIC",
        "rarity": "TIER_3",
        "nationId": "",
    },
}
EN = {"char_1": {"name": "Test Guard"}, "char_2": {"name": "Test Sniper"}}


def test_normalize_tables_filters_and_maps() -> None:
    operators = normalize_tables(ZH, EN)

    assert len(operators) == 2
    by_name = {item["name_cn"]: item for item in operators}
    assert by_name["测试近卫"]["class"] == "近卫"
    assert by_name["测试近卫"]["rarity"] == 6
    assert by_name["测试近卫"]["faction"] == "罗德岛"
    assert by_name["测试近卫"]["name_en"] == "Test Guard"
    assert by_name["测试狙击"]["name_en"] == "Test Sniper"
    assert "召唤物" not in by_name


def test_merge_keeps_curated_fields() -> None:
    synced = [
        {"id": "s1", "name_cn": "银灰", "name_en": "SilverAsh", "class": "近卫", "rarity": 6, "faction": "", "race": "", "tags": []},
        {"id": "s2", "name_cn": "新干员甲", "name_en": "New A", "class": "狙击", "rarity": 6, "faction": "维多利亚", "race": "", "tags": []},
    ]
    merged = merge_operators(synced)
    by_name = {item["name_cn"]: item for item in merged}

    assert by_name["银灰"]["faction"] == "喀兰贸易"
    assert "领主" in by_name["银灰"]["tags"]
    assert by_name["新干员甲"]["class"] == "狙击"
    assert by_name["新干员甲"]["class_color"]
    assert by_name["新干员甲"]["initial"] == "新"
    assert len(merged) == len(OPERATOR_NAMES())


def OPERATOR_NAMES() -> set[str]:  # noqa: N802 - tiny helper for the assertion
    from arknights_codex import OPERATORS

    return {item["name_cn"] for item in OPERATORS} | {"新干员甲"}


def _fake_roster(count: int = 60) -> list[dict]:
    return [
        {
            "id": f"char_{index}",
            "name_cn": f"测试干员{index}",
            "name_en": f"Test {index}",
            "class": "近卫" if index % 2 else "狙击",
            "rarity": 6 if index % 3 else 4,
            "faction": "罗德岛" if index % 2 else "维多利亚",
            "race": "",
            "tags": [],
        }
        for index in range(count)
    ]


def test_sync_writes_cache_and_payload_uses_it(tmp_path: Path) -> None:
    result = sync_index(tmp_path, fetcher=_fake_roster)

    assert result["ok"] is True
    assert result["count"] == 60

    cached = load_index(tmp_path)
    assert cached["count"] == 60
    assert read_index_operators(tmp_path)[0]["name_cn"] == "测试干员0"

    payload = codex_payload(data_dir=tmp_path, max_results=200)
    names = {item["name_cn"] for item in payload["results"]}
    assert "测试干员0" in names
    assert payload["summary"]["total"] == len(codex_operators(tmp_path))
    assert payload["summary"]["total"] >= 60


def test_load_index_rejects_small_or_bad_cache(tmp_path: Path) -> None:
    path = tmp_path / "arknights_index.json"
    assert load_index(tmp_path) == {}

    path.write_text("{not json", encoding="utf-8")
    assert load_index(tmp_path) == {}

    path.write_text(json.dumps({"operators": [{"name_cn": "只有一个"}]}), encoding="utf-8")
    assert load_index(tmp_path) == {}


def test_profession_and_nation_maps_cover_classes() -> None:
    from arknights_codex import CLASSES

    assert set(PROFESSION_ZH.values()) == set(CLASSES)
    assert NATION_ZH["rhodes"] == "罗德岛"
    assert NATION_ZH["penguin"] == "企鹅物流"