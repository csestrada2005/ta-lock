export type Mode = "Notes Creator" | "Quiz" | "Study" | "Pre-Read";

export type ExpertiseLevel = "Novice" | "Intermediate" | "Expert" | null;

export interface Message {
  id?: string; // Database ID for feedback tracking
  role: "user" | "assistant";
  content: string;
}

export interface Lecture {
  id: string;
  title: string;
  class_name?: string;
}

// Persona / course definition in personas.json
export interface CoursePersona {
  display_name: string;
  system_prompt: string;
  initial_message: string;
  professor_name?: string;
}

// Mode definition in personas.json
export interface ModePersona {
  system_prompt: string;
  initial_message: string;
}

export interface PersonasData {
  modes: Record<string, ModePersona>;
  [cohort: string]: Record<string, CoursePersona> | Record<string, ModePersona>;
}

// Diagnostic Quiz types
export interface DiagnosticQuestion {
  q_id?: string;
  id?: string;
  question?: string;
  text?: string;
  options: { A: string; B: string; C: string; D: string; IDK?: string } | Array<{ id: string; text: string } | string>;
  correct_id?: string;
}

export interface DiagnosticQuizData {
  topic_slug: string;
  title?: string;
  questions: DiagnosticQuestion[];
}

export interface DiagnosticSubmission {
  topic_slug: string;
  answers: Array<{
    q_id: string;
    selected: "A" | "B" | "C" | "D" | "IDK";
    correct_id?: string;
  }>;
}

// System Event types
export interface SystemEvent {
  type: "persona_shift" | string;
  persona?: string;
  message?: string;
}

// Header tab type
export type HeaderTab = "chat";

// Socratic State types
export interface SocraticState {
  hints_given: number;
  max_hints: number;
  resolved: boolean;
  resolution_type: string | null;
  student_attempts: Array<{ attempt: string; correct: boolean }>;
}
