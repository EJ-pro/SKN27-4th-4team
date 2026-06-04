import unittest
from unittest.mock import patch

from recommendation_service.agents import build_recommendation_params_from_profile, supervisor_agent, user_profile_tool
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


if __name__ == "__main__":
    unittest.main()
