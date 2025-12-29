-- Add missing INSERT/UPDATE/DELETE policies for new users
-- Run this in Supabase SQL Editor

-- Household Members - Allow users to insert themselves
CREATE POLICY "Users can insert themselves as household members" ON household_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own membership" ON household_members
  FOR UPDATE USING (auth.uid() = user_id);

-- Households - Allow creating and viewing
CREATE POLICY "Users can create households" ON households
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their household" ON households
  FOR UPDATE USING (
    id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- Pantry Items - Full CRUD for household members
CREATE POLICY "Users can insert pantry items" ON pantry_items
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view household pantry items" ON pantry_items
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update household pantry items" ON pantry_items
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete household pantry items" ON pantry_items
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- Recipes - Full CRUD for household members
CREATE POLICY "Users can insert recipes" ON recipes
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view household recipes" ON recipes
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update household recipes" ON recipes
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete household recipes" ON recipes
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- Shopping List - Full CRUD for household members
CREATE POLICY "Users can insert shopping items" ON shopping_list
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view household shopping list" ON shopping_list
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update household shopping items" ON shopping_list
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete household shopping items" ON shopping_list
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- Meal Plans - Full CRUD for household members
CREATE POLICY "Users can insert meal plans" ON meal_plans
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view household meal plans" ON meal_plans
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update household meal plans" ON meal_plans
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete household meal plans" ON meal_plans
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- Household Invites - Allow viewing and creating
CREATE POLICY "Users can view their household invites" ON household_invites
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create household invites" ON household_invites
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );
