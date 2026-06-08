"""
에픽02 스모크 테스트 — 게스트 채팅 세션 생성 → 로그인 마이그레이션 → 회원 조회/삭제.

사용:
  python scripts/epic02_smoke_test.py
  BASE_URL=http://localhost:8000 python scripts/epic02_smoke_test.py
"""
from __future__ import annotations

import json
import os
import sys
import uuid
from http.cookiejar import CookieJar
from urllib.error import HTTPError
from urllib.request import Request, build_opener, HTTPCookieProcessor

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
TEST_NICKNAME = os.environ.get("EPIC02_TEST_NICKNAME", "epic02smoke")
TEST_PASSWORD = os.environ.get("EPIC02_TEST_PASSWORD", "epic02pass1234")
TEST_EMAIL = os.environ.get("EPIC02_TEST_EMAIL", "epic02smoke@example.com")


def _request(opener, method: str, path: str, body: dict | None = None, headers: dict | None = None):
    data = None
    req_headers = {"Content-Type": "application/json", **(headers or {})}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = Request(f"{BASE_URL}{path}", data=data, headers=req_headers, method=method)
    try:
        with opener.open(req, timeout=30) as res:
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


def main() -> int:
    device = str(uuid.uuid4())
    jar = CookieJar()
    opener = build_opener(HTTPCookieProcessor(jar))

    print(f"[1] 게스트 세션 생성 (device_uuid={device[:8]}...)")
    status, created = _request(
        opener,
        "POST",
        "/api/sessions/",
        {"device_uuid": device, "title": "에픽02 스모크"},
    )
    if status != 201:
        print(f"FAIL: 세션 생성 {status} {created}")
        return 1
    session_id = created["session_id"]
    print(f"    session_id={session_id}")

    print("[2] 게스트 세션 목록 조회")
    status, sessions = _request(opener, "GET", f"/api/sessions/?device_uuid={device}")
    if status != 200 or not any(s["session_id"] == session_id for s in sessions):
        print(f"FAIL: 게스트 목록 {status} {sessions}")
        return 1

    csrf = _csrf(opener)
    _register_if_needed(opener, csrf)

    print("[3] 로그인 + 마이그레이션")
    status, login_data = _request(
        opener,
        "POST",
        "/api/auth/login/",
        {"nickname": TEST_NICKNAME, "password": TEST_PASSWORD, "device_uuid": device},
        {"X-CSRFToken": csrf},
    )
    if status != 200:
        print(f"FAIL: 로그인 {status} {login_data}")
        return 1
    migrated = login_data.get("migrated_sessions", 0)
    print(f"    migrated_sessions={migrated}, migrated_routines={login_data.get('migrated_routines', 0)}")
    if migrated < 1:
        print("FAIL: migrated_sessions >= 1 기대")
        return 1

    print("[4] 로그인 후 세션 목록 (user_id 기준)")
    status, member_sessions = _request(opener, "GET", "/api/sessions/")
    if status != 200 or not any(s["session_id"] == session_id for s in member_sessions):
        print(f"FAIL: 회원 목록 {status} {member_sessions}")
        return 1

    print("[5] 세션 DELETE (actor 기반)")
    status, deleted = _request(
        opener,
        "DELETE",
        f"/api/sessions/{session_id}/",
        {"device_uuid": device},
    )
    if status != 200 or not deleted.get("ok"):
        print(f"FAIL: DELETE {status} {deleted}")
        return 1

    print("[6] 삭제 후 목록에서 제외 확인")
    status, after = _request(opener, "GET", "/api/sessions/")
    if status != 200 or any(s["session_id"] == session_id for s in after):
        print(f"FAIL: 삭제 후에도 세션 존재 {after}")
        return 1

    print("PASS: 에픽02 스모크 테스트 성공")
    return 0


if __name__ == "__main__":
    sys.exit(main())
