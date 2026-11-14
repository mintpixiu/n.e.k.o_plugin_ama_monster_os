"""Pure shell runtime for Ama Monster OS.

This module intentionally has no N.E.K.O imports.  The same runtime will be
embedded in the future standalone application by supplying a different
``SystemPort`` implementation.
"""

from __future__ import annotations

import asyncio
import re
import time
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Mapping

try:  # package-relative import used by the N.E.K.O plugin
    from .steam_catalog import (
        FREE_TO_PLAY,
        FREE_TO_PLAY_GROUP_SIZE,
        FREE_TO_PLAY_UPDATED,
        free_to_play_entries,
    )
    from .steam_sales import evaluate_sales
    from .system_contract import (
        SystemEvent,
        SystemPort,
        utc_now_iso,
    )
    from .ui_profile import DEFAULT_UI_PROFILE, normalize_ui_profile
except ImportError:  # pragma: no cover - direct test import fallback
    from steam_catalog import (  # type: ignore[no-redef]
        FREE_TO_PLAY,
        FREE_TO_PLAY_GROUP_SIZE,
        FREE_TO_PLAY_UPDATED,
        free_to_play_entries,
    )
    from steam_sales import evaluate_sales  # type: ignore[no-redef]
    from system_contract import (  # type: ignore[no-redef]
        SystemEvent,
        SystemPort,
        utc_now_iso,
    )
    from ui_profile import DEFAULT_UI_PROFILE, normalize_ui_profile  # type: ignore[no-redef]

SHELL_NAME = "Ama Monster OS"
SHELL_VERSION = "0.6.4-beta"
SHELL_DISPLAY_VERSION = "0.6.4 Beta"
SHELL_CHANNEL = "Beta"
SHELL_CODENAME = "Ama-01"
_MAX_QUERY_CHARS = 200


@dataclass(frozen=True, slots=True)
class ShellModule:
    id: str
    name_key: str
    description_key: str
    status: str
    glyph: str
    tone: str

    def as_dict(self) -> dict[str, str]:
        return {
            "id": self.id,
            "name_key": self.name_key,
            "description_key": self.description_key,
            "status": self.status,
            "glyph": self.glyph,
            "tone": self.tone,
        }


MODULES: tuple[ShellModule, ...] = (
    ShellModule("core", "modules.core.name", "modules.core.description", "online", "✧", "sky"),
    ShellModule("memory", "modules.memory.name", "modules.memory.description", "reserved", "❀", "peach"),
    ShellModule("tools", "modules.tools.name", "modules.tools.description", "reserved", "⚙", "mint"),
    ShellModule("style", "modules.style.name", "modules.style.description", "reserved", "♡", "lilac"),
)


def _daypart(hour: int) -> str:
    if 5 <= hour < 11:
        return "morning"
    if 11 <= hour < 17:
        return "day"
    if 17 <= hour < 22:
        return "evening"
    return "night"


def _mood(daypart: str) -> str:
    return {
        "morning": "sunny",
        "day": "focused",
        "evening": "cozy",
        "night": "sleepy",
    }.get(daypart, "curious")


class AmaOsRuntime:
    """State machine behind the shell window.

    Construction is cheap and side-effect free.  ``start`` attaches the port and
    records the boot events; ``snapshot`` is safe to call before ``start``.
    """

    def __init__(
        self,
        port: SystemPort,
        *,
        clock: Any = time.monotonic,
        wall_clock: Any = time.time,
    ) -> None:
        self._port = port
        self._clock = clock
        self._wall_clock = wall_clock
        self._started_monotonic = float(clock())
        self._started_at = str(utc_now_iso())
        self._running = False
        self._booted = False
        self._boot_count = 0
        self._pulse_count = 0
        self._last_pulse_at: str | None = None
        self._last_pulse_ms = 0.0
        self._degraded = False
        self._events: list[SystemEvent] = []
        self._activity: dict[str, Any] = {
            "available": False,
            "privacy": "unavailable",
            "category": None,
            "idle_seconds": None,
        }
        self._environment: dict[str, Any] = {}
        self._web: dict[str, Any] = {
            "available": True,
            "status": "idle",
            "query": "",
            "count": 0,
            "results": [],
            "provider": "",
            "at": None,
            "error": "",
            "fallback": False,
        }
        self._steam: dict[str, Any] = {
            "available": True,
            "status": "idle",
            "query": "",
            "count": 0,
            "results": [],
            "provider": "CheapShark",
            "currency": "USD",
            "at": None,
            "error": "",
            "account_linked": False,
            "account_mode": "deferred",
        }
        self._steam_deals: dict[str, Any] = {
            "available": True,
            "status": "idle",
            "count": 0,
            "results": [],
            "provider": "CheapShark",
            "currency": "USD",
            "at": None,
            "error": "",
            "page": 1,
            "groups": 1,
            "pool": 0,
        }
        self._steam_account: dict[str, Any] = {
            "account": {},
            "accelerator": {"available": False, "note": "", "redirected": []},
            "login": "idle",
        }
        self._ui_profile = normalize_ui_profile(DEFAULT_UI_PROFILE)
        self._codex: dict[str, Any] = {"version": "", "updated": "", "total": 0, "classes": {}, "rarities": {}, "factions": [], "disclaimer": ""}
        self._deals_offset = 0
        self._free_shelf_offset = 0
        self._free_shelf: tuple[list[dict[str, Any]], int, int] = ([], 1, 1)
        self._token_radar: dict[str, Any] = {
            "ok": True,
            "status": "idle",
            "message": "",
            "source": "models.dev 公开目录",
            "source_url": "https://models.dev/",
            "currency": "USD",
            "unit": "1M tokens",
            "fetched_at": "",
            "checked_at": "",
            "models": [],
            "history": {},
            "history_meta": {"days": 0, "baseline": False, "note": ""},
            "time_note": "目录价按 USD / 1M tokens；价格只在厂商调价时变化。",
        }

    @property
    def port(self) -> SystemPort:
        return self._port

    @property
    def running(self) -> bool:
        return self._running

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._started_monotonic = float(self._clock())
        self._started_at = str(utc_now_iso())
        if not self._booted:
            self._booted = True
            self._boot_count += 1
            self._record("bridge.attached")
            self._record("shell.ready")
            try:
                self._port.record_event("shell.ready")
            except Exception:
                self._degraded = True

    async def stop(self) -> None:
        if not self._running:
            return
        self._running = False
        self._record("shell.sleep")
        try:
            await self._port.close()
        except Exception:
            self._degraded = True

    def _record(self, name: str, detail: str = "") -> None:
        self._events.append(
            SystemEvent(
                name=str(name)[:80],
                at=time.strftime("%H:%M:%S", time.localtime(float(self._wall_clock()))),
                detail=str(detail)[:200],
            )
        )
        del self._events[:-16]

    async def _safe_call(
        self,
        method: str,
        fallback: Any,
        *,
        timeout: float = 2.5,
    ) -> Any:
        caller = getattr(self._port, method, None)
        if caller is None:
            self._degraded = True
            return fallback
        try:
            result = await asyncio.wait_for(caller(), timeout=timeout)
        except Exception:
            self._degraded = True
            return fallback
        return result if result is not None else fallback

    def _uptime_seconds(self) -> int:
        return max(0, int(round(float(self._clock()) - self._started_monotonic)))

    def set_ui_profile(self, profile: Mapping[str, Any] | None) -> dict[str, Any]:
        self._ui_profile = normalize_ui_profile(profile)
        return dict(self._ui_profile)

    def _free_shelf_group(self, advance: bool = False) -> tuple[list[dict[str, Any]], int, int]:
        """Return the current rotated free shelf group plus its meta.

        The full curated pool is split into ``FREE_TO_PLAY_GROUP_SIZE``
        windows. ``advance`` moves to the next group; the snapshot itself only
        renders the current one so background refreshes do not reshuffle it.
        """

        if advance:
            self._free_shelf_offset += 1
        pool_size = len(FREE_TO_PLAY)
        size = min(int(FREE_TO_PLAY_GROUP_SIZE), pool_size) if pool_size else 1
        groups = max(1, (pool_size + size - 1) // size) if pool_size else 1
        group_index = (self._free_shelf_offset % groups) + 1
        entries = free_to_play_entries(self._free_shelf_offset, size)
        return entries, group_index, groups

    def shuffle_free_shelf(self) -> dict[str, Any]:
        """Advance to the next free-to-play group and return it."""

        entries, group, groups = self._free_shelf_group(advance=True)
        self._free_shelf = (entries, group, groups)
        self._record("steam.free.shuffle", f"group {group}/{groups}")
        return {
            "ok": True,
            "count": len(entries),
            "results": entries,
            "group": group,
            "groups": groups,
            "updated": FREE_TO_PLAY_UPDATED,
        }

    def set_token_radar(self, radar: Mapping[str, Any] | None) -> dict[str, Any]:
        if isinstance(radar, Mapping):
            self._token_radar = {str(key): value for key, value in radar.items()}
        return dict(self._token_radar)

    def set_codex(self, summary: Mapping[str, Any] | None) -> dict[str, Any]:
        if isinstance(summary, Mapping):
            self._codex = {str(key): value for key, value in summary.items()}
        return dict(self._codex)

    def set_steam_account(self, value: Mapping[str, Any] | None) -> dict[str, Any]:
        if isinstance(value, Mapping):
            self._steam_account = {str(key): value for key, value in value.items()}
        account = self._steam_account.get("account")
        linked = isinstance(account, Mapping) and bool(account.get("steam_id"))
        self._steam["account_linked"] = linked
        self._steam["account_mode"] = "openid"
        return dict(self._steam_account)

    def contract(self) -> Mapping[str, Any]:
        try:
            manifest = self._port.manifest()
        except Exception:
            self._degraded = True
            manifest = {}
        return dict(manifest) if isinstance(manifest, Mapping) else {}

    async def snapshot(self) -> dict[str, Any]:
        environment = await self._safe_call("environment", {})
        activity = await self._safe_call("activity", None)
        if not isinstance(environment, Mapping):
            environment = {}
        self._environment = {str(key): value for key, value in environment.items()}
        if isinstance(activity, Mapping):
            privacy = str(activity.get("privacy") or "unavailable")
            if privacy not in ("visible", "private", "unavailable"):
                privacy = "unavailable"
            self._activity = {
                "available": bool(activity.get("available")),
                "privacy": privacy,
                "category": activity.get("category") if privacy == "visible" else None,
                "idle_seconds": activity.get("idle_seconds") if privacy == "visible" else None,
            }

        now = datetime.now()
        daypart = _daypart(now.hour)
        bridge = self.contract()
        bridge.update(
            {
                "health": "degraded" if self._degraded else "ready",
                "activity": dict(self._activity),
            }
        )
        self._free_shelf = self._free_shelf_group()
        return {
            "ok": True,
            "shell": {
                "name": SHELL_NAME,
                "version": SHELL_DISPLAY_VERSION,
                "semver": SHELL_VERSION,
                "channel": SHELL_CHANNEL,
                "codename": SHELL_CODENAME,
                "started_at": self._started_at,
                "uptime_seconds": self._uptime_seconds(),
                "boot_count": self._boot_count,
                "daypart": daypart,
                "mood": _mood(daypart),
                "hosted": True,
            },
            "modules": [module.as_dict() for module in MODULES],
            "bridge": bridge,
            "telemetry": {
                "host": str(self._environment.get("host") or "N.E.K.O"),
                "surface": str(self._environment.get("host_surface") or "plugin-manager"),
                "platform": str(self._environment.get("platform") or "unknown"),
                "os_release": str(self._environment.get("os_release") or "unknown"),
                "python": str(self._environment.get("python") or "unknown"),
                "sdk": str(self._environment.get("sdk") or "unknown"),
                "degraded": bool(self._degraded),
            },
            "pulse": {
                "count": self._pulse_count,
                "last_at": self._last_pulse_at,
                "server_ms": round(self._last_pulse_ms, 3),
            },
            "web": {**self._web, "results": list(self._web.get("results") or [])},
            "steam": {
                **self._steam,
                "results": list(self._steam.get("results") or []),
                "deals": {**self._steam_deals, "results": list(self._steam_deals.get("results") or [])},
                "free_to_play": self._free_shelf[0],
                "free_to_play_updated": FREE_TO_PLAY_UPDATED,
                "free_to_play_group": self._free_shelf[1],
                "free_to_play_groups": self._free_shelf[2],
                "account": dict(self._steam_account.get("account") or {}),
                "accelerator": dict(self._steam_account.get("accelerator") or {}),
                "login": str(self._steam_account.get("login") or "idle"),
                "sale": evaluate_sales(),
            },
            "events": [event.as_dict() for event in self._events[-8:]],
            "ui_profile": dict(self._ui_profile),
            "token_radar": dict(self._token_radar),
            "codex": dict(self._codex),
            "preview": True,
        }

    async def pulse(self) -> dict[str, Any]:
        started = time.perf_counter()
        self._pulse_count += 1
        self._last_pulse_at = str(utc_now_iso())
        self._last_pulse_ms = (time.perf_counter() - started) * 1000.0
        self._record("pulse.answered", f"#{self._pulse_count}")
        try:
            self._port.record_event("pulse.answered", f"#{self._pulse_count}")
        except Exception:
            self._degraded = True
        return {
            "ok": True,
            "pulse": {
                "count": self._pulse_count,
                "at": self._last_pulse_at,
                "server_ms": round(self._last_pulse_ms, 3),
            },
            "summary": f"Pulse #{self._pulse_count} acknowledged.",
        }

    @staticmethod
    def _clean_results(raw_items: Any) -> list[dict[str, str]]:
        if not isinstance(raw_items, list):
            return []
        results: list[dict[str, str]] = []
        seen: set[str] = set()
        for item in raw_items[:8]:
            if not isinstance(item, Mapping):
                continue
            url = str(item.get("url") or "").strip()
            if not url.startswith(("http://", "https://")) or len(url) > 2048 or url in seen:
                continue
            seen.add(url)
            title = re.sub(r"\s+", " ", str(item.get("title") or "")).strip()[:300]
            snippet = re.sub(r"\s+", " ", str(item.get("snippet") or "")).strip()[:700]
            if not title:
                continue
            results.append({
                "title": title,
                "url": url,
                "snippet": snippet,
                "domain": str(item.get("domain") or "")[:80],
            })
        return results

    async def search_web(self, query: str, max_results: int = 5) -> dict[str, Any]:
        text = str(query or "").strip()
        if not text:
            return {
                "ok": False,
                "status": "error",
                "query": "",
                "count": 0,
                "results": [],
                "provider": "",
                "error": "empty_query",
                "summary": "Search query is empty.",
            }
        text = text[:_MAX_QUERY_CHARS]
        limit = max(3, min(8, int(max_results or 5)))
        caller = getattr(self._port, "search_web", None)
        if caller is None:
            result: Mapping[str, Any] = {
                "ok": False,
                "available": False,
                "provider": "none",
                "error": "unavailable",
                "results": [],
            }
        else:
            try:
                raw = await asyncio.wait_for(caller(text, limit), timeout=50.0)
                result = raw if isinstance(raw, Mapping) else {
                    "ok": False,
                    "available": False,
                    "provider": "none",
                    "error": "invalid_response",
                    "results": [],
                }
            except asyncio.TimeoutError:
                result = {
                    "ok": False,
                    "available": False,
                    "provider": "none",
                    "error": "timeout",
                    "results": [],
                }
            except Exception:
                result = {
                    "ok": False,
                    "available": False,
                    "provider": "none",
                    "error": "search_failed",
                    "results": [],
                }

        results = self._clean_results(result.get("results"))
        provider = str(result.get("provider") or "none")[:80]
        available = bool(result.get("available", True))
        error = str(result.get("error") or "")[:120]
        success = bool(result.get("ok")) or error == "no_results"
        if success:
            status = "ok" if results else "empty"
            self._record("web.search", f"{len(results)} result(s)")
            error = ""
        else:
            status = "error"
            self._record("web.search.failed", error or "unknown")
        self._web = {
            "available": available,
            "status": status,
            "query": text,
            "count": len(results),
            "results": results,
            "provider": provider,
            "at": str(utc_now_iso()),
            "error": error,
            "fallback": bool(result.get("fallback")),
        }
        try:
            self._port.record_event("web.search", str(len(results)))
        except Exception:
            self._degraded = True

        if success:
            summary = (
                f'Web search for "{text[:80]}" returned {len(results)} result(s)'
                f"{' via ' + provider if provider and provider != 'none' else ''}."
            )
            return {
                "ok": True,
                "status": status,
                "query": text,
                "count": len(results),
                "results": results,
                "provider": provider,
                "fallback": bool(result.get("fallback")),
                "summary": summary,
            }
        return {
            "ok": False,
            "status": "error",
            "query": text,
            "count": 0,
            "results": [],
            "provider": provider,
            "error": error or "unavailable",
            "summary": "Web search is unavailable right now.",
        }

    async def steam_deals(self, max_results: int = 6) -> dict[str, Any]:
        limit = max(3, min(8, int(max_results or 6)))
        caller = getattr(self._port, "fetch_steam_deals", None)
        offset = int(self._deals_offset)
        self._deals_offset += 1
        if caller is None:
            result: Mapping[str, Any] = {
                "ok": False,
                "available": False,
                "provider": "CheapShark",
                "currency": "USD",
                "error": "unavailable",
                "results": [],
            }
        else:
            try:
                try:
                    coroutine = caller(limit, offset)
                except TypeError:
                    coroutine = caller(limit)
                raw = await asyncio.wait_for(coroutine, timeout=35.0)
                result = raw if isinstance(raw, Mapping) else {
                    "ok": False,
                    "available": False,
                    "provider": "CheapShark",
                    "currency": "USD",
                    "error": "invalid_response",
                    "results": [],
                }
            except asyncio.TimeoutError:
                result = {
                    "ok": False,
                    "available": False,
                    "provider": "CheapShark",
                    "currency": "USD",
                    "error": "timeout",
                    "results": [],
                }
            except Exception:
                result = {
                    "ok": False,
                    "available": False,
                    "provider": "CheapShark",
                    "currency": "USD",
                    "error": "search_failed",
                    "results": [],
                }

        raw_results = result.get("results")
        results = [
            dict(item) for item in raw_results
            if isinstance(item, Mapping) and item.get("title") and item.get("steam_app_id")
        ][:limit] if isinstance(raw_results, list) else []
        provider = str(result.get("provider") or "CheapShark")[:80]
        success = bool(result.get("ok")) or str(result.get("error") or "") == "no_results"
        error = str(result.get("error") or "")[:120]
        groups = max(1, int(result.get("groups") or 1))
        page = (offset % groups) + 1 if groups else 1
        if success:
            status = "ok" if results else "empty"
            self._record("steam.deals", f"{len(results)} game(s)")
            error = ""
        else:
            status = "error"
            self._record("steam.deals.failed", error or "unknown")
        self._steam_deals = {
            "available": bool(result.get("available", True)),
            "status": status,
            "count": len(results),
            "results": results,
            "provider": provider,
            "currency": str(result.get("currency") or "USD")[:8],
            "at": str(utc_now_iso()),
            "error": error,
            "page": page,
            "groups": groups,
            "pool": max(0, int(result.get("pool") or 0)),
        }
        try:
            self._port.record_event("steam.deals", str(len(results)))
        except Exception:
            self._degraded = True

        if success:
            return {
                "ok": True,
                "status": status,
                "count": len(results),
                "results": results,
                "provider": provider,
                "currency": self._steam_deals["currency"],
                "page": page,
                "groups": groups,
                "pool": self._steam_deals["pool"],
                "summary": f"Steam sale picks returned {len(results)} game(s).",
            }
        return {
            "ok": False,
            "status": "error",
            "count": 0,
            "results": [],
            "provider": provider,
            "currency": self._steam_deals["currency"],
            "error": error or "unavailable",
            "summary": "Steam sale picks are unavailable right now.",
        }

    async def search_game_prices(self, query: str, max_results: int = 3) -> dict[str, Any]:
        text = str(query or "").strip()
        if not text:
            return {
                "ok": False,
                "status": "error",
                "query": "",
                "count": 0,
                "results": [],
                "provider": "CheapShark",
                "currency": "USD",
                "error": "empty_query",
                "summary": "Game name or Steam app ID is empty.",
            }
        text = text[:_MAX_QUERY_CHARS]
        limit = max(3, min(5, int(max_results or 3)))
        caller = getattr(self._port, "search_game_prices", None)
        if caller is None:
            result: Mapping[str, Any] = {
                "ok": False,
                "available": False,
                "provider": "CheapShark",
                "currency": "USD",
                "error": "unavailable",
                "results": [],
            }
        else:
            try:
                raw = await asyncio.wait_for(caller(text, limit), timeout=35.0)
                result = raw if isinstance(raw, Mapping) else {
                    "ok": False,
                    "available": False,
                    "provider": "CheapShark",
                    "currency": "USD",
                    "error": "invalid_response",
                    "results": [],
                }
            except asyncio.TimeoutError:
                result = {
                    "ok": False,
                    "available": False,
                    "provider": "CheapShark",
                    "currency": "USD",
                    "error": "timeout",
                    "results": [],
                }
            except Exception:
                result = {
                    "ok": False,
                    "available": False,
                    "provider": "CheapShark",
                    "currency": "USD",
                    "error": "search_failed",
                    "results": [],
                }

        raw_results = result.get("results")
        results = [
            dict(item) for item in raw_results
            if isinstance(item, Mapping) and item.get("title") and item.get("steam_app_id")
        ][:limit] if isinstance(raw_results, list) else []
        provider = str(result.get("provider") or "CheapShark")[:80]
        success = bool(result.get("ok")) or str(result.get("error") or "") == "no_results"
        error = str(result.get("error") or "")[:120]
        if success:
            status = "ok" if results else "empty"
            self._record("steam.price", f"{len(results)} game(s)")
            error = ""
        else:
            status = "error"
            self._record("steam.price.failed", error or "unknown")
        self._steam = {
            "available": bool(result.get("available", True)),
            "status": status,
            "query": text,
            "count": len(results),
            "results": results,
            "provider": provider,
            "currency": str(result.get("currency") or "USD")[:8],
            "at": str(utc_now_iso()),
            "error": error,
            "account_linked": False,
            "account_mode": "deferred",
        }
        try:
            self._port.record_event("steam.price", str(len(results)))
        except Exception:
            self._degraded = True

        if success:
            return {
                "ok": True,
                "status": status,
                "query": text,
                "count": len(results),
                "results": results,
                "provider": provider,
                "currency": self._steam["currency"],
                "summary": f'Price lookup for "{text[:80]}" returned {len(results)} game(s).',
            }
        return {
            "ok": False,
            "status": "error",
            "query": text,
            "count": 0,
            "results": [],
            "provider": provider,
            "currency": self._steam["currency"],
            "error": error or "unavailable",
            "summary": "Price lookup is unavailable right now.",
        }


__all__ = [
    "AmaOsRuntime",
    "MODULES",
    "SHELL_CHANNEL",
    "SHELL_CODENAME",
    "SHELL_DISPLAY_VERSION",
    "SHELL_NAME",
    "SHELL_VERSION",
    "ShellModule",
]
