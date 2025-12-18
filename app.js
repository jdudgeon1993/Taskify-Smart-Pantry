// Smart Pantry Application
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

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    initNavigation();
    initIngredients();
    initRecipes();
    initShopping();
    initMealPlan();
});

// Local Storage Functions
function saveToLocalStorage() {
    localStorage.setItem('smartPantry_ingredients', JSON.stringify(ingredients));
    localStorage.setItem('smartPantry_recipes', JSON.stringify(recipes));
    localStorage.setItem('smartPantry_shopping', JSON.stringify(shoppingList));
    localStorage.setItem('smartPantry_mealPlan', JSON.stringify(mealPlan));
}

function loadFromLocalStorage() {
    const savedIngredients = localStorage.getItem('smartPantry_ingredients');
    const savedRecipes = localStorage.getItem('smartPantry_recipes');
    const savedShopping = localStorage.getItem('smartPantry_shopping');
    const savedMealPlan = localStorage.getItem('smartPantry_mealPlan');

    if (savedIngredients) ingredients = JSON.parse(savedIngredients);
    if (savedRecipes) recipes = JSON.parse(savedRecipes);
    if (savedShopping) shoppingList = JSON.parse(savedShopping);
    if (savedMealPlan) mealPlan = JSON.parse(savedMealPlan);
}

// Navigation
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetSection = btn.dataset.section;

            // Update active nav button
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update active section
            document.querySelectorAll('.section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(targetSection).classList.add('active');
        });
    });
}

// Ingredients Section
function initIngredients() {
    const locationButtons = document.querySelectorAll('.location-btn');
    const addIngredientBtn = document.getElementById('add-ingredient-btn');

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

    // Allow Enter key to add ingredient
    document.getElementById('ingredient-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addIngredient();
    });

    renderIngredients();
}

function addIngredient() {
    const nameInput = document.getElementById('ingredient-name');
    const quantityInput = document.getElementById('ingredient-quantity');
    const unitInput = document.getElementById('ingredient-unit');

    const name = nameInput.value.trim();
    const quantity = parseFloat(quantityInput.value) || 1;
    const unit = unitInput.value.trim();

    if (!name) {
        alert('Please enter an ingredient name');
        return;
    }

    const ingredient = {
        id: Date.now(),
        name,
        quantity,
        unit
    };

    ingredients[currentLocation].push(ingredient);
    saveToLocalStorage();
    renderIngredients();
    updateRecipeStatus();

    // Clear inputs
    nameInput.value = '';
    quantityInput.value = '1';
    unitInput.value = '';
    nameInput.focus();
}

function deleteIngredient(location, id) {
    ingredients[location] = ingredients[location].filter(ing => ing.id !== id);
    saveToLocalStorage();
    renderIngredients();
    updateRecipeStatus();
}

function renderIngredients() {
    ['pantry', 'fridge', 'freezer'].forEach(location => {
        const listElement = document.getElementById(`${location}-items`);
        const items = ingredients[location];

        if (items.length === 0) {
            listElement.innerHTML = '<li style="background: none; text-align: center; color: #6c757d;">No items yet</li>';
            return;
        }

        listElement.innerHTML = items.map(item => `
            <li>
                <div class="ingredient-info">
                    <span class="ingredient-name">${item.name}</span>
                    <span class="ingredient-quantity">${item.quantity} ${item.unit}</span>
                </div>
                <button class="delete-btn" onclick="deleteIngredient('${location}', ${item.id})">Delete</button>
            </li>
        `).join('');
    });
}

// Recipes Section
function initRecipes() {
    const addRecipeBtn = document.getElementById('add-recipe-btn');
    const saveRecipeBtn = document.getElementById('save-recipe-btn');
    const closeModal = document.querySelector('.close-modal');
    const addRecipeIngredientBtn = document.getElementById('add-recipe-ingredient-btn');
    const filterButtons = document.querySelectorAll('.filter-btn');

    addRecipeBtn.addEventListener('click', () => {
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

    // Close modal on outside click
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
    document.getElementById('recipe-name').value = '';
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

    const recipe = {
        id: Date.now(),
        name,
        instructions,
        ingredients: recipeIngredients
    };

    recipes.push(recipe);
    saveToLocalStorage();
    renderRecipes();

    document.getElementById('add-recipe-form').classList.add('hidden');
}

function deleteRecipe(id) {
    if (confirm('Are you sure you want to delete this recipe?')) {
        recipes = recipes.filter(recipe => recipe.id !== id);
        saveToLocalStorage();
        renderRecipes();
    }
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
        const found = allIngredients.find(ing =>
            ing.name.toLowerCase() === reqIng.name.toLowerCase() &&
            ing.quantity >= reqIng.quantity
        );

        if (found) {
            have.push(reqIng);
        } else {
            missing.push(reqIng);
        }
    });

    return { missing, have, isReady: missing.length === 0 };
}

function updateRecipeStatus() {
    renderRecipes();
}

function renderRecipes() {
    const recipeList = document.getElementById('recipe-list');

    if (recipes.length === 0) {
        recipeList.innerHTML = '<div class="empty-state"><p>No recipes yet. Add your first recipe!</p></div>';
        return;
    }

    let filteredRecipes = recipes;

    if (currentRecipeFilter === 'ready') {
        filteredRecipes = recipes.filter(recipe => checkRecipeStatus(recipe).isReady);
    } else if (currentRecipeFilter === 'missing') {
        filteredRecipes = recipes.filter(recipe => !checkRecipeStatus(recipe).isReady);
    }

    if (filteredRecipes.length === 0) {
        recipeList.innerHTML = '<div class="empty-state"><p>No recipes match this filter</p></div>';
        return;
    }

    recipeList.innerHTML = filteredRecipes.map(recipe => {
        const status = checkRecipeStatus(recipe);
        const statusClass = status.isReady ? 'ready' : 'missing';
        const statusText = status.isReady ? 'Ready to Cook' : 'Need Ingredients';

        return `
            <div class="recipe-card ${statusClass}">
                <span class="recipe-status ${statusClass}">${statusText}</span>
                <h3>${recipe.name}</h3>

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
                    <button class="delete-btn" onclick="deleteRecipe(${recipe.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

// Shopping List Section
function initShopping() {
    const addShoppingItemBtn = document.getElementById('add-shopping-item-btn');
    const autoGenerateBtn = document.getElementById('auto-generate-list-btn');
    const clearListBtn = document.getElementById('clear-shopping-list-btn');

    addShoppingItemBtn.addEventListener('click', addShoppingItem);
    autoGenerateBtn.addEventListener('click', autoGenerateShoppingList);
    clearListBtn.addEventListener('click', clearShoppingList);

    document.getElementById('shopping-item-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addShoppingItem();
    });

    renderShoppingList();
}

function addShoppingItem() {
    const nameInput = document.getElementById('shopping-item-name');
    const quantityInput = document.getElementById('shopping-item-qty');
    const unitInput = document.getElementById('shopping-item-unit');

    const name = nameInput.value.trim();
    const quantity = parseFloat(quantityInput.value) || 1;
    const unit = unitInput.value.trim();

    if (!name) {
        alert('Please enter an item name');
        return;
    }

    const item = {
        id: Date.now(),
        name,
        quantity,
        unit,
        checked: false
    };

    shoppingList.push(item);
    saveToLocalStorage();
    renderShoppingList();

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
                checked: false
            });
        }
    });

    saveToLocalStorage();
    renderShoppingList();
    alert(`Added ${missingIngredients.length} missing ingredients to shopping list!`);
}

function clearShoppingList() {
    if (confirm('Are you sure you want to clear the shopping list?')) {
        shoppingList = [];
        saveToLocalStorage();
        renderShoppingList();
    }
}

function renderShoppingList() {
    const listElement = document.getElementById('shopping-list-items');

    if (shoppingList.length === 0) {
        listElement.innerHTML = '<li style="background: none; text-align: center; color: #6c757d;">Shopping list is empty</li>';
        return;
    }

    listElement.innerHTML = shoppingList.map(item => `
        <li class="${item.checked ? 'checked' : ''}" onclick="toggleShoppingItem(${item.id})">
            <div class="shopping-item-info">
                <span class="shopping-item-name">${item.name}</span>
                <span class="shopping-item-quantity">${item.quantity} ${item.unit}</span>
            </div>
            <button class="delete-btn" onclick="event.stopPropagation(); deleteShoppingItem(${item.id})">Delete</button>
        </li>
    `).join('');
}

// Meal Plan Section
function initMealPlan() {
    renderMealPlan();
}

function renderMealPlan() {
    const mealPlanGrid = document.getElementById('meal-plan-grid');
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const meals = ['breakfast', 'lunch', 'dinner'];

    mealPlanGrid.innerHTML = days.map(day => `
        <div class="meal-day">
            <h3>${day.charAt(0).toUpperCase() + day.slice(1)}</h3>
            <div class="meal-slots">
                ${meals.map(meal => {
                    const selectedRecipe = mealPlan[day][meal];
                    const recipeOptions = recipes.map(recipe =>
                        `<option value="${recipe.id}" ${selectedRecipe === recipe.id ? 'selected' : ''}>${recipe.name}</option>`
                    ).join('');

                    return `
                        <div class="meal-slot ${selectedRecipe ? 'filled' : ''}">
                            <h4>${meal.charAt(0).toUpperCase() + meal.slice(1)}</h4>
                            <select onchange="updateMealPlan('${day}', '${meal}', this.value)">
                                <option value="">-- Select Recipe --</option>
                                ${recipeOptions}
                            </select>
                            ${selectedRecipe ? `<button class="remove-meal-btn" onclick="removeMealFromPlan('${day}', '${meal}')">Remove</button>` : ''}
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
