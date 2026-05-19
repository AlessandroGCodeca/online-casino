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

    /* Hand-crafted lobby card scenes — one unique illustration per theme. */
    const SCENES = {
        slot_egypt: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="se-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fef3c7"/><stop offset="1" stop-color="#92400e"/></linearGradient></defs>
            <circle cx="60" cy="32" r="16" fill="#fbbf24" opacity=".85"/>
            <circle cx="60" cy="32" r="10" fill="#fde047"/>
            <polygon points="14,98 60,26 106,98" fill="url(#se-sand)" stroke="#451a03" stroke-width="1.5"/>
            <polygon points="60,26 106,98 64,98" fill="#451a03" opacity=".25"/>
            <ellipse cx="60" cy="64" rx="10" ry="5" fill="#0f172a"/>
            <circle cx="60" cy="64" r="3.5" fill="#fde68a"/>
            <circle cx="60" cy="64" r="1.5" fill="#0f172a"/>
            <path d="M50 70 Q56 76 60 70" stroke="#0f172a" stroke-width="1.5" fill="none"/>
            <rect x="6" y="98" width="108" height="3" fill="#7c2d12"/>
        </svg>`,
        slot_fruit: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <polygon points="28,40 92,40 80,76 40,76" fill="#fef08a" stroke="#0f172a" stroke-width="1.5"/>
            <polygon points="28,40 92,40 84,52 36,52" fill="#fbbf24" opacity=".5"/>
            <line x1="60" y1="76" x2="60" y2="100" stroke="#0f172a" stroke-width="2"/>
            <ellipse cx="60" cy="102" rx="22" ry="4" fill="#0f172a"/>
            <circle cx="70" cy="36" r="7" fill="#dc2626" stroke="#0f172a" stroke-width="1"/>
            <circle cx="82" cy="40" r="7" fill="#dc2626" stroke="#0f172a" stroke-width="1"/>
            <path d="M70 30 Q76 16 90 18" stroke="#15803d" stroke-width="2" fill="none"/>
            <circle cx="38" cy="34" r="10" fill="#fef08a" stroke="#a16207" stroke-width="1.5"/>
            <line x1="38" y1="24" x2="38" y2="44" stroke="#a16207"/>
            <line x1="28" y1="34" x2="48" y2="34" stroke="#a16207"/>
            <circle cx="52" cy="56" r="3" fill="#a3e635" opacity=".8"/>
        </svg>`,
        slot_pirate: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <rect x="18" y="68" width="84" height="36" rx="4" fill="#7c2d12" stroke="#0f172a" stroke-width="1.5"/>
            <path d="M18 68 Q60 36 102 68" fill="#92400e" stroke="#0f172a" stroke-width="1.5"/>
            <circle cx="40" cy="82" r="6" fill="#fbbf24" stroke="#7c2d12"/>
            <circle cx="55" cy="86" r="6" fill="#fde047" stroke="#7c2d12"/>
            <circle cx="70" cy="82" r="6" fill="#fbbf24" stroke="#7c2d12"/>
            <circle cx="84" cy="88" r="5" fill="#fbbf24" stroke="#7c2d12"/>
            <circle cx="60" cy="54" r="11" fill="#fafafa"/>
            <rect x="55" y="62" width="10" height="5" fill="#fafafa"/>
            <circle cx="56" cy="52" r="2.2" fill="#0f172a"/>
            <circle cx="64" cy="52" r="2.2" fill="#0f172a"/>
            <rect x="58" y="57" width="4" height="3" fill="#0f172a"/>
            <line x1="40" y1="48" x2="80" y2="64" stroke="#0f172a" stroke-width="2"/>
            <line x1="80" y1="48" x2="40" y2="64" stroke="#0f172a" stroke-width="2"/>
            <rect x="55" y="82" width="10" height="10" rx="2" fill="#fbbf24" stroke="#0f172a"/>
        </svg>`,
        slot_aztec: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="30" r="11" fill="#fbbf24"/>
            <g stroke="#fbbf24" stroke-width="2">
                <line x1="60" y1="14" x2="60" y2="6"/><line x1="60" y1="46" x2="60" y2="54"/>
                <line x1="44" y1="30" x2="36" y2="30"/><line x1="76" y1="30" x2="84" y2="30"/>
                <line x1="49" y1="19" x2="44" y2="14"/><line x1="71" y1="19" x2="76" y2="14"/>
                <line x1="49" y1="41" x2="44" y2="46"/><line x1="71" y1="41" x2="76" y2="46"/>
            </g>
            <polygon points="18,98 38,68 58,98" fill="#16a34a" stroke="#15803d" stroke-width="1.5"/>
            <polygon points="42,98 62,58 82,98" fill="#15803d" stroke="#14532d" stroke-width="1.5"/>
            <polygon points="62,98 82,68 102,98" fill="#16a34a" stroke="#15803d" stroke-width="1.5"/>
            <rect x="58" y="80" width="8" height="18" fill="#451a03"/>
            <polygon points="56,76 66,76 62,68" fill="#fbbf24"/>
            <rect x="6" y="100" width="108" height="2" fill="#451a03"/>
        </svg>`,
        slot_western: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="80" width="120" height="40" fill="#ca8a04" opacity=".25"/>
            <polygon points="0,80 30,72 60,82 90,68 120,80 120,86 0,86" fill="#a16207"/>
            <ellipse cx="84" cy="48" rx="22" ry="6" fill="#7c2d12"/>
            <path d="M62 48 Q62 30 84 30 Q106 30 106 48 Z" fill="#92400e"/>
            <ellipse cx="84" cy="48" rx="14" ry="3" fill="#fde047"/>
            <polygon points="24,50 27,60 38,60 29,66 33,76 24,70 15,76 19,66 10,60 21,60" fill="#fbbf24" stroke="#451a03"/>
            <line x1="24" y1="76" x2="24" y2="98" stroke="#92400e" stroke-width="3"/>
            <rect x="40" y="92" width="40" height="6" rx="3" fill="#92400e"/>
            <rect x="45" y="90" width="8" height="10" fill="#92400e"/>
            <rect x="67" y="90" width="8" height="10" fill="#92400e"/>
        </svg>`,
        slot_space: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <defs><radialGradient id="sp-planet" cx="0.3" cy="0.3"><stop offset="0" stop-color="#67e8f9"/><stop offset="1" stop-color="#0e7490"/></radialGradient></defs>
            <g fill="#fff">
                <circle cx="18" cy="22" r="1.5"/><circle cx="100" cy="18" r="1.5"/>
                <circle cx="106" cy="46" r="2"/><circle cx="14" cy="58" r="1.5"/>
                <circle cx="32" cy="92" r="1.5"/><circle cx="104" cy="86" r="1.5"/>
            </g>
            <circle cx="60" cy="62" r="28" fill="url(#sp-planet)"/>
            <ellipse cx="60" cy="62" rx="44" ry="9" fill="none" stroke="#fbbf24" stroke-width="2" transform="rotate(-15 60 62)"/>
            <ellipse cx="60" cy="62" rx="44" ry="9" fill="none" stroke="#fde047" stroke-width="1" opacity=".5" transform="rotate(-15 60 62)" stroke-dasharray="3 3"/>
            <ellipse cx="50" cy="55" rx="6" ry="3" fill="#0e7490" opacity=".6"/>
            <ellipse cx="72" cy="68" rx="4" ry="2" fill="#0e7490" opacity=".6"/>
            <path d="M88 22 L92 26 L96 22" stroke="#fde047" stroke-width="2" fill="none"/>
            <circle cx="96" cy="22" r="2" fill="#fde047"/>
        </svg>`,
        slot_dragon: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <circle cx="32" cy="22" r="8" fill="#dc2626" stroke="#fbbf24" stroke-width="1.5"/>
            <line x1="32" y1="30" x2="32" y2="98" stroke="#fbbf24" stroke-width="2" stroke-dasharray="3 2"/>
            <rect x="22" y="38" width="20" height="22" rx="2" fill="#dc2626" stroke="#fbbf24" stroke-width="1.5"/>
            <line x1="22" y1="42" x2="42" y2="42" stroke="#fbbf24"/>
            <line x1="22" y1="56" x2="42" y2="56" stroke="#fbbf24"/>
            <circle cx="32" cy="49" r="3" fill="#fde047"/>
            <path d="M52 78 Q72 58 96 56 Q98 64 82 72 Q98 76 96 86 Q72 90 52 78 Z" fill="#dc2626" stroke="#fbbf24" stroke-width="1.5"/>
            <circle cx="90" cy="62" r="2" fill="#fde047"/>
            <path d="M70 76 L74 70 M78 78 L82 70 M86 80 L90 74" stroke="#fbbf24" stroke-width="1.5" fill="none"/>
            <path d="M52 78 Q44 86 50 96" stroke="#dc2626" stroke-width="3" fill="none"/>
            <path d="M96 86 Q104 96 96 104" stroke="#fbbf24" stroke-width="2" fill="none"/>
        </svg>`,
        slot_candy: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="cd-lol" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fef08a"/><stop offset="0.5" stop-color="#ec4899"/><stop offset="1" stop-color="#7e22ce"/></linearGradient></defs>
            <line x1="60" y1="60" x2="60" y2="106" stroke="#fef08a" stroke-width="3"/>
            <circle cx="60" cy="48" r="26" fill="url(#cd-lol)" stroke="#fff" stroke-width="2"/>
            <path d="M60 48 m-22 0 a22 22 0 0 1 22 -22 a22 22 0 0 1 22 22 a22 22 0 0 1 -22 22" fill="none" stroke="#fff" stroke-width="2.5" opacity=".7"/>
            <path d="M60 48 m-14 0 a14 14 0 0 1 14 -14 a14 14 0 0 1 14 14" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/>
            <path d="M60 48 m-6 0 a6 6 0 0 1 6 -6" fill="none" stroke="#fff" stroke-width="1.5" opacity=".7"/>
            <circle cx="22" cy="92" r="6" fill="#ec4899" stroke="#fff"/>
            <circle cx="36" cy="100" r="5" fill="#fde047" stroke="#fff"/>
            <circle cx="92" cy="92" r="5" fill="#22d3ee" stroke="#fff"/>
            <circle cx="100" cy="76" r="4" fill="#a3e635" stroke="#fff"/>
        </svg>`,
        slot_halloween: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="6" fill="#fde047"/>
            <circle cx="22" cy="22" r="4" fill="#0f172a"/>
            <ellipse cx="60" cy="72" rx="36" ry="32" fill="#f97316" stroke="#7c2d12" stroke-width="2"/>
            <path d="M28 70 Q60 60 92 70" stroke="#7c2d12" stroke-width="1" fill="none" opacity=".5"/>
            <path d="M40 38 L50 44 L40 50" stroke="#15803d" stroke-width="3" fill="#15803d"/>
            <rect x="42" y="42" width="4" height="6" fill="#15803d"/>
            <polygon points="40,68 48,60 56,68 50,68 50,80 46,80 46,68" fill="#0f172a"/>
            <polygon points="64,68 72,60 80,68 74,68 74,80 70,80 70,68" fill="#0f172a"/>
            <path d="M40 86 L46 92 L52 86 L58 92 L64 86 L70 92 L76 86 L82 92" stroke="#0f172a" stroke-width="3" fill="none"/>
            <path d="M14 50 Q22 48 18 56 Q26 54 22 62" stroke="#0f172a" stroke-width="2" fill="none"/>
            <path d="M98 36 Q92 34 96 42 Q88 40 92 48" stroke="#0f172a" stroke-width="2" fill="none"/>
        </svg>`,
        slot_norse: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="nr-bolt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde047"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs>
            <polygon points="34,4 24,52 42,52 30,100 70,40 50,40 64,4" fill="url(#nr-bolt)" stroke="#92400e" stroke-width="1.5"/>
            <rect x="60" y="68" width="38" height="24" fill="#94a3b8" stroke="#0f172a" stroke-width="2"/>
            <rect x="64" y="72" width="30" height="16" fill="#cbd5e1"/>
            <line x1="64" y1="80" x2="94" y2="80" stroke="#0f172a"/>
            <line x1="74" y1="72" x2="74" y2="88" stroke="#0f172a"/>
            <line x1="84" y1="72" x2="84" y2="88" stroke="#0f172a"/>
            <rect x="76" y="92" width="6" height="14" fill="#7c2d12"/>
            <rect x="72" y="106" width="14" height="3" fill="#92400e"/>
            <circle cx="79" cy="80" r="3" fill="#fde047"/>
        </svg>`,
        slot_olympus: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <rect x="14" y="20" width="92" height="6" fill="#fde047" stroke="#0f172a"/>
            <polygon points="14,26 60,8 106,26" fill="#cbd5e1" stroke="#0f172a"/>
            <rect x="20" y="30" width="12" height="64" fill="#e2e8f0" stroke="#0f172a" stroke-width="1.5"/>
            <rect x="48" y="30" width="12" height="64" fill="#e2e8f0" stroke="#0f172a" stroke-width="1.5"/>
            <rect x="76" y="30" width="12" height="64" fill="#e2e8f0" stroke="#0f172a" stroke-width="1.5"/>
            <rect x="14" y="92" width="92" height="8" fill="#cbd5e1" stroke="#0f172a"/>
            <rect x="14" y="100" width="92" height="6" fill="#94a3b8" stroke="#0f172a"/>
            <line x1="20" y1="30" x2="32" y2="30" stroke="#fde047" stroke-width="2"/>
            <line x1="48" y1="30" x2="60" y2="30" stroke="#fde047" stroke-width="2"/>
            <line x1="76" y1="30" x2="88" y2="30" stroke="#fde047" stroke-width="2"/>
            <polygon points="68,40 60,60 70,60 62,80 80,52 72,52 78,40" fill="#fbbf24" stroke="#92400e"/>
        </svg>`,
        slot_atlantis: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="at-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06b6d4" stop-opacity="0"/><stop offset="1" stop-color="#06b6d4" stop-opacity="0.6"/></linearGradient></defs>
            <rect x="0" y="0" width="120" height="120" fill="url(#at-water)"/>
            <circle cx="22" cy="32" r="4" fill="none" stroke="#fff" stroke-width="1.5"/>
            <circle cx="38" cy="20" r="3" fill="none" stroke="#fff" stroke-width="1.5"/>
            <circle cx="92" cy="28" r="5" fill="none" stroke="#fff" stroke-width="1.5"/>
            <circle cx="100" cy="50" r="3" fill="none" stroke="#fff" stroke-width="1.5"/>
            <line x1="60" y1="20" x2="60" y2="74" stroke="#fde047" stroke-width="3"/>
            <path d="M48 30 L60 18 L72 30 L66 30 L66 38 L54 38 L54 30 Z" fill="#fbbf24" stroke="#92400e" stroke-width="1.5"/>
            <line x1="44" y1="30" x2="48" y2="30" stroke="#fbbf24" stroke-width="3"/>
            <line x1="72" y1="30" x2="76" y2="30" stroke="#fbbf24" stroke-width="3"/>
            <path d="M30 96 Q60 80 90 96 L90 110 L30 110 Z" fill="#0e7490" stroke="#0f172a" stroke-width="1.5"/>
            <path d="M40 98 L48 92 M56 98 L64 90 M72 98 L80 92" stroke="#22d3ee" stroke-width="2" fill="none"/>
        </svg>`,
        slot_cyber: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <g stroke="#22d3ee" stroke-width="1" opacity=".5">
                <line x1="0" y1="40" x2="120" y2="40"/><line x1="0" y1="60" x2="120" y2="60"/><line x1="0" y1="80" x2="120" y2="80"/><line x1="0" y1="100" x2="120" y2="100"/>
                <line x1="40" y1="0" x2="40" y2="120"/><line x1="60" y1="0" x2="60" y2="120"/><line x1="80" y1="0" x2="80" y2="120"/>
            </g>
            <rect x="30" y="34" width="60" height="48" rx="4" fill="#0f172a" stroke="#22d3ee" stroke-width="2"/>
            <rect x="36" y="40" width="48" height="20" fill="#22d3ee" opacity=".25"/>
            <text x="60" y="55" font-size="14" font-weight="900" fill="#22d3ee" text-anchor="middle" font-family="Arial">10x</text>
            <circle cx="42" cy="72" r="3" fill="#ec4899"/>
            <circle cx="60" cy="72" r="3" fill="#fde047"/>
            <circle cx="78" cy="72" r="3" fill="#a3e635"/>
            <line x1="60" y1="82" x2="60" y2="92" stroke="#22d3ee" stroke-width="3"/>
            <rect x="50" y="92" width="20" height="6" fill="#22d3ee"/>
        </svg>`,
        slot_dj: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <defs><radialGradient id="dj-vinyl" cx="0.5" cy="0.5"><stop offset="0" stop-color="#ec4899"/><stop offset="0.2" stop-color="#0f172a"/><stop offset="1" stop-color="#0f172a"/></radialGradient></defs>
            <circle cx="60" cy="60" r="42" fill="url(#dj-vinyl)" stroke="#22d3ee" stroke-width="2"/>
            <circle cx="60" cy="60" r="32" fill="none" stroke="#1e293b" stroke-width="1"/>
            <circle cx="60" cy="60" r="22" fill="none" stroke="#1e293b" stroke-width="1"/>
            <circle cx="60" cy="60" r="12" fill="#ec4899"/>
            <circle cx="60" cy="60" r="3" fill="#0f172a"/>
            <path d="M60 60 L94 76" stroke="#cbd5e1" stroke-width="2"/>
            <circle cx="94" cy="76" r="3" fill="#cbd5e1"/>
            <path d="M8 80 Q14 70 8 60 M14 84 Q22 70 14 56 M20 88 Q30 70 20 52" stroke="#22d3ee" stroke-width="2" fill="none"/>
        </svg>`,
        slot_rome: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="60" cy="64" rx="30" ry="24" fill="#fbbf24" stroke="#7c2d12" stroke-width="2"/>
            <path d="M30 64 Q30 38 60 38 Q90 38 90 64" fill="#fde047" stroke="#7c2d12" stroke-width="2"/>
            <rect x="55" y="22" width="10" height="20" fill="#dc2626" stroke="#7c2d12"/>
            <path d="M55 22 Q60 8 65 22" fill="#dc2626" stroke="#7c2d12"/>
            <rect x="36" y="62" width="48" height="6" fill="#fde047" stroke="#7c2d12"/>
            <ellipse cx="60" cy="86" rx="20" ry="6" fill="#7c2d12"/>
            <path d="M16 70 Q22 60 30 64 Q26 76 16 70 Z" fill="#16a34a" stroke="#15803d"/>
            <path d="M22 76 Q28 66 36 70" fill="#16a34a" stroke="#15803d"/>
            <path d="M104 70 Q98 60 90 64 Q94 76 104 70 Z" fill="#16a34a" stroke="#15803d"/>
            <path d="M98 76 Q92 66 84 70" fill="#16a34a" stroke="#15803d"/>
            <circle cx="22" cy="68" r="2" fill="#dc2626"/>
            <circle cx="98" cy="68" r="2" fill="#dc2626"/>
        </svg>`,
        slot_viking: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="60" cy="68" rx="28" ry="26" fill="#94a3b8" stroke="#0f172a" stroke-width="2"/>
            <path d="M32 68 Q60 38 88 68" fill="#cbd5e1" stroke="#0f172a" stroke-width="2"/>
            <rect x="48" y="62" width="24" height="20" rx="2" fill="#fafafa"/>
            <rect x="50" y="64" width="20" height="6" fill="#0f172a"/>
            <ellipse cx="56" cy="72" rx="2" ry="3" fill="#0f172a"/>
            <ellipse cx="64" cy="72" rx="2" ry="3" fill="#0f172a"/>
            <path d="M16 56 Q4 24 30 32 Q26 50 32 60 Z" fill="#cbd5e1" stroke="#0f172a" stroke-width="2"/>
            <path d="M104 56 Q116 24 90 32 Q94 50 88 60 Z" fill="#cbd5e1" stroke="#0f172a" stroke-width="2"/>
            <rect x="56" y="38" width="8" height="14" fill="#fbbf24" stroke="#92400e"/>
            <circle cx="60" cy="38" r="5" fill="#fbbf24" stroke="#92400e"/>
        </svg>`,
        slot_safari: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="sf-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbbf24"/><stop offset="1" stop-color="#dc2626"/></linearGradient></defs>
            <rect x="0" y="0" width="120" height="100" fill="url(#sf-sky)" opacity=".4"/>
            <circle cx="60" cy="50" r="20" fill="#fde047"/>
            <rect x="0" y="86" width="120" height="20" fill="#92400e"/>
            <line x1="68" y1="58" x2="68" y2="98" stroke="#1e293b" stroke-width="2"/>
            <ellipse cx="68" cy="58" rx="22" ry="8" fill="#365314" stroke="#1e293b" stroke-width="1.5"/>
            <ellipse cx="60" cy="56" rx="10" ry="6" fill="#15803d"/>
            <ellipse cx="76" cy="58" rx="12" ry="7" fill="#15803d"/>
            <ellipse cx="22" cy="92" rx="14" ry="10" fill="#a16207"/>
            <circle cx="14" cy="86" r="8" fill="#a16207"/>
            <circle cx="10" cy="84" r="2" fill="#0f172a"/>
            <path d="M8 88 Q10 92 14 90" stroke="#0f172a" stroke-width="1.5" fill="none"/>
            <path d="M6 80 Q4 76 8 76 M22 78 Q20 74 24 74" stroke="#92400e" stroke-width="2" fill="none"/>
        </svg>`,
        slot_frozen: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <g stroke="#fff" stroke-width="1.5">
                <circle cx="22" cy="22" r="1" fill="#fff"/><circle cx="38" cy="14" r="1" fill="#fff"/>
                <circle cx="98" cy="20" r="1" fill="#fff"/><circle cx="110" cy="48" r="1" fill="#fff"/>
                <circle cx="14" cy="50" r="1" fill="#fff"/>
            </g>
            <g transform="translate(60 36)" stroke="#22d3ee" stroke-width="2.5" fill="none">
                <line x1="0" y1="-16" x2="0" y2="16"/>
                <line x1="-14" y1="-8" x2="14" y2="8"/>
                <line x1="-14" y1="8" x2="14" y2="-8"/>
                <path d="M0 -16 L-3 -12 M0 -16 L3 -12"/>
                <path d="M0 16 L-3 12 M0 16 L3 12"/>
                <path d="M-14 -8 L-12 -4 M-14 -8 L-12 -12"/>
                <path d="M14 8 L12 4 M14 8 L12 12"/>
            </g>
            <rect x="34" y="68" width="52" height="36" fill="#dc2626" stroke="#7f1d1d" stroke-width="2"/>
            <rect x="34" y="68" width="52" height="8" fill="#fde047"/>
            <rect x="56" y="68" width="8" height="36" fill="#fde047"/>
            <path d="M48 68 Q44 56 56 60 Q56 50 64 60 Q76 56 72 68 Z" fill="#fde047" stroke="#92400e"/>
        </svg>`,
        slot_fairy: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <defs><linearGradient id="fc-castle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0abfc"/><stop offset="1" stop-color="#7e22ce"/></linearGradient></defs>
            <g fill="#fde047">
                <text x="14" y="28" font-size="14">✨</text>
                <text x="96" y="22" font-size="12">✨</text>
                <text x="100" y="58" font-size="14">✨</text>
                <text x="10" y="62" font-size="12">✨</text>
            </g>
            <rect x="22" y="60" width="14" height="40" fill="url(#fc-castle)" stroke="#0f172a"/>
            <polygon points="22,60 36,60 29,46" fill="#dc2626" stroke="#0f172a"/>
            <rect x="42" y="46" width="36" height="54" fill="url(#fc-castle)" stroke="#0f172a"/>
            <polygon points="42,46 78,46 60,24" fill="#dc2626" stroke="#0f172a"/>
            <circle cx="60" cy="32" r="3" fill="#fde047"/>
            <rect x="84" y="60" width="14" height="40" fill="url(#fc-castle)" stroke="#0f172a"/>
            <polygon points="84,60 98,60 91,46" fill="#dc2626" stroke="#0f172a"/>
            <rect x="56" y="78" width="8" height="22" fill="#451a03"/>
            <rect x="50" y="60" width="4" height="6" fill="#fde047"/>
            <rect x="66" y="60" width="4" height="6" fill="#fde047"/>
            <rect x="48" y="68" width="6" height="4" fill="#fde047"/>
        </svg>`,
        slot_mardi: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <g fill="none" stroke="#fbbf24" stroke-width="3">
                <path d="M88 26 Q98 12 110 24"/><path d="M82 22 Q90 4 102 12"/>
                <path d="M76 20 Q80 4 96 6"/>
            </g>
            <g fill="none" stroke="#22d3ee" stroke-width="3">
                <path d="M32 26 Q22 12 10 24"/><path d="M38 22 Q30 4 18 12"/>
                <path d="M44 20 Q40 4 24 6"/>
            </g>
            <path d="M20 56 Q40 36 60 50 Q80 36 100 56 Q92 76 78 72 Q72 86 60 80 Q48 86 42 72 Q28 76 20 56 Z" fill="#a855f7" stroke="#0f172a" stroke-width="2"/>
            <ellipse cx="42" cy="58" rx="10" ry="7" fill="#0f172a"/>
            <ellipse cx="78" cy="58" rx="10" ry="7" fill="#0f172a"/>
            <circle cx="42" cy="58" r="3" fill="#fde047"/>
            <circle cx="78" cy="58" r="3" fill="#fde047"/>
            <g fill="#22d3ee">
                <circle cx="28" cy="48" r="2"/><circle cx="92" cy="48" r="2"/>
            </g>
            <g fill="#fde047">
                <circle cx="60" cy="40" r="2"/><circle cx="50" cy="46" r="1.5"/><circle cx="70" cy="46" r="1.5"/>
            </g>
            <line x1="60" y1="80" x2="60" y2="100" stroke="#fbbf24" stroke-width="2"/>
        </svg>`
    };

    /* Fallback for any theme without a custom scene. */
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

    // Register each theme. Custom hand-drawn scenes override the fallback art.
    THEMES.forEach(theme => {
        if (!window.Casino || typeof Casino.registerGame !== 'function') return;
        const art = SCENES[theme.id] || theme.art;
        Casino.registerGame({
            id: theme.id, name: theme.name, desc: theme.desc, icon: theme.icon,
            g1: theme.g1, g2: theme.g2, studio: theme.studio, art,
            category: 'slots',
            particles: theme.symbols
        }, makeSlotGame(theme));
    });
})();
