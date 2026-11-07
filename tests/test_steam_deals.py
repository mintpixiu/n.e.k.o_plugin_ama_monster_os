from __future__ import annotations

import system_port


def test_cheapshark_deal_picks_are_filtered_and_enriched(monkeypatch) -> None:
    deals = [
        {
            "gameID": "88304",
            "steamAppID": "49520",
            "title": "Borderlands 2",
            "salePrice": "1.99",
            "normalPrice": "19.99",
            "savings": "90.045",
            "dealRating": "9.5",
            "steamRatingPercent": "90",
            "steamRatingText": "Very Positive",
            "metacriticScore": "89",
            "releaseDate": "1330000000",
            "thumb": "https://example.com/thumb.jpg",
        },
        {
            "gameID": "1",
            "steamAppID": "10",
            "title": "Low-rated deal",
            "salePrice": "1.00",
            "normalPrice": "20.00",
            "savings": "95",
            "dealRating": "8.0",
            "steamRatingPercent": "40",
        },
    ]

    def fake_http(url, max_bytes=0, user_agent="") -> object:
        if "/deals?" in url:
            return deals
        if "id=88304" in url:
            return {
                "cheapestPriceEver": {"price": "1.99", "date": 1793651134},
                "deals": [{"storeID": "1", "price": "1.99", "retailPrice": "19.99"}],
            }
        return {}

    monkeypatch.setattr(system_port, "_http_json", fake_http)

    result = system_port._fetch_steam_deals_sync(6)

    assert result["ok"] is True
    assert result["count"] == 1
    pick = result["results"][0]
    assert pick["steam_app_id"] == "49520"
    assert pick["deal_rating"] == 9.5
    assert pick["steam_percent"] == 90
    assert pick["history"]["lowest"] == "1.99"
    assert pick["is_at_low"] is True
    assert pick["hoard_worthy"] is True
    assert pick["store_url"] == "https://store.steampowered.com/app/49520/"


def test_cheapshark_deal_picks_handle_empty_payload(monkeypatch) -> None:
    monkeypatch.setattr(system_port, "_http_json", lambda *args, **kwargs: [])
    result = system_port._fetch_steam_deals_sync(6)
    assert result["ok"] is False
    assert result["error"] == "no_results"
