"""Token price radar for the Ama Monster OS window.

The public ``models.dev`` catalog is the source of truth for list prices.  It
is a curated, provider-maintained price catalog rather than an exchange feed:
prices only move when a vendor changes them.  The window polls it, keeps a
small local history (used for the 30-day candles), and never invents a quote
when the network is down.

All amounts are USD per 1,000,000 tokens, matching the catalog.  DeepSeek's
peak/off-peak windows are handled explicitly because they are the one
clock-based discount in the selected catalog.
"""

from __future__ import annotations

import json
import math
import threading
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable

MODELS_DEV_URL = "https://models.dev/api.json"
SOURCE_URL = "https://models.dev/"
SOURCE_NAME = "models.dev 公开目录"
MAX_CATALOG_BYTES = 8_000_000
CACHE_TTL_SECONDS = 55
HISTORY_DAYS = 30
HISTORY_KEEP_DAYS = 45
_CACHE_FILE = "token_radar_cache.json"
_HISTORY_FILE = "token_radar_history.json"
_USER_AGENT = "AmaMonsterOS/0.6.4 (+https://github.com/mintpixiu/n.e.k.o_plugin_ama_monster_os)"
_LOCK = threading.Lock()


# The selection is intentionally curated: two representative models from each
# provider keeps the board readable and makes the 30-day history cheap to ship.
PROVIDERS: tuple[dict[str, Any], ...] = (
    {
        "id": "openai",
        "name": "OpenAI",
        "zh": "OpenAI",
        "region": "global",
        "color": "#10a37f",
        "models": (("gpt-5.6", "GPT-5.6"), ("gpt-6-luna", "GPT-6 Luna")),
    },
    {
        "id": "anthropic",
        "name": "Anthropic",
        "zh": "Anthropic",
        "region": "global",
        "color": "#d97757",
        "models": (("claude-sonnet-5", "Claude Sonnet 5"), ("claude-opus-4-7", "Claude Opus 4.7")),
    },
    {
        "id": "google",
        "name": "Google",
        "zh": "Google",
        "region": "global",
        "color": "#4285f4",
        "models": (("gemini-3-flash-preview", "Gemini 3 Flash Preview"), ("gemini-flash-lite-latest", "Gemini Flash-Lite")),
    },
    {
        "id": "xai",
        "name": "xAI",
        "zh": "xAI",
        "region": "global",
        "color": "#6b7280",
        "models": (("grok-4.5", "Grok 4.5"), ("grok-4.6", "Grok 4.6")),
    },
    {
        "id": "mistral",
        "name": "Mistral AI",
        "zh": "Mistral AI",
        "region": "global",
        "color": "#f59e0b",
        "models": (("mistral-medium-latest", "Mistral Medium"), ("ministral-14b-2512", "Ministral 3 14B")),
    },
    {
        "id": "deepseek",
        "name": "DeepSeek",
        "zh": "深度求索",
        "region": "china",
        "color": "#5b8def",
        "models": (("deepseek-v4-pro", "DeepSeek V4 Pro"), ("deepseek-flash", "DeepSeek V4.1 Flash")),
    },
    {
        "id": "alibaba",
        "name": "Alibaba Qwen",
        "zh": "阿里云通义千问",
        "region": "china",
        "color": "#7c5cff",
        "models": (("qwen3.8-max", "Qwen3.8 Max"), ("qwen3-coder-plus", "Qwen3 Coder Plus")),
    },
    {
        "id": "moonshotai",
        "name": "Moonshot AI",
        "zh": "月之暗面",
        "region": "china",
        "color": "#e88aa8",
        "models": (("kimi-k3", "Kimi K3"), ("kimi-k2.6", "Kimi K2.6")),
    },
    {
        "id": "zhipuai",
        "name": "Zhipu AI",
        "zh": "智谱",
        "region": "china",
        "color": "#4fc3a1",
        "models": (("glm-4.6", "GLM-4.6"), ("glm-4.5", "GLM-4.5")),
    },
    {
        "id": "volcengine",
        "name": "Volcengine",
        "zh": "火山引擎（字节）",
        "region": "china",
        "color": "#3b82f6",
        "models": (("doubao-seed-2-1-pro-260628", "Seed 2.1 Pro"), ("doubao-seed-2-0-lite-260428", "Seed 2.0 Lite")),
    },
)

DEEPSEEK_PEAK_WINDOWS = (("01:00", "04:00"), ("06:00", "10:00"))
DEEPSEEK_LOCAL_WINDOWS = (("09:00", "12:00"), ("14:00", "18:00"))


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if math.isfinite(number) and number >= 0 else default


def _as_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _as_date(value: Any) -> date | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        return date.fromisoformat(value.strip()[:10])
    except ValueError:
        return None


def _fetch_catalog() -> dict[str, Any]:
    request = urllib.request.Request(
        MODELS_DEV_URL,
        headers={"User-Agent": _USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = response.read(MAX_CATALOG_BYTES + 1)
    if len(payload) > MAX_CATALOG_BYTES:
        raise ValueError("models.dev catalog is larger than the safety limit")
    data = json.loads(payload.decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("models.dev catalog has an unexpected shape")
    return data


def _deepseek_policy(input_price: float, output_price: float, cache_price: float) -> dict[str, Any]:
    return {
        "kind": "deepseek_peak",
        "timezone": "UTC",
        "peak_windows_utc": [{"start": start, "end": end} for start, end in DEEPSEEK_PEAK_WINDOWS],
        "local_windows": [{"start": start, "end": end} for start, end in DEEPSEEK_LOCAL_WINDOWS],
        "local_timezone": "UTC+8",
        "weekdays": [0, 1, 2, 3, 4],
        "weekend_off_peak": True,
        "off_peak_multiplier": 0.5,
        "peak_multiplier": 1.0,
        "note": "高峰为 UTC 周一至周五 01:00–04:00、06:00–10:00；其余时间及周末为非高峰，非高峰约为高峰的 5 折。中国法定节假日未计入。",
        "peak_input": round(input_price, 6),
        "peak_output": round(output_price, 6),
        "peak_cache": round(cache_price, 6),
        "off_peak_input": round(input_price * 0.5, 6),
        "off_peak_output": round(output_price * 0.5, 6),
        "off_peak_cache": round(cache_price * 0.5, 6),
    }


def _flat_policy() -> dict[str, Any]:
    return {
        "kind": "flat",
        "timezone": "UTC",
        "peak_windows_utc": [],
        "local_windows": [],
        "off_peak_multiplier": 1.0,
        "peak_multiplier": 1.0,
        "note": "厂商按 token 统一目录价计费，没有早晚峰谷；缓存命中、批处理和上下文档位才是主要价差来源。",
    }


def _resolve_models(catalog: dict[str, Any]) -> list[dict[str, Any]]:
    models: list[dict[str, Any]] = []
    for provider in PROVIDERS:
        provider_data = catalog.get(provider["id"])
        if not isinstance(provider_data, dict):
            continue
        provider_models = provider_data.get("models")
        if not isinstance(provider_models, dict):
            continue
        for model_id, fallback_name in provider["models"]:
            raw = provider_models.get(model_id)
            if not isinstance(raw, dict):
                continue
            cost = raw.get("cost")
            if not isinstance(cost, dict):
                continue
            input_price = _as_float(cost.get("input"))
            output_price = _as_float(cost.get("output"))
            cache_price = _as_float(cost.get("cache_read"))
            if input_price <= 0 and output_price <= 0:
                continue
            limit = raw.get("limit") if isinstance(raw.get("limit"), dict) else {}
            tier = None
            tiers = cost.get("tiers")
            if isinstance(tiers, list) and tiers:
                first = tiers[0] if isinstance(tiers[0], dict) else {}
                tier_info = first.get("tier") if isinstance(first.get("tier"), dict) else {}
                tier = {
                    "threshold": _as_int(tier_info.get("size")),
                    "input": _as_float(first.get("input")),
                    "output": _as_float(first.get("output")),
                }
            model = {
                "id": f"{provider['id']}/{model_id}",
                "provider": provider["id"],
                "provider_name": provider["name"],
                "provider_zh": provider["zh"],
                "provider_region": provider["region"],
                "provider_color": provider["color"],
                "name": str(raw.get("name") or fallback_name),
                "input": input_price,
                "output": output_price,
                "cache_read": cache_price,
                "cache_write": _as_float(cost.get("cache_write")),
                "context": _as_int(limit.get("context")),
                "max_output": _as_int(limit.get("output")),
                "release_date": str(raw.get("release_date") or ""),
                "tier": tier,
                "cache_discount": round(1 - cache_price / input_price, 4) if input_price > 0 and cache_price > 0 else 0.0,
                "time_policy": _flat_policy(),
            }
            if provider["id"] == "deepseek":
                model["time_policy"] = _deepseek_policy(input_price, output_price, cache_price)
            models.append(model)
    return models


def _candle(
    day: str,
    price: float,
    output_price: float,
    *,
    baseline: bool = True,
    samples: int = 0,
    previous: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if previous:
        open_price = _as_float(previous.get("close"), price)
        open_output = _as_float(previous.get("output_close"), output_price)
        high = max(_as_float(previous.get("high"), price), price, open_price)
        low = min(_as_float(previous.get("low"), price), price, open_price)
        high_output = max(_as_float(previous.get("output_high"), output_price), output_price, open_output)
        low_output = min(_as_float(previous.get("output_low"), output_price), output_price, open_output)
    else:
        open_price = price
        open_output = output_price
        high = low = price
        high_output = low_output = output_price
    return {
        "date": day,
        "open": round(open_price, 6),
        "high": round(high, 6),
        "low": round(low, 6),
        "close": round(price, 6),
        "output_open": round(open_output, 6),
        "output_high": round(high_output, 6),
        "output_low": round(low_output, 6),
        "output_close": round(output_price, 6),
        "samples": samples,
        "baseline": baseline,
    }


def _seed_history(model: dict[str, Any], today: date) -> list[dict[str, Any]]:
    start = today - timedelta(days=HISTORY_DAYS - 1)
    released = _as_date(model.get("release_date"))
    if released and released > start:
        start = released
    candles: list[dict[str, Any]] = []
    cursor = start
    while cursor <= today:
        candles.append(_candle(cursor.isoformat(), model["input"], model["output"], baseline=True))
        cursor += timedelta(days=1)
    return candles


def _update_history(models: list[dict[str, Any]], old: dict[str, Any], today: date) -> dict[str, Any]:
    old_models = old.get("models") if isinstance(old.get("models"), dict) else {}
    result: dict[str, Any] = {}
    for model in models:
        model_id = model["id"]
        entry = old_models.get(model_id)
        current = []
        if isinstance(entry, dict) and isinstance(entry.get("days"), list):
            current = [item for item in entry["days"] if isinstance(item, dict) and isinstance(item.get("date"), str)]
        if not current:
            current = _seed_history(model, today)
        by_day = {item["date"]: item for item in current}
        today_key = today.isoformat()
        if today_key in by_day:
            previous = by_day[today_key]
            updated = _candle(
                today_key,
                model["input"],
                model["output"],
                baseline=False,
                samples=max(1, _as_int(previous.get("samples")) + 1),
                previous=previous,
            )
            # Preserve the previous close semantics while folding the new tick
            # into the high/low range.
            updated["open"] = _as_float(previous.get("open"), updated["open"])
            updated["output_open"] = _as_float(previous.get("output_open"), updated["output_open"])
            by_day[today_key] = updated
        else:
            previous = current[-1] if current else None
            by_day[today_key] = _candle(
                today_key,
                model["input"],
                model["output"],
                baseline=False,
                samples=1,
                previous=previous,
            )
        days = sorted(by_day.values(), key=lambda item: item["date"])[-HISTORY_DAYS:]
        result[model_id] = {"days": days}
    return {
        "version": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "models": result,
    }


def _history_payload(history: dict[str, Any], models: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    old_models = history.get("models") if isinstance(history.get("models"), dict) else {}
    payload: dict[str, list[dict[str, Any]]] = {}
    for model in models:
        entry = old_models.get(model["id"])
        if isinstance(entry, dict) and isinstance(entry.get("days"), list):
            payload[model["id"]] = entry["days"][-HISTORY_DAYS:]
    return payload


def _read_json(path: Path) -> dict[str, Any]:
    try:
        if path.is_file():
            value = json.loads(path.read_text(encoding="utf-8"))
            return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        pass
    return {}


def _write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.name}.tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    temporary.replace(path)


class TokenPriceService:
    """Fetch, normalize, and persist token list prices and daily candles."""

    def __init__(
        self,
        data_dir: Path,
        *,
        fetcher: Callable[[], dict[str, Any]] | None = None,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        self.data_dir = Path(data_dir)
        self.cache_path = self.data_dir / _CACHE_FILE
        self.history_path = self.data_dir / _HISTORY_FILE
        self._fetcher = fetcher or _fetch_catalog
        self._now = now or (lambda: datetime.now(timezone.utc))

    def refresh(self, force: bool = False) -> dict[str, Any]:
        with _LOCK:
            now = self._now().astimezone(timezone.utc)
            today = now.date()
            cache = _read_json(self.cache_path)
            history = _read_json(self.history_path)
            fetched_at = str(cache.get("fetched_at") or "")
            models = cache.get("models") if isinstance(cache.get("models"), list) else []
            age = _cache_age_seconds(fetched_at, now)
            status = "cached"
            error = ""

            if force or not models or age > CACHE_TTL_SECONDS:
                try:
                    catalog = self._fetcher()
                    fresh_models = _resolve_models(catalog)
                    if not fresh_models:
                        raise ValueError("no supported models returned by the catalog")
                    models = fresh_models
                    fetched_at = now.isoformat(timespec="seconds")
                    cache = {
                        "version": 1,
                        "fetched_at": fetched_at,
                        "source": SOURCE_NAME,
                        "source_url": SOURCE_URL,
                        "models": models,
                    }
                    _write_json(self.cache_path, cache)
                    status = "ok"
                except (OSError, ValueError, urllib.error.URLError) as exc:
                    error = str(exc) or exc.__class__.__name__
                    if not models:
                        return {
                            "ok": False,
                            "status": "error",
                            "message": f"Token 价格源暂时不可用：{error}",
                            "models": [],
                            "history": {},
                            "source": SOURCE_NAME,
                            "source_url": SOURCE_URL,
                            "fetched_at": "",
                            "history_meta": _history_meta({}, True),
                        }
                    status = "stale"

            history = _update_history(models, history, today)
            _write_json(self.history_path, history)
            snapshot = {
                "ok": True,
                "status": status,
                "message": "" if not error else f"使用上次价格缓存：{error}",
                "source": SOURCE_NAME,
                "source_url": SOURCE_URL,
                "currency": "USD",
                "unit": "1M tokens",
                "fetched_at": fetched_at,
                "checked_at": now.isoformat(timespec="seconds"),
                "models": models,
                "history": _history_payload(history, models),
                "history_meta": _history_meta(history, False),
                "time_note": "目录价按 USD / 1M tokens；价格只在厂商调价时变化，60 秒轮询不是交易所逐笔行情。",
            }
            return snapshot


def _cache_age_seconds(value: str, now: datetime) -> float:
    try:
        fetched = datetime.fromisoformat(value)
        if fetched.tzinfo is None:
            fetched = fetched.replace(tzinfo=timezone.utc)
        return max(0.0, (now - fetched.astimezone(timezone.utc)).total_seconds())
    except (TypeError, ValueError):
        return float("inf")


def _history_meta(history: dict[str, Any], empty: bool) -> dict[str, Any]:
    models = history.get("models") if isinstance(history.get("models"), dict) else {}
    days = 0
    baseline = False
    for entry in models.values():
        if not isinstance(entry, dict) or not isinstance(entry.get("days"), list):
            continue
        days = max(days, len(entry["days"]))
        baseline = baseline or any(bool(item.get("baseline")) for item in entry["days"] if isinstance(item, dict))
    return {
        "days": days,
        "baseline": baseline or empty,
        "note": (
            "首次采集会用当前公开目录价回填 30 日基线；之后每次刷新记录当日开高低收。"
            "调价后会出现真实 K 线变化；请把平线理解为目录价未变，而不是行情缺失。"
        ),
    }


__all__ = [
    "HISTORY_DAYS",
    "MODELS_DEV_URL",
    "PROVIDERS",
    "SOURCE_NAME",
    "SOURCE_URL",
    "TokenPriceService",
]
