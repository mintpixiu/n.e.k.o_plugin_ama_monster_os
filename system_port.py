"""N.E.K.O implementation of the Ama Monster OS system port.

This adapter contains every host-specific detail.  The shell runtime only sees
:class:`~system_contract.SystemPort`, which is the seam a future built-in
desktop application implements instead.

Web search has two ordered providers:

1. N.E.K.O's built-in ``web_search`` plugin, when it is running; this keeps the
   host's regional engine choice, caching, and retry policy.
2. A fixed Bing RSS endpoint using only the Python standard library, so the
   window still works when the host search plugin is stopped.  The fallback
   sends only the user's query and never fetches a result page.
"""

from __future__ import annotations

import asyncio
import html
import json
import platform
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any, Mapping

try:  # package-relative imports when loaded as plugin.plugins.ama_monster_os
    from .steam_catalog import chinese_title
    from .system_contract import (
        CAPABILITY_ACTIONS,
        CAPABILITY_ACTIVITY,
        CAPABILITY_ENVIRONMENT,
        CAPABILITY_EVENTS,
        CAPABILITY_STEAM_ACCOUNT,
        CAPABILITY_STEAM_DEALS,
        CAPABILITY_STEAM_PRICES,
        CAPABILITY_WEB_SEARCH,
        MODE_HOSTED_PLUGIN,
        build_manifest,
        utc_now_iso,
    )
except ImportError:  # pragma: no cover - direct test import fallback
    from steam_catalog import chinese_title  # type: ignore[no-redef]
    from system_contract import (  # type: ignore[no-redef]
        CAPABILITY_ACTIONS,
        CAPABILITY_ACTIVITY,
        CAPABILITY_ENVIRONMENT,
        CAPABILITY_EVENTS,
        CAPABILITY_STEAM_ACCOUNT,
        CAPABILITY_STEAM_DEALS,
        CAPABILITY_STEAM_PRICES,
        CAPABILITY_WEB_SEARCH,
        MODE_HOSTED_PLUGIN,
        build_manifest,
        utc_now_iso,
    )

_BING_RSS = "https://www.bing.com/search"
_CHEAPSHARK_API = "https://www.cheapshark.com/api/1.0"
_STEAM_CN_API = "https://store.steampowered.com/api/appdetails"
_MAX_QUERY_CHARS = 200
_MAX_PRICE_QUERY_CHARS = 100
_MAX_HTTP_BYTES = 512 * 1024
_MAX_PRICE_HTTP_BYTES = 1024 * 1024
_HTTP_TIMEOUT_SECONDS = 15.0
_PRICE_CACHE_SECONDS = 600.0
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
_PRICE_USER_AGENT = (
    "NekoAmaMonsterOS/0.1.0 "
    "(+https://github.com/mintpixiu/n.e.k.o_plugin_ama_monster_os)"
)
_DOTTED_ACRONYM = re.compile(r"\b(?:[A-Za-z]\.){2,}[A-Za-z]\b")
_TAG = re.compile(r"<[^>]+>")


def _clean_text(value: Any, limit: int) -> str:
    text = html.unescape(str(value or ""))
    text = _TAG.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]


def _is_http_url(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    text = value.strip()
    if not text or len(text) > 2048:
        return False
    try:
        parsed = urllib.parse.urlparse(text)
    except ValueError:
        return False
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def _domain(url: str) -> str:
    try:
        host = urllib.parse.urlparse(url).hostname or ""
    except ValueError:
        return ""
    return host.lower().removeprefix("www.")[:80]


def _fallback_query(query: str) -> str:
    """Bing tokenizes dotted acronyms badly; NEKO searches better than N.E.K.O."""

    collapsed = _DOTTED_ACRONYM.sub(lambda match: match.group(0).replace(".", ""), query)
    return collapsed.strip() or query


def _clean_results(raw_items: Any, limit: int) -> list[dict[str, str]]:
    if not isinstance(raw_items, list):
        return []
    results: list[dict[str, str]] = []
    seen: set[str] = set()
    for item in raw_items:
        if len(results) >= limit:
            break
        if not isinstance(item, Mapping):
            continue
        url = str(item.get("url") or "").strip()
        title = _clean_text(item.get("title"), 300)
        if not title or not _is_http_url(url) or url in seen:
            continue
        seen.add(url)
        results.append({
            "title": title,
            "url": url,
            "snippet": _clean_text(item.get("snippet"), 700),
            "domain": _domain(url),
        })
    return results


def _parse_bing_rss(payload: bytes, limit: int) -> list[dict[str, str]]:
    """Parse Bing's RSS response without resolving entities or external data."""

    if b"<!DOCTYPE" in payload or b"<!ENTITY" in payload:
        return []
    try:
        root = ET.fromstring(payload)
    except ET.ParseError:
        return []
    raw_items = []
    for item in root.findall("./channel/item"):
        raw_items.append({
            "title": item.findtext("title") or "",
            "url": item.findtext("link") or "",
            "snippet": item.findtext("description") or "",
        })
    return _clean_results(raw_items, limit)


def _search_bing_sync(query: str, limit: int) -> dict[str, Any]:
    query_used = _fallback_query(query)
    params = {
        "format": "rss",
        "q": query_used,
        "count": str(max(3, min(8, limit))),
        "mkt": "zh-CN" if re.search(r"[\u3400-\u9fff]", query_used) else "en-US",
        "setlang": "zh-CN" if re.search(r"[\u3400-\u9fff]", query_used) else "en-US",
    }
    url = f"{_BING_RSS}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": _USER_AGENT,
            "Accept": "application/rss+xml, application/xml, text/xml",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=_HTTP_TIMEOUT_SECONDS) as response:
            payload = response.read(_MAX_HTTP_BYTES + 1)
            if len(payload) > _MAX_HTTP_BYTES:
                return {
                    "ok": False,
                    "available": False,
                    "provider": "Bing RSS",
                    "error": "response_too_large",
                    "results": [],
                }
    except Exception as exc:
        return {
            "ok": False,
            "available": False,
            "provider": "Bing RSS",
            "error": f"request_failed:{type(exc).__name__}",
            "results": [],
        }

    results = _parse_bing_rss(payload, max(3, min(8, limit)))
    return {
        "ok": bool(results),
        "available": True,
        "provider": "Bing RSS",
        "query": query,
        "query_used": query_used,
        "count": len(results),
        "results": results,
        "at": utc_now_iso(),
        "error": "" if results else "no_results",
    }


def _money(value: Any) -> str:
    try:
        return f"{float(value):.2f}"
    except (TypeError, ValueError):
        return ""


def _date_from_epoch(value: Any) -> str:
    try:
        stamp = float(value)
        if stamp <= 0:
            return ""
        return datetime.fromtimestamp(stamp, tz=timezone.utc).date().isoformat()
    except (TypeError, ValueError, OverflowError, OSError):
        return ""


def _http_json(url: str, *, max_bytes: int, user_agent: str) -> Any:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": user_agent,
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=_HTTP_TIMEOUT_SECONDS) as response:
        payload = response.read(max_bytes + 1)
    if len(payload) > max_bytes:
        raise ValueError("response_too_large")
    return json.loads(payload.decode("utf-8"))


def _build_price_entry(
    candidate: Mapping[str, Any],
    detail: Mapping[str, Any],
    stores: Mapping[str, str],
) -> dict[str, Any] | None:
    info = detail.get("info") if isinstance(detail.get("info"), Mapping) else {}
    title = _clean_text(info.get("title") or candidate.get("external"), 200)
    app_id = str(info.get("steamAppID") or candidate.get("steamAppID") or "").strip()
    game_id = str(candidate.get("gameID") or "").strip()
    if not title or not app_id or not game_id.isdigit():
        return None

    deals = detail.get("deals") if isinstance(detail.get("deals"), list) else []
    usable: list[Mapping[str, Any]] = [item for item in deals if isinstance(item, Mapping)]
    current = min(
        usable,
        key=lambda item: float(item.get("price") or "999999"),
        default=None,
    )
    current_price = _money(current.get("price")) if current else _money(candidate.get("cheapest"))
    retail_price = _money(current.get("retailPrice")) if current else ""
    savings_percent = 0
    if current:
        try:
            savings_percent = max(0, int(round(float(current.get("savings") or 0))))
        except (TypeError, ValueError):
            savings_percent = 0
    store_id = str(current.get("storeID") or "") if current else ""
    store_name = stores.get(store_id) or ("CheapShark best" if current_price else "")

    ever = detail.get("cheapestPriceEver") if isinstance(detail.get("cheapestPriceEver"), Mapping) else {}
    ever_price = _money(ever.get("price"))
    ever_date = _date_from_epoch(ever.get("date"))
    gap = ""
    if ever_price and current_price:
        try:
            gap = f"{float(current_price) - float(ever_price):+.2f}"
        except ValueError:
            gap = ""

    thumb = str(info.get("thumb") or candidate.get("thumb") or "").strip()
    if not _is_http_url(thumb):
        thumb = ""
    return {
        "game_id": game_id,
        "steam_app_id": app_id,
        "title": title,
        "thumb": thumb,
        "currency": "USD",
        "current": {
            "price": current_price,
            "retail_price": retail_price,
            "savings_percent": savings_percent,
            "store": _clean_text(store_name, 80),
        },
        "history": {
            "lowest": ever_price,
            "date": ever_date,
            "currency": "USD",
        },
        "gap_to_low": gap,
        "is_at_low": bool(ever_price and current_price and float(current_price) <= float(ever_price)),
        "source": "CheapShark",
    }


def _search_cheapshark_sync(
    query: str,
    limit: int,
    stores: Mapping[str, str],
) -> dict[str, Any]:
    params = (
        {"steamAppID": query}
        if query.isdigit()
        else {"title": query, "limit": str(max(5, limit * 2))}
    )
    url = f"{_CHEAPSHARK_API}/games?{urllib.parse.urlencode(params)}"
    try:
        payload = _http_json(url, max_bytes=_MAX_PRICE_HTTP_BYTES, user_agent=_PRICE_USER_AGENT)
    except Exception as exc:
        return {
            "ok": False,
            "available": False,
            "provider": "CheapShark",
            "currency": "USD",
            "error": f"request_failed:{type(exc).__name__}",
            "results": [],
        }

    if not isinstance(payload, list):
        return {
            "ok": False,
            "available": False,
            "provider": "CheapShark",
            "currency": "USD",
            "error": "invalid_response",
            "results": [],
        }

    candidates = [
        item for item in payload
        if isinstance(item, Mapping)
        and str(item.get("steamAppID") or "").strip()
        and str(item.get("external") or "").strip()
    ][:limit]

    results: list[dict[str, Any]] = []
    for candidate in candidates:
        game_id = str(candidate.get("gameID") or "").strip()
        detail: Mapping[str, Any] = {}
        if game_id.isdigit():
            try:
                detail_payload = _http_json(
                    f"{_CHEAPSHARK_API}/games?id={urllib.parse.quote(game_id)}",
                    max_bytes=_MAX_PRICE_HTTP_BYTES,
                    user_agent=_PRICE_USER_AGENT,
                )
                if isinstance(detail_payload, Mapping):
                    detail = detail_payload
            except Exception:
                detail = {}
            time.sleep(0.12)
        entry = _build_price_entry(candidate, detail, stores)
        if entry is not None:
            results.append(entry)

    _attach_cn_prices(results)
    for entry in results:
        entry["title_cn"] = chinese_title(str(entry.get("title") or ""))
    return {
        "ok": bool(results),
        "available": True,
        "provider": "CheapShark",
        "currency": "USD",
        "query": query,
        "count": len(results),
        "results": results,
        "error": "" if results else "no_results",
        "at": utc_now_iso(),
    }


def _fetch_deal_details_sync(game_ids: list[str]) -> dict[str, Any]:
    """Batch-fetch CheapShark game details for a group of sale picks.

    ``/games?ids=1,2,3`` returns one object keyed by game id, which replaces
    one HTTP round trip per game.
    """

    ids = [str(item).strip() for item in game_ids if str(item).strip().isdigit()]
    ids = list(dict.fromkeys(ids))[:20]
    if not ids:
        return {}
    url = f"{_CHEAPSHARK_API}/games?ids={urllib.parse.quote(','.join(ids))}"
    try:
        payload = _http_json(url, max_bytes=_MAX_PRICE_HTTP_BYTES, user_agent=_PRICE_USER_AGENT)
    except Exception:
        return {}
    if not isinstance(payload, Mapping):
        return {}
    return {str(key): value for key, value in payload.items() if isinstance(value, Mapping)}


def _fetch_steam_deals_sync(limit: int, offset: int = 0) -> dict[str, Any]:
    """Fetch high-quality Steam deals and enrich one rotated group with lows.

    A larger pool is fetched (60 deals) and filtered by the editorial quality
    bar; ``offset`` picks a round-robin window of ``limit`` titles from that
    pool, so consecutive refreshes show different games.
    """

    params = {
        "storeID": "1",
        "onSale": "1",
        "sortBy": "Deal Rating",
        "pageSize": "60",
    }
    url = f"{_CHEAPSHARK_API}/deals?{urllib.parse.urlencode(params)}"
    payload: Any = None
    last_exc: Exception | None = None
    for attempt in range(2):
        try:
            payload = _http_json(url, max_bytes=_MAX_PRICE_HTTP_BYTES, user_agent=_PRICE_USER_AGENT)
            last_exc = None
            break
        except Exception as exc:
            last_exc = exc
            if attempt == 0:
                time.sleep(0.5)
    if last_exc is not None:
        return {
            "ok": False,
            "available": False,
            "provider": "CheapShark",
            "currency": "USD",
            "error": f"request_failed:{type(last_exc).__name__}",
            "results": [],
        }
    if not isinstance(payload, list):
        return {
            "ok": False,
            "available": False,
            "provider": "CheapShark",
            "currency": "USD",
            "error": "invalid_response",
            "results": [],
        }

    candidates: list[tuple[float, Mapping[str, Any]]] = []
    for item in payload:
        if not isinstance(item, Mapping):
            continue
        app_id = str(item.get("steamAppID") or "").strip()
        title = _clean_text(item.get("title"), 200)
        if not app_id or not title:
            continue
        try:
            sale_price = float(item.get("salePrice") or 0)
            normal_price = float(item.get("normalPrice") or 0)
            savings = float(item.get("savings") or 0)
            rating = float(item.get("dealRating") or 0)
            steam_percent = int(float(item.get("steamRatingPercent") or 0))
        except (TypeError, ValueError):
            continue
        if sale_price <= 0 or normal_price <= sale_price or savings < 40 or rating < 7:
            continue
        if steam_percent and steam_percent < 65:
            continue
        candidates.append((rating, item))
    candidates.sort(key=lambda pair: pair[0], reverse=True)
    pool = [pair[1] for pair in candidates]
    pool_size = len(pool)
    groups = max(1, (pool_size + limit - 1) // limit) if pool_size else 1
    if pool_size:
        # Never pad with duplicates: when the pool is smaller than ``limit``
        # the caller simply receives fewer picks.
        start = (int(offset or 0) % groups) * limit
        selected = pool[start:start + limit]
    else:
        selected = []

    results: list[dict[str, Any]] = []
    details = _fetch_deal_details_sync(
        [str(item.get("gameID") or "").strip() for item in selected]
    )
    for item in selected:
        game_id = str(item.get("gameID") or "").strip()
        detail: Mapping[str, Any] = details.get(game_id) or {}

        title = _clean_text(item.get("title"), 200)
        app_id = str(item.get("steamAppID") or "").strip()
        current_price = _money(item.get("salePrice"))
        retail_price = _money(item.get("normalPrice"))
        try:
            savings_percent = max(0, int(round(float(item.get("savings") or 0))))
        except (TypeError, ValueError):
            savings_percent = 0
        ever = detail.get("cheapestPriceEver") if isinstance(detail.get("cheapestPriceEver"), Mapping) else {}
        ever_price = _money(ever.get("price"))
        ever_date = _date_from_epoch(ever.get("date"))
        gap_to_low = ""
        at_low = False
        if ever_price and current_price:
            try:
                gap = max(0.0, float(current_price) - float(ever_price))
                gap_to_low = f"+{gap:.2f}"
                at_low = float(current_price) <= float(ever_price) + 0.001
            except ValueError:
                pass
        try:
            release_year = datetime.fromtimestamp(
                int(item.get("releaseDate") or 0), tz=timezone.utc
            ).year
        except (TypeError, ValueError, OSError):
            release_year = 0
        thumb = str(item.get("thumb") or "").strip()
        if not _is_http_url(thumb):
            thumb = ""
        results.append({
            "game_id": game_id,
            "steam_app_id": app_id,
            "title": title,
            "thumb": thumb,
            "currency": "USD",
            "current": {
                "price": current_price,
                "retail_price": retail_price,
                "savings_percent": savings_percent,
                "store": "Steam",
            },
            "history": {
                "lowest": ever_price,
                "date": ever_date,
                "currency": "USD",
            },
            "gap_to_low": gap_to_low,
            "is_at_low": at_low,
            "hoard_worthy": bool(savings_percent >= 80 or (current_price and float(current_price) <= 5.0) or at_low),
            "deal_rating": round(float(item.get("dealRating") or 0), 1),
            "steam_rating": _clean_text(item.get("steamRatingText"), 40),
            "steam_percent": int(float(item.get("steamRatingPercent") or 0)),
            "metacritic": int(float(item.get("metacriticScore") or 0)),
            "release_year": release_year,
            "store_url": f"https://store.steampowered.com/app/{app_id}/",
            "source": "CheapShark",
        })

    _attach_cn_prices(results)
    missing_titles = [
        str(item.get("steam_app_id") or "")
        for item in results
        if not chinese_title(str(item.get("title") or ""))
    ]
    localized_names = _fetch_steam_names_sync(missing_titles) if missing_titles else {}
    for entry in results:
        app_id = str(entry.get("steam_app_id") or "")
        entry["title_cn"] = chinese_title(
            str(entry.get("title") or ""),
            localized_names.get(app_id, ""),
        )
    return {
        "ok": bool(results),
        "available": True,
        "provider": "CheapShark",
        "currency": "USD",
        "count": len(results),
        "results": results,
        "groups": groups,
        "pool": pool_size,
        "error": "" if results else "no_results",
        "at": utc_now_iso(),
    }


def _fetch_cn_prices_sync(app_ids: list[str]) -> dict[str, Any]:
    """Read current Steam China prices from the official store API.

    This is a current-price endpoint, not a historical-price database. Steam
    returns an empty ``data`` array for free or unavailable products when only
    ``price_overview`` is requested, so those entries are marked unavailable.
    """

    ids = [str(app_id).strip() for app_id in app_ids if str(app_id).strip().isdigit()]
    ids = list(dict.fromkeys(ids))[:20]
    if not ids:
        return {"ok": True, "prices": {}, "at": utc_now_iso()}
    params = {
        "appids": ",".join(ids),
        "cc": "cn",
        "l": "schinese",
        "filters": "price_overview",
    }
    url = f"{_STEAM_CN_API}?{urllib.parse.urlencode(params)}"
    try:
        payload = _http_json(url, max_bytes=_MAX_PRICE_HTTP_BYTES, user_agent=_PRICE_USER_AGENT)
    except Exception as exc:
        return {
            "ok": False,
            "prices": {},
            "error": f"request_failed:{type(exc).__name__}",
            "at": utc_now_iso(),
        }
    if not isinstance(payload, Mapping):
        return {"ok": False, "prices": {}, "error": "invalid_response", "at": utc_now_iso()}

    prices: dict[str, dict[str, Any]] = {}
    for app_id in ids:
        item = payload.get(app_id)
        overview = None
        if isinstance(item, Mapping) and item.get("success"):
            data = item.get("data")
            if isinstance(data, Mapping):
                overview = data.get("price_overview")
        if not isinstance(overview, Mapping):
            prices[app_id] = {
                "available": False,
                "currency": "CNY",
                "reason": "no_price",
                "source": "Steam CN",
            }
            continue
        try:
            final_cents = int(overview.get("final") or 0)
            initial_cents = int(overview.get("initial") or 0)
        except (TypeError, ValueError):
            final_cents = 0
            initial_cents = 0
        discount = 0
        try:
            discount = max(0, min(100, int(overview.get("discount_percent") or 0)))
        except (TypeError, ValueError):
            discount = 0
        formatted = _clean_text(overview.get("final_formatted"), 40)
        if not formatted and final_cents >= 0:
            formatted = f"¥ {final_cents / 100:.2f}"
        prices[app_id] = {
            "available": True,
            "currency": "CNY",
            "price": f"{final_cents / 100:.2f}",
            "initial": f"{initial_cents / 100:.2f}",
            "discount_percent": discount,
            "formatted": formatted,
            "source": "Steam CN",
        }
    return {"ok": True, "prices": prices, "at": utc_now_iso()}


def _fetch_steam_names_sync(app_ids: list[str]) -> dict[str, str]:
    """Read localized App Hub names for the recommendation cards."""

    names: dict[str, str] = {}
    for app_id in list(dict.fromkeys(str(item).strip() for item in app_ids))[:8]:
        if not app_id.isdigit():
            continue
        url = (
            f"{_STEAM_CN_API}?appids={urllib.parse.quote(app_id)}"
            "&cc=cn&l=schinese&filters=basic"
        )
        try:
            payload = _http_json(url, max_bytes=_MAX_PRICE_HTTP_BYTES, user_agent=_PRICE_USER_AGENT)
        except Exception:
            continue
        item = payload.get(app_id) if isinstance(payload, Mapping) else None
        data = item.get("data") if isinstance(item, Mapping) else None
        if isinstance(data, Mapping):
            name = _clean_text(data.get("name"), 200)
            if name:
                names[app_id] = name
        time.sleep(0.08)
    return names


def _attach_cn_prices(entries: list[dict[str, Any]]) -> None:
    app_ids = [str(item.get("steam_app_id") or "") for item in entries]
    cn_result = _fetch_cn_prices_sync(app_ids)
    cn_prices = cn_result.get("prices") if isinstance(cn_result.get("prices"), Mapping) else {}
    for entry in entries:
        app_id = str(entry.get("steam_app_id") or "")
        entry["cn"] = dict(cn_prices.get(app_id) or {
            "available": False,
            "currency": "CNY",
            "reason": "unavailable",
            "source": "Steam CN",
        })


class NekoHostSystemPort:
    """Read-only host adapter used by the N.E.K.O plugin build.

    No process control, filesystem browsing, or raw window titles are exposed.
    Activity is limited to the SDK's privacy-filtered category and idle time.
    Web search sends only query text to the selected provider.
    """

    provider_id = "neko-plugin-host"
    mode = MODE_HOSTED_PLUGIN
    capabilities = (
        CAPABILITY_ENVIRONMENT,
        CAPABILITY_ACTIVITY,
        CAPABILITY_ACTIONS,
        CAPABILITY_EVENTS,
        CAPABILITY_WEB_SEARCH,
        CAPABILITY_STEAM_PRICES,
        CAPABILITY_STEAM_DEALS,
        CAPABILITY_STEAM_ACCOUNT,
    )

    def __init__(self, plugin: Any) -> None:
        self._plugin = plugin
        self._events: list[dict[str, str]] = []
        self._price_cache: dict[str, tuple[float, dict[str, Any]]] = {}
        self._deals_cache: tuple[float, dict[str, Any]] | None = None
        self._deals_group_cache: dict[tuple[int, int], tuple[float, dict[str, Any]]] = {}
        self._deals_groups = 1
        self._store_names: dict[str, str] = {}
        self._store_names_at = 0.0

    def manifest(self) -> Mapping[str, Any]:
        return build_manifest(
            provider_id=self.provider_id,
            mode=self.mode,
            capabilities=self.capabilities,
        )

    def record_event(self, name: str, detail: str = "") -> None:
        try:
            self._events.append({"name": str(name)[:80], "detail": str(detail)[:200]})
            del self._events[:-20]
        except Exception:
            # Event journalling is diagnostic only; it must never break the UI.
            pass

    async def environment(self) -> Mapping[str, Any]:
        sdk_version = "unknown"
        try:
            from plugin.sdk.plugin.runtime import SDK_VERSION  # type: ignore[import-not-found]

            sdk_version = str(SDK_VERSION)
        except Exception:
            pass
        return {
            "host": "N.E.K.O",
            "host_surface": "plugin-manager",
            "plugin_id": str(getattr(self._plugin, "plugin_id", "ama_monster_os")),
            "platform": platform.system() or "unknown",
            "os_release": platform.release() or "unknown",
            "python": platform.python_version(),
            "sdk": sdk_version,
        }

    async def activity(self) -> Mapping[str, Any] | None:
        try:
            from plugin.sdk.plugin import get_os_activity_snapshot  # type: ignore[import-not-found]

            snapshot = await get_os_activity_snapshot("ama_monster_os")
        except Exception:
            return {
                "available": False,
                "privacy": "unavailable",
                "category": None,
                "idle_seconds": None,
            }

        privacy = str(getattr(snapshot, "privacy_state", "unavailable") or "unavailable")
        if privacy not in ("visible", "private", "unavailable"):
            privacy = "unavailable"
        available = bool(getattr(snapshot, "os_signals_available", False))
        category: str | None = None
        idle: float | None = None
        if available and privacy == "visible":
            raw_category = str(getattr(snapshot, "foreground_category", "") or "").strip().lower()
            if raw_category:
                category = raw_category[:32]
            raw_idle = getattr(snapshot, "system_idle_seconds", None)
            if isinstance(raw_idle, (int, float)):
                idle = round(max(0.0, float(raw_idle)), 1)
        return {
            "available": available,
            "privacy": privacy,
            "category": category,
            "idle_seconds": idle,
        }

    async def search_web(self, query: str, max_results: int = 5) -> Mapping[str, Any]:
        text = str(query or "").strip()
        if not text:
            return {"ok": False, "available": True, "provider": "", "error": "empty_query", "results": []}
        if len(text) > _MAX_QUERY_CHARS:
            return {"ok": False, "available": True, "provider": "", "error": "query_too_long", "results": []}
        limit = max(3, min(8, int(max_results or 5)))

        host_result = await self._search_via_host(text, limit)
        if host_result.get("ok") and host_result.get("count"):
            return host_result

        fallback = await asyncio.to_thread(_search_bing_sync, text, limit)
        if fallback.get("ok"):
            fallback["fallback"] = True
            fallback["host_error"] = str(host_result.get("error") or "")[:120]
            return fallback

        return {
            "ok": False,
            "available": False,
            "provider": "none",
            "query": text,
            "count": 0,
            "results": [],
            "error": "unavailable",
            "detail": f"{host_result.get('error') or 'host_failed'}; {fallback.get('error') or 'fallback_failed'}",
            "at": utc_now_iso(),
        }

    async def _search_via_host(self, query: str, limit: int) -> dict[str, Any]:
        plugins = getattr(self._plugin, "plugins", None)
        if plugins is None:
            return {"ok": False, "provider": "N.E.K.O web_search", "error": "plugin_api_unavailable", "results": []}
        try:
            from plugin.sdk.plugin import Err  # type: ignore[import-not-found]

            result = await plugins.call_entry(
                "web_search:search",
                {"query": query, "max_results": limit, "backend": "auto"},
                timeout=32.0,
            )
        except Exception as exc:
            return {
                "ok": False,
                "provider": "N.E.K.O web_search",
                "error": f"call_failed:{type(exc).__name__}",
                "results": [],
            }
        if isinstance(result, Err):
            return {
                "ok": False,
                "provider": "N.E.K.O web_search",
                "error": "web_search_unavailable",
                "results": [],
            }

        value = getattr(result, "value", None)
        if not isinstance(value, Mapping):
            return {"ok": False, "provider": "N.E.K.O web_search", "error": "invalid_response", "results": []}
        if value.get("success") is False:
            return {"ok": False, "provider": "N.E.K.O web_search", "error": "web_search_failed", "results": []}

        inner: Any = value.get("result", value.get("data", value))
        if isinstance(inner, Mapping) and isinstance(inner.get("result"), Mapping):
            inner = inner["result"]
        if not isinstance(inner, Mapping):
            return {"ok": False, "provider": "N.E.K.O web_search", "error": "invalid_response", "results": []}

        results = _clean_results(inner.get("results"), limit)
        return {
            "ok": True,
            "available": True,
            "provider": "N.E.K.O web_search",
            "query": query,
            "count": len(results),
            "results": results,
            "at": utc_now_iso(),
            "error": "",
        }

    def _load_store_names_sync(self) -> Mapping[str, str]:
        now = time.monotonic()
        if self._store_names and (now - self._store_names_at) < 86400.0:
            return self._store_names
        try:
            payload = _http_json(
                f"{_CHEAPSHARK_API}/stores",
                max_bytes=_MAX_PRICE_HTTP_BYTES,
                user_agent=_PRICE_USER_AGENT,
            )
            if isinstance(payload, list):
                self._store_names = {
                    str(item.get("storeID")): _clean_text(item.get("storeName"), 80)
                    for item in payload
                    if isinstance(item, Mapping) and str(item.get("storeID") or "")
                }
                self._store_names_at = now
        except Exception:
            pass
        return dict(self._store_names)

    async def fetch_steam_deals(self, max_results: int = 6, offset: int = 0) -> Mapping[str, Any]:
        """Return one rotated group of sale picks.

        ``offset`` selects the group, so pressing refresh again returns a
        different set of titles instead of the same six. Groups are cached for
        ``_PRICE_CACHE_SECONDS`` so cycling back is instant, while a new group
        costs one CheapShark batch request.
        """

        limit = max(3, min(8, int(max_results or 6)))
        now = time.monotonic()
        fresh = (
            self._deals_cache is not None
            and (now - self._deals_cache[0]) < _PRICE_CACHE_SECONDS
        )
        groups = int(self._deals_groups or 1) if fresh else 1
        page_index = int(offset or 0) % max(1, groups)
        cache_key = (limit, page_index)
        if fresh:
            hit = self._deals_group_cache.get(cache_key)
            if hit is not None and (now - hit[0]) < _PRICE_CACHE_SECONDS:
                return dict(hit[1])

        raw = await asyncio.to_thread(_fetch_steam_deals_sync, limit, int(offset or 0))
        self._deals_cache = (time.monotonic(), dict(raw))
        self._deals_groups = int(raw.get("groups") or 1)
        self._deals_group_cache[cache_key] = (time.monotonic(), dict(raw))
        if len(self._deals_group_cache) > 16:
            oldest = min(self._deals_group_cache, key=lambda key: self._deals_group_cache[key][0])
            self._deals_group_cache.pop(oldest, None)
        return raw

    async def search_game_prices(self, query: str, max_results: int = 3) -> Mapping[str, Any]:
        text = str(query or "").strip()
        if not text:
            return {
                "ok": False,
                "available": True,
                "provider": "CheapShark",
                "currency": "USD",
                "error": "empty_query",
                "results": [],
            }
        if len(text) > _MAX_PRICE_QUERY_CHARS:
            return {
                "ok": False,
                "available": True,
                "provider": "CheapShark",
                "currency": "USD",
                "error": "query_too_long",
                "results": [],
            }
        limit = max(3, min(5, int(max_results or 3)))
        cache_key = f"{text.casefold()}|{limit}"
        cached = self._price_cache.get(cache_key)
        if cached is not None and (time.monotonic() - cached[0]) < _PRICE_CACHE_SECONDS:
            return dict(cached[1])

        stores = await asyncio.to_thread(self._load_store_names_sync)
        raw = await asyncio.to_thread(_search_cheapshark_sync, text, limit, stores)
        if len(self._price_cache) >= 32:
            oldest = min(self._price_cache, key=lambda key: self._price_cache[key][0])
            self._price_cache.pop(oldest, None)
        self._price_cache[cache_key] = (time.monotonic(), dict(raw))
        return raw

    async def close(self) -> None:
        self._events.clear()
        self._price_cache.clear()
        self._deals_cache = None
        self._store_names.clear()


__all__ = ["NekoHostSystemPort"]
