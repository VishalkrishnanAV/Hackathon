from typing import Literal

from pydantic import BaseModel, Field, model_validator


AgentName = Literal["technical", "hr_culture", "hiring_manager", "skeptic"]
Recommendation = Literal["strong_hire", "hire", "mixed", "no_hire", "insufficient_information"]


class Evidence(BaseModel):
    id: str
    document: Literal["job_description", "resume", "transcript"]
    page: int
    quote: str


class CandidateProfile(BaseModel):
    candidate_name: str
    summary: str
    skills: list[str]
    experience: list[str]
    claims: list[str]
    contradictions: list[str]
    missing_information: list[str]
    evidence_ids: list[str]


class AgentOpinion(BaseModel):
    agent: AgentName
    recommendation: Recommendation
    confidence: float = Field(ge=0, le=1)
    headline: str
    strengths: list[str]
    concerns: list[str]
    evidence_ids: list[str]
    missing_information: list[str]


class DebateExchange(BaseModel):
    speaker: AgentName
    responding_to_agent: AgentName
    response: str
    evidence_ids: list[str]
    previous_recommendation: Recommendation
    revised_recommendation: Recommendation
    previous_confidence: float = Field(ge=0, le=1)
    revised_confidence: float = Field(ge=0, le=1)
    changed: bool
    change_reason: str


class DebateResult(BaseModel):
    exchanges: list[DebateExchange] = Field(min_length=2)
    unresolved_disagreements: list[str]

    @model_validator(mode="after")
    def require_visible_opinion_change(self):
        if not any(exchange.changed for exchange in self.exchanges):
            raise ValueError("Debate must include at least one evidence-driven opinion change")
        return self


class FinalDecision(BaseModel):
    recommendation: Recommendation
    confidence: float = Field(ge=0, le=1)
    rationale: str
    strengths: list[str]
    concerns: list[str]
    unresolved_disagreements: list[str]
    evidence_ids: list[str]


class EvaluationResult(BaseModel):
    id: str
    status: Literal["queued", "running", "completed", "failed"]
    stage: str
    evidence: list[Evidence] = Field(default_factory=list)
    profile: CandidateProfile | None = None
    opinions: dict[str, AgentOpinion] = Field(default_factory=dict)
    debate: DebateResult | None = None
    decision: FinalDecision | None = None
    error: str | None = None
