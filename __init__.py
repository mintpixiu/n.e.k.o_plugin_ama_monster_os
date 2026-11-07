"""Ama Monster OS — a NEKO-styled shell preview for Project N.E.K.O.

The facade is intentionally thin: it owns the SDK lifecycle, the Hosted UI
context/action bridge, and two callable entries.  All shell state lives in
:mod:`app`, and all host-specific behaviour lives behind
:class:`system_port.NekoHostSystemPort` so a future built-in desktop build can
reuse the window and runtime with a different system port.
"""

from __future__ import annotations

from typing import Any

from plugin.sdk.plugin import (
    NekoPluginBase,
    Ok,
    lifecycle,
    neko_plugin,
    plugin_entry,
    tr,
    ui,
)

from .shell_runtime import SHELL_CHANNEL, SHELL_DISPLAY_VERSION, SHELL_NAME, AmaOsRuntime
from .system_port import NekoHostSystemPort

PULSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {},
    "required": [],
}

CONTRACT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {},
    "required": [],
}

WEB_SEARCH_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": "Search query. Keep the user's original language; do not translate it.",
        },
        "max_results": {
            "type": "integer",
            "minimum": 3,
            "maximum": 8,
            "default": 5,
            "description": "Number of results to request (3-8).",
        },
    },
    "required": ["query"],
}

STEAM_SEARCH_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": "Game title or numeric Steam AppID, e.g. Hades or 1145360.",
        },
        "max_results": {
            "type": "integer",
            "minimum": 3,
            "maximum": 5,
            "default": 3,
            "description": "Number of game matches to enrich with price history (3-5).",
        },
    },
    "required": ["query"],
}


STEAM_DEALS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "max_results": {
            "type": "integer",
            "minimum": 3,
            "maximum": 8,
            "default": 6,
            "description": "Number of sale picks to return (3-8).",
        },
    },
}


@neko_plugin
class AmaMonsterOsPlugin(NekoPluginBase):
    """The first window of Ama Monster OS, hosted inside N.E.K.O."""

    def __init__(self, ctx: Any) -> None:
        super().__init__(ctx)
        self._runtime = AmaOsRuntime(NekoHostSystemPort(self))

    # ------------------------------------------------------------------
    # Lifecycle: cheap, no background tasks, no I/O at import time.
    # ------------------------------------------------------------------

    @lifecycle(id="startup")
    async def on_startup(self, **_):
        await self._runtime.start()
        contract = self._runtime.contract()
        self.logger.info(
            "Ama Monster OS %s (%s) ready; bridge=%s mode=%s",
            SHELL_DISPLAY_VERSION,
            SHELL_CHANNEL,
            contract.get("contract_version", "unknown"),
            contract.get("mode", "unknown"),
        )
        return Ok({
            "status": "ready",
            "shell": SHELL_NAME,
            "version": SHELL_DISPLAY_VERSION,
            "channel": SHELL_CHANNEL,
            "bridge": contract.get("contract_version", ""),
            "mode": contract.get("mode", ""),
        })

    @lifecycle(id="shutdown")
    async def on_shutdown(self, **_):
        await self._runtime.stop()
        return Ok({"status": "sleeping"})

    # ------------------------------------------------------------------
    # Hosted UI
    # ------------------------------------------------------------------

    @ui.context(id="os_shell")
    async def os_shell_context(self):
        """Return the serializable snapshot consumed by ``ui/panel.tsx``."""

        return await self._runtime.snapshot()

    @ui.action(
        id="ama_pulse",
        label=tr("actions.pulse.label", default="Pulse check"),
        icon="refresh",
        tone="primary",
        order=10,
        refresh_context=True,
    )
    @plugin_entry(
        id="ama_pulse",
        name=tr("entries.pulse.name", default="Pulse check"),
        description=tr(
            "entries.pulse.description",
            default="Wake Ama's shell and ask it to answer one pulse.",
        ),
        input_schema=PULSE_SCHEMA,
        llm_result_fields=["summary"],
        timeout=15,
    )
    async def ama_pulse(self, **_):
        result = await self._runtime.pulse()
        return Ok(result)

    @ui.action(
        id="ama_web_search",
        label=tr("actions.web_search.label", default="Web search"),
        icon="search",
        tone="primary",
        order=20,
        refresh_context=True,
    )
    @plugin_entry(
        id="ama_web_search",
        name=tr("entries.web_search.name", default="Web search"),
        description=tr(
            "entries.web_search.description",
            default="Search the web through the host's search service, with a direct fallback.",
        ),
        input_schema=WEB_SEARCH_SCHEMA,
        llm_result_fields=["summary"],
        timeout=60,
    )
    async def ama_web_search(self, query: Any = "", max_results: Any = 5, **_):
        if not isinstance(query, str) or not query.strip():
            return Ok({
                "ok": False,
                "status": "error",
                "query": "",
                "count": 0,
                "results": [],
                "error": "empty_query",
                "summary": self.i18n.t("web.emptyQuery", default="Search query is empty."),
            })
        try:
            limit = int(max_results)
        except (TypeError, ValueError):
            limit = 5
        result = await self._runtime.search_web(query, limit)
        return Ok(result)

    @ui.action(
        id="ama_steam_search",
        label=tr("actions.steam_search.label", default="Steam price check"),
        icon="search",
        tone="default",
        order=30,
        refresh_context=True,
    )
    @plugin_entry(
        id="ama_steam_search",
        name=tr("entries.steam_search.name", default="Steam price check"),
        description=tr(
            "entries.steam_search.description",
            default="Look up current lowest prices and all-time lows for Steam games via CheapShark (USD).",
        ),
        input_schema=STEAM_SEARCH_SCHEMA,
        llm_result_fields=["summary"],
        timeout=45,
    )
    async def ama_steam_search(self, query: Any = "", max_results: Any = 3, **_):
        if not isinstance(query, str) or not query.strip():
            return Ok({
                "ok": False,
                "status": "error",
                "query": "",
                "count": 0,
                "results": [],
                "error": "empty_query",
                "summary": self.i18n.t("steam.emptyQuery", default="Game name or Steam AppID is empty."),
            })
        try:
            limit = int(max_results)
        except (TypeError, ValueError):
            limit = 3
        result = await self._runtime.search_game_prices(query, limit)
        return Ok(result)

    @ui.action(
        id="ama_steam_deals",
        label=tr("actions.steam_deals.label", default="Steam sale picks"),
        icon="search",
        tone="default",
        order=31,
        refresh_context=True,
    )
    @plugin_entry(
        id="ama_steam_deals",
        name=tr("entries.steam_deals.name", default="Steam sale picks"),
        description=tr(
            "entries.steam_deals.description",
            default="Pick high-discount Steam games, enriched with historical lows, plus a curated free-to-play shelf.",
        ),
        input_schema=STEAM_DEALS_SCHEMA,
        llm_result_fields=["summary"],
        timeout=45,
    )
    async def ama_steam_deals(self, max_results: Any = 6, **_):
        try:
            limit = int(max_results)
        except (TypeError, ValueError):
            limit = 6
        result = await self._runtime.steam_deals(limit)
        return Ok(result)

    # ------------------------------------------------------------------
    # Future integration surface
    # ------------------------------------------------------------------

    @plugin_entry(
        id="ama_system_contract",
        name=tr("entries.contract.name", default="Read system bridge contract"),
        description=tr(
            "entries.contract.description",
            default=(
                "Read the stable Ama Monster OS system-bridge contract (v1) used "
                "by the hosted plugin and reserved for the future built-in app."
            ),
        ),
        input_schema=CONTRACT_SCHEMA,
        llm_result_fields=["summary"],
        timeout=10,
    )
    async def ama_system_contract(self, **_):
        manifest = self._runtime.contract()
        summary = self.i18n.t(
            "entries.contract.summary",
            default="Ama Monster OS system bridge contract v1.0.0.",
        )
        return Ok({
            "summary": summary,
            "contract": manifest,
            "version": SHELL_DISPLAY_VERSION,
            "channel": SHELL_CHANNEL,
        })


__all__ = ["AmaMonsterOsPlugin"]
