-- Remove the duplicate POS_004 row, keeping the earlier created one.
WITH dup AS (
  SELECT id
  FROM public.presets
  WHERE sheet = 'PoseStrength' AND item_id = 'POS_004'
  ORDER BY created_at DESC
  LIMIT 1
)
DELETE FROM public.presets
WHERE id IN (SELECT id FROM dup);