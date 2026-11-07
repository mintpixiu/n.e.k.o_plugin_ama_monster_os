from __future__ import annotations

import system_port


def test_steam_cn_prices_are_parsed_and_cached_shape(monkeypatch) -> None:
    payload = {
        "620": {
            "success": True,
            "data": {
                "price_overview": {
                    "currency": "CNY",
                    "initial": 3500,
                    "final": 3500,
                    "discount_percent": 0,
                    "initial_formatted": "",
                    "final_formatted": "¥ 35.00",
                }
            },
        },
        "730": {"success": True, "data": []},
    }
    monkeypatch.setattr(system_port, "_http_json", lambda *args, **kwargs: payload)

    result = system_port._fetch_cn_prices_sync(["620", "730", "620"])

    assert result["ok"] is True
    assert result["prices"]["620"]["available"] is True
    assert result["prices"]["620"]["currency"] == "CNY"
    assert result["prices"]["620"]["price"] == "35.00"
    assert result["prices"]["620"]["formatted"] == "¥ 35.00"
    assert result["prices"]["730"]["available"] is False
    assert result["prices"]["730"]["reason"] == "no_price"


def test_steam_cn_prices_handle_request_failure(monkeypatch) -> None:
    def fail(*args, **kwargs):
        raise TimeoutError("steam timeout")

    monkeypatch.setattr(system_port, "_http_json", fail)
    result = system_port._fetch_cn_prices_sync(["620"])
    assert result["ok"] is False
    assert result["prices"] == {}
    assert result["error"].startswith("request_failed:")
