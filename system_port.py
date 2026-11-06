"""N.E.K.O implementation of the Ama Monster OS system port.

This adapter contains every host-specific detail.  The shell runtime only sees
:class:`~system_contract.SystemPort`, which is the seam a future built-in
desktop application implements instead.
"""

from __future__ import annotations

import platform
from typing import Any, Mapping

try:  # package-relative imports when loaded as plugin.plugins.ama_monster_os
    from .system_contract import (
        CAPABILITY_ACTIONS,
        CAPABILITY_ACTIVITY,
        CAPABILITY_ENVIRONMENT,
        CAPABILITY_EVENTS,
        MODE_HOSTED_PLUGIN,
        build_manifest,
    )
except ImportError:  # pragma: no cover - direct test import fallback
    from system_contract import (  # type: ignore[no-redef]
        CAPABILITY_ACTIONS,
        CAPABILITY_ACTIVITY,
        CAPABILITY_ENVIRONMENT,
        CAPABILITY_EVENTS,
        MODE_HOSTED_PLUGIN,
        build_manifest,
    )


class NekoHostSystemPort:
    """Read-only host adapter used by the N.E.K.O plugin build.

    No process control, filesystem browsing, or raw window titles are exposed.
    Activity is limited to the SDK's privacy-filtered category and idle time.
    """

    provider_id = "neko-plugin-host"
    mode = MODE_HOSTED_PLUGIN
    capabilities = (
        CAPABILITY_ENVIRONMENT,
        CAPABILITY_ACTIVITY,
        CAPABILITY_ACTIONS,
        CAPABILITY_EVENTS,
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

    async def close(self) -> None:
        self._events.clear()


__all__ = ["NekoHostSystemPort"]
