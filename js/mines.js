/* Mines Game — Click tiles, avoid mines, cash out anytime */
(function() {
    let bet = 100, mineCount = 5, grid = [], revealed = [], mines = [], gameActive = false, currentMultiplier = 1, area;
    const SIZE = 5;

    function init(gameArea) {
        area = gameArea;
        render();
    }

    function render() {
        area.innerHTML = `
            <div style="text-align:center">
                <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:24px;margin-bottom:20px;">
                    <div style="display:flex;justify-content:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
                        <div style="background:rgba(255,255,255,0.05);padding:8px 16px;border-radius:8px;font-size:13px;color:#9ca3af;">
                            Multiplier: <strong style="color:#22c55e;font-size:18px" id="mi-mult">${currentMultiplier.toFixed(2)}x</strong>
                        </div>
                        <div style="background:rgba(255,255,255,0.05);padding:8px 16px;border-radius:8px;font-size:13px;color:#9ca3af;">
                            Potential: <strong style="color:#f0d060;font-size:18px" id="mi-pot">$${Math.floor(bet * currentMultiplier)}</strong>
                        </div>
                    </div>
                    <div id="mi-grid" style="display:grid;grid-template-columns:repeat(${SIZE},1fr);gap:6px;max-width:320px;margin:0 auto;"></div>
                </div>
                <div class="game-message" id="mi-msg" style="min-height:28px;">${gameActive ? 'Click tiles to reveal! Cash out anytime.' : 'Set mines and start!'}</div>
                <div class="game-controls" style="flex-wrap:wrap; justify-content:center;">
                    <div class="bet-group" style="width:100%; justify-content:center; margin-bottom:8px;">
                        <span class="bet-label">Bet</span>
                        <button class="bet-btn" onclick="Casino.games.mines._setBet(50)">$50</button>
                        <button class="bet-btn" onclick="Casino.games.mines._setBet(100)">$100</button>
                        <button class="bet-btn" onclick="Casino.games.mines._setBet(250)">$250</button>
                        <button class="bet-btn" onclick="Casino.games.mines._setBet(500)">$500</button>
                    </div>
                    <div class="bet-group" style="width:100%; justify-content:center; margin-bottom:12px;">
                        <span class="bet-label">Mines</span>
                        <button class="bet-btn ${mineCount===3?'active':''}" style="${mineCount===3?'background:var(--gold);color:#000;':''}" onclick="Casino.games.mines._setMines(3)">3 (Easy)</button>
                        <button class="bet-btn ${mineCount===5?'active':''}" style="${mineCount===5?'background:var(--gold);color:#000;':''}" onclick="Casino.games.mines._setMines(5)">5 (Med)</button>
                        <button class="bet-btn ${mineCount===10?'active':''}" style="${mineCount===10?'background:var(--gold);color:#000;':''}" onclick="Casino.games.mines._setMines(10)">10 (Hard)</button>
                        <button class="bet-btn ${mineCount===15?'active':''}" style="${mineCount===15?'background:var(--gold);color:#000;':''}" onclick="Casino.games.mines._setMines(15)">15 (Extr)</button>
                    </div>
                    ${gameActive
                        ? '<button class="action-btn success" onclick="Casino.games.mines._cashOut()" style="width:100%; max-width:200px;">CASH OUT</button>'
                        : `<button class="action-btn primary" onclick="Casino.games.mines._start()" style="width:100%; max-width:200px;">START — $${bet}</button>`}
                </div>
            </div>`;
        renderGrid();
    }

    function renderGrid() {
        const g = document.getElementById('mi-grid');
        if (!g) return;
        g.innerHTML = '';
        for (let i = 0; i < SIZE * SIZE; i++) {
            const cell = document.createElement('button');
            cell.style.cssText = 'width:100%;aspect-ratio:1;border-radius:10px;border:1px solid rgba(255,255,255,0.1);font-size:24px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;';
            
            if (revealed[i]) {
                if (mines.includes(i)) {
                    cell.style.background = 'rgba(239,68,68,0.3)';
                    cell.style.borderColor = '#ef4444';
                    cell.textContent = '💣';
                    cell.style.cursor = 'default';
                } else {
                    cell.style.background = 'rgba(34,197,94,0.15)';
                    cell.style.borderColor = '#22c55e';
                    cell.textContent = '💎';
                    cell.style.cursor = 'default';
                }
            } else if (!gameActive && mines.length > 0) {
                // Game over reveal
                if (mines.includes(i)) {
                    cell.style.background = 'rgba(239,68,68,0.15)';
                    cell.textContent = '💣';
                    cell.style.opacity = '0.7';
                    cell.style.cursor = 'default';
                } else {
                    cell.style.background = 'rgba(255,255,255,0.02)';
                    cell.textContent = '💎';
                    cell.style.opacity = '0.3'; // Dim unrevealed safe tiles
                    cell.style.cursor = 'default';
                }
            } else {
                cell.style.background = 'rgba(255,255,255,0.05)';
                cell.addEventListener('mouseenter', () => { if (gameActive) cell.style.background = 'rgba(255,255,255,0.12)'; });
                cell.addEventListener('mouseleave', () => { if (gameActive) cell.style.background = 'rgba(255,255,255,0.05)'; });
                const idx = i;
                cell.addEventListener('click', () => revealTile(idx));
            }
            g.appendChild(cell);
        }
    }

    function setBet(b) { if (!gameActive) { bet = b; render(); Casino.playSound('click'); } }
    function setMines(m) { if (!gameActive) { mineCount = m; render(); Casino.playSound('click'); } }

    function start() {
        if (gameActive) return;
        if (!Casino.placeBet(bet)) { 
            const msg = document.getElementById('mi-msg');
            msg.textContent = 'Not enough chips!'; 
            msg.className = 'game-message lose';
            return; 
        }
        gameActive = true;
        currentMultiplier = 1;
        revealed = new Array(SIZE * SIZE).fill(false);
        mines = [];
        while (mines.length < mineCount) {
            const r = Math.floor(Math.random() * SIZE * SIZE);
            if (!mines.includes(r)) mines.push(r);
        }
        Casino.playSound('click');
        render();
    }

    function revealTile(idx) {
        if (!gameActive || revealed[idx]) return;
        revealed[idx] = true;
        
        if (mines.includes(idx)) {
            // Hit a mine
            gameActive = false;
            // The render loop will handle showing unrevealed mines/gems with opacity
            render();
            
            const msg = document.getElementById('mi-msg');
            msg.textContent = '💣 BOOM! You hit a mine!';
            msg.className = 'game-message lose';
            Casino.playSound('lose');
        } else {
            // Safe
            const safe = SIZE * SIZE - mineCount;
            const revealedCount = revealed.filter((r, i) => r && !mines.includes(i)).length;
            currentMultiplier = calcMultiplier(revealedCount, safe, mineCount);
            
            // Pitch goes up slightly with each pick
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.value = 600 + (revealedCount * 50);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
                osc.start(); osc.stop(ctx.currentTime + 0.1);
            } catch(e) { Casino.playSound('click'); }
            
            if (revealedCount >= safe) { 
                cashOut(); // Auto cash out if cleared
                return; 
            }
            render();
        }
    }

    function calcMultiplier(picks, safe, mines) {
        let mult = 1;
        for (let i = 0; i < picks; i++) {
            mult *= (safe + mines - i) / (safe - i);
        }
        return Math.round(mult * 100) / 100;
    }

    function cashOut() {
        if (!gameActive) return;
        gameActive = false;
        
        const winnings = Math.floor(bet * currentMultiplier);
        Casino.changeBalance(winnings);
        render(); // Renders the end-game board state
        
        const msg = document.getElementById('mi-msg');
        msg.textContent = `Cashed out at ${currentMultiplier.toFixed(2)}x — Won $${winnings.toLocaleString()}!`;
        msg.className = 'game-message win';
        
        Casino.playSound(currentMultiplier >= 5 ? 'jackpot' : 'win');
        if (winnings >= 500) Casino.showWinEffect(winnings);
    }

    function destroy() { gameActive = false; }

    Casino.games.mines = { init, destroy, _start: start, _cashOut: cashOut, _setBet: setBet, _setMines: setMines };
})();
