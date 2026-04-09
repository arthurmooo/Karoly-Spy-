import { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import type { SectionCommentKey } from "@/types/activity";

interface Props {
  sectionKey: SectionCommentKey;
  comment: string | undefined;
  isCoach: boolean;
  onSave: (sectionKey: string, comment: string) => Promise<void>;
}

export function SectionCoachComment({ sectionKey, comment, isCoach, onSave }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(comment ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft when comment changes externally (e.g. optimistic revert)
  useEffect(() => {
    if (!isEditing) {
      setDraft(comment ?? "");
    }
  }, [comment, isEditing]);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(sectionKey, draft);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(comment ?? "");
    setIsEditing(false);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  const hasComment = Boolean(comment?.trim());

  // ── Athlete view ──────────────────────────────────────
  if (!isCoach) {
    if (!hasComment) return null;
    return (
      <div className="mt-3 flex gap-2.5 rounded-lg border-l-[3px] border-blue-500 bg-blue-50/60 py-2.5 pr-3 pl-3.5 dark:border-blue-400 dark:bg-blue-950/30">
        <Icon
          name="sports"
          className="mt-0.5 shrink-0 text-[16px] text-blue-500 dark:text-blue-400"
        />
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-500/70 dark:text-blue-400/70">
            Commentaire coach
          </p>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
            {comment}
          </p>
        </div>
      </div>
    );
  }

  // ── Coach: editing mode ───────────────────────────────
  if (isEditing) {
    return (
      <div className="mt-3 rounded-lg border-l-[3px] border-blue-500 bg-blue-50/40 p-3 dark:border-blue-400 dark:bg-blue-950/20">
        <textarea
          ref={textareaRef}
          className="h-20 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500"
          placeholder="Votre commentaire pour cette section..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || draft.trim() === (comment ?? "").trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:bg-blue-500 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {isSaving ? (
              <div className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-white border-t-transparent" />
            ) : (
              <Icon name="check" className="text-[14px]" />
            )}
            {isSaving ? "Envoi..." : "Enregistrer"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-all duration-150 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            Annuler
          </button>
          {error && (
            <p className="ml-auto text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </div>
        <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
          <kbd className="rounded border border-slate-200 px-1 py-0.5 text-[9px] dark:border-slate-700">
            {navigator.platform?.includes("Mac") ? "Cmd" : "Ctrl"}+Enter
          </kbd>{" "}
          pour enregistrer &middot;{" "}
          <kbd className="rounded border border-slate-200 px-1 py-0.5 text-[9px] dark:border-slate-700">
            Esc
          </kbd>{" "}
          pour annuler
        </p>
      </div>
    );
  }

  // ── Coach: display mode (has comment) ─────────────────
  if (hasComment) {
    return (
      <div className="group/comment mt-3 flex gap-2.5 rounded-lg border-l-[3px] border-blue-500 bg-blue-50/40 py-2.5 pr-3 pl-3.5 dark:border-blue-400 dark:bg-blue-950/20">
        <Icon
          name="comment"
          className="mt-0.5 shrink-0 text-[16px] text-blue-500/60 dark:text-blue-400/60"
        />
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700 dark:text-slate-300">
            {comment}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="shrink-0 self-start rounded-md p-1 text-slate-400 opacity-0 transition-all duration-150 hover:bg-slate-100 hover:text-blue-600 group-hover/comment:opacity-100 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-blue-400"
          aria-label="Modifier le commentaire"
        >
          <Icon name="edit" className="text-[16px]" />
        </button>
      </div>
    );
  }

  // ── Coach: no comment yet ─────────────────────────────
  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-400 transition-all duration-150 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-950/30 dark:hover:text-blue-400"
    >
      <Icon name="add_comment" className="text-[15px]" />
      Ajouter un commentaire
    </button>
  );
}
