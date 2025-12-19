// Smart Pantry Application v2.5 - Enhanced Edition with Cloud Sync
// API Configuration
const API_BASE_URL = 'https://rtd-n-line-api.onrender.com';

// ========================================
// TOAST NOTIFICATION SYSTEM
// ========================================
function showToast(title, message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            ${message ? `<div class="toast-message">${message}</div>` : ''}
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Data Storage
let ingredients = {
    pantry: [],
    fridge: [],
    freezer: []
};

let recipes = [];
let shoppingList = [];
let mealPlan = {
    monday: { breakfast: null, lunch: null, dinner: null },
    tuesday: { breakfast: null, lunch: null, dinner: null },
    wednesday: { breakfast: null, lunch: null, dinner: null },
    thursday: { breakfast: null, lunch: null, dinner: null },
    friday: { breakfast: null, lunch: null, dinner: null },
    saturday: { breakfast: null, lunch: null, dinner: null },
    sunday: { breakfast: null, lunch: null, dinner: null }
};

let currentLocation = 'pantry';
let currentRecipeFilter = 'all';
let currentRecipeCategory = 'all';
let currentShoppingCategory = 'all';
let recipeSearchQuery = '';
let ingredientSearchQuery = '';
let editingRecipeId = null;
let editingIngredientData = null;

// Authentication State
let userToken = null;
let isSyncing = false;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    initAuth();
    initNavigation();
    initDashboard();
    initIngredients();
    initRecipes();
    initShopping();
    initMealPlan();
    initSettings();
});

// Local Storage Functions
function saveToLocalStorage() {
    localStorage.setItem('smartPantry_ingredients', JSON.stringify(ingredients));
    localStorage.setItem('smartPantry_recipes', JSON.stringify(recipes));
    localStorage.setItem('smartPantry_shopping', JSON.stringify(shoppingList));
    localStorage.setItem('smartPantry_mealPlan', JSON.stringify(mealPlan));

    // Auto-sync to cloud if logged in
    if (userToken && !isSyncing) {
        clearTimeout(window.syncTimeout);
        window.syncTimeout = setTimeout(() => {
            syncToServer();
        }, 2000); // Debounce for 2 seconds
    }
}

function loadFromLocalStorage() {
    const savedIngredients = localStorage.getItem('smartPantry_ingredients');
    const savedRecipes = localStorage.getItem('smartPantry_recipes');
    const savedShopping = localStorage.getItem('smartPantry_shopping');
    const savedMealPlan = localStorage.getItem('smartPantry_mealPlan');

    if (savedIngredients) {
        try {
            ingredients = JSON.parse(savedIngredients);
        } catch (e) {
            console.error('Failed to parse ingredients:', e);
            ingredients = { pantry: [], fridge: [], freezer: [] };
        }
    }

    if (savedRecipes) {
        try {
            const parsed = JSON.parse(savedRecipes);
            // CRITICAL: Ensure recipes is always an array
            recipes = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error('Failed to parse recipes:', e);
            recipes = [];
        }
    }

    if (savedShopping) {
        try {
            const parsed = JSON.parse(savedShopping);
            shoppingList = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error('Failed to parse shopping list:', e);
            shoppingList = [];
        }
    }

    if (savedMealPlan) {
        try {
            mealPlan = JSON.parse(savedMealPlan);
        } catch (e) {
            console.error('Failed to parse meal plan:', e);
            mealPlan = {
                monday: { breakfast: null, lunch: null, dinner: null },
                tuesday: { breakfast: null, lunch: null, dinner: null },
                wednesday: { breakfast: null, lunch: null, dinner: null },
                thursday: { breakfast: null, lunch: null, dinner: null },
                friday: { breakfast: null, lunch: null, dinner: null },
                saturday: { breakfast: null, lunch: null, dinner: null },
                sunday: { breakfast: null, lunch: null, dinner: null }
            };
        }
    }
}

// Navigation
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetSection = btn.dataset.section;

            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(targetSection).classList.add('active');

            if (targetSection === 'settings') {
                updateStats();
            }
        });
    });
}

// Global navigation function for dashboard cards
function navigateToSection(sectionId) {
    const targetBtn = document.querySelector(`.nav-btn[data-section="${sectionId}"]`);
    if (targetBtn) {
        targetBtn.click();
    }
}

// Dashboard
function initDashboard() {
    // Update dashboard stats
    updateDashboardStats();

    // Dashboard card navigation
    const dashboardCards = document.querySelectorAll('.dashboard-card');
    dashboardCards.forEach(card => {
        card.addEventListener('click', () => {
            const targetSection = card.dataset.navigate;
            if (targetSection) {
                navigateToSection(targetSection);
            }
        });
    });
}

function updateDashboardStats() {
    const totalIngredients = ingredients.pantry.length + ingredients.fridge.length + ingredients.freezer.length;
    const totalRecipes = recipes.length;
    const totalShoppingItems = shoppingList.length;

    document.getElementById('dashboard-ingredients-count').textContent =
        `${totalIngredients} ${totalIngredients === 1 ? 'item' : 'items'}`;
    document.getElementById('dashboard-recipes-count').textContent =
        `${totalRecipes} ${totalRecipes === 1 ? 'recipe' : 'recipes'}`;
    document.getElementById('dashboard-shopping-count').textContent =
        `${totalShoppingItems} ${totalShoppingItems === 1 ? 'item' : 'items'}`;

    // Check for expiring items
    checkExpiringItems();
}

function checkExpiringItems() {
    const allIngredients = [...ingredients.pantry, ...ingredients.fridge, ...ingredients.freezer];
    const expiring = [];
    const expired = [];

    allIngredients.forEach(item => {
        if (item.expiration) {
            const status = getExpirationStatus(item.expiration);
            if (status === 'expired') {
                expired.push(item.name);
            } else if (status === 'expiring-soon') {
                expiring.push(item.name);
            }
        }
    });

    const alert = document.getElementById('expiring-alert');
    const alertText = document.getElementById('expiring-alert-text');

    if (expired.length > 0 || expiring.length > 0) {
        let message = '';
        if (expired.length > 0) {
            message += `${expired.length} item${expired.length > 1 ? 's have' : ' has'} expired. `;
        }
        if (expiring.length > 0) {
            message += `${expiring.length} item${expiring.length > 1 ? 's are' : ' is'} expiring soon.`;
        }
        alertText.textContent = message;
        alert.style.display = 'flex';
    } else {
        alert.style.display = 'none';
    }
}

// Ingredients Section
function initIngredients() {
    const locationButtons = document.querySelectorAll('.location-btn');
    const addIngredientBtn = document.getElementById('add-ingredient-btn');
    const toggleAddIngredientBtn = document.getElementById('toggle-add-ingredient');
    const cancelAddIngredientBtn = document.getElementById('cancel-add-ingredient');
    const formContainer = document.getElementById('add-ingredient-form-container');
    const searchInput = document.getElementById('ingredient-search');

    // Ingredient search
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            ingredientSearchQuery = e.target.value.toLowerCase();
            renderIngredients();
        });
    }

    // Toggle add ingredient form
    if (toggleAddIngredientBtn) {
        toggleAddIngredientBtn.addEventListener('click', () => {
            formContainer.classList.toggle('hidden');
            if (!formContainer.classList.contains('hidden')) {
                document.getElementById('ingredient-name').focus();
            }
        });
    }

    // Cancel button
    if (cancelAddIngredientBtn) {
        cancelAddIngredientBtn.addEventListener('click', () => {
            formContainer.classList.add('hidden');
            clearIngredientForm();
        });
    }

    locationButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentLocation = btn.dataset.location;

            locationButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.ingredient-list').forEach(list => {
                list.classList.remove('active');
            });
            document.getElementById(`${currentLocation}-list`).classList.add('active');

            renderIngredients();
        });
    });

    addIngredientBtn.addEventListener('click', addIngredient);

    document.getElementById('ingredient-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addIngredient();
    });

    // Edit ingredient modal
    document.querySelector('.close-edit-ingredient').addEventListener('click', () => {
        document.getElementById('edit-ingredient-modal').classList.add('hidden');
    });

    document.getElementById('save-ingredient-edit-btn').addEventListener('click', saveIngredientEdit);

    renderIngredients();
}

function clearIngredientForm() {
    document.getElementById('ingredient-name').value = '';
    document.getElementById('ingredient-quantity').value = '1';
    document.getElementById('ingredient-unit').value = '';
    document.getElementById('ingredient-expiration').value = '';
}

function addIngredient() {
    const nameInput = document.getElementById('ingredient-name');
    const quantityInput = document.getElementById('ingredient-quantity');
    const unitInput = document.getElementById('ingredient-unit');
    const expirationInput = document.getElementById('ingredient-expiration');

    const name = nameInput.value.trim();
    const quantity = parseFloat(quantityInput.value) || 1;
    const unit = unitInput.value.trim();
    const expiration = expirationInput.value || null;

    if (!name) {
        alert('Please enter an ingredient name');
        return;
    }

    // Check if ingredient already exists
    const existingIngredient = ingredients[currentLocation].find(
        ing => ing.name.toLowerCase() === name.toLowerCase() && ing.unit.toLowerCase() === unit.toLowerCase()
    );

    if (existingIngredient) {
        existingIngredient.quantity += quantity;
        if (expiration && (!existingIngredient.expiration || new Date(expiration) < new Date(existingIngredient.expiration))) {
            existingIngredient.expiration = expiration;
        }
    } else {
        const ingredient = {
            id: Date.now(),
            name,
            quantity,
            unit,
            expiration
        };
        ingredients[currentLocation].push(ingredient);
    }

    saveToLocalStorage();
    renderIngredients();
    updateRecipeStatus();
    updateDashboardStats();

    // Hide form and clear inputs
    const formContainer = document.getElementById('add-ingredient-form-container');
    if (formContainer) {
        formContainer.classList.add('hidden');
    }

    nameInput.value = '';
    quantityInput.value = '1';
    unitInput.value = '';
    expirationInput.value = '';

    // Show success toast
    showToast('Ingredient Added!', `${name} has been added to your ${currentLocation}`, 'success');
}

function editIngredient(location, id) {
    const ingredient = ingredients[location].find(ing => ing.id === id);
    if (!ingredient) return;

    editingIngredientData = { location, id };

    document.getElementById('edit-ing-name').value = ingredient.name;
    document.getElementById('edit-ing-quantity').value = ingredient.quantity;
    document.getElementById('edit-ing-unit').value = ingredient.unit;
    document.getElementById('edit-ing-expiration').value = ingredient.expiration || '';

    document.getElementById('edit-ingredient-modal').classList.remove('hidden');
}

function saveIngredientEdit() {
    if (!editingIngredientData) return;

    const { location, id } = editingIngredientData;
    const ingredient = ingredients[location].find(ing => ing.id === id);

    if (ingredient) {
        ingredient.name = document.getElementById('edit-ing-name').value.trim();
        ingredient.quantity = parseFloat(document.getElementById('edit-ing-quantity').value) || 1;
        ingredient.unit = document.getElementById('edit-ing-unit').value.trim();
        ingredient.expiration = document.getElementById('edit-ing-expiration').value || null;

        saveToLocalStorage();
        renderIngredients();
        updateRecipeStatus();
    }

    document.getElementById('edit-ingredient-modal').classList.add('hidden');
    editingIngredientData = null;
}

function deleteIngredient(location, id) {
    const ingredient = ingredients[location].find(ing => ing.id === id);
    const ingredientName = ingredient ? ingredient.name : 'Item';

    ingredients[location] = ingredients[location].filter(ing => ing.id !== id);
    saveToLocalStorage();
    renderIngredients();
    updateRecipeStatus();
    updateDashboardStats();

    // Show success toast
    showToast('Ingredient Deleted', `${ingredientName} has been removed`, 'success');
}

function getExpirationStatus(expiration) {
    if (!expiration) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expiration);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= 3) return 'expiring-soon';
    return 'fresh';
}

// Calculate ingredients reserved by meal plan
function getReservedQuantities() {
    const reserved = {};

    Object.keys(mealPlan).forEach(day => {
        Object.keys(mealPlan[day]).forEach(meal => {
            const recipeId = mealPlan[day][meal];
            if (recipeId) {
                const recipe = recipes.find(r => r.id === recipeId);
                if (recipe && recipe.ingredients) {
                    recipe.ingredients.forEach(ing => {
                        const key = `${ing.name.toLowerCase()}|${ing.unit.toLowerCase()}`;
                        reserved[key] = (reserved[key] || 0) + ing.quantity;
                    });
                }
            }
        });
    });

    return reserved;
}

function renderIngredients() {
    const reservedQty = getReservedQuantities();

    ['pantry', 'fridge', 'freezer'].forEach(location => {
        const listElement = document.getElementById(`${location}-items`);
        let items = ingredients[location];

        // Filter by search query
        if (ingredientSearchQuery) {
            items = items.filter(item =>
                item.name.toLowerCase().includes(ingredientSearchQuery) ||
                item.unit.toLowerCase().includes(ingredientSearchQuery)
            );
        }

        if (items.length === 0) {
            const message = ingredientSearchQuery ?
                'No ingredients match your search' :
                'No items yet';
            listElement.innerHTML = `<li style="background: none; text-align: center; color: #6c757d;">${message}</li>`;
            return;
        }

        listElement.innerHTML = items.map(item => {
            const expStatus = getExpirationStatus(item.expiration);
            let classList = '';
            let expBadge = '';

            if (expStatus === 'expired') {
                classList = 'ingredient-expired';
                expBadge = '<span class="expiration-badge expired-badge">EXPIRED</span>';
            } else if (expStatus === 'expiring-soon') {
                classList = 'ingredient-expiring-soon';
                expBadge = '<span class="expiration-badge expiring-soon-badge">EXPIRING SOON</span>';
            }

            // Calculate available quantity after meal plan
            const key = `${item.name.toLowerCase()}|${item.unit.toLowerCase()}`;
            const reserved = reservedQty[key] || 0;
            const available = item.quantity - reserved;

            // Build availability display
            let availabilityHTML = '';
            if (reserved > 0) {
                const availColor = available <= 0 ? '#e53e3e' : (available < item.quantity * 0.3 ? '#ed8936' : '#48bb78');
                availabilityHTML = `
                    <div class="ingredient-availability">
                        <div class="availability-item">
                            <span class="availability-label">On Hand:</span>
                            <span class="availability-value">${item.quantity} ${item.unit}</span>
                        </div>
                        <div class="availability-item">
                            <span class="availability-label">Available:</span>
                            <span class="availability-value" style="color: ${availColor}; font-weight: 700;">${available} ${item.unit}</span>
                        </div>
                        <div class="availability-item reserved-info">
                            <span class="availability-label">Reserved:</span>
                            <span class="availability-value">${reserved} ${item.unit}</span>
                        </div>
                    </div>
                `;
            }

            return `
            <li class="${classList}">
                <div class="ingredient-card-content">
                    <div class="ingredient-header">
                        <span class="ingredient-name">${item.name}</span>
                        ${expBadge}
                    </div>
                    <div class="ingredient-quantity-display">
                        <span class="quantity-number">${item.quantity}</span>
                        <span class="quantity-unit">${item.unit}</span>
                    </div>
                    ${availabilityHTML}
                </div>
                <div class="ingredient-actions">
                    <button class="icon-btn edit-btn" onclick="editIngredient('${location}', ${item.id})" title="Edit">
                        ✏️
                    </button>
                    <button class="icon-btn delete-btn" onclick="deleteIngredient('${location}', ${item.id})" title="Delete">
                        🗑️
                    </button>
                </div>
            </li>
        `}).join('');
    });
}

// Recipes Section
function initRecipes() {
    const addRecipeBtn = document.getElementById('add-recipe-btn');
    const saveRecipeBtn = document.getElementById('save-recipe-btn');
    const closeModal = document.querySelector('.close-modal');
    const addRecipeIngredientBtn = document.getElementById('add-recipe-ingredient-btn');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const categoryButtons = document.querySelectorAll('.category-filter-btn');
    const searchInput = document.getElementById('recipe-search');
    const toggleFiltersBtn = document.getElementById('toggle-filters');
    const filtersContainer = document.getElementById('filters-container');

    // Toggle filters
    if (toggleFiltersBtn) {
        toggleFiltersBtn.addEventListener('click', () => {
            filtersContainer.classList.toggle('hidden');
        });
    }

    addRecipeBtn.addEventListener('click', () => {
        document.getElementById('recipe-modal-title').textContent = 'Add New Recipe';
        document.getElementById('add-recipe-form').classList.remove('hidden');
        clearRecipeForm();
    });

    closeModal.addEventListener('click', () => {
        document.getElementById('add-recipe-form').classList.add('hidden');
    });

    saveRecipeBtn.addEventListener('click', saveRecipe);
    addRecipeIngredientBtn.addEventListener('click', addRecipeIngredientRow);

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentRecipeFilter = btn.dataset.filter;
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderRecipes();
        });
    });

    categoryButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentRecipeCategory = btn.dataset.category;
            categoryButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderRecipes();
        });
    });

    searchInput.addEventListener('input', (e) => {
        recipeSearchQuery = e.target.value.toLowerCase();
        renderRecipes();
    });

    document.getElementById('add-recipe-form').addEventListener('click', (e) => {
        if (e.target.id === 'add-recipe-form') {
            document.getElementById('add-recipe-form').classList.add('hidden');
        }
    });

    renderRecipes();
}

function addRecipeIngredientRow() {
    const container = document.getElementById('recipe-ingredient-inputs');
    const row = document.createElement('div');
    row.className = 'recipe-ingredient-row';
    row.innerHTML = `
        <input type="text" class="recipe-ing-name" placeholder="Ingredient" />
        <input type="number" class="recipe-ing-qty" placeholder="Qty" min="0.1" step="0.1" value="1" />
        <input type="text" class="recipe-ing-unit" placeholder="Unit" />
        <button type="button" class="remove-ing-btn" onclick="this.parentElement.remove()">Remove</button>
    `;
    container.appendChild(row);
}

function clearRecipeForm() {
    editingRecipeId = null;
    document.getElementById('recipe-name').value = '';
    document.getElementById('recipe-servings').value = '4';
    document.getElementById('recipe-category').value = '';
    document.getElementById('recipe-image').value = '';
    document.getElementById('recipe-instructions').value = '';
    document.getElementById('recipe-ingredient-inputs').innerHTML = `
        <div class="recipe-ingredient-row">
            <input type="text" class="recipe-ing-name" placeholder="Ingredient" />
            <input type="number" class="recipe-ing-qty" placeholder="Qty" min="0.1" step="0.1" value="1" />
            <input type="text" class="recipe-ing-unit" placeholder="Unit" />
            <button type="button" class="remove-ing-btn" onclick="this.parentElement.remove()">Remove</button>
        </div>
    `;
}

function saveRecipe() {
    const name = document.getElementById('recipe-name').value.trim();
    const servings = parseInt(document.getElementById('recipe-servings').value) || 4;
    const category = document.getElementById('recipe-category').value;
    const image = document.getElementById('recipe-image').value.trim();
    const instructions = document.getElementById('recipe-instructions').value.trim();

    if (!name) {
        alert('Please enter a recipe name');
        return;
    }

    const ingredientRows = document.querySelectorAll('.recipe-ingredient-row');
    const recipeIngredients = [];

    ingredientRows.forEach(row => {
        const ingName = row.querySelector('.recipe-ing-name').value.trim();
        const ingQty = parseFloat(row.querySelector('.recipe-ing-qty').value) || 1;
        const ingUnit = row.querySelector('.recipe-ing-unit').value.trim();

        if (ingName) {
            recipeIngredients.push({
                name: ingName.toLowerCase(),
                quantity: ingQty,
                unit: ingUnit
            });
        }
    });

    if (recipeIngredients.length === 0) {
        alert('Please add at least one ingredient');
        return;
    }

    if (editingRecipeId) {
        const recipe = recipes.find(r => r.id === editingRecipeId);
        if (recipe) {
            recipe.name = name;
            recipe.servings = servings;
            recipe.category = category;
            recipe.image = image;
            recipe.instructions = instructions;
            recipe.ingredients = recipeIngredients;
        }
        editingRecipeId = null;
    } else {
        const recipe = {
            id: Date.now(),
            name,
            servings,
            category,
            image,
            instructions,
            ingredients: recipeIngredients
        };
        recipes.push(recipe);
    }

    saveToLocalStorage();
    renderRecipes();
    renderMealPlan();
    updateDashboardStats();

    document.getElementById('add-recipe-form').classList.add('hidden');

    // Show success toast
    const action = editingRecipeId ? 'updated' : 'added';
    showToast(`Recipe ${action.charAt(0).toUpperCase() + action.slice(1)}!`, `${name} has been ${action} to your recipes`, 'success');
    editingRecipeId = null;
}

function editRecipe(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    editingRecipeId = id;

    document.getElementById('recipe-modal-title').textContent = 'Edit Recipe';
    document.getElementById('recipe-name').value = recipe.name;
    document.getElementById('recipe-servings').value = recipe.servings || 4;
    document.getElementById('recipe-category').value = recipe.category || '';
    document.getElementById('recipe-image').value = recipe.image || '';
    document.getElementById('recipe-instructions').value = recipe.instructions || '';

    const container = document.getElementById('recipe-ingredient-inputs');
    container.innerHTML = '';

    recipe.ingredients.forEach(ing => {
        const row = document.createElement('div');
        row.className = 'recipe-ingredient-row';
        row.innerHTML = `
            <input type="text" class="recipe-ing-name" placeholder="Ingredient" value="${ing.name}" />
            <input type="number" class="recipe-ing-qty" placeholder="Qty" min="0.1" step="0.1" value="${ing.quantity}" />
            <input type="text" class="recipe-ing-unit" placeholder="Unit" value="${ing.unit}" />
            <button type="button" class="remove-ing-btn" onclick="this.parentElement.remove()">Remove</button>
        `;
        container.appendChild(row);
    });

    document.getElementById('add-recipe-form').classList.remove('hidden');
}

function deleteRecipe(id) {
    const recipe = recipes.find(r => r.id === id);
    if (confirm('Are you sure you want to delete this recipe?')) {
        const recipeName = recipe ? recipe.name : 'Recipe';

        recipes = recipes.filter(recipe => recipe.id !== id);

        Object.keys(mealPlan).forEach(day => {
            Object.keys(mealPlan[day]).forEach(meal => {
                if (mealPlan[day][meal] === id) {
                    mealPlan[day][meal] = null;
                }
            });
        });

        saveToLocalStorage();
        renderRecipes();
        renderMealPlan();
        updateDashboardStats();

        // Show success toast
        showToast('Recipe Deleted', `${recipeName} has been removed`, 'success');
    }
}

function cookRecipe(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    const status = checkRecipeStatus(recipe);
    if (!status.isReady) {
        alert('You don\'t have all ingredients for this recipe!');
        return;
    }

    if (!confirm(`Cook "${recipe.name}"?\n\nThis will deduct ingredients from your pantry.`)) {
        return;
    }

    let deductedCount = 0;

    // Deduct each ingredient
    recipe.ingredients.forEach(reqIng => {
        let remaining = reqIng.quantity;

        // Check all locations for this ingredient
        ['pantry', 'fridge', 'freezer'].forEach(location => {
            if (remaining <= 0) return;

            const ingIndex = ingredients[location].findIndex(ing =>
                ing.name.toLowerCase() === reqIng.name.toLowerCase() &&
                ing.unit.toLowerCase() === reqIng.unit.toLowerCase()
            );

            if (ingIndex !== -1) {
                const available = ingredients[location][ingIndex].quantity;

                if (available >= remaining) {
                    // We have enough in this location
                    ingredients[location][ingIndex].quantity -= remaining;
                    deductedCount++;

                    // Remove ingredient if quantity hits zero
                    if (ingredients[location][ingIndex].quantity <= 0) {
                        ingredients[location].splice(ingIndex, 1);
                    }

                    remaining = 0;
                } else {
                    // Use all from this location and continue
                    remaining -= available;
                    ingredients[location].splice(ingIndex, 1);
                    deductedCount++;
                }
            }
        });
    });

    saveToLocalStorage();
    renderIngredients();
    renderRecipes();

    alert(`✅ Cooked "${recipe.name}"!\n\n${deductedCount} ingredient types deducted from your pantry.\n\nEnjoy your meal! 🍽️`);
}

function checkRecipeStatus(recipe) {
    const allIngredients = [
        ...ingredients.pantry,
        ...ingredients.fridge,
        ...ingredients.freezer
    ];

    const missing = [];
    const have = [];

    recipe.ingredients.forEach(reqIng => {
        // Find ingredient with matching name and unit
        const found = allIngredients.find(ing =>
            ing.name.toLowerCase() === reqIng.name.toLowerCase() &&
            ing.unit.toLowerCase() === reqIng.unit.toLowerCase()
        );

        if (found && found.quantity >= reqIng.quantity) {
            // Have enough - fully satisfied
            have.push(reqIng);
        } else {
            // Calculate how much more we need
            const haveQty = found ? found.quantity : 0;
            const needQty = reqIng.quantity - haveQty;

            if (needQty > 0) {
                missing.push({
                    name: reqIng.name,
                    quantity: needQty,  // ✅ Only the shortage amount!
                    unit: reqIng.unit
                });
            }

            // If we have some but not enough, still mark as "have partial"
            if (haveQty > 0) {
                have.push({
                    name: reqIng.name,
                    quantity: haveQty,
                    unit: reqIng.unit,
                    partial: true
                });
            }
        }
    });

    return { missing, have, isReady: missing.length === 0 };
}

function updateRecipeStatus() {
    renderRecipes();
}

function adjustServings(recipeId, newServings) {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const originalServings = recipe.servings || 4;
    const ratio = newServings / originalServings;

    // This is just for display, we don't save the adjustment
    return ratio;
}

// Smart Meal Suggestions
function updateMealSuggestions() {
    const suggestionsDiv = document.getElementById('meal-suggestions');
    if (!suggestionsDiv) return;

    const allIngredients = [...ingredients.pantry, ...ingredients.fridge, ...ingredients.freezer];
    const suggestions = [];

    recipes.forEach(recipe => {
        const status = checkRecipeStatus(recipe);

        if (status.isReady) {
            // Check if any ingredients are expiring soon
            const expiringIngredients = [];

            recipe.ingredients.forEach(reqIng => {
                const found = allIngredients.find(ing =>
                    ing.name.toLowerCase() === reqIng.name.toLowerCase() &&
                    ing.unit.toLowerCase() === reqIng.unit.toLowerCase()
                );

                if (found && found.expiration) {
                    const expStatus = getExpirationStatus(found.expiration);
                    if (expStatus === 'expiring-soon' || expStatus === 'expired') {
                        expiringIngredients.push({ name: found.name, status: expStatus });
                    }
                }
            });

            if (expiringIngredients.length > 0) {
                suggestions.push({
                    recipe,
                    priority: expiringIngredients.some(i => i.status === 'expired') ? 'urgent' : 'warning',
                    reason: `${expiringIngredients.length} ingredient(s) ${expiringIngredients.some(i => i.status === 'expired') ? 'expired' : 'expiring soon'}`
                });
            } else {
                // Just ready to cook
                suggestions.push({
                    recipe,
                    priority: 'ready',
                    reason: 'All ingredients available'
                });
            }
        }
    });

    if (suggestions.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }

    // Sort by priority: urgent > warning > ready
    suggestions.sort((a, b) => {
        const order = { urgent: 0, warning: 1, ready: 2 };
        return order[a.priority] - order[b.priority];
    });

    // Take top 5 suggestions
    const topSuggestions = suggestions.slice(0, 5);
    const hasUrgent = topSuggestions.some(s => s.priority === 'urgent' || s.priority === 'warning');

    suggestionsDiv.className = 'meal-suggestions' + (hasUrgent ? ' warning' : '');
    suggestionsDiv.style.display = 'block';

    const icon = hasUrgent ? '⚠️' : '💡';
    const title = hasUrgent ? 'Cook These Soon!' : 'Ready to Cook';

    suggestionsDiv.innerHTML = `
        <h3>${icon} ${title}</h3>
        <ul>
            ${topSuggestions.map(s => `
                <li>
                    <div>
                        <div class="suggestion-recipe">${s.recipe.name}</div>
                        <div class="suggestion-reason">${s.reason}</div>
                    </div>
                    <button onclick="cookRecipe(${s.recipe.id})">🍳 Cook</button>
                </li>
            `).join('')}
        </ul>
    `;
}

function renderRecipes() {
    const recipeList = document.getElementById('recipe-list');

    if (recipes.length === 0) {
        recipeList.innerHTML = '<div class="empty-state"><p>No recipes yet. Add your first recipe!</p></div>';
        document.getElementById('meal-suggestions').style.display = 'none';
        return;
    }

    let filteredRecipes = recipes;

    // Filter by status
    if (currentRecipeFilter === 'ready') {
        filteredRecipes = filteredRecipes.filter(recipe => checkRecipeStatus(recipe).isReady);
    } else if (currentRecipeFilter === 'missing') {
        filteredRecipes = filteredRecipes.filter(recipe => !checkRecipeStatus(recipe).isReady);
    }

    // Filter by category
    if (currentRecipeCategory !== 'all') {
        filteredRecipes = filteredRecipes.filter(recipe => recipe.category === currentRecipeCategory);
    }

    // Filter by search query
    if (recipeSearchQuery) {
        filteredRecipes = filteredRecipes.filter(recipe =>
            recipe.name.toLowerCase().includes(recipeSearchQuery) ||
            recipe.ingredients.some(ing => ing.name.includes(recipeSearchQuery))
        );
    }

    if (filteredRecipes.length === 0) {
        recipeList.innerHTML = '<div class="empty-state"><p>No recipes match your filters</p></div>';
        return;
    }

    recipeList.innerHTML = filteredRecipes.map(recipe => {
        const status = checkRecipeStatus(recipe);
        const statusClass = status.isReady ? 'ready' : 'missing';
        const statusText = status.isReady ? 'Ready to Cook' : 'Need Ingredients';

        return `
            <div class="recipe-card ${statusClass}">
                ${recipe.image ? `<img src="${recipe.image}" alt="${recipe.name}" class="recipe-image" onerror="this.style.display='none'">` : ''}
                ${recipe.category ? `<span class="recipe-category-badge">${recipe.category}</span>` : ''}
                <span class="recipe-status ${statusClass}">${statusText}</span>
                <h3>${recipe.name}</h3>
                <p class="recipe-servings">Serves: ${recipe.servings || 4}</p>

                <div class="recipe-ingredients">
                    <h4>Ingredients:</h4>
                    <ul>
                        ${recipe.ingredients.map(ing => {
                            const hasIt = status.have.some(h => h.name === ing.name);
                            return `<li class="${hasIt ? 'have' : 'need'}">${ing.quantity} ${ing.unit} ${ing.name}</li>`;
                        }).join('')}
                    </ul>
                </div>

                ${!status.isReady ? `
                    <div class="missing-ingredients">
                        <h5>Missing:</h5>
                        <ul>
                            ${status.missing.map(ing => `<li>${ing.quantity} ${ing.unit} ${ing.name}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                ${recipe.instructions ? `<p style="margin-top: 10px; font-size: 0.9em; color: #4a5568;"><strong>Instructions:</strong> ${recipe.instructions}</p>` : ''}

                <div class="recipe-actions">
                    ${status.isReady ? `<button style="background: #667eea; font-weight: bold;" onclick="cookRecipe(${recipe.id})">🍳 Cook This</button>` : ''}
                    <button style="background: #48bb78;" onclick="editRecipe(${recipe.id})">Edit</button>
                    <button class="delete-btn" onclick="deleteRecipe(${recipe.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');

    // Update smart meal suggestions
    updateMealSuggestions();
}

// Shopping List Section
function initShopping() {
    const addShoppingItemBtn = document.getElementById('add-shopping-item-btn');
    const autoGenerateBtn = document.getElementById('auto-generate-list-btn');
    const generateFromMealPlanBtn = document.getElementById('generate-from-meal-plan-btn');
    const clearListBtn = document.getElementById('clear-shopping-list-btn');
    const categoryButtons = document.querySelectorAll('.shop-cat-btn');
    const toggleAddShoppingBtn = document.getElementById('toggle-add-shopping');
    const toggleShoppingActionsBtn = document.getElementById('toggle-shopping-actions');
    const cancelAddShoppingBtn = document.getElementById('cancel-add-shopping');
    const shoppingFormContainer = document.getElementById('add-shopping-form-container');
    const shoppingActionsContainer = document.getElementById('shopping-actions-container');

    // Toggle add shopping form
    if (toggleAddShoppingBtn) {
        toggleAddShoppingBtn.addEventListener('click', () => {
            shoppingFormContainer.classList.toggle('hidden');
        });
    }

    // Toggle shopping actions
    if (toggleShoppingActionsBtn) {
        toggleShoppingActionsBtn.addEventListener('click', () => {
            shoppingActionsContainer.classList.toggle('hidden');
        });
    }

    // Cancel button
    if (cancelAddShoppingBtn) {
        cancelAddShoppingBtn.addEventListener('click', () => {
            shoppingFormContainer.classList.add('hidden');
            clearShoppingForm();
        });
    }

    addShoppingItemBtn.addEventListener('click', addShoppingItem);
    autoGenerateBtn.addEventListener('click', autoGenerateShoppingList);
    generateFromMealPlanBtn.addEventListener('click', generateFromMealPlan);
    clearListBtn.addEventListener('click', clearShoppingList);

    categoryButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentShoppingCategory = btn.dataset.shopCategory;
            categoryButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderShoppingList();
        });
    });

    document.getElementById('shopping-item-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addShoppingItem();
    });

    renderShoppingList();
}

function autoCategorizeShopping(itemName) {
    const name = itemName.toLowerCase();

    const categories = {
        produce: ['lettuce', 'tomato', 'onion', 'carrot', 'potato', 'apple', 'banana', 'orange', 'spinach', 'cucumber', 'pepper', 'garlic', 'celery'],
        dairy: ['milk', 'cheese', 'butter', 'yogurt', 'cream', 'eggs'],
        meat: ['chicken', 'beef', 'pork', 'fish', 'salmon', 'turkey', 'bacon', 'ham'],
        pantry: ['rice', 'pasta', 'flour', 'sugar', 'salt', 'pepper', 'oil', 'sauce', 'can'],
        frozen: ['frozen', 'ice cream'],
        bakery: ['bread', 'bagel', 'roll', 'cake', 'cookie']
    };

    for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => name.includes(keyword))) {
            return category;
        }
    }

    return 'other';
}

function clearShoppingForm() {
    document.getElementById('shopping-item-name').value = '';
    document.getElementById('shopping-item-qty').value = '1';
    document.getElementById('shopping-item-unit').value = '';
    document.getElementById('shopping-item-category').value = 'produce';
}

function addShoppingItem() {
    const nameInput = document.getElementById('shopping-item-name');
    const quantityInput = document.getElementById('shopping-item-qty');
    const unitInput = document.getElementById('shopping-item-unit');
    const categorySelect = document.getElementById('shopping-item-category');

    const name = nameInput.value.trim();
    const quantity = parseFloat(quantityInput.value) || 1;
    const unit = unitInput.value.trim();
    const category = categorySelect.value;

    if (!name) {
        alert('Please enter an item name');
        return;
    }

    const item = {
        id: Date.now(),
        name,
        quantity,
        unit,
        category,
        checked: false
    };

    shoppingList.push(item);
    saveToLocalStorage();
    renderShoppingList();
    updateDashboardStats();

    // Hide form and clear inputs
    const formContainer = document.getElementById('add-shopping-form-container');
    if (formContainer) {
        formContainer.classList.add('hidden');
    }

    nameInput.value = '';
    quantityInput.value = '1';
    unitInput.value = '';
    nameInput.focus();
}

function toggleShoppingItem(id) {
    const item = shoppingList.find(item => item.id === id);
    if (item) {
        item.checked = !item.checked;
        saveToLocalStorage();
        renderShoppingList();
    }
}

function deleteShoppingItem(id) {
    shoppingList = shoppingList.filter(item => item.id !== id);
    saveToLocalStorage();
    renderShoppingList();
    updateDashboardStats();
}

function autoGenerateShoppingList() {
    const missingIngredients = [];

    recipes.forEach(recipe => {
        const status = checkRecipeStatus(recipe);
        status.missing.forEach(ing => {
            const existing = missingIngredients.find(mi => mi.name.toLowerCase() === ing.name.toLowerCase());
            if (existing) {
                existing.quantity += ing.quantity;
            } else {
                missingIngredients.push({ ...ing });
            }
        });
    });

    if (missingIngredients.length === 0) {
        alert('You have all ingredients for your recipes!');
        return;
    }

    missingIngredients.forEach(ing => {
        const alreadyInList = shoppingList.find(item => item.name.toLowerCase() === ing.name.toLowerCase());
        if (!alreadyInList) {
            shoppingList.push({
                id: Date.now() + Math.random(),
                name: ing.name,
                quantity: ing.quantity,
                unit: ing.unit,
                category: autoCategorizeShopping(ing.name),
                checked: false
            });
        }
    });

    saveToLocalStorage();
    renderShoppingList();
    alert(`Added ${missingIngredients.length} missing ingredients to shopping list!`);
}

function generateFromMealPlan() {
    const requiredIngredients = [];

    Object.keys(mealPlan).forEach(day => {
        Object.keys(mealPlan[day]).forEach(meal => {
            const recipeId = mealPlan[day][meal];
            if (recipeId) {
                const recipe = recipes.find(r => r.id === recipeId);
                if (recipe) {
                    recipe.ingredients.forEach(ing => {
                        const existing = requiredIngredients.find(ri => ri.name === ing.name && ri.unit === ing.unit);
                        if (existing) {
                            existing.quantity += ing.quantity;
                        } else {
                            requiredIngredients.push({ ...ing });
                        }
                    });
                }
            }
        });
    });

    if (requiredIngredients.length === 0) {
        alert('Your meal plan is empty!');
        return;
    }

    // Check what's missing from ingredients
    const allIngredients = [...ingredients.pantry, ...ingredients.fridge, ...ingredients.freezer];
    const missing = [];

    requiredIngredients.forEach(reqIng => {
        const have = allIngredients.find(ing =>
            ing.name.toLowerCase() === reqIng.name.toLowerCase() &&
            ing.unit.toLowerCase() === reqIng.unit.toLowerCase()
        );

        const needed = have ? Math.max(0, reqIng.quantity - have.quantity) : reqIng.quantity;

        if (needed > 0) {
            missing.push({
                name: reqIng.name,
                quantity: needed,
                unit: reqIng.unit
            });
        }
    });

    if (missing.length === 0) {
        alert('You have all ingredients for your meal plan!');
        return;
    }

    missing.forEach(ing => {
        const alreadyInList = shoppingList.find(item => item.name.toLowerCase() === ing.name.toLowerCase());
        if (!alreadyInList) {
            shoppingList.push({
                id: Date.now() + Math.random(),
                name: ing.name,
                quantity: ing.quantity,
                unit: ing.unit,
                category: autoCategorizeShopping(ing.name),
                checked: false
            });
        }
    });

    saveToLocalStorage();
    renderShoppingList();
    alert(`Added ${missing.length} ingredients needed for your meal plan!`);
}

function clearShoppingList() {
    if (confirm('Are you sure you want to clear the shopping list?')) {
        shoppingList = [];
        saveToLocalStorage();
        renderShoppingList();
    }
}

function renderShoppingList() {
    const container = document.getElementById('shopping-list-by-category');

    if (shoppingList.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Shopping list is empty</p></div>';
        return;
    }

    let itemsToShow = shoppingList;
    if (currentShoppingCategory !== 'all') {
        itemsToShow = shoppingList.filter(item => item.category === currentShoppingCategory);
    }

    // Group by category
    const byCategory = {};
    itemsToShow.forEach(item => {
        const cat = item.category || 'other';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(item);
    });

    container.innerHTML = Object.keys(byCategory).sort().map(category => {
        const items = byCategory[category];
        return `
            <div class="shopping-category-section">
                <h4>${category.charAt(0).toUpperCase() + category.slice(1)}</h4>
                <ul style="list-style: none;">
                    ${items.map(item => `
                        <li class="${item.checked ? 'checked' : ''}" onclick="toggleShoppingItem(${item.id})" style="background: #f8f9fa; padding: 15px; margin-bottom: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                            <div>
                                <span style="font-weight: 600;">${item.name}</span>
                                <span style="color: #667eea; margin-left: 10px;">${item.quantity} ${item.unit}</span>
                            </div>
                            <button class="delete-btn" onclick="event.stopPropagation(); deleteShoppingItem(${item.id})">Delete</button>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }).join('');
}

// Meal Plan Section
function initMealPlan() {
    renderMealPlan();
}

function renderMealPlan() {
    const mealPlanGrid = document.getElementById('meal-plan-grid');
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const meals = ['breakfast', 'lunch', 'dinner'];

    if (recipes.length === 0) {
        mealPlanGrid.innerHTML = '<div class="empty-state"><p>No recipes available. Add some recipes first to create your meal plan!</p></div>';
        return;
    }

    mealPlanGrid.innerHTML = days.map(day => `
        <div class="meal-day">
            <h3>${day.charAt(0).toUpperCase() + day.slice(1)}</h3>
            <div class="meal-slots">
                ${meals.map(meal => {
                    const selectedRecipe = mealPlan[day][meal];
                    const selectedRecipeExists = recipes.find(r => r.id === selectedRecipe);

                    if (selectedRecipe && !selectedRecipeExists) {
                        mealPlan[day][meal] = null;
                    }

                    const recipeOptions = recipes.map(recipe =>
                        `<option value="${recipe.id}" ${selectedRecipe === recipe.id ? 'selected' : ''}>${recipe.name}</option>`
                    ).join('');

                    return `
                        <div class="meal-slot ${selectedRecipe && selectedRecipeExists ? 'filled' : ''}">
                            <h4>${meal.charAt(0).toUpperCase() + meal.slice(1)}</h4>
                            <select onchange="updateMealPlan('${day}', '${meal}', this.value)">
                                <option value="">-- Select Recipe --</option>
                                ${recipeOptions}
                            </select>
                            ${selectedRecipe && selectedRecipeExists ? `<button class="remove-meal-btn" onclick="removeMealFromPlan('${day}', '${meal}')">Remove</button>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
}

function updateMealPlan(day, meal, recipeId) {
    mealPlan[day][meal] = recipeId ? parseInt(recipeId) : null;
    saveToLocalStorage();
    renderMealPlan();
}

function removeMealFromPlan(day, meal) {
    mealPlan[day][meal] = null;
    saveToLocalStorage();
    renderMealPlan();
}

// Settings Section
function initSettings() {
    // Cloud sync UI is now enabled!
    // Data management listeners
    document.getElementById('export-data-btn').addEventListener('click', exportData);
    document.getElementById('import-trigger-btn').addEventListener('click', () => {
        document.getElementById('import-data-file').click();
    });
    document.getElementById('import-data-file').addEventListener('change', importData);
    document.getElementById('clear-all-data-btn').addEventListener('click', clearAllData);

    // Cloud sync button listeners
    const registerBtn = document.getElementById('register-btn');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const manualSyncBtn = document.getElementById('manual-sync-btn');
    const copyTokenBtn = document.getElementById('copy-token-btn');

    if (registerBtn) {
        registerBtn.addEventListener('click', registerNewUser);
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const token = prompt('Enter your sync token:');
            if (token) {
                loginWithToken(token);
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    if (manualSyncBtn) {
        manualSyncBtn.addEventListener('click', () => {
            syncToServer();
        });
    }

    if (copyTokenBtn) {
        copyTokenBtn.addEventListener('click', copyToken);
    }

    updateStats();
}

function exportData() {
    const data = {
        ingredients,
        recipes,
        shoppingList,
        mealPlan,
        exportDate: new Date().toISOString()
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-pantry-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);

            if (confirm('This will replace all current data. Are you sure?')) {
                ingredients = data.ingredients || { pantry: [], fridge: [], freezer: [] };
                recipes = data.recipes || [];
                shoppingList = data.shoppingList || [];
                mealPlan = data.mealPlan || {
                    monday: { breakfast: null, lunch: null, dinner: null },
                    tuesday: { breakfast: null, lunch: null, dinner: null },
                    wednesday: { breakfast: null, lunch: null, dinner: null },
                    thursday: { breakfast: null, lunch: null, dinner: null },
                    friday: { breakfast: null, lunch: null, dinner: null },
                    saturday: { breakfast: null, lunch: null, dinner: null },
                    sunday: { breakfast: null, lunch: null, dinner: null }
                };

                saveToLocalStorage();

                renderIngredients();
                renderRecipes();
                renderShoppingList();
                renderMealPlan();
                updateStats();

                alert('Data imported successfully!');
            }
        } catch (error) {
            alert('Error importing data. Please make sure the file is valid.');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function clearAllData() {
    if (confirm('This will delete ALL your data. Are you absolutely sure?')) {
        if (confirm('Last chance! This cannot be undone.')) {
            ingredients = { pantry: [], fridge: [], freezer: [] };
            recipes = [];
            shoppingList = [];
            mealPlan = {
                monday: { breakfast: null, lunch: null, dinner: null },
                tuesday: { breakfast: null, lunch: null, dinner: null },
                wednesday: { breakfast: null, lunch: null, dinner: null },
                thursday: { breakfast: null, lunch: null, dinner: null },
                friday: { breakfast: null, lunch: null, dinner: null },
                saturday: { breakfast: null, lunch: null, dinner: null },
                sunday: { breakfast: null, lunch: null, dinner: null }
            };

            saveToLocalStorage();

            renderIngredients();
            renderRecipes();
            renderShoppingList();
            renderMealPlan();
            updateStats();

            alert('All data cleared.');
        }
    }
}

function updateStats() {
    const totalIngredients = ingredients.pantry.length + ingredients.fridge.length + ingredients.freezer.length;
    const totalRecipes = recipes.length;
    const readyRecipes = recipes.filter(r => checkRecipeStatus(r).isReady).length;
    const shoppingItems = shoppingList.length;

    let mealCount = 0;
    Object.keys(mealPlan).forEach(day => {
        Object.keys(mealPlan[day]).forEach(meal => {
            if (mealPlan[day][meal]) mealCount++;
        });
    });

    const expiringCount = Object.values(ingredients).flat().filter(ing => {
        const status = getExpirationStatus(ing.expiration);
        return status === 'expiring-soon' || status === 'expired';
    }).length;

    const statsDisplay = document.getElementById('stats-display');
    statsDisplay.innerHTML = `
        <div class="stat-item">
            <span class="stat-value">${totalIngredients}</span>
            <span class="stat-label">Total Ingredients</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${totalRecipes}</span>
            <span class="stat-label">Recipes</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${readyRecipes}</span>
            <span class="stat-label">Ready to Cook</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${mealCount}</span>
            <span class="stat-label">Meals Planned</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${shoppingItems}</span>
            <span class="stat-label">Shopping Items</span>
        </div>
        ${expiringCount > 0 ? `
        <div class="stat-item">
            <span class="stat-value" style="color: #e53e3e;">${expiringCount}</span>
            <span class="stat-label">Expiring Items</span>
        </div>
        ` : ''}
    `;
}

// ==================== AUTHENTICATION & SYNC ====================

function initAuth() {
    userToken = localStorage.getItem('smartPantry_token');
    updateAuthUI();

    if (userToken) {
        syncFromServer();
    }
}

function updateAuthUI() {
    const loggedOutState = document.getElementById('logged-out-state');
    const loggedInState = document.getElementById('logged-in-state');
    const displayToken = document.getElementById('display-token');

    if (userToken) {
        if (loggedOutState) loggedOutState.style.display = 'none';
        if (loggedInState) loggedInState.style.display = 'block';
        if (displayToken) displayToken.textContent = userToken;
        updateSyncStatus();
    } else {
        if (loggedOutState) loggedOutState.style.display = 'block';
        if (loggedInState) loggedInState.style.display = 'none';
    }
}

async function registerNewUser() {
    try {
        const response = await fetch(API_BASE_URL + '/api/planner/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
            userToken = data.token;
            localStorage.setItem('smartPantry_token', userToken);
            updateAuthUI();
            await syncToServer();
            showToast('Account Created!', 'Token: ' + userToken + ' - Save this to access your data from any device!', 'success');
        } else {
            showToast('Registration Failed', 'Please try again', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Network Error', 'Please check your connection', 'error');
    }
}

async function loginWithToken(token) {
    try {
        const response = await fetch(API_BASE_URL + '/api/planner/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token.trim().toUpperCase() })
        });

        const data = await response.json();

        if (data.success) {
            userToken = data.token;
            localStorage.setItem('smartPantry_token', userToken);
            await syncFromServer();
            updateAuthUI();
            showToast('Login Successful!', 'Your data has been synced', 'success');
        } else {
            showToast('Invalid Token', 'Please check and try again', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Network Error', 'Please check your connection', 'error');
    }
}

function logout() {
    if (confirm('Are you sure you want to logout? Your data will remain saved locally on this device.')) {
        localStorage.removeItem('smartPantry_token');
        localStorage.removeItem('smartPantry_lastSync');
        userToken = null;
        updateAuthUI();
        alert('Logged out successfully');
    }
}

async function syncToServer() {
    if (!userToken || isSyncing) return;

    isSyncing = true;
    updateSyncStatus('Syncing to cloud...');

    try {
        // Ensure data is valid before syncing
        const safeIngredients = {
            pantry: Array.isArray(ingredients.pantry) ? ingredients.pantry : [],
            fridge: Array.isArray(ingredients.fridge) ? ingredients.fridge : [],
            freezer: Array.isArray(ingredients.freezer) ? ingredients.freezer : []
        };
        const safeRecipes = Array.isArray(recipes) ? recipes : [];
        const safeShoppingList = Array.isArray(shoppingList) ? shoppingList : [];
        const safeMealPlan = typeof mealPlan === 'object' && mealPlan !== null ? mealPlan : {
            monday: { breakfast: null, lunch: null, dinner: null },
            tuesday: { breakfast: null, lunch: null, dinner: null },
            wednesday: { breakfast: null, lunch: null, dinner: null },
            thursday: { breakfast: null, lunch: null, dinner: null },
            friday: { breakfast: null, lunch: null, dinner: null },
            saturday: { breakfast: null, lunch: null, dinner: null },
            sunday: { breakfast: null, lunch: null, dinner: null }
        };

        // Store all pantry data as a single "task" object (server expects tasks array)
        const pantryData = {
            id: 1, // Use a fixed ID since we only have one data object
            ingredients: safeIngredients,
            recipes: safeRecipes,
            shoppingList: safeShoppingList,
            mealPlan: safeMealPlan,
            version: '2.5',
            lastUpdated: new Date().toISOString()
        };

        const response = await fetch(API_BASE_URL + '/api/planner/tasks/' + userToken, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tasks: [pantryData] }) // Wrap in tasks array
        });

        const result = await response.json();

        if (result.success) {
            localStorage.setItem('smartPantry_lastSync', new Date().toISOString());
            updateSyncStatus();
            console.log('Sync complete');
        } else {
            updateSyncStatus('Sync failed - will retry');
        }
    } catch (error) {
        console.error('Sync error:', error);
        updateSyncStatus('Sync failed - will retry');
    } finally {
        isSyncing = false;
    }
}

async function syncFromServer() {
    if (!userToken || isSyncing) return;

    isSyncing = true;
    updateSyncStatus('Downloading from cloud...');

    try {
        const response = await fetch(API_BASE_URL + '/api/planner/tasks/' + userToken);
        const result = await response.json();

        if (result.success && result.tasks && Array.isArray(result.tasks)) {
            // Extract our pantry data from the tasks array (we stored it as task with id: 1)
            const pantryTask = result.tasks.find(task => task.id === 1);
            const pantryData = pantryTask || null;

            if (pantryData) {
                // Restore ingredients
                if (pantryData.ingredients && pantryData.ingredients.pantry && pantryData.ingredients.fridge && pantryData.ingredients.freezer) {
                    ingredients = pantryData.ingredients;
                }

                // Restore recipes
                if (pantryData.recipes) {
                    recipes = Array.isArray(pantryData.recipes) ? pantryData.recipes : [];
                }

                // Restore shopping list
                if (pantryData.shoppingList) {
                    shoppingList = Array.isArray(pantryData.shoppingList) ? pantryData.shoppingList : [];
                }

                // Restore meal plan
                if (pantryData.mealPlan && typeof pantryData.mealPlan === 'object') {
                    mealPlan = pantryData.mealPlan;
                }
            }

            saveToLocalStorage();
            renderIngredients();
            renderRecipes();
            renderShoppingList();
            renderMealPlan();
            updateStats();
            updateDashboardStats();

            localStorage.setItem('smartPantry_lastSync', new Date().toISOString());
            updateSyncStatus();
            console.log('Download complete');
        } else {
            console.log('No data found on server');
            updateSyncStatus();
        }
    } catch (error) {
        console.error('Sync error:', error);
        updateSyncStatus('Download failed');
    } finally {
        isSyncing = false;
    }
}

function updateSyncStatus(message) {
    const syncStatus = document.getElementById('sync-status');
    if (!syncStatus) return;

    if (message) {
        syncStatus.textContent = message;
        syncStatus.style.background = '#fff3cd';
    } else {
        const lastSync = localStorage.getItem('smartPantry_lastSync');
        if (lastSync) {
            const date = new Date(lastSync);
            syncStatus.textContent = 'Last synced: ' + date.toLocaleString();
            syncStatus.style.background = '#f0fff4';
        } else {
            syncStatus.textContent = 'Last synced: Never';
            syncStatus.style.background = '#f8f9fa';
        }
    }
}

function copyToken() {
    if (userToken) {
        navigator.clipboard.writeText(userToken);
        alert('Token copied to clipboard!');
    }
}

function saveToLocalStorageAndSync() {
    saveToLocalStorage();

    if (userToken && !isSyncing) {
        clearTimeout(window.syncTimeout);
        window.syncTimeout = setTimeout(() => {
            syncToServer();
        }, 2000);
    }
}
