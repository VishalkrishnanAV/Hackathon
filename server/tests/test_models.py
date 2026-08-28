from pydantic import ValidationError

from app.models import DebateExchange, DebateResult


def exchange(changed: bool) -> DebateExchange:
    return DebateExchange(
        speaker="technical",
        responding_to_agent="skeptic",
        response="Evidence-based response",
        evidence_ids=["TR-001"],
        previous_recommendation="mixed",
        revised_recommendation="hire" if changed else "mixed",
        previous_confidence=0.5,
        revised_confidence=0.7 if changed else 0.5,
        changed=changed,
        change_reason="New evidence changed the assessment" if changed else "No change",
    )


def test_debate_requires_two_exchanges():
    try:
        DebateResult(exchanges=[exchange(True)], unresolved_disagreements=[])
        assert False, "Expected minimum exchange validation"
    except ValidationError:
        pass


def test_debate_requires_visible_opinion_change():
    try:
        DebateResult(exchanges=[exchange(False), exchange(False)], unresolved_disagreements=[])
        assert False, "Expected opinion change validation"
    except ValidationError as exc:
        assert "opinion change" in str(exc)


def test_valid_debate_is_accepted():
    result = DebateResult(exchanges=[exchange(True), exchange(False)], unresolved_disagreements=[])
    assert any(item.changed for item in result.exchanges)
