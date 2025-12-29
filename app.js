// Get all pantry items
async function loadPantryItems() {
  const household = await getUserHousehold();
  if (!household) return [];

  const { data, error } = await supabase
    .from('pantry_items')
    .select('*')
    .eq('household_id', household.id)
    .order('name');

  if (error) {
    console.error('Error loading pantry items:', error);
    return [];
  }

  return data;
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
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      expiration_date: item.expirationDate,
      notes: item.notes
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding item:', error);
    throw error;
  }

  return data;
}

// Update pantry item
async function updatePantryItem(itemId, updates) {
  const { data, error } = await supabase
    .from('pantry_items')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
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

// Real-time subscription for live updates
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
