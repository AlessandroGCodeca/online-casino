/* Premium 5-reel × 3-row slot engine with 10 paylines.
   One generic engine + a few rich themes registered as separate games.
   Each theme has: 8 symbols (incl. wild + scatter), weighted distribution,
   payout table (3-of-a-kind base; 4-of-a-kind ×5; 5-of-a-kind ×25),
   color gradient, illustrated card art, sound palette, free-spin bonus,
   win chain, and bonus-buy support. */
(function () {
    'use strict';

    const ROWS = 3;
    const REELS = 5;
    const SYMBOL_PX = 86;

    // Paylines as arrays of row indices per reel (5 entries each).
    const PAYLINES = [
        [1, 1, 1, 1, 1], // middle
        [0, 0, 0, 0, 0], // top
        [2, 2, 2, 2, 2], // bottom
        [0, 1, 2, 1, 0], // V down-up
        [2, 1, 0, 1, 2], // V up-down
        [0, 0, 1, 2, 2], // step down
        [2, 2, 1, 0, 0], // step up
        [1, 0, 0, 0, 1], // top hump
        [1, 2, 2, 2, 1], // bottom hump
        [0, 1, 1, 1, 2]  // diagonal
    ];

    const CHAIN_MULTS = [1, 2, 3, 4, 5];
    const BONUS_BUY_MULT = 75;
    const AUTO_OPTIONS = [10, 25, 50, 100];

    function getTiming() {
        if (Casino.fastSpin) return { base: 0.35, inc: 0.1, finishPad: 100, continuePad: 350 };
        return { base: 1.0, inc: 0.35, finishPad: 200, continuePad: 1400 };
    }

    function weightedPick(symbols, weights) {
        const r = Math.random();
        let acc = 0;
        for (let i = 0; i < symbols.length; i++) {
            acc += weights[i];
            if (r < acc) return symbols[i];
        }
        return symbols[symbols.length - 1];
    }

    function playThemeSound(theme, type) {
        if (!Casino.playTones) return;
        const pal = theme.palette || [400, 500, 600, 700];
        const wave = theme.wave || 'sine';
        let spec = [];
        if (type === 'reelStop')   spec = [{ freq: pal[0], wave, dur: 0.07, vol: 0.04 }];
        else if (type === 'spinStart') spec = [{ freq: pal[0] * 0.7, wave, dur: 0.14, vol: 0.04 }];
        else if (type === 'win')      spec = pal.map((f, i) => ({ freq: f, wave, start: i * 0.08, dur: 0.3, vol: 0.07 }));
        else if (type === 'bigWin')   spec = [
            ...pal.map((f, i) => ({ freq: f,     wave, start: i * 0.07, dur: 0.3, vol: 0.07 })),
            ...pal.map((f, i) => ({ freq: f * 2, wave, start: (pal.length + i) * 0.07, dur: 0.3, vol: 0.07 }))
        ];
        else if (type === 'lose')     spec = [
            { freq: pal[0], wave, dur: 0.25, vol: 0.05 },
            { freq: pal[0] * 0.6, wave, start: 0.18, dur: 0.4, vol: 0.05 }
        ];
        else if (type === 'freeSpin') {
            for (let oct = 0; oct < 2; oct++) {
                pal.forEach((f, i) => {
                    spec.push({ freq: f * (1 + oct * 0.5), wave, start: (oct * pal.length + i) * 0.1, dur: 0.4, vol: 0.07 });
                });
            }
        }
        Casino.playTones(spec);
    }

    function makeSlot5(theme) {
        let bet = 100;
        let spinning = false;
        let area = null;
        let freeSpinsLeft = 0, freeSpinTotal = 0, freeSpinWinSum = 0;
        let winChain = 0;
        let autoSpinsLeft = 0, autoStopOnWin = false, autoTimer = null;
        let lastPaidWasWin = false;
        const freeSpinMult = theme.freeSpinMultiplier || 2;
        const freeSpinGrant = theme.freeSpinGrant || 10;

        function $$(sel) { return area && area.querySelector(sel); }

        function init(gameArea) {
            area = gameArea;
            freeSpinsLeft = 0; freeSpinTotal = 0; freeSpinWinSum = 0;
            autoSpinsLeft = 0; winChain = 0;
            renderUI();
            resetReels();
            wireControls();
            updateBonusBtn();
            if (typeof Casino.startAmbient === 'function') Casino.startAmbient(theme.palette, theme.wave);
        }

        function renderUI() {
            const payHtml = theme.symbols
                .filter(s => theme.payouts[s])
                .map(s => {
                    const p = theme.payouts[s];
                    return `<span class="ts-pay-item"><span class="ts-sym">${s}</span> <b>${p}×</b> · 4=<b>${p * 5}×</b> · 5=<b>${p * 25}×</b></span>`;
                })
                .join('');

            const scatterInfo = theme.scatter
                ? ` · <span class="ts-sym">${theme.scatter}</span> Scatter (3+ = ${freeSpinGrant} free spins, ${freeSpinMult}×)`
                : '';

            area.innerHTML = `
            <div class="themed-slot ts5-slot" style="--ts-g1:${theme.g1};--ts-g2:${theme.g2};--ts-accent:${theme.accent || '#fbbf24'}">
                <div class="ts-frame">
                    <div class="ts-banner">
                        <span class="ts-banner-icon">${theme.icon}</span>
                        <span class="ts-banner-title">${theme.name}</span>
                        <span class="ts5-tier-tag">PREMIUM · 10 LINES</span>
                    </div>
                    <div class="ts-freespin-bar" data-role="fsbar" style="display:none;">
                        <span class="ts-fs-text"><span class="ts-fs-icon">✨</span> FREE SPINS: <b data-role="fscount">0</b> / <b data-role="fstotal">0</b></span>
                        <span class="ts-fs-mult">${freeSpinMult}× ALL WINS</span>
                    </div>
                    <div class="ts5-grid">
                        ${Array.from({ length: REELS }, (_, c) => `<div class="ts5-reel"><div class="ts5-strip" data-reel="${c}"></div></div>`).join('')}
                        <svg class="ts5-lines" viewBox="0 0 ${REELS * SYMBOL_PX} ${ROWS * SYMBOL_PX}" aria-hidden="true"></svg>
                    </div>
                    <div class="ts-message game-message" data-role="msg">${theme.tagline || 'Match symbols left-to-right!'}</div>
                </div>
                <div class="ts-chain-bar" data-role="chainbar" style="display:none;">
                    <span class="ts-chain-text">🔥 HOT STREAK</span>
                    <div class="ts-chain-dots" data-role="chaindots"></div>
                    <span class="ts-chain-mult" data-role="chainmult">×2 next win</span>
                </div>
                <div class="game-controls ts-controls">
                    <div class="bet-group">
                        <span class="bet-label">Bet</span>
                        <button class="bet-btn" type="button" data-bet="100">$100</button>
                        <button class="bet-btn" type="button" data-bet="250">$250</button>
                        <button class="bet-btn" type="button" data-bet="500">$500</button>
                        <button class="bet-btn" type="button" data-bet="1000">$1K</button>
                    </div>
                    <button class="action-btn primary ts-spin" type="button" data-role="spin">SPIN — $${bet}</button>
                    <button class="ts-icon-btn ts-fast" type="button" data-role="fast" aria-pressed="${Casino.fastSpin ? 'true' : 'false'}" title="Fast Spin">⚡</button>
                    <button class="ts-icon-btn ts-auto" type="button" data-role="auto" title="Auto Spin">🔁</button>
                    <button class="action-btn ts-bonus-buy" type="button" data-role="buybonus" title="Pay 75× bet to instantly trigger free spins">💰 BUY BONUS<span class="ts-bonus-cost" data-role="bonuscost"> ($${(bet * BONUS_BUY_MULT).toLocaleString()})</span></button>
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
                        <span>Payouts (×bet, 3 / 4 / 5 matching from left)</span>
                        <span><span class="ts-sym">${theme.wild}</span> Wild${scatterInfo}</span>
                    </div>
                    <div class="ts-paytable-grid ts5-paytable-grid">${payHtml}</div>
                </div>
            </div>`;
        }

        function wireControls() {
            area.querySelectorAll('.bet-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (spinning || freeSpinsLeft > 0 || autoSpinsLeft > 0) return;
                    bet = parseInt(btn.dataset.bet, 10);
                    updateSpinBtn(); updateBonusBtn();
                    Casino.playSound('click');
                });
            });
            $$('[data-role=spin]').addEventListener('click', spin);
            $$('[data-role=buybonus]').addEventListener('click', buyBonus);
            $$('[data-role=fast]').addEventListener('click', () => { Casino.fastSpin = !Casino.fastSpin; Casino.saveState(); applyFastBtn(); Casino.playSound('click'); });
            $$('[data-role=auto]').addEventListener('click', () => { const p = $$('[data-role=autopanel]'); if (p) p.hidden = !p.hidden; Casino.playSound('click'); });
            $$('[data-role=autoclose]').addEventListener('click', () => { $$('[data-role=autopanel]').hidden = true; });
            $$('[data-role=autostart]').addEventListener('click', () => {
                const active = area.querySelector('.ts-auto-count.active');
                autoSpinsLeft = active ? parseInt(active.dataset.count, 10) : 10;
                autoStopOnWin = !!$$('[data-role=autostop]').checked;
                $$('[data-role=autopanel]').hidden = true;
                updateAutoStatus();
                Casino.playSound('click');
                if (!spinning) spin();
            });
            $$('[data-role=autoabort]').addEventListener('click', stopAuto);
            area.querySelectorAll('.ts-auto-count').forEach(btn => {
                btn.addEventListener('click', () => {
                    area.querySelectorAll('.ts-auto-count').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    Casino.playSound('click');
                });
            });
            const def = area.querySelector('.ts-auto-count[data-count="10"]');
            if (def) def.classList.add('active');
            applyFastBtn();
        }

        function applyFastBtn() {
            const btn = $$('[data-role=fast]');
            if (!btn) return;
            btn.classList.toggle('active', !!Casino.fastSpin);
            btn.setAttribute('aria-pressed', Casino.fastSpin ? 'true' : 'false');
        }

        function stopAuto() {
            autoSpinsLeft = 0;
            if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
            updateAutoStatus(); updateSpinBtn();
            Casino.playSound('click');
        }

        function updateSpinBtn() {
            const btn = $$('[data-role=spin]');
            if (!btn) return;
            if (freeSpinsLeft > 0) btn.textContent = `FREE SPIN (${freeSpinsLeft} left)`;
            else btn.textContent = `SPIN — $${bet}`;
            btn.disabled = spinning;
        }

        function updateFsBar() {
            const bar = $$('[data-role=fsbar]');
            if (!bar) return;
            if (freeSpinsLeft > 0 || freeSpinTotal > 0) {
                bar.style.display = 'flex';
                $$('[data-role=fscount]').textContent = freeSpinsLeft;
                $$('[data-role=fstotal]').textContent = freeSpinTotal;
            } else bar.style.display = 'none';
        }

        function updateChainBar() {
            const bar = $$('[data-role=chainbar]');
            if (!bar) return;
            if (winChain > 0) {
                bar.style.display = 'flex';
                const dots = $$('[data-role=chaindots]');
                dots.innerHTML = CHAIN_MULTS.slice(1).map((_, i) => `<span class="ts-chain-dot${i < winChain ? ' lit' : ''}"></span>`).join('');
                const nextMult = CHAIN_MULTS[Math.min(winChain, CHAIN_MULTS.length - 1)];
                $$('[data-role=chainmult]').textContent = `×${nextMult} next win`;
            } else bar.style.display = 'none';
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

        function updateAutoStatus() {
            const status = $$('[data-role=autostatus]');
            if (!status) return;
            if (autoSpinsLeft > 0) {
                status.hidden = false;
                $$('[data-role=autocount]').textContent = autoSpinsLeft;
            } else status.hidden = true;
        }

        function showMsg(text, cls) {
            const m = $$('[data-role=msg]');
            if (!m) return;
            m.textContent = text;
            m.className = 'ts-message game-message ' + (cls || '');
        }

        function themeParticles() {
            if (theme.winFx && theme.winFx.length) return theme.winFx;
            const set = new Set([theme.wild, theme.scatter]);
            return theme.symbols.filter(s => !set.has(s)).slice(0, 6).concat([theme.wild]);
        }

        function clearLines() {
            const svg = area.querySelector('.ts5-lines');
            if (svg) svg.innerHTML = '';
        }

        function drawWinningLines(winningLines) {
            const svg = area.querySelector('.ts5-lines');
            if (!svg) return;
            svg.innerHTML = '';
            const colors = ['#fbbf24','#22c55e','#3b82f6','#ec4899','#8b5cf6','#f97316','#06b6d4','#84cc16','#ef4444','#a855f7'];
            winningLines.forEach((wl, idx) => {
                const line = PAYLINES[wl.idx];
                const points = line.slice(0, wl.count).map((row, col) => {
                    const x = col * SYMBOL_PX + SYMBOL_PX / 2;
                    const y = row * SYMBOL_PX + SYMBOL_PX / 2;
                    return `${x},${y}`;
                }).join(' ');
                setTimeout(() => {
                    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
                    poly.setAttribute('points', points);
                    poly.setAttribute('fill', 'none');
                    poly.setAttribute('stroke', colors[wl.idx % colors.length]);
                    poly.setAttribute('stroke-width', '4');
                    poly.setAttribute('stroke-linecap', 'round');
                    poly.setAttribute('stroke-linejoin', 'round');
                    poly.setAttribute('opacity', '0.85');
                    poly.style.filter = `drop-shadow(0 0 6px ${colors[wl.idx % colors.length]})`;
                    poly.style.animation = 'tsLineFlash 0.7s ease-in-out infinite alternate';
                    svg.appendChild(poly);
                }, idx * 200);
            });
        }

        function resetReels() {
            for (let c = 0; c < REELS; c++) {
                const strip = area.querySelector(`[data-reel="${c}"]`);
                strip.style.transition = 'none';
                strip.style.transform = 'translateY(0)';
                strip.innerHTML = Array.from({ length: ROWS }, () => `<div class="ts5-cell">${pick()}</div>`).join('');
            }
            clearLines();
        }

        function spin() {
            if (spinning) return;
            const usingFreeSpin = freeSpinsLeft > 0;
            if (!usingFreeSpin) {
                if (!Casino.placeBet(bet)) {
                    showMsg('Not enough chips!', 'lose');
                    stopAuto();
                    return;
                }
            } else {
                freeSpinsLeft--;
                updateFsBar();
            }
            if (Casino.fastSpin && !usingFreeSpin) Casino.stats.fastSpins = (Casino.stats.fastSpins || 0) + 1;

            spinning = true;
            const btn = $$('[data-role=spin]');
            btn.disabled = true;
            btn.textContent = usingFreeSpin ? 'FREE SPIN...' : 'SPINNING...';
            showMsg(usingFreeSpin ? '✨ Free spin!' : 'Good luck!', '');
            clearLines();
            playThemeSound(theme, 'spinStart');

            // Generate result grid: [row][col]
            const grid = Array.from({ length: ROWS }, () => Array.from({ length: REELS }, () => pick()));
            const t = getTiming();
            const spinCounts = Casino.fastSpin ? [10, 12, 14, 16, 18] : [18, 22, 26, 30, 34];

            for (let c = 0; c < REELS; c++) {
                const strip = area.querySelector(`[data-reel="${c}"]`);
                const cells = Array.from({ length: spinCounts[c] }, () => `<div class="ts5-cell">${pick()}</div>`).join('') +
                              Array.from({ length: ROWS }, (_, r) => `<div class="ts5-cell">${grid[r][c]}</div>`).join('');
                strip.innerHTML = cells;
                strip.style.transition = 'none';
                strip.style.transform = 'translateY(0)';
                void strip.offsetWidth;
                const offset = -(spinCounts[c]) * SYMBOL_PX;
                const dur = t.base + c * t.inc;
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
            }

            setTimeout(() => evaluate(grid, usingFreeSpin), (t.base + (REELS - 1) * t.inc) * 1000 + t.finishPad);
        }

        function pick() { return weightedPick(theme.symbols, theme.weights); }

        function evaluate(grid, wasFreeSpin) {
            // Count scatters anywhere
            let scatterCount = 0;
            for (let r = 0; r < ROWS; r++) for (let c = 0; c < REELS; c++) if (grid[r][c] === theme.scatter) scatterCount++;

            // Evaluate paylines
            const wild = theme.wild;
            const winningLines = [];
            let totalWin = 0;
            PAYLINES.forEach((line, idx) => {
                const syms = line.map((row, col) => grid[row][col]);
                if (syms.some(s => s === theme.scatter)) return;

                // Determine base symbol
                let baseSymbol = syms[0];
                if (baseSymbol === wild) {
                    const firstNonWild = syms.find(s => s !== wild);
                    if (firstNonWild) baseSymbol = firstNonWild;
                }

                let count = 0;
                for (let i = 0; i < syms.length; i++) {
                    if (syms[i] === baseSymbol || syms[i] === wild) count++;
                    else break;
                }

                if (count >= 3) {
                    const mult = theme.payouts[baseSymbol] || 0;
                    if (mult > 0) {
                        let lineWin = bet * mult;
                        if (count === 4) lineWin *= 5;
                        else if (count === 5) lineWin *= 25;
                        totalWin += lineWin;
                        winningLines.push({ idx, count, baseSymbol, win: lineWin });
                    }
                }
            });

            if (!wasFreeSpin) lastPaidWasWin = false;

            // Scatter bonus
            if (scatterCount >= 3) {
                freeSpinsLeft += freeSpinGrant;
                freeSpinTotal += freeSpinGrant;
                Casino.stats.freeSpinTriggers = (Casino.stats.freeSpinTriggers || 0) + 1;
                if (!wasFreeSpin) lastPaidWasWin = true;
                showMsg(`${theme.scatter}×${scatterCount} BONUS! +${freeSpinGrant} FREE SPINS (${freeSpinMult}×)`, 'win');
                playThemeSound(theme, 'freeSpin');
                Casino.showWinEffect(freeSpinGrant);
                updateFsBar();
                if (typeof Casino.checkAchievements === 'function') Casino.checkAchievements();
            }

            // Free-spin multiplier
            if (wasFreeSpin && totalWin > 0) {
                totalWin *= freeSpinMult;
                freeSpinWinSum += totalWin;
            }

            // Win chain (paid spins only)
            if (!wasFreeSpin && totalWin > 0 && winChain > 0) {
                const chainMult = CHAIN_MULTS[Math.min(winChain, CHAIN_MULTS.length - 1)];
                if (chainMult > 1) totalWin *= chainMult;
            }
            if (!wasFreeSpin) {
                lastPaidWasWin = lastPaidWasWin || totalWin > 0;
                if (totalWin > 0) {
                    winChain = Math.min(winChain + 1, CHAIN_MULTS.length - 1);
                    if (winChain > (Casino.stats.maxChain || 0)) Casino.stats.maxChain = winChain;
                } else winChain = 0;
            }

            if (totalWin > 0) {
                Casino.changeBalance(totalWin);
                const lines = winningLines.length;
                const chainTag = (!wasFreeSpin && winChain > 1) ? `🔥${CHAIN_MULTS[Math.min(winChain - 1, CHAIN_MULTS.length - 1)]}× ` : '';
                const freeTag = wasFreeSpin ? `[FREE ${freeSpinMult}×] ` : '';
                showMsg(`${freeTag}${chainTag}${lines} line${lines > 1 ? 's' : ''} — Won $${totalWin.toLocaleString()}!`, 'win');
                const ratio = totalWin / Math.max(1, bet);
                const tier = ratio >= 100 ? 'mega' : ratio >= 25 ? 'big' : 'normal';
                if (tier !== 'normal') {
                    Casino.showWinEffect(totalWin, {
                        particles: themeParticles(),
                        accent: theme.accent || theme.g1,
                        tier,
                        themeLabel: theme.name
                    });
                    playThemeSound(theme, 'bigWin');
                } else if (ratio >= 5) {
                    Casino.showWinEffect(totalWin, { particles: themeParticles(), accent: theme.accent || theme.g1, tier: 'normal' });
                    playThemeSound(theme, 'win');
                } else {
                    playThemeSound(theme, 'win');
                }
                drawWinningLines(winningLines);
            } else if (scatterCount < 3) {
                showMsg('No win this spin', 'lose');
                if (!wasFreeSpin) playThemeSound(theme, 'lose');
            }

            finishSpinAndContinue();
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
            updateFsBar(); updateChainBar(); updateBonusBtn();
            if (typeof Casino.checkAchievements === 'function') Casino.checkAchievements();
            setTimeout(() => { if (!spinning) spin(); }, Casino.fastSpin ? 500 : 1100);
        }

        function finishSpinAndContinue() {
            spinning = false;
            updateSpinBtn(); updateFsBar(); updateChainBar(); updateBonusBtn();
            const t = getTiming();

            if (freeSpinsLeft > 0) {
                autoTimer = setTimeout(() => { if (!spinning && freeSpinsLeft > 0) spin(); }, t.continuePad);
                return;
            }
            if (freeSpinTotal > 0) {
                const summary = freeSpinWinSum > 0
                    ? `🎉 Free spins complete! Total won: $${freeSpinWinSum.toLocaleString()}`
                    : 'Free spins complete — no wins this round.';
                setTimeout(() => showMsg(summary, freeSpinWinSum > 0 ? 'win' : ''), 200);
                freeSpinTotal = 0; freeSpinWinSum = 0;
                updateFsBar();
            }

            if (autoSpinsLeft > 0) {
                autoSpinsLeft--;
                updateAutoStatus();
                if (autoSpinsLeft <= 0) {
                    stopAuto();
                    if (typeof Casino.showToast === 'function') Casino.showToast('🔁 Auto spins complete.');
                } else if (autoStopOnWin && lastPaidWasWin) {
                    stopAuto();
                    showMsg('Auto stopped: you won!', 'win');
                } else if (Casino.balance < bet) {
                    stopAuto();
                    showMsg('Auto stopped: low balance.', 'lose');
                } else {
                    autoTimer = setTimeout(() => { if (autoSpinsLeft > 0) spin(); }, t.continuePad);
                }
            }
        }

        return {
            init,
            destroy() {
                spinning = false;
                freeSpinsLeft = 0; freeSpinTotal = 0; freeSpinWinSum = 0;
                autoSpinsLeft = 0; winChain = 0;
                if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
                if (typeof Casino.stopAmbient === 'function') Casino.stopAmbient();
            }
        };
    }

    // Lobby card art for premium tier — 5 reels with the centerpiece symbol.
    function makeArt(center, accent) {
        return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="36" width="108" height="62" rx="10" fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.4)" stroke-width="2"/>
            ${[0,1,2,3,4].map(i => `<rect x="${10 + i*21}" y="42" width="19" height="50" rx="3" fill="rgba(0,0,0,.4)"/>`).join('')}
            ${[0,1,2,3,4].map(i => `<text x="${10 + i*21 + 9.5}" y="72" font-size="14" text-anchor="middle">${center}</text>`).join('')}
            <rect x="8" y="66" width="104" height="2" fill="#fbbf24" opacity=".8"/>
            <text x="60" y="26" font-size="18" text-anchor="middle">${accent}</text>
            <text x="60" y="113" font-size="7" fill="#fbbf24" font-weight="900" text-anchor="middle" letter-spacing="2">PREMIUM</text>
        </svg>`;
    }

    const THEMES = [
        {
            id: 'p_olympus', name: 'Olympus Premium', icon: '⚡',
            desc: 'Zeus & Hera · 5 reels · 10 paylines',
            g1: '#0891b2', g2: '#1e1b4b', accent: '#fbbf24',
            studio: 'OLYMPUS HALL · PREMIUM',
            art: makeArt('⚡', '🏛️'),
            tagline: 'Strike the lightning for premium gold!',
            symbols: ['🍇', '🦉', '🌊', '🏛️', '⚔️', '👑', '⚡', '🌟'],
            weights: [0.24, 0.20, 0.16, 0.13, 0.10, 0.07, 0.05, 0.05],
            payouts: { '🍇': 1, '🦉': 1.5, '🌊': 2, '🏛️': 3, '⚔️': 5, '👑': 10, '⚡': 25 },
            wild: '⚡', scatter: '🌟',
            palette: [196, 247, 294, 392, 494], wave: 'sine',
            freeSpinGrant: 10, freeSpinMultiplier: 3
        },
        {
            id: 'p_dragon', name: 'Imperial Dragon Premium', icon: '🐉',
            desc: 'Imperial fortune · 10 lines · 25× max',
            g1: '#dc2626', g2: '#450a0a', accent: '#fde047',
            studio: 'IMPERIAL ORIENT · PREMIUM',
            art: makeArt('🐉', '🏮'),
            tagline: 'Awaken the dragon!',
            symbols: ['🎋', '🏮', '☯️', '🐟', '🪙', '💰', '🐉', '🧧'],
            weights: [0.24, 0.20, 0.16, 0.13, 0.10, 0.07, 0.05, 0.05],
            payouts: { '🎋': 1, '🏮': 1.5, '☯️': 2, '🐟': 3, '🪙': 5, '💰': 12, '🐉': 30 },
            wild: '🐉', scatter: '🧧',
            palette: [261, 293, 349, 392, 440], wave: 'sine',
            freeSpinGrant: 12, freeSpinMultiplier: 3
        },
        {
            id: 'p_aztec', name: 'Aztec Premium', icon: '🗿',
            desc: 'Lost temples · 10 lines · jaguar wilds',
            g1: '#15803d', g2: '#1e1b4b', accent: '#fbbf24',
            studio: 'JUNGLE PRAGMA · PREMIUM',
            art: makeArt('🗿', '🌞'),
            tagline: 'Awaken ancient riches!',
            symbols: ['🌿', '🐍', '🐆', '🌞', '🗿', '💎', '👑', '🌋'],
            weights: [0.24, 0.20, 0.16, 0.13, 0.10, 0.07, 0.05, 0.05],
            payouts: { '🌿': 1, '🐍': 1.5, '🐆': 2, '🌞': 3, '🗿': 6, '💎': 12, '👑': 30 },
            wild: '👑', scatter: '🌋',
            palette: [196, 233, 277, 349, 415], wave: 'sine',
            freeSpinGrant: 10, freeSpinMultiplier: 3
        }
    ];

    THEMES.forEach(theme => {
        if (!window.Casino || typeof Casino.registerGame !== 'function') return;
        Casino.registerGame({
            id: theme.id, name: theme.name, desc: theme.desc, icon: theme.icon,
            g1: theme.g1, g2: theme.g2, studio: theme.studio, art: theme.art,
            category: 'slots'
        }, makeSlot5(theme));
    });
})();
