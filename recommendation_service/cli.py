import argparse
import json
from uuid import uuid4

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from .state import initial_state
from .workflow import build_recommendation_graph


def main() -> int:
    parser = argparse.ArgumentParser(description="Run LangGraph routine recommendation.")
    parser.add_argument("message", help="User request text.")
    parser.add_argument("--user-id", default=None)
    parser.add_argument("--json", action="store_true", help="Print final state as JSON.")
    parser.add_argument("--auto-approve", action="store_true", help="Approve final human review automatically.")
    args = parser.parse_args()

    graph = build_recommendation_graph(checkpointer=InMemorySaver())
    config = {
        "recursion_limit": 40,
        "configurable": {"thread_id": args.user_id or str(uuid4())},
    }

    result = graph.invoke(initial_state(args.message, user_id=args.user_id), config)
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
    return 0


def _auto_review() -> dict[str, str]:
    return {"decision": "approve", "feedback": "CLI auto approval."}


def _prompt_review() -> dict[str, str]:
    decision = input("Type approve to accept, or revise to request changes: ").strip().lower()
    if decision not in {"approve", "revise"}:
        decision = "revise"
    feedback = ""
    if decision == "revise":
        feedback = input("Revision feedback: ").strip()
    return {"decision": decision, "feedback": feedback}


def _print_review_payload(payload: dict) -> None:
    print("\n[Final human review required]")
    print(payload.get("message", "Please review the recommended routine."))
    routine = payload.get("routine_draft", {})
    for day in routine.get("days", []):
        target = day.get("target", "")
        names = ", ".join(ex.get("name", "") for ex in day.get("exercises", []))
        print(f"- {day.get('day', '')} {target}: {names}")
    validation = payload.get("validation_result")
    if validation:
        print(f"validation: valid={validation.get('is_valid')} risk={validation.get('risk_level')}")
    print()


if __name__ == "__main__":
    raise SystemExit(main())
