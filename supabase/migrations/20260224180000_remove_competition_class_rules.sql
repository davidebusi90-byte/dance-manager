-- Migration to remove competition_class_rules table as it's no longer used
-- All enrollment logic is now based on competition_event_types

DROP TABLE IF EXISTS "public"."competition_class_rules" CASCADE;
