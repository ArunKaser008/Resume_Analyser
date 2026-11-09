import type { ResumeTemplate } from '../../api/types'

export type ResumeTemplateCategory = 'simple' | 'modern' | 'creative'

export interface ResumeTemplateOption {
  id: ResumeTemplate
  name: string
  category: ResumeTemplateCategory
  description: string
}

export const resumeTemplates: ResumeTemplateOption[] = [
  { id: 'classic-clear', name: 'Classic Clear', category: 'simple', description: 'A crisp, traditional layout with a focus on readability.' },
  { id: 'atlantic-blue', name: 'Atlantic Blue', category: 'modern', description: 'A confident two-column design for experienced professionals.' },
  { id: 'mercury-flow', name: 'Mercury Flow', category: 'creative', description: 'A light, contemporary layout with room for a personal touch.' },
  { id: 'modern', name: 'Modern', category: 'modern', description: 'A balanced, contemporary resume with clean color accents.' },
  { id: 'professional', name: 'Professional', category: 'simple', description: 'A polished, traditional layout for any career stage.' },
  { id: 'minimal', name: 'Minimal', category: 'simple', description: 'An uncluttered, compact design that keeps attention on your experience.' },
  { id: 'executive', name: 'Executive', category: 'simple', description: 'A confident, spacious design for leadership and senior roles.' },
  { id: 'elegant', name: 'Elegant', category: 'creative', description: 'Refined serif details paired with a graceful, editorial layout.' },
  { id: 'charcoal', name: 'Charcoal', category: 'modern', description: 'A high-contrast professional design with a distinctive side rail.' },
  { id: 'coral', name: 'Coral', category: 'creative', description: 'A warm, energetic design with a bright accent and clear structure.' },
  { id: 'emerald', name: 'Emerald', category: 'modern', description: 'A fresh, modern layout with subtle green details.' },
  { id: 'indigo', name: 'Indigo', category: 'creative', description: 'A creative, contemporary design with bold indigo accents.' },
]

export const getTemplateName = (id: ResumeTemplate): string =>
  resumeTemplates.find((template) => template.id === id)?.name || id
