// ==============================================
// SUPABASE DATABASE OPERATIONS
// ==============================================

// ==============================================
// HOUSEHOLD MANAGEMENT
// ==============================================

// Get current user
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Get user's household
async function getUserHousehold() {
  const user = await getCurrentUser();
  if (!user) return null;

  // Get households, ordered by when user joined (most recent first)
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, households(*), created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching household:', error);
    return null;
  }

  // Return the most recently joined household
  return data && data.length > 0 ? data[0].households : null;
}

// Create household for new user
async function createHousehold(name) {
  const user = await getCurrentUser();
  if (!user) throw new Error('No authenticated user');

  // Create household
  const { data: household, error: householdError } = await supabase
    .from('households')
    .insert({ name: name })
    .select()
    .single();

  if (householdError) throw householdError;

  // Add user as household member
  const { error: memberError } = await supabase
    .from('household_members')
    .insert({
      household_id: household.id,
      user_id: user.id,
      role: 'owner'
    });

  if (memberError) throw memberError;

  return household;
}

// Generate invite code
async function generateInviteCode() {
  const household = await getUserHousehold();
  if (!household) throw new Error('No household found');

  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data, error } = await supabase
    .from('household_invites')
    .insert({
      household_id: household.id,
      code: code,
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return code;
}

// Join household with invite code
async function joinHousehold(code) {
  const user = await getCurrentUser();
  if (!user) throw new Error('No authenticated user');

  // Find valid invite
  const { data: invite, error: inviteError } = await supabase
    .from('household_invites')
    .select('household_id, expires_at')
    .eq('code', code.toUpperCase())
    .single();

  if (inviteError || !invite) throw new Error('Invalid invite code');

  if (new Date(invite.expires_at) < new Date()) {
    throw new Error('Invite code has expired');
  }

  // IMPORTANT: Remove user from ALL other households first
  // This prevents conflicts when users are in multiple households
  const { error: removeError } = await supabase
    .from('household_members')
    .delete()
    .eq('user_id', user.id);

  if (removeError) {
    console.error('Error removing old household memberships:', removeError);
  }

  // Add user to new household
  const { error: memberError } = await supabase
    .from('household_members')
    .insert({
      household_id: invite.household_id,
      user_id: user.id,
      role: 'member'
    });

  if (memberError) throw memberError;

  return invite.household_id;
}

// ==============================================
// PANTRY ITEMS
// ==============================================

// Get all pantry items
async function loadPantryItems() {
  const household = await getUserHousehold();
  if (!household) return { pantry: [], fridge: [], freezer: [] };

  const { data, error } = await supabase
    .from('pantry_items')
    .select('*')
    .eq('household_id', household.id)
    .order('name');

  if (error) {
    console.error('Error loading pantry items:', error);
    return { pantry: [], fridge: [], freezer: [] };
  }

  // Group by category (dynamically support custom locations)
  const grouped = {
    pantry: [],
    fridge: [],
    freezer: []
  };

  data.forEach(item => {
    const location = item.category || 'pantry'; // 'category' field is actually location

    // Create location array if it doesn't exist (for custom locations)
    if (!grouped[location]) {
      grouped[location] = [];
    }

    const reserved = item.reserved_quantity || 0;
    const available = (item.quantity || 0) - reserved;

    grouped[location].push({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      reserved: reserved,
      available: available,
      unit: item.unit,
      location: location,
      itemCategory: item.item_category || null, // NEW: Meat, Produce, etc.
      expiration: item.expiration_date
    });
  });

  return grouped;
}

// Add pantry item
async function addPantryItem(item) {
  const household = await getUserHousehold();
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('pantry_items')
    .insert({
      household_id: household.id,
      created_by: user.id,
      name: item.name,
      category: item.location || item.category || 'pantry', // location (pantry/fridge/freezer)
      item_category: item.itemCategory || null, // NEW: category (Meat/Produce/etc.)
      quantity: item.quantity,
      unit: item.unit,
      expiration_date: item.expiration || null,
      notes: item.notes || null,
      reserved_quantity: 0 // NEW: start with 0 reserved
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding item:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    quantity: data.quantity,
    reserved: data.reserved_quantity || 0,
    available: (data.quantity || 0) - (data.reserved_quantity || 0),
    unit: data.unit,
    location: data.category,
    itemCategory: data.item_category,
    expiration: data.expiration_date
  };
}

// Update pantry item
async function updatePantryItem(itemId, updates) {
  const updateData = {
    updated_at: new Date().toISOString()
  };

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
  if (updates.unit !== undefined) updateData.unit = updates.unit;
  if (updates.category !== undefined) updateData.category = updates.category; // location
  if (updates.location !== undefined) updateData.category = updates.location; // NEW: handle location field
  if (updates.itemCategory !== undefined) updateData.item_category = updates.itemCategory; // NEW: Meat/Produce/etc.
  if (updates.expiration !== undefined) updateData.expiration_date = updates.expiration;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  const { data, error } = await supabase
    .from('pantry_items')
    .update(updateData)
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    console.error('Error updating item:', error);
    throw error;
  }

  return data;
}

// Delete pantry item
async function deletePantryItem(itemId) {
  const { error } = await supabase
    .from('pantry_items')
    .delete()
    .eq('id', itemId);

  if (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
}

// ==============================================
// RECIPES
// ==============================================

// Get all recipes
async function loadRecipes() {
  const household = await getUserHousehold();
  if (!household) return [];

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('household_id', household.id)
    .order('name');

  if (error) {
    console.error('Error loading recipes:', error);
    return [];
  }

  return data.map(recipe => ({
    id: recipe.id,
    name: recipe.name,
    servings: recipe.servings,
    category: recipe.category,
    image: recipe.image_url,
    instructions: recipe.instructions,
    ingredients: recipe.ingredients || [],
    favorite: recipe.favorite || false,
    color: recipe.color || null
  }));
}

// Add recipe
async function addRecipe(recipe) {
  const household = await getUserHousehold();
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('recipes')
    .insert({
      household_id: household.id,
      created_by: user.id,
      name: recipe.name,
      servings: recipe.servings || 4,
      category: recipe.category || null,
      image_url: recipe.image || null,
      instructions: recipe.instructions || null,
      ingredients: recipe.ingredients || [],
      favorite: recipe.favorite || false,
      color: recipe.color || null
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding recipe:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    servings: data.servings,
    category: data.category,
    image: data.image_url,
    instructions: data.instructions,
    ingredients: data.ingredients,
    favorite: data.favorite,
    color: data.color
  };
}

// Update recipe
async function updateRecipe(recipeId, updates) {
  const updateData = {
    updated_at: new Date().toISOString()
  };

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.servings !== undefined) updateData.servings = updates.servings;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.image !== undefined) updateData.image_url = updates.image;
  if (updates.instructions !== undefined) updateData.instructions = updates.instructions;
  if (updates.ingredients !== undefined) updateData.ingredients = updates.ingredients;
  if (updates.favorite !== undefined) updateData.favorite = updates.favorite;
  if (updates.color !== undefined) updateData.color = updates.color;

  const { data, error } = await supabase
    .from('recipes')
    .update(updateData)
    .eq('id', recipeId)
    .select()
    .single();

  if (error) {
    console.error('Error updating recipe:', error);
    throw error;
  }

  return data;
}

// Delete recipe
async function deleteRecipe(recipeId) {
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', recipeId);

  if (error) {
    console.error('Error deleting recipe:', error);
    throw error;
  }
}

// ==============================================
// SHOPPING LIST
// ==============================================

// Get shopping list
async function loadShoppingList() {
  const household = await getUserHousehold();
  if (!household) return [];

  const { data, error } = await supabase
    .from('shopping_list')
    .select('*')
    .eq('household_id', household.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading shopping list:', error);
    return [];
  }

  return data.map(item => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    checked: item.checked || false
  }));
}

// Add shopping item
async function addShoppingItem(item) {
  const household = await getUserHousehold();
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('shopping_list')
    .insert({
      household_id: household.id,
      created_by: user.id,
      name: item.name,
      quantity: item.quantity || 1,
      unit: item.unit || '',
      category: item.category || 'other',
      checked: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding shopping item:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    quantity: data.quantity,
    unit: data.unit,
    category: data.category,
    checked: data.checked
  };
}

// Update shopping item
async function updateShoppingItem(itemId, updates) {
  const updateData = {};

  if (updates.checked !== undefined) updateData.checked = updates.checked;
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
  if (updates.unit !== undefined) updateData.unit = updates.unit;
  if (updates.category !== undefined) updateData.category = updates.category;

  const { data, error } = await supabase
    .from('shopping_list')
    .update(updateData)
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    console.error('Error updating shopping item:', error);
    throw error;
  }

  return data;
}

// Delete shopping item
async function deleteShoppingItem(itemId) {
  const { error } = await supabase
    .from('shopping_list')
    .delete()
    .eq('id', itemId);

  if (error) {
    console.error('Error deleting shopping item:', error);
    throw error;
  }
}

// Clear shopping list
async function clearShoppingList() {
  const household = await getUserHousehold();
  if (!household) return;

  const { error } = await supabase
    .from('shopping_list')
    .delete()
    .eq('household_id', household.id);

  if (error) {
    console.error('Error clearing shopping list:', error);
    throw error;
  }
}

// ==============================================
// MEAL PLAN
// ==============================================

// Get meal plan
async function loadMealPlan() {
  const household = await getUserHousehold();
  if (!household) return {
    week1: {
      monday: [], tuesday: [], wednesday: [], thursday: [],
      friday: [], saturday: [], sunday: []
    },
    week2: {
      monday: [], tuesday: [], wednesday: [], thursday: [],
      friday: [], saturday: [], sunday: []
    }
  };

  const { data, error } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('household_id', household.id)
    .order('date');

  if (error) {
    console.error('Error loading meal plan:', error);
    return {
      week1: {
        monday: [], tuesday: [], wednesday: [], thursday: [],
        friday: [], saturday: [], sunday: []
      },
      week2: {
        monday: [], tuesday: [], wednesday: [], thursday: [],
        friday: [], saturday: [], sunday: []
      }
    };
  }

  // Convert database format to app format
  const mealPlan = {
    week1: {
      monday: [], tuesday: [], wednesday: [], thursday: [],
      friday: [], saturday: [], sunday: []
    },
    week2: {
      monday: [], tuesday: [], wednesday: [], thursday: [],
      friday: [], saturday: [], sunday: []
    }
  };

  data.forEach(entry => {
    if (entry.week && entry.day_of_week && mealPlan[entry.week] && mealPlan[entry.week][entry.day_of_week]) {
      mealPlan[entry.week][entry.day_of_week] = entry.recipe_ids || [];
    }
  });

  return mealPlan;
}

// Save meal plan entry
async function saveMealPlanEntry(week, day, recipeIds) {
  const household = await getUserHousehold();
  if (!household) return;

  // Delete existing entry for this week+day
  await supabase
    .from('meal_plans')
    .delete()
    .eq('household_id', household.id)
    .eq('week', week)
    .eq('day_of_week', day);

  // Insert new entry if there are recipes
  if (recipeIds && recipeIds.length > 0) {
    const { error } = await supabase
      .from('meal_plans')
      .insert({
        household_id: household.id,
        week: week,
        day_of_week: day,
        recipe_ids: recipeIds
      });

    if (error) {
      console.error('Error saving meal plan entry:', error);
      throw error;
    }
  }
}

// Clear meal plan
async function clearMealPlan() {
  const household = await getUserHousehold();
  if (!household) return;

  const { error } = await supabase
    .from('meal_plans')
    .delete()
    .eq('household_id', household.id);

  if (error) {
    console.error('Error clearing meal plan:', error);
    throw error;
  }
}

// ==============================================
// CATEGORIES MANAGEMENT
// ==============================================

// Load all categories for household
async function loadCategories() {
  const household = await getUserHousehold();
  if (!household) return [];

  const { data, error} = await supabase
    .from('categories')
    .select('*')
    .eq('household_id', household.id)
    .order('name');

  if (error) {
    console.error('Error loading categories:', error);
    return [];
  }

  return data;
}

// Add custom category
async function addCategory(name) {
  const household = await getUserHousehold();
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('categories')
    .insert({
      household_id: household.id,
      name: name,
      is_default: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding category:', error);
    throw error;
  }

  return data;
}

// Update category
async function updateCategory(categoryId, name) {
  const { data, error } = await supabase
    .from('categories')
    .update({ name: name, updated_at: new Date().toISOString() })
    .eq('id', categoryId)
    .select()
    .single();

  if (error) {
    console.error('Error updating category:', error);
    throw error;
  }

  return data;
}

// Delete category (only non-default)
async function deleteCategory(categoryId) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId)
    .eq('is_default', false); // Can only delete non-default

  if (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
}

// ==============================================
// LOCATIONS MANAGEMENT
// ==============================================

// Load all locations for household
async function loadLocations() {
  const household = await getUserHousehold();
  if (!household) return [];

  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('household_id', household.id)
    .order('name');

  if (error) {
    console.error('Error loading locations:', error);
    return [];
  }

  return data;
}

// Add custom location
async function addLocation(name) {
  const household = await getUserHousehold();
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from('locations')
    .insert({
      household_id: household.id,
      name: name,
      is_default: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding location:', error);
    throw error;
  }

  return data;
}

// Update location
async function updateLocation(locationId, name) {
  const { data, error } = await supabase
    .from('locations')
    .update({ name: name, updated_at: new Date().toISOString() })
    .eq('id', locationId)
    .select()
    .single();

  if (error) {
    console.error('Error updating location:', error);
    throw error;
  }

  return data;
}

// Delete location (only non-default)
async function deleteLocation(locationId) {
  const { error } = await supabase
    .from('locations')
    .delete()
    .eq('id', locationId)
    .eq('is_default', false); // Can only delete non-default

  if (error) {
    console.error('Error deleting location:', error);
    throw error;
  }
}

// ==============================================
// RECENT PURCHASES
// ==============================================

// Load recent purchases (last 10)
async function loadRecentPurchases() {
  const household = await getUserHousehold();
  if (!household) return [];

  const { data, error } = await supabase
    .from('recent_purchases')
    .select('*')
    .eq('household_id', household.id)
    .order('purchased_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error loading recent purchases:', error);
    return [];
  }

  return data;
}

// Add recent purchase (when sending from shopping list to pantry)
async function addRecentPurchase(item) {
  const household = await getUserHousehold();
  const user = await getCurrentUser();

  const { error } = await supabase
    .from('recent_purchases')
    .insert({
      household_id: household.id,
      created_by: user.id,
      item_name: item.name,
      item_category: item.category || null,
      quantity: item.quantity || null,
      unit: item.unit || null
    });

  if (error) {
    console.error('Error adding recent purchase:', error);
    // Don't throw - this is non-critical
  }
}

// ==============================================
// REAL-TIME SUBSCRIPTIONS
// ==============================================

// Subscribe to pantry changes
function subscribeToPantryChanges(callback) {
  const subscription = supabase
    .channel('pantry_changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'pantry_items'
    }, callback)
    .subscribe();

  return subscription;
}

// Subscribe to recipe changes
function subscribeToRecipeChanges(callback) {
  const subscription = supabase
    .channel('recipe_changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'recipes'
    }, callback)
    .subscribe();

  return subscription;
}

// Subscribe to shopping list changes
function subscribeToShoppingChanges(callback) {
  const subscription = supabase
    .channel('shopping_changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'shopping_list'
    }, callback)
    .subscribe();

  return subscription;
}

// Subscribe to meal plan changes
function subscribeToMealPlanChanges(callback) {
  const subscription = supabase
    .channel('meal_plan_changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'meal_plans'
    }, callback)
    .subscribe();

  return subscription;
}
