/* Themed single-line 3-reel slot machines.
   Generic engine + 20 themes registered as separate games.
   Each theme has: symbol set with wild + scatter, weighted distribution,
   payout table, color gradient, illustrated card art, sound palette,
   and free-spin bonus rounds with a configurable multiplier. */
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

    /* Theme-specific sound: builds tone spec from the theme's palette
       and hands it to Casino.playTones (single shared AudioContext). */
    function playThemeSound(theme, type) {
        if (!Casino.playTones) return;
        const pal = theme.palette || [400, 500, 600, 700];
        const wave = theme.wave || 'sine';
        let spec = [];
        if (type === 'reelStop') {
            spec = [{ freq: pal[0], wave, dur: 0.07, vol: 0.04 }];
        } else if (type === 'spinStart') {
            spec = [
                { freq: pal[pal.length - 1] || pal[0], wave, dur: 0.12, vol: 0.04 },
                { freq: pal[0] * 0.7, wave, start: 0.06, dur: 0.14, vol: 0.04 }
            ];
        } else if (type === 'win') {
            spec = pal.map((f, i) => ({ freq: f, wave, start: i * 0.09, dur: 0.28, vol: 0.07 }));
        } else if (type === 'bigWin') {
            spec = [
                ...pal.map((f, i) => ({ freq: f, wave, start: i * 0.08, dur: 0.3, vol: 0.07 })),
                ...pal.map((f, i) => ({ freq: f * 2, wave, start: (pal.length + i) * 0.08, dur: 0.3, vol: 0.07 })),
                ...pal.map((f, i) => ({ freq: f * 1.5, wave: 'triangle', start: i * 0.08, dur: 0.4, vol: 0.04 }))
            ];
        } else if (type === 'lose') {
            spec = [
                { freq: pal[0], wave, dur: 0.25, vol: 0.05 },
                { freq: pal[0] * 0.6, wave, start: 0.18, dur: 0.4, vol: 0.05 }
            ];
        } else if (type === 'freeSpin') {
            for (let octave = 0; octave < 2; octave++) {
                pal.forEach((f, i) => {
                    spec.push({ freq: f * (1 + octave * 0.5), wave, start: (octave * pal.length + i) * 0.1, dur: 0.35, vol: 0.07 });
                    spec.push({ freq: f * 1.5 * (1 + octave * 0.3), wave: 'triangle', start: (octave * pal.length + i) * 0.1, dur: 0.3, vol: 0.04 });
                });
            }
        }
        Casino.playTones(spec);
    }

    const CHAIN_MULTS = [1, 2, 3, 4, 5];  // win-chain multipliers per consecutive win
    const BONUS_BUY_MULT = 50;             // cost of "Buy Bonus" = 50× current bet
    const AUTO_OPTIONS = [10, 25, 50, 100];

    // Spin animation timing — toggled by Casino.fastSpin.
    function getTiming() {
        if (Casino.fastSpin) {
            return { base: 0.4, inc: 0.15, finishPad: 100, continuePad: 350 };
        }
        return { base: 1.4, inc: 0.5, finishPad: 250, continuePad: 1600 };
    }

    function makeSlotGame(theme) {
        let bet = 100;
        let spinning = false;
        let area = null;
        let freeSpinsLeft = 0;
        let freeSpinTotal = 0;       // total awarded in current round
        let freeSpinWinSum = 0;      // cumulative win during current round
        let winChain = 0;            // consecutive paid-spin wins (caps CHAIN_MULTS)
        let autoSpinsLeft = 0;       // remaining auto spins (0 = not auto)
        let autoStopOnWin = false;   // stop auto when any paid spin wins
        let autoTimer = null;        // setTimeout id for queued auto continuation
        let lastPaidWasWin = false;  // tracked per paid spin for auto-stop checks
        const baseSym = theme.symbols[0];
        const freeSpinMult = theme.freeSpinMultiplier || 2;
        const freeSpinGrant = theme.freeSpinGrant || 8;

        function $$(sel) { return area && area.querySelector(sel); }

        function init(gameArea) {
            area = gameArea;
            freeSpinsLeft = 0; freeSpinTotal = 0; freeSpinWinSum = 0; winChain = 0;
            renderUI();
            resetReels();
            wireControls();
            updateBonusBtn();
            if (typeof Casino.startAmbient === 'function') Casino.startAmbient(theme.palette, theme.wave);
        }

        function renderUI() {
            const payHtml = theme.symbols
                .filter(s => theme.payouts[s])
                .map(s => `<span class="ts-pay-item"><span class="ts-sym">${s}</span>×3 = <b>${theme.payouts[s]}×</b></span>`)
                .join('');

            const scatterInfo = theme.scatter
                ? ` · <span class="ts-sym">${theme.scatter}</span> Scatter (3 = ${freeSpinGrant} free spins, ${freeSpinMult}×)`
                : '';

            area.innerHTML = `
            <div class="themed-slot" style="--ts-g1:${theme.g1};--ts-g2:${theme.g2};--ts-accent:${theme.accent || '#fbbf24'}">
                <div class="ts-frame">
                    <div class="ts-banner">
                        <span class="ts-banner-icon">${theme.icon}</span>
                        <span class="ts-banner-title">${theme.name}</span>
                    </div>
                    <div class="ts-freespin-bar" data-role="fsbar" style="display:none;">
                        <span class="ts-fs-text"><span class="ts-fs-icon">✨</span> FREE SPINS: <b data-role="fscount">0</b> / <b data-role="fstotal">0</b></span>
                        <span class="ts-fs-mult">${freeSpinMult}× ALL WINS</span>
                    </div>
                    <div class="ts-chain-bar" data-role="chainbar" style="display:none;">
                        <span class="ts-chain-text">🔥 HOT STREAK</span>
                        <div class="ts-chain-dots" data-role="chaindots"></div>
                        <span class="ts-chain-mult" data-role="chainmult">×2 next win</span>
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
                    <button class="ts-icon-btn ts-fast" type="button" data-role="fast" aria-pressed="${Casino.fastSpin ? 'true' : 'false'}" title="Fast Spin">⚡</button>
                    <button class="ts-icon-btn ts-auto" type="button" data-role="auto" title="Auto Spin">🔁</button>
                    <button class="action-btn ts-bonus-buy" type="button" data-role="buybonus" title="Pay 50× bet to instantly trigger free spins">💰 BUY BONUS<span class="ts-bonus-cost" data-role="bonuscost"> ($${(bet * BONUS_BUY_MULT).toLocaleString()})</span></button>
                </div>
                <div class="ts-auto-panel" data-role="autopanel" hidden>
                    <div class="ts-auto-row">
                        <span class="ts-auto-label">Auto spins:</span>
                        ${AUTO_OPTIONS.map(n => `<button class="ts-auto-count" type="button" data-count="${n}">${n}</button>`).join('')}
                    </div>
                    <label class="ts-auto-row ts-auto-stop">
                        <input type="checkbox" data-role="autostop"> Stop on any paid-spin win
                    </label>
                    <div class="ts-auto-row">
                        <button class="action-btn primary ts-auto-start" type="button" data-role="autostart">START AUTO</button>
                        <button class="ts-icon-btn" type="button" data-role="autoclose" title="Close">✕</button>
                    </div>
                </div>
                <div class="ts-auto-status" data-role="autostatus" hidden>
                    🔁 AUTO SPINNING — <b data-role="autocount">0</b> remaining
                    <button class="ts-auto-stop-btn" type="button" data-role="autoabort">STOP</button>
                </div>
                <div class="ts-paytable">
                    <div class="ts-paytable-head">
                        <span>Payouts (×bet)</span>
                        <span><span class="ts-sym">${theme.wild}</span> Wild${scatterInfo}</span>
                    </div>
                    <div class="ts-paytable-grid">${payHtml}</div>
                </div>
            </div>`;
        }

        function wireControls() {
            area.querySelectorAll('.bet-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (spinning || freeSpinsLeft > 0 || autoSpinsLeft > 0) return;
                    bet = parseInt(btn.dataset.bet, 10);
                    updateSpinBtn();
                    updateBonusBtn();
                    Casino.playSound('click');
                });
            });
            $$('[data-role=spin]').addEventListener('click', spin);
            $$('[data-role=buybonus]').addEventListener('click', buyBonus);
            $$('[data-role=fast]').addEventListener('click', toggleFast);
            $$('[data-role=auto]').addEventListener('click', toggleAutoPanel);
            $$('[data-role=autoclose]').addEventListener('click', () => { $$('[data-role=autopanel]').hidden = true; });
            $$('[data-role=autostart]').addEventListener('click', startAutoSpins);
            $$('[data-role=autoabort]').addEventListener('click', stopAutoSpins);
            area.querySelectorAll('.ts-auto-count').forEach(btn => {
                btn.addEventListener('click', () => {
                    area.querySelectorAll('.ts-auto-count').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    Casino.playSound('click');
                });
            });
            // Default selection
            const def = area.querySelector('.ts-auto-count[data-count="10"]');
            if (def) def.classList.add('active');
            // Reflect persisted fast-spin state
            applyFastBtn();
        }

        function applyFastBtn() {
            const btn = $$('[data-role=fast]');
            if (!btn) return;
            btn.classList.toggle('active', !!Casino.fastSpin);
            btn.setAttribute('aria-pressed', Casino.fastSpin ? 'true' : 'false');
            btn.title = Casino.fastSpin ? 'Fast Spin: ON' : 'Fast Spin: OFF';
        }

        function toggleFast() {
            Casino.fastSpin = !Casino.fastSpin;
            Casino.saveState();
            applyFastBtn();
            Casino.playSound('click');
        }

        function toggleAutoPanel() {
            const panel = $$('[data-role=autopanel]');
            if (!panel) return;
            panel.hidden = !panel.hidden;
            Casino.playSound('click');
        }

        function startAutoSpins() {
            if (spinning) return;
            const active = area.querySelector('.ts-auto-count.active');
            const count = active ? parseInt(active.dataset.count, 10) : 10;
            autoSpinsLeft = count;
            autoStopOnWin = !!$$('[data-role=autostop]').checked;
            $$('[data-role=autopanel]').hidden = true;
            updateAutoStatus();
            Casino.playSound('click');
            // Kick off first spin.
            if (!spinning) spin();
        }

        function stopAutoSpins() {
            autoSpinsLeft = 0;
            if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
            updateAutoStatus();
            updateSpinBtn();
            Casino.playSound('click');
        }

        function updateAutoStatus() {
            const status = $$('[data-role=autostatus]');
            if (!status) return;
            if (autoSpinsLeft > 0) {
                status.hidden = false;
                $$('[data-role=autocount]').textContent = autoSpinsLeft;
            } else {
                status.hidden = true;
            }
        }

        function buyBonus() {
            if (spinning || freeSpinsLeft > 0) return;
            const cost = bet * BONUS_BUY_MULT;
            if (!Casino.buyBonusFlat(cost)) {
                showMsg(`Need $${cost.toLocaleString()} to buy bonus`, 'lose');
                return;
            }
            Casino.stats.bonusesBought = (Casino.stats.bonusesBought || 0) + 1;
            freeSpinsLeft = freeSpinGrant;
            freeSpinTotal = freeSpinGrant;
            freeSpinWinSum = 0;
            winChain = 0;
            showMsg(`💰 Bonus bought! ${freeSpinGrant} free spins at ${freeSpinMult}×`, 'win');
            playThemeSound(theme, 'freeSpin');
            Casino.showWinEffect(freeSpinGrant);
            updateFsBar();
            updateChainBar();
            updateBonusBtn();
            if (typeof Casino.checkAchievements === 'function') Casino.checkAchievements();
            setTimeout(() => { if (!spinning) spin(); }, Casino.fastSpin ? 600 : 1200);
        }

        function resetReels() {
            for (let r = 0; r < 3; r++) {
                const strip = area.querySelector(`[data-reel="${r}"]`);
                strip.style.transition = 'none';
                strip.style.transform = 'translateY(0)';
                strip.innerHTML = `<div class="ts-cell">${baseSym}</div>`.repeat(3);
            }
        }

        function updateSpinBtn() {
            const btn = $$('[data-role=spin]');
            if (!btn) return;
            if (freeSpinsLeft > 0) btn.textContent = `FREE SPIN (${freeSpinsLeft} left)`;
            else btn.textContent = `SPIN — $${bet}`;
        }

        function updateFsBar() {
            const bar = $$('[data-role=fsbar]');
            if (!bar) return;
            if (freeSpinsLeft > 0 || freeSpinTotal > 0) {
                bar.style.display = 'flex';
                $$('[data-role=fscount]').textContent = freeSpinsLeft;
                $$('[data-role=fstotal]').textContent = freeSpinTotal;
            } else {
                bar.style.display = 'none';
            }
        }

        function updateChainBar() {
            const bar = $$('[data-role=chainbar]');
            if (!bar) return;
            if (winChain > 0) {
                bar.style.display = 'flex';
                const dots = $$('[data-role=chaindots]');
                dots.innerHTML = CHAIN_MULTS.slice(1).map((_, i) =>
                    `<span class="ts-chain-dot${i < winChain ? ' lit' : ''}"></span>`).join('');
                const nextMult = CHAIN_MULTS[Math.min(winChain, CHAIN_MULTS.length - 1)];
                $$('[data-role=chainmult]').textContent = `×${nextMult} next win`;
            } else {
                bar.style.display = 'none';
            }
        }

        function updateBonusBtn() {
            const btn = $$('[data-role=buybonus]');
            const costEl = $$('[data-role=bonuscost]');
            if (!btn || !costEl) return;
            const cost = bet * BONUS_BUY_MULT;
            costEl.textContent = ` ($${cost.toLocaleString()})`;
            btn.disabled = spinning || freeSpinsLeft > 0 || Casino.balance < cost;
            btn.style.display = (freeSpinsLeft > 0) ? 'none' : '';
        }

        function showMsg(text, cls) {
            const m = $$('[data-role=msg]');
            if (!m) return;
            m.textContent = text;
            m.className = 'ts-message game-message ' + (cls || '');
        }

        function themeParticles() {
            // Prefer explicit theme.winFx, fall back to the symbol set (sans
            // duplicates of wild/scatter so the rain feels themed and varied).
            if (theme.winFx && theme.winFx.length) return theme.winFx;
            const set = new Set([theme.wild, theme.scatter]);
            return theme.symbols.filter(s => !set.has(s)).slice(0, 6).concat([theme.wild]);
        }

        function spin() {
            if (spinning) return;
            const usingFreeSpin = freeSpinsLeft > 0;

            if (!usingFreeSpin) {
                if (!Casino.placeBet(bet)) {
                    showMsg('Not enough chips!', 'lose');
                    stopAutoSpins();
                    return;
                }
            } else {
                freeSpinsLeft--;
                updateFsBar();
            }

            // Stat tracking — count fast spins for the speed_demon achievement.
            if (Casino.fastSpin && !usingFreeSpin) {
                Casino.stats.fastSpins = (Casino.stats.fastSpins || 0) + 1;
            }

            spinning = true;
            const btn = $$('[data-role=spin]');
            btn.disabled = true;
            btn.textContent = usingFreeSpin ? `FREE SPIN...` : 'SPINNING...';
            showMsg(usingFreeSpin ? '✨ Free spin!' : 'Good luck!', '');
            playThemeSound(theme, 'spinStart');

            const result = [pick(), pick(), pick()];
            const t = getTiming();
            const spinCounts = Casino.fastSpin ? [8, 12, 16] : [16, 22, 28];

            result.forEach((sym, r) => {
                const strip = area.querySelector(`[data-reel="${r}"]`);
                const cells = Array.from({ length: spinCounts[r] }, () => `<div class="ts-cell">${pick()}</div>`).join('') +
                              `<div class="ts-cell">${sym}</div>`;
                strip.innerHTML = cells;
                strip.style.transition = 'none';
                strip.style.transform = 'translateY(0)';
                void strip.offsetWidth;
                const offset = -(spinCounts[r]) * SYMBOL_ROW;
                const dur = t.base + r * t.inc;
                requestAnimationFrame(() => {
                    strip.style.transition = `transform ${dur}s cubic-bezier(0.2, 0.85, 0.25, 1)`;
                    strip.style.transform = `translateY(${offset}px)`;
                });
                setTimeout(() => {
                    playThemeSound(theme, 'reelStop');
                    const reel = strip.parentElement;
                    if (reel) {
                        reel.classList.remove('reel-bounce');
                        void reel.offsetWidth;
                        reel.classList.add('reel-bounce');
                    }
                }, dur * 1000);
            });

            setTimeout(() => evaluate(result, usingFreeSpin), (t.base + 2 * t.inc) * 1000 + t.finishPad);
        }

        function pick() { return weightedPick(theme.symbols, theme.weights); }

        function evaluate(result, wasFreeSpin) {
            const scatterCount = theme.scatter ? result.filter(s => s === theme.scatter).length : 0;
            const wild = theme.wild;
            let win = 0, label = '', isBig = false;

            // Track auto-stop signal for the spin that just completed.
            if (!wasFreeSpin) lastPaidWasWin = false;

            // Three-scatter bonus: free spins (in addition to any normal line wins).
            if (scatterCount >= 3) {
                freeSpinsLeft += freeSpinGrant;
                freeSpinTotal += freeSpinGrant;
                Casino.stats.freeSpinTriggers = (Casino.stats.freeSpinTriggers || 0) + 1;
                if (!wasFreeSpin) lastPaidWasWin = true;
                label = `${theme.scatter}×3 BONUS! +${freeSpinGrant} FREE SPINS (${freeSpinMult}×)`;
                showMsg(label, 'win');
                playThemeSound(theme, 'freeSpin');
                Casino.showWinEffect(freeSpinGrant);
                updateFsBar();
                if (typeof Casino.checkAchievements === 'function') Casino.checkAchievements();
                finishSpinAndContinue();
                return;
            }

            // Normal payline eval — treat scatters as neutral (not a match).
            const matchPool = result.filter(s => s !== theme.scatter);
            if (matchPool.length === result.length) { // no scatters in result
                const nonWild = result.filter(s => s !== wild);
                if (nonWild.length === 0) {
                    // 3 wilds = mega jackpot (5× top symbol payout)
                    const maxPay = Math.max(...Object.values(theme.payouts));
                    win = bet * maxPay * 5;
                    label = `🎆 TRIPLE ${wild} MEGA JACKPOT! 🎆`;
                    isBig = true;
                } else if (nonWild.every(s => s === nonWild[0])) {
                    const sym = nonWild[0];
                    const mult = theme.payouts[sym] || 0;
                    if (mult > 0) {
                        win = bet * mult;
                        const wildsUsed = result.filter(s => s === wild).length;
                        label = wildsUsed
                            ? `3× ${sym} (${wildsUsed} wild${wildsUsed > 1 ? 's' : ''}!) — Won $${win.toLocaleString()}!`
                            : `3× ${sym}! Won $${win.toLocaleString()}!`;
                    }
                }
            }

            if (wasFreeSpin && win > 0) {
                win *= freeSpinMult;
                label = `[FREE ${freeSpinMult}×] ` + label;
                freeSpinWinSum += win;
            }

            // Win Chain — consecutive paid-spin wins multiply the next payout.
            // Doesn't apply on the very first win of a chain, builds from there.
            if (!wasFreeSpin && win > 0 && winChain > 0) {
                const chainMult = CHAIN_MULTS[Math.min(winChain, CHAIN_MULTS.length - 1)];
                if (chainMult > 1) {
                    win *= chainMult;
                    label = `[🔥 CHAIN ${chainMult}×] ` + label;
                }
            }
            // Update chain state (only on paid spins so free-spin no-wins don't break it).
            if (!wasFreeSpin) {
                lastPaidWasWin = win > 0;
                if (win > 0) {
                    winChain = Math.min(winChain + 1, CHAIN_MULTS.length - 1);
                    if (winChain > (Casino.stats.maxChain || 0)) {
                        Casino.stats.maxChain = winChain;
                        if (typeof Casino.checkAchievements === 'function') Casino.checkAchievements();
                    }
                } else {
                    winChain = 0;
                }
            }

            if (win > 0) {
                Casino.changeBalance(win);
                showMsg(label, 'win');
                const ratio = win / Math.max(1, bet);
                const tier = ratio >= 100 ? 'mega' : ratio >= 25 ? 'big' : 'normal';
                const fxParticles = themeParticles();
                if (tier !== 'normal' || isBig) {
                    Casino.showWinEffect(win, {
                        particles: fxParticles,
                        accent: theme.accent || theme.g1,
                        tier: isBig ? 'mega' : tier,
                        themeLabel: theme.name
                    });
                    playThemeSound(theme, 'bigWin');
                } else if (ratio >= 5) {
                    Casino.showWinEffect(win, { particles: fxParticles, accent: theme.accent || theme.g1, tier: 'normal' });
                    playThemeSound(theme, 'win');
                } else {
                    playThemeSound(theme, 'win');
                }
            } else {
                showMsg(result.join('  ·  ') + ' — no win', 'lose');
                if (!wasFreeSpin) playThemeSound(theme, 'lose');
            }

            finishSpinAndContinue();
        }

        function finishSpinAndContinue() {
            spinning = false;
            const btn = $$('[data-role=spin]');
            if (btn) btn.disabled = false;
            updateSpinBtn();
            updateFsBar();
            updateChainBar();
            updateBonusBtn();

            const t = getTiming();

            // Auto-continue free spin round.
            if (freeSpinsLeft > 0) {
                autoTimer = setTimeout(() => { if (!spinning && freeSpinsLeft > 0) spin(); }, t.continuePad);
                return;
            }

            // Free spin round just ended — show summary.
            if (freeSpinTotal > 0) {
                const summary = freeSpinWinSum > 0
                    ? `🎉 Free spins complete! Total won: $${freeSpinWinSum.toLocaleString()}`
                    : `Free spins complete — no wins this round.`;
                setTimeout(() => showMsg(summary, freeSpinWinSum > 0 ? 'win' : ''), 200);
                freeSpinTotal = 0;
                freeSpinWinSum = 0;
                updateFsBar();
            }

            // Auto-spin continuation (only counts paid spins).
            if (autoSpinsLeft > 0) {
                autoSpinsLeft--;
                updateAutoStatus();
                if (autoSpinsLeft <= 0) {
                    stopAutoSpins();
                    showToast('🔁 Auto spins complete.');
                } else if (autoStopOnWin && lastPaidWasWin) {
                    stopAutoSpins();
                    showMsg('Auto stopped: you won!', 'win');
                } else if (Casino.balance < bet) {
                    stopAutoSpins();
                    showMsg('Auto stopped: low balance.', 'lose');
                } else {
                    autoTimer = setTimeout(() => { if (autoSpinsLeft > 0) spin(); }, t.continuePad);
                }
            }
        }

        function showToast(text) {
            if (typeof Casino.showToast === 'function') Casino.showToast(text);
        }

        return {
            init,
            destroy() {
                spinning = false;
                freeSpinsLeft = 0; freeSpinTotal = 0; freeSpinWinSum = 0;
                autoSpinsLeft = 0;
                if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
                if (typeof Casino.stopAmbient === 'function') Casino.stopAmbient();
            }
        };
    }

    /* Lobby card art — themed slot frame with the centerpiece symbol. */
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
        // ---- Original 10 (now with scatter + palette + free spins) ----
        {
            id: 'slot_egypt', name: 'Pharaoh Riches', icon: '𓂀',
            desc: 'Treasures of the Nile await',
            g1: '#fbbf24', g2: '#7c2d12', accent: '#fbbf24',
            studio: 'PYRAMID GAMING',
            art: makeArt('☥', '𓂀'),
            tagline: 'Awaken the gods of Egypt!',
            symbols: ['🐍', '🪲', '☥', '🏺', '𓂀', '🔱', '⭐'],
            weights: [0.30, 0.22, 0.18, 0.13, 0.08, 0.04, 0.05],
            payouts: { '🐍': 4, '🪲': 8, '☥': 15, '🏺': 40, '𓂀': 100, '🔱': 250 },
            wild: '🔱', scatter: '⭐',
            palette: [220, 247, 262, 330, 392], wave: 'sine'
        },
        {
            id: 'slot_fruit', name: 'Fruit Cocktail', icon: '🍒',
            desc: 'Classic fruit machine vibes',
            g1: '#f97316', g2: '#9a3412', accent: '#fde047',
            studio: 'CLASSIC REELS',
            art: makeArt('🍒', '🍋'),
            tagline: 'Sun-kissed and juicy wins!',
            symbols: ['🍒', '🍋', '🍊', '🍇', '🍉', '🔔', '7️⃣', '🍓'],
            weights: [0.26, 0.20, 0.17, 0.12, 0.09, 0.06, 0.05, 0.05],
            payouts: { '🍒': 3, '🍋': 5, '🍊': 8, '🍇': 12, '🍉': 25, '🔔': 75, '7️⃣': 200 },
            wild: '7️⃣', scatter: '🍓',
            palette: [262, 330, 392, 523], wave: 'triangle'
        },
        {
            id: 'slot_pirate', name: "Pirate's Bounty", icon: '🏴‍☠️',
            desc: 'Yo-ho-ho and a chest of gold',
            g1: '#0ea5e9', g2: '#0c4a6e', accent: '#fbbf24',
            studio: 'BLACKBEARD STUDIOS',
            art: makeArt('💀', '🏴‍☠️'),
            tagline: 'Plunder the seven seas!',
            symbols: ['🦜', '⚓', '⚔️', '🗝️', '💀', '🪙', '🏴‍☠️', '🗺️'],
            weights: [0.28, 0.20, 0.17, 0.12, 0.10, 0.05, 0.03, 0.05],
            payouts: { '🦜': 3, '⚓': 6, '⚔️': 10, '🗝️': 20, '💀': 50, '🪙': 100, '🏴‍☠️': 300 },
            wild: '🏴‍☠️', scatter: '🗺️',
            palette: [196, 247, 294, 392], wave: 'sawtooth'
        },
        {
            id: 'slot_aztec', name: 'Aztec Gold', icon: '🗿',
            desc: 'Lost temples of the jungle',
            g1: '#15803d', g2: '#1e1b4b', accent: '#fbbf24',
            studio: 'JUNGLE PRAGMA',
            art: makeArt('🗿', '🌞'),
            tagline: 'Awaken ancient riches!',
            symbols: ['🌿', '🐍', '🐆', '🌞', '🗿', '💎', '👑', '🌋'],
            weights: [0.28, 0.20, 0.17, 0.12, 0.09, 0.05, 0.03, 0.06],
            payouts: { '🌿': 3, '🐍': 5, '🐆': 10, '🌞': 20, '🗿': 50, '💎': 100, '👑': 250 },
            wild: '👑', scatter: '🌋',
            palette: [196, 233, 277, 349, 415], wave: 'sine'
        },
        {
            id: 'slot_western', name: 'Wild West', icon: '🤠',
            desc: 'Cowboys, gold, and showdowns',
            g1: '#b45309', g2: '#451a03', accent: '#fde047',
            studio: 'SADDLE UP GAMES',
            art: makeArt('🐎', '🤠'),
            tagline: 'High noon — draw to win!',
            symbols: ['🌵', '👢', '🐎', '🔫', '⭐', '💰', '🤠', '🎯'],
            weights: [0.28, 0.20, 0.17, 0.12, 0.09, 0.05, 0.03, 0.06],
            payouts: { '🌵': 3, '👢': 5, '🐎': 10, '🔫': 20, '⭐': 50, '💰': 100, '🤠': 200 },
            wild: '🤠', scatter: '🎯',
            palette: [261, 329, 392, 466, 523], wave: 'triangle'
        },
        {
            id: 'slot_space', name: 'Galaxy Spin', icon: '🚀',
            desc: 'Cosmic multipliers from deep space',
            g1: '#7c3aed', g2: '#020617', accent: '#22d3ee',
            studio: 'NEON COSMOS',
            art: makeArt('🪐', '🚀'),
            tagline: 'Blast off to cosmic wins!',
            symbols: ['💫', '⭐', '🛸', '👽', '🪐', '☄️', '🚀', '🌌'],
            weights: [0.27, 0.20, 0.17, 0.12, 0.09, 0.05, 0.03, 0.07],
            payouts: { '💫': 3, '⭐': 5, '🛸': 10, '👽': 20, '🪐': 50, '☄️': 100, '🚀': 300 },
            wild: '🚀', scatter: '🌌',
            palette: [220, 247, 277, 311, 349, 392], wave: 'sine'
        },
        {
            id: 'slot_dragon', name: "Dragon's Fortune", icon: '🐉',
            desc: 'Oriental luck and dragon gold',
            g1: '#dc2626', g2: '#450a0a', accent: '#fde047',
            studio: 'IMPERIAL ORIENT',
            art: makeArt('🐉', '🏮'),
            tagline: 'Summon the dragon!',
            symbols: ['🎋', '🏮', '🐟', '☯️', '🪙', '💰', '🐉', '🧧'],
            weights: [0.27, 0.20, 0.17, 0.12, 0.09, 0.05, 0.03, 0.07],
            payouts: { '🎋': 3, '🏮': 5, '🐟': 10, '☯️': 20, '🪙': 50, '💰': 125, '🐉': 250 },
            wild: '🐉', scatter: '🧧',
            palette: [261, 293, 349, 392, 440], wave: 'sine'
        },
        {
            id: 'slot_candy', name: 'Sweet Bonanza', icon: '🍭',
            desc: 'Candy-coated multipliers',
            g1: '#ec4899', g2: '#831843', accent: '#fde047',
            studio: 'CANDY KINGDOM',
            art: makeArt('🍭', '🍬'),
            tagline: 'A sugar rush of wins!',
            symbols: ['🍪', '🍫', '🍩', '🧁', '🍰', '🍬', '🍭', '🌈'],
            weights: [0.27, 0.20, 0.17, 0.12, 0.09, 0.05, 0.03, 0.07],
            payouts: { '🍪': 3, '🍫': 5, '🍩': 10, '🧁': 20, '🍰': 40, '🍬': 80, '🍭': 200 },
            wild: '🍭', scatter: '🌈',
            palette: [392, 440, 523, 587, 659], wave: 'triangle'
        },
        {
            id: 'slot_halloween', name: 'Halloween Spooks', icon: '🎃',
            desc: 'Trick-or-treat for tricks of gold',
            g1: '#f97316', g2: '#3b0764', accent: '#a3e635',
            studio: 'MIDNIGHT REELS',
            art: makeArt('🎃', '👻'),
            tagline: 'Boo! Win big this Hallows Eve!',
            symbols: ['🕷️', '🦇', '👻', '🧙', '💀', '🎃', '👹', '🕯️'],
            weights: [0.27, 0.20, 0.17, 0.12, 0.09, 0.05, 0.03, 0.07],
            payouts: { '🕷️': 3, '🦇': 5, '👻': 10, '🧙': 20, '💀': 50, '🎃': 100, '👹': 250 },
            wild: '🎃', scatter: '🕯️',
            palette: [220, 261, 311, 369, 440], wave: 'square'
        },
        {
            id: 'slot_norse', name: 'Norse Gods', icon: '⚒️',
            desc: 'Hammer of Thor strikes gold',
            g1: '#475569', g2: '#0f172a', accent: '#fbbf24',
            studio: 'VALHALLA STUDIOS',
            art: makeArt('⚒️', '⚡'),
            tagline: 'For Asgard and gold!',
            symbols: ['🌳', '🛡️', '🐺', '🦅', '⚡', '👁️', '⚒️', '🪓'],
            weights: [0.27, 0.20, 0.17, 0.12, 0.09, 0.05, 0.03, 0.07],
            payouts: { '🌳': 3, '🛡️': 5, '🐺': 10, '🦅': 20, '⚡': 50, '👁️': 100, '⚒️': 250 },
            wild: '⚒️', scatter: '🪓',
            palette: [110, 147, 196, 247, 294], wave: 'sawtooth'
        },

        // ---- 10 new themes ----
        {
            id: 'slot_olympus', name: 'Olympus Gods', icon: '⚡',
            desc: 'Zeus and Hera throw lightning jackpots',
            g1: '#0891b2', g2: '#1e1b4b', accent: '#fbbf24',
            studio: 'OLYMPUS HALL',
            art: makeArt('🏛️', '⚡'),
            tagline: 'Hear the thunder of Olympus!',
            symbols: ['🍇', '🦉', '🏛️', '🌊', '⚔️', '👑', '⚡', '🌟'],
            weights: [0.26, 0.20, 0.17, 0.12, 0.10, 0.06, 0.03, 0.06],
            payouts: { '🍇': 3, '🦉': 5, '🏛️': 10, '🌊': 20, '⚔️': 50, '👑': 100, '⚡': 250 },
            wild: '⚡', scatter: '🌟',
            palette: [196, 247, 294, 392, 494], wave: 'sine'
        },
        {
            id: 'slot_atlantis', name: 'Atlantis Treasures', icon: '🧜‍♀️',
            desc: 'Sunken city, pearls and kraken gold',
            g1: '#06b6d4', g2: '#164e63', accent: '#fde047',
            studio: 'DEEP BLUE STUDIOS',
            art: makeArt('🐚', '🧜‍♀️'),
            tagline: 'Dive for sunken treasure!',
            symbols: ['🐚', '🐠', '🦀', '🐙', '🧜‍♀️', '🦑', '💎', '⭐'],
            weights: [0.27, 0.20, 0.17, 0.13, 0.09, 0.05, 0.03, 0.06],
            payouts: { '🐚': 3, '🐠': 5, '🦀': 10, '🐙': 20, '🧜‍♀️': 50, '🦑': 100, '💎': 250 },
            wild: '💎', scatter: '⭐',
            palette: [220, 277, 330, 415, 494], wave: 'sine'
        },
        {
            id: 'slot_cyber', name: 'Cyber Spin', icon: '🤖',
            desc: 'Neon-drenched future jackpots',
            g1: '#22d3ee', g2: '#581c87', accent: '#f472b6',
            studio: 'NEON FUTURE',
            art: makeArt('💾', '🤖'),
            tagline: 'Hack the matrix for chips!',
            symbols: ['💾', '🎮', '📡', '🤖', '🔋', '💿', '🌐', '👾'],
            weights: [0.27, 0.20, 0.17, 0.13, 0.09, 0.05, 0.03, 0.06],
            payouts: { '💾': 3, '🎮': 5, '📡': 10, '🤖': 20, '🔋': 50, '💿': 100, '🌐': 250 },
            wild: '🌐', scatter: '👾',
            palette: [110, 220, 277, 330, 440], wave: 'square'
        },
        {
            id: 'slot_dj', name: 'DJ Beats', icon: '🎧',
            desc: 'Drop the bass, drop the chips',
            g1: '#a855f7', g2: '#1e1b4b', accent: '#22d3ee',
            studio: 'CLUB NIGHTS',
            art: makeArt('🎧', '🎵'),
            tagline: 'Spin the decks!',
            symbols: ['🎵', '🎷', '🎸', '🎹', '🎤', '🎧', '🪩', '💫'],
            weights: [0.27, 0.20, 0.17, 0.13, 0.09, 0.05, 0.03, 0.06],
            payouts: { '🎵': 3, '🎷': 5, '🎸': 10, '🎹': 20, '🎤': 50, '🎧': 100, '🪩': 250 },
            wild: '🪩', scatter: '💫',
            palette: [110, 165, 220, 330, 440, 523], wave: 'sawtooth'
        },
        {
            id: 'slot_rome', name: 'Rome Triumph', icon: '🏛️',
            desc: 'Roman legions march to victory',
            g1: '#dc2626', g2: '#3b0764', accent: '#fbbf24',
            studio: 'IMPERIAL GAMES',
            art: makeArt('🛡️', '👑'),
            tagline: 'Veni, vidi, vici!',
            symbols: ['🍇', '⚔️', '🛡️', '🏛️', '🦅', '👑', '⚜️', '🌟'],
            weights: [0.27, 0.20, 0.17, 0.13, 0.09, 0.05, 0.03, 0.06],
            payouts: { '🍇': 3, '⚔️': 5, '🛡️': 10, '🏛️': 20, '🦅': 50, '👑': 100, '⚜️': 250 },
            wild: '⚜️', scatter: '🌟',
            palette: [220, 277, 330, 369, 415, 494], wave: 'sine'
        },
        {
            id: 'slot_viking', name: 'Viking Raid', icon: '🪓',
            desc: 'For Odin! For gold!',
            g1: '#1e40af', g2: '#1e1b4b', accent: '#cbd5e1',
            studio: 'LONGSHIP STUDIOS',
            art: makeArt('🪓', '⚔️'),
            tagline: 'Raid the kingdom of gold!',
            symbols: ['🍺', '🛡️', '🪓', '🐺', '⚔️', '🪙', '👑', '🔥'],
            weights: [0.27, 0.20, 0.17, 0.13, 0.09, 0.05, 0.03, 0.06],
            payouts: { '🍺': 3, '🛡️': 5, '🪓': 10, '🐺': 20, '⚔️': 50, '🪙': 100, '👑': 250 },
            wild: '👑', scatter: '🔥',
            palette: [98, 147, 196, 247, 294], wave: 'triangle'
        },
        {
            id: 'slot_safari', name: 'Safari Wild', icon: '🦁',
            desc: 'African plains, lions and elephants',
            g1: '#ca8a04', g2: '#365314', accent: '#fde047',
            studio: 'SAVANNA REELS',
            art: makeArt('🦁', '🌅'),
            tagline: 'King of the jungle!',
            symbols: ['🌿', '🦓', '🦒', '🐘', '🦏', '🦁', '💎', '🌅'],
            weights: [0.27, 0.20, 0.17, 0.13, 0.09, 0.05, 0.03, 0.06],
            payouts: { '🌿': 3, '🦓': 5, '🦒': 10, '🐘': 20, '🦏': 50, '🦁': 100, '💎': 250 },
            wild: '💎', scatter: '🌅',
            palette: [196, 247, 294, 349, 440], wave: 'sine'
        },
        {
            id: 'slot_frozen', name: 'Frozen Festival', icon: '❄️',
            desc: 'Snow, gifts, and yuletide gold',
            g1: '#0ea5e9', g2: '#1e1b4b', accent: '#fda4af',
            studio: 'POLAR STAR',
            art: makeArt('🎁', '❄️'),
            tagline: 'Ho ho ho!',
            symbols: ['🔔', '🎁', '🍪', '⛄', '🦌', '🎅', '🌟', '✨'],
            weights: [0.27, 0.20, 0.17, 0.13, 0.09, 0.05, 0.03, 0.06],
            payouts: { '🔔': 3, '🎁': 5, '🍪': 10, '⛄': 20, '🦌': 50, '🎅': 100, '🌟': 250 },
            wild: '🌟', scatter: '✨',
            palette: [523, 587, 659, 698, 784], wave: 'sine'
        },
        {
            id: 'slot_fairy', name: 'Fairy Castle', icon: '🏰',
            desc: 'Princesses, dragons and enchanted gems',
            g1: '#a855f7', g2: '#831843', accent: '#fde047',
            studio: 'STORYBOOK SPIN',
            art: makeArt('🏰', '👸'),
            tagline: 'Once upon a jackpot!',
            symbols: ['🦄', '🧚', '🐸', '👸', '🏰', '👑', '💎', '🌠'],
            weights: [0.27, 0.20, 0.17, 0.13, 0.09, 0.05, 0.03, 0.06],
            payouts: { '🦄': 3, '🧚': 5, '🐸': 10, '👸': 20, '🏰': 50, '👑': 100, '💎': 250 },
            wild: '💎', scatter: '🌠',
            palette: [392, 440, 494, 587, 659], wave: 'triangle'
        },
        {
            id: 'slot_mardi', name: 'Mardi Gras', icon: '🎭',
            desc: 'Carnival of color and gold',
            g1: '#a855f7', g2: '#15803d', accent: '#fbbf24',
            studio: 'CARNIVAL GAMES',
            art: makeArt('🎭', '🎉'),
            tagline: 'Let the good times roll!',
            symbols: ['🎵', '🪅', '🎺', '🎭', '🎊', '🍾', '👑', '🎉'],
            weights: [0.27, 0.20, 0.17, 0.13, 0.09, 0.05, 0.03, 0.06],
            payouts: { '🎵': 3, '🪅': 5, '🎺': 10, '🎭': 20, '🎊': 50, '🍾': 100, '👑': 250 },
            wild: '👑', scatter: '🎉',
            palette: [261, 311, 392, 466, 523], wave: 'triangle'
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
