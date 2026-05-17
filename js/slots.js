/* Slot Machine Game */
(function() {
    const SYMBOLS = ['🍒','🍋','🍊','🔔','⭐','💎','7️⃣'];
    const PAYOUTS = { '🍒': 5, '🍋': 8, '🍊': 10, '🔔': 15, '⭐': 25, '💎': 50, '7️⃣': 100 };
    let bet = 100, spinning = false, area;

    function init(gameArea) {
        area = gameArea;
        area.innerHTML = `
            <div class="slots-machine">
                <div class="slots-title">🎰 MEGA JACKPOT 🎰</div>
                <div style="position:relative">
                    <div class="reels-container">
                        <div class="reel" id="reel-0"><div class="reel-strip" id="strip-0"></div></div>
                        <div class="reel" id="reel-1"><div class="reel-strip" id="strip-1"></div></div>
                        <div class="reel" id="reel-2"><div class="reel-strip" id="strip-2"></div></div>
                    </div>
                </div>
                <div class="game-message" id="slots-msg">Spin to win!</div>
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
                    <strong style="color:#d4a843;">Payouts:</strong>
                    ${SYMBOLS.map(s => `${s}×3 = ${PAYOUTS[s]}x`).join(' &nbsp;|&nbsp; ')}
                    <br>Any 2 matching from left = 2x
                </div>
            </div>`;
        resetReels();
    }

    function resetReels() {
        for (let i = 0; i < 3; i++) {
            const strip = document.getElementById('strip-' + i);
            strip.style.transition = 'none';
            strip.style.transform = 'translateY(0)';
            strip.innerHTML = `<div class="reel-symbol">${SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)]}</div>`;
        }
    }

    function setBet(b) {
        bet = b;
        const btn = document.getElementById('spin-btn');
        if (btn) btn.textContent = `SPIN — $${bet}`;
        Casino.playSound('click');
    }

    function spin() {
        if (spinning) return;
        if (!Casino.placeBet(bet)) {
            document.getElementById('slots-msg').textContent = 'Not enough chips!';
            document.getElementById('slots-msg').className = 'game-message lose';
            return;
        }
        spinning = true;
        document.getElementById('spin-btn').disabled = true;
        document.getElementById('slots-msg').textContent = 'Spinning...';
        document.getElementById('slots-msg').className = 'game-message';
        Casino.playSound('click');

        const results = [0,1,2].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);

        for (let i = 0; i < 3; i++) {
            const strip = document.getElementById('strip-' + i);
            let html = '';
            const count = 8 + i * 3;
            for (let j = 0; j < count; j++) html += `<div class="reel-symbol">${SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)]}</div>`;
            html += `<div class="reel-symbol">${results[i]}</div>`;
            strip.innerHTML = html;
            strip.style.transition = 'none';
            strip.style.transform = 'translateY(0)';
            void strip.offsetWidth;

            const reelEl = document.getElementById('reel-' + i);
            const symbolH = reelEl.offsetHeight || 120;
            const totalOffset = -(count) * symbolH;

            setTimeout(() => {
                strip.style.transition = `transform ${1 + i * 0.4}s cubic-bezier(0.15, 0.8, 0.3, 1)`;
                strip.style.transform = `translateY(${totalOffset}px)`;
            }, 50);
        }

        setTimeout(() => {
            checkResult(results);
            spinning = false;
            document.getElementById('spin-btn').disabled = false;
        }, 1000 + 2 * 400 + 500);
    }

    function checkResult(r) {
        let multiplier = 0;
        let msg = '';
        if (r[0] === r[1] && r[1] === r[2]) {
            multiplier = PAYOUTS[r[0]] || 10;
            msg = r[0] === '7️⃣' ? '🎉 JACKPOT!!! 🎉' : `🎉 Triple ${r[0]}! ${multiplier}x!`;
        } else if (r[0] === r[1]) {
            multiplier = 2;
            msg = `Double ${r[0]}! 2x!`;
        } else {
            msg = 'No luck — spin again!';
        }
        const msgEl = document.getElementById('slots-msg');
        if (multiplier > 0) {
            const winnings = bet * multiplier;
            Casino.changeBalance(winnings);
            msgEl.textContent = `${msg} Won $${winnings.toLocaleString()}!`;
            msgEl.className = 'game-message win';
            if (multiplier >= 25) { Casino.showWinEffect(winnings); Casino.playSound('jackpot'); }
            else Casino.playSound('win');
        } else {
            msgEl.textContent = msg;
            msgEl.className = 'game-message lose';
            Casino.playSound('lose');
        }
    }

    function destroy() { spinning = false; }

    Casino.games.slots = { init, destroy, _spin: spin, _setBet: setBet };
})();
