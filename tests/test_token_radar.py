from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from token_radar import TokenPriceService


def _catalog(openai_input: float = 4.0, deepseek_input: float = 0.66) -> dict:
    return {
        "openai": {
            "id": "openai",
            "name": "OpenAI",
            "models": {
                "gpt-5.6": {
                    "name": "GPT-5.6",
                    "release_date": "2026-01-01",
                    "limit": {"context": 1_050_000, "output": 128_000},
                    "cost": {
                        "input": openai_input,
                        "output": 20.0,
                        "cache_read": 0.4,
                        "tiers": [{"input": 8.0, "output": 30.0, "tier": {"type": "context", "size": 272_000}}],
                    },
                },
                "gpt-6-luna": {
                    "name": "GPT-6 Luna",
                    "release_date": "2026-09-22",
                    "limit": {"context": 1_050_000},
                    "cost": {"input": 0.1, "output": 0.5, "cache_read": 0.01},
                },
            },
        },
        "deepseek": {
            "id": "deepseek",
            "name": "DeepSeek",
            "models": {
                "deepseek-v4-pro": {
                    "name": "DeepSeek V4 Pro",
                    "release_date": "2026-08-13",
                    "limit": {"context": 1_048_576},
                    "cost": {"input": deepseek_input, "output": 1.98, "cache_read": 0.022},
                }
            },
        },
    }


def _service(tmp_path: Path, catalogue: dict, now: datetime) -> TokenPriceService:
    return TokenPriceService(
        tmp_path,
        fetcher=lambda: catalogue,
        now=lambda: now,
    )


def test_token_snapshot_has_models_history_and_deepseek_window(tmp_path: Path) -> None:
    now = datetime(2026, 11, 10, 8, 0, tzinfo=timezone.utc)
    service = _service(tmp_path, _catalog(), now)

    snapshot = service.refresh()

    assert snapshot["ok"] is True
    assert snapshot["status"] == "ok"
    assert len(snapshot["models"]) == 3
    assert snapshot["currency"] == "USD"
    assert snapshot["unit"] == "1M tokens"
    assert len(snapshot["history"]["deepseek/deepseek-v4-pro"]) == 30
    assert snapshot["history_meta"]["days"] == 30
    assert snapshot["history_meta"]["baseline"] is True

    model = next(item for item in snapshot["models"] if item["id"] == "deepseek/deepseek-v4-pro")
    policy = model["time_policy"]
    assert policy["kind"] == "deepseek_peak"
    assert policy["off_peak_input"] == 0.33
    assert policy["peak_windows_utc"][0] == {"start": "01:00", "end": "04:00"}
    assert model["cache_discount"] > 0

    latest = snapshot["history"][model["id"]][-1]
    assert latest["date"] == "2026-11-10"
    assert latest["samples"] == 1
    assert latest["baseline"] is False
    assert latest["close"] == 0.66


def test_price_change_folds_into_today_candle(tmp_path: Path) -> None:
    now = datetime(2026, 11, 10, 8, 0, tzinfo=timezone.utc)
    service = _service(tmp_path, _catalog(openai_input=4.0), now)
    service.refresh(force=True)

    changed = _service(tmp_path, _catalog(openai_input=6.0), now)
    snapshot = changed.refresh(force=True)

    candle = snapshot["history"]["openai/gpt-5.6"][-1]
    assert candle["open"] == 4.0
    assert candle["high"] == 6.0
    assert candle["low"] == 4.0
    assert candle["close"] == 6.0
    assert candle["samples"] == 2
    assert candle["baseline"] is False


def test_stale_cache_is_kept_when_fetch_fails(tmp_path: Path) -> None:
    now = datetime(2026, 11, 10, 8, 0, tzinfo=timezone.utc)
    service = _service(tmp_path, _catalog(), now)
    first = service.refresh(force=True)
    assert first["status"] == "ok"

    def fail() -> dict:
        raise ValueError("catalog offline")

    broken = TokenPriceService(tmp_path, fetcher=fail, now=lambda: now)
    snapshot = broken.refresh(force=True)

    assert snapshot["ok"] is True
    assert snapshot["status"] == "stale"
    assert snapshot["models"]
    assert "catalog offline" in snapshot["message"]
    assert snapshot["history"]["openai/gpt-5.6"]


def test_tier_and_cache_values_are_exposed(tmp_path: Path) -> None:
    now = datetime(2026, 11, 10, 8, 0, tzinfo=timezone.utc)
    snapshot = _service(tmp_path, _catalog(), now).refresh(force=True)
    model = next(item for item in snapshot["models"] if item["id"] == "openai/gpt-5.6")
    assert model["tier"] == {"threshold": 272_000, "input": 8.0, "output": 30.0}
    assert model["cache_read"] == 0.4
    assert model["cache_discount"] == 0.9
    assert model["context"] == 1_050_000
