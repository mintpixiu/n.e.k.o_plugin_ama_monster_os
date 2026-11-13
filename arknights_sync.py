"""Sync the complete Arknights operator index from public game data.

The plugin does not bundle the full roster (400+ entries change constantly and
would bloat the package).  Instead it downloads two public game-data tables,
keeps only factual fields (names, class, rarity, nation), and caches the result
in the plugin data folder.

No artwork, voice lines, story text or wiki prose is downloaded.  Every
operator gets a procedurally generated avatar in the UI (initial + class
colour + rarity), so the codex is complete without shipping copyrighted art.
"""

from __future__ import annotations

import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

_ZH_PATH = "zh_CN/gamedata/excel/character_table.json"
_EN_PATH = "en_US/gamedata/excel/character_table.json"
ZH_TABLE_URLS = (
    f"https://fastly.jsdelivr.net/gh/Kengxxiao/ArknightsGameData@master/{_ZH_PATH}",
    f"https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/{_ZH_PATH}",
)
EN_TABLE_URLS = (
    f"https://fastly.jsdelivr.net/gh/Kengxxiao/ArknightsGameData@master/{_EN_PATH}",
    f"https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/master/{_EN_PATH}",
)
MAX_TABLE_BYTES = 32 * 1024 * 1024
CACHE_FILE = "arknights_index.json"
CACHE_VERSION = 1
_HTTP_TIMEOUT = 45.0
_USER_AGENT = "AmaMonsterOS/0.6.2 (+https://github.com/mintpixiu/n.e.k.o_plugin_ama_monster_os)"

PROFESSION_ZH: dict[str, str] = {
    "PIONEER": "先锋",
    "WARRIOR": "近卫",
    "TANK": "重装",
    "SNIPER": "狙击",
    "CASTER": "术师",
    "MEDIC": "医疗",
    "SUPPORT": "辅助",
    "SPECIAL": "特种",
}

NATION_ZH: dict[str, str] = {
    "rhodes": "罗德岛",
    "penguin": "企鹅物流",
    "rhine": "莱茵生命",
    "karlan": "喀兰贸易",
    "lgd": "龙门近卫局",
    "blacksteel": "黑钢国际",
    "ursus": "乌萨斯",
    "abyssal": "深海猎人",
    "followers": "使徒",
    "glasgow": "格拉斯哥帮",
    "laterano": "拉特兰",
    "siracusa": "叙拉古",
    "kazimierz": "卡西米尔",
    "victoria": "维多利亚",
    "yan": "炎",
    "higashi": "东",
    "sargon": "萨尔贡",
    "columbia": "哥伦比亚",
    "leithanien": "莱塔尼亚",
    "aegir": "阿戈尔",
    "iberia": "伊比利亚",
    "bolivar": "玻利瓦尔",
    "sami": "萨米",
    "rim": "边界",
    "kazdel": "卡兹戴尔",
    "egir": "阿戈尔",
}

_RARITY = {"TIER_1": 1, "TIER_2": 2, "TIER_3": 3, "TIER_4": 4, "TIER_5": 5, "TIER_6": 6}

# Ids that are collectible operators: real professions, obtainable characters.
_SKIP_PROFESSIONS = {"TOKEN", "TRAP", "NONE", ""}


def _read_url(url: str) -> bytes:
    """Download one table, preferring httpx when the host provides it."""

    last_error: Exception | None = None
    try:
        import httpx  # type: ignore[import-not-found]

        try:
            import ssl

            import truststore  # type: ignore[import-not-found]

            verify: Any = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        except Exception:
            verify = True
        with httpx.stream(
            "GET",
            url,
            headers={"User-Agent": _USER_AGENT},
            verify=verify,
            timeout=httpx.Timeout(30.0, read=120.0),
            follow_redirects=True,
        ) as response:
            if response.status_code >= 400:
                raise ValueError(f"http_{response.status_code}")
            payload = b"".join(response.iter_bytes(262144))
        if len(payload) > MAX_TABLE_BYTES:
            raise ValueError("character table is larger than the safety limit")
        return payload
    except ImportError:
        last_error = None
    except Exception as exc:  # fall through to urllib
        last_error = exc

    request = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            payload = response.read(MAX_TABLE_BYTES + 1)
    except Exception as exc:
        raise exc from last_error
    if len(payload) > MAX_TABLE_BYTES:
        raise ValueError("character table is larger than the safety limit")
    return payload


def _fetch_json(urls: tuple[str, ...]) -> Any:
    last_error: Exception | None = None
    for url in urls:
        try:
            return json.loads(_read_url(url).decode("utf-8"))
        except Exception as exc:
            last_error = exc
            continue
    raise last_error or ValueError("no source available")


def normalize_tables(zh: Mapping[str, Any], en: Mapping[str, Any] | None = None) -> list[dict[str, Any]]:
    """Turn the raw character tables into the codex entry shape."""

    english = en if isinstance(en, Mapping) else {}
    operators: list[dict[str, Any]] = []
    seen: set[str] = set()
    for char_id, raw in zh.items():
        if not isinstance(raw, Mapping):
            continue
        profession = str(raw.get("profession") or "")
        if profession in _SKIP_PROFESSIONS or profession not in PROFESSION_ZH:
            continue
        name_cn = str(raw.get("name") or "").strip()
        if not name_cn or name_cn in seen:
            continue
        if raw.get("isNotObtainable"):
            continue
        seen.add(name_cn)
        rarity = _RARITY.get(str(raw.get("rarity") or ""), 0)
        if rarity < 1:
            continue
        en_raw = english.get(char_id) if isinstance(english, Mapping) else None
        name_en = str((en_raw or {}).get("name") or "").strip() if isinstance(en_raw, Mapping) else ""
        nation = str(raw.get("nationId") or "")
        faction = NATION_ZH.get(nation, "")
        operator_class = PROFESSION_ZH[profession]
        operators.append({
            "id": str(char_id),
            "name_cn": name_cn,
            "name_en": name_en or name_cn,
            "class": operator_class,
            "rarity": rarity,
            "faction": faction,
            "race": "",
            "tags": [operator_class] + ([faction] if faction else []),
        })
    operators.sort(key=lambda item: (-item["rarity"], item["name_cn"]))
    return operators


def fetch_index() -> list[dict[str, Any]]:
    zh = _fetch_json(ZH_TABLE_URLS)
    if not isinstance(zh, Mapping):
        raise ValueError("unexpected Chinese table shape")
    try:
        en = _fetch_json(EN_TABLE_URLS)
    except Exception:
        en = {}
    operators = normalize_tables(zh, en if isinstance(en, Mapping) else {})
    if len(operators) < 100:
        raise ValueError("the downloaded roster looks incomplete")
    return operators


def sync_index(data_dir: Path, *, fetcher: Any = None) -> dict[str, Any]:
    """Download, normalize and cache the full roster. Returns a summary."""

    operators = (fetcher or fetch_index)()
    payload = {
        "version": CACHE_VERSION,
        "source": "Kengxxiao/ArknightsGameData (public game data)",
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(operators),
        "operators": operators,
    }
    path = Path(data_dir) / CACHE_FILE
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.name}.tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    temporary.replace(path)
    return {
        "ok": True,
        "count": len(operators),
        "fetched_at": payload["fetched_at"],
        "source": payload["source"],
    }


def load_index(data_dir: Path) -> dict[str, Any]:
    path = Path(data_dir) / CACHE_FILE
    try:
        if not path.is_file():
            return {}
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    if not isinstance(payload, dict):
        return {}
    operators = payload.get("operators")
    if not isinstance(operators, list) or len(operators) < 50:
        return {}
    return payload


def read_index_operators(data_dir: Path) -> list[dict[str, Any]]:
    payload = load_index(data_dir)
    operators = payload.get("operators") if isinstance(payload, dict) else None
    if not isinstance(operators, list):
        return []
    return [dict(item) for item in operators if isinstance(item, Mapping)]


__all__ = [
    "CACHE_FILE",
    "NATION_ZH",
    "PROFESSION_ZH",
    "fetch_index",
    "load_index",
    "normalize_tables",
    "read_index_operators",
    "sync_index",
]