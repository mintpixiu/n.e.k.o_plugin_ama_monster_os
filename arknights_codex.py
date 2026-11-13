"""Local Arknights operator codex for the Ama Monster OS window.

This is a hand-curated **offline reference**: operator names, class, rarity,
faction and race are factual fields, while every description is generic text
derived from the class. No official artwork, voice lines, story text or wiki
copy is bundled, and nothing is downloaded at runtime.

Data is a versioned snapshot; the official game remains the source of truth.
"""

from __future__ import annotations

from typing import Any, Iterable, Mapping

CODEX_VERSION = "2026.11"
CODEX_UPDATED = "2026-11-13"
CODEX_DISCLAIMER = (
    "本地整理的入门档案，只含职业、星级、阵营等公开设定，不含官方立绘、"
    "语音与剧情文本；以游戏内与官方资料为准。"
)

CLASSES: tuple[str, ...] = ("先锋", "近卫", "重装", "狙击", "术师", "医疗", "辅助", "特种")

CLASS_COLORS: dict[str, str] = {
    "先锋": "#e0685f",
    "近卫": "#4a90d9",
    "重装": "#45a89c",
    "狙击": "#7cb45a",
    "术师": "#cf79bb",
    "医疗": "#8cc44d",
    "辅助": "#9a7ed6",
    "特种": "#b58b5a",
}

CLASS_ROLE: dict[str, str] = {
    "先锋": "开场部署与费用回复，抢占前期节奏。",
    "近卫": "近战输出，负责正面压制与拦截。",
    "重装": "前线承伤，阻挡与保护队友。",
    "狙击": "远程物理输出，优先处理飞行与轻甲目标。",
    "术师": "法术输出，擅长处理高防御目标。",
    "医疗": "治疗与支援，维持队伍血线。",
    "辅助": "增益、控制与战场调度。",
    "特种": "位移、控制与特殊机制。",
}

# id, 中文名, English name, class, rarity, faction, race (optional), tags
_RAW: tuple[tuple[str, str, str, str, int, str, str, tuple[str, ...]], ...] = (
    ("silverash", "银灰", "SilverAsh", "近卫", 6, "喀兰贸易", "菲林", ("领主", "近卫", "喀兰")),
    ("exusiai", "能天使", "Exusiai", "狙击", 6, "企鹅物流", "萨科塔", ("速射", "狙击", "企鹅物流")),
    ("saria", "塞雷娅", "Saria", "重装", 6, "莱茵生命", "瓦伊凡", ("守护者", "重装", "莱茵")),
    ("eyjafjalla", "艾雅法拉", "Eyjafjalla", "术师", 6, "罗德岛", "卡普里尼", ("群攻", "术师", "火山")),
    ("chen", "陈", "Ch'en", "近卫", 6, "龙门近卫局", "龙", ("剑豪", "近卫", "龙门")),
    ("skadi", "斯卡蒂", "Skadi", "近卫", 6, "深海猎人", "阿戈尔", ("无畏者", "近卫", "深海")),
    ("schwarz", "黑", "Schwarz", "狙击", 6, "罗德岛", "菲林", ("重射手", "狙击", "汐斯塔")),
    ("bagpipe", "风笛", "Bagpipe", "先锋", 6, "维多利亚", "瓦伊凡", ("冲锋手", "先锋", "维多利亚")),
    ("surtr", "史尔特尔", "Surtr", "近卫", 6, "罗德岛", "", ("术战者", "近卫", "黄昏")),
    ("mudrock", "泥岩", "Mudrock", "重装", 6, "罗德岛", "萨卡兹", ("不屈者", "重装", "萨卡兹")),
    ("kaltsit", "凯尔希", "Kal'tsit", "医疗", 6, "罗德岛", "菲林", ("医师", "医疗", "罗德岛")),
    ("w", "W", "W", "狙击", 6, "罗德岛", "萨卡兹", ("炮手", "狙击", "爆破")),
    ("rosmontis", "迷迭香", "Rosmontis", "狙击", 6, "罗德岛", "菲林", ("投掷手", "狙击", "罗德岛")),
    ("nearl_radiant", "耀骑士临光", "Nearl the Radiant Knight", "近卫", 6, "使徒", "库兰塔", ("无畏者", "近卫", "卡西米尔")),
    ("ling", "令", "Ling", "辅助", 6, "岁", "龙", ("召唤师", "辅助", "岁")),
    ("texas_omertosa", "缄默德克萨斯", "Texas the Omertosa", "特种", 6, "企鹅物流", "鲁珀", ("处决者", "特种", "企鹅物流")),
    ("mlynar", "玛恩纳", "Młynar", "近卫", 6, "卡西米尔", "库兰塔", ("解放者", "近卫", "卡西米尔")),
    ("goldenglow", "澄闪", "Goldenglow", "术师", 6, "维多利亚", "菲林", ("驭械术师", "术师", "维多利亚")),
    ("pozyomka", "鸿雪", "Pozyomka", "狙击", 6, "乌萨斯", "乌萨斯", ("猎手", "狙击", "乌萨斯")),
    ("penance", "斥罪", "Penance", "重装", 6, "叙拉古", "鲁珀", ("不屈者", "重装", "叙拉古")),
    ("gavial_invincible", "百炼嘉维尔", "Gavial the Invincible", "近卫", 6, "罗德岛", "阿达克利斯", ("强攻手", "近卫", "萨尔贡")),
    ("ebenholz", "黑键", "Ebenholz", "术师", 6, "莱塔尼亚", "卡普里尼", ("秘术师", "术师", "莱塔尼亚")),
    ("reed_alter", "焰影苇草", "Reed the Flame Shadow", "术师", 6, "维多利亚", "德拉克", ("咒愈师", "术师", "维多利亚")),
    ("amiya", "阿米娅", "Amiya", "术师", 5, "罗德岛", "卡特斯", ("核心", "术师", "罗德岛")),
    ("lappland", "拉普兰德", "Lappland", "近卫", 5, "叙拉古", "鲁珀", ("领主", "近卫", "叙拉古")),
    ("blue_poison", "蓝毒", "Blue Poison", "狙击", 5, "罗德岛", "安努拉", ("速射", "狙击", "毒素")),
    ("platinum", "白金", "Platinum", "狙击", 5, "卡西米尔", "库兰塔", ("速射", "狙击", "卡西米尔")),
    ("ptilopsis", "白面鸮", "Ptilopsis", "医疗", 5, "莱茵生命", "黎博利", ("群愈师", "医疗", "莱茵")),
    ("warfarin", "华法琳", "Warfarin", "医疗", 5, "罗德岛", "萨卡兹", ("医师", "医疗", "血液")),
    ("specter", "幽灵鲨", "Specter", "近卫", 5, "深海猎人", "阿戈尔", ("群卫", "近卫", "深海")),
    ("nearl", "临光", "Nearl", "重装", 5, "使徒", "库兰塔", ("守护者", "重装", "卡西米尔")),
    ("meteorite", "陨星", "Meteorite", "狙击", 5, "罗德岛", "萨科塔", ("炮手", "狙击", "萨科塔")),
    ("texas", "德克萨斯", "Texas", "先锋", 5, "企鹅物流", "鲁珀", ("尖兵", "先锋", "企鹅物流")),
    ("zima", "凛冬", "Zima", "先锋", 5, "乌萨斯学生自治团", "乌萨斯", ("尖兵", "先锋", "乌萨斯")),
    ("silence", "赫默", "Silence", "医疗", 5, "莱茵生命", "黎博利", ("医师", "医疗", "莱茵")),
    ("croissant", "可颂", "Croissant", "重装", 5, "企鹅物流", "丰蹄", ("守护者", "重装", "企鹅物流")),
    ("liskarm", "雷蛇", "Liskarm", "重装", 5, "黑钢国际", "瓦伊凡", ("守护者", "重装", "黑钢")),
    ("franka", "芙兰卡", "Franka", "近卫", 5, "黑钢国际", "沃尔珀", ("剑圣", "近卫", "黑钢")),
    ("indra", "因陀罗", "Indra", "近卫", 5, "格拉斯哥帮", "菲林", ("斗士", "近卫", "格拉斯哥")),
    ("firewatch", "守林人", "Firewatch", "狙击", 5, "罗德岛", "黎博利", ("神射手", "狙击", "守林")),
    ("provence", "普罗旺斯", "Provence", "狙击", 5, "罗德岛", "鲁珀", ("重射手", "狙击", "叙拉古")),
    ("astesia", "星极", "Astesia", "近卫", 5, "罗德岛", "黎博利", ("剑豪", "近卫", "占星")),
    ("manticore", "狮蝎", "Manticore", "特种", 5, "萨尔贡", "曼提柯", ("伏击客", "特种", "萨尔贡")),
    ("feater", "食铁兽", "FEater", "特种", 5, "龙门", "乌萨斯", ("推击手", "特种", "龙门")),
    ("shamare", "巫恋", "Shamare", "辅助", 5, "叙拉古", "沃尔珀", ("削弱者", "辅助", "叙拉古")),
    ("leizi", "惊蛰", "Leizi", "术师", 5, "炎", "麒麟", ("链术师", "术师", "炎")),
    ("greythroat", "灰喉", "GreyThroat", "狙击", 5, "罗德岛", "黎博利", ("速射", "狙击", "罗德岛")),
    ("broca", "布洛卡", "Broca", "近卫", 5, "叙拉古", "鲁珀", ("强攻手", "近卫", "叙拉古")),
    ("archetto", "空弦", "Archetto", "狙击", 5, "拉特兰", "萨科塔", ("速射", "狙击", "拉特兰")),
    ("courier", "讯使", "Courier", "先锋", 4, "喀兰贸易", "菲林", ("尖兵", "先锋", "喀兰")),
    ("myrrh", "末药", "Myrrh", "医疗", 4, "罗德岛", "菲林", ("医师", "医疗", "罗德岛")),
    ("perfumer", "调香师", "Perfumer", "医疗", 4, "罗德岛", "菲林", ("群愈师", "医疗", "罗德岛")),
    ("gitano", "远山", "Gitano", "术师", 4, "叙拉古", "卡普里尼", ("群攻", "术师", "占卜")),
    ("cuora", "蛇屠箱", "Cuora", "重装", 4, "罗德岛", "匹特拉姆", ("守护者", "重装", "罗德岛")),
    ("jessica", "杰西卡", "Jessica", "狙击", 4, "黑钢国际", "菲林", ("速射", "狙击", "黑钢")),
    ("meteor", "流星", "Meteor", "狙击", 4, "罗德岛", "库兰塔", ("速射", "狙击", "罗德岛")),
    ("shirayuki", "白雪", "Shirayuki", "狙击", 4, "罗德岛", "菲林", ("炮手", "狙击", "东")),
    ("gravel", "砾", "Gravel", "特种", 4, "卡西米尔", "扎拉克", ("处决者", "特种", "卡西米尔")),
    ("rope", "崖心", "Rope", "特种", 4, "莱茵生命", "菲林", ("钩索师", "特种", "莱茵")),
    ("mousse", "慕斯", "Mousse", "近卫", 4, "维多利亚", "菲林", ("术战者", "近卫", "维多利亚")),
    ("utage", "宴", "Utage", "近卫", 4, "东", "菲林", ("武者", "近卫", "东")),
    ("podenco", "波登可", "Podenco", "辅助", 4, "罗德岛", "佩洛", ("护佑者", "辅助", "罗德岛")),
    ("may", "梅", "May", "狙击", 4, "拉特兰", "萨科塔", ("速射", "狙击", "拉特兰")),
    ("cutter", "刻刀", "Cutter", "近卫", 4, "罗德岛", "菲林", ("剑豪", "近卫", "罗德岛")),
    ("ambriel", "安比尔", "Ambriel", "狙击", 4, "拉特兰", "萨科塔", ("神射手", "狙击", "拉特兰")),
    ("pinecone", "松果", "Pinecone", "狙击", 4, "哥伦比亚", "菲林", ("散射手", "狙击", "哥伦比亚")),
    ("fang", "芬", "Fang", "先锋", 3, "罗德岛", "库兰塔", ("尖兵", "先锋", "罗德岛")),
    ("kroos", "克洛丝", "Kroos", "狙击", 3, "罗德岛", "卡特斯", ("速射", "狙击", "罗德岛")),
    ("melantha", "玫兰莎", "Melantha", "近卫", 3, "罗德岛", "菲林", ("剑圣", "近卫", "罗德岛")),
    ("lava", "炎熔", "Lava", "术师", 3, "罗德岛", "萨卡兹", ("群攻", "术师", "罗德岛")),
    ("hibiscus", "芙蓉", "Hibiscus", "医疗", 3, "罗德岛", "萨卡兹", ("医师", "医疗", "罗德岛")),
    ("ansel", "安赛尔", "Ansel", "医疗", 3, "罗德岛", "菲林", ("医师", "医疗", "罗德岛")),
    ("vanilla", "香草", "Vanilla", "先锋", 3, "罗德岛", "沃尔珀", ("尖兵", "先锋", "罗德岛")),
    ("plume", "翎羽", "Plume", "先锋", 3, "罗德岛", "黎博利", ("尖兵", "先锋", "罗德岛")),
    ("catapult", "空爆", "Catapult", "狙击", 3, "罗德岛", "萨科塔", ("炮手", "狙击", "罗德岛")),
    ("midnight", "月见夜", "Midnight", "近卫", 3, "罗德岛", "萨卡兹", ("领主", "近卫", "罗德岛")),
    ("orchid", "梓兰", "Orchid", "辅助", 3, "罗德岛", "菲林", ("减速者", "辅助", "罗德岛")),
    ("steward", "史都华德", "Steward", "术师", 3, "罗德岛", "菲林", ("秘术师", "术师", "罗德岛")),
    ("adnachiel", "安德切尔", "Adnachiel", "狙击", 3, "罗德岛", "萨科塔", ("速射", "狙击", "罗德岛")),
    ("spot", "卡缇", "Spot", "重装", 3, "罗德岛", "菲林", ("守护者", "重装", "罗德岛")),
    ("popukar", "泡普卡", "Popukar", "近卫", 3, "罗德岛", "乌萨斯", ("强攻手", "近卫", "罗德岛")),
)

OPERATORS: tuple[dict[str, Any], ...] = tuple(
    {
        "id": slug,
        "name_cn": name_cn,
        "name_en": name_en,
        "class": operator_class,
        "rarity": rarity,
        "faction": faction,
        "race": race,
        "tags": list(tags),
        "role": CLASS_ROLE[operator_class],
        "class_color": CLASS_COLORS[operator_class],
        "initial": name_cn[:1],
    }
    for slug, name_cn, name_en, operator_class, rarity, faction, race, tags in _RAW
)


def _matches(operator: Mapping[str, Any], query: str) -> bool:
    if not query:
        return True
    needle = query.casefold()
    haystack = " ".join(
        str(operator.get(field) or "")
        for field in ("name_cn", "name_en", "class", "faction", "race")
    ).casefold()
    if needle in haystack:
        return True
    return any(needle in str(tag).casefold() for tag in operator.get("tags") or [])


def filter_operators(
    query: str = "",
    classes: Iterable[str] | None = None,
    rarities: Iterable[int] | None = None,
    max_results: int = 120,
) -> list[dict[str, Any]]:
    """Return codex entries matching a text query, class and rarity filters."""

    text = str(query or "").strip()[:40]
    class_filter = {item for item in (classes or ()) if item in CLASSES}
    rarity_filter = {int(item) for item in (rarities or ()) if str(item).isdigit()}
    results: list[dict[str, Any]] = []
    for operator in OPERATORS:
        if class_filter and operator["class"] not in class_filter:
            continue
        if rarity_filter and operator["rarity"] not in rarity_filter:
            continue
        if not _matches(operator, text):
            continue
        results.append(dict(operator))
        if len(results) >= max(1, min(int(max_results or 120), 200)):
            break
    return results


def codex_summary() -> dict[str, Any]:
    """Counts used by the window header and the plugin snapshot."""

    by_class = {name: 0 for name in CLASSES}
    by_rarity: dict[str, int] = {}
    factions: set[str] = set()
    for operator in OPERATORS:
        by_class[operator["class"]] += 1
        key = str(operator["rarity"])
        by_rarity[key] = by_rarity.get(key, 0) + 1
        factions.add(str(operator["faction"]))
    return {
        "version": CODEX_VERSION,
        "updated": CODEX_UPDATED,
        "total": len(OPERATORS),
        "classes": by_class,
        "rarities": by_rarity,
        "factions": sorted(factions),
        "disclaimer": CODEX_DISCLAIMER,
        "class_colors": dict(CLASS_COLORS),
    }


def codex_payload(
    query: str = "",
    classes: Iterable[str] | None = None,
    rarities: Iterable[int] | None = None,
    max_results: int = 120,
) -> dict[str, Any]:
    results = filter_operators(query, classes, rarities, max_results)
    return {
        "ok": True,
        "query": str(query or "")[:40],
        "count": len(results),
        "results": results,
        "summary": codex_summary(),
        "tools": [dict(item) for item in TOOLS],
        "disclaimer": CODEX_DISCLAIMER,
        "updated": CODEX_UPDATED,
    }


# A deliberately small, clearly partial skin sample. Full skin lists live on the
# official wiki; the window links out instead of bundling artwork.
SKINS: dict[str, tuple[dict[str, str], ...]] = {
    "amiya": (
        {"name": "报童", "series": "罗德岛", "release": "2019", "obtain": "活动获取"},
    ),
    "silverash": (
        {"name": "约克的寒风", "series": "时代", "release": "2020", "obtain": "采购凭证"},
    ),
    "chen": (
        {"name": "岁红霞", "series": "岁岁平安", "release": "2020", "obtain": "采购凭证"},
    ),
    "texas": (
        {"name": "寒冬信使", "series": "寒武纪", "release": "2020", "obtain": "采购凭证"},
    ),
    "saria": (
        {"name": "铁律", "series": "斗争血脉", "release": "2020", "obtain": "采购凭证"},
    ),
    "skadi": (
        {"name": "静谧海流", "series": "珊瑚海岸", "release": "2020", "obtain": "采购凭证"},
    ),
}

SKIN_NOTE = "本地只收录少量示例皮肤，完整皮肤与立绘请查看 PRTS 或游戏内干员档案。"

# Curated helper tools. Every entry is an external link opened in the browser;
# nothing is bundled or downloaded by the plugin.
TOOLS: tuple[dict[str, Any], ...] = (
    {
        "id": "prts",
        "name": "PRTS 明日方舟 Wiki",
        "kind": "wiki",
        "url": "https://prts.wiki/",
        "note": "最全的中文资料站：干员、皮肤、剧情、活动、材料掉率。",
        "download": False,
    },
    {
        "id": "skland",
        "name": "森空岛（官方社区）",
        "kind": "official",
        "url": "https://www.skland.com/",
        "note": "鹰角官方社区，含官方资讯、干员资料与客户端下载入口。",
        "download": True,
    },
    {
        "id": "official",
        "name": "明日方舟官网",
        "kind": "official",
        "url": "https://ak.hypergryph.com/",
        "note": "官方公告与 PC / Android / iOS 客户端下载渠道。",
        "download": True,
    },
    {
        "id": "arkntools",
        "name": "Arkntools 工具箱",
        "kind": "tool",
        "url": "https://arkntools.app/",
        "note": "开源的养成规划、材料计算与抽卡统计工具。",
        "download": False,
    },
    {
        "id": "penguin",
        "name": "企鹅物流数据统计",
        "kind": "data",
        "url": "https://penguin-stats.io/",
        "note": "社区掉率统计，查材料去哪刷最省理智。",
        "download": False,
    },
    {
        "id": "fandom",
        "name": "Arknights Wiki (EN)",
        "kind": "wiki",
        "url": "https://arknights.fandom.com/",
        "note": "英文资料站，适合对照英文名与海外活动。",
        "download": False,
    },
    {
        "id": "gamepress",
        "name": "GamePress Arknights",
        "kind": "guide",
        "url": "https://gamepress.gg/arknights/",
        "note": "英文攻略与干员评价。",
        "download": False,
    },
    {
        "id": "nga",
        "name": "NGA 明日方舟版",
        "kind": "community",
        "url": "https://bbs.nga.cn/thread.php?fid=-34587507",
        "note": "中文玩家社区，攻略、节奏榜与活动讨论。",
        "download": False,
    },
)


def _story_brief(operator: Mapping[str, Any]) -> dict[str, Any]:
    """Build an honest, data-only story brief.

    The plugin deliberately does not invent lore or copy wiki prose.  The brief
    only restates fields already in the codex and points to the official wiki
    for the full story.
    """

    return {
        "lines": [
            f"{operator['name_cn']}（{operator['name_en']}）是{operator['faction']}的{operator['class']}干员。",
            f"种族：{operator['race'] or '资料未明确'}；星级：{operator['rarity']}★。",
            f"战场定位：{operator['role']}",
        ],
        "link": f"https://prts.wiki/w/{operator['name_cn']}",
        "link_label": "PRTS 上的完整剧情与档案",
        "note": "这里只做入门速览，不转载剧情原文；完整的背景故事请以游戏内剧情与官方资料为准。",
    }


def codex_detail(operator_id: str) -> dict[str, Any]:
    """Return one operator with skins and a story brief."""

    for operator in OPERATORS:
        if operator["id"] != operator_id:
            continue
        skins = [dict(item) for item in SKINS.get(operator_id, ())]
        return {
            "ok": True,
            "operator": dict(operator),
            "skins": skins,
            "skin_note": SKIN_NOTE,
            "story": _story_brief(operator),
            "tools": [dict(item) for item in TOOLS],
        }
    return {"ok": False, "error": "not_found", "operator": None}


def tools_payload() -> list[dict[str, Any]]:
    return [dict(item) for item in TOOLS]


__all__ = [
    "CLASSES",
    "CLASS_COLORS",
    "SKINS",
    "SKIN_NOTE",
    "TOOLS",
    "CODEX_DISCLAIMER",
    "CODEX_UPDATED",
    "CODEX_VERSION",
    "OPERATORS",
    "codex_detail",
    "codex_payload",
    "codex_summary",
    "filter_operators",
    "tools_payload",
]