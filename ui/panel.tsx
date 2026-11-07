import { FileDownload, useState } from "@neko/plugin-ui"
import type { HostedAction, PluginSurfaceProps } from "@neko/plugin-ui"

type ViewId = "home" | "web" | "steam" | "core" | "bridge" | "about"
type ChromeMode = "normal" | "max" | "min" | "asleep"
type ThemeMode = "light" | "dark"

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
  }
  free_to_play?: SteamFree[]
  free_to_play_updated?: string
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
  events?: BootEvent[]
  preview?: boolean
}

type PulseStatus = "idle" | "running" | "success" | "error"
type WebStatus = "idle" | "searching" | "success" | "empty" | "error"

const VIEWS: Array<{ id: ViewId; key: string; glyph: string }> = [
  { id: "home", key: "nav.home", glyph: "⌂" },
  { id: "web", key: "nav.web", glyph: "◎" },
  { id: "steam", key: "nav.steam", glyph: "◈" },
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
  background: var(--paper);
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
.ama-logo {
  position: relative;
  display: grid;
  place-items: center;
  width: 37px;
  height: 33px;
  flex: 0 0 auto;
  border-radius: 11px 11px 13px 13px;
  color: #ffffff;
  font-size: 16px;
  font-weight: 900;
  background: linear-gradient(145deg, #6ed6ff 0%, #36b4f0 55%, #1f93d1 100%);
  box-shadow: 0 6px 16px rgba(47, 160, 213, 0.3);
}
.ama-logo::before, .ama-logo::after {
  content: "";
  position: absolute;
  top: -5px;
  width: 15px;
  height: 15px;
  background: #59c8f8;
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}
.ama-logo::before { left: 2px; transform: rotate(-16deg); }
.ama-logo::after { right: 2px; transform: rotate(16deg); }
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
.ama-avatar {
  position: relative;
  display: grid;
  place-items: center;
  width: 36px;
  height: 33px;
  flex: 0 0 auto;
  border-radius: 11px;
  color: #fff;
  font-size: 13px;
  font-weight: 900;
  background: linear-gradient(145deg, #7adcff, #35b2ea);
  box-shadow: 0 5px 12px rgba(47, 160, 213, 0.22);
}
.ama-avatar::before, .ama-avatar::after {
  content: "";
  position: absolute;
  top: -4px;
  width: 12px;
  height: 12px;
  background: #60caf8;
  clip-path: polygon(50% 0, 100% 100%, 0 100%);
}
.ama-avatar::before { left: 2px; transform: rotate(-15deg); }
.ama-avatar::after { right: 2px; transform: rotate(15deg); }
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
.ama-steam-hero { background: linear-gradient(140deg, var(--hero-1), color-mix(in srgb, var(--sky-soft) 55%, var(--hero-2))); }
.ama-steam-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.ama-steam-card { display: flex; flex-direction: column; min-width: 0; padding: 13px; border: 1px solid var(--line); border-radius: 15px; background: var(--card); transition: border-color .16s ease, transform .16s ease; }
.ama-steam-card:hover { border-color: var(--line-strong); transform: translateY(-1px); }
.ama-steam-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.ama-steam-app { color: var(--muted); font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 8px; font-weight: 700; letter-spacing: .04em; }
.ama-steam-title { margin: 3px 0 0; font-size: 13px; font-weight: 850; line-height: 1.35; overflow-wrap: anywhere; }
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
.ama-mini-icon { display: grid; place-items: center; width: 31px; height: 29px; border-radius: 9px; background: linear-gradient(145deg, #7adcff, #35b2ea); color: #fff; font-size: 13px; }
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
@keyframes ama-window-in { from { opacity: 0; transform: translateY(12px) scale(.992); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes ama-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
@keyframes ama-twinkle { 0%, 100% { opacity: .35; transform: scale(.92); } 50% { opacity: .95; transform: scale(1.08); } }
@keyframes ama-drift { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(10px); } }
@keyframes ama-blink { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
@keyframes ama-spin { to { transform: rotate(360deg); } }
@media (max-width: 980px) {
  .ama-columns, .ama-split, .ama-steam-grid { grid-template-columns: 1fr; }
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
  const freeGames = Array.isArray(steamInfo.free_to_play) ? steamInfo.free_to_play : []
  const modules = Array.isArray(safeState.modules) ? safeState.modules : []
  const events = Array.isArray(safeState.events) ? safeState.events.slice(-5) : []
  const capabilities = safeStringArray(bridge.capabilities)
  const reserved = Array.isArray(bridge.reserved) ? bridge.reserved : []
  const activity = bridge.activity || {}
  const contractVersion = bridge.contract_version || "1.0.0"
  const version = shell.version || "0.1.0 Beta"
  const shellName = shell.name || "Ama Monster OS"
  const hosted = shell.hosted !== false
  const pulseAction = actionById(actions || [], "ama_pulse")
  const webSearchAction = actionById(actions || [], "ama_web_search")
  const steamSearchAction = actionById(actions || [], "ama_steam_search")
  const steamDealsAction = actionById(actions || [], "ama_steam_deals")

  const [view, setView] = props.useLocalState<ViewId>("ama.view", "home")
  const [chrome, setChrome] = props.useLocalState<ChromeMode>("ama.chrome", "normal")
  const [theme, setTheme] = props.useLocalState<ThemeMode>("ama.theme", "light")
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

  const tr = (key: string, fallback: string): string => {
    const value = t(key)
    return value && value !== key ? value : fallback
  }

  const validViews: ViewId[] = ["home", "web", "steam", "core", "bridge", "about"]
  const activeView: ViewId = validViews.indexOf(view) >= 0 ? view : "home"
  const validChrome: ChromeMode[] = ["normal", "max", "min", "asleep"]
  const activeChrome: ChromeMode = validChrome.indexOf(chrome) >= 0 ? chrome : "normal"
  const activeTheme: ThemeMode = theme === "dark" ? "dark" : "light"

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
    setTheme(activeTheme === "dark" ? "light" : "dark")
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

  function selectSteamTab(next: "prices" | "picks") {
    setSteamTab(next)
    if (next === "picks" && !dealsLoaded && dealStatus !== "searching") {
      void runSteamDeals()
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
        <div className="ama-logo" aria-hidden="true">✦</div>
        <div className="ama-brand-title">
          <p className="ama-brand-name">{shellName}</p>
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
      <div className="ama-steam-account">
        <div className="ama-steam-account-icon" aria-hidden="true">S</div>
        <div className="ama-steam-account-main">
          <p className="ama-steam-account-title">{tr("steam.account.title", "Steam account")}</p>
          <p className="ama-steam-account-note">{tr("steam.account.note", "This build never asks for a Steam password.")}</p>
        </div>
        <span className="ama-badge is-peach">{tr("steam.account.status", "Login deferred")}</span>
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
              <button
                type="button"
                className="ama-web-chip"
                disabled={dealStatus === "searching"}
                onClick={() => void runSteamDeals()}
              >
                {dealStatus === "searching" ? tr("steam.deals.loading", "Finding the best deals...") : tr("steam.deals.refresh", "Refresh picks")}
              </button>
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
              <span className="ama-badge is-peach">{tr("steam.hoard", "Can skip playing; can't skip owning.")}</span>
            </div>
            <div className="ama-free-grid">
              {freeGames.map((game) => (
                <article className="ama-free-card" key={game.app_id || game.title}>
                  <div className="ama-free-top">
                    <span className="ama-free-badge">{tr("steam.free.badge", "FREE")}</span>
                    <span className="ama-steam-app">App {game.app_id || "—"}</span>
                  </div>
                  <h3 className="ama-free-title">{game.title || "—"}</h3>
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

  const content = activeView === "web" ? webView : activeView === "steam" ? steamView : activeView === "core" ? coreView : activeView === "bridge" ? bridgeView : activeView === "about" ? aboutView : homeView

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
    <div className={`ama-root ama-theme-${activeTheme}`}>
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
