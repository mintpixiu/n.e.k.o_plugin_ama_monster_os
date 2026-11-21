"""Offline food-delivery manual for the Ama Monster OS food room.

This module is deliberately host-free and network-free: it bundles an editorial
snapshot of coupon-acquisition tips and nationwide chain brands, and a small
random meal picker.  Nothing here is a live price, stock, or promotion feed, and
the manual never contains real store addresses or scraped platform data.
"""

from __future__ import annotations

import random
from typing import Any

FOOD_MANUAL_NAME = "隔离食用手册"
FOOD_MANUAL_VERSION = "1.0"
FOOD_MANUAL_UPDATED = "2026-11-21"

DISCLAIMER = (
    "离线整理的优惠券与外卖参考快照，不是实时价格、库存、配送范围或活动；"
    "券面额、满减门槛、起送价和配送时效都以各平台下单页为准。"
    "本手册不抓取任何外卖平台数据，也不提供真实门店地址；"
    "到店路线请用地图 App 搜索最近门店。"
)

PLATFORMS: tuple[dict[str, Any], ...] = (
    {
        "id": "meituan",
        "name": "美团",
        "short": "美团外卖",
        "entry": "App 首页 → 外卖 → 领券中心 / 神券节",
        "caution": "券有门槛和有效期；膨胀券、会员红包、店铺满减能否叠加因店而异，下单前在结算页确认。",
        "coupons": (
            {
                "title": "神券 / 膨胀券",
                "how": "美团 App → 外卖 → 神券节或领券中心领取；午晚高峰前先领，部分券可膨胀后再用。",
                "note": "膨胀券需要在结算页手动勾选，漏选就按原价结算。",
            },
            {
                "title": "会员红包",
                "how": "美团外卖会员月卡每月发放红包包，在「我的 → 会员中心」领取，可与店铺满减叠加。",
                "note": "红包有使用门槛、有效期和适用商家限制。",
            },
            {
                "title": "店铺券 + 店内活动",
                "how": "进店先领店铺券，再看新客立减、收藏有礼、第二份半价等店内活动。",
                "note": "叠加顺序和是否可同享以结算页为准。",
            },
            {
                "title": "拼好饭",
                "how": "美团 App → 拼好饭频道，单人简餐通常比常规外卖便宜。",
                "note": "可选商家、菜品和配送范围有限，适合工作餐。",
            },
            {
                "title": "支付立减",
                "how": "结算页选择指定银行卡、美团月付或数字人民币活动。",
                "note": "立减名额和金额实时变化，以下单页展示为准。",
            },
        ),
    },
    {
        "id": "eleme",
        "name": "饿了么",
        "short": "饿了么外卖",
        "entry": "App 首页 → 领红包 / 超级吃货卡",
        "caution": "平台红包通常有使用门槛和时段限制；会员卡券按月发放，过期不补。",
        "coupons": (
            {
                "title": "超级吃货卡 / 吃货豆",
                "how": "饿了么 App → 我的 → 超级吃货卡；吃货豆可在豆子商城兑换红包和券包。",
                "note": "吃货豆有有效期，兑换前看清适用商家。",
            },
            {
                "title": "天天领红包",
                "how": "首页「天天领红包」每天签到，连续签到红包金额会变大。",
                "note": "下单结算时记得手动勾选红包。",
            },
            {
                "title": "品牌馆 / 大牌券",
                "how": "品牌馆和商超便利频道经常发大牌券、品牌日券，先领券再进店。",
                "note": "品牌券可能限品类或指定商品。",
            },
            {
                "title": "店铺满减",
                "how": "店铺满减可与平台红包叠加，注意满减门槛是否按商品小计计算。",
                "note": "凑单时留意配送费和包装费是否计入门槛。",
            },
            {
                "title": "支付立减",
                "how": "结算页选择银行卡、花呗或数字人民币活动。",
                "note": "随机立减和名额以结算页实时展示为准。",
            },
        ),
    },
    {
        "id": "jd",
        "name": "京东外卖",
        "short": "京东秒送",
        "entry": "京东 App → 秒送 / 外卖",
        "caution": "外卖覆盖城市和商家范围以 App 内实际展示为准；不同城市活动差异较大。",
        "coupons": (
            {
                "title": "PLUS 会员券包",
                "how": "京东 App → 我的 → PLUS 会员中心，领取外卖券包和每月权益。",
                "note": "券包内容按会员等级发放，以会员页为准。",
            },
            {
                "title": "京豆抵扣",
                "how": "结算页可用京豆抵扣部分金额，通常有抵扣比例上限。",
                "note": "京豆抵扣与平台券的叠加规则以下单页为准。",
            },
            {
                "title": "品牌券 / 店铺券",
                "how": "品牌馆和店铺页领券，注意券的可用商品范围。",
                "note": "部分神券仅限指定门店或指定时段。",
            },
            {
                "title": "满减 + 配送费券",
                "how": "凑单满减的同时，留意配送费减免券和免配送费活动。",
                "note": "配送费按距离和时段浮动，以下单页为准。",
            },
            {
                "title": "支付立减",
                "how": "京东支付、白条或指定银行卡活动，结算页自动展示可用优惠。",
                "note": "名额有限，先到先得。",
            },
        ),
    },
    {
        "id": "taobao",
        "name": "淘宝闪购",
        "short": "淘宝小时达",
        "entry": "淘宝 App → 闪购 / 小时达",
        "caution": "小时达的时效和库存依赖附近门店，能否配送以 App 内实际展示为准。",
        "coupons": (
            {
                "title": "88VIP 权益",
                "how": "淘宝 App → 我的 → 88VIP 会员中心，领取专属券包和外卖权益。",
                "note": "权益按会员等级和活动期发放。",
            },
            {
                "title": "店铺券 + 平台补贴",
                "how": "先领店铺券，再看平台补贴和跨店满减是否可叠加。",
                "note": "补贴券通常限频道或限品类。",
            },
            {
                "title": "签到红包 / 任务红包",
                "how": "闪购频道签到和做任务领红包，下单时手动勾选。",
                "note": "红包有使用门槛和有效期。",
            },
            {
                "title": "限时秒杀",
                "how": "闪购频道限时秒杀价，适合买水饮、零食和日用品。",
                "note": "秒杀库存有限，配送范围以门店为准。",
            },
            {
                "title": "支付立减",
                "how": "支付宝、银行卡或数字人民币活动，结算页展示可用优惠。",
                "note": "立减名额实时变化。",
            },
        ),
    },
    {
        "id": "douyin",
        "name": "抖音",
        "short": "抖音团购 / 外卖",
        "entry": "抖音 App → 团购 / 外卖",
        "caution": "团购券通常到店核销，外卖覆盖城市有限；退款和过期规则看券面说明。",
        "coupons": (
            {
                "title": "团购套餐",
                "how": "抖音 App → 团购，先买套餐券再到店核销，通常比单点便宜。",
                "note": "买前确认可用门店、使用时段和是否需要预约。",
            },
            {
                "title": "直播间专属券",
                "how": "品牌直播间会发专属券和秒杀套餐，注意使用门店和有效期。",
                "note": "直播间券库存少，过期不补。",
            },
            {
                "title": "达人探店券",
                "how": "达人视频和探店页面挂载的券多为到店套餐，先看可用门店再买。",
                "note": "部分券限新客或限指定门店。",
            },
            {
                "title": "平台补贴券",
                "how": "活动页和任务中心领取平台补贴券，下单前先领。",
                "note": "补贴券通常有品类和金额限制。",
            },
            {
                "title": "支付立减",
                "how": "抖音支付或指定银行卡立减，结算页展示为准。",
                "note": "名额和金额实时变化。",
            },
        ),
    },
)

BRANDS: tuple[dict[str, Any], ...] = (
    {
        "id": "mcdonalds",
        "name": "麦当劳",
        "category": "汉堡快餐",
        "platforms": ("meituan", "eleme", "jd"),
        "price": "¥20–40",
        "coupon": "小程序会员日、早餐卡；外卖先领店铺券，再叠平台神券。",
        "arrival": "外卖配送；到店自取在下单页切换「到店取餐」，路线用地图 App 查最近门店。",
    },
    {
        "id": "kfc",
        "name": "肯德基",
        "category": "汉堡快餐",
        "platforms": ("meituan", "eleme", "jd"),
        "price": "¥25–45",
        "coupon": "疯狂星期四、宅急送会员券；店铺满减和平台红包可以一起看。",
        "arrival": "外卖配送或到店自取；自取路线用地图 App 查最近门店。",
    },
    {
        "id": "burgerking",
        "name": "汉堡王",
        "category": "汉堡快餐",
        "platforms": ("meituan", "eleme"),
        "price": "¥25–45",
        "coupon": "会员券包、工作日套餐；外卖注意店铺满减门槛。",
        "arrival": "外卖配送；自取在下单页切换，路线用地图 App 查询。",
    },
    {
        "id": "tastien",
        "name": "塔斯汀",
        "category": "汉堡快餐",
        "platforms": ("meituan", "eleme", "douyin"),
        "price": "¥18–30",
        "coupon": "抖音团购套餐、周二会员日；外卖店铺券和满减。",
        "arrival": "外卖配送；到店自取用地图 App 查最近门店。",
    },
    {
        "id": "wallace",
        "name": "华莱士",
        "category": "汉堡快餐",
        "platforms": ("meituan", "eleme", "douyin"),
        "price": "¥15–30",
        "coupon": "抖音团购、店铺满减；单人套餐更划算。",
        "arrival": "外卖配送；自取路线用地图 App 查询。",
    },
    {
        "id": "laoxiangji",
        "name": "老乡鸡",
        "category": "中式快餐",
        "platforms": ("meituan", "eleme", "jd"),
        "price": "¥20–35",
        "coupon": "会员日月卡券；外卖店铺满减 + 平台红包。",
        "arrival": "外卖配送；到店自取在下单页切换，路线用地图 App。",
    },
    {
        "id": "zhengongfu",
        "name": "真功夫",
        "category": "中式快餐",
        "platforms": ("meituan", "eleme"),
        "price": "¥20–35",
        "coupon": "套餐券、早餐券；先领券再点单。",
        "arrival": "外卖配送；自取路线用地图 App 查询。",
    },
    {
        "id": "yonghe",
        "name": "永和大王",
        "category": "中式快餐",
        "platforms": ("meituan", "eleme"),
        "price": "¥15–30",
        "coupon": "早餐券和会员券；早高峰前领券更划算。",
        "arrival": "外卖配送；到店自取可用地图 App 导航。",
    },
    {
        "id": "pizzahut",
        "name": "必胜客",
        "category": "披萨轻食",
        "platforms": ("meituan", "eleme", "jd"),
        "price": "¥40–90",
        "coupon": "周三会员日、买一送一；外卖满减和套餐券。",
        "arrival": "外卖配送；自取路线用地图 App 查最近门店。",
    },
    {
        "id": "subway",
        "name": "赛百味",
        "category": "披萨轻食",
        "platforms": ("meituan", "eleme"),
        "price": "¥25–45",
        "coupon": "会员券、工作日套餐；注意店铺满减门槛。",
        "arrival": "外卖配送；自取路线用地图 App 查询。",
    },
    {
        "id": "ziyan",
        "name": "紫燕百味鸡",
        "category": "卤味小吃",
        "platforms": ("meituan", "eleme"),
        "price": "¥20–40",
        "coupon": "满减和会员券；称重商品注意满减门槛。",
        "arrival": "外卖配送；自取用地图 App 查最近门店。",
    },
    {
        "id": "juewei",
        "name": "绝味鸭脖",
        "category": "卤味小吃",
        "platforms": ("meituan", "eleme"),
        "price": "¥15–35",
        "coupon": "满减、第二份半价；先领店铺券。",
        "arrival": "外卖配送；自取路线用地图 App 查询。",
    },
    {
        "id": "luckin",
        "name": "瑞幸咖啡",
        "category": "咖啡茶饮",
        "platforms": ("meituan", "eleme", "jd", "douyin"),
        "price": "¥9.9–25",
        "coupon": "9.9 券、社群券、会员券；抖音团购也可用。",
        "arrival": "外卖配送；自取在下单页切换，地图 App 查最近门店。",
    },
    {
        "id": "starbucks",
        "name": "星巴克",
        "category": "咖啡茶饮",
        "platforms": ("meituan", "eleme"),
        "price": "¥25–45",
        "coupon": "星享俱乐部、专星送会员券；平台店铺券。",
        "arrival": "外卖配送；到店自取路线用地图 App。",
    },
    {
        "id": "mixue",
        "name": "蜜雪冰城",
        "category": "咖啡茶饮",
        "platforms": ("meituan", "eleme", "douyin"),
        "price": "¥6–15",
        "coupon": "抖音团购、会员日；外卖满减。",
        "arrival": "外卖配送；自取路线用地图 App 查最近门店。",
    },
    {
        "id": "chagee",
        "name": "霸王茶姬",
        "category": "咖啡茶饮",
        "platforms": ("meituan", "eleme", "douyin"),
        "price": "¥15–25",
        "coupon": "团购券、会员券；新品券先领后用。",
        "arrival": "外卖配送；到店自取用地图 App 导航。",
    },
)

DISH_CATEGORIES: tuple[str, ...] = (
    "中式热食",
    "面食粉类",
    "汉堡披萨",
    "早餐点心",
    "轻食料理",
    "夜宵烧烤",
)

DISHES: tuple[dict[str, Any], ...] = (
    {
        "id": "malatang",
        "name": "麻辣烫",
        "category": "中式热食",
        "price": "¥18–35",
        "platforms": ("meituan", "eleme"),
        "coupon": "先领午餐神券，再进店领满减；自选称重留意满减门槛。",
        "arrival": "外卖配送；到店自取通常更快，路线用地图 App 查询。",
    },
    {
        "id": "maocai",
        "name": "冒菜",
        "category": "中式热食",
        "price": "¥18–35",
        "platforms": ("meituan", "eleme"),
        "coupon": "店铺满减 + 平台红包一起领，按份点比称重好凑满减。",
        "arrival": "外卖配送；到店自取可用地图 App 导航。",
    },
    {
        "id": "huangmenji",
        "name": "黄焖鸡米饭",
        "category": "中式热食",
        "price": "¥18–30",
        "platforms": ("meituan", "eleme"),
        "coupon": "单人套餐券通常比单点便宜，先领店铺券再下单。",
        "arrival": "外卖配送；自取路线用地图 App 查询。",
    },
    {
        "id": "baozaifan",
        "name": "煲仔饭",
        "category": "中式热食",
        "price": "¥22–38",
        "platforms": ("meituan", "eleme"),
        "coupon": "店铺满减 + 会员红包；注意配送时间影响口感。",
        "arrival": "外卖配送；到店自取用地图 App 查最近门店。",
    },
    {
        "id": "suancaiyu",
        "name": "酸菜鱼",
        "category": "中式热食",
        "price": "¥35–70",
        "platforms": ("meituan", "eleme"),
        "coupon": "双人套餐券更划算；先领店铺券再凑满减。",
        "arrival": "外卖配送；自取路线用地图 App 查询。",
    },
    {
        "id": "malaxiangguo",
        "name": "麻辣香锅",
        "category": "中式热食",
        "price": "¥30–60",
        "platforms": ("meituan", "eleme"),
        "coupon": "按份套餐比自选好控制预算；店铺满减先领。",
        "arrival": "外卖配送；到店自取用地图 App 导航。",
    },
    {
        "id": "niuroumian",
        "name": "牛肉面",
        "category": "面食粉类",
        "price": "¥18–32",
        "platforms": ("meituan", "eleme"),
        "coupon": "先领平台红包，再看店铺满减；加肉加面以下单页价格为准。",
        "arrival": "外卖配送；到店自取路线用地图 App。",
    },
    {
        "id": "lanzhou",
        "name": "兰州拉面",
        "category": "面食粉类",
        "price": "¥15–28",
        "platforms": ("meituan", "eleme"),
        "coupon": "单人套餐券 + 店铺满减；午市优惠更多。",
        "arrival": "外卖配送；自取路线用地图 App 查询。",
    },
    {
        "id": "luosifen",
        "name": "螺蛳粉",
        "category": "面食粉类",
        "price": "¥15–30",
        "platforms": ("meituan", "eleme"),
        "coupon": "袋装和外卖套餐券；先领店铺券再凑满减。",
        "arrival": "外卖配送；到店自取可用地图 App 导航。",
    },
    {
        "id": "mixian",
        "name": "米线",
        "category": "面食粉类",
        "price": "¥16–30",
        "platforms": ("meituan", "eleme"),
        "coupon": "店铺满减 + 平台红包；加料前先看套餐内容。",
        "arrival": "外卖配送；自取路线用地图 App 查询。",
    },
    {
        "id": "jiaozi",
        "name": "饺子",
        "category": "面食粉类",
        "price": "¥18–35",
        "platforms": ("meituan", "eleme"),
        "coupon": "套餐券更划算；先领店铺券再点。",
        "arrival": "外卖配送；到店自取用地图 App 查最近门店。",
    },
    {
        "id": "zhaji",
        "name": "炸鸡汉堡",
        "category": "汉堡披萨",
        "price": "¥20–45",
        "platforms": ("meituan", "eleme", "douyin"),
        "coupon": "抖音团购套餐 + 平台神券；先领券再凑满减。",
        "arrival": "外卖配送；自取路线用地图 App 查询。",
    },
    {
        "id": "pisa",
        "name": "披萨",
        "category": "汉堡披萨",
        "price": "¥40–90",
        "platforms": ("meituan", "eleme", "jd"),
        "coupon": "周三会员日、买一送一；外卖满减和套餐券。",
        "arrival": "外卖配送；到店自取用地图 App 导航。",
    },
    {
        "id": "jianbing",
        "name": "煎饼果子",
        "category": "早餐点心",
        "price": "¥8–18",
        "platforms": ("meituan", "eleme"),
        "coupon": "早餐时段券和店铺满减；早点下单避免高峰。",
        "arrival": "外卖配送；到店自取路线用地图 App。",
    },
    {
        "id": "shengjian",
        "name": "生煎小笼",
        "category": "早餐点心",
        "price": "¥12–28",
        "platforms": ("meituan", "eleme"),
        "coupon": "早餐组合券；先领店铺券再下单。",
        "arrival": "外卖配送；自取路线用地图 App 查询。",
    },
    {
        "id": "zhou",
        "name": "粥 + 点心",
        "category": "早餐点心",
        "price": "¥15–30",
        "platforms": ("meituan", "eleme"),
        "coupon": "早餐券和满减；清淡搭配时注意配送时间。",
        "arrival": "外卖配送；到店自取用地图 App 导航。",
    },
    {
        "id": "shala",
        "name": "轻食沙拉",
        "category": "轻食料理",
        "price": "¥25–45",
        "platforms": ("meituan", "eleme"),
        "coupon": "轻食套餐券 + 平台红包；自选加料前看热量。",
        "arrival": "外卖配送；自取路线用地图 App 查询。",
    },
    {
        "id": "shousi",
        "name": "寿司",
        "category": "轻食料理",
        "price": "¥30–60",
        "platforms": ("meituan", "eleme"),
        "coupon": "双人套餐券更划算；生食注意配送时效。",
        "arrival": "外卖配送；到店自取用地图 App 导航。",
    },
    {
        "id": "hanguo",
        "name": "韩式简餐",
        "category": "轻食料理",
        "price": "¥25–50",
        "platforms": ("meituan", "eleme", "douyin"),
        "coupon": "团购套餐 + 店铺满减；先看小菜是否包含。",
        "arrival": "外卖配送；到店自取路线用地图 App。",
    },
    {
        "id": "shaokao",
        "name": "烧烤",
        "category": "夜宵烧烤",
        "price": "¥30–70",
        "platforms": ("meituan", "eleme"),
        "coupon": "夜宵时段券 + 店铺满减；先领券再凑单。",
        "arrival": "外卖配送；到店自取用地图 App 查最近门店。",
    },
    {
        "id": "longxia",
        "name": "小龙虾",
        "category": "夜宵烧烤",
        "price": "¥60–130",
        "platforms": ("meituan", "eleme", "douyin"),
        "coupon": "团购套餐券通常比单点便宜；注意配送时效。",
        "arrival": "外卖配送；到店自取路线用地图 App。",
    },
    {
        "id": "kaoya",
        "name": "烤鸭饭",
        "category": "中式热食",
        "price": "¥22–38",
        "platforms": ("meituan", "eleme"),
        "coupon": "套餐券 + 店铺满减；先领券再看起送价。",
        "arrival": "外卖配送；自取路线用地图 App 查询。",
    },
    {
        "id": "galifan",
        "name": "咖喱饭",
        "category": "中式热食",
        "price": "¥20–35",
        "platforms": ("meituan", "eleme"),
        "coupon": "会员券和店铺满减；加料前看套餐内容。",
        "arrival": "外卖配送；到店自取用地图 App 导航。",
    },
    {
        "id": "kaoroufan",
        "name": "烤肉饭",
        "category": "中式热食",
        "price": "¥20–32",
        "platforms": ("meituan", "eleme"),
        "coupon": "单人套餐券 + 平台红包；避开高峰期口感更好。",
        "arrival": "外卖配送；自取路线用地图 App 查询。",
    },
)

_PLATFORM_BY_ID = {platform["id"]: platform for platform in PLATFORMS}


def food_manual_payload() -> dict[str, Any]:
    """Return the serializable manual consumed by the Hosted UI and snapshot."""

    return {
        "ok": True,
        "name": FOOD_MANUAL_NAME,
        "version": FOOD_MANUAL_VERSION,
        "updated": FOOD_MANUAL_UPDATED,
        "disclaimer": DISCLAIMER,
        "categories": list(DISH_CATEGORIES),
        "platforms": [
            {
                **{key: value for key, value in platform.items() if key != "coupons"},
                "coupons": [dict(coupon) for coupon in platform["coupons"]],
            }
            for platform in PLATFORMS
        ],
        "brands": [
            {**brand, "platforms": list(brand["platforms"])}
            for brand in BRANDS
        ],
        "dishes": [
            {**dish, "platforms": list(dish["platforms"])}
            for dish in DISHES
        ],
        "summary": {
            "platforms": len(PLATFORMS),
            "brands": len(BRANDS),
            "dishes": len(DISHES),
        },
    }


def draw_meal(
    *,
    avoid: str = "",
    category: str = "",
    rng: random.Random | None = None,
) -> dict[str, Any]:
    """Pick one dish and attach a platform, coupon tip, price and arrival note.

    ``avoid`` excludes the last drawn dish when another choice exists, so the
    "再抽一次" button never repeats immediately.  ``category`` filters to one of
    ``DISH_CATEGORIES``; unknown categories fall back to the full pool.
    """

    picker = rng if rng is not None else random.SystemRandom()
    wanted = str(category or "").strip()
    pool = [dish for dish in DISHES if not wanted or dish["category"] == wanted]
    if not pool:
        pool = list(DISHES)
    previous = str(avoid or "").strip()
    if previous and len(pool) > 1:
        reduced = [dish for dish in pool if dish["id"] != previous]
        if reduced:
            pool = reduced
    dish = picker.choice(pool)
    platform_ids = [item for item in dish["platforms"] if item in _PLATFORM_BY_ID]
    platform = _PLATFORM_BY_ID[picker.choice(platform_ids)]
    coupon = picker.choice(list(platform["coupons"]))
    return {
        "ok": True,
        "dish": {**dish, "platforms": list(dish["platforms"])},
        "platform": {
            "id": platform["id"],
            "name": platform["name"],
            "short": platform.get("short", platform["name"]),
        },
        "coupon": dict(coupon),
        "arrival": dish["arrival"],
        "price": dish["price"],
    }


__all__ = [
    "BRANDS",
    "DISHES",
    "DISH_CATEGORIES",
    "DISCLAIMER",
    "FOOD_MANUAL_NAME",
    "FOOD_MANUAL_UPDATED",
    "FOOD_MANUAL_VERSION",
    "PLATFORMS",
    "draw_meal",
    "food_manual_payload",
]
