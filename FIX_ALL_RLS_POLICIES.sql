-- ============================================
-- COMPLETE RLS POLICY FIX - RUN THIS ONCE
-- Fixes all Row Level Security issues
-- ============================================

-- ============================================
-- 1. HOUSEHOLDS TABLE
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their household" ON households;
DROP POLICY IF EXISTS "Users can create households" ON households;
DROP POLICY IF EXISTS "Anyone authenticated can create household" ON households;
DROP POLICY IF EXISTS "Users can update their household" ON households;
DROP POLICY IF EXISTS "Users can delete their household" ON households;

-- Create new working policies
CREATE POLICY "Allow authenticated users to create households" ON households
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow users to view their households" ON households
  FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Allow users to update their households" ON households
  FOR UPDATE
  TO authenticated
  USING (
    id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Allow users to delete their households" ON households
  FOR DELETE
  TO authenticated
  USING (
    id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- ============================================
-- 2. HOUSEHOLD_MEMBERS TABLE (No Recursion)
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their household members" ON household_members;
DROP POLICY IF EXISTS "Users can view household members" ON household_members;
DROP POLICY IF EXISTS "Authenticated users can view household members" ON household_members;
DROP POLICY IF EXISTS "Users can insert themselves as household members" ON household_members;
DROP POLICY IF EXISTS "Anyone can insert household members" ON household_members;
DROP POLICY IF EXISTS "Users can update their own membership" ON household_members;
DROP POLICY IF EXISTS "Users can update own membership" ON household_members;
DROP POLICY IF EXISTS "Users can delete their own membership" ON household_members;
DROP POLICY IF EXISTS "Users can delete own membership" ON household_members;

-- Create simple policies that don't cause recursion
CREATE POLICY "Allow authenticated to insert household members" ON household_members
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated to view household members" ON household_members
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow users to update own membership" ON household_members
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow users to delete own membership" ON household_members
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- 3. HOUSEHOLD_INVITES TABLE
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view invites for their household" ON household_invites;
DROP POLICY IF EXISTS "Users can create invites for their household" ON household_invites;
DROP POLICY IF EXISTS "Anyone can view valid invites" ON household_invites;

-- Create new policies
CREATE POLICY "Allow users to create invites" ON household_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anyone to view invites" ON household_invites
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow users to delete their household invites" ON household_invites
  FOR DELETE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- ============================================
-- 4. PANTRY_ITEMS TABLE
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their household pantry" ON pantry_items;
DROP POLICY IF EXISTS "Users can insert into their household pantry" ON pantry_items;
DROP POLICY IF EXISTS "Users can update their household pantry" ON pantry_items;
DROP POLICY IF EXISTS "Users can delete from their household pantry" ON pantry_items;

-- Create new policies
CREATE POLICY "Allow users to view household pantry" ON pantry_items
  FOR SELECT
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Allow users to insert into household pantry" ON pantry_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Allow users to update household pantry" ON pantry_items
  FOR UPDATE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Allow users to delete from household pantry" ON pantry_items
  FOR DELETE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- ============================================
-- 5. RECIPES TABLE
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their household recipes" ON recipes;
DROP POLICY IF EXISTS "Users can insert into their household recipes" ON recipes;
DROP POLICY IF EXISTS "Users can update their household recipes" ON recipes;
DROP POLICY IF EXISTS "Users can delete from their household recipes" ON recipes;

-- Create new policies
CREATE POLICY "Allow users to view household recipes" ON recipes
  FOR SELECT
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Allow users to insert into household recipes" ON recipes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Allow users to update household recipes" ON recipes
  FOR UPDATE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Allow users to delete from household recipes" ON recipes
  FOR DELETE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- ============================================
-- 6. SHOPPING_LIST TABLE
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their household shopping list" ON shopping_list;
DROP POLICY IF EXISTS "Users can insert into their household shopping list" ON shopping_list;
DROP POLICY IF EXISTS "Users can update their household shopping list" ON shopping_list;
DROP POLICY IF EXISTS "Users can delete from their household shopping list" ON shopping_list;

-- Create new policies
CREATE POLICY "Allow users to view household shopping list" ON shopping_list
  FOR SELECT
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Allow users to insert into household shopping list" ON shopping_list
  FOR INSERT
  TO authenticated
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Allow users to update household shopping list" ON shopping_list
  FOR UPDATE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Allow users to delete from household shopping list" ON shopping_list
  FOR DELETE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- ============================================
-- 7. MEAL_PLANS TABLE
-- ============================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their household meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can insert into their household meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can update their household meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can delete from their household meal plans" ON meal_plans;

-- Create new policies
CREATE POLICY "Allow users to view household meal plans" ON meal_plans
  FOR SELECT
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Allow users to insert into household meal plans" ON meal_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Allow users to update household meal plans" ON meal_plans
  FOR UPDATE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Allow users to delete from household meal plans" ON meal_plans
  FOR DELETE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- ============================================
-- VERIFICATION
-- ============================================
-- After running this, verify with:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
