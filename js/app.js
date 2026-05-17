/* Royal Flush Casino — Main Application */
window.Casino = {
    balance: 10000,
    games: {},
    currentGame: null,
    soundEnabled: true,
    stats: { totalWagered: 0, totalWon: 0, biggestWin: 0, gamesPlayed: 0 }
};

const GAME_CARDS = [
    { id: 'slots', name: 'Slot Machine', icon: '🎰', desc: 'Spin the reels and hit the jackpot!', accent: '#e74c3c' },
    { id: 'blackjack', name: 'Blackjack', icon: '🃏', desc: 'Beat the dealer to 21!', accent: '#22c55e' },
    { id: 'roulette', name: 'Roulette', icon: '🎡', desc: 'Place your bets on the wheel!', accent: '#8b5cf6' },
    { id: 'poker', name: 'Video Poker', icon: '🂡', desc: 'Jacks or Better draw poker!', accent: '#3b82f6' },
    { id: 'crash', name: 'Crash', icon: '🚀', desc: 'Cash out before the crash!', accent: '#f59e0b' }
];

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    renderLobby();
    updateBalanceUI();
    document.getElementById('back-to-lobby').addEventListener('click', showLobby);
    document.getElementById('logo-link').addEventListener('click', e => { e.preventDefault(); showLobby(); });
    document.getElementById('sound-toggle').addEventListener('click', toggleSound);
    document.getElementById('stats-btn').addEventListener('click', showStats);
    document.getElementById('close-stats').addEventListener('click', () => document.getElementById('stats-modal').classList.add('hidden'));
    document.getElementById('stats-modal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden'); });
});

/* ---- State Persistence ---- */
function loadState() {
    try {
        const s = JSON.parse(localStorage.getItem('casino_state'));
        if (s) { Casino.balance = s.balance ?? 10000; Casino.stats = s.stats ?? Casino.stats; Casino.soundEnabled = s.soundEnabled ?? true; }
    } catch(e) {}
    if (Casino.balance <= 0) Casino.balance = 10000;
}
function saveState() {
    localStorage.setItem('casino_state', JSON.stringify({ balance: Casino.balance, stats: Casino.stats, soundEnabled: Casino.soundEnabled }));
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
    Casino.stats.gamesPlayed++;
    saveState();
}
function placeBet(amount) {
    if (amount > Casino.balance || amount <= 0) return false;
    Casino.balance -= amount;
    Casino.stats.totalWagered += amount;
    updateBalanceUI();
    const el = document.getElementById('balance-display');
    el.classList.remove('flash-green', 'flash-red');
    void el.offsetWidth;
    el.classList.add('flash-red');
    saveState();
    return true;
}
window.Casino.changeBalance = changeBalance;
window.Casino.placeBet = placeBet;
window.Casino.updateBalanceUI = updateBalanceUI;
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
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine';
        if (type === 'win') {
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            [523,659,784,1047].forEach((f,i) => osc.frequency.setValueAtTime(f, ctx.currentTime + i*0.1));
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start(); osc.stop(ctx.currentTime + 0.5);
        } else if (type === 'lose') {
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            osc.frequency.setValueAtTime(300, ctx.currentTime + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start(); osc.stop(ctx.currentTime + 0.3);
        } else if (type === 'click') {
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            osc.start(); osc.stop(ctx.currentTime + 0.08);
        } else if (type === 'jackpot') {
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            [523,659,784,1047,1319,1568].forEach((f,i) => osc.frequency.setValueAtTime(f, ctx.currentTime + i*0.12));
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
            osc.start(); osc.stop(ctx.currentTime + 0.8);
        } else {
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
            osc.start(); osc.stop(ctx.currentTime + 0.12);
        }
    } catch(e) {}
}
window.Casino.playSound = playSound;

/* ---- Lobby ---- */
function renderLobby() {
    const grid = document.getElementById('games-grid');
    grid.innerHTML = '';
    GAME_CARDS.forEach(g => {
        const card = document.createElement('div');
        card.className = 'game-card';
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
    document.getElementById('lobby').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    const info = GAME_CARDS.find(g => g.id === id);
    document.getElementById('game-title').textContent = info ? info.name : id;
    Casino.currentGame = id;
    const area = document.getElementById('game-area');
    area.innerHTML = '';
    game.init(area);
}
function showLobby() {
    if (Casino.currentGame && Casino.games[Casino.currentGame] && Casino.games[Casino.currentGame].destroy) {
        Casino.games[Casino.currentGame].destroy();
    }
    Casino.currentGame = null;
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('lobby').classList.remove('hidden');
}

/* ---- Stats ---- */
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
    document.getElementById('reset-stats-btn').addEventListener('click', () => {
        Casino.balance = 10000; Casino.stats = { totalWagered:0, totalWon:0, biggestWin:0, gamesPlayed:0 };
        saveState(); updateBalanceUI(); showStats();
    });
    document.getElementById('stats-modal').classList.remove('hidden');
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
