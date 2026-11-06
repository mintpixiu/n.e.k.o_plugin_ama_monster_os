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
