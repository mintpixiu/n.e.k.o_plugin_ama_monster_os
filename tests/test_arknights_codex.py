from __future__ import annotations

from arknights_codex import (
    CLASS_COLORS,
    CLASSES,
    OPERATORS,
    codex_payload,
    codex_summary,
    filter_operators,
)


def test_operator_data_is_internally_consistent() -> None:
    ids = [item["id"] for item in OPERATORS]
    names = [item["name_cn"] for item in OPERATORS]

    assert len(ids) == len(set(ids))
    assert len(names) == len(set(names))
    assert len(OPERATORS) >= 60

    for item in OPERATORS:
        assert item["name_cn"] and item["name_en"]
        assert item["class"] in CLASSES
        assert 3 <= item["rarity"] <= 6
        assert item["faction"]
        assert item["role"]
        assert item["class_color"] == CLASS_COLORS[item["class"]]
        assert item["initial"] == item["name_cn"][:1]
        assert isinstance(item["tags"], list) and item["tags"]


def test_filter_by_class_and_rarity() -> None:
    snipers = filter_operators(classes=["狙击"])
    assert snipers
    assert {item["class"] for item in snipers} == {"狙击"}

    six_star = filter_operators(rarities=[6])
    assert six_star
    assert {item["rarity"] for item in six_star} == {6}

    overlap = filter_operators(classes=["狙击"], rarities=[6])
    assert overlap
    assert all(item["class"] == "狙击" and item["rarity"] == 6 for item in overlap)


def test_filter_by_query_matches_name_and_faction() -> None:
    by_cn = filter_operators(query="银灰")
    assert [item["name_cn"] for item in by_cn] == ["银灰"]

    by_en = filter_operators(query="silverash")
    assert by_en and by_en[0]["id"] == "silverash"

    by_faction = filter_operators(query="企鹅物流")
    assert by_faction
    assert {item["faction"] for item in by_faction} == {"企鹅物流"}

    assert filter_operators(query="不存在的干员") == []


def test_filter_ignores_unknown_classes_and_respects_limit() -> None:
    unknown = filter_operators(classes=["不存在"])
    assert unknown

    limited = filter_operators(max_results=5)
    assert len(limited) == 5

    assert len(filter_operators(max_results=9999)) == len(OPERATORS)


def test_summary_counts_match_data() -> None:
    summary = codex_summary()
    assert summary["total"] == len(OPERATORS)
    assert sum(summary["classes"].values()) == len(OPERATORS)
    assert sum(summary["rarities"].values()) == len(OPERATORS)
    assert set(summary["classes"]) == set(CLASSES)
    assert "官方资料" in summary["disclaimer"]


def test_payload_shape() -> None:
    payload = codex_payload(query="罗德岛", max_results=10)
    assert payload["ok"] is True
    assert payload["count"] == len(payload["results"])
    assert payload["count"] <= 10
    assert payload["summary"]["total"] == len(OPERATORS)
    assert payload["updated"] == "2026-11-13"