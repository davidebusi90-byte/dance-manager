-- Search Optimization: Server-side trigram search for athletes
-- This function uses the trigram GIN indexes created in migration 20260330130000_add_trigram_search_indexes.sql

CREATE OR REPLACE FUNCTION public.search_athletes_server(search_term TEXT)
RETURNS SETOF public.athletes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If search_term is empty, return only non-deleted athletes
    IF (search_term IS NULL OR trim(search_term) = '') THEN
        RETURN QUERY SELECT * FROM public.athletes WHERE is_deleted = false;
    ELSE
        -- Perform fuzzy search using trigram index
        -- ILIKE with %pattern% is optimized by pg_trgm GIN index
        RETURN QUERY 
        SELECT * FROM public.athletes 
        WHERE (
            first_name ILIKE '%' || search_term || '%' OR
            last_name ILIKE '%' || search_term || '%' OR
            code ILIKE '%' || search_term || '%' OR
            qr_code ILIKE '%' || search_term || '%'
        ) AND is_deleted = false
        ORDER BY (
            CASE 
                -- Exact match on code/qr_code gets highest priority
                WHEN code = search_term OR qr_code = search_term THEN 1
                -- Starts with search term
                WHEN last_name ILIKE search_term || '%' THEN 2
                WHEN first_name ILIKE search_term || '%' THEN 3
                ELSE 4
            END
        ), last_name ASC, first_name ASC
        LIMIT 100;
    END IF;
END;
$$;

COMMENT ON FUNCTION public.search_athletes_server IS 'Performs optimized fuzzy search on athletes using trigram GIN indexes.';
