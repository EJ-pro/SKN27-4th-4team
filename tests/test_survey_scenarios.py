import unittest
from unittest.mock import patch

from recommendation_service.agents import (
    _apply_deterministic_validation,
    _condition_summary,
    _ensure_split_routine,
    _final_response_payload,
    _local_revision_param_hints,
    build_recommendation_params_from_profile,
    graph_search_tool,
    routine_revision_agent,
    supervisor_agent,
    user_profile_tool,
)
from recommendation_service.cli import _format_exercise, _prompt_review
from recommendation_service.state import initial_state
from recommendation_service.survey_scenarios import SURVEY_SCENARIOS, survey_to_user_profile


class SurveyScenarioTests(unittest.TestCase):
    def test_scenarios_convert_to_expected_graphdb_params(self):
        for scenario in SURVEY_SCENARIOS:
            with self.subTest(scenario=scenario["id"]):
                profile = survey_to_user_profile(scenario["survey"])
                params = build_recommendation_params_from_profile(profile, parsed={})

                for key, expected in scenario["expected_params"].items():
                    self.assertEqual(params[key], expected)

                self.assertTrue(params["split_targets"])
                self.assertEqual(params["available_equipment"], profile["available_equipment"])
                self.assertEqual(params["home_only"], profile["home_only"])
                self.assertEqual(params["intensity_bias"], profile["intensity_bias"])

    def test_scenarios_normalize_profile_without_message_llm_fallback(self):
        for scenario in SURVEY_SCENARIOS:
            with self.subTest(scenario=scenario["id"]):
                state = initial_state(user_profile=survey_to_user_profile(scenario["survey"]))
                with patch("recommendation_service.agents.invoke_json") as invoke_json:
                    result = user_profile_tool(state)

                invoke_json.assert_not_called()
                params = build_recommendation_params_from_profile(result["user_profile"], parsed={})
                for key, expected in scenario["expected_params"].items():
                    self.assertEqual(params[key], expected)

    def test_supervisor_routes_to_profile_normalization_before_params(self):
        state = initial_state(user_profile=survey_to_user_profile(SURVEY_SCENARIOS[0]["survey"]))

        with patch("recommendation_service.agents.invoke_json", return_value={
            "next_action": "CALL_RECOMMENDATION_PARAM_AGENT",
            "reason": "try params too early",
        }):
            result = supervisor_agent(state)

        self.assertEqual(result["next_action"], "CALL_USER_PROFILE_TOOL")

    def test_missing_structured_profile_stops_without_message_llm_fallback(self):
        state = initial_state()
        with patch("recommendation_service.agents.invoke_json") as invoke_json:
            result = user_profile_tool(state)

        invoke_json.assert_not_called()
        self.assertEqual(result["next_action"], "END")
        self.assertIn("user_profile", result["final_response"])

    def test_missing_required_profile_field_is_not_filled_by_llm_params(self):
        profile = survey_to_user_profile(SURVEY_SCENARIOS[0]["survey"])
        profile.pop("goal")

        with self.assertRaises(ValueError):
            build_recommendation_params_from_profile(
                profile,
                parsed={"goal": "hypertrophy"},
            )

    def test_missing_session_min_stops_recommendation_params(self):
        profile = survey_to_user_profile(SURVEY_SCENARIOS[0]["survey"])
        profile.pop("session_min")

        with self.assertRaises(ValueError):
            build_recommendation_params_from_profile(profile, parsed={})

    def test_session_min_controls_exercise_count_per_split(self):
        expected_counts = {30: 3, 45: 3, 60: 4, 90: 5}
        candidates = {
            "CHEST": [
                {"id": index, "name_kor": f"운동{index}", "equipment": "body"}
                for index in range(1, 7)
            ]
        }
        parsed_routine = {
            "days": [
                {
                    "day": "월",
                    "target": "CHEST",
                    "exercises": [
                        {"name": f"운동{index}"}
                        for index in range(1, 7)
                    ],
                }
            ]
        }

        for minutes, expected in expected_counts.items():
            with self.subTest(minutes=minutes):
                params = {"split_targets": ["CHEST"], "session_min": minutes}
                routine = _ensure_split_routine(parsed_routine, candidates, params)
                self.assertEqual(len(routine["days"][0]["exercises"]), expected)

    def test_higher_intensity_changes_sets_reps_and_rest(self):
        candidates = {
            "CHEST": [
                {"id": index, "name_kor": f"운동{index}", "equipment": "body"}
                for index in range(1, 5)
            ]
        }
        params = {
            "split_targets": ["CHEST"],
            "session_min": 60,
            "intensity_bias": "higher",
        }

        routine = _ensure_split_routine({"days": []}, candidates, params)
        exercise = routine["days"][0]["exercises"][0]

        self.assertEqual(exercise["sets"], 4)
        self.assertEqual(exercise["reps"], "6-10")
        self.assertEqual(exercise["rest_seconds"], 90)
        self.assertIn("고강도", exercise["intensity_note"])

    def test_local_feedback_hint_maps_high_intensity_to_param(self):
        self.assertEqual(
            _local_revision_param_hints("좀 더 고강도로 해주세요"),
            {"intensity_bias": "higher"},
        )

    def test_local_feedback_hint_maps_focus_target_to_volume_bias(self):
        self.assertEqual(
            _local_revision_param_hints("가슴에 좀 더 집중하고 싶어요"),
            {"focus_targets": ["CHEST"], "volume_bias": "higher"},
        )

    def test_local_feedback_hint_maps_common_injuries(self):
        self.assertEqual(
            _local_revision_param_hints("무릎이 아파요"),
            {"avoid_conditions": ["knee"]},
        )
        self.assertEqual(
            _local_revision_param_hints("허리를 다쳤습니다"),
            {"avoid_conditions": ["lower_back"], "spine": "low"},
        )
        self.assertEqual(
            _local_revision_param_hints("손목이 불편해요"),
            {"avoid_conditions": ["wrist"]},
        )

    def test_focus_target_increases_only_that_target_sets(self):
        candidates = {
            "CHEST": [{"id": index, "name_kor": f"가슴{index}", "equipment": "body"} for index in range(1, 5)],
            "BACK": [{"id": index, "name_kor": f"등{index}", "equipment": "body"} for index in range(1, 5)],
        }
        params = {
            "split_targets": ["CHEST", "BACK"],
            "session_min": 60,
            "focus_targets": ["CHEST"],
            "volume_bias": "higher",
        }

        routine = _ensure_split_routine({"days": []}, candidates, params)
        chest = routine["days"][0]["exercises"][0]
        back = routine["days"][1]["exercises"][0]

        self.assertEqual(chest["sets"], 4)
        self.assertEqual(back["sets"], 3)
        self.assertIn("CHEST 집중", chest["intensity_note"])

    def test_pain_scenarios_force_low_spine_load(self):
        for scenario in SURVEY_SCENARIOS:
            profile = survey_to_user_profile(scenario["survey"])
            params = build_recommendation_params_from_profile(profile, parsed={})
            has_pain = bool(profile["pain_points"])

            with self.subTest(scenario=scenario["id"]):
                if has_pain or int(profile["age"]) >= 65:
                    self.assertEqual(params["spine"], "low")

    def test_gender_sets_initial_intensity_bias_only(self):
        for scenario in SURVEY_SCENARIOS:
            profile = survey_to_user_profile(scenario["survey"])
            params = build_recommendation_params_from_profile(profile, parsed={})

            with self.subTest(scenario=scenario["id"]):
                expected = "slightly_conservative" if profile["gender"] == "female" else "standard"
                self.assertEqual(params["intensity_bias"], expected)

    def test_human_revision_constraints_trigger_graphdb_research(self):
        state = initial_state(user_profile=survey_to_user_profile(SURVEY_SCENARIOS[0]["survey"]))
        state.update({
            "recommendation_params": {
                "split_targets": ["CHEST", "BACK"],
                "goal": "hypertrophy",
                "level": "intermediate",
                "available_equipment": ["machine", "body"],
                "avoid_conditions": [],
                "exclude_exercises": [],
                "home_only": False,
                "session_min": 60,
                "spine": "all",
            },
            "exercise_candidates": {"CHEST": [{"name_kor": "푸쉬업"}]},
            "routine_draft": {"days": [{"target": "CHEST", "exercises": [{"name": "푸쉬업"}]}]},
            "validation_result": {"is_valid": True, "issues": []},
            "human_review_result": {
                "decision": "revise",
                "feedback": "허리에 부담이 덜 가게 수정해주세요.",
            },
        })

        with patch("recommendation_service.agents.invoke_json", return_value={
            "revision_type": "constraint_update",
            "revision_reason": "새 안전 제약으로 GraphDB 재검색이 필요합니다.",
            "requires_research": True,
            "updated_params": {
                "spine": "low",
                "avoid_conditions": ["lower_back"],
            },
        }):
            result = routine_revision_agent(state)

        self.assertEqual(result["recommendation_params"]["spine"], "low")
        self.assertEqual(result["recommendation_params"]["avoid_conditions"], ["lower_back"])
        self.assertEqual(result["exercise_candidates"], {})
        self.assertIsNone(result["routine_draft"])
        self.assertIsNone(result["validation_result"])
        self.assertIsNone(result["human_review_result"])

    def test_graph_search_stops_when_graphdb_candidates_are_insufficient(self):
        state = initial_state(user_profile=survey_to_user_profile(SURVEY_SCENARIOS[1]["survey"]))
        state["recommendation_params"] = {
            "split_targets": ["LEG", "SHOULDER", "ARM"],
            "level": "beginner",
            "available_equipment": ["body", "dumbbell", "band"],
            "home_only": True,
            "session_min": 45,
            "spine": "low",
        }

        with patch("recommendation_service.graph_tools.search_exercises", return_value=(
            {
                "LEG": [{"name_kor": "운동1"}, {"name_kor": "운동2"}],
                "SHOULDER": [{"name_kor": "운동3"}],
                "ARM": [{"name_kor": "운동4"}, {"name_kor": "운동5"}],
            },
            ["LEG", "SHOULDER", "ARM"],
        )):
            result = graph_search_tool(state)

        self.assertEqual(result["next_action"], "END")
        self.assertIn("운동 후보가 부족", result["final_response"])
        self.assertEqual(result["insufficient_targets"], ["LEG", "SHOULDER", "ARM"])

    def test_cli_accept_alias_is_treated_as_approval(self):
        with patch("builtins.input", return_value="accept"):
            result = _prompt_review()

        self.assertEqual(result, {"decision": "approve", "feedback": ""})

    def test_cli_review_payload_formats_prescription(self):
        self.assertEqual(
            _format_exercise({
                "name": "벤치 프레스",
                "sets": 4,
                "reps": "6-10",
                "rest_seconds": 90,
            }),
            "벤치 프레스(4세트 6-10회 90초)",
        )

    def test_valid_routine_with_pain_context_has_medium_risk_warning(self):
        profile = survey_to_user_profile(SURVEY_SCENARIOS[1]["survey"])
        state = initial_state(user_profile=profile)
        state.update({
            "recommendation_params": {
                "split_targets": ["LEG"],
                "spine": "low",
                "avoid_conditions": ["knee"],
            },
            "exercise_candidates": {
                "LEG": [
                    {"id": 1, "name_kor": "운동1", "spine_loading": "하"},
                    {"id": 2, "name_kor": "운동2", "spine_loading": "하"},
                    {"id": 3, "name_kor": "운동3", "spine_loading": "하"},
                ]
            },
            "routine_draft": {
                "days": [{
                    "target": "LEG",
                    "exercises": [
                        {"name": "운동1"},
                        {"name": "운동2"},
                        {"name": "운동3"},
                    ],
                }]
            },
        })

        result = _apply_deterministic_validation(state, {
            "is_valid": True,
            "risk_level": "low",
            "issues": [],
            "safety_warnings": ["다른 장비를 추가하세요."],
            "revision_instructions": ["장비를 다양하게 구성하세요."],
        })

        self.assertTrue(result["is_valid"])
        self.assertEqual(result["risk_level"], "medium")
        self.assertEqual(len(result["safety_warnings"]), 1)
        self.assertNotIn("다른 장비를 추가하세요.", result["safety_warnings"])
        self.assertEqual(result["revision_instructions"], [])
        self.assertIn("주의가 필요", result["reason"])

    def test_low_spine_constraint_rejects_medium_spine_loading(self):
        profile = survey_to_user_profile(SURVEY_SCENARIOS[0]["survey"])
        state = initial_state(user_profile=profile)
        state.update({
            "recommendation_params": {
                "split_targets": ["LEG"],
                "spine": "low",
                "avoid_conditions": ["lower_back"],
            },
            "exercise_candidates": {
                "LEG": [
                    {"id": 1, "name_kor": "운동1", "spine_loading": "중"},
                    {"id": 2, "name_kor": "운동2", "spine_loading": "하"},
                    {"id": 3, "name_kor": "운동3", "spine_loading": "하"},
                ]
            },
            "routine_draft": {
                "days": [{
                    "target": "LEG",
                    "exercises": [
                        {"name": "운동1"},
                        {"name": "운동2"},
                        {"name": "운동3"},
                    ],
                }]
            },
        })

        result = _apply_deterministic_validation(state, {
            "is_valid": True,
            "risk_level": "low",
            "issues": [],
        })

        self.assertFalse(result["is_valid"])
        self.assertEqual(result["risk_level"], "high")
        self.assertEqual(result["issues"][0]["type"], "non_low_spine_loading")

    def test_condition_summary_explains_human_feedback_constraints(self):
        state = initial_state()
        state.update({
            "revision_constraints": {
                "spine": "low",
                "intensity_bias": "higher",
                "avoid_conditions": ["통증", "부상"],
            },
            "validation_result": {
                "risk_level": "medium",
            },
        })

        summary = _condition_summary(state)

        self.assertTrue(any("운동 후보" in item for item in summary))
        self.assertTrue(any("강도" in item for item in summary))
        self.assertTrue(any("통증, 부상" in item for item in summary))
        self.assertTrue(any("주의가 필요" in item for item in summary))

    def test_final_response_payload_exposes_only_user_facing_fields(self):
        state = initial_state()
        state.update({
            "user_profile": {"goal": "hypertrophy", "session_min": 60},
            "routine_draft": {"days": []},
            "revision_constraints": {"spine": "low", "avoid_conditions": ["통증"]},
            "validation_result": {
                "risk_level": "medium",
                "safety_warnings": ["운동 가능 여부를 확인하세요."],
            },
        })

        payload = _final_response_payload(state)

        self.assertEqual(
            set(payload),
            {"확정 루틴", "사용자 조건", "조건 반영 설명", "주의 수준", "주의사항"},
        )
        self.assertNotIn("validation", payload)
        self.assertNotIn("revision_constraints", payload)
        self.assertEqual(payload["주의 수준"], "주의 필요")


if __name__ == "__main__":
    unittest.main()
