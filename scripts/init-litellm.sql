-- Create user if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'litellm') THEN
    CREATE USER litellm WITH PASSWORD 'litellm';
  END IF;
END
$$;

-- Grant permissions on litellm database
GRANT ALL PRIVILEGES ON DATABASE litellm TO litellm;