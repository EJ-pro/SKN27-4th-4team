from typing import Literal

from langgraph.graph import END, START, StateGraph

from .agents import (
    final_human_review_node,
    final_response_generator,
    graph_search_tool,
    profile_clarification_agent,
    recommendation_param_agent,
    routine_composition_agent,
    routine_revision_agent,
    routine_validation_agent,
    supervisor_agent,
    user_profile_tool,
)
from .state import RecommendationState


ROUTE_MAP = {
    "CALL_USER_PROFILE_TOOL": "user_profile_tool",
    "REQUEST_REQUIRED_INFO": "profile_clarification_agent",
    "CALL_RECOMMENDATION_PARAM_AGENT": "recommendation_param_agent",
    "CALL_GRAPH_SEARCH_TOOL": "graph_search_tool",
    "CALL_COMPOSITION_AGENT": "routine_composition_agent",
    "CALL_VALIDATION_AGENT": "routine_validation_agent",
    "REQUEST_FINAL_HUMAN_REVIEW": "final_human_review_node",
    "CALL_REVISION_AGENT": "routine_revision_agent",
    "CALL_FINAL_RESPONSE_GENERATOR": "final_response_generator",
    "END": END,
}


def route_from_supervisor(state: RecommendationState) -> Literal[
    "user_profile_tool",
    "profile_clarification_agent",
    "recommendation_param_agent",
    "graph_search_tool",
    "routine_composition_agent",
    "routine_validation_agent",
    "final_human_review_node",
    "routine_revision_agent",
    "final_response_generator",
    "__end__",
]:
    return ROUTE_MAP.get(state.get("next_action", "END"), END)


def build_recommendation_graph(checkpointer=None):
    workflow = StateGraph(RecommendationState)
    workflow.add_node("supervisor", supervisor_agent)
    workflow.add_node("user_profile_tool", user_profile_tool)
    workflow.add_node("profile_clarification_agent", profile_clarification_agent)
    workflow.add_node("recommendation_param_agent", recommendation_param_agent)
    workflow.add_node("graph_search_tool", graph_search_tool)
    workflow.add_node("routine_composition_agent", routine_composition_agent)
    workflow.add_node("routine_validation_agent", routine_validation_agent)
    workflow.add_node("final_human_review_node", final_human_review_node)
    workflow.add_node("routine_revision_agent", routine_revision_agent)
    workflow.add_node("final_response_generator", final_response_generator)

    workflow.add_edge(START, "supervisor")
    workflow.add_conditional_edges("supervisor", route_from_supervisor)

    for node in [
        "user_profile_tool",
        "profile_clarification_agent",
        "recommendation_param_agent",
        "graph_search_tool",
        "routine_composition_agent",
        "routine_validation_agent",
        "final_human_review_node",
        "routine_revision_agent",
    ]:
        workflow.add_edge(node, "supervisor")
    workflow.add_edge("final_response_generator", END)
    return workflow.compile(checkpointer=checkpointer)
