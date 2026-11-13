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
        if "/appdetails?" in url:
            return {
                "49520": {
                    "success": True,
                    "data": {
                        "price_overview": {
                            "currency": "CNY",
                            "initial": 6400,
                            "final": 640,
                            "discount_percent": 90,
                            "initial_formatted": "¥ 64.00",
                            "final_formatted": "¥ 6.40",
                        }
                    },
                }
            }
        if "ids=88304" in url or "id=88304" in url:
            return {
                "88304": {
                    "cheapestPriceEver": {"price": "1.99", "date": 1793651134},
                    "deals": [{"storeID": "1", "price": "1.99", "retailPrice": "19.99"}],
                }
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
    assert pick["cn"]["price"] == "6.40"
    assert pick["cn"]["discount_percent"] == 90
    assert pick["title_cn"] == "无主之地2"
    assert pick["store_url"] == "https://store.steampowered.com/app/49520/"


def test_cheapshark_deal_picks_handle_empty_payload(monkeypatch) -> None:
    monkeypatch.setattr(system_port, "_http_json", lambda *args, **kwargs: [])
    result = system_port._fetch_steam_deals_sync(6)
    assert result["ok"] is False
    assert result["error"] == "no_results"


def _deal_payload(index: int) -> dict:
    return {
        "gameID": str(1000 + index),
        "steamAppID": str(2000 + index),
        "title": f"Quality Deal {index}",
        "salePrice": "1.99",
        "normalPrice": "19.99",
        "savings": "90",
        "dealRating": str(9.5 - index * 0.01),
        "steamRatingPercent": "90",
    }


def test_deal_groups_rotate_across_offsets(monkeypatch) -> None:
    deals = [_deal_payload(index) for index in range(12)]

    def fake_http(url, max_bytes=0, user_agent="") -> object:
        if "/deals?" in url:
            return deals
        if "/appdetails?" in url:
            return {}
        return {}

    monkeypatch.setattr(system_port, "_http_json", fake_http)

    first = system_port._fetch_steam_deals_sync(3, 0)
    second = system_port._fetch_steam_deals_sync(3, 1)
    third = system_port._fetch_steam_deals_sync(3, 2)

    assert first["groups"] == 4
    assert first["pool"] == 12
    assert [item["steam_app_id"] for item in first["results"]] == ["2000", "2001", "2002"]
    assert [item["steam_app_id"] for item in second["results"]] == ["2003", "2004", "2005"]
    assert [item["steam_app_id"] for item in third["results"]] == ["2006", "2007", "2008"]
    assert len({item["steam_app_id"] for item in first["results"] + second["results"]}) == 6


def test_deal_group_wraps_and_never_duplicates(monkeypatch) -> None:
    deals = [_deal_payload(index) for index in range(4)]

    def fake_http(url, max_bytes=0, user_agent="") -> object:
        if "/deals?" in url:
            return deals
        return {}

    monkeypatch.setattr(system_port, "_http_json", fake_http)

    last = system_port._fetch_steam_deals_sync(3, 1)
    assert [item["steam_app_id"] for item in last["results"]] == ["2003"]
    assert len(last["results"]) == 1

    single = system_port._fetch_steam_deals_sync(6, 0)
    assert len(single["results"]) == 4
    assert len({item["steam_app_id"] for item in single["results"]}) == 4
