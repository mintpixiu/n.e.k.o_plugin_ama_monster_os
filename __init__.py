"""Ama Monster OS — a NEKO-styled shell preview for Project N.E.K.O.

The facade is intentionally thin: it owns the SDK lifecycle, the Hosted UI
context/action bridge, and two callable entries.  All shell state lives in
:mod:`app`, and all host-specific behaviour lives behind
:class:`system_port.NekoHostSystemPort` so a future built-in desktop build can
reuse the window and runtime with a different system port.
"""

from __future__ import annotations

import asyncio
import json
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
from .steam_account import SteamAccountService
from .system_port import NekoHostSystemPort
from .token_radar import TokenPriceService
from .ui_profile import (
    MAX_UI_PROFILE_BYTES,
    export_ui_profile,
    normalize_ui_profile,
    parse_ui_profile_payload,
)

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

UI_PROFILE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "profile": {
            "type": "object",
            "description": "Safe appearance profile: brand, glyph, accent, wallpaper, radius, density, theme.",
            "additionalProperties": True,
        },
    },
    "required": ["profile"],
}

STEAM_FREE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {},
}

STEAM_LOGIN_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {},
}

STEAM_ACCOUNT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "finish": {
            "type": "boolean",
            "default": True,
            "description": "Check whether the browser already completed the OpenID login.",
        },
    },
}

TOKEN_PRICES_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "force": {
            "type": "boolean",
            "default": False,
            "description": "Bypass the 55-second cache and fetch the public catalog now.",
        },
    },
}


@neko_plugin
class AmaMonsterOsPlugin(NekoPluginBase):
    """The first window of Ama Monster OS, hosted inside N.E.K.O."""

    def __init__(self, ctx: Any) -> None:
        super().__init__(ctx)
        self._runtime = AmaOsRuntime(NekoHostSystemPort(self))

    def _ui_profile_path(self):
        return self.data_path("ui_profile.json")

    def _steam_account(self) -> SteamAccountService:
        return SteamAccountService(self.data_path())

    def _load_ui_profile(self) -> None:
        try:
            path = self._ui_profile_path()
            if not path.is_file():
                return
            raw = path.read_text(encoding="utf-8")
            if len(raw.encode("utf-8", errors="ignore")) > MAX_UI_PROFILE_BYTES:
                return
            profile, error = parse_ui_profile_payload(raw)
            if profile is not None:
                self._runtime.set_ui_profile(profile)
                self.logger.info("Loaded custom UI profile from %s", path)
            elif error:
                self.logger.warning("Ignoring invalid UI profile: %s", error)
        except Exception as exc:
            self.logger.warning("Could not load UI profile: %s", exc)

    # ------------------------------------------------------------------
    # Lifecycle: cheap, no background tasks, no I/O at import time.
    # ------------------------------------------------------------------

    @lifecycle(id="startup")
    async def on_startup(self, **_):
        self._load_ui_profile()
        try:
            self._runtime.set_steam_account(self._steam_account().status())
        except Exception as exc:
            self.logger.warning("Could not read the Steam account: %s", exc)
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

    @ui.action(
        id="ama_steam_free",
        label=tr("actions.steam_free.label", default="Shuffle free shelf"),
        icon="refresh",
        tone="default",
        order=32,
        refresh_context=True,
    )
    @plugin_entry(
        id="ama_steam_free",
        name=tr("entries.steam_free.name", default="Shuffle free shelf"),
        description=tr(
            "entries.steam_free.description",
            default="Rotate to the next group of permanently free Steam games.",
        ),
        input_schema=STEAM_FREE_SCHEMA,
        llm_result_fields=["summary"],
        timeout=10,
    )
    async def ama_steam_free(self, **_):
        result = self._runtime.shuffle_free_shelf()
        return Ok({
            **result,
            "summary": self.i18n.t(
                "entries.steam_free.summary",
                default="Free shelf group {group}/{groups}.",
            ).replace("{group}", str(result["group"])).replace("{groups}", str(result["groups"])),
        })

    @ui.action(
        id="ama_steam_login",
        label=tr("actions.steam_login.label", default="Sign in to Steam"),
        icon="search",
        tone="default",
        order=33,
        refresh_context=True,
    )
    @plugin_entry(
        id="ama_steam_login",
        name=tr("entries.steam_login.name", default="Sign in to Steam"),
        description=tr(
            "entries.steam_login.description",
            default=(
                "Start the Steam OpenID login: open a loopback listener and return "
                "the steamcommunity.com login URL. Never asks for a Steam password."
            ),
        ),
        input_schema=STEAM_LOGIN_SCHEMA,
        llm_result_fields=["summary"],
        timeout=20,
    )
    async def ama_steam_login(self, **_):
        service = self._steam_account()
        started = service.start_login()
        self._runtime.set_steam_account(service.status())
        accelerator = started.get("accelerator") or {}
        return Ok({
            **started,
            "summary": (
                "Steam 登录已启动，请在浏览器完成登录。"
                if accelerator.get("available")
                else "Steam 登录已启动；如果打不开 steamcommunity.com，请先开启 Steam++ 加速。"
            ),
        })

    @ui.action(
        id="ama_steam_account",
        label=tr("actions.steam_account.label", default="Steam account status"),
        icon="refresh",
        tone="default",
        order=34,
        refresh_context=True,
    )
    @plugin_entry(
        id="ama_steam_account",
        name=tr("entries.steam_account.name", default="Steam account status"),
        description=tr(
            "entries.steam_account.description",
            default=(
                "Read the linked Steam account, accelerator detection, and finish "
                "a pending OpenID login when the browser has returned."
            ),
        ),
        input_schema=STEAM_ACCOUNT_SCHEMA,
        llm_result_fields=["summary"],
        timeout=30,
    )
    async def ama_steam_account(self, finish: Any = True, **_):
        service = self._steam_account()
        should_finish = finish is not False
        result: dict[str, Any] = {"ok": True, "status": "idle"}
        if should_finish:
            result = await asyncio.to_thread(service.poll_login)
        status_payload = service.status()
        if result.get("status") == "linked":
            status_payload["account"] = result.get("account") or status_payload.get("account") or {}
        self._runtime.set_steam_account(status_payload)
        account = status_payload.get("account") or {}
        linked = bool(account.get("steam_id"))
        return Ok({
            **status_payload,
            **result,
            "linked": linked,
            "summary": (
                self.i18n.t("entries.steam_account.linked", default="Steam account linked: {name}.")
                .replace("{name}", str(account.get("nickname") or account.get("steam_id") or ""))
                if linked
                else self.i18n.t("entries.steam_account.unlinked", default="No Steam account linked.")
            ),
        })

    @ui.action(
        id="ama_steam_logout",
        label=tr("actions.steam_logout.label", default="Sign out of Steam"),
        icon="refresh",
        tone="default",
        order=35,
        refresh_context=True,
    )
    @plugin_entry(
        id="ama_steam_logout",
        name=tr("entries.steam_logout.name", default="Sign out of Steam"),
        description=tr(
            "entries.steam_logout.description",
            default="Forget the stored Steam OpenID profile on this machine.",
        ),
        input_schema=STEAM_ACCOUNT_SCHEMA,
        llm_result_fields=["summary"],
        timeout=10,
    )
    async def ama_steam_logout(self, **_):
        service = self._steam_account()
        service.clear()
        status_payload = service.status()
        self._runtime.set_steam_account(status_payload)
        return Ok({
            **status_payload,
            "linked": False,
            "summary": self.i18n.t("entries.steam_logout.summary", default="Steam account signed out."),
        })

    @ui.action(
        id="ama_ui_profile_save",
        label=tr("actions.ui_profile_save.label", default="Save appearance"),
        icon="refresh",
        tone="primary",
        order=40,
        refresh_context=True,
    )
    @plugin_entry(
        id="ama_ui_profile_save",
        name=tr("entries.ui_profile_save.name", default="Save appearance"),
        description=tr(
            "entries.ui_profile_save.description",
            default="Persist a validated custom UI profile for the Ama Monster OS window.",
        ),
        input_schema=UI_PROFILE_SCHEMA,
        llm_result_fields=["summary"],
        timeout=10,
    )
    async def ama_ui_profile_save(self, profile: Any = None, **_):
        normalized = normalize_ui_profile(profile)
        self._runtime.set_ui_profile(normalized)
        try:
            path = self._ui_profile_path()
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_name(f"{path.name}.tmp")
            temporary.write_text(
                json.dumps(export_ui_profile(normalized), ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
                newline="\n",
            )
            temporary.replace(path)
        except Exception as exc:
            self.logger.warning("Could not persist UI profile: %s", exc)
            return Ok({
                "ok": False,
                "profile": normalized,
                "error": "persist_failed",
                "summary": self.i18n.t(
                    "studio.saveFailed",
                    default="Appearance applied for this session, but could not be saved.",
                ),
            })
        return Ok({
            "ok": True,
            "profile": normalized,
            "summary": self.i18n.t("studio.saved", default="Appearance saved."),
        })

    @ui.action(
        id="ama_token_prices",
        label=tr("actions.token_prices.label", default="Refresh token prices"),
        icon="search",
        tone="primary",
        order=41,
        refresh_context=True,
    )
    @plugin_entry(
        id="ama_token_prices",
        name=tr("entries.token_prices.name", default="Refresh token prices"),
        description=tr(
            "entries.token_prices.description",
            default=(
                "Fetch current public model list prices, update the local daily "
                "price history, and return the token radar snapshot."
            ),
        ),
        input_schema=TOKEN_PRICES_SCHEMA,
        llm_result_fields=["summary"],
        timeout=45,
    )
    async def ama_token_prices(self, force: Any = False, **_):
        force_refresh = force is True or str(force).strip().lower() in ("1", "true", "yes")
        service = TokenPriceService(self.data_path())
        try:
            snapshot = await asyncio.to_thread(service.refresh, force_refresh)
        except Exception as exc:
            self.logger.warning("Token radar refresh failed: %s", exc)
            return Ok({
                "ok": False,
                "error": "token_radar_failed",
                "summary": self.i18n.t(
                    "tokens.error",
                    default="Token prices are temporarily unavailable.",
                ),
            })
        self._runtime.set_token_radar(snapshot)
        model_count = len(snapshot.get("models") or [])
        return Ok({
            "ok": bool(snapshot.get("ok", True)),
            "token_radar": snapshot,
            "summary": self.i18n.t(
                "tokens.updated",
                default="Token prices updated: {count} models.",
            ).replace("{count}", str(model_count)),
        })

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
