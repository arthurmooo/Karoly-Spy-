-- RPE=0 means "not yet filled by athlete", treat as NULL
UPDATE activities
SET rpe = NULL,
    missing_rpe_flag = TRUE
WHERE rpe = 0;
