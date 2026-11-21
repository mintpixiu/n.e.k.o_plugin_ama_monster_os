"""Bundled cook-recipe catalog for the Ama Monster OS food room.

The catalog is an offline snapshot of the open-source 食用手册
(https://github.com/YunYouJun/cook) dataset: recipe names, required
ingredients, cookware, difficulty, tags, methods, and Bilibili / source links.
Matching mirrors the upstream recommender's three modes:

* ``loose`` (模糊) — the recipe needs at least one selected ingredient and may
  miss up to two unselected ingredients;
* ``strict`` (严格) — every selected ingredient must appear in the recipe;
* ``survival`` (生存) — the recipe may only use selected ingredients.

Catch-all recipes (10+ ingredients, like hot pot) are treated as optional
suggestions: they need at least two matched ingredients.
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any, Iterable

CATALOG_PATH = Path(__file__).with_name("cook_recipes.json")
CATCH_ALL_MIN_STUFF = 10
CATCH_ALL_MIN_MATCH = 2
MODES = ("loose", "strict", "survival")
MODE_LABELS = {"loose": "模糊", "strict": "严格", "survival": "生存"}
RESULT_LIMIT = 160

_EMPTY = {
    "schema_version": "1.0",
    "source": "",
    "source_name": "食用手册",
    "author": "",
    "updated": "",
    "recipe_count": 0,
    "foods": {"vegetable": [], "meat": [], "staple": []},
    "tools": [],
    "recipes": [],
}


def _load_catalog() -> dict[str, Any]:
    try:
        payload = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return dict(_EMPTY)
    if not isinstance(payload, dict):
        return dict(_EMPTY)
    recipes = payload.get("recipes")
    if not isinstance(recipes, list) or not recipes:
        return dict(_EMPTY)
    foods = payload.get("foods") if isinstance(payload.get("foods"), dict) else {}
    result = dict(_EMPTY)
    result.update(payload)
    result["foods"] = {
        "vegetable": list(foods.get("vegetable") or []),
        "meat": list(foods.get("meat") or []),
        "staple": list(foods.get("staple") or []),
    }
    result["tools"] = [str(item) for item in (payload.get("tools") or []) if str(item)]
    result["recipes"] = [dict(recipe) for recipe in recipes if isinstance(recipe, dict)]
    return result


CATALOG = _load_catalog()
RECIPES: tuple[dict[str, Any], ...] = tuple(CATALOG["recipes"])
FOOD_SECTIONS: dict[str, list[dict[str, Any]]] = CATALOG["foods"]
TOOLS: tuple[str, ...] = tuple(CATALOG["tools"])
_REQUIRED: tuple[list[str], ...] = tuple(list(recipe.get("stuff") or []) for recipe in RECIPES)


def cook_payload() -> dict[str, Any]:
    """Return the small catalog metadata that travels inside the snapshot."""

    foods: dict[str, list[dict[str, Any]]] = {}
    for key in ("vegetable", "meat", "staple"):
        entries: list[dict[str, Any]] = []
        for item in FOOD_SECTIONS.get(key, []):
            name = str(item.get("name") or "")
            if not name:
                continue
            entry: dict[str, Any] = {"name": name, "emoji": str(item.get("emoji") or "")}
            if item.get("more"):
                entry["more"] = True
            entries.append(entry)
        foods[key] = entries
    return {
        "recipe_count": len(RECIPES),
        "source": CATALOG.get("source", ""),
        "source_name": CATALOG.get("source_name", "食用手册"),
        "author": CATALOG.get("author", ""),
        "updated": CATALOG.get("updated", ""),
        "modes": [{"id": mode, "label": MODE_LABELS[mode]} for mode in MODES],
        "foods": foods,
        "tools": list(TOOLS),
    }


def _normalize_selection(values: Iterable[Any] | str | None) -> set[str]:
    if values is None:
        return set()
    if isinstance(values, str):
        values = [values]
    return {str(item).strip() for item in values if str(item).strip()}


def _recipe_view(
    recipe: dict[str, Any],
    matched: list[str],
    missing: list[str],
    catch_all: bool,
) -> dict[str, Any]:
    return {
        "id": recipe.get("id"),
        "name": str(recipe.get("name") or ""),
        "stuff": list(recipe.get("stuff") or []),
        "tools": list(recipe.get("tools") or []),
        "difficulty": str(recipe.get("difficulty") or ""),
        "tags": list(recipe.get("tags") or []),
        "methods": list(recipe.get("methods") or []),
        "url": str(recipe.get("url") or ""),
        "video": bool(recipe.get("video")),
        "matched": matched,
        "missing": missing,
        "optional": list(missing) if catch_all else [],
        "catch_all": catch_all,
    }


def search_recipes(
    foods: Iterable[Any] | str | None,
    tool: str = "",
    mode: str = "loose",
    limit: int = RESULT_LIMIT,
) -> dict[str, Any]:
    """Return recipes that fit the selected ingredients, tool, and mode."""

    selected = _normalize_selection(foods)
    tool_name = str(tool or "").strip()
    wanted_mode = str(mode or "loose").strip()
    if wanted_mode not in MODES:
        wanted_mode = "loose"
    if not selected:
        return {
            "ok": True,
            "count": 0,
            "returned": 0,
            "mode": wanted_mode,
            "tool": tool_name,
            "results": [],
            "error": "empty_selection",
        }

    max_results = max(1, min(200, int(limit or RESULT_LIMIT)))
    matches: list[tuple[int, int, int, int, dict[str, Any]]] = []
    for index, recipe in enumerate(RECIPES):
        required = _REQUIRED[index]
        if tool_name and tool_name not in (recipe.get("tools") or []):
            continue
        catch_all = len(required) >= CATCH_ALL_MIN_STUFF
        matched = [item for item in required if item in selected]
        missing = [item for item in required if item not in selected]
        if not matched:
            continue
        if not catch_all and len(missing) > 2:
            continue
        if catch_all and len(matched) < CATCH_ALL_MIN_MATCH:
            continue
        if wanted_mode == "strict" and not selected.issubset(required):
            continue
        if wanted_mode == "survival" and missing:
            continue
        matches.append((
            len(missing),
            int(catch_all),
            -len(matched),
            index,
            _recipe_view(recipe, matched, missing, catch_all),
        ))

    matches.sort(key=lambda item: item[:4])
    results = [item[4] for item in matches[:max_results]]
    return {
        "ok": True,
        "count": len(matches),
        "returned": len(results),
        "mode": wanted_mode,
        "tool": tool_name,
        "results": results,
    }


def random_recipe(rng: random.Random | None = None) -> dict[str, Any]:
    """Return one random recipe from the whole catalog."""

    if not RECIPES:
        return {"ok": False, "error": "empty_catalog", "recipe": None}
    picker = rng if rng is not None else random.SystemRandom()
    recipe = picker.choice(RECIPES)
    required = list(recipe.get("stuff") or [])
    return {
        "ok": True,
        "recipe": _recipe_view(recipe, required, [], len(required) >= CATCH_ALL_MIN_STUFF),
        "mode": "random",
    }


__all__ = [
    "CATALOG",
    "CATCH_ALL_MIN_MATCH",
    "CATCH_ALL_MIN_STUFF",
    "MODES",
    "MODE_LABELS",
    "RECIPES",
    "RESULT_LIMIT",
    "TOOLS",
    "cook_payload",
    "random_recipe",
    "search_recipes",
]
