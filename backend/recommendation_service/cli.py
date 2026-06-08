import argparse
import json
from uuid import uuid4

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from .state import initial_state
from .survey_scenarios import SURVEY_SCENARIOS, survey_to_user_profile
from .config import settings
from .workflow import build_recommendation_graph


def main() -> int:
    parser = argparse.ArgumentParser(description="Run LangGraph routine recommendation.")
    parser.add_argument("message", nargs="?", default="", help="Optional run label. Natural-language profile extraction is disabled.")
    parser.add_argument("--user-id", default=None)
    parser.add_argument("--profile-json", default=None, help="Structured frontend survey/user_profile JSON.")
    parser.add_argument("--scenario", default=None, help="Run a bundled survey scenario by index or id.")
    parser.add_argument("--list-scenarios", action="store_true", help="Print bundled survey scenarios and exit.")
    parser.add_argument("--recursion-limit", type=int, default=None, help="LangGraph recursion limit.")
    parser.add_argument("--json", action="store_true", help="Print final state as JSON.")
    parser.add_argument("--debug", action="store_true", help="Print routing diagnostics with the final output.")
    parser.add_argument("--auto-approve", action="store_true", help="Approve final human review automatically.")
    args = parser.parse_args()

    if args.list_scenarios:
        for idx, scenario in enumerate(SURVEY_SCENARIOS):
            print(f"{idx}: {scenario['id']} - {scenario.get('description', '')}")
        return 0

    graph = build_recommendation_graph(checkpointer=InMemorySaver())
    config = {
        "recursion_limit": args.recursion_limit or _default_recursion_limit(),
        "configurable": {"thread_id": args.user_id or str(uuid4())},
    }

    user_profile = _load_user_profile(args.profile_json, args.scenario)
    result = graph.invoke(initial_state(user_id=args.user_id, user_profile=user_profile), config)
    while "__interrupt__" in result:
        payload = result["__interrupt__"][0].value
        if args.json:
            print(json.dumps({"interrupt": payload}, ensure_ascii=False, indent=2))
        else:
            _print_review_payload(payload)

        review = _auto_review() if args.auto_approve else _prompt_review()
        result = graph.invoke(Command(resume=review), config)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(result.get("final_response") or json.dumps(result, ensure_ascii=False, indent=2))
        if args.debug:
            _print_debug(result)
    return 0


def _load_user_profile(profile_json: str | None, scenario_arg: str | None) -> dict | None:
    if profile_json and scenario_arg:
        raise ValueError("Use only one of --profile-json or --scenario.")
    if profile_json:
        return json.loads(profile_json)
    if scenario_arg is None:
        return None

    scenario = _find_scenario(scenario_arg)
    return survey_to_user_profile(scenario["survey"])


def _find_scenario(scenario_arg: str) -> dict:
    if scenario_arg.isdigit():
        idx = int(scenario_arg)
        try:
            return SURVEY_SCENARIOS[idx]
        except IndexError as exc:
            raise ValueError(f"Unknown scenario index: {scenario_arg}") from exc

    for scenario in SURVEY_SCENARIOS:
        if scenario["id"] == scenario_arg:
            return scenario
    raise ValueError(f"Unknown scenario id: {scenario_arg}")


def _default_recursion_limit() -> int:
    # LangGraph counts every node execution, not only supervisor decisions.
    # Keep this comfortably above MAX_SUPERVISOR_STEPS so our own loop guard
    # gets the chance to end or route to final review first.
    return max(80, settings.max_supervisor_steps * 3 + 10)


def _auto_review() -> dict[str, str]:
    return {"decision": "approve", "feedback": "CLI auto approval."}


def _prompt_review() -> dict[str, str]:
    raw = input("Type approve to accept, revise to request changes, or enter feedback directly: ").strip()
    decision = raw.lower()
    if decision in {"approve", "accept"}:
        return {"decision": "approve", "feedback": ""}
    if decision == "revise":
        return {"decision": "revise", "feedback": input("Revision feedback: ").strip()}
    return {"decision": "revise", "feedback": raw}


def _print_review_payload(payload: dict) -> None:
    print("\n[Final human review required]")
    print(payload.get("message", "Please review the recommended routine."))
    routine = payload.get("routine_draft", {})
    for day in routine.get("days", []):
        target = day.get("target", "")
        names = ", ".join(_format_exercise(ex) for ex in day.get("exercises", []))
        print(f"- {day.get('day', '')} {target}: {names}")
    validation = payload.get("validation_result")
    if validation:
        print(f"validation: valid={validation.get('is_valid')} risk={validation.get('risk_level')}")
        if validation.get("reason"):
            print(f"reason: {validation.get('reason')}")
        for warning in validation.get("safety_warnings", []):
            print(f"warning: {warning}")
    print()


def _format_exercise(exercise: dict) -> str:
    name = exercise.get("name", "")
    sets = exercise.get("sets")
    reps = exercise.get("reps")
    rest = exercise.get("rest_seconds")
    if sets and reps and rest:
        return f"{name}({sets}세트 {reps}회 {rest}초)"
    return name


def _print_debug(state: dict) -> None:
    print("\n[debug]")
    print(f"next_action: {state.get('next_action')}")
    print(f"supervisor_step_count: {state.get('supervisor_step_count')}")
    print(f"max_supervisor_steps: {state.get('max_supervisor_steps')}")
    print(f"last_actions: {state.get('action_history', [])[-20:]}")
    validation = state.get("validation_result")
    if validation:
        print(f"validation.is_valid: {validation.get('is_valid')}")
        print(f"validation.risk_level: {validation.get('risk_level')}")
        print(f"validation.issues: {validation.get('issues')}")
        print(f"validation.revision_instructions: {validation.get('revision_instructions')}")
    print(f"human_review_result: {state.get('human_review_result')}")
    print(f"errors: {state.get('errors')}")


if __name__ == "__main__":
    raise SystemExit(main())
