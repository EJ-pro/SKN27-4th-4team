"""에픽03 — JWT LLM 게이트 단위 테스트 (DB 불필요)."""
from __future__ import annotations

from unittest.mock import patch

from django.test import RequestFactory, SimpleTestCase
from rest_framework_simplejwt.tokens import RefreshToken

from api.services.chatbot.constants import AUTH_REQUIRED_MESSAGE
from api.services.chatbot.llm_gate import should_run_llm, stream_bot_content


class ShouldRunLlmTests(SimpleTestCase):
    def setUp(self):
        self.rf = RequestFactory()

    def _request(self, session: dict | None = None):
        req = self.rf.get("/")
        req.session = session or {}
        return req

    @patch("api.services.chatbot.llm_gate.CHATBOT_REQUIRE_AUTH", False)
    def test_false_env_bypasses_without_token(self):
        self.assertTrue(should_run_llm(self._request({})))

    @patch("api.services.chatbot.llm_gate.CHATBOT_REQUIRE_AUTH", True)
    def test_true_env_blocks_guest(self):
        self.assertFalse(should_run_llm(self._request({})))

    @patch("api.services.chatbot.llm_gate.CHATBOT_REQUIRE_AUTH", True)
    def test_true_env_allows_valid_access_token(self):
        access = str(RefreshToken().access_token)
        self.assertTrue(should_run_llm(self._request({"access_token": access})))

    @patch("api.services.chatbot.llm_gate.CHATBOT_REQUIRE_AUTH", True)
    def test_true_env_rejects_invalid_token(self):
        self.assertFalse(should_run_llm(self._request({"access_token": "not-a-jwt"})))


class StreamBotContentTests(SimpleTestCase):
    def setUp(self):
        self.rf = RequestFactory()

    def _request(self, session_data: dict | None = None):
        req = self.rf.post("/")
        req.session = session_data or {}
        return req

    @patch("api.services.chatbot.llm_gate.stream_answer")
    @patch("api.services.chatbot.llm_gate.CHATBOT_REQUIRE_AUTH", True)
    def test_blocked_returns_auth_message_without_llm(self, mock_stream_answer):
        events = list(stream_bot_content(self._request({}), "스쿼트", 1))
        self.assertEqual(
            events,
            [("token", AUTH_REQUIRED_MESSAGE), ("done", AUTH_REQUIRED_MESSAGE)],
        )
        mock_stream_answer.assert_not_called()

    @patch("api.services.chatbot.llm_gate.stream_answer")
    @patch("api.services.chatbot.llm_gate.CHATBOT_REQUIRE_AUTH", False)
    def test_false_env_calls_stream_answer(self, mock_stream_answer):
        mock_stream_answer.return_value = iter([
            ("token", "LLM"),
            ("done", "LLM 답변"),
        ])
        events = list(stream_bot_content(self._request({}), "스쿼트", 42))
        self.assertEqual(events, [("token", "LLM"), ("done", "LLM 답변")])
        mock_stream_answer.assert_called_once_with("스쿼트", 42)

    @patch("api.services.chatbot.llm_gate.stream_answer")
    @patch("api.services.chatbot.llm_gate.CHATBOT_REQUIRE_AUTH", True)
    def test_true_env_with_token_calls_stream_answer(self, mock_stream_answer):
        mock_stream_answer.return_value = iter([
            ("token", "로그인"),
            ("done", "로그인 후 답변"),
        ])
        access = str(RefreshToken().access_token)
        events = list(stream_bot_content(self._request({"access_token": access}), "스쿼트", 7))
        self.assertEqual(events, [("token", "로그인"), ("done", "로그인 후 답변")])
        mock_stream_answer.assert_called_once_with("스쿼트", 7)

    @patch("api.services.chatbot.llm_gate.stream_answer", side_effect=RuntimeError("boom"))
    @patch("api.services.chatbot.llm_gate.CHATBOT_REQUIRE_AUTH", False)
    def test_stream_answer_exception_propagates(self, _mock_stream_answer):
        with self.assertRaises(RuntimeError):
            list(stream_bot_content(self._request({}), "스쿼트", 1))
