"""
에픽03 스모크 테스트 — CHATBOT_REQUIRE_AUTH True/False 동작 확인.

사용:
  python scripts/epic03_llm_gate_smoke_test.py
  BASE_URL=http://localhost:8000 python scripts/epic03_llm_gate_smoke_test.py

주의:
  - True 모드 테스트는 백엔드 재시작이 필요합니다 (constants import 시점 env 반영).
  - False 모드 LLM 호출 테스트는 OpenAI API를 1회 호출합니다.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import uuid
from http.cookiejar import CookieJar
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, build_opener, HTTPCookieProcessor

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
AUTH_REQUIRED_MESSAGE = (
    "AI 답변을 이용하려면 로그인이 필요합니다. "
    "로그인 후 다시 질문해 주세요."
)
TEST_NICKNAME = os.environ.get("EPIC03_TEST_NICKNAME", "epic03gate")
TEST_PASSWORD = os.environ.get("EPIC03_TEST_PASSWORD", "epic03pass1234")
TEST_EMAIL = os.environ.get("EPIC03_TEST_EMAIL", "epic03gate@example.com")
ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT / ".env"


def _request(opener, method: str, path: str, body: dict | None = None, headers: dict | None = None):
    data = None
    req_headers = {"Content-Type": "application/json", **(headers or {})}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = Request(f"{BASE_URL}{path}", data=data, headers=req_headers, method=method)
    try:
        with opener.open(req, timeout=120) as res:
            raw = res.read().decode("utf-8")
            return res.status, json.loads(raw) if raw else {}
    except HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"error": raw}
        return exc.code, payload


def _csrf(opener) -> str:
    status, data = _request(opener, "GET", "/api/auth/csrf/")
    if status != 200:
        raise RuntimeError(f"CSRF 실패: {status} {data}")
    return data.get("csrfToken", "")


def _register_if_needed(opener, csrf: str) -> None:
    status, data = _request(
        opener,
        "POST",
        "/api/auth/register/",
        {"nickname": TEST_NICKNAME, "email": TEST_EMAIL, "password": TEST_PASSWORD},
        {"X-CSRFToken": csrf},
    )
    if status == 201:
        return
    if status == 400 and "이미" in str(data.get("error", "")):
        return
    raise RuntimeError(f"회원가입 실패: {status} {data}")


def _create_guest_session(opener, device: str) -> int:
    status, created = _request(
        opener,
        "POST",
        "/api/sessions/",
        {"device_uuid": device, "title": "에픽03 게이트 테스트"},
    )
    if status != 201:
        raise RuntimeError(f"세션 생성 실패: {status} {created}")
    return created["session_id"]


def _post_message(opener, session_id: int, device: str, content: str):
    return _request(
        opener,
        "POST",
        f"/api/sessions/{session_id}/messages/",
        {"device_uuid": device, "content": content},
    )


def _read_require_auth_flag() -> str:
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if line.startswith("CHATBOT_REQUIRE_AUTH="):
            return line.split("=", 1)[1].strip()
    return "False"


def _set_require_auth_flag(value: str) -> str:
    previous = _read_require_auth_flag()
    lines = []
    replaced = False
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if line.startswith("CHATBOT_REQUIRE_AUTH="):
            lines.append(f"CHATBOT_REQUIRE_AUTH={value}")
            replaced = True
        else:
            lines.append(line)
    if not replaced:
        lines.append(f"CHATBOT_REQUIRE_AUTH={value}")
    ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return previous


def _restart_backend() -> None:
    subprocess.run(
        ["docker", "compose", "up", "-d", "backend"],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    import time

    for _ in range(30):
        try:
            status, _ = _request(build_opener(), "GET", "/api/auth/csrf/")
            if status == 200:
                return
        except Exception:
            pass
        time.sleep(2)
    raise RuntimeError("backend 재시작 후 헬스체크 실패")


def _assert_guest_blocked(opener, session_id: int, device: str) -> None:
    status, body = _post_message(opener, session_id, device, "게스트 차단 테스트")
    if status != 201:
        raise RuntimeError(f"게스트 차단: HTTP {status} {body}")
    bot = body.get("bot_message", {}).get("content", "")
    if bot != AUTH_REQUIRED_MESSAGE:
        raise RuntimeError(
            f"guest blocked: unexpected bot message\n  expected: {AUTH_REQUIRED_MESSAGE}\n  actual: {bot}"
        )


def _assert_guest_llm(opener, session_id: int, device: str) -> None:
    status, body = _post_message(opener, session_id, device, "스쿼트 자세 알려줘")
    if status != 201:
        raise RuntimeError(f"게스트 LLM: HTTP {status} {body}")
    bot = body.get("bot_message", {}).get("content", "")
    if bot == AUTH_REQUIRED_MESSAGE:
        raise RuntimeError("False 모드인데 AUTH_REQUIRED_MESSAGE가 반환됨")
    if len(bot.strip()) < 5:
        raise RuntimeError(f"False 모드 bot 응답이 너무 짧음: {bot!r}")


def _assert_logged_in_llm(opener, session_id: int, device: str) -> None:
    status, body = _post_message(opener, session_id, device, "로그인 후 스쿼트 질문")
    if status != 201:
        raise RuntimeError(f"로그인 LLM: HTTP {status} {body}")
    bot = body.get("bot_message", {}).get("content", "")
    if bot == AUTH_REQUIRED_MESSAGE:
        raise RuntimeError("로그인 상태인데 AUTH_REQUIRED_MESSAGE가 반환됨")


def main() -> int:
    original_flag = _read_require_auth_flag()
    restored = False

    try:
        print(f"[setup] CHATBOT_REQUIRE_AUTH={original_flag}")

        print("[1] True mode - guest blocked")
        _set_require_auth_flag("True")
        _restart_backend()
        device = str(uuid.uuid4())
        guest_opener = build_opener(HTTPCookieProcessor(CookieJar()))
        session_id = _create_guest_session(guest_opener, device)
        _assert_guest_blocked(guest_opener, session_id, device)
        print("    PASS: guest -> AUTH_REQUIRED_MESSAGE, HTTP 201")

        print("[2] True mode - logged-in LLM allowed")
        member_opener = build_opener(HTTPCookieProcessor(CookieJar()))
        csrf = _csrf(member_opener)
        _register_if_needed(member_opener, csrf)
        status, login_data = _request(
            member_opener,
            "POST",
            "/api/auth/login/",
            {"nickname": TEST_NICKNAME, "password": TEST_PASSWORD, "device_uuid": device},
            {"X-CSRFToken": csrf},
        )
        if status != 200:
            raise RuntimeError(f"로그인 실패: {status} {login_data}")
        _assert_logged_in_llm(member_opener, session_id, device)
        print("    PASS: logged-in -> LLM reply (not AUTH_REQUIRED)")

        print("[3] False mode - guest LLM allowed")
        _set_require_auth_flag("False")
        _restart_backend()
        device2 = str(uuid.uuid4())
        guest2 = build_opener(HTTPCookieProcessor(CookieJar()))
        session_id2 = _create_guest_session(guest2, device2)
        _assert_guest_llm(guest2, session_id2, device2)
        print("    PASS: guest -> LLM reply")

        print("PASS: epic03 LLM gate smoke test OK")
        return 0
    finally:
        if not restored and _read_require_auth_flag() != original_flag:
            print(f"[cleanup] restore CHATBOT_REQUIRE_AUTH={original_flag} and restart backend")
            _set_require_auth_flag(original_flag)
            _restart_backend()


if __name__ == "__main__":
    sys.exit(main())
