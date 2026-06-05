import unittest
from unittest.mock import patch

from recommendation_service.agents import supervisor_agent
from recommendation_service.state import initial_state


class SupervisorLoopGuardTests(unittest.TestCase):
    def test_loop_guard_stops_before_llm_when_max_steps_reached(self):
        state = initial_state()
        state["supervisor_step_count"] = 2
        state["max_supervisor_steps"] = 2

        with patch("recommendation_service.agents.invoke_json") as invoke_json:
            result = supervisor_agent(state)

        invoke_json.assert_not_called()
        self.assertEqual(result["next_action"], "END")
        self.assertIn("max_supervisor_steps=2", result["action_reason"])
        self.assertIn("최대 단계 수", result["final_response"])

    def test_loop_guard_preserves_human_review_when_routine_is_valid(self):
        state = initial_state()
        state.update({
            "supervisor_step_count": 3,
            "max_supervisor_steps": 3,
            "user_profile": {"level": "beginner"},
            "recommendation_params": {"split_targets": ["CHEST"]},
            "exercise_candidates": {"CHEST": [{"name_kor": "푸쉬업"}]},
            "routine_draft": {"days": []},
            "validation_result": {"is_valid": True},
        })

        with patch("recommendation_service.agents.invoke_json") as invoke_json:
            result = supervisor_agent(state)

        invoke_json.assert_not_called()
        self.assertEqual(result["next_action"], "REQUEST_FINAL_HUMAN_REVIEW")

    def test_loop_guard_allows_final_generation_after_approval(self):
        state = initial_state()
        state.update({
            "supervisor_step_count": 3,
            "max_supervisor_steps": 3,
            "human_review_result": {"decision": "approve"},
        })

        with patch("recommendation_service.agents.invoke_json") as invoke_json:
            result = supervisor_agent(state)

        invoke_json.assert_not_called()
        self.assertEqual(result["next_action"], "CALL_FINAL_RESPONSE_GENERATOR")


if __name__ == "__main__":
    unittest.main()
