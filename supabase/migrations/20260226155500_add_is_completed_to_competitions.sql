-- Migration: Add is_completed column to competitions table

ALTER TABLE "public"."competitions" 
ADD COLUMN IF NOT EXISTS "is_completed" boolean NOT NULL DEFAULT false;
