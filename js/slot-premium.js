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
                    const color = colors[wl.idx % colors.length];
                    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
                    poly.setAttribute('points', points);
                    poly.setAttribute('fill', 'none');
                    poly.setAttribute('stroke', color);
                    poly.setAttribute('stroke-width', '4');
                    poly.setAttribute('stroke-linecap', 'round');
                    poly.setAttribute('stroke-linejoin', 'round');
                    poly.setAttribute('opacity', '0.9');
                    poly.style.filter = `drop-shadow(0 0 6px ${color})`;
                    svg.appendChild(poly);
                    // Animate the line "drawing" across the reels, then flash.
                    let len = 400;
                    try { len = poly.getTotalLength(); } catch (e) {}
                    poly.style.strokeDasharray = len;
                    poly.style.strokeDashoffset = len;
                    poly.style.transition = 'stroke-dashoffset 0.45s ease-out';
                    requestAnimationFrame(() => { poly.style.strokeDashoffset = '0'; });
                    setTimeout(() => {
                        poly.style.animation = 'tsLineFlash 0.7s ease-in-out infinite alternate';
                    }, 460);
                    // Pop the winning symbol cells on this line.
                    line.slice(0, wl.count).forEach((row, col) => {
                        const reel = area.querySelector(`[data-reel="${col}"]`);
                        if (!reel) return;
                        const cells = reel.querySelectorAll('.ts5-cell');
                        const cell = cells[cells.length - ROWS + row];
                        if (cell) {
                            cell.classList.remove('ts5-cell-win');
                            void cell.offsetWidth;
                            cell.classList.add('ts5-cell-win');
                        }
                    });
                }, idx * 220);
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

    /* Custom premium 5-reel lobby scenes. */
    const SCENES = {
        p_olympus: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <defs><radialGradient id="po-sky" cx="0.5" cy="0.3"><stop offset="0" stop-color="#fde68a" stop-opacity=".4"/><stop offset="1" stop-color="#0c4a6e" stop-opacity="0"/></radialGradient></defs>
            <rect x="0" y="0" width="120" height="60" fill="url(#po-sky)"/>
            <polygon points="60,6 30,30 90,30" fill="#cbd5e1" stroke="#0f172a" stroke-width="1.5"/>
            <rect x="22" y="30" width="76" height="5" fill="#fde047" stroke="#0f172a"/>
            <rect x="22" y="35" width="76" height="4" fill="#94a3b8" stroke="#0f172a"/>
            <g stroke="#0f172a" stroke-width="1.2" fill="#f1f5f9">
                <rect x="24" y="40" width="11" height="54"/>
                <rect x="40" y="40" width="11" height="54"/>
                <rect x="55" y="40" width="11" height="54"/>
                <rect x="70" y="40" width="11" height="54"/>
                <rect x="85" y="40" width="11" height="54"/>
            </g>
            <g stroke="#fbbf24" stroke-width="1.5" fill="none">
                <line x1="29.5" y1="40" x2="29.5" y2="94"/>
                <line x1="45.5" y1="40" x2="45.5" y2="94"/>
                <line x1="60.5" y1="40" x2="60.5" y2="94"/>
                <line x1="75.5" y1="40" x2="75.5" y2="94"/>
                <line x1="90.5" y1="40" x2="90.5" y2="94"/>
            </g>
            <rect x="18" y="94" width="84" height="6" fill="#94a3b8" stroke="#0f172a"/>
            <rect x="14" y="100" width="92" height="6" fill="#64748b" stroke="#0f172a"/>
            <polygon points="64,52 56,74 64,74 58,90 78,68 68,68 76,52" fill="#fbbf24" stroke="#92400e" stroke-width="1.5"/>
            <text x="60" y="116" font-size="6.5" fill="#fbbf24" font-weight="900" text-anchor="middle" letter-spacing="2.5">PREMIUM · 5 REELS</text>
        </svg>`,
        p_dragon: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <defs><radialGradient id="pd-glow" cx="0.5" cy="0.5"><stop offset="0" stop-color="#fde047" stop-opacity=".5"/><stop offset="1" stop-color="#dc2626" stop-opacity="0"/></radialGradient></defs>
            <rect x="0" y="0" width="120" height="120" fill="url(#pd-glow)"/>
            <g stroke="#fbbf24" stroke-width="1.5">
                <line x1="14" y1="20" x2="14" y2="36"/>
                <line x1="36" y1="20" x2="36" y2="36"/>
                <line x1="60" y1="14" x2="60" y2="32"/>
                <line x1="84" y1="20" x2="84" y2="36"/>
                <line x1="106" y1="20" x2="106" y2="36"/>
            </g>
            <g fill="#dc2626" stroke="#fde047" stroke-width="1.5">
                <ellipse cx="14" cy="44" rx="8" ry="10"/>
                <ellipse cx="36" cy="44" rx="8" ry="10"/>
                <ellipse cx="60" cy="40" rx="9" ry="11"/>
                <ellipse cx="84" cy="44" rx="8" ry="10"/>
                <ellipse cx="106" cy="44" rx="8" ry="10"/>
            </g>
            <g fill="#fbbf24">
                <circle cx="14" cy="44" r="2"/><circle cx="36" cy="44" r="2"/>
                <circle cx="60" cy="40" r="2.5"/><circle cx="84" cy="44" r="2"/><circle cx="106" cy="44" r="2"/>
            </g>
            <path d="M10 70 Q30 60 50 70 Q70 80 90 70 Q104 64 110 70 Q102 84 88 80 Q72 92 56 80 Q40 92 24 80 Q14 84 10 70 Z"
                  fill="#dc2626" stroke="#fde047" stroke-width="2"/>
            <g fill="#fde047">
                <path d="M22 72 L28 64 L30 74 Z"/>
                <path d="M48 76 L54 66 L58 78 Z"/>
                <path d="M76 76 L82 66 L86 78 Z"/>
            </g>
            <circle cx="90" cy="70" r="4" fill="#fde047" stroke="#0f172a"/>
            <circle cx="90" cy="70" r="1.5" fill="#0f172a"/>
            <path d="M10 84 Q14 96 22 100 M110 84 Q106 96 98 100" stroke="#fde047" stroke-width="2" fill="none"/>
            <text x="60" y="116" font-size="6.5" fill="#fde047" font-weight="900" text-anchor="middle" letter-spacing="2.5">PREMIUM · 5 REELS</text>
        </svg>`,
        p_aztec: `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <circle cx="60" cy="22" r="9" fill="#fbbf24"/>
            <g stroke="#fbbf24" stroke-width="1.8">
                <line x1="60" y1="8" x2="60" y2="2"/><line x1="60" y1="36" x2="60" y2="42"/>
                <line x1="46" y1="22" x2="40" y2="22"/><line x1="74" y1="22" x2="80" y2="22"/>
                <line x1="50" y1="12" x2="46" y2="8"/><line x1="70" y1="12" x2="74" y2="8"/>
                <line x1="50" y1="32" x2="46" y2="36"/><line x1="70" y1="32" x2="74" y2="36"/>
            </g>
            <polygon points="6,100 20,80 34,100" fill="#16a34a" stroke="#15803d" stroke-width="1.5"/>
            <polygon points="22,100 38,72 54,100" fill="#15803d" stroke="#14532d" stroke-width="1.5"/>
            <polygon points="42,100 60,58 78,100" fill="#16a34a" stroke="#15803d" stroke-width="1.5"/>
            <polygon points="66,100 82,72 98,100" fill="#15803d" stroke="#14532d" stroke-width="1.5"/>
            <polygon points="86,100 100,80 114,100" fill="#16a34a" stroke="#15803d" stroke-width="1.5"/>
            <rect x="56" y="78" width="8" height="22" fill="#0f172a"/>
            <polygon points="54,74 66,74 60,66" fill="#fbbf24"/>
            <g fill="#fbbf24">
                <circle cx="20" cy="90" r="2"/><circle cx="38" cy="86" r="2"/>
                <circle cx="82" cy="86" r="2"/><circle cx="100" cy="90" r="2"/>
            </g>
            <rect x="6" y="100" width="108" height="3" fill="#451a03"/>
            <text x="60" y="118" font-size="6.5" fill="#fbbf24" font-weight="900" text-anchor="middle" letter-spacing="2.5">PREMIUM · 5 REELS</text>
        </svg>`
    };

    const THEMES = [
        {
            id: 'p_olympus', name: 'Olympus Premium', icon: '⚡',
            desc: 'Zeus & Hera · 5 reels · 10 paylines',
            g1: '#0891b2', g2: '#1e1b4b', accent: '#fbbf24',
            studio: 'OLYMPUS HALL · PREMIUM',
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
            g1: theme.g1, g2: theme.g2, studio: theme.studio,
            art: SCENES[theme.id],
            category: 'slots',
            particles: theme.symbols
        }, makeSlot5(theme));
    });
})();
