-- 071: Notification system for athlete space
-- When coach posts a comment (full activity or section), athlete receives a clickable notification.

CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id  UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('coach_comment', 'section_comment')),
  section_key TEXT,          -- NULL for coach_comment; one of the 8 section keys for section_comment
  message     TEXT NOT NULL, -- pre-rendered FR string e.g. "Nouveau commentaire sur votre séance du 9 avril"
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast unread count query (partial index, only unread rows)
CREATE INDEX idx_notifications_athlete_unread
  ON notifications(athlete_id)
  WHERE NOT is_read;

-- Sorted list query
CREATE INDEX idx_notifications_athlete_created
  ON notifications(athlete_id, created_at DESC);

-- RLS: reuses get_my_athlete_id() from migration 054
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Athletes can read their own notifications
CREATE POLICY athlete_read_own ON notifications
  FOR SELECT TO authenticated
  USING (athlete_id = public.get_my_athlete_id());

-- Athletes can mark their own notifications as read
CREATE POLICY athlete_update_own ON notifications
  FOR UPDATE TO authenticated
  USING (athlete_id = public.get_my_athlete_id())
  WITH CHECK (athlete_id = public.get_my_athlete_id());

-- Coaches can read notifications for their athletes (for potential coach-side display)
CREATE POLICY coach_read ON notifications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM athletes a
      WHERE a.id = notifications.athlete_id
        AND a.coach_id = auth.uid()
    )
  );

-- INSERT is done by Edge Functions with service role key (bypasses RLS) — no client INSERT policy needed
