// Smart Pantry Application v3.0 - Supabase Edition
// Now powered by Supabase for real-time multi-user sync!

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
    week1: {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: []
    },
    week2: {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: []
    }
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
let currentUser = null;
let currentHousehold = null;
let isLoading = false;
let isInitialized = false; // Prevent double initialization

// Expose state flags globally so auth.js can reset them
window.isInitialized = false;
window.isLoading = false;

// Meal Plan UI State
let currentWeekView = 'week1'; // Which week is being displayed

// Helper function to get today's day of week
function getTodayDayName() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
}

// Helper function to update greeting and datetime
function updateGreetingAndDatetime() {
    const now = new Date();
    const hour = now.getHours();

    // Determine greeting based on time
    let greeting = 'Good Evening';
    if (hour < 12) {
        greeting = 'Good Morning';
    } else if (hour < 18) {
        greeting = 'Good Afternoon';
    }

    // Format date and time
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const dayName = days[now.getDay()];
    const monthName = months[now.getMonth()];
    const date = now.getDate();
    const year = now.getFullYear();

    // Add ordinal suffix (st, nd, rd, th)
    const getOrdinalSuffix = (d) => {
        if (d > 3 && d < 21) return 'th';
        switch (d % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };

    // Format time (12-hour format)
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    const dateStr = `${dayName}, ${hours}:${minutes} ${ampm}`;
    const fullDateStr = `${monthName} ${date}${getOrdinalSuffix(date)}, ${year}`;

    // Update DOM
    const greetingEl = document.getElementById('greeting-text');
    const datetimeEl = document.getElementById('current-datetime');

    if (greetingEl) greetingEl.textContent = greeting;
    if (datetimeEl) datetimeEl.textContent = `${dateStr}, ${fullDateStr}`;
}

// Helper function to check if it's Monday and roll over weeks if needed
function checkAndRolloverWeeks() {
    const today = getTodayDayName();
    const lastRollover = localStorage.getItem('smartPantry_lastRollover');
    const currentDate = new Date().toDateString();

    // If it's Monday and we haven't rolled over today
    if (today === 'monday' && lastRollover !== currentDate) {
        // Move week2 to week1, clear week2
        mealPlan.week1 = { ...mealPlan.week2 };
        mealPlan.week2 = {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: [],
            saturday: [],
            sunday: []
        };

        localStorage.setItem('smartPantry_lastRollover', currentDate);
        showToast('Week Rolled Over', 'Next week is now your current week!', 'info');
    }
}

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

// ==============================================
// GREETING BANNER
// ==============================================

function updateGreeting() {
    const greetingText = document.getElementById('greeting-text');
    const datetimeText = document.getElementById('current-datetime');

    if (!greetingText || !datetimeText) return;

    const now = new Date();
    const hour = now.getHours();

    // Determine greeting based on time
    let greeting = 'Good Evening';
    if (hour < 12) greeting = 'Good Morning';
    else if (hour < 17) greeting = 'Good Afternoon';

    // Format date and time
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const dayName = days[now.getDay()];
    const monthName = months[now.getMonth()];
    const date = now.getDate();
    const year = now.getFullYear();

    // Add ordinal suffix
    const ordinal = (date) => {
        if (date > 3 && date < 21) return 'th';
        switch (date % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };

    // Format time
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    greetingText.textContent = greeting;
    datetimeText.textContent = `${dayName}, ${hours}:${minutes} ${ampm}, ${monthName} ${date}${ordinal(date)}, ${year}`;
}

// Update greeting every minute
setInterval(updateGreeting, 60000);
// Update immediately on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateGreeting);
} else {
    updateGreeting();
}

// Initialize App - Wait for auth before loading data
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📍 DOMContentLoaded fired');
    console.log('📍 Checking for existing session...');
    const { data: { session } } = await supabase.auth.getSession();
    console.log('📍 Session check result:', session ? 'Session exists' : 'No session');
    if (session) {
        console.log('📍 User already logged in, calling initializeApp...');
        await initializeApp();
    } else {
        console.log('📍 No session, showing login screen');
        showLoginScreen();
    }
    console.log('📍 DOMContentLoaded complete');
});

// Initialize the main app after successful login
async function initializeApp() {
    console.log('🚀 initializeApp() called');

    // Prevent double initialization
    if (window.isInitialized) {
        console.log('⚠️ App already initialized, skipping...');
        return;
    }
    if (window.isLoading) {
        console.log('⚠️ App is currently loading, skipping duplicate call...');
        return;
    }

    window.isLoading = true;
    console.log('📺 Calling showAppScreen()...');
    showAppScreen();
    console.log('📊 Loading app data...');
    try {
        console.log('🔍 Step 1: Getting current user...');
        currentUser = await getCurrentUser();
        console.log('✅ Current user:', currentUser?.email);

        console.log('🔍 Step 2: Getting user household...');
        currentHousehold = await getUserHousehold();
        console.log('✅ Current household:', currentHousehold?.name);

        if (!currentHousehold) {
            console.log('🏠 Creating new household...');
            const householdName = currentUser.email.split('@')[0] + '\'s Pantry';
            currentHousehold = await createHousehold(householdName);
            console.log('✅ Household created:', householdName);
            showToast('Welcome!', 'Created household: ' + householdName, 'success');
        }

        console.log('🔍 Step 3: Updating household display...');
        const householdDisplay = document.getElementById('household-name-display');
        if (householdDisplay && currentHousehold) {
            householdDisplay.textContent = currentHousehold.name;
        }
        // Set household name for mobile bottom bar
        const appContent = document.getElementById('app-content');
        if (appContent && currentHousehold) {
            appContent.setAttribute('data-household', currentHousehold.name);
        }

        console.log('🔍 Step 4: Loading all data from Supabase...');
        await loadAllDataFromSupabase();
        console.log('✅ Data loading complete');

        console.log('🔧 Updating data lists...');
        updateDataLists();

        console.log('🔧 Initializing navigation...');
        initNavigation();

        console.log('🔧 Initializing dashboard...');
        initDashboard();

        console.log('🔧 Initializing ingredients...');
        initIngredients();

        console.log('🔧 Initializing recipes...');
        initRecipes();

        console.log('🔧 Initializing shopping...');
        initShopping();

        console.log('🔧 Initializing meal plan...');
        initMealPlan();

        console.log('🔧 Initializing settings...');
        initSettings();

        console.log('🔧 Setting up realtime subscriptions...');
        setupRealtimeSubscriptions();

        console.log('🔧 Updating greeting and datetime...');
        updateGreetingAndDatetime();
        // Update every minute
        setInterval(updateGreetingAndDatetime, 60000);

        console.log('✅✅✅ App initialized successfully!');
        window.isInitialized = true;
        window.isLoading = false;
    } catch (error) {
        console.error('❌ Error initializing app:', error);
        console.error('Error stack:', error.stack);
        window.isLoading = false; // Reset loading flag on error
        showToast('Error', 'Failed to initialize app: ' + error.message, 'error');
        // On error, show login screen and sign out to allow recovery
        alert('Critical error during initialization:\n\n' + error.message + '\n\nPlease contact support or try again. You will be logged out.');
        await handleSignout();
        showLoginScreen();
    }
}

// Expose initializeApp to global scope for auth.js
window.initializeApp = initializeApp;

// Timeout wrapper for async operations
function withTimeout(promise, timeoutMs = 10000, operationName = 'Operation') {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
}

// Set up auth state listener NOW that initializeApp is available
if (window.supabaseClient) {
    console.log('🔧 Setting up auth state listener in app.js');
    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log('🔔 [APP.JS] Auth state changed:', event);
        if (event === 'SIGNED_IN' && session) {
            console.log('✅ [APP.JS] User signed in:', session.user.email);
            console.log('📱 [APP.JS] Calling initializeApp()...');
            try {
                // Add timeout to initialization
                await withTimeout(initializeApp(), 30000, 'App initialization');
                console.log('✅ [APP.JS] initializeApp() completed');
            } catch (error) {
                console.error('❌ [APP.JS] Error in initializeApp:', error);
                window.isLoading = false;
                window.isInitialized = false;
                showToast('Error', 'Failed to initialize: ' + error.message, 'error');
                // Show a helpful error message
                if (error.message.includes('timed out')) {
                    alert('The app is taking too long to load. This might be a network issue. Please refresh the page and try again.');
                }
            }
        } else if (event === 'SIGNED_OUT') {
            console.log('👋 [APP.JS] User signed out');
            showLoginScreen();
        }
    });
}

async function ensureDefaultCategoriesAndLocations() {
    try {
        console.log('🔍 Ensuring default categories and locations exist...');

        // Check if categories exist
        const categories = await loadCategories();
        if (categories.length === 0) {
            console.log('📝 Creating default categories...');
            const defaultCategories = ['Produce', 'Dairy', 'Meat', 'Grains', 'Condiments', 'Beverages', 'Snacks', 'Other'];
            for (const cat of defaultCategories) {
                try {
                    await addCategory(cat);
                } catch (err) {
                    console.warn(`Could not add category ${cat}:`, err);
                }
            }
        }

        // Check if locations exist
        const locations = await loadLocations();
        if (locations.length === 0) {
            console.log('📝 Creating default locations...');
            const defaultLocations = ['Pantry', 'Fridge', 'Freezer'];
            for (const loc of defaultLocations) {
                try {
                    await addLocation(loc);
                } catch (err) {
                    console.warn(`Could not add location ${loc}:`, err);
                }
            }
        }

        console.log('✅ Default categories and locations ensured');
    } catch (error) {
        console.warn('⚠️ Could not ensure defaults (tables may not exist yet):', error);
        // Don't throw - allow app to continue even if these tables don't exist
    }
}

async function loadAllDataFromSupabase() {
    try {
        console.log('⏳ Ensuring default categories and locations...');
        await ensureDefaultCategoriesAndLocations();

        console.log('⏳ Loading pantry items...');
        ingredients = await loadPantryItems();
        const totalItems = (ingredients.pantry?.length || 0) + (ingredients.fridge?.length || 0) + (ingredients.freezer?.length || 0);
        console.log('✅ Pantry items loaded:', totalItems, 'items');

        console.log('⏳ Loading recipes...');
        recipes = await loadRecipes();
        console.log('✅ Recipes loaded:', recipes.length, 'recipes');

        console.log('⏳ Loading shopping list...');
        shoppingList = await loadShoppingList();
        console.log('✅ Shopping list loaded:', shoppingList.length, 'items');

        console.log('⏳ Loading meal plan...');
        mealPlan = await loadMealPlan();
        console.log('✅ Meal plan loaded');

        console.log('✅ All data loaded from Supabase');
    } catch (error) {
        console.error('❌ Error loading data:', error);
        throw error;
    }
}

function setupRealtimeSubscriptions() {
    subscribeToPantryChanges(async () => {
        ingredients = await loadPantryItems();
        renderIngredients();
        updateRecipeStatus();
        updateDashboardStats();
    });
    subscribeToRecipeChanges(async () => {
        recipes = await loadRecipes();
        renderRecipes();
        renderMealPlan();
        updateDashboardStats();
    });
    subscribeToShoppingChanges(async () => {
        shoppingList = await loadShoppingList();
        renderShoppingList();
        updateDashboardStats();
    });
    subscribeToMealPlanChanges(async () => {
        mealPlan = await loadMealPlan();
        renderMealPlan();
        updateTodaysMeals();
    });
}

// Supabase Data Sync (replaces localStorage)
// Note: Individual CRUD operations now directly call Supabase functions in db.js

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
    closeNav(); // Close navigation menu when navigating
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
    // === PANTRY STATS ===
    // Dynamically count all locations (including custom ones)
    let totalIngredients = 0;
    let allIngredients = [];
    Object.keys(ingredients).forEach(location => {
        const locationItems = ingredients[location] || [];
        totalIngredients += locationItems.length;
        allIngredients = allIngredients.concat(locationItems);
    });
    const expiringCount = allIngredients.filter(item => {
        if (!item.expiration) return false;
        const status = getExpirationStatus(item.expiration);
        return status === 'expiring-soon' || status === 'expired';
    }).length;

    document.getElementById('dashboard-ingredients-count').textContent =
        `${totalIngredients} ${totalIngredients === 1 ? 'item' : 'items'}`;

    const ingredientsSecondary = document.getElementById('dashboard-ingredients-secondary');
    if (expiringCount > 0) {
        ingredientsSecondary.innerHTML = `<span style="color: #D97706;">⚠️ ${expiringCount} expiring soon</span>`;
    } else {
        ingredientsSecondary.textContent = 'All items fresh';
    }

    // === RECIPES STATS ===
    const totalRecipes = recipes.length;

    // Count ready-to-cook recipes
    const readyToCook = recipes.filter(recipe => {
        const status = checkRecipeStatus(recipe);
        return status.isReady;
    }).length;

    document.getElementById('dashboard-recipes-count').textContent =
        `${totalRecipes} ${totalRecipes === 1 ? 'recipe' : 'recipes'}`;

    const recipesSecondary = document.getElementById('dashboard-recipes-secondary');
    if (readyToCook > 0) {
        recipesSecondary.innerHTML = `<span style="color: #48BB78;">✓ ${readyToCook} ready to cook</span>`;
    } else {
        recipesSecondary.textContent = 'Add ingredients to cook';
    }

    // === SHOPPING LIST STATS ===
    const totalShoppingItems = shoppingList.length;
    const uncheckedItems = shoppingList.filter(item => !item.checked).length;

    document.getElementById('dashboard-shopping-count').textContent =
        `${totalShoppingItems} ${totalShoppingItems === 1 ? 'item' : 'items'}`;

    const shoppingSecondary = document.getElementById('dashboard-shopping-secondary');
    if (uncheckedItems > 0) {
        shoppingSecondary.innerHTML = `<span style="color: #4299E1;">${uncheckedItems} items to buy</span>`;
    } else if (totalShoppingItems > 0) {
        shoppingSecondary.innerHTML = `<span style="color: #48BB78;">✓ All items purchased</span>`;
    } else {
        shoppingSecondary.textContent = 'List is empty';
    }

    // === MEAL PLAN STATS ===
    const todayMealsCount = getTodaysMealCount();
    const weekTotalMeals = getWeekTotalMeals();

    const mealsCount = document.getElementById('dashboard-meals-count');
    const mealsSecondary = document.getElementById('dashboard-meals-secondary');

    if (todayMealsCount > 0) {
        mealsCount.innerHTML = `${todayMealsCount} ${todayMealsCount === 1 ? 'meal' : 'meals'} today`;
        mealsSecondary.textContent = `${weekTotalMeals} meals planned this week`;
    } else {
        mealsCount.textContent = 'Plan your week';
        mealsSecondary.textContent = `${weekTotalMeals} meals planned this week`;
    }

    // Check for expiring items
    checkExpiringItems();

    // Show today's meal plan
    updateTodaysMeals();
}

// Helper: Get count of today's meals
function getTodaysMealCount() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const now = new Date();
    const todayIndex = now.getDay();
    const today = days[todayIndex];

    console.log('📅 Getting today\'s meals:', {
        date: now.toLocaleDateString(),
        dayIndex: todayIndex,
        dayName: today,
        mealsPlanned: mealPlan.week1?.[today]?.length || 0
    });

    // Check Week 1 for today's meals
    if (mealPlan.week1 && mealPlan.week1[today]) {
        return mealPlan.week1[today].length;
    }

    return 0;
}

// Helper: Get total meals planned for Week 1
function getWeekTotalMeals() {
    if (!mealPlan.week1) return 0;

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    let total = 0;

    days.forEach(day => {
        if (mealPlan.week1[day]) {
            total += mealPlan.week1[day].length;
        }
    });

    return total;
}

function updateTodaysMeals() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[new Date().getDay()];

    const container = document.getElementById('today-meal-plan');
    const content = document.getElementById('today-meals-content');

    // Check if we have week1 and today's meals
    if (!mealPlan.week1 || !mealPlan.week1[today]) {
        container.style.display = 'none';
        return;
    }

    const todayRecipeIds = mealPlan.week1[today];

    // If no meals planned for today
    if (!todayRecipeIds || todayRecipeIds.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    // Build the today's meals display
    const mealsHtml = todayRecipeIds.map(recipeId => {
        const recipe = recipes.find(r => r.id === recipeId);
        if (!recipe) return '';

        const status = checkRecipeStatus(recipe);
        const statusIcon = status.isReady ? '✅' : '⚠️';
        const statusText = status.isReady ? 'Ready to cook' : 'Missing ingredients';
        const statusColor = status.isReady ? '#48BB78' : '#ED8936';

        return `
            <div style="padding: 14px; background: linear-gradient(135deg, #F7FAFC 0%, #FFFFFF 100%); border-radius: var(--radius-md); margin-bottom: var(--spacing-sm); border: 2px solid var(--border); transition: all 0.2s ease;"
                 onmouseover="this.style.transform='translateX(5px)'; this.style.borderColor='var(--primary)';"
                 onmouseout="this.style.transform='translateX(0)'; this.style.borderColor='var(--border)';">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 700; color: var(--primary); font-size: 1rem; margin-bottom: 4px;">
                            🍽️ ${recipe.name}
                        </div>
                        <div style="font-size: 0.85rem; color: ${statusColor}; font-weight: 500;">
                            ${statusIcon} ${statusText}
                        </div>
                    </div>
                    ${recipe.servings ? `<div style="color: var(--text-secondary); font-size: 0.9rem;">${recipe.servings} servings</div>` : ''}
                </div>
            </div>
        `;
    }).filter(html => html).join('');

    content.innerHTML = mealsHtml || '<p style="color: var(--text-tertiary); font-style: italic;">No meals planned for today</p>';
}

function checkExpiringItems() {
    // Get all ingredients from all locations (including custom ones)
    let allIngredients = [];
    Object.keys(ingredients).forEach(location => {
        allIngredients = allIngredients.concat(ingredients[location] || []);
    });
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

// ==============================================
// INGREDIENTS SECTION
// ==============================================

let currentLocationFilter = 'all'; // Track active location tab

async function initIngredients() {
    const addIngredientBtn = document.getElementById('add-ingredient-btn');
    const floatingAddBtn = document.getElementById('floating-add-ingredient');
    const cancelAddIngredientBtn = document.getElementById('cancel-add-ingredient');
    const closeModalBtn = document.getElementById('close-ingredient-modal');
    const formContainer = document.getElementById('add-ingredient-form-container');
    const searchInput = document.getElementById('ingredient-search');

    // Load categories and locations, then populate dropdowns
    await populateIngredientsDropdowns();

    // Create dynamic location tabs
    await createLocationTabs();

    // Ingredient search
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            ingredientSearchQuery = e.target.value.toLowerCase();
            renderIngredients();
        });
    }

    // Floating + button - show modal
    if (floatingAddBtn) {
        floatingAddBtn.addEventListener('click', () => {
            // Show modal
            formContainer.classList.remove('hidden');
            // Refresh autocomplete
            updateDataLists();
            // Focus on name input
            document.getElementById('ingredient-name').focus();
            // Clear form
            clearIngredientForm();
        });
    }

    // Close modal button (×)
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            formContainer.classList.add('hidden');
            clearIngredientForm();
        });
    }

    // Cancel button - hide modal
    if (cancelAddIngredientBtn) {
        cancelAddIngredientBtn.addEventListener('click', () => {
            formContainer.classList.add('hidden');
            clearIngredientForm();
        });
    }

    // Click outside modal to close
    if (formContainer) {
        formContainer.addEventListener('click', (e) => {
            if (e.target === formContainer) {
                formContainer.classList.add('hidden');
                clearIngredientForm();
            }
        });
    }

    // Save ingredient button
    if (addIngredientBtn) {
        addIngredientBtn.addEventListener('click', addIngredient);
    }

    // Enter key on name input
    const nameInput = document.getElementById('ingredient-name');
    if (nameInput) {
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addIngredient();
        });
    }

    // Event delegation for edit/delete buttons
    const ingredientsGrid = document.getElementById('ingredients-grid');
    if (ingredientsGrid) {
        ingredientsGrid.addEventListener('click', (e) => {
            const button = e.target.closest('.icon-btn');
            if (!button) return;

            const action = button.dataset.action;
            const location = button.dataset.location;
            const id = button.dataset.id; // Keep as string (UUID)

            if (action === 'edit') {
                editIngredient(location, id);
            } else if (action === 'delete') {
                if (confirm('Are you sure you want to delete this ingredient?')) {
                    deleteIngredient(location, id);
                }
            }
        });
    }

    // Initial render
    renderIngredients();
}

// Populate the Storage Location and Item Category dropdowns
async function populateIngredientsDropdowns() {
    const locationSelect = document.getElementById('ingredient-location');
    const categorySelect = document.getElementById('ingredient-item-category');

    if (!locationSelect || !categorySelect) return;

    try {
        // Load locations from database
        const locations = await loadLocations();
        locationSelect.innerHTML = locations.map(loc =>
            `<option value="${loc.name.toLowerCase()}">${loc.name}</option>`
        ).join('');

        // Default to first location
        if (locations.length > 0) {
            currentLocation = locations[0].name.toLowerCase();
        }

        // Load categories from database
        const categories = await loadCategories();
        categorySelect.innerHTML = `<option value="">-- Select Category --</option>` +
            categories.map(cat =>
                `<option value="${cat.name}">${cat.name}</option>`
            ).join('');
    } catch (error) {
        console.error('Error populating ingredient dropdowns:', error);
    }
}

// Create dynamic location tabs based on database locations
async function createLocationTabs() {
    const tabsContainer = document.getElementById('location-tabs');
    if (!tabsContainer) return;

    try {
        const locations = await loadLocations();

        // Add "All" tab first
        let tabsHTML = `
            <button class="location-tab active" data-location="all">
                All Locations
            </button>
        `;

        // Add tab for each location
        tabsHTML += locations.map(loc => `
            <button class="location-tab" data-location="${loc.name.toLowerCase()}">
                ${loc.name}
            </button>
        `).join('');

        tabsContainer.innerHTML = tabsHTML;

        // Set up tab click handlers
        const tabs = tabsContainer.querySelectorAll('.location-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active state
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update filter and re-render
                currentLocationFilter = tab.dataset.location;
                renderIngredients();
            });
        });
    } catch (error) {
        console.error('Error creating location tabs:', error);
    }
}

function clearIngredientForm() {
    document.getElementById('ingredient-name').value = '';
    document.getElementById('ingredient-quantity').value = '1';
    document.getElementById('ingredient-unit').value = '';
    document.getElementById('ingredient-expiration').value = '';
    // Reset to first location in dropdown
    const locationSelect = document.getElementById('ingredient-location');
    if (locationSelect && locationSelect.options.length > 0) {
        locationSelect.selectedIndex = 0;
    }
    // Reset category to default
    const categorySelect = document.getElementById('ingredient-item-category');
    if (categorySelect) {
        categorySelect.selectedIndex = 0; // "-- Select Category --"
    }
    // Reset modal title and button text
    document.getElementById('ingredient-form-title').textContent = 'Add New Ingredient';
    document.getElementById('add-ingredient-btn').textContent = 'Save Ingredient';
    // Clear editing mode
    editingIngredientData = null;
}

async function addIngredient() {
    console.log('🥕 addIngredient called');
    const nameInput = document.getElementById('ingredient-name');
    const quantityInput = document.getElementById('ingredient-quantity');
    const unitInput = document.getElementById('ingredient-unit');
    const expirationInput = document.getElementById('ingredient-expiration');
    const locationSelect = document.getElementById('ingredient-location');
    const categorySelect = document.getElementById('ingredient-item-category');

    const name = nameInput.value.trim();
    const quantity = parseFloat(quantityInput.value) || 1;
    const unit = unitInput.value.trim();
    const expiration = expirationInput.value || null;
    const location = locationSelect ? locationSelect.value : 'pantry'; // Storage location (WHERE)
    const itemCategory = categorySelect && categorySelect.value ? categorySelect.value : null; // Item category (WHAT)

    console.log('📝 Form values:', { name, quantity, unit, location, itemCategory, expiration });

    if (!name) {
        alert('Please enter an ingredient name');
        return;
    }

    if (!unit) {
        alert('Please enter a unit (e.g., cups, lbs, items)');
        return;
    }

    try {
        // Check if we're in editing mode
        if (editingIngredientData) {
            // Update existing ingredient
            await updatePantryItem(editingIngredientData.id, {
                name,
                quantity,
                unit,
                category: location,
                itemCategory: itemCategory,
                expiration: expiration
            });

            showToast('Ingredient Updated!', `${name} has been updated`, 'success');
            editingIngredientData = null; // Clear editing mode
        } else {
            // Check if ingredient already exists in the selected location
            const locationIngredients = ingredients[location] || [];
            const existingIngredient = locationIngredients.find(
                ing => ing.name.toLowerCase() === name.toLowerCase() &&
                       ing.unit.toLowerCase() === unit.toLowerCase()
            );

            if (existingIngredient) {
                // Update existing ingredient quantity
                const newQuantity = existingIngredient.quantity + quantity;
                const newExpiration = expiration && (!existingIngredient.expiration || new Date(expiration) < new Date(existingIngredient.expiration))
                    ? expiration
                    : existingIngredient.expiration;

                await updatePantryItem(existingIngredient.id, {
                    quantity: newQuantity,
                    expiration: newExpiration,
                    itemCategory: itemCategory // Update category if provided
                });

                showToast('Ingredient Updated!', `${name} quantity increased to ${newQuantity} ${unit}`, 'success');
            } else {
                // Add new ingredient to Supabase
                console.log('💾 Saving new ingredient to database...');
                const result = await addPantryItem({
                    name,
                    quantity,
                    unit,
                    category: location, // This is the storage location (legacy field name)
                    itemCategory: itemCategory, // This is the item category (Produce, Dairy, etc.)
                    expiration
                });
                console.log('✅ Ingredient saved, result:', result);

                showToast('Ingredient Added!', `${name} has been added to your ${location}`, 'success');
            }
        }

        // Reload ingredients from database
        console.log('🔄 Reloading ingredients from database...');
        ingredients = await loadPantryItems();
        console.log('✅ Ingredients reloaded:', ingredients);
        console.log('🎨 Rendering ingredients...');
        renderIngredients();
        updateRecipeStatus();
        updateDashboardStats();
        console.log('✅ Rendering complete');

        // Hide form and clear inputs
        const formContainer = document.getElementById('add-ingredient-form-container');
        if (formContainer) {
            formContainer.classList.add('hidden');
        }
        clearIngredientForm();
    } catch (error) {
        console.error('Error saving ingredient:', error);
        showToast('Error', 'Failed to save ingredient: ' + error.message, 'error');
    }
}

function editIngredient(location, id) {
    const ingredient = ingredients[location].find(ing => ing.id === id);
    if (!ingredient) return;

    // Set editing mode
    editingIngredientData = { location, id };

    // Update modal title
    document.getElementById('ingredient-form-title').textContent = 'Edit Ingredient';

    // Populate form with current values
    document.getElementById('ingredient-name').value = ingredient.name;
    document.getElementById('ingredient-quantity').value = ingredient.quantity;
    document.getElementById('ingredient-unit').value = ingredient.unit;
    document.getElementById('ingredient-location').value = ingredient.location || location;
    document.getElementById('ingredient-item-category').value = ingredient.itemCategory || '';
    document.getElementById('ingredient-expiration').value = ingredient.expiration || '';

    // Update button text
    document.getElementById('add-ingredient-btn').textContent = 'Update Ingredient';

    // Show modal
    document.getElementById('add-ingredient-form-container').classList.remove('hidden');
    document.getElementById('ingredient-name').focus();
}

async function saveIngredientEdit() {
    if (!editingIngredientData) return;

    const { location, id } = editingIngredientData;
    const newCategory = document.getElementById('edit-ing-category').value;
    const updates = {
        name: document.getElementById('edit-ing-name').value.trim(),
        quantity: parseFloat(document.getElementById('edit-ing-quantity').value) || 1,
        unit: document.getElementById('edit-ing-unit').value.trim(),
        expiration: document.getElementById('edit-ing-expiration').value || null,
        category: newCategory
    };

    try {
        await updatePantryItem(id, updates);

        // Reload ingredients from Supabase
        ingredients = await loadPantryItems();
        renderIngredients();
        updateRecipeStatus();
        updateDashboardStats();

        document.getElementById('edit-ingredient-modal').classList.add('hidden');
        editingIngredientData = null;
        showToast('Ingredient Updated', 'Changes saved successfully', 'success');
    } catch (error) {
        console.error('Error updating ingredient:', error);
        alert('Failed to update ingredient: ' + error.message);
    }
}

async function deleteIngredient(location, id) {
    const ingredient = ingredients[location].find(ing => ing.id === id);
    const ingredientName = ingredient ? ingredient.name : 'Item';

    try {
        await deletePantryItem(id);

        // Reload ingredients from Supabase
        ingredients = await loadPantryItems();
        renderIngredients();
        updateRecipeStatus();
        updateDashboardStats();

        showToast('Ingredient Deleted', `${ingredientName} has been removed`, 'success');
    } catch (error) {
        console.error('Error deleting ingredient:', error);
        alert('Failed to delete ingredient: ' + error.message);
    }
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

    // Current structure uses week1 and week2
    ['week1', 'week2'].forEach(weekKey => {
        if (!mealPlan[weekKey]) return;

        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        days.forEach(day => {
            const dayRecipes = mealPlan[weekKey][day];
            if (!Array.isArray(dayRecipes)) return;

            dayRecipes.forEach(recipeId => {
                const recipe = recipes.find(r => r.id === recipeId);
                if (recipe && recipe.ingredients) {
                    recipe.ingredients.forEach(ing => {
                        const key = `${ing.name.toLowerCase()}|${ing.unit.toLowerCase()}`;
                        reserved[key] = (reserved[key] || 0) + ing.quantity;
                    });
                }
            });
        });
    });

    return reserved;
}

// Update ingredient summary boxes
function updateIngredientSummary() {
    // Get all ingredients (dynamically from all locations)
    let allIngredients = [];
    Object.keys(ingredients).forEach(location => {
        allIngredients = allIngredients.concat(ingredients[location] || []);
    });

    // Calculate totals
    let totalAvailable = 0;
    let totalReserved = 0;
    let totalExpiring = 0;

    const reservedQty = getReservedQuantities();

    allIngredients.forEach(item => {
        const key = `${item.name.toLowerCase()}|${item.unit.toLowerCase()}`;
        const reserved = item.reserved || reservedQty[key] || 0;
        const available = item.available !== undefined ? item.available : (item.quantity - reserved);

        if (available > 0) totalAvailable++;
        if (reserved > 0) totalReserved++;

        // Check if expiring
        const expStatus = getExpirationStatus(item.expiration);
        if (expStatus === 'expiring-soon' || expStatus === 'expired') {
            totalExpiring++;
        }
    });

    // Update DOM
    const availableEl = document.getElementById('available-count');
    const reservedEl = document.getElementById('reserved-count');
    const expiringEl = document.getElementById('expiring-count');

    if (availableEl) {
        availableEl.textContent = `${totalAvailable} ingredient${totalAvailable !== 1 ? 's' : ''}`;
    }
    if (reservedEl) {
        reservedEl.textContent = `${totalReserved} ingredient${totalReserved !== 1 ? 's' : ''}`;
    }
    if (expiringEl) {
        expiringEl.textContent = `${totalExpiring} ingredient${totalExpiring !== 1 ? 's' : ''}`;
    }
}

function renderIngredients() {
    const gridContainer = document.getElementById('ingredients-grid');
    if (!gridContainer) return;

    const reservedQty = getReservedQuantities();

    // Update summary boxes
    updateIngredientSummary();

    // Gather all ingredients from all locations
    let allItems = [];
    Object.keys(ingredients).forEach(location => {
        const locationItems = ingredients[location] || [];
        locationItems.forEach(item => {
            allItems.push({
                ...item,
                location: location // Add location to each item
            });
        });
    });

    // Filter by location tab
    if (currentLocationFilter !== 'all') {
        allItems = allItems.filter(item => item.location === currentLocationFilter);
    }

    // Filter by search query
    if (ingredientSearchQuery) {
        allItems = allItems.filter(item =>
            item.name.toLowerCase().includes(ingredientSearchQuery) ||
            (item.itemCategory && item.itemCategory.toLowerCase().includes(ingredientSearchQuery)) ||
            item.unit.toLowerCase().includes(ingredientSearchQuery)
        );
    }

    // Sort alphabetically by name
    allItems = allItems.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    // Handle empty state
    if (allItems.length === 0) {
        const message = ingredientSearchQuery
            ? 'No ingredients match your search'
            : currentLocationFilter === 'all'
                ? 'No ingredients yet. Click the + button to add your first item!'
                : `No items in ${currentLocationFilter}`;
        gridContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
                <p style="font-size: 1.1rem;">${message}</p>
            </div>
        `;
        return;
    }

    // Render ingredient cards
    gridContainer.innerHTML = allItems.map(item => {
        const expStatus = getExpirationStatus(item.expiration);
        let expBadge = '';
        let cardClass = 'ingredient-card';

        if (expStatus === 'expired') {
            cardClass += ' expired';
            expBadge = '<span class="exp-badge expired">EXPIRED</span>';
        } else if (expStatus === 'expiring-soon') {
            cardClass += ' expiring-soon';
            expBadge = '<span class="exp-badge expiring">EXPIRING SOON</span>';
        }

        // Calculate reserved and available quantities
        const key = `${item.name.toLowerCase()}|${item.unit.toLowerCase()}`;
        const reserved = item.reserved || reservedQty[key] || 0;
        const available = item.available !== undefined ? item.available : (item.quantity - reserved);

        // Determine availability color
        const availColor = available <= 0
            ? 'var(--danger)'
            : (available < item.quantity * 0.3 ? 'var(--warning)' : 'var(--success)');

        // Category badge (optional)
        const categoryBadge = item.itemCategory
            ? `<span class="category-badge">${item.itemCategory}</span>`
            : '';

        return `
            <div class="${cardClass}">
                <div class="ingredient-card-header">
                    <h4 class="ingredient-card-name">${item.name}</h4>
                    <div class="ingredient-card-badges">
                        ${categoryBadge}
                        ${expBadge}
                    </div>
                </div>

                <div class="ingredient-card-quantities">
                    <div class="qty-box qty-onhand">
                        <div class="qty-label">On Hand</div>
                        <div class="qty-value">${item.quantity} ${item.unit}</div>
                    </div>
                    <div class="qty-box qty-reserved">
                        <div class="qty-label">Reserved</div>
                        <div class="qty-value">${reserved} ${item.unit}</div>
                    </div>
                    <div class="qty-box qty-available">
                        <div class="qty-label">Available</div>
                        <div class="qty-value" style="color: ${availColor}; font-weight: 700;">
                            ${available} ${item.unit}
                        </div>
                    </div>
                </div>

                <div class="ingredient-card-actions">
                    <button class="icon-btn edit-btn"
                            data-action="edit"
                            data-location="${item.location}"
                            data-id="${item.id}"
                            title="Edit">
                        ✏️
                    </button>
                    <button class="icon-btn delete-btn"
                            data-action="delete"
                            data-location="${item.location}"
                            data-id="${item.id}"
                            title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ==============================================
// RECIPES SECTION
// ==============================================

function initRecipes() {
    const saveRecipeBtn = document.getElementById('save-recipe-btn');
    const addRecipeForm = document.getElementById('add-recipe-form');
    const closeModal = addRecipeForm ? addRecipeForm.querySelector('.close-modal') : null;
    const addRecipeIngredientBtn = document.getElementById('add-recipe-ingredient-btn');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const categoryButtons = document.querySelectorAll('.category-filter-btn');
    const searchInput = document.getElementById('recipe-search');
    const floatingAddBtn = document.getElementById('floating-add-recipe');

    // Floating + button - show recipe form
    if (floatingAddBtn) {
        floatingAddBtn.addEventListener('click', () => {
            document.getElementById('recipe-modal-title').textContent = 'Add New Recipe';
            addRecipeForm.classList.remove('hidden');
            clearRecipeForm();
        });
    }

    // Close modal button - specific to add recipe form
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            addRecipeForm.classList.add('hidden');
            clearRecipeForm();
        });
    }

    // Click outside modal to close
    if (addRecipeForm) {
        addRecipeForm.addEventListener('click', (e) => {
            if (e.target === addRecipeForm) {
                addRecipeForm.classList.add('hidden');
                clearRecipeForm();
            }
        });
    }

    // Save recipe button
    if (saveRecipeBtn) {
        saveRecipeBtn.addEventListener('click', saveRecipe);
    }

    // Add ingredient row button
    if (addRecipeIngredientBtn) {
        addRecipeIngredientBtn.addEventListener('click', addRecipeIngredientRow);
    }

    // Status filter buttons (All, Ready to Cook, Expiring Soon, Missing Items, Favorites)
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentRecipeFilter = btn.dataset.filter;
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderRecipes();
        });
    });

    // Category filter buttons
    categoryButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            currentRecipeCategory = btn.dataset.category;
            categoryButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderRecipes();
        });
    });

    // Search input
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            recipeSearchQuery = e.target.value.toLowerCase();
            renderRecipes();
        });
    }

    // Close modal when clicking outside
    const recipeForm = document.getElementById('add-recipe-form');
    if (recipeForm) {
        recipeForm.addEventListener('click', (e) => {
            if (e.target.id === 'add-recipe-form') {
                recipeForm.classList.add('hidden');
            }
        });
    }

    // Don't render recipes on page load - only when navigating to recipes section
    // renderRecipes() is called in initNavigation() when user clicks Recipes tab
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

async function saveRecipe() {
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

    try {
        if (editingRecipeId) {
            // Update existing recipe in Supabase
            await updateRecipe(editingRecipeId, {
                name,
                servings,
                category,
                image,
                instructions,
                ingredients: recipeIngredients
            });
            showToast('Recipe Updated!', `${name} has been updated`, 'success');
        } else {
            // Add new recipe to Supabase
            const recipe = {
                name,
                servings,
                category,
                image,
                instructions,
                ingredients: recipeIngredients
            };
            await addRecipe(recipe);
            showToast('Recipe Added!', `${name} has been added to your recipes`, 'success');
        }

        // Reload recipes from Supabase
        recipes = await loadRecipes();
        renderRecipes();
        renderMealPlan();
        updateDashboardStats();
        updateDataLists();

        document.getElementById('add-recipe-form').classList.add('hidden');
        editingRecipeId = null;
    } catch (error) {
        console.error('Error saving recipe:', error);
        alert('Failed to save recipe: ' + error.message);
    }
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

async function deleteRecipe(id) {
    const recipe = recipes.find(r => r.id === id);
    if (confirm('Are you sure you want to delete this recipe?')) {
        const recipeName = recipe ? recipe.name : 'Recipe';

        try {
            // Delete from Supabase
            const { error } = await supabase
                .from('recipes')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Reload recipes from Supabase
            recipes = await loadRecipes();
            renderRecipes();
            renderMealPlan();
            updateDashboardStats();

            showToast('Recipe Deleted', `${recipeName} has been removed`, 'success');
        } catch (error) {
            console.error('Error deleting recipe:', error);
            alert('Failed to delete recipe: ' + error.message);
        }
    }
}

async function toggleFavorite(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    const newFavoriteState = !recipe.favorite;

    try {
        await updateRecipe(id, { favorite: newFavoriteState });
        recipes = await loadRecipes();
        renderRecipes();

        const message = newFavoriteState ? `${recipe.name} added to favorites!` : `${recipe.name} removed from favorites`;
        showToast(newFavoriteState ? 'Added to Favorites' : 'Removed from Favorites', message, 'success');
    } catch (error) {
        console.error('Error toggling favorite:', error);
        alert('Failed to update favorite: ' + error.message);
    }
}

function toggleColorPicker(id) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    recipe.showColorPicker = !recipe.showColorPicker;
    // Close all other color pickers
    recipes.forEach(r => {
        if (r.id !== id) r.showColorPicker = false;
    });
    renderRecipes();
}

async function setRecipeColor(id, color) {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) return;

    try {
        await updateRecipe(id, { color: color });
        recipes = await loadRecipes();
        renderRecipes();
        showToast('Color Updated', `Recipe card color changed to ${color}!`, 'success');
    } catch (error) {
        console.error('Error updating recipe color:', error);
        alert('Failed to update color: ' + error.message);
    }
}

// Global variable to track current recipe in modal
let currentModalRecipeId = null;

async function openRecipeDetailModal(id) {
    // ID is a UUID string, keep it as-is
    const recipeId = id;

    console.log('🔍 openRecipeDetailModal called with id:', recipeId);
    console.log('📚 Available recipes:', recipes);

    let recipe = recipes.find(r => r.id === recipeId);
    console.log('📖 Found recipe:', recipe);

    // If recipe not found, try reloading recipes (might be out of sync)
    if (!recipe) {
        console.warn('⚠️ Recipe not found in current array, reloading recipes...');
        showToast('Loading Recipe...', 'Refreshing recipe data', 'info');
        try {
            recipes = await loadRecipes();
            recipe = recipes.find(r => r.id === recipeId);
        } catch (error) {
            console.error('❌ Error reloading recipes:', error);
        }
    }

    if (!recipe) {
        console.error('❌ Recipe not found with id:', recipeId);
        showToast('Recipe Not Found', 'This recipe may have been deleted. Try refreshing the page.', 'error');
        return;
    }

    currentModalRecipeId = recipeId;
    populateRecipeModal(recipe);

    const modal = document.getElementById('recipe-detail-modal');
    console.log('🎭 Modal element:', modal);

    if (!modal) {
        console.error('❌ Modal element not found in DOM!');
        return;
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    console.log('✅ Modal should be visible now');
}

// Test function to verify it's accessible globally
window.testModalFunction = function() {
    console.log('✅ Modal functions are globally accessible');
    console.log('📊 Current recipes:', recipes.length);
};

function closeRecipeDetailModal() {
    const modal = document.getElementById('recipe-detail-modal');
    modal.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
    currentModalRecipeId = null;
}

function populateRecipeModal(recipe) {
    const status = checkRecipeStatus(recipe);

    // Set color stripe based on category - refined palette
    const categoryColors = {
        'breakfast': '#D4A574',      // Gentle amber
        'lunch': '#8B9D83',          // Muted sage
        'dinner': '#7C6A5C',         // Warm taupe
        'dessert': '#C4998B',        // Soft terracotta
        'snack': '#C4A892',          // Warm sand
        'default': '#A8B89F'         // Soft sage
    };
    const stripeColor = categoryColors[recipe.category?.toLowerCase()] || categoryColors['default'];
    document.getElementById('modal-color-stripe').style.background = stripeColor;

    // Set recipe name
    document.getElementById('modal-recipe-name').textContent = recipe.name;

    // Set category
    const categoryElement = document.getElementById('modal-recipe-category');
    if (recipe.category) {
        categoryElement.textContent = recipe.category.charAt(0).toUpperCase() + recipe.category.slice(1);
    } else {
        categoryElement.textContent = 'Uncategorized';
    }

    // Set servings
    document.getElementById('modal-recipe-servings').textContent = `Serves ${recipe.servings || 4}`;

    // Set image
    const imageContainer = document.getElementById('modal-recipe-image-container');
    if (recipe.image) {
        imageContainer.innerHTML = `<img src="${recipe.image}" alt="${recipe.name}" onerror="this.parentElement.style.display='none'">`;
        imageContainer.style.display = 'block';
    } else {
        imageContainer.style.display = 'none';
    }

    // Reset servings multiplier
    document.getElementById('modal-servings-multiplier').value = '1';

    // Populate ingredients list with mushroom bullets
    const ingredientsList = document.getElementById('modal-ingredients-list');
    ingredientsList.innerHTML = recipe.ingredients.map(ing => {
        const hasIt = status.have.some(h => h.name === ing.name);
        const className = hasIt ? 'has-ingredient' : 'need-ingredient';
        return `<li class="${className}" data-base-qty="${ing.quantity}">
            🍄 <span class="qty-display">${ing.quantity}</span> ${ing.unit} ${ing.name}
        </li>`;
    }).join('');

    // Handle servings adjustment
    document.getElementById('modal-servings-multiplier').onchange = function() {
        const multiplier = parseFloat(this.value);
        const items = ingredientsList.querySelectorAll('li');
        items.forEach(item => {
            const baseQty = parseFloat(item.getAttribute('data-base-qty'));
            const qtyDisplay = item.querySelector('.qty-display');
            if (qtyDisplay && !isNaN(baseQty)) {
                const scaledQty = (baseQty * multiplier).toFixed(2);
                const formatted = parseFloat(scaledQty).toString();
                qtyDisplay.textContent = formatted;
            }
        });
    };

    // Populate instructions
    const instructionsSection = document.getElementById('modal-instructions-section');
    const instructionsText = document.getElementById('modal-recipe-instructions');
    if (recipe.instructions && recipe.instructions.trim()) {
        instructionsText.textContent = recipe.instructions;
        instructionsSection.style.display = 'block';
    } else {
        instructionsSection.style.display = 'none';
    }

    // Handle missing ingredients section
    const missingSection = document.getElementById('modal-missing-section');
    const missingList = document.getElementById('modal-missing-list');
    if (!status.isReady && status.missing.length > 0) {
        missingList.innerHTML = status.missing.map(ing =>
            `<li>🍄 ${ing.quantity} ${ing.unit} ${ing.name}</li>`
        ).join('');
        missingSection.style.display = 'block';
    } else {
        missingSection.style.display = 'none';
    }

    // Update Cook button
    const cookBtn = document.getElementById('modal-cook-btn');
    if (status.isReady) {
        cookBtn.style.display = 'inline-flex';
    } else {
        cookBtn.style.display = 'none';
    }

    // Update favorite button
    const favoriteBtn = document.getElementById('modal-favorite-btn');
    if (recipe.favorite) {
        favoriteBtn.textContent = '⭐ Favorited';
        favoriteBtn.classList.add('active');
    } else {
        favoriteBtn.textContent = '☆ Favorite';
        favoriteBtn.classList.remove('active');
    }
}

async function cookFromModal() {
    if (!currentModalRecipeId) return;
    closeRecipeDetailModal();
    await cookRecipe(currentModalRecipeId);
}

function editFromModal() {
    if (!currentModalRecipeId) return;
    closeRecipeDetailModal();
    editRecipe(currentModalRecipeId);
}

async function toggleFavoriteFromModal() {
    if (!currentModalRecipeId) return;
    await toggleFavorite(currentModalRecipeId);
    const recipe = recipes.find(r => r.id === currentModalRecipeId);
    if (recipe) {
        populateRecipeModal(recipe); // Refresh modal content
    }
}

function addMissingFromModal() {
    if (!currentModalRecipeId) return;
    const multiplier = parseFloat(document.getElementById('modal-servings-multiplier').value) || 1;
    addMissingToShopping(currentModalRecipeId, multiplier);
}

async function cookFromModal() {
    if (!currentModalRecipeId) return;
    await cookRecipe(currentModalRecipeId);
}

// Expose modal functions to window for inline handlers
window.editFromModal = editFromModal;
window.toggleFavoriteFromModal = toggleFavoriteFromModal;
window.addMissingFromModal = addMissingFromModal;
window.cookFromModal = cookFromModal;

// Keep for backward compatibility but unused in new design
async function toggleRecipeCard(event, id) {
    await openRecipeDetailModal(id);
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

async function cookRecipe(id) {
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

    try {
        let deductedCount = 0;
        // Get all ingredients from all locations (including custom ones)
        let allIngredients = [];
        Object.keys(ingredients).forEach(location => {
            allIngredients = allIngredients.concat(ingredients[location] || []);
        });

        // Deduct each required ingredient
        for (const reqIng of recipe.ingredients) {
            let remaining = reqIng.quantity;

            // Find matching ingredients across all locations
            const matches = allIngredients.filter(ing =>
                ing.name.toLowerCase() === reqIng.name.toLowerCase() &&
                ing.unit.toLowerCase() === reqIng.unit.toLowerCase()
            );

            for (const match of matches) {
                if (remaining <= 0) break;

                if (match.quantity >= remaining) {
                    // Deduct from this ingredient
                    const newQty = match.quantity - remaining;
                    if (newQty <= 0) {
                        // Delete ingredient
                        await deletePantryItem(match.id);
                    } else {
                        // Update quantity
                        await updatePantryItem(match.id, { quantity: newQty });
                    }
                    deductedCount++;
                    remaining = 0;
                } else {
                    // Use all from this ingredient
                    await deletePantryItem(match.id);
                    remaining -= match.quantity;
                    deductedCount++;
                }
            }
        }

        // Reload ingredients from Supabase
        ingredients = await loadPantryItems();
        renderIngredients();
        renderRecipes();

        alert(`✅ Cooked "${recipe.name}"!\n\n${deductedCount} ingredient types deducted from your pantry.\n\nEnjoy your meal! 🍽️`);
    } catch (error) {
        console.error('Error cooking recipe:', error);
        alert('Failed to cook recipe: ' + error.message);
    }
}

function checkRecipeStatus(recipe) {
    // Get all ingredients from all locations (including custom ones)
    let allIngredients = [];
    Object.keys(ingredients).forEach(location => {
        allIngredients = allIngredients.concat(ingredients[location] || []);
    });

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

    // Get all ingredients from all locations (including custom ones)
    let allIngredients = [];
    Object.keys(ingredients).forEach(location => {
        allIngredients = allIngredients.concat(ingredients[location] || []);
    });
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

    // Helper function to check if recipe has expiring ingredients
    function hasExpiringIngredients(recipe) {
        // Get all ingredients from all locations (including custom ones)
        let allIngredients = [];
        Object.keys(ingredients).forEach(location => {
            allIngredients = allIngredients.concat(ingredients[location] || []);
        });
        return recipe.ingredients.some(recipeIng => {
            const ingredient = allIngredients.find(inv =>
                inv.name.toLowerCase() === recipeIng.name.toLowerCase()
            );
            if (!ingredient || !ingredient.expiration) return false;
            const expStatus = getExpirationStatus(ingredient.expiration);
            return expStatus === 'expiring-soon' || expStatus === 'expired';
        });
    }

    // Filter by status
    if (currentRecipeFilter === 'ready') {
        filteredRecipes = filteredRecipes.filter(recipe => checkRecipeStatus(recipe).isReady);
    } else if (currentRecipeFilter === 'expiring') {
        // Show recipes with expiring ingredients
        filteredRecipes = filteredRecipes.filter(recipe => hasExpiringIngredients(recipe));
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
        const statusText = status.isReady ? '✓ Ready' : 'Need Ingredients';

        // Assign color based on category - refined, sophisticated palette
        const categoryColors = {
            'breakfast': '#D4A574',      // Gentle amber
            'lunch': '#8B9D83',          // Muted sage
            'dinner': '#7C6A5C',         // Warm taupe
            'dessert': '#C4998B',        // Soft terracotta
            'snack': '#C4A892',          // Warm sand
            'default': '#A8B89F'         // Soft sage
        };
        const cardColor = categoryColors[recipe.category?.toLowerCase()] || categoryColors['default'];

        return `
            <div class="cottage-recipe-card"
                 data-recipe-id="${recipe.id}"
                 onclick="openRecipeDetailModal('${recipe.id}')"
                 style="border-left: 6px solid ${cardColor};">

                ${recipe.favorite ? '<div class="recipe-favorite-star">⭐</div>' : ''}

                <div class="recipe-card-title">
                    <h3>${recipe.name}</h3>
                </div>

                <div class="recipe-card-meta">
                    ${recipe.category ? `
                        <span class="recipe-meta-item">
                            <span class="meta-label">Category:</span>
                            <span class="meta-value">${recipe.category.charAt(0).toUpperCase() + recipe.category.slice(1)}</span>
                        </span>
                    ` : ''}

                    <span class="recipe-meta-item">
                        <span class="meta-label">Serves:</span>
                        <span class="meta-value">${recipe.servings || 4}</span>
                    </span>
                </div>

                <div class="recipe-card-status ${statusClass}">
                    ${showExpiringBadge ?
                        '<span class="status-badge expiring">🔥 Cook Soon!</span>' :
                        `<span class="status-badge">${statusText}</span>`
                    }
                </div>

                <div class="recipe-card-hint">
                    Tap to view full recipe →
                </div>
            </div>
        `;
    }

    // Build responsive deck-style layout
    let html = `
        <div class="recipe-deck-container">
            ${readyRecipes.length > 0 ? `
                <div class="recipe-deck-section">
                    <div class="deck-section-header ready">
                        <h3>✅ Ready to Cook</h3>
                        <span class="recipe-count">${readyRecipes.length} recipe${readyRecipes.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="recipe-cards-grid">
                        ${readyRecipes.map(recipe => renderRecipeCard(recipe)).join('')}
                    </div>
                </div>
            ` : ''}

            ${cookSoonRecipes.length > 0 ? `
                <div class="recipe-deck-section">
                    <div class="deck-section-header cook-soon">
                        <h3>🔥 Cook These Soon!</h3>
                        <span class="recipe-count">${cookSoonRecipes.length} recipe${cookSoonRecipes.length !== 1 ? 's' : ''}</span>
                        <p class="section-note">Ingredients expiring soon</p>
                    </div>
                    <div class="recipe-cards-grid">
                        ${cookSoonRecipes.map(recipe => renderRecipeCard(recipe, true)).join('')}
                    </div>
                </div>
            ` : ''}

            ${needIngredientsRecipes.length > 0 ? `
                <div class="recipe-deck-section">
                    <div class="deck-section-header need-ingredients">
                        <h3>📝 Need Ingredients</h3>
                        <span class="recipe-count">${needIngredientsRecipes.length} recipe${needIngredientsRecipes.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="recipe-cards-grid">
                        ${needIngredientsRecipes.map(recipe => renderRecipeCard(recipe)).join('')}
                    </div>
                </div>
            ` : ''}

            ${readyRecipes.length === 0 && cookSoonRecipes.length === 0 && needIngredientsRecipes.length === 0 ? `
                <div class="empty-recipes-state">
                    <p>No recipes yet. Add your first recipe to get started! 🍳</p>
                </div>
            ` : ''}
        </div>
    `;

    recipeList.innerHTML = html;

    // Update smart meal suggestions
    updateMealSuggestions();
}

// ==============================================
// SHOPPING LIST SECTION
// ==============================================

async function initShopping() {
    const addShoppingItemBtn = document.getElementById('add-shopping-item-btn');
    const autoGenerateBtn = document.getElementById('auto-generate-list-btn');
    const generateFromMealPlanBtn = document.getElementById('generate-from-meal-plan-btn');
    const clearListBtn = document.getElementById('clear-shopping-list-btn');
    const floatingAddBtn = document.getElementById('floating-add-shopping');
    const cancelAddShoppingBtn = document.getElementById('cancel-add-shopping');
    const shoppingFormContainer = document.getElementById('add-shopping-form-container');

    // Populate category dropdown from database
    await populateShoppingCategoryDropdown();

    // Load and display recent purchases
    await loadAndDisplayRecentPurchases();

    // Floating + button - show form
    if (floatingAddBtn) {
        floatingAddBtn.addEventListener('click', () => {
            shoppingFormContainer.classList.remove('hidden');
            document.getElementById('shopping-item-name').focus();
        });
    }

    // Cancel button
    if (cancelAddShoppingBtn) {
        cancelAddShoppingBtn.addEventListener('click', () => {
            shoppingFormContainer.classList.add('hidden');
            clearShoppingForm();
        });
    }

    // Add shopping item button
    if (addShoppingItemBtn) {
        addShoppingItemBtn.addEventListener('click', addShoppingItem);
    }

    // Auto-generate buttons
    if (autoGenerateBtn) {
        autoGenerateBtn.addEventListener('click', autoGenerateShoppingList);
    }

    if (generateFromMealPlanBtn) {
        generateFromMealPlanBtn.addEventListener('click', generateFromMealPlan);
    }

    if (clearListBtn) {
        clearListBtn.addEventListener('click', clearShoppingList);
    }

    // Print button
    const printListBtn = document.getElementById('print-shopping-list-btn');
    if (printListBtn) {
        printListBtn.addEventListener('click', printShoppingList);
    }

    // Enter key on name input
    const nameInput = document.getElementById('shopping-item-name');
    if (nameInput) {
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addShoppingItem();
        });
    }

    renderShoppingList();
}

// Populate category dropdown from database
async function populateShoppingCategoryDropdown() {
    const categorySelect = document.getElementById('shopping-item-category');
    if (!categorySelect) return;

    try {
        const categories = await loadCategories();
        categorySelect.innerHTML = categories.map(cat =>
            `<option value="${cat.name}">${cat.name}</option>`
        ).join('');
    } catch (error) {
        console.error('Error populating shopping category dropdown:', error);
        // Fallback to defaults
        categorySelect.innerHTML = `
            <option value="Produce">Produce</option>
            <option value="Dairy">Dairy</option>
            <option value="Meat">Meat</option>
            <option value="Pantry Staples">Pantry Staples</option>
        `;
    }
}

// Load and display top 10 recent purchases
async function loadAndDisplayRecentPurchases() {
    const container = document.getElementById('recent-purchases-section');
    if (!container) return;

    try {
        const recentItems = await loadRecentPurchases();

        if (recentItems.length === 0) {
            container.style.display = 'none';
            return;
        }

        // Take top 10
        const top10 = recentItems.slice(0, 10);

        container.innerHTML = `
            <div class="recent-purchases-card">
                <h4>Quick Add from Recent Purchases</h4>
                <div class="recent-purchases-grid">
                    ${top10.map(item => `
                        <button class="recent-purchase-btn" onclick="quickAddRecentItem('${item.name}', '${item.unit || ''}')">
                            + ${item.name}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        container.style.display = 'block';
    } catch (error) {
        console.error('Error loading recent purchases:', error);
        container.style.display = 'none';
    }
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
    const categorySelect = document.getElementById('shopping-item-category');
    if (categorySelect && categorySelect.options.length > 0) {
        categorySelect.selectedIndex = 0;
    }
}

// Quick add from recent purchases
async function quickAddRecentItem(itemName, unit) {
    try {
        const household = await getUserHousehold();
        const user = await getCurrentUser();

        // Check if already in shopping list
        const existing = shoppingList.find(item =>
            item.name.toLowerCase() === itemName.toLowerCase()
        );

        if (existing) {
            showToast('Already in List', `${itemName} is already in your shopping list`, 'info');
            return;
        }

        // Auto-categorize
        const category = autoCategorizeShopping(itemName);

        // Add to database
        const { error } = await supabase
            .from('shopping_list')
            .insert({
                household_id: household.id,
                created_by: user.id,
                name: itemName,
                quantity: 1,
                unit: unit || 'unit',
                category: category,
                checked: false
            });

        if (error) throw error;

        // Reload shopping list
        shoppingList = await loadShoppingList();
        renderShoppingList();

        showToast('Added!', `${itemName} added to shopping list`, 'success');
    } catch (error) {
        console.error('Error quick-adding item:', error);
        showToast('Error', 'Failed to add item', 'error');
    }
}

async function addShoppingItem() {
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

    try {
        const household = await getUserHousehold();
        const user = await getCurrentUser();

        // Add to Supabase
        const { error } = await supabase
            .from('shopping_list')
            .insert({
                household_id: household.id,
                created_by: user.id,
                name,
                quantity,
                unit,
                category,
                checked: false
            });

        if (error) throw error;

        // Reload shopping list from Supabase
        shoppingList = await loadShoppingList();
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
        showToast('Item Added', `${name} added to shopping list`, 'success');
    } catch (error) {
        console.error('Error adding shopping item:', error);
        alert('Failed to add item: ' + error.message);
    }
}

async function toggleShoppingItem(id) {
    const item = shoppingList.find(item => item.id === id);
    if (item) {
        try {
            const newCheckedState = !item.checked;
            const { error } = await supabase
                .from('shopping_list')
                .update({ checked: newCheckedState })
                .eq('id', id);

            if (error) throw error;

            // Reload shopping list from Supabase
            shoppingList = await loadShoppingList();
            renderShoppingList();
        } catch (error) {
            console.error('Error toggling shopping item:', error);
            alert('Failed to update item: ' + error.message);
        }
    }
}

async function deleteShoppingItem(id) {
    try {
        const { error } = await supabase
            .from('shopping_list')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Reload shopping list from Supabase
        shoppingList = await loadShoppingList();
        renderShoppingList();
        updateDashboardStats();
        showToast('Item Removed', 'Item removed from shopping list', 'success');
    } catch (error) {
        console.error('Error deleting shopping item:', error);
        alert('Failed to delete item: ' + error.message);
    }
}

async function addMissingToShopping(recipeId, servingsMultiplier = 1) {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const status = checkRecipeStatus(recipe);
    if (status.missing.length === 0) {
        showToast('All Set!', 'You have all ingredients for this recipe', 'info');
        return;
    }

    try {
        let addedCount = 0;
        for (const ing of status.missing) {
            const scaledQuantity = ing.quantity * servingsMultiplier;

            // Check if already in shopping list
            const existing = shoppingList.find(item =>
                item.name.toLowerCase() === ing.name.toLowerCase() &&
                item.unit.toLowerCase() === ing.unit.toLowerCase()
            );

            if (existing) {
                // Update existing quantity in database
                await updateShoppingItem(existing.id, {
                    quantity: existing.quantity + scaledQuantity
                });
                addedCount++;
            } else {
                // Add new item to database
                const category = autoCategorizeShopping(ing.name);
                await addShoppingItem({
                    name: ing.name,
                    quantity: scaledQuantity,
                    unit: ing.unit,
                    category: category
                });
                addedCount++;
            }
        }

        // Reload shopping list from database
        shoppingList = await loadShoppingList();
        renderShoppingList();
        updateDashboardStats();

        const multiplierText = servingsMultiplier !== 1 ? ` (×${servingsMultiplier})` : '';
        showToast('Added to Shopping List', `${addedCount} ingredient${addedCount > 1 ? 's' : ''} from ${recipe.name}${multiplierText}`, 'success');
    } catch (error) {
        console.error('Error adding to shopping list:', error);
        showToast('Error', 'Failed to add items to shopping list', 'error');
    }
}

async function autoGenerateShoppingList() {
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

    try {
        let addedCount = 0;
        for (const ing of missingIngredients) {
            const alreadyInList = shoppingList.find(item =>
                item.name.toLowerCase() === ing.name.toLowerCase() &&
                item.unit.toLowerCase() === ing.unit.toLowerCase()
            );
            if (!alreadyInList) {
                const category = autoCategorizeShopping(ing.name);
                await addShoppingItem({
                    name: ing.name,
                    quantity: ing.quantity,
                    unit: ing.unit,
                    category: category
                });
                addedCount++;
            }
        }

        // Reload shopping list from database
        shoppingList = await loadShoppingList();
        renderShoppingList();
        updateDashboardStats();
        showToast('Added to Shopping List', `${addedCount} missing ingredient${addedCount > 1 ? 's' : ''} from recipes`, 'success');
    } catch (error) {
        console.error('Error auto-generating shopping list:', error);
        showToast('Error', 'Failed to generate shopping list', 'error');
    }
}

async function generateFromMealPlan() {
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
    // Get all ingredients from all locations (including custom ones)
    let allIngredients = [];
    Object.keys(ingredients).forEach(location => {
        allIngredients = allIngredients.concat(ingredients[location] || []);
    });
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

    try {
        let addedCount = 0;
        for (const ing of missing) {
            const alreadyInList = shoppingList.find(item =>
                item.name.toLowerCase() === ing.name.toLowerCase() &&
                item.unit.toLowerCase() === ing.unit.toLowerCase()
            );
            if (!alreadyInList) {
                const category = autoCategorizeShopping(ing.name);
                await addShoppingItem({
                    name: ing.name,
                    quantity: ing.quantity,
                    unit: ing.unit,
                    category: category
                });
                addedCount++;
            }
        }

        // Reload shopping list from database
        shoppingList = await loadShoppingList();
        renderShoppingList();
        updateDashboardStats();
        showToast('Added to Shopping List', `${addedCount} ingredient${addedCount > 1 ? 's' : ''} from meal plan`, 'success');
    } catch (error) {
        console.error('Error generating from meal plan:', error);
        showToast('Error', 'Failed to generate shopping list from meal plan', 'error');
    }
}

function clearShoppingList() {
    if (confirm('Are you sure you want to clear the shopping list?')) {
        shoppingList = [];
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

    // Add copy list button if there are items
    if (shoppingList.length > 0) {
        html += `
            <div style="display: flex; justify-content: flex-end; margin-bottom: 15px;">
                <button onclick="copyShoppingListToClipboard()" class="btn-secondary" style="font-size: 14px;">
                    📋 Copy List
                </button>
            </div>
        `;
    }

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

    // Add "Send to Pantry" button if there are checked items
    if (hasCheckedItems) {
        html += `
            <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                <button onclick="openSendToPantryModal()" style="background: white; color: #38a169; width: 100%; padding: 12px; border: none; border-radius: 8px; font-weight: 700; font-size: 16px; cursor: pointer;">
                    ✅ Send Checked Items to Pantry
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
                                <div onclick="toggleShoppingItem('${item.id}')" style="cursor: pointer; flex: 1;">
                                    <span style="font-weight: 600; font-size: 15px;">${item.name}</span>
                                </div>
                                <div style="display: flex; gap: 5px;">
                                    <button onclick="editShoppingItem('${item.id}')" style="padding: 6px 12px; background: #667eea; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Edit</button>
                                    <button class="delete-btn" onclick="deleteShoppingItem('${item.id}')">Delete</button>
                                </div>
                            </div>
                            ${!item.checked ? `
                                <div onclick="toggleShoppingItem('${item.id}')" style="cursor: pointer; color: #667eea; font-size: 14px; margin-bottom: 5px;">
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
                                                   onchange="updatePurchasedQuantity('${item.id}', this.value)"
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
    }
}

function updateTargetLocation(id, value) {
    const item = shoppingList.find(item => item.id === id);
    if (item) {
        item.targetLocation = value;
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
    renderShoppingList();
    showToast('All Checked', `${shoppingList.length} item${shoppingList.length > 1 ? 's' : ''} checked`, 'success');
}

function uncheckAllShoppingItems() {
    shoppingList.forEach(item => {
        item.checked = false;
        item.purchasedQuantity = null; // Reset purchased quantity
    });
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
    renderShoppingList();
}

function getSuggestedLocation(category) {
    const fridgeCategories = ['dairy', 'meat', 'produce', 'beverages'];
    const freezerCategories = ['frozen'];

    if (fridgeCategories.includes(category)) return 'fridge';
    if (freezerCategories.includes(category)) return 'freezer';
    return 'pantry';
}

async function quickAddItem(itemName) {
    try {
        // Check if already in shopping list
        const existing = shoppingList.find(item => item.name.toLowerCase() === itemName.toLowerCase());

        if (existing) {
            await updateShoppingItem(existing.id, {
                quantity: existing.quantity + 1
            });
            showToast('Quantity Updated', `${itemName} quantity increased to ${existing.quantity + 1}`, 'info');
        } else {
            const category = autoCategorizeShopping(itemName);
            await addShoppingItem({
                name: itemName,
                quantity: 1,
                unit: 'unit',
                category: category
            });
            showToast('Added to Shopping List', `${itemName} added`, 'success');
        }

        // Reload shopping list from database
        shoppingList = await loadShoppingList();
        renderShoppingList();
        updateDashboardStats();
    } catch (error) {
        console.error('Error quick-adding item:', error);
        showToast('Error', 'Failed to add item to shopping list', 'error');
    }
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

// ==============================================
// SEND TO PANTRY MODAL
// ==============================================

async function openSendToPantryModal() {
    const checkedItems = shoppingList.filter(item => item.checked);

    if (checkedItems.length === 0) {
        showToast('No Items', 'No items are checked', 'info');
        return;
    }

    const modal = document.getElementById('send-to-pantry-modal');
    const itemsList = document.getElementById('send-to-pantry-items-list');

    // Load locations and categories
    const locations = await loadLocations();
    const categories = await loadCategories();

    // Build form for each checked item
    itemsList.innerHTML = checkedItems.map((item, index) => `
        <div class="send-to-pantry-item" style="background: var(--bg-secondary); padding: var(--spacing-md); border-radius: var(--radius-md); margin-bottom: var(--spacing-md);">
            <h5 style="margin: 0 0 var(--spacing-sm) 0; color: var(--text-primary);">${item.name}</h5>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-sm);">
                <div>
                    <label style="font-size: 0.85rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Storage Location</label>
                    <select id="pantry-location-${index}" class="pantry-location-select" style="width: 100%; padding: 0.5rem; border: 2px solid var(--border); border-radius: var(--radius-sm);">
                        ${locations.map(loc => `<option value="${loc.name.toLowerCase()}">${loc.name}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size: 0.85rem; color: var(--text-secondary); display: block; margin-bottom: 0.25rem;">Item Category</label>
                    <select id="pantry-category-${index}" class="pantry-category-select" style="width: 100%; padding: 0.5rem; border: 2px solid var(--border); border-radius: var(--radius-sm);">
                        <option value="">-- Select --</option>
                        ${categories.map(cat => `<option value="${cat.name}" ${cat.name === item.category ? 'selected' : ''}>${cat.name}</option>`).join('')}
                    </select>
                </div>
            </div>
        </div>
    `).join('');

    modal.classList.remove('hidden');

    // Set up confirm button
    const confirmBtn = document.getElementById('confirm-send-to-pantry-btn');
    confirmBtn.onclick = confirmSendToPantry;
}

function closeSendToPantryModal() {
    const modal = document.getElementById('send-to-pantry-modal');
    modal.classList.add('hidden');
}

async function confirmSendToPantry() {
    const checkedItems = shoppingList.filter(item => item.checked);

    try {
        for (let i = 0; i < checkedItems.length; i++) {
            const item = checkedItems[i];
            const locationSelect = document.getElementById(`pantry-location-${i}`);
            const categorySelect = document.getElementById(`pantry-category-${i}`);

            const location = locationSelect ? locationSelect.value : 'pantry';
            const itemCategory = categorySelect && categorySelect.value ? categorySelect.value : null;

            // Add to pantry
            await addPantryItem({
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                category: location, // Storage location (WHERE)
                itemCategory: itemCategory, // Item category (WHAT)
                expiration: null
            });

            // Add to recent purchases
            await addRecentPurchase({
                name: item.name,
                unit: item.unit
            });

            // Delete from shopping list
            await supabase
                .from('shopping_list')
                .delete()
                .eq('id', item.id);
        }

        // Reload data
        ingredients = await loadPantryItems();
        shoppingList = await loadShoppingList();
        await loadAndDisplayRecentPurchases(); // Refresh recent purchases
        renderIngredients();
        renderShoppingList();
        updateDashboardStats();

        closeSendToPantryModal();
        showToast('Success!', `${checkedItems.length} item${checkedItems.length > 1 ? 's' : ''} sent to pantry`, 'success');
    } catch (error) {
        console.error('Error sending to pantry:', error);
        showToast('Error', 'Failed to send items to pantry', 'error');
    }
}

// ==============================================
// MEAL PLAN SECTION
// ==============================================

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

async function clearMealPlan() {
    const options = ['Clear Current Week (Week 1)', 'Clear Next Week (Week 2)', 'Clear Both Weeks', 'Cancel'];
    const choice = prompt(`Choose an option:\n1. ${options[0]}\n2. ${options[1]}\n3. ${options[2]}\n4. ${options[3]}\n\nEnter 1, 2, 3, or 4:`);

    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    try {
        if (choice === '1') {
            for (const day of days) {
                await saveMealPlanEntry('week1', day, []);
            }
            mealPlan = await loadMealPlan();
            renderMealPlan();
            renderIngredients();
            updateDashboardStats();
            showToast('Week 1 Cleared', 'Current week meals removed', 'success');
        } else if (choice === '2') {
            for (const day of days) {
                await saveMealPlanEntry('week2', day, []);
            }
            mealPlan = await loadMealPlan();
            renderMealPlan();
            renderIngredients();
            updateDashboardStats();
            showToast('Week 2 Cleared', 'Next week meals removed', 'success');
        } else if (choice === '3') {
            if (confirm('Are you sure you want to clear BOTH weeks?')) {
                for (const day of days) {
                    await saveMealPlanEntry('week1', day, []);
                    await saveMealPlanEntry('week2', day, []);
                }
                mealPlan = await loadMealPlan();
                renderMealPlan();
                renderIngredients();
                updateDashboardStats();
                showToast('Both Weeks Cleared', 'All meals removed from plan', 'success');
            }
        }
    } catch (error) {
        console.error('Error clearing meal plan:', error);
        showToast('Error', 'Failed to clear meal plan', 'error');
    }
}

// Expose to window for inline handlers
window.clearMealPlan = clearMealPlan;

async function duplicateWeek() {
    // Duplicate Week 1 to Week 2
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    // Check if Week 1 has any meals
    const hasMeals = days.some(day => mealPlan.week1[day] && mealPlan.week1[day].length > 0);

    if (!hasMeals) {
        showToast('Nothing to Duplicate', 'Week 1 is empty', 'info');
        return;
    }

    if (!confirm('This will copy Week 1 to Week 2, replacing any existing Week 2 meals. Continue?')) {
        return;
    }

    try {
        // Copy Week 1 to Week 2
        for (const day of days) {
            const week1Recipes = mealPlan.week1[day] || [];
            await saveMealPlanEntry('week2', day, [...week1Recipes]);
        }

        // Reload meal plan from database
        mealPlan = await loadMealPlan();
        renderMealPlan();
        updateDashboardStats();
        showToast('Week Duplicated!', 'Week 1 copied to Week 2', 'success');
    } catch (error) {
        console.error('Error duplicating week:', error);
        showToast('Error', 'Failed to duplicate week', 'error');
    }
}

// Expose to window for inline handlers
window.duplicateWeek = duplicateWeek;

function renderMealPlan() {
    const week1Container = document.getElementById('week1-days');
    const week2Container = document.getElementById('week2-days');
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const today = getTodayDayName();

    // Ensure meal plan structure exists
    if (!mealPlan.week1 || !mealPlan.week2) {
        console.error('Meal plan structure missing, reinitializing...');
        mealPlan = {
            week1: {
                monday: [],
                tuesday: [],
                wednesday: [],
                thursday: [],
                friday: [],
                saturday: [],
                sunday: []
            },
            week2: {
                monday: [],
                tuesday: [],
                wednesday: [],
                thursday: [],
                friday: [],
                saturday: [],
                sunday: []
            }
        };
    }

    if (recipes.length === 0) {
        const emptyState = '<div class="empty-state"><p>No recipes available. Add some recipes first to create your meal plan!</p></div>';
        if (week1Container) week1Container.innerHTML = emptyState;
        if (week2Container) week2Container.innerHTML = emptyState;
        return;
    }

    const recipeOptions = recipes
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        .map(recipe => `<option value="${recipe.id}">${recipe.name}</option>`)
        .join('');

    // Helper function to render a single week's days
    const renderWeekDays = (weekKey, container) => {
        const weekData = mealPlan[weekKey];
        const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const todayIndex = dayOrder.indexOf(today);

        const isPastDay = (day) => {
            if (weekKey === 'week2') return false; // Week 2 is always future
            const dayIndex = dayOrder.indexOf(day);
            return dayIndex < todayIndex;
        };

        const isToday = (day) => {
            return weekKey === 'week1' && day === today;
        };

        const daysHTML = days.map(day => {
            const dayRecipes = (weekData[day] || []).map(id => recipes.find(r => r.id === id)).filter(Boolean);
            const dayName = day.charAt(0).toUpperCase() + day.slice(1);
            const past = isPastDay(day);
            const todayDay = isToday(day);

            return `
            <div class="meal-day-card ${past ? 'past-day' : ''} ${todayDay ? 'today-day' : ''}" id="meal-day-${weekKey}-${day}">
                <div class="meal-day-header">
                    <div class="meal-day-title">
                        <h4>${dayName}</h4>
                        ${todayDay ? '<span class="today-badge">📍 TODAY</span>' : ''}
                    </div>
                    <span class="meal-count">${dayRecipes.length} ${dayRecipes.length === 1 ? 'meal' : 'meals'}</span>
                </div>

                <div class="meal-list">
                    ${dayRecipes.map(recipe => `
                        <div class="meal-item">
                            <div class="meal-item-content">
                                <span class="meal-recipe-name">${recipe.name}</span>
                                ${recipe.servings ? `<span class="meal-servings">${recipe.servings} servings</span>` : ''}
                            </div>
                            <div class="meal-item-actions">
                                <button class="meal-action-btn cook-btn" onclick="cookNowAndDeduct('${recipe.id}', '${weekKey}', '${day}')" title="Cook this recipe now">
                                    🍳
                                </button>
                                <button class="meal-action-btn remove-btn" onclick="removeRecipeFromMeal('${weekKey}', '${day}', '${recipe.id}')" title="Remove from plan">
                                    ✕
                                </button>
                            </div>
                        </div>
                    `).join('')}

                    ${dayRecipes.length === 0 ? '<p class="empty-day-message">No meals planned</p>' : ''}

                    <div class="add-meal-section">
                        <select class="add-meal-select" onchange="addRecipeToMeal('${weekKey}', '${day}', this.value); this.value='';">
                            <option value="">+ Add meal</option>
                            ${recipeOptions}
                        </select>
                    </div>
                </div>
            </div>
            `;
        }).join('');

        container.innerHTML = daysHTML;
    };

    // Render both weeks
    if (week1Container) renderWeekDays('week1', week1Container);
    if (week2Container) renderWeekDays('week2', week2Container);
}

function switchWeek(week) {
    currentWeekView = week;
    renderMealPlan();
}

function toggleMealDay(day) {
    // No longer needed with simplified design
}

function expandAllMealDays() {
    // No longer needed with simplified design
}

function collapseAllMealDays() {
    // No longer needed with simplified design
}

async function addRecipeToMeal(week, day, recipeId) {
    console.log('🍽️ addRecipeToMeal called:', { week, day, recipeId });
    if (!recipeId) {
        console.log('⚠️ No recipeId provided');
        return;
    }

    // recipeId is a UUID string, keep as-is
    console.log('📝 RecipeId:', recipeId);

    // Ensure mealPlan[week][day] is an array
    if (!Array.isArray(mealPlan[week][day])) {
        mealPlan[week][day] = [];
    }

    // Add recipe if not already there
    if (!mealPlan[week][day].includes(recipeId)) {
        mealPlan[week][day].push(recipeId);
        console.log('✅ Recipe added to local meal plan');

        try {
            // Save to Supabase - use saveMealPlanEntry with the full array
            await saveMealPlanEntry(week, day, mealPlan[week][day]);
            console.log('✅ Saved to Supabase');

            // Reload from Supabase to ensure consistency
            mealPlan = await loadMealPlan();
            renderMealPlan();
            updateDashboardStats();
            showToast('Meal Added', 'Recipe added to meal plan', 'success');
        } catch (error) {
            console.error('❌ Error adding meal:', error);
            // Revert the local change
            mealPlan[week][day] = mealPlan[week][day].filter(id => id !== recipeId);
            showToast('Error', 'Failed to add meal: ' + error.message, 'error');
        }
    } else {
        console.log('ℹ️ Recipe already in meal plan for this day');
    }
}

// Expose to window for inline handlers
window.addRecipeToMeal = addRecipeToMeal;

async function removeRecipeFromMeal(week, day, recipeId) {
    if (Array.isArray(mealPlan[week][day])) {
        // recipeId is a UUID string, keep as-is

        // Remove recipe from the array
        const updatedRecipes = mealPlan[week][day].filter(id => id !== recipeId);

        try {
            // Save updated array to Supabase
            await saveMealPlanEntry(week, day, updatedRecipes);

            // Reload from Supabase to ensure consistency
            mealPlan = await loadMealPlan();
            renderMealPlan();
            updateDashboardStats();
            showToast('Meal Removed', 'Recipe removed from plan', 'success');
        } catch (error) {
            console.error('Error removing meal:', error);
            showToast('Error', 'Failed to remove meal: ' + error.message, 'error');
        }
    }
}

// Expose to window for inline handlers
window.removeRecipeFromMeal = removeRecipeFromMeal;

async function cookNowAndDeduct(recipeId, week, day) {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    // Check ingredient availability
    const status = checkRecipeStatus(recipe);

    if (status.missing.length > 0) {
        // Missing ingredients - offer to add to shopping list
        const missingList = status.missing.map(ing =>
            `${ing.name}: ${ing.quantity} ${ing.unit}`
        ).join('\n');

        if (confirm(`You're missing some ingredients:\n\n${missingList}\n\nAdd them to shopping list?`)) {
            try {
                let addedCount = 0;
                for (const ing of status.missing) {
                    const existingItem = shoppingList.find(
                        item => item.name.toLowerCase() === ing.name.toLowerCase()
                    );

                    if (!existingItem) {
                        const category = autoCategorizeShopping(ing.name);
                        await addShoppingItem({
                            name: ing.name,
                            quantity: ing.quantity,
                            unit: ing.unit,
                            category: category
                        });
                        addedCount++;
                    }
                }

                // Reload shopping list from database
                shoppingList = await loadShoppingList();
                renderShoppingList();
                showToast('Added to Shopping List', `${addedCount} missing ingredient${addedCount > 1 ? 's' : ''} for ${recipe.name}`, 'success');
            } catch (error) {
                console.error('Error adding missing ingredients to shopping list:', error);
                showToast('Error', 'Failed to add ingredients to shopping list', 'error');
            }
        }
    } else {
        // All ingredients available - show recipe and confirm cooking
        const instructions = recipe.instructions || 'No instructions provided.';
        const ingredientsList = recipe.ingredients.map(ing =>
            `• ${ing.quantity} ${ing.unit} ${ing.name}`
        ).join('\n');

        const message = `Recipe: ${recipe.name}\n${recipe.servings ? `Servings: ${recipe.servings}\n` : ''}\n\nIngredients:\n${ingredientsList}\n\nInstructions:\n${instructions}\n\nThis will deduct ingredients from your pantry and remove this meal from your plan. Continue?`;

        if (confirm(message)) {
            // Deduct ingredients from pantry
            let deductedCount = 0;

            recipe.ingredients.forEach(reqIng => {
                let remaining = reqIng.quantity;

                ['pantry', 'fridge', 'freezer'].forEach(location => {
                    if (remaining <= 0) return;

                    const ingIndex = ingredients[location].findIndex(ing =>
                        ing.name.toLowerCase() === reqIng.name.toLowerCase() &&
                        ing.unit.toLowerCase() === reqIng.unit.toLowerCase()
                    );

                    if (ingIndex !== -1) {
                        const available = ingredients[location][ingIndex].quantity;

                        if (available >= remaining) {
                            ingredients[location][ingIndex].quantity -= remaining;
                            deductedCount++;

                            if (ingredients[location][ingIndex].quantity <= 0) {
                                ingredients[location].splice(ingIndex, 1);
                            }

                            remaining = 0;
                        } else {
                            remaining -= available;
                            ingredients[location].splice(ingIndex, 1);
                            deductedCount++;
                        }
                    }
                });
            });

            // Remove meal from plan
            removeRecipeFromMeal(week, day, recipeId);

            renderIngredients();
            renderRecipes();

            showToast('Meal Cooked!', `Cooked ${recipe.name}! ${deductedCount} ingredients deducted`, 'success');
        }
    }
}

// Expose to window for inline handlers
window.cookNowAndDeduct = cookNowAndDeduct;

// Settings Section
function initSettings() {
    // Cloud sync UI is now enabled!
    // Data management listeners
    const exportBtn = document.getElementById('export-data-btn');
    const importTriggerBtn = document.getElementById('import-trigger-btn');
    const importFileInput = document.getElementById('import-data-file');
    const clearAllDataBtn = document.getElementById('clear-all-data-btn');

    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }
    if (importTriggerBtn && importFileInput) {
        importTriggerBtn.addEventListener('click', () => {
            importFileInput.click();
        });
    }
    if (importFileInput) {
        importFileInput.addEventListener('change', importData);
    }
    if (clearAllDataBtn) {
        clearAllDataBtn.addEventListener('click', clearAllData);
    }

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

    // NEW: Categories and Locations management
    const addCategoryBtn = document.getElementById('add-category-btn');
    const addLocationBtn = document.getElementById('add-location-btn');

    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', showAddCategoryPrompt);
    }

    if (addLocationBtn) {
        addLocationBtn.addEventListener('click', showAddLocationPrompt);
    }

    // Load and display categories and locations
    loadAndDisplayCategories();
    loadAndDisplayLocations();

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
    // Dynamically count all locations (including custom ones)
    let totalIngredients = 0;
    Object.keys(ingredients).forEach(location => {
        totalIngredients += (ingredients[location] || []).length;
    });
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

// ==============================================
// CATEGORIES AND LOCATIONS MANAGEMENT
// ==============================================

// Load and display categories
async function loadAndDisplayCategories() {
    try {
        const categories = await loadCategories();
        const categoriesList = document.getElementById('categories-list');

        if (!categoriesList) return;

        if (categories.length === 0) {
            categoriesList.innerHTML = '<p style="color: #888; font-style: italic;">No categories yet. Add one above!</p>';
            return;
        }

        categoriesList.innerHTML = categories.map(cat => `
            <div class="settings-list-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f7fafc; border-radius: 8px; margin-bottom: 8px;">
                <span style="font-weight: 500;">${cat.name}${cat.is_default ? ' <span style="color: #888; font-size: 0.85em;">(default)</span>' : ''}</span>
                <div style="display: flex; gap: 8px;">
                    ${!cat.is_default ? `
                        <button onclick="editCategory('${cat.id}', '${cat.name}')" class="btn-secondary" style="padding: 6px 12px; font-size: 0.9em;">Edit</button>
                        <button onclick="handleDeleteCategory('${cat.id}')" class="btn-danger" style="padding: 6px 12px; font-size: 0.9em;">Delete</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading categories:', error);
        showToast('Error', 'Failed to load categories', 'error');
    }
}

// Load and display locations
async function loadAndDisplayLocations() {
    try {
        const locations = await loadLocations();
        const locationsList = document.getElementById('locations-list');

        if (!locationsList) return;

        if (locations.length === 0) {
            locationsList.innerHTML = '<p style="color: #888; font-style: italic;">No locations yet. Add one above!</p>';
            return;
        }

        locationsList.innerHTML = locations.map(loc => `
            <div class="settings-list-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f7fafc; border-radius: 8px; margin-bottom: 8px;">
                <span style="font-weight: 500;">${loc.name}${loc.is_default ? ' <span style="color: #888; font-size: 0.85em;">(default)</span>' : ''}</span>
                <div style="display: flex; gap: 8px;">
                    ${!loc.is_default ? `
                        <button onclick="editLocation('${loc.id}', '${loc.name}')" class="btn-secondary" style="padding: 6px 12px; font-size: 0.9em;">Edit</button>
                        <button onclick="handleDeleteLocation('${loc.id}')" class="btn-danger" style="padding: 6px 12px; font-size: 0.9em;">Delete</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading locations:', error);
        showToast('Error', 'Failed to load locations', 'error');
    }
}

// Show add category prompt
async function showAddCategoryPrompt() {
    const name = prompt('Enter category name (e.g., Spices, Baking, Asian Ingredients):');
    if (!name || !name.trim()) return;

    try {
        await addCategory(name.trim());
        showToast('Success', `Added category: ${name}`, 'success');
        await loadAndDisplayCategories();
        // Refresh dropdowns in forms
        await populateIngredientsDropdowns();
        await populateShoppingCategoryDropdown();
    } catch (error) {
        console.error('Error adding category:', error);
        showToast('Error', 'Failed to add category. It may already exist.', 'error');
    }
}

// Show add location prompt
async function showAddLocationPrompt() {
    const name = prompt('Enter location name (e.g., Garage Freezer, Wine Fridge, Basement Pantry):');
    if (!name || !name.trim()) return;

    try {
        await addLocation(name.trim());
        showToast('Success', `Added location: ${name}`, 'success');
        await loadAndDisplayLocations();
        // Refresh dropdowns in forms and recreate location tabs
        await populateIngredientsDropdowns();
        await createLocationTabs();
    } catch (error) {
        console.error('Error adding location:', error);
        showToast('Error', 'Failed to add location. It may already exist.', 'error');
    }
}

// Edit category
async function editCategory(id, currentName) {
    const newName = prompt('Edit category name:', currentName);
    if (!newName || !newName.trim() || newName === currentName) return;

    try {
        await updateCategory(id, newName.trim());
        showToast('Success', `Renamed category to: ${newName}`, 'success');
        await loadAndDisplayCategories();
    } catch (error) {
        console.error('Error updating category:', error);
        showToast('Error', 'Failed to update category', 'error');
    }
}

// Edit location
async function editLocation(id, currentName) {
    const newName = prompt('Edit location name:', currentName);
    if (!newName || !newName.trim() || newName === currentName) return;

    try {
        await updateLocation(id, newName.trim());
        showToast('Success', `Renamed location to: ${newName}`, 'success');
        await loadAndDisplayLocations();
    } catch (error) {
        console.error('Error updating location:', error);
        showToast('Error', 'Failed to update location', 'error');
    }
}

// Delete category with confirmation
async function handleDeleteCategory(id) {
    if (!confirm('Are you sure you want to delete this category? This cannot be undone.')) return;

    try {
        await deleteCategory(id);
        showToast('Success', 'Category deleted', 'success');
        await loadAndDisplayCategories();
    } catch (error) {
        console.error('Error deleting category:', error);
        showToast('Error', 'Failed to delete category. It may be in use.', 'error');
    }
}

// Delete location with confirmation
async function handleDeleteLocation(id) {
    if (!confirm('Are you sure you want to delete this location? This cannot be undone.')) return;

    try {
        await deleteLocation(id);
        showToast('Success', 'Location deleted', 'success');
        await loadAndDisplayLocations();
    } catch (error) {
        console.error('Error deleting location:', error);
        showToast('Error', 'Failed to delete location. It may be in use.', 'error');
    }
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

    if (userToken && !isSyncing) {
        clearTimeout(window.syncTimeout);
        window.syncTimeout = setTimeout(() => {
            syncToServer();
        }, 2000);
    }
}
// ==========================================
// HAMBURGER NAVIGATION
// ==========================================
function toggleNav() {
    const nav = document.getElementById('main-nav');
    const overlay = document.getElementById('nav-overlay');
    const hamburger = document.getElementById('hamburger-btn');
    
    nav.classList.toggle('active');
    overlay.classList.toggle('active');
    hamburger.classList.toggle('active');
}

function closeNav() {
    const nav = document.getElementById('main-nav');
    const overlay = document.getElementById('nav-overlay');
    const hamburger = document.getElementById('hamburger-btn');
    
    nav.classList.remove('active');
    overlay.classList.remove('active');
    hamburger.classList.remove('active');
}

