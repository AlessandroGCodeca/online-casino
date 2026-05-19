/* Tumble / Cascade slot engine — 6 columns × 5 rows.
   Pays for 8+ of the same symbol anywhere on the grid (cluster-style).
   Winning cells dissolve, remaining cells drop down, and new symbols
   tumble in from the top. Cascade multiplier grows with each chain. */
(function () {
    'use strict';

    const COLS = 6;
    const ROWS = 5;
    const CELL_PX = 72;

    const CASCADE_MULTS = [1, 2, 3, 5, 10, 25];  // multiplier per cascade depth
    const BONUS_BUY_MULT = 100;
    const AUTO_OPTIONS = [10, 25, 50, 100];

    function getTiming() {
        if (Casino.fastSpin) return { drop: 280, between: 380, scatter: 4 };
        return { drop: 600, between: 900, scatter: 4 };
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

    function playThemeSound(theme, type, depth) {
        if (!Casino.playTones) return;
        const pal = theme.palette || [400, 500, 600, 700];
        const wave = theme.wave || 'sine';
        let spec = [];
        if (type === 'spinStart') spec = [{ freq: pal[0] * 0.7, wave, dur: 0.14, vol: 0.04 }];
        else if (type === 'cascadeWin') {
            const base = (depth || 0) * 60;
            spec = pal.map((f, i) => ({ freq: f + base, wave, start: i * 0.06, dur: 0.22, vol: 0.06 }));
        } else if (type === 'bigWin') spec = [
            ...pal.map((f, i) => ({ freq: f,     wave, start: i * 0.07, dur: 0.3, vol: 0.07 })),
            ...pal.map((f, i) => ({ freq: f * 2, wave, start: (pal.length + i) * 0.07, dur: 0.3, vol: 0.07 }))
        ];
        else if (type === 'lose') spec = [
            { freq: pal[0], wave, dur: 0.25, vol: 0.05 },
            { freq: pal[0] * 0.6, wave, start: 0.18, dur: 0.4, vol: 0.05 }
        ];
        else if (type === 'freeSpin') {
            for (let oct = 0; oct < 2; oct++) {
                pal.forEach((f, i) => spec.push({ freq: f * (1 + oct * 0.5), wave, start: (oct * pal.length + i) * 0.1, dur: 0.4, vol: 0.07 }));
            }
        }
        Casino.playTones(spec);
    }

    function makeSlotCascade(theme) {
        let bet = 100, spinning = false, area = null;
        let grid = [];  // grid[row][col]
        let freeSpinsLeft = 0, freeSpinTotal = 0, freeSpinWinSum = 0;
        let autoSpinsLeft = 0, autoStopOnWin = false, autoTimer = null;
        let lastPaidWasWin = false;
        let totalRoundWin = 0;
        let cascadeDepth = 0;
        const freeSpinMult = theme.freeSpinMultiplier || 2;
        const freeSpinGrant = theme.freeSpinGrant || 10;
        const SCATTER_TRIGGER = theme.scatterTrigger || 4;

        function $$(sel) { return area && area.querySelector(sel); }

        function init(gameArea) {
            area = gameArea;
            freeSpinsLeft = 0; freeSpinTotal = 0; freeSpinWinSum = 0;
            autoSpinsLeft = 0; cascadeDepth = 0; totalRoundWin = 0;
            renderUI();
            grid = newGrid();
            renderGrid(false);
            wireControls();
            updateBonusBtn();
            if (typeof Casino.startAmbient === 'function') Casino.startAmbient(theme.palette, theme.wave);
        }

        function renderUI() {
            const payHtml = theme.symbols
                .filter(s => theme.payouts[s])
                .map(s => `<span class="ts-pay-item"><span class="ts-sym">${s}</span> <b>${theme.payouts[s]}×</b> · 10=<b>${theme.payouts[s] * 5}×</b> · 12+=<b>${theme.payouts[s] * 25}×</b></span>`)
                .join('');

            const scatterInfo = theme.scatter
                ? ` · <span class="ts-sym">${theme.scatter}</span> Scatter (${SCATTER_TRIGGER}+ = ${freeSpinGrant} free spins, ${freeSpinMult}×)`
                : '';

            area.innerHTML = `
            <div class="themed-slot tsc-slot" style="--ts-g1:${theme.g1};--ts-g2:${theme.g2};--ts-accent:${theme.accent || '#fbbf24'}">
                <div class="ts-frame">
                    <div class="ts-banner">
                        <span class="ts-banner-icon">${theme.icon}</span>
                        <span class="ts-banner-title">${theme.name}</span>
                        <span class="ts5-tier-tag tsc-tier-tag">TUMBLE · PAYS ANYWHERE</span>
                    </div>
                    <div class="ts-freespin-bar" data-role="fsbar" style="display:none;">
                        <span class="ts-fs-text"><span class="ts-fs-icon">✨</span> FREE SPINS: <b data-role="fscount">0</b> / <b data-role="fstotal">0</b></span>
                        <span class="ts-fs-mult">${freeSpinMult}× ALL WINS</span>
                    </div>
                    <div class="tsc-mult-bar" data-role="multbar" style="display:none;">
                        <span class="tsc-mult-text">🌀 CASCADE</span>
                        <span class="tsc-mult-val" data-role="multval">×1</span>
                    </div>
                    <div class="tsc-grid" data-role="grid"></div>
                    <div class="ts-message game-message" data-role="msg">${theme.tagline || 'Match 8+ of the same symbol anywhere!'}</div>
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
                    <button class="action-btn ts-bonus-buy" type="button" data-role="buybonus" title="Pay 100× bet to instantly trigger free spins">💰 BUY BONUS<span class="ts-bonus-cost" data-role="bonuscost"> ($${(bet * BONUS_BUY_MULT).toLocaleString()})</span></button>
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
                        <span>Pay anywhere (8+ matching symbols)</span>
                        <span><span class="ts-sym">${theme.wild}</span> Wild${scatterInfo}</span>
                    </div>
                    <div class="ts-paytable-grid tsc-paytable-grid">${payHtml}</div>
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

        function updateMultBar() {
            const bar = $$('[data-role=multbar]');
            if (!bar) return;
            const mult = CASCADE_MULTS[Math.min(cascadeDepth, CASCADE_MULTS.length - 1)];
            if (cascadeDepth > 0) {
                bar.style.display = 'flex';
                $$('[data-role=multval]').textContent = `×${mult}`;
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

        function pick() { return weightedPick(theme.symbols, theme.weights); }

        function newGrid() {
            const g = [];
            for (let r = 0; r < ROWS; r++) {
                g.push([]);
                for (let c = 0; c < COLS; c++) g[r].push(pick());
            }
            return g;
        }

        function renderGrid(dropAnim) {
            const container = $$('[data-role=grid]');
            if (!container) return;
            container.innerHTML = '';
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'tsc-cell' + (dropAnim ? ' entering' : '');
                    cell.dataset.r = r;
                    cell.dataset.c = c;
                    if (dropAnim) cell.style.animationDelay = (c * 0.04 + r * 0.06) + 's';
                    cell.textContent = grid[r][c];
                    container.appendChild(cell);
                }
            }
        }

        function highlightWinningCells(cells) {
            const container = $$('[data-role=grid]');
            if (!container) return;
            container.querySelectorAll('.tsc-cell').forEach(el => {
                const key = `${el.dataset.r}-${el.dataset.c}`;
                if (cells.has(key)) el.classList.add('win');
            });
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
            cascadeDepth = 0;
            totalRoundWin = 0;
            lastPaidWasWin = false;

            const btn = $$('[data-role=spin]');
            btn.disabled = true;
            btn.textContent = usingFreeSpin ? 'FREE SPIN...' : 'SPINNING...';
            showMsg(usingFreeSpin ? '✨ Free spin!' : 'Symbols dropping...', '');
            playThemeSound(theme, 'spinStart');

            grid = newGrid();
            renderGrid(true);
            updateMultBar();

            const t = getTiming();
            setTimeout(() => evaluateCascade(usingFreeSpin), t.drop);
        }

        function evaluateCascade(wasFreeSpin) {
            // Tally each symbol's count (wilds + that symbol).
            const counts = {};
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    const s = grid[r][c];
                    counts[s] = (counts[s] || 0) + 1;
                }
            }

            const wildCount = counts[theme.wild] || 0;
            const winningCells = new Set();
            let win = 0;

            Object.entries(theme.payouts).forEach(([sym, baseMult]) => {
                if (sym === theme.wild || sym === theme.scatter) return;
                const total = (counts[sym] || 0) + wildCount;
                if (total >= 8) {
                    const tier = total >= 12 ? 25 : total >= 10 ? 5 : 1;
                    const cascMult = CASCADE_MULTS[Math.min(cascadeDepth, CASCADE_MULTS.length - 1)];
                    let symWin = bet * baseMult * tier * cascMult;
                    if (wasFreeSpin) symWin *= freeSpinMult;
                    win += symWin;
                    // Mark cells of this symbol AND wilds
                    for (let r = 0; r < ROWS; r++) {
                        for (let c = 0; c < COLS; c++) {
                            if (grid[r][c] === sym || grid[r][c] === theme.wild) {
                                winningCells.add(`${r}-${c}`);
                            }
                        }
                    }
                }
            });

            // Scatter trigger (only on the initial spin of a paid round, not on cascades or free spins)
            let scatterCount = 0;
            for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] === theme.scatter) scatterCount++;
            const triggerNow = scatterCount >= SCATTER_TRIGGER && cascadeDepth === 0 && !wasFreeSpin;
            if (triggerNow) {
                freeSpinsLeft += freeSpinGrant;
                freeSpinTotal += freeSpinGrant;
                Casino.stats.freeSpinTriggers = (Casino.stats.freeSpinTriggers || 0) + 1;
                lastPaidWasWin = true;
                showMsg(`${theme.scatter}×${scatterCount} BONUS! +${freeSpinGrant} FREE SPINS (${freeSpinMult}×)`, 'win');
                playThemeSound(theme, 'freeSpin');
                Casino.showWinEffect(freeSpinGrant);
                updateFsBar();
                if (typeof Casino.checkAchievements === 'function') Casino.checkAchievements();
            }

            const t = getTiming();
            if (win > 0) {
                totalRoundWin += win;
                if (!wasFreeSpin) lastPaidWasWin = true;
                else freeSpinWinSum += win;
                playThemeSound(theme, 'cascadeWin', cascadeDepth);
                highlightWinningCells(winningCells);
                const cascMult = CASCADE_MULTS[Math.min(cascadeDepth, CASCADE_MULTS.length - 1)];
                showMsg(`Cascade ×${cascMult} — +$${win.toLocaleString()}`, 'win');

                setTimeout(() => {
                    cascadeDepth++;
                    removeAndDropCells(winningCells);
                    renderGrid(true);
                    updateMultBar();
                    setTimeout(() => evaluateCascade(wasFreeSpin), t.between);
                }, t.between);
            } else {
                finishCascade(wasFreeSpin);
            }
        }

        function removeAndDropCells(cells) {
            // For each column, keep non-winning cells (preserving order from top to bottom),
            // pad new ones at the top.
            for (let c = 0; c < COLS; c++) {
                const remaining = [];
                for (let r = 0; r < ROWS; r++) {
                    if (!cells.has(`${r}-${c}`)) remaining.push(grid[r][c]);
                }
                while (remaining.length < ROWS) remaining.unshift(pick());
                for (let r = 0; r < ROWS; r++) grid[r][c] = remaining[r];
            }
        }

        function finishCascade(wasFreeSpin) {
            if (totalRoundWin > 0) {
                Casino.changeBalance(totalRoundWin);
                const cascadesText = cascadeDepth > 1 ? ` (${cascadeDepth} cascades)` : '';
                showMsg(`🎉 Won $${totalRoundWin.toLocaleString()}${cascadesText}!`, 'win');
                if (totalRoundWin >= bet * 25) { Casino.showWinEffect(totalRoundWin); playThemeSound(theme, 'bigWin'); }
            } else if (cascadeDepth === 0 && !wasFreeSpin) {
                showMsg('No matches this spin', 'lose');
                playThemeSound(theme, 'lose');
            }
            cascadeDepth = 0;
            updateMultBar();
            finishSpinAndContinue(wasFreeSpin);
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
            showMsg(`💰 Bonus bought! ${freeSpinGrant} free spins at ${freeSpinMult}×`, 'win');
            playThemeSound(theme, 'freeSpin');
            Casino.showWinEffect(freeSpinGrant);
            updateFsBar(); updateBonusBtn();
            if (typeof Casino.checkAchievements === 'function') Casino.checkAchievements();
            setTimeout(() => { if (!spinning) spin(); }, Casino.fastSpin ? 500 : 1100);
        }

        function finishSpinAndContinue(wasFreeSpin) {
            spinning = false;
            updateSpinBtn(); updateFsBar(); updateBonusBtn();
            const t = getTiming();

            if (freeSpinsLeft > 0) {
                autoTimer = setTimeout(() => { if (!spinning && freeSpinsLeft > 0) spin(); }, Casino.fastSpin ? 400 : 1200);
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
                    autoTimer = setTimeout(() => { if (autoSpinsLeft > 0) spin(); }, Casino.fastSpin ? 400 : 1200);
                }
            }
        }

        return {
            init,
            destroy() {
                spinning = false;
                freeSpinsLeft = 0; freeSpinTotal = 0; freeSpinWinSum = 0;
                autoSpinsLeft = 0; cascadeDepth = 0;
                if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
                if (typeof Casino.stopAmbient === 'function') Casino.stopAmbient();
            }
        };
    }

    function makeArt(top, bottom) {
        return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <rect x="14" y="22" width="92" height="78" rx="10" fill="rgba(0,0,0,.45)" stroke="rgba(255,255,255,.4)" stroke-width="2"/>
            ${[0,1,2,3,4,5].map(c => `
                <text x="${20 + c*14}" y="38" font-size="12" text-anchor="middle">${top}</text>
                <text x="${20 + c*14}" y="54" font-size="12" text-anchor="middle">${bottom}</text>
                <text x="${20 + c*14}" y="70" font-size="12" text-anchor="middle">${top}</text>
                <text x="${20 + c*14}" y="86" font-size="12" text-anchor="middle">${bottom}</text>
            `).join('')}
            <text x="60" y="113" font-size="7" fill="#fbbf24" font-weight="900" text-anchor="middle" letter-spacing="2">TUMBLE</text>
        </svg>`;
    }

    const THEMES = [
        {
            id: 'c_candy', name: 'Candy Cascade', icon: '🍬',
            desc: '6×5 grid · cluster pays · tumble mechanic',
            g1: '#ec4899', g2: '#831843', accent: '#fde047',
            studio: 'CANDY KINGDOM · TUMBLE',
            art: makeArt('🍬', '🍭'),
            tagline: 'Sweet cascades, sweeter wins!',
            symbols: ['🍪', '🍫', '🍩', '🧁', '🍰', '🍬', '🍭', '🌈'],
            weights: [0.20, 0.18, 0.16, 0.14, 0.12, 0.10, 0.05, 0.05],
            payouts: { '🍪': 0.5, '🍫': 0.8, '🍩': 1.2, '🧁': 2, '🍰': 4, '🍬': 8, '🍭': 25 },
            wild: '🍭', scatter: '🌈',
            palette: [392, 440, 523, 587, 659], wave: 'triangle',
            freeSpinGrant: 12, freeSpinMultiplier: 2, scatterTrigger: 4
        },
        {
            id: 'c_jewel', name: 'Gem Cascade', icon: '💎',
            desc: 'Glittering gems · cluster wins · cascades',
            g1: '#7c3aed', g2: '#1e1b4b', accent: '#22d3ee',
            studio: 'CRYSTAL HALL · TUMBLE',
            art: makeArt('💎', '🔷'),
            tagline: 'Cluster the gems!',
            symbols: ['🟢', '🟡', '🟠', '🔴', '🔵', '🟣', '💎', '✨'],
            weights: [0.20, 0.18, 0.16, 0.14, 0.12, 0.10, 0.05, 0.05],
            payouts: { '🟢': 0.5, '🟡': 0.8, '🟠': 1.2, '🔴': 2, '🔵': 4, '🟣': 8, '💎': 25 },
            wild: '💎', scatter: '✨',
            palette: [220, 277, 330, 415, 494], wave: 'sine',
            freeSpinGrant: 10, freeSpinMultiplier: 3, scatterTrigger: 4
        },
        {
            id: 'c_fruit', name: 'Fruit Cluster', icon: '🍇',
            desc: 'Juicy clusters · 8+ to win · tumble & re-tumble',
            g1: '#f97316', g2: '#7c2d12', accent: '#fde047',
            studio: 'ORCHARD ORIGINALS · TUMBLE',
            art: makeArt('🍇', '🍒'),
            tagline: 'Pick the cluster, win the round!',
            symbols: ['🍒', '🍋', '🍊', '🍇', '🍉', '🍓', '7️⃣', '⭐'],
            weights: [0.20, 0.18, 0.16, 0.14, 0.12, 0.10, 0.05, 0.05],
            payouts: { '🍒': 0.5, '🍋': 0.8, '🍊': 1.2, '🍇': 2, '🍉': 4, '🍓': 8, '7️⃣': 25 },
            wild: '7️⃣', scatter: '⭐',
            palette: [262, 330, 392, 523], wave: 'triangle',
            freeSpinGrant: 12, freeSpinMultiplier: 2, scatterTrigger: 4
        }
    ];

    THEMES.forEach(theme => {
        if (!window.Casino || typeof Casino.registerGame !== 'function') return;
        Casino.registerGame({
            id: theme.id, name: theme.name, desc: theme.desc, icon: theme.icon,
            g1: theme.g1, g2: theme.g2, studio: theme.studio, art: theme.art,
            category: 'slots'
        }, makeSlotCascade(theme));
    });
})();
