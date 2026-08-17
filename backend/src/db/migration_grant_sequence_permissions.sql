-- Grant sequence and table permissions required for publish-time assignment
-- Run this as a database superuser (e.g., via psql as postgres)

-- Replace `creativ5_ffdb_userr` with your application DB user if different.

GRANT USAGE, SELECT ON SEQUENCE species_public_id_seq TO creativ5_ffdb_userr;
GRANT SELECT, UPDATE ON TABLE species TO creativ5_ffdb_userr;

-- If images/taxonomy inserts are performed by the same user, ensure those privileges exist:
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE images TO creativ5_ffdb_userr;
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE taxonomy TO creativ5_ffdb_userr;
