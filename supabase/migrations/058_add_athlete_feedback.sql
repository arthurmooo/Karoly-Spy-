-- US-19: Athlete feedback (rating 1-5 + free text)
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS athlete_feedback_rating SMALLINT CHECK (athlete_feedback_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS athlete_feedback_text TEXT;
