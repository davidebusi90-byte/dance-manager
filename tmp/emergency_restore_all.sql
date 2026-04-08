-- Emergency Restoration: Undelete everything to restore the 19:00 state
UPDATE athletes SET is_deleted = false, deleted_at = null;
UPDATE couples SET is_active = true, is_deleted = false, deleted_at = null;
