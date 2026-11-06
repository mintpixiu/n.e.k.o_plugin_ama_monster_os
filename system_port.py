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
import platform
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any, Mapping

try:  # package-relative imports when loaded as plugin.plugins.ama_monster_os
    from .system_contract import (
        CAPABILITY_ACTIONS,
        CAPABILITY_ACTIVITY,
        CAPABILITY_ENVIRONMENT,
        CAPABILITY_EVENTS,
        CAPABILITY_WEB_SEARCH,
        MODE_HOSTED_PLUGIN,
        build_manifest,
        utc_now_iso,
    )
except ImportError:  # pragma: no cover - direct test import fallback
    from system_contract import (  # type: ignore[no-redef]
        CAPABILITY_ACTIONS,
        CAPABILITY_ACTIVITY,
        CAPABILITY_ENVIRONMENT,
        CAPABILITY_EVENTS,
        CAPABILITY_WEB_SEARCH,
        MODE_HOSTED_PLUGIN,
        build_manifest,
        utc_now_iso,
    )

_BING_RSS = "https://www.bing.com/search"
_MAX_QUERY_CHARS = 200
_MAX_HTTP_BYTES = 512 * 1024
_HTTP_TIMEOUT_SECONDS = 12.0
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
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
    )

    def __init__(self, plugin: Any) -> None:
        self._plugin = plugin
        self._events: list[dict[str, str]] = []

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

    async def close(self) -> None:
        self._events.clear()


__all__ = ["NekoHostSystemPort"]
