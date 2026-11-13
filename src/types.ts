export type SectionPurpose = "Align" | "Decide" | "Review" | "Brainstorm" | "Update";

export type ActionPriority = "High" | "Medium" | "Low";

export interface ActionItem {
  id: string;
  task: string;
  owner: string;
  priority: ActionPriority;
  dueContext: string;
  completed: boolean;
}

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  responsibility: string;
}

export interface AgendaSection {
  id: string;
  title: string;
  durationMinutes: number;
  purpose: SectionPurpose;
  summary: string;
  keyPoints: string[];
  leadStakeholder: string;
  participants: string[];
  actionItems: ActionItem[];
}

export interface MeetingAgenda {
  id: string;
  createdAt: string;
  sourceFileName: string;
  sourceFileType: string;
  sourceCharCount: number;
  targetDurationMinutes: number;
  startTime: string;
  meetingTitle: string;
  meetingObjective: string;
  documentSummary: string;
  stakeholders: Stakeholder[];
  sections: AgendaSection[];
}

export interface SampleDocument {
  id: string;
  title: string;
  fileName: string;
  suggestedMinutes: number;
  description: string;
  content: string;
}
