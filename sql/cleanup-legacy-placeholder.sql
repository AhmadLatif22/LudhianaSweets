-- ============================================================================
-- One-time cleanup: run this ONCE if you tested image uploads before
-- 2026-08-05. An earlier version of products-data.js had a bug that could
-- write the literal string "images/placeholder.jpg" into a product's real
-- images array. This strips that fake entry out of any row it ended up in.
-- Safe to run even if nothing is affected — it's a no-op for clean rows.
-- Run in Supabase Dashboard → SQL Editor → New query.
-- ============================================================================

update products
set images = array_remove(images, 'images/placeholder.jpg')
where images @> array['images/placeholder.jpg'];

-- Check the result:
select id, name, images from products;
