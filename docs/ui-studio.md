# 自定义外观与导入导出教程

**Ama Monster OS 0.1.0 Beta** · UI Studio · `ama.ui.profile` v1

这篇教程讲三件事：

1. 在窗口里直接制作一套自己的外观。
2. 把外观导出成 JSON，备份或分享。
3. 导入别人制作的 JSON，并恢复或迁移自己的外观。

> UI Studio 只接受受支持的颜色、枚举、长度和数值范围。它不会执行任意
> CSS、HTML、JavaScript，也不会加载远程壁纸或图片。

![外观工坊](preview-studio.png)

## 一、先认识外观配置

一套外观是一个 JSON 对象，完整格式如下：

```json
{
  "format": "ama.ui.profile",
  "version": 1,
  "profile": {
    "version": 1,
    "name": "Sakura",
    "brand": "Ama Monster OS",
    "glyph": "✦",
    "accent": "#e88aa8",
    "wallpaper": "dots",
    "window_bg": "sakura",
    "window_color": "#ffffff",
    "radius": 16,
    "density": "comfortable",
    "theme": "light"
  }
}
```

字段说明：

| 字段 | 类型 | 说明 |
|------|------|------|
| `format` | 字符串 | 固定为 `ama.ui.profile`，用于识别文件 |
| `version` | 数字 | 当前为 `1` |
| `profile.name` | 字符串 | 配置名称，最长 32 字符 |
| `profile.brand` | 字符串 | 窗口左上角标题，最长 24 字符 |
| `profile.glyph` | 字符串 | 窗口图标，最长 2 字符，例如 `✦`、`❀`、`♥` |
| `profile.accent` | 字符串 | 六位十六进制颜色，例如 `#44b8f2` |
| `profile.wallpaper` | 字符串 | 窗口外桌面背景：`grid` / `dots` / `aurora` / `stars` / `plain` |
| `profile.window_bg` | 字符串 | **窗口本身背景**：`paper` / `mist` / `sakura` / `glass` / `custom` |
| `profile.window_color` | 字符串 | `window_bg=custom` 时的窗口背景色，六位十六进制 |
| `profile.radius` | 数字 | 圆角，8–28，超出会截断 |
| `profile.density` | 字符串 | `comfortable` / `compact` |
| `profile.theme` | 字符串 | `light` / `dark` |

> `wallpaper` 是窗口**外**的桌面花纹；`window_bg` 才是窗口**本身**的背景。
> 两者可以独立设置。

也可以只写 `profile` 里的字段，不带 `format` 外层：

```json
{
  "brand": "Ama 夜航",
  "glyph": "☾",
  "accent": "#8bdcff",
  "wallpaper": "stars",
  "window_bg": "glass",
  "window_color": "#ffffff",
  "radius": 20,
  "density": "compact",
  "theme": "dark"
}
```

导入时缺少的字段会用默认值补齐；非法颜色、未知枚举、超长文字和越界圆角
会被自动纠正，而不是执行。

## 二、在窗口里制作外观

### 第 1 步：打开外观工坊

打开 **N.E.K.O → 插件管理 → Ama Monster OS → UI**，在左侧导航点击
**外观**。

### 第 2 步：选一个起点

顶部有四个预设：

- **云海**：浅色、蓝色强调色、网格背景
- **樱雾**：浅色、粉色强调色、点阵背景
- **薄荷**：浅色、绿色强调色、极光背景
- **星夜**：深色、浅蓝强调色、星空背景

预设只是一键起点，后面还可以继续改。

### 第 3 步：微调

- **强调色**：点色板，或使用右侧取色器
- **主题**：日光 / 月光
- **窗口背景**：纸白 / 雾蓝 / 樱粉 / 玻璃 / 自定义颜色
- **桌面背景**：网格 / 点阵 / 极光 / 星夜 / 纯净
- **圆角**：拖动 8–28px
- **密度**：舒适 / 紧凑
- **窗口标识**：修改标题和图标

修改会立即显示在整个窗口里。右上角会从 **已保存** 变成 **未保存**。

### 第 4 步：保存

点击 **保存外观**。

- 配置写入插件数据目录的 `data/ui_profile.json`
- 重新打开窗口或重启插件后会自动恢复
- 如果只预览没保存，重开窗口会回到上次保存的版本

### 第 5 步：导出

在 **导入 / 导出** 区域：

- **下载 JSON**：下载 `ama-ui-profile.json`
- **复制**：把当前配置复制到剪贴板
- 也可以直接选中文本框里的 JSON 手动复制

如果浏览器/宿主拦截了下载，使用 **复制** 仍然可用。

![导入导出区域](preview-studio-io.png)

## 三、导入一套外观

### 方法 A：从别人分享的 JSON 导入

1. 打开 **外观** 页面。
2. 找到 **导入配置**。
3. 粘贴完整的 JSON（带不带 `format` 外层都可以）。
4. 点击 **导入并应用**。
5. 检查预览和标题栏。
6. 点击 **保存外观** 持久化。

如果没有点保存，导入只对当前窗口会话生效。

### 方法 B：恢复自己的备份

1. 打开之前导出的 `ama-ui-profile.json`。
2. 复制全部内容。
3. 粘贴到 **导入配置**。
4. **导入并应用 → 保存外观**。

### 方法 C：手写一套配置

1. 新建一个 UTF-8 文本文件，扩展名改成 `.json`。
2. 按上面的格式写入配置。
3. 用编辑器的 JSON 校验功能确认没有多余逗号。
4. 把全文粘贴到 **导入配置**，点击 **导入并应用**。
5. 点击 **保存外观**。

注意：

- 颜色必须是 `#` 加六位十六进制，例如 `#44b8f2`，不能写 `blue`。
- `wallpaper`、`density`、`theme` 只能使用上表中的英文值。
- 中文标题、图标可以直接写；会按 UTF-8 保存。
- 文本字段有长度限制，超长会被截断。

## 四、直接制作 JSON 的示例

### 樱雾

```json
{
  "format": "ama.ui.profile",
  "version": 1,
  "profile": {
    "version": 1,
    "name": "Sakura",
    "brand": "Ama 樱花工坊",
    "glyph": "❀",
    "accent": "#e88aa8",
    "wallpaper": "dots",
    "window_bg": "sakura",
    "window_color": "#ffffff",
    "radius": 18,
    "density": "comfortable",
    "theme": "light"
  }
}
```

### 星夜

```json
{
  "format": "ama.ui.profile",
  "version": 1,
  "profile": {
    "version": 1,
    "name": "Night",
    "brand": "Ama 夜航",
    "glyph": "☾",
    "accent": "#8bdcff",
    "wallpaper": "stars",
    "window_bg": "glass",
    "window_color": "#ffffff",
    "radius": 20,
    "density": "compact",
    "theme": "dark"
  }
}
```

### 薄荷

```json
{
  "format": "ama.ui.profile",
  "version": 1,
  "profile": {
    "version": 1,
    "name": "Mint",
    "brand": "Ama Monster OS",
    "glyph": "✦",
    "accent": "#4fc3a1",
    "wallpaper": "aurora",
    "window_bg": "mist",
    "window_color": "#ffffff",
    "radius": 16,
    "density": "comfortable",
    "theme": "light"
  }
}
```

## 五、常见问题

| 问题 | 处理 |
|------|------|
| 点了保存但重开没变化 | 确认提示为“外观已保存”；查看插件日志和数据目录写权限 |
| 下载按钮没反应 | 使用 **复制**，把 JSON 保存到本地文件 |
| 导入提示无效 | 检查 JSON 是否有语法错误；`format` 必须是 `ama.ui.profile` |
| 导入后颜色不对 | 颜色必须为六位十六进制；其他值会被默认值替换 |
| 想恢复初始外观 | 点击 **恢复默认**，再点 **保存外观** |
| 配置存在哪里 | 插件数据目录下的 `data/ui_profile.json`；具体根目录由 N.E.K.O 按平台决定 |

## 六、安全边界

- 不接受任意 CSS、HTML、JavaScript。
- 不接受远程背景图或 URL。
- 所有字段在 Python 端再次校验后才写入磁盘。
- 导入文件大小有上限；异常 JSON 会被拒绝。
- 不读取 Steam 密码，不涉及账号登录。

## 七、相关入口

- `@ui.action(id="ama_ui_profile_save")` → 保存外观
- `@ui.context(id="os_shell")` → 快照中的 `ui_profile`
- `ui_profile.py` → 校验、导出、导入解析
- `data/ui_profile.json` → 持久化文件
