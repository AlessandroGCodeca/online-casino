/* Themed single-line 3-reel slot machines.
   One generic engine + 10 theme configs registered as Casino games. */
(function () {
    'use strict';

    const SYMBOL_ROW = 90; // px height of each reel cell

    function weightedPick(symbols, weights) {
        const r = Math.random();
        let acc = 0;
        for (let i = 0; i < symbols.length; i++) {
            acc += weights[i];
            if (r < acc) return symbols[i];
        }
        return symbols[symbols.length - 1];
    }

    function makeSlotGame(theme) {
        let bet = 100;
        let spinning = false;
        let area = null;
        const baseSym = theme.symbols[0];

        function $$(sel) { return area && area.querySelector(sel); }

        function init(gameArea) {
            area = gameArea;
            renderUI();
            resetReels();
            wireControls();
        }

        function renderUI() {
            const payHtml = theme.symbols.map((s, i) => {
                const pay = theme.payouts[s];
                return `<span class="ts-pay-item"><span class="ts-sym">${s}</span>×3 = <b>${pay}×</b></span>`;
            }).join('');

            area.innerHTML = `
            <div class="themed-slot" style="--ts-g1:${theme.g1};--ts-g2:${theme.g2};--ts-accent:${theme.accent || '#fbbf24'}">
                <div class="ts-frame">
                    <div class="ts-banner">
                        <span class="ts-banner-icon">${theme.icon}</span>
                        <span class="ts-banner-title">${theme.name}</span>
                    </div>
                    <div class="ts-reels-row">
                        <div class="ts-reel"><div class="ts-strip" data-reel="0"></div></div>
                        <div class="ts-reel"><div class="ts-strip" data-reel="1"></div></div>
                        <div class="ts-reel"><div class="ts-strip" data-reel="2"></div></div>
                        <div class="ts-payline" aria-hidden="true"></div>
                    </div>
                    <div class="ts-message game-message" data-role="msg">${theme.tagline || 'Match 3 to win!'}</div>
                </div>
                <div class="game-controls ts-controls">
                    <div class="bet-group">
                        <span class="bet-label">Bet</span>
                        <button class="bet-btn" type="button" data-bet="50">$50</button>
                        <button class="bet-btn" type="button" data-bet="100">$100</button>
                        <button class="bet-btn" type="button" data-bet="250">$250</button>
                        <button class="bet-btn" type="button" data-bet="500">$500</button>
                    </div>
                    <button class="action-btn primary ts-spin" type="button" data-role="spin">SPIN — $${bet}</button>
                </div>
                <div class="ts-paytable">
                    <div class="ts-paytable-head">
                        <span>Payouts (×bet)</span>
                        <span><span class="ts-sym">${theme.wild}</span> Wild · Substitutes any symbol</span>
                    </div>
                    <div class="ts-paytable-grid">${payHtml}</div>
                </div>
            </div>`;
        }

        function wireControls() {
            area.querySelectorAll('.bet-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (spinning) return;
                    bet = parseInt(btn.dataset.bet, 10);
                    $$('.ts-spin').textContent = `SPIN — $${bet}`;
                    Casino.playSound('click');
                });
            });
            $$('[data-role=spin]').addEventListener('click', spin);
        }

        function resetReels() {
            for (let r = 0; r < 3; r++) {
                const strip = area.querySelector(`[data-reel="${r}"]`);
                strip.style.transition = 'none';
                strip.style.transform = 'translateY(0)';
                strip.innerHTML = `<div class="ts-cell">${baseSym}</div>`.repeat(3);
            }
        }

        function spin() {
            if (spinning) return;
            if (!Casino.placeBet(bet)) {
                $$('[data-role=msg]').textContent = 'Not enough chips!';
                $$('[data-role=msg]').className = 'ts-message game-message lose';
                return;
            }
            spinning = true;
            const btn = $$('[data-role=spin]');
            btn.disabled = true; btn.textContent = 'SPINNING...';
            $$('[data-role=msg]').textContent = 'Good luck!';
            $$('[data-role=msg]').className = 'ts-message game-message';
            Casino.playSound('click');

            const result = [pick(), pick(), pick()];
            const spinCounts = [16, 22, 28];

            result.forEach((sym, r) => {
                const strip = area.querySelector(`[data-reel="${r}"]`);
                const cells = Array.from({ length: spinCounts[r] }, () => `<div class="ts-cell">${pick()}</div>`).join('') +
                              `<div class="ts-cell">${sym}</div>`;
                strip.innerHTML = cells;
                strip.style.transition = 'none';
                strip.style.transform = 'translateY(0)';
                void strip.offsetWidth;
                const offset = -(spinCounts[r]) * SYMBOL_ROW;
                requestAnimationFrame(() => {
                    strip.style.transition = `transform ${1.4 + r * 0.5}s cubic-bezier(0.2, 0.85, 0.25, 1)`;
                    strip.style.transform = `translateY(${offset}px)`;
                });
                setTimeout(() => Casino.playSound('click'), (1.4 + r * 0.5) * 1000);
            });

            setTimeout(() => evaluate(result), (1.4 + 2 * 0.5) * 1000 + 200);
        }

        function pick() { return weightedPick(theme.symbols, theme.weights); }

        function evaluate(result) {
            const msg = $$('[data-role=msg]');
            const wild = theme.wild;
            // Determine "matched symbol" by treating wilds as flexible.
            const nonWild = result.filter(s => s !== wild);
            let payoutSym = null;
            if (nonWild.length === 0) {
                // 3 wilds → top payout × 5
                payoutSym = '__triple_wild__';
            } else if (nonWild.every(s => s === nonWild[0])) {
                payoutSym = nonWild[0]; // all matching (with wilds substituting)
            }

            let win = 0, label = '';
            if (payoutSym === '__triple_wild__') {
                const maxPayout = Math.max(...Object.values(theme.payouts));
                win = bet * maxPayout * 5;
                label = `🎆 TRIPLE ${wild} MEGA JACKPOT! 🎆`;
            } else if (payoutSym && result.length === 3) {
                const mult = theme.payouts[payoutSym] || 0;
                win = bet * mult;
                const wildsUsed = result.filter(s => s === wild).length;
                label = wildsUsed
                    ? `3× ${payoutSym} (${wildsUsed} wild!) — Won $${win.toLocaleString()}!`
                    : `3× ${payoutSym}! Won $${win.toLocaleString()}!`;
            }

            if (win > 0) {
                Casino.changeBalance(win);
                msg.textContent = label;
                msg.className = 'ts-message game-message win';
                if (win >= bet * 25) { Casino.showWinEffect(win); Casino.playSound('jackpot'); }
                else Casino.playSound('win');
            } else {
                msg.textContent = result.join(' · ') + ' — no win, try again';
                msg.className = 'ts-message game-message lose';
                Casino.playSound('lose');
            }

            spinning = false;
            const btn = $$('[data-role=spin]');
            btn.disabled = false;
            btn.textContent = `SPIN — $${bet}`;
        }

        return { init, destroy() { spinning = false; } };
    }

    /* Lobby card art — a themed slot frame with the centerpiece symbol. */
    function makeArt(centerEmoji, accentEmoji) {
        return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <rect x="14" y="38" width="92" height="58" rx="10" fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.4)" stroke-width="2"/>
            <rect x="20" y="45" width="22" height="44" rx="4" fill="rgba(0,0,0,.4)"/>
            <rect x="49" y="45" width="22" height="44" rx="4" fill="rgba(0,0,0,.4)"/>
            <rect x="78" y="45" width="22" height="44" rx="4" fill="rgba(0,0,0,.4)"/>
            <text x="31" y="78" font-size="18" text-anchor="middle">${centerEmoji}</text>
            <text x="60" y="78" font-size="18" text-anchor="middle">${centerEmoji}</text>
            <text x="89" y="78" font-size="18" text-anchor="middle">${centerEmoji}</text>
            <rect x="16" y="66" width="88" height="2" fill="#fbbf24" opacity=".7"/>
            <text x="60" y="28" font-size="22" text-anchor="middle">${accentEmoji}</text>
        </svg>`;
    }

    const THEMES = [
        {
            id: 'slot_egypt', name: 'Pharaoh Riches', icon: '𓂀',
            desc: 'Treasures of the Nile await',
            g1: '#fbbf24', g2: '#7c2d12', accent: '#fbbf24',
            studio: 'PYRAMID GAMING',
            art: makeArt('☥', '𓂀'),
            tagline: 'Awaken the gods of Egypt!',
            symbols: ['🐍', '🪲', '☥', '🏺', '𓂀', '🔱'],
            weights: [0.32, 0.25, 0.18, 0.13, 0.08, 0.04],
            payouts: { '🐍': 4, '🪲': 8, '☥': 15, '🏺': 40, '𓂀': 100, '🔱': 250 },
            wild: '🔱'
        },
        {
            id: 'slot_fruit', name: 'Fruit Cocktail', icon: '🍒',
            desc: 'Classic fruit machine vibes',
            g1: '#f97316', g2: '#9a3412', accent: '#fde047',
            studio: 'CLASSIC REELS',
            art: makeArt('🍒', '🍋'),
            tagline: 'Sun-kissed and juicy wins!',
            symbols: ['🍒', '🍋', '🍊', '🍇', '🍉', '🔔', '7️⃣'],
            weights: [0.28, 0.22, 0.18, 0.13, 0.10, 0.06, 0.03],
            payouts: { '🍒': 3, '🍋': 5, '🍊': 8, '🍇': 12, '🍉': 25, '🔔': 75, '7️⃣': 200 },
            wild: '7️⃣'
        },
        {
            id: 'slot_pirate', name: "Pirate's Bounty", icon: '🏴‍☠️',
            desc: 'Yo-ho-ho and a chest of gold',
            g1: '#0ea5e9', g2: '#0c4a6e', accent: '#fbbf24',
            studio: 'BLACKBEARD STUDIOS',
            art: makeArt('💀', '🏴‍☠️'),
            tagline: 'Plunder the seven seas!',
            symbols: ['🦜', '⚓', '⚔️', '🗝️', '💀', '🪙', '🏴‍☠️'],
            weights: [0.30, 0.22, 0.18, 0.13, 0.10, 0.05, 0.02],
            payouts: { '🦜': 3, '⚓': 6, '⚔️': 10, '🗝️': 20, '💀': 50, '🪙': 100, '🏴‍☠️': 300 },
            wild: '🏴‍☠️'
        },
        {
            id: 'slot_aztec', name: 'Aztec Gold', icon: '🗿',
            desc: 'Lost temples of the jungle',
            g1: '#15803d', g2: '#1e1b4b', accent: '#fbbf24',
            studio: 'JUNGLE PRAGMA',
            art: makeArt('🗿', '🌞'),
            tagline: 'Awaken ancient riches!',
            symbols: ['🌿', '🐍', '🐆', '🌞', '🗿', '💎', '👑'],
            weights: [0.30, 0.22, 0.18, 0.13, 0.09, 0.05, 0.03],
            payouts: { '🌿': 3, '🐍': 5, '🐆': 10, '🌞': 20, '🗿': 50, '💎': 100, '👑': 250 },
            wild: '👑'
        },
        {
            id: 'slot_western', name: 'Wild West', icon: '🤠',
            desc: 'Cowboys, gold, and showdowns',
            g1: '#b45309', g2: '#451a03', accent: '#fde047',
            studio: 'SADDLE UP GAMES',
            art: makeArt('🐎', '🤠'),
            tagline: 'High noon — draw to win!',
            symbols: ['🌵', '👢', '🐎', '🔫', '⭐', '💰', '🤠'],
            weights: [0.30, 0.22, 0.18, 0.13, 0.09, 0.05, 0.03],
            payouts: { '🌵': 3, '👢': 5, '🐎': 10, '🔫': 20, '⭐': 50, '💰': 100, '🤠': 200 },
            wild: '🤠'
        },
        {
            id: 'slot_space', name: 'Galaxy Spin', icon: '🚀',
            desc: 'Cosmic multipliers from deep space',
            g1: '#7c3aed', g2: '#020617', accent: '#22d3ee',
            studio: 'NEON COSMOS',
            art: makeArt('🪐', '🚀'),
            tagline: 'Blast off to cosmic wins!',
            symbols: ['💫', '⭐', '🛸', '👽', '🪐', '☄️', '🚀'],
            weights: [0.30, 0.22, 0.18, 0.13, 0.09, 0.05, 0.03],
            payouts: { '💫': 3, '⭐': 5, '🛸': 10, '👽': 20, '🪐': 50, '☄️': 100, '🚀': 300 },
            wild: '🚀'
        },
        {
            id: 'slot_dragon', name: "Dragon's Fortune", icon: '🐉',
            desc: 'Oriental luck and dragon gold',
            g1: '#dc2626', g2: '#450a0a', accent: '#fde047',
            studio: 'IMPERIAL ORIENT',
            art: makeArt('🐉', '🏮'),
            tagline: 'Summon the dragon!',
            symbols: ['🎋', '🏮', '🐟', '☯️', '🪙', '💰', '🐉'],
            weights: [0.30, 0.22, 0.18, 0.13, 0.09, 0.05, 0.03],
            payouts: { '🎋': 3, '🏮': 5, '🐟': 10, '☯️': 20, '🪙': 50, '💰': 125, '🐉': 250 },
            wild: '🐉'
        },
        {
            id: 'slot_candy', name: 'Sweet Bonanza', icon: '🍭',
            desc: 'Candy-coated multipliers',
            g1: '#ec4899', g2: '#831843', accent: '#fde047',
            studio: 'CANDY KINGDOM',
            art: makeArt('🍭', '🍬'),
            tagline: 'A sugar rush of wins!',
            symbols: ['🍪', '🍫', '🍩', '🧁', '🍰', '🍬', '🍭'],
            weights: [0.30, 0.22, 0.18, 0.13, 0.09, 0.05, 0.03],
            payouts: { '🍪': 3, '🍫': 5, '🍩': 10, '🧁': 20, '🍰': 40, '🍬': 80, '🍭': 200 },
            wild: '🍭'
        },
        {
            id: 'slot_halloween', name: 'Halloween Spooks', icon: '🎃',
            desc: 'Trick-or-treat for tricks of gold',
            g1: '#f97316', g2: '#3b0764', accent: '#a3e635',
            studio: 'MIDNIGHT REELS',
            art: makeArt('🎃', '👻'),
            tagline: 'Boo! Win big this Hallows Eve!',
            symbols: ['🕷️', '🦇', '👻', '🧙', '💀', '🎃', '👹'],
            weights: [0.30, 0.22, 0.18, 0.13, 0.09, 0.05, 0.03],
            payouts: { '🕷️': 3, '🦇': 5, '👻': 10, '🧙': 20, '💀': 50, '🎃': 100, '👹': 250 },
            wild: '🎃'
        },
        {
            id: 'slot_norse', name: 'Norse Gods', icon: '⚒️',
            desc: 'Hammer of Thor strikes gold',
            g1: '#475569', g2: '#0f172a', accent: '#fbbf24',
            studio: 'VALHALLA STUDIOS',
            art: makeArt('⚒️', '⚡'),
            tagline: 'For Asgard and gold!',
            symbols: ['🌳', '🛡️', '🐺', '🦅', '⚡', '👁️', '⚒️'],
            weights: [0.30, 0.22, 0.18, 0.13, 0.09, 0.05, 0.03],
            payouts: { '🌳': 3, '🛡️': 5, '🐺': 10, '🦅': 20, '⚡': 50, '👁️': 100, '⚒️': 250 },
            wild: '⚒️'
        }
    ];

    // Register each theme.
    THEMES.forEach(theme => {
        if (!window.Casino || typeof Casino.registerGame !== 'function') return;
        Casino.registerGame({
            id: theme.id, name: theme.name, desc: theme.desc, icon: theme.icon,
            g1: theme.g1, g2: theme.g2, studio: theme.studio, art: theme.art,
            category: 'slots'
        }, makeSlotGame(theme));
    });
})();
