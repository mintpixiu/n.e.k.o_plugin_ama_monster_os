from __future__ import annotations

from pathlib import Path

from steam_account import (
    SteamAccountService,
    build_login_url,
    detect_accelerator,
    parse_profile_xml,
    steam_id_from_claimed_id,
    verify_assertion,
)

STEAM_ID = "76561198000000000"


def test_steam_id_from_claimed_id() -> None:
    assert steam_id_from_claimed_id(f"https://steamcommunity.com/openid/id/{STEAM_ID}") == STEAM_ID
    assert steam_id_from_claimed_id("https://example.com/openid/id/123") == ""
    assert steam_id_from_claimed_id("") == ""


def test_build_login_url_contains_required_fields() -> None:
    url = build_login_url(
        "http://127.0.0.1:5000/steam/openid/callback",
        "http://127.0.0.1:5000",
        "abc123",
    )
    assert url.startswith("https://steamcommunity.com/openid/login?")
    assert "openid.mode=checkid_setup" in url
    assert "openid.return_to=http%3A%2F%2F127.0.0.1%3A5000" in url
    assert "openid.state=abc123" in url


def test_detect_accelerator_reads_hosts_file(tmp_path: Path) -> None:
    hosts = tmp_path / "hosts"
    hosts.write_text(
        "127.0.0.1 steamcommunity.com\n"
        "127.0.0.1 www.steamcommunity.com\n"
        "# 127.0.0.1 api.steampowered.com\n"
        "10.0.0.1 example.com\n",
        encoding="utf-8",
    )
    result = detect_accelerator(hosts, probe=lambda: False)

    assert result["available"] is True
    assert "steamcommunity.com" in result["redirected"]
    assert "api.steampowered.com" not in result["redirected"]


def test_detect_accelerator_without_redirect(tmp_path: Path) -> None:
    hosts = tmp_path / "hosts"
    hosts.write_text("10.0.0.1 example.com\n", encoding="utf-8")
    result = detect_accelerator(hosts, probe=lambda: False)

    assert result["available"] is False
    assert result["redirected"] == []
    assert "Steam++" in result["note"]


def test_parse_profile_xml() -> None:
    payload = (
        "<profile><steamID64>76561198000000000</steamID64>"
        "<steamID><![CDATA[呆萌猫猫]]></steamID>"
        "<realname>Cat</realname>"
        "<avatarFull><![CDATA[https://avatars.example/cat.jpg]]></avatarFull>"
        "<onlineState>online</onlineState>"
        "<stateMessage>Playing Dota 2</stateMessage>"
        "<privacyState>public</privacyState></profile>"
    )
    profile = parse_profile_xml(payload)

    assert profile["steam_id"] == STEAM_ID
    assert profile["nickname"] == "呆萌猫猫"
    assert profile["avatar"].startswith("https://")
    assert profile["privacy"] == "public"


def test_parse_profile_xml_rejects_non_profile() -> None:
    assert parse_profile_xml("<html>blocked</html>") == {}
    assert parse_profile_xml("") == {}


def test_verify_assertion_rejects_bad_response(monkeypatch) -> None:
    class FakeResponse:
        def __init__(self, body: str) -> None:
            self._body = body

        def read(self, _limit: int = 0) -> bytes:
            return self._body.encode("utf-8")

        def __enter__(self) -> "FakeResponse":
            return self

        def __exit__(self, *_args) -> bool:
            return False

    params = {
        "openid.mode": "id_res",
        "openid.claimed_id": f"https://steamcommunity.com/openid/id/{STEAM_ID}",
        "openid.sig": "x",
    }
    ok, steam_id, error = verify_assertion(
        params,
        opener=lambda _request: FakeResponse("ns:http://specs.openid.net/auth/2.0\nis_valid:false\n"),
    )
    assert ok is False
    assert error == "invalid_assertion"

    ok, steam_id, error = verify_assertion(
        params,
        opener=lambda _request: FakeResponse("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n"),
    )
    assert ok is True
    assert steam_id == STEAM_ID


def test_login_flow_persists_profile(tmp_path: Path) -> None:
    hosts = tmp_path / "hosts"
    hosts.write_text("127.0.0.1 steamcommunity.com\n", encoding="utf-8")

    service = SteamAccountService(
        tmp_path,
        detector=lambda: detect_accelerator(hosts, probe=lambda: False),
        verifier=lambda _params: (True, STEAM_ID, ""),
        profile_fetcher=lambda steam_id: {
            "steam_id": steam_id,
            "nickname": "Ama",
            "avatar": "https://avatars.example/ama.jpg",
            "privacy": "public",
        },
    )

    started = service.start_login()
    assert started["ok"] is True
    assert started["accelerator"]["available"] is True
    assert started["url"].startswith("https://steamcommunity.com/openid/login?")
    assert started["port"] > 0

    pending = service.poll_login()
    assert pending["status"] == "pending"

    # Simulate the browser redirect hitting the loopback listener.
    server = service._server  # noqa: SLF001 - white-box test of the loopback
    assert server is not None
    server._captured.update({  # noqa: SLF001
        "openid.mode": "id_res",
        "openid.claimed_id": f"https://steamcommunity.com/openid/id/{STEAM_ID}",
        "openid.state": service._state,  # noqa: SLF001
    })

    done = service.poll_login()
    assert done["ok"] is True
    assert done["status"] == "linked"
    assert done["account"]["steam_id"] == STEAM_ID
    assert done["account"]["nickname"] == "Ama"

    stored = service.load()
    assert stored["steam_id"] == STEAM_ID
    assert stored["nickname"] == "Ama"
    assert stored["linked_at"]

    service.clear()
    assert service.load() == {}


def test_login_rejects_state_mismatch(tmp_path: Path) -> None:
    service = SteamAccountService(
        tmp_path,
        detector=lambda: {"available": True, "note": "", "redirected": []},
        verifier=lambda _params: (True, STEAM_ID, ""),
        profile_fetcher=lambda steam_id: {"steam_id": steam_id},
    )
    service.start_login()
    server = service._server  # noqa: SLF001
    assert server is not None
    server._captured.update({  # noqa: SLF001
        "openid.mode": "id_res",
        "openid.claimed_id": f"https://steamcommunity.com/openid/id/{STEAM_ID}",
        "openid.state": "wrong",
    })

    result = service.poll_login()
    assert result["ok"] is False
    assert result["error"] == "state_mismatch"


def test_status_reports_account_and_accelerator(tmp_path: Path) -> None:
    hosts = tmp_path / "hosts"
    hosts.write_text("127.0.0.1 steamcommunity.com\n", encoding="utf-8")
    service = SteamAccountService(tmp_path, detector=lambda: detect_accelerator(hosts, probe=lambda: True))

    status = service.status()
    assert status["ok"] is True
    assert status["account"] == {}
    assert status["accelerator"]["available"] is True