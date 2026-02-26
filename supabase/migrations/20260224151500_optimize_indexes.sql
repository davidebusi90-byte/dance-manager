-- Database Performance Optimization: Indexes for frequently queried columns

-- competition_entries: Speed up lookups for couple's registrations and status-based queries
CREATE INDEX IF NOT EXISTS idx_competition_entries_couple_id ON competition_entries(couple_id);
CREATE INDEX IF NOT EXISTS idx_competition_entries_competition_id ON competition_entries(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_entries_status ON competition_entries(status);

-- athletes: Optimize search by code and lookup by instructor
CREATE INDEX IF NOT EXISTS idx_athletes_code ON athletes(code);
CREATE INDEX IF NOT EXISTS idx_athletes_instructor_id ON athletes(instructor_id);

-- couples: Speed up lookup by partner IDs and active status
CREATE INDEX IF NOT EXISTS idx_couples_athlete1_id ON couples(athlete1_id);
CREATE INDEX IF NOT EXISTS idx_couples_athlete2_id ON couples(athlete2_id);
CREATE INDEX IF NOT EXISTS idx_couples_is_active ON couples(is_active);

-- competition_class_rules: Speed up rule checks in Edge Functions
CREATE INDEX IF NOT EXISTS idx_comp_class_rules_comp_id ON competition_class_rules(competition_id);

-- competition_event_types: Speed up event type lookups
CREATE INDEX IF NOT EXISTS idx_comp_event_types_comp_id ON competition_event_types(competition_id);
