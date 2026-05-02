/* =========================================================
   Momentum Engine — Indian Market Screener  |  app.js  v2
   Vanilla JS · Chart.js 4.x · Flask backend
   ========================================================= */

'use strict';

/* ─── App State ─────────────────────────────────────────── */
const state = {
  maType: 'EMA',
  fastPeriod: 12,
  slowPeriod: 26,
  crossoverDays: 10,
  holdDays: 180,
  avwapFilter: true,
  rsFilter: true,
  universe: 'nifty50',
  results: [],
  sectorData: {},
  watchlist: [],
  heatmapChart: null,
  stockChart: null,
  equityChart: null,
  activeModal: null,
  activeTab: 'chart',
  // Spotlight state
  spotlightTicker: null,
  spotlightStock: null,
  spStockChart: null,
  spEquityChart: null,
  spActiveTab: 'chart',
  spChartLoaded: false,
  spBtLoaded: false,
};

/* ─── 1. Initialization ─────────────────────────────────── */
function init() {
  loadWatchlist();
  renderWatchlist();
  setupSliderLabels();
  setupEventListeners();
  setupResizeHandle();
  restoreCollapseSections();
  restoreWatchlistCardsCollapse();

  // Reflect initial state on UI toggles
  document.getElementById('btn-nifty50').classList.add('active');
  document.getElementById('btn-ema').classList.add('active');

  const fastInput  = document.getElementById('fast-period');
  const slowInput  = document.getElementById('slow-period');
  const crossInput = document.getElementById('crossover-days');
  const holdInput  = document.getElementById('hold-days');

  if (fastInput)  fastInput.value  = state.fastPeriod;
  if (slowInput)  slowInput.value  = state.slowPeriod;
  if (crossInput) crossInput.value = state.crossoverDays;
  if (holdInput)  holdInput.value  = state.holdDays;
}

/* ─── Section Collapse ──────────────────────────────────── */
const _COLLAPSE_KEY = 'momentum_collapsed';

function _getCollapsed() {
  try { return JSON.parse(localStorage.getItem(_COLLAPSE_KEY) || '{}'); } catch { return {}; }
}
function _saveCollapsed(map) {
  try { localStorage.setItem(_COLLAPSE_KEY, JSON.stringify(map)); } catch {}
}

function toggleSection(id) {
  const body    = document.getElementById('cs-body-' + id);
  const btn     = document.getElementById('collapse-btn-' + id);
  const chevron = btn ? btn.querySelector('.cs-chevron') : null;
  if (!body) return;

  const isCollapsed = body.classList.toggle('cs-collapsed');
  if (chevron) chevron.textContent = isCollapsed ? '▼' : '▲';
  btn && btn.setAttribute('title', isCollapsed ? 'Expand section' : 'Collapse section');

  const map = _getCollapsed();
  map[id] = isCollapsed;
  _saveCollapsed(map);
}

function restoreCollapseSections() {
  const map = _getCollapsed();
  ['lookup', 'screener', 'watchlist'].forEach(id => {
    if (map[id]) {
      const body    = document.getElementById('cs-body-' + id);
      const btn     = document.getElementById('collapse-btn-' + id);
      const chevron = btn ? btn.querySelector('.cs-chevron') : null;
      if (body) body.classList.add('cs-collapsed');
      if (chevron) chevron.textContent = '▼';
    }
  });
}

/* ── Watchlist cards grid collapse (independent of section-level collapse) */
const _WL_CARDS_KEY = 'momentum_wl_cards_collapsed';

function toggleWatchlistCards() {
  const wrap    = document.getElementById('watchlist-items-wrap');
  const chevron = document.getElementById('wl-cards-chevron');
  const btn     = document.getElementById('wl-cards-collapse-btn');
  if (!wrap) return;
  const isCollapsed = wrap.classList.toggle('wl-cards-collapsed');
  if (chevron) chevron.textContent = isCollapsed ? '▼' : '▲';
  if (btn) btn.setAttribute('title', isCollapsed ? 'Expand cards' : 'Collapse cards');
  try { localStorage.setItem(_WL_CARDS_KEY, isCollapsed ? '1' : '0'); } catch {}
}

function restoreWatchlistCardsCollapse() {
  try {
    if (localStorage.getItem(_WL_CARDS_KEY) === '1') {
      const wrap    = document.getElementById('watchlist-items-wrap');
      const chevron = document.getElementById('wl-cards-chevron');
      if (wrap)    wrap.classList.add('wl-cards-collapsed');
      if (chevron) chevron.textContent = '▼';
    }
  } catch {}
}

/* helper: show a section (and hide empty state if any section visible) */
function _showSection(id) {
  const sec = document.getElementById('section-' + id);
  if (sec) sec.style.display = 'block';
  // Hide empty state whenever any section is visible
  const anyVisible = ['lookup','screener','watchlist'].some(i => {
    const s = document.getElementById('section-' + i);
    return s && s.style.display !== 'none';
  });
  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.style.display = anyVisible ? 'none' : 'flex';
}

function _hideSection(id) {
  const sec = document.getElementById('section-' + id);
  if (sec) sec.style.display = 'none';
  // Show empty state if nothing else is visible
  const anyVisible = ['lookup','screener','watchlist'].some(i => {
    const s = document.getElementById('section-' + i);
    return s && s.style.display !== 'none';
  });
  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.style.display = anyVisible ? 'none' : 'flex';
}

/* ─── Sidebar Resize Handle ─────────────────────────────── */
function setupResizeHandle() {
  const SIDEBAR_MIN = 200;   // px — narrowest allowed
  const SIDEBAR_MAX = 480;   // px — widest allowed
  const STORAGE_KEY = 'momentum_sidebar_w';

  const handle   = document.getElementById('resize-handle');
  const tooltip  = document.getElementById('resize-tooltip');
  if (!handle) return;

  // Restore saved width from localStorage
  const saved = parseInt(localStorage.getItem(STORAGE_KEY), 10);
  if (saved && saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX) {
    setSidebarWidth(saved);
  }

  let dragging   = false;
  let startX     = 0;
  let startWidth = 0;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging   = true;
    startX     = e.clientX;
    startWidth = parseInt(getComputedStyle(document.documentElement)
                          .getPropertyValue('--sidebar-w'), 10) || 280;

    handle.classList.add('dragging');
    document.body.classList.add('resizing');      // sets col-resize cursor everywhere
    document.body.style.userSelect = 'none';       // prevent text selection
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const delta    = e.clientX - startX;
    const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth + delta));
    setSidebarWidth(newWidth);
    if (tooltip) tooltip.textContent = `${Math.round(newWidth)}px`;
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.classList.remove('resizing');
    document.body.style.userSelect = '';

    // Persist to localStorage
    const current = parseInt(getComputedStyle(document.documentElement)
                             .getPropertyValue('--sidebar-w'), 10);
    if (current) localStorage.setItem(STORAGE_KEY, current);
  });

  // Touch support
  handle.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    dragging   = true;
    startX     = touch.clientX;
    startWidth = parseInt(getComputedStyle(document.documentElement)
                          .getPropertyValue('--sidebar-w'), 10) || 280;
    handle.classList.add('dragging');
    document.body.style.userSelect = 'none';
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const touch    = e.touches[0];
    const delta    = touch.clientX - startX;
    const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth + delta));
    setSidebarWidth(newWidth);
    if (tooltip) tooltip.textContent = `${Math.round(newWidth)}px`;
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.style.userSelect = '';
    const current = parseInt(getComputedStyle(document.documentElement)
                             .getPropertyValue('--sidebar-w'), 10);
    if (current) localStorage.setItem(STORAGE_KEY, current);
  });

  // Double-click to reset to default 280px
  handle.addEventListener('dblclick', () => {
    setSidebarWidth(280);
    localStorage.removeItem(STORAGE_KEY);
    showToast('Sidebar reset to default width', 'success');
  });
}

function setSidebarWidth(px) {
  document.documentElement.style.setProperty('--sidebar-w', `${px}px`);
}

function setupSliderLabels() {
  const sliders = document.querySelectorAll('input[type="range"]');
  sliders.forEach(slider => {
    const labelId = slider.dataset.labelFor || slider.id + '-label';
    const label   = document.getElementById(labelId);
    if (label) label.textContent = slider.value;
    slider.addEventListener('input', () => {
      if (label) label.textContent = slider.value;
    });
  });
}

function setupEventListeners() {
  // Close modal when clicking overlay background
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // Keyboard escape to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.activeModal) closeModal();
  });
}

/* ─── 2. Strategy Controls ──────────────────────────────── */
const UNIVERSE_LABELS = {
  nifty50: '50 stocks',
  nifty100: '100 stocks',
  all_nse: '~2,250 NSE stocks (slow)',
};

function setUniverse(u) {
  state.universe = u;
  document.getElementById('btn-nifty50').classList.toggle('active', u === 'nifty50');
  document.getElementById('btn-nifty100').classList.toggle('active', u === 'nifty100');
  const btnAll = document.getElementById('btn-allnse');
  if (btnAll) btnAll.classList.toggle('active', u === 'all_nse');
  const note = document.getElementById('universe-note');
  if (note) note.textContent = UNIVERSE_LABELS[u] || '';
}

/* ─── Stock Search ──────────────────────────────────────── */
let _searchTimer = null;

function _showDropdown(dd) { if (dd) { dd.classList.remove('hidden'); dd.style.display = 'block'; } }
function _hideDropdown(dd) { if (dd) { dd.style.display = 'none'; dd.classList.add('hidden'); } }

async function onSearchInput(val) {
  const dropdown = document.getElementById('search-results');
  clearTimeout(_searchTimer);
  if (!val || val.trim().length < 1) {
    _hideDropdown(dropdown);
    return;
  }
  _searchTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(val.trim())}`);
      const data = await res.json();
      renderSearchDropdown(data.results || []);
    } catch (_) {}
  }, 300);
}

function renderSearchDropdown(results) {
  const dropdown = document.getElementById('search-results');
  if (!dropdown) return;

  if (results.length === 0) {
    dropdown.innerHTML = '<div class="search-no-results">No results found</div>';
    _showDropdown(dropdown);
    return;
  }

  // Cap at 5 results
  const top5 = results.slice(0, 5);

  dropdown.innerHTML = top5.map(r => {
    const safeName   = r.name.replace(/'/g, "\\'");
    const safeTicker = r.ticker;
    const baseSymbol = r.ticker.replace('.NS', '').replace('.BO', '');
    const inWatch    = state.watchlist.some(w => w.ticker === r.ticker);
    const watchTitle = inWatch ? 'Already in watchlist' : 'Add to watchlist';
    const watchIcon  = inWatch ? '★' : '☆';

    return `<div class="search-item" onclick="openSpotlight('${safeTicker}', '${safeName}')">
      <div class="search-item-left">
        <span class="search-item-ticker">${baseSymbol}</span>
        <span class="search-item-name">${r.name}</span>
      </div>
      <button class="sr-watch-btn ${inWatch ? 'in-watch' : ''}"
        title="${watchTitle}"
        onclick="event.stopPropagation(); searchAddToWatchlist('${safeTicker}', '${safeName}', this)">
        ${watchIcon}
      </button>
    </div>`;
  }).join('');
  _showDropdown(dropdown);
}

/** Called when user clicks a search-result row — opens Spotlight in main area */
/**
 * Open the spotlight panel for any stock.
 * @param {string} ticker   Full ticker e.g. "RELIANCE.NS"
 * @param {string} name     Company name
 * @param {object} [meta]   Optional extra fields: { sector, avwap_status, price, rs_vs_nifty, adx, confidence_score }
 * @param {boolean} [scrollTo]  If true, scroll spotlight into view after opening (default false)
 */
function openSpotlight(ticker, name, meta = {}, scrollTo = false) {
  // Close search dropdown if open
  _hideDropdown(document.getElementById('search-results'));
  const input = document.getElementById('stock-search');
  if (input) input.value = '';

  // Reset spotlight state, merging any extra meta we already have
  state.spotlightTicker = ticker;
  state.spotlightStock  = {
    ticker,
    name,
    sector:           meta.sector           || '—',
    avwap_status:     meta.avwap_status     || 'unknown',
    price:            meta.price            || null,
    rs_vs_nifty:      meta.rs_vs_nifty      ?? null,
    adx:              meta.adx              ?? null,
    confidence_score: meta.confidence_score ?? null,
  };
  state.spChartLoaded = false;
  state.spBtLoaded    = false;

  // Destroy previous spotlight charts
  if (state.spStockChart)  { state.spStockChart.destroy();  state.spStockChart  = null; }
  if (state.spEquityChart) { state.spEquityChart.destroy(); state.spEquityChart = null; }

  // Show the lookup section
  _showSection('lookup');

  // Populate header
  const base = ticker.replace('.NS','').replace('.BO','');
  document.getElementById('sp-ticker').textContent       = base;
  document.getElementById('sp-name').textContent         = name;
  document.getElementById('sp-sector-badge').textContent = state.spotlightStock.sector;
  document.getElementById('sp-avwap-badge').innerHTML    = getAVWAPBadge(state.spotlightStock.avwap_status);

  // Show confidence score badge only if we have it
  const scoreBadge = document.getElementById('sp-score-badge');
  if (scoreBadge) {
    if (state.spotlightStock.confidence_score != null) {
      const sc = Math.round(state.spotlightStock.confidence_score);
      scoreBadge.textContent = sc;
      scoreBadge.className   = `score-badge ${getScoreClass(sc)}`;
      scoreBadge.style.display = 'inline-flex';
    } else {
      scoreBadge.style.display = 'none';
    }
  }

  _updateSpotlightWatchBtn(ticker);

  // Hide any previous screener result strip while new one loads
  const strip = document.getElementById('sp-screen-result');
  if (strip) {
    strip.style.display = 'none';
    strip.innerHTML = '';
  }

  // Load chart tab
  switchSpotlightTab('chart', document.querySelector('[data-sptab="chart"]'));

  // Run screener on this single stock and populate result strip
  _runSpotlightScreen(ticker, name);

  // Optionally scroll the spotlight into view
  if (scrollTo) {
    setTimeout(() => {
      document.getElementById('stock-spotlight')
        .scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }
}

/** Open spotlight on a skipped stock and immediately switch to the backtest/performance tab */
function openSpotlightBacktest(ticker, name, meta) {
  openSpotlight(ticker, name, meta, true);
  // Small delay to let spotlight DOM render before switching tabs
  setTimeout(() => {
    const btn = document.querySelector('[data-sptab="performance"]');
    switchSpotlightTab('performance', btn);
  }, 60);
}

/** Run the current config on one ticker and render the result strip */
async function _runSpotlightScreen(ticker, name) {
  const strip = document.getElementById('sp-screen-result');
  if (!strip) return;

  const base = ticker.replace('.NS','').replace('.BO','');
  strip.style.display = 'block';
  strip.innerHTML = `<div class="sp-screen-loading"><span class="loading-spinner"></span> Loading data for ${base}…</div>`;

  try {
    // ── Step 1: Fetch raw stock data (price, AVWAP, ADX, RS, win rate) ──────
    const params = new URLSearchParams({
      ma_type:     state.maType,
      fast_period: state.fastPeriod,
      slow_period: state.slowPeriod,
    });
    const stockRes = await fetch(`/api/stock/${encodeURIComponent(ticker)}?${params}`);
    if (!stockRes.ok) throw new Error(`Could not load data for ${base}`);
    const s = await stockRes.json();
    if (s.error) throw new Error(s.error);

    // ── Update spotlight header with real data ───────────────────────────────
    state.spotlightStock = { ...state.spotlightStock, ...s };
    document.getElementById('sp-sector-badge').textContent = s.sector || '—';
    document.getElementById('sp-avwap-badge').innerHTML    = getAVWAPBadge(s.avwap_status);
    const scoreBadge = document.getElementById('sp-score-badge');
    if (scoreBadge && s.confidence_score != null) {
      const sc = Number(s.confidence_score).toFixed(1);
      scoreBadge.textContent   = `${sc}%`;
      scoreBadge.className     = `score-badge ${getScoreClass(sc)}`;
      scoreBadge.style.display = 'inline-flex';
    }

    // Make available for openModal
    if (!state.results.find(r => r.ticker === ticker)) state.results.push(s);

    // ── Step 2: Check filter pass/fail (separate, non-blocking) ─────────────
    strip.innerHTML = `<div class="sp-screen-loading"><span class="loading-spinner"></span> Checking strategy filters…</div>`;

    const screenRes = await fetch('/api/screen/watchlist', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tickers:        [ticker],
        ma_type:        state.maType,
        fast_period:    state.fastPeriod,
        slow_period:    state.slowPeriod,
        crossover_days: state.crossoverDays,
        avwap_filter:   state.avwapFilter,
        rs_filter:      state.rsFilter,
      }),
    });
    const filterData = screenRes.ok ? await screenRes.json() : { stocks: [], skipped: [] };
    const passed     = (filterData.stocks  || []).length > 0;
    const failItems  = filterData.skipped  || [];
    const failReasons = passed ? [] : (failItems[0]?.fail_reasons || []);

    // ── Render strip with real data + pass/fail banner ───────────────────────
    const winRate    = s.confidence_score != null ? Number(s.confidence_score).toFixed(1) : null;
    const filterBanner = passed
      ? `<div class="sp-passed-banner">
           <span class="sp-pass-icon">✅</span>
           <span class="sp-pass-text">Passes all filters — <strong>${state.maType} ${state.fastPeriod}/${state.slowPeriod}</strong></span>
         </div>`
      : `<div class="sp-failed-banner">
           <span class="sp-fail-icon">❌</span>
           <span class="sp-fail-text">Does not pass filters — <strong>${state.maType} ${state.fastPeriod}/${state.slowPeriod}</strong></span>
           <div class="sp-fail-reasons">${failReasons.map(r => `<span class="fail-reason">${r}</span>`).join('')}</div>
         </div>`;

    strip.innerHTML = `
      ${filterBanner}
      <div class="sp-metrics-grid">
        <div class="sp-metric">
          <div class="sp-metric-label">Price</div>
          <div class="sp-metric-value">${s.price != null ? formatPrice(s.price) : '—'}</div>
        </div>
        <div class="sp-metric">
          <div class="sp-metric-label">AVWAP</div>
          <div class="sp-metric-value">${s.avwap != null ? formatPrice(s.avwap) : '—'} ${getAVWAPBadge(s.avwap_status)}</div>
        </div>
        <div class="sp-metric">
          <div class="sp-metric-label">Win Rate</div>
          <div class="sp-metric-value">${winRate != null ? `<span class="score-badge ${getScoreClass(winRate)}">${winRate}%</span>` : '—'}</div>
        </div>
        <div class="sp-metric">
          <div class="sp-metric-label">RS vs Nifty</div>
          <div class="sp-metric-value">${s.rs_vs_nifty != null ? formatRS(s.rs_vs_nifty) : '—'}</div>
        </div>
        <div class="sp-metric">
          <div class="sp-metric-label">Volume Ratio</div>
          <div class="sp-metric-value volume-cell">${s.volume_ratio != null ? s.volume_ratio.toFixed(1) + 'x' : '—'}</div>
        </div>
        <div class="sp-metric">
          <div class="sp-metric-label">ADX</div>
          <div class="sp-metric-value">${s.adx != null ? s.adx.toFixed(1) : '—'}</div>
        </div>
        <div class="sp-metric">
          <div class="sp-metric-label">Sector</div>
          <div class="sp-metric-value"><span class="sector-tag">${s.sector || '—'}</span></div>
        </div>
      </div>`;

  } catch (err) {
    strip.innerHTML = `<div class="sp-screen-noop">⚠ ${err.message}</div>`;
  }
}

function closeSpotlight() {
  _hideSection('lookup');
  state.spotlightTicker = null;
  state.spotlightStock  = null;
  if (state.spStockChart)  { state.spStockChart.destroy();  state.spStockChart  = null; }
  if (state.spEquityChart) { state.spEquityChart.destroy(); state.spEquityChart = null; }
}

function switchSpotlightTab(tab, btnEl) {
  state.spActiveTab = tab;

  // Update tab buttons
  document.querySelectorAll('.sp-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.sptab === tab));

  // Show/hide panels
  document.getElementById('sp-tab-chart').style.display       = tab === 'chart'       ? 'block' : 'none';
  document.getElementById('sp-tab-performance').style.display = tab === 'performance' ? 'block' : 'none';

  if (!state.spotlightTicker) return;

  if (tab === 'chart' && !state.spChartLoaded) {
    state.spChartLoaded = true;
    loadSpotlightChart(state.spotlightTicker);
  } else if (tab === 'performance' && !state.spBtLoaded) {
    state.spBtLoaded = true;
    loadSpotlightBacktest(state.spotlightTicker);
  }
}

/** Add to watchlist from the search dropdown watchlist button */
async function searchAddToWatchlist(ticker, name, btn) {
  const alreadyIn = state.watchlist.some(w => w.ticker === ticker);
  if (alreadyIn) {
    showToast(`${ticker.replace('.NS','').replace('.BO','')} is already in your watchlist.`, 'warning');
    return;
  }

  // Fetch minimal data to populate the watchlist card (price etc.)
  let price = null, avwap_status = 'unknown', sector = '—', score = null;
  try {
    const params = new URLSearchParams({ ma_type: state.maType, fast_period: state.fastPeriod, slow_period: state.slowPeriod, period: '1mo' });
    const res    = await fetch(`/api/chart/${encodeURIComponent(ticker)}?${params}`);
    if (res.ok) {
      const data = await res.json();
      if (data.close && data.close.length) {
        const lastClose = data.close.filter(v => v != null).at(-1);
        if (lastClose) price = lastClose;
      }
    }
  } catch (_) {}

  state.watchlist.push({ ticker, name, sector, price, score, avwap_status, added_at: new Date().toISOString() });
  saveWatchlist();
  renderWatchlist();

  // Update button appearance
  if (btn) {
    btn.textContent = '★';
    btn.classList.add('in-watch');
    btn.title = 'Already in watchlist';
  }
  showToast(`⭐ ${name || ticker} added to watchlist.`, 'success');
}

/** Update spotlight watchlist button to reflect current state */
function _updateSpotlightWatchBtn(ticker) {
  const btn = document.getElementById('sp-watch-btn');
  if (!btn) return;
  const inWatch = state.watchlist.some(w => w.ticker === ticker);
  btn.textContent  = inWatch ? '★ In Watchlist' : '⭐ Watchlist';
  btn.classList.toggle('active', inWatch);
}

/** Add-to-watchlist action from spotlight panel */
async function spotlightAddToWatchlist() {
  const ticker = state.spotlightTicker;
  if (!ticker) return;
  const stock  = state.spotlightStock || {};
  const name   = stock.name || ticker;

  const alreadyIn = state.watchlist.some(w => w.ticker === ticker);
  if (alreadyIn) {
    showToast(`${ticker.replace('.NS','').replace('.BO','')} is already in your watchlist.`, 'warning');
    return;
  }

  let price = stock.price || null;
  if (!price) {
    try {
      const params = new URLSearchParams({ ma_type: state.maType, fast_period: state.fastPeriod, slow_period: state.slowPeriod, period: '1mo' });
      const res    = await fetch(`/api/chart/${encodeURIComponent(ticker)}?${params}`);
      if (res.ok) {
        const data = await res.json();
        if (data.close) price = data.close.filter(v => v != null).at(-1);
      }
    } catch (_) {}
  }

  state.watchlist.push({
    ticker,
    name,
    sector:       stock.sector       || '—',
    price,
    score:        stock.confidence_score || null,
    avwap_status: stock.avwap_status  || 'unknown',
    added_at:     new Date().toISOString(),
  });
  saveWatchlist();
  renderWatchlist();
  _updateSpotlightWatchBtn(ticker);
  showToast(`⭐ ${name} added to watchlist.`, 'success');
}

// Close search dropdown when clicking outside
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.search-wrap');
  if (wrap && !wrap.contains(e.target)) {
    _hideDropdown(document.getElementById('search-results'));
  }
});

function setMAType(type) {
  state.maType = type;
  document.getElementById('btn-ema').classList.toggle('active', type === 'EMA');
  document.getElementById('btn-sma').classList.toggle('active', type === 'SMA');
}

function applyPreset(fast, slow, maType) {
  state.fastPeriod  = fast;
  state.slowPeriod  = slow;
  state.maType      = maType;

  const fastInput = document.getElementById('fast-period');
  const slowInput = document.getElementById('slow-period');
  if (fastInput) fastInput.value = fast;
  if (slowInput) slowInput.value = slow;

  // Update labels if they exist
  const fastLabel = document.getElementById('fast-period-label');
  const slowLabel = document.getElementById('slow-period-label');
  if (fastLabel) fastLabel.textContent = fast;
  if (slowLabel) slowLabel.textContent = slow;

  setMAType(maType);
  showToast(`Preset applied: ${maType} ${fast}/${slow}`, 'success');
}

/* ─── 3. Run Screener ───────────────────────────────────── */

// Split an array into chunks of size n
function _chunkArray(arr, n) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += n) chunks.push(arr.slice(i, i + n));
  return chunks;
}

async function runScreener() {
  // Read all form values into state
  const fastInput      = document.getElementById('fast-period');
  const slowInput      = document.getElementById('slow-period');
  const crossInput     = document.getElementById('crossover-days');
  const holdInput      = document.getElementById('hold-days');
  const avwapCheckbox  = document.getElementById('avwap-filter');
  const rsCheckbox     = document.getElementById('rs-filter');

  state.fastPeriod    = parseInt(fastInput?.value  || state.fastPeriod,  10);
  state.slowPeriod    = parseInt(slowInput?.value  || state.slowPeriod,  10);
  state.crossoverDays = parseInt(crossInput?.value || state.crossoverDays, 10);
  state.holdDays      = parseInt(holdInput?.value  || state.holdDays,    10);
  state.avwapFilter   = avwapCheckbox ? avwapCheckbox.checked : state.avwapFilter;
  state.rsFilter      = rsCheckbox    ? rsCheckbox.checked    : state.rsFilter;

  // Validate fast < slow
  if (state.fastPeriod >= state.slowPeriod) {
    showToast('Fast period must be less than slow period.', 'error');
    return;
  }

  // Warn if scanning all NSE (slow even with parallelism)
  if (state.universe === 'all_nse') {
    showToast('⚠ Scanning all NSE stocks in parallel — this may take a few minutes.', 'warning');
  }

  // Show spinner, disable button
  const runBtn = document.getElementById('run-btn');
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.innerHTML = '<span class="spinner"></span> Scanning…';
  }

  try {
    // Step 1: Fetch the full ticker list for the selected universe
    const uniRes = await fetch(`/api/universe?universe=${state.universe}`);
    if (!uniRes.ok) throw new Error('Could not load universe tickers');
    const uniData = await uniRes.json();
    const allTickers = uniData.tickers || [];

    if (allTickers.length === 0) throw new Error('No tickers found for this universe');

    // Step 2: Split tickers into chunks and fire all in parallel
    const CHUNK_SIZE = 7;
    const chunks = _chunkArray(allTickers, CHUNK_SIZE);

    if (runBtn) {
      runBtn.innerHTML = `<span class="spinner"></span> Scanning ${chunks.length} batches…`;
    }

    const batchPayload = {
      ma_type:        state.maType,
      fast_period:    state.fastPeriod,
      slow_period:    state.slowPeriod,
      crossover_days: state.crossoverDays,
      hold_days:      state.holdDays,
      avwap_filter:   state.avwapFilter,
      rs_filter:      state.rsFilter,
    };

    const batchRequests = chunks.map(tickers =>
      fetch('/api/screen/watchlist', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...batchPayload, tickers }),
      }).then(r => r.ok ? r.json() : Promise.reject(new Error(`Batch failed: ${r.status}`)))
    );

    const batchResults = await Promise.all(batchRequests);

    // Step 3: Merge all batch results into one
    const merged = {
      stocks:         [],
      skipped:        [],
      sector_heatmap: {},
      screened:       0,
      matched:        0,
    };

    for (const batch of batchResults) {
      merged.stocks.push(...(batch.stocks  || []));
      merged.skipped.push(...(batch.skipped || []));
      merged.screened += batch.screened || 0;
      merged.matched  += batch.matched  || 0;
      for (const [sector, count] of Object.entries(batch.sector_heatmap || {})) {
        merged.sector_heatmap[sector] = (merged.sector_heatmap[sector] || 0) + count;
      }
    }

    // Sort merged stocks by confidence score descending
    merged.stocks.sort((a, b) => b.confidence_score - a.confidence_score);

    // Store results
    state.results    = merged.stocks;
    state.sectorData = merged.sector_heatmap;

    // Update sidebar meta
    const meta = document.getElementById('screen-meta');
    if (meta) {
      meta.textContent = `✓ Scanned ${merged.screened} · Found ${merged.stocks.length}`;
      meta.style.display = 'block';
    }

    renderResults(merged);
    renderHeatmap(merged.sector_heatmap);

  } catch (err) {
    showToast(err.message || 'Screening failed. Please try again.', 'error');
  } finally {
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.innerHTML = '▶ Run Screener';
    }
  }
}

/* ─── 4. Render Results ─────────────────────────────────── */
function renderResults(data) {
  _showSection('screener');
  // Update section subtitle with strategy + count
  const screenerSub = document.getElementById('screener-sub');
  if (screenerSub) screenerSub.textContent = `${state.maType} ${state.fastPeriod}/${state.slowPeriod} · ${state.results.length} matched`;

  // Update summary stats
  const universeLabel = state.universe === 'nifty50' ? 'Nifty 50' : 'Nifty 100';
  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('sum-matched',  state.results.length);
  el('sum-scanned',  data.screened ?? '—');
  el('sum-universe', universeLabel);
  el('sum-strategy', `${state.maType} ${state.fastPeriod}/${state.slowPeriod}`);

  renderTable(state.results);
}

function renderTable(stocks) {
  const tbody = document.getElementById('results-tbody');
  if (!tbody) return;

  if (!stocks || stocks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:2rem;color:var(--text-muted)">
      No stocks matched the current filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = stocks.map(s => {
    const ticker      = s.ticker || '';
    const baseTicker  = ticker.replace('.NS', '').replace('.BO', '');
    const suffix      = ticker.includes('.') ? '.' + ticker.split('.').pop() : '';
    const name        = s.name || ticker;
    const sector      = s.sector || '—';
    const price       = s.price != null ? formatPrice(s.price) : '—';
    const score       = s.confidence_score != null ? Number(s.confidence_score).toFixed(1) : null;
    const scoreClass  = getScoreClass(score);
    const crossDate   = s.crossover_date ? formatDate(s.crossover_date) : '—';
    const avwapPrice  = s.avwap != null ? formatPrice(s.avwap) : '—';
    const avwapBadge  = getAVWAPBadge(s.avwap_status);
    const rsHTML      = s.rs_vs_nifty != null ? formatRS(s.rs_vs_nifty) : '—';
    const volRatio    = s.volume_ratio != null ? s.volume_ratio.toFixed(1) + 'x' : '—';
    const adx         = s.adx != null ? s.adx.toFixed(1) : '—';
    const inWatch     = state.watchlist.some(w => w.ticker === ticker);
    const watchClass  = inWatch ? 'watch-btn active' : 'watch-btn';
    const watchTitle  = inWatch ? 'In watchlist' : 'Add to watchlist';

    return `<tr>
      <td>
        <span class="ticker-cell">${baseTicker}</span><br>
        <small style="color:var(--muted);font-size:.68rem">${suffix}</small>
      </td>
      <td><span class="sector-tag">${sector}</span></td>
      <td class="text-right price-cell">${price}</td>
      <td class="text-center">
        ${score != null ? `<span class="score-badge ${scoreClass}">${score}%</span>` : '—'}
      </td>
      <td>${crossDate}</td>
      <td class="text-right">${avwapPrice}</td>
      <td class="text-center">${avwapBadge}</td>
      <td class="text-right">${rsHTML}</td>
      <td class="text-right volume-cell">${volRatio}</td>
      <td class="text-right">${adx}</td>
      <td class="text-center">
        <div class="btn-group">
          <button class="action-btn chart-btn"
            onclick="openModal('${ticker}')"
            title="View Chart">📈</button>
          <button class="action-btn backtest-btn"
            onclick="openModal('${ticker}', 'backtest')"
            title="Backtest">🧪</button>
          <button class="action-btn ${watchClass}"
            onclick="addToWatchlist('${ticker}')"
            title="${watchTitle}">⭐</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ─── 5. Sector Heatmap ─────────────────────────────────── */
function renderHeatmap(sectorData) {
  const canvas = document.getElementById('heatmap-chart');
  if (!canvas) return;

  // Destroy old chart
  if (state.heatmapChart) {
    state.heatmapChart.destroy();
    state.heatmapChart = null;
  }

  // Sort sectors by count descending
  const entries = Object.entries(sectorData).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return;

  const labels = entries.map(([sector]) => sector);
  const values = entries.map(([, count]) => count);
  const maxVal = Math.max(...values, 1);

  // Interpolate color from dark green to teal based on normalized value
  const colors = values.map(v => {
    const t = v / maxVal;           // 0 → 1
    const r = Math.round(26  + t * (0   - 26));
    const g = Math.round(61  + t * (212 - 61));
    const b = Math.round(46  + t * (170 - 46));
    return `rgb(${r},${g},${b})`;
  });

  const borderColors = colors.map(c => c.replace('rgb', 'rgba').replace(')', ', 0.9)'));

  state.heatmapChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Matches',
        data: values,
        backgroundColor: colors,
        borderColor: borderColors,
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.x} stock${ctx.parsed.x !== 1 ? 's' : ''}`,
          },
          backgroundColor: '#1c2128',
          titleColor: '#e6edf3',
          bodyColor: '#8b949e',
          borderColor: '#30363d',
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          ticks: {
            color: '#8b949e',
            stepSize: 1,
          },
          grid: {
            color: '#21262d',
          },
          border: {
            color: '#30363d',
          },
        },
        y: {
          ticks: {
            color: '#e6edf3',
            font: { size: 12 },
          },
          grid: {
            display: false,
          },
          border: {
            color: '#30363d',
          },
        },
      },
    },
  });
}

/* ─── 6. Modal ──────────────────────────────────────────── */
function openModal(ticker, defaultTab = 'chart') {
  // Find stock in results
  const stock = state.results.find(s => s.ticker === ticker);
  if (!stock) {
    showToast('Stock data not found. Please re-run screener.', 'error');
    return;
  }

  state.activeModal = stock;
  state.activeTab   = defaultTab;

  // Populate modal header
  const baseTicker = ticker.replace('.NS', '').replace('.BO', '');

  const elTicker = document.getElementById('modal-ticker');
  const elName   = document.getElementById('modal-name');
  const elSector = document.getElementById('modal-sector-badge');
  const elScore  = document.getElementById('modal-score-badge');

  if (elTicker) elTicker.textContent = baseTicker;
  if (elName)   elName.textContent   = stock.name || ticker;
  if (elSector) {
    elSector.textContent  = stock.sector || '—';
    elSector.className    = 'sector-tag';
  }
  if (elScore) {
    const score = stock.confidence_score != null ? Number(stock.confidence_score).toFixed(1) : null;
    elScore.textContent = score != null ? `${score}%` : '—';
    elScore.className   = `score-badge ${getScoreClass(score)}`;
  }

  // Show overlay
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Reset loaded flags so data re-fetches when tab changes
  delete stock._chartLoaded;
  delete stock._backtestLoaded;

  // Switch to default tab
  switchTab(defaultTab);
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';

  // Destroy charts to free memory
  if (state.stockChart) {
    state.stockChart.destroy();
    state.stockChart = null;
  }
  if (state.equityChart) {
    state.equityChart.destroy();
    state.equityChart = null;
  }

  state.activeModal = null;
}

function switchTab(tab) {
  state.activeTab = tab;

  // Toggle tab buttons (they have data-tab attribute)
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Show/hide tab panels (id = tab-panel-chart or tab-panel-backtest)
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.style.display = panel.id === `tab-panel-${tab}` ? 'block' : 'none';
  });

  if (!state.activeModal) return;

  if (tab === 'chart' && !state.activeModal._chartLoaded) {
    state.activeModal._chartLoaded = true;
    loadStockChart(state.activeModal.ticker);
  } else if (tab === 'backtest' && !state.activeModal._backtestLoaded) {
    state.activeModal._backtestLoaded = true;
    loadBacktest(state.activeModal.ticker);
  }
}

/* ─── 6b. Spotlight Chart & Backtest ───────────────────── */
async function loadSpotlightChart(ticker) {
  const loading   = document.getElementById('sp-chart-loading');
  const chartBody = document.getElementById('sp-chart-body');
  const errorDiv  = document.getElementById('sp-chart-error');
  const canvas    = document.getElementById('sp-stock-chart');

  if (loading)   loading.style.display   = 'flex';
  if (chartBody) chartBody.style.display = 'none';
  if (errorDiv)  errorDiv.style.display  = 'none';

  if (state.spStockChart) { state.spStockChart.destroy(); state.spStockChart = null; }

  try {
    const params = new URLSearchParams({
      ma_type:     state.maType,
      fast_period: state.fastPeriod,
      slow_period: state.slowPeriod,
      period:      '6mo',
    });

    const response = await fetch(`/api/chart/${encodeURIComponent(ticker)}?${params}`);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Chart data unavailable (${response.status})`);
    }
    const data = await response.json();

    if (loading)   loading.style.display   = 'none';
    if (chartBody) chartBody.style.display = 'block';

    const dates  = data.dates   || [];
    const closes = data.close   || [];
    const fastMA = data.fast_ma || [];
    const slowMA = data.slow_ma || [];
    const avwap  = data.avwap   || [];

    // Update legend labels
    const legFast = document.getElementById('sp-legend-fast');
    const legSlow = document.getElementById('sp-legend-slow');
    if (legFast) legFast.querySelector('span:last-child').textContent = `${state.maType} ${state.fastPeriod}`;
    if (legSlow) legSlow.querySelector('span:last-child').textContent = `${state.maType} ${state.slowPeriod}`;

    const labelSkip = Math.max(1, Math.floor(dates.length / 13));

    const datasets = [
      {
        label: 'Close', data: closes,
        borderColor: '#00d4aa', backgroundColor: 'rgba(0,212,170,0.04)',
        borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.2, fill: false, order: 1,
      },
      {
        label: `Fast MA (${state.maType} ${state.fastPeriod})`, data: fastMA,
        borderColor: '#58a6ff', backgroundColor: 'transparent',
        borderWidth: 1.5, borderDash: [5,3], pointRadius: 0, pointHoverRadius: 3, tension: 0.2, fill: false, order: 2,
      },
      {
        label: `Slow MA (${state.maType} ${state.slowPeriod})`, data: slowMA,
        borderColor: '#ff4d6d', backgroundColor: 'transparent',
        borderWidth: 1.5, borderDash: [5,3], pointRadius: 0, pointHoverRadius: 3, tension: 0.2, fill: false, order: 3,
      },
      {
        label: 'AVWAP', data: avwap,
        borderColor: '#f59e0b', backgroundColor: 'transparent',
        borderWidth: 2, borderDash: [2,2], pointRadius: 0, pointHoverRadius: 3, tension: 0.2, fill: false, order: 4,
      },
    ];

    state.spStockChart = new Chart(canvas, {
      type: 'line',
      data: { labels: dates, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'top', labels: { color: '#8b949e', boxWidth: 20, padding: 12, font: { size: 11 }, usePointStyle: true } },
          tooltip: {
            backgroundColor: '#1c2128', titleColor: '#e6edf3', bodyColor: '#8b949e', borderColor: '#30363d', borderWidth: 1,
            callbacks: { label: (ctx) => ctx.parsed.y == null ? null : ` ${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
          },
        },
        scales: {
          x: {
            ticks: { color: '#8b949e', maxTicksLimit: 13, callback: (val, idx) => idx % labelSkip !== 0 ? '' : (dates[idx] ? formatDate(dates[idx]) : ''), maxRotation: 45 },
            grid: { color: '#21262d' }, border: { color: '#30363d' },
          },
          y: {
            ticks: { color: '#8b949e', callback: (val) => `₹${val.toLocaleString('en-IN')}` },
            grid: { color: '#21262d' }, border: { color: '#30363d' },
          },
        },
      },
    });

    // Try to determine last price and update spotlight stock info
    if (closes.length) {
      const lastPrice = closes.filter(v => v != null).at(-1);
      if (state.spotlightStock) state.spotlightStock.price = lastPrice;
    }

  } catch (err) {
    if (loading)  loading.style.display  = 'none';
    if (errorDiv) {
      errorDiv.style.display = 'block';
      errorDiv.innerHTML = `<p>⚠ ${err.message}</p>`;
    }
  }
}

async function loadSpotlightBacktest(ticker) {
  const loading  = document.getElementById('sp-bt-loading');
  const results  = document.getElementById('sp-bt-results');
  const errorDiv = document.getElementById('sp-bt-error');

  if (loading)  loading.style.display  = 'flex';
  if (results)  results.style.display  = 'none';
  if (errorDiv) errorDiv.style.display = 'none';

  try {
    const payload = {
      ticker,
      ma_type:     state.maType,
      fast_period: state.fastPeriod,
      slow_period: state.slowPeriod,
      hold_days:   state.holdDays,
    };

    const response = await fetch('/api/backtest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Backtest failed (${response.status})`);
    }

    const data = await response.json();

    if (loading) loading.style.display = 'none';
    if (results) results.style.display = 'block';

    const winRate     = data.win_rate     != null ? Number(data.win_rate).toFixed(1)     : null;
    const avgReturn   = data.avg_return   != null ? Number(data.avg_return).toFixed(2)   : null;
    const maxDD       = data.max_drawdown != null ? Number(data.max_drawdown).toFixed(2) : null;
    const trades      = data.total_trades != null ? data.total_trades                    : '—';
    const totalReturn = data.total_return != null ? Number(data.total_return).toFixed(2) : null;
    const finalEquity = data.final_equity != null ? formatPrice(data.final_equity)       : '—';

    const el = (id, val, color) => {
      const e = document.getElementById(id);
      if (!e) return;
      e.textContent = val;
      if (color) e.style.color = color;
    };

    el('sp-stat-winrate',   winRate     != null ? `${winRate}%`                                                   : '—', parseFloat(winRate) > 60  ? 'var(--accent)' : 'var(--text)');
    el('sp-stat-avgreturn', avgReturn   != null ? `${parseFloat(avgReturn) >= 0 ? '+' : ''}${avgReturn}%`         : '—', parseFloat(avgReturn) >= 0 ? 'var(--accent)' : 'var(--red)');
    el('sp-stat-maxdd',     maxDD       != null ? `${maxDD}%`                                                     : '—');
    el('sp-stat-trades',    trades);
    el('sp-stat-totalret',  totalReturn != null ? `${parseFloat(totalReturn) >= 0 ? '+' : ''}${totalReturn}%`    : '—', parseFloat(totalReturn) >= 0 ? 'var(--accent)' : 'var(--red)');
    el('sp-stat-equity',    finalEquity);

    if (data.equity_curve && data.equity_curve.length > 0) {
      _renderSpotlightEquityChart(data.equity_curve);
    }
    if (data.trades && data.trades.length > 0) {
      _renderSpotlightTradesList(data.trades);
    }

  } catch (err) {
    if (loading)  loading.style.display  = 'none';
    if (errorDiv) {
      errorDiv.style.display = 'block';
      errorDiv.innerHTML = `<p>⚠ ${err.message}</p>`;
    }
  }
}

function _renderSpotlightEquityChart(equityCurve) {
  const canvas = document.getElementById('sp-equity-chart');
  if (!canvas) return;
  if (state.spEquityChart) { state.spEquityChart.destroy(); state.spEquityChart = null; }

  const dates  = equityCurve.map(p => p.date  || p[0]);
  const values = equityCurve.map(p => p.equity != null ? p.equity : p[1]);
  const startVal = values[0] || 10000;
  const endVal   = values[values.length - 1] || startVal;
  const isProfit = endVal >= startVal;
  const lineColor = isProfit ? '#3fb950' : '#ff4d6d';
  const fillColor = isProfit ? 'rgba(63,185,80,0.08)' : 'rgba(255,77,109,0.08)';

  state.spEquityChart = new Chart(canvas, {
    type: 'line',
    data: { labels: dates, datasets: [{ label: 'Portfolio Equity', data: values, borderColor: lineColor, backgroundColor: fillColor, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.2, fill: true }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#1c2128', titleColor: '#e6edf3', bodyColor: '#8b949e', borderColor: '#30363d', borderWidth: 1, callbacks: { label: (ctx) => ` Equity: ${formatPrice(ctx.parsed.y)}` } },
      },
      scales: {
        x: { ticks: { color: '#8b949e', maxTicksLimit: 8, callback: (val, idx) => dates[idx] ? formatDate(dates[idx]) : '', maxRotation: 45 }, grid: { color: '#21262d' }, border: { color: '#30363d' } },
        y: { ticks: { color: '#8b949e', callback: (val) => `₹${val.toLocaleString('en-IN')}` }, grid: { color: '#21262d' }, border: { color: '#30363d' } },
      },
    },
  });
}

function _renderSpotlightTradesList(trades) {
  const container = document.getElementById('sp-trades-list');
  if (!container) return;
  if (!trades || trades.length === 0) { container.innerHTML = '<p class="text-muted">No trades recorded.</p>'; return; }
  const recent = [...trades].reverse().slice(0, 20);
  container.innerHTML = recent.map((trade, idx) => {
    const ret      = trade.return_pct != null ? Number(trade.return_pct).toFixed(2) : null;
    const isWin    = ret != null && parseFloat(ret) >= 0;
    const rowClass = isWin ? 'trade-row trade-win' : 'trade-row trade-loss';
    const retSign  = ret != null ? (parseFloat(ret) >= 0 ? '+' : '') : '';
    const retColor = isWin ? '#3fb950' : '#ff4d6d';
    const buyDate  = trade.buy_date  ? formatDate(trade.buy_date)  : '—';
    const sellDate = trade.sell_date ? formatDate(trade.sell_date) : 'Holding';
    const buyPrice = trade.buy_price  != null ? formatPrice(trade.buy_price)  : '—';
    const sellPrice= trade.sell_price != null ? formatPrice(trade.sell_price) : '—';
    return `<div class="${rowClass}">
      <div class="trade-num">#${trades.length - idx}</div>
      <div class="trade-dates">
        <span class="trade-buy">BUY: ${buyDate} @ ${buyPrice}</span>
        <span class="trade-sell">SELL: ${sellDate} @ ${sellPrice}</span>
      </div>
      <div class="trade-return" style="color:${retColor}">${ret != null ? `${retSign}${ret}%` : '—'} ${isWin ? '▲' : '▼'}</div>
    </div>`;
  }).join('');
}

/* ─── 7. Stock Chart ────────────────────────────────────── */
async function loadStockChart(ticker) {
  const loading   = document.getElementById('chart-loading');
  const chartBody = document.getElementById('chart-body');
  const canvas    = document.getElementById('stock-chart');

  if (loading)   loading.style.display   = 'flex';
  if (chartBody) chartBody.style.display = 'none';

  if (state.stockChart) {
    state.stockChart.destroy();
    state.stockChart = null;
  }

  try {
    const params = new URLSearchParams({
      ma_type:     state.maType,
      fast_period: state.fastPeriod,
      slow_period: state.slowPeriod,
      period:      '6mo',
    });

    const response = await fetch(`/api/chart/${encodeURIComponent(ticker)}?${params}`);
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Chart data unavailable (${response.status})`);
    }

    const data = await response.json();

    if (loading)   loading.style.display   = 'none';
    if (chartBody) chartBody.style.display = 'block';

    const dates     = data.dates     || [];
    const closes    = data.close     || [];
    const fastMA    = data.fast_ma   || [];
    const slowMA    = data.slow_ma   || [];
    const avwap     = data.avwap     || [];

    // Build datasets, only include non-empty series
    const datasets = [
      {
        label:           'Close',
        data:            closes,
        borderColor:     '#00d4aa',
        backgroundColor: 'rgba(0, 212, 170, 0.04)',
        borderWidth:     2,
        pointRadius:     0,
        pointHoverRadius: 4,
        tension:         0.2,
        fill:            false,
        order:           1,
      },
      {
        label:           `Fast MA (${state.maType} ${state.fastPeriod})`,
        data:            fastMA,
        borderColor:     '#58a6ff',
        backgroundColor: 'transparent',
        borderWidth:     1.5,
        borderDash:      [5, 3],
        pointRadius:     0,
        pointHoverRadius: 3,
        tension:         0.2,
        fill:            false,
        order:           2,
      },
      {
        label:           `Slow MA (${state.maType} ${state.slowPeriod})`,
        data:            slowMA,
        borderColor:     '#ff4d6d',
        backgroundColor: 'transparent',
        borderWidth:     1.5,
        borderDash:      [5, 3],
        pointRadius:     0,
        pointHoverRadius: 3,
        tension:         0.2,
        fill:            false,
        order:           3,
      },
      {
        label:           'AVWAP',
        data:            avwap,
        borderColor:     '#f59e0b',
        backgroundColor: 'transparent',
        borderWidth:     2,
        borderDash:      [2, 2],
        pointRadius:     0,
        pointHoverRadius: 3,
        tension:         0.2,
        fill:            false,
        order:           4,
      },
    ];

    // Reduce x-axis label density: show every 10th label
    const labelSkip = Math.max(1, Math.floor(dates.length / 13));

    state.stockChart = new Chart(canvas, {
      type: 'line',
      data: { labels: dates, datasets },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        interaction: {
          mode:        'index',
          intersect:   false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color:      '#8b949e',
              boxWidth:   20,
              padding:    12,
              font:       { size: 11 },
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: '#1c2128',
            titleColor:      '#e6edf3',
            bodyColor:       '#8b949e',
            borderColor:     '#30363d',
            borderWidth:     1,
            callbacks: {
              label: (ctx) => {
                if (ctx.parsed.y == null) return null;
                return ` ${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color:        '#8b949e',
              maxTicksLimit: 13,
              callback: (val, index) => {
                if (index % labelSkip !== 0) return '';
                return dates[index] ? formatDate(dates[index]) : '';
              },
              maxRotation: 45,
              minRotation: 0,
            },
            grid:   { color: '#21262d' },
            border: { color: '#30363d' },
          },
          y: {
            ticks: {
              color: '#8b949e',
              callback: (val) => `₹${val.toLocaleString('en-IN')}`,
            },
            grid:   { color: '#21262d' },
            border: { color: '#30363d' },
          },
        },
      },
    });

    // Update legend labels
    const legendFast = document.getElementById('legend-fast');
    const legendSlow = document.getElementById('legend-slow');
    if (legendFast) legendFast.textContent = `${state.maType} ${state.fastPeriod}`;
    if (legendSlow) legendSlow.textContent = `${state.maType} ${state.slowPeriod}`;

  } catch (err) {
    if (loading) {
      loading.style.display = 'flex';
      loading.innerHTML = `<span style="color:var(--red)">⚠ ${err.message}</span>`;
    }
  }
}

/* ─── 8. Backtest ───────────────────────────────────────── */
async function loadBacktest(ticker) {
  const loading  = document.getElementById('backtest-loading');
  const results  = document.getElementById('backtest-results');
  const errorDiv = document.getElementById('backtest-error');

  if (loading)  loading.style.display  = 'flex';
  if (results)  results.style.display  = 'none';
  if (errorDiv) errorDiv.style.display = 'none';

  try {
    const payload = {
      ticker,
      ma_type:     state.maType,
      fast_period: state.fastPeriod,
      slow_period: state.slowPeriod,
      hold_days:   state.holdDays,
    };

    const response = await fetch('/api/backtest', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Backtest failed (${response.status})`);
    }

    const data = await response.json();

    if (loading) loading.style.display = 'none';
    if (results) results.style.display = 'block';

    // API returns values already as percentages (e.g. win_rate: 68.5, avg_return: 14.2)
    const winRate     = data.win_rate     != null ? Number(data.win_rate).toFixed(1)     : null;
    const avgReturn   = data.avg_return   != null ? Number(data.avg_return).toFixed(2)   : null;
    const maxDD       = data.max_drawdown != null ? Number(data.max_drawdown).toFixed(2) : null;
    const trades      = data.total_trades != null ? data.total_trades                    : '—';
    const totalReturn = data.total_return != null ? Number(data.total_return).toFixed(2) : null;
    const finalEquity = data.final_equity != null ? formatPrice(data.final_equity)       : '—';

    // Stat card IDs match the HTML: stat-winrate, stat-avgreturn, stat-maxdd, stat-trades, stat-totalret, stat-equity
    const wr = document.getElementById('stat-winrate');
    const ar = document.getElementById('stat-avgreturn');
    const md = document.getElementById('stat-maxdd');
    const tr = document.getElementById('stat-trades');
    const to = document.getElementById('stat-totalret');
    const eq = document.getElementById('stat-equity');

    if (wr) { wr.textContent = winRate != null ? `${winRate}%` : '—'; wr.style.color = parseFloat(winRate) > 60 ? 'var(--accent)' : 'var(--text)'; }
    if (ar) { ar.textContent = avgReturn != null ? `${parseFloat(avgReturn) >= 0 ? '+' : ''}${avgReturn}%` : '—'; ar.style.color = parseFloat(avgReturn) >= 0 ? 'var(--accent)' : 'var(--red)'; }
    if (md) { md.textContent = maxDD != null ? `${maxDD}%` : '—'; }
    if (tr) { tr.textContent = trades; }
    if (to) { to.textContent = totalReturn != null ? `${parseFloat(totalReturn) >= 0 ? '+' : ''}${totalReturn}%` : '—'; to.style.color = parseFloat(totalReturn) >= 0 ? 'var(--accent)' : 'var(--red)'; }
    if (eq) { eq.textContent = finalEquity; }

    // ── Equity curve ─────────────────────────────────────
    if (data.equity_curve && data.equity_curve.length > 0) {
      renderEquityChart(data.equity_curve);
    }

    // ── Trades list ──────────────────────────────────────
    if (data.trades && data.trades.length > 0) {
      renderTradesList(data.trades);
    }

  } catch (err) {
    if (loading)  loading.style.display = 'none';
    if (errorDiv) {
      errorDiv.style.display = 'block';
      errorDiv.innerHTML = `<p>⚠ ${err.message}</p>`;
    }
  }
}

/** Helper: set a stat card's value and color class */
function _setStatCard(id, value, colorClass) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
  // Remove any existing color classes then apply new one
  el.classList.remove('stat-green', 'stat-red', 'stat-neutral');
  if (colorClass) el.classList.add(colorClass);
}

function renderEquityChart(equityCurve) {
  const canvas = document.getElementById('equity-chart');
  if (!canvas) return;

  if (state.equityChart) {
    state.equityChart.destroy();
    state.equityChart = null;
  }

  const dates  = equityCurve.map(p => p.date  || p[0]);
  const values = equityCurve.map(p => p.equity != null ? p.equity : p[1]);

  const startVal = values[0] || 10000;
  const endVal   = values[values.length - 1] || startVal;
  const isProfit = endVal >= startVal;
  const lineColor = isProfit ? '#3fb950' : '#ff4d6d';
  const fillColor = isProfit ? 'rgba(63, 185, 80, 0.08)' : 'rgba(255, 77, 109, 0.08)';

  state.equityChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label:           'Portfolio Equity',
        data:            values,
        borderColor:     lineColor,
        backgroundColor: fillColor,
        borderWidth:     2,
        pointRadius:     0,
        pointHoverRadius: 4,
        tension:         0.2,
        fill:            true,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1c2128',
          titleColor:      '#e6edf3',
          bodyColor:       '#8b949e',
          borderColor:     '#30363d',
          borderWidth:     1,
          callbacks: {
            label: (ctx) => ` Equity: ${formatPrice(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color:         '#8b949e',
            maxTicksLimit: 8,
            callback: (val, index) => dates[index] ? formatDate(dates[index]) : '',
            maxRotation:   45,
          },
          grid:   { color: '#21262d' },
          border: { color: '#30363d' },
        },
        y: {
          ticks: {
            color:    '#8b949e',
            callback: (val) => `₹${val.toLocaleString('en-IN')}`,
          },
          grid:   { color: '#21262d' },
          border: { color: '#30363d' },
        },
      },
    },
  });
}

function renderTradesList(trades) {
  const container = document.getElementById('trades-list');
  if (!container) return;

  if (!trades || trades.length === 0) {
    container.innerHTML = '<p class="text-muted">No trades recorded.</p>';
    return;
  }

  // Show last 20 trades, most recent first
  const recent = [...trades].reverse().slice(0, 20);

  container.innerHTML = recent.map((trade, idx) => {
    const ret      = trade.return_pct != null ? Number(trade.return_pct).toFixed(2) : null;
    const isWin    = ret != null && parseFloat(ret) >= 0;
    const rowClass = isWin ? 'trade-row trade-win' : 'trade-row trade-loss';
    const retSign  = ret != null ? (parseFloat(ret) >= 0 ? '+' : '') : '';
    const retColor = isWin ? '#3fb950' : '#ff4d6d';

    const buyDate  = trade.buy_date  ? formatDate(trade.buy_date)  : '—';
    const sellDate = trade.sell_date ? formatDate(trade.sell_date) : 'Holding';
    const buyPrice = trade.buy_price  != null ? formatPrice(trade.buy_price)  : '—';
    const sellPrice= trade.sell_price != null ? formatPrice(trade.sell_price) : '—';

    return `<div class="${rowClass}">
      <div class="trade-num">#${trades.length - idx}</div>
      <div class="trade-dates">
        <span class="trade-buy">BUY: ${buyDate} @ ${buyPrice}</span>
        <span class="trade-sell">SELL: ${sellDate} @ ${sellPrice}</span>
      </div>
      <div class="trade-return" style="color:${retColor}">
        ${ret != null ? `${retSign}${ret}%` : '—'}
        ${isWin ? '▲' : '▼'}
      </div>
    </div>`;
  }).join('');
}

/* ─── 9. Watchlist ──────────────────────────────────────── */
function addToWatchlist(ticker) {
  const stock = state.results.find(s => s.ticker === ticker);
  if (!stock) {
    showToast('Stock not found in current results.', 'error');
    return;
  }

  const alreadyIn = state.watchlist.some(w => w.ticker === ticker);
  if (alreadyIn) {
    showToast(`${ticker.replace('.NS','').replace('.BO','')} is already in your watchlist.`, 'warning');
    return;
  }

  state.watchlist.push({
    ticker:       stock.ticker,
    name:         stock.name             || ticker,
    sector:       stock.sector           || '—',
    price:        stock.price,
    score:        stock.confidence_score,
    avwap_status: stock.avwap_status     || 'unknown',
    added_at:    new Date().toISOString(),
  });

  saveWatchlist();
  renderWatchlist();
  // Refresh star button state in table
  const watchBtns = document.querySelectorAll(`.watch-btn`);
  watchBtns.forEach(btn => {
    const row = btn.closest('tr');
    if (row) {
      const chartBtn = row.querySelector('.chart-btn');
      if (chartBtn && chartBtn.getAttribute('onclick')?.includes(ticker)) {
        btn.classList.add('active');
      }
    }
  });

  showToast(`⭐ ${stock.name || ticker} added to watchlist.`, 'success');
}

function removeFromWatchlist(ticker) {
  state.watchlist = state.watchlist.filter(w => w.ticker !== ticker);
  saveWatchlist();
  renderWatchlist();
  showToast(`Removed from watchlist.`, 'success');
}

function clearWatchlist() {
  if (state.watchlist.length === 0) return;
  state.watchlist = [];
  saveWatchlist();
  renderWatchlist();
  showToast('Watchlist cleared.', 'success');
}

/* ── Watchlist peek/expand state ────────────────────────── */
let _wlExpanded = false;

/** Build one watchlist stock card HTML string */
function _buildWatchCard(stock) {
  const base       = stock.ticker.replace('.NS','').replace('.BO','');
  const score      = stock.score != null ? Number(stock.score).toFixed(1) : null;
  const scoreClass = getScoreClass(score);
  const avwapBadge = getAVWAPBadge(stock.avwap_status);
  const isBreached = stock.avwap_status === 'below';
  const cardClass  = isBreached ? 'watchlist-card breached' : 'watchlist-card';
  const breachWarn = isBreached
    ? '<span class="breach-warn" title="Price fell below AVWAP">⚠ Breached AVWAP</span>'
    : '';
  const price     = stock.price != null ? formatPrice(stock.price) : '—';
  const addedDate = stock.added_at ? formatDate(stock.added_at.split('T')[0]) : '';
  return `<div class="${cardClass}" data-ticker="${stock.ticker}">
    <div class="wl-header">
      <div class="wl-name">
        <strong>${base}</strong>
        <small class="text-muted">${stock.name || ''}</small>
      </div>
      <button class="remove-btn" onclick="removeFromWatchlist('${stock.ticker}')" title="Remove from watchlist">✕</button>
    </div>
    <div class="wl-body">
      <div class="wl-price">${price}</div>
      <div class="wl-score">${score != null ? `<span class="score-badge ${scoreClass}">${score}%</span>` : ''}</div>
      <div class="wl-avwap">${avwapBadge}</div>
    </div>
    ${breachWarn}
    <div class="wl-footer">
      <span class="sector-tag">${stock.sector || '—'}</span>
      <small class="text-muted">Added ${addedDate}</small>
    </div>
  </div>`;
}

/** Compute how many cards fit in one grid row given the container width */
function _wlColumnsPerRow(container) {
  const minCardW  = 200; // matches CSS minmax(200px, 1fr)
  const gap       = 12;  // matches CSS gap: 12px
  const padH      = 40;  // 20px left + 20px right padding on .watchlist-items
  const rawW      = container.clientWidth || 0;
  // If element isn't rendered yet, fall back to parent width or a sensible default
  const w = rawW > padH ? rawW - padH : (container.parentElement?.clientWidth || 800);
  return Math.max(1, Math.floor((w + gap) / (minCardW + gap)));
}

function renderWatchlist() {
  const items = document.getElementById('watchlist-items');
  const count = document.getElementById('watchlist-count');

  if (state.watchlist.length === 0) {
    _hideSection('watchlist');
    _wlExpanded = false;
    return;
  }

  _showSection('watchlist');
  if (count) count.textContent = state.watchlist.length;
  const wlSub = document.getElementById('watchlist-sub');
  if (wlSub) wlSub.textContent = `${state.watchlist.length} stock${state.watchlist.length !== 1 ? 's' : ''} monitored`;

  if (!items) return;

  const total = state.watchlist.length;
  const cols  = _wlColumnsPerRow(items);

  // If all cards fit in one row (or fewer), just show them all — no peek needed
  if (total <= cols) {
    items.innerHTML = state.watchlist.map(_buildWatchCard).join('');
    _wlExpanded = false;
    return;
  }

  if (_wlExpanded) {
    // ── EXPANDED: show all real cards + a "See less" card at the end ──
    const seeMoreCard = `<div class="watchlist-card wl-seemore-card" onclick="toggleWatchlistExpand()" title="Collapse">
      <div class="wl-seemore-inner">
        <span class="wl-seemore-icon">▲</span>
        <span class="wl-seemore-label">See less</span>
      </div>
    </div>`;
    items.innerHTML = state.watchlist.map(_buildWatchCard).join('') + seeMoreCard;
  } else {
    // ── PEEK: show cols-1 real cards + 1 "See all N more" card ──
    const visible  = cols - 1;
    const hidden   = total - visible;
    const cards    = state.watchlist.slice(0, visible).map(_buildWatchCard).join('');
    const seeMoreCard = `<div class="watchlist-card wl-seemore-card" onclick="toggleWatchlistExpand()" title="Show all ${total} stocks">
      <div class="wl-seemore-inner">
        <span class="wl-seemore-icon">+${hidden}</span>
        <span class="wl-seemore-label">See all</span>
        <small class="wl-seemore-sub">${total} stocks</small>
      </div>
    </div>`;
    items.innerHTML = cards + seeMoreCard;
  }
}

function toggleWatchlistExpand() {
  _wlExpanded = !_wlExpanded;
  renderWatchlist();
}

function saveWatchlist() {
  try {
    localStorage.setItem('momentum_watchlist', JSON.stringify(state.watchlist));
  } catch (e) {
    // localStorage may be unavailable (private browsing quota exceeded, etc.)
    console.warn('Could not save watchlist to localStorage:', e);
  }
}

function loadWatchlist() {
  try {
    const raw = localStorage.getItem('momentum_watchlist');
    state.watchlist = raw ? JSON.parse(raw) : [];
  } catch (e) {
    state.watchlist = [];
  }
}

/* ─── 9b. Watchlist Screener ────────────────────────────── */
async function runWatchlistScreen() {
  if (state.watchlist.length === 0) {
    showToast('Your watchlist is empty.', 'warning');
    return;
  }

  // Read live form values into state (same as runScreener does)
  state.fastPeriod    = parseInt(document.getElementById('fast-period')?.value  || state.fastPeriod,  10);
  state.slowPeriod    = parseInt(document.getElementById('slow-period')?.value  || state.slowPeriod,  10);
  state.crossoverDays = parseInt(document.getElementById('crossover-days')?.value || state.crossoverDays, 10);
  state.holdDays      = parseInt(document.getElementById('hold-days')?.value    || state.holdDays,    10);
  state.avwapFilter   = document.getElementById('avwap-filter')?.checked ?? state.avwapFilter;
  state.rsFilter      = document.getElementById('rs-filter')?.checked    ?? state.rsFilter;

  if (state.fastPeriod >= state.slowPeriod) {
    showToast('Fast period must be less than slow period.', 'error');
    return;
  }

  // Spinner on button
  const btn = document.getElementById('wl-run-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Running…'; }

  // Hide previous results
  document.getElementById('wl-results-section').style.display = 'none';

  try {
    const tickers = state.watchlist.map(w => w.ticker);
    const payload = {
      tickers,
      ma_type:        state.maType,
      fast_period:    state.fastPeriod,
      slow_period:    state.slowPeriod,
      crossover_days: state.crossoverDays,
      avwap_filter:   state.avwapFilter,
      rs_filter:      state.rsFilter,
    };

    const response = await fetch('/api/screen/watchlist', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();

    // Add matched AND skipped stocks to state.results so openModal works for both
    [...(data.stocks || []), ...(data.skipped || [])].forEach(s => {
      if (!state.results.find(r => r.ticker === s.ticker)) state.results.push(s);
    });

    // ── Update watchlist cards with fresh market data ──────────
    // Both matched (stocks) and skipped contain current price/AVWAP/RS/ADX
    const allFresh = [...(data.stocks || []), ...(data.skipped || [])];
    allFresh.forEach(fresh => {
      const wlItem = state.watchlist.find(w => w.ticker === fresh.ticker);
      if (wlItem) {
        if (fresh.price        != null) wlItem.price        = fresh.price;
        if (fresh.avwap_status != null) wlItem.avwap_status = fresh.avwap_status;
        if (fresh.rs_vs_nifty  != null) wlItem.rs_vs_nifty  = fresh.rs_vs_nifty;
        if (fresh.adx          != null) wlItem.adx           = fresh.adx;
        if (fresh.volume_ratio != null) wlItem.volume_ratio  = fresh.volume_ratio;
        // confidence_score only present for matched stocks
        if (fresh.confidence_score != null) wlItem.score = fresh.confidence_score;
      }
    });
    saveWatchlist();
    renderWatchlist(); // re-render cards with fresh data

    renderWatchlistResults(data);

  } catch (err) {
    showToast(err.message || 'Watchlist screen failed.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '▶ Run on Watchlist'; }
  }
}

function renderWatchlistResults(data) {
  const matched  = data.stocks  || [];
  const skipped  = data.skipped || [];
  const strategy = `${state.maType} ${state.fastPeriod}/${state.slowPeriod}`;

  // Show the results section
  document.getElementById('wl-results-section').style.display = 'block';

  // Strategy label
  const stratLbl = document.getElementById('wl-strategy-label');
  if (stratLbl) stratLbl.textContent = strategy;

  // Summary pills
  const summaryEl = document.getElementById('wl-results-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div class="wl-pill wl-pill-total">🔍 Scanned <strong>${data.screened ?? state.watchlist.length}</strong></div>
      <div class="wl-pill wl-pill-pass">✅ Passed <strong>${matched.length}</strong></div>
      <div class="wl-pill wl-pill-fail">❌ Filtered Out <strong>${skipped.length}</strong></div>
    `;
  }

  // ── Matched stocks table ────────────────────────────────────
  const matchedSection = document.getElementById('wl-matched-section');
  const matchedCount   = document.getElementById('wl-matched-count');
  const matchedTbody   = document.getElementById('wl-matched-tbody');

  if (matchedCount) matchedCount.textContent = matched.length;

  if (matched.length > 0 && matchedSection && matchedTbody) {
    matchedSection.style.display = 'block';
    matchedTbody.innerHTML = matched.map(s => {
      const ticker     = s.ticker || '';
      const base       = ticker.replace('.NS','').replace('.BO','');
      const score      = s.confidence_score != null ? Number(s.confidence_score).toFixed(1) : null;
      const scoreClass = getScoreClass(score);
      const crossDate  = s.crossover_date ? formatDate(s.crossover_date) : '—';
      const avwapPrice = s.avwap != null ? formatPrice(s.avwap) : '—';
      const inWatch    = state.watchlist.some(w => w.ticker === ticker);
      return `<tr>
        <td><span class="ticker-cell">${base}</span><br><small style="color:var(--muted);font-size:.68rem">${s.name || ''}</small></td>
        <td><span class="sector-tag">${s.sector || '—'}</span></td>
        <td class="text-right price-cell">${s.price != null ? formatPrice(s.price) : '—'}</td>
        <td class="text-center">${score != null ? `<span class="score-badge ${scoreClass}">${score}%</span>` : '—'}</td>
        <td>${crossDate}</td>
        <td class="text-right">${avwapPrice}</td>
        <td class="text-center">${getAVWAPBadge(s.avwap_status)}</td>
        <td class="text-right">${s.rs_vs_nifty != null ? formatRS(s.rs_vs_nifty) : '—'}</td>
        <td class="text-right volume-cell">${s.volume_ratio != null ? s.volume_ratio.toFixed(1) + 'x' : '—'}</td>
        <td class="text-right">${s.adx != null ? s.adx.toFixed(1) : '—'}</td>
        <td class="text-center">
          <div class="btn-group">
            <button class="action-btn chart-btn"    onclick="openModal('${ticker}')"             title="View Chart">📈</button>
            <button class="action-btn backtest-btn" onclick="openModal('${ticker}','backtest')"  title="Backtest">🧪</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  } else if (matchedSection) {
    matchedSection.style.display = 'none';
  }

  // ── Skipped stocks (same table layout as matched) ──────────
  const skippedSection = document.getElementById('wl-skipped-section');
  const skippedCount   = document.getElementById('wl-skipped-count');
  const skippedTbody   = document.getElementById('wl-skipped-tbody');

  if (skippedCount) skippedCount.textContent = skipped.length;

  if (skipped.length > 0 && skippedSection && skippedTbody) {
    skippedSection.style.display = 'block';
    skippedTbody.innerHTML = skipped.map(s => {
      const ticker     = s.ticker || '';
      const base       = ticker.replace('.NS','').replace('.BO','');
      const avwapPrice = s.avwap != null ? formatPrice(s.avwap) : '—';
      // Fail reasons as inline badges in the "Failed Filters" column
      const reasons    = (s.fail_reasons || []).map(r => `<span class="fail-reason">${r}</span>`).join(' ');
      // Build meta string for onclick (escape for JS string literal)
      const safeNameJs   = (s.name   || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const safeSectorJs = (s.sector || '').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      const metaJs = `{sector:'${safeSectorJs}',avwap_status:'${s.avwap_status||'unknown'}',price:${s.price??null},rs_vs_nifty:${s.rs_vs_nifty??null},adx:${s.adx??null}}`;
      return `<tr>
        <td><span class="ticker-cell">${base}</span><br><small style="color:var(--muted);font-size:.68rem">${s.name || ''}</small></td>
        <td><span class="sector-tag">${s.sector || '—'}</span></td>
        <td class="text-right price-cell">${s.price != null ? formatPrice(s.price) : '—'}</td>
        <td class="text-center">${s.confidence_score != null && s.confidence_score > 0 ? `<span class="score-badge ${getScoreClass(s.confidence_score)}">${s.confidence_score}%</span>` : '<span class="score-badge score-low" style="opacity:.45">—</span>'}</td>
        <td>${reasons}</td>
        <td class="text-right">${avwapPrice}</td>
        <td class="text-center">${getAVWAPBadge(s.avwap_status)}</td>
        <td class="text-right">${s.rs_vs_nifty != null ? formatRS(s.rs_vs_nifty) : '—'}</td>
        <td class="text-right volume-cell">${s.volume_ratio != null ? s.volume_ratio.toFixed(1) + 'x' : '—'}</td>
        <td class="text-right">${s.adx != null ? s.adx.toFixed(1) : '—'}</td>
        <td class="text-center">
          <div class="btn-group">
            <button class="action-btn chart-btn"    onclick="openModal('${ticker}')"            title="View Chart">📈</button>
            <button class="action-btn backtest-btn" onclick="openModal('${ticker}','backtest')" title="Backtest">🧪</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  } else if (skippedSection) {
    skippedSection.style.display = 'none';
  }

  // Scroll to the results smoothly
  document.getElementById('wl-results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ─── 10. Toast Notifications ───────────────────────────── */
let _toastTimer = null;

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // Reset classes
  toast.className = 'toast';
  toast.classList.add(type);
  toast.textContent = message;
  toast.style.display = 'block';
  toast.classList.add('show');

  // Clear any existing timer
  if (_toastTimer) clearTimeout(_toastTimer);

  _toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    // Wait for CSS transition to finish before hiding
    setTimeout(() => {
      toast.style.display = 'none';
    }, 400);
  }, 3000);
}

/* ─── 11. Utilities ─────────────────────────────────────── */

/**
 * Format a number as Indian Rupee: ₹2,34,567.89
 */
function formatPrice(p) {
  if (p == null || isNaN(p)) return '—';
  return '₹' + Number(p).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format ISO date string "2026-03-10" → "Mar 10, 2026"
 * Also handles datetime strings by using only the date part.
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  // Normalize: take only date portion in case of datetime string
  const datePart = String(dateStr).slice(0, 10);
  // Append T00:00 to avoid UTC/local offset shifting the date
  const d = new Date(datePart + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    year:  'numeric',
    month: 'short',
    day:   'numeric',
  });
}

/**
 * Format relative strength vs Nifty.
 * Returns an HTML string with color applied.
 * @param {number} rs  e.g. 12.5 (percent) or 0.125 (decimal fraction)
 */
function formatRS(rs) {
  if (rs == null || isNaN(rs)) return '<span>—</span>';

  // Normalise: if absolute value < 2 it's likely a decimal fraction → convert
  let pct = Math.abs(rs) < 2 ? rs * 100 : rs;
  const sign   = pct >= 0 ? '+' : '';
  const color  = pct >= 0 ? '#3fb950' : '#ff4d6d';
  return `<span style="color:${color};font-weight:500">${sign}${pct.toFixed(1)}%</span>`;
}

/**
 * Map a confidence score to a CSS class.
 */
function getScoreClass(score) {
  const s = Number(score);
  if (s >= 60) return 'score-high';   // ≥60% win rate → green
  if (s >= 40) return 'score-med';    // 40–59% win rate → orange
  return 'score-low';                 // <40% win rate → red
}

/**
 * Return an HTML badge for AVWAP position status.
 * @param {string} status  'above' | 'near' | 'below' | 'unknown'
 */
function getAVWAPBadge(status) {
  switch ((status || '').toLowerCase()) {
    case 'above':
      return '<span class="avwap-badge avwap-above">✓ Above</span>';
    case 'near':
      return '<span class="avwap-badge avwap-near">≈ Near</span>';
    case 'below':
      return '<span class="avwap-badge avwap-below">✗ Below</span>';
    default:
      return '<span class="avwap-badge avwap-unknown">— N/A</span>';
  }
}

/* ─── Bootstrap ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
