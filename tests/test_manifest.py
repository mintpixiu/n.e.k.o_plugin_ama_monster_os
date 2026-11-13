from __future__ import annotations

import ast
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _manifest() -> dict:
    with (ROOT / "plugin.toml").open("rb") as stream:
        return tomllib.load(stream)


def test_identity_is_locked() -> None:
    manifest = _manifest()
    plugin = manifest["plugin"]

    assert ROOT.name == "ama_monster_os"
    assert plugin["id"] == "ama_monster_os"
    assert plugin["name"] == "N.E.K.O Ama Monster OS"
    assert plugin["version"] == "0.5.3-beta"
    assert plugin["type"] == "plugin"
    assert plugin["author"]["name"] == "呆萌貔貅"
    assert plugin["entry"] == "plugin.plugins.ama_monster_os:AmaMonsterOsPlugin"
    assert "host" not in plugin
    assert "dependencies" not in plugin


def test_market_sdk_range_and_runtime() -> None:
    manifest = _manifest()
    sdk = manifest["plugin"]["sdk"]
    runtime = manifest["plugin_runtime"]

    assert sdk["recommended"] == ">=0.1.0,<0.2.0"
    assert sdk["supported"] == ">=0.1.0,<0.3.0"
    assert runtime["enabled"] is True
    assert runtime["auto_start"] is False
    assert 0 < runtime["timeout"] <= 300
    assert runtime["startup_failure"] in {"warn", "fail", "ignore"}


def test_hosted_ui_surfaces_exist() -> None:
    manifest = _manifest()
    ui = manifest["plugin"]["ui"]
    assert ui["enabled"] is True

    panel = ui["panel"][0]
    assert panel["id"] == "os_shell"
    assert panel["context"] == "os_shell"
    assert panel["entry"] == "ui/panel.tsx"
    assert "state:read" in panel["permissions"]
    assert "action:call" in panel["permissions"]
    assert (ROOT / panel["entry"]).is_file()

    guides = ui["guide"] + ui["docs"]
    assert {item["entry"] for item in guides} == {
        "docs/quickstart.md",
        "docs/token-radar.md", "docs/ui-studio.md",
        "docs/system-contract.md",
    }
    for item in guides:
        assert (ROOT / item["entry"]).is_file()


def test_all_i18n_locales_exist() -> None:
    locales = {path.stem for path in (ROOT / "i18n").glob("*.json")}
    assert locales == {"en", "es", "ja", "ko", "pt", "ru", "zh-CN", "zh-TW"}


def test_entry_class_and_runtime_hooks_are_async() -> None:
    tree = ast.parse((ROOT / "__init__.py").read_text(encoding="utf-8"))
    classes = [node for node in tree.body if isinstance(node, ast.ClassDef)]
    assert [node.name for node in classes] == ["AmaMonsterOsPlugin"]
    class_node = classes[0]
    decorators = {ast.unparse(item) for item in class_node.decorator_list}
    assert "neko_plugin" in decorators

    methods = {node.name: node for node in class_node.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))}
    for name in ("on_startup", "on_shutdown", "os_shell_context", "ama_pulse", "ama_system_contract"):
        assert name in methods, name
        assert isinstance(methods[name], ast.AsyncFunctionDef), f"{name} must be async"
        method_decorators = {ast.unparse(item) for item in methods[name].decorator_list}
        assert any(
            item.startswith(("lifecycle(", "ui.context(", "ui.action(", "plugin_entry("))
            for item in method_decorators
        ), name


def test_no_internal_sdk_imports_or_heavy_top_level_side_effects() -> None:
    for name in ("__init__.py", "shell_runtime.py", "system_port.py", "system_contract.py"):
        text = (ROOT / name).read_text(encoding="utf-8")
        assert "plugin.sdk.shared" not in text
        for forbidden in ("requests.", "subprocess.", "socket."):
            assert forbidden not in text, f"{name} contains {forbidden}"


def test_ui_entry_contract() -> None:
    text = (ROOT / "ui" / "panel.tsx").read_text(encoding="utf-8")
    assert "export default function AmaMonsterOsPanel" in text
    assert 'from "@neko/plugin-ui"' in text
    assert "props.api.call" in text
    assert "props.api.refresh" in text
    assert "import(" not in text
    imports = [line for line in text.splitlines() if line.lstrip().startswith("import ")]
    for line in imports:
        assert '"@neko/plugin-ui"' in line or line.lstrip().startswith("import type"), line
    assert len(text.encode("utf-8")) < 280_000
