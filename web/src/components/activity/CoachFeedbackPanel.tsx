import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Activity, ActivitySourceJson } from "@/types/activity";

interface Props {
  activity: Activity;
  isCoach: boolean;
  isSaving: boolean;
  saveError: string | null;
  nolioSynced: boolean | null;
  onSaveComment: (comment: string) => void;
}

function getFeedbackText(sourceJson: ActivitySourceJson | null | undefined): string {
  const text = sourceJson?.comment ?? sourceJson?.description ?? "";
  return text.trim();
}

function getFeelingLabel(feeling: number | null | undefined): string {
  if (feeling == null) return "Non renseigné";
  if (feeling >= 4) return "Bon ressenti";
  if (feeling === 3) return "Neutre";
  return "Ressenti à surveiller";
}

export function CoachFeedbackPanel({
  activity,
  isCoach,
  isSaving,
  saveError,
  nolioSynced,
  onSaveComment,
}: Props) {
  const [coachNote, setCoachNote] = useState(activity.coach_comment ?? "");
  const sourceJson = activity.source_json ?? null;
  const segmentedMetrics = activity.segmented_metrics ?? null;
  const rpe = activity.rpe ?? sourceJson?.rpe ?? null;
  const athleteFeedback = activity.athlete_comment?.trim() || getFeedbackText(sourceJson);
  const feeling = sourceJson?.feeling ?? null;
  const isDirty = coachNote !== (activity.coach_comment ?? "");

  useEffect(() => {
    if (activity.coach_comment != null) {
      setCoachNote(activity.coach_comment);
    }
  }, [activity.coach_comment]);

  return (
    <div className="space-y-6">
      {/* Athlete Feedback */}
      <Card data-testid="coach-athlete-feedback-panel">
        <CardContent className="space-y-4 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Icon name="person" className="text-slate-400" />
            Feedback Athlète
          </h2>
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Ressenti de l'effort (RPE)
            </p>
            {rpe != null ? (
              <div className="flex items-center gap-4">
                <span className="text-2xl font-semibold text-slate-900 dark:text-white">
                  {rpe}
                  <span className="ml-1 text-lg text-slate-400">/10</span>
                </span>
                <div className="flex flex-1 gap-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded-none ${
                        i < rpe ? "bg-accent-orange" : "bg-slate-200 dark:bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm italic text-slate-400">Non renseigné</p>
            )}
            {segmentedMetrics?.per_index != null && rpe != null && rpe >= 1 && (
              <div className="mt-2">
                <Badge
                  variant={
                    segmentedMetrics.per_index > 1.05
                      ? "orange"
                      : segmentedMetrics.per_index < 0.95
                        ? "emerald"
                        : "slate"
                  }
                >
                  {segmentedMetrics.per_index > 1.05
                    ? "RPE > intensité objective"
                    : segmentedMetrics.per_index < 0.95
                      ? "RPE < intensité objective"
                      : "RPE cohérent"}
                </Badge>
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Feeling Nolio</p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {getFeelingLabel(feeling)}
            </p>
          </div>

          {activity.athlete_feedback_rating != null && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Ressenti post-séance
              </p>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm font-semibold text-white ${
                    activity.athlete_feedback_rating >= 4
                      ? "bg-emerald-500"
                      : activity.athlete_feedback_rating === 3
                        ? "bg-slate-400"
                        : activity.athlete_feedback_rating === 2
                          ? "bg-orange-400"
                          : "bg-red-500"
                  }`}
                >
                  {activity.athlete_feedback_rating}/5
                </span>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {activity.athlete_feedback_rating === 5
                    ? "Excellent"
                    : activity.athlete_feedback_rating === 4
                      ? "Bien"
                      : activity.athlete_feedback_rating === 3
                        ? "Neutre"
                        : activity.athlete_feedback_rating === 2
                          ? "Difficile"
                          : "Très difficile"}
                </span>
              </div>
              {activity.athlete_feedback_text?.trim() && (
                <p className="mt-2 text-sm italic text-slate-600 dark:text-slate-400">
                  {activity.athlete_feedback_text}
                </p>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Commentaire remonté</p>
            <textarea
              readOnly
              className="h-28 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm italic text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
              value={athleteFeedback}
              placeholder="Aucun commentaire de l'athlète remonté depuis Nolio"
            />
          </div>
        </CardContent>
      </Card>

      {/* Coach Notes */}
      <Card data-testid="coach-feedback-panel">
        <CardContent className="space-y-4 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Icon name="comment" className="text-slate-400" />
            Notes du Coach
          </h2>
          {isCoach ? (
            <>
              <textarea
                className="h-24 w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                placeholder="Écrire un feedback à l'athlète..."
                value={coachNote}
                onChange={(e) => setCoachNote(e.target.value)}
                disabled={isSaving}
                aria-label="Commentaire coach"
                data-testid="coach-comment-input"
              />
              <Button
                className="w-full"
                disabled={!isDirty || isSaving}
                onClick={() => onSaveComment(coachNote)}
                data-testid="coach-comment-save"
              >
                {isSaving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Icon name="send" />
                )}
                {isSaving ? "Envoi..." : "Envoyer"}
              </Button>
              {saveError && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{saveError}</p>
              )}
              {nolioSynced === true && (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Note enregistrée</p>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {activity.coach_comment?.trim() || "Aucune note du coach pour le moment."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
