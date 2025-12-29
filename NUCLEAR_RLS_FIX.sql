-- ============================================
-- NUCLEAR OPTION: Complete RLS Reset
-- This will DROP ALL existing policies and create new ones
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Drop ALL existing policies on ALL tables
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('households', 'household_members', 'household_invites',
                           'pantry_items', 'recipes', 'shopping_list', 'meal_plans')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
        RAISE NOTICE 'Dropped policy % on table %', pol.policyname, pol.tablename;
    END LOOP;
END $$;

-- Step 2: Create new clean policies

-- ============================================
-- HOUSEHOLDS
-- ============================================
CREATE POLICY "households_insert" ON households
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "households_select" ON households
  FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "households_update" ON households
  FOR UPDATE
  TO authenticated
  USING (
    id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "households_delete" ON households
  FOR DELETE
  TO authenticated
  USING (
    id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- ============================================
-- HOUSEHOLD_MEMBERS (No Recursion!)
-- ============================================
CREATE POLICY "household_members_insert" ON household_members
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "household_members_select" ON household_members
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "household_members_update" ON household_members
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "household_members_delete" ON household_members
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- HOUSEHOLD_INVITES
-- ============================================
CREATE POLICY "household_invites_insert" ON household_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "household_invites_select" ON household_invites
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "household_invites_delete" ON household_invites
  FOR DELETE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- ============================================
-- PANTRY_ITEMS
-- ============================================
CREATE POLICY "pantry_items_select" ON pantry_items
  FOR SELECT
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "pantry_items_insert" ON pantry_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "pantry_items_update" ON pantry_items
  FOR UPDATE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "pantry_items_delete" ON pantry_items
  FOR DELETE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- ============================================
-- RECIPES
-- ============================================
CREATE POLICY "recipes_select" ON recipes
  FOR SELECT
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "recipes_insert" ON recipes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "recipes_update" ON recipes
  FOR UPDATE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "recipes_delete" ON recipes
  FOR DELETE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- ============================================
-- SHOPPING_LIST
-- ============================================
CREATE POLICY "shopping_list_select" ON shopping_list
  FOR SELECT
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "shopping_list_insert" ON shopping_list
  FOR INSERT
  TO authenticated
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "shopping_list_update" ON shopping_list
  FOR UPDATE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "shopping_list_delete" ON shopping_list
  FOR DELETE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- ============================================
-- MEAL_PLANS
-- ============================================
CREATE POLICY "meal_plans_select" ON meal_plans
  FOR SELECT
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "meal_plans_insert" ON meal_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "meal_plans_update" ON meal_plans
  FOR UPDATE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  )
  WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "meal_plans_delete" ON meal_plans
  FOR DELETE
  TO authenticated
  USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- ============================================
-- VERIFICATION
-- ============================================
SELECT 'RLS Policies Reset Complete!' as status;
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
