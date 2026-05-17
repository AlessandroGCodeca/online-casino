/* Royal Flush Casino — Main Application */
window.Casino = {
    balance: 10000,
    games: {},
    currentGame: null,
    soundEnabled: true,
    theme: 'dark',
    lastDailyBonus: 0,
    achievements: [],
    vip: { xp: 0, level: 0 },
    inventory: { deck: 'default', theme: 'default', owned: ['default_deck', 'default_theme'] },
    stats: { totalWagered: 0, totalWon: 0, biggestWin: 0, gamesPlayed: 0, winStreak: 0, bestStreak: 0, jackpots: 0 }
};

const STARTING_BALANCE = 10000;
const DEFAULT_STATS = { totalWagered: 0, totalWon: 0, biggestWin: 0, gamesPlayed: 0, winStreak: 0, bestStreak: 0, jackpots: 0 };

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
    { id: 'slots', name: 'Slot Machine', icon: '🎰', desc: 'Spin the reels and hit the jackpot!', accent: '#e74c3c' },
    { id: 'blackjack', name: 'Blackjack', icon: '🃏', desc: 'Beat the dealer to 21!', accent: '#22c55e' },
    { id: 'roulette', name: 'Roulette', icon: '🎡', desc: 'Place your bets on the wheel!', accent: '#8b5cf6' },
    { id: 'poker', name: 'Video Poker', icon: '🂡', desc: 'Jacks or Better draw poker!', accent: '#3b82f6' },
    { id: 'crash', name: 'Crash', icon: '🚀', desc: 'Cash out before the crash!', accent: '#f59e0b' },
    { id: 'mines', name: 'Mines', icon: '💣', desc: 'Reveal gems, avoid the mines!', accent: '#22c55e' },
    { id: 'dice', name: 'Hi-Lo Dice', icon: '🎲', desc: 'Predict over or under the target!', accent: '#3b82f6' },
    { id: 'baccarat', name: 'Baccarat', icon: '👑', desc: 'Classic high-roller card game!', accent: '#d4a843' },
    { id: 'wheel', name: 'Wheel of Fortune', icon: '🎡', desc: 'Spin for multiplier prizes!', accent: '#8b5cf6' },
    { id: 'keno', name: 'Keno', icon: '🔢', desc: 'Pick numbers and match to win!', accent: '#ef4444' },
    { id: 'plinko', name: 'Plinko', icon: '🟢', desc: 'Drop the ball and hit the multipliers!', accent: '#22c55e' }
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

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    applyTheme();
    renderLobby();
    updateBalanceUI();
    updateVIPUI();
    checkDailyBonus();
    renderLeaderboard();
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

    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(m.id); });
    });

    // Shop delegated interactions (CSP-friendly — no inline onclick).
    $('shop-body').addEventListener('click', onShopClick);

    // Service Worker for offline play.
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(() => {});
        });
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
            Casino.achievements = s.achievements ?? [];
            Casino.vip = s.vip ?? { xp: 0, level: 0 };
            Casino.inventory = s.inventory ?? { deck: 'default', theme: 'default', owned: ['default_deck', 'default_theme'] };
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
            achievements: Casino.achievements,
            vip: Casino.vip,
            inventory: Casino.inventory
        }));
    } catch(e) {}
}

/* ---- Balance & game outcome tracking ---- */
// pendingBet > 0 means "a bet was placed and we haven't recorded a win yet".
// If a new placeBet comes in while pendingBet > 0, the previous round was a loss.
let pendingBet = 0;

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

    // Record game outcomes — but only when there's an active bet (filters out
    // achievement rewards and daily bonus, which shouldn't count as "wins").
    if (amount > 0 && pendingBet > 0) {
        Casino.stats.totalWon += amount;
        if (amount > Casino.stats.biggestWin) Casino.stats.biggestWin = amount;
        Casino.stats.winStreak = (Casino.stats.winStreak || 0) + 1;
        if (Casino.stats.winStreak > Casino.stats.bestStreak) Casino.stats.bestStreak = Casino.stats.winStreak;
        if (amount >= pendingBet * 25) {
            Casino.stats.jackpots = (Casino.stats.jackpots || 0) + 1;
        }
        pendingBet = 0;
        haptic([30, 40, 30]);
    }

    checkAchievements();
    saveState();
}
function placeBet(amount) {
    if (amount > Casino.balance || amount <= 0) return false;
    // Previous round had a pending bet that never paid out → it was a loss.
    if (pendingBet > 0) Casino.stats.winStreak = 0;

    Casino.balance -= amount;
    Casino.stats.totalWagered += amount;
    Casino.stats.gamesPlayed++;
    pendingBet = amount;

    Casino.vip.xp += amount;
    checkVIPLevelUp();
    updateVIPUI();

    updateBalanceUI();
    flashBalance(false);
    saveState();
    return true;
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

Object.assign(window.Casino, {
    changeBalance, placeBet, updateBalanceUI, updateVIPUI, saveState
});

/* ---- Sound (single shared AudioContext) ---- */
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

    function createTone(freq, wave, timeOffset, duration, vol) {
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
            [523, 659, 784, 1047].forEach((f, i) => {
                createTone(f, 'sine', i * 0.1, 0.4, 0.1);
                createTone(f * 2, 'triangle', i * 0.1, 0.3, 0.05);
            });
        } else if (type === 'lose') {
            createTone(400, 'sawtooth', 0, 0.3, 0.05);
            createTone(300, 'sawtooth', 0.15, 0.3, 0.05);
            createTone(200, 'square', 0.3, 0.4, 0.05);
        } else if (type === 'click') {
            createTone(800, 'sine', 0, 0.05, 0.05);
            createTone(1200, 'triangle', 0, 0.05, 0.02);
        } else if (type === 'jackpot') {
            [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => {
                createTone(f, 'square', i * 0.1, 0.5, 0.05);
                createTone(f * 1.5, 'sine', i * 0.1, 0.6, 0.05);
            });
        } else {
            createTone(600, 'sine', 0, 0.1, 0.05);
        }
    } catch(e) {}
}
window.Casino.playSound = playSound;

/* ---- Lobby ---- */
function renderLobby() {
    const grid = $('games-grid');
    grid.innerHTML = '';
    GAME_CARDS.forEach((g, index) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'game-card slide-up';
        card.style.animationDelay = `${0.2 + (index * 0.05)}s`;
        card.style.setProperty('--card-accent', g.accent);
        card.setAttribute('aria-label', `${g.name}: ${g.desc}`);
        card.innerHTML = `<span class="game-card-icon" aria-hidden="true">${esc(g.icon)}</span><h3 class="game-card-name">${esc(g.name)}</h3><p class="game-card-desc">${esc(g.desc)}</p><span class="game-card-btn">Play Now</span>`;
        card.addEventListener('click', () => openGame(g.id));
        grid.appendChild(card);
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
    // Going to lobby — if there was an unresolved bet (lost), reset streak.
    if (pendingBet > 0) { Casino.stats.winStreak = 0; pendingBet = 0; saveState(); }

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
        // Refresh leaderboard in case biggestWin changed
        renderLeaderboard();
    }, delay);
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

    $('reset-stats-btn').addEventListener('click', () => {
        if (!confirm('Reset ALL data — balance, stats, achievements, VIP, and shop items?')) return;
        Casino.balance = STARTING_BALANCE;
        Casino.stats = Object.assign({}, DEFAULT_STATS);
        Casino.achievements = [];
        Casino.lastDailyBonus = 0;
        Casino.vip = { xp: 0, level: 0 };
        Casino.inventory = { deck: 'default', theme: 'default', owned: ['default_deck', 'default_theme'] };
        pendingBet = 0;
        // Reset theme overrides (custom shop themes).
        document.documentElement.style.removeProperty('--bg-primary');
        saveState(); updateBalanceUI(); updateVIPUI(); renderLeaderboard(); showStats();
        showToast('All data reset.');
    });
    openModal('stats-modal');
}

function checkAchievements() {
    const s = Casino.stats;
    const check = (id, condition) => {
        if (!Casino.achievements.includes(id) && condition) {
            Casino.achievements.push(id);
            const a = ACHIEVEMENTS_DATA.find(x => x.id === id);
            // Award via direct balance addition so we don't accidentally
            // re-trigger the win-tracking inside changeBalance.
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
    setTimeout(() => {
        toast.classList.add('toast-leaving');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
window.Casino.showToast = showToast;

/* ---- Daily Bonus ---- */
function checkDailyBonus() {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    if (now - Casino.lastDailyBonus > msPerDay) {
        $('daily-bonus-btn').classList.remove('hidden');
    } else {
        $('daily-bonus-btn').classList.add('hidden');
    }
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

/* ---- Leaderboard (seeded daily + player insertion) ---- */
function renderLeaderboard() {
    const list = $('leaderboard-list');
    if (!list) return;

    const today = new Date().toISOString().slice(0, 10);
    let seed = 0;
    for (const c of today) seed = (seed * 31 + c.charCodeAt(0)) | 0;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    const seedNames = ['CryptoKing','VegasPro','Lucky777','HighRoller','CardShark','DiamondHands'];
    const entries = seedNames.map((n, i) => ({
        name: n,
        best: Math.floor(50000 - i * 7000 + rand() * 6000)
    }));
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
    // Re-apply shop theme override if equipped.
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
    const id = btn.dataset.id;
    if (btn.dataset.action === 'buy') buyItem(id);
    else if (btn.dataset.action === 'equip') equipItem(id);
}

function buyItem(id) {
    const item = SHOP_ITEMS.find(i => i.id === id);
    if (!item || Casino.inventory.owned.includes(id)) return;

    if (Casino.balance < item.price) {
        showToast('Not enough chips for this item.');
        playSound('lose');
        return;
    }
    // Direct deduction — shop purchases shouldn't affect wager/XP stats.
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
let liveFeedTimer = null;
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
        if (r < 0.6) {
            html = `<strong>${esc(name)}</strong> won $${amount.toLocaleString()} on ${esc(game)}`;
        } else if (r < 0.8) {
            const mult = Math.floor(Math.random() * 10) + 2;
            html = `<strong>${esc(name)}</strong> just hit a ${mult}x multiplier on Crash!`;
        } else {
            const tier = VIP_TIERS[Math.floor(Math.random() * VIP_TIERS.length)];
            html = `<strong>${esc(name)}</strong> reached ${esc(tier.icon)} ${esc(tier.name)} VIP!`;
        }

        const div = document.createElement('div');
        div.className = 'live-feed-item';
        div.innerHTML = html;
        list.prepend(div);
        while (list.children.length > 5) list.removeChild(list.lastChild);

        liveFeedTimer = setTimeout(addFeedItem, 5000 + Math.random() * 10000);
    }
    liveFeedTimer = setTimeout(addFeedItem, 3000);
}

/* ---- Keyboard Shortcuts & Modal Helpers ---- */
let lastFocusedBeforeModal = null;
function openModal(id) {
    const m = $(id);
    if (!m) return;
    lastFocusedBeforeModal = document.activeElement;
    m.classList.remove('hidden');
    m.setAttribute('aria-hidden', 'false');
    // Focus first focusable element.
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

        // Trap Tab inside modal.
        if (e.key === 'Tab' && openOverlay) {
            const focusable = Array.from(openOverlay.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
            )).filter(el => el.offsetParent !== null);
            if (focusable.length === 0) return;
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault(); first.focus();
            }
            return;
        }

        // Space = trigger primary action (only when nothing is focused; if a
        // button/input has focus, let it handle Space natively).
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if ((e.key === ' ' || e.code === 'Space') && Casino.currentGame && !openOverlay && tag === 'BODY') {
            const btn = document.querySelector('#game-area .action-btn.primary:not(:disabled)');
            if (btn) { e.preventDefault(); btn.click(); }
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
