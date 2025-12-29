-- Fix households RLS policies
-- Run this in Supabase SQL Editor

-- Drop all existing policies on households table
DROP POLICY IF EXISTS "Users can view their household" ON households;
DROP POLICY IF EXISTS "Users can create households" ON households;
DROP POLICY IF EXISTS "Users can update their household" ON households;

-- Create new policies that actually work
CREATE POLICY "Anyone authenticated can create household" ON households
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view their household" ON households
  FOR SELECT 
  TO authenticated
  USING (
    id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update their household" ON households
  FOR UPDATE 
  TO authenticated
  USING (
    id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- Also fix household_members policies
DROP POLICY IF EXISTS "Users can view their household members" ON household_members;
DROP POLICY IF EXISTS "Users can insert themselves as household members" ON household_members;
DROP POLICY IF EXISTS "Users can update their own membership" ON household_members;

CREATE POLICY "Anyone can insert household members" ON household_members
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view household members" ON household_members
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid()));
