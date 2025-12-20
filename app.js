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
    monday: { breakfast: { personA: [], personB: [], joint: [] }, lunch: { personA: [], personB: [], joint: [] }, dinner: { personA: [], personB: [], joint: [] } },
    tuesday: { breakfast: { personA: [], personB: [], joint: [] }, lunch: { personA: [], personB: [], joint: [] }, dinner: { personA: [], personB: [], joint: [] } },
    wednesday: { breakfast: { personA: [], personB: [], joint: [] }, lunch: { personA: [], personB: [], joint: [] }, dinner: { personA: [], personB: [], joint: [] } },
    thursday: { breakfast: { personA: [], personB: [], joint: [] }, lunch: { personA: [], personB: [], joint: [] }, dinner: { personA: [], personB: [], joint: [] } },
    friday: { breakfast: { personA: [], personB: [], joint: [] }, lunch: { personA: [], personB: [], joint: [] }, dinner: { personA: [], personB: [], joint: [] } },
    saturday: { breakfast: { personA: [], personB: [], joint: [] }, lunch: { personA: [], personB: [], joint: [] }, dinner: { personA: [], personB: [], joint: [] } },
    sunday: { breakfast: { personA: [], personB: [], joint: [] }, lunch: { personA: [], personB: [], joint: [] }, dinner: { personA: [], personB: [], joint: [] } }
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

// Meal Plan UI State
let expandedMealDays = new Set(); // Track which days are expanded

// Helper function to get all unique units from ingredients and recipes
function getAllUnits() {
    const units = new Set();

    // Get units from ingredients
    ['pantry', 'fridge', 'freezer'].forEach(location => {
        ingredients[location].forEach(item => {
            if (item.unit && item.unit.trim()) {
                units.add(item.unit.trim().toLowerCase());
            }
        });
    });

    // Get units from recipes
    recipes.forEach(recipe => {
        if (recipe.ingredients) {
            recipe.ingredients.forEach(ing => {
                if (ing.unit && ing.unit.trim()) {
                    units.add(ing.unit.trim().toLowerCase());
                }
            });
        }
    });

    return Array.from(units).sort();
}

// Helper function to get all unique ingredient names
function getAllIngredientNames() {
    const names = new Set();

    // Get from ingredients
    ['pantry', 'fridge', 'freezer'].forEach(location => {
        ingredients[location].forEach(item => {
            if (item.name && item.name.trim()) {
                names.add(item.name.trim().toLowerCase());
            }
        });
    });

    // Get from recipes
    recipes.forEach(recipe => {
        if (recipe.ingredients) {
            recipe.ingredients.forEach(ing => {
                if (ing.name && ing.name.trim()) {
                    names.add(ing.name.trim().toLowerCase());
                }
            });
        }
    });

    return Array.from(names).sort();
}

// Update datalists for autocomplete
function updateDataLists() {
    // Update units datalist
    const unitsList = document.getElementById('units-list');
    if (unitsList) {
        const units = getAllUnits();
        unitsList.innerHTML = units.map(unit => `<option value="${unit}">`).join('');
    }

    // Update ingredient names datalist
    const namesList = document.getElementById('ingredient-names-list');
    if (namesList) {
        const names = getAllIngredientNames();
        namesList.innerHTML = names.map(name => `<option value="${name}">`).join('');
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    updateDataLists(); // Populate autocomplete lists
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

            // Refresh sections when navigating to them
            if (targetSection === 'settings') {
                updateStats();
            } else if (targetSection === 'recipes') {
                renderRecipes(); // Refresh recipe sections to update Cook Soon etc.
            } else if (targetSection === 'dashboard') {
                updateDashboardStats(); // Refresh dashboard stats
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

    // Show today's meal plan
    updateTodaysMeals();
}

function updateTodaysMeals() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[new Date().getDay()];
    const todayMeals = mealPlan[today];

    const container = document.getElementById('today-meal-plan');
    const content = document.getElementById('today-meals-content');

    if (!todayMeals) {
        container.style.display = 'none';
        return;
    }

    // Check if there are any meals planned for today
    const hasMeals = ['breakfast', 'lunch', 'dinner'].some(meal => {
        const mealSlot = todayMeals[meal];
        if (typeof mealSlot === 'object' && mealSlot !== null) {
            return (mealSlot.personA && mealSlot.personA.length > 0) ||
                   (mealSlot.personB && mealSlot.personB.length > 0) ||
                   (mealSlot.joint && mealSlot.joint.length > 0);
        }
        return false;
    });

    if (!hasMeals) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    const mealsHtml = ['breakfast', 'lunch', 'dinner'].map(meal => {
        const mealSlot = todayMeals[meal];
        if (!mealSlot || typeof mealSlot !== 'object') return '';

        const allRecipes = [
            ...(mealSlot.personA || []),
            ...(mealSlot.personB || []),
            ...(mealSlot.joint || [])
        ].filter((id, index, self) => self.indexOf(id) === index); // Unique IDs

        if (allRecipes.length === 0) return '';

        const recipeNames = allRecipes.map(id => {
            const recipe = recipes.find(r => r.id === id);
            return recipe ? recipe.name : 'Unknown Recipe';
        }).join(', ');

        const mealIcon = meal === 'breakfast' ? '🌅' : meal === 'lunch' ? '☀️' : '🌙';

        return `
            <div style="padding: 12px; background: #f7fafc; border-radius: 8px; margin-bottom: 10px;">
                <div style="font-weight: 700; color: #667eea; margin-bottom: 5px;">
                    ${mealIcon} ${meal.charAt(0).toUpperCase() + meal.slice(1)}
                </div>
                <div style="color: #4a5568;">${recipeNames}</div>
            </div>
        `;
    }).filter(html => html).join('');

    content.innerHTML = mealsHtml;
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
                updateDataLists(); // Refresh autocomplete options
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
    updateDataLists(); // Update autocomplete options

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
            const mealSlot = mealPlan[day][meal];

            // Handle both old format (single recipeId) and new format (personA/personB/joint)
            if (typeof mealSlot === 'number') {
                // Old format - single recipe ID
                const recipe = recipes.find(r => r.id === mealSlot);
                if (recipe && recipe.ingredients) {
                    recipe.ingredients.forEach(ing => {
                        const key = `${ing.name.toLowerCase()}|${ing.unit.toLowerCase()}`;
                        reserved[key] = (reserved[key] || 0) + ing.quantity;
                    });
                }
            } else if (mealSlot && typeof mealSlot === 'object') {
                // New format - personA/personB/joint arrays
                ['personA', 'personB', 'joint'].forEach(person => {
                    if (Array.isArray(mealSlot[person])) {
                        mealSlot[person].forEach(recipeId => {
                            const recipe = recipes.find(r => r.id === recipeId);
                            if (recipe && recipe.ingredients) {
                                recipe.ingredients.forEach(ing => {
                                    const key = `${ing.name.toLowerCase()}|${ing.unit.toLowerCase()}`;
                                    reserved[key] = (reserved[key] || 0) + ing.quantity;
                                });
                            }
                        });
                    }
                });
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

        // Sort alphabetically
        items = items.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

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
        <input type="text" class="recipe-ing-name" placeholder="Ingredient" list="ingredient-names-list" />
        <input type="number" class="recipe-ing-qty" placeholder="Qty" min="0.1" step="0.1" value="1" />
        <input type="text" class="recipe-ing-unit" placeholder="Unit" list="units-list" />
        <button type="button" class="remove-ing-btn" onclick="this.parentElement.remove()">Remove</button>
    `;
    container.appendChild(row);
    updateDataLists(); // Refresh autocomplete options when adding new row
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
            <input type="text" class="recipe-ing-name" placeholder="Ingredient" list="ingredient-names-list" />
            <input type="number" class="recipe-ing-qty" placeholder="Qty" min="0.1" step="0.1" value="1" />
            <input type="text" class="recipe-ing-unit" placeholder="Unit" list="units-list" />
            <button type="button" class="remove-ing-btn" onclick="this.parentElement.remove()">Remove</button>
        </div>
    `;
    updateDataLists(); // Refresh autocomplete options
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
    updateDataLists(); // Update autocomplete options

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
            <input type="text" class="recipe-ing-name" placeholder="Ingredient" value="${ing.name}" list="ingredient-names-list" />
            <input type="number" class="recipe-ing-qty" placeholder="Qty" min="0.1" step="0.1" value="${ing.quantity}" />
            <input type="text" class="recipe-ing-unit" placeholder="Unit" value="${ing.unit}" list="units-list" />
            <button type="button" class="remove-ing-btn" onclick="this.parentElement.remove()">Remove</button>
        `;
        container.appendChild(row);
    });

    updateDataLists(); // Refresh autocomplete options
    document.getElementById('add-recipe-form').classList.remove('hidden');
}

function deleteRecipe(id) {
    const recipe = recipes.find(r => r.id === id);
    if (confirm('Are you sure you want to delete this recipe?')) {
        const recipeName = recipe ? recipe.name : 'Recipe';

        recipes = recipes.filter(recipe => recipe.id !== id);

        Object.keys(mealPlan).forEach(day => {
            Object.keys(mealPlan[day]).forEach(meal => {
                const mealSlot = mealPlan[day][meal];
                if (typeof mealSlot === 'number' && mealSlot === id) {
                    // Old format
                    mealPlan[day][meal] = { personA: [], personB: [], joint: [] };
                } else if (mealSlot && typeof mealSlot === 'object') {
                    // New format - remove from all arrays
                    if (Array.isArray(mealSlot.personA)) {
                        mealSlot.personA = mealSlot.personA.filter(recipeId => recipeId !== id);
                    }
                    if (Array.isArray(mealSlot.personB)) {
                        mealSlot.personB = mealSlot.personB.filter(recipeId => recipeId !== id);
                    }
                    if (Array.isArray(mealSlot.joint)) {
                        mealSlot.joint = mealSlot.joint.filter(recipeId => recipeId !== id);
                    }
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

function toggleFavorite(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    recipe.favorite = !recipe.favorite;
    saveToLocalStorage();
    renderRecipes();

    const message = recipe.favorite ? `${recipe.name} added to favorites!` : `${recipe.name} removed from favorites`;
    showToast(recipe.favorite ? 'Added to Favorites' : 'Removed from Favorites', message, 'success');
}

function scaleRecipe(recipeId, multiplier) {
    const scale = parseFloat(multiplier);
    const ingredientsList = document.getElementById(`ingredients-list-${recipeId}`);
    if (!ingredientsList) return;

    const items = ingredientsList.querySelectorAll('li');
    items.forEach(item => {
        const baseQty = parseFloat(item.getAttribute('data-base-qty'));
        const qtyDisplay = item.querySelector('.qty-display');
        if (qtyDisplay && !isNaN(baseQty)) {
            const scaledQty = (baseQty * scale).toFixed(2);
            // Remove trailing zeros and decimal point if whole number
            const formatted = parseFloat(scaledQty).toString();
            qtyDisplay.textContent = formatted;
        }
    });
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
    } else if (currentRecipeFilter === 'favorites') {
        filteredRecipes = filteredRecipes.filter(recipe => recipe.favorite === true);
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

    // Helper function to check if recipe has expiring ingredients
    function hasExpiringIngredients(recipe) {
        const allIngredients = [...ingredients.pantry, ...ingredients.fridge, ...ingredients.freezer];
        return recipe.ingredients.some(recipeIng => {
            const ingredient = allIngredients.find(inv =>
                inv.name.toLowerCase() === recipeIng.name.toLowerCase()
            );
            if (!ingredient || !ingredient.expiration) return false;
            const expStatus = getExpirationStatus(ingredient.expiration);
            return expStatus === 'expiring-soon' || expStatus === 'expired';
        });
    }

    // Categorize recipes into three groups
    const readyRecipes = [];
    const cookSoonRecipes = [];
    const needIngredientsRecipes = [];

    filteredRecipes.forEach(recipe => {
        const status = checkRecipeStatus(recipe);
        if (status.isReady) {
            if (hasExpiringIngredients(recipe)) {
                cookSoonRecipes.push(recipe);
            } else {
                readyRecipes.push(recipe);
            }
        } else {
            needIngredientsRecipes.push(recipe);
        }
    });

    // Sort each group alphabetically
    readyRecipes.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    cookSoonRecipes.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    needIngredientsRecipes.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    // Render function for recipe cards
    function renderRecipeCard(recipe, showExpiringBadge = false) {
        const status = checkRecipeStatus(recipe);
        const statusClass = status.isReady ? 'ready' : 'missing';
        const statusText = status.isReady ? 'Ready to Cook' : 'Need Ingredients';

        return `
            <div class="recipe-card ${statusClass}">
                <button onclick="toggleFavorite(${recipe.id})" style="position: absolute; top: 10px; right: 10px; background: ${recipe.favorite ? '#fbbf24' : 'rgba(255,255,255,0.9)'}; border: 2px solid #fbbf24; border-radius: 50%; width: 40px; height: 40px; font-size: 20px; cursor: pointer; z-index: 10; transition: all 0.2s;" title="${recipe.favorite ? 'Remove from favorites' : 'Add to favorites'}">
                    ${recipe.favorite ? '⭐' : '☆'}
                </button>
                ${recipe.image ? `<img src="${recipe.image}" alt="${recipe.name}" class="recipe-image" onerror="this.style.display='none'">` : ''}
                ${recipe.category ? `<span class="recipe-category-badge">${recipe.category}</span>` : ''}
                ${showExpiringBadge ? `<span class="recipe-status expiring" style="background: #f59e0b;">🔥 Cook These Soon!</span>` : `<span class="recipe-status ${statusClass}">${statusText}</span>`}
                <h3>${recipe.name}</h3>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                    <p class="recipe-servings" style="margin: 0;">Serves: ${recipe.servings || 4}</p>
                    <select onchange="scaleRecipe(${recipe.id}, this.value)" style="padding: 4px 8px; border: 2px solid #e2e8f0; border-radius: 6px; font-size: 13px;">
                        <option value="0.5">×0.5</option>
                        <option value="1" selected>×1</option>
                        <option value="1.5">×1.5</option>
                        <option value="2">×2</option>
                        <option value="3">×3</option>
                    </select>
                </div>

                <div class="recipe-ingredients">
                    <h4>Ingredients:</h4>
                    <ul id="ingredients-list-${recipe.id}">
                        ${recipe.ingredients.map(ing => {
                            const hasIt = status.have.some(h => h.name === ing.name);
                            return `<li class="${hasIt ? 'have' : 'need'}" data-base-qty="${ing.quantity}"><span class="qty-display">${ing.quantity}</span> ${ing.unit} ${ing.name}</li>`;
                        }).join('')}
                    </ul>
                </div>

                ${!status.isReady ? `
                    <div class="missing-ingredients">
                        <h5>Missing ${status.missing.length} ingredient${status.missing.length > 1 ? 's' : ''}:</h5>
                        <ul>
                            ${status.missing.map(ing => `<li>${ing.quantity} ${ing.unit} ${ing.name}</li>`).join('')}
                        </ul>
                        <div style="display: flex; gap: 10px; align-items: center; margin-top: 10px;">
                            <select id="servings-multiplier-${recipe.id}" style="padding: 8px; border: 2px solid #e2e8f0; border-radius: 6px; font-size: 14px;">
                                <option value="0.5">×0.5 (Half)</option>
                                <option value="1" selected>×1 (Original)</option>
                                <option value="1.5">×1.5</option>
                                <option value="2">×2 (Double)</option>
                                <option value="3">×3 (Triple)</option>
                                <option value="4">×4</option>
                            </select>
                            <button style="background: #f59e0b; flex: 1; padding: 10px;" onclick="addMissingToShopping(${recipe.id}, parseFloat(document.getElementById('servings-multiplier-${recipe.id}').value))">
                                📝 Add to Shopping
                            </button>
                        </div>
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
    }

    // Build 3-column responsive layout
    let html = `
        <div class="recipe-sections-container">
            <div class="recipe-section ready-section">
                <div class="section-header-card" style="background: #f0fff4; border-left: 4px solid #48bb78;">
                    <h3 style="margin: 0; color: #48bb78; font-size: 16px; font-weight: 700;">✅ Ready to Cook (${readyRecipes.length})</h3>
                </div>
                <div class="recipe-cards-wrapper">
                    ${readyRecipes.map(recipe => renderRecipeCard(recipe)).join('')}
                    ${readyRecipes.length === 0 ? '<p style="text-align: center; color: #718096; padding: 20px;">No ready recipes</p>' : ''}
                </div>
            </div>

            <div class="recipe-section cook-soon-section">
                <div class="section-header-card" style="background: #fffaf0; border-left: 4px solid #f59e0b;">
                    <h3 style="margin: 0; color: #f59e0b; font-size: 16px; font-weight: 700;">🔥 Cook These Soon! (${cookSoonRecipes.length})</h3>
                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #c05621;">Ingredients expiring soon</p>
                </div>
                <div class="recipe-cards-wrapper">
                    ${cookSoonRecipes.map(recipe => renderRecipeCard(recipe, true)).join('')}
                    ${cookSoonRecipes.length === 0 ? '<p style="text-align: center; color: #718096; padding: 20px;">No expiring ingredients</p>' : ''}
                </div>
            </div>

            <div class="recipe-section need-ingredients-section">
                <div class="section-header-card" style="background: #fef5e7; border-left: 4px solid #ed8936;">
                    <h3 style="margin: 0; color: #ed8936; font-size: 16px; font-weight: 700;">📝 Need Ingredients (${needIngredientsRecipes.length})</h3>
                </div>
                <div class="recipe-cards-wrapper">
                    ${needIngredientsRecipes.map(recipe => renderRecipeCard(recipe)).join('')}
                    ${needIngredientsRecipes.length === 0 ? '<p style="text-align: center; color: #718096; padding: 20px;">All recipes ready!</p>' : ''}
                </div>
            </div>
        </div>
    `;

    recipeList.innerHTML = html;

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

    const printListBtn = document.getElementById('print-shopping-list-btn');
    if (printListBtn) {
        printListBtn.addEventListener('click', printShoppingList);
    }

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
        checked: false,
        purchasedQuantity: null,
        targetLocation: getSuggestedLocation(category)
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

function addMissingToShopping(recipeId, servingsMultiplier = 1) {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const status = checkRecipeStatus(recipe);
    if (status.missing.length === 0) {
        showToast('All Set!', 'You have all ingredients for this recipe', 'info');
        return;
    }

    let addedCount = 0;
    status.missing.forEach(ing => {
        const scaledQuantity = ing.quantity * servingsMultiplier;

        // Check if already in shopping list
        const existing = shoppingList.find(item =>
            item.name.toLowerCase() === ing.name.toLowerCase() &&
            item.unit.toLowerCase() === ing.unit.toLowerCase()
        );

        if (existing) {
            // Add to existing quantity
            existing.quantity += scaledQuantity;
            addedCount++;
        } else {
            // Add new item
            const category = autoCategorizeShopping(ing.name);
            shoppingList.push({
                id: Date.now() + Math.random(),
                name: ing.name,
                quantity: scaledQuantity,
                unit: ing.unit,
                category: category,
                checked: false,
                purchasedQuantity: null,
                targetLocation: getSuggestedLocation(category)
            });
            addedCount++;
        }
    });

    saveToLocalStorage();
    renderShoppingList();
    updateDashboardStats();

    const multiplierText = servingsMultiplier !== 1 ? ` (×${servingsMultiplier})` : '';
    showToast('Added to Shopping List', `${addedCount} ingredient${addedCount > 1 ? 's' : ''} from ${recipe.name}${multiplierText}`, 'success');
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
        showToast('All Set!', 'You have all ingredients for your recipes!', 'success');
        return;
    }

    let addedCount = 0;
    missingIngredients.forEach(ing => {
        const alreadyInList = shoppingList.find(item =>
            item.name.toLowerCase() === ing.name.toLowerCase() &&
            item.unit.toLowerCase() === ing.unit.toLowerCase()
        );
        if (!alreadyInList) {
            const category = autoCategorizeShopping(ing.name);
            shoppingList.push({
                id: Date.now() + Math.random(),
                name: ing.name,
                quantity: ing.quantity,
                unit: ing.unit,
                category: category,
                checked: false,
                purchasedQuantity: null,
                targetLocation: getSuggestedLocation(category)
            });
            addedCount++;
        }
    });

    saveToLocalStorage();
    renderShoppingList();
    updateDashboardStats();
    showToast('Added to Shopping List', `${addedCount} missing ingredient${addedCount > 1 ? 's' : ''} from recipes`, 'success');
}

function generateFromMealPlan() {
    const requiredIngredients = [];

    Object.keys(mealPlan).forEach(day => {
        Object.keys(mealPlan[day]).forEach(meal => {
            const mealSlot = mealPlan[day][meal];

            // Handle both old format (single recipeId) and new format (personA/personB/joint)
            let recipeIds = [];
            if (typeof mealSlot === 'number') {
                // Old format - single recipe ID
                recipeIds = [mealSlot];
            } else if (mealSlot && typeof mealSlot === 'object') {
                // New format - personA/personB/joint arrays
                recipeIds = [
                    ...(mealSlot.personA || []),
                    ...(mealSlot.personB || []),
                    ...(mealSlot.joint || [])
                ];
            }

            // Process all recipes in this meal slot
            recipeIds.forEach(recipeId => {
                const recipe = recipes.find(r => r.id === recipeId);
                if (recipe && recipe.ingredients) {
                    recipe.ingredients.forEach(ing => {
                        const existing = requiredIngredients.find(ri =>
                            ri.name.toLowerCase() === ing.name.toLowerCase() &&
                            ri.unit.toLowerCase() === ing.unit.toLowerCase()
                        );
                        if (existing) {
                            existing.quantity += ing.quantity;
                        } else {
                            requiredIngredients.push({ ...ing });
                        }
                    });
                }
            });
        });
    });

    if (requiredIngredients.length === 0) {
        showToast('Empty Meal Plan', 'Your meal plan is empty! Add some recipes first.', 'info');
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
        showToast('All Set!', 'You have all ingredients for your meal plan!', 'success');
        return;
    }

    let addedCount = 0;
    missing.forEach(ing => {
        const alreadyInList = shoppingList.find(item =>
            item.name.toLowerCase() === ing.name.toLowerCase() &&
            item.unit.toLowerCase() === ing.unit.toLowerCase()
        );
        if (!alreadyInList) {
            const category = autoCategorizeShopping(ing.name);
            shoppingList.push({
                id: Date.now() + Math.random(),
                name: ing.name,
                quantity: ing.quantity,
                unit: ing.unit,
                category: category,
                checked: false,
                purchasedQuantity: null,
                targetLocation: getSuggestedLocation(category)
            });
            addedCount++;
        }
    });

    saveToLocalStorage();
    renderShoppingList();
    updateDashboardStats();
    showToast('Added to Shopping List', `${addedCount} ingredient${addedCount > 1 ? 's' : ''} from meal plan`, 'success');
}

function clearShoppingList() {
    if (confirm('Are you sure you want to clear the shopping list?')) {
        shoppingList = [];
        saveToLocalStorage();
        renderShoppingList();
    }
}

function printShoppingList() {
    if (shoppingList.length === 0) {
        showToast('Nothing to Print', 'Shopping list is empty', 'info');
        return;
    }

    // Group by category
    const byCategory = {};
    shoppingList.forEach(item => {
        const cat = item.category || 'other';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(item);
    });

    // Build print-friendly HTML
    const categoryLabels = {
        produce: '🥬 Produce',
        dairy: '🥛 Dairy',
        meat: '🥩 Meat/Seafood',
        pantry: '🥫 Pantry',
        frozen: '❄️ Frozen',
        bakery: '🍞 Bakery',
        other: '📦 Other'
    };

    let printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Shopping List - ${new Date().toLocaleDateString()}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                h1 { color: #667eea; border-bottom: 3px solid #667eea; padding-bottom: 10px; }
                h2 { color: #4a5568; margin-top: 25px; font-size: 18px; }
                ul { list-style: none; padding: 0; }
                li { padding: 8px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; }
                .checkbox { width: 20px; height: 20px; border: 2px solid #cbd5e0; margin-right: 15px; display: inline-block; }
                .item-name { font-weight: 600; flex: 1; }
                .item-qty { color: #718096; }
                @media print { body { padding: 10px; } }
            </style>
        </head>
        <body>
            <h1>🛒 Shopping List</h1>
            <p style="color: #718096;">Generated on ${new Date().toLocaleString()}</p>
    `;

    Object.keys(byCategory).sort().forEach(category => {
        const items = byCategory[category];
        printHTML += `<h2>${categoryLabels[category] || category}</h2><ul>`;
        items.forEach(item => {
            printHTML += `
                <li>
                    <span class="checkbox"></span>
                    <span class="item-name">${item.name}</span>
                    <span class="item-qty">${item.quantity} ${item.unit}</span>
                </li>
            `;
        });
        printHTML += '</ul>';
    });

    printHTML += `
            <p style="margin-top: 40px; color: #718096; font-size: 14px;">
                Total items: ${shoppingList.length}
            </p>
        </body>
        </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 250);

    showToast('Print Ready', 'Shopping list opened in new window', 'success');
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

    const hasCheckedItems = shoppingList.some(item => item.checked);
    const hasUncheckedItems = shoppingList.some(item => !item.checked);

    let html = '';

    // Add quick-add common items
    html += `
        <div style="background: #f7fafc; padding: 15px; border-radius: 12px; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h4 style="margin: 0; font-size: 14px; color: #4a5568;">Quick Add Common Items</h4>
                ${shoppingList.length > 0 ? `
                    <button onclick="copyShoppingListToClipboard()" style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">
                        📋 Copy List
                    </button>
                ` : ''}
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${['Milk', 'Eggs', 'Bread', 'Butter', 'Chicken', 'Rice', 'Pasta', 'Onions', 'Garlic', 'Tomatoes'].map(item => `
                    <button onclick="quickAddItem('${item}')" style="padding: 6px 12px; background: white; border: 2px solid #e2e8f0; border-radius: 6px; font-size: 13px; cursor: pointer; transition: all 0.2s;">
                        + ${item}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    // Add bulk action buttons
    if (shoppingList.length > 0) {
        html += `
            <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                ${hasUncheckedItems ? `
                    <button onclick="checkAllShoppingItems()" style="flex: 1; min-width: 140px; padding: 10px 15px; background: #667eea; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        ✓ Check All
                    </button>
                ` : ''}
                ${hasCheckedItems ? `
                    <button onclick="uncheckAllShoppingItems()" style="flex: 1; min-width: 140px; padding: 10px 15px; background: #718096; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        ✗ Uncheck All
                    </button>
                    <button onclick="clearCheckedShoppingItems()" style="flex: 1; min-width: 140px; padding: 10px 15px; background: #e53e3e; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        🗑️ Clear Checked
                    </button>
                ` : ''}
            </div>
        `;
    }

    // Add "Move to Inventory" button if there are checked items
    if (hasCheckedItems) {
        html += `
            <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                <button onclick="moveCheckedToInventory()" style="background: white; color: #38a169; width: 100%; padding: 12px; border: none; border-radius: 8px; font-weight: 700; font-size: 16px; cursor: pointer;">
                    ✅ Move Checked Items to Inventory
                </button>
            </div>
        `;
    }

    html += Object.keys(byCategory).sort().map(category => {
        const items = byCategory[category].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        return `
            <div class="shopping-category-section">
                <h4>${category.charAt(0).toUpperCase() + category.slice(1)}</h4>
                <ul style="list-style: none;">
                    ${items.map(item => `
                        <li class="${item.checked ? 'checked' : ''}" style="background: #f8f9fa; padding: 15px; margin-bottom: 10px; border-radius: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${item.checked ? '10px' : '5px'};">
                                <div onclick="toggleShoppingItem(${item.id})" style="cursor: pointer; flex: 1;">
                                    <span style="font-weight: 600; font-size: 15px;">${item.name}</span>
                                </div>
                                <div style="display: flex; gap: 5px;">
                                    <button onclick="editShoppingItem(${item.id})" style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Edit</button>
                                    <button class="delete-btn" onclick="deleteShoppingItem(${item.id})">Delete</button>
                                </div>
                            </div>
                            ${!item.checked ? `
                                <div onclick="toggleShoppingItem(${item.id})" style="cursor: pointer; color: #667eea; font-size: 14px; margin-bottom: 5px;">
                                    <span>Need: ${item.quantity} ${item.unit}</span>
                                    <span style="margin-left: 10px; color: #718096;">→ ${item.targetLocation === 'pantry' ? '🏺 Pantry' : item.targetLocation === 'fridge' ? '❄️ Fridge' : '🧊 Freezer'}</span>
                                </div>
                            ` : ''}
                            ${item.checked ? `
                                <div style="background: white; padding: 12px; border-radius: 8px; margin-top: 10px; border-left: 3px solid #48bb78;">
                                    <div style="display: flex; gap: 10px; margin-bottom: 8px;">
                                        <div style="flex: 1;">
                                            <label style="display: block; font-size: 12px; color: #718096; margin-bottom: 4px;">Quantity Purchased</label>
                                            <input type="number"
                                                   value="${item.purchasedQuantity || item.quantity}"
                                                   onchange="updatePurchasedQuantity(${item.id}, this.value)"
                                                   onclick="event.stopPropagation()"
                                                   step="0.1"
                                                   min="0"
                                                   style="width: 100%; padding: 8px; border: 2px solid #e2e8f0; border-radius: 6px; font-size: 14px;">
                                        </div>
                                        <div style="flex: 1;">
                                            <label style="display: block; font-size: 12px; color: #718096; margin-bottom: 4px;">Unit</label>
                                            <input type="text"
                                                   value="${item.unit}"
                                                   readonly
                                                   style="width: 100%; padding: 8px; border: 2px solid #e2e8f0; border-radius: 6px; background: #f7fafc; font-size: 14px;">
                                        </div>
                                    </div>
                                    <div>
                                        <label style="display: block; font-size: 12px; color: #718096; margin-bottom: 4px;">Move To</label>
                                        <select onchange="updateTargetLocation(${item.id}, this.value)"
                                                onclick="event.stopPropagation()"
                                                style="width: 100%; padding: 8px; border: 2px solid #e2e8f0; border-radius: 6px; font-size: 14px;">
                                            <option value="pantry" ${item.targetLocation === 'pantry' ? 'selected' : ''}>🏺 Pantry</option>
                                            <option value="fridge" ${item.targetLocation === 'fridge' ? 'selected' : ''}>❄️ Fridge</option>
                                            <option value="freezer" ${item.targetLocation === 'freezer' ? 'selected' : ''}>🧊 Freezer</option>
                                        </select>
                                    </div>
                                </div>
                            ` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

function updatePurchasedQuantity(id, value) {
    const item = shoppingList.find(item => item.id === id);
    if (item) {
        item.purchasedQuantity = parseFloat(value) || 0;
        saveToLocalStorage();
    }
}

function updateTargetLocation(id, value) {
    const item = shoppingList.find(item => item.id === id);
    if (item) {
        item.targetLocation = value;
        saveToLocalStorage();
    }
}

function moveCheckedToInventory() {
    const checkedItems = shoppingList.filter(item => item.checked);

    if (checkedItems.length === 0) {
        showToast('No Items', 'No items are checked', 'warning');
        return;
    }

    let movedCount = 0;
    const locations = { pantry: 0, fridge: 0, freezer: 0 };

    checkedItems.forEach(item => {
        const purchasedQty = item.purchasedQuantity || item.quantity;
        const location = item.targetLocation || 'pantry';

        // Check if ingredient already exists in target location
        const existing = ingredients[location].find(ing =>
            ing.name.toLowerCase() === item.name.toLowerCase() &&
            ing.unit.toLowerCase() === item.unit.toLowerCase()
        );

        if (existing) {
            // Add to existing quantity
            existing.quantity += purchasedQty;
        } else {
            // Create new ingredient
            ingredients[location].push({
                id: Date.now() + Math.random(),
                name: item.name,
                quantity: purchasedQty,
                unit: item.unit,
                category: item.category
            });
        }

        locations[location]++;
        movedCount++;
    });

    // Remove checked items from shopping list
    shoppingList = shoppingList.filter(item => !item.checked);

    saveToLocalStorage();
    renderShoppingList();
    renderIngredients();
    updateDashboardStats();
    updateDataLists();

    // Show summary toast
    const locationSummary = Object.entries(locations)
        .filter(([_, count]) => count > 0)
        .map(([loc, count]) => `${count} to ${loc}`)
        .join(', ');

    showToast('Items Moved!', `${movedCount} item${movedCount > 1 ? 's' : ''} moved: ${locationSummary}`, 'success');
}

function checkAllShoppingItems() {
    shoppingList.forEach(item => item.checked = true);
    saveToLocalStorage();
    renderShoppingList();
    showToast('All Checked', `${shoppingList.length} item${shoppingList.length > 1 ? 's' : ''} checked`, 'success');
}

function uncheckAllShoppingItems() {
    shoppingList.forEach(item => {
        item.checked = false;
        item.purchasedQuantity = null; // Reset purchased quantity
    });
    saveToLocalStorage();
    renderShoppingList();
    showToast('All Unchecked', 'Shopping list items unchecked', 'info');
}

function clearCheckedShoppingItems() {
    const checkedCount = shoppingList.filter(item => item.checked).length;
    if (checkedCount === 0) {
        showToast('No Items', 'No items are checked', 'warning');
        return;
    }

    if (confirm(`Remove ${checkedCount} checked item${checkedCount > 1 ? 's' : ''} from shopping list?`)) {
        shoppingList = shoppingList.filter(item => !item.checked);
        saveToLocalStorage();
        renderShoppingList();
        updateDashboardStats();
        showToast('Items Removed', `${checkedCount} item${checkedCount > 1 ? 's' : ''} removed`, 'success');
    }
}

function editShoppingItem(id) {
    const item = shoppingList.find(item => item.id === id);
    if (!item) return;

    const newName = prompt('Edit item name:', item.name);
    if (newName && newName.trim()) {
        item.name = newName.trim();
        item.category = autoCategorizeShopping(item.name);
        saveToLocalStorage();
        renderShoppingList();
        showToast('Item Updated', `${item.name} updated`, 'success');
    }
}

function updateShoppingItemQuantity(id, quantity, unit) {
    const item = shoppingList.find(item => item.id === id);
    if (!item) return;

    item.quantity = parseFloat(quantity) || 1;
    if (unit && unit.trim()) {
        item.unit = unit.trim();
    }
    saveToLocalStorage();
    renderShoppingList();
}

function getSuggestedLocation(category) {
    const fridgeCategories = ['dairy', 'meat', 'produce', 'beverages'];
    const freezerCategories = ['frozen'];

    if (fridgeCategories.includes(category)) return 'fridge';
    if (freezerCategories.includes(category)) return 'freezer';
    return 'pantry';
}

function quickAddItem(itemName) {
    // Check if already in shopping list
    const existing = shoppingList.find(item => item.name.toLowerCase() === itemName.toLowerCase());

    if (existing) {
        existing.quantity += 1;
        showToast('Quantity Updated', `${itemName} quantity increased to ${existing.quantity}`, 'info');
    } else {
        const category = autoCategorizeShopping(itemName);
        shoppingList.push({
            id: Date.now() + Math.random(),
            name: itemName,
            quantity: 1,
            unit: 'unit',
            category: category,
            checked: false,
            purchasedQuantity: null,
            targetLocation: getSuggestedLocation(category)
        });
        showToast('Added to Shopping List', `${itemName} added`, 'success');
    }

    saveToLocalStorage();
    renderShoppingList();
    updateDashboardStats();
}

function copyShoppingListToClipboard() {
    if (shoppingList.length === 0) {
        showToast('Empty List', 'Shopping list is empty', 'warning');
        return;
    }

    // Group by category
    const byCategory = {};
    shoppingList.forEach(item => {
        const cat = item.category || 'other';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(item);
    });

    // Format as text
    let text = '🛒 SHOPPING LIST\n\n';
    Object.keys(byCategory).sort().forEach(category => {
        text += `${category.toUpperCase()}\n`;
        byCategory[category]
            .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
            .forEach(item => {
                const checkbox = item.checked ? '✅' : '☐';
                text += `${checkbox} ${item.quantity} ${item.unit} ${item.name}\n`;
            });
        text += '\n';
    });

    // Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied!', 'Shopping list copied to clipboard', 'success');
    }).catch(() => {
        showToast('Copy Failed', 'Could not copy to clipboard', 'error');
    });
}

// Meal Plan Section
function initMealPlan() {
    // Wire up Clear Meal Plan button
    const clearBtn = document.getElementById('clear-meal-plan');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearMealPlan);
    }

    // Wire up Duplicate Week button
    const duplicateBtn = document.getElementById('duplicate-week-btn');
    if (duplicateBtn) {
        duplicateBtn.addEventListener('click', duplicateWeek);
    }

    renderMealPlan();
}

function clearMealPlan() {
    if (confirm('Are you sure you want to clear the entire meal plan?')) {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        days.forEach(day => {
            mealPlan[day] = {
                breakfast: { personA: [], personB: [], joint: [] },
                lunch: { personA: [], personB: [], joint: [] },
                dinner: { personA: [], personB: [], joint: [] }
            };
        });
        saveToLocalStorage();
        renderMealPlan();
        renderIngredients(); // Update ingredient availability
        showToast('Meal Plan Cleared', 'All meals removed from plan', 'success');
    }
}

function duplicateWeek() {
    // Check if there's anything to duplicate
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const hasMeals = days.some(day => {
        const dayPlan = mealPlan[day];
        return ['breakfast', 'lunch', 'dinner'].some(meal => {
            const mealSlot = dayPlan[meal];
            return (mealSlot.personA && mealSlot.personA.length > 0) ||
                   (mealSlot.personB && mealSlot.personB.length > 0) ||
                   (mealSlot.joint && mealSlot.joint.length > 0);
        });
    });

    if (!hasMeals) {
        showToast('Nothing to Duplicate', 'Current meal plan is empty', 'info');
        return;
    }

    // Create a deep copy of the current meal plan
    const mealPlanCopy = JSON.stringify(mealPlan);

    // Store in clipboard-like temporary storage
    localStorage.setItem('mealPlanClipboard', mealPlanCopy);

    showToast('Week Copied!', 'Use "Paste Week" to apply this plan to a different week', 'success');

    // Show paste option
    const confirmPaste = confirm('Meal plan copied! Do you want to paste it now to replace the current week?');
    if (confirmPaste) {
        pasteWeek();
    }
}

function pasteWeek() {
    const clipboard = localStorage.getItem('mealPlanClipboard');
    if (!clipboard) {
        showToast('Nothing to Paste', 'No meal plan has been copied yet', 'info');
        return;
    }

    try {
        const copiedPlan = JSON.parse(clipboard);
        mealPlan = copiedPlan;
        saveToLocalStorage();
        renderMealPlan();
        renderIngredients();
        showToast('Week Pasted!', 'Meal plan has been applied', 'success');
    } catch (e) {
        showToast('Error', 'Failed to paste meal plan', 'error');
    }
}

function renderMealPlan() {
    const mealPlanGrid = document.getElementById('meal-plan-grid');
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const meals = ['breakfast', 'lunch', 'dinner'];

    if (recipes.length === 0) {
        mealPlanGrid.innerHTML = '<div class="empty-state"><p>No recipes available. Add some recipes first to create your meal plan!</p></div>';
        return;
    }

    const recipeOptions = recipes
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        .map(recipe => `<option value="${recipe.id}">${recipe.name}</option>`)
        .join('');

    // Add quick day filter buttons at top
    let html = `
        <div class="meal-plan-quick-filters" style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; justify-content: center;">
            ${days.map(day => `
                <button onclick="toggleMealDay('${day}')" class="day-filter-btn" style="padding: 8px 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                    ${day.charAt(0).toUpperCase() + day.slice(1)}
                </button>
            `).join('')}
            <button onclick="expandAllMealDays()" style="padding: 8px 16px; background: #48bb78; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                Expand All
            </button>
            <button onclick="collapseAllMealDays()" style="padding: 8px 16px; background: #718096; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                Collapse All
            </button>
        </div>
    `;

    html += days.map(day => {
        const isExpanded = expandedMealDays.has(day);
        const displayStyle = isExpanded ? 'block' : 'none';
        const iconText = isExpanded ? '▲' : '▼';
        const iconRotation = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';

        return `
        <div class="meal-day" id="meal-day-${day}">
            <h3 onclick="toggleMealDay('${day}')" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; user-select: none;">
                <span>${day.charAt(0).toUpperCase() + day.slice(1)}</span>
                <span class="collapse-icon" id="collapse-icon-${day}" style="font-size: 20px; transition: transform 0.3s; transform: ${iconRotation};">${iconText}</span>
            </h3>
            <div class="meal-slots" id="meal-slots-${day}" style="display: ${displayStyle};">
                ${meals.map(meal => {
                    const mealSlot = mealPlan[day][meal];

                    // Ensure structure exists
                    if (!mealSlot || typeof mealSlot !== 'object' || !Array.isArray(mealSlot.personA)) {
                        mealPlan[day][meal] = { personA: [], personB: [], joint: [] };
                    }

                    const personARecipes = (mealPlan[day][meal].personA || []).map(id => recipes.find(r => r.id === id)).filter(Boolean);
                    const personBRecipes = (mealPlan[day][meal].personB || []).map(id => recipes.find(r => r.id === id)).filter(Boolean);
                    const jointRecipes = (mealPlan[day][meal].joint || []).map(id => recipes.find(r => r.id === id)).filter(Boolean);

                    return `
                        <div class="meal-slot">
                            <h4>${meal.charAt(0).toUpperCase() + meal.slice(1)}</h4>

                            <!-- Person A -->
                            <div class="person-meal">
                                <label style="font-weight: 600; color: #667eea;">Person A:</label>
                                ${personARecipes.map(recipe => `
                                    <div class="recipe-tag">
                                        ${recipe.name}
                                        <button class="remove-tag-btn" onclick="removeRecipeFromMeal('${day}', '${meal}', 'personA', ${recipe.id})">×</button>
                                    </div>
                                `).join('')}
                                <select onchange="addRecipeToMeal('${day}', '${meal}', 'personA', this.value); this.value='';" style="margin-top: 5px;">
                                    <option value="">+ Add recipe</option>
                                    ${recipeOptions}
                                </select>
                            </div>

                            <!-- Person B -->
                            <div class="person-meal">
                                <label style="font-weight: 600; color: #764ba2;">Person B:</label>
                                ${personBRecipes.map(recipe => `
                                    <div class="recipe-tag">
                                        ${recipe.name}
                                        <button class="remove-tag-btn" onclick="removeRecipeFromMeal('${day}', '${meal}', 'personB', ${recipe.id})">×</button>
                                    </div>
                                `).join('')}
                                <select onchange="addRecipeToMeal('${day}', '${meal}', 'personB', this.value); this.value='';" style="margin-top: 5px;">
                                    <option value="">+ Add recipe</option>
                                    ${recipeOptions}
                                </select>
                            </div>

                            <!-- Joint -->
                            <div class="person-meal">
                                <label style="font-weight: 600; color: #48bb78;">Joint:</label>
                                ${jointRecipes.map(recipe => `
                                    <div class="recipe-tag joint-tag">
                                        ${recipe.name}
                                        <button class="remove-tag-btn" onclick="removeRecipeFromMeal('${day}', '${meal}', 'joint', ${recipe.id})">×</button>
                                    </div>
                                `).join('')}
                                <select onchange="addRecipeToMeal('${day}', '${meal}', 'joint', this.value); this.value='';" style="margin-top: 5px;">
                                    <option value="">+ Add recipe</option>
                                    ${recipeOptions}
                                </select>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        `;
    }).join('');

    mealPlanGrid.innerHTML = html;
}

function toggleMealDay(day) {
    if (expandedMealDays.has(day)) {
        expandedMealDays.delete(day);
    } else {
        expandedMealDays.add(day);
    }

    // Update UI immediately
    const slotsElement = document.getElementById(`meal-slots-${day}`);
    const iconElement = document.getElementById(`collapse-icon-${day}`);

    if (expandedMealDays.has(day)) {
        slotsElement.style.display = 'block';
        iconElement.style.transform = 'rotate(180deg)';
        iconElement.textContent = '▲';
    } else {
        slotsElement.style.display = 'none';
        iconElement.style.transform = 'rotate(0deg)';
        iconElement.textContent = '▼';
    }
}

function expandAllMealDays() {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    days.forEach(day => expandedMealDays.add(day));
    renderMealPlan();
}

function collapseAllMealDays() {
    expandedMealDays.clear();
    renderMealPlan();
}

function addRecipeToMeal(day, meal, person, recipeId) {
    if (!recipeId) return;

    recipeId = parseInt(recipeId);

    // Ensure structure exists
    if (!mealPlan[day][meal] || typeof mealPlan[day][meal] !== 'object') {
        mealPlan[day][meal] = { personA: [], personB: [], joint: [] };
    }

    // Add recipe if not already there
    if (!mealPlan[day][meal][person].includes(recipeId)) {
        mealPlan[day][meal][person].push(recipeId);
        saveToLocalStorage();
        renderMealPlan();
        renderIngredients(); // Update ingredient availability
    }
}

function removeRecipeFromMeal(day, meal, person, recipeId) {
    if (mealPlan[day][meal] && Array.isArray(mealPlan[day][meal][person])) {
        mealPlan[day][meal][person] = mealPlan[day][meal][person].filter(id => id !== recipeId);
        saveToLocalStorage();
        renderMealPlan();
        renderIngredients(); // Update ingredient availability
    }
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
            const mealSlot = mealPlan[day][meal];
            if (typeof mealSlot === 'number') {
                // Old format - single recipe
                mealCount++;
            } else if (mealSlot && typeof mealSlot === 'object') {
                // New format - count all recipes across all people
                const totalRecipes = (mealSlot.personA || []).length +
                                    (mealSlot.personB || []).length +
                                    (mealSlot.joint || []).length;
                if (totalRecipes > 0) mealCount++;
            }
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
            id: Date.now(), // Use timestamp for unique ID
            type: 'smartpantry', // Tag to identify our data
            ingredients: safeIngredients,
            recipes: safeRecipes,
            shoppingList: safeShoppingList,
            mealPlan: safeMealPlan,
            version: '2.5',
            lastUpdated: new Date().toISOString()
        };

        const payload = { tasks: [pantryData] };
        console.log('📤 Sending to server:', payload);

        const response = await fetch(API_BASE_URL + '/api/planner/tasks/' + userToken, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('📬 Server response:', result);

        if (result.success) {
            localStorage.setItem('smartPantry_lastSync', new Date().toISOString());
            updateSyncStatus();
            console.log('✅ Sync complete - ' + result.count + ' tasks saved');
        } else {
            console.error('❌ Sync failed:', result);
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

        console.log('📥 Sync response:', result);

        if (result.success && result.tasks && Array.isArray(result.tasks)) {
            console.log('📦 Found tasks:', result.tasks.length);

            // Extract our pantry data from the tasks array (find by type tag)
            const pantryTask = result.tasks.find(task => task.type === 'smartpantry');
            console.log('🔍 Pantry task:', pantryTask);
            const pantryData = pantryTask || null;

            if (pantryData) {
                console.log('✅ Restoring data...');

                // Restore ingredients
                if (pantryData.ingredients && pantryData.ingredients.pantry && pantryData.ingredients.fridge && pantryData.ingredients.freezer) {
                    ingredients = pantryData.ingredients;
                    console.log('  ✓ Ingredients restored:', ingredients);
                }

                // Restore recipes
                if (pantryData.recipes) {
                    recipes = Array.isArray(pantryData.recipes) ? pantryData.recipes : [];
                    console.log('  ✓ Recipes restored:', recipes.length);
                }

                // Restore shopping list
                if (pantryData.shoppingList) {
                    shoppingList = Array.isArray(pantryData.shoppingList) ? pantryData.shoppingList : [];
                    console.log('  ✓ Shopping list restored:', shoppingList.length);
                }

                // Restore meal plan
                if (pantryData.mealPlan && typeof pantryData.mealPlan === 'object') {
                    mealPlan = pantryData.mealPlan;
                    console.log('  ✓ Meal plan restored');
                }
            } else {
                console.warn('❌ No pantry task found with type === smartpantry');
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
