export type ProfileType = 'student' | 'fresher' | 'experienced'
export type ResumeTemplate =
  | 'modern'
  | 'professional'
  | 'minimal'
  | 'classic-clear'
  | 'atlantic-blue'
  | 'mercury-flow'
  | 'executive'
  | 'elegant'
  | 'charcoal'
  | 'coral'
  | 'emerald'
  | 'indigo'
export type SectionType =
  | 'education'
  | 'work_experience'
  | 'technical_skill'
  | 'project'
  | 'certification'
  | 'achievement'
export type CustomResumeSectionType =
  | 'language'
  | 'volunteer'
  | 'publication'
  | 'course'
  | 'interest'
  | 'reference'
  | 'custom'

export interface CustomResumeEntry {
  title: string
  subtitle: string | null
  date: string | null
  location: string | null
  url: string | null
  description: string | null
}

export interface CustomResumeSection {
  id: string
  section_type: CustomResumeSectionType
  title: string
  entries: CustomResumeEntry[]
}

export interface ResumeDesignSettings {
  layout: 'single-column' | 'two-column'
  font_family: 'Arial' | 'Georgia' | 'Inter' | 'Tahoma'
  font_size: number
  spacing: 'compact' | 'comfortable' | 'spacious'
  accent_color: string
  page_size: 'A4' | 'Letter'
}

export const defaultResumeDesign: ResumeDesignSettings = {
  layout: 'single-column',
  font_family: 'Arial',
  font_size: 12,
  spacing: 'comfortable',
  accent_color: '#00A7A2',
  page_size: 'A4',
}

export interface CareerProfile {
  id: string
  profile_type: ProfileType
  full_name: string
  email: string | null
  phone: string | null
  city: string | null
  professional_title: string | null
  summary: string | null
  linkedin_url: string | null
  github_url: string | null
  portfolio_url: string | null
  created_at: string
  updated_at: string
}

export interface Resume {
  id: string
  career_profile_id: string
  parent_resume_id?: string | null
  title: string
  target_role: string | null
  template_name: ResumeTemplate
  is_primary: boolean
  source_filename?: string | null
  custom_sections: CustomResumeSection[]
  design_settings: ResumeDesignSettings
  section_order: SectionType[]
  created_at: string
  updated_at: string
}

export interface ResumeImportResponse {
  career_profile: CareerProfile
  resume: Resume
  extracted_character_count: number
}

export interface ParsedContactInfo {
  full_name: string | null
  email: string | null
  phone: string | null
  linkedin_url: string | null
  github_url: string | null
  portfolio_url: string | null
}

export interface ParsedEducation {
  degree: string | null
  institution: string | null
  graduation_year: number | null
  grade: string | null
}

export interface ParsedTechnicalSkills {
  languages: string[]
  frameworks: string[]
  cloud_devops: string[]
  databases: string[]
  tools: string[]
}

export interface ParsedExperience {
  company: string | null
  title: string | null
  start_date: string | null
  end_date: string | null
  bullet_points: string[]
}

export interface ParsedProject {
  title: string | null
  tech_stack: string[]
  bullet_points: string[]
  live_url: string | null
  code_url: string | null
}

export interface ParsedResumeData {
  contact_info: ParsedContactInfo
  education: ParsedEducation[]
  technical_skills: ParsedTechnicalSkills
  experience: ParsedExperience[]
  projects: ParsedProject[]
}

export interface ResumeParseResponse {
  parse_id: string
  filename: string
  parsed_data: ParsedResumeData
}

export type ProofStatus = 'Verified' | 'Unverified' | 'High Risk of Misrepresentation'

export interface ProofProjectClaim {
  title: string
  code_url: string | null
  bullet_points: string[]
}

export interface ProofOfWorkRequest {
  github_url: string | null
  leetcode_url: string | null
  projects: ProofProjectClaim[]
}

export interface ProofProjectResult {
  title: string
  status: ProofStatus
  repository_url: string | null
  repository_owner: string | null
  owner_matches_profile: boolean | null
  is_fork: boolean | null
  stars: number
  commits_last_12_months: number
  languages: string[]
  reasons: string[]
}

export interface ProofGitHubStats {
  profile_url: string | null
  username: string | null
  valid: boolean
  recent_commits: number
  stars: number
  top_languages: Record<string, number>
  monthly_activity: { month: string; commits: number }[]
  history_truncated: boolean
}

export interface ProofLeetCodeStats {
  profile_url: string | null
  username: string | null
  valid: boolean
  easy_solved: number
  medium_solved: number
  hard_solved: number
  contest_rating: number | null
  global_ranking: number | null
  contests_attended: number
}

export interface ProofOfWorkResponse {
  score: number
  status: ProofStatus
  github: ProofGitHubStats | null
  leetcode: ProofLeetCodeStats | null
  projects: ProofProjectResult[]
  summary: string
}

export type ResumeCreate = Pick<Resume, 'title'> & {
  career_profile_id?: string
  full_name?: string
  profile_type?: ProfileType
  target_role?: string
  template_name?: ResumeTemplate
  is_primary?: boolean
}
export type ResumeUpdate = Partial<
  Pick<Resume, 'title' | 'target_role' | 'template_name' | 'is_primary' | 'custom_sections' | 'design_settings' | 'section_order'>
>

export interface ResumeEntity {
  id: string
  career_profile_id: string
  created_at: string
  updated_at: string
  [key: string]: string | number | boolean | null
}

export interface Education extends ResumeEntity {
  institution_name: string
  degree: string
  field_of_study: string | null
  start_date: string | null
  end_date: string | null
  is_current: boolean
  grade: string | null
  description: string | null
}

export interface WorkExperience extends ResumeEntity {
  company_name: string
  job_title: string
  employment_type: string | null
  location: string | null
  start_date: string
  end_date: string | null
  is_current: boolean
  description: string | null
}

export interface TechnicalSkill extends ResumeEntity {
  skill_name: string
  category: string | null
  proficiency_level: string | null
  years_of_experience: number | null
}

export interface Project extends ResumeEntity {
  project_name: string
  role: string | null
  technologies: string | null
  description: string | null
  responsibilities: string | null
  achievements: string | null
  project_url: string | null
}

export interface Certification extends ResumeEntity {
  certification_name: string
  issuing_organization: string
  credential_id: string | null
  credential_url: string | null
  issue_date: string | null
  expiry_date: string | null
  does_not_expire: boolean
}

export interface Achievement extends ResumeEntity {
  title: string
  category: string | null
  issuing_organization: string | null
  achievement_date: string | null
  description: string | null
  credential_url: string | null
}

export type SectionRecord =
  | Education
  | WorkExperience
  | TechnicalSkill
  | Project
  | Certification
  | Achievement

export interface ResumeSectionItem {
  item_id: string
  display_order: number
}

export interface ResumeSection {
  section_type: SectionType
  items: ResumeSectionItem[]
}

export interface ResumeSections {
  resume_id: string
  sections: ResumeSection[]
}

export interface ScoreCategory {
  category: string
  weight: number
  score: number
  weighted_score: number
  details: string
}

export interface ResumeAnalysis {
  resume_id: string
  match_score: number
  score_label: string
  score_breakdown: ScoreCategory[]
  matched_keywords: string[]
  missing_keywords: string[]
  matched_skills: string[]
  missing_skills: string[]
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  summary: string
}

export type TargetATS = 'WORKDAY' | 'GREENHOUSE' | 'LEVER'

export interface ATSHardSkillMatch {
  skill: string
  status: 'matched' | 'partial' | 'missing'
  evidence: string[]
  rationale: string
}

export interface ATSFormattingFlag {
  line_number: number | null
  category: string
  severity: string
  message: string
}

export interface ATSJDAnalysis {
  resume_id: string
  target_ats: TargetATS
  overall_match_score: number
  score_breakdown: {
    hard_skills: number
    soft_skills: number
    experience_alignment: number
    formatting: number
  }
  hard_skill_matrix: ATSHardSkillMatch[]
  seniority_signals: {
    density_per_100_words: number
    signal_count: number
    signals: string[]
    summary: string
  }
  formatting_risk_score: number
  formatting_flags: ATSFormattingFlag[]
  raw_parser_output: string
  recruiter_view: string
  parser_warnings: string[]
}

export interface SkillMatch {
  skill_name: string
  category: string
  importance: 'mandatory' | 'preferred'
  status: 'matched' | 'partial' | 'missing'
  match_percentage: number
  evidence: string[]
}

export interface EvidenceMatch {
  requirement: string
  status: 'matched' | 'partial' | 'missing' | 'not_applicable'
  match_percentage: number | null
  evidence: string[]
}

export interface CandidateJDMatch {
  resume_id: string
  job_title: string | null
  target_role: string | null
  overall_match_score: number
  match_label: string
  mandatory_skill_match_percentage: number | null
  preferred_skill_match_percentage: number | null
  matched_skills: SkillMatch[]
  partially_matched_skills: SkillMatch[]
  missing_skills: SkillMatch[]
  experience_alignment: EvidenceMatch
  project_alignment: EvidenceMatch
  qualification_alignment: EvidenceMatch
  score_breakdown: ScoreCategory[]
  strengths: string[]
  improvement_opportunities: string[]
  summary: string
}

export interface OptimizationSuggestion {
  id: string
  session_id: string
  suggestion_type: string
  source_item_id: string | null
  target_field: string | null
  original_text: string | null
  suggested_text: string
  explanation: string | null
  status: string
  created_at: string
  updated_at: string | null
}

export interface OptimizationSession {
  id: string
  resume_id: string
  target_role: string | null
  job_description: string
  status: string
  created_at: string
  updated_at: string
  suggestions: OptimizationSuggestion[]
}

export interface ResumeOptimization {
  resume_id: string
  target_role: string | null
  optimized_summary: string
  experience_suggestions: {
    original_text: string
    suggested_text: string
    explanation: string
  }[]
  project_suggestions: {
    original_text: string
    suggested_text: string
    explanation: string
  }[]
  keywords_to_consider: string[]
  skill_gap_recommendations: string[]
  general_recommendations: string[]
  factuality_notes: string[]
}

export interface ResumeContentOverride {
  id: string
  resume_id: string
  suggestion_id: string | null
  section_type: string
  source_item_id: string | null
  field_name: string
  content: string
  is_draft: boolean
  created_at: string
  updated_at: string
}

export interface TailoringResult {
  resume_id: string
  job_title: string | null
  target_role: string | null
  match_analysis: CandidateJDMatch
  optimization_session: Omit<OptimizationSession, 'suggestions'>
  suggestions: OptimizationSuggestion[]
  suggestion_count: number
  message: string
}
