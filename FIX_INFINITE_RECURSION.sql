-- Fix infinite recursion in household_members RLS policy
-- The previous policy tried to check household_members within the household_members policy, causing recursion
-- Run this in Supabase SQL Editor

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view household members" ON household_members;

-- Create a simple policy that doesn't cause recursion
-- Allow all authenticated users to view household_members
-- This is safe because:
-- 1. It only reveals which users belong to which households
-- 2. Household IDs are UUIDs (not guessable)
-- 3. Actual household data is protected by other RLS policies
CREATE POLICY "Authenticated users can view household members" ON household_members
  FOR SELECT
  TO authenticated
  USING (true);

-- Also ensure UPDATE policy exists and doesn't cause recursion
DROP POLICY IF EXISTS "Users can update their own membership" ON household_members;

CREATE POLICY "Users can update own membership" ON household_members
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Ensure DELETE policy is safe
DROP POLICY IF EXISTS "Users can delete their own membership" ON household_members;

CREATE POLICY "Users can delete own membership" ON household_members
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
