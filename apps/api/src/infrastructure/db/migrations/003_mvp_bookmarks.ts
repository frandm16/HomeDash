export const version = 3
export const name = 'mvp_global_bookmarks'

export const up = `
  ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
  UPDATE bookmarks b SET user_id = d.user_id FROM dashboard_profiles p JOIN dashboards d ON d.id = p.dashboard_id WHERE b.profile_id = p.id AND b.user_id IS NULL;
  ALTER TABLE bookmarks ALTER COLUMN user_id SET NOT NULL;
  CREATE INDEX IF NOT EXISTS bookmarks_user_idx ON bookmarks(user_id, sort_order, created_at);
`
