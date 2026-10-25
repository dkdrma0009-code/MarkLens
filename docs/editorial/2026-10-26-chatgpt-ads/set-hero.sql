-- Connect the hero image to editorial #1 in PRODUCTION: only articles.image_url of this one article changes.
-- Aborts unchanged unless exactly one published article matches the slug and it has no image yet.
BEGIN;
DO $guard$
BEGIN
  IF (SELECT count(*) FROM public.insights i JOIN public.articles a ON a.id = i.article_id
      WHERE i.slug = 'chatgpt-ads-89-countries-answers-not-for-sale' AND a.status = 'published' AND a.image_url IS NULL) <> 1
  THEN RAISE EXCEPTION 'ABORT: article not found, not published, or already has an image - nothing changed'; END IF;
END $guard$;
UPDATE public.articles a SET image_url = 'https://marklens.site/editorial/chatgpt-ads-89-countries-hero.jpg', updated_at = now()
FROM public.insights i
WHERE i.article_id = a.id AND i.slug = 'chatgpt-ads-89-countries-answers-not-for-sale' AND a.image_url IS NULL
RETURNING 'hero set: ' || i.slug || ' | ' || a.image_url;
COMMIT;
