-- ROLLBACK: put the previous graphic back as the editorial #1 hero in PRODUCTION: only articles.image_url changes.
-- Aborts unchanged unless exactly one published article with this slug points at the photo.
BEGIN;
DO $guard$
BEGIN
  IF (SELECT count(*) FROM public.insights i JOIN public.articles a ON a.id = i.article_id
      WHERE i.slug = 'chatgpt-ads-89-countries-answers-not-for-sale' AND a.status = 'published'
        AND a.image_url = 'https://marklens.site/editorial/chatgpt-ads-89-countries-photo.jpg') <> 1
  THEN RAISE EXCEPTION 'ABORT: article not found, not published, or image_url is not the photo - nothing changed'; END IF;
END $guard$;
UPDATE public.articles a SET image_url = 'https://marklens.site/editorial/chatgpt-ads-89-countries-hero.jpg', updated_at = now()
FROM public.insights i
WHERE i.article_id = a.id AND i.slug = 'chatgpt-ads-89-countries-answers-not-for-sale'
  AND a.image_url = 'https://marklens.site/editorial/chatgpt-ads-89-countries-photo.jpg'
RETURNING 'rolled back: ' || i.slug || ' | ' || a.image_url;
COMMIT;
