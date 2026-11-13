import { FileDownload, useEffect, useState } from "@neko/plugin-ui"
import type { HostedAction, PluginSurfaceProps } from "@neko/plugin-ui"

type ViewId = "home" | "web" | "steam" | "codex" | "tokens" | "studio" | "core" | "bridge" | "about"
type ChromeMode = "normal" | "max" | "min" | "asleep"
type ThemeMode = "light" | "dark"
type UiWallpaper = "grid" | "dots" | "aurora" | "stars" | "plain"
type UiWindowBg = "paper" | "mist" | "sakura" | "glass" | "gradient" | "image" | "custom"
type UiDensity = "comfortable" | "compact"
type UiMaterial = "glass" | "solid" | "metal" | "cream" | "ink"
type SoundMode = "steam" | "soft" | "mechanical" | "custom"

type UiProfile = {
  version: number
  name: string
  brand: string
  glyph: string
  accent: string
  wallpaper: UiWallpaper
  window_bg: UiWindowBg
  window_color: string
  window_image: string
  gradient_colors: string[]
  gradient_angle: number
  sound_enabled: boolean
  sound_mode: SoundMode
  sound_volume: number
  sound_data: string
  sound_name: string
  material: UiMaterial
  glass_blur: number
  glass_alpha: number
  radius: number
  density: UiDensity
  theme: ThemeMode
}

const DEFAULT_UI_PROFILE: UiProfile = {
  version: 1,
  name: "Cloud",
  brand: "Ama Monster OS",
  glyph: "✦",
  accent: "#44b8f2",
  wallpaper: "grid",
  window_bg: "paper",
  window_color: "#ffffff",
  window_image: "",
  gradient_colors: ["#44b8f2", "#9b8ad9", "#e88aa8"],
  gradient_angle: 135,
  sound_enabled: true,
  sound_mode: "steam",
  sound_volume: 0.55,
  sound_data: "",
  sound_name: "",
  material: "glass",
  glass_blur: 24,
  glass_alpha: 58,
  radius: 16,
  density: "comfortable",
  theme: "light",
}

const UI_PRESETS: Array<{ id: string; labelKey: string; accent: string; wallpaper: UiWallpaper; window_bg: UiWindowBg; theme: ThemeMode; material?: UiMaterial; glass_blur?: number; glass_alpha?: number }> = [
  { id: "glass", labelKey: "studio.preset.glass", accent: "#4fb6f0", wallpaper: "aurora", window_bg: "glass", theme: "light", material: "glass", glass_blur: 28, glass_alpha: 52 },
  { id: "cloud", labelKey: "studio.preset.cloud", accent: "#44b8f2", wallpaper: "grid", window_bg: "paper", theme: "light", material: "glass", glass_blur: 20, glass_alpha: 66 },
  { id: "sakura", labelKey: "studio.preset.sakura", accent: "#e88aa8", wallpaper: "dots", window_bg: "sakura", theme: "light", material: "glass", glass_blur: 22, glass_alpha: 60 },
  { id: "mint", labelKey: "studio.preset.mint", accent: "#4fc3a1", wallpaper: "aurora", window_bg: "mist", theme: "light", material: "glass", glass_blur: 24, glass_alpha: 56 },
  { id: "night", labelKey: "studio.preset.night", accent: "#8bdcff", wallpaper: "stars", window_bg: "glass", theme: "dark", material: "glass", glass_blur: 26, glass_alpha: 46 },
  { id: "metal", labelKey: "studio.preset.metal", accent: "#8c9bb0", wallpaper: "plain", window_bg: "custom", theme: "light", material: "metal" },
  { id: "cream", labelKey: "studio.preset.cream", accent: "#f2a3b8", wallpaper: "dots", window_bg: "custom", theme: "light", material: "cream" },
  { id: "ink", labelKey: "studio.preset.ink", accent: "#7f7ae0", wallpaper: "aurora", window_bg: "custom", theme: "light", material: "ink" },
]

const UI_MATERIALS: Array<{ id: UiMaterial; labelKey: string; hintKey: string }> = [
  { id: "glass", labelKey: "studio.material.glass", hintKey: "studio.material.glassHint" },
  { id: "metal", labelKey: "studio.material.metal", hintKey: "studio.material.metalHint" },
  { id: "cream", labelKey: "studio.material.cream", hintKey: "studio.material.creamHint" },
  { id: "ink", labelKey: "studio.material.ink", hintKey: "studio.material.inkHint" },
  { id: "solid", labelKey: "studio.material.solid", hintKey: "studio.material.solidHint" },
]

const UI_WALLPAPERS: UiWallpaper[] = ["grid", "dots", "aurora", "stars", "plain"]
const UI_WINDOW_BACKGROUNDS: UiWindowBg[] = ["paper", "mist", "sakura", "glass", "gradient", "image", "custom"]
const UI_ACCENTS = ["#44b8f2", "#e88aa8", "#4fc3a1", "#9b8ad9", "#d9a441", "#7d8fa8"]
const MAX_WINDOW_IMAGE_BYTES = 1_200_000
const MAX_SOUND_BYTES = 1_000_000
const MAX_UI_PROFILE_BYTES = 4_000_000

function validWindowImage(value: any): boolean {
  return typeof value === "string"
    && /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(value)
    && value.length < MAX_WINDOW_IMAGE_BYTES * 1.4
}

function validSoundData(value: any): boolean {
  return typeof value === "string"
    && /^data:audio\/(?:wav|mpeg|mp3|ogg);base64,/i.test(value)
    && value.length < MAX_SOUND_BYTES * 1.4
}

let amaAudioContext: AudioContext | null = null

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360 / 360
  const s = saturation / 100
  const l = lightness / 100
  const hueToRgb = (p: number, q: number, t: number) => {
    let value = t
    if (value < 0) value += 1
    if (value > 1) value -= 1
    if (value < 1 / 6) return p + (q - p) * 6 * value
    if (value < 1 / 2) return q
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const values = [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)]
  return `#${values.map((value) => Math.round(value * 255).toString(16).padStart(2, "0")).join("")}`
}

function playSelectSound(profile: UiProfile) {
  if (!profile.sound_enabled || profile.sound_volume <= 0) return
  const volume = Math.max(0, Math.min(1, Number(profile.sound_volume) || 0))
  if (profile.sound_mode === "custom" && profile.sound_data) {
    try {
      const audio = new Audio(profile.sound_data)
      audio.volume = volume
      void audio.play().catch(() => {})
      return
    } catch (_error) {
      return
    }
  }
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return
    if (!amaAudioContext) amaAudioContext = new Ctor()
    const context = amaAudioContext
    if (context.state === "suspended") void context.resume()
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    if (profile.sound_mode === "mechanical") {
      oscillator.type = "square"
      oscillator.frequency.setValueAtTime(760, now)
      oscillator.frequency.exponentialRampToValueAtTime(420, now + 0.045)
    } else if (profile.sound_mode === "soft") {
      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(680, now)
      oscillator.frequency.exponentialRampToValueAtTime(520, now + 0.055)
    } else {
      oscillator.type = "triangle"
      oscillator.frequency.setValueAtTime(1040, now)
      oscillator.frequency.exponentialRampToValueAtTime(1480, now + 0.035)
    }
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume * 0.18), now + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.09)
  } catch (_error) {
    // Audio is a nicety; never break the window if the host blocks it.
  }
}

function normalizeUiProfile(value: any): UiProfile {
  const source = value && typeof value === "object" ? value : {}
  const accent = typeof source.accent === "string" && /^#[0-9a-f]{6}$/i.test(source.accent.trim())
    ? source.accent.trim().toLowerCase()
    : DEFAULT_UI_PROFILE.accent
  const radius = Math.max(8, Math.min(28, Math.round(Number(source.radius) || DEFAULT_UI_PROFILE.radius)))
  const wallpaper = UI_WALLPAPERS.indexOf(source.wallpaper) >= 0 ? source.wallpaper : DEFAULT_UI_PROFILE.wallpaper
  const windowColor = typeof source.window_color === "string" && /^#[0-9a-f]{6}$/i.test(source.window_color.trim())
    ? source.window_color.trim().toLowerCase()
    : DEFAULT_UI_PROFILE.window_color
  const windowImage = validWindowImage(source.window_image) ? String(source.window_image) : ""
  const windowBgValue = UI_WINDOW_BACKGROUNDS.indexOf(source.window_bg) >= 0 ? source.window_bg : DEFAULT_UI_PROFILE.window_bg
  const window_bg: UiWindowBg = windowBgValue === "image" && !windowImage ? "paper" : windowBgValue
  const gradientColors: string[] = Array.isArray(source.gradient_colors)
    ? Array.from(new Set<string>(
      (source.gradient_colors as any[])
        .filter((item: any) => typeof item === "string" && /^#[0-9a-f]{6}$/i.test(item.trim()))
        .map((item: any) => String(item).trim().toLowerCase()),
    )).slice(0, 30)
    : []
  const gradient_colors = gradientColors.length >= 2 ? gradientColors : [...DEFAULT_UI_PROFILE.gradient_colors]
  const gradientAngle = Math.max(0, Math.min(360, Math.round(Number(source.gradient_angle) || DEFAULT_UI_PROFILE.gradient_angle)))
  const soundMode: SoundMode = ["steam", "soft", "mechanical", "custom"].indexOf(source.sound_mode) >= 0 ? source.sound_mode : "steam"
  const soundData = soundMode === "custom" && validSoundData(source.sound_data) ? String(source.sound_data) : ""
  const sound_mode: SoundMode = soundMode === "custom" && !soundData ? "steam" : soundMode
  const soundVolume = Math.max(0, Math.min(1, Number(source.sound_volume ?? DEFAULT_UI_PROFILE.sound_volume)))
  const material: UiMaterial = (["glass", "solid", "metal", "cream", "ink"] as string[]).indexOf(source.material) >= 0 ? source.material as UiMaterial : "glass"
  const glassBlur = Math.max(6, Math.min(40, Math.round(Number(source.glass_blur) || DEFAULT_UI_PROFILE.glass_blur)))
  const glassAlpha = Math.max(28, Math.min(92, Math.round(Number(source.glass_alpha) || DEFAULT_UI_PROFILE.glass_alpha)))
  const density: UiDensity = source.density === "compact" ? "compact" : "comfortable"
  const theme: ThemeMode = source.theme === "dark" ? "dark" : "light"
  const brand = String(source.brand || "").trim().slice(0, 24) || DEFAULT_UI_PROFILE.brand
  const glyph = String(source.glyph || "").trim().slice(0, 2) || DEFAULT_UI_PROFILE.glyph
  const name = String(source.name || "").trim().slice(0, 32) || DEFAULT_UI_PROFILE.name
  return {
    version: 1,
    name,
    brand,
    glyph,
    accent,
    wallpaper,
    window_bg,
    window_color: windowColor,
    window_image: windowImage,
    gradient_colors,
    gradient_angle: gradientAngle,
    sound_enabled: source.sound_enabled !== false,
    sound_mode,
    sound_volume: Math.round(soundVolume * 100) / 100,
    sound_data: soundData,
    sound_name: String(source.sound_name || "").trim().slice(0, 80),
    material,
    glass_blur: glassBlur,
    glass_alpha: glassAlpha,
    radius,
    density,
    theme,
  }
}

function windowBackgroundValue(profile: UiProfile): string {
  if (profile.window_bg === "gradient" && profile.gradient_colors.length >= 2) {
    const stops = profile.gradient_colors.map((color, index) => {
      const position = Math.round((index / (profile.gradient_colors.length - 1)) * 100)
      return `${color} ${position}%`
    }).join(", ")
    return `linear-gradient(${profile.gradient_angle}deg, ${stops})`
  }
  if (profile.window_bg === "image" && profile.window_image) {
    return `linear-gradient(145deg, color-mix(in srgb, var(--paper) 52%, transparent), color-mix(in srgb, var(--paper) 74%, transparent)), url("${profile.window_image}") center / cover no-repeat`
  }
  if (profile.window_bg === "custom") return profile.window_color
  if (profile.window_bg === "mist") return "linear-gradient(145deg, color-mix(in srgb, var(--sky) 14%, var(--paper)), var(--paper))"
  if (profile.window_bg === "sakura") return "linear-gradient(145deg, #fff8fb, #ffe6f0)"
  if (profile.window_bg === "glass") return "color-mix(in srgb, var(--paper) 76%, transparent)"
  return "var(--paper)"
}

function formatTokenPrice(value: any): string {
  const number = Number(value)
  if (!Number.isFinite(number)) return "—"
  if (number === 0) return "$0"
  if (number < 0.01) return `$${number.toFixed(4)}`
  if (number < 1) return `$${number.toFixed(3)}`
  if (number < 10) return `$${number.toFixed(2)}`
  return `$${number.toFixed(1)}`
}

function formatTokenContext(value: any): string {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return "—"
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(number % 1_000_000 === 0 ? 0 : 1)}M`
  if (number >= 1000) return `${Math.round(number / 1000)}K`
  return String(Math.round(number))
}

function tokenHistoryChange(candles: TokenCandle[], metric: "input" | "output"): number {
  if (!Array.isArray(candles) || candles.length < 2) return 0
  const first = candles[0]
  const last = candles[candles.length - 1]
  const start = Number(metric === "input" ? first.close : first.output_close)
  const end = Number(metric === "input" ? last.close : last.output_close)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) return 0
  return ((end - start) / start) * 100
}

type PeakState = { peak: boolean; minutes: number | null; next: "peak" | "offPeak" | "unknown" }

function tokenPeakPolicyFor(models: TokenModel[]): TokenTimePolicy | undefined {
  const withPeak = models.find((model) => model.time_policy?.kind === "deepseek_peak")
  return withPeak?.time_policy
}

function tokenPeakState(policy: TokenTimePolicy | undefined, now: Date): PeakState {
  if (!policy || policy.kind !== "deepseek_peak") return { peak: false, minutes: null, next: "unknown" }
  const windows = Array.isArray(policy.peak_windows_utc) ? policy.peak_windows_utc : []
  if (windows.length === 0) return { peak: false, minutes: null, next: "unknown" }
  const nowMs = now.getTime()
  for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
    const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset)
    const weekday = new Date(dayStart).getUTCDay()
    if (weekday === 0 || weekday === 6) continue
    for (const window of windows) {
      const startParts = String(window.start || "00:00").split(":")
      const endParts = String(window.end || "00:00").split(":")
      const start = dayStart + (Number(startParts[0]) * 60 + Number(startParts[1] || 0)) * 60000
      const end = dayStart + (Number(endParts[0]) * 60 + Number(endParts[1] || 0)) * 60000
      if (end <= nowMs) continue
      if (start > nowMs) {
        return { peak: false, minutes: Math.round((start - nowMs) / 60000), next: "peak" }
      }
      return { peak: true, minutes: Math.round((end - nowMs) / 60000), next: "offPeak" }
    }
  }
  return { peak: false, minutes: null, next: "unknown" }
}

function tokenPeakCountdown(state: PeakState, tr: (key: string, fallback: string) => string): string {
  if (state.minutes === null) return ""
  const hours = Math.floor(state.minutes / 60)
  const minutes = state.minutes % 60
  const span = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  return state.next === "peak"
    ? tr("tokens.peakIn", "距高峰 {span}").replace("{span}", span)
    : tr("tokens.offPeakIn", "距低谷 {span}").replace("{span}", span)
}

function TokenKLine(props: { candles: TokenCandle[]; metric: "input" | "output"; label: string }) {
  const [hover, setHover] = useState(-1)
  const candles = Array.isArray(props.candles) ? props.candles.slice(-30) : []
  if (candles.length === 0) {
    return <div className="ama-token-chart-empty">{props.label} · 暂无历史点位</div>
  }
  const openKey = props.metric === "input" ? "open" : "output_open"
  const highKey = props.metric === "input" ? "high" : "output_high"
  const lowKey = props.metric === "input" ? "low" : "output_low"
  const closeKey = props.metric === "input" ? "close" : "output_close"
  const values = candles.flatMap((candle) => [Number(candle[highKey]), Number(candle[lowKey])]).filter(Number.isFinite)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (!Number.isFinite(min) || !Number.isFinite(max)) min = max = 0
  if (max === min) {
    const pad = Math.max(Math.abs(max) * 0.18, 0.01)
    min = Math.max(0, min - pad)
    max += pad
  } else {
    const pad = (max - min) * 0.12
    min = Math.max(0, min - pad)
    max += pad
  }
  const ticks = [0, 1, 2, 3, 4].map((index) => min + ((max - min) / 4) * index)
  const latest = candles[candles.length - 1]
  const latestValue = Number(latest[closeKey])
  const yPct = (value: number) => ((value - min) / (max - min)) * 100
  const bodyWidth = Math.max(3, Math.min(12, 420 / candles.length))
  const change = tokenHistoryChange(candles, props.metric)
  return (
    <div className="ama-token-chart">
      <div className="ama-token-chart-top">
        <div>
          <strong>{formatTokenPrice(latestValue)}</strong>
          <span>{props.label} · USD / 1M</span>
        </div>
        <span className={`ama-token-chart-change ${change >= 0 ? "is-up" : "is-down"}`}>
          {change >= 0 ? "+" : ""}{change.toFixed(2)}% · 30D
        </span>
      </div>
      <div className="ama-token-chart-body">
        <div className="ama-token-y-axis">
          {ticks.map((tick, index) => (
            <span key={`tick-${index}`} style={{ bottom: `${(index / 4) * 100}%` }}>{formatTokenPrice(tick)}</span>
          ))}
        </div>
        <div className="ama-token-plot">
          {ticks.map((tick, index) => (
            <i className="ama-token-gridline" key={`grid-${index}`} style={{ bottom: `${(index / 4) * 100}%` }} />
          ))}
          {candles.map((candle, index) => {
            const open = Number(candle[openKey])
            const close = Number(candle[closeKey])
            const high = Number(candle[highKey])
            const low = Number(candle[lowKey])
            const up = close >= open
            const lowPct = yPct(low)
            const highPct = yPct(high)
            const bodyBottom = yPct(Math.min(open, close))
            const bodyHeight = Math.abs(yPct(open) - yPct(close))
            return (
              <div
                className={`ama-token-candle ${candle.baseline ? "is-baseline" : ""}`}
                key={candle.date}
                style={{ left: `${((index + 0.5) / candles.length) * 100}%` }}
                onMouseEnter={() => setHover(index)}
                title={`${candle.date} · 开 ${formatTokenPrice(open)} / 高 ${formatTokenPrice(high)} / 低 ${formatTokenPrice(low)} / 收 ${formatTokenPrice(close)}${candle.baseline ? " · 目录基线" : ""}`}
              >
                <i className={`ama-token-wick ${up ? "is-up" : "is-down"}`} style={{ bottom: `${lowPct}%`, height: `${Math.max(1, highPct - lowPct)}%` }} />
                <i
                  className={`ama-token-body ${up ? "is-up" : "is-down"} ${hover === index ? "is-hover" : ""}`}
                  style={{ bottom: `${bodyBottom}%`, height: `${Math.max(2.2, bodyHeight)}%`, width: `${bodyWidth}px` }}
                />
                <i className={`ama-token-close-dot ${up ? "is-up" : "is-down"}`} style={{ bottom: `${yPct(close)}%` }} />
              </div>
            )
          })}
          {candles.map((candle, index) => {
            if (!(index === 0 || index === candles.length - 1 || index % 6 === 0)) return null
            return <span className="ama-token-x-label" key={`label-${candle.date}`} style={{ left: `${((index + 0.5) / candles.length) * 100}%` }}>{candle.date.slice(5)}</span>
          })}
        </div>
      </div>
      <div className="ama-token-chart-foot">
        <span><i className="ama-token-dot is-up" /> 上涨 / 收高</span>
        <span><i className="ama-token-dot is-down" /> 下跌 / 收低</span>
        <span>悬停蜡烛查看 OHLC</span>
      </div>
    </div>
  )
}

function uiProfileDownloadUrl(value: any): string {
  const json = JSON.stringify(value, null, 2)
  const bytes = new TextEncoder().encode(json)
  let binary = ""
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return `data:application/json;base64,${btoa(binary)}`
}

function parseUiProfileText(text: string): { profile?: UiProfile; error?: string } {
  const trimmed = String(text || "").trim()
  if (!trimmed) return { error: "empty" }
  if (new TextEncoder().encode(trimmed).length > MAX_UI_PROFILE_BYTES) return { error: "profile_too_large" }
  let parsed: any
  try {
    parsed = JSON.parse(trimmed)
  } catch (_error) {
    return { error: "invalid_json" }
  }
  if (!parsed || typeof parsed !== "object") return { error: "invalid_profile" }
  if (parsed.format && parsed.format !== "ama.ui.profile") return { error: "unsupported_format" }
  const candidate = parsed.profile && typeof parsed.profile === "object" ? parsed.profile : parsed
  return { profile: normalizeUiProfile(candidate) }
}

type ModuleInfo = {
  id?: string
  name_key?: string
  description_key?: string
  status?: string
  glyph?: string
  tone?: string
}

type BridgeInfo = {
  contract_version?: string
  provider?: string
  mode?: string
  health?: string
  capabilities?: string[]
  reserved?: Array<{ id?: string; state?: string; summary?: string }>
  activity?: {
    available?: boolean
    privacy?: string
    category?: string | null
    idle_seconds?: number | null
  }
}

type ShellInfo = {
  name?: string
  version?: string
  channel?: string
  codename?: string
  uptime_seconds?: number
  boot_count?: number
  daypart?: string
  hosted?: boolean
}

type TelemetryInfo = {
  host?: string
  surface?: string
  platform?: string
  os_release?: string
  python?: string
  sdk?: string
  degraded?: boolean
}

type PulseInfo = {
  count?: number
  last_at?: string | null
  server_ms?: number
}

type WebResult = {
  title?: string
  url?: string
  snippet?: string
  domain?: string
}

type WebInfo = {
  available?: boolean
  status?: string
  query?: string
  count?: number
  results?: WebResult[]
  provider?: string
  at?: string | null
  error?: string
  fallback?: boolean
}

type SteamPrice = {
  game_id?: string
  steam_app_id?: string
  title?: string
  title_cn?: string
  currency?: string
  current?: {
    price?: string
    retail_price?: string
    savings_percent?: number
    store?: string
  }
  history?: {
    lowest?: string
    date?: string
    currency?: string
  }
  cn?: SteamCNPrice
  gap_to_low?: string
  is_at_low?: boolean
  source?: string
}

type SteamCNPrice = {
  available?: boolean
  currency?: string
  price?: string
  initial?: string
  discount_percent?: number
  formatted?: string
  source?: string
  reason?: string
}

type SteamInfo = {
  available?: boolean
  status?: string
  query?: string
  count?: number
  results?: SteamPrice[]
  provider?: string
  currency?: string
  at?: string | null
  error?: string
  account_linked?: boolean
  account_mode?: string
  sale?: SaleCalendar
  deals?: {
    available?: boolean
    status?: string
    count?: number
    results?: SteamDeal[]
    provider?: string
    currency?: string
    at?: string | null
    error?: string
    page?: number
    groups?: number
    pool?: number
  }
  free_to_play?: SteamFree[]
  free_to_play_updated?: string
  free_to_play_group?: number
  free_to_play_groups?: number
  account?: SteamAccount
  accelerator?: SteamAccelerator
  login?: string
}

type CodexOperator = {
  id: string
  name_cn: string
  name_en: string
  class: string
  rarity: number
  faction: string
  race?: string
  tags?: string[]
  role?: string
  class_color?: string
  initial?: string
}

type CodexSkin = { name: string; series?: string; release?: string; obtain?: string }

type CodexDetail = {
  skins?: CodexSkin[]
  skin_note?: string
  story?: { lines?: string[]; link?: string; link_label?: string; note?: string }
  tools?: CodexTool[]
}

type CodexTool = {
  id: string
  name: string
  kind: string
  url: string
  note?: string
  download?: boolean
}

type CodexSummary = {
  version?: string
  updated?: string
  total?: number
  classes?: Record<string, number>
  rarities?: Record<string, number>
  factions?: string[]
  disclaimer?: string
  class_colors?: Record<string, string>
}

type SteamAccount = {
  steam_id?: string
  nickname?: string
  real_name?: string
  avatar?: string
  online_state?: string
  privacy?: string
  linked_at?: string
}

type SteamAccelerator = {
  available?: boolean
  note?: string
  redirected?: string[]
  hosts_path?: string
}

type SteamDeal = SteamPrice & {
  hoard_worthy?: boolean
  deal_rating?: number
  steam_rating?: string
  steam_percent?: number
  metacritic?: number
  release_year?: number
  store_url?: string
}

type SteamFree = {
  app_id?: string
  title?: string
  title_cn?: string
  store_url?: string
  source?: string
}

type SaleEvent = {
  id?: string
  kind?: string
  name?: string
  start_at?: string | null
  end_at?: string | null
  status?: string
  starts_in_seconds?: number | null
  ends_in_seconds?: number | null
  time_confirmed?: boolean
  tbd?: boolean
}

type SaleCalendar = {
  updated?: string
  source?: string
  source_url?: string
  timezone?: string
  current?: SaleEvent | null
  next?: SaleEvent | null
  next_seasonal?: SaleEvent | null
  upcoming?: SaleEvent[]
  all?: SaleEvent[]
  evaluated_at?: string
}

type TokenCandle = {
  date: string
  open: number
  high: number
  low: number
  close: number
  output_open: number
  output_high: number
  output_low: number
  output_close: number
  samples: number
  baseline: boolean
}

type TokenTimePolicy = {
  kind?: "flat" | "deepseek_peak" | string
  timezone?: string
  peak_windows_utc?: Array<{ start: string; end: string }>
  local_windows?: Array<{ start: string; end: string }>
  local_timezone?: string
  weekdays?: number[]
  weekend_off_peak?: boolean
  off_peak_multiplier?: number
  peak_multiplier?: number
  note?: string
  peak_input?: number
  peak_output?: number
  peak_cache?: number
  off_peak_input?: number
  off_peak_output?: number
  off_peak_cache?: number
}

type TokenModel = {
  id: string
  provider: string
  provider_name: string
  provider_zh: string
  provider_region: string
  provider_color: string
  name: string
  input: number
  output: number
  cache_read: number
  cache_write?: number
  context?: number
  max_output?: number
  release_date?: string
  cache_discount?: number
  tier?: { threshold: number; input: number; output: number } | null
  time_policy?: TokenTimePolicy
}

type TokenRadar = {
  ok?: boolean
  status?: string
  message?: string
  source?: string
  source_url?: string
  currency?: string
  unit?: string
  fetched_at?: string
  checked_at?: string
  models?: TokenModel[]
  history?: Record<string, TokenCandle[]>
  history_meta?: { days?: number; baseline?: boolean; note?: string }
  time_note?: string
}

type BootEvent = { name?: string; at?: string; detail?: string }

type ShellState = {
  ok?: boolean
  shell?: ShellInfo
  modules?: ModuleInfo[]
  bridge?: BridgeInfo
  telemetry?: TelemetryInfo
  pulse?: PulseInfo
  web?: WebInfo
  steam?: SteamInfo
  token_radar?: TokenRadar
  codex?: CodexSummary
  ui_profile?: UiProfile
  events?: BootEvent[]
  preview?: boolean
}

type PulseStatus = "idle" | "running" | "success" | "error"
type WebStatus = "idle" | "searching" | "success" | "empty" | "error"

const VIEWS: Array<{ id: ViewId; key: string; glyph: string }> = [
  { id: "home", key: "nav.home", glyph: "⌂" },
  { id: "web", key: "nav.web", glyph: "◎" },
  { id: "steam", key: "nav.steam", glyph: "◈" },
  { id: "codex", key: "nav.codex", glyph: "▤" },
  { id: "tokens", key: "nav.tokens", glyph: "₮" },
  { id: "studio", key: "nav.studio", glyph: "✎" },
  { id: "core", key: "nav.core", glyph: "✦" },
  { id: "bridge", key: "nav.bridge", glyph: "⇄" },
  { id: "about", key: "nav.about", glyph: "♡" },
]

function actionById(actions: HostedAction[], id: string): HostedAction | undefined {
  return actions.find((action) => action.id === id || action.entry_id === id)
}

function unwrapResult(envelope: any): Record<string, any> {
  if (!envelope || typeof envelope !== "object") return {}
  if (envelope.result && typeof envelope.result === "object") return envelope.result
  if (envelope.data && typeof envelope.data === "object") return envelope.data
  return envelope
}

function formatUptime(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0))
  const days = Math.floor(safe / 86400)
  const hours = Math.floor((safe % 86400) / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

function safeStringArray(value: any): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item) => typeof item === "string" && item.length > 0)
}

function moduleTone(tone?: string): string {
  if (tone === "peach" || tone === "mint" || tone === "lilac" || tone === "sky") return tone
  return "sky"
}

function isHttpUrl(value: any): boolean {
  if (typeof value !== "string" || value.length > 2048) return false
  return /^https?:\/\//i.test(value.trim())
}

function usd(value: any): string {
  const number = Number(value)
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : "—"
}

function usdGap(value: any): string {
  const number = Number(value)
  if (!Number.isFinite(number)) return "—"
  const sign = number > 0 ? "+" : number < 0 ? "−" : ""
  return `${sign}$${Math.abs(number).toFixed(2)}`
}

function webDomain(result: WebResult): string {
  if (result.domain) return result.domain
  try {
    return new URL(String(result.url || "")).hostname.replace(/^www\./, "")
  } catch (_error) {
    return ""
  }
}

function normalizeHex(value: string): string {
  const text = String(value || "").trim().toLowerCase()
  const withHash = text.startsWith("#") ? text : `#${text}`
  return /^#[0-9a-f]{6}$/.test(withHash) ? withHash : ""
}

function hexLuminance(color: string): number {
  const hex = normalizeHex(color)
  if (!hex) return 0.5
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
  const linear = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

function ColorHexField(props: { value: string; label: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(props.value)
  const [bad, setBad] = useState(false)
  useEffect(() => {
    setDraft(props.value)
    setBad(false)
  }, [props.value])
  const commit = () => {
    const next = normalizeHex(draft)
    if (!next) {
      setBad(true)
      return
    }
    setBad(false)
    setDraft(next)
    props.onCommit(next)
  }
  return (
    <input
      className={`ama-hex-input${bad ? " is-bad" : ""}`}
      value={draft}
      maxLength={7}
      spellCheck={false}
      autoComplete="off"
      aria-label={props.label}
      aria-invalid={bad || undefined}
      onInput={(event: any) => setDraft(String(event.target.value))}
      onBlur={commit}
      onKeyDown={(event: any) => {
        if (event.key === "Enter") {
          event.preventDefault()
          commit()
        }
        if (event.key === "Escape") {
          setDraft(props.value)
          setBad(false)
        }
      }}
    />
  )
}

const STYLES = `
.ama-root {
  --ink: #22394c;
  --ink-soft: #3c5d74;
  --muted: #718b9e;
  --sky: #44b8f2;
  --sky-deep: #1f8fce;
  --sky-soft: #e5f7ff;
  --pink: #ffb6cf;
  --peach: #ffdcc8;
  --mint: #b9eedf;
  --lilac: #ddceff;
  --mint-ink: #24735d;
  --peach-ink: #9a563e;
  --lilac-ink: #69509b;
  --paper: #ffffff;
  --paper-2: #f8fcff;
  --card: rgba(255, 255, 255, 0.82);
  --panel-2: #f5fbff;
  --line: #dcecf7;
  --line-strong: #c8e2f2;
  --hover: #eaf7ff;
  --desktop-1: #edf9ff;
  --desktop-2: #dcefff;
  --desktop-3: #cfe8fa;
  --hero-1: #ffffff;
  --hero-2: #eaf8ff;
  --side-1: #fbfeff;
  --side-2: #f3fbff;
  --title-1: #ffffff;
  --title-2: #f4fbff;
  --window-shadow: 0 30px 80px rgba(58, 146, 197, 0.22), 0 4px 18px rgba(58, 146, 197, 0.08);
  --orb: radial-gradient(circle at 32% 25%, #ffffff 0%, #d5f5ff 40%, #9ce4ff 72%, #75cef5 100%);
  --logo-1: #7adcff;
  --logo-2: #36b4f0;
  --logo-3: #1f93d1;
  --grid-line: rgba(81, 165, 210, 0.09);
  --cloud: rgba(255, 255, 255, 0.78);
  --code-bg: #f3faff;
  --error: #d4546d;
  --success: #2c9d78;
  color-scheme: light;
  min-height: 100vh;
  background: var(--desktop-1);
  color: var(--ink);
  font-family: "Segoe UI", "Microsoft YaHei UI", "Hiragino Sans", "Noto Sans KR", system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
.ama-theme-dark {
  --ink: #e8f6ff;
  --ink-soft: #c3deed;
  --muted: #91adbf;
  --sky: #5ec9ff;
  --sky-deep: #8bdcff;
  --sky-soft: #14364a;
  --pink: #f29ec1;
  --peach: #c79077;
  --mint: #7ccdb5;
  --lilac: #b8a4e8;
  --mint-ink: #b6f4e2;
  --peach-ink: #ffd8c7;
  --lilac-ink: #e2d6ff;
  --paper: #16222f;
  --paper-2: #121c27;
  --card: rgba(29, 46, 63, 0.86);
  --panel-2: #1b2b3a;
  --line: #2b4256;
  --line-strong: #39556b;
  --hover: #1d3446;
  --desktop-1: #0c151f;
  --desktop-2: #102333;
  --desktop-3: #183345;
  --hero-1: #182a3a;
  --hero-2: #10202c;
  --side-1: #14202c;
  --side-2: #101923;
  --title-1: #1a2a38;
  --title-2: #14212d;
  --window-shadow: 0 34px 90px rgba(0, 0, 0, 0.45);
  --orb: radial-gradient(circle at 32% 25%, #e8fbff 0%, #a8e5fb 30%, #58bce8 65%, #2d85b5 100%);
  --logo-1: #8fe3ff;
  --logo-2: #3fa9dd;
  --logo-3: #1c6d99;
  --grid-line: rgba(117, 196, 238, 0.08);
  --cloud: rgba(105, 161, 192, 0.14);
  --code-bg: #0e1822;
  --error: #ff9ab0;
  --success: #8ae4c6;
  color-scheme: dark;
}
.ama-root, .ama-root *, .ama-root *::before, .ama-root *::after { box-sizing: border-box; }
.ama-desktop {
  position: relative;
  min-height: 100vh;
  padding: 26px;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  background:
    radial-gradient(circle at 13% 8%, rgba(255, 255, 255, 0.92), transparent 30%),
    radial-gradient(circle at 86% 14%, rgba(178, 236, 255, 0.66), transparent 32%),
    radial-gradient(circle at 74% 90%, rgba(255, 208, 226, 0.22), transparent 34%),
    linear-gradient(150deg, var(--desktop-1) 0%, var(--desktop-2) 50%, var(--desktop-3) 100%);
}
.ama-desktop::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: linear-gradient(to bottom, rgba(0,0,0,0.6), transparent 82%);
  pointer-events: none;
}
.ama-desktop::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(68, 148, 191, 0.07) 100%);
  pointer-events: none;
}
.ama-root[data-wallpaper="dots"] .ama-desktop::before {
  background-image: radial-gradient(var(--grid-line) 1.2px, transparent 1.2px);
  background-size: 20px 20px;
  mask-image: none;
}
.ama-root[data-wallpaper="aurora"] .ama-desktop::before {
  background:
    radial-gradient(circle at 18% 22%, color-mix(in srgb, var(--sky) 22%, transparent), transparent 38%),
    radial-gradient(circle at 78% 18%, color-mix(in srgb, var(--pink) 20%, transparent), transparent 42%),
    radial-gradient(circle at 60% 86%, color-mix(in srgb, var(--mint) 17%, transparent), transparent 45%);
  mask-image: none;
}
.ama-root[data-wallpaper="stars"] .ama-desktop::before {
  background-image:
    radial-gradient(1.2px 1.2px at 12% 24%, var(--sky) 50%, transparent 52%),
    radial-gradient(1px 1px at 32% 68%, var(--pink) 50%, transparent 52%),
    radial-gradient(1.4px 1.4px at 58% 18%, var(--sky) 50%, transparent 52%),
    radial-gradient(1px 1px at 74% 52%, var(--peach) 50%, transparent 52%),
    radial-gradient(1.1px 1.1px at 88% 76%, var(--sky) 50%, transparent 52%),
    radial-gradient(1px 1px at 44% 42%, var(--mint) 50%, transparent 52%);
  background-size: 220px 180px;
  mask-image: none;
  opacity: .55;
}
.ama-root[data-window-bg="glass"] .ama-window { backdrop-filter: blur(18px); }
.ama-root[data-wallpaper="plain"] .ama-desktop::before { display: none; }
.ama-root[data-radius="custom"] .ama-window { border-radius: calc(var(--ui-radius) + 6px) !important; }
.ama-root[data-radius="custom"] .ama-hero,
.ama-root[data-radius="custom"] .ama-panel,
.ama-root[data-radius="custom"] .ama-web-hero,
.ama-root[data-radius="custom"] .ama-web-result,
.ama-root[data-radius="custom"] .ama-web-state,
.ama-root[data-radius="custom"] .ama-sale-panel,
.ama-root[data-radius="custom"] .ama-picks-section,
.ama-root[data-radius="custom"] .ama-free-section,
.ama-root[data-radius="custom"] .ama-steam-card,
.ama-root[data-radius="custom"] .ama-deal-card,
.ama-root[data-radius="custom"] .ama-core-card,
.ama-root[data-radius="custom"] .ama-about-card { border-radius: var(--ui-radius) !important; }
.ama-root[data-density="compact"] .ama-content { padding: 14px 18px 14px; }
.ama-root[data-density="compact"] .ama-sidebar { gap: 9px; padding: 12px 10px; }
.ama-root[data-density="compact"] .ama-nav-btn { padding: 7px 9px; }
.ama-root[data-density="compact"] .ama-hero { padding: 16px; }
.ama-root[data-density="compact"] .ama-panel { padding: 11px; }
.ama-root[data-density="compact"] .ama-web-hero { padding: 15px; }
.ama-cloud { position: absolute; border-radius: 999px; background: var(--cloud); filter: blur(2px); pointer-events: none; opacity: .8; }
.ama-cloud.c1 { width: 180px; height: 54px; left: 4%; top: 18%; box-shadow: 54px -18px 0 -10px var(--cloud), 104px 6px 0 -16px var(--cloud); animation: ama-drift 16s ease-in-out infinite; }
.ama-cloud.c2 { width: 130px; height: 38px; right: 7%; top: 10%; box-shadow: 42px -13px 0 -8px var(--cloud), 80px 4px 0 -12px var(--cloud); animation: ama-drift 20s ease-in-out infinite reverse; }
.ama-cloud.c3 { width: 220px; height: 62px; right: 14%; bottom: 7%; opacity: .34; animation: ama-drift 24s ease-in-out infinite; }
.ama-spark { position: absolute; color: var(--sky); opacity: .42; font-size: 17px; animation: ama-twinkle 4s ease-in-out infinite; pointer-events: none; }
.ama-spark.s1 { left: 7%; top: 57%; }
.ama-spark.s2 { right: 4%; top: 43%; animation-delay: 1.4s; }
.ama-spark.s3 { left: 19%; bottom: 9%; font-size: 11px; animation-delay: 2.5s; }
.ama-window {
  position: relative;
  z-index: 1;
  width: min(1180px, 100%);
  height: calc(100vh - 52px);
  min-height: 680px;
  max-height: 900px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: 28px;
  border: 1px solid var(--line);
  background: var(--window-bg, var(--paper));
  box-shadow: var(--window-shadow);
  animation: ama-window-in .55s cubic-bezier(.2,.8,.2,1) both;
}
.ama-window.is-expanded { width: min(1320px, 100%); }
.ama-desktop.is-expanded { padding: 8px; }
.ama-desktop.is-expanded .ama-window { width: 100%; height: calc(100vh - 16px); max-height: none; border-radius: 20px; }
.ama-titlebar {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, var(--title-1), var(--title-2));
}
.ama-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.ama-logo, .ama-avatar, .ama-mini-icon {
  position: relative;
  isolation: isolate;
  background: linear-gradient(148deg, var(--logo-1) 0%, var(--logo-2) 54%, var(--logo-3) 100%);
  color: #ffffff;
  text-shadow: 0 1px 2px rgb(12 60 88 / 0.3);
}
.ama-logo, .ama-avatar, .ama-mini-icon { filter: drop-shadow(0 6px 14px rgba(47, 160, 213, 0.3)); }
.ama-logo::before, .ama-logo::after,
.ama-avatar::before, .ama-avatar::after,
.ama-mini-icon::before, .ama-mini-icon::after {
  content: "";
  position: absolute;
  top: -18%;
  width: 40%;
  height: 50%;
  z-index: -1;
  background: inherit;
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}
.ama-logo::before, .ama-avatar::before, .ama-mini-icon::before { left: 2%; transform: rotate(-12deg); }
.ama-logo::after, .ama-avatar::after, .ama-mini-icon::after { right: 2%; transform: rotate(12deg); }
.ama-logo { display: grid; place-items: center; width: 37px; height: 33px; flex: 0 0 auto; border-radius: 11px 11px 13px 13px; font-size: 16px; font-weight: 900; }
.ama-avatar { display: grid; place-items: center; width: 36px; height: 33px; flex: 0 0 auto; border-radius: 11px; font-size: 13px; font-weight: 900; }
.ama-mini-icon { display: grid; place-items: center; width: 31px; height: 29px; border-radius: 9px; font-size: 13px; }
.ama-brand-title { min-width: 0; }
.ama-brand-name { margin: 0; font-size: 14px; font-weight: 850; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ama-brand-sub { margin: 1px 0 0; font-size: 9px; font-weight: 750; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); white-space: nowrap; }
.ama-title-pills { display: flex; align-items: center; gap: 5px; margin-left: auto; }
.ama-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--card);
  color: var(--muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .1em;
  text-transform: uppercase;
  white-space: nowrap;
}
.ama-pill.is-beta { color: #a65d82; border-color: #f3d5e4; background: #fff5fa; }
.ama-pill.is-beta .ama-pill-dot { background: #f49fc2; }
.ama-pill-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--sky); }
.ama-window-actions { display: flex; align-items: center; gap: 3px; margin-left: 4px; }
.ama-win-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  transition: background .16s ease, color .16s ease, transform .16s ease;
}
.ama-win-btn:hover { background: var(--hover); color: var(--ink); }
.ama-win-btn:active { transform: scale(.94); }
.ama-win-btn.is-close:hover { background: #ffe5eb; color: #cf4260; }
.ama-body { display: grid; grid-template-columns: 208px minmax(0, 1fr); flex: 1; min-height: 0; overflow: hidden; }
.ama-sidebar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 17px 13px 15px;
  border-right: 1px solid var(--line);
  background: linear-gradient(180deg, var(--side-1), var(--side-2));
}
.ama-profile {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--card);
}

.ama-profile-name { margin: 0; font-size: 12px; font-weight: 850; }
.ama-profile-role { margin: 1px 0 0; font-size: 9.5px; color: var(--muted); }
.ama-profile-status { display: flex; align-items: center; gap: 5px; margin-top: 4px; font-size: 8.5px; color: var(--success); font-weight: 750; }
.ama-live-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 14%, transparent); }
.ama-nav { display: grid; gap: 3px; }
.ama-nav-btn {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 11.5px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  transition: background .16s ease, color .16s ease, box-shadow .16s ease;
}
.ama-nav-btn:hover { background: var(--hover); color: var(--ink); }
.ama-nav-btn.is-active {
  color: var(--sky-deep);
  background: linear-gradient(90deg, var(--sky-soft), transparent);
  box-shadow: inset 2px 0 0 var(--sky);
}
.ama-nav-glyph { display: grid; place-items: center; width: 19px; height: 19px; border-radius: 7px; background: rgba(255,255,255,.46); font-size: 11px; }
.ama-theme-dark .ama-nav-glyph { background: rgba(255,255,255,.07); }
.ama-nav-btn.is-active .ama-nav-glyph { background: #ffffff; box-shadow: 0 2px 8px rgba(56, 166, 219, .15); }
.ama-theme-dark .ama-nav-btn.is-active .ama-nav-glyph { background: #203d51; }
.ama-side-bottom { display: grid; gap: 8px; margin-top: auto; }
.ama-side-note {
  padding: 10px;
  border: 1px dashed var(--line-strong);
  border-radius: 12px;
  background: linear-gradient(150deg, var(--card), transparent);
  font-size: 9.5px;
  line-height: 1.5;
  color: var(--muted);
}
.ama-side-note strong { display: block; color: var(--ink-soft); font-size: 10px; margin-bottom: 2px; }
.ama-theme-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: var(--card);
  color: var(--muted);
  font: inherit;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: background .16s ease, color .16s ease;
}
.ama-theme-btn:hover { background: var(--hover); color: var(--ink); }
.ama-theme-icon { font-size: 13px; color: var(--sky-deep); }
.ama-content {
  min-width: 0;
  min-height: 0;
  padding: 24px 26px 22px;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}
.ama-content::-webkit-scrollbar { width: 7px; }
.ama-content::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 99px; }
.ama-kicker { display: flex; align-items: center; gap: 7px; color: var(--muted); font-size: 9px; font-weight: 850; letter-spacing: .16em; text-transform: uppercase; }
.ama-kicker .ama-kicker-line { width: 17px; height: 1px; background: var(--sky); opacity: .75; }
.ama-view-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.ama-view-title { margin: 6px 0 0; font-size: 27px; line-height: 1.08; letter-spacing: -.035em; }
.ama-view-sub { margin: 6px 0 0; max-width: 620px; color: var(--muted); font-size: 11.5px; line-height: 1.6; }
.ama-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 228px;
  gap: 14px;
  overflow: hidden;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: linear-gradient(140deg, var(--hero-1) 0%, var(--hero-2) 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9);
}
.ama-hero::after {
  content: "";
  position: absolute;
  width: 300px;
  height: 300px;
  right: -128px;
  top: -136px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 178, 210, .18), transparent 62%);
  pointer-events: none;
}
.ama-hero-copy { position: relative; z-index: 1; display: flex; flex-direction: column; justify-content: center; }
.ama-hero-title { margin: 9px 0 5px; font-size: clamp(25px, 3.2vw, 38px); line-height: 1.06; letter-spacing: -.045em; }
.ama-hero-line { margin: 0; max-width: 470px; color: var(--ink-soft); font-size: 12px; line-height: 1.65; }
.ama-hero-caption { margin: 8px 0 0; max-width: 440px; color: var(--muted); font-size: 10.5px; line-height: 1.6; }
.ama-hero-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin-top: 17px; }
.ama-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 0;
  border-radius: 11px;
  padding: 9px 13px;
  font: inherit;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  transition: transform .16s ease, box-shadow .16s ease, opacity .16s ease, background .16s ease;
}
.ama-btn:hover { transform: translateY(-1px); }
.ama-btn:active { transform: translateY(0) scale(.985); }
.ama-btn:disabled { opacity: .6; cursor: wait; transform: none; }
.ama-btn-primary { color: #083247; background: linear-gradient(135deg, #74d9ff 0%, #42b9ef 58%, #2ca8e3 100%); box-shadow: 0 8px 18px rgba(51, 168, 222, 0.25); }
.ama-btn-primary:hover { box-shadow: 0 10px 24px rgba(51, 168, 222, 0.33); }
.ama-btn-ghost { color: var(--ink-soft); background: var(--card); border: 1px solid var(--line); box-shadow: 0 3px 10px rgba(58, 146, 197, 0.05); }
.ama-btn-ghost:hover { background: var(--hover); }
.ama-btn-quiet { color: var(--sky-deep); background: transparent; padding-inline: 5px; }
.ama-pulse-line { display: flex; align-items: center; gap: 6px; min-height: 16px; margin: 11px 0 0; color: var(--muted); font-size: 9.5px; }
.ama-pulse-line.is-success { color: var(--success); }
.ama-pulse-line.is-error { color: var(--error); }
.ama-pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: 0 0 auto; }
.ama-pulse-line.is-running .ama-pulse-dot { animation: ama-blink .85s ease-in-out infinite; }
.ama-orb-wrap { position: relative; display: grid; place-items: center; min-height: 188px; }
.ama-orb {
  position: relative;
  display: grid;
  place-items: center;
  width: 196px;
  height: 196px;
  border-radius: 50%;
  background: var(--orb);
  box-shadow: 0 22px 50px rgba(54, 161, 213, 0.25), inset 0 0 0 1px rgba(255,255,255,.75);
  animation: ama-float 6s ease-in-out infinite;
}
.ama-orb::before { content: ""; position: absolute; inset: 12px; border: 1px dashed rgba(255,255,255,.66); border-radius: 50%; }
.ama-orb::after { content: ""; position: absolute; width: 62%; height: 20%; bottom: 23px; border-radius: 50%; background: rgba(58, 155, 202, .18); filter: blur(9px); }
.ama-cat { position: relative; width: 112px; height: 102px; z-index: 1; }
.ama-cat-ear { position: absolute; top: -11px; width: 38px; height: 35px; background: linear-gradient(140deg, #66d2ff, #279ed6); clip-path: polygon(50% 0, 100% 100%, 0 100%); z-index: 0; }
.ama-cat-ear.left { left: 4px; transform: rotate(-10deg); }
.ama-cat-ear.right { right: 4px; transform: rotate(10deg); }
.ama-cat-face {
  position: absolute;
  inset: 8px 0 0;
  z-index: 1;
  border-radius: 45% 45% 43% 43% / 38% 38% 56% 56%;
  background: linear-gradient(160deg, #66d4ff 0%, #36b9ee 48%, #219cd6 100%);
  box-shadow: inset 0 -13px 22px rgba(8, 82, 121, .16), 0 12px 28px rgba(28, 132, 181, .22);
}
.ama-cat-eye { position: absolute; top: 40%; width: 12px; height: 16px; border-radius: 50%; background: #0a374d; box-shadow: inset 0 2px 3px rgba(255,255,255,.2); }
.ama-cat-eye.left { left: 28%; }
.ama-cat-eye.right { right: 28%; }
.ama-cat-eye::after { content: ""; position: absolute; width: 4px; height: 4px; top: 3px; left: 3px; border-radius: 50%; background: rgba(255,255,255,.85); }
.ama-cat-blush { position: absolute; top: 57%; width: 16px; height: 7px; border-radius: 50%; background: rgba(255, 160, 194, .5); filter: blur(1px); }
.ama-cat-blush.left { left: 13%; }
.ama-cat-blush.right { right: 13%; }
.ama-cat-mouth { position: absolute; left: 50%; top: 57%; transform: translateX(-50%); color: #ffffff; font-size: 14px; font-weight: 900; letter-spacing: 1px; text-shadow: 0 1px 2px rgba(4,74,108,.2); }
.ama-orb-spark { position: absolute; color: #ffffff; text-shadow: 0 0 10px rgba(255,255,255,.9); animation: ama-twinkle 3.2s ease-in-out infinite; }
.ama-orb-spark.a { top: 12%; right: 13%; font-size: 21px; }
.ama-orb-spark.b { bottom: 16%; left: 8%; font-size: 12px; animation-delay: 1.4s; }
.ama-orb-spark.c { top: 28%; left: 6%; font-size: 8px; animation-delay: 2.1s; }
.ama-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; margin-top: 12px; }
.ama-metric { min-width: 0; padding: 12px 13px; border: 1px solid var(--line); border-radius: 15px; background: var(--card); }
.ama-metric-label { margin: 0; color: var(--muted); font-size: 9px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ama-metric-value { margin: 5px 0 0; color: var(--ink); font-size: 19px; font-weight: 850; letter-spacing: -.035em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ama-metric-value small { margin-left: 3px; color: var(--muted); font-size: 9px; font-weight: 650; letter-spacing: 0; }
.ama-columns { display: grid; grid-template-columns: minmax(0, 1.28fr) minmax(0, .82fr); gap: 12px; margin-top: 12px; align-items: start; }
.ama-panel { min-width: 0; padding: 15px; border: 1px solid var(--line); border-radius: 17px; background: var(--card); }
.ama-panel + .ama-panel { margin-top: 10px; }
.ama-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
.ama-panel-title { margin: 0; font-size: 13px; font-weight: 850; letter-spacing: -.015em; }
.ama-panel-hint { margin: 3px 0 0; color: var(--muted); font-size: 9.5px; line-height: 1.5; }
.ama-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  padding: 3px 7px;
  border-radius: 999px;
  background: var(--sky-soft);
  color: var(--sky-deep);
  font-size: 8px;
  font-weight: 850;
  letter-spacing: .08em;
  text-transform: uppercase;
  white-space: nowrap;
}
.ama-badge.is-mint { color: var(--mint-ink); background: color-mix(in srgb, var(--mint) 25%, transparent); }
.ama-badge.is-peach { color: var(--peach-ink); background: color-mix(in srgb, var(--peach) 26%, transparent); }
.ama-badge.is-lilac { color: var(--lilac-ink); background: color-mix(in srgb, var(--lilac) 25%, transparent); }
.ama-badge.is-muted { color: var(--muted); background: var(--panel-2); border: 1px solid var(--line); }
.ama-module-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.ama-module {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: var(--panel-2);
  transition: transform .16s ease, border-color .16s ease, background .16s ease;
}
.ama-module:hover { transform: translateY(-1px); border-color: var(--line); }
.ama-module.is-reserved { opacity: .72; }
.ama-module-top { display: flex; align-items: center; gap: 7px; min-width: 0; }
.ama-module-icon { display: grid; place-items: center; width: 27px; height: 27px; flex: 0 0 auto; border-radius: 9px; font-size: 13px; color: var(--ink-soft); }
.tone-sky { background: color-mix(in srgb, var(--sky) 18%, transparent); color: var(--sky-deep); }
.tone-peach { background: color-mix(in srgb, var(--peach) 42%, transparent); color: var(--peach-ink); }
.tone-mint { background: color-mix(in srgb, var(--mint) 40%, transparent); color: var(--mint-ink); }
.tone-lilac { background: color-mix(in srgb, var(--lilac) 42%, transparent); color: var(--lilac-ink); }
.ama-module-name { margin: 0; min-width: 0; font-size: 10.5px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ama-module-desc { margin: 0; color: var(--muted); font-size: 9px; line-height: 1.45; }
.ama-module-status { display: flex; align-items: center; gap: 4px; margin-top: 1px; color: var(--success); font-size: 8px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
.ama-module.is-reserved .ama-module-status { color: var(--muted); }
.ama-status-dot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
.ama-rows { display: grid; gap: 0; }
.ama-row { display: flex; align-items: baseline; justify-content: space-between; gap: 9px; padding: 6px 0; border-bottom: 1px dashed var(--line); font-size: 9.5px; }
.ama-row:last-child { border-bottom: 0; }
.ama-row-key { flex: 0 0 auto; color: var(--muted); }
.ama-row-val { min-width: 0; color: var(--ink-soft); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 9px; text-align: right; overflow-wrap: anywhere; }
.ama-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.ama-chip { padding: 3px 6px; border-radius: 6px; border: 1px solid var(--line); background: var(--panel-2); color: var(--muted); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 8px; line-height: 1.4; }
.ama-code { max-height: 210px; overflow: auto; margin: 8px 0 0; padding: 11px; border: 1px solid var(--line); border-radius: 11px; background: var(--code-bg); color: var(--ink-soft); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 8.5px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
.ama-details { margin-top: 8px; }
.ama-details summary { cursor: pointer; color: var(--sky-deep); font-size: 9.5px; font-weight: 750; }
.ama-web-hero {
  position: relative;
  overflow: hidden;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background:
    radial-gradient(circle at 88% 14%, rgba(255, 183, 210, 0.16), transparent 27%),
    linear-gradient(140deg, var(--hero-1), var(--hero-2));
}
.ama-web-hero::after {
  content: "";
  position: absolute;
  width: 220px;
  height: 220px;
  right: -90px;
  bottom: -120px;
  border-radius: 50%;
  border: 1px dashed var(--line-strong);
  pointer-events: none;
}
.ama-web-form {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 7px;
  align-items: stretch;
  margin-top: 14px;
}
.ama-web-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  padding: 0 12px;
  border: 1px solid var(--line-strong);
  border-radius: 12px;
  background: var(--paper);
  box-shadow: 0 5px 16px rgba(58, 146, 197, 0.06);
  transition: border-color .16s ease, box-shadow .16s ease;
}
.ama-web-input-wrap:focus-within { border-color: var(--sky); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sky) 15%, transparent); }
.ama-web-glyph { flex: 0 0 auto; color: var(--sky-deep); font-size: 17px; line-height: 1; }
.ama-web-input {
  width: 100%;
  min-width: 0;
  padding: 10px 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 12px;
}
.ama-web-input::placeholder { color: var(--muted); }
.ama-web-submit { flex: 0 0 auto; min-width: 78px; }
.ama-web-suggestions { position: relative; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-top: 10px; }
.ama-web-suggestions-label { color: var(--muted); font-size: 8.5px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
.ama-web-chip {
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--card);
  color: var(--muted);
  font: inherit;
  font-size: 8.5px;
  cursor: pointer;
  transition: border-color .16s ease, color .16s ease, background .16s ease;
}
.ama-web-chip:hover { border-color: var(--sky); background: var(--sky-soft); color: var(--sky-deep); }
.ama-web-note { position: relative; z-index: 1; margin: 11px 0 0; color: var(--muted); font-size: 8.5px; line-height: 1.55; }
.ama-web-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin: 12px 1px 7px; min-height: 18px; color: var(--muted); font-size: 9px; }
.ama-web-meta strong { color: var(--ink-soft); font-weight: 800; }
.ama-web-meta .ama-badge { margin-left: auto; }
.ama-web-list { display: grid; gap: 7px; }
.ama-web-result {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 9px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: var(--card);
  transition: border-color .16s ease, transform .16s ease;
}
.ama-web-result:hover { border-color: var(--line-strong); transform: translateY(-1px); }
.ama-web-rank { display: grid; place-items: center; align-self: start; width: 24px; height: 24px; border-radius: 8px; background: var(--panel-2); color: var(--sky-deep); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 9px; font-weight: 800; }
.ama-web-result-body { min-width: 0; }
.ama-web-result-top { display: flex; align-items: center; gap: 6px; min-width: 0; }
.ama-web-domain { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--sky-deep); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 8px; font-weight: 750; }
.ama-web-result-title { margin: 4px 0 0; font-size: 12px; font-weight: 800; line-height: 1.4; overflow-wrap: anywhere; }
.ama-web-snippet { margin: 4px 0 0; color: var(--muted); font-size: 9.5px; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ama-web-actions { display: flex; align-items: center; gap: 7px; margin-top: 7px; min-width: 0; }
.ama-web-url { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 8px; opacity: .8; }
.ama-web-open.neko-button, .ama-web-open.neko-download {
  flex: 0 0 auto;
  min-height: 0;
  padding: 4px 9px;
  border: 1px solid var(--line-strong);
  border-radius: 7px;
  background: var(--sky-soft);
  color: var(--sky-deep);
  box-shadow: none;
  font: inherit;
  font-size: 8.5px;
  font-weight: 800;
  line-height: 1.5;
}
.ama-web-open.neko-button:hover, .ama-web-open.neko-download:hover { background: var(--hover); color: var(--sky-deep); }
.ama-web-state { display: grid; place-items: center; min-height: 170px; padding: 24px; text-align: center; border: 1px dashed var(--line-strong); border-radius: 15px; background: var(--panel-2); }
.ama-web-state-glyph { display: grid; place-items: center; width: 45px; height: 45px; border-radius: 14px; background: var(--sky-soft); color: var(--sky-deep); font-size: 21px; }
.ama-web-state h3 { margin: 10px 0 3px; font-size: 13px; }
.ama-web-state p { max-width: 350px; margin: 0; color: var(--muted); font-size: 9.5px; line-height: 1.6; }
.ama-web-state.is-error .ama-web-state-glyph { background: color-mix(in srgb, var(--error) 12%, transparent); color: var(--error); }
.ama-web-spinner { width: 20px; height: 20px; border: 2px solid var(--line-strong); border-top-color: var(--sky); border-radius: 50%; animation: ama-spin .8s linear infinite; }
.ama-web-provider { display: inline-flex; align-items: center; gap: 4px; padding: 3px 6px; border-radius: 6px; background: var(--panel-2); color: var(--muted); font-size: 8px; font-weight: 700; }
.ama-web-provider.is-fallback { color: var(--peach-ink); background: color-mix(in srgb, var(--peach) 22%, transparent); }
.ama-sale-panel {
  padding: 14px;
  margin-bottom: 12px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: linear-gradient(140deg, var(--hero-1), color-mix(in srgb, var(--peach) 9%, var(--hero-2)));
}
.ama-sale-current {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 8px;
  padding: 7px 9px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--panel-2);
  color: var(--muted);
  font-size: 9px;
}
.ama-sale-current.is-active { color: var(--mint-ink); background: color-mix(in srgb, var(--mint) 18%, transparent); border-color: color-mix(in srgb, var(--mint) 45%, var(--line)); }
.ama-sale-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); flex: 0 0 auto; }
.ama-sale-current.is-active .ama-sale-dot { background: var(--mint-ink); box-shadow: 0 0 0 3px color-mix(in srgb, var(--mint) 28%, transparent); }
.ama-sale-highlights { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin-top: 8px; }
.ama-sale-highlight { min-width: 0; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); }
.ama-sale-label { display: flex; align-items: center; gap: 5px; color: var(--muted); font-size: 8px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.ama-sale-highlight strong { display: block; margin-top: 4px; color: var(--ink-soft); font-size: 10.5px; line-height: 1.4; }
.ama-sale-highlight small { display: block; margin-top: 2px; color: var(--muted); font-size: 8.5px; }
.ama-sale-highlight em { display: block; margin-top: 5px; color: var(--sky-deep); font-size: 9px; font-style: normal; font-weight: 800; }
.ama-sale-kind { display: inline-flex; padding: 2px 5px; border-radius: 5px; background: var(--panel-2); color: var(--muted); font-size: 7px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; }
.ama-sale-details { margin-top: 7px; }
.ama-sale-details summary { cursor: pointer; color: var(--sky-deep); font-size: 9px; font-weight: 750; }
.ama-sale-list { display: grid; gap: 2px; margin-top: 5px; }
.ama-sale-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px dashed var(--line); font-size: 8.5px; }
.ama-sale-row:last-child { border-bottom: 0; }
.ama-sale-row-main { min-width: 0; }
.ama-sale-row-name { color: var(--ink-soft); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ama-sale-row-date { margin-top: 1px; color: var(--muted); font-size: 7.5px; font-family: ui-monospace, "Cascadia Code", Consolas, monospace; }
.ama-sale-row-kind { flex: 0 0 auto; color: var(--muted); font-size: 7.5px; }
.ama-sale-source { margin: 8px 0 0; color: var(--muted); font-size: 7.5px; line-height: 1.5; }
.ama-steam-tabs { display: flex; gap: 5px; margin: 0 0 10px; }
.ama-steam-tab { padding: 6px 11px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); color: var(--muted); font: inherit; font-size: 9px; font-weight: 750; cursor: pointer; transition: background .16s ease, color .16s ease, border-color .16s ease; }
.ama-steam-tab:hover { color: var(--ink-soft); border-color: var(--line-strong); }
.ama-steam-tab.is-active { background: var(--sky-soft); border-color: color-mix(in srgb, var(--sky) 45%, var(--line)); color: var(--sky-deep); }
.ama-picks-section, .ama-free-section { padding: 14px; margin-bottom: 12px; border: 1px solid var(--line); border-radius: 16px; background: var(--card); }
.ama-deal-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.ama-deal-card { display: flex; flex-direction: column; min-width: 0; padding: 11px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel-2); }
.ama-deal-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-height: 18px; }
.ama-deal-discount { flex: 0 0 auto; padding: 2px 6px; border-radius: 5px; background: var(--mint); color: var(--mint-ink); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 9px; font-weight: 900; }
.ama-hoard { display: inline-flex; align-items: center; padding: 2px 6px; border-radius: 999px; background: color-mix(in srgb, var(--peach) 30%, transparent); color: var(--peach-ink); font-size: 7px; font-weight: 800; letter-spacing: .03em; white-space: nowrap; }
.ama-deal-title { margin: 4px 0 0; color: var(--ink); font-size: 12px; font-weight: 850; line-height: 1.35; overflow-wrap: anywhere; }
.ama-deal-title-alt { margin-top: 1px; color: var(--ink-soft); font-size: 9px; font-weight: 600; overflow-wrap: anywhere; }
.ama-deal-price-row { display: flex; align-items: baseline; gap: 7px; margin-top: 6px; }
.ama-deal-price-row strong { color: var(--sky-deep); font-size: 17px; font-weight: 900; letter-spacing: -.03em; }
.ama-deal-price-row s { color: var(--muted); font-size: 9px; }
.ama-deal-cn { display: flex; align-items: baseline; gap: 5px; margin-top: 3px; color: var(--peach-ink); font-size: 8px; }
.ama-deal-cn strong { font-size: 11px; font-weight: 850; }
.ama-deal-cn small { color: var(--muted); font-size: 7.5px; }
.ama-deal-meta { display: grid; gap: 2px; margin-top: 7px; padding-top: 7px; border-top: 1px dashed var(--line); color: var(--muted); font-size: 8px; }
.ama-deal-meta span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ama-deal-actions { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 8px; }
.ama-deal-actions > span { color: var(--muted); font-size: 7px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ama-free-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
.ama-free-card { min-width: 0; padding: 9px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); }
.ama-free-top { display: flex; align-items: center; justify-content: space-between; gap: 5px; }
.ama-free-badge { padding: 2px 6px; border-radius: 5px; background: color-mix(in srgb, var(--mint) 25%, transparent); color: var(--mint-ink); font-size: 7px; font-weight: 900; letter-spacing: .08em; }
.ama-free-title { margin: 5px 0 0; color: var(--ink-soft); font-size: 10px; font-weight: 800; line-height: 1.35; overflow-wrap: anywhere; }
.ama-free-title-alt { margin-top: 1px; color: var(--ink-soft); font-size: 8.5px; font-weight: 600; overflow-wrap: anywhere; }
.ama-free-actions { margin-top: 7px; }
.ama-steam-account {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 13px;
  margin-bottom: 12px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: linear-gradient(135deg, var(--card), color-mix(in srgb, var(--sky-soft) 42%, transparent));
}
.ama-steam-account-icon { display: grid; place-items: center; width: 32px; height: 32px; flex: 0 0 auto; border-radius: 10px; background: #223b52; color: #dff6ff; font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 14px; font-weight: 900; }
.ama-steam-account-main { min-width: 0; }
.ama-steam-account-title { margin: 0; color: var(--ink-soft); font-size: 10px; font-weight: 850; }
.ama-steam-account-note { margin: 2px 0 0; color: var(--muted); font-size: 8.5px; line-height: 1.5; }
.ama-steam-account .ama-badge { margin-left: auto; flex: 0 0 auto; }
.ama-steam-account.is-linked { border-color: color-mix(in srgb, var(--mint) 45%, var(--line)); }
.ama-steam-avatar { width: 32px; height: 32px; flex: 0 0 auto; border-radius: 9px; object-fit: cover; border: 1px solid var(--line); }
.ama-steam-account-warn { margin: 3px 0 0; color: var(--danger); font-size: 8.5px; line-height: 1.5; }
.ama-steam-login-link { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin-top: 5px; }
.ama-steam-login-link span { color: var(--muted); font-size: 8px; }
.ama-steam-login-url { flex: 1 0 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 7px; user-select: all; }
.ama-steam-account .ama-btn, .ama-steam-account .ama-web-chip { margin-left: auto; flex: 0 0 auto; }
.ama-steam-hero { background: linear-gradient(140deg, var(--hero-1), color-mix(in srgb, var(--sky-soft) 55%, var(--hero-2))); }
.ama-steam-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.ama-steam-card { display: flex; flex-direction: column; min-width: 0; padding: 13px; border: 1px solid var(--line); border-radius: 15px; background: var(--card); transition: border-color .16s ease, transform .16s ease; }
.ama-steam-card:hover { border-color: var(--line-strong); transform: translateY(-1px); }
.ama-steam-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.ama-steam-app { color: var(--muted); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 8px; font-weight: 700; letter-spacing: .04em; }
.ama-steam-title { margin: 3px 0 0; font-size: 13px; font-weight: 850; line-height: 1.35; overflow-wrap: anywhere; }
.ama-steam-title-alt { margin-top: 1px; color: var(--ink-soft); font-size: 10px; font-weight: 600; overflow-wrap: anywhere; }
.ama-steam-low { flex: 0 0 auto; padding: 3px 7px; border-radius: 999px; background: var(--panel-2); color: var(--muted); font-size: 8px; font-weight: 850; letter-spacing: .06em; text-transform: uppercase; }
.ama-steam-low.is-low { background: color-mix(in srgb, var(--mint) 30%, transparent); color: var(--mint-ink); }
.ama-steam-prices { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: 11px; }
.ama-steam-price { min-width: 0; padding: 8px; border-radius: 9px; background: var(--panel-2); }
.ama-steam-price > span { display: block; color: var(--muted); font-size: 8px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ama-steam-price > strong { display: block; margin-top: 3px; color: var(--ink); font-size: 14px; font-weight: 850; letter-spacing: -.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ama-steam-price.is-low > strong { color: var(--mint-ink); }
.ama-steam-price.is-cn > strong { color: var(--peach-ink); }
.ama-steam-price > small { display: block; margin-top: 2px; color: var(--muted); font-size: 7.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ama-steam-meta { display: flex; flex-wrap: wrap; gap: 4px 8px; margin-top: 9px; padding-top: 8px; border-top: 1px dashed var(--line); color: var(--muted); font-size: 8px; }
.ama-steam-meta span { white-space: nowrap; }
.ama-boot-list { display: grid; gap: 1px; margin-top: 4px; }
.ama-boot-row { display: grid; grid-template-columns: 50px 6px minmax(0, 1fr); align-items: center; gap: 7px; padding: 4px 0; font-size: 9px; }
.ama-boot-time { color: var(--muted); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 8px; }
.ama-boot-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--sky); }
.ama-boot-label { min-width: 0; color: var(--ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ama-split { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, .85fr); gap: 12px; align-items: start; }
.ama-core-card {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 19px;
  background: linear-gradient(135deg, var(--hero-1), var(--hero-2));
}
.ama-core-card .ama-orb { width: 142px; height: 142px; animation-duration: 7s; }
.ama-core-card .ama-cat { transform: scale(.76); }
.ama-core-title { margin: 0 0 5px; font-size: 18px; letter-spacing: -.03em; }
.ama-core-body { margin: 0; color: var(--muted); font-size: 10.5px; line-height: 1.65; }
.ama-about-card { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 22px; align-items: center; padding: 24px; border: 1px solid var(--line); border-radius: 22px; background: linear-gradient(135deg, var(--hero-1), var(--hero-2)); }
.ama-about-orb { min-height: 190px; }
.ama-about-orb .ama-orb { width: 176px; height: 176px; }
.ama-about-title { margin: 0; font-size: 23px; letter-spacing: -.035em; }
.ama-about-body { margin: 7px 0 0; color: var(--ink-soft); font-size: 11px; line-height: 1.7; }
.ama-about-credit { margin: 12px 0 0; color: var(--muted); font-size: 9.5px; font-weight: 650; }
.ama-note { margin: 10px 0 0; padding: 9px 11px; border: 1px dashed var(--line-strong); border-radius: 10px; color: var(--muted); font-size: 9px; line-height: 1.55; background: color-mix(in srgb, var(--sky-soft) 45%, transparent); }
.ama-footer { display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 7px 17px; border-top: 1px solid var(--line); background: var(--paper-2); color: var(--muted); font-size: 8.5px; }
.ama-footer strong { color: var(--ink-soft); font-weight: 750; }
.ama-footer-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.ama-footer-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--success); }
.ama-mini {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 11px;
  width: min(560px, 100%);
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 17px;
  background: var(--paper);
  box-shadow: var(--window-shadow);
  animation: ama-window-in .3s ease both;
}

.ama-mini-copy { min-width: 0; }
.ama-mini-copy strong { display: block; font-size: 10px; color: var(--ink-soft); }
.ama-mini-copy span { display: block; font-size: 8px; color: var(--muted); }
.ama-mini .ama-btn { margin-left: auto; }
.ama-sleep {
  position: relative;
  display: grid;
  place-items: center;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 30px;
  text-align: center;
  background:
    radial-gradient(circle at 50% 28%, rgba(132, 212, 255, .2), transparent 35%),
    linear-gradient(160deg, var(--hero-1), var(--hero-2));
}
.ama-sleep::before { content: ""; position: absolute; width: 520px; height: 520px; border-radius: 50%; border: 1px dashed var(--line); opacity: .7; pointer-events: none; }
.ama-sleep-card { position: relative; z-index: 2; }
.ama-moon { display: grid; place-items: center; width: 92px; height: 92px; border-radius: 50%; background: var(--orb); box-shadow: 0 16px 45px rgba(69, 165, 212, .22); color: #2b9ed6; font-size: 39px; animation: ama-float 7s ease-in-out infinite; }
.ama-sleep h2 { margin: 20px 0 4px; font-size: 25px; letter-spacing: -.04em; }
.ama-sleep p { margin: 0; max-width: 360px; color: var(--muted); font-size: 10.5px; line-height: 1.65; }
.ama-sleep .ama-btn { margin-top: 18px; }
.ama-sleep-stars { position: absolute; inset: 0; pointer-events: none; color: var(--sky); opacity: .45; }
.ama-sleep-stars span { position: absolute; animation: ama-twinkle 3.4s ease-in-out infinite; }
.ama-sleep-stars span:nth-child(1) { left: 17%; top: 16%; font-size: 14px; }
.ama-sleep-stars span:nth-child(2) { right: 18%; top: 22%; font-size: 9px; animation-delay: 1.2s; }
.ama-sleep-stars span:nth-child(3) { left: 25%; bottom: 17%; font-size: 10px; animation-delay: 2.2s; }
.ama-sleep-stars span:nth-child(4) { right: 23%; bottom: 13%; font-size: 16px; animation-delay: .7s; }
.ama-empty { padding: 26px 10px; text-align: center; color: var(--muted); font-size: 10px; }
.ama-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.ama-studio-layout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(250px, .65fr); gap: 12px; align-items: start; }
.ama-studio-panel { min-width: 0; }
.ama-studio-group { padding: 11px 0; border-top: 1px dashed var(--line); }
.ama-studio-group:first-of-type { border-top: 0; padding-top: 0; }
.ama-studio-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 7px; color: var(--ink-soft); font-size: 9px; font-weight: 850; }
.ama-studio-label small { color: var(--muted); font-size: 8px; font-weight: 600; }
.ama-studio-presets { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
.ama-preset { display: flex; align-items: center; gap: 6px; min-width: 0; padding: 8px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2); color: var(--ink-soft); font: inherit; font-size: 8px; font-weight: 750; cursor: pointer; text-align: left; }
.ama-preset:hover { border-color: var(--line-strong); }
.ama-preset.is-active { border-color: var(--sky); box-shadow: 0 0 0 2px color-mix(in srgb, var(--sky) 14%, transparent); }
.ama-preset-dot { width: 14px; height: 14px; flex: 0 0 auto; border-radius: 50%; }
.ama-swatches { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
.ama-swatch { width: 22px; height: 22px; padding: 2px; border: 2px solid transparent; border-radius: 50%; background: var(--card); cursor: pointer; }
.ama-swatch span { display: block; width: 100%; height: 100%; border-radius: 50%; }
.ama-swatch.is-active { border-color: var(--ink-soft); }
.ama-studio-color { width: 34px; height: 28px; padding: 1px; border: 1px solid var(--line); border-radius: 7px; background: var(--card); cursor: pointer; }
.ama-studio-seg { display: flex; flex-wrap: wrap; gap: 5px; }
.ama-studio-seg button { padding: 6px 9px; border: 1px solid var(--line); border-radius: 7px; background: var(--panel-2); color: var(--muted); font: inherit; font-size: 8px; font-weight: 700; cursor: pointer; }
.ama-studio-seg button.is-active { border-color: var(--sky); background: var(--sky-soft); color: var(--sky-deep); }
.ama-studio-seg button:disabled { opacity: .42; cursor: not-allowed; }
.ama-studio-image-row { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin-top: 7px; }
.ama-file-button { display: inline-flex; align-items: center; justify-content: center; min-height: 28px; padding: 5px 9px; border: 1px solid var(--line); border-radius: 7px; background: var(--panel-2); color: var(--ink-soft); font-size: 8px; font-weight: 700; cursor: pointer; }
.ama-file-button:hover { border-color: var(--sky); color: var(--sky-deep); }
.ama-file-input { display: none; }
.ama-studio-image-preview { width: 58px; height: 36px; object-fit: cover; border: 1px solid var(--line); border-radius: 7px; }
.ama-gradient-editor { margin-top: 8px; padding: 8px; border: 1px dashed var(--line-strong); border-radius: 9px; background: var(--panel-2); }
.ama-gradient-preview { height: 28px; margin-bottom: 8px; border: 1px solid var(--line); border-radius: 7px; }
.ama-gradient-colors { display: grid; gap: 3px; max-height: 160px; overflow: auto; padding-right: 2px; }
.ama-gradient-row { display: grid; grid-template-columns: 20px 30px minmax(0, 1fr) 20px; align-items: center; gap: 5px; }
.ama-gradient-index { color: var(--muted); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 7px; }
.ama-gradient-row code { color: var(--ink-soft); font-size: 8px; }
.ama-gradient-remove { display: grid; place-items: center; width: 18px; height: 18px; padding: 0; border: 1px solid var(--line); border-radius: 5px; background: var(--card); color: var(--muted); font: inherit; font-size: 11px; cursor: pointer; }
.ama-gradient-remove:disabled { opacity: .3; cursor: not-allowed; }
.ama-hex-input {
  width: 72px;
  min-height: 22px;
  padding: 2px 6px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel-2);
  color: var(--ink-soft);
  font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
  font-size: 8px;
  letter-spacing: .02em;
}
.ama-hex-input:focus { outline: none; border-color: var(--sky); box-shadow: 0 0 0 2px color-mix(in srgb, var(--sky) 26%, transparent); }
.ama-hex-input.is-bad { border-color: var(--error); color: var(--error); box-shadow: 0 0 0 2px color-mix(in srgb, var(--error) 20%, transparent); }
.ama-color-row { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin-top: 7px; }
.ama-recent-row { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
.ama-recent-row > span { color: var(--muted); font-size: 7.5px; }
.ama-recent-dot { width: 15px; height: 15px; padding: 0; border: 1px solid var(--line-strong); border-radius: 5px; cursor: pointer; }
.ama-recent-dot.is-active { box-shadow: 0 0 0 2px color-mix(in srgb, var(--sky) 45%, transparent); }
.ama-gradient-tools { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
.ama-studio-sound-row { display: flex; align-items: center; gap: 7px; margin-top: 7px; }
.ama-studio-sound-row > span { flex: 0 0 auto; color: var(--muted); font-size: 8px; }
.ama-studio-sound-row .ama-studio-range { flex: 1; min-width: 70px; }
.ama-studio-sound-row > strong { min-width: 28px; color: var(--ink-soft); font-size: 8px; text-align: right; }
.ama-token-head-actions { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; justify-content: flex-end; }
.ama-token-live { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border: 1px solid var(--line); border-radius: 999px; background: var(--card); color: var(--muted); font-size: 8px; font-weight: 750; animation: ama-token-pop .45s ease both; }
.ama-token-live i { width: 5px; height: 5px; border-radius: 50%; background: var(--muted); }
.ama-token-live.is-ok i, .ama-token-live.is-cached i { background: var(--success); box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 14%, transparent); }
.ama-token-live.is-stale i { background: #d9a441; }
.ama-token-live.is-error i { background: var(--danger); }
.ama-token-live.is-updating i, .ama-token-live.is-idle i { background: var(--sky); animation: ama-token-blink 1s ease infinite; }
.ama-token-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-bottom: 10px; }
.ama-token-stat { min-width: 0; padding: 10px 11px; border: 1px solid var(--line); border-radius: 13px; background: linear-gradient(135deg, color-mix(in srgb, var(--sky-soft) 55%, var(--card)), var(--card)); }
.ama-token-stat > span { display: block; color: var(--muted); font-size: 8px; font-weight: 750; }
.ama-token-stat > strong { display: block; margin-top: 2px; font-size: 20px; letter-spacing: -.04em; color: var(--ink); }
.ama-token-stat > small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: 8px; }
.ama-token-note { margin-bottom: 10px; }
.ama-token-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, .88fr); gap: 10px; align-items: start; }
.ama-token-board { min-width: 0; }
.ama-token-board .ama-panel-head h2, .ama-token-chart-panel .ama-panel-head h2 { margin: 3px 0 0; font-size: 15px; letter-spacing: -.02em; }
.ama-token-board .ama-panel-head p, .ama-token-chart-panel .ama-panel-head p { margin: 4px 0 0; color: var(--muted); font-size: 8.5px; }
.ama-token-filters { display: flex; flex-wrap: wrap; gap: 4px; margin: 10px 0 7px; }
.ama-token-filter { display: inline-flex; align-items: center; gap: 4px; padding: 4px 7px; border: 1px solid var(--line); border-radius: 7px; background: var(--card); color: var(--muted); font: inherit; font-size: 8px; font-weight: 750; cursor: pointer; }
.ama-token-filter i { width: 5px; height: 5px; border-radius: 50%; }
.ama-token-filter small { color: var(--muted); font-size: 7px; font-weight: 500; }
.ama-token-filter.is-active { border-color: var(--sky); background: var(--sky-soft); color: var(--sky-deep); }
.ama-token-list { display: grid; gap: 3px; max-height: 390px; overflow: auto; padding-right: 2px; }
.ama-token-row { display: grid; grid-template-columns: 7px minmax(0, 1fr) 56px 56px 43px; align-items: center; gap: 7px; width: 100%; padding: 6px 6px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
.ama-token-row:hover { background: var(--panel-2); border-color: var(--line); }
.ama-token-row.is-active { border-color: color-mix(in srgb, var(--sky) 50%, var(--line)); background: color-mix(in srgb, var(--sky-soft) 70%, var(--card)); }
.ama-token-provider-dot { width: 6px; height: 6px; border-radius: 50%; }
.ama-token-model { min-width: 0; }
.ama-token-model strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 9px; font-weight: 800; }
.ama-token-model small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: 7.5px; }
.ama-token-price-cell { text-align: right; }
.ama-token-price-cell strong { display: block; font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 9px; font-weight: 700; color: var(--ink-soft); }
.ama-token-price-cell small { display: block; color: var(--muted); font-size: 7px; }
.ama-token-row-change { color: var(--muted); font-size: 8px; font-weight: 750; text-align: right; }
.ama-token-row-change.is-up, .ama-token-chart-change.is-up, .ama-token-change-big strong.is-up { color: var(--success); }
.ama-token-row-change.is-down, .ama-token-chart-change.is-down, .ama-token-change-big strong.is-down { color: var(--danger); }
.ama-token-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 36px 0; color: var(--muted); font-size: 10px; }
.ama-token-source { margin: 8px 0 0; color: var(--muted); font-size: 7.5px; }
.ama-token-source a { color: var(--sky-deep); text-decoration: none; }
.ama-token-side { min-width: 0; }
.ama-token-focus .ama-panel-head, .ama-token-clock .ama-panel-head { align-items: flex-start; }
.ama-token-focus .ama-panel-head h2 { max-width: 260px; overflow-wrap: anywhere; }
.ama-token-large-dot { flex: 0 0 auto; width: 22px; height: 22px; border-radius: 7px; box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 10%, transparent); }
.ama-token-focus-prices { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; margin-top: 10px; }
.ama-token-focus-prices > div { min-width: 0; padding: 7px; border: 1px dashed var(--line-strong); border-radius: 8px; background: var(--panel-2); }
.ama-token-focus-prices span { display: block; color: var(--muted); font-size: 7px; }
.ama-token-focus-prices strong { display: block; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; font-size: 11px; }
.ama-token-focus-facts { display: flex; flex-wrap: wrap; gap: 5px 8px; margin-top: 7px; color: var(--muted); font-size: 7.5px; }
.ama-token-focus-facts strong { color: var(--ink-soft); }
.ama-token-change-big { display: flex; align-items: baseline; gap: 5px; margin-top: 8px; padding-top: 7px; border-top: 1px solid var(--line); }
.ama-token-change-big span { color: var(--muted); font-size: 8px; }
.ama-token-change-big strong { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 16px; }
.ama-token-change-big small { margin-left: auto; color: var(--muted); font-size: 7px; }
.ama-token-now { flex: 0 0 auto; padding: 3px 6px; border-radius: 999px; font-size: 7.5px; font-weight: 800; }
.ama-token-now.is-peak { color: #a34e5f; background: #ffe3e9; }
.ama-token-now.is-offpeak { color: #28795c; background: #dff6ec; }
.ama-token-clockbar { position: relative; display: flex; gap: 1px; height: 20px; margin: 11px 0 3px; overflow: visible; border-radius: 5px; }
.ama-token-clockbar > span { flex: 1; min-width: 0; height: 100%; background: #dff6ec; }
.ama-token-clockbar > span:first-child { border-radius: 5px 0 0 5px; }
.ama-token-clockbar > span:last-of-type { border-radius: 0 5px 5px 0; }
.ama-token-clockbar > span.is-peak { background: #ffd6e0; }
.ama-token-clockbar.is-flat > span { background: color-mix(in srgb, var(--sky) 15%, var(--card)); }
.ama-token-clock-now { position: absolute; top: -3px; width: 2px; height: 26px; border-radius: 2px; background: var(--ink); box-shadow: 0 0 0 2px var(--card); pointer-events: none; }
.ama-token-clock-labels { display: flex; justify-content: space-between; color: var(--muted); font-size: 6.5px; }
.ama-token-clock-note { margin: 8px 0 0; color: var(--muted); font-size: 7.5px; line-height: 1.55; }
.ama-token-window-prices { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 8px; }
.ama-token-window-prices > div { padding: 6px 7px; border-radius: 7px; background: var(--panel-2); }
.ama-token-window-prices span { display: block; color: var(--muted); font-size: 7px; }
.ama-token-window-prices strong { display: block; margin-top: 1px; font-size: 8.5px; }
.ama-token-window-prices > small { grid-column: 1 / -1; color: var(--muted); font-size: 7px; line-height: 1.45; }
.ama-token-peak { margin-bottom: 10px; }
.ama-token-peak .ama-panel-head { align-items: flex-start; }
.ama-token-now-inline { margin-left: 8px; vertical-align: 2px; }
.ama-token-peak .ama-panel-head h2 { margin: 3px 0 0; font-size: 15px; letter-spacing: -.02em; }
.ama-token-peak .ama-panel-head p { margin: 4px 0 0; color: var(--muted); font-size: 8.5px; }
.ama-token-peak-body { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(210px, 0.75fr); gap: 16px; align-items: center; margin-top: 8px; }
.ama-token-peak-clock { min-width: 0; }
.ama-token-peak-clock .ama-token-clockbar { height: 26px; }
.ama-token-peak-windows { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
.ama-token-peak-windows span { padding: 2px 6px; border: 1px solid var(--line); border-radius: 5px; background: var(--panel-2); color: var(--ink-soft); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 7px; }
.ama-token-peak-local { color: var(--muted) !important; }
.ama-token-peak-meta { display: grid; gap: 6px; }
.ama-token-peak-meta > div { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 8px; align-items: baseline; padding: 7px 9px; border: 1px dashed var(--line-strong); border-radius: 9px; background: var(--panel-2); }
.ama-token-peak-meta span { color: var(--muted); font-size: 7.5px; }
.ama-token-peak-meta strong { color: var(--ink); font-size: 12px; font-weight: 850; text-align: right; }
.ama-token-peak-meta small { grid-column: 1 / -1; color: var(--muted); font-size: 7px; }
.ama-token-peak-tag { display: inline-block; margin-left: 5px; padding: 0 4px; border-radius: 4px; font-size: 6.5px; font-style: normal; font-weight: 800; vertical-align: 1px; }
.ama-token-peak-tag.is-peak { color: #a34e5f; background: #ffe3e9; }
.ama-token-peak-tag.is-offpeak { color: #28795c; background: #dff6ec; }
@media (max-width: 1000px) {
  .ama-token-peak-body { grid-template-columns: 1fr; }
  .ama-studio-presets { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .ama-material-preview { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.ama-codex-toolbar { display: grid; gap: 9px; margin-bottom: 10px; }
.ama-codex-toolbar .ama-web-input-wrap { max-width: 460px; }
.ama-codex-filters { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
.ama-codex-chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border: 1px solid var(--line); border-radius: 7px; background: var(--card); color: var(--muted); font: inherit; font-size: 8px; font-weight: 750; cursor: pointer; }
.ama-codex-chip small { color: var(--muted); font-size: 7px; font-weight: 500; }
.ama-codex-chip.is-active { border-color: var(--sky); background: var(--sky-soft); color: var(--sky-deep); }
.ama-codex-count { margin-left: auto; color: var(--muted); font-size: 7.5px; }
.ama-codex-layout { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(230px, 0.8fr); gap: 10px; align-items: start; }
.ama-codex-list { min-width: 0; max-height: 560px; overflow: auto; }
.ama-codex-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 7px; }
.ama-codex-card { display: grid; grid-template-columns: 38px minmax(0, 1fr); align-items: center; gap: 8px; padding: 7px; border: 1px solid var(--line); border-radius: 11px; background: var(--panel-2); color: var(--ink); font: inherit; text-align: left; cursor: pointer; transition: border-color .16s ease, transform .16s ease, background .16s ease; }
.ama-codex-card:hover { border-color: var(--line-strong); transform: translateY(-1px); }
.ama-codex-card.is-active { border-color: color-mix(in srgb, var(--sky) 55%, var(--line)); background: color-mix(in srgb, var(--sky-soft) 65%, var(--card)); }
.ama-codex-avatar { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 11px; color: #fff; font-size: 16px; font-weight: 900; text-shadow: 0 1px 2px rgb(0 0 0 / 0.28); }
.ama-codex-avatar.is-large { width: 56px; height: 56px; border-radius: 16px; font-size: 24px; }
.ama-codex-body { min-width: 0; }
.ama-codex-body strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; font-weight: 850; }
.ama-codex-body small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: 7.5px; }
.ama-codex-meta { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
.ama-codex-meta em { padding: 0 4px; border-radius: 4px; background: color-mix(in srgb, var(--sky) 14%, transparent); color: var(--sky-deep); font-size: 7px; font-style: normal; font-weight: 800; }
.ama-codex-meta i { color: #d9a441; font-size: 7.5px; font-style: normal; letter-spacing: .5px; }
.ama-codex-detail { min-width: 0; position: sticky; top: 0; }
.ama-codex-detail-head { display: flex; align-items: center; gap: 10px; }
.ama-codex-detail-head h2 { margin: 0; font-size: 16px; letter-spacing: -.02em; }
.ama-codex-detail-head p { margin: 1px 0 0; color: var(--muted); font-size: 8px; }
.ama-codex-stars { color: #d9a441; font-size: 9px; letter-spacing: 1px; }
.ama-codex-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin: 12px 0 0; }
.ama-codex-facts > div { padding: 7px 8px; border: 1px dashed var(--line-strong); border-radius: 8px; background: var(--panel-2); }
.ama-codex-facts dt { color: var(--muted); font-size: 7px; }
.ama-codex-facts dd { margin: 1px 0 0; color: var(--ink-soft); font-size: 9.5px; font-weight: 750; }
.ama-codex-role { margin: 10px 0 0; color: var(--ink-soft); font-size: 8.5px; line-height: 1.6; }
.ama-codex-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.ama-codex-tags span { padding: 2px 6px; border: 1px solid var(--line); border-radius: 999px; background: var(--card); color: var(--muted); font-size: 7px; }
.ama-codex-tabs { display: flex; gap: 4px; margin-top: 12px; padding: 3px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2); }
.ama-codex-tab { flex: 1; padding: 5px 6px; border: 0; border-radius: 6px; background: transparent; color: var(--muted); font: inherit; font-size: 8px; font-weight: 750; cursor: pointer; }
.ama-codex-tab.is-active { background: var(--card); color: var(--sky-deep); box-shadow: inset 0 0 0 1px var(--line-strong); }
.ama-codex-skins { display: grid; gap: 6px; margin-top: 10px; }
.ama-skin-card { display: grid; grid-template-columns: 44px minmax(0, 1fr); align-items: center; gap: 8px; padding: 7px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2); }
.ama-skin-art { display: grid; place-items: center; width: 44px; height: 52px; border-radius: 8px; background: linear-gradient(150deg, color-mix(in srgb, var(--sky) 55%, #fff), color-mix(in srgb, var(--pink) 45%, #fff)); color: #fff; text-shadow: 0 1px 2px rgb(0 0 0 / 0.25); }
.ama-skin-art span { font-size: 15px; font-weight: 900; }
.ama-skin-art small { font-size: 6.5px; }
.ama-skin-body strong { display: block; font-size: 9px; }
.ama-skin-body small { display: block; color: var(--muted); font-size: 7px; }
.ama-codex-skin-note { margin: 8px 0 6px; color: var(--muted); font-size: 7px; line-height: 1.55; }
.ama-codex-story p { margin: 8px 0 0; color: var(--ink-soft); font-size: 8.5px; line-height: 1.65; }
.ama-codex-tools { margin-top: 10px; }
.ama-tool-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; margin-top: 4px; }
.ama-tool-card { display: flex; flex-direction: column; min-width: 0; padding: 9px; border: 1px solid var(--line); border-radius: 11px; background: var(--panel-2); }
.ama-tool-top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.ama-tool-top strong { font-size: 9px; font-weight: 850; }
.ama-tool-kind { flex: 0 0 auto; padding: 1px 5px; border-radius: 4px; background: color-mix(in srgb, var(--sky) 14%, transparent); color: var(--sky-deep); font-size: 6.5px; font-weight: 800; }
.ama-tool-card p { flex: 1; margin: 5px 0 7px; color: var(--muted); font-size: 7.5px; line-height: 1.55; }
.ama-tool-card .ama-web-open { align-self: flex-start; }
.ama-codex-disclaimer { margin: 12px 0 0; padding-top: 8px; border-top: 1px dashed var(--line); color: var(--muted); font-size: 7px; line-height: 1.55; }
@media (max-width: 1000px) {
  .ama-codex-layout { grid-template-columns: 1fr; }
  .ama-codex-detail { position: static; }
}
.ama-token-chart-panel { margin-top: 10px; }
.ama-token-chart-tools { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
.ama-token-chart { margin-top: 6px; }
.ama-token-chart-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px; margin-bottom: 1px; }
.ama-token-chart-top strong { display: block; font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 19px; letter-spacing: -.04em; }
.ama-token-chart-top span { display: block; color: var(--muted); font-size: 7.5px; }
.ama-token-chart-change { flex: 0 0 auto; font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 8px !important; font-weight: 750; }
.ama-token-chart-body { display: flex; gap: 7px; margin-top: 8px; }
.ama-token-y-axis { position: relative; flex: 0 0 42px; height: 210px; }
.ama-token-y-axis span { position: absolute; right: 2px; transform: translateY(50%); color: var(--muted); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 6.5px; white-space: nowrap; }
.ama-token-plot { position: relative; flex: 1; min-width: 0; height: 210px; margin: 0 4px 22px 0; border-bottom: 1px solid var(--line); }
.ama-token-gridline { position: absolute; right: 0; left: 0; height: 1px; border-top: 1px dashed color-mix(in srgb, var(--line) 85%, transparent); pointer-events: none; }
.ama-token-candle { position: absolute; bottom: 0; height: 100%; transform: translateX(-50%); cursor: crosshair; }
.ama-token-candle.is-baseline { opacity: .62; }
.ama-token-wick { position: absolute; left: 50%; width: 1px; transform: translateX(-50%); background: #3ba66b; opacity: .8; pointer-events: none; }
.ama-token-wick.is-down { background: #d76a7a; }
.ama-token-body { position: absolute; left: 50%; min-height: 3px; transform: translateX(-50%); border-radius: 1px; background: #55bf85; pointer-events: none; }
.ama-token-body.is-down { background: #e88aa8; }
.ama-token-body.is-hover { outline: 1px solid var(--ink); }
.ama-token-close-dot { position: absolute; left: 50%; width: 3px; height: 3px; transform: translate(-50%, 50%); border-radius: 50%; background: var(--sky-deep); pointer-events: none; }
.ama-token-close-dot.is-down { background: #d76a7a; }
.ama-token-x-label { position: absolute; top: calc(100% + 6px); transform: translateX(-50%); color: var(--muted); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 6px; white-space: nowrap; }
.ama-token-chart-foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 1px; color: var(--muted); font-size: 7px; }
.ama-token-chart-foot span { display: inline-flex; align-items: center; gap: 3px; }
.ama-token-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; }
.ama-token-dot.is-up { background: #55bf85; }
.ama-token-dot.is-down { background: #e88aa8; }
.ama-token-chart-empty { display: grid; place-items: center; min-height: 150px; color: var(--muted); font-size: 9px; }
.ama-token-footnote { margin: 7px 0 0; color: var(--muted); font-size: 7.5px; line-height: 1.55; }
@keyframes ama-token-pop { from { opacity: .5; transform: translateY(-2px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ama-token-blink { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
@media (max-width: 1000px) {
  .ama-token-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ama-token-grid { grid-template-columns: 1fr; }
  .ama-token-list { max-height: 260px; }
}
.ama-studio-fields { display: grid; grid-template-columns: 1fr 72px; gap: 7px; }
.ama-studio-field { min-width: 0; }
.ama-studio-field label { display: block; margin-bottom: 3px; color: var(--muted); font-size: 7.5px; }
.ama-studio-input { width: 100%; min-height: 30px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 8px; outline: none; background: var(--input); color: var(--ink); font: inherit; font-size: 9px; }
.ama-studio-input:focus { border-color: var(--sky); }
.ama-studio-range { width: 100%; accent-color: var(--sky); }
.ama-studio-side { min-width: 0; }
.ama-studio-preview { padding: 13px; border: 1px solid var(--line); border-radius: var(--ui-radius); background: linear-gradient(140deg, var(--hero-1), var(--hero-2)); }
.ama-studio-preview-card { padding: 13px; border: 1px solid var(--line); border-radius: calc(var(--ui-radius) - 2px); background: var(--card); }
.ama-studio-preview-top { display: flex; align-items: center; gap: 8px; }
.ama-studio-glyph { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 10px; background: var(--sky); color: #fff; font-size: 15px; font-weight: 900; }
.ama-studio-preview-title { min-width: 0; }
.ama-studio-preview-title strong { display: block; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ama-studio-preview-title small { display: block; color: var(--muted); font-size: 7.5px; }
.ama-studio-preview-lines { display: grid; gap: 5px; margin-top: 11px; }
.ama-studio-preview-lines span { display: block; height: 5px; border-radius: 99px; background: color-mix(in srgb, var(--sky) 24%, var(--line)); }
.ama-studio-preview-lines span:nth-child(2) { width: 75%; }
.ama-studio-preview-lines span:nth-child(3) { width: 48%; background: color-mix(in srgb, var(--pink) 35%, var(--line)); }
.ama-studio-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.ama-studio-actions .ama-btn { min-height: 30px; font-size: 9px; }
.ama-studio-note { margin: 7px 0 0; color: var(--muted); font-size: 8px; line-height: 1.5; }
.ama-studio-export, .ama-studio-import { width: 100%; min-height: 108px; resize: vertical; padding: 8px; border: 1px solid var(--line); border-radius: 9px; outline: none; background: var(--input); color: var(--ink); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 8px; line-height: 1.5; }
.ama-studio-export:focus, .ama-studio-import:focus { border-color: var(--sky); }
.ama-studio-io { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 9px; }
.ama-studio-io-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.ama-studio-message { min-height: 15px; margin: 7px 0 0; color: var(--muted); font-size: 8px; }
.ama-studio-message.is-ok { color: var(--success); }
@keyframes ama-window-in { from { opacity: 0; transform: translateY(12px) scale(.992); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes ama-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes ama-twinkle { 0%, 100% { opacity: .35; transform: scale(.92); } 50% { opacity: .95; transform: scale(1.08); } }
@keyframes ama-drift { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(10px); } }
@keyframes ama-blink { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
@keyframes ama-spin { to { transform: rotate(360deg); } }
@media (max-width: 980px) {
  .ama-columns, .ama-split, .ama-steam-grid { grid-template-columns: 1fr; }
  .ama-studio-layout { grid-template-columns: 1fr; }
  .ama-hero { grid-template-columns: minmax(0, 1fr) 180px; }
  .ama-orb { width: 168px; height: 168px; }
  .ama-cat { transform: scale(.86); }
  .ama-core-card { grid-template-columns: 142px minmax(0, 1fr); }
}
@media (max-width: 760px) {
  .ama-desktop { padding: 10px; }
  .ama-window { height: auto; max-height: none; min-height: 0; border-radius: 20px; }
  .ama-body { grid-template-columns: 1fr; min-height: 0; overflow: visible; }
  .ama-sidebar { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px 12px; padding: 10px 12px; border-right: 0; border-bottom: 1px solid var(--line); }
  .ama-profile { grid-column: 1 / -1; }
  .ama-nav { display: flex; overflow-x: auto; gap: 2px; }
  .ama-nav-btn { width: auto; flex: 0 0 auto; padding: 7px 9px; }
  .ama-nav-glyph { display: none; }
  .ama-side-bottom { margin: 0; }
  .ama-side-note { display: none; }
  .ama-theme-btn { width: auto; white-space: nowrap; }
  .ama-content { padding: 18px 16px 16px; max-height: none; overflow: visible; }
  .ama-hero { grid-template-columns: 1fr; padding: 18px; }
  .ama-orb-wrap { min-height: 150px; order: -1; }
  .ama-orb { width: 148px; height: 148px; }
  .ama-cat { transform: scale(.74); }
  .ama-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ama-module-grid { grid-template-columns: 1fr; }
  .ama-web-form { flex-direction: column; }
  .ama-web-submit { min-height: 38px; }
  .ama-web-result { grid-template-columns: 22px minmax(0, 1fr); gap: 7px; padding: 10px; }
  .ama-web-rank { width: 21px; height: 21px; }
  .ama-steam-prices { grid-template-columns: 1fr; }
  .ama-steam-price { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
  .ama-steam-price > strong { margin-top: 0; font-size: 13px; }
  .ama-steam-account { align-items: flex-start; }
  .ama-sale-highlights { grid-template-columns: 1fr; }
  .ama-deal-grid { grid-template-columns: 1fr; }
  .ama-free-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ama-studio-presets { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ama-studio-io { grid-template-columns: 1fr; }
  .ama-about-card { grid-template-columns: 1fr; gap: 4px; }
  .ama-about-orb { min-height: 150px; }
  .ama-view-title { font-size: 23px; }
  .ama-title-pills .ama-pill.is-hosted { display: none; }
  .ama-window-actions { margin-left: 0; }
  .ama-brand-sub { display: none; }
  .ama-sleep { min-height: 470px; }
}
@media (max-width: 430px) {
  .ama-titlebar { gap: 7px; padding: 11px; }
  .ama-title-pills { display: none; }
  .ama-window-actions { margin-left: auto; }
  .ama-hero-title { font-size: 25px; }
  .ama-footer { font-size: 8px; }
  .ama-footer .ama-footer-local { display: none; }
  .ama-core-card { grid-template-columns: 1fr; text-align: center; }
  .ama-core-card .ama-orb-wrap { min-height: 130px; }
  .ama-core-card .ama-orb { width: 130px; height: 130px; }
}
@media (prefers-reduced-motion: reduce) {
  .ama-root *, .ama-root *::before, .ama-root *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
}


/* ============================================================
   Glass material — Apple / Xiaomi style layered translucency
   ============================================================ */
.ama-root[data-material="glass"] {
  --glass-rgb: 255 255 255;
  --glass-edge: rgb(255 255 255 / 0.72);
  --glass-edge-soft: rgb(255 255 255 / 0.46);
  --glass-hairline: rgb(255 255 255 / 0.34);
  --glass-sheen: rgb(255 255 255 / 0.5);
  --glass-shadow: 0 34px 80px rgb(24 74 108 / 0.26), 0 8px 22px rgb(24 74 108 / 0.1);
  --glass-card-shadow: 0 14px 32px rgb(24 74 108 / 0.12), 0 2px 6px rgb(24 74 108 / 0.06);
  --card: rgb(var(--glass-rgb) / calc(var(--glass-alpha) * 0.74%));
  --panel-2: rgb(var(--glass-rgb) / calc(var(--glass-alpha) * 0.55%));
  --title-1: rgb(var(--glass-rgb) / 0.46);
  --title-2: rgb(var(--glass-rgb) / 0.2);
  --side-1: rgb(var(--glass-rgb) / 0.36);
  --side-2: rgb(var(--glass-rgb) / 0.16);
  --hero-1: rgb(var(--glass-rgb) / 0.5);
  --hero-2: rgb(var(--glass-rgb) / 0.16);
  --line: rgb(var(--glass-rgb) / 0.5);
  --line-strong: rgb(var(--glass-rgb) / 0.72);
  --hover: rgb(var(--glass-rgb) / 0.62);
}
.ama-root[data-material="glass"].ama-theme-dark {
  --glass-rgb: 30 44 60;
  --glass-edge: rgb(255 255 255 / 0.14);
  --glass-edge-soft: rgb(255 255 255 / 0.09);
  --glass-hairline: rgb(255 255 255 / 0.07);
  --glass-sheen: rgb(255 255 255 / 0.14);
  --glass-shadow: 0 34px 90px rgb(0 0 0 / 0.55), 0 8px 24px rgb(0 0 0 / 0.3);
  --glass-card-shadow: 0 12px 28px rgb(0 0 0 / 0.28);
  --line: rgb(255 255 255 / 0.1);
  --line-strong: rgb(255 255 255 / 0.16);
}
.ama-root[data-material="glass"] .ama-desktop {
  background:
    radial-gradient(circle at 14% 9%, rgb(255 255 255 / 0.95), transparent 26%),
    radial-gradient(circle at 84% 14%, color-mix(in srgb, var(--sky) 62%, transparent), transparent 46%),
    radial-gradient(circle at 72% 88%, color-mix(in srgb, var(--pink) 58%, transparent), transparent 46%),
    radial-gradient(circle at 18% 94%, color-mix(in srgb, var(--lilac) 54%, transparent), transparent 48%),
    linear-gradient(150deg, var(--desktop-1) 0%, var(--desktop-2) 48%, var(--desktop-3) 100%);
}
.ama-root[data-material="glass"].ama-theme-dark .ama-desktop {
  background:
    radial-gradient(circle at 16% 10%, color-mix(in srgb, var(--sky) 34%, transparent), transparent 44%),
    radial-gradient(circle at 82% 16%, color-mix(in srgb, var(--lilac) 30%, transparent), transparent 46%),
    radial-gradient(circle at 70% 90%, color-mix(in srgb, var(--pink) 24%, transparent), transparent 44%),
    linear-gradient(150deg, var(--desktop-1) 0%, var(--desktop-2) 50%, var(--desktop-3) 100%);
}
.ama-root[data-material="glass"] .ama-desktop::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle 120px at 9% 26%, color-mix(in srgb, var(--sky) 55%, transparent), transparent 70%),
    radial-gradient(circle 86px at 22% 72%, color-mix(in srgb, var(--pink) 52%, transparent), transparent 70%),
    radial-gradient(circle 150px at 78% 18%, color-mix(in srgb, var(--sky) 42%, transparent), transparent 72%),
    radial-gradient(circle 96px at 88% 66%, color-mix(in srgb, var(--lilac) 56%, transparent), transparent 70%),
    radial-gradient(circle 70px at 54% 92%, color-mix(in srgb, var(--mint) 58%, transparent), transparent 70%),
    radial-gradient(ellipse at center, transparent 52%, rgb(24 74 108 / 0.06) 100%);
  filter: blur(6px) saturate(125%);
}
.ama-root[data-material="glass"] .ama-window {
  border: 1px solid var(--glass-edge);
  background:
    linear-gradient(
      152deg,
      rgb(var(--glass-rgb) / calc(var(--glass-alpha) * 0.62%)) 0%,
      rgb(var(--glass-rgb) / calc(var(--glass-alpha) * 0.3%)) 50%,
      rgb(var(--glass-rgb) / calc(var(--glass-alpha) * 0.46%)) 100%
    );
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) * 0.62px)) saturate(205%) brightness(1.04);
  backdrop-filter: blur(calc(var(--glass-blur) * 0.62px)) saturate(205%) brightness(1.04);
  box-shadow: var(--glass-shadow), inset 0 1px 0 var(--glass-edge), inset 0 0 0 1px rgb(255 255 255 / 0.14);
}
.ama-root[data-material="glass"][data-window-bg="image"] .ama-window,
.ama-root[data-material="glass"][data-window-bg="gradient"] .ama-window,
.ama-root[data-material="glass"][data-window-bg="custom"] .ama-window {
  background:
    linear-gradient(
      152deg,
      rgb(var(--glass-rgb) / calc(var(--glass-alpha) * 0.42%)) 0%,
      rgb(var(--glass-rgb) / calc(var(--glass-alpha) * 0.2%)) 50%,
      rgb(var(--glass-rgb) / calc(var(--glass-alpha) * 0.32%)) 100%
    ),
    var(--window-bg);
}
.ama-root[data-material="glass"] .ama-window::after {
  content: "";
  position: absolute;
  top: 0;
  left: 8%;
  right: 8%;
  height: 1px;
  z-index: 2;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.9), transparent);
  opacity: .8;
  pointer-events: none;
}
.ama-root[data-material="glass"] .ama-window::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  pointer-events: none;
  background:
    radial-gradient(120% 80% at 8% -10%, var(--glass-sheen), transparent 46%),
    radial-gradient(90% 60% at 104% 8%, rgb(255 255 255 / 0.28), transparent 55%),
    linear-gradient(118deg, transparent 32%, rgb(255 255 255 / 0.14) 48%, transparent 62%);
  mix-blend-mode: soft-light;
}
.ama-root[data-material="glass"] .ama-titlebar,
.ama-root[data-material="glass"] .ama-body,
.ama-root[data-material="glass"] .ama-footer { position: relative; z-index: 1; }
.ama-root[data-material="glass"] .ama-titlebar {
  border-bottom: 1px solid var(--glass-hairline);
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) * 0.7px)) saturate(170%);
  backdrop-filter: blur(calc(var(--glass-blur) * 0.7px)) saturate(170%);
}
.ama-root[data-material="glass"] .ama-sidebar {
  border-right: 1px solid var(--glass-hairline);
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) * 0.55px)) saturate(160%);
  backdrop-filter: blur(calc(var(--glass-blur) * 0.55px)) saturate(160%);
}
.ama-root[data-material="glass"] .ama-panel,
.ama-root[data-material="glass"] .ama-web-hero,
.ama-root[data-material="glass"] .ama-web-result,
.ama-root[data-material="glass"] .ama-web-state,
.ama-root[data-material="glass"] .ama-sale-panel,
.ama-root[data-material="glass"] .ama-picks-section,
.ama-root[data-material="glass"] .ama-free-section,
.ama-root[data-material="glass"] .ama-hero,
.ama-root[data-material="glass"] .ama-core-card,
.ama-root[data-material="glass"] .ama-about-card,
.ama-root[data-material="glass"] .ama-studio-preview-card,
.ama-root[data-material="glass"] .ama-steam-card,
.ama-root[data-material="glass"] .ama-deal-card,
.ama-root[data-material="glass"] .ama-free-card,
.ama-root[data-material="glass"] .ama-profile,
.ama-root[data-material="glass"] .ama-token-stat,
.ama-root[data-material="glass"] .ama-token-focus,
.ama-root[data-material="glass"] .ama-token-clock {
  border: 1px solid var(--glass-edge-soft);
  background-image: linear-gradient(158deg, rgb(255 255 255 / 0.34) 0%, rgb(255 255 255 / 0.06) 46%, rgb(255 255 255 / 0.16) 100%);
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) * 0.42px)) saturate(175%);
  backdrop-filter: blur(calc(var(--glass-blur) * 0.42px)) saturate(175%);
  box-shadow: var(--glass-card-shadow), inset 0 1px 0 var(--glass-edge-soft);
  transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
}
.ama-root[data-material="glass"]:not(.ama-theme-dark) .ama-panel,
.ama-root[data-material="glass"]:not(.ama-theme-dark) .ama-web-hero,
.ama-root[data-material="glass"]:not(.ama-theme-dark) .ama-picks-section,
.ama-root[data-material="glass"]:not(.ama-theme-dark) .ama-free-section,
.ama-root[data-material="glass"]:not(.ama-theme-dark) .ama-steam-card,
.ama-root[data-material="glass"]:not(.ama-theme-dark) .ama-deal-card,
.ama-root[data-material="glass"]:not(.ama-theme-dark) .ama-free-card,
.ama-root[data-material="glass"]:not(.ama-theme-dark) .ama-profile,
.ama-root[data-material="glass"]:not(.ama-theme-dark) .ama-token-stat,
.ama-root[data-material="glass"]:not(.ama-theme-dark) .ama-token-focus,
.ama-root[data-material="glass"]:not(.ama-theme-dark) .ama-token-clock {
  background-image: linear-gradient(158deg, rgb(255 255 255 / 0.56) 0%, rgb(255 255 255 / 0.2) 48%, rgb(255 255 255 / 0.3) 100%);
  border-color: rgb(255 255 255 / 0.62);
  box-shadow:
    0 16px 34px rgb(24 74 108 / 0.13),
    0 2px 6px rgb(24 74 108 / 0.06),
    inset 0 1px 0 rgb(255 255 255 / 0.92);
}
.ama-root[data-material="glass"]:not(.ama-theme-dark) .ama-window {
  box-shadow:
    var(--glass-shadow),
    inset 0 1px 0 rgb(255 255 255 / 0.85),
    inset 0 0 0 1px rgb(255 255 255 / 0.2),
    inset 0 0 70px rgb(24 74 108 / 0.05),
    inset 1px 1px 0 rgb(255 255 255 / 0.7),
    inset -2px -2px 18px color-mix(in srgb, var(--sky) 16%, transparent),
    inset 2px 2px 22px color-mix(in srgb, var(--pink) 12%, transparent);
}
.ama-root[data-material="glass"]:not(.ama-theme-dark) .ama-sidebar {
  background-image: linear-gradient(180deg, rgb(255 255 255 / 0.42), rgb(255 255 255 / 0.16));
}
.ama-root[data-material="glass"].ama-theme-dark .ama-panel,
.ama-root[data-material="glass"].ama-theme-dark .ama-web-hero,
.ama-root[data-material="glass"].ama-theme-dark .ama-web-result,
.ama-root[data-material="glass"].ama-theme-dark .ama-web-state,
.ama-root[data-material="glass"].ama-theme-dark .ama-sale-panel,
.ama-root[data-material="glass"].ama-theme-dark .ama-picks-section,
.ama-root[data-material="glass"].ama-theme-dark .ama-free-section,
.ama-root[data-material="glass"].ama-theme-dark .ama-hero,
.ama-root[data-material="glass"].ama-theme-dark .ama-core-card,
.ama-root[data-material="glass"].ama-theme-dark .ama-about-card,
.ama-root[data-material="glass"].ama-theme-dark .ama-studio-preview-card,
.ama-root[data-material="glass"].ama-theme-dark .ama-steam-card,
.ama-root[data-material="glass"].ama-theme-dark .ama-deal-card,
.ama-root[data-material="glass"].ama-theme-dark .ama-free-card,
.ama-root[data-material="glass"].ama-theme-dark .ama-profile,
.ama-root[data-material="glass"].ama-theme-dark .ama-token-stat,
.ama-root[data-material="glass"].ama-theme-dark .ama-token-focus,
.ama-root[data-material="glass"].ama-theme-dark .ama-token-clock {
  background-image: linear-gradient(158deg, rgb(255 255 255 / 0.1) 0%, rgb(255 255 255 / 0.02) 46%, rgb(255 255 255 / 0.06) 100%);
}
.ama-root[data-material="glass"] .ama-panel:hover,
.ama-root[data-material="glass"] .ama-steam-card:hover,
.ama-root[data-material="glass"] .ama-deal-card:hover,
.ama-root[data-material="glass"] .ama-free-card:hover {
  border-color: var(--glass-edge);
  box-shadow: 0 16px 34px rgb(24 74 108 / 0.14), inset 0 1px 0 var(--glass-edge);
}
.ama-root[data-material="glass"] .ama-nav-btn {
  border: 1px solid transparent;
  transition: background .18s ease, border-color .18s ease, box-shadow .18s ease, transform .18s ease;
}
.ama-root[data-material="glass"] .ama-nav-btn.is-active {
  border-color: var(--glass-edge-soft);
  background: linear-gradient(160deg, rgb(255 255 255 / 0.72), rgb(255 255 255 / 0.3));
  box-shadow: 0 8px 20px rgb(24 74 108 / 0.12), inset 0 1px 0 var(--glass-edge);
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) * 0.4px)) saturate(160%);
  backdrop-filter: blur(calc(var(--glass-blur) * 0.4px)) saturate(160%);
}
.ama-root[data-material="glass"].ama-theme-dark .ama-nav-btn.is-active {
  background: linear-gradient(160deg, rgb(255 255 255 / 0.16), rgb(255 255 255 / 0.04));
}
.ama-root[data-material="glass"] .ama-pill,
.ama-root[data-material="glass"] .ama-badge {
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) * 0.35px)) saturate(150%);
  backdrop-filter: blur(calc(var(--glass-blur) * 0.35px)) saturate(150%);
  box-shadow: inset 0 1px 0 var(--glass-edge-soft);
}
.ama-root[data-material="glass"] .ama-web-input,
.ama-root[data-material="glass"] .ama-studio-input,
.ama-root[data-material="glass"] .ama-web-input-wrap {
  background: rgb(255 255 255 / 0.42);
  border-color: var(--glass-edge-soft);
  box-shadow: inset 0 1px 2px rgb(24 74 108 / 0.08), inset 0 1px 0 var(--glass-edge-soft);
}
.ama-root[data-material="glass"].ama-theme-dark .ama-web-input,
.ama-root[data-material="glass"].ama-theme-dark .ama-studio-input,
.ama-root[data-material="glass"].ama-theme-dark .ama-web-input-wrap {
  background: rgb(255 255 255 / 0.06);
}
.ama-root[data-material="glass"] .ama-btn {
  border-color: var(--glass-edge-soft);
  background: linear-gradient(160deg, rgb(255 255 255 / 0.6), rgb(255 255 255 / 0.26));
  box-shadow: inset 0 1px 0 var(--glass-edge), 0 6px 16px rgb(24 74 108 / 0.08);
}
.ama-root[data-material="glass"].ama-theme-dark .ama-btn {
  background: linear-gradient(160deg, rgb(255 255 255 / 0.12), rgb(255 255 255 / 0.03));
}
.ama-root[data-material="glass"] .ama-btn-primary {
  border-color: transparent;
  background: linear-gradient(158deg, color-mix(in srgb, var(--sky) 92%, white), color-mix(in srgb, var(--sky) 78%, #0d5f8c));
  box-shadow: 0 10px 24px color-mix(in srgb, var(--sky) 38%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.55);
}
.ama-root[data-material="glass"] .ama-footer {
  border-top: 1px solid var(--glass-hairline);
  background: rgb(var(--glass-rgb) / 0.34);
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) * 0.5px)) saturate(150%);
  backdrop-filter: blur(calc(var(--glass-blur) * 0.5px)) saturate(150%);
}
.ama-root[data-material="glass"] .ama-deal-grid,
.ama-root[data-material="glass"] .ama-free-grid { perspective: 900px; }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .ama-root[data-material="glass"] .ama-window,
  .ama-root[data-material="glass"] .ama-titlebar,
  .ama-root[data-material="glass"] .ama-sidebar,
  .ama-root[data-material="glass"] .ama-panel,
  .ama-root[data-material="glass"] .ama-hero,
  .ama-root[data-material="glass"] .ama-steam-card,
  .ama-root[data-material="glass"] .ama-deal-card {
    background-color: rgb(var(--glass-rgb) / 0.94);
  }
}
.ama-material-preview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
  margin-top: 7px;
}
.ama-material-option {
  position: relative;
  overflow: hidden;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel-2);
  color: var(--ink-soft);
  font: inherit;
  font-size: 9px;
  font-weight: 800;
  text-align: left;
  cursor: pointer;
}
.ama-material-option small { display: block; margin-top: 2px; color: var(--muted); font-size: 7.5px; font-weight: 600; }
.ama-material-option.is-active { border-color: var(--sky); box-shadow: 0 0 0 2px color-mix(in srgb, var(--sky) 22%, transparent); }
.ama-material-option.is-glass {
  background:
    linear-gradient(150deg, rgb(255 255 255 / 0.6), rgb(255 255 255 / 0.18)),
    linear-gradient(120deg, color-mix(in srgb, var(--sky) 30%, transparent), color-mix(in srgb, var(--pink) 26%, transparent));
  -webkit-backdrop-filter: blur(6px) saturate(160%);
  backdrop-filter: blur(6px) saturate(160%);
}
.ama-root[data-material="glass"] .ama-studio-seg button.is-active {
  box-shadow: inset 0 1px 0 var(--glass-edge-soft);
}



/* ============================================================
   Metal material — brushed steel, chamfered edges, specular bands
   ============================================================ */
.ama-root[data-material="metal"] {
  --metal-1: #f4f7fb;
  --metal-2: #dbe3ec;
  --metal-3: #c3cede;
  --metal-edge: rgb(255 255 255 / 0.85);
  --metal-dark: rgb(84 102 124 / 0.18);
  --card: #eef3f8;
  --panel-2: #e6edf5;
  --line: #c6d2e0;
  --line-strong: #aebbcb;
  --hover: #e2eaf3;
  --title-1: #f7fafd;
  --title-2: #dde5ee;
  --side-1: #f2f6fb;
  --side-2: #dbe4ee;
  --hero-1: #f9fbfe;
  --hero-2: #e4ebf4;
}
.ama-root[data-material="metal"].ama-theme-dark {
  --metal-1: #2a3440;
  --metal-2: #1d2530;
  --metal-3: #141b24;
  --metal-edge: rgb(255 255 255 / 0.16);
  --metal-dark: rgb(0 0 0 / 0.5);
  --card: #232d38;
  --panel-2: #1b232d;
  --line: #34414f;
  --line-strong: #465565;
  --hover: #2b3743;
  --title-1: #2b3541;
  --title-2: #1d2530;
  --side-1: #232d38;
  --side-2: #1a222c;
  --hero-1: #27313d;
  --hero-2: #1a222c;
}
.ama-root[data-material="metal"] .ama-window {
  border: 1px solid var(--line-strong);
  background:
    repeating-linear-gradient(90deg, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 3px),
    linear-gradient(155deg, var(--metal-1) 0%, var(--metal-2) 42%, var(--metal-1) 62%, var(--metal-3) 100%);
  box-shadow:
    0 30px 70px rgb(52 68 88 / 0.28),
    inset 0 1px 0 var(--metal-edge),
    inset 0 -2px 4px var(--metal-dark);
}
.ama-root[data-material="metal"] .ama-titlebar {
  border-bottom: 1px solid var(--line-strong);
  background:
    linear-gradient(180deg, rgb(255 255 255 / 0.6), transparent 62%),
    repeating-linear-gradient(90deg, rgb(255 255 255 / 0.06) 0 1px, transparent 1px 4px),
    linear-gradient(180deg, var(--title-1), var(--title-2));
  box-shadow: inset 0 -1px 0 rgb(255 255 255 / 0.35);
}
.ama-root[data-material="metal"] .ama-sidebar {
  border-right: 1px solid var(--line-strong);
  background:
    repeating-linear-gradient(90deg, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 3px),
    linear-gradient(180deg, var(--side-1), var(--side-2));
}
.ama-root[data-material="metal"] .ama-panel,
.ama-root[data-material="metal"] .ama-hero,
.ama-root[data-material="metal"] .ama-web-hero,
.ama-root[data-material="metal"] .ama-web-result,
.ama-root[data-material="metal"] .ama-web-state,
.ama-root[data-material="metal"] .ama-sale-panel,
.ama-root[data-material="metal"] .ama-picks-section,
.ama-root[data-material="metal"] .ama-free-section,
.ama-root[data-material="metal"] .ama-core-card,
.ama-root[data-material="metal"] .ama-about-card,
.ama-root[data-material="metal"] .ama-studio-preview-card,
.ama-root[data-material="metal"] .ama-steam-card,
.ama-root[data-material="metal"] .ama-deal-card,
.ama-root[data-material="metal"] .ama-free-card,
.ama-root[data-material="metal"] .ama-profile,
.ama-root[data-material="metal"] .ama-token-stat,
.ama-root[data-material="metal"] .ama-token-focus,
.ama-root[data-material="metal"] .ama-token-clock {
  border: 1px solid var(--line-strong);
  background:
    linear-gradient(158deg, rgb(255 255 255 / 0.75) 0%, transparent 34%),
    repeating-linear-gradient(90deg, rgb(255 255 255 / 0.04) 0 1px, transparent 1px 3px),
    linear-gradient(160deg, var(--card), var(--panel-2));
  box-shadow:
    0 10px 22px rgb(52 68 88 / 0.12),
    inset 0 1px 0 var(--metal-edge),
    inset 0 -1px 0 var(--metal-dark);
}
.ama-root[data-material="metal"].ama-theme-dark .ama-panel,
.ama-root[data-material="metal"].ama-theme-dark .ama-hero,
.ama-root[data-material="metal"].ama-theme-dark .ama-steam-card,
.ama-root[data-material="metal"].ama-theme-dark .ama-deal-card,
.ama-root[data-material="metal"].ama-theme-dark .ama-free-card,
.ama-root[data-material="metal"].ama-theme-dark .ama-profile {
  background:
    linear-gradient(158deg, rgb(255 255 255 / 0.1) 0%, transparent 38%),
    linear-gradient(160deg, var(--card), var(--panel-2));
}
.ama-root[data-material="metal"] .ama-nav-btn.is-active {
  border: 1px solid var(--line-strong);
  background: linear-gradient(180deg, rgb(255 255 255 / 0.9), rgb(255 255 255 / 0.35));
  box-shadow: inset 0 1px 0 var(--metal-edge), 0 2px 6px rgb(52 68 88 / 0.14);
}
.ama-root[data-material="metal"] .ama-btn {
  border: 1px solid var(--line-strong);
  background: linear-gradient(180deg, rgb(255 255 255 / 0.85), rgb(255 255 255 / 0.3));
  box-shadow: inset 0 1px 0 var(--metal-edge), 0 2px 0 var(--metal-dark);
}
.ama-root[data-material="metal"] .ama-btn-primary {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(180deg, color-mix(in srgb, var(--sky) 84%, white), color-mix(in srgb, var(--sky) 72%, #123a56));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.6), 0 3px 0 rgb(12 60 88 / 0.35), 0 8px 18px color-mix(in srgb, var(--sky) 30%, transparent);
}
.ama-root[data-material="metal"] .ama-web-input,
.ama-root[data-material="metal"] .ama-studio-input,
.ama-root[data-material="metal"] .ama-web-input-wrap {
  background: linear-gradient(180deg, color-mix(in srgb, var(--panel-2) 88%, #94a3b4), var(--card));
  border-color: var(--line-strong);
  box-shadow: inset 0 1px 2px rgb(52 68 88 / 0.2), inset 0 -1px 0 rgb(255 255 255 / 0.5);
}
.ama-root[data-material="metal"] {
  --logo-1: #e8eef6;
  --logo-2: #9aa9bd;
  --logo-3: #5d6f86;
}

/* ============================================================
   Cream material — cartoon cream, chunky borders, sticker shadow
   ============================================================ */
.ama-root[data-material="cream"] {
  --cream-bg: #fff8ef;
  --cream-2: #ffefdd;
  --cream-line: rgb(196 142 106 / 0.35);
  --cream-line-strong: rgb(176 122 88 / 0.55);
  --cream-shadow: rgb(190 132 98 / 0.22);
  --card: #fffdf9;
  --panel-2: #fff3e4;
  --line: #f2ddc8;
  --line-strong: #e6c8ad;
  --hover: #fff0de;
  --ink: #4a3728;
  --ink-soft: #6b5240;
  --muted: #a08772;
  --title-1: #fffaf3;
  --title-2: #ffeedb;
  --side-1: #fffaf4;
  --side-2: #ffeeda;
  --hero-1: #fffdf8;
  --hero-2: #fff0e0;
}
.ama-root[data-material="cream"].ama-theme-dark {
  --cream-bg: #2a211c;
  --cream-2: #3a2c24;
  --cream-line: rgb(255 224 196 / 0.14);
  --cream-line-strong: rgb(255 224 196 / 0.22);
  --cream-shadow: rgb(0 0 0 / 0.45);
  --card: #33261f;
  --panel-2: #2b201a;
  --line: #4b3a2e;
  --line-strong: #614a3a;
  --hover: #3c2c23;
  --ink: #ffeedd;
  --ink-soft: #f3d9c2;
  --muted: #c8ab92;
  --title-1: #362920;
  --title-2: #2a211c;
  --side-1: #33261f;
  --side-2: #271d17;
  --hero-1: #362a22;
  --hero-2: #2a211c;
}
.ama-root[data-material="cream"] .ama-window {
  border: 2px solid var(--cream-line-strong);
  border-radius: calc(var(--ui-radius, 16px) + 10px);
  background:
    radial-gradient(circle at 12% 8%, rgb(255 255 255 / 0.85), transparent 42%),
    linear-gradient(160deg, var(--cream-bg), var(--cream-2));
  box-shadow: 0 14px 0 -2px rgb(255 255 255 / 0.4), 0 26px 60px var(--cream-shadow), 0 6px 0 var(--cream-line);
}
.ama-root[data-material="cream"] .ama-titlebar {
  border-bottom: 2px dashed var(--cream-line);
  background: linear-gradient(180deg, var(--title-1), var(--title-2));
}
.ama-root[data-material="cream"] .ama-sidebar {
  border-right: 2px dashed var(--cream-line);
  background: linear-gradient(180deg, var(--side-1), var(--side-2));
}
.ama-root[data-material="cream"] .ama-panel,
.ama-root[data-material="cream"] .ama-hero,
.ama-root[data-material="cream"] .ama-web-hero,
.ama-root[data-material="cream"] .ama-web-result,
.ama-root[data-material="cream"] .ama-web-state,
.ama-root[data-material="cream"] .ama-sale-panel,
.ama-root[data-material="cream"] .ama-picks-section,
.ama-root[data-material="cream"] .ama-free-section,
.ama-root[data-material="cream"] .ama-core-card,
.ama-root[data-material="cream"] .ama-about-card,
.ama-root[data-material="cream"] .ama-studio-preview-card,
.ama-root[data-material="cream"] .ama-steam-card,
.ama-root[data-material="cream"] .ama-deal-card,
.ama-root[data-material="cream"] .ama-free-card,
.ama-root[data-material="cream"] .ama-profile,
.ama-root[data-material="cream"] .ama-token-stat,
.ama-root[data-material="cream"] .ama-token-focus,
.ama-root[data-material="cream"] .ama-token-clock {
  border: 2px solid var(--cream-line);
  border-radius: calc(var(--ui-radius, 16px) + 6px);
  background: linear-gradient(170deg, var(--card), var(--panel-2));
  box-shadow: 0 5px 0 var(--cream-line), 0 12px 24px var(--cream-shadow);
}
.ama-root[data-material="cream"] .ama-nav-btn {
  border-radius: 14px;
  font-weight: 850;
}
.ama-root[data-material="cream"] .ama-nav-btn.is-active {
  border: 2px solid var(--cream-line-strong);
  background: linear-gradient(170deg, #fffdf9, var(--panel-2));
  box-shadow: 0 3px 0 var(--cream-line);
  color: var(--ink);
}
.ama-root[data-material="cream"] .ama-logo,
.ama-root[data-material="cream"] .ama-avatar,
.ama-root[data-material="cream"] .ama-mini-icon { filter: drop-shadow(0 3px 0 rgb(208 138 156 / 0.55)) drop-shadow(0 8px 16px rgb(190 132 98 / 0.26)); }
.ama-root[data-material="cream"] .ama-btn {
  border: 2px solid var(--cream-line-strong);
  border-radius: 12px;
  background: linear-gradient(180deg, #fffdf9, var(--panel-2));
  color: var(--ink);
  font-weight: 800;
  box-shadow: 0 3px 0 var(--cream-line);
}
.ama-root[data-material="cream"] .ama-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--cream-line); }
.ama-root[data-material="cream"] .ama-btn-primary {
  border-color: color-mix(in srgb, var(--accent, #f2a3b8) 60%, #a9603f);
  background: linear-gradient(180deg, color-mix(in srgb, var(--sky) 40%, #fff6ec), color-mix(in srgb, var(--sky) 62%, #ffd9c4));
  color: #4a3728;
  box-shadow: 0 3px 0 color-mix(in srgb, var(--sky) 45%, #b37a5c);
}
.ama-root[data-material="cream"] .ama-web-input,
.ama-root[data-material="cream"] .ama-studio-input,
.ama-root[data-material="cream"] .ama-web-input-wrap {
  border: 2px solid var(--cream-line);
  border-radius: 12px;
  background: #fffdf9;
  box-shadow: inset 0 2px 4px rgb(190 132 98 / 0.12);
}
.ama-root[data-material="cream"] .ama-pill,
.ama-root[data-material="cream"] .ama-badge { border-width: 2px; border-style: solid; border-color: var(--cream-line); }
.ama-root[data-material="cream"] {
  --logo-1: #ffd7b0;
  --logo-2: #f6a9bd;
  --logo-3: #e08ba4;
}
.ama-root[data-material="cream"] .ama-footer {
  border-top: 2px dashed var(--cream-line);
  background: var(--title-2);
}

/* ============================================================
   Ink material — 彩水墨 soft-cute watercolour on rice paper
   ============================================================ */
.ama-root[data-material="ink"] {
  --ink-paper: #fdfbf6;
  --ink-paper-2: #f6f1e7;
  --ink-wash-a: color-mix(in srgb, var(--sky) 26%, transparent);
  --ink-wash-b: color-mix(in srgb, var(--pink) 30%, transparent);
  --ink-wash-c: color-mix(in srgb, var(--mint) 26%, transparent);
  --ink-line: rgb(90 82 74 / 0.18);
  --card: rgb(255 253 248 / 0.86);
  --panel-2: rgb(250 244 234 / 0.8);
  --line: rgb(120 108 96 / 0.2);
  --line-strong: rgb(120 108 96 / 0.3);
  --hover: rgb(255 250 242 / 0.9);
  --title-1: rgb(255 252 246 / 0.92);
  --title-2: rgb(248 240 230 / 0.8);
  --side-1: rgb(255 252 246 / 0.9);
  --side-2: rgb(246 238 228 / 0.78);
  --hero-1: rgb(255 253 248 / 0.92);
  --hero-2: rgb(247 238 228 / 0.7);
}
.ama-root[data-material="ink"].ama-theme-dark {
  --ink-paper: #232026;
  --ink-paper-2: #1c1a20;
  --ink-line: rgb(255 246 235 / 0.12);
  --card: rgb(45 41 49 / 0.86);
  --panel-2: rgb(36 33 40 / 0.82);
  --line: rgb(255 246 235 / 0.12);
  --line-strong: rgb(255 246 235 / 0.2);
  --hover: rgb(58 52 62 / 0.86);
}
.ama-root[data-material="ink"] .ama-window {
  border: 1px solid var(--ink-line);
  border-radius: calc(var(--ui-radius, 16px) + 12px) calc(var(--ui-radius, 16px) + 18px) calc(var(--ui-radius, 16px) + 10px) calc(var(--ui-radius, 16px) + 16px);
  background:
    radial-gradient(circle at 8% 12%, var(--ink-wash-a), transparent 46%),
    radial-gradient(circle at 92% 18%, var(--ink-wash-b), transparent 44%),
    radial-gradient(circle at 74% 92%, var(--ink-wash-c), transparent 48%),
    repeating-linear-gradient(135deg, rgb(120 108 96 / 0.022) 0 1px, transparent 1px 4px),
    linear-gradient(160deg, var(--ink-paper), var(--ink-paper-2));
  box-shadow: 0 26px 64px rgb(74 62 52 / 0.2), inset 0 0 0 1px rgb(255 255 255 / 0.5);
}
.ama-root[data-material="ink"] .ama-titlebar {
  border-bottom: 1px solid var(--ink-line);
  background: linear-gradient(180deg, var(--title-1), var(--title-2));
}
.ama-root[data-material="ink"] .ama-sidebar {
  border-right: 1px solid var(--ink-line);
  background:
    radial-gradient(circle at 20% 6%, var(--ink-wash-c), transparent 60%),
    linear-gradient(180deg, var(--side-1), var(--side-2));
}
.ama-root[data-material="ink"] .ama-panel,
.ama-root[data-material="ink"] .ama-hero,
.ama-root[data-material="ink"] .ama-web-hero,
.ama-root[data-material="ink"] .ama-web-result,
.ama-root[data-material="ink"] .ama-web-state,
.ama-root[data-material="ink"] .ama-sale-panel,
.ama-root[data-material="ink"] .ama-picks-section,
.ama-root[data-material="ink"] .ama-free-section,
.ama-root[data-material="ink"] .ama-core-card,
.ama-root[data-material="ink"] .ama-about-card,
.ama-root[data-material="ink"] .ama-studio-preview-card,
.ama-root[data-material="ink"] .ama-steam-card,
.ama-root[data-material="ink"] .ama-deal-card,
.ama-root[data-material="ink"] .ama-free-card,
.ama-root[data-material="ink"] .ama-profile,
.ama-root[data-material="ink"] .ama-token-stat,
.ama-root[data-material="ink"] .ama-token-focus,
.ama-root[data-material="ink"] .ama-token-clock {
  border: 1px solid var(--ink-line);
  border-radius: calc(var(--ui-radius, 16px) + 8px) calc(var(--ui-radius, 16px) + 14px) calc(var(--ui-radius, 16px) + 6px) calc(var(--ui-radius, 16px) + 12px);
  background:
    radial-gradient(circle at 12% 0%, var(--ink-wash-b), transparent 58%),
    radial-gradient(circle at 92% 100%, var(--ink-wash-a), transparent 56%),
    linear-gradient(170deg, var(--card), var(--panel-2));
  box-shadow: 0 10px 26px rgb(74 62 52 / 0.1), inset 0 0 24px rgb(255 255 255 / 0.32);
}
.ama-root[data-material="ink"] .ama-nav-btn.is-active {
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background:
    radial-gradient(circle at 30% 20%, var(--ink-wash-b), transparent 70%),
    linear-gradient(170deg, var(--card), var(--panel-2));
  box-shadow: 0 4px 12px rgb(74 62 52 / 0.12);
}
.ama-root[data-material="ink"] .ama-btn {
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: linear-gradient(170deg, var(--card), var(--panel-2));
  box-shadow: 0 3px 10px rgb(74 62 52 / 0.1);
}
.ama-root[data-material="ink"] .ama-btn-primary {
  color: #fff;
  border-color: transparent;
  background:
    radial-gradient(circle at 24% 18%, rgb(255 255 255 / 0.4), transparent 62%),
    linear-gradient(160deg, color-mix(in srgb, var(--sky) 82%, white), color-mix(in srgb, var(--sky) 64%, #6d6a9c));
  box-shadow: 0 8px 20px color-mix(in srgb, var(--sky) 32%, transparent);
}
.ama-root[data-material="ink"] .ama-web-input,
.ama-root[data-material="ink"] .ama-studio-input,
.ama-root[data-material="ink"] .ama-web-input-wrap {
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: rgb(255 253 248 / 0.9);
  box-shadow: inset 0 1px 3px rgb(120 108 96 / 0.12);
}
.ama-root[data-material="ink"] {
  --logo-1: color-mix(in srgb, var(--sky) 62%, #ffffff);
  --logo-2: color-mix(in srgb, var(--sky) 58%, var(--lilac));
  --logo-3: color-mix(in srgb, var(--pink) 66%, #9b8ec8);
}

/* material preview swatches in the studio */
.ama-material-preview { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.ama-material-option.is-metal {
  background:
    repeating-linear-gradient(90deg, rgb(255 255 255 / 0.08) 0 1px, transparent 1px 3px),
    linear-gradient(160deg, #f2f6fb, #c6d2e0 55%, #e8eef6);
}
.ama-material-option.is-cream {
  border: 2px solid rgb(196 142 106 / 0.35);
  background: linear-gradient(170deg, #fffdf9, #ffeeda);
  box-shadow: 0 3px 0 rgb(196 142 106 / 0.3);
}
.ama-material-option.is-ink {
  background:
    radial-gradient(circle at 14% 10%, rgb(68 184 242 / 0.28), transparent 60%),
    radial-gradient(circle at 88% 90%, rgb(232 138 168 / 0.3), transparent 58%),
    linear-gradient(170deg, #fdfbf6, #f3ecdf);
}

`

export default function AmaMonsterOsPanel(props: PluginSurfaceProps<ShellState>) {
  const { state, actions, t } = props
  const safeState: ShellState = state || {}
  const shell = safeState.shell || {}
  const bridge = safeState.bridge || {}
  const telemetry = safeState.telemetry || {}
  const pulseInfo = safeState.pulse || {}
  const webInfo = safeState.web || {}
  const initialWebResults = Array.isArray(webInfo.results) ? webInfo.results : []
  const steamInfo = safeState.steam || {}
  const initialSteamResults = Array.isArray(steamInfo.results) ? steamInfo.results : []
  const initialDeals = Array.isArray(steamInfo.deals?.results) ? steamInfo.deals?.results || [] : []
  const initialFreeGames = Array.isArray(steamInfo.free_to_play) ? steamInfo.free_to_play : []
  const modules = Array.isArray(safeState.modules) ? safeState.modules : []
  const events = Array.isArray(safeState.events) ? safeState.events.slice(-5) : []
  const capabilities = safeStringArray(bridge.capabilities)
  const reserved = Array.isArray(bridge.reserved) ? bridge.reserved : []
  const activity = bridge.activity || {}
  const contractVersion = bridge.contract_version || "1.0.0"
  const version = shell.version || "0.6.1 Beta"
  const shellName = shell.name || "Ama Monster OS"
  const hosted = shell.hosted !== false
  const pulseAction = actionById(actions || [], "ama_pulse")
  const webSearchAction = actionById(actions || [], "ama_web_search")
  const steamSearchAction = actionById(actions || [], "ama_steam_search")
  const steamDealsAction = actionById(actions || [], "ama_steam_deals")
  const steamFreeAction = actionById(actions || [], "ama_steam_free")
  const codexAction = actionById(actions || [], "ama_arknights_codex")
  const codexDetailAction = actionById(actions || [], "ama_arknights_detail")
  const steamLoginAction = actionById(actions || [], "ama_steam_login")
  const steamAccountAction = actionById(actions || [], "ama_steam_account")
  const steamLogoutAction = actionById(actions || [], "ama_steam_logout")
  const tokenAction = actionById(actions || [], "ama_token_prices")
  const uiProfileSaveAction = actionById(actions || [], "ama_ui_profile_save")
  const initialUiProfile = normalizeUiProfile(safeState.ui_profile)
  const initialTokenRadar = safeState.token_radar || {}
  const initialTokenModels = Array.isArray(initialTokenRadar.models) ? initialTokenRadar.models : []
  const initialTokenHistory = initialTokenRadar.history && typeof initialTokenRadar.history === "object"
    ? initialTokenRadar.history as Record<string, TokenCandle[]>
    : {}

  const [view, setView] = props.useLocalState<ViewId>("ama.view", "home")
  const [chrome, setChrome] = props.useLocalState<ChromeMode>("ama.chrome", "normal")
  const [uiProfile, setUiProfile] = props.useLocalState<UiProfile>("ama.ui.profile", initialUiProfile)
  const [tokenModels, setTokenModels] = useState<TokenModel[]>(initialTokenModels)
  const [tokenHistory, setTokenHistory] = useState<Record<string, TokenCandle[]>>(initialTokenHistory)
  const [tokenSelected, setTokenSelected] = useState(String(initialTokenModels[0]?.id || ""))
  const [tokenProvider, setTokenProvider] = useState("all")
  const [tokenMetric, setTokenMetric] = useState<"input" | "output">("input")
  const [tokenAuto, setTokenAuto] = useState(true)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenStatus, setTokenStatus] = useState(String(initialTokenRadar.status || "idle"))
  const [tokenUpdatedAt, setTokenUpdatedAt] = useState(String(initialTokenRadar.checked_at || initialTokenRadar.fetched_at || ""))
  const [tokenMessage, setTokenMessage] = useState(String(initialTokenRadar.message || ""))
  const [tokenHistoryMeta, setTokenHistoryMeta] = useState(initialTokenRadar.history_meta || {})
  const [tokenPulse, setTokenPulse] = useState(0)
  const initialCodex = safeState.codex || {}
  const [codexQuery, setCodexQuery] = useState("")
  const [codexClass, setCodexClass] = useState("全部")
  const [codexRarity, setCodexRarity] = useState(0)
  const [codexOperators, setCodexOperators] = useState<CodexOperator[]>([])
  const [codexSummary, setCodexSummary] = useState<CodexSummary>(initialCodex)
  const [codexSelected, setCodexSelected] = useState("")
  const [codexLoading, setCodexLoading] = useState(false)
  const [codexLoaded, setCodexLoaded] = useState(false)
  const [codexMessage, setCodexMessage] = useState("")
  const [codexDetail, setCodexDetail] = useState<CodexDetail>({})
  const [codexTools, setCodexTools] = useState<CodexTool[]>([])
  const [codexTab, setCodexTab] = useState<"overview" | "skins" | "story">("overview")
  const [codexDetailLoading, setCodexDetailLoading] = useState(false)
  const [uiSaving, setUiSaving] = useState(false)

  useEffect(() => {
    if (view !== "tokens" || tokenModels.length > 0) return
    void loadTokenPrices(false)
  }, [view])

  useEffect(() => {
    if (view !== "tokens" || !tokenAuto) return
    const timer = setInterval(() => { void loadTokenPrices(false) }, 60000)
    return () => clearInterval(timer)
  }, [view, tokenAuto, tokenLoading])
  const [uiDirty, setUiDirty] = useState(false)
  const [uiMessage, setUiMessage] = useState("")
  const [recentColors, setRecentColors] = props.useLocalState<string[]>("ama.studio.recent", [])
  const [importText, setImportText] = useState("")
  const [pulse, setPulse] = useState<{ status: PulseStatus; message: string }>({
    status: "idle",
    message: "",
  })
  const [refreshing, setRefreshing] = useState(false)
  const [webQuery, setWebQuery] = useState(String(webInfo.query || ""))
  const [webResults, setWebResults] = useState<WebResult[]>(initialWebResults)
  const [webProvider, setWebProvider] = useState(String(webInfo.provider || ""))
  const [webFallback, setWebFallback] = useState(Boolean(webInfo.fallback))
  const [webStatus, setWebStatus] = useState<WebStatus>(
    webInfo.status === "error"
      ? "error"
      : initialWebResults.length > 0
        ? "success"
        : webInfo.status === "empty"
          ? "empty"
          : "idle",
  )
  const [webMessage, setWebMessage] = useState("")
  const [steamQuery, setSteamQuery] = useState(String(steamInfo.query || ""))
  const [steamResults, setSteamResults] = useState<SteamPrice[]>(initialSteamResults)
  const [steamStatus, setSteamStatus] = useState<WebStatus>(
    steamInfo.status === "error"
      ? "error"
      : initialSteamResults.length > 0
        ? "success"
        : steamInfo.status === "empty"
          ? "empty"
          : "idle",
  )
  const [steamMessage, setSteamMessage] = useState("")
  const [steamAccount, setSteamAccount] = useState<SteamAccount>(steamInfo.account || {})
  const [steamAccelerator, setSteamAccelerator] = useState<SteamAccelerator>(steamInfo.accelerator || {})
  const [steamLoginUrl, setSteamLoginUrl] = useState("")
  const [steamLoginBusy, setSteamLoginBusy] = useState(false)
  const [steamLoginNote, setSteamLoginNote] = useState("")
  const [steamLoginError, setSteamLoginError] = useState("")
  const [steamTab, setSteamTab] = useState<"prices" | "picks">("prices")
  const [dealResults, setDealResults] = useState<SteamDeal[]>(initialDeals)
  const [dealStatus, setDealStatus] = useState<WebStatus>(
    steamInfo.deals?.status === "error"
      ? "error"
      : initialDeals.length > 0
        ? "success"
        : steamInfo.deals?.status === "empty"
          ? "empty"
          : "idle",
  )
  const [dealMessage, setDealMessage] = useState("")
  const [dealsLoaded, setDealsLoaded] = useState(initialDeals.length > 0)
  const [dealPage, setDealPage] = useState(Number(steamInfo.deals?.page) || 1)
  const [dealGroups, setDealGroups] = useState(Number(steamInfo.deals?.groups) || 1)
  const [dealPool, setDealPool] = useState(Number(steamInfo.deals?.pool) || 0)
  const [freeGames, setFreeGames] = useState<SteamFree[]>(initialFreeGames)
  const [freeShelfPage, setFreeShelfPage] = useState(Number(steamInfo.free_to_play_group) || 1)
  const [freeShelfGroups, setFreeShelfGroups] = useState(Number(steamInfo.free_to_play_groups) || 1)
  const [freeShelfBusy, setFreeShelfBusy] = useState(false)

  const tr = (key: string, fallback: string): string => {
    const value = t(key)
    return value && value !== key ? value : fallback
  }

  const validViews: ViewId[] = ["home", "web", "steam", "codex", "tokens", "studio", "core", "bridge", "about"]
  const activeView: ViewId = validViews.indexOf(view) >= 0 ? view : "home"
  const validChrome: ChromeMode[] = ["normal", "max", "min", "asleep"]
  const activeChrome: ChromeMode = validChrome.indexOf(chrome) >= 0 ? chrome : "normal"
  const activeTheme: ThemeMode = uiProfile.theme === "dark" ? "dark" : "light"

  const daypart = shell.daypart || "day"
  const greeting = tr(
    `greeting.${daypart}`,
    daypart === "morning"
      ? "Good morning"
      : daypart === "evening"
        ? "Good evening"
        : daypart === "night"
          ? "Good night"
          : "Good afternoon",
  )
  const privacy = activity.privacy || "unavailable"
  const privacyLabel =
    privacy === "visible"
      ? tr("privacy.visible", "Visible")
      : privacy === "private"
        ? tr("privacy.private", "Private")
        : tr("privacy.unavailable", "Unavailable")
  const privacyDetail =
    privacy === "visible"
      ? activity.category || tr("privacy.visible", "Visible")
      : privacy === "private"
        ? tr("telemetry.hidden", "Hidden by privacy")
        : tr("telemetry.none", "No signal")
  const pulseCount = Number(pulseInfo.count) || 0
  const pulseMessage =
    pulse.message ||
    (pulse.status === "running"
      ? tr("pulse.running", "Listening...")
      : pulseCount > 0
        ? tr("pulse.last", "Last pulse #{count}").replace("{count}", String(pulseCount))
        : tr("pulse.never", "No pulse yet"))

  function changeView(next: ViewId) {
    setView(next)
  }

  function toggleTheme() {
    patchUiProfile({ theme: activeTheme === "dark" ? "light" : "dark" })
  }

  function patchUiProfile(patch: Partial<UiProfile>) {
    setUiProfile(normalizeUiProfile({ ...uiProfile, ...patch }))
    setUiDirty(true)
    setUiMessage("")
  }

  function rememberColor(color: string) {
    const next = normalizeHex(color)
    if (!next) return
    setRecentColors((current) => [next, ...(Array.isArray(current) ? current : []).filter((item) => item !== next)].slice(0, 8))
  }

  function setAccent(color: string) {
    patchUiProfile({ accent: color })
    rememberColor(color)
  }

  function reverseGradient() {
    setUiProfile(normalizeUiProfile({
      ...uiProfile,
      window_bg: "gradient",
      gradient_colors: [...uiProfile.gradient_colors].reverse(),
    }))
    setUiDirty(true)
  }

  function shuffleGradient() {
    const count = Math.max(3, Math.min(6, uiProfile.gradient_colors.length))
    const baseHue = Math.round(Math.random() * 360)
    const colors = Array.from({ length: count }, (_, index) =>
      hslToHex((baseHue + index * Math.round(360 / count)) % 360, 64, 58 + (index % 2) * 8))
    setUiProfile(normalizeUiProfile({ ...uiProfile, window_bg: "gradient", gradient_colors: colors }))
    colors.forEach(rememberColor)
    setUiDirty(true)
  }

  function commitGradientColor(index: number, color: string) {
    setGradientColor(index, color)
    rememberColor(color)
  }

  function applyPreset(preset: typeof UI_PRESETS[number]) {
    setUiProfile(normalizeUiProfile({
      ...uiProfile,
      accent: preset.accent,
      wallpaper: preset.wallpaper,
      window_bg: preset.window_bg,
      theme: preset.theme,
      material: preset.material || uiProfile.material,
      glass_blur: preset.glass_blur || uiProfile.glass_blur,
      glass_alpha: preset.glass_alpha || uiProfile.glass_alpha,
    }))
    setUiDirty(true)
    setUiMessage("")
  }

  async function saveUiProfile(profile: UiProfile = uiProfile) {
    if (!uiProfileSaveAction) {
      setUiMessage(tr("studio.saveUnavailable", "Could not save appearance in this window."))
      return
    }
    setUiSaving(true)
    try {
      const result = unwrapResult(
        await props.api.call(
          uiProfileSaveAction.id || "ama_ui_profile_save",
          { profile },
          { timeoutMs: 15000 },
        ),
      )
      if (result.ok === false) {
        setUiMessage(String(result.summary || "") || tr("studio.saveFailed", "Could not save appearance."))
      } else {
        setUiDirty(false)
        setUiMessage(tr("studio.saved", "Appearance saved."))
        try { await props.api.refresh() } catch (_error) { /* saved locally */ }
      }
    } catch (_error) {
      setUiMessage(tr("studio.saveFailed", "Could not save appearance."))
    } finally {
      setUiSaving(false)
    }
  }

  function resetUiProfile() {
    const next = { ...DEFAULT_UI_PROFILE, name: uiProfile.name }
    setUiProfile(next)
    setUiDirty(true)
    setUiMessage("")
  }

  function importUiProfile() {
    const parsed = parseUiProfileText(importText)
    if (!parsed.profile) {
      setUiMessage(tr("studio.importInvalid", "That does not look like an Ama UI profile."))
      return
    }
    setUiProfile(parsed.profile)
    setUiDirty(true)
    setImportText("")
    setUiMessage(tr("studio.imported", "Imported. Save to keep it."))
  }

  function importProfileFromText(text: string) {
    const parsed = parseUiProfileText(text)
    if (!parsed.profile) {
      setUiMessage(tr("studio.importInvalid", "That does not look like an Ama UI profile."))
      return
    }
    setUiProfile(parsed.profile)
    setUiDirty(true)
    setUiMessage(tr("studio.fileImported", "Imported from file. Save to keep it."))
  }

  function importProfileFile(event: any) {
    const file = event?.target?.files?.[0]
    if (event?.target) event.target.value = ""
    if (!file) return
    if (Number(file.size) > MAX_UI_PROFILE_BYTES) {
      setUiMessage(tr("studio.fileTooLarge", "That profile file is too large."))
      return
    }
    try {
      file.text().then((text: string) => importProfileFromText(text)).catch(() => {
        setUiMessage(tr("studio.fileInvalid", "Could not read that profile file."))
      })
    } catch (_error) {
      setUiMessage(tr("studio.fileInvalid", "Could not read that profile file."))
    }
  }

  function importWindowImage(event: any) {
    const file = event?.target?.files?.[0]
    if (event?.target) event.target.value = ""
    if (!file) return
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(String(file.type || ""))) {
      setUiMessage(tr("studio.imageInvalid", "Use a PNG, JPG, WebP, or GIF image."))
      return
    }
    if (Number(file.size) > MAX_WINDOW_IMAGE_BYTES) {
      setUiMessage(tr("studio.imageTooLarge", "That image is larger than 1.2 MB."))
      return
    }
    try {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = String(reader.result || "")
        if (!validWindowImage(dataUrl)) {
          setUiMessage(tr("studio.imageInvalid", "Use a PNG, JPG, WebP, or GIF image."))
          return
        }
        setUiProfile(normalizeUiProfile({ ...uiProfile, window_bg: "image", window_image: dataUrl }))
        setUiDirty(true)
        setUiMessage(tr("studio.imageImported", "Image imported. Save to keep it."))
      }
      reader.onerror = () => setUiMessage(tr("studio.imageInvalid", "Use a PNG, JPG, WebP, or GIF image."))
      reader.readAsDataURL(file)
    } catch (_error) {
      setUiMessage(tr("studio.imageInvalid", "Use a PNG, JPG, WebP, or GIF image."))
    }
  }

  function removeWindowImage() {
    setUiProfile(normalizeUiProfile({ ...uiProfile, window_bg: "paper", window_image: "" }))
    setUiDirty(true)
    setUiMessage("")
  }

  function addGradientColor() {
    if (uiProfile.gradient_colors.length >= 30) return
    const next = hslToHex((uiProfile.gradient_colors.length * 47 + 205) % 360, 64, 62)
    const colors = uiProfile.gradient_colors.indexOf(next) >= 0
      ? [...uiProfile.gradient_colors, hslToHex((uiProfile.gradient_colors.length * 67 + 20) % 360, 58, 66)]
      : [...uiProfile.gradient_colors, next]
    setUiProfile(normalizeUiProfile({
      ...uiProfile,
      window_bg: "gradient",
      gradient_colors: colors.slice(0, 30),
    }))
    setUiDirty(true)
    setUiMessage("")
  }

  function setGradientColor(index: number, value: string) {
    const colors = [...uiProfile.gradient_colors]
    if (index < 0 || index >= colors.length) return
    colors[index] = value
    setUiProfile(normalizeUiProfile({ ...uiProfile, window_bg: "gradient", gradient_colors: colors }))
    setUiDirty(true)
  }

  function removeGradientColor(index: number) {
    if (uiProfile.gradient_colors.length <= 2) return
    const colors = uiProfile.gradient_colors.filter((_, itemIndex) => itemIndex !== index)
    setUiProfile(normalizeUiProfile({ ...uiProfile, window_bg: "gradient", gradient_colors: colors }))
    setUiDirty(true)
  }

  function importSoundFile(event: any) {
    const file = event?.target?.files?.[0]
    if (event?.target) event.target.value = ""
    if (!file) return
    if (!/^audio\/(wav|mpeg|mp3|ogg)$/i.test(String(file.type || ""))) {
      setUiMessage(tr("studio.soundInvalid", "Use a WAV, MP3, or OGG sound file."))
      return
    }
    if (Number(file.size) > MAX_SOUND_BYTES) {
      setUiMessage(tr("studio.soundTooLarge", "That sound is larger than 1 MB."))
      return
    }
    try {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = String(reader.result || "")
        if (!validSoundData(dataUrl)) {
          setUiMessage(tr("studio.soundInvalid", "Use a WAV, MP3, or OGG sound file."))
          return
        }
        setUiProfile(normalizeUiProfile({
          ...uiProfile,
          sound_enabled: true,
          sound_mode: "custom",
          sound_data: dataUrl,
          sound_name: String(file.name || "").slice(0, 80),
        }))
        setUiDirty(true)
        setUiMessage(tr("studio.soundImported", "Sound imported. Save to keep it."))
      }
      reader.onerror = () => setUiMessage(tr("studio.soundInvalid", "Use a WAV, MP3, or OGG sound file."))
      reader.readAsDataURL(file)
    } catch (_error) {
      setUiMessage(tr("studio.soundInvalid", "Use a WAV, MP3, or OGG sound file."))
    }
  }

  function removeSound() {
    setUiProfile(normalizeUiProfile({ ...uiProfile, sound_mode: "steam", sound_data: "", sound_name: "" }))
    setUiDirty(true)
    setUiMessage("")
  }

  function handleSelectSound(event: any) {
    const target = event?.target as HTMLElement | null
    if (!target || typeof target.closest !== "function") return
    if (target.closest("[data-no-sound]")) return
    if (target.closest("button, a, [role='tab'], [role='button']")) {
      playSelectSound(uiProfile)
    }
  }

  function currentWebQuery(): string {
    try {
      const input = document.querySelector(".ama-web-input") as HTMLInputElement | null
      return input && typeof input.value === "string" ? input.value : webQuery
    } catch (_error) {
      return webQuery
    }
  }

  function currentSteamQuery(): string {
    try {
      const input = document.querySelector(".ama-steam-input") as HTMLInputElement | null
      return input && typeof input.value === "string" ? input.value : steamQuery
    } catch (_error) {
      return steamQuery
    }
  }

  function saleEventName(event: SaleEvent | null | undefined): string {
    if (!event) return ""
    const key = `steam.sale.${event.id || ""}`
    const value = t(key)
    return value && value !== key ? value : event.name || key
  }

  function saleDateRange(event: SaleEvent | null | undefined): string {
    if (!event || !event.start_at || !event.end_at) return tr("steam.sale.tbd", "TBD")
    try {
      const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric", timeZone: "America/Los_Angeles" }
      const start = new Date(event.start_at)
      const end = new Date(event.end_at)
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return tr("steam.sale.tbd", "TBD")
      return `${start.toLocaleDateString(undefined, options)} – ${end.toLocaleDateString(undefined, options)} (PT)`
    } catch (_error) {
      return tr("steam.sale.tbd", "TBD")
    }
  }

  function saleCountdown(event: SaleEvent | null | undefined): string {
    if (!event) return ""
    if (event.tbd) return tr("steam.sale.tbd", "TBD")
    const seconds = Number(event.status === "active" ? event.ends_in_seconds : event.starts_in_seconds)
    if (!Number.isFinite(seconds) || seconds < 0) return ""
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const key = event.status === "active" ? "steam.sale.endsIn" : "steam.sale.inDays"
    const fallback = event.status === "active" ? "Ends in {days}d {hours}h" : "In {days}d {hours}h"
    return tr(key, fallback).replace("{days}", String(days)).replace("{hours}", String(hours))
  }

  async function loadTokenPrices(force = false) {
    if (!tokenAction || tokenLoading) return
    setTokenLoading(true)
    setTokenMessage("")
    try {
      const result = unwrapResult(
        await props.api.call(tokenAction.id || "ama_token_prices", { force }, { timeoutMs: 45000 }),
      )
      const radar = result.token_radar && typeof result.token_radar === "object" ? result.token_radar : result
      const models = Array.isArray(radar.models) ? radar.models as TokenModel[] : []
      const history = radar.history && typeof radar.history === "object"
        ? radar.history as Record<string, TokenCandle[]>
        : {}
      if (models.length > 0) {
        setTokenModels(models)
        setTokenHistory(history)
        setTokenSelected((current) => models.some((model) => model.id === current) ? current : models[0].id)
        setTokenProvider((current) => current === "all" || models.some((model) => model.provider === current) ? current : "all")
      }
      const nextStatus = String(radar.status || (result.ok === false ? "error" : "ok"))
      setTokenStatus(nextStatus)
      setTokenUpdatedAt(String(radar.checked_at || radar.fetched_at || new Date().toISOString()))
      setTokenMessage(String(radar.message || (result.ok === false ? result.error || "" : "")))
      setTokenHistoryMeta(radar.history_meta || {})
      setTokenPulse((value) => value + 1)
    } catch (_error) {
      setTokenStatus("error")
      setTokenMessage(tr("tokens.fetchFailed", "Could not refresh token prices. Showing the last snapshot."))
    } finally {
      setTokenLoading(false)
    }
  }

  async function loadCodex() {
    if (!codexAction || codexLoading) return
    setCodexLoading(true)
    setCodexMessage("")
    try {
      const result = unwrapResult(
        await props.api.call(codexAction.id || "ama_arknights_codex", { query: "", classes: [], rarities: [], max_results: 200 }, { timeoutMs: 15000 }),
      )
      if (result.ok === false) {
        setCodexMessage(tr("codex.error", "图鉴读取失败，可以重试。"))
        return
      }
      const results = Array.isArray(result.results) ? result.results as CodexOperator[] : []
      setCodexOperators(results)
      if (Array.isArray(result.tools)) setCodexTools(result.tools as CodexTool[])
      if (result.summary && typeof result.summary === "object") setCodexSummary(result.summary as CodexSummary)
      setCodexLoaded(true)
      setCodexMessage(results.length === 0 ? tr("codex.empty", "图鉴里还没有数据。") : "")
    } catch (_error) {
      setCodexMessage(tr("codex.error", "图鉴读取失败，可以重试。"))
    } finally {
      setCodexLoading(false)
    }
  }

  useEffect(() => {
    if (view !== "codex" || codexLoaded || codexLoading) return
    void loadCodex()
  }, [view])

  async function selectCodexOperator(operatorId: string) {
    setCodexSelected(operatorId)
    setCodexTab("overview")
    if (!codexDetailAction) return
    setCodexDetailLoading(true)
    try {
      const result = unwrapResult(
        await props.api.call(codexDetailAction.id || "ama_arknights_detail", { operator_id: operatorId }, { timeoutMs: 10000 }),
      )
      if (result.ok === false) return
      setCodexDetail({
        skins: Array.isArray(result.skins) ? result.skins as CodexSkin[] : [],
        skin_note: String(result.skin_note || ""),
        story: result.story && typeof result.story === "object" ? result.story : {},
        tools: Array.isArray(result.tools) ? result.tools as CodexTool[] : [],
      })
      if (Array.isArray(result.tools) && result.tools.length > 0) setCodexTools(result.tools as CodexTool[])
    } catch (_error) {
      // Keep the previous detail panel.
    } finally {
      setCodexDetailLoading(false)
    }
  }

  async function runPulse() {
    if (!pulseAction || pulse.status === "running") {
      setPulse({
        status: "error",
        message: tr("pulse.error", "Ama did not answer. Check the plugin log."),
      })
      return
    }
    setPulse({ status: "running", message: tr("pulse.running", "Listening...") })
    const started = Date.now()
    try {
      const result = unwrapResult(
        await props.api.call(pulseAction.id || "ama_pulse", {}, { timeoutMs: 15000 }),
      )
      if (result.ok === false) throw new Error(String(result.error || result.summary || "pulse failed"))
      const ms = Math.max(1, Date.now() - started)
      setPulse({
        status: "success",
        message: tr("pulse.success", "Pulse answered in {ms} ms.").replace("{ms}", String(ms)),
      })
      await props.api.refresh()
    } catch (_error) {
      setPulse({
        status: "error",
        message: tr("pulse.error", "Ama did not answer. Check the plugin log."),
      })
    }
  }

  async function refreshShell() {
    if (refreshing) return
    setRefreshing(true)
    try {
      await props.api.refresh()
    } catch (_error) {
      setPulse({
        status: "error",
        message: tr("refresh.error", "Could not refresh the shell."),
      })
    } finally {
      setRefreshing(false)
    }
  }

  async function runSteamSearch(rawQuery?: string) {
    const query = String(rawQuery ?? steamQuery).trim()
    if (!query) {
      setSteamStatus("error")
      setSteamMessage(tr("steam.emptyQuery", "Type a game name or Steam AppID."))
      return
    }
    if (!steamSearchAction) {
      setSteamStatus("error")
      setSteamMessage(tr("steam.offline", "Price service is unavailable right now."))
      return
    }
    setSteamQuery(query)
    setSteamStatus("searching")
    setSteamMessage(tr("steam.searching", "Checking prices..."))
    try {
      const result = unwrapResult(
        await props.api.call(
          steamSearchAction.id || "ama_steam_search",
          { query, max_results: 3 },
          { timeoutMs: 45000 },
        ),
      )
      if (result.ok === false) {
        setSteamResults([])
        setSteamStatus("error")
        setSteamMessage(
          String(result.error || "") === "empty_query"
            ? tr("steam.emptyQuery", "Type a game name or Steam AppID.")
            : String(result.error || "") === "unavailable"
              ? tr("steam.offline", "Price service is unavailable right now.")
              : tr("steam.error", "Price lookup failed. Check your connection and try again."),
        )
        return
      }
      const results = Array.isArray(result.results) ? result.results : []
      setSteamResults(results)
      setSteamStatus(results.length > 0 ? "success" : "empty")
      setSteamMessage(results.length > 0 ? "" : tr("steam.empty", "No Steam games found. Try a full title or a numeric AppID."))
      try {
        await props.api.refresh()
      } catch (_error) {
        // The price result is already in hand; a context refresh failure is not a lookup failure.
      }
    } catch (_error) {
      setSteamResults([])
      setSteamStatus("error")
      setSteamMessage(tr("steam.error", "Price lookup failed. Check your connection and try again."))
    }
  }

  async function runSteamDeals() {
    if (!steamDealsAction) {
      setDealStatus("error")
      setDealMessage(tr("steam.deals.error", "Could not load sale picks. Check your connection and retry."))
      setDealsLoaded(true)
      return
    }
    setDealStatus("searching")
    setDealMessage(tr("steam.deals.loading", "Finding the best deals..."))
    try {
      const result = unwrapResult(
        await props.api.call(
          steamDealsAction.id || "ama_steam_deals",
          { max_results: 6 },
          { timeoutMs: 45000 },
        ),
      )
      if (result.ok === false) {
        setDealResults([])
        setDealStatus("error")
        setDealMessage(
          String(result.error || "") === "unavailable"
            ? tr("steam.offline", "Price service is unavailable right now.")
            : tr("steam.deals.error", "Could not load sale picks. Check your connection and retry."),
        )
        setDealsLoaded(true)
        return
      }
      const results = Array.isArray(result.results) ? result.results : []
      setDealResults(results)
      setDealPage(Number(result.page) || 1)
      setDealGroups(Number(result.groups) || 1)
      setDealPool(Number(result.pool) || 0)
      setDealStatus(results.length > 0 ? "success" : "empty")
      setDealMessage(results.length > 0 ? "" : tr("steam.deals.empty", "No qualifying high-discount deals right now."))
      setDealsLoaded(true)
      try {
        await props.api.refresh()
      } catch (_error) {
        // The recommendation result is already in hand.
      }
    } catch (_error) {
      setDealResults([])
      setDealStatus("error")
      setDealMessage(tr("steam.deals.error", "Could not load sale picks. Check your connection and retry."))
      setDealsLoaded(true)
    }
  }

  async function startSteamLogin() {
    if (!steamLoginAction || steamLoginBusy) return
    setSteamLoginBusy(true)
    setSteamLoginNote("")
    setSteamLoginError("")
    try {
      const result = unwrapResult(
        await props.api.call(steamLoginAction.id || "ama_steam_login", {}, { timeoutMs: 20000 }),
      )
      if (result.ok === false) {
        setSteamLoginError(tr("steam.login.failed", "无法启动 Steam 登录，请稍后再试。"))
        return
      }
      const url = String(result.url || "")
      setSteamLoginUrl(url)
      if (result.accelerator && typeof result.accelerator === "object") {
        setSteamAccelerator(result.accelerator as SteamAccelerator)
      }
      setSteamLoginNote(String(result.note || ""))
      if (url) {
        void pollSteamLogin()
      }
    } catch (_error) {
      setSteamLoginError(tr("steam.login.failed", "无法启动 Steam 登录，请稍后再试。"))
    } finally {
      setSteamLoginBusy(false)
    }
  }

  async function pollSteamLogin(attempt = 0) {
    if (!steamAccountAction) return
    if (attempt > 90) {
      setSteamLoginError(tr("steam.login.timeout", "登录等待超时，可以重新点击登录。"))
      setSteamLoginUrl("")
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
    try {
      const result = unwrapResult(
        await props.api.call(steamAccountAction.id || "ama_steam_account", { finish: true }, { timeoutMs: 30000 }),
      )
      const account = result.account && typeof result.account === "object" ? result.account as SteamAccount : {}
      if (result.accelerator && typeof result.accelerator === "object") {
        setSteamAccelerator(result.accelerator as SteamAccelerator)
      }
      if (account.steam_id) {
        setSteamAccount(account)
        setSteamLoginUrl("")
        setSteamLoginNote("")
        try { await props.api.refresh() } catch (_error) { /* already linked */ }
        return
      }
      if (result.status === "error") {
        setSteamLoginError(
          String(result.error || "") === "state_mismatch"
            ? tr("steam.login.stateMismatch", "登录校验失败（状态不一致），请重新登录。")
            : tr("steam.login.verifyFailed", "Steam 登录校验失败，请确认 Steam++ 正常后再试。"),
        )
        setSteamLoginUrl("")
        return
      }
    } catch (_error) {
      // keep polling
    }
    void pollSteamLogin(attempt + 1)
  }

  async function signOutSteam() {
    if (!steamLogoutAction) return
    try {
      const result = unwrapResult(
        await props.api.call(steamLogoutAction.id || "ama_steam_logout", {}, { timeoutMs: 10000 }),
      )
      if (result.ok === false) return
      setSteamAccount({})
      setSteamLoginUrl("")
      setSteamLoginNote("")
      try { await props.api.refresh() } catch (_error) { /* already cleared */ }
    } catch (_error) {
      // keep the current card
    }
  }

  function selectSteamTab(next: "prices" | "picks") {
    setSteamTab(next)
    if (next === "picks" && !dealsLoaded && dealStatus !== "searching") {
      void runSteamDeals()
    }
  }

  async function shuffleFreeShelf() {
    if (freeShelfBusy) return
    setFreeShelfBusy(true)
    try {
      if (!steamFreeAction) {
        await props.api.refresh()
        return
      }
      const result = unwrapResult(
        await props.api.call(steamFreeAction.id || "ama_steam_free", {}, { timeoutMs: 15000 }),
      )
      if (result.ok === false) return
      const results = Array.isArray(result.results) ? result.results : []
      if (results.length > 0) setFreeGames(results)
      setFreeShelfPage(Number(result.group) || 1)
      setFreeShelfGroups(Number(result.groups) || 1)
    } catch (_error) {
      // Keep the current shelf on failure.
    } finally {
      setFreeShelfBusy(false)
    }
  }

  async function runWebSearch(rawQuery?: string) {    const query = String(rawQuery ?? webQuery).trim()
    if (!query) {
      setWebStatus("error")
      setWebMessage(tr("web.emptyQuery", "Type something to search."))
      return
    }
    if (!webSearchAction) {
      setWebStatus("error")
      setWebMessage(tr("web.offline", "Search is unavailable right now."))
      return
    }
    setWebQuery(query)
    setWebStatus("searching")
    setWebMessage(tr("web.searching", "Searching..."))
    try {
      const result = unwrapResult(
        await props.api.call(
          webSearchAction.id || "ama_web_search",
          { query, max_results: 5 },
          { timeoutMs: 60000 },
        ),
      )
      if (result.ok === false) {
        const error = String(result.error || "")
        setWebResults([])
        setWebProvider(String(result.provider || ""))
        setWebFallback(Boolean(result.fallback))
        setWebStatus("error")
        setWebMessage(
          error === "empty_query"
            ? tr("web.emptyQuery", "Type something to search.")
            : error === "unavailable"
              ? tr("web.offline", "Search is unavailable right now.")
              : tr("web.error", "Search failed. Check your connection or the web_search plugin."),
        )
        return
      }
      const results = Array.isArray(result.results) ? result.results : []
      setWebResults(results)
      setWebProvider(String(result.provider || ""))
      setWebFallback(Boolean(result.fallback))
      setWebStatus(results.length > 0 ? "success" : "empty")
      setWebMessage(results.length > 0 ? "" : tr("web.empty", "No results. Try a shorter or different query."))
      try {
        await props.api.refresh()
      } catch (_error) {
        // The search result is already in hand; a context refresh failure is not a search failure.
      }
    } catch (_error) {
      setWebResults([])
      setWebStatus("error")
      setWebMessage(tr("web.error", "Search failed. Check your connection or the web_search plugin."))
    }
  }

  function bootLabel(name?: string): string {
    if (!name) return tr("boot.unknown", "System event")
    const value = t(`boot.${name}`)
    return value && value !== `boot.${name}` ? value : tr("boot.unknown", "System event")
  }

  function moduleName(module: ModuleInfo): string {
    const key = module.name_key || ""
    const value = key ? t(key) : ""
    return value && value !== key ? value : module.id || "Module"
  }

  function moduleDescription(module: ModuleInfo): string {
    const key = module.description_key || ""
    const value = key ? t(key) : ""
    return value && value !== key ? value : ""
  }

  function statusLabel(status?: string): string {
    return status === "online"
      ? tr("module.online", "Online")
      : tr("module.reserved", "Reserved")
  }

  const healthLabel =
    bridge.health === "degraded" ? tr("bridge.degraded", "Degraded") : tr("bridge.ready", "Ready")
  const uptimeValue = formatUptime(Number(shell.uptime_seconds) || 0)
  const pulseValue = String(pulseCount)
  const webCount = webResults.length
  const webReady = webInfo.available !== false
  const webProviderLabel =
    webFallback || webProvider === "Bing RSS"
      ? tr("web.fallback", "Bing RSS fallback")
      : webProvider === "N.E.K.O web_search"
        ? tr("web.viaNeko", "via N.E.K.O web_search")
        : webProvider
  const webSuggestions: string[] = [
    tr("web.suggestions.docs", "N.E.K.O plugin documentation"),
    tr("web.suggestions.news", "technology news today"),
    tr("web.suggestions.ama", "Ama Monster OS N.E.K.O"),
  ]
  const steamCount = steamResults.length
  const steamReady = steamInfo.available !== false
  const steamReadyText = steamReady
    ? tr("steam.ready", "Prices ready")
    : tr("steam.offline", "Price service is unavailable right now.")
  const sale = steamInfo.sale || {}
  const saleCurrent = sale.current || null
  const saleNext = sale.next || null
  const saleNextSeasonal = sale.next_seasonal || null
  const saleUpcoming = Array.isArray(sale.upcoming) ? sale.upcoming : []
  const saleTbd = Array.isArray(sale.all) ? sale.all.filter((event) => event.tbd) : []
  const saleOfficialUrl = sale.source_url || "https://partner.steamgames.com/doc/marketing/upcoming_events"

  const tokenProviderOptions: Array<{ id: string; name: string; zh: string; color: string }> = []
  for (const model of tokenModels) {
    if (!tokenProviderOptions.some((item) => item.id === model.provider)) {
      tokenProviderOptions.push({ id: model.provider, name: model.provider_name, zh: model.provider_zh, color: model.provider_color })
    }
  }
  const visibleTokenModels = tokenProvider === "all"
    ? tokenModels
    : tokenModels.filter((model) => model.provider === tokenProvider)
  const tokenSelectedModel = visibleTokenModels.find((model) => model.id === tokenSelected)
    || visibleTokenModels[0]
    || tokenModels[0]
    || null
  const tokenCandles = tokenSelectedModel ? tokenHistory[tokenSelectedModel.id] || [] : []
  const tokenPriceSort = [...tokenModels].filter((model) => model.input > 0).sort((a, b) => a.input - b.input)
  const tokenCheapest = tokenPriceSort[0] || null
  const tokenPriciest = tokenPriceSort[tokenPriceSort.length - 1] || null
  const tokenBiggestMove = tokenModels.reduce((best, model) => {
    const move = Math.abs(tokenHistoryChange(tokenHistory[model.id] || [], tokenMetric))
    return move > best.move ? { move, model } : best
  }, { move: 0, model: tokenModels[0] || null })
  const tokenPolicy = tokenSelectedModel?.time_policy || {}
  const tokenNow = new Date()
  const tokenUtcMinutes = tokenNow.getUTCHours() * 60 + tokenNow.getUTCMinutes()
  const tokenWeekday = tokenNow.getUTCDay()
  const tokenPeak = tokenPolicy.kind === "deepseek_peak"
    && tokenWeekday >= 1
    && tokenWeekday <= 5
    && (tokenPolicy.peak_windows_utc || []).some((window) => {
      const start = Number(String(window.start).split(":")[0]) * 60 + Number(String(window.start).split(":")[1] || 0)
      const end = Number(String(window.end).split(":")[0]) * 60 + Number(String(window.end).split(":")[1] || 0)
      return tokenUtcMinutes >= start && tokenUtcMinutes < end
    })
  const tokenPeakHours = new Set<number>()
  if (tokenPolicy.kind === "deepseek_peak") {
    for (const window of tokenPolicy.peak_windows_utc || []) {
      const start = Number(String(window.start).split(":")[0])
      const end = Number(String(window.end).split(":")[0])
      for (let hour = start; hour < end; hour += 1) tokenPeakHours.add(hour)
    }
  }
  const tokenIsWeekend = tokenWeekday === 0 || tokenWeekday === 6
  const tokenPeakModels = tokenModels.filter((model) => model.time_policy?.kind === "deepseek_peak")
  const tokenFlatCount = tokenModels.length - tokenPeakModels.length
  const tokenPeakNowPolicy = tokenPeakPolicyFor(tokenModels)
  const tokenPeakNow = tokenPeakState(tokenPeakNowPolicy, tokenNow)
  const tokenPeakCountdownText = tokenPeakCountdown(tokenPeakNow, tr)
  const tokenStatusText = tokenLoading
    ? tr("tokens.updating", "更新中…")
    : tokenStatus === "stale"
      ? tr("tokens.stale", "缓存价")
      : tokenStatus === "error"
        ? tr("tokens.errorShort", "价格源异常")
        : tokenStatus === "idle"
          ? tr("tokens.idle", "待刷新")
          : tr("tokens.live", "实时目录价")
  const tokenUpdatedLabel = tokenUpdatedAt
    ? new Date(tokenUpdatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    : "—"

  const nav = VIEWS.map((item) => (
    <button
      key={item.id}
      type="button"
      className={`ama-nav-btn${activeView === item.id ? " is-active" : ""}`}
      aria-current={activeView === item.id ? "page" : undefined}
      onClick={() => changeView(item.id)}
    >
      <span className="ama-nav-glyph" aria-hidden="true">{item.glyph}</span>
      <span>{tr(item.key, item.id)}</span>
    </button>
  ))

  const titlebar = (
    <header className="ama-titlebar">
      <div className="ama-brand">
        <div className="ama-logo" aria-hidden="true">{uiProfile.glyph || "✦"}</div>
        <div className="ama-brand-title">
          <p className="ama-brand-name">{uiProfile.brand || shellName}</p>
          <p className="ama-brand-sub">{tr("hero.preview", "SHELL PREVIEW")} · {version}</p>
        </div>
      </div>
      <div className="ama-title-pills">
        <span className="ama-pill is-beta"><span className="ama-pill-dot" />{shell.channel || "Beta"}</span>
        <span className="ama-pill is-hosted"><span className="ama-pill-dot" />{tr("footer.local", "Local only")}</span>
      </div>
      <div className="ama-window-actions">
        <button
          type="button"
          className="ama-win-btn"
          title={tr("window.minimize", "Minimize")}
          aria-label={tr("window.minimize", "Minimize")}
          onClick={() => setChrome("min")}
        >–</button>
        <button
          type="button"
          className="ama-win-btn"
          title={activeChrome === "max" ? tr("window.restore", "Restore") : tr("window.maximize", "Expand")}
          aria-label={activeChrome === "max" ? tr("window.restore", "Restore") : tr("window.maximize", "Expand")}
          onClick={() => setChrome(activeChrome === "max" ? "normal" : "max")}
        >{activeChrome === "max" ? "❐" : "□"}</button>
        <button
          type="button"
          className="ama-win-btn is-close"
          title={tr("window.close", "Sleep")}
          aria-label={tr("window.close", "Sleep")}
          onClick={() => setChrome("asleep")}
        >×</button>
      </div>
    </header>
  )

  const sidebar = (
    <aside className="ama-sidebar">
      <div className="ama-profile">
        <div className="ama-avatar" aria-hidden="true">A</div>
        <div>
          <p className="ama-profile-name">Ama</p>
          <p className="ama-profile-role">{tr("profile.role", "Shell keeper")}</p>
          <p className="ama-profile-status"><span className="ama-live-dot" />{tr("profile.status", "Host link ready")}</p>
        </div>
      </div>
      <nav className="ama-nav" aria-label={shellName}>{nav}</nav>
      <div className="ama-side-bottom">
        <div className="ama-side-note">
          <strong>{tr("footer.local", "Local only")}</strong>
          {tr("footer.hint", "This window runs inside N.E.K.O.")}
        </div>
        <button type="button" className="ama-theme-btn" onClick={toggleTheme}>
          <span className="ama-theme-icon" aria-hidden="true">{activeTheme === "dark" ? "☾" : "☀"}</span>
          <span>{activeTheme === "dark" ? tr("theme.light", "Daylight") : tr("theme.dark", "Moonlight")}</span>
        </button>
      </div>
    </aside>
  )

  const orb = (
    <div className="ama-orb-wrap" aria-hidden="true">
      <div className="ama-orb">
        <div className="ama-cat">
          <span className="ama-cat-ear left" />
          <span className="ama-cat-ear right" />
          <span className="ama-cat-face">
            <span className="ama-cat-eye left" />
            <span className="ama-cat-eye right" />
            <span className="ama-cat-blush left" />
            <span className="ama-cat-blush right" />
            <span className="ama-cat-mouth">ω</span>
          </span>
        </div>
        <span className="ama-orb-spark a">✦</span>
        <span className="ama-orb-spark b">✧</span>
        <span className="ama-orb-spark c">·</span>
      </div>
      <div className="ama-sr">{shellName}</div>
    </div>
  )

  const metrics = (
    <div className="ama-metrics">
      <div className="ama-metric">
        <p className="ama-metric-label">{tr("stats.uptime", "Uptime")}</p>
        <p className="ama-metric-value">{uptimeValue}</p>
      </div>
      <div className="ama-metric">
        <p className="ama-metric-label">{tr("stats.contract", "Bridge")}</p>
        <p className="ama-metric-value">v{contractVersion}</p>
      </div>
      <div className="ama-metric">
        <p className="ama-metric-label">{tr("stats.boots", "Boots")}</p>
        <p className="ama-metric-value">{Number(shell.boot_count) || 0}</p>
      </div>
      <div className="ama-metric">
        <p className="ama-metric-label">{tr("stats.pulses", "Pulses")}</p>
        <p className="ama-metric-value">{pulseValue}</p>
      </div>
    </div>
  )

  const bootPanel = (
    <section className="ama-panel">
      <div className="ama-panel-head">
        <div>
          <h2 className="ama-panel-title">{tr("boot.title", "Boot log")}</h2>
        </div>
        <span className="ama-badge is-muted">{shell.codename || "Ama-01"}</span>
      </div>
      <div className="ama-boot-list">
        {events.length === 0 ? (
          <div className="ama-empty">{tr("boot.unknown", "System event")}</div>
        ) : events.map((event, index) => (
          <div className="ama-boot-row" key={`${event.name || "event"}-${event.at || index}-${index}`}>
            <span className="ama-boot-time">{event.at || "--:--:--"}</span>
            <span className="ama-boot-dot" />
            <span className="ama-boot-label">{bootLabel(event.name)}</span>
          </div>
        ))}
      </div>
    </section>
  )

  const bridgeRows = (
    <div className="ama-rows">
      <div className="ama-row"><span className="ama-row-key">{tr("bridge.contract", "Contract")}</span><span className="ama-row-val">v{contractVersion}</span></div>
      <div className="ama-row"><span className="ama-row-key">{tr("bridge.provider", "Provider")}</span><span className="ama-row-val">{bridge.provider || "neko-plugin-host"}</span></div>
      <div className="ama-row"><span className="ama-row-key">{tr("bridge.mode", "Mode")}</span><span className="ama-row-val">{bridge.mode || "hosted-plugin"}</span></div>
      <div className="ama-row"><span className="ama-row-key">{tr("bridge.privacy", "Activity privacy")}</span><span className="ama-row-val">{privacyDetail}</span></div>
    </div>
  )

  const bridgePanel = (
    <section className="ama-panel">
      <div className="ama-panel-head">
        <div>
          <h2 className="ama-panel-title">{tr("bridge.title", "System Bridge")}</h2>
          <p className="ama-panel-hint">{tr("bridge.hint", "The seam that lets this window grow into a native app.")}</p>
        </div>
        <span className={`ama-badge ${bridge.health === "degraded" ? "is-peach" : "is-mint"}`}>{healthLabel}</span>
      </div>
      {bridgeRows}
      {capabilities.length > 0 ? (
        <div className="ama-chips">
          {capabilities.slice(0, 7).map((capability) => <span className="ama-chip" key={capability}>{capability}</span>)}
        </div>
      ) : null}
    </section>
  )

  const modulePanel = (
    <section className="ama-panel">
      <div className="ama-panel-head">
        <div>
          <h2 className="ama-panel-title">{tr("modules.title", "Module deck")}</h2>
          <p className="ama-panel-hint">{tr("modules.hint", "The shell is real. These rooms are reserved for later builds.")}</p>
        </div>
        <span className="ama-badge is-muted">{tr("hero.preview", "SHELL PREVIEW")}</span>
      </div>
      <div className="ama-module-grid">
        {modules.length === 0 ? (
          <div className="ama-empty">{tr("boot.unknown", "System event")}</div>
        ) : modules.map((module) => (
          <div className={`ama-module${module.status === "online" ? "" : " is-reserved"}`} key={module.id || module.name_key}>
            <div className="ama-module-top">
              <span className={`ama-module-icon tone-${moduleTone(module.tone)}`} aria-hidden="true">{module.glyph || "✦"}</span>
              <p className="ama-module-name">{moduleName(module)}</p>
            </div>
            <p className="ama-module-desc">{moduleDescription(module)}</p>
            <span className="ama-module-status"><span className="ama-status-dot" />{statusLabel(module.status)}</span>
          </div>
        ))}
      </div>
    </section>
  )

  const pulseButton = (
    <button
      type="button"
      className="ama-btn ama-btn-primary"
      onClick={runPulse}
      disabled={pulse.status === "running"}
      aria-busy={pulse.status === "running"}
    >
      <span aria-hidden="true">♡</span>{tr("actions.pulse.label", "Pulse check")}
    </button>
  )

  const hero = (
    <section className="ama-hero">
      <div className="ama-hero-copy">
        <div className="ama-kicker"><span className="ama-kicker-line" />{tr("hero.preview", "SHELL PREVIEW")} · v{version}</div>
        <h1 className="ama-hero-title">{greeting}</h1>
        <p className="ama-hero-line">{tr("greeting.line", "Welcome home. The shell is purring.")}</p>
        <p className="ama-hero-caption">{tr("hero.caption", "A cozy little operating system for Ama and her monsters.")}</p>
        <div className="ama-hero-actions">
          {pulseButton}
          <button type="button" className="ama-btn ama-btn-ghost" onClick={refreshShell} disabled={refreshing} aria-busy={refreshing}>
            <span aria-hidden="true">↺</span>{tr("refresh.label", "Refresh")}
          </button>
          <button type="button" className="ama-btn ama-btn-ghost" onClick={() => changeView("web")}>
            <span aria-hidden="true">◎</span>{tr("web.title", "Web room")}
          </button>
        </div>
        <p className={`ama-pulse-line${pulse.status === "success" ? " is-success" : pulse.status === "error" ? " is-error" : pulse.status === "running" ? " is-running" : ""}`} aria-live="polite">
          <span className="ama-pulse-dot" />{pulseMessage}
        </p>
      </div>
      {orb}
    </section>
  )

  const homeView = (
    <>
      {hero}
      {metrics}
      <div className="ama-columns">
        <div>
          {modulePanel}
        </div>
        <div>
          {bridgePanel}
        </div>
      </div>
    </>
  )

  const webView = (
    <>
      <div className="ama-view-head">
        <div>
          <div className="ama-kicker"><span className="ama-kicker-line" />{tr("web.kicker", "NETWORK")}</div>
          <h1 className="ama-view-title">{tr("web.title", "Web room")}</h1>
          <p className="ama-view-sub">{tr("web.subtitle", "A tiny internet window for Ama. Search without leaving the shell.")}</p>
        </div>
        <span className={`ama-badge ${webReady ? "is-mint" : "is-peach"}`}>
          {webReady ? tr("web.ready", "Search ready") : tr("web.offline", "Search is unavailable right now.")}
        </span>
      </div>
      <section className="ama-web-hero">
        <div className="ama-web-form">
          <div
            className="ama-web-input-wrap"
            onKeyDown={(event: any) => {
              if (event.key === "Enter") {
                event.preventDefault()
                runWebSearch(currentWebQuery())
              }
            }}
          >
            <span className="ama-web-glyph" aria-hidden="true">⌕</span>
            <input
              className="ama-web-input"
              type="search"
              value={webQuery}
              maxLength={200}
              autoComplete="off"
              spellCheck={false}
              placeholder={tr("web.placeholder", "Search the internet...")}
              aria-label={tr("web.placeholder", "Search the internet...")}
              onChange={(event: any) => setWebQuery(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="ama-btn ama-btn-primary ama-web-submit"
            disabled={webStatus === "searching"}
            aria-busy={webStatus === "searching"}
            onClick={() => runWebSearch(currentWebQuery())}
          >
            {webStatus === "searching" ? tr("web.searching", "Searching...") : tr("web.search", "Search")}
          </button>
        </div>
        <div className="ama-web-suggestions">
          <span className="ama-web-suggestions-label">{tr("web.suggestionsLabel", "Try")}</span>
          {webSuggestions.map((suggestion) => (
            <button
              type="button"
              className="ama-web-chip"
              key={suggestion}
              onClick={() => runWebSearch(suggestion)}
            >{suggestion}</button>
          ))}
        </div>
        <p className="ama-web-note">{tr("web.privacy", "Only the query leaves this window. No page is fetched automatically; opening a result uses your browser.")}</p>
      </section>

      {webCount > 0 ? (
        <div className="ama-web-meta">
          <strong>{tr("web.results", "{count} results").replace("{count}", String(webCount))}</strong>
          {webProviderLabel ? (
            <span className={`ama-web-provider${webFallback || webProvider === "Bing RSS" ? " is-fallback" : ""}`}>
              {webProviderLabel}
            </span>
          ) : null}
          <span className="ama-badge is-muted">{tr("web.ready", "Search ready")}</span>
        </div>
      ) : null}

      {webStatus === "searching" ? (
        <div className="ama-web-state" role="status">
          <div className="ama-web-spinner" aria-hidden="true" />
          <h3>{tr("web.searching", "Searching...")}</h3>
          <p>{tr("web.privacy", "Only the query leaves this window. No page is fetched automatically; opening a result uses your browser.")}</p>
        </div>
      ) : webStatus === "error" ? (
        <div className="ama-web-state is-error" role="alert">
          <div className="ama-web-state-glyph" aria-hidden="true">!</div>
          <h3>{tr("web.title", "Web room")}</h3>
          <p>{webMessage || tr("web.error", "Search failed. Check your connection or the web_search plugin.")}</p>
        </div>
      ) : webStatus === "empty" ? (
        <div className="ama-web-state">
          <div className="ama-web-state-glyph" aria-hidden="true">⌕</div>
          <h3>{tr("web.empty", "No results. Try a shorter or different query.")}</h3>
          <p>{tr("web.sourceNote", "Results are third-party content. Opening one leaves N.E.K.O.")}</p>
        </div>
      ) : webResults.length === 0 ? (
        <div className="ama-web-state">
          <div className="ama-web-state-glyph" aria-hidden="true">◎</div>
          <h3>{tr("web.ready", "Search ready")}</h3>
          <p>{tr("web.subtitle", "A tiny internet window for Ama. Search without leaving the shell.")}</p>
        </div>
      ) : (
        <div className="ama-web-list">
          {webResults.map((result, index) => (
            <article className="ama-web-result" key={`${result.url || result.title || "result"}-${index}`}>
              <div className="ama-web-rank" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
              <div className="ama-web-result-body">
                <div className="ama-web-result-top">
                  <span className="ama-web-domain">{webDomain(result) || "web"}</span>
                </div>
                <h3 className="ama-web-result-title">{String(result.title || result.url || "")}</h3>
                {result.snippet ? <p className="ama-web-snippet">{String(result.snippet)}</p> : null}
                <div className="ama-web-actions">
                  {isHttpUrl(result.url) ? (
                    <FileDownload
                      href={String(result.url)}
                      label={tr("web.open", "Open")}
                      className="ama-web-open"
                    />
                  ) : null}
                  <span className="ama-web-url">{String(result.url || "")}</span>
                </div>
              </div>
            </article>
          ))}
          <p className="ama-web-note">{tr("web.sourceNote", "Results are third-party content. Opening one leaves N.E.K.O.")}</p>
        </div>
      )}
    </>
  )

  const codexClassNames = Array.isArray(Object.keys(codexSummary.classes || {})) && Object.keys(codexSummary.classes || {}).length > 0
    ? Object.keys(codexSummary.classes || {})
    : ["先锋", "近卫", "重装", "狙击", "术师", "医疗", "辅助", "特种"]
  const codexFiltered = codexOperators.filter((operator) => {
    if (codexClass !== "全部" && operator.class !== codexClass) return false
    if (codexRarity > 0 && Number(operator.rarity) !== codexRarity) return false
    const needle = codexQuery.trim().toLowerCase()
    if (!needle) return true
    const haystack = [operator.name_cn, operator.name_en, operator.class, operator.faction, operator.race, ...(operator.tags || [])]
      .filter(Boolean).join(" ").toLowerCase()
    return haystack.indexOf(needle) >= 0
  })
  const codexCurrent = codexFiltered.find((operator) => operator.id === codexSelected) || codexFiltered[0] || null

  const codexView = (
    <>
      <div className="ama-view-head">
        <div>
          <div className="ama-kicker"><span className="ama-kicker-line" />OPERATOR CODEX</div>
          <h1 className="ama-view-title">{tr("codex.title", "干员图鉴")}</h1>
          <p className="ama-view-sub">
            {tr("codex.subtitle", "离线整理的干员档案：职业、星级、阵营与一句话定位。")}
            {codexSummary.updated ? ` · ${tr("codex.updated", "快照 {date}").replace("{date}", String(codexSummary.updated))}` : ""}
          </p>
        </div>
        <span className="ama-badge is-lilac">{codexOperators.length || codexSummary.total || 0}</span>
      </div>

      <section className="ama-panel ama-codex-toolbar">
        <div className="ama-web-input-wrap">
          <span className="ama-web-glyph" aria-hidden="true">⌕</span>
          <input
            className="ama-web-input"
            type="search"
            value={codexQuery}
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            placeholder={tr("codex.search", "搜索中文名、英文名、阵营或标签…")}
            aria-label={tr("codex.search", "搜索中文名、英文名、阵营或标签…")}
            onInput={(event: any) => setCodexQuery(String(event.target.value))}
          />
        </div>
        <div className="ama-codex-filters">
          {["全部", ...codexClassNames].map((name) => (
            <button
              type="button"
              key={name}
              className={`ama-codex-chip${codexClass === name ? " is-active" : ""}`}
              onClick={() => setCodexClass(name)}
            >
              {name === "全部" ? tr("codex.all", "全部") : name}
              <small>{name === "全部" ? codexOperators.length : (codexSummary.classes?.[name] || 0)}</small>
            </button>
          ))}
        </div>
        <div className="ama-codex-filters">
          {[0, 6, 5, 4, 3].map((rarity) => (
            <button
              type="button"
              key={`rarity-${rarity}`}
              className={`ama-codex-chip${codexRarity === rarity ? " is-active" : ""}`}
              onClick={() => setCodexRarity(rarity)}
            >
              {rarity === 0 ? tr("codex.anyRarity", "全部星级") : `${rarity}★`}
            </button>
          ))}
          <span className="ama-codex-count">
            {tr("codex.matched", "匹配 {count} 位").replace("{count}", String(codexFiltered.length))}
          </span>
        </div>
      </section>

      {codexMessage ? <div className="ama-note">{codexMessage}</div> : null}

      <div className="ama-codex-layout">
        <section className="ama-panel ama-codex-list">
          {codexLoading && codexOperators.length === 0 ? (
            <div className="ama-web-state" role="status">
              <div className="ama-web-spinner" aria-hidden="true" />
              <h3>{tr("codex.loading", "正在读取图鉴…")}</h3>
            </div>
          ) : codexFiltered.length === 0 ? (
            <div className="ama-web-state">
              <div className="ama-web-state-glyph" aria-hidden="true">▤</div>
              <h3>{tr("codex.empty", "没有匹配的干员")}</h3>
              <p>{tr("codex.emptyHint", "换个关键词，或把职业 / 星级切回全部。")}</p>
            </div>
          ) : (
            <div className="ama-codex-grid">
              {codexFiltered.map((operator) => (
                <button
                  type="button"
                  key={operator.id}
                  className={`ama-codex-card${codexCurrent?.id === operator.id ? " is-active" : ""}`}
                  onClick={() => void selectCodexOperator(operator.id)}
                >
                  <span
                    className="ama-codex-avatar"
                    style={{ background: `linear-gradient(150deg, ${operator.class_color || "#4a90d9"}, color-mix(in srgb, ${operator.class_color || "#4a90d9"} 62%, #1b2a3a))` }}
                    aria-hidden="true"
                  >{operator.initial || operator.name_cn.slice(0, 1)}</span>
                  <span className="ama-codex-body">
                    <strong>{operator.name_cn}</strong>
                    <small>{operator.name_en}</small>
                    <span className="ama-codex-meta">
                      <em>{operator.class}</em>
                      <i>{"★".repeat(operator.rarity)}</i>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="ama-panel ama-codex-detail">
          {codexCurrent ? (
            <>
              <div className="ama-codex-detail-head">
                <span
                  className="ama-codex-avatar is-large"
                  style={{ background: `linear-gradient(150deg, ${codexCurrent.class_color || "#4a90d9"}, color-mix(in srgb, ${codexCurrent.class_color || "#4a90d9"} 60%, #1b2a3a))` }}
                  aria-hidden="true"
                >{codexCurrent.initial || codexCurrent.name_cn.slice(0, 1)}</span>
                <div>
                  <h2>{codexCurrent.name_cn}</h2>
                  <p>{codexCurrent.name_en}</p>
                  <span className="ama-codex-stars">{"★".repeat(codexCurrent.rarity)}</span>
                </div>
              </div>
              <div className="ama-codex-tabs" role="tablist" aria-label={tr("codex.detailTabs", "档案分页")}>
                {([
                  ["overview", tr("codex.tabOverview", "概览")],
                  ["skins", tr("codex.tabSkins", "皮肤")],
                  ["story", tr("codex.tabStory", "故事")],
                ] as Array<["overview" | "skins" | "story", string]>).map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    role="tab"
                    aria-selected={codexTab === id}
                    className={`ama-codex-tab${codexTab === id ? " is-active" : ""}`}
                    onClick={() => setCodexTab(id)}
                  >{label}</button>
                ))}
              </div>
              {codexTab === "overview" ? (
                <>
                  <dl className="ama-codex-facts">
                    <div><dt>{tr("codex.class", "职业")}</dt><dd>{codexCurrent.class}</dd></div>
                    <div><dt>{tr("codex.rarity", "星级")}</dt><dd>{codexCurrent.rarity}★</dd></div>
                    <div><dt>{tr("codex.faction", "阵营")}</dt><dd>{codexCurrent.faction || "—"}</dd></div>
                    <div><dt>{tr("codex.race", "种族")}</dt><dd>{codexCurrent.race || "—"}</dd></div>
                  </dl>
                  <p className="ama-codex-role">{codexCurrent.role}</p>
                  <div className="ama-codex-tags">
                    {(codexCurrent.tags || []).map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                </>
              ) : null}
              {codexTab === "skins" ? (
                <div className="ama-codex-skins">
                  {codexDetailLoading ? <p className="ama-studio-note">{tr("codex.loadingDetail", "读取中…")}</p> : null}
                  {(codexDetail.skins || []).length > 0 ? (
                    (codexDetail.skins || []).map((skin) => (
                      <article className="ama-skin-card" key={skin.name}>
                        <div className="ama-skin-art" aria-hidden="true">
                          <span>{codexCurrent.initial || codexCurrent.name_cn.slice(0, 1)}</span>
                          <small>{codexCurrent.class}</small>
                        </div>
                        <div className="ama-skin-body">
                          <strong>{skin.name}</strong>
                          <small>{[skin.series, skin.release, skin.obtain].filter(Boolean).join(" · ")}</small>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="ama-codex-role">{tr("codex.noSkins", "本地暂未收录这位干员的皮肤。")}</p>
                  )}
                  <p className="ama-codex-skin-note">{codexDetail.skin_note || tr("codex.skinNote", "本地只收录少量示例皮肤，完整列表见 PRTS。")}</p>
                  <FileDownload
                    href={`https://prts.wiki/w/${encodeURIComponent(codexCurrent.name_cn)}`}
                    label={tr("codex.skinLink", "在 PRTS 查看皮肤与立绘")}
                    className="ama-web-open"
                  />
                </div>
              ) : null}
              {codexTab === "story" ? (
                <div className="ama-codex-story">
                  {((codexDetail.story || {}).lines || []).map((line) => <p key={line}>{line}</p>)}
                  <p className="ama-codex-skin-note">{((codexDetail.story || {}).note) || tr("codex.storyNote", "这里只做入门速览，不转载剧情原文。")}</p>
                  {(codexDetail.story || {}).link ? (
                    <FileDownload
                      href={String((codexDetail.story || {}).link)}
                      label={String((codexDetail.story || {}).link_label || tr("codex.storyLink", "查看完整剧情"))}
                      className="ama-web-open"
                    />
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="ama-web-state">
              <div className="ama-web-state-glyph" aria-hidden="true">▤</div>
              <h3>{tr("codex.pick", "选一位干员")}</h3>
            </div>
          )}
          <p className="ama-codex-disclaimer">{codexSummary.disclaimer || tr("codex.disclaimer", "本地整理，不含官方立绘与剧情文本，以游戏内资料为准。")}</p>
        </aside>
      </div>

      <section className="ama-panel ama-codex-tools">
        <div className="ama-panel-head">
          <div>
            <div className="ama-kicker">HELPER TOOLS</div>
            <h2>{tr("codex.toolsTitle", "明日方舟辅助工具与下载渠道")}</h2>
            <p>{tr("codex.toolsHint", "全部为外部链接，点击在浏览器打开；插件不下载、不内置这些软件。")}</p>
          </div>
          <span className="ama-badge is-muted">{codexTools.length}</span>
        </div>
        <div className="ama-tool-grid">
          {codexTools.map((tool) => (
            <article className="ama-tool-card" key={tool.id}>
              <div className="ama-tool-top">
                <strong>{tool.name}</strong>
                <span className={`ama-tool-kind is-${tool.kind}`}>
                  {tool.download ? tr("codex.toolDownload", "含下载") : tr("codex.toolWeb", "网页")}
                </span>
              </div>
              <p>{tool.note}</p>
              <FileDownload href={tool.url} label={tr("codex.toolOpen", "打开")} className="ama-web-open" />
            </article>
          ))}
        </div>
        <p className="ama-codex-disclaimer">
          {tr("codex.toolsNote", "第三方站点与官方客户端以各自页面为准；下载请在官网或官方社区进行，注意辨别仿冒站点。")}
        </p>
      </section>
    </>
  )

  const tokenView = (
    <>
      <div className="ama-view-head ama-token-head">
        <div>
          <div className="ama-kicker"><span className="ama-kicker-line" />TOKEN RADAR</div>
          <h1 className="ama-view-title">{tr("tokens.title", "Token 看板")}</h1>
          <p className="ama-view-sub">{tr("tokens.subtitle", "国内外主流模型的公开目录价、30 日 K 线和峰谷时段。")}</p>
        </div>
        <div className="ama-token-head-actions">
          <span key={`token-live-${tokenPulse}`} className={`ama-token-live is-${tokenStatus}`}><i />{tokenStatusText}</span>
          <button type="button" className="ama-btn ama-btn-primary" disabled={tokenLoading} onClick={() => void loadTokenPrices(true)}>
            {tokenLoading ? tr("tokens.updating", "更新中…") : tr("tokens.refresh", "刷新价格")}
          </button>
          <button type="button" className={`ama-web-chip ${tokenAuto ? "is-active" : ""}`} onClick={() => setTokenAuto((value) => !value)}>
            {tokenAuto ? tr("tokens.autoOn", "60s 自动") : tr("tokens.autoOff", "手动")}
          </button>
        </div>
      </div>

      <div className="ama-token-stats">
        <article className="ama-token-stat">
          <span>{tr("tokens.stats.models", "覆盖模型")}</span>
          <strong>{tokenModels.length}</strong>
          <small>{tokenProviderOptions.length} {tr("tokens.stats.providers", "家厂商")}</small>
        </article>
        <article className="ama-token-stat">
          <span>{tr("tokens.stats.cheapest", "最低输入价")}</span>
          <strong>{tokenCheapest ? formatTokenPrice(tokenCheapest.input) : "—"}</strong>
          <small>{tokenCheapest ? tokenCheapest.name : tr("tokens.waiting", "等待价格")}</small>
        </article>
        <article className="ama-token-stat">
          <span>{tr("tokens.stats.priciest", "最高输入价")}</span>
          <strong>{tokenPriciest ? formatTokenPrice(tokenPriciest.input) : "—"}</strong>
          <small>{tokenPriciest ? tokenPriciest.name : "—"}</small>
        </article>
        <article className="ama-token-stat">
          <span>{tr("tokens.stats.move", "30 日最大波动")}</span>
          <strong>{tokenBiggestMove.model ? `${tokenBiggestMove.move.toFixed(2)}%` : "—"}</strong>
          <small>{tokenBiggestMove.model ? tokenBiggestMove.model.name : tr("tokens.baseline", "目录基线")}</small>
        </article>
      </div>

      <section className="ama-panel ama-token-peak">
        <div className="ama-panel-head">
          <div>
            <div className="ama-kicker">AI PEAK HOURS</div>
            <h2>
              {tr("tokens.peakTitle", "AI 高峰时段")}
              <span className={`ama-token-now ama-token-now-inline ${tokenPeakNow.peak ? "is-peak" : "is-offpeak"}`}>
                {tokenModels.length === 0
                  ? tr("tokens.waiting", "等待价格")
                  : tokenPeakNow.peak ? tr("tokens.peakNow", "当前高峰") : tr("tokens.offPeakNow", "当前低谷")}
              </span>
            </h2>
            <p>{tr("tokens.peakHint", "DeepSeek 按高低峰浮动；其他厂商全天同价。")}</p>
          </div>
        </div>
        <div className="ama-token-peak-body">
          <div className="ama-token-peak-clock">
            <div className="ama-token-clockbar">
              {Array.from({ length: 24 }, (_, hour) => (
                <span
                  key={`peak-${hour}`}
                  className={tokenPeakHours.has(hour) ? "is-peak" : "is-offpeak"}
                  title={`${String(hour).padStart(2, "0")}:00 UTC`}
                />
              ))}
              <i className="ama-token-clock-now" style={{ left: `${(tokenUtcMinutes / 1440) * 100}%` }} />
            </div>
            <div className="ama-token-clock-labels"><span>00</span><span>06</span><span>12</span><span>18</span><span>24 UTC</span></div>
            <div className="ama-token-peak-windows">
              {(tokenPeakNowPolicy?.peak_windows_utc || []).map((window) => (
                <span key={`${window.start}-${window.end}`}>{window.start}–{window.end} UTC</span>
              ))}
              <span className="ama-token-peak-local">{(tokenPeakNowPolicy?.local_windows || []).map((window) => `${window.start}–${window.end}`).join(" / ")} 北京时间</span>
            </div>
            <p className="ama-token-clock-note">
              {tokenPeakNow.peak
                ? tr("tokens.peakNowNote", "现在属于高峰价，DeepSeek 约为低谷的 2 倍。")
                : tr("tokens.offPeakNowNote", "现在是低谷价；周末与法定节假日整天按低谷计费。")}
            </p>
          </div>
          <div className="ama-token-peak-meta">
            <div>
              <span>{tr("tokens.peakCountdown", "下一次切换")}</span>
              <strong>
                {tokenPeakCountdownText
                  || (tokenModels.length === 0 ? tr("tokens.waiting", "等待价格") : tr("tokens.peakUnknown", "未公布时段"))}
              </strong>
              <small>{tokenPeakNow.peak ? tr("tokens.toOffPeak", "进入低谷") : tr("tokens.toPeak", "进入高峰")}</small>
            </div>
            <div>
              <span>{tr("tokens.peakModels", "按时段浮动")}</span>
              <strong>{tokenPeakModels.length}</strong>
              <small>{tr("tokens.peakModelsHint", "DeepSeek 模型")}</small>
            </div>
            <div>
              <span>{tr("tokens.flatModels", "全天同价")}</span>
              <strong>{tokenFlatCount}</strong>
              <small>{tr("tokens.flatModelsHint", "其余厂商")}</small>
            </div>
          </div>
        </div>
      </section>

      {tokenMessage ? <div className="ama-note ama-token-note">{tokenMessage}</div> : null}

      <div className="ama-token-grid">
        <section className="ama-panel ama-token-board">
          <div className="ama-panel-head">
            <div>
              <div className="ama-kicker">{tr("tokens.catalogKicker", "PUBLIC CATALOG")}</div>
              <h2>{tr("tokens.catalog", "模型目录价")}</h2>
              <p>{tr("tokens.catalogHint", "USD / 1M tokens · 60 秒轮询 · 厂商调价才跳动")}</p>
            </div>
            <span className="ama-badge is-lilac">{tokenUpdatedLabel}</span>
          </div>
          <div className="ama-token-filters">
            <button type="button" className={`ama-token-filter ${tokenProvider === "all" ? "is-active" : ""}`} onClick={() => setTokenProvider("all")}>
              {tr("tokens.all", "全部")} <small>{tokenModels.length}</small>
            </button>
            {tokenProviderOptions.map((provider) => (
              <button
                type="button"
                key={provider.id}
                className={`ama-token-filter ${tokenProvider === provider.id ? "is-active" : ""}`}
                onClick={() => setTokenProvider(provider.id)}
              >
                <i style={{ background: provider.color }} />{provider.name} <small>{tokenModels.filter((model) => model.provider === provider.id).length}</small>
              </button>
            ))}
          </div>
          {visibleTokenModels.length > 0 ? (
            <div className="ama-token-list">
              {visibleTokenModels.map((model) => {
                const change = tokenHistoryChange(tokenHistory[model.id] || [], tokenMetric)
                const active = tokenSelectedModel?.id === model.id
                return (
                  <button
                    type="button"
                    key={model.id}
                    className={`ama-token-row ${active ? "is-active" : ""}`}
                    onClick={() => setTokenSelected(model.id)}
                  >
                    <i className="ama-token-provider-dot" style={{ background: model.provider_color }} />
                    <span className="ama-token-model">
                      <strong>{model.name}</strong>
                      <small>
                        {model.provider_name} · {model.provider_zh}{model.provider_region === "china" ? ` · ${tr("tokens.cn", "国内")}` : ""}
                        {model.time_policy?.kind === "deepseek_peak" ? (
                          <em className={`ama-token-peak-tag ${tokenPeakNow.peak ? "is-peak" : "is-offpeak"}`}>
                            {tokenPeakNow.peak ? tr("tokens.peak", "高峰价") : tr("tokens.offPeak", "非高峰价")}
                          </em>
                        ) : null}
                      </small>
                    </span>
                    <span className="ama-token-price-cell">
                      <strong>{formatTokenPrice(model.input)}</strong>
                      <small>{tr("tokens.input", "输入")}</small>
                    </span>
                    <span className="ama-token-price-cell">
                      <strong>{formatTokenPrice(model.output)}</strong>
                      <small>{tr("tokens.output", "输出")}</small>
                    </span>
                    <span className={`ama-token-row-change ${change >= 0 ? "is-up" : "is-down"}`}>
                      {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="ama-token-empty">
              <span>{tokenLoading ? tr("tokens.updating", "更新中…") : tr("tokens.empty", "暂无模型价格")}</span>
              {!tokenLoading ? <button type="button" className="ama-web-chip" onClick={() => void loadTokenPrices(true)}>{tr("tokens.retry", "重试")}</button> : null}
            </div>
          )}
          <p className="ama-token-source">
            {tr("tokens.source", "数据源")}：
            <a href="https://models.dev/" target="_blank" rel="noreferrer">models.dev</a>
            <span> · {tokenUpdatedAt ? new Date(tokenUpdatedAt).toLocaleString("zh-CN") : "—"}</span>
          </p>
        </section>

        <aside className="ama-token-side">
          <section className="ama-panel ama-token-focus">
            <div className="ama-panel-head">
              <div>
                <div className="ama-kicker">{tr("tokens.focusKicker", "SELECTED MODEL")}</div>
                <h2>{tokenSelectedModel?.name || "—"}</h2>
                <p>{tokenSelectedModel ? `${tokenSelectedModel.provider_name} · ${tokenSelectedModel.provider_zh}` : tr("tokens.pick", "选择一个模型")}</p>
              </div>
              {tokenSelectedModel ? <i className="ama-token-large-dot" style={{ background: tokenSelectedModel.provider_color }} /> : null}
            </div>
            {tokenSelectedModel ? (
              <>
                <div className="ama-token-focus-prices">
                  <div><span>{tr("tokens.input", "输入")}</span><strong>{formatTokenPrice(tokenSelectedModel.input)}</strong></div>
                  <div><span>{tr("tokens.output", "输出")}</span><strong>{formatTokenPrice(tokenSelectedModel.output)}</strong></div>
                  <div><span>{tr("tokens.cache", "缓存命中")}</span><strong>{formatTokenPrice(tokenSelectedModel.cache_read)}</strong></div>
                </div>
                <div className="ama-token-focus-facts">
                  <span>{tr("tokens.context", "上下文")} <strong>{formatTokenContext(tokenSelectedModel.context)}</strong></span>
                  <span>{tr("tokens.release", "发布")} <strong>{tokenSelectedModel.release_date || "—"}</strong></span>
                  {tokenSelectedModel.tier ? <span>{tr("tokens.tier", "超过 {size} 后").replace("{size}", formatTokenContext(tokenSelectedModel.tier.threshold))} <strong>{formatTokenPrice(tokenSelectedModel.tier.input)}</strong></span> : null}
                </div>
                <div className="ama-token-change-big">
                  <span>{tr("tokens.change30", "30 日变化")}</span>
                  <strong className={tokenHistoryChange(tokenCandles, tokenMetric) >= 0 ? "is-up" : "is-down"}>
                    {tokenHistoryChange(tokenCandles, tokenMetric) >= 0 ? "+" : ""}{tokenHistoryChange(tokenCandles, tokenMetric).toFixed(2)}%
                  </strong>
                  <small>{tokenHistoryMeta.baseline ? tr("tokens.baseline", "目录基线") : tr("tokens.observed", "本机观测")}</small>
                </div>
              </>
            ) : null}
          </section>

          <section className="ama-panel ama-token-clock">
            <div className="ama-panel-head">
              <div>
                <div className="ama-kicker">{tr("tokens.clockKicker", "PRICE WINDOW")}</div>
                <h2>{tr("tokens.clock", "价格时段")}</h2>
              </div>
              <span className={`ama-token-now ${tokenPeak ? "is-peak" : "is-offpeak"}`}>
                {tokenPolicy.kind === "deepseek_peak"
                  ? (tokenIsWeekend ? tr("tokens.weekend", "周末非高峰") : tokenPeak ? tr("tokens.peak", "高峰价") : tr("tokens.offPeak", "非高峰价"))
                  : tr("tokens.flat", "全天同价")}
              </span>
            </div>
            <div className={`ama-token-clockbar ${tokenPolicy.kind === "deepseek_peak" ? "" : "is-flat"}`}>
              {Array.from({ length: 24 }, (_, hour) => (
                <span
                  key={hour}
                  className={tokenPolicy.kind === "deepseek_peak" && tokenPeakHours.has(hour) ? "is-peak" : "is-offpeak"}
                  title={`${String(hour).padStart(2, "0")}:00 UTC`}
                />
              ))}
              <i className="ama-token-clock-now" style={{ left: `${(tokenUtcMinutes / 1440) * 100}%` }} />
            </div>
            <div className="ama-token-clock-labels"><span>00</span><span>06</span><span>12</span><span>18</span><span>24 UTC</span></div>
            <p className="ama-token-clock-note">
              {tokenPolicy.note || tr("tokens.flatNote", "厂商按 token 统一目录价计费，没有早晚峰谷。")}
            </p>
            {tokenPolicy.kind === "deepseek_peak" ? (
              <div className="ama-token-window-prices">
                <div><span>{tr("tokens.peak", "高峰价")}</span><strong>{formatTokenPrice(tokenPolicy.peak_input)} / {formatTokenPrice(tokenPolicy.peak_output)}</strong></div>
                <div><span>{tr("tokens.offPeak", "非高峰价")}</span><strong>{formatTokenPrice(tokenPolicy.off_peak_input)} / {formatTokenPrice(tokenPolicy.off_peak_output)}</strong></div>
                <small>{tr("tokens.localWindows", "北京时间 09:00–12:00、14:00–18:00（周一至周五）")}</small>
              </div>
            ) : (
              <div className="ama-token-window-prices">
                <div><span>{tr("tokens.cache", "缓存命中")}</span><strong>{formatTokenPrice(tokenSelectedModel?.cache_read)}</strong></div>
                <div><span>{tr("tokens.cacheSaving", "缓存节省")}</span><strong>{Math.round((tokenSelectedModel?.cache_discount || 0) * 100)}%</strong></div>
                <small>{tr("tokens.flatCheap", "便宜来自缓存命中、Batch 批处理与上下文档位，不是早晚时段。")}</small>
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className="ama-panel ama-token-chart-panel">
        <div className="ama-panel-head">
          <div>
            <div className="ama-kicker">30 DAY CANDLES</div>
            <h2>{tr("tokens.chart", "近 30 日价格 K 线")}</h2>
            <p>{tokenSelectedModel ? `${tokenSelectedModel.name} · ${tokenMetric === "input" ? tr("tokens.input", "输入") : tr("tokens.output", "输出")}价 · USD / 1M` : tr("tokens.pick", "选择一个模型")}</p>
          </div>
          <div className="ama-token-chart-tools">
            <button type="button" className={`ama-web-chip ${tokenMetric === "input" ? "is-active" : ""}`} onClick={() => setTokenMetric("input")}>{tr("tokens.input", "输入")}</button>
            <button type="button" className={`ama-web-chip ${tokenMetric === "output" ? "is-active" : ""}`} onClick={() => setTokenMetric("output")}>{tr("tokens.output", "输出")}</button>
            <span className="ama-badge">{tokenHistoryMeta.days || tokenCandles.length}D</span>
          </div>
        </div>
        <TokenKLine candles={tokenCandles} metric={tokenMetric} label={tokenSelectedModel?.name || tr("tokens.chart", "近 30 日价格 K 线")} />
        <p className="ama-token-footnote">{tokenHistoryMeta.note || tr("tokens.historyNote", "首次采集以当前目录价回填基线；之后每日记录开高低收。")}</p>
      </section>
    </>
  )

  const steamView = (
    <>
      <div className="ama-view-head">
        <div>
          <div className="ama-kicker"><span className="ama-kicker-line" />{tr("steam.kicker", "STORE WATCH")}</div>
          <h1 className="ama-view-title">{tr("steam.title", "Steam price room")}</h1>
          <p className="ama-view-sub">{tr("steam.subtitle", "Check the current lowest price and CheapShark's all-time low.")}</p>
        </div>
        <span className={`ama-badge ${steamReady ? "is-mint" : "is-peach"}`}>{steamReadyText}</span>
      </div>
      <section className="ama-sale-panel">
        <div className="ama-panel-head">
          <div>
            <h2 className="ama-panel-title">{tr("steam.sale.title", "Sale radar")}</h2>
            <p className="ama-panel-hint">{tr("steam.sale.subtitle", "Next Steam event and the next seasonal sale.")}</p>
          </div>
          <FileDownload
            href={saleOfficialUrl}
            label={tr("steam.sale.official", "Official schedule")}
            className="ama-web-open"
          />
        </div>
        <div className={`ama-sale-current${saleCurrent ? " is-active" : ""}`}>
          <span className="ama-sale-dot" aria-hidden="true" />
          <span>
            {saleCurrent
              ? `${tr("steam.sale.active", "Active now")} · ${saleEventName(saleCurrent)}`
              : tr("steam.sale.noneActive", "No Steam-wide seasonal sale is active.")}
          </span>
        </div>
        <div className="ama-sale-highlights">
          {saleNext ? (
            <div className="ama-sale-highlight">
              <div className="ama-sale-label">
                {tr("steam.sale.next", "Next event")}
                <span className="ama-sale-kind">
                  {saleNext.kind === "seasonal" ? tr("steam.sale.kind.seasonal", "Seasonal sale") : tr("steam.sale.kind.themed", "Themed fest")}
                </span>
              </div>
              <strong>{saleEventName(saleNext)}</strong>
              <small>{saleDateRange(saleNext)}</small>
              <em>{saleCountdown(saleNext)}</em>
            </div>
          ) : null}
          {saleNextSeasonal && (!saleNext || saleNextSeasonal.id !== saleNext.id) ? (
            <div className="ama-sale-highlight">
              <div className="ama-sale-label">
                {tr("steam.sale.nextSeasonal", "Next seasonal sale")}
              </div>
              <strong>{saleEventName(saleNextSeasonal)}</strong>
              <small>{saleDateRange(saleNextSeasonal)}</small>
              <em>{saleCountdown(saleNextSeasonal)}</em>
            </div>
          ) : null}
        </div>
        <details className="ama-sale-details">
          <summary>{tr("steam.sale.upcoming", "Upcoming schedule")}</summary>
          <div className="ama-sale-list">
            {saleUpcoming.map((event) => (
              <div className="ama-sale-row" key={event.id || event.name}>
                <div className="ama-sale-row-main">
                  <div className="ama-sale-row-name">{saleEventName(event)}</div>
                  <div className="ama-sale-row-date">{saleDateRange(event)} · {saleCountdown(event)}</div>
                </div>
                <span className="ama-sale-row-kind">
                  {event.kind === "seasonal" ? tr("steam.sale.kind.seasonal", "Seasonal sale") : tr("steam.sale.kind.themed", "Themed fest")}
                </span>
              </div>
            ))}
            {saleTbd.map((event) => (
              <div className="ama-sale-row" key={event.id || event.name}>
                <div className="ama-sale-row-main">
                  <div className="ama-sale-row-name">{saleEventName(event)}</div>
                  <div className="ama-sale-row-date">{tr("steam.sale.tbd", "TBD")}</div>
                </div>
                <span className="ama-sale-row-kind">{tr("steam.sale.kind.seasonal", "Seasonal sale")}</span>
              </div>
            ))}
          </div>
        </details>
        <p className="ama-sale-source">
          {tr("steam.sale.source", "Source: Steamworks")} · {tr("steam.sale.updated", "Updated {date}").replace("{date}", sale.updated || "—")} · {tr("steam.sale.timeNote", "Dates use your local timezone.")}
        </p>
      </section>
      <div className="ama-steam-tabs" role="tablist" aria-label={tr("steam.title", "Steam price room")}>
        <button
          type="button"
          role="tab"
          aria-selected={steamTab === "prices"}
          className={`ama-steam-tab${steamTab === "prices" ? " is-active" : ""}`}
          onClick={() => selectSteamTab("prices")}
        >{tr("steam.tab.prices", "Prices")}</button>
        <button
          type="button"
          role="tab"
          aria-selected={steamTab === "picks"}
          className={`ama-steam-tab${steamTab === "picks" ? " is-active" : ""}`}
          onClick={() => selectSteamTab("picks")}
        >{tr("steam.tab.picks", "Sale picks")}</button>
      </div>
      {steamTab === "prices" ? (
        <>
      <div className={`ama-steam-account${steamAccount.steam_id ? " is-linked" : ""}`}>
        {steamAccount.steam_id && isHttpUrl(steamAccount.avatar) ? (
          <img className="ama-steam-avatar" src={String(steamAccount.avatar)} alt="" />
        ) : (
          <div className="ama-steam-account-icon" aria-hidden="true">S</div>
        )}
        <div className="ama-steam-account-main">
          <p className="ama-steam-account-title">
            {steamAccount.steam_id
              ? (steamAccount.nickname || tr("steam.account.linkedName", "Steam 已连接"))
              : tr("steam.account.title", "Steam account")}
          </p>
          <p className="ama-steam-account-note">
            {steamAccount.steam_id
              ? `SteamID ${steamAccount.steam_id}${steamAccount.online_state ? ` · ${steamAccount.online_state}` : ""}`
              : (steamAccelerator.available
                ? tr("steam.accel.ok", "已检测到 Steam++，可以直连登录。")
                : tr("steam.accel.missing", "未检测到 Steam++；国内网络请先开启「Steam 社区」加速。"))}
          </p>
          {!steamAccount.steam_id && steamLoginError ? <p className="ama-steam-account-warn">{steamLoginError}</p> : null}
          {steamLoginUrl ? (
            <div className="ama-steam-login-link">
              <FileDownload href={steamLoginUrl} label={tr("steam.login.open", "打开 Steam 登录页")} className="ama-web-open" />
              <span>{steamLoginNote || tr("steam.login.hint", "在浏览器完成登录后会自动回到这里。")}</span>
              <code className="ama-steam-login-url">{steamLoginUrl}</code>
            </div>
          ) : null}
        </div>
        {steamAccount.steam_id ? (
          <button type="button" className="ama-web-chip" onClick={() => void signOutSteam()}>
            {tr("steam.logout", "退出")}
          </button>
        ) : (
          <button
            type="button"
            className="ama-btn ama-btn-primary"
            disabled={steamLoginBusy}
            onClick={() => void startSteamLogin()}
          >
            {steamLoginBusy ? tr("steam.login.starting", "启动中…") : tr("steam.login", "登录 Steam")}
          </button>
        )}
      </div>
      <section className="ama-web-hero ama-steam-hero">
        <div className="ama-web-form">
          <div
            className="ama-web-input-wrap"
            onKeyDown={(event: any) => {
              if (event.key === "Enter") {
                event.preventDefault()
                runSteamSearch(currentSteamQuery())
              }
            }}
          >
            <span className="ama-web-glyph" aria-hidden="true">◈</span>
            <input
              className="ama-web-input ama-steam-input"
              type="search"
              value={steamQuery}
              maxLength={100}
              autoComplete="off"
              spellCheck={false}
              placeholder={tr("steam.placeholder", "Game name or Steam AppID...")}
              aria-label={tr("steam.placeholder", "Game name or Steam AppID...")}
              onChange={(event: any) => setSteamQuery(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="ama-btn ama-btn-primary ama-web-submit"
            disabled={steamStatus === "searching"}
            aria-busy={steamStatus === "searching"}
            onClick={() => runSteamSearch(currentSteamQuery())}
          >
            {steamStatus === "searching" ? tr("steam.searching", "Checking prices...") : tr("steam.search", "Check price")}
          </button>
        </div>
        <div className="ama-web-suggestions">
          <span className="ama-web-suggestions-label">{tr("steam.suggestionsLabel", "Try")}</span>
          {["Portal 2", "Hades", "Stardew Valley"].map((game) => (
            <button type="button" className="ama-web-chip" key={game} onClick={() => runSteamSearch(game)}>{game}</button>
          ))}
        </div>
        <p className="ama-web-note">{tr("steam.sourceNote", "Prices come from CheapShark in USD.")}</p>
        <p className="ama-web-note">{tr("steam.cn.note", "CN prices are current Steam China store prices in CNY, not historical lows.")}</p>
      </section>

      {steamCount > 0 ? (
        <div className="ama-web-meta">
          <strong>{tr("steam.results", "{count} games").replace("{count}", String(steamCount))}</strong>
          <span className="ama-web-provider">{tr("steam.source", "Source")} · CheapShark · USD</span>
          <span className="ama-badge is-muted">{tr("steam.ready", "Prices ready")}</span>
        </div>
      ) : null}

      {steamStatus === "searching" ? (
        <div className="ama-web-state" role="status">
          <div className="ama-web-spinner" aria-hidden="true" />
          <h3>{tr("steam.searching", "Checking prices...")}</h3>
          <p>{tr("steam.sourceNote", "Prices come from CheapShark in USD.")}</p>
        </div>
      ) : steamStatus === "error" ? (
        <div className="ama-web-state is-error" role="alert">
          <div className="ama-web-state-glyph" aria-hidden="true">!</div>
          <h3>{tr("steam.title", "Steam price room")}</h3>
          <p>{steamMessage || tr("steam.error", "Price lookup failed. Check your connection and try again.")}</p>
        </div>
      ) : steamStatus === "empty" ? (
        <div className="ama-web-state">
          <div className="ama-web-state-glyph" aria-hidden="true">◈</div>
          <h3>{tr("steam.empty", "No Steam games found.")}</h3>
          <p>{tr("steam.sourceNote", "Prices come from CheapShark in USD.")}</p>
        </div>
      ) : steamResults.length === 0 ? (
        <div className="ama-web-state">
          <div className="ama-web-state-glyph" aria-hidden="true">◈</div>
          <h3>{tr("steam.ready", "Prices ready")}</h3>
          <p>{tr("steam.subtitle", "Check the current lowest price and CheapShark's all-time low.")}</p>
        </div>
      ) : (
        <div className="ama-steam-grid">
          {steamResults.map((game, index) => {
            const current = game.current || {}
            const history = game.history || {}
            const isLow = game.is_at_low === true
            return (
              <article className="ama-steam-card" key={`${game.game_id || game.steam_app_id || "game"}-${index}`}>
                <div className="ama-steam-head">
                  <div>
                    <div className="ama-steam-app">{tr("steam.appId", "App")} {game.steam_app_id || "—"}</div>
                    <h3 className="ama-steam-title">{game.title || "—"}</h3>
                    {game.title_cn ? <div className="ama-steam-title-alt">{game.title_cn}</div> : null}
                  </div>
                  <span className={`ama-steam-low${isLow ? " is-low" : ""}`}>
                    {isLow ? tr("steam.atLow", "At the low") : tr("steam.aboveLow", "Above the low")}
                  </span>
                </div>
                <div className="ama-steam-prices">
                  <div className="ama-steam-price">
                    <span>{tr("steam.current", "Current lowest")}</span>
                    <strong>{usd(current.price)}</strong>
                    <small>{current.store || "—"}</small>
                  </div>
                  <div className="ama-steam-price is-low">
                    <span>{tr("steam.history", "All-time low")}</span>
                    <strong>{usd(history.lowest)}</strong>
                    <small>{history.date || "—"}</small>
                  </div>
                  <div className="ama-steam-price">
                    <span>{tr("steam.gap", "Above low")}</span>
                    <strong>{usdGap(game.gap_to_low)}</strong>
                    <small>{tr("steam.currency", "Currency")} USD</small>
                  </div>
                  <div className="ama-steam-price is-cn">
                    <span>{tr("steam.cn.price", "CN price")}</span>
                    <strong>{game.cn?.available ? (game.cn.formatted || (game.cn.price ? `¥ ${game.cn.price}` : "—")) : "—"}</strong>
                    <small>
                      {game.cn?.available
                        ? (Number(game.cn.discount_percent) > 0 ? `-${Number(game.cn.discount_percent)}%` : tr("steam.cn.store", "Steam CN"))
                        : tr("steam.cn.unavailable", "No CN price")}
                    </small>
                  </div>
                </div>
                <div className="ama-steam-meta">
                  <span>{tr("steam.retail", "Retail")} {usd(current.retail_price)}</span>
                  <span>{tr("steam.savings", "Save")} {Number(current.savings_percent) || 0}%</span>
                  <span>{tr("steam.store", "Store")} {current.store || "—"}</span>
                  <span>{tr("steam.source", "Source")} {game.source || "CheapShark"} · {game.currency || "USD"}</span>
                </div>
              </article>
            )
          })}
        </div>
      )}
        </>
      ) : (
        <>
          <section className="ama-picks-section">
            <div className="ama-panel-head">
              <div>
                <div className="ama-kicker"><span className="ama-kicker-line" />{tr("steam.hoard", "Can skip playing; can't skip owning.")}</div>
                <h2 className="ama-panel-title">{tr("steam.deals.title", "Worth grabbing")}</h2>
                <p className="ama-panel-hint">{tr("steam.deals.subtitle", "Hand-picked by discount and rating, with historical lows.")}</p>
              </div>
              <div className="ama-deal-actions">
                <span className="ama-deal-page">
                  {tr("steam.deals.page", "第 {page}/{groups} 批").replace("{page}", String(dealPage || 1)).replace("{groups}", String(dealGroups || 1))}
                  {dealPool > 0 ? ` · ${dealPool}` : ""}
                </span>
                <button
                  type="button"
                  className="ama-web-chip"
                  disabled={dealStatus === "searching"}
                  onClick={() => void runSteamDeals()}
                >
                  {dealStatus === "searching" ? tr("steam.deals.loading", "Finding the best deals...") : tr("steam.deals.shuffle", "换一批")}
                </button>
              </div>
            </div>
            {dealStatus === "searching" ? (
              <div className="ama-web-state" role="status">
                <div className="ama-web-spinner" aria-hidden="true" />
                <h3>{tr("steam.deals.loading", "Finding the best deals...")}</h3>
                <p>{tr("steam.deals.subtitle", "Hand-picked by discount and rating, with historical lows.")}</p>
              </div>
            ) : dealStatus === "error" ? (
              <div className="ama-web-state is-error" role="alert">
                <div className="ama-web-state-glyph" aria-hidden="true">!</div>
                <h3>{tr("steam.deals.title", "Worth grabbing")}</h3>
                <p>{dealMessage || tr("steam.deals.error", "Could not load sale picks. Check your connection and retry.")}</p>
              </div>
            ) : dealStatus === "empty" ? (
              <div className="ama-web-state">
                <div className="ama-web-state-glyph" aria-hidden="true">◈</div>
                <h3>{tr("steam.deals.empty", "No qualifying high-discount deals right now.")}</h3>
                <p>{tr("steam.deals.subtitle", "Hand-picked by discount and rating, with historical lows.")}</p>
              </div>
            ) : dealResults.length === 0 ? (
              <div className="ama-web-state">
                <div className="ama-web-state-glyph" aria-hidden="true">◈</div>
                <h3>{tr("steam.deals.title", "Worth grabbing")}</h3>
                <p>{tr("steam.deals.subtitle", "Hand-picked by discount and rating, with historical lows.")}</p>
              </div>
            ) : (
              <div className="ama-deal-grid">
                {dealResults.map((deal, index) => {
                  const current = deal.current || {}
                  const history = deal.history || {}
                  const isLow = deal.is_at_low === true
                  const steamPercent = Number(deal.steam_percent) || 0
                  const releaseYear = Number(deal.release_year) || 0
                  const discount = Number(current.savings_percent) || 0
                  return (
                    <article className="ama-deal-card" key={`${deal.game_id || deal.steam_app_id || "deal"}-${index}`}>
                      <div className="ama-deal-top">
                        <span className="ama-deal-discount">-{discount}%</span>
                        {deal.hoard_worthy ? <span className="ama-hoard">{tr("steam.hoard", "Can skip playing; can't skip owning.")}</span> : null}
                      </div>
                      <div className="ama-steam-app">App {deal.steam_app_id || "—"}{releaseYear ? ` · ${releaseYear}` : ""}</div>
                      <h3 className="ama-deal-title">{deal.title || "—"}</h3>
                      {deal.title_cn ? <div className="ama-deal-title-alt">{deal.title_cn}</div> : null}
                      <div className="ama-deal-price-row">
                        <strong>{usd(current.price)}</strong>
                        <s>{usd(current.retail_price)}</s>
                      </div>
                      <div className="ama-deal-cn">
                        <span>{tr("steam.cn.price", "CN price")}</span>
                        <strong>{deal.cn?.available ? (deal.cn.formatted || (deal.cn.price ? `¥ ${deal.cn.price}` : "—")) : tr("steam.cn.unavailable", "No CN price")}</strong>
                        {deal.cn?.available && Number(deal.cn.discount_percent) > 0 ? <small>-{Number(deal.cn.discount_percent)}%</small> : null}
                      </div>
                      <div className="ama-deal-meta">
                        <span>{tr("steam.deals.rating", "Rating")} {Number(deal.deal_rating) || 0}/10{steamPercent ? ` · ${steamPercent}%` : ""}</span>
                        <span>{isLow ? tr("steam.deals.atLow", "At the low") : `${tr("steam.deals.nearLow", "Gap to low")} ${usdGap(deal.gap_to_low)}`}</span>
                        <span>{tr("steam.history", "All-time low")} {usd(history.lowest)}</span>
                      </div>
                      <div className="ama-deal-actions">
                        {isHttpUrl(deal.store_url) ? (
                          <FileDownload href={String(deal.store_url)} label={tr("web.open", "Open")} className="ama-web-open" />
                        ) : null}
                        <span>{tr("steam.deals.source", "Source: CheapShark · USD")}</span>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
            <p className="ama-sale-source">{tr("steam.deals.source", "Source: CheapShark · USD")}</p>
            <p className="ama-sale-source">{tr("steam.cn.note", "CN prices are current Steam China store prices in CNY, not historical lows.")}</p>
          </section>

          <section className="ama-free-section">
            <div className="ama-panel-head">
              <div>
                <div className="ama-kicker"><span className="ama-kicker-line" />{tr("steam.hoard", "Can skip playing; can't skip owning.")}</div>
                <h2 className="ama-panel-title">{tr("steam.free.title", "Free to play")}</h2>
                <p className="ama-panel-hint">{tr("steam.free.subtitle", "Permanently free, not a limited giveaway.")}</p>
              </div>
              <div className="ama-deal-actions">
                <span className="ama-deal-page">
                  {tr("steam.free.page", "第 {page}/{groups} 组").replace("{page}", String(freeShelfPage || 1)).replace("{groups}", String(freeShelfGroups || 1))}
                </span>
                <button
                  type="button"
                  className="ama-web-chip"
                  disabled={refreshing || freeShelfBusy}
                  onClick={() => void shuffleFreeShelf()}
                >
                  {freeShelfBusy ? tr("steam.free.loading", "更新中…") : tr("steam.free.shuffle", "换一批")}
                </button>
              </div>
            </div>
            <div className="ama-free-grid">
              {freeGames.map((game) => (
                <article className="ama-free-card" key={game.app_id || game.title}>
                  <div className="ama-free-top">
                    <span className="ama-free-badge">{tr("steam.free.badge", "FREE")}</span>
                    <span className="ama-steam-app">App {game.app_id || "—"}</span>
                  </div>
                  <h3 className="ama-free-title">{game.title || "—"}</h3>
                  {game.title_cn ? <div className="ama-free-title-alt">{game.title_cn}</div> : null}
                  <div className="ama-free-actions">
                    {isHttpUrl(game.store_url) ? (
                      <FileDownload href={String(game.store_url)} label={tr("web.open", "Open")} className="ama-web-open" />
                    ) : null}
                  </div>
                </article>
              ))}
              {freeGames.length === 0 ? <p className="ama-empty">{tr("steam.free.note", "Curated snapshot, not a live full catalogue.")}</p> : null}
            </div>
            <p className="ama-sale-source">
              {tr("steam.free.note", "Curated snapshot, not a live full catalogue.")} · {tr("steam.free.updated", "Updated {date}").replace("{date}", steamInfo.free_to_play_updated || "—")}
            </p>
          </section>
        </>
      )}
    </>
  )

  const coreView = (
    <>
      <div className="ama-view-head">
        <div>
          <div className="ama-kicker"><span className="ama-kicker-line" />{tr("core.title", "Core")}</div>
          <h1 className="ama-view-title">{tr("core.title", "Core")}</h1>
          <p className="ama-view-sub">{tr("core.body", "The hosted window is awake.")}</p>
        </div>
        <span className="ama-badge is-peach">{tr("core.preview", "Preview build")}</span>
      </div>
      <div className="ama-core-card">
        {orb}
        <div>
          <h2 className="ama-core-title">{shellName}</h2>
          <p className="ama-core-body">{tr("core.body", "The hosted window is awake.")}</p>
          <div className="ama-chips">
            <span className="ama-chip">{version}</span>
            <span className="ama-chip">{tr("core.host", "Host surface")}: {telemetry.surface || "plugin-manager"}</span>
            <span className="ama-chip">bridge v{contractVersion}</span>
          </div>
        </div>
      </div>
      <div className="ama-split" style={{ marginTop: "12px" } as any}>
        <div className="ama-panel">
          <div className="ama-panel-head"><h2 className="ama-panel-title">{tr("core.version", "Version")} & {tr("telemetry.title", "Live telemetry")}</h2><span className="ama-badge is-mint">{healthLabel}</span></div>
          <div className="ama-rows">
            <div className="ama-row"><span className="ama-row-key">{tr("core.version", "Version")}</span><span className="ama-row-val">{version}</span></div>
            <div className="ama-row"><span className="ama-row-key">{tr("stats.uptime", "Uptime")}</span><span className="ama-row-val">{uptimeValue}</span></div>
            <div className="ama-row"><span className="ama-row-key">{tr("stats.boots", "Boots")}</span><span className="ama-row-val">{Number(shell.boot_count) || 0}</span></div>
            <div className="ama-row"><span className="ama-row-key">{tr("telemetry.platform", "Platform")}</span><span className="ama-row-val">{telemetry.platform || "—"} {telemetry.os_release || ""}</span></div>
            <div className="ama-row"><span className="ama-row-key">{tr("telemetry.python", "Python")}</span><span className="ama-row-val">{telemetry.python || "—"}</span></div>
            <div className="ama-row"><span className="ama-row-key">{tr("telemetry.sdk", "Plugin SDK")}</span><span className="ama-row-val">{telemetry.sdk || "—"}</span></div>
            <div className="ama-row"><span className="ama-row-key">{tr("telemetry.activity", "Private view")}</span><span className="ama-row-val">{privacyLabel} · {privacyDetail}</span></div>
          </div>
        </div>
        <div>{bootPanel}</div>
      </div>
    </>
  )

  const bridgeView = (
    <>
      <div className="ama-view-head">
        <div>
          <div className="ama-kicker"><span className="ama-kicker-line" />{tr("nav.bridge", "Bridge")} · v1</div>
          <h1 className="ama-view-title">{tr("bridge.title", "System Bridge")}</h1>
          <p className="ama-view-sub">{tr("bridge.hint", "The seam that lets this window grow into a native app.")}</p>
        </div>
        <span className={`ama-badge ${bridge.health === "degraded" ? "is-peach" : "is-mint"}`}>{healthLabel}</span>
      </div>
      <div className="ama-split">
        <section className="ama-panel">
          <div className="ama-panel-head">
            <div>
              <h2 className="ama-panel-title">{tr("bridge.contract", "Contract")}</h2>
              <p className="ama-panel-hint">{tr("bridge.hint", "The seam that lets this window grow into a native app.")}</p>
            </div>
            <span className="ama-badge">v{contractVersion}</span>
          </div>
          {bridgeRows}
          <div className="ama-panel-head" style={{ marginTop: "14px" } as any}><h2 className="ama-panel-title">{tr("bridge.capabilities", "Capabilities")}</h2><span className="ama-badge is-muted">{capabilities.length}</span></div>
          <div className="ama-chips">
            {capabilities.map((capability) => <span className="ama-chip" key={capability}>{capability}</span>)}
            {capabilities.length === 0 ? <span className="ama-empty">{tr("telemetry.none", "No signal")}</span> : null}
          </div>
          <details className="ama-details">
            <summary>{tr("bridge.contract", "Contract")} JSON</summary>
            <pre className="ama-code">{JSON.stringify(bridge, null, 2)}</pre>
          </details>
        </section>
        <section className="ama-panel">
          <div className="ama-panel-head">
            <div>
              <h2 className="ama-panel-title">{tr("bridge.reserved", "Reserved seams")}</h2>
              <p className="ama-panel-hint">{tr("about.outOfScope", "Not yet: native window, real modules, process control, or voice pipeline.")}</p>
            </div>
            <span className="ama-badge is-peach">{reserved.length}</span>
          </div>
          <div className="ama-rows">
            {reserved.map((seam) => (
              <div className="ama-row" key={seam.id || seam.summary}>
                <span className="ama-row-key">{seam.id || "reserved"}</span>
                <span className="ama-row-val">{seam.state || "reserved"}</span>
              </div>
            ))}
          </div>
          <div className="ama-note">{tr("about.outOfScope", "Not yet: native window, real modules, process control, or voice pipeline.")}</div>
        </section>
      </div>
    </>
  )

  const aboutView = (
    <>
      <div className="ama-view-head">
        <div>
          <div className="ama-kicker"><span className="ama-kicker-line" />{tr("nav.about", "About")}</div>
          <h1 className="ama-view-title">{tr("about.title", "About Ama")}</h1>
        </div>
        <span className="ama-badge is-lilac">{version}</span>
      </div>
      <div className="ama-about-card">
        <div className="ama-about-orb">{orb}</div>
        <div>
          <h2 className="ama-about-title">{shellName}</h2>
          <p className="ama-about-body">{tr("about.body", "Ama Monster OS is a small, soft-edged home for N.E.K.O's catgirl energy.")}</p>
          <p className="ama-about-credit">{tr("about.credits", "Built for Project N.E.K.O · Plugin SDK 0.1")}</p>
          <div className="ama-note">{tr("about.outOfScope", "Not yet: native window, real modules, process control, or voice pipeline.")}</div>
          <div className="ama-chips">
            <span className="ama-chip">{shell.channel || "Beta"}</span>
            <span className="ama-chip">{tr("bridge.contract", "Contract")} v{contractVersion}</span>
            <span className="ama-chip">{bridge.provider || "neko-plugin-host"}</span>
            <span className="ama-chip">{tr("footer.local", "Local only")}</span>
          </div>
        </div>
      </div>
      <div className="ama-panel" style={{ marginTop: "12px" } as any}>
        <div className="ama-panel-head"><h2 className="ama-panel-title">{tr("telemetry.title", "Live telemetry")}</h2><span className="ama-badge is-muted">{tr("core.preview", "Preview build")}</span></div>
        <div className="ama-rows">
          <div className="ama-row"><span className="ama-row-key">{tr("telemetry.platform", "Platform")}</span><span className="ama-row-val">{telemetry.platform || "—"} {telemetry.os_release || ""}</span></div>
          <div className="ama-row"><span className="ama-row-key">{tr("telemetry.python", "Python")}</span><span className="ama-row-val">{telemetry.python || "—"}</span></div>
          <div className="ama-row"><span className="ama-row-key">{tr("telemetry.sdk", "Plugin SDK")}</span><span className="ama-row-val">{telemetry.sdk || "—"}</span></div>
          <div className="ama-row"><span className="ama-row-key">{tr("bridge.mode", "Mode")}</span><span className="ama-row-val">{bridge.mode || "hosted-plugin"}</span></div>
        </div>
      </div>
    </>
  )

  const uiExportText = JSON.stringify({
    format: "ama.ui.profile",
    version: 1,
    profile: uiProfile,
  }, null, 2)
  const uiDownloadUrl = uiProfileDownloadUrl({
    format: "ama.ui.profile",
    version: 1,
    profile: uiProfile,
  })

  async function copyUiProfile() {
    try {
      await navigator.clipboard.writeText(uiExportText)
      setUiMessage(tr("studio.copied", "Copied."))
    } catch (_error) {
      try {
        const area = document.querySelector(".ama-studio-export") as HTMLTextAreaElement | null
        area?.select()
        document.execCommand("copy")
        setUiMessage(tr("studio.copied", "Copied."))
      } catch (_fallback) {
        setUiMessage(tr("studio.copyFailed", "Select the text and copy it manually."))
      }
    }
  }

  const studioView = (
    <>
      <div className="ama-view-head">
        <div>
          <div className="ama-kicker"><span className="ama-kicker-line" />UI STUDIO</div>
          <h1 className="ama-view-title">{tr("studio.title", "Appearance studio")}</h1>
          <p className="ama-view-sub">{tr("studio.subtitle", "Make the shell yours, then save or export the profile.")}</p>
        </div>
        <span className={`ama-badge ${uiDirty ? "is-peach" : "is-mint"}`}>
          {uiDirty ? tr("studio.unsaved", "Unsaved") : tr("studio.savedBadge", "Saved")}
        </span>
      </div>

      <div className="ama-studio-layout">
        <section className="ama-panel ama-studio-panel">
          <div className="ama-panel-head">
            <div>
              <h2 className="ama-panel-title">{tr("studio.controls", "Appearance")}</h2>
              <p className="ama-panel-hint">{tr("studio.controlsHint", "Changes preview immediately. Save to keep them.")}</p>
            </div>
            <span className="ama-badge is-muted">v1</span>
          </div>

          <div className="ama-studio-group">
            <div className="ama-studio-label">{tr("studio.presets", "Presets")}<small>{tr("studio.presetsHint", "One click")}</small></div>
            <div className="ama-studio-presets">
              {UI_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  className={`ama-preset${uiProfile.accent === preset.accent && uiProfile.wallpaper === preset.wallpaper ? " is-active" : ""}`}
                  onClick={() => applyPreset(preset)}
                >
                  <span className="ama-preset-dot" style={{ background: preset.accent }} />
                  <span>{tr(preset.labelKey, preset.id)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="ama-studio-group">
            <div className="ama-studio-label">
              {tr("studio.accent", "Accent")}
              <small>{hexLuminance(uiProfile.accent) > 0.82 ? tr("studio.accentLight", "偏亮，浅色背景上对比度低") : uiProfile.accent}</small>
            </div>
            <div className="ama-swatches">
              {UI_ACCENTS.map((color) => (
                <button
                  type="button"
                  key={color}
                  className={`ama-swatch${uiProfile.accent === color ? " is-active" : ""}`}
                  aria-label={`${tr("studio.accent", "Accent")} ${color}`}
                  onClick={() => setAccent(color)}
                ><span style={{ background: color }} /></button>
              ))}
              <input
                className="ama-studio-color"
                type="color"
                value={uiProfile.accent}
                aria-label={tr("studio.accent", "Accent")}
                onInput={(event: any) => patchUiProfile({ accent: String(event.target.value) })}
                onBlur={(event: any) => rememberColor(String(event.target.value))}
              />
            </div>
            <div className="ama-color-row">
              <ColorHexField value={uiProfile.accent} label={tr("studio.accentHex", "Accent hex")} onCommit={setAccent} />
              <span className="ama-studio-note">{tr("studio.hexHint", "输入 #RRGGBB 后回车")}</span>
            </div>
            {Array.isArray(recentColors) && recentColors.length > 0 ? (
              <div className="ama-recent-row">
                <span>{tr("studio.recent", "最近使用")}</span>
                {recentColors.map((color) => (
                  <button
                    type="button"
                    key={color}
                    className={`ama-recent-dot${uiProfile.accent === color ? " is-active" : ""}`}
                    style={{ background: color }}
                    aria-label={`${tr("studio.recent", "最近使用")} ${color}`}
                    title={color}
                    onClick={() => setAccent(color)}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="ama-studio-group">
            <div className="ama-studio-label">{tr("studio.theme", "Theme")}</div>
            <div className="ama-studio-seg">
              <button type="button" className={activeTheme === "light" ? "is-active" : ""} onClick={() => patchUiProfile({ theme: "light" })}>{tr("theme.light", "Daylight")}</button>
              <button type="button" className={activeTheme === "dark" ? "is-active" : ""} onClick={() => patchUiProfile({ theme: "dark" })}>{tr("theme.dark", "Moonlight")}</button>
            </div>
          </div>

          <div className="ama-studio-group">
            <div className="ama-studio-label">
              {tr("studio.material", "材质")}
              <small>{tr(`studio.material.${uiProfile.material}`, uiProfile.material)}</small>
            </div>
            <div className="ama-material-preview">
              {UI_MATERIALS.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={`ama-material-option is-${option.id}${uiProfile.material === option.id ? " is-active" : ""}`}
                  onClick={() => patchUiProfile({ material: option.id })}
                >
                  {tr(option.labelKey, option.id)}
                  <small>{tr(option.hintKey, "")}</small>
                </button>
              ))}
            </div>
            {uiProfile.material === "glass" ? (
              <>
                <div className="ama-studio-label" style={{ marginTop: "9px" } as any}>
                  {tr("studio.glassBlur", "模糊强度")}
                  <small>{uiProfile.glass_blur}px</small>
                </div>
                <input
                  className="ama-studio-range"
                  type="range"
                  min={6}
                  max={40}
                  step={1}
                  value={uiProfile.glass_blur}
                  aria-label={tr("studio.glassBlur", "模糊强度")}
                  onInput={(event: any) => patchUiProfile({ glass_blur: Number(event.target.value) })}
                />
                <div className="ama-studio-label">
                  {tr("studio.glassAlpha", "玻璃浓度")}
                  <small>{uiProfile.glass_alpha}%</small>
                </div>
                <input
                  className="ama-studio-range"
                  type="range"
                  min={28}
                  max={92}
                  step={1}
                  value={uiProfile.glass_alpha}
                  aria-label={tr("studio.glassAlpha", "玻璃浓度")}
                  onInput={(event: any) => patchUiProfile({ glass_alpha: Number(event.target.value) })}
                />
              </>
            ) : null}
          </div>

          <div className="ama-studio-group">
            <div className="ama-studio-label">
              {tr("studio.windowBg", "Window background")}
              <small>{uiProfile.window_bg === "custom" ? uiProfile.window_color : tr(`studio.windowBg.${uiProfile.window_bg}`, uiProfile.window_bg)}</small>
            </div>
            <div className="ama-studio-seg">
              {UI_WINDOW_BACKGROUNDS.map((windowBg) => (
                <button
                  type="button"
                  key={windowBg}
                  className={uiProfile.window_bg === windowBg ? "is-active" : ""}
                  disabled={windowBg === "image" && !uiProfile.window_image}
                  onClick={() => patchUiProfile({ window_bg: windowBg })}
                >{tr(`studio.windowBg.${windowBg}`, windowBg)}</button>
              ))}
            </div>
            <div className="ama-studio-image-row">
              <label className="ama-file-button">
                {tr("studio.importImage", "Import image")}
                <input
                  className="ama-file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={importWindowImage}
                />
              </label>
              {uiProfile.window_image ? (
                <>
                  <img className="ama-studio-image-preview" src={uiProfile.window_image} alt="" />
                  <button type="button" className="ama-web-chip" onClick={removeWindowImage}>{tr("studio.removeImage", "Remove image")}</button>
                </>
              ) : (
                <span className="ama-studio-note">{tr("studio.imageHint", "PNG / JPG / WebP / GIF, up to 1.2 MB")}</span>
              )}
            </div>
            {uiProfile.window_bg === "custom" ? (
              <div className="ama-swatches" style={{ marginTop: "7px" } as any}>
                <input
                  className="ama-studio-color"
                  type="color"
                  value={uiProfile.window_color}
                  aria-label={tr("studio.windowColor", "Window colour")}
                  onInput={(event: any) => patchUiProfile({ window_color: event.target.value })}
                />
                <ColorHexField
                  value={uiProfile.window_color}
                  label={tr("studio.windowColorHex", "Window colour hex")}
                  onCommit={(color) => { patchUiProfile({ window_color: color }); rememberColor(color) }}
                />
              </div>
            ) : null}
            {uiProfile.window_bg === "gradient" ? (
              <div className="ama-gradient-editor">
                <div
                  className="ama-gradient-preview"
                  style={{ background: windowBackgroundValue({ ...uiProfile, window_bg: "gradient" }) }}
                />
                <div className="ama-studio-label">
                  {tr("studio.gradientColors", "Gradient colours")}
                  <small>{uiProfile.gradient_colors.length}/30</small>
                </div>
                <div className="ama-gradient-colors">
                  {uiProfile.gradient_colors.map((color, index) => (
                    <div className="ama-gradient-row" key={`${color}-${index}`}>
                      <span className="ama-gradient-index">{String(index + 1).padStart(2, "0")}</span>
                      <input
                        className="ama-studio-color"
                        type="color"
                        value={color}
                        aria-label={`${tr("studio.gradientColor", "Gradient colour")} ${index + 1}`}
                        onInput={(event: any) => setGradientColor(index, event.target.value)}
                      />
                      <ColorHexField
                        value={color}
                        label={`${tr("studio.gradientColor", "Gradient colour")} ${index + 1}`}
                        onCommit={(next) => commitGradientColor(index, next)}
                      />
                      <button
                        type="button"
                        className="ama-gradient-remove"
                        disabled={uiProfile.gradient_colors.length <= 2}
                        aria-label={tr("studio.removeColor", "Remove colour")}
                        onClick={() => removeGradientColor(index)}
                      >×</button>
                    </div>
                  ))}
                </div>
                <div className="ama-gradient-tools">
                  <button
                    type="button"
                    className="ama-web-chip"
                    disabled={uiProfile.gradient_colors.length >= 30}
                    onClick={addGradientColor}
                  >+ {tr("studio.addColor", "Add colour")}</button>
                  <button type="button" className="ama-web-chip" onClick={reverseGradient}>{tr("studio.gradientReverse", "Reverse")}</button>
                  <button type="button" className="ama-web-chip" onClick={shuffleGradient}>{tr("studio.gradientShuffle", "Shuffle palette")}</button>
                </div>
                <p className="ama-studio-note">{tr("studio.gradientHint", "2–30 colours, evenly spaced.")}</p>
                <div className="ama-studio-label">
                  {tr("studio.gradientAngle", "Gradient angle")}
                  <small>{uiProfile.gradient_angle}°</small>
                </div>
                <input
                  className="ama-studio-range"
                  type="range"
                  min={0}
                  max={360}
                  step={5}
                  value={uiProfile.gradient_angle}
                  aria-label={tr("studio.gradientAngle", "Gradient angle")}
                  onInput={(event: any) => patchUiProfile({ gradient_angle: Number(event.target.value) })}
                />
              </div>
            ) : null}
          </div>

          <div className="ama-studio-group">
            <div className="ama-studio-label">{tr("studio.wallpaper", "Desktop backdrop")}</div>
            <div className="ama-studio-seg">
              {UI_WALLPAPERS.map((wallpaper) => (
                <button
                  type="button"
                  key={wallpaper}
                  className={uiProfile.wallpaper === wallpaper ? "is-active" : ""}
                  onClick={() => patchUiProfile({ wallpaper })}
                >{tr(`studio.wallpaper.${wallpaper}`, wallpaper)}</button>
              ))}
            </div>
          </div>

          <div className="ama-studio-group">
            <div className="ama-studio-label">{tr("studio.radius", "Corner radius")}<small>{uiProfile.radius}px</small></div>
            <input
              className="ama-studio-range"
              type="range"
              min={8}
              max={28}
              value={uiProfile.radius}
              aria-label={tr("studio.radius", "Corner radius")}
              onInput={(event: any) => patchUiProfile({ radius: Number(event.target.value) })}
            />
          </div>

          <div className="ama-studio-group">
            <div className="ama-studio-label">{tr("studio.density", "Density")}</div>
            <div className="ama-studio-seg">
              <button type="button" className={uiProfile.density === "comfortable" ? "is-active" : ""} onClick={() => patchUiProfile({ density: "comfortable" })}>{tr("studio.density.comfortable", "Comfortable")}</button>
              <button type="button" className={uiProfile.density === "compact" ? "is-active" : ""} onClick={() => patchUiProfile({ density: "compact" })}>{tr("studio.density.compact", "Compact")}</button>
            </div>
          </div>

          <div className="ama-studio-group">
            <div className="ama-studio-label">{tr("studio.identity", "Window identity")}</div>
            <div className="ama-studio-fields">
              <div className="ama-studio-field">
                <label>{tr("studio.brand", "Title")}</label>
                <input
                  className="ama-studio-input"
                  value={uiProfile.brand}
                  maxLength={24}
                  onInput={(event: any) => patchUiProfile({ brand: event.target.value })}
                />
              </div>
              <div className="ama-studio-field">
                <label>{tr("studio.glyph", "Glyph")}</label>
                <input
                  className="ama-studio-input"
                  value={uiProfile.glyph}
                  maxLength={2}
                  onInput={(event: any) => patchUiProfile({ glyph: event.target.value })}
                />
              </div>
            </div>
            <div className="ama-studio-group">
              <div className="ama-studio-label">
                {tr("studio.sound", "Selection sound")}
                <small>{uiProfile.sound_enabled ? tr("studio.soundOn", "On") : tr("studio.soundOff", "Off")}</small>
              </div>
              <div className="ama-studio-seg">
                <button type="button" className={uiProfile.sound_enabled ? "is-active" : ""} onClick={() => patchUiProfile({ sound_enabled: true })}>{tr("studio.soundOn", "On")}</button>
                <button type="button" className={!uiProfile.sound_enabled ? "is-active" : ""} onClick={() => patchUiProfile({ sound_enabled: false })}>{tr("studio.soundOff", "Off")}</button>
              </div>
              <div className="ama-studio-label" style={{ marginTop: "9px" } as any}>{tr("studio.soundMode", "Sound style")}</div>
              <div className="ama-studio-seg">
                {(["steam", "soft", "mechanical", "custom"] as SoundMode[]).map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    className={uiProfile.sound_mode === mode ? "is-active" : ""}
                    disabled={mode === "custom" && !uiProfile.sound_data}
                    onClick={() => patchUiProfile({ sound_mode: mode })}
                  >{tr(`studio.sound.${mode}`, mode)}</button>
                ))}
              </div>
              <div className="ama-studio-sound-row">
                <span>{tr("studio.soundVolume", "Volume")}</span>
                <input
                  className="ama-studio-range"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={uiProfile.sound_volume}
                  aria-label={tr("studio.soundVolume", "Volume")}
                  onInput={(event: any) => patchUiProfile({ sound_volume: Number(event.target.value) })}
                />
                <strong>{Math.round(uiProfile.sound_volume * 100)}%</strong>
                <button
                  type="button"
                  className="ama-web-chip"
                  data-no-sound="true"
                  onClick={() => playSelectSound({ ...uiProfile, sound_enabled: true })}
                >{tr("studio.soundTest", "Test")}</button>
              </div>
              <div className="ama-studio-image-row">
                <label className="ama-file-button">
                  {tr("studio.soundImport", "Import sound")}
                  <input
                    className="ama-file-input"
                    type="file"
                    accept="audio/wav,audio/mpeg,audio/ogg,audio/mp3"
                    onChange={importSoundFile}
                  />
                </label>
                {uiProfile.sound_data ? (
                  <>
                    <span className="ama-studio-note">{uiProfile.sound_name || tr("studio.sound.custom", "Custom")}</span>
                    <button type="button" className="ama-web-chip" onClick={removeSound}>{tr("studio.soundRemove", "Remove sound")}</button>
                  </>
                ) : (
                  <span className="ama-studio-note">{tr("studio.soundHint", "WAV / MP3 / OGG, up to 1 MB")}</span>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="ama-studio-side">
          <div className="ama-studio-preview">
            <div className="ama-studio-preview-card">
              <div className="ama-studio-preview-top">
                <span className="ama-studio-glyph">{uiProfile.glyph || "✦"}</span>
                <div className="ama-studio-preview-title">
                  <strong>{uiProfile.brand || shellName}</strong>
                  <small>{tr("studio.preview", "Live preview")} · v1</small>
                </div>
              </div>
              <div className="ama-studio-preview-lines" aria-hidden="true"><span /><span /><span /></div>
            </div>
          </div>
          <div className="ama-studio-actions">
            <button type="button" className="ama-btn ama-btn-primary" disabled={uiSaving} onClick={() => void saveUiProfile()}>
              {uiSaving ? tr("studio.saving", "Saving...") : tr("studio.save", "Save appearance")}
            </button>
            <button type="button" className="ama-btn" onClick={resetUiProfile}>{tr("studio.reset", "Reset")}</button>
          </div>
          <p className="ama-studio-note">{tr("studio.stored", "Profiles are stored in the plugin data folder. Export a JSON copy for backup.")}</p>
          <p className={`ama-studio-message${uiMessage && !uiDirty ? " is-ok" : ""}`}>{uiMessage}</p>
        </aside>
      </div>

      <section className="ama-panel" style={{ marginTop: "12px" } as any}>
        <div className="ama-panel-head">
          <div>
            <h2 className="ama-panel-title">{tr("studio.io", "Import / export")}</h2>
            <p className="ama-panel-hint">{tr("studio.ioHint", "Paste a profile to apply it, or copy the current JSON.")}</p>
          </div>
          <span className="ama-badge is-muted">JSON</span>
        </div>
        <div className="ama-studio-io">
          <div>
            <div className="ama-studio-label">{tr("studio.export", "Current profile")}</div>
            <textarea className="ama-studio-export" readOnly value={uiExportText} aria-label={tr("studio.export", "Current profile")} />
            <div className="ama-studio-io-actions">
              <button type="button" className="ama-web-chip" onClick={() => void copyUiProfile()}>{tr("studio.copy", "Copy")}</button>
              <FileDownload href={uiDownloadUrl} label={tr("studio.download", "Download JSON")} filename="ama-ui-profile.json" className="ama-web-open" />
            </div>
          </div>
          <div>
            <div className="ama-studio-label">{tr("studio.import", "Import profile")}</div>
            <textarea
              className="ama-studio-import"
              value={importText}
              placeholder={tr("studio.importPlaceholder", "Paste an exported Ama UI profile here...")}
              aria-label={tr("studio.import", "Import profile")}
              onInput={(event: any) => setImportText(event.target.value)}
            />
            <div className="ama-studio-io-actions">
              <button type="button" className="ama-web-chip" onClick={importUiProfile}>{tr("studio.applyImport", "Import and apply")}</button>
              <label className="ama-file-button">
                {tr("studio.importJsonFile", "Import JSON file")}
                <input
                  className="ama-file-input"
                  type="file"
                  accept=".json,application/json"
                  onChange={importProfileFile}
                />
              </label>
            </div>
          </div>
        </div>
      </section>
    </>
  )

  const content = activeView === "web" ? webView : activeView === "steam" ? steamView : activeView === "codex" ? codexView : activeView === "tokens" ? tokenView : activeView === "studio" ? studioView : activeView === "core" ? coreView : activeView === "bridge" ? bridgeView : activeView === "about" ? aboutView : homeView

  const uiStyle = {
    "--sky": uiProfile.accent,
    "--glass-blur": uiProfile.glass_blur,
    "--glass-alpha": uiProfile.glass_alpha,
    "--sky-soft": `color-mix(in srgb, ${uiProfile.accent} 18%, var(--card))`,
    "--sky-deep": `color-mix(in srgb, ${uiProfile.accent} 58%, var(--ink))`,
    "--ui-radius": `${uiProfile.radius}px`,
    "--window-bg": windowBackgroundValue(uiProfile),
  } as any

  const footer = (
    <footer className="ama-footer">
      <span className="ama-footer-dot" />
      <strong>{hosted ? "N.E.K.O" : "Ama"}</strong>
      <span>{tr("footer.hint", "This window runs inside N.E.K.O.")}</span>
      <div className="ama-footer-right">
        <span className="ama-footer-local">{tr("footer.local", "Local only")}</span>
        <span>{shellName} · {version}</span>
      </div>
    </footer>
  )

  const sleepView = (
    <div className="ama-sleep">
      <div className="ama-sleep-stars" aria-hidden="true"><span>✦</span><span>·</span><span>✧</span><span>✦</span></div>
      <div className="ama-sleep-card">
        <div className="ama-moon" aria-hidden="true">☾</div>
        <h2>{tr("window.sleepTitle", "Ama is napping")}</h2>
        <p>{tr("window.sleepBody", "The window is asleep. Nothing was lost; wake her whenever you like.")}</p>
        <button type="button" className="ama-btn ama-btn-primary" onClick={() => setChrome("normal")}>
          <span aria-hidden="true">♡</span>{tr("window.wake", "Wake Ama")}
        </button>
      </div>
    </div>
  )

  const mini = (
    <div className="ama-mini" role="status">
      <div className="ama-mini-icon" aria-hidden="true">✦</div>
      <div className="ama-mini-copy">
        <strong>{tr("window.minimized", "Ama is curled up in the taskbar.")}</strong>
        <span>{shellName} · {tr("footer.local", "Local only")}</span>
      </div>
      <button type="button" className="ama-btn ama-btn-primary" onClick={() => setChrome("normal")}>
        {tr("window.restoreTaskbar", "Bring her back")}
      </button>
    </div>
  )

  return (
    <div
      className={`ama-root ama-theme-${activeTheme}`}
      data-wallpaper={uiProfile.wallpaper}
      data-window-bg={uiProfile.window_bg}
      data-density={uiProfile.density}
      data-material={uiProfile.material}
      data-radius={uiProfile.radius === DEFAULT_UI_PROFILE.radius ? "default" : "custom"}
      style={uiStyle}
      onClick={handleSelectSound}
    >
      <style>{STYLES}</style>
      <div className={`ama-desktop${activeChrome === "max" ? " is-expanded" : ""}`}>
        <span className="ama-cloud c1" aria-hidden="true" />
        <span className="ama-cloud c2" aria-hidden="true" />
        <span className="ama-cloud c3" aria-hidden="true" />
        <span className="ama-spark s1" aria-hidden="true">✦</span>
        <span className="ama-spark s2" aria-hidden="true">✧</span>
        <span className="ama-spark s3" aria-hidden="true">·</span>
        {activeChrome === "min" ? mini : (
          <div className={`ama-window${activeChrome === "max" ? " is-expanded" : ""}`}>
            {titlebar}
            {activeChrome === "asleep" ? sleepView : (
              <>
                <div className="ama-body">
                  {sidebar}
                  <main className="ama-content">{content}</main>
                </div>
                {footer}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
