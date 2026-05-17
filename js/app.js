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
    stats: { totalWagered: 0, totalWon: 0, biggestWin: 0, gamesPlayed: 0 }
};

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
    
    document.getElementById('back-to-lobby').addEventListener('click', showLobby);
    document.getElementById('logo-link').addEventListener('click', e => { e.preventDefault(); showLobby(); });
    document.getElementById('sound-toggle').addEventListener('click', toggleSound);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('stats-btn').addEventListener('click', showStats);
    document.getElementById('close-stats').addEventListener('click', () => document.getElementById('stats-modal').classList.add('hidden'));
    document.getElementById('stats-modal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden'); });
    document.getElementById('close-daily').addEventListener('click', () => document.getElementById('daily-modal').classList.add('hidden'));
    document.getElementById('claim-daily-btn').addEventListener('click', claimDailyBonus);
    
    document.getElementById('shop-btn').addEventListener('click', openShop);
    document.getElementById('close-shop').addEventListener('click', () => document.getElementById('shop-modal').classList.add('hidden'));
    document.getElementById('shop-modal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden'); });

    // Register PWA Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(() => {});
        });
    }
});

/* ---- State Persistence ---- */
function loadState() {
    try {
        const s = JSON.parse(localStorage.getItem('casino_state'));
        if (s) { 
            Casino.balance = s.balance ?? 10000; 
            Casino.stats = s.stats ?? Casino.stats; 
            Casino.soundEnabled = s.soundEnabled ?? true;
            Casino.theme = s.theme ?? 'dark';
            Casino.lastDailyBonus = s.lastDailyBonus ?? 0;
            Casino.achievements = s.achievements ?? [];
            Casino.vip = s.vip ?? { xp: 0, level: 0 };
            Casino.inventory = s.inventory ?? { deck: 'default', theme: 'default', owned: ['default_deck', 'default_theme'] };
        }
    } catch(e) {}
    if (Casino.balance <= 0) Casino.balance = 10000;
}
function saveState() {
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
}

/* ---- Balance ---- */
function updateBalanceUI() {
    document.getElementById('balance-display').textContent = '$' + Casino.balance.toLocaleString();
}
function changeBalance(amount) {
    Casino.balance += amount;
    if (Casino.balance < 0) Casino.balance = 0;
    updateBalanceUI();
    const el = document.getElementById('balance-display');
    el.classList.remove('flash-green', 'flash-red');
    void el.offsetWidth;
    el.classList.add(amount >= 0 ? 'flash-green' : 'flash-red');
    if (amount > 0) { Casino.stats.totalWon += amount; if (amount > Casino.stats.biggestWin) Casino.stats.biggestWin = amount; }
    Casino.stats.gamesPlayed++; Casino.checkAchievements();
    saveState();
}
function placeBet(amount) {
    if (amount > Casino.balance || amount <= 0) return false;
    Casino.balance -= amount;
    Casino.stats.totalWagered += amount;
    
    // Add XP equal to bet amount
    Casino.vip.xp += amount;
    checkVIPLevelUp();
    updateVIPUI();

    updateBalanceUI();
    const el = document.getElementById('balance-display');
    el.classList.remove('flash-green', 'flash-red');
    void el.offsetWidth;
    el.classList.add('flash-red');
    saveState();
    return true;
}

function checkVIPLevelUp() {
    let newLevel = 0;
    for (let i = VIP_TIERS.length - 1; i >= 0; i--) {
        if (Casino.vip.xp >= VIP_TIERS[i].xp) {
            newLevel = i;
            break;
        }
    }
    if (newLevel > Casino.vip.level) {
        Casino.vip.level = newLevel;
        const tier = VIP_TIERS[newLevel];
        showToast(`${tier.icon} VIP Level Up! You are now ${tier.name}!`);
        playSound('jackpot');
    }
}

function updateVIPUI() {
    const tier = VIP_TIERS[Casino.vip.level];
    const nextTier = VIP_TIERS[Casino.vip.level + 1];
    
    document.getElementById('vip-icon').textContent = tier.icon;
    document.getElementById('vip-level-text').textContent = tier.name;
    
    if (nextTier) {
        const xpInCurrentTier = Casino.vip.xp - tier.xp;
        const xpNeededForNext = nextTier.xp - tier.xp;
        const pct = Math.min(100, Math.max(0, (xpInCurrentTier / xpNeededForNext) * 100));
        document.getElementById('vip-xp-fill').style.width = `${pct}%`;
        document.getElementById('vip-badge').title = `XP: ${Casino.vip.xp} / ${nextTier.xp}`;
    } else {
        document.getElementById('vip-xp-fill').style.width = '100%';
        document.getElementById('vip-badge').title = 'Max VIP Level!';
    }
}

window.Casino.changeBalance = changeBalance;
window.Casino.placeBet = placeBet;
window.Casino.updateBalanceUI = updateBalanceUI;
window.Casino.updateVIPUI = updateVIPUI;
window.Casino.saveState = saveState;

/* ---- Sound ---- */
function toggleSound() {
    Casino.soundEnabled = !Casino.soundEnabled;
    document.getElementById('sound-toggle').textContent = Casino.soundEnabled ? '🔊' : '🔇';
    saveState();
}
function playSound(type) {
    if (!Casino.soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        
        function createTone(freq, type, timeOffset, duration, vol) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime + timeOffset);
            gain.gain.setValueAtTime(vol, ctx.currentTime + timeOffset);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + timeOffset + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + timeOffset);
            osc.stop(ctx.currentTime + timeOffset + duration);
        }

        if (type === 'win') {
            [523, 659, 784, 1047].forEach((f, i) => {
                createTone(f, 'sine', i * 0.1, 0.4, 0.1);
                createTone(f * 2, 'triangle', i * 0.1, 0.3, 0.05); // add harmonics
            });
        } else if (type === 'lose') {
            createTone(400, 'sawtooth', 0, 0.3, 0.05);
            createTone(300, 'sawtooth', 0.15, 0.3, 0.05);
            createTone(200, 'square', 0.3, 0.4, 0.05);
        } else if (type === 'click') {
            createTone(800, 'sine', 0, 0.05, 0.05);
            createTone(1200, 'triangle', 0, 0.05, 0.02); // crisp click
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
    const grid = document.getElementById('games-grid');
    grid.innerHTML = '';
    GAME_CARDS.forEach((g, index) => {
        const card = document.createElement('div');
        card.className = 'game-card slide-up';
        card.style.animationDelay = `${0.2 + (index * 0.05)}s`;
        card.style.setProperty('--card-accent', g.accent);
        card.innerHTML = `<span class="game-card-icon">${g.icon}</span><h3 class="game-card-name">${g.name}</h3><p class="game-card-desc">${g.desc}</p><button class="game-card-btn">Play Now</button>`;
        card.addEventListener('click', () => openGame(g.id));
        grid.appendChild(card);
    });
}

/* ---- Navigation ---- */
function openGame(id) {
    const game = Casino.games[id];
    if (!game) return;
    playSound('click');
    const lobby = document.getElementById('lobby');
    const container = document.getElementById('game-container');
    
    lobby.classList.add('fade-out');
    setTimeout(() => {
        lobby.classList.add('hidden');
        lobby.classList.remove('fade-out');
        
        container.classList.remove('hidden');
        container.classList.add('fade-in');
        
        const info = GAME_CARDS.find(g => g.id === id);
        document.getElementById('game-title').textContent = info ? info.name : id;
        Casino.currentGame = id;
        const area = document.getElementById('game-area');
        area.innerHTML = '';
        game.init(area);
        
        setTimeout(() => container.classList.remove('fade-in'), 300);
    }, 300);
}
function showLobby() {
    if (Casino.currentGame && Casino.games[Casino.currentGame] && Casino.games[Casino.currentGame].destroy) {
        Casino.games[Casino.currentGame].destroy();
    }
    Casino.currentGame = null;
    
    const lobby = document.getElementById('lobby');
    const container = document.getElementById('game-container');
    
    container.classList.add('fade-out');
    setTimeout(() => {
        container.classList.add('hidden');
        container.classList.remove('fade-out');
        
        lobby.classList.remove('hidden');
        lobby.classList.add('fade-in');
        
        setTimeout(() => lobby.classList.remove('fade-in'), 300);
    }, 300);
}

/* ---- Stats & Achievements ---- */
function showStats() {
    const body = document.getElementById('stats-body');
    const net = Casino.stats.totalWon - Casino.stats.totalWagered;
    const cls = net >= 0 ? 'positive' : 'negative';
    body.innerHTML = `
        <div class="stat-row"><span class="stat-name">Current Balance</span><span class="stat-value">$${Casino.balance.toLocaleString()}</span></div>
        <div class="stat-row"><span class="stat-name">Total Wagered</span><span class="stat-value">$${Casino.stats.totalWagered.toLocaleString()}</span></div>
        <div class="stat-row"><span class="stat-name">Total Won</span><span class="stat-value positive">$${Casino.stats.totalWon.toLocaleString()}</span></div>
        <div class="stat-row"><span class="stat-name">Net Profit/Loss</span><span class="stat-value ${cls}">${net >= 0 ? '+' : ''}$${net.toLocaleString()}</span></div>
        <div class="stat-row"><span class="stat-name">Biggest Win</span><span class="stat-value">$${Casino.stats.biggestWin.toLocaleString()}</span></div>
        <div class="stat-row"><span class="stat-name">Rounds Played</span><span class="stat-value">${Casino.stats.gamesPlayed}</span></div>
        <button class="reset-btn" id="reset-stats-btn">Reset All Data</button>`;
    
    const achList = document.getElementById('achievements-list');
    achList.innerHTML = '';
    ACHIEVEMENTS_DATA.forEach(a => {
        const unlocked = Casino.achievements.includes(a.id);
        const div = document.createElement('div');
        div.style.cssText = `display:flex;align-items:center;gap:12px;padding:12px;border-radius:8px;background:var(${unlocked ? '--glass-bg' : '--bg-card'});border:1px solid var(${unlocked ? '--glass-border' : 'transparent'});opacity:${unlocked ? '1' : '0.5'}`;
        div.innerHTML = `
            <div style="font-size:24px;filter:${unlocked ? 'none' : 'grayscale(1)'}">${a.icon}</div>
            <div style="flex:1">
                <div style="font-weight:700;color:var(--text);font-size:14px;">${a.name}</div>
                <div style="font-size:12px;color:var(--text-secondary);">${a.desc}</div>
            </div>
            ${unlocked ? `<div style="font-size:12px;color:var(--gold);font-weight:700">+$${a.reward}</div>` : ''}
        `;
        achList.appendChild(div);
    });

    document.getElementById('reset-stats-btn').addEventListener('click', () => {
        Casino.balance = 10000; Casino.stats = { totalWagered:0, totalWon:0, biggestWin:0, gamesPlayed:0 };
        Casino.achievements = []; Casino.lastDailyBonus = 0;
        saveState(); updateBalanceUI(); showStats();
    });
    document.getElementById('stats-modal').classList.remove('hidden');
}

function checkAchievements() {
    const s = Casino.stats;
    const check = (id, condition) => {
        if (!Casino.achievements.includes(id) && condition) {
            Casino.achievements.push(id);
            const a = ACHIEVEMENTS_DATA.find(x => x.id === id);
            Casino.changeBalance(a.reward);
            showToast(`${a.icon} Achievement Unlocked: ${a.name}! (+$${a.reward})`);
            playSound('jackpot');
        }
    };
    check('first_win', s.totalWon > 0);
    check('high_roller', s.totalWagered >= 10000);
    check('veteran', s.gamesPlayed >= 100);
}
window.Casino.checkAchievements = checkAchievements;

function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--gold);border-radius:8px;padding:12px 16px;color:var(--text);box-shadow:0 4px 12px rgba(0,0,0,0.3);font-weight:600;font-size:14px;animation:slideUp 0.3s forwards;';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/* ---- Daily Bonus ---- */
function checkDailyBonus() {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    if (now - Casino.lastDailyBonus > msPerDay) {
        document.getElementById('daily-bonus-btn').classList.remove('hidden');
        document.getElementById('daily-bonus-btn').addEventListener('click', () => {
            const tier = VIP_TIERS[Casino.vip.level];
            document.getElementById('daily-bonus-amount').textContent = `Claim $${tier.bonus.toLocaleString()}!`;
            document.getElementById('daily-modal').classList.remove('hidden');
        }, { once: true });
    }
}
function claimDailyBonus() {
    const tier = VIP_TIERS[Casino.vip.level];
    Casino.changeBalance(tier.bonus);
    Casino.lastDailyBonus = Date.now();
    saveState();
    document.getElementById('daily-modal').classList.add('hidden');
    document.getElementById('daily-bonus-btn').classList.add('hidden');
    playSound('win');
    showWinEffect(tier.bonus);
}

/* ---- Leaderboard ---- */
function renderLeaderboard() {
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    const names = ['CryptoKing','VegasPro','Lucky777','HighRoller','CardShark','DiamondHands'];
    let html = '';
    names.forEach((n, i) => {
        const bal = 50000 - (i * 8000) + Math.floor(Math.random() * 2000);
        html += `
            <div style="display:flex;justify-content:space-between;padding:12px;border-bottom:1px solid var(--glass-border);align-items:center;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <span style="color:var(--text-muted);font-weight:800;width:20px;">#${i+1}</span>
                    <span style="font-weight:600;color:var(--text);">${n}</span>
                </div>
                <span style="color:var(--gold-light);font-weight:800;">$${bal.toLocaleString()}</span>
            </div>`;
    });
    list.innerHTML = html;
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
    document.getElementById('theme-toggle').textContent = Casino.theme === 'dark' ? '🌓' : '☀️';
}

/* ---- Win Effects ---- */
function showWinEffect(amount) {
    const overlay = document.getElementById('win-overlay');
    overlay.classList.remove('hidden');
    overlay.innerHTML = '';
    const txt = document.createElement('div');
    txt.className = 'win-text';
    txt.textContent = `+$${amount.toLocaleString()}!`;
    overlay.appendChild(txt);
    for (let i = 0; i < 40; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = Math.random() * 100 + '%';
        c.style.top = '-10px';
        c.style.background = ['#d4a843','#f0d060','#22c55e','#ef4444','#3b82f6','#8b5cf6'][Math.floor(Math.random()*6)];
        c.style.animationDelay = Math.random() * 0.5 + 's';
        c.style.animationDuration = (1.5 + Math.random()) + 's';
        overlay.appendChild(c);
    }
    setTimeout(() => { overlay.classList.add('hidden'); overlay.innerHTML = ''; }, 2500);
}
window.Casino.showWinEffect = showWinEffect;

/* ---- Shop Logic ---- */
function openShop() {
    const body = document.getElementById('shop-body');
    let html = '<div class="shop-grid">';
    
    SHOP_ITEMS.forEach(item => {
        const owned = Casino.inventory.owned.includes(item.id);
        const equipped = Casino.inventory[item.type] === item.id;
        
        html += `
            <div class="shop-item">
                <div class="shop-item-icon">${item.icon}</div>
                <div class="shop-item-name">${item.name}</div>
                ${!owned ? `<div class="shop-item-price">$${item.price.toLocaleString()}</div>` : '<div style="height:14px;margin-bottom:12px;"></div>'}
                ${!owned ? 
                    `<button class="shop-btn buy" onclick="Casino.buyItem('${item.id}')">Buy</button>` : 
                    (equipped ? 
                        `<button class="shop-btn equipped">Equipped</button>` : 
                        `<button class="shop-btn equip" onclick="Casino.equipItem('${item.id}')">Equip</button>`)
                }
            </div>
        `;
    });
    
    html += '</div>';
    body.innerHTML = html;
    document.getElementById('shop-modal').classList.remove('hidden');
}

function buyItem(id) {
    const item = SHOP_ITEMS.find(i => i.id === id);
    if (!item) return;
    if (Casino.inventory.owned.includes(id)) return;
    
    if (Casino.placeBet(item.price)) {
        Casino.inventory.owned.push(id);
        equipItem(id);
        playSound('win');
        showToast(`Purchased ${item.name}!`);
    } else {
        showToast("Not enough chips to buy this item.");
        playSound('lose');
    }
}

function equipItem(id) {
    const item = SHOP_ITEMS.find(i => i.id === id);
    if (!item || !Casino.inventory.owned.includes(id)) return;
    
    Casino.inventory[item.type] = id;
    saveState();
    openShop(); // Refresh UI
    playSound('click');
    showToast(`Equipped ${item.name}!`);
    
    if (item.type === 'theme') {
        // Special theme logic could go here if needed
        if (id === 'purple_theme') document.documentElement.style.setProperty('--bg-primary', '#1e1b4b');
        else if (id === 'crimson_theme') document.documentElement.style.setProperty('--bg-primary', '#450a0a');
        else document.documentElement.style.setProperty('--bg-primary', ''); // reset
    }
}

window.Casino.buyItem = buyItem;
window.Casino.equipItem = equipItem;

/* ---- Live Feed ---- */
function initLiveFeed() {
    const names = ['CryptoKing','VegasPro','Lucky777','HighRoller','CardShark','DiamondHands','SlotQueen','JackpotJoey'];
    const games = ['Slots','Blackjack','Roulette','Crash','Video Poker','Mines','Plinko'];
    const list = document.getElementById('live-feed-list');
    
    function addFeedItem() {
        if (!list) return;
        const name = names[Math.floor(Math.random() * names.length)];
        const game = games[Math.floor(Math.random() * games.length)];
        const amount = Math.floor(Math.random() * 5000) + 100;
        
        let msg = '';
        const r = Math.random();
        if (r < 0.6) {
            msg = `<strong>${name}</strong> won $${amount.toLocaleString()} on ${game}`;
        } else if (r < 0.8) {
            msg = `<strong>${name}</strong> just hit a ${Math.floor(Math.random() * 10) + 2}x multiplier on Crash!`;
        } else {
            const tier = VIP_TIERS[Math.floor(Math.random() * VIP_TIERS.length)];
            msg = `<strong>${name}</strong> reached ${tier.icon} ${tier.name} VIP!`;
        }
        
        const div = document.createElement('div');
        div.className = 'live-feed-item';
        div.innerHTML = msg;
        
        list.prepend(div);
        if (list.children.length > 5) {
            list.removeChild(list.lastChild);
        }
        
        setTimeout(addFeedItem, 5000 + Math.random() * 10000);
    }
    
    setTimeout(addFeedItem, 3000);
}

/* ---- Card Helpers ---- */
function createCardElement(card, faceDown) {
    const div = document.createElement('div');
    const isRed = card.suit === '♥' || card.suit === '♦';
    div.className = 'playing-card ' + (faceDown ? 'face-down' : (isRed ? 'red' : 'black'));
    if (!faceDown) {
        div.innerHTML = `<span class="card-value">${card.display}</span><span class="card-suit">${card.suit}</span>`;
    }
    return div;
}
function createDeck() {
    const suits = ['♠','♥','♦','♣'];
    const values = [{v:2,d:'2'},{v:3,d:'3'},{v:4,d:'4'},{v:5,d:'5'},{v:6,d:'6'},{v:7,d:'7'},{v:8,d:'8'},{v:9,d:'9'},{v:10,d:'10'},{v:10,d:'J'},{v:10,d:'Q'},{v:10,d:'K'},{v:11,d:'A'}];
    const deck = [];
    suits.forEach(s => values.forEach(v => deck.push({ value: v.v, display: v.d, suit: s, rank: values.indexOf(v) })));
    return shuffle(deck);
}
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [arr[i],arr[j]] = [arr[j],arr[i]]; }
    return arr;
}
window.Casino.createCardElement = createCardElement;
window.Casino.createDeck = createDeck;
window.Casino.shuffle = shuffle;
