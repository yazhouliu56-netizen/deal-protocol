CREATE OR REPLACE FUNCTION match_providers_nearby(
  ref_lng DOUBLE PRECISION,
  ref_lat DOUBLE PRECISION,
  radius_m DOUBLE PRECISION,
  target_category TEXT,
  max_results INT DEFAULT 200
)
RETURNS TABLE(
  user_id UUID,
  skills TEXT[],
  is_online BOOLEAN,
  distance_m DOUBLE PRECISION
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    pc.user_id,
    pc.skills,
    pc.is_online,
    ST_Distance(pc.current_location, ST_SetSRID(ST_MakePoint(ref_lng, ref_lat), 4326)::geography) AS distance_m
  FROM provider_categories pc
  WHERE pc.category = target_category
    AND pc.is_online = true
    AND pc.current_location IS NOT NULL
    AND ST_DWithin(pc.current_location, ST_SetSRID(ST_MakePoint(ref_lng, ref_lat), 4326)::geography, radius_m)
  ORDER BY distance_m ASC
  LIMIT max_results;
$$;
