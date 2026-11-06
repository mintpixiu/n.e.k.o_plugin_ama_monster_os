from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Any

from app import AmaOsRuntime
from system_contract import (
    CONTRACT_VERSION,
    MODE_HOSTED_PLUGIN,
    SystemPort,
    build_manifest,
    validate_manifest,
)


@dataclass
class FakePort:
    provider_id: str = "test-host"
    mode: str = MODE_HOSTED_PLUGIN
    capabilities: tuple[str, ...] = ("telemetry.environment", "activity.privacy")
    privacy: str = "visible"
    fail: bool = False
    closed: bool = False
    events: list[str] | None = None

    def __post_init__(self) -> None:
        self.events = []

    def manifest(self) -> dict[str, Any]:
        return build_manifest(
            provider_id=self.provider_id,
            mode=self.mode,
            capabilities=self.capabilities,
        )

    async def environment(self) -> dict[str, Any]:
        if self.fail:
            raise RuntimeError("environment unavailable")
        return {
            "host": "N.E.K.O",
            "host_surface": "plugin-manager",
            "platform": "Windows",
            "os_release": "11",
            "python": "3.11.0",
            "sdk": "0.1.0",
        }

    async def activity(self) -> dict[str, Any]:
        if self.fail:
            raise RuntimeError("activity unavailable")
        return {
            "available": True,
            "privacy": self.privacy,
            "category": "game" if self.privacy == "visible" else None,
            "idle_seconds": 4.2,
        }

    def record_event(self, name: str, detail: str = "") -> None:
        assert self.events is not None
        self.events.append(name)

    async def close(self) -> None:
        self.closed = True


def test_fake_port_matches_protocol() -> None:
    assert isinstance(FakePort(), SystemPort)


def test_snapshot_is_versioned_and_serializable() -> None:
    runtime = AmaOsRuntime(FakePort())

    snapshot = asyncio.run(runtime.snapshot())

    assert snapshot["ok"] is True
    assert snapshot["shell"]["version"] == "0.1.0 Beta"
    assert snapshot["shell"]["name"] == "Ama Monster OS"
    assert snapshot["preview"] is True
    assert snapshot["bridge"]["contract_version"] == CONTRACT_VERSION
    assert snapshot["bridge"]["health"] == "ready"
    assert snapshot["bridge"]["activity"]["category"] == "game"
    assert snapshot["telemetry"]["platform"] == "Windows"
    assert len(snapshot["modules"]) == 4
    assert {module["status"] for module in snapshot["modules"]} == {"online", "reserved"}
    json.dumps(snapshot)


def test_private_activity_never_leaks_category() -> None:
    runtime = AmaOsRuntime(FakePort(privacy="private"))

    snapshot = asyncio.run(runtime.snapshot())

    assert snapshot["bridge"]["activity"]["privacy"] == "private"
    assert snapshot["bridge"]["activity"]["category"] is None
    assert snapshot["bridge"]["activity"]["idle_seconds"] is None


def test_start_records_boot_and_pulse() -> None:
    port = FakePort()

    async def scenario() -> tuple[dict[str, Any], dict[str, Any]]:
        runtime = AmaOsRuntime(port)
        await runtime.start()
        before = await runtime.snapshot()
        pulse = await runtime.pulse()
        after = await runtime.snapshot()
        await runtime.stop()
        return before, {"pulse": pulse, "after": after}

    before, rest = asyncio.run(scenario())

    assert before["shell"]["boot_count"] == 1
    assert [event["name"] for event in before["events"]] == ["bridge.attached", "shell.ready"]
    assert rest["pulse"]["ok"] is True
    assert rest["after"]["pulse"]["count"] == 1
    assert port.closed is True
    assert "shell.ready" in (port.events or [])


def test_port_failure_degrades_without_raising() -> None:
    runtime = AmaOsRuntime(FakePort(fail=True))

    snapshot = asyncio.run(runtime.snapshot())

    assert snapshot["bridge"]["health"] == "degraded"
    assert snapshot["telemetry"]["degraded"] is True
    assert snapshot["telemetry"]["platform"] == "unknown"
    assert snapshot["bridge"]["activity"]["privacy"] == "unavailable"


def test_contract_validates() -> None:
    manifest = build_manifest(provider_id="test-host", mode=MODE_HOSTED_PLUGIN)
    assert validate_manifest(manifest) == []
    assert manifest["contract_id"] == "ama.system.bridge"
    assert manifest["api_level"] == 1
    assert manifest["reserved"]
    assert manifest["entrypoints"]["context"] == "os_shell"
