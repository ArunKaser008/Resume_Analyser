export type HighlightFlag = 'ATS_RISK' | 'WEAK_PHRASING' | 'STRONG_METRIC'
export type TierType = 'MAANG_PRODUCT' | 'SERVICED_MNC' | 'SERIES_B_STARTUP'

export interface DashboardScoreBreakdown {
  hard_skills: number
  formatting: number
  proof_of_work: number
  leadership: number
}

export interface PriorityFix {
  id: string
  title: string
  description: string
  estimated_impact: string
  line_number: number
}

export interface AnnotatedSection {
  line_number: number
  text: string
  highlight: HighlightFlag | null
}

export interface DashboardResponse {
  analysis_id: string
  resume_id: string
  overall_score: number
  ats_grade: string
  target_role: string
  score_breakdown: DashboardScoreBreakdown
  top_priority_fixes: PriorityFix[]
  annotated_sections: AnnotatedSection[]
}

export interface TierCheck {
  name: string
  passed: boolean
  score: number
  detail: string
}

export interface TierSimulationRequest {
  resume_id: string
  tier_type: TierType
}

export interface TierSimulationResponse {
  resume_id: string
  tier_type: TierType
  overall_score: number
  score_breakdown: DashboardScoreBreakdown
  checks: TierCheck[]
}

export interface TechnicalProbe {
  question: string
  resume_claim: string
  evaluation_focus: string
}

export interface GapTrap {
  weak_area: string
  interviewer_question: string
  suggested_talking_points: string[]
}

export interface InterviewPrepResponse {
  resume_id: string
  technical_probes: TechnicalProbe[]
  gap_traps: GapTrap[]
}

export interface ResumePatch {
  operation: 'replace' | 'insert'
  section_id: string | null
  original_text: string
  suggested_text: string
  rationale: string
}

export interface CopilotChatResponse {
  resume_id: string
  message: string
  patches: ResumePatch[]
}
