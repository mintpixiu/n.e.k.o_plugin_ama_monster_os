from __future__ import annotations

from system_port import (
    NekoHostSystemPort,
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
    assert "web.fetch" in {item["id"] for item in manifest["reserved"]}
