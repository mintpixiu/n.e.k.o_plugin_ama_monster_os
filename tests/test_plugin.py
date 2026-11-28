"""Plugin-level integration tests with a fake N.E.K.O SDK.

``__init__.py`` imports the host SDK at module import time, so this file
installs a minimal fake ``plugin.sdk.plugin`` before importing the plugin
package.  That lets the real ``AmaMonsterOsPlugin`` class be constructed and
its entries exercised without a running N.E.K.O host.
"""

from __future__ import annotations

import asyncio
import importlib
import logging
import sys
import types
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

import pytest

ENTRIES: dict[str, dict[str, Any]] = {}
ACTIONS: dict[str, dict[str, Any]] = {}
CONTEXTS: dict[str, dict[str, Any]] = {}


class FakeOk:
    def __init__(self, value: Any) -> None:
        self.value = value


class FakeErr(FakeOk):
    pass


class FakeNekoPluginBase:
    plugin_id = "ama_monster_os"

    def __init__(self, ctx: Any) -> None:
        self.ctx = ctx
        self.logger = logging.getLogger("ama-monster-os-test")
        self.i18n = types.SimpleNamespace(
            t=lambda key, default=None, **_: default if default is not None else key,
        )

    def data_path(self, name: str | None = None) -> Path:
        base = Path(self.ctx["data_dir"])
        base.mkdir(parents=True, exist_ok=True)
        return base / name if name else base


def _record(store: dict[str, dict[str, Any]]):
    def decorator_factory(**kwargs):
        def decorate(function):
            store[function.__name__] = dict(kwargs)
            return function

        return decorate

    return decorator_factory


def _install_fake_sdk() -> None:
    # pytest may have imported the package during collection (the repo root has
    # an ``__init__.py``); drop it so the fake SDK is the one that binds.
    for name in [name for name in list(sys.modules) if name == "ama_monster_os" or name.startswith("ama_monster_os.")]:
        sys.modules.pop(name, None)

    plugin_package = types.ModuleType("plugin")
    sdk_package = types.ModuleType("plugin.sdk")
    sdk_module = types.ModuleType("plugin.sdk.plugin")

    ui = types.SimpleNamespace(
        action=_record(ACTIONS),
        context=_record(CONTEXTS),
    )
    sdk_module.NekoPluginBase = FakeNekoPluginBase
    sdk_module.Ok = FakeOk
    sdk_module.Err = FakeErr
    sdk_module.neko_plugin = lambda cls: cls
    sdk_module.lifecycle = _record(ENTRIES)
    sdk_module.plugin_entry = _record(ENTRIES)
    sdk_module.ui = ui
    sdk_module.tr = lambda key, default=None, **_: default if default is not None else key

    plugin_package.sdk = sdk_package
    sdk_package.plugin = sdk_module
    sys.modules["plugin"] = plugin_package
    sys.modules["plugin.sdk"] = sdk_package
    sys.modules["plugin.sdk.plugin"] = sdk_module


@contextmanager
def _fake_sdk() -> Iterator[None]:
    """Install the fake SDK and put the host's real modules back afterwards."""

    names = ("plugin", "plugin.sdk", "plugin.sdk.plugin")
    saved = {name: sys.modules.get(name) for name in names}
    _install_fake_sdk()
    try:
        yield
    finally:
        for name, module in saved.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module


def _load_module():
    for name in [name for name in list(sys.modules) if name == "ama_monster_os" or name.startswith("ama_monster_os.")]:
        sys.modules.pop(name, None)
    with _fake_sdk():
        module = importlib.import_module("ama_monster_os")
    return module


class RecordingSteamService:
    instances: list["RecordingSteamService"] = []

    def __init__(self, data_dir: Path) -> None:
        self.data_dir = Path(data_dir)
        self.start_calls = 0
        self.poll_calls = 0
        self.status_calls = 0
        self.clear_calls = 0
        self.stop_calls = 0
        RecordingSteamService.instances.append(self)

    def start_login(self) -> dict[str, Any]:
        self.start_calls += 1
        return {
            "ok": True,
            "status": "pending",
            "url": "https://steamcommunity.com/openid/login?openid.mode=checkid_setup",
            "accelerator": {"available": True, "note": ""},
        }

    def poll_login(self) -> dict[str, Any]:
        self.poll_calls += 1
        return {
            "ok": True,
            "status": "linked",
            "account": {"steam_id": "76561198000000000", "nickname": "Ama"},
        }

    def status(self) -> dict[str, Any]:
        self.status_calls += 1
        return {
            "ok": True,
            "account": {"steam_id": "76561198000000000", "nickname": "Ama"},
            "accelerator": {"available": True, "note": ""},
            "login": "idle",
        }

    def clear(self) -> None:
        self.clear_calls += 1

    def stop(self) -> None:
        self.stop_calls += 1


@pytest.fixture()
def plugin(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    RecordingSteamService.instances = []
    module = _load_module()
    monkeypatch.setattr(module, "SteamAccountService", RecordingSteamService)
    instance = module.AmaMonsterOsPlugin({"data_dir": str(tmp_path)})
    return instance


def test_steam_login_and_account_use_one_service(plugin: Any) -> None:
    login = asyncio.run(plugin.ama_steam_login())
    assert login.value["ok"] is True
    assert len(RecordingSteamService.instances) == 1
    service = RecordingSteamService.instances[0]
    assert service.start_calls == 1

    account = asyncio.run(plugin.ama_steam_account(finish=True))

    assert len(RecordingSteamService.instances) == 1
    assert service.poll_calls == 1
    assert account.value["status"] == "linked"
    assert account.value["linked"] is True
    assert account.value["summary"]


def test_shutdown_stops_the_login_listener(plugin: Any) -> None:
    asyncio.run(plugin.ama_steam_login())
    service = RecordingSteamService.instances[0]

    asyncio.run(plugin.on_shutdown())

    assert service.stop_calls == 1


def test_contract_entry_returns_the_versioned_contract(plugin: Any) -> None:
    result = asyncio.run(plugin.ama_system_contract())

    contract = result.value["contract"]
    assert contract["contract_id"] == "ama.system.bridge"
    assert contract["contract_version"] == "1.0.0"
    assert result.value["version"] == "0.7.0"


def test_panel_only_entries_are_hidden_from_the_agent() -> None:
    _load_module()

    for name in (
        "ama_steam_login",
        "ama_steam_account",
        "ama_steam_logout",
        "ama_ui_profile_save",
        "ama_arknights_sync",
    ):
        assert ENTRIES[name].get("metadata", {}).get("agent_hidden") is True, name


def test_no_argument_entries_use_their_own_schema() -> None:
    _load_module()

    logout_schema = ENTRIES["ama_steam_logout"]["input_schema"]
    sync_schema = ENTRIES["ama_arknights_sync"]["input_schema"]
    assert logout_schema["properties"] == {}
    assert sync_schema["properties"] == {}
