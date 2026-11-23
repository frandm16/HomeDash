export const version = 4
export const name = 'widget_scoped_bookmarks'

export const up = `
  ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS widget_id UUID REFERENCES widget_instances(id) ON DELETE CASCADE;

  UPDATE bookmarks b
  SET widget_id = (
    SELECT w.id
    FROM widget_instances w
    WHERE w.profile_id = b.profile_id
      AND w.widget_type IN ('bookmarks', 'bookmarks-icons', 'bookmarks-dock')
    ORDER BY w.created_at ASC
    LIMIT 1
  )
  WHERE b.widget_id IS NULL;

  CREATE INDEX IF NOT EXISTS bookmarks_widget_idx ON bookmarks(widget_id, sort_order, created_at);
`
