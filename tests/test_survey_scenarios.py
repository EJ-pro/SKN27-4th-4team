import unittest
from unittest.mock import patch

from recommendation_service.agents import (
    _apply_deterministic_validation,
    _condition_summary,
    _ensure_split_routine,
    _local_revision_param_hints,
    build_recommendation_params_from_profile,
    graph_search_tool,
    routine_revision_agent,
    routine_composition_agent,
    routine_validation_agent,
    supervisor_agent,
    user_profile_tool,
)
from recommendation_service.graph_tools import movement_family, search_exercises
from recommendation_service.policies import GOAL_EQUIPMENT_POLICY
from recommendation_service.state import initial_state
from recommendation_service.survey_scenarios import SURVEY_SCENARIOS, survey_to_user_profile
from backend.api.services.routine_recommender import start_recommendation


class SurveyScenarioTests(unittest.TestCase):
    def test_scenarios_convert_to_expected_graphdb_params(self):
        for scenario in SURVEY_SCENARIOS:
            with self.subTest(scenario=scenario["id"]):
                profile = survey_to_user_profile(scenario["survey"])
                params = build_recommendation_params_from_profile(profile, parsed={})

                for key, expected in scenario["expected_params"].items():
                    self.assertEqual(params[key], expected)

                self.assertTrue(params["split_targets"])
                excluded = GOAL_EQUIPMENT_POLICY.get(params["goal"], {}).get("excluded", set())
                self.assertEqual(
                    params["available_equipment"],
                    [item for item in profile["available_equipment"] if item not in excluded],
                )
                self.assertFalse(params["home_only"])
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

        self.assertEqual(exercise["sets"], 5)
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

        self.assertEqual(chest["sets"], 5)
        self.assertEqual(back["sets"], 4)
        self.assertIn("CHEST 집중", chest["intensity_note"])

    def test_pain_scenarios_force_low_spine_load(self):
        for scenario in SURVEY_SCENARIOS:
            profile = survey_to_user_profile(scenario["survey"])
            params = build_recommendation_params_from_profile(profile, parsed={})
            has_pain = bool(profile["pain_points"])

            with self.subTest(scenario=scenario["id"]):
                if has_pain or int(profile["age"]) >= 50:
                    self.assertEqual(params["spine"], "low")

    def test_goal_equipment_policies(self):
        base_profile = survey_to_user_profile(SURVEY_SCENARIOS[0]["survey"])
        expected_exclusions = {
            "strength": {"body"},
            "hypertrophy": {"body"},
            "fat_loss": {"body"},
            "health": {"barbell", "dumbbell", "kettlebell"},
        }

        for goal, exclusions in expected_exclusions.items():
            with self.subTest(goal=goal):
                profile = {
                    **base_profile,
                    "goal": goal,
                    "available_equipment": [
                        "barbell",
                        "dumbbell",
                        "machine",
                        "body",
                        "pull_up_bar",
                        "band",
                        "kettlebell",
                    ],
                }
                params = build_recommendation_params_from_profile(profile)
                self.assertTrue(exclusions.isdisjoint(params["available_equipment"]))

    def test_bodyweight_is_allowed_only_for_health_goal(self):
        base_profile = survey_to_user_profile(SURVEY_SCENARIOS[0]["survey"])
        for goal in ["strength", "hypertrophy", "fat_loss", "health"]:
            with self.subTest(goal=goal):
                params = build_recommendation_params_from_profile({
                    **base_profile,
                    "goal": goal,
                    "available_equipment": ["barbell", "dumbbell", "machine", "body", "band"],
                })
                self.assertEqual("body" in params["available_equipment"], goal == "health")

    def test_health_routine_includes_bodyweight_when_candidate_exists(self):
        candidates = {
            "CHEST": [
                {"id": 1, "name_kor": "체스트 프레스", "equipment": "machine"},
                {"id": 2, "name_kor": "펙 덱 플라이", "equipment": "machine"},
                {"id": 3, "name_kor": "케이블 플라이", "equipment": "machine"},
                {"id": 4, "name_kor": "푸쉬업", "equipment": "body"},
            ],
        }
        routine = _ensure_split_routine(
            {"days": []},
            candidates,
            {
                "split_targets": ["CHEST"],
                "goal": "health",
                "session_min": 30,
            },
        )

        exercises = routine["days"][0]["exercises"]
        self.assertEqual(exercises[0]["equipment"], "machine")
        self.assertIn("body", [exercise["equipment"] for exercise in exercises])

    def test_home_input_is_normalized_to_gym_only(self):
        survey = {
            **SURVEY_SCENARIOS[0]["survey"],
            "place": "home",
        }
        profile = survey_to_user_profile(survey)
        params = build_recommendation_params_from_profile(profile)

        self.assertEqual(profile["place"], "gym")
        self.assertFalse(profile["home_only"])
        self.assertFalse(params["home_only"])

    def test_recommendation_api_rejects_home_place(self):
        survey = {
            **SURVEY_SCENARIOS[0]["survey"],
            "place": "home",
        }
        result = start_recommendation(survey)

        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], "failed")
        self.assertIn("체육관 운동만 지원", result["message"])

    def test_strength_and_hypertrophy_require_compound_lifts(self):
        profile = survey_to_user_profile(SURVEY_SCENARIOS[0]["survey"])
        expected_ids = {
            "CHEST": 2001,
            "BACK": 1001,
            "LEG": 4001,
            "SHOULDER": 3001,
        }

        for goal in ["strength", "hypertrophy"]:
            with self.subTest(goal=goal):
                params = build_recommendation_params_from_profile({
                    **profile,
                    "goal": goal,
                })
                self.assertEqual(
                    {target: item["id"] for target, item in params["required_exercises"].items()},
                    expected_ids,
                )

    def test_graph_search_injects_required_exercise_from_neo4j_metadata(self):
        regular_rows = [
            {
                "id": 2099,
                "name_kor": "일반 가슴 운동",
                "equipment": "machine",
                "difficulty": 2,
            },
            {
                "id": 2098,
                "name_kor": "일반 가슴 운동 2",
                "equipment": "machine",
                "difficulty": 2,
            },
        ]
        required_row = {
            "id": 2001,
            "name_kor": "DB에서 조회한 벤치 프레스",
            "split_day": "CHEST",
            "equipment": "barbell",
            "difficulty": 2,
            "spine_loading": "중",
            "video_url": "https://example.test/2001.mp4",
        }

        with patch("recommendation_service.graph_tools.GraphQuery") as graph_query:
            graph = graph_query.return_value
            graph.get_exercises_by_ids.return_value = [required_row]
            graph.get_exercises_by_split.return_value = regular_rows
            candidates, insufficient = search_exercises({
                "split_targets": ["CHEST"],
                "goal": "strength",
                "level": "intermediate",
                "spine": "all",
                "available_equipment": ["barbell", "machine"],
                "candidate_limit_per_target": 8,
                "required_exercises": {"CHEST": {"id": 2001}},
            })

        self.assertEqual(candidates["CHEST"][0]["id"], 2001)
        self.assertEqual(candidates["CHEST"][0]["name_kor"], "DB에서 조회한 벤치 프레스")
        self.assertTrue(candidates["CHEST"][0]["expert_policy_required"])
        self.assertEqual(insufficient, [])

    def test_graph_search_reports_missing_required_exercise(self):
        with patch("recommendation_service.graph_tools.GraphQuery") as graph_query:
            graph = graph_query.return_value
            graph.get_exercises_by_ids.return_value = []
            graph.get_exercises_by_split.return_value = [
                {"id": 1, "name_kor": "운동 1", "equipment": "machine"},
                {"id": 2, "name_kor": "운동 2", "equipment": "machine"},
                {"id": 3, "name_kor": "운동 3", "equipment": "machine"},
            ]
            _, insufficient = search_exercises({
                "split_targets": ["CHEST"],
                "goal": "strength",
                "level": "intermediate",
                "spine": "all",
                "available_equipment": ["barbell", "machine"],
                "required_exercises": {"CHEST": {"id": 2001}},
            })

        self.assertEqual(insufficient, ["CHEST"])

    def test_human_revision_search_does_not_reinject_required_exercise(self):
        regular_rows = [
            {"id": 1001, "name_kor": "데드리프트", "equipment": "barbell", "difficulty": 2},
            {"id": 1101, "name_kor": "시티드 로우 머신", "equipment": "machine", "difficulty": 2},
            {"id": 1102, "name_kor": "랫 풀다운", "equipment": "machine", "difficulty": 2},
            {"id": 1103, "name_kor": "암 풀다운", "equipment": "machine", "difficulty": 2},
        ]

        with patch("recommendation_service.graph_tools.GraphQuery") as graph_query:
            graph = graph_query.return_value
            graph.get_exercises_by_ids.return_value = [
                {"id": 1001, "name_kor": "데드리프트", "equipment": "barbell"}
            ]
            graph.get_exercises_by_split.return_value = regular_rows
            candidates, insufficient = search_exercises({
                "split_targets": ["BACK"],
                "goal": "strength",
                "level": "intermediate",
                "spine": "all",
                "available_equipment": ["barbell", "machine"],
                "exclude_exercises": ["데드리프트"],
                "required_exercises": {},
            })

        self.assertNotIn(1001, [row.get("id") for row in candidates["BACK"]])
        self.assertEqual(insufficient, [])

    def test_removed_revision_exercise_is_not_reused_in_another_slot(self):
        state = initial_state(user_profile=survey_to_user_profile(SURVEY_SCENARIOS[0]["survey"]))
        state.update({
            "previous_routine_draft": {
                "days": [{
                    "target": "BACK",
                    "exercises": [
                        {"exercise_id": 1001, "name": "데드리프트"},
                        {"exercise_id": 1002, "name": "바벨 로우"},
                        {"exercise_id": 1003, "name": "랫 풀다운"},
                    ],
                }],
            },
            "recommendation_params": {
                "split_targets": ["BACK"],
                "goal": "hypertrophy",
                "level": "intermediate",
                "available_equipment": ["machine", "barbell"],
                "exclude_exercises": [],
                "home_only": False,
                "session_min": 60,
                "spine": "low",
                "required_exercises": {},
            },
            "exercise_candidates": {
                "BACK": [
                    {"id": 1101, "name_kor": "시티드 로우 머신", "equipment": "machine", "spine_loading": "하"},
                    {"id": 1001, "name_kor": "데드리프트", "equipment": "barbell", "spine_loading": "상"},
                    {"id": 1102, "name_kor": "랫 풀다운", "equipment": "machine", "spine_loading": "하"},
                    {"id": 1103, "name_kor": "암 풀다운", "equipment": "machine", "spine_loading": "하"},
                    {"id": 1104, "name_kor": "클로즈 그립 케이블 랫 풀 다운", "equipment": "machine", "spine_loading": "하"},
                ],
            },
        })

        with patch("recommendation_service.agents.invoke_json", return_value={
            "split_type": "5-day",
            "days": [{
                "target": "BACK",
                "exercises": [
                    {"exercise_id": 1101, "name": "시티드 로우 머신"},
                    {"exercise_id": 1001, "name": "데드리프트"},
                    {"exercise_id": 1102, "name": "랫 풀다운"},
                ],
            }],
        }):
            result = routine_composition_agent(state)

        names = [
            exercise["name"]
            for day in result["routine_draft"]["days"]
            for exercise in day["exercises"]
        ]
        self.assertNotIn("데드리프트", names)
        self.assertIn("데드리프트", result["revision_excluded_exercises"])
        self.assertIn("데드리프트", result["recommendation_params"]["exclude_exercises"])

    def test_graph_search_uses_substitute_relations_for_revision_seeds(self):
        regular_rows = [
            {"id": 1, "name_kor": "체스트 프레스", "equipment": "machine", "cal_per_min": 5},
            {"id": 2, "name_kor": "펙덱 플라이", "equipment": "machine", "cal_per_min": 4},
            {"id": 3, "name_kor": "밴드 크로스오버", "equipment": "band", "cal_per_min": 3},
        ]
        substitute_row = {
            "id": 4,
            "name_kor": "대체 체스트 프레스",
            "equipment": "machine",
            "cal_per_min": 6,
            "relation_type": "SUBSTITUTE_FOR",
            "relation_source_id": 99,
        }

        with patch("recommendation_service.graph_tools.GraphQuery") as graph_query:
            graph = graph_query.return_value
            graph.get_exercises_by_ids.return_value = []
            graph.get_exercises_by_split.return_value = regular_rows
            graph.get_related_exercises.side_effect = lambda **kwargs: (
                [substitute_row]
                if kwargs["relationship_type"] == "SUBSTITUTE_FOR"
                else []
            )
            candidates, insufficient = search_exercises({
                "split_targets": ["CHEST"],
                "goal": "fat_loss",
                "level": "intermediate",
                "spine": "low",
                "available_equipment": ["machine", "band"],
                "candidate_limit_per_target": 4,
                "relationship_seed_ids_by_target": {"CHEST": [99]},
            })

        graph.get_related_exercises.assert_any_call(
            exercise_ids=[99],
            relationship_type="SUBSTITUTE_FOR",
            split_day="CHEST",
            spine="low",
            equip=["machine", "band"],
            level="intermediate",
            limit=64,
        )
        self.assertTrue(any(
            row.get("candidate_source") == "substitute_relation"
            for row in candidates["CHEST"]
        ))
        self.assertEqual(insufficient, [])

    def test_graph_candidate_limit_keeps_movement_families_balanced(self):
        rows = [
            {"id": 1, "name_kor": "벤치 프레스", "equipment": "machine", "cal_per_min": 6},
            {"id": 2, "name_kor": "펙덱 플라이", "equipment": "machine", "cal_per_min": 5},
            {"id": 3, "name_kor": "인클라인 프레스", "equipment": "machine", "cal_per_min": 4},
            {"id": 4, "name_kor": "덤벨 프레스", "equipment": "dumbbell", "cal_per_min": 3},
            {"id": 5, "name_kor": "케이블 플라이", "equipment": "machine", "cal_per_min": 2},
            {"id": 6, "name_kor": "덤벨 플라이", "equipment": "dumbbell", "cal_per_min": 1},
        ]

        with patch("recommendation_service.graph_tools.GraphQuery") as graph_query:
            graph = graph_query.return_value
            graph.get_exercises_by_ids.return_value = []
            graph.get_exercises_by_split.return_value = rows
            candidates, _ = search_exercises({
                "split_targets": ["CHEST"],
                "goal": "fat_loss",
                "level": "intermediate",
                "spine": "all",
                "available_equipment": ["machine", "dumbbell"],
                "candidate_limit_per_target": 4,
            })

        families = [movement_family(row) for row in candidates["CHEST"]]
        self.assertEqual(families.count("press"), 2)
        self.assertEqual(families.count("fly"), 2)

    def test_required_exercise_is_forced_into_routine(self):
        candidates = {
            "CHEST": [
                {
                    "id": 2001,
                    "name_kor": "벤치 프레스",
                    "equipment": "barbell",
                    "expert_policy_required": True,
                },
                {"id": 2, "name_kor": "머신 운동 1", "equipment": "machine"},
                {"id": 3, "name_kor": "머신 운동 2", "equipment": "machine"},
                {"id": 4, "name_kor": "머신 운동 3", "equipment": "machine"},
            ],
        }
        routine = _ensure_split_routine(
            {"days": [{"exercises": [{"name": "머신 운동 1"}]}]},
            candidates,
            {
                "split_targets": ["CHEST"],
                "goal": "strength",
                "session_min": 60,
            },
        )

        first = routine["days"][0]["exercises"][0]
        self.assertEqual(first["exercise_id"], 2001)
        self.assertTrue(first["expert_policy_required"])

    def test_llm_selected_duplicate_movement_is_replaced(self):
        candidates = {
            "BACK": [
                {
                    "id": 1001,
                    "name_kor": "데드리프트",
                    "equipment": "barbell",
                    "expert_policy_required": True,
                },
                {"id": 1002, "name_kor": "덤벨 데드리프트", "equipment": "dumbbell"},
                {"id": 1003, "name_kor": "시티드 로우", "equipment": "machine"},
                {"id": 1004, "name_kor": "암 풀다운", "equipment": "machine"},
                {"id": 1005, "name_kor": "백 익스텐션", "equipment": "machine"},
                {"id": 1006, "name_kor": "리버스 플라이", "equipment": "machine"},
            ],
        }
        routine = _ensure_split_routine(
            {
                "days": [{
                    "exercises": [
                        {"name": "덤벨 데드리프트"},
                        {"name": "시티드 로우"},
                    ],
                }],
            },
            candidates,
            {
                "split_targets": ["BACK"],
                "goal": "strength",
                "session_min": 60,
            },
        )

        names = [exercise["name"] for exercise in routine["days"][0]["exercises"]]
        self.assertIn("데드리프트", names)
        self.assertNotIn("덤벨 데드리프트", names)

    def test_routine_balances_two_available_movement_families(self):
        candidates = {
            "CHEST": [
                {"id": 1, "name_kor": "벤치 프레스", "equipment": "barbell"},
                {"id": 2, "name_kor": "펙덱 플라이", "equipment": "machine"},
                {"id": 3, "name_kor": "체스트 프레스 머신", "equipment": "machine"},
                {"id": 4, "name_kor": "덤벨 플라이", "equipment": "dumbbell"},
                {"id": 5, "name_kor": "인클라인 프레스", "equipment": "machine"},
                {"id": 6, "name_kor": "케이블 플라이", "equipment": "machine"},
            ],
        }
        routine = _ensure_split_routine(
            {"days": [{"target": "CHEST", "exercises": []}]},
            candidates,
            {
                "split_targets": ["CHEST"],
                "goal": "fat_loss",
                "session_min": 60,
            },
        )

        families = [
            movement_family(exercise["name"])
            for exercise in routine["days"][0]["exercises"]
        ]
        self.assertEqual(families.count("press"), 2)
        self.assertEqual(families.count("fly"), 2)

    def test_validation_rejects_avoidable_single_movement_family(self):
        candidates = {
            "CHEST": [
                {"id": 1, "name_kor": "벤치 프레스", "equipment": "machine", "movement_family": "press"},
                {"id": 2, "name_kor": "인클라인 프레스", "equipment": "machine", "movement_family": "press"},
                {"id": 3, "name_kor": "체스트 프레스", "equipment": "machine", "movement_family": "press"},
                {"id": 4, "name_kor": "펙덱 플라이", "equipment": "machine", "movement_family": "fly"},
                {"id": 5, "name_kor": "케이블 크로스오버", "equipment": "machine", "movement_family": "fly"},
                {"id": 6, "name_kor": "플랭크", "equipment": "machine", "movement_family": "core"},
            ],
        }
        state = {
            "user_profile": {},
            "recommendation_params": {
                "split_targets": ["CHEST"],
                "available_equipment": ["machine"],
                "spine": "all",
            },
            "exercise_candidates": candidates,
            "routine_draft": {
                "days": [{
                    "target": "CHEST",
                    "exercises": [
                        {"exercise_id": 1, "name": "벤치 프레스"},
                        {"exercise_id": 2, "name": "인클라인 프레스"},
                        {"exercise_id": 3, "name": "체스트 프레스"},
                    ],
                }],
            },
        }

        result = _apply_deterministic_validation(
            state,
            {"is_valid": True, "risk_level": "low", "issues": []},
        )

        self.assertFalse(result["is_valid"])
        self.assertIn(
            "insufficient_movement_diversity",
            {issue["type"] for issue in result["issues"]},
        )

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
                "required_exercises": {"BACK": {"id": 1001}},
            },
            "exercise_candidates": {"CHEST": [{"name_kor": "푸쉬업"}]},
            "routine_draft": {
                "days": [{
                    "target": "CHEST",
                    "exercises": [{"exercise_id": 2087, "name": "푸쉬업"}],
                }],
            },
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
        self.assertEqual(result["recommendation_params"]["required_exercises"], {})
        self.assertEqual(
            result["recommendation_params"]["relationship_seed_ids_by_target"],
            {"CHEST": [2087]},
        )
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
                "home_only": False,
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

    def test_validation_agent_receives_candidate_safety_metadata(self):
        state = initial_state(user_profile={
            "age": 30,
            "injuries": [],
            "pain_points": [],
        })
        state.update({
            "recommendation_params": {
                "split_targets": ["CHEST"],
                "available_equipment": ["machine"],
                "spine": "all",
            },
            "exercise_candidates": {
                "CHEST": [
                    {
                        "id": index,
                        "name_kor": f"운동{index}",
                        "equipment": "machine",
                        "difficulty_label": "intermediate",
                        "spine_loading": "하",
                    }
                    for index in range(1, 4)
                ],
            },
            "routine_draft": {
                "days": [{
                    "target": "CHEST",
                    "exercises": [
                        {"name": f"운동{index}", "exercise_id": index}
                        for index in range(1, 4)
                    ],
                }],
            },
        })

        with patch("recommendation_service.agents.invoke_json", return_value={
            "is_valid": True,
            "risk_level": "low",
            "issues": [],
            "revision_instructions": [],
        }) as invoke_json:
            result = routine_validation_agent(state)

        payload = invoke_json.call_args.args[1]
        self.assertIn('"difficulty_label": "intermediate"', payload)
        self.assertIn('"spine_loading": "하"', payload)
        self.assertTrue(result["validation_result"]["is_valid"])

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

if __name__ == "__main__":
    unittest.main()
