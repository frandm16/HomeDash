export const version = 2
export const name = 'service_catalog_admin'

export const up = `
  ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
  UPDATE users SET is_admin = TRUE WHERE id = (SELECT id FROM users ORDER BY created_at LIMIT 1) AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin = TRUE);
  INSERT INTO service_catalog (name, description, url, host, sort_order) VALUES
    ('Notification Center', 'Central notification inbox', 'https://notifications.frandm.dev', '192.168.1.52:7778', 0),
    ('Proxmox', 'Virtualization node management', 'https://proxmox.frandm.dev', '192.168.1.50:8006', 1),
    ('Dokploy', 'Application deployment platform', 'https://dokploy.frandm.dev', '192.168.1.52:3000', 2),
    ('Pi-hole', 'Network-wide DNS filtering', 'https://pihole.frandm.dev', '192.168.1.51:8080', 3)
  ON CONFLICT (name) DO NOTHING;
`
