## Supabase Schema Scripts

Run these files in order when setting up or updating the database schema:

1. `01_profiles.sql`
2. `02_events.sql`
3. `03_registrations.sql`
4. `04_event_feedback.sql`
5. `05_rls.sql`
6. `06_updated_at_triggers.sql`
7. `07_registered_count.sql`
8. `08_handle_new_user.sql`

Optional:

- `00_block_signup.sql`: helper function reference if you want to block self-signup from the client side.

Notes:

- The repo keeps [schema.sql](/d:/Vuyp-AGILE/backend/scripts/supabase/schema.sql) as an index/guide only.
- Open and run only the files you need in Supabase SQL Editor.
- `05_rls.sql` depends on the tables created by `01` to `04`.
- `06` to `08` create functions/triggers that depend on earlier tables.
