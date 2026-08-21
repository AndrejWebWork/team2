-- Лидерборд: поените се собираат до 1 јануари 2027 (Europe/Skopje),
-- потоа се ресетираат и продолжуваат годишно (секој 1 јануари).
CREATE OR REPLACE VIEW leaderboard_monthly AS
SELECT
  u.id            AS user_id,
  u.display_name,
  u.email,
  COALESCE(SUM(pe.points), 0) AS points
FROM users u
LEFT JOIN points_events pe
  ON pe.user_id = u.id
  AND pe.created_at >= (
    CASE
      WHEN (now() AT TIME ZONE 'Europe/Skopje') < TIMESTAMP '2027-01-01'
        THEN TIMESTAMPTZ '1970-01-01 00:00:00+00'
      ELSE (date_trunc('year', now() AT TIME ZONE 'Europe/Skopje') AT TIME ZONE 'Europe/Skopje')
    END
  )
  AND pe.created_at < (
    CASE
      WHEN (now() AT TIME ZONE 'Europe/Skopje') < TIMESTAMP '2027-01-01'
        THEN (TIMESTAMP '2027-01-01' AT TIME ZONE 'Europe/Skopje')
      ELSE ((date_trunc('year', now() AT TIME ZONE 'Europe/Skopje') + INTERVAL '1 year') AT TIME ZONE 'Europe/Skopje')
    END
  )
GROUP BY u.id, u.display_name, u.email
ORDER BY points DESC;
