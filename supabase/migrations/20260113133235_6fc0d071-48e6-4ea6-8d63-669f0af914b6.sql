-- Fix video_path to start with lowercase letter
UPDATE exercises 
SET video_path = LOWER(LEFT(video_path, 1)) || SUBSTRING(video_path FROM 2)
WHERE video_path IS NOT NULL 
  AND video_path != ''
  AND LEFT(video_path, 1) ~ '[A-Z]';