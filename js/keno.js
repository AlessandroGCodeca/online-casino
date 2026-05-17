/* Keno Game — Pick numbers, match for prizes */
(function() {
    let bet = 100, picked = [], drawn = [], phase = 'pick', area;
    const GRID = 40, MAX_PICKS = 10;
    const PAYOUTS = { 0:0, 1:0, 2:1, 3:2, 4:5, 5:12, 6:25, 7:50, 8:100, 9:200, 10:500 };

    function init(gameArea) {
        area = gameArea;
        picked = []; drawn = []; phase = 'pick';
        renderUI();
    }

    function renderUI() {
        area.innerHTML = `
            <div style="text-align:center">
                <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:24px;margin-bottom:20px">
                    <div style="font-size:13px;color:#9ca3af;margin-bottom:12px">
                        Pick up to <strong style="color:#f0d060">${MAX_PICKS}</strong> numbers — Selected: <strong style="color:#d4a843">${picked.length}</strong>
                    </div>
                    <div id="keno-grid" style="display:grid;grid-template-columns:repeat(8,1fr);gap:6px;max-width:420px;margin:0 auto"></div>
                    ${drawn.length > 0 ? `<div style="margin-top:16px;font-size:13px;color:#9ca3af">Drawn: <strong style="color:#f0d060">${drawn.join(', ')}</strong></div>` : ''}
                </div>
                <div class="game-message" id="keno-msg">${phase === 'pick' ? 'Pick your numbers!' : ''}</div>
                <div class="game-controls">
                    <div class="bet-group">
                        <span class="bet-label">Bet</span>
                        <button class="bet-btn" onclick="Casino.games.keno._setBet(50)">$50</button>
                        <button class="bet-btn" onclick="Casino.games.keno._setBet(100)">$100</button>
                        <button class="bet-btn" onclick="Casino.games.keno._setBet(250)">$250</button>
                    </div>
                    ${phase === 'pick'
                        ? `<button class="action-btn secondary" onclick="Casino.games.keno._quickPick()" style="margin-right:8px">Quick Pick</button>
                           <button class="action-btn primary" onclick="Casino.games.keno._play()">PLAY — $${bet}</button>`
                        : `<button class="action-btn primary" onclick="Casino.games.keno._reset()">NEW GAME</button>`}
                </div>
                <div style="margin-top:16px;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;font-size:12px;color:#9ca3af">
                    <strong style="color:#d4a843">Payouts (${MAX_PICKS} picks):</strong>
                    ${Object.entries(PAYOUTS).filter(([k]) => parseInt(k) >= 2).map(([k,v]) => `${k} hits = ${v}x`).join(' | ')}
                </div>
            </div>`;
        renderGrid();
    }

    function renderGrid() {
        const g = document.getElementById('keno-grid');
        if (!g) return;
        for (let i = 1; i <= GRID; i++) {
            const btn = document.createElement('button');
            const isPicked = picked.includes(i);
            const isDrawn = drawn.includes(i);
            const isHit = isPicked && isDrawn;
            btn.textContent = i;
            btn.style.cssText = `padding:8px 4px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);font-size:14px;font-weight:700;cursor:pointer;transition:all 0.15s;font-family:Inter,sans-serif;`;
            if (isHit) {
                btn.style.background = 'rgba(34,197,94,0.3)';
                btn.style.borderColor = '#22c55e';
                btn.style.color = '#22c55e';
            } else if (isPicked) {
                btn.style.background = 'rgba(212,168,67,0.2)';
                btn.style.borderColor = '#d4a843';
                btn.style.color = '#f0d060';
            } else if (isDrawn) {
                btn.style.background = 'rgba(239,68,68,0.15)';
                btn.style.borderColor = '#ef4444';
                btn.style.color = '#ef4444';
            } else {
                btn.style.background = 'rgba(255,255,255,0.05)';
                btn.style.color = '#ccc';
            }
            if (phase === 'pick') {
                btn.addEventListener('click', () => togglePick(i));
            } else {
                btn.style.cursor = 'default';
            }
            g.appendChild(btn);
        }
    }

    function togglePick(n) {
        if (phase !== 'pick') return;
        const idx = picked.indexOf(n);
        if (idx >= 0) picked.splice(idx, 1);
        else if (picked.length < MAX_PICKS) picked.push(n);
        Casino.playSound('click');
        renderUI();
    }

    function quickPick() {
        picked = [];
        while (picked.length < MAX_PICKS) {
            const r = Math.floor(Math.random() * GRID) + 1;
            if (!picked.includes(r)) picked.push(r);
        }
        Casino.playSound('click');
        renderUI();
    }

    function setBet(b) { if (phase === 'pick') { bet = b; Casino.playSound('click'); renderUI(); } }

    function play() {
        if (picked.length === 0) { document.getElementById('keno-msg').textContent = 'Pick at least 1 number!'; return; }
        if (!Casino.placeBet(bet)) { document.getElementById('keno-msg').textContent = 'Not enough chips!'; return; }
        Casino.playSound('click');

        drawn = [];
        while (drawn.length < 10) {
            const r = Math.floor(Math.random() * GRID) + 1;
            if (!drawn.includes(r)) drawn.push(r);
        }
        phase = 'done';

        const hits = picked.filter(n => drawn.includes(n)).length;
        const adjustedPicks = picked.length;
        const payTable = getPayoutForPicks(adjustedPicks);
        const mult = payTable[hits] || 0;

        renderUI();
        const msg = document.getElementById('keno-msg');
        if (mult > 0) {
            const winnings = Math.floor(bet * mult);
            Casino.changeBalance(winnings);
            msg.textContent = `${hits} hits! Won $${winnings} (${mult}x)!`;
            msg.className = 'game-message win';
            Casino.playSound(mult >= 25 ? 'jackpot' : 'win');
            if (winnings >= 500) Casino.showWinEffect(winnings);
        } else {
            msg.textContent = `${hits} hit${hits !== 1 ? 's' : ''} — no win. Try again!`;
            msg.className = 'game-message lose';
            Casino.playSound('lose');
        }
    }

    function getPayoutForPicks(n) {
        const tables = {
            1: {1:2},
            2: {2:4},
            3: {2:2, 3:8},
            4: {2:1, 3:4, 4:15},
            5: {2:1, 3:2, 4:8, 5:30},
            6: {3:2, 4:5, 5:15, 6:50},
            7: {3:1, 4:3, 5:10, 6:30, 7:80},
            8: {4:2, 5:5, 6:20, 7:50, 8:150},
            9: {4:1, 5:4, 6:10, 7:40, 8:100, 9:300},
            10: {4:1, 5:2, 6:5, 7:25, 8:50, 9:200, 10:500}
        };
        return tables[n] || {};
    }

    function reset() { picked = []; drawn = []; phase = 'pick'; renderUI(); }
    function destroy() {}

    Casino.games.keno = { init, destroy, _play: play, _setBet: setBet, _quickPick: quickPick, _reset: reset };
})();
