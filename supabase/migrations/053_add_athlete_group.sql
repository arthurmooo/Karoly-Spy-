-- Add athlete_group column to athletes table
ALTER TABLE athletes
ADD COLUMN athlete_group TEXT CHECK (athlete_group IN ('elite', 'preparation', 'loisir'));

-- Allow coaches to update their own athletes
CREATE POLICY "coach_update_own_athletes"
ON athletes
FOR UPDATE
TO authenticated
USING (coach_id = auth.uid())
WITH CHECK (coach_id = auth.uid());
