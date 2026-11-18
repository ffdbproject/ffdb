CREATE TABLE IF NOT EXISTS site_notice (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  title VARCHAR(255),
  message TEXT NOT NULL DEFAULT '',
  style VARCHAR(20) NOT NULL DEFAULT 'info'
    CHECK (style IN ('info', 'warning', 'success', 'urgent')),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  dismissible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO site_notice (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
