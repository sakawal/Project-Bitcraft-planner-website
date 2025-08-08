document.addEventListener('DOMContentLoaded', () => {
  // --- CONFIGURATION & STATE VARIABLES ---
  const craftingURL = "https://raw.githubusercontent.com/fsobolev/BitPlanner/main/BitPlanner/crafting_data.json";
  const travelersURL = "https://raw.githubusercontent.com/fsobolev/BitPlanner/main/BitPlanner/travelers_data.json";
  const assetsBaseURL = "assets/";
  const itemsPerPage = 50;
  const rarityMap = { 0: 'None', 1: 'Common', 2: 'Uncommon', 3: 'Rare', 4: 'Epic', 5: 'Legendary', 6: 'Mythic' };

  let items = [];
  let filteredItems = {};
  let currentPage = 1;
  let searchValue = "";
  let tierFilter = "";
  let rarityFilter = "";
  let tagFilter = "";
  let craftingData = {};
  let travelersData = [];

  // Load state from localStorage or set defaults
  let craftList = JSON.parse(localStorage.getItem('craftList') || '{}');
  let inventory = JSON.parse(localStorage.getItem('inventory') || '{}');
  let travelerVisibility = JSON.parse(localStorage.getItem('travelerVisibility') || '{}');
  let selectedRecipes = JSON.parse(localStorage.getItem('selectedRecipes') || '{}');

  // --- INITIALIZATION & CORE APP LOGIC ---
  const init = async () => {
    showMessage('Loading data...', 'info');
    try {
      const [craftingResponse, travelersResponse] = await Promise.all([
        fetch(craftingURL),
        fetch(travelersURL)
      ]);
      if (!craftingResponse.ok || !travelersResponse.ok) {
        throw new Error('Network response was not ok.');
      }
      craftingData = await craftingResponse.json();
      travelersData = await travelersResponse.json();
      items = Object.values(craftingData); 

      setupEventListeners();
      populateFilters();
      renderTravelerFilterButtons();
      
      const activeTab = localStorage.getItem('activeTab') || 'travelers';
      switchTab(activeTab);
      
      showMessage('Data loaded successfully!', 'success');
    } catch (error) {
      showMessage(`Error fetching data: ${error.message}`, 'error');
      console.error("Fetch Error:", error);
    }
  };

  const setupEventListeners = () => {
    document.querySelectorAll('nav li').forEach(button => {
      button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
    document.getElementById('hamburger-menu').addEventListener('click', () => document.getElementById('settings-modal').classList.add('active'));
    document.getElementById('close-settings-modal').addEventListener('click', () => document.getElementById('settings-modal').classList.remove('active'));
    document.getElementById('delete-cache-btn').addEventListener('click', clearLocalStorage);
    document.getElementById('items-search').addEventListener('input', (e) => { searchValue = e.target.value; filterAndRenderItems(); });
    document.getElementById('items-tier-filter').addEventListener('change', (e) => { tierFilter = e.target.value; filterAndRenderItems(); });
    document.getElementById('items-rarity-filter').addEventListener('change', (e) => { rarityFilter = e.target.value; filterAndRenderItems(); });
    document.getElementById('items-tag-filter').addEventListener('change', (e) => { tagFilter = e.target.value; filterAndRenderItems(); });
    document.getElementById('prev-page').addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderItemsGrid(); } });
    document.getElementById('next-page').addEventListener('click', () => { if (currentPage < Math.ceil(Object.keys(filteredItems).length / itemsPerPage)) { currentPage++; renderItemsGrid(); } });
    document.getElementById('player-level-filter').addEventListener('input', filterAndRenderTravelers);
    document.getElementById('clear-craft-list-btn').addEventListener('click', clearCraftList);
    document.getElementById('clear-inventory-btn').addEventListener('click', clearInventory);
    document.getElementById('travelers-grid').addEventListener('click', e => {
        if (e.target.classList.contains('add-to-craft-btn-quest')) {
            const { itemId, quantity } = e.target.dataset;
            addToCraftList(itemId, parseInt(quantity, 10));
        }
    });
    document.getElementById('items-grid').addEventListener('click', handleItemCardClick);
    const settingsModal = document.getElementById('settings-modal');
    
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('active');
        }
    });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsModal.classList.contains('active')) {
            settingsModal.classList.remove('active');
        }
    });
  };

  const switchTab = (tabId) => {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('nav li').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`nav li[data-tab='${tabId}']`).classList.add('active');
    
    localStorage.setItem('activeTab', tabId);

    switch (tabId) {
      case 'items': filterAndRenderItems(); break;
      case 'travelers': filterAndRenderTravelers(); break;
      case 'craft': renderCraftingTab(); break;
      case 'inventory': renderInventory(); break;
    }
  };

  // --- ITEMS TAB ---
  const populateFilters = () => {
    const tierFilterSelect = document.getElementById('items-tier-filter');
    const tagFilterSelect = document.getElementById('items-tag-filter');
    const tiers = [...new Set(items.map(item => item.tier).filter(t => t !== undefined))].sort((a, b) => a - b);
    const tags = [...new Set(items.flatMap(item => item.tag || []))].sort();

    tierFilterSelect.innerHTML = '<option value="">All Tiers</option>';
    tiers.forEach(tier => tierFilterSelect.innerHTML += `<option value="${tier}">Tier ${tier}</option>`);

    tagFilterSelect.innerHTML = '<option value="">All Tags</option>';
    tags.forEach(tag => tagFilterSelect.innerHTML += `<option value="${tag}">${tag}</option>`);
  };

  const filterAndRenderItems = () => {
    const filteredEntries = Object.entries(craftingData).filter(([id, item]) => 
      item.name.toLowerCase().includes(searchValue.toLowerCase()) &&
      (tierFilter === "" || item.tier?.toString() === tierFilter) &&
      (rarityFilter === "" || item.rarity?.toString() === rarityFilter) &&
      (tagFilter === "" || item.tag?.toLowerCase() === tagFilter.toLowerCase())
    );
    filteredItems = Object.fromEntries(filteredEntries);
    currentPage = 1;
    renderItemsGrid();
  };

  const renderItemsGrid = () => {
    const itemsGrid = document.getElementById('items-grid');
    itemsGrid.innerHTML = '';
    const allFilteredEntries = Object.entries(filteredItems);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const itemsToRender = allFilteredEntries.slice(startIndex, startIndex + itemsPerPage);

    if (itemsToRender.length === 0) {
      itemsGrid.innerHTML = '<p>No items found.</p>';
      renderPagination();
      return;
    }

    const fragment = document.createDocumentFragment();
    itemsToRender.forEach(([id, item]) => {
      const itemCard = document.createElement('div');
      itemCard.className = 'item-card';
      const imageUrl = `assets/${item.icon}.png`;
      const placeholderUrl = `https://placehold.co/64x64/2b2b41/e0e0e0?text=IMG`;
      itemCard.innerHTML = `
        <img src="${imageUrl}" alt="${item.name}" onerror="this.onerror=null;this.src='${placeholderUrl}';"/>
        <div class="item-name">${item.name}</div>
        <div class="item-tier">Tier ${item.tier ?? 'N/A'}</div>
        <div class="item-rarity">${rarityMap[item.rarity] || 'Unknown'}</div>
        <div class="quantity-controls">
          <button class="quantity-btn minus-btn">-</button>
          <input type="number" value="1" min="1" class="quantity-input"/>
          <button class="quantity-btn plus-btn">+</button>
        </div>
        <div class="item-actions">
          <button class="add-to-craft-btn" data-item-id="${id}">Add to Craft</button>
          <button class="add-to-inventory-btn" data-item-id="${id}">Add to Inventory</button>
        </div>
      `;
      fragment.appendChild(itemCard);
    });
    itemsGrid.appendChild(fragment);
    renderPagination();
  };
  
  const handleItemCardClick = (e) => {
    const target = e.target;
    const card = target.closest('.item-card');
    if (!card) return;

    const quantityInput = card.querySelector('.quantity-input');
    if (!quantityInput) return;

    let currentQuantity = parseInt(quantityInput.value, 10) || 1;

    if (target.classList.contains('plus-btn')) {
        quantityInput.value = currentQuantity + 1;
        return;
    }

    if (target.classList.contains('minus-btn')) {
        quantityInput.value = Math.max(1, currentQuantity - 1);
        return;
    }

    if (target.classList.contains('add-to-craft-btn') || target.classList.contains('add-to-inventory-btn')) {
        const itemId = target.dataset.itemId;
        if (!itemId) {
            console.error("Button is missing data-item-id attribute!");
            return;
        }
        if (target.classList.contains('add-to-craft-btn')) {
            addToCraftList(itemId, currentQuantity);
        } else {
            addToInventory(itemId, currentQuantity);
        }
    }
  };

  const renderPagination = () => {
    const totalPages = Math.ceil(Object.keys(filteredItems).length / itemsPerPage);
    document.getElementById('page-indicator').textContent = `Page ${currentPage} / ${totalPages || 1}`;
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
  };

  // --- TRAVELERS TAB ---
  const renderTravelerFilterButtons = () => {
    const container = document.getElementById('traveler-filter-buttons');
    container.innerHTML = '';
    travelersData.forEach(traveler => {
      travelerVisibility[traveler.name] = travelerVisibility[traveler.name] ?? true;
      const button = document.createElement('button');
      button.textContent = traveler.name;
      button.className = `traveler-filter-btn ${travelerVisibility[traveler.name] ? 'active' : ''}`;
      button.addEventListener('click', () => {
        travelerVisibility[traveler.name] = !travelerVisibility[traveler.name];
        saveToLocalStorage('travelerVisibility', travelerVisibility);
        renderTravelerFilterButtons();
        filterAndRenderTravelers();
      });
      container.appendChild(button);
    });
  };

  const filterAndRenderTravelers = () => {
    const grid = document.getElementById('travelers-grid');
    grid.innerHTML = '';
    const playerLevel = parseInt(document.getElementById('player-level-filter').value, 10) || 1;
    const placeholderUrl = `https://placehold.co/64x64/2b2b41/e0e0e0?text=IMG`;
    const filteredTravelers = travelersData.filter(t => travelerVisibility[t.name]);
    if (filteredTravelers.length === 0) {
        grid.innerHTML = '<p>No travelers selected.</p>';
        return;
    }
    filteredTravelers.forEach(traveler => {
      const validTasks = traveler.tasks.filter(task => playerLevel >= task.levels[0] && playerLevel <= task.levels[1]);
      if (validTasks.length === 0) return;
      const travelerCard = document.createElement('div');
      travelerCard.className = 'traveler-card';
      const travelerImgUrl = `assets/Travelers/${traveler.name}.png`;
      const tasksHtml = validTasks.map(task => {
        const itemsHtml = Object.entries(task.required_items).map(([id, q]) => {
          const item = craftingData[id];
          if (!item) {
            console.warn(`Item with ID "${id}" for traveler quest not found.`);
            return '';
          }
          const itemImgUrl = `assets/${item.icon}.png`;
          return `<li>
                    <img src="${itemImgUrl}" alt="${item.name}" onerror="this.onerror=null;this.src='${placeholderUrl}';"/>
                    <span>${item.name} (x${q})</span>
                    <button class="add-to-craft-btn-quest" data-item-id="${id}" data-quantity="${q}">Add</button>
                  </li>`;
        }).join('');
        return `<div class="task-card">
                  <h4 class="task-title">Quest (Lv ${task.levels[0]}-${task.levels[1]})</h4>
                  <ul class="quest-items-list">${itemsHtml}</ul>
                  <p class="reward"><strong>Reward:</strong> ${task.reward} HexCoins, ${task.experience} XP</p>
                </div>`;
      }).join('');
      travelerCard.innerHTML = `
        <div class="traveler-header">
          <img src="${travelerImgUrl}" alt="${traveler.name}" class="traveler-icon" onerror="this.onerror=null;this.src='${placeholderUrl}';"/>
          <h3>${traveler.name}</h3>
        </div>
        <div class="tasks-container">${tasksHtml}</div>`;
      grid.appendChild(travelerCard);
    });
  };

  // --- CRAFTING TAB ---
  const renderCraftingTab = () => {
    showLoadingScreen(true);
    setTimeout(() => {
      renderCraftList();
      const { rawRequirements, craftingSteps, inventoryUsage } = calculateCraftingRequirements();
      renderRequiredResources(rawRequirements);
      renderInventoryUsage(inventoryUsage);
      renderCraftingSteps(craftingSteps);
      showLoadingScreen(false);
    }, 50);
  };

  const renderCraftList = () => {
    const container = document.getElementById('craft-list');
    container.innerHTML = '<h3>Items to Craft</h3>';
    if (Object.keys(craftList).length === 0) {
      container.innerHTML += '<p>Your craft list is empty.</p>';
      return;
    }
    Object.entries(craftList).forEach(([id, quantity]) => {
      const item = craftingData[id];
      if (!item) {
          console.warn(`Item with ID "${id}" not found in crafting data. Skipping from craft list render.`);
          return;
      }
      const card = document.createElement('div');
      card.className = 'craft-item-card';
      const imageUrl = `assets/${item.icon}.png`;
      const placeholderUrl = `https://placehold.co/48x48/2b2b41/e0e0e0?text=IMG`;
      card.innerHTML = `
        <img src="${imageUrl}" alt="${item.name}" onerror="this.onerror=null;this.src='${placeholderUrl}';"/>
        <div class="item-name">${item.name}</div>
        <div class="craft-item-controls">
          <button data-action="decrease" data-id="${id}">-</button>
          <input type="number" value="${quantity}" min="0" data-id="${id}"/>
          <button data-action="increase" data-id="${id}">+</button>
          <button data-action="remove" data-id="${id}">Remove</button>
        </div>`;
      container.appendChild(card);
    });
    container.addEventListener('click', handleCraftListUpdate);
    container.addEventListener('change', handleCraftListUpdate);
  };

  const handleCraftListUpdate = (e) => {
    const { action, id } = e.target.dataset;
    if (!id) return;
    const quantity = parseInt(craftList[id], 10) || 0;
    if (e.type === 'change') {
      updateCraftQuantity(id, parseInt(e.target.value, 10));
    } else if (action === 'increase') {
      updateCraftQuantity(id, quantity + 1);
    } else if (action === 'decrease') {
      updateCraftQuantity(id, quantity - 1);
    } else if (action === 'remove') {
      updateCraftQuantity(id, 0);
    }
  };

  const renderCraftingSteps = (craftingSteps) => {
    const container = document.getElementById('craft-steps-list');
    container.innerHTML = '';
    if (craftingSteps.length === 0) {
      container.innerHTML = '<p>No crafting steps required.</p>';
      return;
    }
    craftingSteps.forEach((step, index) => {
      const item = craftingData[step.id];
      if (!item) {
          console.warn(`Item with ID "${step.id}" not found. Skipping from craft steps render.`);
          return;
      }
      const card = document.createElement('div');
      card.className = 'craft-step-card';
      let recipeSelectorHtml = '';
      if (item.recipes.length > 1) {
        const options = item.recipes.map((recipe, idx) => {
          const ingredientsText = recipe.consumed_items
            .map(ing => {
              const ingItem = craftingData[ing.id];
              return ingItem ? `${ing.quantity}x ${ingItem.name}` : 'Unknown Item';
            })
            .join(', ');
          return `<option value="${idx}" ${idx === step.recipeIndex ? 'selected' : ''}>Recipe: ${ingredientsText}</option>`;
        }).join('');
        recipeSelectorHtml = `<div class="recipe-selector"><select data-id="${step.id}">${options}</select></div>`;
      }
      const ownedForStep = inventory[step.id] || 0;
      const deficit = Math.max(0, step.quantityToCraft - ownedForStep);
      let titleDetail = '';
      if (deficit > 0) {
          titleDetail = ownedForStep > 0 ? ` (${ownedForStep} in inventory, ${Math.ceil(deficit)} missing)` : ` (${Math.ceil(deficit)} missing)`;
      } else {
          titleDetail = ` (${ownedForStep} in inventory)`;
      }
      const ingredientsHtml = step.ingredients.map(ing => {
        const ingItem = craftingData[ing.id];
        if (!ingItem) return `<li>Unknown Item</li>`; 
        const needed = ing.quantityNeeded;
        const owned = inventory[ing.id] || 0;
        const statusClass = owned >= needed ? 'green' : owned > 0 ? 'orange' : 'red';
        return `<li><span class="ingredient-name">${ingItem.name}</span> <span class="step-status ${statusClass}"> in inventory : ${Math.ceil(owned)}/${Math.ceil(needed)} </span></li>`;
      }).join('');
      card.innerHTML = `
        <div class="step-header">
          <h4 class="step-title">Step ${index + 1}: Craft ${Math.ceil(step.quantityToCraft)}x ${item.name}</h4>
        </div>
        ${recipeSelectorHtml}
        <h5 class="ingredients-title">Used in recipe for this step:</h5>
        <ul class="step-ingredients-list">${ingredientsHtml}</ul>`;
      container.appendChild(card);
    });
    container.addEventListener('change', e => {
      if (e.target.tagName === 'SELECT') {
        const itemId = e.target.dataset.id;
        const recipeIndex = parseInt(e.target.value, 10);
        selectedRecipes[itemId] = recipeIndex;
        saveToLocalStorage('selectedRecipes', selectedRecipes);
        renderCraftingTab();
      }
    });
  };

  const renderRequiredResources = (rawRequirements) => {
    const container = document.getElementById('global-requirements-list');
    container.innerHTML = '';
    if (Object.keys(rawRequirements).length === 0) {
      container.innerHTML = '<p>No raw resources required.</p>';
      return;
    }
    Object.entries(rawRequirements).forEach(([id, needed]) => {
      const item = craftingData[id];
      if (!item) return;
      const owned = inventory[id] || 0;
      const statusClass = owned >= needed ? 'green' : owned > 0 ? 'orange' : 'red';
      const statusLabel = owned >= needed ? 'From inventory (complete)' : owned > 0 ? 'From inventory (partial)' : 'Missing';
      const card = document.createElement('div');
      card.className = 'requirement-card';
      const imageUrl = `assets/${item.icon}.png`;
      const placeholderUrl = `https://placehold.co/40x40/2b2b41/e0e0e0?text=IMG`;
      card.innerHTML = `
        <img src="${imageUrl}" alt="${item.name}" onerror="this.onerror=null;this.src='${placeholderUrl}';"/>
        <div class="item-name">${item.name}</div>
        <div class="item-quantity">${Math.ceil(owned)} / ${Math.ceil(needed)}</div>
        <div class="step-status ${statusClass}">${statusLabel}</div>`;
      container.appendChild(card);
    });
  };
  
  const renderInventoryUsage = (inventoryUsage) => {
    const container = document.getElementById('inventory-usage-list');
    container.innerHTML = '';
    if (Object.keys(inventoryUsage).length === 0) {
        container.innerHTML = '<p>No items from your inventory are used for this craft.</p>';
        return;
    }

    Object.entries(inventoryUsage).forEach(([id, quantityUsed]) => {
        const item = craftingData[id];
        if (!item) return;

        const card = document.createElement('div');
        card.className = 'requirement-card';
        const imageUrl = `assets/${item.icon}.png`;
        const placeholderUrl = `https://placehold.co/40x40/2b2b41/e0e0e0?text=IMG`;
        
        card.innerHTML = `
            <img src="${imageUrl}" alt="${item.name}" onerror="this.onerror=null;this.src='${placeholderUrl}';"/>
            <div class="item-name">${item.name}</div>
            <div class="item-quantity">Used: ${Math.ceil(quantityUsed)}</div>
            <div class="step-status green">From Inventory</div>
        `;
        container.appendChild(card);
    });
  };

  // --- CORE CALCULATION & LOGIC ---
  function calculateCraftingRequirements() {
    const rawRequirements = {};
    const toCraftAggregated = {};
    const inventoryUsage = {}; 
    const tempInventory = { ...inventory };

    function recurse(itemId, quantityNeeded, visited = new Set()) {
      if (visited.has(itemId)) {
          console.warn(`Cycle detected for item ${itemId}, stopping calculation for this branch.`);
          return;
      }
      visited.add(itemId);

      const item = craftingData[itemId];
      if (!item) return;

      const availableInTemp = tempInventory[itemId] || 0;
      const canUseFromTemp = Math.min(quantityNeeded, availableInTemp);

      if (canUseFromTemp > 0) {
          inventoryUsage[itemId] = (inventoryUsage[itemId] || 0) + canUseFromTemp;
          tempInventory[itemId] -= canUseFromTemp;
          quantityNeeded -= canUseFromTemp;
      }

      if (quantityNeeded <= 0) return;

      if (!item.recipes || item.recipes.length === 0) {
        rawRequirements[itemId] = (rawRequirements[itemId] || 0) + quantityNeeded;
        return;
      }
      
      let recipeIndex = selectedRecipes[itemId] || 0;
      if (recipeIndex >= item.recipes.length) recipeIndex = 0;
      const recipe = item.recipes[recipeIndex];
      if (!recipe) return;

      const outputPerCraft = getEffectiveOutput(recipe);
      const craftsNeeded = Math.ceil(quantityNeeded / outputPerCraft);
      
      if (craftsNeeded <= 0) return;

      const totalProduced = craftsNeeded * outputPerCraft;
      toCraftAggregated[itemId] = (toCraftAggregated[itemId] || 0) + totalProduced;

      for (const ing of recipe.consumed_items) {
        recurse(ing.id, ing.quantity * craftsNeeded, new Set(visited));
      }
    }

    for (const [itemId, quantity] of Object.entries(craftList)) {
      recurse(itemId, quantity);
    }
    
    const craftingSteps = Object.entries(toCraftAggregated).map(([id, quantityToCraft]) => {
      const item = craftingData[id];
      if (!item) return null;
      let recipeIndex = selectedRecipes[id] || 0;
      if (recipeIndex >= item.recipes.length) recipeIndex = 0;
      const recipe = item.recipes[recipeIndex];
      if (!recipe) return null;

      const outputPerCraft = getEffectiveOutput(recipe);
      const craftsNeeded = Math.ceil(quantityToCraft / outputPerCraft);

      return {
        id: id,
        quantityToCraft: quantityToCraft,
        recipeIndex: recipeIndex,
        ingredients: recipe.consumed_items.map(ing => ({
          id: ing.id,
          quantityNeeded: ing.quantity * craftsNeeded
        }))
      };
    }).filter(Boolean);

    craftingSteps.sort((a, b) => getCraftingDepth(a.id) - getCraftingDepth(b.id));
    
    return { rawRequirements, craftingSteps, inventoryUsage };
  }

  const getCraftingDepth = (itemId, path = new Set()) => {
      if (path.has(itemId)) return Infinity; 
      path.add(itemId);
      const item = craftingData[itemId];
      if (!item?.recipes?.length) return 0;
      let recipeIndex = selectedRecipes[itemId] || 0;
      if (recipeIndex >= item.recipes.length) recipeIndex = 0;
      const recipe = item.recipes[recipeIndex];
      if (!recipe || !recipe.consumed_items) return 1;
      const maxDepth = Math.max(0, ...recipe.consumed_items.map(ing => getCraftingDepth(ing.id, new Set(path))));
      return 1 + maxDepth;
  };

  function getEffectiveOutput(recipe) {
      if (recipe.possibilities && Object.keys(recipe.possibilities).length > 0) {
          let maxProb = 0;
          let bestOutcome = recipe.output_quantity || 1;
          for (const [amount, probability] of Object.entries(recipe.possibilities)) {
              if (probability > maxProb) {
                  maxProb = probability;
                  bestOutcome = parseInt(amount, 10);
              }
          }
          return bestOutcome;
      }
      return recipe.output_quantity || 1;
  }

  // --- INVENTORY TAB ---
  const renderInventory = () => {
    const container = document.getElementById('inventory-list');
    container.innerHTML = '';
    if (Object.keys(inventory).length === 0) {
      container.innerHTML = '<p>Your inventory is empty.</p>';
      return;
    }
    Object.entries(inventory).forEach(([id, quantity]) => {
      const item = craftingData[id];
      if (!item || quantity <= 0) return;
      const card = document.createElement('div');
      card.className = 'inventory-item-card';
      const imageUrl = `assets/${item.icon}.png`;
      const placeholderUrl = `https://placehold.co/64x64/2b2b41/e0e0e0?text=IMG`;
      card.innerHTML = `
        <img src="${imageUrl}" alt="${item.name}" onerror="this.onerror=null;this.src='${placeholderUrl}';"/>
        <div class="item-name">${item.name}</div>
        <div class="inventory-item-controls">
          <button data-action="decrease" data-id="${id}">-</button>
          <input type="number" value="${quantity}" min="0" data-id="${id}"/>
          <button data-action="increase" data-id="${id}">+</button>
          <button data-action="remove" data-id="${id}">Remove</button>
        </div>`;
      container.appendChild(card);
    });
    container.addEventListener('click', handleInventoryUpdate);
    container.addEventListener('change', handleInventoryUpdate);
  };

  const handleInventoryUpdate = (e) => {
      const { action, id } = e.target.dataset;
      if (!id) return;
      const quantity = parseInt(inventory[id], 10) || 0;
      if (e.type === 'change') {
          updateInventoryQuantity(id, parseInt(e.target.value, 10));
      } else if (action === 'increase') {
          updateInventoryQuantity(id, quantity + 1);
      } else if (action === 'decrease') {
          updateInventoryQuantity(id, quantity - 1);
      } else if (action === 'remove') {
          updateInventoryQuantity(id, 0);
      }
  };

  // --- DATA MANIPULATION & STORAGE ---
  const addToCraftList = (id, quantity) => {
    const item = craftingData[id];
    if (!item) {
        showMessage(`Error: Item with ID ${id} not found.`, 'error');
        return;
    }
    craftList[id] = (craftList[id] || 0) + quantity;
    saveToLocalStorage('craftList', craftList);
    showMessage(`Added ${quantity}x ${item.name} to craft list.`, 'success');
  };
  
  const updateCraftQuantity = (id, value) => {
    const quantity = parseInt(value, 10);
    if (isNaN(quantity) || quantity <= 0) {
      delete craftList[id];
    } else {
      craftList[id] = quantity;
    }
    saveToLocalStorage('craftList', craftList);
    renderCraftingTab();
  };
  
  const addToInventory = (id, quantity) => {
    const item = craftingData[id];
    if (!item) {
        showMessage(`Error: Item with ID ${id} not found.`, 'error');
        return;
    }
    inventory[id] = (inventory[id] || 0) + quantity;
    saveToLocalStorage('inventory', inventory);
    showMessage(`Added ${quantity}x ${item.name} to inventory.`, 'success');
  };

  const updateInventoryQuantity = (id, value) => {
    const quantity = parseInt(value, 10);
    if (isNaN(quantity) || quantity <= 0) {
      delete inventory[id];
    } else {
      inventory[id] = quantity;
    }
    saveToLocalStorage('inventory', inventory);
    renderInventory();
    if (document.getElementById('craft').classList.contains('active')) {
      renderCraftingTab();
    }
  };

  const clearCraftList = () => {
    if (confirm('Are you sure you want to clear your craft list?')) {
      craftList = {};
      selectedRecipes = {};
      saveToLocalStorage('craftList', craftList);
      saveToLocalStorage('selectedRecipes', selectedRecipes);
      showMessage('Craft list cleared!', 'success');
      renderCraftingTab();
    }
  };

  const clearInventory = () => {
    if (confirm('Are you sure you want to clear your entire inventory?')) {
      inventory = {};
      saveToLocalStorage('inventory', inventory);
      showMessage('Inventory cleared!', 'success');
      renderInventory();
    }
  };

// --- SHARING HELPERS ---
function generateShareableLink(type, dataObject) {
  const payload = btoa(JSON.stringify(dataObject));
  const baseUrl = window.location.origin + window.location.pathname;
  const url = new URL(baseUrl);
  url.searchParams.set(type, payload);
  return url.toString();
}

function showImportOptionsMenu(type, data) {
  const modal = document.createElement('div');
  modal.className = 'import-modal';
  modal.innerHTML = `
    <div class="import-modal-content">
      <h2>Import ${type === 'craft' ? 'Craft List' : 'Inventory'}?</h2>
      <p>Select what you want to do with the shared data:</p>
      <div class="import-buttons">
        ${type === 'inventory' ? `
          <button id="import-${type}-replace">Replace</button>
          <button id="import-${type}-merge">Merge</button>
        ` : `
          <button id="import-${type}-confirm">Import</button>
        `}
        <button id="import-${type}-cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const cleanup = () => {
    modal.remove();
    history.replaceState({}, document.title, window.location.pathname);
  };

  // Close when clicking outside
  modal.addEventListener('click', e => {
    if (e.target === modal) cleanup();
  });

  // Close with Escape key
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      cleanup();
      document.removeEventListener('keydown', escHandler);
    }
  });

  if (type === 'inventory') {
    modal.querySelector(`#import-${type}-replace`).addEventListener('click', () => {
      inventory = data;
      saveToLocalStorage('inventory', inventory);
      renderInventory();
      showMessage('Inventory replaced.', 'success');
      cleanup();
    });
    modal.querySelector(`#import-${type}-merge`).addEventListener('click', () => {
      for (const [id, qty] of Object.entries(data)) {
        inventory[id] = (inventory[id] || 0) + qty;
      }
      saveToLocalStorage('inventory', inventory);
      renderInventory();
      showMessage('Inventory merged.', 'success');
      cleanup();
    });
  } else {
    modal.querySelector(`#import-${type}-confirm`).addEventListener('click', () => {
      craftList = data.list || {};
      selectedRecipes = data.recipes || {};
      saveToLocalStorage('craftList', craftList);
      saveToLocalStorage('selectedRecipes', selectedRecipes);
      renderCraftingTab();
      showMessage('Craft list imported.', 'success');
      cleanup();
    });
  }

  modal.querySelector(`#import-${type}-cancel`).addEventListener('click', cleanup);
}

function handleSharedDataFromURL() {
  const params = new URLSearchParams(window.location.search);
  const craftDataEncoded = params.get('craft');
  const inventoryDataEncoded = params.get('inventory');
  if (craftDataEncoded) {
    try {
      const decoded = JSON.parse(atob(craftDataEncoded));
      showImportOptionsMenu('craft', decoded);
    } catch (e) {
      console.error('Failed to parse shared craft data:', e);
    }
  }
  if (inventoryDataEncoded) {
    try {
      const decoded = JSON.parse(atob(inventoryDataEncoded));
      showImportOptionsMenu('inventory', decoded);
    } catch (e) {
      console.error('Failed to parse shared inventory data:', e);
    }
  }
}

// Inject button logic for export
function addExportButtons() {
  const craftShareBtn = document.getElementById('share-craft-list-btn');
  if (craftShareBtn) {
    craftShareBtn.addEventListener('click', () => {
      if (Object.keys(craftList).length === 0) {
        showMessage('Craft list is empty.', 'info');
        return;
      }
      const url = generateShareableLink('craft', { list: craftList, recipes: selectedRecipes });
      navigator.clipboard.writeText(url).then(() => showMessage('Craft list URL copied!', 'success'));
    });
  }

  const inventoryShareBtn = document.getElementById('share-inventory-btn');
  if (inventoryShareBtn) {
    inventoryShareBtn.addEventListener('click', () => {
      if (Object.keys(inventory).length === 0) {
        showMessage('Inventory is empty.', 'info');
        return;
      }
      const url = generateShareableLink('inventory', inventory);
      navigator.clipboard.writeText(url).then(() => showMessage('Inventory URL copied!', 'success'));
    });
  }
}

// Run this after DOM is loaded and setup
handleSharedDataFromURL();
addExportButtons();
// --- sharing buttons  end---

  // --- UTILITY ---

  const clearLocalStorage = () => {
    if (confirm('This will clear ALL data (craft list, inventory, settings). Are you sure?')) {
      localStorage.clear();
      craftList = {};
      inventory = {};
      travelerVisibility = {};
      selectedRecipes = {};
      showMessage('All local data cleared.', 'success');
      document.location.reload();
    }
  };

  const saveToLocalStorage = (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  let messageTimeout;
  const showMessage = (message, type = 'info') => {
    const infoBox = document.getElementById('global-info-message');
    infoBox.textContent = message;
    infoBox.className = `global-info-message ${type} show`;
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
      infoBox.classList.remove('show');
    }, 4000);
  };

  function showLoadingScreen(show) {
    let screen = document.getElementById('loading-screen');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'loading-screen';
      screen.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);color:white;display:flex;align-items:center;justify-content:center;z-index:9999;';
      screen.innerHTML = '<div class="loading-text">Loading...</div>';
      document.body.appendChild(screen);
    }
    screen.style.display = show ? 'flex' : 'none';
  }

  // --- START THE APP ---
  init();
});
