import { useState } from "react";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DiagnosticQuestion, DiagnosticQuizData, DiagnosticSubmission } from "./types";

interface DiagnosticQuizProps {
  quiz: DiagnosticQuizData;
  onSubmit: (payload: DiagnosticSubmission) => Promise<void>;
  onClose: () => void;
}

interface Answer {
  q_id: string;
  selected: string | null;
}

// Helper to normalize option format
const getOptionIdAndText = (opt: unknown, fallbackKey: string): { id: string; text: string } => {
  if (typeof opt === 'string') return { id: fallbackKey, text: opt };
  if (typeof opt === 'object' && opt !== null) {
    const o = opt as Record<string, unknown>;
    return {
      id: (typeof o.id === 'string' ? o.id : typeof o.key === 'string' ? o.key : null) ?? fallbackKey,
      text: typeof o.text === 'string' ? o.text : typeof o.label === 'string' ? o.label : typeof o.value === 'string' ? o.value : String(opt),
    };
  }
  return { id: fallbackKey, text: String(opt) };
};

// Helper to get options array from question
const getOptionsArray = (options: DiagnosticQuestion['options']): Array<{ id: string; text: string }> => {
  if (Array.isArray(options)) {
    return options.map((opt, idx) => getOptionIdAndText(opt, String.fromCharCode(65 + idx)));
  }
  if (typeof options === 'object' && options !== null) {
    return ['A', 'B', 'C', 'D', 'IDK']
      .filter(key => options[key] !== undefined)
      .map(key => ({ id: key, text: options[key] }));
  }
  return [];
};

export const DiagnosticQuiz = ({ quiz, onSubmit, onClose }: DiagnosticQuizProps) => {
  const [answers, setAnswers] = useState<Answer[]>(
    quiz.questions.map((q) => ({ q_id: q.q_id || q.id || String(q), selected: null }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const answeredCount = answers.filter((a) => a.selected !== null).length;
  const allAnswered = answeredCount === quiz.questions.length;

  const handleSelect = (questionIndex: number, optionId: string) => {
    setAnswers((prev) =>
      prev.map((a, i) => (i === questionIndex ? { ...a, selected: optionId } : a))
    );
  };

  const handleSubmit = async () => {
    if (!allAnswered) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        topic_slug: quiz.topic_slug,
        answers: answers.map((a, i) => ({
          q_id: a.q_id,
          selected: a.selected as "A" | "B" | "C" | "D" | "IDK",
          correct_id: quiz.questions[i].correct_id,
        })),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex gap-4 animate-fade-in max-w-full">
      {/* Avatar matching ProfessorMessage */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center shadow-lg shadow-primary/20">
        <Sparkles className="w-4 h-4 text-primary-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Title */}
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {quiz.title || "Knowledge Check"}
          </h3>
          {quiz.topic_slug && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {quiz.topic_slug.replace(/-/g, ' ')}
            </p>
          )}
        </div>

        {/* Questions */}
        {quiz.questions.map((question, qIdx) => {
          const optionsArray = getOptionsArray(question.options);
          const currentAnswer = answers[qIdx];

          return (
            <div key={qIdx} className="space-y-2.5">
              {/* Question text */}
              <p className="text-[15px] font-medium text-foreground leading-relaxed">
                {qIdx + 1}. {question.question || question.text || "Question"}
              </p>

              {/* Options as radio dots */}
              <div className="space-y-1.5 pl-5">
                {optionsArray.map((opt) => {
                  const isSelected = currentAnswer.selected === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelect(qIdx, opt.id)}
                      className={cn(
                        "flex items-center gap-3 w-full text-left py-1.5 px-2 rounded-lg transition-colors",
                        "hover:bg-secondary/50",
                        isSelected && "bg-primary/5"
                      )}
                    >
                      {/* Radio dot */}
                      <span
                        className={cn(
                          "flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                          isSelected
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/40"
                        )}
                      >
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                        )}
                      </span>
                      {/* Option text */}
                      <span className={cn(
                        "text-sm leading-relaxed",
                        isSelected ? "text-foreground font-medium" : "text-muted-foreground"
                      )}>
                        {opt.id}) {opt.text}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Separator between questions */}
              {qIdx < quiz.questions.length - 1 && (
                <div className="border-b border-border/30 mt-3" />
              )}
            </div>
          );
        })}

        {/* Footer: progress + submit */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            {answeredCount} of {quiz.questions.length} answered
          </span>
          <Button
            onClick={handleSubmit}
            disabled={!allAnswered || isSubmitting}
            size="sm"
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Submit Quiz
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
