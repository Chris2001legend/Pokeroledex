
// ----------------- OFFLINE LOCAL STORAGE HELPERS -----------------
function getLocalTrainers() {
  try {
    return JSON.parse(localStorage.getItem('pokeroledex_trainers') || '[]');
  } catch(e) { return []; }
}
function setLocalTrainers(list) {
  localStorage.setItem('pokeroledex_trainers', JSON.stringify(list));
  fetchStats();
}
function getLocalPokemon() {
  try {
    return JSON.parse(localStorage.getItem('pokeroledex_custom_pokemon') || '[]');
  } catch(e) { return []; }
}
function setLocalPokemon(list) {
  localStorage.setItem('pokeroledex_custom_pokemon', JSON.stringify(list));
  fetchStats();
}
/**
 * PokéroleDex 3.0 Client Application
 * Handles interactive tabs, responsive moves view (cards / table), Pokérole stat sheet modals,
 * sprite styling, character/trainer creator, custom Pokémon builder, and TTRPG dice pool roller.
 */

// Global State
let currentSpriteStyle = localStorage.getItem('poke_sprite_style') || 'BookSprites';
let allPokemon = [];
let allMoves = [];
let allItems = [];
let allAbilities = [];
let allNatures = [];
let allTrainers = [];
let allCustomPokemon = [];

let activeTab = 'pokedex';
let selectedType = 'All';
let pokeSearchDebounceTimer = null;
let diceHistory = [];
let currentMovesView = 'cards';
let currentCreatorSubtab = 'trainers';

// State for custom pokemon builder
let currentSpeciesInfo = null;
let currentEquippedMoves = [];

const POKEMON_TYPES = [
  'All', 'Normale', 'Fuoco', 'Acqua', 'Erba', 'Elettro', 'Ghiaccio',
  'Lotta', 'Veleno', 'Terra', 'Volante', 'Psico', 'Coleottero',
  'Roccia', 'Spettro', 'Drago', 'Acciaio', 'Buio', 'Folletto'
];

const TYPE_CSS_MAP = {
  'Normale': 'Normal', 'Fuoco': 'Fire', 'Acqua': 'Water', 'Erba': 'Grass',
  'Elettro': 'Electric', 'Ghiaccio': 'Ice', 'Lotta': 'Fighting', 'Veleno': 'Poison',
  'Terra': 'Ground', 'Volante': 'Flying', 'Psico': 'Psychic', 'Coleottero': 'Bug',
  'Roccia': 'Rock', 'Spettro': 'Ghost', 'Drago': 'Dragon', 'Acciaio': 'Steel',
  'Buio': 'Dark', 'Folletto': 'Fairy',
  'Normal': 'Normal', 'Fire': 'Fire', 'Water': 'Water', 'Grass': 'Grass',
  'Electric': 'Electric', 'Ice': 'Ice', 'Fighting': 'Fighting', 'Poison': 'Poison',
  'Ground': 'Ground', 'Flying': 'Flying', 'Psychic': 'Psychic', 'Bug': 'Bug',
  'Rock': 'Rock', 'Ghost': 'Ghost', 'Dragon': 'Dragon', 'Steel': 'Steel',
  'Dark': 'Dark', 'Fairy': 'Fairy'
};

function getTypeClass(t) {
  if (!t) return 'Normal';
  return TYPE_CSS_MAP[t] || t;
}

function getCatClass(cat) {
  if (!cat) return 'Support';
  if (cat.includes('Fisico') || cat.includes('Physical')) return 'Physical';
  if (cat.includes('Speciale') || cat.includes('Special')) return 'Special';
  return 'Support';
}

function triggerHaptic(ms = 20) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(ms); } catch (e) {}
  }
}

const POKEROLE_SKILLS = {
  'Fisiche': ['Rissa', 'Lancio', 'Armi', 'Evasione', 'Atletica', 'Furtività', 'Sopravvivenza'],
  'Mentali': ['Allerta', 'Istruzione', 'Artigianato', 'Medicina', 'Pokélore', 'Scienza'],
  'Sociali': ['Fascino', 'Comando', 'Inganno', 'Empatia', 'Intimidire', 'Esibirsi']
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const spriteSelect = document.getElementById('spriteStyle');
  if (spriteSelect) spriteSelect.value = currentSpriteStyle;

  initTypeChips();
  initMoveTypeOptions();
  initTrainerSkillsInputs();
  fetchStats();
  loadPokedex();
  loadNatures(); // Pre-load natures for trainer & pokemon builders

  window.addEventListener('hashchange', handleHashRouting);
  if (window.location.hash) {
    handleHashRouting();
  }

  // Keyboard shortcut: Press "/" to focus search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      const currentSearch = document.querySelector(`.tab-pane.active .search-box input`);
      if (currentSearch) currentSearch.focus();
    } else if (e.key === 'Escape') {
      closePokeModal();
      closeMoveModal();
      closeAbilityModal();
      closeTrainerModal();
      closeCustomPokeModal();
      closeTrainerSheetModal();
    }
  });
});

// ----------------- ROUTING & TABS -----------------

function switchTab(tabName) {
  activeTab = tabName;
  triggerHaptic(15);
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });
  document.querySelectorAll('.b-nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${tabName}`);
  });

  // Lazy load tab data
  if (tabName === 'moves' && allMoves.length === 0) loadMoves();
  if (tabName === 'items' && allItems.length === 0) loadItems();
  if (tabName === 'abilities' && allAbilities.length === 0) loadAbilities();
  if (tabName === 'natures' && allNatures.length === 0) loadNatures();
  if (tabName === 'creator') loadCreatorData();

  window.location.hash = tabName;
}

function handleHashRouting() {
  const hash = window.location.hash.replace('#', '');
  if (['pokedex', 'moves', 'items', 'abilities', 'natures', 'creator', 'dice'].includes(hash)) {
    switchTab(hash);
  } else if (hash.startsWith('pokemon=')) {
    const pokeId = hash.replace('pokemon=', '');
    switchTab('pokedex');
    openPokeModal(pokeId);
  }
}

function changeSpriteStyle(newStyle) {
  currentSpriteStyle = newStyle;
  localStorage.setItem('poke_sprite_style', newStyle);
  
  document.querySelectorAll('img[data-sprite]').forEach(img => {
    const filename = img.dataset.sprite;
    if (filename) {
      img.src = `/images/${currentSpriteStyle}/${filename}`;
    }
  });
}

function getSpriteUrl(filename) {
  if (!filename) return '';
  if (window.location.protocol === 'file:') {
    return `Storage/images/${currentSpriteStyle}/${filename}`;
  }
  return `/images/${currentSpriteStyle}/${filename}`;
}

function getItemSpriteUrl(imgName) {
  if (!imgName) return '';
  if (window.location.protocol === 'file:') {
    return `Storage/images/ItemSprites/${imgName}`;
  }
  return `/images/ItemSprites/${imgName}`;
}

// ----------------- TYPE CHIPS SETUP -----------------

function initTypeChips() {
  const container = document.getElementById('typeFilterContainer');
  if (!container) return;

  container.innerHTML = POKEMON_TYPES.map(type => `
    <button type="button" 
      class="type-chip ${type === 'All' ? 'active' : `type-${type}`}" 
      onclick="selectTypeFilter('${type}', this)">
      ${type === 'All' ? 'Tutti i Tipi' : type}
    </button>
  `).join('');
}

function initMoveTypeOptions() {
  const select = document.getElementById('moveTypeFilter');
  if (!select) return;

  select.innerHTML = `<option value="All">Tutti i Tipi</option>` +
    POKEMON_TYPES.filter(t => t !== 'All').map(t => `<option value="${t}">${t}</option>`).join('');
}

function selectTypeFilter(type, btn) {
  selectedType = type;
  document.querySelectorAll('#typeFilterContainer .type-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  filterPokemon();
}

// ----------------- FETCH STATS -----------------

async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('stat-pokemon').textContent = data.pokemon;
    document.getElementById('stat-moves').textContent = data.moves;
    document.getElementById('stat-abilities').textContent = data.abilities;
    document.getElementById('stat-items').textContent = data.items;
    document.getElementById('stat-natures').textContent = data.natures;
    const trStat = document.getElementById('stat-trainers');
    if (trStat) trStat.textContent = data.trainers || 0;
    const cpStat = document.getElementById('stat-custom-pokemon');
    if (cpStat) cpStat.textContent = data.custom_pokemon || 0;
  } catch (e) {
    console.error('Stats fetch error:', e);
  }
}

// ----------------- POKEDEX TAB LOGIC -----------------

async function loadPokedex() {
  const grid = document.getElementById('pokemonGrid');
  grid.innerHTML = `<div class="loading-spinner">Caricamento Pokémon in corso...</div>`;

  try {
    const res = await fetch('/api/pokedex');
    allPokemon = await res.json();
    
    // Populate species datalist for custom pokemon creator
    const datalist = document.getElementById('speciesDatalist');
    if (datalist) {
      datalist.innerHTML = allPokemon.map(p => `<option value="${p.Name}">#${p.DexID} ${p.Name}</option>`).join('');
    }

    filterPokemon();
  } catch (err) {
    grid.innerHTML = `<div class="loading-spinner" style="color: #ef4444;">Errore nel caricamento del database SQLite.</div>`;
    console.error(err);
  }
}

function debouncePokeFilter() {
  clearTimeout(pokeSearchDebounceTimer);
  pokeSearchDebounceTimer = setTimeout(filterPokemon, 150);
}

function clearPokeSearch() {
  const input = document.getElementById('pokeSearch');
  input.value = '';
  document.querySelector('.search-box .clear-btn').style.display = 'none';
  filterPokemon();
}

function filterPokemon() {
  const searchInput = document.getElementById('pokeSearch');
  const query = searchInput.value.trim().toLowerCase();
  const clearBtn = searchInput.parentElement.querySelector('.clear-btn');
  if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';

  const rank = document.getElementById('pokeRankFilter').value;
  const sort = document.getElementById('pokeSort').value;
  const starterOnly = document.getElementById('pokeStarterToggle').checked;
  const legendaryOnly = document.getElementById('pokeLegendaryToggle').checked;

  let filtered = allPokemon.filter(p => {
    if (query) {
      const matchName = p.Name && p.Name.toLowerCase().includes(query);
      const matchDex = p.DexID && p.DexID.includes(query);
      const matchNum = p.Number && String(p.Number).includes(query);
      const matchCat = p.DexCategory && p.DexCategory.toLowerCase().includes(query);
      if (!matchName && !matchDex && !matchNum && !matchCat) return false;
    }
    if (selectedType !== 'All') {
      if (p.Type1 !== selectedType && p.Type2 !== selectedType) return false;
    }
    if (rank !== 'All' && p.RecommendedRank !== rank) {
      return false;
    }
    if (starterOnly && !p.GoodStarter) return false;
    if (legendaryOnly && !p.Legendary) return false;
    return true;
  });

  if (sort === 'name') {
    filtered.sort((a, b) => a.Name.localeCompare(b.Name));
  } else if (sort === 'name_desc') {
    filtered.sort((a, b) => b.Name.localeCompare(a.Name));
  } else if (sort === 'hp') {
    filtered.sort((a, b) => b.BaseHP - a.BaseHP || a.Number - b.Number);
  } else if (sort === 'stats') {
    const total = p => p.Strength + p.Dexterity + p.Vitality + p.Special + p.Insight;
    filtered.sort((a, b) => total(b) - total(a) || a.Number - b.Number);
  } else if (sort === 'number_desc') {
    filtered.sort((a, b) => b.Number - a.Number || b.DexID.localeCompare(a.DexID));
  } else {
    filtered.sort((a, b) => a.Number - b.Number || a.DexID.localeCompare(b.DexID));
  }

  renderPokemonGrid(filtered);
}

function renderPokemonGrid(list) {
  const grid = document.getElementById('pokemonGrid');
  const countText = document.getElementById('pokedexCountText');
  countText.textContent = `Visualizzati ${list.length} di ${allPokemon.length} Pokémon`;

  if (list.length === 0) {
    grid.innerHTML = `<div class="loading-spinner">Nessun Pokémon corrisponde ai filtri selezionati.</div>`;
    return;
  }

  grid.innerHTML = list.map(p => {
    const spriteUrl = getSpriteUrl(p.Image);
    return `
      <div class="pokemon-card" onclick="openPokeModal('${p._id}')">
        <div class="card-top">
          <span class="poke-dex-id">#${p.DexID || String(p.Number).padStart(4, '0')}</span>
          <div class="card-badges">
            ${p.GoodStarter ? '<span class="badge-tag badge-starter" title="Starter consigliato">Starter</span>' : ''}
            ${p.Legendary ? '<span class="badge-tag badge-legendary" title="Pokémon Leggendario">Leggendario</span>' : ''}
            <span class="rank-badge">${p.RecommendedRank}</span>
          </div>
        </div>

        <div class="sprite-container">
          <img src="${spriteUrl}" alt="${p.Name}" data-sprite="${p.Image || ''}" loading="lazy" onerror="this.src='/images/BookSprites/${p.Image}'">
        </div>

        <div class="poke-name" title="${p.Name}">${p.Name}</div>
        <div class="poke-category">${p.DexCategory || ''}</div>

        <div class="types-row">
          <span class="type-pill type-${getTypeClass(p.Type1)}">${p.Type1}</span>
          ${p.Type2 ? `<span class="type-pill type-${getTypeClass(p.Type2)}">${p.Type2}</span>` : ''}
        </div>

        <div class="card-stats-preview">
          <div class="stat-item"><span class="stat-label">HP</span><span class="stat-value">${p.BaseHP}</span></div>
          <div class="stat-item"><span class="stat-label">Str</span><span class="stat-value">${p.Strength}</span></div>
          <div class="stat-item"><span class="stat-label">Dex</span><span class="stat-value">${p.Dexterity}</span></div>
          <div class="stat-item"><span class="stat-label">Vit</span><span class="stat-value">${p.Vitality}</span></div>
          <div class="stat-item"><span class="stat-label">Spe</span><span class="stat-value">${p.Special}</span></div>
          <div class="stat-item"><span class="stat-label">Ins</span><span class="stat-value">${p.Insight}</span></div>
        </div>
      </div>
    `;
  }).join('');
}

// ----------------- POKEMON DETAIL MODAL -----------------

async function openPokeModal(pokemonId) {
  const modal = document.getElementById('pokeModal');
  const body = document.getElementById('pokeModalContent');
  modal.classList.add('open');
  body.innerHTML = `<div class="loading-spinner">Caricamento scheda Pokérole...</div>`;

  try {
    const res = await fetch(`/api/pokedex/${pokemonId}`);
    if (!res.ok) throw new Error('Pokemon not found');
    const poke = await res.json();
    renderPokeSheet(poke);
  } catch (e) {
    body.innerHTML = `<div class="loading-spinner" style="color: #ef4444;">Impossibile caricare i dati del Pokémon.</div>`;
  }
}

function closePokeModal(e) {
  if (e && e.target !== document.getElementById('pokeModal') && !e.target.classList.contains('modal-close')) {
    return;
  }
  document.getElementById('pokeModal').classList.remove('open');
  if (window.location.hash.startsWith('#pokemon=')) {
    window.location.hash = activeTab;
  }
}

function renderPokeSheet(poke) {
  const body = document.getElementById('pokeModalContent');
  const spriteUrl = getSpriteUrl(poke.Image);

  const renderDots = (base, max) => {
    let dotsHtml = '';
    for (let i = 1; i <= Math.max(max, 6); i++) {
      if (i <= base) {
        dotsHtml += '<div class="dot base" title="Punteggio Base"></div>';
      } else if (i <= max) {
        dotsHtml += '<div class="dot max" title="Capacità Massima"></div>';
      } else {
        dotsHtml += '<div class="dot"></div>';
      }
    }
    return dotsHtml;
  };

  const ranksOrder = ['Principiante', 'Novizio', 'Standard', 'Avanzato', 'Esperto', 'Asso', 'Maestro', 'Campione'];
  const movesByRank = {};
  poke.Moves.forEach(m => {
    const r = m.Learned || 'Standard';
    if (!movesByRank[r]) movesByRank[r] = [];
    movesByRank[r].push(m);
  });

  const ranksMult = { 'Principiante': 1, 'Starter': 1, 'Novizio': 2, 'Rookie': 2, 'Standard': 3, 'Avanzato': 4, 'Advanced': 4, 'Esperto': 5, 'Expert': 5, 'Asso': 6, 'Ace': 6, 'Maestro': 7, 'Master': 7, 'Campione': 8, 'Champion': 8 };
  const currentRank = poke.RecommendedRank || 'Starter';
  const mult = ranksMult[currentRank] || 1;
  const calculatedHp = poke.BaseHP + (poke.Vitality * mult);

  body.innerHTML = `
    <div class="sheet-header">
      <div class="sheet-artwork">
        <img src="${spriteUrl}" alt="${poke.Name}" data-sprite="${poke.Image}">
      </div>

      <div class="sheet-title-info">
        <div class="sheet-dex-num">#${poke.DexID} • Pokedex #${poke.Number}</div>
        <h1 class="sheet-name">${poke.Name}</h1>
        <div class="sheet-category">${poke.DexCategory || 'Pokémon della regione'}</div>

        <div class="sheet-types-row">
          <span class="type-pill type-${getTypeClass(poke.Type1)}">${poke.Type1}</span>
          ${poke.Type2 ? `<span class="type-pill type-${getTypeClass(poke.Type2)}">${poke.Type2}</span>` : ''}
        </div>

        <div class="sheet-meta-badges">
          <span class="rank-badge">Rango Consigliato: <strong>${poke.RecommendedRank}</strong></span>
          ${poke.GoodStarter ? '<span class="badge-tag badge-starter">⭐ Starter Consigliato</span>' : ''}
          ${poke.Legendary ? '<span class="badge-tag badge-legendary">👑 Pokémon Leggendario</span>' : ''}
          ${poke.GenderType ? `<span class="badge-tag">Genere: ${poke.GenderType}</span>` : ''}
        </div>

        <p style="margin-top: 0.75rem; font-size: 0.85rem; color: var(--text-muted); font-style: italic;">
          "${poke.DexDescription || 'Nessuna descrizione del Pokédex disponibile.'}"
        </p>

        <div style="margin-top: 1rem;">
          <button type="button" class="primary-btn" onclick="closePokeModal(); openCustomPokeModal(null, null, '${poke._id}')">
            <span>🐾 Personalizza questa Specie</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Health & Dynamic Rank Banner -->
    <div class="hp-rank-banner">
      <div class="hp-calculation">
        <div>
          <span style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-dim); display: block;">Punti Vita (HP)</span>
          <span class="hp-number" id="sheetCalculatedHp">${calculatedHp}</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted);">
          <span>HP Base: <strong>${poke.BaseHP}</strong> + (Vitalità <strong>${poke.Vitality}</strong> × Rango <strong id="sheetHpMult">${mult}</strong>)</span>
        </div>
      </div>

      <div class="rank-selector-wrap">
        <label for="sheetRankSelect" style="font-size: 0.8rem; color: var(--text-muted); margin-right: 0.5rem;">Calcola per Rango:</label>
        <select id="sheetRankSelect" onchange="updateSheetRankHp(${poke.BaseHP}, ${poke.Vitality}, this.value)">
          ${ranksOrder.map(r => `<option value="${r}" ${r === currentRank ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- Core Pokérole Attributes with Dot Track -->
    <h3 class="sheet-section-title">Attributi Pokérole (Tracciatore a Punti)</h3>
    <div class="attributes-grid">
      <div class="attr-box">
        <div class="attr-box-header">
          <span class="attr-name">Forza (Strength)</span>
          <span class="attr-val">${poke.Strength} <span style="font-size:0.75rem; color:var(--text-dim);">/ ${poke.MaxStrength}</span></span>
        </div>
        <div class="dot-track">${renderDots(poke.Strength, poke.MaxStrength)}</div>
      </div>

      <div class="attr-box">
        <div class="attr-box-header">
          <span class="attr-name">Destrezza (Dexterity)</span>
          <span class="attr-val">${poke.Dexterity} <span style="font-size:0.75rem; color:var(--text-dim);">/ ${poke.MaxDexterity}</span></span>
        </div>
        <div class="dot-track">${renderDots(poke.Dexterity, poke.MaxDexterity)}</div>
      </div>

      <div class="attr-box">
        <div class="attr-box-header">
          <span class="attr-name">Vitalità (Vitality)</span>
          <span class="attr-val">${poke.Vitality} <span style="font-size:0.75rem; color:var(--text-dim);">/ ${poke.MaxVitality}</span></span>
        </div>
        <div class="dot-track">${renderDots(poke.Vitality, poke.MaxVitality)}</div>
      </div>

      <div class="attr-box">
        <div class="attr-box-header">
          <span class="attr-name">Speciale (Special)</span>
          <span class="attr-val">${poke.Special} <span style="font-size:0.75rem; color:var(--text-dim);">/ ${poke.MaxSpecial}</span></span>
        </div>
        <div class="dot-track">${renderDots(poke.Special, poke.MaxSpecial)}</div>
      </div>

      <div class="attr-box">
        <div class="attr-box-header">
          <span class="attr-name">Intuito (Insight)</span>
          <span class="attr-val">${poke.Insight} <span style="font-size:0.75rem; color:var(--text-dim);">/ ${poke.MaxInsight}</span></span>
        </div>
        <div class="dot-track">${renderDots(poke.Insight, poke.MaxInsight)}</div>
      </div>
    </div>

    <!-- Physical specs -->
    <div style="display: flex; gap: 2rem; font-size: 0.85rem; color: var(--text-muted); background: var(--bg-card); padding: 0.75rem 1.25rem; border-radius: var(--radius-md); margin-bottom: 1.5rem;">
      <div>Altezza: <strong style="color:var(--text-main);">${poke.HeightMeters || '?'} m</strong> (${poke.HeightFeet || '?'} ft)</div>
      <div>Peso: <strong style="color:var(--text-main);">${poke.WeightKg || '?'} kg</strong> (${poke.WeightLbs || '?'} lbs)</div>
    </div>

    <!-- Abilities -->
    <h3 class="sheet-section-title">Abilità</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
      ${[
        { slot: 'Abilità 1', name: poke.Ability1 },
        { slot: 'Abilità 2', name: poke.Ability2 },
        { slot: 'Abilità Nascosta', name: poke.HiddenAbility },
        { slot: 'Abilità Evento', name: poke.EventAbilities }
      ].filter(a => a.name).map(a => {
        const details = poke.AbilitiesDetails[a.name] || {};
        return `
          <div class="attr-box" style="cursor:pointer;" onclick="openAbilityModalByName('${a.name}')">
            <span style="font-size: 0.7rem; color: var(--accent-red-hover); text-transform: uppercase; font-weight: 700;">${a.slot}</span>
            <strong style="font-size: 1rem; margin: 0.2rem 0;">${a.name}</strong>
            <p style="font-size: 0.8rem; color: var(--text-muted);">${details.Effect || 'Clicca per dettagli...'}</p>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Evolutions Chain -->
    <h3 class="sheet-section-title">Evoluzioni</h3>
    <div class="evolution-chain">
      ${poke.Evolutions && poke.Evolutions.length > 0 ? poke.Evolutions.map(evo => `
        <div class="evo-card" onclick="${evo.ToPokemon ? `openPokeModalByName('${evo.ToPokemon}')` : evo.FromPokemon ? `openPokeModalByName('${evo.FromPokemon}')` : ''}">
          <span class="evo-arrow">${evo.ToPokemon ? '➔' : '⬅'}</span>
          <div>
            <strong>${evo.ToPokemon || evo.FromPokemon}</strong>
            <div class="evo-req">${evo.Kind}${evo.Speed ? ` (${evo.Speed})` : ''}${evo.Item ? ` con ${evo.Item}` : ''}${evo.Stat ? ` [${evo.Stat}: ${evo.Value}]` : ''}</div>
          </div>
        </div>
      `).join('') : '<span style="color:var(--text-dim); font-size:0.85rem;">Nessuna evoluzione nota per questa specie.</span>'}
    </div>

    <!-- Learnset -->
    <h3 class="sheet-section-title">Mosse Apprese (Learnset per Rango)</h3>
    <div class="table-responsive">
      <table class="learnset-table">
        <thead>
          <tr>
            <th>Rango</th>
            <th>Nome Mossa</th>
            <th>Tipo</th>
            <th>Cat.</th>
            <th>Potenza</th>
            <th>Danno</th>
            <th>Precisione</th>
            <th>Bersaglio</th>
            <th>Effetto</th>
          </tr>
        </thead>
        <tbody>
          ${ranksOrder.map(r => {
            const moves = movesByRank[r];
            if (!moves || moves.length === 0) return '';
            return `
              <tr class="rank-header-row"><td colspan="9">Rango: ${r}</td></tr>
              ${moves.map(m => `
                <tr style="cursor: pointer;" onclick="openMoveModalByName('${m.Name}')">
                  <td><span class="rank-badge">${m.Learned}</span></td>
                  <td><strong>${m.Name}</strong></td>
                  <td>${m.Type ? `<span class="type-pill type-${m.Type}">${m.Type}</span>` : '-'}</td>
                  <td>${m.Category ? `<span class="category-pill cat-${m.Category}">${m.Category}</span>` : '-'}</td>
                  <td><span style="font-family:var(--font-mono); font-weight:600;">${m.Power ?? '-'}</span></td>
                  <td><span style="font-size:0.75rem;">${m.Damage1 ? `${m.Damage1}${m.Damage2 ? ` + ${m.Damage2}` : ''}` : '-'}</span></td>
                  <td><span style="font-size:0.75rem;">${m.Accuracy1 ? `${m.Accuracy1} + ${m.Accuracy2}` : '-'}</span></td>
                  <td><span style="font-size:0.75rem;">${m.Target || '-'}</span></td>
                  <td style="font-size: 0.8rem; color: var(--text-muted); max-width: 280px; white-space:normal;">${m.Effect || '-'}</td>
                </tr>
              `).join('')}
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function updateSheetRankHp(baseHp, vitality, rank) {
  const mults = { 'Starter': 1, 'Rookie': 2, 'Standard': 3, 'Advanced': 4, 'Expert': 5, 'Master': 6, 'Champion': 7 };
  const mult = mults[rank] || 1;
  const hp = baseHp + (vitality * mult);
  document.getElementById('sheetCalculatedHp').textContent = hp;
  document.getElementById('sheetHpMult').textContent = mult;
}

function openPokeModalByName(name) {
  const found = allPokemon.find(p => p.Name.toLowerCase() === name.toLowerCase());
  if (found) {
    openPokeModal(found._id);
  }
}

// ----------------- MOVES TAB LOGIC (RESPONSIVE) -----------------

async function loadMoves() {
  const grid = document.getElementById('movesGrid');
  grid.innerHTML = `<div class="loading-spinner">Caricamento elenco mosse...</div>`;

  try {
    const res = await fetch('/api/moves');
    allMoves = await res.json();
    filterMoves();
  } catch (err) {
    grid.innerHTML = `<div class="loading-spinner" style="color: #ef4444;">Errore nel caricamento delle mosse.</div>`;
  }
}

function setMovesView(mode) {
  currentMovesView = mode;
  document.getElementById('viewBtnCards').classList.toggle('active', mode === 'cards');
  document.getElementById('viewBtnTable').classList.toggle('active', mode === 'table');

  const cardsContainer = document.getElementById('movesGrid');
  const tableWrap = document.getElementById('movesTableWrap');

  if (mode === 'cards') {
    cardsContainer.style.display = 'grid';
    tableWrap.style.display = 'none';
  } else {
    cardsContainer.style.display = 'none';
    tableWrap.style.display = 'block';
  }
  filterMoves();
}

function clearMovesSearch() {
  const input = document.getElementById('movesSearch');
  input.value = '';
  document.querySelector('#tab-moves .clear-btn').style.display = 'none';
  filterMoves();
}

function filterMoves() {
  const searchInput = document.getElementById('movesSearch');
  const query = searchInput.value.trim().toLowerCase();
  const clearBtn = searchInput.parentElement.querySelector('.clear-btn');
  if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';

  const typeFilter = document.getElementById('moveTypeFilter').value;
  const catFilter = document.getElementById('moveCategoryFilter').value;
  const targetFilter = document.getElementById('moveTargetFilter').value;

  const filtered = allMoves.filter(m => {
    if (query) {
      const matchName = m.Name && m.Name.toLowerCase().includes(query);
      const matchEff = m.Effect && m.Effect.toLowerCase().includes(query);
      const matchDesc = m.Description && m.Description.toLowerCase().includes(query);
      if (!matchName && !matchEff && !matchDesc) return false;
    }
    if (typeFilter !== 'All' && m.Type !== typeFilter) return false;
    if (catFilter !== 'All' && m.Category !== catFilter) return false;
    if (targetFilter !== 'All' && m.Target !== targetFilter) return false;
    return true;
  });

  if (currentMovesView === 'cards') {
    renderMovesGrid(filtered);
  } else {
    renderMovesTable(filtered);
  }
}

function renderMovesGrid(list) {
  const grid = document.getElementById('movesGrid');
  const countText = document.getElementById('movesCountText');
  countText.textContent = `Visualizzate ${list.length} di ${allMoves.length} Mosse`;

  if (list.length === 0) {
    grid.innerHTML = `<div class="loading-spinner">Nessuna mossa trovata.</div>`;
    return;
  }

  grid.innerHTML = list.map(m => `
    <div class="move-card" onclick="openMoveModal('${m._id}')">
      <div class="move-header">
        <span class="move-name">${m.Name}</span>
        <div class="move-tags">
          <span class="type-pill type-${getTypeClass(m.Type)}">${m.Type}</span>
          <span class="category-pill cat-${getCatClass(m.Category)}">${m.Category}</span>
        </div>
      </div>

      <div class="move-stats-grid">
        <div class="move-stat-item"><small>Potenza</small><span>${m.Power ?? '-'}</span></div>
        <div class="move-stat-item"><small>Danno</small><span>${m.Damage1 || '-'}</span></div>
        <div class="move-stat-item"><small>Precisione</small><span>${m.Accuracy1 ? `${m.Accuracy1} + ${m.Accuracy2}` : '-'}</span></div>
        <div class="move-stat-item"><small>Bersaglio</small><span>${m.Target || '-'}</span></div>
      </div>

      <div class="move-effect-text">${m.Effect || m.Description || 'Nessun effetto specificato.'}</div>
    </div>
  `).join('');
}

function renderMovesTable(list) {
  const tbody = document.getElementById('movesTableBody');
  const countText = document.getElementById('movesCountText');
  countText.textContent = `Visualizzate ${list.length} di ${allMoves.length} Mosse`;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color:var(--text-muted);">Nessuna mossa trovata.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(m => `
    <tr style="cursor: pointer;" onclick="openMoveModal('${m._id}')">
      <td><strong>${m.Name}</strong></td>
      <td><span class="type-pill type-${getTypeClass(m.Type)}">${m.Type}</span></td>
      <td><span class="category-pill cat-${getCatClass(m.Category)}">${m.Category}</span></td>
      <td><span style="font-family:var(--font-mono); font-weight:700;">${m.Power ?? '-'}</span></td>
      <td><span style="font-size:0.75rem;">${m.Damage1 ? `${m.Damage1}${m.Damage2 ? ` + ${m.Damage2}` : ''}` : '-'}</span></td>
      <td><span style="font-size:0.75rem;">${m.Accuracy1 ? `${m.Accuracy1} + ${m.Accuracy2}` : '-'}</span></td>
      <td><span style="font-size:0.75rem;">${m.Target || '-'}</span></td>
      <td style="font-size:0.8rem; color:var(--text-muted); max-width:280px; white-space:normal;">${m.Effect || m.Description || '-'}</td>
    </tr>
  `).join('');
}

async function openMoveModal(moveId) {
  const modal = document.getElementById('moveModal');
  const body = document.getElementById('moveModalContent');
  modal.classList.add('open');
  triggerHaptic(15);

  if (window.POKEROLEDEX_DATA && window.POKEROLEDEX_DATA.moves) {
    const move = window.POKEROLEDEX_DATA.moves.find(m => m._id === moveId || m.Name.toLowerCase() === moveId.toLowerCase());
    if (move) {
      renderMoveDetailView(move, body);
      return;
    }
  }

  body.innerHTML = `<div class="loading-spinner">Caricamento dettagli mossa...</div>`;
  try {
    const res = await fetch(`/api/moves/${moveId}`);
    if (!res.ok) throw new Error('Move not found');
    const move = await res.json();
    renderMoveDetailView(move, body);
  } catch (err) {
    body.innerHTML = `<div class="loading-spinner" style="color: #ef4444;">Errore nel caricamento della mossa.</div>`;
  }
}

function renderMoveDetailView(move, body) {

    body.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; flex-wrap:wrap; gap:0.5rem;">
        <h2 style="font-size: 1.8rem; font-weight: 800;">${move.Name}</h2>
        <div style="display: flex; gap: 0.5rem;">
          <span class="type-pill type-${getTypeClass(move.Type)}">${move.Type}</span>
          <span class="category-pill cat-${getCatClass(move.Category)}">${move.Category}</span>
        </div>
      </div>

      <div class="move-stats-grid" style="padding: 1rem; font-size: 0.9rem; margin: 1rem 0;">
        <div class="move-stat-item"><small>Potenza</small><span>${move.Power}</span></div>
        <div class="move-stat-item"><small>Riserva Danno</small><span>${move.Damage1 ? `${move.Damage1}${move.Damage2 ? ` + ${move.Damage2}` : ''}` : '-'}</span></div>
        <div class="move-stat-item"><small>Tiro Precisione</small><span>${move.Accuracy1 ? `${move.Accuracy1} + ${move.Accuracy2}` : '-'}</span></div>
        <div class="move-stat-item"><small>Bersaglio</small><span>${move.Target || '-'}</span></div>
      </div>

      <h4 style="font-size: 0.9rem; text-transform: uppercase; color: var(--accent-red-hover); margin-bottom: 0.4rem;">Effetto della Regola</h4>
      <p style="font-size: 0.95rem; line-height: 1.5; margin-bottom: 1rem;">${move.Effect || 'Nessun effetto'}</p>

      <h4 style="font-size: 0.9rem; text-transform: uppercase; color: var(--text-dim); margin-bottom: 0.4rem;">Descrizione Ambientale</h4>
      <p style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; margin-bottom: 1.5rem;">"${move.Description || '-'}"</p>

      <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.75rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
        Pokémon che apprendono questa mossa (${move.LearnedBy ? move.LearnedBy.length : 0})
      </h4>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; max-height: 250px; overflow-y: auto;">
        ${move.LearnedBy && move.LearnedBy.length > 0 ? move.LearnedBy.map(p => `
          <button type="button" class="type-chip" style="background:var(--bg-card); opacity:1;" onclick="closeMoveModal(); openPokeModal('${p._id}');">
            #${p.DexID} <strong>${p.Name}</strong> (${p.Learned})
          </button>
        `).join('') : '<span style="color:var(--text-dim); font-size:0.85rem;">Nessun Pokémon apprende questa mossa per livello.</span>'}
      </div>
    `;
}

function openMoveModalByName(name) {
  const found = allMoves.find(m => m.Name.toLowerCase() === name.toLowerCase());
  if (found) {
    openMoveModal(found._id);
  }
}

function closeMoveModal(e) {
  if (e && e.target !== document.getElementById('moveModal') && !e.target.classList.contains('modal-close')) {
    return;
  }
  document.getElementById('moveModal').classList.remove('open');
}

// ----------------- ITEMS TAB LOGIC -----------------

async function loadItems() {
  const grid = document.getElementById('itemsGrid');
  if (window.POKEROLEDEX_DATA && window.POKEROLEDEX_DATA.items) {
    allItems = window.POKEROLEDEX_DATA.items;
    filterItems();
    return;
  }
  grid.innerHTML = `<div class="loading-spinner">Caricamento strumenti...</div>`;
  try {
    const res = await fetch('/api/items');
    allItems = await res.json();
    filterItems();
  } catch (err) {
    grid.innerHTML = `<div class="loading-spinner" style="color: #ef4444;">Errore nel caricamento degli strumenti.</div>`;
  }
}

function clearItemsSearch() {
  const input = document.getElementById('itemsSearch');
  input.value = '';
  document.querySelector('#tab-items .clear-btn').style.display = 'none';
  filterItems();
}

function filterItems() {
  const searchInput = document.getElementById('itemsSearch');
  const query = searchInput.value.trim().toLowerCase();
  const clearBtn = searchInput.parentElement.querySelector('.clear-btn');
  if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';

  const pocket = document.getElementById('itemPocketFilter').value;
  const pmd = document.getElementById('itemPmdFilter').value;

  const filtered = allItems.filter(item => {
    if (query) {
      const matchName = item.Name && item.Name.toLowerCase().includes(query);
      const matchDesc = item.Description && item.Description.toLowerCase().includes(query);
      const matchCat = item.Category && item.Category.toLowerCase().includes(query);
      if (!matchName && !matchDesc && !matchCat) return false;
    }
    if (pocket !== 'All' && item.Pocket !== pocket) return false;
    if (pmd === 'pmd' && !item.PMD) return false;
    if (pmd === 'standard' && item.PMD) return false;
    return true;
  });

  renderItemsGrid(filtered);
}

function renderItemsGrid(list) {
  const grid = document.getElementById('itemsGrid');
  const countText = document.getElementById('itemsCountText');
  countText.textContent = `Visualizzati ${list.length} di ${allItems.length} Strumenti`;

  if (list.length === 0) {
    grid.innerHTML = `<div class="loading-spinner">Nessuno strumento trovato.</div>`;
    return;
  }

  grid.innerHTML = list.map(it => {
    const spriteUrl = it.Image ? getItemSpriteUrl(it.Image) : '';
    return `
      <div class="item-card">
        <div class="item-sprite">
          ${spriteUrl ? `<img src="${spriteUrl}" alt="${it.Name}" onerror="this.style.display='none'">` : '🎒'}
        </div>
        <div class="item-info">
          <div class="item-title">${it.Name}</div>
          <div class="item-meta">
            <span class="rank-badge">${it.Pocket}</span>
            ${it.Category ? `<span class="badge-tag">${it.Category}</span>` : ''}
            ${it.TrainerPrice ? `<span class="item-price">💰 ${it.TrainerPrice}</span>` : ''}
            ${it.PMDPrice ? `<span class="item-price">🪙 PMD: ${it.PMDPrice}</span>` : ''}
          </div>
          <p class="item-desc">${it.Description || 'Nessuna descrizione.'}</p>
          ${it.HealthRestored ? `<div style="font-size:0.75rem; color:#10b981; margin-top:0.3rem;">💚 Cura: +${it.HealthRestored} HP</div>` : ''}
          ${it.Cures ? `<div style="font-size:0.75rem; color:#38bdf8; margin-top:0.2rem;">✨ Cura: ${it.Cures}</div>` : ''}
          ${it.Boost ? `<div style="font-size:0.75rem; color:#f59e0b; margin-top:0.2rem;">⚡ Incremento: +${it.Value || 1} a ${it.Boost}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ----------------- ABILITIES TAB LOGIC -----------------

async function loadAbilities() {
  const grid = document.getElementById('abilitiesGrid');
  if (window.POKEROLEDEX_DATA && window.POKEROLEDEX_DATA.abilities) {
    allAbilities = window.POKEROLEDEX_DATA.abilities;
    filterAbilities();
    return;
  }
  grid.innerHTML = `<div class="loading-spinner">Caricamento abilità...</div>`;
  try {
    const res = await fetch('/api/abilities');
    allAbilities = await res.json();
    filterAbilities();
  } catch (err) {
    grid.innerHTML = `<div class="loading-spinner" style="color: #ef4444;">Errore nel caricamento delle abilità.</div>`;
  }
}

function clearAbilitySearch() {
  const input = document.getElementById('abilitySearch');
  input.value = '';
  document.querySelector('#tab-abilities .clear-btn').style.display = 'none';
  filterAbilities();
}

function filterAbilities() {
  const searchInput = document.getElementById('abilitySearch');
  const query = searchInput.value.trim().toLowerCase();
  const clearBtn = searchInput.parentElement.querySelector('.clear-btn');
  if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';

  const filtered = allAbilities.filter(a => {
    if (query) {
      const matchName = a.Name && a.Name.toLowerCase().includes(query);
      const matchEff = a.Effect && a.Effect.toLowerCase().includes(query);
      const matchDesc = a.Description && a.Description.toLowerCase().includes(query);
      if (!matchName && !matchEff && !matchDesc) return false;
    }
    return true;
  });

  renderAbilitiesGrid(filtered);
}

function renderAbilitiesGrid(list) {
  const grid = document.getElementById('abilitiesGrid');
  const countText = document.getElementById('abilitiesCountText');
  countText.textContent = `Visualizzate ${list.length} di ${allAbilities.length} Abilità`;

  if (list.length === 0) {
    grid.innerHTML = `<div class="loading-spinner">Nessuna abilità trovata.</div>`;
    return;
  }

  grid.innerHTML = list.map(a => `
    <div class="ability-card" onclick="openAbilityModal('${a._id}')">
      <div class="ability-name">${a.Name}</div>
      <div class="ability-effect">${a.Effect || 'Nessun effetto specificato.'}</div>
      ${a.Description ? `<div class="ability-desc">"${a.Description}"</div>` : ''}
    </div>
  `).join('');
}

async function openAbilityModal(abilityId) {
  const modal = document.getElementById('abilityModal');
  const body = document.getElementById('abilityModalContent');
  modal.classList.add('open');
  triggerHaptic(15);

  if (window.POKEROLEDEX_DATA && window.POKEROLEDEX_DATA.abilities) {
    const ability = window.POKEROLEDEX_DATA.abilities.find(a => a._id === abilityId || a.Name.toLowerCase() === abilityId.toLowerCase());
    if (ability) {
      renderAbilityDetailView(ability, body);
      return;
    }
  }

  body.innerHTML = `<div class="loading-spinner">Caricamento dettagli abilità...</div>`;
  try {
    const res = await fetch(`/api/abilities/${abilityId}`);
    if (!res.ok) throw new Error('Ability not found');
    const ability = await res.json();
    renderAbilityDetailView(ability, body);
  } catch (e) {
    body.innerHTML = `<div class="loading-spinner" style="color: #ef4444;">Errore nel caricamento dell'abilità.</div>`;
  }
}

function renderAbilityDetailView(ability, body) {

    body.innerHTML = `
      <h2 style="font-size: 1.8rem; font-weight: 800; color: var(--accent-red-hover); margin-bottom: 0.5rem;">${ability.Name}</h2>

      <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-dim); margin-top: 1rem; margin-bottom: 0.4rem;">Regola / Effetto</h4>
      <p style="font-size: 1rem; line-height: 1.5; margin-bottom: 1rem;">${ability.Effect || 'Nessun effetto registrato.'}</p>

      <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-dim); margin-bottom: 0.4rem;">Descrizione Ambientale</h4>
      <p style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; margin-bottom: 1.5rem;">"${ability.Description || '-'}"</p>

      <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.75rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
        Pokémon con questa abilità (${ability.PokemonWithAbility ? ability.PokemonWithAbility.length : 0})
      </h4>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; max-height: 250px; overflow-y: auto;">
        ${ability.PokemonWithAbility && ability.PokemonWithAbility.length > 0 ? ability.PokemonWithAbility.map(p => `
          <button type="button" class="type-chip" style="background:var(--bg-card); opacity:1;" onclick="closeAbilityModal(); openPokeModal('${p._id}');">
            #${p.DexID} <strong>${p.Name}</strong> <span style="font-size:0.7rem; color:var(--text-dim);">(${p.Slot})</span>
          </button>
        `).join('') : '<span style="color:var(--text-dim); font-size:0.85rem;">Nessun Pokémon trovato con questa abilità.</span>'}
      </div>
    `;
}

function openAbilityModalByName(name) {
  const found = allAbilities.find(a => a.Name.toLowerCase() === name.toLowerCase());
  if (found) {
    openAbilityModal(found._id);
  }
}

function closeAbilityModal(e) {
  if (e && e.target !== document.getElementById('abilityModal') && !e.target.classList.contains('modal-close')) {
    return;
  }
  document.getElementById('abilityModal').classList.remove('open');
}

// ----------------- NATURES TAB LOGIC -----------------

async function loadNatures() {
  const grid = document.getElementById('naturesGrid');
  if (window.POKEROLEDEX_DATA && window.POKEROLEDEX_DATA.natures) {
    allNatures = window.POKEROLEDEX_DATA.natures;
    if (grid) renderNaturesGrid(allNatures);
    const trNatureSelect = document.getElementById('trNature');
    if (trNatureSelect) {
      trNatureSelect.innerHTML = allNatures.map(n => `<option value="${n.Name}"> ${n.Name} (Fiducia: +${n.Confidence})</option>`).join('');
    }
    const cpNatureSelect = document.getElementById('cpNature');
    if (cpNatureSelect) {
      cpNatureSelect.innerHTML = allNatures.map(n => `<option value="${n.Name}">${n.Name} (Fiducia: +${n.Confidence})</option>`).join('');
    }
    return;
  }
  if (grid) grid.innerHTML = `<div class="loading-spinner">Caricamento nature...</div>`;
  try {
    const res = await fetch('/api/natures');
    allNatures = await res.json();
    if (grid) renderNaturesGrid(allNatures);
    const trNatureSelect = document.getElementById('trNature');
    if (trNatureSelect) {
      trNatureSelect.innerHTML = allNatures.map(n => `<option value="${n.Name}"> ${n.Name} (Fiducia: +${n.Confidence})</option>`).join('');
    }
    const cpNatureSelect = document.getElementById('cpNature');
    if (cpNatureSelect) {
      cpNatureSelect.innerHTML = allNatures.map(n => `<option value="${n.Name}">${n.Name} (Fiducia: +${n.Confidence})</option>`).join('');
    }
  } catch (err) {
    if (grid) grid.innerHTML = `<div class="loading-spinner" style="color: #ef4444;">Errore nel caricamento delle nature.</div>`;
  }
}

function renderNaturesGrid(list) {
  const grid = document.getElementById('naturesGrid');
  if (!grid) return;
  grid.innerHTML = list.map(n => `
    <div class="nature-card">
      <div class="nature-header">
        <span class="nature-name">${n.Name}</span>
        <span class="confidence-badge">Fiducia: +${n.Confidence}</span>
      </div>
      <div class="nature-keywords">${n.Keywords || ''}</div>
      <p class="nature-desc">${n.Description}</p>
    </div>
  `).join('');
}

// ========================================================
// CREATOR TAB LOGIC (PERSONAGGI & TEAM POKÉMON)
// ========================================================

function loadCreatorData() {
  loadTrainers();
  loadCustomPokemon();
}

function switchCreatorSubtab(subtab) {
  currentCreatorSubtab = subtab;
  document.getElementById('subnavTrainers').classList.toggle('active', subtab === 'trainers');
  document.getElementById('subnavPokemon').classList.toggle('active', subtab === 'pokemon');

  document.getElementById('btnNewTrainer').style.display = subtab === 'trainers' ? 'inline-flex' : 'none';
  document.getElementById('btnNewPokemon').style.display = subtab === 'pokemon' ? 'inline-flex' : 'none';

  document.getElementById('creatorTrainersView').style.display = subtab === 'trainers' ? 'block' : 'none';
  document.getElementById('creatorPokemonView').style.display = subtab === 'pokemon' ? 'block' : 'none';

  if (subtab === 'trainers') loadTrainers();
  if (subtab === 'pokemon') loadCustomPokemon();
}

// ----------------- TRAINERS (ALLENATORI) -----------------

async function loadTrainers() {
  const grid = document.getElementById('trainersGrid');
  grid.innerHTML = `<div class="loading-spinner">Caricamento Personaggi...</div>`;

  try {
    const res = await fetch('/api/trainers');
    allTrainers = await res.json();
    renderTrainers(allTrainers);
    fetchStats();
  } catch (e) {
    grid.innerHTML = `<div class="loading-spinner" style="color:#ef4444;">Errore nel caricamento dei personaggi.</div>`;
  }
}

function renderTrainers(list) {
  const grid = document.getElementById('trainersGrid');
  const countText = document.getElementById('trainersCountText');
  countText.textContent = `Hai creato ${list.length} Personaggi`;

  if (list.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 2px dashed var(--border-subtle);">
        <h3 style="font-size: 1.3rem; margin-bottom: 0.5rem;">Nessun Personaggio Allenatore Creato</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">
          Crea la tua scheda personaggio Allenatore distribuendo i punti attributo e le competenze secondo il manuale di Pokérole.
        </p>
        <button type="button" class="primary-btn" onclick="openTrainerModal()">
          <span>+ Crea il tuo primo Allenatore</span>
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(t => {
    const teamSlots = t.team || [];
    return `
      <div class="trainer-card">
        <div class="trainer-card-header">
          <div class="trainer-avatar">🧢</div>
          <div class="trainer-title-wrap">
            <h3>${t.name}</h3>
            <div class="trainer-concept-tag">${t.concept || 'Allenatore'} • Età: ${t.age || 14}</div>
          </div>
          <span class="rank-badge">${t.rank || 'Starter'}</span>
        </div>

        <div class="trainer-quick-stats">
          <div class="tqs-item"><small>HP</small><strong style="color:#10b981;">${t.hp}</strong></div>
          <div class="tqs-item"><small>Volontà</small><strong style="color:#38bdf8;">${t.will_points}</strong></div>
          <div class="tqs-item"><small>Denaro</small><strong style="color:#f59e0b;">$${t.money}</strong></div>
        </div>

        <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom: 0.5rem;">
          Natura: <strong>${t.nature || 'Hardy'}</strong> | Forza ${t.strength} • Destr. ${t.dexterity} • Vit. ${t.vitality} • Int. ${t.insight}
        </div>

        <!-- Team Miniatures -->
        <div class="trainer-team-preview">
          <div class="trainer-team-title">
            <span>Squadra Pokémon (${teamSlots.length}/6)</span>
            <a href="javascript:void(0)" onclick="openCustomPokeModal(null, ${t.id})" style="color:var(--accent-red-hover); text-decoration:none;">+ Aggiungi</a>
          </div>
          <div class="team-miniatures-row">
            ${teamSlots.map(p => `
              <div class="team-mini-slot" title="${p.nickname} (${p.species_name})" onclick="viewCustomPokeSheet(${p.id})">
                <img src="${getSpriteUrl(p.image)}" alt="${p.species_name}">
              </div>
            `).join('')}
            ${Array.from({ length: Math.max(0, 6 - teamSlots.length) }).map(() => `
              <div class="team-mini-slot team-mini-empty" onclick="openCustomPokeModal(null, ${t.id})" title="Aggiungi Pokémon">+</div>
            `).join('')}
          </div>
        </div>

        <div class="card-actions-row">
          <button type="button" class="secondary-btn" onclick="viewTrainerSheet(${t.id})">Visualizza Scheda</button>
          <button type="button" class="secondary-btn" onclick="openTrainerModal(${t.id})">Modifica</button>
          <button type="button" class="btn-delete" onclick="deleteTrainer(${t.id})">Elimina</button>
        </div>
      </div>
    `;
  }).join('');
}

function initTrainerSkillsInputs() {
  const container = document.getElementById('trainerSkillsInputs');
  if (!container) return;

  let html = '';
  for (const [category, skills] of Object.entries(POKEROLE_SKILLS)) {
    html += `
      <div class="skill-category-box">
        <div class="skill-category-title">${category}</div>
        ${skills.map(sk => `
          <div class="skill-row">
            <span>${sk}</span>
            <select id="skill_${sk}" onchange="updateTrainerDerivedStats()">
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>
        `).join('')}
      </div>
    `;
  }
  container.innerHTML = html;
}

function renderStepperDots(id, val, max = 5) {
  const container = document.getElementById(`dots_${id}`);
  if (!container) return;
  let html = '';
  for (let i = 1; i <= max; i++) {
    html += `<div class="dot ${i <= val ? 'base' : ''}"></div>`;
  }
  container.innerHTML = html;
}

function stepStat(id, delta, min = 1, max = 5) {
  const input = document.getElementById(id);
  let val = parseInt(input.value, 10) + delta;
  if (val < min) val = min;
  if (val > max) val = max;
  input.value = val;
  const valDisplay = document.getElementById(`val_${id}`);
  if (valDisplay) valDisplay.textContent = val;
  renderStepperDots(id, val, max);
  updateTrainerDerivedStats();
}

function updateTrainerDerivedStats() {
  const vitality = parseInt(document.getElementById('trVitality')?.value || 1, 10);
  const insight = parseInt(document.getElementById('trInsight')?.value || 1, 10);
  const dexterity = parseInt(document.getElementById('trDexterity')?.value || 1, 10);

  // Health Points (Humans: 5 base + Vitality)
  const hp = 5 + vitality;
  const hpEl = document.getElementById('trDerivedHp');
  if (hpEl) hpEl.textContent = hp;

  // Nature Confidence
  const natureName = document.getElementById('trNature')?.value;
  const nat = allNatures.find(n => n.Name === natureName);
  const confidence = nat ? nat.Confidence : 0;
  const will = insight + confidence + 2;
  const willEl = document.getElementById('trDerivedWill');
  if (willEl) willEl.textContent = will;

  // Initiative = Dexterity + Alert skill
  const alertSkill = parseInt(document.getElementById('skill_Alert')?.value || 0, 10);
  const initEl = document.getElementById('trDerivedInit');
  if (initEl) initEl.textContent = dexterity + alertSkill;

  // Defense = Vitality + Evasion
  const evasionSkill = parseInt(document.getElementById('skill_Evasion')?.value || 0, 10);
  const defEl = document.getElementById('trDerivedDef');
  if (defEl) defEl.textContent = vitality + evasionSkill;

  // Special Defense = Insight + Alert
  const spDefEl = document.getElementById('trDerivedSpDef');
  if (spDefEl) spDefEl.textContent = insight + alertSkill;
}

async function openTrainerModal(trainerId = null) {
  const modal = document.getElementById('trainerModal');
  const title = document.getElementById('trainerModalTitle');
  const form = document.getElementById('trainerForm');
  form.reset();

  const statFields = ['trStrength', 'trDexterity', 'trVitality', 'trInsight', 'trTough', 'trBeauty', 'trCool', 'trCute', 'trClever'];
  statFields.forEach(f => {
    document.getElementById(f).value = 1;
    document.getElementById(`val_${f}`).textContent = '1';
    renderStepperDots(f, 1, 5);
  });

  for (const cat in POKEROLE_SKILLS) {
    POKEROLE_SKILLS[cat].forEach(sk => {
      const el = document.getElementById(`skill_${sk}`);
      if (el) el.value = 0;
    });
  }

  if (trainerId) {
    title.textContent = 'Modifica Scheda Allenatore';
    document.getElementById('trId').value = trainerId;
    try {
      const res = await fetch(`/api/trainers/${trainerId}`);
      const t = await res.json();
      document.getElementById('trName').value = t.name;
      document.getElementById('trConcept').value = t.concept || '';
      document.getElementById('trAge').value = t.age || 14;
      document.getElementById('trNature').value = t.nature || 'Hardy';
      document.getElementById('trRank').value = t.rank || 'Starter';
      document.getElementById('trMoney').value = t.money || 1500;
      document.getElementById('trInventory').value = t.inventory || '';
      document.getElementById('trNotes').value = t.notes || '';

      statFields.forEach(f => {
        const prop = f.replace('tr', '').toLowerCase();
        const val = t[prop] || 1;
        document.getElementById(f).value = val;
        document.getElementById(`val_${f}`).textContent = val;
        renderStepperDots(f, val, 5);
      });

      if (t.skills) {
        for (const [sk, val] of Object.entries(t.skills)) {
          const el = document.getElementById(`skill_${sk}`);
          if (el) el.value = val;
        }
      }
    } catch (e) {
      console.error(e);
    }
  } else {
    title.textContent = 'Crea Nuovo Personaggio Allenatore';
    document.getElementById('trId').value = '';
    document.getElementById('trMoney').value = 1500;
    document.getElementById('trInventory').value = '5x Poké Ball, 2x Pozione, Pokedex, Zaino da viaggio';
  }

  updateTrainerDerivedStats();
  modal.classList.add('open');
}

function closeTrainerModal(e) {
  if (e && e.target !== document.getElementById('trainerModal') && !e.target.classList.contains('modal-close')) {
    return;
  }
  document.getElementById('trainerModal').classList.remove('open');
}

async function saveTrainer(e) {
  e.preventDefault();
  const id = document.getElementById('trId').value;
  const isEdit = !!id;

  const skills = {};
  for (const cat in POKEROLE_SKILLS) {
    POKEROLE_SKILLS[cat].forEach(sk => {
      const val = parseInt(document.getElementById(`skill_${sk}`)?.value || 0, 10);
      if (val > 0) skills[sk] = val;
    });
  }

  const payload = {
    name: document.getElementById('trName').value.trim(),
    concept: document.getElementById('trConcept').value.trim(),
    age: parseInt(document.getElementById('trAge').value, 10) || 14,
    nature: document.getElementById('trNature').value,
    rank: document.getElementById('trRank').value,
    money: parseInt(document.getElementById('trMoney').value, 10) || 1500,
    inventory: document.getElementById('trInventory').value.trim(),
    notes: document.getElementById('trNotes').value.trim(),
    strength: parseInt(document.getElementById('trStrength').value, 10),
    dexterity: parseInt(document.getElementById('trDexterity').value, 10),
    vitality: parseInt(document.getElementById('trVitality').value, 10),
    insight: parseInt(document.getElementById('trInsight').value, 10),
    tough: parseInt(document.getElementById('trTough').value, 10),
    beauty: parseInt(document.getElementById('trBeauty').value, 10),
    cool: parseInt(document.getElementById('trCool').value, 10),
    cute: parseInt(document.getElementById('trCute').value, 10),
    clever: parseInt(document.getElementById('trClever').value, 10),
    skills: skills
  };

  try {
    const url = isEdit ? `/api/trainers/${id}` : '/api/trainers';
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to save trainer');
    closeTrainerModal();
    loadTrainers();
  } catch (err) {
    alert('Errore nel salvataggio: ' + err.message);
  }
}

async function deleteTrainer(id) {
  if (!confirm('Sei sicuro di voler eliminare questo Allenatore? I suoi Pokémon diventeranno liberi.')) return;
  try {
    const res = await fetch(`/api/trainers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    loadTrainers();
  } catch (e) {
    alert('Errore: ' + e.message);
  }
}

async function viewTrainerSheet(trainerId) {
  const modal = document.getElementById('trainerSheetModal');
  const body = document.getElementById('trainerSheetContent');
  modal.classList.add('open');
  body.innerHTML = `<div class="loading-spinner">Caricamento scheda personaggio...</div>`;

  try {
    const res = await fetch(`/api/trainers/${trainerId}`);
    const t = await res.json();

    const renderDots = (val, max = 5) => {
      let h = '';
      for (let i = 1; i <= max; i++) {
        h += `<div class="dot ${i <= val ? 'base' : ''}"></div>`;
      }
      return h;
    };

    body.innerHTML = `
      <div class="sheet-header">
        <div class="trainer-avatar" style="width:80px; height:80px; font-size:2.5rem;">🧢</div>
        <div class="sheet-title-info">
          <div class="sheet-dex-num">Scheda Personaggio Allenatore • Rango: ${t.rank}</div>
          <h1 class="sheet-name">${t.name}</h1>
          <div class="sheet-category">${t.concept || 'Allenatore'} • Età: ${t.age} anni • Natura: ${t.nature}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.4rem;">
            Patrimonio: <strong style="color:#f59e0b;">$${t.money}</strong> | Zaino: <em>${t.inventory || 'Vuoto'}</em>
          </div>
        </div>
      </div>

      <div class="hp-rank-banner">
        <div class="hp-calculation">
          <div><small style="color:var(--text-dim); display:block; font-size:0.75rem;">Punti Vita</small><span class="hp-number">${t.hp}</span></div>
          <div><small style="color:var(--text-dim); display:block; font-size:0.75rem;">Punti Volontà</small><span class="hp-number" style="color:#38bdf8;">${t.will_points}</span></div>
          <div><small style="color:var(--text-dim); display:block; font-size:0.75rem;">Iniziativa</small><span class="hp-number" style="color:#f59e0b;">${t.dexterity + (t.skills?.Alert || 0)}</span></div>
          <div><small style="color:var(--text-dim); display:block; font-size:0.75rem;">Difesa</small><span class="hp-number" style="color:#a78bfa;">${t.vitality + (t.skills?.Evasion || 0)}</span></div>
        </div>
      </div>

      <h3 class="sheet-section-title">Attributi Principali</h3>
      <div class="attributes-grid">
        <div class="attr-box"><div class="attr-box-header"><span class="attr-name">Forza</span><span class="attr-val">${t.strength}/5</span></div><div class="dot-track">${renderDots(t.strength, 5)}</div></div>
        <div class="attr-box"><div class="attr-box-header"><span class="attr-name">Destrezza</span><span class="attr-val">${t.dexterity}/5</span></div><div class="dot-track">${renderDots(t.dexterity, 5)}</div></div>
        <div class="attr-box"><div class="attr-box-header"><span class="attr-name">Vitalità</span><span class="attr-val">${t.vitality}/5</span></div><div class="dot-track">${renderDots(t.vitality, 5)}</div></div>
        <div class="attr-box"><div class="attr-box-header"><span class="attr-name">Intuito</span><span class="attr-val">${t.insight}/5</span></div><div class="dot-track">${renderDots(t.insight, 5)}</div></div>
      </div>

      <h3 class="sheet-section-title">Attributi Sociali</h3>
      <div class="attributes-grid">
        <div class="attr-box"><div class="attr-box-header"><span class="attr-name">Tough</span><span class="attr-val">${t.tough}/5</span></div><div class="dot-track">${renderDots(t.tough, 5)}</div></div>
        <div class="attr-box"><div class="attr-box-header"><span class="attr-name">Beauty</span><span class="attr-val">${t.beauty}/5</span></div><div class="dot-track">${renderDots(t.beauty, 5)}</div></div>
        <div class="attr-box"><div class="attr-box-header"><span class="attr-name">Cool</span><span class="attr-val">${t.cool}/5</span></div><div class="dot-track">${renderDots(t.cool, 5)}</div></div>
        <div class="attr-box"><div class="attr-box-header"><span class="attr-name">Cute</span><span class="attr-val">${t.cute}/5</span></div><div class="dot-track">${renderDots(t.cute, 5)}</div></div>
        <div class="attr-box"><div class="attr-box-header"><span class="attr-name">Clever</span><span class="attr-val">${t.clever}/5</span></div><div class="dot-track">${renderDots(t.clever, 5)}</div></div>
      </div>

      <h3 class="sheet-section-title">Competenze (Skills)</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem;">
        ${t.skills && Object.keys(t.skills).length > 0 ? Object.entries(t.skills).map(([k, v]) => `
          <div class="rank-badge" style="padding: 0.35rem 0.75rem; font-size: 0.82rem;">
            <strong>${k}</strong>: ${v} punti
          </div>
        `).join('') : '<span style="color:var(--text-dim); font-size:0.85rem;">Nessuna abilità assegnata.</span>'}
      </div>

      <h3 class="sheet-section-title">Squadra Pokémon (${t.team ? t.team.length : 0}/6)</h3>
      <div class="custom-pokemon-grid" style="margin-bottom: 1rem;">
        ${t.team && t.team.length > 0 ? t.team.map(p => `
          <div class="custom-poke-card" style="cursor:pointer;" onclick="closeTrainerSheetModal(); viewCustomPokeSheet(${p.id})">
            <div class="c-poke-header">
              <div class="c-poke-sprite"><img src="${getSpriteUrl(p.image)}" alt="${p.species_name}"></div>
              <div class="c-poke-info">
                <div class="c-poke-nickname">${p.nickname}</div>
                <div class="c-poke-species">${p.species_name} • Rango ${p.rank}</div>
                <div class="types-row" style="margin: 0.2rem 0;">
                  <span class="type-pill type-${p.type1}">${p.type1}</span>
                  ${p.type2 ? `<span class="type-pill type-${p.type2}">${p.type2}</span>` : ''}
                </div>
              </div>
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted);">
              HP: <strong style="color:#10b981;">${p.hp}</strong> | Abilità: <strong>${p.ability}</strong> | Mosse: <strong>${p.moves ? p.moves.length : 0}</strong>
            </div>
          </div>
        `).join('') : `
          <div style="grid-column: 1/-1; color:var(--text-dim); font-size:0.85rem; padding: 1rem; background:var(--bg-card); border-radius:var(--radius-sm);">
            Nessun Pokémon in squadra. Clicca su "+ Aggiungi Pokémon" per creare o assegnare Pokémon a questo allenatore.
          </div>
        `}
      </div>

      ${t.notes ? `
        <h3 class="sheet-section-title">Note & Background</h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; line-height: 1.5;">"${t.notes}"</p>
      ` : ''}
    `;
  } catch (e) {
    body.innerHTML = `<div class="loading-spinner" style="color:#ef4444;">Errore: ${e.message}</div>`;
  }
}

function closeTrainerSheetModal() {
  document.getElementById('trainerSheetModal').classList.remove('open');
}

// ----------------- CUSTOM POKÉMON LOGIC -----------------

async function loadCustomPokemon() {
  const grid = document.getElementById('customPokemonGrid');
  grid.innerHTML = `<div class="loading-spinner">Caricamento Pokémon del team...</div>`;

  try {
    const res = await fetch('/api/custom-pokemon');
    allCustomPokemon = await res.json();
    renderCustomPokemon(allCustomPokemon);
    fetchStats();
  } catch (e) {
    grid.innerHTML = `<div class="loading-spinner" style="color:#ef4444;">Errore nel caricamento dei Pokémon.</div>`;
  }
}

function renderCustomPokemon(list) {
  const grid = document.getElementById('customPokemonGrid');
  const countText = document.getElementById('customPokeCountText');
  countText.textContent = `Hai creato ${list.length} Pokémon`;

  if (list.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: var(--bg-card); border-radius: var(--radius-lg); border: 2px dashed var(--border-subtle);">
        <h3 style="font-size: 1.3rem; margin-bottom: 0.5rem;">Nessun Pokémon Creato</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">
          Crea Pokémon personalizzati scegliendo tra tutte le 1.200 specie, assegnando statistiche, abilità e mosse di combattimento.
        </p>
        <button type="button" class="primary-btn" onclick="openCustomPokeModal()">
          <span>+ Crea il tuo primo Pokémon</span>
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(p => {
    const moves = p.moves || [];
    return `
      <div class="custom-poke-card">
        <div class="c-poke-header">
          <div class="c-poke-sprite">
            <img src="${getSpriteUrl(p.image)}" alt="${p.species_name}" onerror="this.src='/images/BookSprites/${p.image}'">
          </div>
          <div class="c-poke-info">
            <div class="c-poke-nickname">${p.nickname}</div>
            <div class="c-poke-species">${p.species_name} • Rango ${p.rank} • ${p.nature}</div>
            <div class="types-row" style="margin: 0.3rem 0;">
              <span class="type-pill type-${p.type1}">${p.type1}</span>
              ${p.type2 ? `<span class="type-pill type-${p.type2}">${p.type2}</span>` : ''}
              <span class="badge-tag" style="background:var(--bg-elevated);">${p.gender === 'M' ? '♂' : p.gender === 'F' ? '♀' : '⚲'}</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-dim);">
              ${p.trainer_name ? `Allenatore: <strong style="color:var(--text-main);">${p.trainer_name}</strong>` : '<span style="font-style:italic;">Libero / Selvatico</span>'}
            </div>
          </div>
        </div>

        <div class="trainer-quick-stats">
          <div class="tqs-item"><small>Punti Vita</small><strong style="color:#10b981;">${p.hp} HP</strong></div>
          <div class="tqs-item"><small>Abilità</small><strong style="font-size:0.8rem;" title="${p.ability_effect || ''}">${p.ability}</strong></div>
          <div class="tqs-item"><small>Strumento</small><strong style="font-size:0.8rem;">${p.held_item || 'Nessuno'}</strong></div>
        </div>

        <div style="font-size:0.72rem; color:var(--text-muted); display:flex; justify-content:space-between; margin-bottom: 0.5rem; background:rgba(0,0,0,0.2); padding:0.35rem; border-radius:var(--radius-sm);">
          <span>Str: <strong>${p.strength}</strong>/${p.max_strength}</span>
          <span>Dex: <strong>${p.dexterity}</strong>/${p.max_dexterity}</span>
          <span>Vit: <strong>${p.vitality}</strong>/${p.max_vitality}</span>
          <span>Spe: <strong>${p.special}</strong>/${p.max_special}</span>
          <span>Ins: <strong>${p.insight}</strong>/${p.max_insight}</span>
        </div>

        <!-- Moves Preview -->
        <div style="margin-bottom: 0.75rem;">
          <div style="font-size:0.72rem; text-transform:uppercase; color:var(--text-dim); font-weight:700; margin-bottom:0.3rem;">
            Mosse Equipaggiate (${moves.length}/6)
          </div>
          <div class="c-poke-moves-list">
            ${moves.map(m => `
              <div class="c-poke-move-chip">
                <span><strong>${m.Name}</strong></span>
                <div style="display:flex; gap:0.3rem;">
                  <span class="type-pill type-${m.Type}" style="font-size:0.65rem; padding:0.1rem 0.4rem;">${m.Type}</span>
                  <span style="font-family:var(--font-mono); font-weight:700;">Pot. ${m.Power ?? '-'}</span>
                </div>
              </div>
            `).join('')}
            ${moves.length === 0 ? '<span style="color:var(--text-dim); font-size:0.75rem;">Nessuna mossa assegnata.</span>' : ''}
          </div>
        </div>

        <div class="card-actions-row">
          <button type="button" class="secondary-btn" onclick="viewCustomPokeSheet(${p.id})">Scheda Completa</button>
          <button type="button" class="secondary-btn" onclick="openCustomPokeModal(${p.id})">Modifica</button>
          <button type="button" class="btn-delete" onclick="deleteCustomPokemon(${p.id})">Elimina</button>
        </div>
      </div>
    `;
  }).join('');
}

async function openCustomPokeModal(pokeId = null, preselectedTrainerId = null, preselectedSpeciesId = null) {
  const modal = document.getElementById('customPokeModal');
  const title = document.getElementById('customPokeModalTitle');
  const form = document.getElementById('customPokeForm');
  form.reset();

  currentEquippedMoves = [];
  renderEquippedMovesList();

  // Populate Trainer Select
  try {
    const res = await fetch('/api/trainers');
    const trainers = await res.json();
    const trSelect = document.getElementById('cpTrainer');
    trSelect.innerHTML = `<option value="">-- Nessun Allenatore (Libero / Selvatico) --</option>` +
      trainers.map(t => `<option value="${t.id}">${t.name} (${t.rank})</option>`).join('');
  } catch (e) {}

  if (pokeId) {
    title.textContent = 'Modifica Pokémon Personalizzato';
    document.getElementById('cpId').value = pokeId;
    try {
      const res = await fetch(`/api/custom-pokemon/${pokeId}`);
      const p = await res.json();

      document.getElementById('cpSpeciesSearch').value = p.species_name;
      await onSpeciesSelected(p.species_id || p.species_name);

      document.getElementById('cpNickname').value = p.nickname;
      document.getElementById('cpGender').value = p.gender;
      document.getElementById('cpNature').value = p.nature;
      document.getElementById('cpRank').value = p.rank;
      document.getElementById('cpTrainer').value = p.trainer_id || '';
      document.getElementById('cpItem').value = p.held_item || '';
      document.getElementById('cpNotes').value = p.notes || '';

      ['Strength', 'Dexterity', 'Vitality', 'Special', 'Insight'].forEach(st => {
        const val = p[st.toLowerCase()] || 1;
        document.getElementById(`cp${st}`).value = val;
        renderPokeStepperDots(`cp${st}`, val, p[`max_${st.toLowerCase()}`] || 5);
      });

      document.getElementById('cpAbilitySelect').value = p.ability;
      onAbilitySelectChanged(p.ability);

      currentEquippedMoves = p.moves || [];
      renderEquippedMovesList();
    } catch (e) {
      console.error(e);
    }
  } else {
    title.textContent = 'Crea Nuovo Pokémon';
    document.getElementById('cpId').value = '';
    if (preselectedTrainerId) {
      document.getElementById('cpTrainer').value = preselectedTrainerId;
    }
    const defaultSpecies = preselectedSpeciesId || (allPokemon[0] ? allPokemon[0]._id : 'pikachu');
    const defaultPoke = allPokemon.find(p => p._id === defaultSpecies) || allPokemon[0];
    if (defaultPoke) {
      document.getElementById('cpSpeciesSearch').value = defaultPoke.Name;
      await onSpeciesSelected(defaultPoke._id);
    }
  }

  updateCustomPokeCalculations();
  modal.classList.add('open');
}

function closeCustomPokeModal(e) {
  if (e && e.target !== document.getElementById('customPokeModal') && !e.target.classList.contains('modal-close')) {
    return;
  }
  document.getElementById('customPokeModal').classList.remove('open');
}

async function onSpeciesSelected(speciesInput) {
  if (!speciesInput) return;
  const match = allPokemon.find(p => p.Name.toLowerCase() === speciesInput.toLowerCase() || p._id === speciesInput.toLowerCase());
  const speciesId = match ? match._id : speciesInput.toLowerCase().replace(/[^a-z0-9]/g, '-');

  try {
    const res = await fetch(`/api/species-info/${speciesId}`);
    if (!res.ok) return;
    const spec = await res.json();
    currentSpeciesInfo = spec;

    document.getElementById('cpImage').value = spec.Image || '';
    document.getElementById('cpSpritePreview').src = getSpriteUrl(spec.Image);
    document.getElementById('cpBaseHp').value = spec.BaseHP;
    document.getElementById('cpBaseHpDisplay').textContent = spec.BaseHP;

    document.getElementById('cpSpeciesTraits').innerHTML = `
      <span class="type-pill type-${spec.Type1}">${spec.Type1}</span>
      ${spec.Type2 ? `<span class="type-pill type-${spec.Type2}">${spec.Type2}</span>` : ''}
      <span class="rank-badge">Rango Consigliato: ${spec.RecommendedRank}</span>
      <span>HP Base: <strong>${spec.BaseHP}</strong></span>
    `;

    // Set stat steppers to species defaults
    const stats = ['Strength', 'Dexterity', 'Vitality', 'Special', 'Insight'];
    stats.forEach(st => {
      const baseVal = spec[st] || 1;
      const maxVal = spec[`Max${st}`] || 5;
      document.getElementById(`cp${st}`).value = baseVal;
      document.getElementById(`cpMax${st}`).value = maxVal;
      renderPokeStepperDots(`cp${st}`, baseVal, maxVal);
    });

    // Populate Abilities Select
    const abSelect = document.getElementById('cpAbilitySelect');
    let abOptions = `<optgroup label="Abilità Naturali della Specie">`;
    spec.NaturalAbilities.forEach(a => {
      abOptions += `<option value="${a.Name}">${a.Name} - ${a.Effect || ''}</option>`;
    });
    abOptions += `</optgroup>`;

    // Also populate with all abilities
    if (allAbilities.length > 0) {
      abOptions += `<optgroup label="Altre Abilità">`;
      allAbilities.forEach(a => {
        abOptions += `<option value="${a.Name}">${a.Name}</option>`;
      });
      abOptions += `</optgroup>`;
    }
    abSelect.innerHTML = abOptions;
    if (spec.NaturalAbilities[0]) {
      onAbilitySelectChanged(spec.NaturalAbilities[0].Name);
    }

    // Populate Learnset select
    const learnSelect = document.getElementById('cpLearnsetSelect');
    learnSelect.innerHTML = `<option value="">-- Seleziona mossa appresa dalla specie --</option>` +
      spec.LearnsetMoves.map(m => `
        <option value="${m.Name}">[${m.Learned}] ${m.Name} (${m.Type} Pot.${m.Power ?? '-'})</option>
      `).join('');

    // Populate All Moves select if empty
    const allMovesSelect = document.getElementById('cpAllMovesSelect');
    if (allMovesSelect && allMovesSelect.children.length <= 1) {
      if (allMoves.length === 0) await loadMoves();
      allMovesSelect.innerHTML = `<option value="">-- Cerca qualsiasi mossa --</option>` +
        allMoves.map(m => `<option value="${m.Name}">${m.Name} (${m.Type} ${m.Category} Pot.${m.Power ?? '-'})</option>`).join('');
    }

    updateCustomPokeCalculations();
  } catch (e) {
    console.error('Species fetch error:', e);
  }
}

function renderPokeStepperDots(id, val, max = 5) {
  const container = document.getElementById(`dots_${id}`);
  const valLabel = document.getElementById(`val_${id}`);
  if (valLabel) valLabel.textContent = `${val} / ${max}`;
  if (!container) return;
  let html = '';
  for (let i = 1; i <= max; i++) {
    html += `<div class="dot ${i <= val ? 'base' : ''}"></div>`;
  }
  container.innerHTML = html;
}

function stepPokeStat(statKey, delta) {
  const input = document.getElementById(statKey);
  const maxInput = document.getElementById(`cpMax${statKey.replace('cp', '')}`);
  const max = maxInput ? parseInt(maxInput.value, 10) : 5;
  let val = parseInt(input.value, 10) + delta;
  if (val < 1) val = 1;
  if (val > max) val = max;
  input.value = val;
  renderPokeStepperDots(statKey, val, max);
  updateCustomPokeCalculations();
}

function updateCustomPokeCalculations() {
  const baseHp = parseInt(document.getElementById('cpBaseHp')?.value || 4, 10);
  const vitality = parseInt(document.getElementById('cpVitality')?.value || 1, 10);
  const rank = document.getElementById('cpRank')?.value || 'Starter';

  const ranksMult = { 'Starter': 1, 'Rookie': 2, 'Standard': 3, 'Advanced': 4, 'Expert': 5, 'Master': 6, 'Champion': 7 };
  const mult = ranksMult[rank] || 1;
  const hp = baseHp + (vitality * mult);

  const hpEl = document.getElementById('cpCalculatedHp');
  if (hpEl) hpEl.textContent = hp;
  const vitEl = document.getElementById('cpVitDisplay');
  if (vitEl) vitEl.textContent = vitality;
  const multEl = document.getElementById('cpRankMultDisplay');
  if (multEl) multEl.textContent = mult;
}

function onAbilitySelectChanged(abilityName) {
  document.getElementById('cpAbilityName').value = abilityName;
  let effectText = 'Nessun effetto specificato.';

  if (currentSpeciesInfo && currentSpeciesInfo.NaturalAbilities) {
    const natural = currentSpeciesInfo.NaturalAbilities.find(a => a.Name === abilityName);
    if (natural) effectText = natural.Effect || natural.Description || effectText;
  }
  if (allAbilities.length > 0) {
    const ab = allAbilities.find(a => a.Name === abilityName);
    if (ab) effectText = ab.Effect || ab.Description || effectText;
  }

  document.getElementById('cpAbilityEffect').value = effectText;
  document.getElementById('cpAbilityEffectText').textContent = effectText;
}

function addMoveFromSelect(selectId) {
  const select = document.getElementById(selectId);
  const moveName = select.value;
  if (!moveName) return;

  if (currentEquippedMoves.length >= 6) {
    alert('Un Pokémon può avere al massimo 6 mosse di combattimento equipaggiate.');
    select.value = '';
    return;
  }

  if (currentEquippedMoves.some(m => m.Name.toLowerCase() === moveName.toLowerCase())) {
    alert('Questa mossa è già presente tra quelle equipaggiate.');
    select.value = '';
    return;
  }

  let moveObj = null;
  if (currentSpeciesInfo && currentSpeciesInfo.LearnsetMoves) {
    moveObj = currentSpeciesInfo.LearnsetMoves.find(m => m.Name.toLowerCase() === moveName.toLowerCase());
  }
  if (!moveObj && allMoves.length > 0) {
    moveObj = allMoves.find(m => m.Name.toLowerCase() === moveName.toLowerCase());
  }

  if (!moveObj) {
    moveObj = { Name: moveName, Type: 'Normal', Power: 2 };
  }

  currentEquippedMoves.push(moveObj);
  renderEquippedMovesList();
  select.value = '';
}

function removeEquippedMove(index) {
  currentEquippedMoves.splice(index, 1);
  renderEquippedMovesList();
}

function renderEquippedMovesList() {
  const container = document.getElementById('cpEquippedMovesList');
  if (!container) return;

  if (currentEquippedMoves.length === 0) {
    container.innerHTML = `<div class="empty-state">Nessuna mossa ancora equipaggiata. Aggiungi mosse dal Learnset o dall'elenco completo sotto.</div>`;
    return;
  }

  container.innerHTML = currentEquippedMoves.map((m, idx) => `
    <div class="equipped-move-item">
      <div class="move-item-info">
        <strong>${m.Name}</strong>
        <span class="type-pill type-${m.Type || 'Normal'}">${m.Type || 'Normal'}</span>
        ${m.Category ? `<span class="category-pill cat-${m.Category}">${m.Category}</span>` : ''}
        <span style="font-family:var(--font-mono); font-weight:700;">Pot. ${m.Power ?? '-'}</span>
        <span style="font-size:0.75rem; color:var(--text-dim);">${m.Damage1 ? `Danno: ${m.Damage1}` : ''} ${m.Accuracy1 ? `| Prec: ${m.Accuracy1}` : ''}</span>
      </div>
      <button type="button" class="btn-delete" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="removeEquippedMove(${idx})">Rimuovi</button>
    </div>
  `).join('');
}

async function saveCustomPokemon(e) {
  e.preventDefault();
  const id = document.getElementById('cpId').value;
  const isEdit = !!id;

  if (!currentSpeciesInfo) {
    alert('Per favore seleziona una specie valida.');
    return;
  }

  const baseHp = parseInt(document.getElementById('cpBaseHp').value, 10);
  const vitality = parseInt(document.getElementById('cpVitality').value, 10);
  const rank = document.getElementById('cpRank').value;
  const ranksMult = { 'Starter': 1, 'Rookie': 2, 'Standard': 3, 'Advanced': 4, 'Expert': 5, 'Master': 6, 'Champion': 7 };
  const mult = ranksMult[rank] || 1;
  const hp = baseHp + (vitality * mult);

  const payload = {
    species_id: currentSpeciesInfo._id,
    species_name: currentSpeciesInfo.Name,
    nickname: document.getElementById('cpNickname').value.trim() || currentSpeciesInfo.Name,
    type1: currentSpeciesInfo.Type1,
    type2: currentSpeciesInfo.Type2 || null,
    gender: document.getElementById('cpGender').value,
    nature: document.getElementById('cpNature').value,
    rank: rank,
    trainer_id: document.getElementById('cpTrainer').value || null,
    base_hp: baseHp,
    hp: hp,
    strength: parseInt(document.getElementById('cpStrength').value, 10),
    max_strength: parseInt(document.getElementById('cpMaxStrength').value, 10),
    dexterity: parseInt(document.getElementById('cpDexterity').value, 10),
    max_dexterity: parseInt(document.getElementById('cpMaxDexterity').value, 10),
    vitality: vitality,
    max_vitality: parseInt(document.getElementById('cpMaxVitality').value, 10),
    special: parseInt(document.getElementById('cpSpecial').value, 10),
    max_special: parseInt(document.getElementById('cpMaxSpecial').value, 10),
    insight: parseInt(document.getElementById('cpInsight').value, 10),
    max_insight: parseInt(document.getElementById('cpMaxInsight').value, 10),
    ability: document.getElementById('cpAbilityName').value,
    ability_effect: document.getElementById('cpAbilityEffect').value,
    moves: currentEquippedMoves,
    held_item: document.getElementById('cpItem').value.trim(),
    notes: document.getElementById('cpNotes').value.trim(),
    image: document.getElementById('cpImage').value || currentSpeciesInfo.Image
  };

  try {
    const url = isEdit ? `/api/custom-pokemon/${id}` : '/api/custom-pokemon';
    const method = isEdit ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to save pokemon');
    closeCustomPokeModal();
    loadCustomPokemon();
    loadTrainers(); // refresh trainer team counts
  } catch (err) {
    alert('Errore nel salvataggio: ' + err.message);
  }
}

async function deleteCustomPokemon(id) {
  if (!confirm('Sei sicuro di voler eliminare questo Pokémon?')) return;
  try {
    const res = await fetch(`/api/custom-pokemon/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    loadCustomPokemon();
    loadTrainers();
  } catch (e) {
    alert('Errore: ' + e.message);
  }
}

async function viewCustomPokeSheet(pokeId) {
  const modal = document.getElementById('trainerSheetModal');
  const body = document.getElementById('trainerSheetContent');
  modal.classList.add('open');
  body.innerHTML = `<div class="loading-spinner">Caricamento scheda Pokémon...</div>`;

  try {
    const res = await fetch(`/api/custom-pokemon/${pokeId}`);
    const p = await res.json();

    const renderDots = (base, max) => {
      let dotsHtml = '';
      for (let i = 1; i <= Math.max(max, 6); i++) {
        dotsHtml += `<div class="dot ${i <= base ? 'base' : i <= max ? 'max' : ''}"></div>`;
      }
      return dotsHtml;
    };

    body.innerHTML = `
      <div class="sheet-header">
        <div class="sheet-artwork">
          <img src="${getSpriteUrl(p.image)}" alt="${p.species_name}" data-sprite="${p.image}">
        </div>
        <div class="sheet-title-info">
          <div class="sheet-dex-num">Specie: ${p.species_name} • Rango: ${p.rank}</div>
          <h1 class="sheet-name">${p.nickname}</h1>
          <div class="sheet-category">Natura: <strong>${p.nature}</strong> • Genere: ${p.gender === 'M' ? 'Maschio (♂)' : p.gender === 'F' ? 'Femmina (♀)' : 'Senza genere'}</div>
          <div class="sheet-types-row" style="margin-top:0.4rem;">
            <span class="type-pill type-${p.type1}">${p.type1}</span>
            ${p.type2 ? `<span class="type-pill type-${p.type2}">${p.type2}</span>` : ''}
          </div>
          <div style="font-size:0.85rem; color:var(--text-muted); margin-top:0.4rem;">
            Allenatore: <strong style="color:var(--text-main);">${p.trainer_name || 'Nessuno (Selvatico/Libero)'}</strong> | Strumento: <strong>${p.held_item || 'Nessuno'}</strong>
          </div>
        </div>
      </div>

      <div class="hp-rank-banner">
        <div class="hp-calculation">
          <div><small style="color:var(--text-dim); display:block; font-size:0.75rem;">Punti Vita Totali</small><span class="hp-number">${p.hp} HP</span></div>
          <div style="font-size:0.85rem; color:var(--text-muted);">
            <span>Abilità: <strong style="color:var(--accent-red-hover);">${p.ability}</strong></span>
            <div style="font-size:0.8rem; margin-top:2px;">"${p.ability_effect || ''}"</div>
          </div>
        </div>
      </div>

      <h3 class="sheet-section-title">Attributi Pokémon (Tracciatore a Punti)</h3>
      <div class="attributes-grid">
        <div class="attr-box"><div class="attr-box-header"><span class="attr-name">Forza</span><span class="attr-val">${p.strength}/${p.max_strength}</span></div><div class="dot-track">${renderDots(p.strength, p.max_strength)}</div></div>
        <div class="attr-box"><div class="attr-box-header"><span class="attr-name">Destrezza</span><span class="attr-val">${p.dexterity}/${p.max_dexterity}</span></div><div class="dot-track">${renderDots(p.dexterity, p.max_dexterity)}</div></div>
        <div class="attr-box"><div class="attr-box-header"><span class="attr-name">Vitalità</span><span class="attr-val">${p.vitality}/${p.max_vitality}</span></div><div class="dot-track">${renderDots(p.vitality, p.max_vitality)}</div></div>
        <div class="attr-box"><div class="attr-box-header"><span class="attr-name">Speciale</span><span class="attr-val">${p.special}/${p.max_special}</span></div><div class="dot-track">${renderDots(p.special, p.max_special)}</div></div>
        <div class="attr-box"><div class="attr-box-header"><span class="attr-name">Intuito</span><span class="attr-val">${p.insight}/${p.max_insight}</span></div><div class="dot-track">${renderDots(p.insight, p.max_insight)}</div></div>
      </div>

      <h3 class="sheet-section-title">Mosse di Combattimento Equipaggiate (${p.moves ? p.moves.length : 0}/6)</h3>
      <div class="table-responsive">
        <table class="learnset-table">
          <thead>
            <tr>
              <th>Nome Mossa</th>
              <th>Tipo</th>
              <th>Cat.</th>
              <th>Potenza</th>
              <th>Danno</th>
              <th>Precisione</th>
              <th>Bersaglio</th>
              <th>Effetto</th>
            </tr>
          </thead>
          <tbody>
            ${p.moves && p.moves.length > 0 ? p.moves.map(m => `
              <tr style="cursor: pointer;" onclick="openMoveModalByName('${m.Name}')">
                <td><strong>${m.Name}</strong></td>
                <td><span class="type-pill type-${m.Type || 'Normal'}">${m.Type || 'Normal'}</span></td>
                <td>${m.Category ? `<span class="category-pill cat-${m.Category}">${m.Category}</span>` : '-'}</td>
                <td><span style="font-family:var(--font-mono); font-weight:700;">${m.Power ?? '-'}</span></td>
                <td><span style="font-size:0.75rem;">${m.Damage1 ? `${m.Damage1}${m.Damage2 ? ` + ${m.Damage2}` : ''}` : '-'}</span></td>
                <td><span style="font-size:0.75rem;">${m.Accuracy1 ? `${m.Accuracy1} + ${m.Accuracy2}` : '-'}</span></td>
                <td><span style="font-size:0.75rem;">${m.Target || '-'}</span></td>
                <td style="font-size:0.8rem; color:var(--text-muted); max-width:280px; white-space:normal;">${m.Effect || m.Description || '-'}</td>
              </tr>
            `).join('') : '<tr><td colspan="8" style="text-align:center; padding:1.5rem; color:var(--text-muted);">Nessuna mossa equipaggiata.</td></tr>'}
          </tbody>
        </table>
      </div>

      ${p.notes ? `
        <h3 class="sheet-section-title" style="margin-top:1.5rem;">Note Narrative</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); font-style:italic;">"${p.notes}"</p>
      ` : ''}
    `;
  } catch (e) {
    body.innerHTML = `<div class="loading-spinner" style="color:#ef4444;">Errore: ${e.message}</div>`;
  }
}

// ----------------- POKÉROLE DICE ROLLER -----------------

function adjustDice(fieldId, delta) {
  const input = document.getElementById(fieldId);
  const min = parseInt(input.min, 10);
  const max = parseInt(input.max, 10);
  let val = parseInt(input.value, 10) + delta;
  if (val < min) val = min;
  if (val > max) val = max;
  input.value = val;
}

function rollPokeDice() {
  triggerHaptic(40);
  const mainCount = parseInt(document.getElementById('mainDice').value, 10) || 1;
  const chanceCount = parseInt(document.getElementById('chanceDice').value, 10) || 0;
  const difficulty = parseInt(document.getElementById('difficulty').value, 10) || 1;

  const mainRolls = [];
  let successes = 0;
  let crits = 0;

  for (let i = 0; i < mainCount; i++) {
    const val = Math.floor(Math.random() * 6) + 1;
    mainRolls.push(val);
    if (val >= 4) successes++;
    if (val === 6) crits++;
  }

  const chanceRolls = [];
  let chanceBotches = 0;
  for (let i = 0; i < chanceCount; i++) {
    const val = Math.floor(Math.random() * 6) + 1;
    chanceRolls.push(val);
    if (val >= 4) successes++;
    if (val === 6) crits++;
    if (val === 1) chanceBotches++;
  }

  const isSuccess = successes >= difficulty;
  const resultBox = document.getElementById('diceResultBox');
  resultBox.style.display = 'block';

  resultBox.className = 'dice-result-box';
  resultBox.innerHTML = `
    <div class="dice-result-status ${isSuccess ? 'status-success' : 'status-fail'}">
      ${isSuccess ? '✓ PROVA SUPERATA!' : '✗ PROVA FALLITA'}
      <span style="font-size: 1.1rem; font-weight: 500; color: var(--text-muted); margin-left: 0.5rem;">
        (${successes} successi su ${difficulty} richiesti)
      </span>
    </div>

    ${chanceBotches > 0 ? `
      <div style="color: #ef4444; font-weight: 700; font-size: 0.9rem; margin-bottom: 0.5rem;">
        ⚠️ COMPLICAZIONE! ${chanceBotches} dado/i Chance hanno ottenuto 1!
      </div>
    ` : ''}

    ${crits > 0 ? `
      <div style="color: #34d399; font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem;">
        ⭐ COLPO ECCELLENTE! ${crits} dado/i hanno ottenuto un 6 perfetto!
      </div>
    ` : ''}

    <div style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-dim); margin-top: 1rem;">Dadi Principali (${mainCount}d6):</div>
    <div class="dice-visual-pool">
      ${mainRolls.map(v => `
        <div class="d6-die ${v === 6 ? 'crit' : v >= 4 ? 'success' : ''}">${v}</div>
      `).join('')}
    </div>

    ${chanceCount > 0 ? `
      <div style="font-size: 0.8rem; text-transform: uppercase; color: #f87171; margin-top: 0.75rem;">Dadi Rischio / Chance (${chanceCount}d6):</div>
      <div class="dice-visual-pool">
        ${chanceRolls.map(v => `
          <div class="d6-die ${v === 1 ? 'chance-botch' : v === 6 ? 'crit' : v >= 4 ? 'success' : ''}">${v}</div>
        `).join('')}
      </div>
    ` : ''}
  `;

  addDiceHistory({
    mainCount,
    chanceCount,
    difficulty,
    successes,
    isSuccess,
    chanceBotches,
    time: new Date().toLocaleTimeString()
  });
}

function addDiceHistory(entry) {
  diceHistory.unshift(entry);
  const list = document.getElementById('diceHistoryList');
  list.innerHTML = diceHistory.slice(0, 20).map(e => `
    <div class="history-item ${e.isSuccess ? 'pass' : 'fail'}">
      <div style="display: flex; justify-content: space-between; font-weight: 600;">
        <span>${e.isSuccess ? 'Superata' : 'Fallita'} (${e.successes}/${e.difficulty} diff.)</span>
        <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim);">${e.time}</span>
      </div>
      <div style="color: var(--text-muted); font-size: 0.78rem;">
        Lancio: ${e.mainCount} Dadi ${e.chanceCount > 0 ? `+ ${e.chanceCount} Rischio` : ''} ${e.chanceBotches > 0 ? '• ⚠️ Complicanza' : ''}
      </div>
    </div>
  `).join('');
}

function clearDiceHistory() {
  diceHistory = [];
  document.getElementById('diceHistoryList').innerHTML = `<div class="empty-state">Cronologia cancellata.</div>`;
}


// ========================================================
// PWA & ANDROID WI-FI NETWORK MODAL LOGIC
// ========================================================

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('SW registration skipped or error:', err);
    });
  });
}

// PWA Install prompt
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('pwaInstallBtn');
  if (btn) btn.style.display = 'inline-flex';
});

function installPwaApp() {
  triggerHaptic(25);
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null;
      const btn = document.getElementById('pwaInstallBtn');
      if (btn) btn.style.display = 'none';
    });
  }
}

// Wi-Fi Phone Connect Modal
let currentLanUrl = '';

async function openNetworkModal() {
  triggerHaptic(15);
  const modal = document.getElementById('networkModal');
  const linkEl = document.getElementById('lanUrlLink');
  const qrBox = document.getElementById('qrCodeBox');
  modal.classList.add('open');

  try {
    const res = await fetch('/api/network-info');
    const info = await res.json();
    currentLanUrl = info.url;
    linkEl.textContent = info.url;
    linkEl.href = info.url;

    // Render simple QR code SVG using lightweight generator
    qrBox.innerHTML = generateQrSvg(info.url);
  } catch (err) {
    linkEl.textContent = window.location.origin;
    linkEl.href = window.location.origin;
    currentLanUrl = window.location.origin;
    qrBox.innerHTML = generateQrSvg(window.location.origin);
  }
}

function closeNetworkModal(e) {
  if (e && e.target !== document.getElementById('networkModal') && !e.target.classList.contains('modal-close')) {
    return;
  }
  document.getElementById('networkModal').classList.remove('open');
}

function copyLanUrl() {
  triggerHaptic(20);
  if (!currentLanUrl) return;
  navigator.clipboard.writeText(currentLanUrl).then(() => {
    alert('Link copiato negli appunti! Invialo via WhatsApp o incollalo su Chrome del telefono.');
  }).catch(() => {
    alert('Indirizzo: ' + currentLanUrl);
  });
}

// Simple embedded QR Code generator (SVG) without external dependencies
function generateQrSvg(text) {
  // Use Google chart / SVG QR API or fallback high-contrast visual matrix
  const encoded = encodeURIComponent(text);
  return `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encoded}&bgcolor=ffffff&color=000000&margin=2" 
    alt="QR Code" width="180" height="180" style="display:block; border-radius:8px;"
    onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'padding:1rem;color:#000;font-weight:700;font-size:0.9rem;\\' >Inquadra: ' + currentLanUrl + '</div>'">`;
}
