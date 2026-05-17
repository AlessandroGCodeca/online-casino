/* Royal Flush Casino — Main Application */
window.Casino = {
    balance: 10000,
    games: {},
    currentGame: null,
    soundEnabled: true,
    theme: 'dark',
    lastDailyBonus: 0,
    lastRescue: 0,
    achievements: [],
    vip: { xp: 0, level: 0 },
    inventory: { deck: 'default', theme: 'default', owned: ['default_deck', 'default_theme'] },
    stats: { totalWagered: 0, totalWon: 0, biggestWin: 0, gamesPlayed: 0, winStreak: 0, bestStreak: 0, jackpots: 0 },
    recentlyPlayed: [],
    playCounts: {},
    betHistory: [],
    missions: { date: '', list: [] },
    dailyStats: { date: '', rounds: 0, wins: 0, wagered: 0, gamesSet: [], bestMult: 0 }
};

const STARTING_BALANCE = 10000;
const RESCUE_AMOUNT = 1000;
const RESCUE_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h
const BET_HISTORY_MAX = 30;
const RECENT_MAX = 6;

const DEFAULT_STATS = { totalWagered: 0, totalWon: 0, biggestWin: 0, gamesPlayed: 0, winStreak: 0, bestStreak: 0, jackpots: 0 };
const DEFAULT_DAILY = { date: '', rounds: 0, wins: 0, wagered: 0, gamesSet: [], bestMult: 0 };

const VIP_TIERS = [
    { name: 'Bronze', xp: 0, icon: '🥉', bonus: 1000 },
    { name: 'Silver', xp: 5000, icon: '🥈', bonus: 2500 },
    { name: 'Gold', xp: 25000, icon: '🥇', bonus: 5000 },
    { name: 'Platinum', xp: 100000, icon: '💎', bonus: 10000 },
    { name: 'Diamond', xp: 500000, icon: '👑', bonus: 25000 }
];

const SHOP_ITEMS = [
    { id: 'neon_deck', name: 'Neon Deck', type: 'deck', price: 5000, icon: '🃏' },
    { id: 'gold_deck', name: 'Gold Deck', type: 'deck', price: 20000, icon: '🎴' },
    { id: 'purple_theme', name: 'Royal Purple Theme', type: 'theme', price: 10000, icon: '🟣' },
    { id: 'crimson_theme', name: 'Crimson Theme', type: 'theme', price: 10000, icon: '🔴' }
];

const ACHIEVEMENTS_DATA = [
    { id: 'first_win', name: 'First Win', icon: '🎯', desc: 'Win your first game', reward: 500 },
    { id: 'high_roller', name: 'High Roller', icon: '🎩', desc: 'Place a total of $10,000 in bets', reward: 1000 },
    { id: 'lucky_streak', name: 'Lucky Streak', icon: '🔥', desc: 'Win 5 games in a row', reward: 2000 },
    { id: 'jackpot', name: 'Jackpot!', icon: '🎰', desc: 'Hit a major jackpot in any game', reward: 5000 },
    { id: 'veteran', name: 'Casino Veteran', icon: '👑', desc: 'Play 100 total rounds', reward: 10000 }
];

const GAME_CARDS = [
    { id: 'slots', name: 'Slot Machine', icon: '🎰', desc: 'Spin the reels and hit the jackpot!', accent: '#e74c3c', category: 'spin' },
    { id: 'blackjack', name: 'Blackjack', icon: '🃏', desc: 'Beat the dealer to 21!', accent: '#22c55e', category: 'cards' },
    { id: 'roulette', name: 'Roulette', icon: '🎡', desc: 'Place your bets on the wheel!', accent: '#8b5cf6', category: 'spin' },
    { id: 'poker', name: 'Video Poker', icon: '🂡', desc: 'Jacks or Better draw poker!', accent: '#3b82f6', category: 'cards' },
    { id: 'crash', name: 'Crash', icon: '🚀', desc: 'Cash out before the crash!', accent: '#f59e0b', category: 'instant' },
    { id: 'mines', name: 'Mines', icon: '💣', desc: 'Reveal gems, avoid the mines!', accent: '#22c55e', category: 'instant' },
    { id: 'dice', name: 'Hi-Lo Dice', icon: '🎲', desc: 'Predict over or under the target!', accent: '#3b82f6', category: 'instant' },
    { id: 'baccarat', name: 'Baccarat', icon: '👑', desc: 'Classic high-roller card game!', accent: '#d4a843', category: 'cards' },
    { id: 'wheel', name: 'Wheel of Fortune', icon: '🎡', desc: 'Spin for multiplier prizes!', accent: '#8b5cf6', category: 'spin' },
    { id: 'keno', name: 'Keno', icon: '🔢', desc: 'Pick numbers and match to win!', accent: '#ef4444', category: 'instant' },
    { id: 'plinko', name: 'Plinko', icon: '🟢', desc: 'Drop the ball and hit the multipliers!', accent: '#22c55e', category: 'instant' }
];

const MISSION_POOL = [
    { type: 'rounds', target: 10, name: 'Warm Up', desc: 'Play 10 rounds today', reward: 500, icon: '🎯' },
    { type: 'rounds', target: 25, name: 'Marathon', desc: 'Play 25 rounds today', reward: 1500, icon: '🏃' },
    { type: 'wins', target: 5, name: 'Winning Vibe', desc: 'Win 5 games today', reward: 1000, icon: '🎉' },
    { type: 'wins', target: 15, name: 'On Fire', desc: 'Win 15 games today', reward: 3000, icon: '🔥' },
    { type: 'wagered', target: 5000, name: 'Big Spender', desc: 'Bet $5,000 in total today', reward: 1000, icon: '💰' },
    { type: 'wagered', target: 25000, name: 'Whale', desc: 'Bet $25,000 in total today', reward: 5000, icon: '🐋' },
    { type: 'variety', target: 3, name: 'Explorer', desc: 'Try 3 different games today', reward: 750, icon: '🗺️' },
    { type: 'variety', target: 6, name: 'Globetrotter', desc: 'Try 6 different games today', reward: 2000, icon: '🌍' },
    { type: 'multiplier', target: 5, name: 'Multiplier Magic', desc: 'Win at 5× your bet or higher', reward: 1500, icon: '⚡' },
    { type: 'multiplier', target: 25, name: 'Jackpot Hunter', desc: 'Win at 25× your bet or higher', reward: 5000, icon: '🎰' },
    { type: 'streak', target: 3, name: 'Triple Threat', desc: 'Win 3 games in a row', reward: 1000, icon: '🔱' },
    { type: 'streak', target: 6, name: 'Unstoppable', desc: 'Win 6 games in a row', reward: 4000, icon: '👑' }
];

const PROMOS = [
    '🎁 Claim your daily bonus from the hero banner!',
    '💎 Bet to earn XP and unlock VIP tiers with bigger daily bonuses.',
    '🛍️ Spend chips in the Reward Shop on decks and themes.',
    '🏆 Win 5 in a row to unlock the Lucky Streak achievement.',
    '🎯 Complete Daily Missions for bonus chips.',
    '⌨️ Pro tip: press Space to spin, Esc to leave a game.',
    '🚀 Crash, Plinko, Mines — instant games pay big multipliers.',
    '🃏 Card sharks: Blackjack, Baccarat and Video Poker await.'
];

/* ---- Utilities ---- */
function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function haptic(pattern) {
    if (!Casino.soundEnabled) return;
    if (navigator.vibrate) try { navigator.vibrate(pattern); } catch(e) {}
}
function $(id) { return document.getElementById(id); }
function today() { return new Date().toISOString().slice(0, 10); }

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    checkDailyReset();
    applyTheme();
    renderLobby();
    updateBalanceUI();
    updateVIPUI();
    checkDailyBonus();
    renderLeaderboard();
    renderMissions();
    renderRecentlyPlayed();
    renderRescue();
    initPromoCarousel();
    initMissionTimer();
    initLiveFeed();
    initKeyboard();

    bindClick('back-to-lobby', showLobby);
    $('logo-link').addEventListener('click', e => { e.preventDefault(); showLobby(); });
    bindClick('sound-toggle', toggleSound);
    bindClick('theme-toggle', toggleTheme);
    bindClick('stats-btn', showStats);
    bindClick('close-stats', () => closeModal('stats-modal'));
    bindClick('close-daily', () => closeModal('daily-modal'));
    bindClick('claim-daily-btn', claimDailyBonus);
    bindClick('shop-btn', openShop);
    bindClick('close-shop', () => closeModal('shop-modal'));
    bindClick('daily-bonus-btn', showDailyModal);
    bindClick('rescue-btn', claimRescueChips);
    bindClick('fullscreen-btn', toggleFullscreen);

    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(m.id); });
    });

    // Shop delegated interactions (CSP-friendly).
    $('shop-body').addEventListener('click', onShopClick);

    // Search + category filter
    const search = $('game-search');
    if (search) search.addEventListener('input', () => renderLobby());
    document.querySelectorAll('.cat-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderLobby();
        });
    });

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    }

    // Unlock audio on first interaction (mobile autoplay rules).
    const unlock = () => { primeAudio(); document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
});

function bindClick(id, fn) {
    const el = $(id);
    if (el) el.addEventListener('click', fn);
}

/* ---- State Persistence ---- */
function loadState() {
    try {
        const s = JSON.parse(localStorage.getItem('casino_state'));
        if (s) {
            Casino.balance = s.balance ?? STARTING_BALANCE;
            Casino.stats = Object.assign({}, DEFAULT_STATS, s.stats || {});
            Casino.soundEnabled = s.soundEnabled ?? true;
            Casino.theme = s.theme ?? 'dark';
            Casino.lastDailyBonus = s.lastDailyBonus ?? 0;
            Casino.lastRescue = s.lastRescue ?? 0;
            Casino.achievements = s.achievements ?? [];
            Casino.vip = s.vip ?? { xp: 0, level: 0 };
            Casino.inventory = s.inventory ?? { deck: 'default', theme: 'default', owned: ['default_deck', 'default_theme'] };
            Casino.recentlyPlayed = s.recentlyPlayed ?? [];
            Casino.playCounts = s.playCounts ?? {};
            Casino.betHistory = s.betHistory ?? [];
            Casino.missions = s.missions ?? { date: '', list: [] };
            Casino.dailyStats = Object.assign({}, DEFAULT_DAILY, s.dailyStats || {});
        }
    } catch(e) {}
    if (Casino.balance <= 0) Casino.balance = STARTING_BALANCE;
}
function saveState() {
    try {
        localStorage.setItem('casino_state', JSON.stringify({
            balance: Casino.balance,
            stats: Casino.stats,
            soundEnabled: Casino.soundEnabled,
            theme: Casino.theme,
            lastDailyBonus: Casino.lastDailyBonus,
            lastRescue: Casino.lastRescue,
            achievements: Casino.achievements,
            vip: Casino.vip,
            inventory: Casino.inventory,
            recentlyPlayed: Casino.recentlyPlayed,
            playCounts: Casino.playCounts,
            betHistory: Casino.betHistory,
            missions: Casino.missions,
            dailyStats: Casino.dailyStats
        }));
    } catch(e) {}
}

/* ---- Daily rollover (missions, daily stats) ---- */
function checkDailyReset() {
    const t = today();
    if (Casino.dailyStats.date !== t) {
        Casino.dailyStats = Object.assign({}, DEFAULT_DAILY, { date: t });
    }
    if (Casino.missions.date !== t) {
        Casino.missions = { date: t, list: generateMissions(t) };
    }
}
function generateMissions(date) {
    let seed = 0;
    for (const c of date) seed = (seed * 31 + c.charCodeAt(0)) | 0;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const pool = MISSION_POOL.slice();
    const picked = [];
    for (let i = 0; i < 3 && pool.length; i++) {
        const idx = Math.floor(rand() * pool.length);
        const m = pool.splice(idx, 1)[0];
        picked.push(Object.assign({}, m, { progress: 0, claimed: false, missionId: m.type + '_' + m.target }));
    }
    return picked;
}

/* ---- Balance & game outcome tracking ---- */
// pendingBet > 0 means an active bet is awaiting a result.
let pendingBet = 0;
let pendingGameId = null;

function updateBalanceUI() {
    $('balance-display').textContent = '$' + Casino.balance.toLocaleString();
}
function flashBalance(positive) {
    const el = $('balance-display');
    el.classList.remove('flash-green', 'flash-red');
    void el.offsetWidth;
    el.classList.add(positive ? 'flash-green' : 'flash-red');
}
function changeBalance(amount) {
    Casino.balance += amount;
    if (Casino.balance < 0) Casino.balance = 0;
    updateBalanceUI();
    flashBalance(amount >= 0);

    if (amount > 0 && pendingBet > 0) {
        const mult = amount / pendingBet;
        Casino.stats.totalWon += amount;
        if (amount > Casino.stats.biggestWin) Casino.stats.biggestWin = amount;
        Casino.stats.winStreak = (Casino.stats.winStreak || 0) + 1;
        if (Casino.stats.winStreak > Casino.stats.bestStreak) Casino.stats.bestStreak = Casino.stats.winStreak;
        if (amount >= pendingBet * 25) Casino.stats.jackpots = (Casino.stats.jackpots || 0) + 1;

        // Daily mission tracking
        Casino.dailyStats.wins++;
        if (mult > (Casino.dailyStats.bestMult || 0)) Casino.dailyStats.bestMult = mult;

        // Bet history
        recordBet({ game: pendingGameId, bet: pendingBet, won: amount, mult: mult });

        pendingBet = 0;
        pendingGameId = null;
        haptic([30, 40, 30]);
        updateMissionProgress();
    }

    checkAchievements();
    renderRescue();
    saveState();
}
function placeBet(amount) {
    if (amount > Casino.balance || amount <= 0) return false;
    checkDailyReset();

    // Previous round had a pending bet that never paid out → loss.
    if (pendingBet > 0) {
        Casino.stats.winStreak = 0;
        recordBet({ game: pendingGameId, bet: pendingBet, won: 0, mult: 0 });
    }

    Casino.balance -= amount;
    Casino.stats.totalWagered += amount;
    Casino.stats.gamesPlayed++;
    Casino.dailyStats.rounds++;
    Casino.dailyStats.wagered += amount;
    if (Casino.currentGame && !Casino.dailyStats.gamesSet.includes(Casino.currentGame)) {
        Casino.dailyStats.gamesSet.push(Casino.currentGame);
    }
    pendingBet = amount;
    pendingGameId = Casino.currentGame;

    Casino.vip.xp += amount;
    checkVIPLevelUp();
    updateVIPUI();

    updateBalanceUI();
    flashBalance(false);
    updateMissionProgress();
    renderRescue();
    saveState();
    return true;
}

function recordBet(entry) {
    entry.time = Date.now();
    Casino.betHistory.unshift(entry);
    if (Casino.betHistory.length > BET_HISTORY_MAX) Casino.betHistory.length = BET_HISTORY_MAX;
}

function checkVIPLevelUp() {
    let newLevel = 0;
    for (let i = VIP_TIERS.length - 1; i >= 0; i--) {
        if (Casino.vip.xp >= VIP_TIERS[i].xp) { newLevel = i; break; }
    }
    if (newLevel > Casino.vip.level) {
        Casino.vip.level = newLevel;
        const tier = VIP_TIERS[newLevel];
        showToast(`${tier.icon} VIP Level Up! You are now ${tier.name}!`);
        playSound('jackpot');
        haptic([60, 60, 120]);
    }
}

function updateVIPUI() {
    const tier = VIP_TIERS[Casino.vip.level];
    const nextTier = VIP_TIERS[Casino.vip.level + 1];

    $('vip-icon').textContent = tier.icon;
    $('vip-level-text').textContent = tier.name;

    if (nextTier) {
        const xpInCurrentTier = Casino.vip.xp - tier.xp;
        const xpNeededForNext = nextTier.xp - tier.xp;
        const pct = Math.min(100, Math.max(0, (xpInCurrentTier / xpNeededForNext) * 100));
        $('vip-xp-fill').style.width = `${pct}%`;
        $('vip-badge').title = `XP: ${Casino.vip.xp.toLocaleString()} / ${nextTier.xp.toLocaleString()}`;
    } else {
        $('vip-xp-fill').style.width = '100%';
        $('vip-badge').title = 'Max VIP Level!';
    }
}

Object.assign(window.Casino, { changeBalance, placeBet, updateBalanceUI, updateVIPUI, saveState });

/* ---- Sound (shared AudioContext) ---- */
let audioCtx = null;
function primeAudio() {
    if (!audioCtx) {
        try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function toggleSound() {
    Casino.soundEnabled = !Casino.soundEnabled;
    const btn = $('sound-toggle');
    btn.textContent = Casino.soundEnabled ? '🔊' : '🔇';
    btn.setAttribute('aria-pressed', String(!Casino.soundEnabled));
    saveState();
}
function playSound(type) {
    if (!Casino.soundEnabled) return;
    primeAudio();
    if (!audioCtx) return;
    const ctx = audioCtx;

    function tone(freq, wave, timeOffset, duration, vol) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + timeOffset);
        gain.gain.setValueAtTime(vol, ctx.currentTime + timeOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + timeOffset + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + timeOffset);
        osc.stop(ctx.currentTime + timeOffset + duration);
    }

    try {
        if (type === 'win') {
            [523, 659, 784, 1047].forEach((f, i) => { tone(f, 'sine', i * 0.1, 0.4, 0.1); tone(f * 2, 'triangle', i * 0.1, 0.3, 0.05); });
        } else if (type === 'lose') {
            tone(400, 'sawtooth', 0, 0.3, 0.05);
            tone(300, 'sawtooth', 0.15, 0.3, 0.05);
            tone(200, 'square', 0.3, 0.4, 0.05);
        } else if (type === 'click') {
            tone(800, 'sine', 0, 0.05, 0.05);
            tone(1200, 'triangle', 0, 0.05, 0.02);
        } else if (type === 'jackpot') {
            [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => { tone(f, 'square', i * 0.1, 0.5, 0.05); tone(f * 1.5, 'sine', i * 0.1, 0.6, 0.05); });
        } else {
            tone(600, 'sine', 0, 0.1, 0.05);
        }
    } catch(e) {}
}
window.Casino.playSound = playSound;

/* ---- Lobby ---- */
function getFilteredGames() {
    const q = ($('game-search')?.value || '').trim().toLowerCase();
    const activeCat = document.querySelector('.cat-tab.active')?.dataset.cat || 'all';
    return GAME_CARDS.filter(g => {
        if (activeCat !== 'all' && g.category !== activeCat) return false;
        if (q && !(g.name.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q))) return false;
        return true;
    });
}
function topPlayedIds(n) {
    return Object.entries(Casino.playCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .filter(e => e[1] > 0)
        .map(e => e[0]);
}
function renderLobby() {
    const grid = $('games-grid');
    grid.innerHTML = '';
    const hot = new Set(topPlayedIds(3));
    const filtered = getFilteredGames();

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="no-results">No games match your search.</div>`;
        return;
    }

    filtered.forEach((g, index) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'game-card slide-up';
        card.style.animationDelay = `${0.05 * index}s`;
        card.style.setProperty('--card-accent', g.accent);
        card.setAttribute('aria-label', `${g.name}: ${g.desc}`);
        const isNew = !Casino.playCounts[g.id];
        const isHot = hot.has(g.id);
        const badge = isHot ? '<span class="card-badge hot">🔥 HOT</span>' :
                      isNew ? '<span class="card-badge new">NEW</span>' : '';
        card.innerHTML = `${badge}<span class="game-card-icon" aria-hidden="true">${esc(g.icon)}</span><h3 class="game-card-name">${esc(g.name)}</h3><p class="game-card-desc">${esc(g.desc)}</p><span class="game-card-btn">Play Now</span>`;
        card.addEventListener('click', () => openGame(g.id));
        grid.appendChild(card);
    });
}

function renderRecentlyPlayed() {
    const section = $('recent-section');
    const row = $('recent-row');
    if (!section || !row) return;
    if (!Casino.recentlyPlayed.length) {
        section.classList.add('hidden');
        return;
    }
    section.classList.remove('hidden');
    row.innerHTML = '';
    Casino.recentlyPlayed.slice(0, RECENT_MAX).forEach(id => {
        const g = GAME_CARDS.find(c => c.id === id);
        if (!g) return;
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'recent-tile';
        tile.style.setProperty('--card-accent', g.accent);
        tile.setAttribute('aria-label', `Resume ${g.name}`);
        tile.innerHTML = `<span class="recent-tile-icon" aria-hidden="true">${esc(g.icon)}</span><span class="recent-tile-name">${esc(g.name)}</span>`;
        tile.addEventListener('click', () => openGame(id));
        row.appendChild(tile);
    });
}

/* ---- Navigation ---- */
function openGame(id) {
    const game = Casino.games[id];
    if (!game) return;
    playSound('click');
    const lobby = $('lobby');
    const container = $('game-container');
    const delay = reducedMotion ? 0 : 300;

    // Track recently played + play counts
    Casino.recentlyPlayed = [id, ...Casino.recentlyPlayed.filter(x => x !== id)].slice(0, RECENT_MAX);
    Casino.playCounts[id] = (Casino.playCounts[id] || 0) + 1;
    saveState();

    lobby.classList.add('fade-out');
    setTimeout(() => {
        lobby.classList.add('hidden');
        lobby.classList.remove('fade-out');
        container.classList.remove('hidden');
        container.classList.add('fade-in');

        const info = GAME_CARDS.find(g => g.id === id);
        $('game-title').textContent = info ? info.name : id;
        Casino.currentGame = id;
        const area = $('game-area');
        area.innerHTML = '';
        game.init(area);

        setTimeout(() => container.classList.remove('fade-in'), 300);
    }, delay);
}
function showLobby() {
    if (Casino.currentGame && Casino.games[Casino.currentGame] && Casino.games[Casino.currentGame].destroy) {
        Casino.games[Casino.currentGame].destroy();
    }
    Casino.currentGame = null;
    if (pendingBet > 0) {
        Casino.stats.winStreak = 0;
        recordBet({ game: pendingGameId, bet: pendingBet, won: 0, mult: 0 });
        pendingBet = 0;
        pendingGameId = null;
        saveState();
    }

    const lobby = $('lobby');
    const container = $('game-container');
    const delay = reducedMotion ? 0 : 300;

    container.classList.add('fade-out');
    setTimeout(() => {
        container.classList.add('hidden');
        container.classList.remove('fade-out');
        lobby.classList.remove('hidden');
        lobby.classList.add('fade-in');
        setTimeout(() => lobby.classList.remove('fade-in'), 300);
        // Refresh dynamic sections
        renderLeaderboard();
        renderRecentlyPlayed();
        renderLobby();
        renderMissions();
    }, delay);

    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

/* ---- Stats & Achievements ---- */
function showStats() {
    const body = $('stats-body');
    const s = Casino.stats;
    const net = s.totalWon - s.totalWagered;
    const cls = net >= 0 ? 'positive' : 'negative';
    body.innerHTML = `
        <div class="stat-row"><span class="stat-name">Current Balance</span><span class="stat-value">$${Casino.balance.toLocaleString()}</span></div>
        <div class="stat-row"><span class="stat-name">Total Wagered</span><span class="stat-value">$${s.totalWagered.toLocaleString()}</span></div>
        <div class="stat-row"><span class="stat-name">Total Won</span><span class="stat-value positive">$${s.totalWon.toLocaleString()}</span></div>
        <div class="stat-row"><span class="stat-name">Net Profit/Loss</span><span class="stat-value ${cls}">${net >= 0 ? '+' : ''}$${net.toLocaleString()}</span></div>
        <div class="stat-row"><span class="stat-name">Biggest Win</span><span class="stat-value">$${s.biggestWin.toLocaleString()}</span></div>
        <div class="stat-row"><span class="stat-name">Current Streak</span><span class="stat-value">${s.winStreak || 0} 🔥</span></div>
        <div class="stat-row"><span class="stat-name">Best Streak</span><span class="stat-value">${s.bestStreak || 0}</span></div>
        <div class="stat-row"><span class="stat-name">Jackpots Hit</span><span class="stat-value">${s.jackpots || 0}</span></div>
        <div class="stat-row"><span class="stat-name">Rounds Played</span><span class="stat-value">${s.gamesPlayed.toLocaleString()}</span></div>
        <button class="reset-btn" id="reset-stats-btn" type="button">Reset All Data</button>`;

    const achList = $('achievements-list');
    achList.innerHTML = '';
    ACHIEVEMENTS_DATA.forEach(a => {
        const unlocked = Casino.achievements.includes(a.id);
        const div = document.createElement('div');
        div.className = 'achievement-row' + (unlocked ? ' unlocked' : '');
        div.innerHTML = `
            <div class="achievement-icon">${esc(a.icon)}</div>
            <div class="achievement-body">
                <div class="achievement-name">${esc(a.name)}</div>
                <div class="achievement-desc">${esc(a.desc)}</div>
            </div>
            ${unlocked ? `<div class="achievement-reward">+$${a.reward}</div>` : ''}
        `;
        achList.appendChild(div);
    });

    renderBetHistory();

    $('reset-stats-btn').addEventListener('click', () => {
        if (!confirm('Reset ALL data — balance, stats, history, achievements, VIP, and shop items?')) return;
        Casino.balance = STARTING_BALANCE;
        Casino.stats = Object.assign({}, DEFAULT_STATS);
        Casino.achievements = [];
        Casino.lastDailyBonus = 0;
        Casino.lastRescue = 0;
        Casino.vip = { xp: 0, level: 0 };
        Casino.inventory = { deck: 'default', theme: 'default', owned: ['default_deck', 'default_theme'] };
        Casino.recentlyPlayed = [];
        Casino.playCounts = {};
        Casino.betHistory = [];
        Casino.missions = { date: '', list: [] };
        Casino.dailyStats = Object.assign({}, DEFAULT_DAILY);
        pendingBet = 0; pendingGameId = null;
        document.documentElement.style.removeProperty('--bg-primary');
        checkDailyReset();
        saveState();
        updateBalanceUI(); updateVIPUI(); renderLeaderboard(); renderLobby();
        renderRecentlyPlayed(); renderMissions(); renderRescue();
        showStats();
        showToast('All data reset.');
    });
    openModal('stats-modal');
}

function renderBetHistory() {
    const list = $('bet-history-list');
    if (!list) return;
    if (!Casino.betHistory.length) {
        list.innerHTML = '<div class="bet-empty">No bets yet — pick a game to start playing.</div>';
        return;
    }
    list.innerHTML = Casino.betHistory.slice(0, 15).map(b => {
        const g = GAME_CARDS.find(c => c.id === b.game);
        const icon = g ? g.icon : '🎲';
        const name = g ? g.name : (b.game || 'Game');
        const won = b.won > 0;
        const time = new Date(b.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const result = won
            ? `<span class="bet-result win">+$${b.won.toLocaleString()} <span class="bet-mult">${b.mult.toFixed(2)}×</span></span>`
            : `<span class="bet-result lose">−$${b.bet.toLocaleString()}</span>`;
        return `
            <div class="bet-row">
                <span class="bet-icon" aria-hidden="true">${esc(icon)}</span>
                <span class="bet-game">${esc(name)}</span>
                <span class="bet-time">${time}</span>
                ${result}
            </div>`;
    }).join('');
}

function checkAchievements() {
    const s = Casino.stats;
    const check = (id, condition) => {
        if (!Casino.achievements.includes(id) && condition) {
            Casino.achievements.push(id);
            const a = ACHIEVEMENTS_DATA.find(x => x.id === id);
            Casino.balance += a.reward;
            updateBalanceUI();
            saveState();
            showToast(`${a.icon} Achievement Unlocked: ${a.name}! (+$${a.reward})`);
            playSound('jackpot');
            haptic([40, 40, 80]);
        }
    };
    check('first_win', s.totalWon > 0);
    check('high_roller', s.totalWagered >= 10000);
    check('lucky_streak', (s.bestStreak || 0) >= 5);
    check('jackpot', (s.jackpots || 0) >= 1);
    check('veteran', s.gamesPlayed >= 100);
}
window.Casino.checkAchievements = checkAchievements;

function showToast(msg) {
    const container = $('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-leaving'); setTimeout(() => toast.remove(), 300); }, 4000);
}
window.Casino.showToast = showToast;

/* ---- Daily Bonus ---- */
function checkDailyBonus() {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    $('daily-bonus-btn').classList.toggle('hidden', now - Casino.lastDailyBonus <= msPerDay);
}
function showDailyModal() {
    const tier = VIP_TIERS[Casino.vip.level];
    $('daily-bonus-amount').textContent = `Claim $${tier.bonus.toLocaleString()}!`;
    openModal('daily-modal');
}
function claimDailyBonus() {
    const tier = VIP_TIERS[Casino.vip.level];
    Casino.balance += tier.bonus;
    updateBalanceUI();
    flashBalance(true);
    Casino.lastDailyBonus = Date.now();
    saveState();
    closeModal('daily-modal');
    $('daily-bonus-btn').classList.add('hidden');
    playSound('win');
    showWinEffect(tier.bonus);
    haptic([30, 30, 60]);
}

/* ---- Missions ---- */
function renderMissions() {
    const list = $('missions-list');
    if (!list) return;
    checkDailyReset();
    list.innerHTML = Casino.missions.list.map(m => {
        const pct = Math.min(100, (m.progress / m.target) * 100);
        const complete = m.progress >= m.target;
        return `
            <div class="mission-card${complete ? ' complete' : ''}${m.claimed ? ' claimed' : ''}">
                <div class="mission-icon" aria-hidden="true">${esc(m.icon)}</div>
                <div class="mission-body">
                    <div class="mission-name">${esc(m.name)}</div>
                    <div class="mission-desc">${esc(m.desc)}</div>
                    <div class="mission-progress">
                        <div class="mission-progress-bar"><div class="mission-progress-fill" style="width:${pct}%"></div></div>
                        <div class="mission-progress-text">${formatProgress(m)}</div>
                    </div>
                </div>
                <div class="mission-reward">${m.claimed ? '✓' : `+$${m.reward.toLocaleString()}`}</div>
            </div>`;
    }).join('');
}
function formatProgress(m) {
    if (m.type === 'wagered') return `$${Math.min(m.progress, m.target).toLocaleString()} / $${m.target.toLocaleString()}`;
    if (m.type === 'multiplier') return `${m.progress.toFixed(1)}× / ${m.target}×`;
    return `${Math.min(m.progress, m.target)} / ${m.target}`;
}
function updateMissionProgress() {
    if (!Casino.missions || !Casino.missions.list) return;
    const ds = Casino.dailyStats;
    let anyComplete = false;
    Casino.missions.list.forEach(m => {
        if (m.claimed) return;
        const prev = m.progress;
        if (m.type === 'rounds') m.progress = ds.rounds;
        else if (m.type === 'wins') m.progress = ds.wins;
        else if (m.type === 'wagered') m.progress = ds.wagered;
        else if (m.type === 'variety') m.progress = ds.gamesSet.length;
        else if (m.type === 'multiplier') m.progress = Math.max(m.progress, ds.bestMult || 0);
        else if (m.type === 'streak') m.progress = Math.max(m.progress, Casino.stats.winStreak || 0);

        if (m.progress >= m.target && !m.claimed) {
            m.claimed = true;
            Casino.balance += m.reward;
            updateBalanceUI();
            showToast(`✨ Mission Complete: ${m.name}! +$${m.reward.toLocaleString()}`);
            playSound('jackpot');
            haptic([40, 40, 80]);
            anyComplete = true;
        }
        if (prev !== m.progress) anyComplete = true;
    });
    if (anyComplete) renderMissions();
}
function initMissionTimer() {
    const el = $('mission-timer');
    if (!el) return;
    function tick() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setUTCHours(24, 0, 0, 0);
        const diff = tomorrow - now;
        const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
        const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
        const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
        el.textContent = `${h}:${m}:${s}`;
        // Mid-rollover: refresh missions if day changed.
        if (Casino.missions.date !== today()) {
            checkDailyReset();
            renderMissions();
            saveState();
        }
    }
    tick();
    setInterval(tick, 1000);
}

/* ---- Promo carousel (hero) ---- */
function initPromoCarousel() {
    const el = $('promo-text');
    if (!el) return;
    let idx = Math.floor(Math.random() * PROMOS.length);
    el.textContent = PROMOS[idx];
    if (reducedMotion) return;
    setInterval(() => {
        idx = (idx + 1) % PROMOS.length;
        el.classList.add('promo-leaving');
        setTimeout(() => {
            el.textContent = PROMOS[idx];
            el.classList.remove('promo-leaving');
        }, 300);
    }, 6000);
}

/* ---- Rescue chips ---- */
function renderRescue() {
    const btn = $('rescue-btn');
    if (!btn) return;
    const eligible = Casino.balance < 100 && (Date.now() - Casino.lastRescue) > RESCUE_COOLDOWN_MS;
    btn.classList.toggle('hidden', !eligible);
}
function claimRescueChips() {
    if (Casino.balance >= 100) return;
    if ((Date.now() - Casino.lastRescue) <= RESCUE_COOLDOWN_MS) return;
    Casino.balance += RESCUE_AMOUNT;
    Casino.lastRescue = Date.now();
    updateBalanceUI();
    flashBalance(true);
    saveState();
    playSound('win');
    haptic([30, 30, 60]);
    showToast(`🆘 +$${RESCUE_AMOUNT.toLocaleString()} rescue chips!`);
    renderRescue();
}

/* ---- Fullscreen ---- */
function toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
        if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    } else {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
    playSound('click');
}

/* ---- Leaderboard (seeded daily + player insertion) ---- */
function renderLeaderboard() {
    const list = $('leaderboard-list');
    if (!list) return;
    const t = today();
    let seed = 0;
    for (const c of t) seed = (seed * 31 + c.charCodeAt(0)) | 0;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    const seedNames = ['CryptoKing','VegasPro','Lucky777','HighRoller','CardShark','DiamondHands'];
    const entries = seedNames.map((n, i) => ({ name: n, best: Math.floor(50000 - i * 7000 + rand() * 6000) }));
    entries.push({ name: 'You', best: Casino.stats.biggestWin || 0, you: true });
    entries.sort((a, b) => b.best - a.best);

    list.innerHTML = entries.map((e, i) => `
        <div class="leaderboard-row${e.you ? ' you' : ''}">
            <div class="leaderboard-rank">#${i + 1}</div>
            <div class="leaderboard-name">${esc(e.name)}${e.you ? ' <span class="you-tag">YOU</span>' : ''}</div>
            <div class="leaderboard-amount">$${e.best.toLocaleString()}</div>
        </div>
    `).join('');
}

/* ---- Theme ---- */
function toggleTheme() {
    Casino.theme = Casino.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    saveState();
    playSound('click');
}
function applyTheme() {
    document.documentElement.setAttribute('data-theme', Casino.theme);
    $('theme-toggle').textContent = Casino.theme === 'dark' ? '🌓' : '☀️';
    const t = Casino.inventory.theme;
    if (t === 'purple_theme') document.documentElement.style.setProperty('--bg-primary', '#1e1b4b');
    else if (t === 'crimson_theme') document.documentElement.style.setProperty('--bg-primary', '#450a0a');
    else document.documentElement.style.removeProperty('--bg-primary');
}

/* ---- Win Effects ---- */
function showWinEffect(amount) {
    const overlay = $('win-overlay');
    overlay.classList.remove('hidden');
    overlay.innerHTML = '';
    const txt = document.createElement('div');
    txt.className = 'win-text';
    txt.textContent = `+$${amount.toLocaleString()}!`;
    overlay.appendChild(txt);
    if (!reducedMotion) {
        const colors = ['#d4a843','#f0d060','#22c55e','#ef4444','#3b82f6','#8b5cf6'];
        for (let i = 0; i < 40; i++) {
            const c = document.createElement('div');
            c.className = 'confetti';
            c.style.left = Math.random() * 100 + '%';
            c.style.top = '-10px';
            c.style.background = colors[Math.floor(Math.random() * colors.length)];
            c.style.animationDelay = Math.random() * 0.5 + 's';
            c.style.animationDuration = (1.5 + Math.random()) + 's';
            overlay.appendChild(c);
        }
    }
    haptic([20, 30, 60, 30, 20]);
    setTimeout(() => { overlay.classList.add('hidden'); overlay.innerHTML = ''; }, 2500);
}
window.Casino.showWinEffect = showWinEffect;

/* ---- Shop ---- */
function openShop() {
    const body = $('shop-body');
    body.innerHTML = `<div class="shop-grid">${SHOP_ITEMS.map(item => {
        const owned = Casino.inventory.owned.includes(item.id);
        const equipped = Casino.inventory[item.type] === item.id;
        const buttonHtml = !owned
            ? `<button class="shop-btn buy" type="button" data-action="buy" data-id="${esc(item.id)}">Buy</button>`
            : (equipped
                ? `<button class="shop-btn equipped" type="button" disabled>Equipped</button>`
                : `<button class="shop-btn equip" type="button" data-action="equip" data-id="${esc(item.id)}">Equip</button>`);
        return `
            <div class="shop-item">
                <div class="shop-item-icon" aria-hidden="true">${esc(item.icon)}</div>
                <div class="shop-item-name">${esc(item.name)}</div>
                ${!owned ? `<div class="shop-item-price">$${item.price.toLocaleString()}</div>` : '<div class="shop-item-price-placeholder"></div>'}
                ${buttonHtml}
            </div>`;
    }).join('')}</div>`;
    openModal('shop-modal');
}

function onShopClick(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'buy') buyItem(btn.dataset.id);
    else if (btn.dataset.action === 'equip') equipItem(btn.dataset.id);
}

function buyItem(id) {
    const item = SHOP_ITEMS.find(i => i.id === id);
    if (!item || Casino.inventory.owned.includes(id)) return;
    if (Casino.balance < item.price) {
        showToast('Not enough chips for this item.');
        playSound('lose');
        return;
    }
    Casino.balance -= item.price;
    updateBalanceUI();
    flashBalance(false);
    Casino.inventory.owned.push(id);
    saveState();
    equipItem(id);
    playSound('win');
    showToast(`Purchased ${item.name}!`);
}

function equipItem(id) {
    const item = SHOP_ITEMS.find(i => i.id === id);
    if (!item || !Casino.inventory.owned.includes(id)) return;
    Casino.inventory[item.type] = id;
    saveState();
    openShop();
    playSound('click');
    showToast(`Equipped ${item.name}!`);
    if (item.type === 'theme') applyTheme();
}

window.Casino.buyItem = buyItem;
window.Casino.equipItem = equipItem;

/* ---- Live Feed ---- */
function initLiveFeed() {
    const names = ['CryptoKing','VegasPro','Lucky777','HighRoller','CardShark','DiamondHands','SlotQueen','JackpotJoey'];
    const games = ['Slots','Blackjack','Roulette','Crash','Video Poker','Mines','Plinko'];
    const list = $('live-feed-list');
    if (!list) return;
    function addFeedItem() {
        const name = names[Math.floor(Math.random() * names.length)];
        const game = games[Math.floor(Math.random() * games.length)];
        const amount = Math.floor(Math.random() * 5000) + 100;
        const r = Math.random();
        let html;
        if (r < 0.6) html = `<strong>${esc(name)}</strong> won $${amount.toLocaleString()} on ${esc(game)}`;
        else if (r < 0.8) html = `<strong>${esc(name)}</strong> just hit a ${Math.floor(Math.random()*10)+2}x multiplier on Crash!`;
        else { const tier = VIP_TIERS[Math.floor(Math.random()*VIP_TIERS.length)]; html = `<strong>${esc(name)}</strong> reached ${esc(tier.icon)} ${esc(tier.name)} VIP!`; }
        const div = document.createElement('div');
        div.className = 'live-feed-item';
        div.innerHTML = html;
        list.prepend(div);
        while (list.children.length > 5) list.removeChild(list.lastChild);
        setTimeout(addFeedItem, 5000 + Math.random() * 10000);
    }
    setTimeout(addFeedItem, 3000);
}

/* ---- Keyboard & Modal Helpers ---- */
let lastFocusedBeforeModal = null;
function openModal(id) {
    const m = $(id);
    if (!m) return;
    lastFocusedBeforeModal = document.activeElement;
    m.classList.remove('hidden');
    m.setAttribute('aria-hidden', 'false');
    const focusable = m.querySelector('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) focusable.focus();
}
function closeModal(id) {
    const m = $(id);
    if (!m) return;
    m.classList.add('hidden');
    m.setAttribute('aria-hidden', 'true');
    if (lastFocusedBeforeModal && lastFocusedBeforeModal.focus) {
        try { lastFocusedBeforeModal.focus(); } catch(e) {}
    }
    lastFocusedBeforeModal = null;
}
window.Casino.openModal = openModal;
window.Casino.closeModal = closeModal;

function initKeyboard() {
    document.addEventListener('keydown', e => {
        const openOverlay = document.querySelector('.modal-overlay:not(.hidden)');

        if (e.key === 'Escape') {
            if (openOverlay) { e.preventDefault(); closeModal(openOverlay.id); return; }
            if (Casino.currentGame) { e.preventDefault(); showLobby(); return; }
        }

        if (e.key === 'Tab' && openOverlay) {
            const focusable = Array.from(openOverlay.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
            )).filter(el => el.offsetParent !== null);
            if (focusable.length === 0) return;
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            return;
        }

        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if ((e.key === ' ' || e.code === 'Space') && Casino.currentGame && !openOverlay && tag === 'BODY') {
            const btn = document.querySelector('#game-area .action-btn.primary:not(:disabled)');
            if (btn) { e.preventDefault(); btn.click(); }
        }

        // "/" focuses search in lobby
        if (e.key === '/' && !Casino.currentGame && !openOverlay && tag === 'BODY') {
            const s = $('game-search');
            if (s) { e.preventDefault(); s.focus(); }
        }
    });
}

/* ---- Card Helpers ---- */
const CARD_VALUES = [
    { v: 2, d: '2' }, { v: 3, d: '3' }, { v: 4, d: '4' }, { v: 5, d: '5' },
    { v: 6, d: '6' }, { v: 7, d: '7' }, { v: 8, d: '8' }, { v: 9, d: '9' },
    { v: 10, d: '10' }, { v: 10, d: 'J' }, { v: 10, d: 'Q' }, { v: 10, d: 'K' },
    { v: 11, d: 'A' }
];
function createCardElement(card, faceDown) {
    const div = document.createElement('div');
    const isRed = card.suit === '♥' || card.suit === '♦';
    div.className = 'playing-card ' + (faceDown ? 'face-down' : (isRed ? 'red' : 'black'));
    if (!faceDown) {
        div.innerHTML = `<span class="card-value">${esc(card.display)}</span><span class="card-suit">${esc(card.suit)}</span>`;
    }
    return div;
}
function createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const deck = [];
    suits.forEach(s => {
        CARD_VALUES.forEach((v, rank) => {
            deck.push({ value: v.v, display: v.d, suit: s, rank });
        });
    });
    return shuffle(deck);
}
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
Object.assign(window.Casino, { createCardElement, createDeck, shuffle, esc, haptic });
