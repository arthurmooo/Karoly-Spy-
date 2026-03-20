import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Activity } from "@/types/activity";

interface Props {
  activity: Activity;
  isCoach: boolean;
  isSaving: boolean;
  saveError: string | null;
  onSaveFeedback: (rating: number | null, text: string) => void;
}

const RATING_LABELS: Record<number, string> = {
  1: "Tres difficile",
  2: "Difficile",
  3: "Neutre",
  4: "Bien",
  5: "Excellent",
};

const RATING_COLORS: Record<number, string> = {
  1: "bg-red-500 text-white",
  2: "bg-orange-400 text-white",
  3: "bg-slate-400 text-white",
  4: "bg-emerald-500 text-white",
  5: "bg-emerald-600 text-white",
};

export function AthleteFeedbackPanel({
  activity,
  isCoach,
  isSaving,
  saveError,
  onSaveFeedback,
}: Props) {
  const [selectedRating, setSelectedRating] = useState<number | null>(
    activity.athlete_feedback_rating ?? null
  );
  const [feedbackText, setFeedbackText] = useState(
    activity.athlete_feedback_text ?? ""
  );

  useEffect(() => {
    setSelectedRating(activity.athlete_feedback_rating ?? null);
    setFeedbackText(activity.athlete_feedback_text ?? "");
  }, [activity.athlete_feedback_rating, activity.athlete_feedback_text]);

  const isDirty =
    selectedRating !== (activity.athlete_feedback_rating ?? null) ||
    feedbackText !== (activity.athlete_feedback_text ?? "");

  // Coach: read-only view
  if (isCoach) {
    const rating = activity.athlete_feedback_rating;
    const text = activity.athlete_feedback_text?.trim();

    if (rating == null && !text) return null;

    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Icon name="thumb_up" className="text-slate-400" />
            Ressenti Athlete
          </h2>
          {rating != null && (
            <div className="flex items-center gap-3">
              <Badge className={RATING_COLORS[rating]}>
                {rating}/5
              </Badge>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {RATING_LABELS[rating]}
              </span>
            </div>
          )}
          {text && (
            <div className="rounded-sm border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-sm text-slate-600 dark:text-slate-400">{text}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Athlete: editable form
  return (
    <Card data-testid="athlete-feedback-panel">
      <CardContent className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Icon name="thumb_up" className="text-slate-400" />
          Mon ressenti
        </h2>

        <div>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Comment avez-vous vecu cette seance ?
          </p>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                disabled={isSaving}
                onClick={() =>
                  setSelectedRating(selectedRating === value ? null : value)
                }
                aria-pressed={selectedRating === value}
                data-testid={`athlete-feedback-rating-${value}`}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-3 text-sm font-semibold transition-colors ${
                  selectedRating === value
                    ? "border-primary bg-primary text-white"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-primary/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                <span className="text-lg">{value}</span>
                <span className="text-[10px] font-medium leading-tight">
                  {RATING_LABELS[value]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Commentaire (optionnel)
          </p>
          <textarea
            className="h-24 w-full resize-none rounded-sm border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            placeholder="Decrivez votre ressenti..."
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            disabled={isSaving}
            aria-label="Commentaire athlète"
            data-testid="athlete-feedback-text"
          />
        </div>

        <Button
          className="w-full"
          disabled={!isDirty || isSaving}
          onClick={() => onSaveFeedback(selectedRating, feedbackText)}
          data-testid="athlete-feedback-save"
        >
          {isSaving ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Icon name="send" />
          )}
          {isSaving ? "Envoi..." : "Envoyer"}
        </Button>

        {saveError && (
          <p className="text-xs font-medium text-red-600 dark:text-red-400">
            {saveError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
