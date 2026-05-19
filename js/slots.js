/* Slot Machine Game — Upgraded with 3x3 grid, 5 paylines, wilds, and bonus rounds */
(function() {
    const SYMBOLS = ['🍒','🍋','🍊','🔔','⭐','💎','7️⃣','🃏'];
    const PAYOUTS = { '🍒': 5, '🍋': 8, '🍊': 10, '🔔': 15, '💎': 50, '7️⃣': 100, '🃏': 200 };
    // ⭐ is Scatter/Bonus, 🃏 is Wild

    let bet = 100, spinning = false, area;
    let freeSpins = 0, totalFreeSpinWin = 0;

    function init(gameArea) {
        area = gameArea;
        renderUI();
        resetReels();
    }

    function renderUI() {
        area.innerHTML = `
            <div class="slots-machine" style="position:relative;overflow:hidden;">
                <div class="slots-title">🎰 MEGA JACKPOT 🎰</div>
                <div style="position:relative; max-width:340px; margin:0 auto; background:rgba(0,0,0,0.4); padding:10px; border-radius:12px; border:1px solid var(--glass-border);">
                    <div id="payline-overlay" style="position:absolute; inset:0; pointer-events:none; z-index:10;"></div>
                    <div class="reels-container" style="gap:8px; margin-bottom:0; height:240px; overflow:hidden;">
                        <div class="reel" id="reel-0" style="height:240px; width:100px;"><div class="reel-strip" id="strip-0"></div></div>
                        <div class="reel" id="reel-1" style="height:240px; width:100px;"><div class="reel-strip" id="strip-1"></div></div>
                        <div class="reel" id="reel-2" style="height:240px; width:100px;"><div class="reel-strip" id="strip-2"></div></div>
                    </div>
                </div>
                <div class="game-message" id="slots-msg" style="min-height:70px; margin-top:16px;">Spin to win on 5 paylines!</div>
                
                <div class="game-controls">
                    <div class="bet-group">
                        <span class="bet-label">Bet</span>
                        <button class="bet-btn" onclick="Casino.games.slots._setBet(50)">$50</button>
                        <button class="bet-btn" onclick="Casino.games.slots._setBet(100)">$100</button>
                        <button class="bet-btn" onclick="Casino.games.slots._setBet(250)">$250</button>
                        <button class="bet-btn" onclick="Casino.games.slots._setBet(500)">$500</button>
                    </div>
                    <button class="action-btn primary" id="spin-btn" onclick="Casino.games.slots._spin()">SPIN — $${bet}</button>
                </div>
                
                <div style="margin-top:16px;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;font-size:12px;color:#9ca3af;">
                    <div style="display:flex; justify-content:center; gap:20px; margin-bottom:8px;">
                        <span>🃏 <strong>Wild</strong> (Substitutes all but ⭐)</span>
                        <span>⭐×3 = <strong>5 Free Spins (2x)</strong></span>
                    </div>
                    <strong style="color:#d4a843;">Payouts:</strong>
                    ${['🍒','🍋','🍊','🔔','💎','7️⃣','🃏'].map(s => `${s}×3 = ${PAYOUTS[s]}x`).join(' | ')}
                </div>
            </div>`;
    }

    function generateSymbol() {
        // Weighted probability for symbols
        const r = Math.random();
        if (r < 0.02) return '🃏'; // 2% Wild
        if (r < 0.05) return '7️⃣'; // 3%
        if (r < 0.10) return '⭐'; // 5% Bonus
        if (r < 0.18) return '💎'; // 8%
        if (r < 0.30) return '🔔'; // 12%
        if (r < 0.50) return '🍊'; // 20%
        if (r < 0.75) return '🍋'; // 25%
        return '🍒'; // 25%
    }

    function resetReels() {
        for (let i = 0; i < 3; i++) {
            const strip = document.getElementById('strip-' + i);
            strip.style.transition = 'none';
            strip.style.transform = 'translateY(0)';
            let html = '';
            for(let j=0; j<3; j++) html += `<div class="reel-symbol" style="height:80px; font-size:48px;">${generateSymbol()}</div>`;
            strip.innerHTML = html;
        }
    }

    function setBet(b) {
        if (spinning || freeSpins > 0) return;
        bet = b;
        document.getElementById('spin-btn').textContent = `SPIN — $${bet}`;
        Casino.playSound('click');
    }

    function spin() {
        if (spinning) return;
        
        if (freeSpins > 0) {
            // Free spin mode
            document.getElementById('spin-btn').disabled = true;
            document.getElementById('spin-btn').textContent = `FREE SPINS (${freeSpins})`;
        } else {
            if (!Casino.placeBet(bet)) {
                document.getElementById('slots-msg').textContent = 'Not enough chips!';
                document.getElementById('slots-msg').className = 'game-message lose';
                return;
            }
            totalFreeSpinWin = 0;
            document.getElementById('spin-btn').disabled = true;
            document.getElementById('spin-btn').textContent = 'SPINNING...';
        }

        spinning = true;
        document.getElementById('payline-overlay').innerHTML = ''; // clear previous lines
        document.getElementById('slots-msg').textContent = 'Good luck...';
        document.getElementById('slots-msg').className = 'game-message';
        Casino.playSound('click');

        // Generate 3x3 result grid
        const grid = [
            [generateSymbol(), generateSymbol(), generateSymbol()], // Top row
            [generateSymbol(), generateSymbol(), generateSymbol()], // Middle row
            [generateSymbol(), generateSymbol(), generateSymbol()]  // Bottom row
        ];

        for (let i = 0; i < 3; i++) {
            const strip = document.getElementById('strip-' + i);
            let html = '';
            const spinCount = 12 + i * 4; // Add extra spins per reel for stagger effect
            
            // Add filler symbols for the spin animation
            for (let j = 0; j < spinCount; j++) {
                html += `<div class="reel-symbol" style="height:80px; font-size:48px;">${generateSymbol()}</div>`;
            }
            
            // Add the 3 final symbols
            html += `<div class="reel-symbol" style="height:80px; font-size:48px;">${grid[0][i]}</div>`;
            html += `<div class="reel-symbol" style="height:80px; font-size:48px;">${grid[1][i]}</div>`;
            html += `<div class="reel-symbol" style="height:80px; font-size:48px;">${grid[2][i]}</div>`;
            
            strip.innerHTML = html;
            strip.style.transition = 'none';
            strip.style.transform = 'translateY(0)';
            void strip.offsetWidth; // Force reflow

            const totalOffset = -(spinCount) * 80;

            setTimeout(() => {
                strip.style.transition = `transform ${1.5 + i * 0.5}s cubic-bezier(0.15, 0.8, 0.3, 1)`; // Easing out
                strip.style.transform = `translateY(${totalOffset}px)`;
                
                // Sound effect for reel stop
                setTimeout(() => Casino.playSound('click'), (1.5 + i * 0.5) * 1000);
            }, 50);
        }

        // Wait for last reel to stop
        setTimeout(() => {
            evaluateGrid(grid);
        }, 1000 + 2 * 500 + 700); // Base + 2*inc + padding
    }

    function evaluateGrid(grid) {
        // Paylines: Top, Middle, Bottom, Diagonal Down, Diagonal Up
        const lines = [
            { id: 1, pos: [ [0,0], [0,1], [0,2] ], css: 'top: 40px;' }, // Top
            { id: 2, pos: [ [1,0], [1,1], [1,2] ], css: 'top: 120px;' }, // Mid
            { id: 3, pos: [ [2,0], [2,1], [2,2] ], css: 'top: 200px;' }, // Bot
            { id: 4, pos: [ [0,0], [1,1], [2,2] ], css: 'top: 120px; transform: rotate(38deg); transform-origin: center;' }, // Diag down
            { id: 5, pos: [ [2,0], [1,1], [0,2] ], css: 'top: 120px; transform: rotate(-38deg); transform-origin: center;' } // Diag up
        ];

        let totalWin = 0;
        let winningLines = [];
        let scatters = 0;

        // Count scatters anywhere
        for(let r=0; r<3; r++) {
            for(let c=0; c<3; c++) {
                if (grid[r][c] === '⭐') scatters++;
            }
        }

        const isMatch = (s1, s2) => s1 === s2 || s1 === '🃏' || s2 === '🃏';

        lines.forEach(line => {
            const s0 = grid[line.pos[0][0]][line.pos[0][1]];
            const s1 = grid[line.pos[1][0]][line.pos[1][1]];
            const s2 = grid[line.pos[2][0]][line.pos[2][1]];

            // Scatters don't pay on lines
            if (s0 === '⭐' || s1 === '⭐' || s2 === '⭐') return;

            // Determine base symbol (ignore wild for matching)
            let baseSymbol = s0;
            if (baseSymbol === '🃏') baseSymbol = s1;
            if (baseSymbol === '🃏') baseSymbol = s2;
            
            // If all 3 are wilds, treat as wild
            if (s0 === '🃏' && s1 === '🃏' && s2 === '🃏') baseSymbol = '🃏';

            if (isMatch(baseSymbol, s0) && isMatch(baseSymbol, s1) && isMatch(baseSymbol, s2)) {
                let win = bet * (PAYOUTS[baseSymbol] || 5);
                if (freeSpins > 0) win *= 2; // 2x multiplier during free spins
                totalWin += win;
                winningLines.push(line);
            }
        });

        const msgEl = document.getElementById('slots-msg');
        
        if (scatters >= 3) {
            freeSpins += 5;
            msgEl.textContent = `🎰 5 FREE SPINS WON! 🎰`;
            msgEl.className = 'game-message win';
            Casino.playSound('jackpot');
            drawLines(winningLines); // still draw standard lines if any
            
            setTimeout(() => {
                spinning = false;
                spin(); // Auto-start free spin
            }, 2500);
            return;
        }

        if (totalWin > 0) {
            if (freeSpins > 0) totalFreeSpinWin += totalWin;
            Casino.changeBalance(totalWin);
            msgEl.textContent = freeSpins > 0 ? `Free Spin Win: $${totalWin}!` : `Won $${totalWin.toLocaleString()} on ${winningLines.length} line(s)!`;
            msgEl.className = 'game-message win';
            drawLines(winningLines);
            if (totalWin >= bet * 25) { Casino.showWinEffect(totalWin, { bet, particles: ['🎰','💎','🍒','7️⃣','💰','✨','🍋','⭐'], accent: '#e74c3c', themeLabel: 'Mega Jackpot' }); Casino.playSound('jackpot'); }
            else Casino.playSound('win');
        } else {
            msgEl.textContent = freeSpins > 0 ? 'No win this spin.' : 'No luck — spin again!';
            msgEl.className = 'game-message lose';
            Casino.playSound('lose');
        }

        setTimeout(() => {
            spinning = false;
            if (freeSpins > 0) {
                freeSpins--;
                if (freeSpins > 0) {
                    spin(); // Next free spin
                } else {
                    // Free spins ended
                    msgEl.textContent = `Bonus Round Over! Total Won: $${totalFreeSpinWin}`;
                    document.getElementById('spin-btn').disabled = false;
                    document.getElementById('spin-btn').textContent = `SPIN — $${bet}`;
                }
            } else {
                document.getElementById('spin-btn').disabled = false;
                document.getElementById('spin-btn').textContent = `SPIN — $${bet}`;
            }
        }, 1500);
    }

    function drawLines(lines) {
        const overlay = document.getElementById('payline-overlay');
        overlay.innerHTML = '';
        lines.forEach((line, index) => {
            setTimeout(() => {
                const div = document.createElement('div');
                div.style.cssText = `position:absolute; left:-10px; right:-10px; height:4px; background:var(--gold-light); box-shadow:0 0 10px var(--gold-light), 0 0 20px var(--gold-light); z-index:10; animation:flashLine 0.5s infinite alternate; ${line.css}`;
                overlay.appendChild(div);
            }, index * 300); // stagger line drawing
        });
        
        // Add animation keyframes if not exists
        if (!document.getElementById('slot-anims')) {
            const style = document.createElement('style');
            style.id = 'slot-anims';
            style.textContent = `@keyframes flashLine { from { opacity: 0.5; } to { opacity: 1; filter: brightness(1.5); } }`;
            document.head.appendChild(style);
        }
    }

    function destroy() { spinning = false; freeSpins = 0; }

    Casino.games.slots = { init, destroy, _spin: spin, _setBet: setBet };
})();
