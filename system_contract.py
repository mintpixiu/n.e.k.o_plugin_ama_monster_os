"""Stable system-bridge contract for Ama Monster OS.

The hosted N.E.K.O plugin is the first provider of this contract.  A future
standalone Ama Monster OS build can implement the same :class:`SystemPort`
protocol and reuse :class:`shell_runtime.AmaOsRuntime` and the hosted shell without
touching plugin code.  Keep this module dependency-free so it can be imported
by that future host as well.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping, Protocol, Sequence, runtime_checkable

CONTRACT_ID = "ama.system.bridge"
CONTRACT_VERSION = "1.0.0"
API_LEVEL = 1
SCHEMA_VERSION = "1.0"

MODE_HOSTED_PLUGIN = "hosted-plugin"
MODE_DESKTOP_BUILTIN = "desktop-builtin"
SUPPORTED_MODES = (MODE_HOSTED_PLUGIN, MODE_DESKTOP_BUILTIN)

CAPABILITY_ENVIRONMENT = "telemetry.environment"
CAPABILITY_ACTIVITY = "activity.privacy"
CAPABILITY_ACTIONS = "actions.invoke"
CAPABILITY_EVENTS = "events.record"
CAPABILITY_WEB_SEARCH = "web.search"
CAPABILITY_STEAM_PRICES = "steam.prices"
CAPABILITY_STEAM_DEALS = "steam.deals"
HOSTED_CAPABILITIES = (
    CAPABILITY_ENVIRONMENT,
    CAPABILITY_ACTIVITY,
    CAPABILITY_ACTIONS,
    CAPABILITY_EVENTS,
    CAPABILITY_WEB_SEARCH,
    CAPABILITY_STEAM_PRICES,
    CAPABILITY_STEAM_DEALS,
)

# These are deliberately declared, but not advertised as implemented yet.
# A future built-in build replaces the "reserved" marker with an implementation
# and bumps CONTRACT_VERSION if the JSON shape changes.
RESERVED_SEAMS = (
    {
        "id": "window.native",
        "state": "reserved",
        "summary": "Native always-on-top shell window managed by the built-in app.",
    },
    {
        "id": "process.supervision",
        "state": "reserved",
        "summary": "Start, stop, and health-check companion processes with user consent.",
    },
    {
        "id": "vault.storage",
        "state": "reserved",
        "summary": "User-scoped settings and secrets backed by the desktop vault.",
    },
    {
        "id": "voice.pipeline",
        "state": "reserved",
        "summary": "Handoff to the host's speech input and voice output pipeline.",
    },
    {
        "id": "web.fetch",
        "state": "reserved",
        "summary": "Read a specific page through an SSRF-safe URL policy and size limit.",
    },
    {
        "id": "steam.account",
        "state": "reserved",
        "summary": "Link a Steam account through Steam OpenID or a user-supplied Web API key; never store passwords.",
    },
    {
        "id": "module.registry",
        "state": "reserved",
        "summary": "Load additional OS modules beyond the preview shell.",
    },
)

ENTRYPOINTS = {
    "context": "os_shell",
    "pulse": "ama_pulse",
    "web_search": "ama_web_search",
    "steam_search": "ama_steam_search",
    "steam_deals": "ama_steam_deals",
    "contract": "ama_system_contract",
}


@dataclass(frozen=True, slots=True)
class SystemEvent:
    """A small, serializable event recorded by the shell runtime."""

    name: str
    at: str
    detail: str = ""

    def as_dict(self) -> dict[str, str]:
        return {"name": self.name, "at": self.at, "detail": self.detail}


@runtime_checkable
class SystemPort(Protocol):
    """Host boundary used by the OS shell.

    The desktop build should provide an async adapter that implements every
    member below.  The shell never imports N.E.K.O-specific modules, so the
    same runtime can be mounted in a native window.
    """

    provider_id: str
    mode: str
    capabilities: Sequence[str]

    def manifest(self) -> Mapping[str, Any]:
        """Return the serialized contract for this provider."""

    async def environment(self) -> Mapping[str, Any]:
        """Return non-sensitive runtime facts (platform, Python, host surface)."""

    async def activity(self) -> Mapping[str, Any] | None:
        """Return privacy-filtered activity, or ``None`` when unavailable."""

    async def search_web(self, query: str, max_results: int = 5) -> Mapping[str, Any]:
        """Search the web for a user-entered query.

        The provider owns the engine choice and must return only HTTP(S)
        result URLs.  It must never fetch arbitrary result pages.
        """

    async def search_game_prices(self, query: str, max_results: int = 3) -> Mapping[str, Any]:
        """Look up a game's current lowest price and all-time low.

        The provider must use a fixed price-data endpoint and must not require
        a Steam password.  Account linking is a separate reserved capability.
        """

    async def fetch_steam_deals(self, max_results: int = 6) -> Mapping[str, Any]:
        """Return high-discount Steam deals, enriched with historical lows.

        Recommendations are editorial, not paid placements.  The provider must
        use a fixed deal endpoint and never require a Steam password.
        """

    def record_event(self, name: str, detail: str = "") -> None:
        """Record an event in the host journal.  Must never raise."""

    async def close(self) -> None:
        """Release provider resources.  Must be idempotent."""


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def build_manifest(
    *,
    provider_id: str,
    mode: str,
    capabilities: Sequence[str] = HOSTED_CAPABILITIES,
) -> dict[str, Any]:
    """Build the versioned, serializable contract shared by all providers."""

    return {
        "contract_id": CONTRACT_ID,
        "contract_version": CONTRACT_VERSION,
        "schema_version": SCHEMA_VERSION,
        "api_level": API_LEVEL,
        "provider": str(provider_id),
        "mode": str(mode),
        "capabilities": [str(item) for item in capabilities],
        "reserved": [dict(item) for item in RESERVED_SEAMS],
        "entrypoints": dict(ENTRYPOINTS),
    }


def validate_manifest(manifest: Mapping[str, Any]) -> list[str]:
    """Return human-readable contract violations; an empty list means valid."""

    errors: list[str] = []
    if manifest.get("contract_id") != CONTRACT_ID:
        errors.append("contract_id mismatch")
    if manifest.get("contract_version") != CONTRACT_VERSION:
        errors.append("contract_version mismatch")
    if manifest.get("schema_version") != SCHEMA_VERSION:
        errors.append("schema_version mismatch")
    if manifest.get("api_level") != API_LEVEL:
        errors.append("api_level mismatch")
    if not isinstance(manifest.get("provider"), str) or not manifest.get("provider"):
        errors.append("provider must be a non-empty string")
    if manifest.get("mode") not in SUPPORTED_MODES:
        errors.append("mode is not supported")
    capabilities = manifest.get("capabilities")
    if not isinstance(capabilities, list) or not capabilities:
        errors.append("capabilities must be a non-empty list")
    elif any(not isinstance(item, str) or not item for item in capabilities):
        errors.append("capabilities must contain non-empty strings")
    reserved = manifest.get("reserved")
    if not isinstance(reserved, list) or not reserved:
        errors.append("reserved seams must be declared")
    entrypoints = manifest.get("entrypoints")
    if not isinstance(entrypoints, dict):
        errors.append("entrypoints must be an object")
    else:
        for key in ("context", "pulse", "web_search", "steam_search", "steam_deals", "contract"):
            if not isinstance(entrypoints.get(key), str) or not entrypoints.get(key):
                errors.append(f"entrypoints.{key} is missing")
    return errors


__all__ = [
    "API_LEVEL",
    "CAPABILITY_ACTIONS",
    "CAPABILITY_ACTIVITY",
    "CAPABILITY_ENVIRONMENT",
    "CAPABILITY_EVENTS",
    "CAPABILITY_STEAM_PRICES",
    "CAPABILITY_STEAM_DEALS",
    "CAPABILITY_WEB_SEARCH",
    "CONTRACT_ID",
    "CONTRACT_VERSION",
    "ENTRYPOINTS",
    "HOSTED_CAPABILITIES",
    "MODE_DESKTOP_BUILTIN",
    "MODE_HOSTED_PLUGIN",
    "RESERVED_SEAMS",
    "SCHEMA_VERSION",
    "SUPPORTED_MODES",
    "SystemEvent",
    "SystemPort",
    "build_manifest",
    "utc_now_iso",
    "validate_manifest",
]
