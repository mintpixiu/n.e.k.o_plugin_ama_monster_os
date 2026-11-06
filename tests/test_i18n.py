from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
I18N = ROOT / "i18n"
LOCALES = {"en", "es", "ja", "ko", "pt", "ru", "zh-CN", "zh-TW"}
PLACEHOLDER = re.compile(r"\{([A-Za-z0-9_]+)\}")


def _catalogs() -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    for path in I18N.glob("*.json"):
        data = json.loads(path.read_text(encoding="utf-8"))
        assert isinstance(data, dict), path
        assert all(isinstance(key, str) and isinstance(value, str) for key, value in data.items()), path
        result[path.stem] = data
    return result


def test_all_market_locales_present() -> None:
    assert LOCALES <= set(_catalogs())


def test_locale_keys_and_placeholders_match() -> None:
    catalogs = _catalogs()
    baseline = catalogs["en"]
    for locale, catalog in catalogs.items():
        assert set(catalog) == set(baseline), f"{locale} has a different key set"
        assert all(value.strip() for value in catalog.values()), f"{locale} has an empty value"
        for key, value in catalog.items():
            assert set(PLACEHOLDER.findall(value)) == set(PLACEHOLDER.findall(baseline[key])), (
                f"{locale}:{key} has a different placeholder set"
            )


def test_ui_and_python_translation_keys_exist() -> None:
    catalogs = _catalogs()
    baseline = catalogs["en"]
    sources = [ROOT / "ui" / "panel.tsx", ROOT / "__init__.py"]
    used: set[str] = set()
    for source in sources:
        text = source.read_text(encoding="utf-8")
        used.update(re.findall(r'(?<![A-Za-z0-9_.])t\("([a-zA-Z0-9_.-]+)"', text))
        used.update(re.findall(r'(?<![A-Za-z0-9_.])tr\("([a-zA-Z0-9_.-]+)"', text))
        used.update(re.findall(r'(?<![A-Za-z0-9_.])t\(`([^`]+)`', text))
    dynamic_prefixes = {"greeting.", "boot."}
    missing = {
        key for key in used
        if not any(key.startswith(prefix) for prefix in dynamic_prefixes)
        and key not in baseline
    }
    assert not missing, f"missing locale keys: {sorted(missing)}"


def test_every_module_key_exists() -> None:
    catalogs = _catalogs()
    baseline = catalogs["en"]
    from shell_runtime import MODULES

    for module in MODULES:
        assert module.name_key in baseline
        assert module.description_key in baseline
