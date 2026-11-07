"""Steam sale calendar for Ama Monster OS.

Dates come from Valve's Steamworks "Upcoming Steam Events" documentation,
captured 2026-11-07. Seasonal start/end times are 10:00 Pacific; themed-event
times are inferred from Valve's usual 10:00 Pacific start and are marked as not
confirmed. Valve can change dates; keep this file versioned with the plugin.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

SALE_CALENDAR_UPDATED = "2026-11-07"
SALE_SOURCE_URL = "https://partner.steamgames.com/doc/marketing/upcoming_events"
SALE_TIMEZONE = "America/Los_Angeles"

EVENTS: tuple[dict[str, Any], ...] = (
    {
        "id": "auto_battler_rpg_2026",
        "kind": "themed",
        "name": "Steam Auto-Battler RPG Fest 2026",
        "start_at": "2026-11-16T18:00:00Z",
        "end_at": "2026-11-23T18:00:00Z",
        "time_confirmed": False,
        "tbd": False,
    },
    {
        "id": "winter_2026",
        "kind": "seasonal",
        "name": "Steam Winter Sale 2026",
        "start_at": "2026-12-17T18:00:00Z",
        "end_at": "2027-01-04T18:00:00Z",
        "time_confirmed": True,
        "tbd": False,
    },
    {
        "id": "spring_2027",
        "kind": "seasonal",
        "name": "Steam Spring Sale 2027",
        "start_at": "2027-03-18T17:00:00Z",
        "end_at": "2027-03-25T17:00:00Z",
        "time_confirmed": False,
        "tbd": False,
    },
    {
        "id": "summer_2027",
        "kind": "seasonal",
        "name": "Steam Summer Sale 2027",
        "start_at": "2027-06-24T17:00:00Z",
        "end_at": "2027-07-08T17:00:00Z",
        "time_confirmed": False,
        "tbd": False,
    },
    {
        "id": "autumn_2027",
        "kind": "seasonal",
        "name": "Steam Autumn Sale 2027",
        "start_at": None,
        "end_at": None,
        "time_confirmed": False,
        "tbd": True,
    },
)


def _parse(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def _event_view(event: dict[str, Any], now: datetime) -> dict[str, Any]:
    start = _parse(event.get("start_at"))
    end = _parse(event.get("end_at"))
    status = "tbd"
    starts_in = None
    ends_in = None
    if start is not None and end is not None:
        if now < start:
            status = "upcoming"
            starts_in = max(0, int((start - now).total_seconds()))
        elif start <= now <= end:
            status = "active"
            ends_in = max(0, int((end - now).total_seconds()))
        else:
            status = "ended"
    return {
        **event,
        "status": status,
        "starts_in_seconds": starts_in,
        "ends_in_seconds": ends_in,
    }


def evaluate_sales(now: datetime | None = None) -> dict[str, Any]:
    """Return current, next, next-seasonal, and the upcoming calendar."""

    current_time = now.astimezone(timezone.utc) if now is not None else datetime.now(timezone.utc)
    events = [_event_view(dict(event), current_time) for event in EVENTS]
    dated = [event for event in events if not event["tbd"] and event.get("start_at")]
    dated.sort(key=lambda event: event["start_at"] or "")
    upcoming = [event for event in dated if event["status"] == "upcoming"]
    active = [event for event in dated if event["status"] == "active"]
    seasonal_upcoming = [event for event in upcoming if event["kind"] == "seasonal"]
    current = active[0] if active else None
    next_event = upcoming[0] if upcoming else None
    next_seasonal = seasonal_upcoming[0] if seasonal_upcoming else None
    return {
        "updated": SALE_CALENDAR_UPDATED,
        "source": "Steamworks",
        "source_url": SALE_SOURCE_URL,
        "timezone": SALE_TIMEZONE,
        "time_confirmed_for_next": bool(next_event and next_event.get("time_confirmed")),
        "current": current,
        "next": next_event,
        "next_seasonal": next_seasonal,
        "upcoming": upcoming[:6],
        "all": events,
        "evaluated_at": current_time.isoformat().replace("+00:00", "Z"),
    }


__all__ = [
    "EVENTS",
    "SALE_CALENDAR_UPDATED",
    "SALE_SOURCE_URL",
    "SALE_TIMEZONE",
    "evaluate_sales",
]
