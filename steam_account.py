"""Steam account linking through OpenID, with Steam++ (Watt Toolkit) support.

The plugin never asks for a Steam password and never embeds Steam's login page
in the hosted iframe.  Instead it runs the standard Steam OpenID 2.0 flow:

1. The window returns a `steamcommunity.com/openid/login` URL.
2. The user opens it in a normal browser and signs in on Steam's own page.
3. Steam redirects back to a loopback listener owned by this plugin.
4. The plugin verifies the assertion with `check_authentication` and stores the
   public SteamID plus the public profile.

In mainland China `steamcommunity.com` is frequently unreachable.  Steam++
(Watt Toolkit / 瓦特工具箱) redirects the Steam community hosts to a local
proxy; this module detects that hosts redirection and reports it, so the window
can explain what is missing instead of silently timing out.
"""

from __future__ import annotations

import html
import json
import re
import secrets
import threading
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any, Callable, Mapping

STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login"
STEAM_PROFILE_XML = "https://steamcommunity.com/profiles/{steamid}?xml=1"
STEAM_STORE = "https://store.steampowered.com/"
MAX_HTTP_BYTES = 512 * 1024
HTTP_TIMEOUT_SECONDS = 20.0
LOGIN_TTL_SECONDS = 600.0
_ACCOUNT_FILE = "steam_account.json"
_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AmaMonsterOS/0.6.2"

SPEEDUP_HOSTS = (
    "steamcommunity.com",
    "www.steamcommunity.com",
    "api.steampowered.com",
    "store.steampowered.com",
    "help.steampowered.com",
)
LOOPBACK_HOSTS = {"127.0.0.1", "::1", "0.0.0.0", "localhost"}
_STEAM_ID_RE = re.compile(r"/openid/id/(\d{17})")


def _hosts_path() -> Path:
    if hasattr(Path, "home") and Path("/etc/hosts").exists():
        return Path("/etc/hosts")
    return Path(r"C:\Windows\System32\drivers\etc\hosts")


def _probe_steam_community(timeout: float = 5.0) -> bool:
    """Return True when ``steamcommunity.com`` answers from this machine."""

    request = urllib.request.Request(
        "https://steamcommunity.com/",
        headers={"User-Agent": _USER_AGENT},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return int(getattr(response, "status", 200) or 200) < 500
    except urllib.error.HTTPError as exc:
        # Any HTTP answer (even 403) proves the host is reachable.
        return int(getattr(exc, "code", 0) or 0) < 500
    except Exception:
        return False


_PROBE_CACHE: dict[str, Any] = {"at": 0.0, "ok": False}
_PROBE_TTL_SECONDS = 45.0


def detect_accelerator(
    hosts_path: Path | None = None,
    *,
    probe: Callable[[], bool] | None = None,
) -> dict[str, Any]:
    """Detect whether the Steam community hosts are reachable.

    Two signals are combined:

    * host-file redirection to a loopback proxy (classic Steam++ hosts mode),
    * an actual reachability probe of ``steamcommunity.com`` (covers Steam++
      TUN/proxy acceleration and networks that reach Steam directly).

    A missing host file or a failed probe is not an error; it only changes the
    guidance shown in the window.
    """

    path = Path(hosts_path) if hosts_path is not None else _hosts_path()
    redirected: list[str] = []
    try:
        if path.is_file():
            for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
                line = raw_line.split("#", 1)[0].strip()
                if not line:
                    continue
                parts = line.split()
                if len(parts) < 2:
                    continue
                address = parts[0].lower()
                if address not in LOOPBACK_HOSTS:
                    continue
                for host in parts[1:]:
                    cleaned = host.lower().split(":")[0]
                    if cleaned in SPEEDUP_HOSTS and cleaned not in redirected:
                        redirected.append(cleaned)
    except OSError:
        pass

    if probe is not None:
        reachable = bool(probe())
    else:
        now = datetime.now(timezone.utc).timestamp()
        if now - float(_PROBE_CACHE.get("at") or 0.0) < _PROBE_TTL_SECONDS:
            reachable = bool(_PROBE_CACHE.get("ok"))
        else:
            reachable = _probe_steam_community()
            _PROBE_CACHE.update({"at": now, "ok": reachable})

    available = bool(redirected) or reachable
    if redirected:
        mode = "hosts"
    elif reachable:
        mode = "direct"
    else:
        mode = "none"

    if available and mode == "hosts":
        note = (
            "检测到 Steam 社区加速（Steam++ / 瓦特工具箱）："
            f"{len(redirected)} 个域名已指向本机代理，可以直接登录。"
        )
    elif available:
        note = "steamcommunity.com 当前可访问，可以直接登录 Steam。"
    else:
        note = (
            "无法访问 steamcommunity.com。国内网络通常需要先启动 Steam++（瓦特工具箱）"
            "并开启「Steam 社区」加速，或在可直连的网络下登录。"
        )
    return {
        "available": available,
        "mode": mode,
        "hosts_path": str(path),
        "redirected": redirected,
        "reachable": reachable,
        "note": note,
    }


def build_login_url(return_to: str, realm: str, state: str) -> str:
    """Build the Steam OpenID ``checkid_setup`` URL."""

    params = {
        "openid.ns": "http://specs.openid.net/auth/2.0",
        "openid.mode": "checkid_setup",
        "openid.return_to": return_to,
        "openid.realm": realm,
        "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
        "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
        "openid.state": state,
    }
    return f"{STEAM_OPENID_ENDPOINT}?{urllib.parse.urlencode(params)}"


def steam_id_from_claimed_id(claimed_id: str) -> str:
    """Extract the 64-bit SteamID from an OpenID claimed id."""

    match = _STEAM_ID_RE.search(str(claimed_id or ""))
    return match.group(1) if match else ""


def verify_assertion(
    params: Mapping[str, str],
    *,
    opener: Callable[[urllib.request.Request], Any] | None = None,
) -> tuple[bool, str, str]:
    """Validate an OpenID assertion with Steam.

    Returns ``(ok, steam_id, error)``.  Only keys prefixed with ``openid.`` are
    forwarded, and ``openid.mode`` is forced to ``check_authentication``.
    """

    pairs: list[tuple[str, str]] = []
    for key, value in params.items():
        text_key = str(key)
        if not text_key.startswith("openid."):
            continue
        if text_key == "openid.mode":
            pairs.append((text_key, "check_authentication"))
            continue
        pairs.append((text_key, str(value)))
    if not pairs:
        return False, "", "missing_assertion"

    body = urllib.parse.urlencode(pairs).encode("utf-8")
    request = urllib.request.Request(
        STEAM_OPENID_ENDPOINT,
        data=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": _USER_AGENT,
        },
        method="POST",
    )
    try:
        open_fn = opener or urllib.request.urlopen
        with open_fn(request) as response:
            payload = response.read(MAX_HTTP_BYTES).decode("utf-8", errors="replace")
    except Exception as exc:  # network / TLS / proxy failures
        return False, "", f"verify_failed:{type(exc).__name__}"

    if "is_valid:true" not in payload:
        return False, "", "invalid_assertion"

    steam_id = steam_id_from_claimed_id(params.get("openid.claimed_id", ""))
    if not steam_id:
        return False, "", "missing_steam_id"
    return True, steam_id, ""


def _xml_text(payload: str, tag: str) -> str:
    match = re.search(rf"<{tag}>(.*?)</{tag}>", payload, re.S)
    if not match:
        return ""
    value = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", match.group(1), flags=re.S)
    return html.unescape(value.strip())


def parse_profile_xml(payload: str) -> dict[str, Any]:
    """Parse the public ``?xml=1`` profile into a small safe dict."""

    if not isinstance(payload, str) or "<profile>" not in payload:
        return {}
    steam_id = _xml_text(payload, "steamID64")
    nickname = _xml_text(payload, "steamID")
    real_name = _xml_text(payload, "realname")
    avatar = _xml_text(payload, "avatarFull")
    state_message = _xml_text(payload, "stateMessage")
    online = _xml_text(payload, "onlineState") or _xml_text(payload, "stateMessage")
    privacy = _xml_text(payload, "privacyState")
    return {
        "steam_id": steam_id,
        "nickname": nickname[:64],
        "real_name": real_name[:64],
        "avatar": avatar if avatar.startswith("https://") else "",
        "online_state": online[:48],
        "privacy": privacy[:32],
        "state_message": state_message[:200],
    }


def fetch_profile(
    steam_id: str,
    *,
    opener: Callable[[urllib.request.Request], Any] | None = None,
) -> dict[str, Any]:
    """Fetch the public profile; failures degrade to the bare SteamID."""

    if not re.fullmatch(r"\d{17}", str(steam_id or "")):
        return {}
    url = STEAM_PROFILE_XML.format(steamid=steam_id)
    request = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
    try:
        open_fn = opener or urllib.request.urlopen
        with open_fn(request) as response:
            payload = response.read(MAX_HTTP_BYTES).decode("utf-8", errors="replace")
    except Exception:
        return {}
    profile = parse_profile_xml(payload)
    return profile if profile.get("steam_id") else {}


class _CallbackServer:
    """Tiny loopback listener that captures the OpenID redirect query."""

    def __init__(self) -> None:
        self._captured: dict[str, str] = {}
        self._server: HTTPServer | None = None
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()
        self.port = 0

    def start(self) -> str:
        owner = self
        captured = owner._captured
        lock = owner._lock

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802 - stdlib naming
                parsed = urllib.parse.urlparse(self.path)
                if parsed.path != "/steam/openid/callback":
                    self.send_response(404)
                    self.end_headers()
                    return
                query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
                flat = {key: values[-1] for key, values in query.items() if values}
                with lock:
                    captured.clear()
                    captured.update({str(k): str(v) for k, v in flat.items()})
                body = (
                    "<!doctype html><meta charset='utf-8'>"
                    "<title>Ama Monster OS</title>"
                    "<body style='font-family:system-ui;padding:40px;background:#0f1720;color:#e6f2ff'>"
                    "<h1 style='font-size:20px'>Steam 登录已返回</h1>"
                    "<p style='color:#8fa6bd'>可以关闭这个页面，回到 N.E.K.O 窗口查看结果。</p>"
                ).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *_args: Any) -> None:  # silence stderr noise
                return

        server = HTTPServer(("127.0.0.1", 0), Handler)
        server.timeout = 1.0
        self._server = server
        self.port = int(server.server_address[1])
        thread = threading.Thread(target=self._serve, name="ama-steam-openid", daemon=True)
        self._thread = thread
        thread.start()
        return f"http://127.0.0.1:{self.port}/steam/openid/callback"

    def _serve(self) -> None:
        server = self._server
        if server is None:
            return
        while server is not None:
            try:
                server.handle_request()
            except Exception:
                break

    def captured(self) -> dict[str, str]:
        with self._lock:
            return dict(self._captured)

    def stop(self) -> None:
        server, self._server = self._server, None
        if server is not None:
            try:
                server.server_close()
            except Exception:
                pass


class SteamAccountService:
    """Manage the OpenID login session and the persisted public profile."""

    def __init__(
        self,
        data_dir: Path,
        *,
        detector: Callable[[], dict[str, Any]] | None = None,
        profile_fetcher: Callable[[str], dict[str, Any]] | None = None,
        verifier: Callable[[Mapping[str, str]], tuple[bool, str, str]] | None = None,
    ) -> None:
        self.data_dir = Path(data_dir)
        self.account_path = self.data_dir / _ACCOUNT_FILE
        self._detector = detector or detect_accelerator
        self._profile_fetcher = profile_fetcher or fetch_profile
        self._verifier = verifier or verify_assertion
        self._server: _CallbackServer | None = None
        self._state = ""
        self._started_at = 0.0
        self._lock = threading.Lock()

    # ---------------------------------------------------------------- state
    def load(self) -> dict[str, Any]:
        try:
            if self.account_path.is_file():
                payload = json.loads(self.account_path.read_text(encoding="utf-8"))
                if isinstance(payload, dict) and re.fullmatch(r"\d{17}", str(payload.get("steam_id") or "")):
                    return payload
        except (OSError, ValueError):
            pass
        return {}

    def save(self, profile: Mapping[str, Any]) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        temporary = self.account_path.with_name(f"{self.account_path.name}.tmp")
        temporary.write_text(
            json.dumps(dict(profile), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        temporary.replace(self.account_path)

    def clear(self) -> None:
        try:
            self.account_path.unlink(missing_ok=True)
        except OSError:
            pass

    # ---------------------------------------------------------------- login
    def start_login(self) -> dict[str, Any]:
        """Open a loopback listener and return the Steam OpenID URL."""

        accelerator = self._detector()
        with self._lock:
            if self._server is not None:
                self._server.stop()
            server = _CallbackServer()
            return_to = server.start()
            state = secrets.token_urlsafe(16)
            realm = return_to.rsplit("/steam/", 1)[0]
            self._server = server
            self._state = state
            self._started_at = datetime.now(timezone.utc).timestamp()
            url = build_login_url(return_to, realm, state)
        return {
            "ok": True,
            "status": "pending",
            "url": url,
            "realm": realm,
            "port": server.port,
            "accelerator": accelerator,
            "note": (
                "在浏览器中完成 Steam 登录后会跳回本机端口。"
                if accelerator.get("available")
                else accelerator.get("note", "")
            ),
        }

    def poll_login(self) -> dict[str, Any]:
        """Finish the login if the browser already came back."""

        with self._lock:
            server = self._server
            state = self._state
            started = self._started_at
        if server is None:
            return {"ok": True, "status": "idle", "account": self.load()}

        captured = server.captured()
        if not captured:
            age = datetime.now(timezone.utc).timestamp() - started if started else 0.0
            if age > LOGIN_TTL_SECONDS:
                server.stop()
                with self._lock:
                    self._server = None
                return {"ok": False, "status": "expired", "error": "login_expired"}
            return {"ok": True, "status": "pending"}

        server.stop()
        with self._lock:
            self._server = None

        returned_state = captured.get("openid.state", "")
        if state and returned_state and returned_state != state:
            return {"ok": False, "status": "error", "error": "state_mismatch"}

        ok, steam_id, error = self._verifier(captured)
        if not ok:
            return {"ok": False, "status": "error", "error": error or "verify_failed"}

        profile = self._profile_fetcher(steam_id) or {}
        account = {
            "steam_id": steam_id,
            "nickname": str(profile.get("nickname") or "")[:64],
            "real_name": str(profile.get("real_name") or "")[:64],
            "avatar": str(profile.get("avatar") or "")[:300],
            "online_state": str(profile.get("online_state") or "")[:48],
            "privacy": str(profile.get("privacy") or "")[:32],
            "linked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "store_url": STEAM_STORE,
        }
        try:
            self.save(account)
        except OSError:
            return {"ok": False, "status": "error", "error": "persist_failed", "account": account}
        return {"ok": True, "status": "linked", "account": account}

    def status(self) -> dict[str, Any]:
        return {
            "ok": True,
            "account": self.load(),
            "accelerator": self._detector(),
            "login": "pending" if self._server is not None else "idle",
        }


__all__ = [
    "SteamAccountService",
    "build_login_url",
    "detect_accelerator",
    "fetch_profile",
    "parse_profile_xml",
    "steam_id_from_claimed_id",
    "verify_assertion",
]