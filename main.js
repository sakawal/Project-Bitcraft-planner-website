// The Bitcrafter's House — Main logic (refactor per spec)
document.addEventListener('DOMContentLoaded', () => {
  // ==============================
  //  CONFIG & GLOBAL STATE
  // ==============================
  const craftingURL = "https://raw.githubusercontent.com/fsobolev/BitPlanner/main/BitPlanner/crafting_data.json";
  const travelersURL = "https://raw.githubusercontent.com/fsobolev/BitPlanner/main/BitPlanner/travelers_data.json";
  const itemsPerPage = 50;
  const rarityMap = { 0: 'None', 1: 'Common', 2: 'Uncommon', 3: 'Rare', 4: 'Epic', 5: 'Legendary', 6: 'Mythic' };

  // ---- Travelers profession (edit here in CODE) ----
  // Remplis cette map avec les vraies professions quand tu les as :
  const TRAVELER_PROFESSIONS = {
    "Alesi": "Taming",
    "Brico": "Construction",
    "Heimlich": "Cooking",
    "Ramparte": "Slayer",
    "Rumbagh": "Merchanting",
    "Svim": "Sailing",
  };
  const getProfession = (name) => TRAVELER_PROFESSIONS[name] || 'profession';

  // --- generic name (pour la recherche) ---
  const TIER_PREFIXES = [
    "Rough","Simple","Sturdy","Fine","Exquisite","Peerless","Ornate","Pristine","Magnificent","Flawless",
    "Flint","Ferralith","Pyrelite","Emarium","Elenvar","Luminite","Rathium","Aurumite","Celestium","Umbracite","Astralite",
    "Beginner's","Novice's","Novice","Essential","Proficient","Advanced","Comprehensive",
    "Plain","Savory","Zesty","Succulent","Ambrosial",
    "Basic","Infused","Magnificient","Automata's"
  ];
  const _genericNameCache = new Map();
  const getGenericName = (name) => {
    if (!name) return "";
    const cached = _genericNameCache.get(name);
    if (cached) return cached;
    for (const prefix of TIER_PREFIXES) {
      const needle = `${prefix} `;
      const i = name.indexOf(needle);
      if (i > -1) {
        const g = name.slice(0, i) + name.slice(i + needle.length);
        _genericNameCache.set(name, g); return g;
      }
    }
    _genericNameCache.set(name, name); return name;
  };
  const sortTierValue = (t) => (t === -1 || t == null) ? 9999 : t;

  // Remote data
  let craftingData = {};
  let travelersData = [];

  // UI state
  let items = [];
  let filteredItems = {};
  let currentPage = 1;

  // Filters (Items tab)
  let searchValue = "";
  let tierFilter = "";
  let rarityFilter = "";
  let tagFilter = "";

  // Local storage state
  let craftList = JSON.parse(localStorage.getItem('craftList') || '{}');                 // { id: qty }
  let inventory = JSON.parse(localStorage.getItem('inventory') || '{}');                 // { id: qty }
  let travelerVisibility = JSON.parse(localStorage.getItem('travelerVisibility') || '{}'); // { travelerName: boolean }
  let selectedRecipes = JSON.parse(localStorage.getItem('selectedRecipes') || '{}');     // { id: recipeIndex }
  let travelerLevels = JSON.parse(localStorage.getItem('travelerLevels') || '{}');       // { travelerName: level }

  // Saved plans (craft & inventory)
  // craftPlans: { name: { list: {id: qty}, recipes: {id: idx} } }
  let craftPlans = JSON.parse(localStorage.getItem('craftPlans') || '{}');
  // inventoryPlans: { name: { inv: {id: qty} } }
  let inventoryPlans = JSON.parse(localStorage.getItem('inventoryPlans') || '{}');

  // ==============================
  //  THEME (default: LIGHT)
  // ==============================
  initTheme();
  function initTheme(){
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    // When the toggle is to the right (checked), we are in dark mode. When to the left (unchecked), we are in light mode.
    const toggle = () => {
      const now = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', now);
      localStorage.setItem('theme', now);
      const cb = document.getElementById('theme-toggle');
      // Checked means dark mode
      if (cb) cb.checked = (now === 'dark');
    };
    requestAnimationFrame(() => {
      const cb = document.getElementById('theme-toggle');
      if (cb) {
        // Checked reflects dark mode
        cb.checked = (saved === 'dark');
        cb.addEventListener('change', toggle);
      }
    });
  }

  // ==============================
  //  INIT
  // ==============================
  const init = async () => {
    showMessage('Loading data...', 'info');
    try {
      const [craftingRes, travelersRes] = await Promise.all([ fetch(craftingURL), fetch(travelersURL) ]);
      if (!craftingRes.ok || !travelersRes.ok) throw new Error('Network response was not ok.');
      craftingData = await craftingRes.json();
      travelersData = await travelersRes.json();
      items = Object.values(craftingData);

      setupEventListeners();
      populateFilters();
      renderTravelerFilterButtons();

      const activeTab = 'home'; // add this before 'home' to keep last tab opened when comeback to website -> localStorage.getItem('activeTab') || 
      switchTab(activeTab);

      // Render saved plans at startup
      renderCraftPlans();
      renderInventoryPlans();

      // Auto-import ?craft=... ou ?inventory=... on open link
      tryImportFromURL();

      showMessage('Data loaded successfully!', 'success');
    } catch (err) {
      console.error(err);
      showMessage(`Error fetching data: ${err.message}`, 'error');
    }
  };

  // ==============================
  //  EVENT LISTENERS
  // ==============================
  function setupEventListeners(){
    // Nav
    document.querySelectorAll('nav li').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Settings modal (gear button)
    const settingsModal = document.getElementById('settings-modal');
    // Support both legacy id "hamburger-menu" and current "settings-gear"
    const gearBtn = document.getElementById('settings-gear') || document.getElementById('hamburger-menu');
    const closeSettings = document.getElementById('close-settings-modal');
    if (gearBtn && settingsModal) {
      const open = () => settingsModal.classList.add('active');
      gearBtn.addEventListener('click', open);
      gearBtn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
    }
    if (closeSettings && settingsModal) {
      const close = () => settingsModal.classList.remove('active');
      closeSettings.addEventListener('click', close);
      settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) close(); });
      window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && settingsModal.classList.contains('active')) close(); });
    }

    // Clear storage, in settings
    const deleteCacheBtn = document.getElementById('delete-cache-btn');
    if (deleteCacheBtn) deleteCacheBtn.addEventListener('click', clearLocalStorage);

    // Local storage export/import
    const exportBtn = document.getElementById('export-localstorage-btn');
    const importBtn = document.getElementById('import-localstorage-btn');
    const importFile = document.getElementById('import-localstorage-file');
    if (exportBtn) exportBtn.addEventListener('click', exportLocalStorageData);
    if (importBtn) importBtn.addEventListener('click', () => importFile?.click());
    if (importFile && !importFile._bound) {
      importFile.addEventListener('change', handleLocalStorageImport);
      importFile._bound = true;
    }

    // Items controls
    const searchInput = document.getElementById('items-search');
    const tierSel = document.getElementById('items-tier-filter');
    const raritySel = document.getElementById('items-rarity-filter');
    const tagSel = document.getElementById('items-tag-filter');
    if (searchInput) searchInput.addEventListener('input', e => { searchValue = e.target.value; filterAndRenderItems(); });
    if (tierSel) tierSel.addEventListener('change', e => { tierFilter = e.target.value; filterAndRenderItems(); });
    if (raritySel) raritySel.addEventListener('change', e => { rarityFilter = e.target.value; filterAndRenderItems(); });
    if (tagSel) tagSel.addEventListener('change', e => { tagFilter = e.target.value; filterAndRenderItems(); });

    // Pagination
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    if (prevBtn) prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderItemsGrid(); } });
    if (nextBtn) nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(Object.keys(filteredItems).length / itemsPerPage) || 1;
      if (currentPage < totalPages) { currentPage++; renderItemsGrid(); }
    });

    // Items grid
    const itemsGrid = document.getElementById('items-grid');
    if (itemsGrid) itemsGrid.addEventListener('click', handleItemCardClick);

    // Travelers grid (Add depuis quêtes)
    const travelersGrid = document.getElementById('travelers-grid');
    if (travelersGrid) {
      travelersGrid.addEventListener('click', e => {
        if (e.target.classList.contains('add-to-craft-btn-quest')) {
          const { itemId, quantity } = e.target.dataset;
          addToCraftList(itemId, parseInt(quantity, 10));
          renderCraftingTab();
        }
      });
    }

    // Craft actions
    const clearCraftBtn = document.getElementById('clear-craft-list-btn');
    if (clearCraftBtn) clearCraftBtn.addEventListener('click', clearCraftList);
    const shareCraftBtn = document.getElementById('share-craft-list-btn');
    if (shareCraftBtn) shareCraftBtn.addEventListener('click', () => shareViaLink('craft'));

    // Inventory actions
    const clearInventoryBtn = document.getElementById('clear-inventory-btn');
    if (clearInventoryBtn) clearInventoryBtn.addEventListener('click', clearInventory);
    const shareInventoryBtn = document.getElementById('share-inventory-btn');
    if (shareInventoryBtn) shareInventoryBtn.addEventListener('click', () => shareViaLink('inventory'));

    // Share modal
    wireShareModal();

    // Craft plan save
    const savePlanBtn = document.getElementById('save-plan-btn');
    if (savePlanBtn) savePlanBtn.addEventListener('click', () => {
      const inp = document.getElementById('plan-name-input');
      const name = inp?.value.trim();
      if (!name) { showMessage('Please enter a plan name.', 'error'); return; }
      if (Object.keys(craftList).length === 0) { showMessage('Craft list is empty.', 'error'); return; }
      craftPlans[name] = { list: { ...craftList }, recipes: { ...selectedRecipes } };
      localStorage.setItem('craftPlans', JSON.stringify(craftPlans));
      inp.value = '';
      renderCraftPlans();
      showMessage('Plan saved!', 'success');
    });
    // Inventory plan save
    const saveInvPlanBtn = document.getElementById('save-inv-plan-btn');
    if (saveInvPlanBtn) saveInvPlanBtn.addEventListener('click', () => {
      const inp = document.getElementById('inv-plan-name-input');
      const name = inp?.value.trim();
      if (!name) { showMessage('Please enter a plan name.', 'error'); return; }
      if (Object.keys(inventory).length === 0) { showMessage('Inventory is empty.', 'error'); return; }
      inventoryPlans[name] = { inv: { ...inventory } };
      localStorage.setItem('inventoryPlans', JSON.stringify(inventoryPlans));
      inp.value = '';
      renderInventoryPlans();
      showMessage('Plan saved!', 'success');
    });
    // Plan action handlers (craft & inventory)
    const plansList = document.getElementById('plans-list');
    if (plansList && !plansList._bound) {
      plansList.addEventListener('click', handleCraftPlanClick);
      plansList._bound = true;
    }
    const invPlansList = document.getElementById('inv-plans-list');
    if (invPlansList && !invPlansList._bound) {
      invPlansList.addEventListener('click', handleInventoryPlanClick);
      invPlansList._bound = true;
    }
  }

  // ==============================
  //  TABS
  // ==============================
  function switchTab(tabId){
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('nav li').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');
    document.querySelector(`nav li[data-tab='${tabId}']`)?.classList.add('active');
    localStorage.setItem('activeTab', tabId);
    if (tabId === 'items') filterAndRenderItems();
    if (tabId === 'travelers') filterAndRenderTravelers();
    if (tabId === 'craft') renderCraftingTab();
    if (tabId === 'inventory') renderInventory();
  }

  // ==============================
  //  ITEMS TAB
  // ==============================

  function populateFilters(){
    const tierSel = document.getElementById('items-tier-filter');
    const tagSel = document.getElementById('items-tag-filter');
    if (!tierSel || !tagSel) return;
    const tiers = [...new Set(items.map(i => i.tier).filter(t => t !== undefined))].sort((a,b)=>a-b);
    const tags = [...new Set(items.flatMap(i => i.tag || []))].sort();
    tierSel.innerHTML = '<option value="">All Tiers</option>';
    tiers.forEach(t => tierSel.innerHTML += `<option value="${t}">Tier ${t}</option>`);
    tagSel.innerHTML = '<option value="">All Tags</option>';
    tags.forEach(t => tagSel.innerHTML += `<option value="${t}">${t}</option>`);
  }

  function filterAndRenderItems(){
    const q = (searchValue || '').toLowerCase();
    const filteredEntries = Object.entries(craftingData).filter(([id,item])=>{
      const name = item.name || '';
      const gname = getGenericName(name);
      const hit = name.toLowerCase().includes(q) || gname.toLowerCase().includes(q);
      return hit &&
        (tierFilter === "" || item.tier?.toString() === tierFilter) &&
        (rarityFilter === "" || item.rarity?.toString() === rarityFilter) &&
        (tagFilter === "" || (typeof item.tag === 'string'
          ? item.tag.toLowerCase() === tagFilter.toLowerCase()
          : Array.isArray(item.tag) && item.tag.some(t => t.toLowerCase() === tagFilter.toLowerCase())));
    });

    filteredEntries.sort((a,b)=>{
      const A=a[1], B=b[1];
      const sa = (A?.extraction_skill ?? 999);
      const sb = (B?.extraction_skill ?? 999);
      if (sa !== sb) return sa - sb;
      const ga = getGenericName(A?.name||'');
      const gb = getGenericName(B?.name||'');
      const gcmp = ga.localeCompare(gb);
      if (gcmp !== 0) return gcmp;
      const ta = sortTierValue(A?.tier);
      const tb = sortTierValue(B?.tier);
      if (ta !== tb) return ta - tb;
      return (A?.name||'').localeCompare(B?.name||'');
    });

    filteredItems = Object.fromEntries(filteredEntries);
    currentPage = 1;
    renderItemsGrid();
  }

  function renderItemsGrid(){
    const grid = document.getElementById('items-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const entries = Object.entries(filteredItems);
    const start = (currentPage - 1) * itemsPerPage;
    const slice = entries.slice(start, start + itemsPerPage);
    if (slice.length === 0){ grid.innerHTML = '<p>No items found.</p>'; renderPagination(); return; }

    const frag = document.createDocumentFragment();
    const ph = `https://placehold.co/64x64/2b2b41/e0e0e0?text=IMG`;

    slice.forEach(([id,item])=>{
      const invOwned = inventory[id] || 0;
      const craftOwned = craftList[id] || 0;
      const tierText = (item.tier === -1 || item.tier == null) ? 'No Tier' : `Tier ${item.tier}`;
      const img = `assets/${item.icon}.png`;

      const card = document.createElement('div');
      card.className = 'item-card';
      card.dataset.id = id;
      card.innerHTML = `
        <img src="${img}" alt="${item.name}" width="64" height="64"
             loading="lazy" decoding="async"
             onerror="this.onerror=null;this.src='${ph}';"/>
        <div class="item-name">${item.name}</div>
        <div class="item-tier">${tierText}</div>
        <div class="item-rarity">${rarityMap[item.rarity] || 'Unknown'}</div>
        <div class="quantity-controls">
          <button class="quantity-btn minus-btn" aria-label="Decrease">−</button>
          <input type="number" value="1" min="1" class="quantity-input"/>
          <button class="quantity-btn plus-btn" aria-label="Increase">+</button>
        </div>
        <div class="item-actions">
          <button class="add-to-craft-btn" data-item-id="${id}">Add to Craft (${craftOwned})</button>
          <button class="add-to-inventory-btn" data-item-id="${id}">Add to Inventory (${invOwned})</button>
        </div>`;
      frag.appendChild(card);
    });

    grid.appendChild(frag);
    renderPagination();
  }

  function handleItemCardClick(e){
    const target = e.target;
    const card = target.closest('.item-card');
    if (!card) return;
    const qInput = card.querySelector('.quantity-input');
    if (!qInput) return;
    let q = parseInt(qInput.value, 10) || 1;

    if (target.classList.contains('plus-btn')) { qInput.value = q + 1; return; }
    if (target.classList.contains('minus-btn')) { qInput.value = Math.max(1, q - 1); return; }

    if (target.classList.contains('add-to-craft-btn') || target.classList.contains('add-to-inventory-btn')) {
      const id = target.dataset.itemId;
      if (!id) return;
      if (target.classList.contains('add-to-craft-btn')) addToCraftList(id, q);
      else addToInventory(id, q);

      // Refresh numbers when adding/removing items
      renderItemsGrid();
      if (document.getElementById('craft')?.classList.contains('active')) renderCraftingTab();
      if (document.getElementById('inventory')?.classList.contains('active')) renderInventory();
    }
  }

  function renderPagination(){
    const totalPages = Math.ceil(Object.keys(filteredItems).length / itemsPerPage) || 1;
    const ind = document.getElementById('page-indicator');
    const prev = document.getElementById('prev-page');
    const next = document.getElementById('next-page');
    if (ind) ind.textContent = `Page ${currentPage} / ${totalPages}`;
    if (prev) prev.disabled = currentPage === 1;
    if (next) next.disabled = currentPage >= totalPages;
  }

  // ==============================
  //  TRAVELERS
  // ==============================

  // Get the level of a traveler, defaulting to 1 if not set or invalid (User cant set level above 100, if user do, so it goes to max -> 100)
  function getTravelerLevel(name){
  const v = travelerLevels?.[name];
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 100) : 1;
}

// save into localstorage level of travelers.
function saveTravelerLevel(name, lvl) {
  const n = Math.max(1, Math.min(100, parseInt(lvl, 10) || 1));
  travelerLevels[name] = n;
  saveToLocalStorage('travelerLevels', travelerLevels);
  return n;
}


function renderTravelerFilterButtons(){
  const c = document.getElementById('traveler-filter-buttons');
  if (!c) return;
  c.innerHTML = '';
  travelersData.forEach(t => {
    travelerVisibility[t.name] = travelerVisibility[t.name] ?? true;
    const b = document.createElement('button');
    b.textContent = t.name;
    b.className = `traveler-filter-btn ${travelerVisibility[t.name] ? 'active' : ''}`;
    b.addEventListener('click', () => {
      travelerVisibility[t.name] = !travelerVisibility[t.name];
      saveToLocalStorage('travelerVisibility', travelerVisibility);
      renderTravelerFilterButtons();
      filterAndRenderTravelers();
    });
    c.appendChild(b);
  });
}

  function filterAndRenderTravelers(){
    const grid = document.getElementById('travelers-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const ph = `https://placehold.co/64x64/2b2b41/e0e0e0?text=IMG`;
    const list = travelersData.filter(t => travelerVisibility[t.name]);
    if (list.length === 0){ grid.innerHTML = '<p>No travelers selected.</p>'; return; }

    list.forEach(traveler => {
      const lvl = getTravelerLevel(traveler.name);
      const valid = traveler.tasks.filter(task => {
        const [minL, maxL] = task.levels || [1, 999];
        return lvl >= minL && lvl <= maxL;
      });
      if (valid.length === 0) return;

      const card = document.createElement('div');
      card.className = 'traveler-card';
      const tImg = `assets/Travelers/${traveler.name}.png`;

      const tasksHtml = valid.map(task => {
        const itemsHtml = Object.entries(task.required_items).map(([id,q])=>{
          const it = craftingData[id]; if (!it) return '';
          const icon = `assets/${it.icon}.png`;
          return `<li>
            <img src="${icon}" alt="${it.name}" width="32" height="32" loading="lazy" decoding="async"
                 onerror="this.onerror=null;this.src='${ph}';"/>
            <span>${it.name} (x${q})</span>
            <button class="add-to-craft-btn-quest" data-item-id="${id}" data-quantity="${q}">Add</button>
          </li>`;
        }).join('');
        return `<div class="task-card">
          <h4 class="task-title">Quest (Lv ${task.levels?.[0] ?? '?'}-${task.levels?.[1] ?? '?'})</h4>
          <ul class="quest-items-list">${itemsHtml}</ul>
          <p class="reward"><strong>Reward:</strong> ${task.reward} HexCoins, ${task.experience} XP</p>
        </div>`;
      }).join('');

      const prof = getProfession(traveler.name);

      card.innerHTML = `
        <div class="traveler-header">
          <img src="${tImg}" alt="${traveler.name}" class="traveler-icon" width="64" height="64"
               loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${ph}';"/>
          <div class="traveler-title-wrap">
            <h3>${traveler.name}</h3>
            <div class="traveler-note">${prof}</div>
          </div>
          <div class="traveler-level">
            <label>Lvl:</label>
            <input type="number" min="1" max="100" value="${lvl}" class="traveler-level-input" data-traveler="${traveler.name}"/>
          </div>
        </div>
        <div class="tasks-container">${tasksHtml}</div>`;
      grid.appendChild(card);
    });

    if (!grid._bound){
      grid.addEventListener('change', (e)=>{
        if (!e.target.classList.contains('traveler-level-input')) return;
        const name = e.target.dataset.traveler;
        const v = saveTravelerLevel(name, e.target.value.trim());
        e.target.value = v;
        filterAndRenderTravelers();
      });
      grid.addEventListener('keydown', (e)=>{
        if (!e.target.classList.contains('traveler-level-input')) return;
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const name = e.target.dataset.traveler;
        const v = saveTravelerLevel(name, e.target.value.trim());
        e.target.value = v;
        e.target.blur();
        filterAndRenderTravelers();
      });
      grid._bound = true;
    }
  }

  // ==============================
  //  CRAFT (calc + render)
  // ==============================
  const PH24 = 'https://placehold.co/24x24/2b2b41/e0e0e0?text=IMG';
  const PH40 = 'https://placehold.co/40x40/2b2b41/e0e0e0?text=IMG';
  const PH48 = 'https://placehold.co/48x48/2b2b41/e0e0e0?text=IMG';

  function renderCraftingTab(){
    // Re-render craft list, compute requirements and update displays.
    renderCraftList();
    const { rawRange, craftingSteps, inventoryUsage } = calculateCraftingRequirements();
    // Use rawRange (min/max) for required resources display
    renderRequiredResources(rawRange);
    renderInventoryUsage(inventoryUsage);
    renderCraftingSteps(craftingSteps);
  }

  function renderCraftList(){
    const c = document.getElementById('craft-list');
    c.innerHTML = '<h3>Items to Craft</h3>';
    if (Object.keys(craftList).length === 0) {
      c.innerHTML += '<p>Your craft list is empty.</p>';
    } else {
      Object.entries(craftList).forEach(([id, qty])=>{
        const it = craftingData[id]; if (!it) return;
        const card = document.createElement('div');
        card.className = 'craft-item-card';
        card.innerHTML = `
          <img src="assets/${it.icon}.png" alt="${it.name}" width="48" height="48"
               loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${PH48}'"/>
          <div class="item-name">${it.name}</div>
          <div class="craft-item-controls">
            <button data-action="decrease" data-id="${id}" class="btn-round btn-minus" title="Decrease">−</button>
            <input type="number" value="${qty}" min="0" data-id="${id}"/>
            <button data-action="increase" data-id="${id}" class="btn-round btn-plus" title="Increase">+</button>
            <button data-action="remove" data-id="${id}" class="btn-ghost-danger">Remove</button>
          </div>`;
        c.appendChild(card);
      });
    }
    if (!c._bound){
      c.addEventListener('click', handleCraftListUpdate);
      c.addEventListener('change', handleCraftListUpdate);
      c._bound = true;
    }
  }

  function handleCraftListUpdate(e){
    const { action, id } = e.target.dataset || {};
    if (!id) return;
    const current = parseInt(craftList[id], 10) || 0;
    if (e.type === 'change') updateCraftQuantity(id, parseInt(e.target.value, 10));
    else if (action === 'increase') updateCraftQuantity(id, current + 1);
    else if (action === 'decrease') updateCraftQuantity(id, current - 1);
    else if (action === 'remove') updateCraftQuantity(id, 0);
  }
function renderCraftingSteps(craftingSteps){
  const c = document.getElementById('craft-steps-list');
  if (!c) return;
  c.innerHTML = '';

  if (!Array.isArray(craftingSteps) || craftingSteps.length === 0){
    c.innerHTML = '<p>No crafting steps required.</p>';
    return;
  }
  // Bind handlers once: recipe selection and inventory +/- adjustments
  // These need to be attached outside the per-step loop so they persist across renders.
  // _selectBound and _invBound ensure we don't attach multiple times on repeated renders.
  if (!c._selectBound) {
    c.addEventListener('change', (e) => {
      const target = e.target;
      if (target.tagName !== 'SELECT') return;
      const itemId = target.dataset.id;
      const idx    = parseInt(target.value, 10);
      if (!isNaN(idx)) {
        selectedRecipes[itemId] = idx;
        saveToLocalStorage('selectedRecipes', selectedRecipes);
        renderCraftingTab();
      }
    });
    c._selectBound = true;
  }
  // Bind click handler for plus/minus buttons to modify inventory.
  if (!c._invBound) {
    c.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const id = btn.dataset.id;
      if (!id) return;
      const current = inventory[id] || 0;
      const inc = btn.classList.contains('inv-add-btn') || btn.classList.contains('btn-plus');
      const dec = btn.classList.contains('inv-minus-btn') || btn.classList.contains('btn-minus');
      if (inc) updateInventoryQuantity(id, current + 1);
      else if (dec) updateInventoryQuantity(id, current - 1);
    });
    c._invBound = true;
  }


  const formatRange = (a,b) => (a === b ? `${b}` : `${a}\u2013${b}`); // 3–7

  craftingSteps.forEach((step, i)=>{
    const it = craftingData[step.id]; if (!it) return;

    // Calculate craftsNeeded based on target quantity
    const out = Math.max(1, step.outputs?.maxOut || 1);
    const craftsNeeded = Math.ceil(step.quantityToGet / out);

    // Calculate real needs calculating +- from inventory
    const ingredientsComputed = (step.ingredients || []).map(ing => {
      const have = inventory[ing.id] || 0;
      const minQty = ing.quantityNeededMin !== undefined ? ing.quantityNeededMin : (ing.quantityNeeded || 0);
      const maxQty = ing.quantityNeededMax !== undefined ? ing.quantityNeededMax : (ing.quantityNeeded || 0);
      const needMin = Math.max(0, Math.ceil(minQty - have));
      const needMax = Math.max(0, Math.ceil(maxQty - have));
      return { ...ing, needMin, needMax };
    });

    // if inventory have all previous step, so show the next step needed, and hide "completed" steps
    if (ingredientsComputed.every(x => x.needMax === 0)) return;

    // Select recipe
    let recipeSelectorHtml = '';
    const item = craftingData[step.id];
    if (Array.isArray(item.recipes) && item.recipes.length > 1){
      const options = item.recipes.map((r, idx)=>{
        const txt = (r.consumed_items || []).map(ci=>{
          const ii = craftingData[ci.id]; return ii ? `${ci.quantity}x ${ii.name}` : 'Unknown';
        }).join(', ');
        return `<option value="${idx}" ${idx===step.recipeIndex?'selected':''}>Recipe: ${txt}</option>`;
      }).join('');
      recipeSelectorHtml = `<div class="recipe-selector"><select data-id="${step.id}">${options}</select></div>`;
    }

    // Title: "Get X ..." + no x,xx numbers
    const qtyGet = Math.ceil(step.quantityToGet);
    const producedMin = Math.ceil(step.quantityProducedMin || 0);
    const producedMax = Math.ceil(step.quantityProducedMax || 0);
    const showHint = (producedMin !== qtyGet) || (producedMax !== qtyGet);
    const hint = showHint
      ? ` <span style="opacity:.85;font-weight:600">(craft output: ${formatRange(step.outputs.minOut, step.outputs.maxOut)} per craft)</span>`
      : '';

    const titleImg = `assets/${it.icon}.png`;
    const titleHtml = `
      <div class="step-header">
        <h4 class="step-title">
          <img src="${titleImg}" alt="${it.name}" width="24" height="24"
               loading="lazy" decoding="async"
               style="object-fit:contain;border-radius:6px"
               onerror="this.onerror=null;this.src='${PH24}'"/>
          Step ${i + 1}: Get ${qtyGet}x ${it.name}${hint}
        </h4>
      </div>`;

    const ingHtml = ingredientsComputed.map(ing=>{
      const ingItem = craftingData[ing.id]; if (!ingItem) return `<li>Unknown Item</li>`;
      const icon = `assets/${ingItem.icon}.png`;
      const requiredMin = Math.ceil(ing.needMin);
      const requiredMax = Math.ceil(ing.needMax);
      const display = (requiredMin === requiredMax) ? `${requiredMax}` : `${requiredMin}–${requiredMax}`;
      const statusClass = (requiredMax === 0) ? 'green' : 'red';
      return `
        <li style="display:flex;align-items:center;gap:.5rem;">
          <img src="${icon}" alt="${ingItem.name}" width="24" height="24"
               loading="lazy" decoding="async"
               style="object-fit:contain;border-radius:6px"
               onerror="this.onerror=null;this.src='${PH24}'"/>
          <span class="ingredient-name">${ingItem.name}</span>
          <div style="margin-left:auto;display:flex;align-items:center;gap:.25rem;">
            <span class="step-status ${statusClass}">required: ${display}</span>
            <button class="btn-round btn-minus inv-minus-btn" data-id="${ing.id}" title="Decrease" style="--btn-size:24px;">−</button>
            <button class="btn-round btn-plus inv-add-btn" data-id="${ing.id}" title="Increase" style="--btn-size:24px;">+</button>
          </div>
        </li>`;
    }).join('');

    const card = document.createElement('div');
    card.className = 'craft-step-card';
    card.innerHTML = `${titleHtml}${recipeSelectorHtml}
      <h5 class="ingredients-title">Used in recipe for this step:</h5>
      <ul class="step-ingredients-list">${ingHtml}</ul>`;
    c.appendChild(card);
  });
}

  function renderRequiredResources(rawRange){
    const c = document.getElementById('global-requirements-list');
    if (!c) return;
    c.innerHTML = '';
    if (!rawRange || Object.keys(rawRange).length === 0){
      c.innerHTML = '<p>No raw resources required.</p>';
      return;
    }
    Object.entries(rawRange).forEach(([id, range]) => {
      const it = craftingData[id]; if (!it) return;
      let minVal, maxVal;
      if (typeof range === 'number' || range === undefined){
        minVal = maxVal = Math.max(0, Math.ceil(range || 0));
      } else {
        minVal = Math.max(0, Math.ceil(range.min || 0));
        maxVal = Math.max(0, Math.ceil(range.max || 0));
      }
      const txt = (minVal === maxVal) ? `${maxVal}` : `${minVal}–${maxVal}`;
      const statusClass = (maxVal === 0) ? 'green' : 'red';
      const card = document.createElement('div');
      card.className = 'requirement-card';
      const rightBlock = `<div style="margin-left:auto;display:flex;align-items:center;gap:.25rem;">
        <span class="step-status ${statusClass}" style="padding:.2rem .6rem;border-radius:6px;">required: ${txt}</span>
        <button class="btn-round btn-minus req-minus-btn" data-id="${id}" title="Decrease" style="--btn-size:24px;">−</button>
        <button class="btn-round btn-plus req-add-btn" data-id="${id}" title="Increase" style="--btn-size:24px;">+</button>
      </div>`;
      card.innerHTML = `
        <img src="assets/${it.icon}.png" alt="${it.name}" width="40" height="40"
             loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${PH40}'"/>
        <div class="item-name">${it.name}</div>
        ${rightBlock}`;
      c.appendChild(card);
    });

    // adjust inventory on button click
    if (!c._reqBound){
      c.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const id = btn.dataset.id;
        if (!id) return;
        const current = inventory[id] || 0;
        const inc = btn.classList.contains('req-add-btn') || btn.classList.contains('btn-plus');
        const dec = btn.classList.contains('req-minus-btn') || btn.classList.contains('btn-minus');
        if (inc) updateInventoryQuantity(id, current + 1);
        else if (dec) updateInventoryQuantity(id, current - 1);
      });
      c._reqBound = true;
    }
  }

  function renderInventory(){
    const c = document.getElementById('inventory-list');
    c.innerHTML = '';
    if (Object.keys(inventory).length === 0){ c.innerHTML = '<p>Your inventory is empty.</p>'; return; }
    Object.entries(inventory).forEach(([id, qty])=>{
      const it = craftingData[id]; if (!it || qty <= 0) return;
      const card = document.createElement('div');
      card.className = 'inventory-item-card';
      card.innerHTML = `
        <img src="assets/${it.icon}.png" alt="${it.name}" width="48" height="48"
             loading="lazy" decoding="async"
             onerror="this.onerror=null;this.src='https://placehold.co/64x64/2b2b41/e0e0e0?text=IMG'"/>
        <div class="item-name">${it.name}</div>
        <div class="inventory-item-controls">
          <button data-action="decrease" data-id="${id}" class="btn-round btn-minus" title="Decrease">−</button>
          <input type="number" value="${qty}" min="0" data-id="${id}"/>
          <button data-action="increase" data-id="${id}" class="btn-round btn-plus" title="Increase">+</button>
          <button data-action="remove" data-id="${id}" class="btn-ghost-danger">Remove</button>
        </div>`;
      c.appendChild(card);
    });

    if (!c._bound){
      c.addEventListener('click', handleInventoryUpdate);
      c.addEventListener('change', handleInventoryUpdate);
      c._bound = true;
    }
  }

  function renderInventoryUsage(inventoryUsage){
    const c = document.getElementById('inventory-usage-list');
    if (!c) return;
    c.innerHTML = '';
    if (Object.keys(inventoryUsage).length === 0){
      c.innerHTML = '<p>No items from your inventory are used for this craft.</p>';
      return;
    }
    Object.entries(inventoryUsage).forEach(([id, used])=>{
      const it = craftingData[id]; if (!it) return;
      const card = document.createElement('div');
      card.className = 'requirement-card';
      card.innerHTML = `
        <img src="assets/${it.icon}.png" alt="${it.name}" width="40" height="40"
             loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${PH40}'"/>
        <div class="item-name">${it.name}</div>
        <div class="item-quantity">used: ${Math.ceil(used)}</div>
        <div class="step-status green">from inventory</div>`;
      c.appendChild(card);
    });
  }

  // ==============================
  //  CORE CALCULATION
  // ==============================
  function calculateCraftingRequirements() {
    /**
     * Calculate the required resources (min/max bounds) and crafting steps while considering the inventory.
     *
     * - rawRange : object { id -> { min, max } } for raw resources (after inventory).
     * - craftingSteps : list of crafting steps with min/max craft and min/max needs for each ingredient.
     * - inventoryUsage : items consumed directly from the inventory.
     */
    const toCraftAggregated = {}; // id -> Quantity to get (Before rounding)
    const inventoryUsage = {};    // id -> Quantity used from inventory
    const tempInventory = { ...inventory };

    // Expand needs recursively to determine the minimum quantity to obtain for each item
    function expand(itemId, targetQtyMin, visited = new Set()){
      if (visited.has(itemId)) return;
      visited.add(itemId);

      const item = craftingData[itemId];
      if (!item) return;

      // Consume temporary inventory
      const have = tempInventory[itemId] || 0;
      const use  = Math.min(targetQtyMin, have);
      if (use > 0){
        inventoryUsage[itemId] = (inventoryUsage[itemId] || 0) + use;
        tempInventory[itemId]  -= use;
        targetQtyMin           -= use;
      }
      if (targetQtyMin <= 0) return;

      // if the item dont have recipe, it's probably a raw material: we accumulate the minimum required quantity
      if (!item.recipes || item.recipes.length === 0){
        // We simply count the minimum need in toCraftAggregated
        toCraftAggregated[itemId] = (toCraftAggregated[itemId] || 0) + targetQtyMin;
        return;
      }

      // Choose recipe (or first if not defined)
      let recipeIndex = selectedRecipes[itemId] || 0;
      if (recipeIndex >= item.recipes.length) recipeIndex = 0;
      const recipe = item.recipes[recipeIndex];
      if (!recipe) return;

      // Determine the number of crafts needed using the maxOut bound to minimize the number of crafts
      const { minOut, maxOut } = getRecipeOutputs(recipe);
      const outMax = Math.max(1, maxOut);
      const craftsNeeded = Math.ceil(targetQtyMin / outMax);

      // Total quantity to obtain (before rounding)
      toCraftAggregated[itemId] = (toCraftAggregated[itemId] || 0) + targetQtyMin;

      // propagate to ingredients
      for (const ing of recipe.consumed_items || []){
        const childTarget = craftsNeeded * ing.quantity;
        expand(ing.id, childTarget, new Set(visited));
      }
    }

    // start expansion for each item in craftList
    for (const [id, qty] of Object.entries(craftList)){
      expand(id, qty);
    }

    // Build crafting steps with min/max bounds
    const craftingSteps = Object.entries(toCraftAggregated).map(([id, qtyToGet]) => {
      const item = craftingData[id]; if (!item) return null;
      let recipeIndex = selectedRecipes[id] || 0;
      if (recipeIndex >= (item.recipes?.length || 0)) recipeIndex = 0;
      const recipe = item.recipes?.[recipeIndex]; if (!recipe) return null;
      const { minOut, maxOut } = getRecipeOutputs(recipe);
      const outMin = Math.max(1, minOut);
      const outMax = Math.max(1, maxOut);
      // craftsMin: we utilize outMax (for lucky people)
      const craftsMin = Math.ceil(qtyToGet / outMax);
      // craftsMax: we utilize outMin (for people like me)
      const craftsMax = Math.ceil(qtyToGet / outMin);
      const quantityProducedMin = craftsMin * outMin;
      const quantityProducedMax = craftsMax * outMax;
      const ingredients = (recipe.consumed_items || []).map(ing => {
        const qMin = ing.quantity * craftsMin;
        const qMax = ing.quantity * craftsMax;
        return {
          id: ing.id,
          quantityNeededMin: qMin,
          quantityNeededMax: qMax
        };
      });
      return {
        id,
        recipeIndex,
        quantityToGet : qtyToGet,
        craftsMin,
        craftsMax,
        quantityProducedMin,
        quantityProducedMax,
        outputs: { minOut: outMin, maxOut: outMax },
        ingredients
      };
    }).filter(Boolean);

    // sort by depth (from start to end)
    craftingSteps.sort((a,b) => getCraftingDepth(a.id) - getCraftingDepth(b.id));

    // Build min/max bounds for raw resources
    const rawRange = {};
    // Aggregate from step ingredients
    craftingSteps.forEach(step => {
      (step.ingredients || []).forEach(ing => {
        const itm = craftingData[ing.id];
        if (!itm || (itm.recipes && itm.recipes.length > 0)) return; // if in data "recipe" have something, so it's not a rawMaterial
        if (!rawRange[ing.id]) rawRange[ing.id] = { min: 0, max: 0 };
        rawRange[ing.id].min += ing.quantityNeededMin;
        rawRange[ing.id].max += ing.quantityNeededMax;
      });
    });
    // add crafted items that don't have a recipe (directly from craftList)
    Object.entries(craftList).forEach(([id, qty]) => {
      const item = craftingData[id];
      if (!item || (item.recipes && item.recipes.length > 0)) return;
      if (!rawRange[id]) rawRange[id] = { min: 0, max: 0 };
      rawRange[id].min += qty;
      rawRange[id].max += qty;
    });
    // minus from inventory usage
    Object.entries(rawRange).forEach(([id, range]) => {
      const used = inventoryUsage[id] || 0;
      range.min = Math.max(0, Math.ceil(range.min - used));
      range.max = Math.max(0, Math.ceil(range.max - used));
    });

    return { rawRange, craftingSteps, inventoryUsage };
  }

  function getCraftingDepth(itemId, path = new Set()){
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
  }

  function getRecipeOutputs(recipe){
    if (recipe?.possibilities && Object.keys(recipe.possibilities).length > 0){
      const amounts = Object.keys(recipe.possibilities).map(k=>parseInt(k,10)).filter(Number.isFinite);
      const minOut = Math.max(0, Math.min(...amounts));
      const maxOut = Math.max(0, Math.max(...amounts));
      return { minOut: Math.max(0, minOut), maxOut: Math.max(1, maxOut) };
    }
    const q = recipe?.output_quantity || 1;
    return { minOut: q, maxOut: q };
  }

  // ==============================
  //  INVENTORY HANDLERS
  // ==============================
  function handleInventoryUpdate(e){
    const { action, id } = e.target.dataset || {};
    if (!id) return;
    const current = parseInt(inventory[id], 10) || 0;
    if (e.type === 'change') updateInventoryQuantity(id, parseInt(e.target.value, 10));
    else if (action === 'increase') updateInventoryQuantity(id, current + 1);
    else if (action === 'decrease') updateInventoryQuantity(id, current - 1);
    else if (action === 'remove') updateInventoryQuantity(id, 0);
  }

  // ==============================
  //  STATE HELPERS
  // ==============================
  function addToCraftList(id, q){
    if (!craftingData[id]) { showMessage(`Error: Item ${id} not found.`, 'error'); return; }
    craftList[id] = (craftList[id] || 0) + q;
    saveToLocalStorage('craftList', craftList);
    showMessage('added', 'success');
  }
  function updateCraftQuantity(id, v){
    const n = parseInt(v, 10);
    if (isNaN(n) || n <= 0) delete craftList[id];
    else craftList[id] = n;
    saveToLocalStorage('craftList', craftList);
    renderCraftingTab();
  }
  function addToInventory(id, q){
    if (!craftingData[id]) { showMessage(`Error: Item ${id} not found.`, 'error'); return; }
    inventory[id] = (inventory[id] || 0) + q;
    saveToLocalStorage('inventory', inventory);
    showMessage('added', 'success');
  }
  function updateInventoryQuantity(id, v){
    const n = parseInt(v, 10);
    if (isNaN(n) || n <= 0) delete inventory[id];
    else inventory[id] = n;
    saveToLocalStorage('inventory', inventory);
    if (document.getElementById('inventory')?.classList.contains('active')) renderInventory();
    if (document.getElementById('craft')?.classList.contains('active')) renderCraftingTab();
    if (document.getElementById('items-grid')) renderItemsGrid();
  }
  function clearCraftList(){
    if (!confirm('Clear your craft list?')) return;
    craftList = {}; selectedRecipes = {};
    saveToLocalStorage('craftList', craftList);
    saveToLocalStorage('selectedRecipes', selectedRecipes);
    showMessage('Craft list cleared!', 'success');
    renderCraftingTab(); if (document.getElementById('items-grid')) renderItemsGrid();
  }
  function clearInventory(){
    if (!confirm('Clear your entire inventory?')) return;
    inventory = {};
    saveToLocalStorage('inventory', inventory);
    showMessage('Inventory cleared!', 'success');
    renderInventory();
    if (document.getElementById('craft')?.classList.contains('active')) renderCraftingTab();
    if (document.getElementById('items-grid')) renderItemsGrid();
  }
  function clearLocalStorage(){
    if (!confirm('This will clear ALL local data (craft list, inventory, settings). Are you sure?')) return;
    localStorage.clear();
    craftList = {}; inventory = {}; travelerVisibility = {}; selectedRecipes = {}; travelerLevels = {};
    showMessage('All local data cleared.', 'success');
    location.reload();
  }
  const saveToLocalStorage = (k, d) => localStorage.setItem(k, JSON.stringify(d));

  // ==============================
  //  SHARE (modal in-site)
  // ==============================

  // The entire code for sharing and import is coded entirely by AI, and while I don't fully understand it, I trust its functionality. AI made some comments for me to improve my understanding.
  // but I need to learn more about it. So i kept her comments.
  
  function wireShareModal(){
    const modal = document.getElementById('share-modal');
    if (!modal) return;
    const linkInput   = modal.querySelector('#share-link');
    const codeInput   = modal.querySelector('#share-code');
    const copyLinkBtn = modal.querySelector('#copy-share-link');
    const openBtn     = modal.querySelector('#open-share-link');
    const closeBtn    = modal.querySelector('#close-share-modal');
    const viewBtn     = modal.querySelector('#view-share-data');
    const dataView    = modal.querySelector('#share-data-view');

    const copy = (t) => navigator.clipboard.writeText(t)
      .then(()=>showMessage('Copied!', 'success'))
      .catch(()=>showMessage('Copy failed. Select & Ctrl+C.', 'error'));

    if (copyLinkBtn) copyLinkBtn.onclick = () => copy(linkInput.value);
    if (openBtn) openBtn.onclick = (e)=>{ e.preventDefault(); window.open(linkInput.value, '_blank'); };
    if (closeBtn) closeBtn.onclick = ()=>{ modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); };

    // Show decoded contents of the share payload when the user clicks "View Data". This
    // decodes the Base64 in the share-code input, then renders a list of items and
    // quantities for either craft lists or inventories. If the view is currently
    // visible, clicking again hides it. Of course, this entire part is done by GPT, cause he explained me how this work, but impossible for me to understand.
    if (viewBtn && dataView) {
      viewBtn.onclick = () => {
        const code = codeInput.value.trim();
        if (!code) { showMessage('No data to view.', 'info'); return; }
        // Toggle off if already visible
        if (dataView.style.display !== 'none') {
          dataView.style.display = 'none';
          return;
        }
        let data;
        try {
          data = JSON.parse(atob(code));
        } catch (err) {
          console.error(err);
          showMessage('Invalid encoded data.', 'error');
          return;
        }
        // Determine whether this is a craft or inventory payload
        const list = data?.list || {};
        const inv  = data?.inv || {};
        let html = '';
        // helper to format entries
        const formatEntries = (entries) => {
          return Object.entries(entries).map(([id,q]) => {
            const it = craftingData[id];
            const name = it ? it.name : `#${id}`;
            return `<li style="margin:.15rem 0">${name}: <strong>${q}</strong></li>`;
          }).join('');
        };
        if (Object.keys(list).length > 0) {
          html += '<strong>Craft List:</strong><ul style="margin:.25rem 0 .5rem;padding-left:1.25rem">' + formatEntries(list) + '</ul>';
        }
        if (Object.keys(inv).length > 0) {
          html += '<strong>Inventory:</strong><ul style="margin:.25rem 0;padding-left:1.25rem">' + formatEntries(inv) + '</ul>';
        }
        if (!html) {
          html = '<em>No items found.</em>';
        }
        dataView.innerHTML = html;
        dataView.style.display = 'block';
      };
    }
  }
  function openShareModal(url, code){
    const modal = document.getElementById('share-modal'); if (!modal) return;
    modal.querySelector('#share-link').value = url;
    modal.querySelector('#share-code').value = code;
    modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
    const onBackdrop = (e)=>{ if (e.target === modal){ modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); modal.removeEventListener('click', onBackdrop);} };
    modal.addEventListener('click', onBackdrop, { once:true });
    const onEsc = (e)=>{ if (e.key === 'Escape'){ modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); window.removeEventListener('keydown', onEsc);} };
    window.addEventListener('keydown', onEsc, { once:true });
  }
  function shareViaLink(kind){
    let payload;
    if (kind === 'craft') payload = { list: craftList, recipes: selectedRecipes };
    else if (kind === 'inventory') payload = { inv: inventory };
    else return;
    const base = `${location.origin}${location.pathname}`;
    const encoded = btoa(JSON.stringify(payload));
    const param = kind === 'craft' ? 'craft' : 'inventory';
    const url = `${base}?${param}=${encodeURIComponent(encoded)}`;
    openShareModal(url, encoded);
  }

  // ==============================
  //  IMPORT VIA URL
  // ==============================
  function tryImportFromURL(){
    const p = new URLSearchParams(location.search);
    const craftCode = p.get('craft');
    const invCode = p.get('inventory');
    if (craftCode){ handleImportPayload(craftCode, 'craft'); history.replaceState({}, '', location.pathname); }
    else if (invCode){ handleImportPayload(invCode, 'inventory'); history.replaceState({}, '', location.pathname); }
  }
  function handleImportPayload(codeOrURL, kind){
    let encoded = codeOrURL.trim();
    try {
      const u = new URL(encoded);
      const sp = new URLSearchParams(u.search);
      if (sp.get('craft')) { encoded = sp.get('craft'); kind = 'craft'; }
      if (sp.get('inventory')) { encoded = sp.get('inventory'); kind = 'inventory'; }
    } catch {}
    let data;
    try { data = JSON.parse(atob(encoded)); }
    catch(e){ showMessage('Invalid or corrupted import code.', 'error'); console.error(e); return; }

    const modal = document.getElementById('link-import-modal');
    if (modal) openLinkImportModal(kind, data);
    else {
      const merge = confirm(`Import ${kind} — OK = Merge, Cancel = Replace`);
      doImport(kind, data, merge ? 'merge' : 'replace');
    }
  }
  function openLinkImportModal(kind, data){
    const modal = document.getElementById('link-import-modal'); if (!modal) return;
    const details = modal.querySelector('#import-details');
    const title = modal.querySelector('#import-title');
    const summary = modal.querySelector('#import-summary');
    const mergeBtn = modal.querySelector('#merge-import');
    const replaceBtn = modal.querySelector('#replace-import');
    const cancelBtn = modal.querySelector('#cancel-import');

    title.textContent = kind === 'inventory' ? 'Import Inventory' : 'Import Craft List';
    const incoming = (kind === 'inventory') ? (data?.inv || {}) : (data?.list || {});
    const current  = (kind === 'inventory') ? inventory : craftList;

    // Set default import target radio buttons based on kind
    const targetCraftRadio = modal.querySelector('#import-target-craft');
    const targetInvRadio   = modal.querySelector('#import-target-inventory');
    if (targetCraftRadio && targetInvRadio){
      targetCraftRadio.checked = (kind === 'craft');
      targetInvRadio.checked   = (kind === 'inventory');
    }

    // Function to update the details section based on a selected target (craft or inventory)
    function updateDetails(targetKind){
      // Determine the incoming items: if the user chooses to import into inventory,
      // use whatever exists in data.inv (or data.list) and vice‑versa for craft. This
      // allows cross‑imports (e.g. import an inventory list into the craft tab).
      const incomingItems = targetKind === 'inventory'
        ? (data.inv || data.list || {})
        : (data.list || data.inv || {});
      // Determine current items from whichever list the user selected as target
      const currentItems = targetKind === 'inventory' ? inventory : craftList;
      // Compute simple diff rows (limit to first 10 for brevity)
      const allKeys = Array.from(new Set([...Object.keys(incomingItems), ...Object.keys(currentItems)]));
      const diffRows = [];
      for (const id of allKeys){
        const cur = currentItems[id] || 0;
        const inc = incomingItems[id] || 0;
        if (cur === 0 && inc > 0){ diffRows.push([id,'added',cur,inc]); }
        else if (cur > 0 && inc === 0){ diffRows.push([id,'removed',cur,inc]); }
        else if (cur !== inc){ diffRows.push([id,'updated',cur,inc]); }
      }
      const top10 = diffRows.slice(0,10).map(([id,type,cur,inc]) => {
        const it = craftingData[id];
        const name = it ? it.name : `#${id}`;
        return `<div style="display:flex;gap:.5rem;align-items:center;padding:.25rem 0;border-bottom:1px dashed var(--accent)">
          <span style="min-width:72px;text-transform:capitalize">${type}</span>
          <span style="flex:1">${name}</span>
          <span style="opacity:.8">${cur} → ${inc}</span>
        </div>`;
      }).join('');
      const count = Object.keys(incomingItems).length;
      // Update summary: inform the user how many items were found and ask how to import
      summary.textContent = `Found ${count} item${count !== 1 ? 's' : ''} in the incoming ${targetKind}. Choose how to import it.`;
      // Show up to 10 difference rows or leave blank if there are no differences
      details.innerHTML = diffRows.length ? top10 : '';
    }

    // Initial render of details using default kind
    updateDetails(kind);

    // When the user toggles import target, update details accordingly. Attach a single
    // change handler to the radio group. We avoid multiple listeners on each radio
    // to ensure the correct currently checked value is used.
    const group = modal.querySelector('.import-target');
    if (group && !group._bound) {
      group.addEventListener('change', () => {
        // Read which radio is currently checked
        const selected = modal.querySelector('input[name="import-target"]:checked');
        const targetKind = selected ? selected.value : kind;
        updateDetails(targetKind);
      });
      group._bound = true;
    }

    const onClose = ()=>{ modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); };
    mergeBtn.onclick = ()=>{
      const selected = modal.querySelector('input[name="import-target"]:checked');
      const targetKind = selected ? selected.value : kind;
      doImport(targetKind, data, 'merge');
      onClose();
    };
    replaceBtn.onclick = ()=>{
      const selected = modal.querySelector('input[name="import-target"]:checked');
      const targetKind = selected ? selected.value : kind;
      doImport(targetKind, data, 'replace');
      onClose();
    };
    cancelBtn.onclick = onClose;

    modal.classList.add('open'); modal.setAttribute('aria-hidden','false');
    modal.addEventListener('click', (e)=>{ if (e.target === modal) onClose(); }, { once:true });
    window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') onClose(); }, { once:true });
  }
  function doImport(kind, data, mode){
    // When importing, allow user to choose target (craft or inventory). The payload
    // might originate from either a craft share (data.list + data.recipes) or an
    // inventory share (data.inv). We normalise accordingly.
    if (kind === 'craft'){
      const incomingList = data.list || data.inv || {};
      if (mode === 'merge'){
        for (const [id,q] of Object.entries(incomingList)){
          craftList[id] = (craftList[id] || 0) + (q || 0);
        }
        // When merging into craft, preserve selectedRecipes and merge new recipes if present
        if (data.recipes) selectedRecipes = { ...data.recipes, ...selectedRecipes };
      } else {
        craftList = { ...incomingList };
        // Only set selectedRecipes if provided in payload; otherwise reset
        selectedRecipes = data.recipes || {};
      }
      saveToLocalStorage('craftList', craftList);
      saveToLocalStorage('selectedRecipes', selectedRecipes);
      renderCraftingTab();
      showMessage('Craft list imported!', 'success');
      switchTab('craft');
    } else {
      const incoming = data.inv || data.list || {};
      if (mode === 'merge'){
        for (const [id,q] of Object.entries(incoming)){
          inventory[id] = (inventory[id] || 0) + (q || 0);
        }
      } else {
        inventory = { ...incoming };
      }
      saveToLocalStorage('inventory', inventory);
      renderInventory();
      if (document.getElementById('craft')?.classList.contains('active')) renderCraftingTab();
      showMessage('Inventory imported!', 'success');
      switchTab('inventory');
    }
  }

  /**
   * Export all relevant local storage data to a JSON file. The file will
   * include craft lists, inventory, selected recipes, traveler settings and
   * saved plans. A download will be triggered with a timestamped filename.
   */
  function exportLocalStorageData(){
    try {
      const data = {
        craftList,
        inventory,
        selectedRecipes,
        travelerVisibility,
        travelerLevels,
        craftPlans,
        inventoryPlans
      };
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `bitcraft-localstorage-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMessage('Local storage exported!', 'success');
    } catch (err) {
      console.error(err);
      showMessage('Export failed.', 'error');
    }
  }

  /**
   * Handle file selection for importing local storage data. Reads the JSON
   * file provided by the user, validates its structure, then applies it to
   * the current local state and reloads the page.
   */
  function handleLocalStorageImport(e){
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (typeof data !== 'object' || data === null) throw new Error('Invalid data');
        craftList = data.craftList || {};
        inventory = data.inventory || {};
        selectedRecipes = data.selectedRecipes || {};
        travelerVisibility = data.travelerVisibility || {};
        travelerLevels = data.travelerLevels || {};
        craftPlans = data.craftPlans || {};
        inventoryPlans = data.inventoryPlans || {};
        // Persist to localStorage
        saveToLocalStorage('craftList', craftList);
        saveToLocalStorage('inventory', inventory);
        saveToLocalStorage('selectedRecipes', selectedRecipes);
        saveToLocalStorage('travelerVisibility', travelerVisibility);
        saveToLocalStorage('travelerLevels', travelerLevels);
        saveToLocalStorage('craftPlans', craftPlans);
        saveToLocalStorage('inventoryPlans', inventoryPlans);
        showMessage('Local storage imported!', 'success');
        // Reload page to apply changes everywhere
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        console.error(err);
        showMessage('Invalid JSON file.', 'error');
      }
    };
    reader.readAsText(file);
  }

  /**
   * Open a modal showing the contents of a saved plan. The plan is passed
   * as a simple object mapping item IDs to quantities. The second argument
   * indicates the kind (craft or inventory) and is used for the title.
   */
  function openPlanViewModal(listObj, kind){
    const modal = document.getElementById('plan-view-modal');
    if (!modal) return;
    const content = modal.querySelector('#plan-view-content');
    const titleEl = modal.querySelector('#plan-view-title');
    // Build title based on kind
    titleEl.textContent = kind === 'inventory' ? 'Inventory Plan' : 'Craft Plan';
    // Build HTML list of items
    const entries = Object.entries(listObj || {});
    if (entries.length === 0){
      content.innerHTML = '<p><em>No items in this plan.</em></p>';
    } else {
      const itemsHtml = entries.map(([id, q]) => {
        const it = craftingData[id];
        const name = it ? it.name : `#${id}`;
        return `<li style="margin:.15rem 0">${name}: <strong>${q}</strong></li>`;
      }).join('');
      content.innerHTML = `<ul style="padding-left:1.25rem;margin:0">${itemsHtml}</ul>`;
    }
    // Show modal
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    // Close handler
    const closeBtn = modal.querySelector('#close-plan-view');
    const onClose = () => {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden','true');
    };
    if (closeBtn) closeBtn.onclick = onClose;
    // Click outside to close
    modal.addEventListener('click', (e) => { if (e.target === modal) onClose(); }, { once:true });
    // Escape key to close
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') onClose(); }, { once:true });
  }
  // =========================================
  // PLAN HANDLING (Craft and Inventory)
  // =========================================

  /**
   * Render the list of saved craft plans into the plans list container. Each
   * plan card shows its name, a simple summary (# of items) and actions to
   * merge, replace or delete the plan. Clicking on the action buttons is
   * delegated to handleCraftPlanClick().
   */
  function renderCraftPlans(){
    const container = document.getElementById('plans-list');
    if (!container) return;
    container.innerHTML = '';
    const names = Object.keys(craftPlans);
    if (names.length === 0){
      container.innerHTML = '<p style="opacity:.8;">No saved plans.</p>';
      return;
    }
    names.forEach(name => {
      const plan = craftPlans[name];
      const itemCount = Object.keys(plan.list || {}).length;
      const card = document.createElement('div');
      card.className = 'plan-card';
      card.dataset.name = name;
      card.innerHTML = `
        <div>
          <div class="plan-name">${name}</div>
          <div class="plan-meta">${itemCount} item${itemCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="plan-actions">
          <button data-action="view" data-name="${name}">View</button>
          <button data-action="share" data-name="${name}">Share</button>
          <button data-action="merge" data-name="${name}">Merge</button>
          <button data-action="replace" data-name="${name}">Replace</button>
          <button data-action="delete" data-name="${name}">Delete</button>
        </div>`;
      container.appendChild(card);
    });
  }

  /**
   * Handle click events on craft plan action buttons. Determines the action
   * based on the data-action attribute and invokes the corresponding
   * operation (merge, replace or delete) on the selected plan.
   */
  function handleCraftPlanClick(e){
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const name = btn.dataset.name;
    if (!action || !name) return;
    const plan = craftPlans[name];
    if (!plan) { showMessage('Plan not found.', 'error'); return; }
    if (action === 'view'){
      // Show contents of this craft plan
      openPlanViewModal(plan.list || {}, 'craft');
      return;
    } else if (action === 'share'){
      // Share this craft plan: generate a share link/code and open share modal
      const payload = { list: { ...plan.list }, recipes: { ...plan.recipes } };
      const encoded = btoa(JSON.stringify(payload));
      const base = `${location.origin}${location.pathname}`;
      const url = `${base}?craft=${encodeURIComponent(encoded)}`;
      openShareModal(url, encoded);
      return;
    } else if (action === 'delete'){
      if (!confirm(`Delete plan \"${name}\"?`)) return;
      delete craftPlans[name];
      localStorage.setItem('craftPlans', JSON.stringify(craftPlans));
      renderCraftPlans();
      showMessage('Plan deleted.', 'success');
    } else if (action === 'merge' || action === 'replace'){
      // Apply plan to craftList
      if (action === 'replace'){
        craftList = { ...plan.list };
        selectedRecipes = { ...plan.recipes };
      } else {
        // merge: add quantities
        for (const [id, q] of Object.entries(plan.list || {})){
          craftList[id] = (craftList[id] || 0) + q;
        }
        // merge recipes – prefer existing recipe if present
        selectedRecipes = { ...plan.recipes, ...selectedRecipes };
      }
      saveToLocalStorage('craftList', craftList);
      saveToLocalStorage('selectedRecipes', selectedRecipes);
      renderCraftingTab();
      renderCraftPlans();
      showMessage(`Plan \"${name}\" applied (${action}).`, 'success');
      switchTab('craft');
    }
  }

  /**
   * Render the list of saved inventory plans into the inv-plans-list container.
   */
  function renderInventoryPlans(){
    const container = document.getElementById('inv-plans-list');
    if (!container) return;
    container.innerHTML = '';
    const names = Object.keys(inventoryPlans);
    if (names.length === 0){
      container.innerHTML = '<p style="opacity:.8;">No saved plans.</p>';
      return;
    }
    names.forEach(name => {
      const plan = inventoryPlans[name];
      const itemCount = Object.keys(plan.inv || {}).length;
      const card = document.createElement('div');
      card.className = 'plan-card';
      card.dataset.name = name;
      card.innerHTML = `
        <div>
          <div class="plan-name">${name}</div>
          <div class="plan-meta">${itemCount} item${itemCount !== 1 ? 's' : ''}</div>
        </div>
        <div class="plan-actions">
          <button data-action="view" data-name="${name}">View</button>
          <button data-action="share" data-name="${name}">Share</button>
          <button data-action="merge" data-name="${name}">Merge</button>
          <button data-action="replace" data-name="${name}">Replace</button>
          <button data-action="delete" data-name="${name}">Delete</button>
        </div>`;
      container.appendChild(card);
    });
  }

  /**
   * Handle click events on inventory plan action buttons.
   */
  function handleInventoryPlanClick(e){
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const name = btn.dataset.name;
    if (!action || !name) return;
    const plan = inventoryPlans[name];
    if (!plan) { showMessage('Plan not found.', 'error'); return; }
    if (action === 'view'){
      openPlanViewModal(plan.inv || {}, 'inventory');
      return;
    } else if (action === 'share'){
      // Share this inventory plan: encode and open share modal
      const payload = { inv: { ...plan.inv } };
      const encoded = btoa(JSON.stringify(payload));
      const base = `${location.origin}${location.pathname}`;
      const url = `${base}?inventory=${encodeURIComponent(encoded)}`;
      openShareModal(url, encoded);
      return;
    } else if (action === 'delete'){
      if (!confirm(`Delete plan \"${name}\"?`)) return;
      delete inventoryPlans[name];
      localStorage.setItem('inventoryPlans', JSON.stringify(inventoryPlans));
      renderInventoryPlans();
      showMessage('Plan deleted.', 'success');
    } else if (action === 'merge' || action === 'replace'){
      if (action === 'replace'){
        inventory = { ...plan.inv };
      } else {
        // merge: sum quantities
        for (const [id, q] of Object.entries(plan.inv || {})){
          inventory[id] = (inventory[id] || 0) + q;
        }
      }
      saveToLocalStorage('inventory', inventory);
      renderInventory();
      if (document.getElementById('craft')?.classList.contains('active')) renderCraftingTab();
      renderInventoryPlans();
      showMessage(`Plan \"${name}\" applied (${action}).`, 'success');
      switchTab('inventory');
    }
  }

  // ==============================
  //  BOOT
  // ==============================
  init();

  // ==============================
  //  SMALL UI HELPERS
  // ==============================
  function showMessage(text, type='info'){
    const el = document.getElementById('global-info-message');
    if (!el) return;
    el.textContent = text;
    el.className = `global-info-message show ${type}`;
    setTimeout(()=> el.classList.remove('show'), 1600);
  }
});
