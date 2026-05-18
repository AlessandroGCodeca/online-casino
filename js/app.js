/* Royal Flush Casino — Main Application */
window.Casino = {
    balance: 10000,
    games: {},
    currentGame: null,
    soundEnabled: true,
    volume: 1.0,
    animationsEnabled: true,
    hapticsEnabled: true,
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
    { id: 'slots', name: 'Mega Jackpot', icon: '🎰', desc: '3×3 with 5 paylines and free spins!', accent: '#e74c3c', category: 'slots' },
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

const GAME_STUDIOS = {
    slots: 'ROYAL ORIGINALS', blackjack: 'CLASSIC CASINO', roulette: 'EUROPEAN STYLE',
    poker: 'CLASSIC CASINO', crash: 'ROYAL ORIGINALS', mines: 'ROYAL ORIGINALS',
    dice: 'PROVABLY FAIR', baccarat: 'HIGH ROLLER', wheel: 'ROYAL ORIGINALS',
    keno: 'LOTTERY HALL', plinko: 'ROYAL ORIGINALS'
};

const GAME_GRADIENTS = {
    slots:     { g1: '#ec4899', g2: '#9f1239' },
    blackjack: { g1: '#10b981', g2: '#064e3b' },
    roulette:  { g1: '#a855f7', g2: '#4c1d95' },
    poker:     { g1: '#3b82f6', g2: '#1e3a8a' },
    crash:     { g1: '#f97316', g2: '#7c2d12' },
    mines:     { g1: '#0ea5e9', g2: '#0c4a6e' },
    dice:      { g1: '#06b6d4', g2: '#155e75' },
    baccarat:  { g1: '#f59e0b', g2: '#451a03' },
    wheel:     { g1: '#d946ef', g2: '#581c87' },
    keno:      { g1: '#ef4444', g2: '#831843' },
    plinko:    { g1: '#84cc16', g2: '#3f6212' }
};

const GAME_ART = {
    slots: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <circle cx="60" cy="20" r="10" fill="#fde68a"/>
        <polygon points="60,11 63,18 70,18 64,23 66,30 60,26 54,30 56,23 50,18 57,18" fill="#fbbf24"/>
        <rect x="16" y="38" width="26" height="58" rx="6" fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.4)" stroke-width="1.5"/>
        <rect x="47" y="38" width="26" height="58" rx="6" fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.4)" stroke-width="1.5"/>
        <rect x="78" y="38" width="26" height="58" rx="6" fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.4)" stroke-width="1.5"/>
        <text x="29" y="78" font-size="26" font-weight="900" fill="#fde047" text-anchor="middle" font-family="Arial">7</text>
        <text x="60" y="78" font-size="26" font-weight="900" fill="#fde047" text-anchor="middle" font-family="Arial">7</text>
        <text x="91" y="78" font-size="26" font-weight="900" fill="#fde047" text-anchor="middle" font-family="Arial">7</text>
        <rect x="14" y="98" width="92" height="3" rx="1.5" fill="#fbbf24" opacity=".7"/>
    </svg>`,
    blackjack: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(-14 44 65)">
            <rect x="20" y="35" width="42" height="58" rx="6" fill="#fff" stroke="rgba(0,0,0,.2)"/>
            <text x="28" y="58" font-size="20" font-weight="900" fill="#0f172a" font-family="Arial">A</text>
            <text x="28" y="78" font-size="22" fill="#0f172a" font-family="Arial">♠</text>
        </g>
        <g transform="rotate(14 78 60)">
            <rect x="58" y="30" width="42" height="58" rx="6" fill="#fff" stroke="rgba(0,0,0,.2)"/>
            <text x="66" y="53" font-size="20" font-weight="900" fill="#dc2626" font-family="Arial">K</text>
            <text x="66" y="73" font-size="22" fill="#dc2626" font-family="Arial">♥</text>
        </g>
    </svg>`,
    roulette: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <polygon points="60,8 53,22 67,22" fill="#fbbf24"/>
        <circle cx="60" cy="65" r="42" fill="#0a0e1a" stroke="#fbbf24" stroke-width="3"/>
        <g>
            <path d="M60 65 L60 23 A42 42 0 0 1 96 44 Z" fill="#dc2626"/>
            <path d="M60 65 L96 44 A42 42 0 0 1 96 86 Z" fill="#1a1a2e"/>
            <path d="M60 65 L96 86 A42 42 0 0 1 60 107 Z" fill="#dc2626"/>
            <path d="M60 65 L60 107 A42 42 0 0 1 24 86 Z" fill="#1a1a2e"/>
            <path d="M60 65 L24 86 A42 42 0 0 1 24 44 Z" fill="#dc2626"/>
            <path d="M60 65 L24 44 A42 42 0 0 1 60 23 Z" fill="#15803d"/>
        </g>
        <circle cx="60" cy="65" r="10" fill="#fbbf24"/>
        <circle cx="60" cy="65" r="5" fill="#0a0e1a"/>
        <circle cx="92" cy="56" r="3.5" fill="#fff"/>
    </svg>`,
    poker: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(60 76)">
            <g transform="rotate(-22)"><rect x="-14" y="-30" width="26" height="40" rx="4" fill="#fff"/><text x="-9" y="-15" font-size="12" font-weight="900" fill="#0f172a" font-family="Arial">10</text></g>
            <g transform="rotate(-11)"><rect x="-14" y="-34" width="26" height="40" rx="4" fill="#fff"/><text x="-9" y="-19" font-size="12" font-weight="900" fill="#dc2626" font-family="Arial">J</text></g>
            <g><rect x="-13" y="-36" width="26" height="40" rx="4" fill="#fff"/><text x="-9" y="-21" font-size="12" font-weight="900" fill="#0f172a" font-family="Arial">Q</text></g>
            <g transform="rotate(11)"><rect x="-12" y="-34" width="26" height="40" rx="4" fill="#fff"/><text x="-7" y="-19" font-size="12" font-weight="900" fill="#dc2626" font-family="Arial">K</text></g>
            <g transform="rotate(22)"><rect x="-12" y="-30" width="26" height="40" rx="4" fill="#fff"/><text x="-8" y="-15" font-size="12" font-weight="900" fill="#0f172a" font-family="Arial">A</text></g>
        </g>
        <text x="60" y="105" font-size="9" font-weight="900" fill="#fde68a" text-anchor="middle" letter-spacing="2" font-family="Arial">ROYAL FLUSH</text>
    </svg>`,
    crash: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 108 Q40 90 60 70 T108 16" stroke="#fde68a" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M12 110 Q35 95 50 82" stroke="#fff" stroke-opacity=".4" stroke-width="2" fill="none" stroke-linecap="round"/>
        <g transform="translate(92 28) rotate(-45)">
            <path d="M0 -16 L10 8 L0 16 L-10 8 Z" fill="#fff"/>
            <path d="M0 -16 L5 -4 L-5 -4 Z" fill="#dc2626"/>
            <circle cx="0" cy="-2" r="3.5" fill="#3b82f6"/>
            <path d="M-10 8 L-15 18 L0 10 Z" fill="#fb923c"/>
            <path d="M10 8 L15 18 L0 10 Z" fill="#fb923c"/>
            <path d="M-4 16 L4 16 L0 28 Z" fill="#fbbf24"/>
        </g>
        <text x="14" y="98" font-size="14" font-weight="900" fill="#fde68a" font-family="Arial">2.45×</text>
    </svg>`,
    mines: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(38 56)">
            <polygon points="0,-22 18,-10 14,22 -14,22 -18,-10" fill="#22d3ee" stroke="#fff" stroke-width="2"/>
            <polygon points="-18,-10 18,-10 0,-22" fill="#67e8f9"/>
            <polygon points="-18,-10 -14,22 0,-10" fill="#0891b2"/>
            <polygon points="18,-10 14,22 0,-10" fill="#0e7490"/>
            <line x1="-8" y1="-15" x2="-2" y2="-5" stroke="#fff" stroke-width="1.5"/>
        </g>
        <g transform="translate(82 70)">
            <circle r="18" fill="#0a0e1a" stroke="#fff" stroke-width="2"/>
            <circle cx="-5" cy="-6" r="4" fill="#fff" opacity=".4"/>
            <path d="M0 -18 L6 -26 L12 -22" stroke="#fbbf24" stroke-width="2" fill="none" stroke-linecap="round"/>
            <circle cx="12" cy="-22" r="3" fill="#ef4444"/>
            <circle cx="14" cy="-26" r="1.5" fill="#fff"/>
        </g>
    </svg>`,
    dice: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(-12 40 60)">
            <rect x="20" y="40" width="42" height="42" rx="8" fill="#fff" stroke="rgba(0,0,0,.15)"/>
            <circle cx="32" cy="52" r="3.5" fill="#0f172a"/>
            <circle cx="50" cy="52" r="3.5" fill="#0f172a"/>
            <circle cx="41" cy="61" r="3.5" fill="#0f172a"/>
            <circle cx="32" cy="70" r="3.5" fill="#0f172a"/>
            <circle cx="50" cy="70" r="3.5" fill="#0f172a"/>
        </g>
        <g transform="rotate(12 80 65)">
            <rect x="58" y="48" width="42" height="42" rx="8" fill="#fff" stroke="rgba(0,0,0,.15)"/>
            <circle cx="70" cy="60" r="3.5" fill="#dc2626"/>
            <circle cx="88" cy="60" r="3.5" fill="#dc2626"/>
            <circle cx="70" cy="78" r="3.5" fill="#dc2626"/>
            <circle cx="88" cy="78" r="3.5" fill="#dc2626"/>
        </g>
    </svg>`,
    baccarat: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 62 L24 32 L42 56 L60 22 L78 56 L96 32 L102 62 L96 90 L24 90 Z" fill="#fbbf24" stroke="#fff" stroke-width="2"/>
        <rect x="24" y="85" width="72" height="10" rx="2" fill="#d97706"/>
        <circle cx="24" cy="32" r="5" fill="#dc2626" stroke="#fff" stroke-width="1.5"/>
        <circle cx="60" cy="22" r="6" fill="#dc2626" stroke="#fff" stroke-width="1.5"/>
        <circle cx="96" cy="32" r="5" fill="#dc2626" stroke="#fff" stroke-width="1.5"/>
        <circle cx="42" cy="70" r="4" fill="#22d3ee" stroke="#fff" stroke-width="1"/>
        <circle cx="78" cy="70" r="4" fill="#22d3ee" stroke="#fff" stroke-width="1"/>
    </svg>`,
    wheel: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <polygon points="60,8 53,22 67,22" fill="#fbbf24"/>
        <circle cx="60" cy="63" r="46" fill="#0a0e1a"/>
        <g>
            <path d="M60 63 L60 17 A46 46 0 0 1 100 40 Z" fill="#ec4899"/>
            <path d="M60 63 L100 40 A46 46 0 0 1 100 86 Z" fill="#fbbf24"/>
            <path d="M60 63 L100 86 A46 46 0 0 1 60 109 Z" fill="#8b5cf6"/>
            <path d="M60 63 L60 109 A46 46 0 0 1 20 86 Z" fill="#06b6d4"/>
            <path d="M60 63 L20 86 A46 46 0 0 1 20 40 Z" fill="#22c55e"/>
            <path d="M60 63 L20 40 A46 46 0 0 1 60 17 Z" fill="#ef4444"/>
        </g>
        <circle cx="60" cy="63" r="46" fill="none" stroke="#fbbf24" stroke-width="3"/>
        <circle cx="60" cy="63" r="9" fill="#fff"/>
        <text x="60" y="67" font-size="9" font-weight="900" fill="#0a0e1a" text-anchor="middle" font-family="Arial">SPIN</text>
    </svg>`,
    keno: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <g>
            <circle cx="34" cy="38" r="20" fill="#fbbf24" stroke="#fff" stroke-width="2.5"/>
            <ellipse cx="28" cy="32" rx="6" ry="3" fill="#fef3c7" opacity=".7"/>
            <text x="34" y="44" font-size="16" font-weight="900" text-anchor="middle" fill="#7c2d12" font-family="Arial">7</text>
        </g>
        <g>
            <circle cx="82" cy="55" r="20" fill="#ec4899" stroke="#fff" stroke-width="2.5"/>
            <ellipse cx="76" cy="49" rx="6" ry="3" fill="#fbcfe8" opacity=".7"/>
            <text x="82" y="61" font-size="16" font-weight="900" text-anchor="middle" fill="#fff" font-family="Arial">23</text>
        </g>
        <g>
            <circle cx="48" cy="90" r="20" fill="#3b82f6" stroke="#fff" stroke-width="2.5"/>
            <ellipse cx="42" cy="84" rx="6" ry="3" fill="#bfdbfe" opacity=".7"/>
            <text x="48" y="96" font-size="16" font-weight="900" text-anchor="middle" fill="#fff" font-family="Arial">42</text>
        </g>
    </svg>`,
    plinko: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <g fill="#fff">
            <circle cx="60" cy="32" r="3"/>
            <circle cx="48" cy="46" r="3"/><circle cx="72" cy="46" r="3"/>
            <circle cx="36" cy="60" r="3"/><circle cx="60" cy="60" r="3"/><circle cx="84" cy="60" r="3"/>
            <circle cx="24" cy="74" r="3"/><circle cx="48" cy="74" r="3"/><circle cx="72" cy="74" r="3"/><circle cx="96" cy="74" r="3"/>
        </g>
        <circle cx="60" cy="18" r="6" fill="#fbbf24" stroke="#fff" stroke-width="1.5"/>
        <circle cx="58" cy="16" r="2" fill="#fef3c7"/>
        <g>
            <rect x="14" y="90" width="18" height="18" rx="2" fill="#22c55e" stroke="#fff" stroke-width="1.5"/>
            <text x="23" y="103" font-size="9" font-weight="900" fill="#fff" text-anchor="middle" font-family="Arial">2×</text>
            <rect x="34" y="90" width="18" height="18" rx="2" fill="#fbbf24" stroke="#fff" stroke-width="1.5"/>
            <text x="43" y="103" font-size="9" font-weight="900" fill="#7c2d12" text-anchor="middle" font-family="Arial">10×</text>
            <rect x="54" y="90" width="18" height="18" rx="2" fill="#ef4444" stroke="#fff" stroke-width="1.5"/>
            <text x="63" y="103" font-size="9" font-weight="900" fill="#fff" text-anchor="middle" font-family="Arial">100×</text>
            <rect x="74" y="90" width="18" height="18" rx="2" fill="#fbbf24" stroke="#fff" stroke-width="1.5"/>
            <text x="83" y="103" font-size="9" font-weight="900" fill="#7c2d12" text-anchor="middle" font-family="Arial">10×</text>
            <rect x="94" y="90" width="18" height="18" rx="2" fill="#22c55e" stroke="#fff" stroke-width="1.5"/>
            <text x="103" y="103" font-size="9" font-weight="900" fill="#fff" text-anchor="middle" font-family="Arial">2×</text>
        </g>
    </svg>`
};

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
    if (!Casino.soundEnabled || !Casino.hapticsEnabled) return;
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
    bindClick('settings-btn', showSettings);
    bindClick('close-settings', () => closeModal('settings-modal'));

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
            document.querySelectorAll('.cat-tab').forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            renderLobby();
            playSound('click');
        });
    });

    initSidebar();
    initHelpBubble();

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
            Casino.volume = s.volume ?? 1.0;
            Casino.animationsEnabled = s.animationsEnabled ?? true;
            Casino.hapticsEnabled = s.hapticsEnabled ?? true;
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
            volume: Casino.volume,
            animationsEnabled: Casino.animationsEnabled,
            hapticsEnabled: Casino.hapticsEnabled,
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

/* Special "Bonus Buy" deduction — counts as wagered and grants XP,
   but does NOT start a regular bet (so the win-tracking won't mark
   the resulting free spins as one giant payout). Used by themed
   slots' "Buy Bonus" button. */
window.Casino.buyBonusFlat = function(amount) {
    if (Casino.balance < amount || amount <= 0) return false;
    Casino.balance -= amount;
    Casino.stats.totalWagered += amount;
    Casino.stats.gamesPlayed++;
    Casino.dailyStats.wagered += amount;
    Casino.dailyStats.rounds++;
    if (Casino.currentGame && !Casino.dailyStats.gamesSet.includes(Casino.currentGame)) {
        Casino.dailyStats.gamesSet.push(Casino.currentGame);
    }
    Casino.vip.xp += amount;
    checkVIPLevelUp();
    updateVIPUI();
    updateBalanceUI();
    flashBalance(false);
    updateMissionProgress();
    renderRescue();
    saveState();
    return true;
};

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
        gain.gain.setValueAtTime(vol * Casino.volume, ctx.currentTime + timeOffset);
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

/* Play an arbitrary sequence of tones — used by themed games for
   genre-specific sound palettes (Egyptian pentatonic vs. cyberpunk
   square waves, etc.). */
window.Casino.playTones = function(spec) {
    if (!Casino.soundEnabled) return;
    primeAudio();
    if (!audioCtx || !Array.isArray(spec)) return;
    const ctx = audioCtx;
    try {
        spec.forEach(s => {
            const wave = s.wave || 'sine';
            const start = s.start || 0;
            const dur = s.dur || 0.2;
            const vol = (s.vol != null ? s.vol : 0.06) * Casino.volume;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = wave;
            osc.frequency.setValueAtTime(s.freq, ctx.currentTime + start);
            if (s.freqEnd) osc.frequency.exponentialRampToValueAtTime(s.freqEnd, ctx.currentTime + start + dur);
            gain.gain.setValueAtTime(vol, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + dur);
        });
    } catch(e) {}
};

/* ---- Lobby ---- */
function getFilteredGames() {
    const q = ($('game-search')?.value || '').trim().toLowerCase();
    return GAME_CARDS.filter(g => q && (g.name.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q)));
}
function topPlayedIds(n) {
    return Object.entries(Casino.playCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .filter(e => e[1] > 0)
        .map(e => e[0]);
}
function buildGameCard(g, opts) {
    opts = opts || {};
    const grad = GAME_GRADIENTS[g.id] || { g1: g.accent, g2: '#0f172a' };
    const art = GAME_ART[g.id] || '';
    const isNew = !Casino.playCounts[g.id];
    const isHot = opts.hot;
    const badge = isHot ? '<span class="card-badge hot">🔥 HOT</span>' :
                  isNew ? '<span class="card-badge new">NEW</span>' : '';
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'game-card';
    card.style.setProperty('--g1', grad.g1);
    card.style.setProperty('--g2', grad.g2);
    card.setAttribute('aria-label', `${g.name}: ${g.desc}`);
    const studio = GAME_STUDIOS[g.id] || 'ORIGINAL';
    card.innerHTML = `
        ${badge}
        <div class="card-art">${art}</div>
        <div class="card-meta">
            <div class="card-name">${esc(g.name)}</div>
            <div class="card-sub">${esc(studio)}</div>
        </div>
        <div class="card-play"><span>▶ PLAY</span></div>
    `;
    card.addEventListener('click', () => openGame(g.id));
    attachTilt(card);
    return card;
}

/* Pointer-driven 3D tilt on cards. Skipped under prefers-reduced-motion
   and on touch-primary devices. */
const isTouchPrimary = matchMedia('(hover: none)').matches;
function attachTilt(card) {
    if (reducedMotion || isTouchPrimary) return;
    let rafId = 0;
    card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;  // 0..1
        const y = (e.clientY - r.top) / r.height;  // 0..1
        const rx = (0.5 - y) * 8;  // tilt up to 8deg
        const ry = (x - 0.5) * 10;
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px) scale(1.025)`;
        });
    });
    card.addEventListener('pointerleave', () => {
        cancelAnimationFrame(rafId);
        card.style.transform = '';
    });
}
function buildRow(title, icon, games, rowClass) {
    if (!games.length) return null;
    const section = document.createElement('section');
    section.className = 'game-row-section ' + (rowClass || '');
    const header = document.createElement('div');
    header.className = 'row-header';
    header.innerHTML = `<h3>${icon ? `<span class="row-icon">${icon}</span>` : ''}${esc(title)}</h3>`;
    section.appendChild(header);
    const row = document.createElement('div');
    row.className = 'game-row';
    games.forEach(g => row.appendChild(buildGameCard(g, { hot: rowClass === 'row-hot' })));
    section.appendChild(row);
    return section;
}
function renderLobby() {
    const grid = $('games-grid');
    grid.innerHTML = '';
    const q = ($('game-search')?.value || '').trim().toLowerCase();
    const activeCat = document.querySelector('.cat-tab.active')?.dataset.cat || 'all';

    if (q) {
        const filtered = getFilteredGames();
        if (filtered.length === 0) {
            grid.innerHTML = `<div class="no-results">No games match "${esc(q)}".</div>`;
            return;
        }
        const wrap = document.createElement('div');
        wrap.className = 'game-grid-inner';
        filtered.forEach(g => wrap.appendChild(buildGameCard(g)));
        grid.appendChild(wrap);
        return;
    }

    const categoryDefs = [
        { cat: 'slots',   title: 'Slots',       icon: '🎰' },
        { cat: 'cards',   title: 'Card Games',  icon: '🃏' },
        { cat: 'spin',    title: 'Spin & Win',  icon: '🎡' },
        { cat: 'instant', title: 'Instant Play', icon: '⚡' }
    ];

    if (activeCat === 'all') {
        // Hot row: top-played, padded with default order to always show 6.
        const hotIds = topPlayedIds(6);
        const padding = GAME_CARDS.map(g => g.id).filter(id => !hotIds.includes(id));
        const hotList = [...hotIds, ...padding].slice(0, 6).map(id => GAME_CARDS.find(g => g.id === id));
        const hot = buildRow('Trending Now', '🔥', hotList, 'row-hot');
        if (hot) grid.appendChild(hot);

        categoryDefs.forEach(d => {
            const games = GAME_CARDS.filter(g => g.category === d.cat);
            const sec = buildRow(d.title, d.icon, games);
            if (sec) grid.appendChild(sec);
        });

        const bigWins = buildBigWinsRow();
        if (bigWins) grid.appendChild(bigWins);
    } else {
        const games = GAME_CARDS.filter(g => g.category === activeCat);
        const def = categoryDefs.find(d => d.cat === activeCat);
        const sec = buildRow(def ? def.title : 'Games', def ? def.icon : '', games);
        if (sec) {
            sec.querySelector('.game-row').classList.add('game-row-grid');
            grid.appendChild(sec);
        }
    }
}

function buildBigWinsRow() {
    const wins = (Casino.betHistory || []).filter(b => b.won > 0).slice(0, 8);
    if (!wins.length) return null;
    const section = document.createElement('section');
    section.className = 'game-row-section big-wins-section';
    section.innerHTML = `<div class="row-header"><h3><span class="row-icon live-dot-inline"></span>Recent Big Wins</h3></div>`;
    const row = document.createElement('div');
    row.className = 'big-wins-row';
    wins.forEach(b => {
        const g = GAME_CARDS.find(c => c.id === b.game);
        if (!g) return;
        const grad = GAME_GRADIENTS[g.id] || { g1: g.accent, g2: '#0f172a' };
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'big-win-tile';
        tile.style.setProperty('--g1', grad.g1);
        tile.style.setProperty('--g2', grad.g2);
        tile.setAttribute('aria-label', `Play ${g.name}, last win $${b.won.toLocaleString()}`);
        tile.innerHTML = `
            <div class="big-win-art">${GAME_ART[g.id] || ''}</div>
            <div class="big-win-amount">+$${b.won.toLocaleString()}</div>
            <div class="big-win-mult">${b.mult.toFixed(2)}×</div>
        `;
        tile.addEventListener('click', () => openGame(g.id));
        row.appendChild(tile);
    });
    section.appendChild(row);
    return section;
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
        const grad = GAME_GRADIENTS[g.id] || { g1: g.accent, g2: '#0f172a' };
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'recent-tile';
        tile.style.setProperty('--g1', grad.g1);
        tile.style.setProperty('--g2', grad.g2);
        tile.setAttribute('aria-label', `Resume ${g.name}`);
        tile.innerHTML = `<div class="recent-tile-art">${GAME_ART[g.id] || ''}</div><span class="recent-tile-name">${esc(g.name)}</span>`;
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

    // Apply themed background tint
    const grad = GAME_GRADIENTS[id];
    if (grad) {
        document.documentElement.style.setProperty('--game-g1', grad.g1);
        document.documentElement.style.setProperty('--game-g2', grad.g2);
        document.body.classList.add('in-game');
    }

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

    // Clear themed background tint
    document.body.classList.remove('in-game');
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
    document.body.classList.toggle('no-animations', !Casino.animationsEnabled);
}

/* ---- Settings modal ---- */
function showSettings() {
    const body = $('settings-body');
    if (!body) return;
    body.innerHTML = `
        <label class="settings-row">
            <span class="settings-label">🔊 Volume</span>
            <input type="range" id="settings-volume" min="0" max="100" step="1" value="${Math.round(Casino.volume * 100)}" class="settings-slider">
            <span class="settings-value" id="settings-volume-val">${Math.round(Casino.volume * 100)}%</span>
        </label>
        <label class="settings-row">
            <span class="settings-label">✨ Animations</span>
            <input type="checkbox" id="settings-anim" ${Casino.animationsEnabled ? 'checked' : ''} class="settings-toggle">
        </label>
        <label class="settings-row">
            <span class="settings-label">📳 Haptics (vibration)</span>
            <input type="checkbox" id="settings-haptic" ${Casino.hapticsEnabled ? 'checked' : ''} class="settings-toggle">
        </label>
        <label class="settings-row">
            <span class="settings-label">🔔 Sound effects</span>
            <input type="checkbox" id="settings-sound" ${Casino.soundEnabled ? 'checked' : ''} class="settings-toggle">
        </label>
        <p class="settings-note">Settings persist across sessions. Disable animations for the lowest-CPU experience.</p>
    `;
    $('settings-volume').addEventListener('input', e => {
        Casino.volume = e.target.value / 100;
        $('settings-volume-val').textContent = e.target.value + '%';
        saveState();
    });
    $('settings-volume').addEventListener('change', () => {
        playSound('click'); // preview
    });
    $('settings-anim').addEventListener('change', e => {
        Casino.animationsEnabled = e.target.checked;
        document.body.classList.toggle('no-animations', !Casino.animationsEnabled);
        saveState();
    });
    $('settings-haptic').addEventListener('change', e => {
        Casino.hapticsEnabled = e.target.checked;
        saveState();
        if (e.target.checked) haptic([30, 30, 30]);
    });
    $('settings-sound').addEventListener('change', e => {
        Casino.soundEnabled = e.target.checked;
        const btn = $('sound-toggle');
        btn.textContent = Casino.soundEnabled ? '🔊' : '🔇';
        btn.setAttribute('aria-pressed', String(!Casino.soundEnabled));
        saveState();
        if (e.target.checked) playSound('click');
    });
    openModal('settings-modal');
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

/* ---- External game registration (used by slot-themes.js, etc.) ---- */
window.Casino.registerGame = function(meta, gameLogic) {
    if (Casino.games[meta.id]) return;  // already registered
    GAME_CARDS.push({
        id: meta.id,
        name: meta.name,
        icon: meta.icon || '🎰',
        desc: meta.desc || '',
        accent: meta.g1 || '#d4a843',
        category: meta.category || 'slots'
    });
    GAME_GRADIENTS[meta.id] = { g1: meta.g1, g2: meta.g2 };
    GAME_ART[meta.id] = meta.art || '';
    GAME_STUDIOS[meta.id] = meta.studio || 'ORIGINAL';
    Casino.games[meta.id] = gameLogic;
    // If the lobby has already rendered, refresh it.
    if (document.getElementById('games-grid')?.childElementCount) renderLobby();
};

/* ---- Sidebar ---- */
function initSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    sidebar.querySelectorAll('[data-nav]').forEach(btn => {
        btn.addEventListener('click', () => {
            const nav = btn.dataset.nav;
            playSound('click');
            if (Casino.currentGame) showLobby();
            // Defer so showLobby's transition has time to remove .hidden
            setTimeout(() => handleSidebarNav(nav, btn), Casino.currentGame ? 320 : 0);
        });
    });
}
function handleSidebarNav(nav, btn) {
    if (nav === 'home') {
        // Reset filter to All, scroll to top.
        const allTab = document.querySelector('.cat-tab[data-cat="all"]');
        if (allTab) allTab.click();
        window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
        markActiveSidebar(btn);
    } else if (nav === 'cat') {
        const tab = document.querySelector(`.cat-tab[data-cat="${btn.dataset.cat}"]`);
        if (tab) tab.click();
        scrollToSelector('#games-grid');
        markActiveSidebar(btn);
    } else if (nav === 'trending') {
        const allTab = document.querySelector('.cat-tab[data-cat="all"]');
        if (allTab && !allTab.classList.contains('active')) allTab.click();
        scrollToSelector('#games-grid');
        markActiveSidebar(btn);
    } else if (nav === 'missions') {
        scrollToSelector('.missions-section');
        markActiveSidebar(btn);
    } else if (nav === 'leaderboard') {
        scrollToSelector('.leaderboard');
        markActiveSidebar(btn);
    } else if (nav === 'shop') {
        openShop();
    } else if (nav === 'stats') {
        showStats();
    }
}
function markActiveSidebar(btn) {
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
    if (btn && btn.classList.contains('sidebar-btn')) btn.classList.add('active');
}
function scrollToSelector(sel) {
    const el = document.querySelector(sel);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 60;
    window.scrollTo({ top, behavior: reducedMotion ? 'auto' : 'smooth' });
}

/* ---- Help bubble ---- */
function initHelpBubble() {
    const bubble = $('help-bubble');
    const panel = $('help-panel');
    if (!bubble || !panel) return;
    bubble.addEventListener('click', () => {
        const open = !panel.classList.contains('hidden');
        if (open) {
            panel.classList.add('hidden');
            panel.setAttribute('aria-hidden', 'true');
        } else {
            panel.classList.remove('hidden');
            panel.setAttribute('aria-hidden', 'false');
        }
        playSound('click');
    });
    $('close-help').addEventListener('click', () => {
        panel.classList.add('hidden');
        panel.setAttribute('aria-hidden', 'true');
    });
    // Close on outside click
    document.addEventListener('click', e => {
        if (panel.classList.contains('hidden')) return;
        if (!panel.contains(e.target) && !bubble.contains(e.target)) {
            panel.classList.add('hidden');
            panel.setAttribute('aria-hidden', 'true');
        }
    });
}
