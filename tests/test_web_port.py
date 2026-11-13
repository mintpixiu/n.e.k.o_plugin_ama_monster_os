from __future__ import annotations

from system_port import (
    NekoHostSystemPort,
    _build_price_entry,
    _clean_results,
    _fallback_query,
    _is_http_url,
    _parse_bing_rss,
)


def test_dotted_acronym_is_collapsed_for_fallback() -> None:
    assert _fallback_query("N.E.K.O 插件开发") == "NEKO 插件开发"
    assert _fallback_query("plain query") == "plain query"


def test_only_http_urls_are_accepted() -> None:
    assert _is_http_url("https://example.com/page")
    assert _is_http_url("http://example.com")
    assert not _is_http_url("javascript:alert(1)")
    assert not _is_http_url("file:///etc/passwd")
    assert not _is_http_url("")


def test_result_cleaning_strips_html_and_bad_urls() -> None:
    results = _clean_results(
        [
            {"title": "<b>Hello</b> world", "url": "https://example.com/a", "snippet": "<i>Nice</i>"},
            {"title": "Bad", "url": "javascript:alert(1)", "snippet": ""},
            {"title": "Duplicate", "url": "https://example.com/a", "snippet": ""},
        ],
        5,
    )
    assert len(results) == 1
    assert results[0]["title"] == "Hello world"
    assert results[0]["snippet"] == "Nice"
    assert results[0]["domain"] == "example.com"


def test_bing_rss_parser_limits_and_sanitizes() -> None:
    payload = b"""<?xml version="1.0" encoding="utf-8"?>
    <rss version="2.0"><channel>
      <item><title>First</title><link>https://example.com/1</link><description>One</description></item>
      <item><title>Second</title><link>https://example.com/2</link><description>Two</description></item>
      <item><title>Bad</title><link>javascript:alert(1)</link><description>No</description></item>
    </channel></rss>"""
    results = _parse_bing_rss(payload, 3)
    assert [item["title"] for item in results] == ["First", "Second"]
    assert results[0]["domain"] == "example.com"


def test_bing_rss_parser_rejects_doctype() -> None:
    payload = b"""<?xml version="1.0"?><!DOCTYPE rss><rss><channel></channel></rss>"""
    assert _parse_bing_rss(payload, 5) == []


def test_port_manifest_advertises_web_search() -> None:
    port = NekoHostSystemPort(object())
    manifest = port.manifest()
    assert "web.search" in manifest["capabilities"]
    assert "steam.prices" in manifest["capabilities"]
    assert "steam.deals" in manifest["capabilities"]
    assert "web.fetch" in {item["id"] for item in manifest["reserved"]}
    assert "steam.account" in manifest["capabilities"]
    assert "steam.account" not in {item["id"] for item in manifest["reserved"]}


def test_cheapshark_detail_is_normalized() -> None:
    candidate = {
        "gameID": "36",
        "steamAppID": "620",
        "external": "Portal 2",
        "cheapest": "9.99",
        "thumb": "https://example.com/thumb.jpg",
    }
    detail = {
        "info": {"title": "Portal 2", "steamAppID": "620", "thumb": "https://example.com/thumb.jpg"},
        "cheapestPriceEver": {"price": "0.99", "date": 1561485700},
        "deals": [{
            "storeID": "1",
            "dealID": "abc",
            "price": "9.99",
            "retailPrice": "19.99",
            "savings": "50.000000",
        }],
    }
    entry = _build_price_entry(candidate, detail, {"1": "Steam"})
    assert entry is not None
    assert entry["title"] == "Portal 2"
    assert entry["steam_app_id"] == "620"
    assert entry["current"]["price"] == "9.99"
    assert entry["current"]["store"] == "Steam"
    assert entry["current"]["savings_percent"] == 50
    assert entry["history"]["lowest"] == "0.99"
    assert entry["history"]["date"] == "2019-06-25"
    assert entry["gap_to_low"] == "+9.00"
    assert entry["is_at_low"] is False
    assert entry["currency"] == "USD"


def test_cheapshark_entry_rejects_non_steam_game() -> None:
    entry = _build_price_entry(
        {"gameID": "12", "external": "No Steam"},
        {"info": {"title": "No Steam"}},
        {},
    )
    assert entry is None
