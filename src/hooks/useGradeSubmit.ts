import { useTaLock } from "@/contexts/TaLockContext";
import { apiFetch } from "@/lib/auth";

export interface GradePayload {
  scoreGiven: number;
  scoreMaximum: number;
}

export function useGradeSubmit() {
  const { agsLineitem } = useTaLock();

  const submitGrade = async (payload: GradePayload): Promise<void> => {
    if (!agsLineitem) {
      console.warn("useGradeSubmit: no agsLineitem in context, grade not submitted.");
      return;
    }
    const response = await apiFetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lti-ags-submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error ?? "Grade submission failed");
    }
  };

  return { submitGrade, hasGrading: !!agsLineitem };
}
