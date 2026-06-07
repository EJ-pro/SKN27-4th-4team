import unittest
from unittest.mock import patch

from recommendation_service.agents import supervisor_agent
from recommendation_service.state import initial_state


class SupervisorLoopGuardTests(unittest.TestCase):
    def test_normal_flow_routes_without_llm(self):
        state = initial_state(user_profile={"age": 30})

        with patch("recommendation_service.agents.invoke_json") as invoke_json:
            result = supervisor_agent(state)

        invoke_json.assert_not_called()
        self.assertEqual(result["next_action"], "CALL_USER_PROFILE_TOOL")
        self.assertEqual(result["action_reason"], "deterministic normal-flow route")

    def test_human_feedback_supervisor_can_route_to_graph_research(self):
        state = initial_state(user_profile={"age": 30})
        state.update({
            "profile_normalized": True,
            "recommendation_params": {
                "split_targets": ["BACK"],
                "goal": "health",
                "level": "intermediate",
                "available_equipment": ["machine", "body"],
                "spine": "all",
                "avoid_conditions": [],
            },
            "exercise_candidates": {"BACK": [{"name_kor": "운동1"}]},
            "routine_draft": {"days": [{"target": "BACK", "exercises": [{"name": "운동1"}]}]},
            "validation_result": {"is_valid": True, "issues": []},
            "human_review_result": {
                "decision": "revise",
                "feedback": "허리에 부담이 적게 해주세요.",
            },
        })

        with patch("recommendation_service.agents.invoke_json", return_value={
            "strategy": "research",
            "reason": "새로운 허리 안전 조건으로 후보 재검색이 필요합니다.",
            "updated_params": {
                "spine": "low",
                "avoid_conditions": ["lower_back"],
            },
        }) as invoke_json:
            result = supervisor_agent(state)

        invoke_json.assert_called_once()
        self.assertEqual(result["next_action"], "CALL_GRAPH_SEARCH_TOOL")
        self.assertEqual(result["recommendation_params"]["spine"], "low")
        self.assertEqual(result["recommendation_params"]["avoid_conditions"], ["lower_back"])
        self.assertEqual(result["exercise_candidates"], {})
        self.assertIsNone(result["routine_draft"])
        self.assertIsNone(result["human_review_result"])

    def test_human_feedback_supervisor_can_choose_local_revision(self):
        state = initial_state(user_profile={"age": 30})
        state.update({
            "profile_normalized": True,
            "recommendation_params": {
                "split_targets": ["CHEST"],
                "goal": "hypertrophy",
                "level": "intermediate",
                "available_equipment": ["barbell", "machine"],
            },
            "exercise_candidates": {"CHEST": [{"name_kor": "운동1"}]},
            "routine_draft": {"days": [{"target": "CHEST", "exercises": [{"name": "운동1"}]}]},
            "validation_result": {"is_valid": True, "issues": []},
            "human_review_result": {
                "decision": "revise",
                "feedback": "운동 순서만 바꿔주세요.",
            },
        })

        with patch("recommendation_service.agents.invoke_json", return_value={
            "strategy": "local_revision",
            "reason": "현재 후보 안에서 순서만 바꾸면 됩니다.",
            "updated_params": {},
        }) as invoke_json:
            result = supervisor_agent(state)

        invoke_json.assert_called_once()
        self.assertEqual(result["next_action"], "CALL_REVISION_AGENT")
        self.assertTrue(result["revision_request"]["handled_by_supervisor"])
        self.assertEqual(result["revision_request"]["strategy"], "local_revision")

    def test_multiple_validation_issues_use_supervisor_llm(self):
        state = initial_state(user_profile={"age": 30})
        state.update({
            "profile_normalized": True,
            "recommendation_params": {"split_targets": ["CHEST"]},
            "exercise_candidates": {"CHEST": [{"name_kor": "운동1"}]},
            "routine_draft": {"days": [{"target": "CHEST", "exercises": []}]},
            "validation_result": {
                "is_valid": False,
                "issues": [
                    {"type": "too_few_exercises"},
                    {"type": "missing_required_exercise"},
                ],
            },
        })

        with patch("recommendation_service.agents.invoke_json", return_value={
            "strategy": "local_revision",
            "reason": "현재 후보로 재구성할 수 있습니다.",
            "updated_params": {},
        }) as invoke_json:
            result = supervisor_agent(state)

        invoke_json.assert_called_once()
        self.assertEqual(result["next_action"], "CALL_REVISION_AGENT")

    def test_single_validation_issue_routes_without_supervisor_llm(self):
        state = initial_state(user_profile={"age": 30})
        state.update({
            "profile_normalized": True,
            "recommendation_params": {"split_targets": ["CHEST"]},
            "exercise_candidates": {"CHEST": [{"name_kor": "운동1"}]},
            "routine_draft": {"days": [{"target": "CHEST", "exercises": []}]},
            "validation_result": {
                "is_valid": False,
                "issues": [{"type": "too_few_exercises"}],
            },
        })

        with patch("recommendation_service.agents.invoke_json") as invoke_json:
            result = supervisor_agent(state)

        invoke_json.assert_not_called()
        self.assertEqual(result["next_action"], "CALL_REVISION_AGENT")

    def test_inconsistent_state_uses_llm_recovery_choice(self):
        state = initial_state(user_profile={"age": 30})
        state.update({
            "profile_normalized": True,
            "recommendation_params": {"split_targets": ["CHEST"]},
            "exercise_candidates": {"CHEST": [{"name_kor": "운동1"}]},
            "routine_draft": None,
            "validation_result": {"is_valid": True},
        })

        with patch("recommendation_service.agents.invoke_json", return_value={
            "recovery_option": "RECOMPOSE_ROUTINE",
            "reason": "후보는 있으므로 루틴 구성부터 복구합니다.",
        }) as invoke_json:
            result = supervisor_agent(state)

        invoke_json.assert_called_once()
        self.assertEqual(result["next_action"], "CALL_COMPOSITION_AGENT")
        self.assertIsNone(result["validation_result"])

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

    def test_loop_guard_ends_immediately_after_approval(self):
        state = initial_state()
        state.update({
            "supervisor_step_count": 3,
            "max_supervisor_steps": 3,
            "human_review_result": {"decision": "approve"},
        })

        with patch("recommendation_service.agents.invoke_json") as invoke_json:
            result = supervisor_agent(state)

        invoke_json.assert_not_called()
        self.assertEqual(result["next_action"], "END")


if __name__ == "__main__":
    unittest.main()
