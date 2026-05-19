/* Hi-Lo Dice Game */
(function() {
    let bet = 100, target = 50, prediction = 'over', rolling = false, area;

    function init(gameArea) {
        area = gameArea;
        renderUI();
    }

    function renderUI() {
        area.innerHTML = `
            <div style="text-align:center">
                <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:32px;margin-bottom:20px;">
                    <div id="dice-result" style="font-size:80px;font-weight:900;color:#d4a843;margin-bottom:16px;font-variant-numeric:tabular-nums;min-height:100px;display:flex;align-items:center;justify-content:center;">🎲</div>
                    <div class="game-message" id="dice-msg">Set your target and predict Over or Under!</div>
                    <div style="margin:24px 0">
                        <div style="color:#9ca3af;font-size:13px;margin-bottom:8px;font-weight:600;letter-spacing:1px">TARGET: <span id="dice-target-val" style="color:#f0d060;font-size:18px">${target}</span></div>
                        <input type="range" id="dice-slider" min="5" max="95" value="${target}" style="width:80%;max-width:400px;accent-color:#d4a843;" oninput="Casino.games.dice._setTarget(this.value)">
                        <div style="display:flex;justify-content:space-between;max-width:400px;margin:4px auto 0;font-size:11px;color:#6b7280"><span>5</span><span>95</span></div>
                    </div>
                    <div style="display:flex;gap:12px;justify-content:center;margin:20px 0">
                        <button class="action-btn ${prediction==='under'?'success':'secondary'}" onclick="Casino.games.dice._setPrediction('under')" style="min-width:140px">
                            ⬇ UNDER ${target}<br><small style="opacity:0.7">${calcMultiplier('under')}x</small>
                        </button>
                        <button class="action-btn ${prediction==='over'?'success':'secondary'}" onclick="Casino.games.dice._setPrediction('over')" style="min-width:140px">
                            ⬆ OVER ${target}<br><small style="opacity:0.7">${calcMultiplier('over')}x</small>
                        </button>
                    </div>
                </div>
                <div class="game-controls">
                    <div class="bet-group">
                        <span class="bet-label">Bet</span>
                        <button class="bet-btn" onclick="Casino.games.dice._setBet(50)">$50</button>
                        <button class="bet-btn" onclick="Casino.games.dice._setBet(100)">$100</button>
                        <button class="bet-btn" onclick="Casino.games.dice._setBet(250)">$250</button>
                        <button class="bet-btn" onclick="Casino.games.dice._setBet(500)">$500</button>
                    </div>
                    <button class="action-btn primary" id="dice-roll-btn" onclick="Casino.games.dice._roll()">ROLL — $${bet}</button>
                </div>
            </div>`;
    }

    function calcMultiplier(pred) {
        const chance = pred === 'over' ? (100 - target) / 100 : target / 100;
        return chance > 0 ? (0.97 / chance).toFixed(2) : '0.00';
    }

    function setTarget(v) {
        target = parseInt(v);
        document.getElementById('dice-target-val').textContent = target;
        renderUI();
    }

    function setPrediction(p) { prediction = p; Casino.playSound('click'); renderUI(); }
    function setBet(b) { bet = b; Casino.playSound('click'); renderUI(); }

    function roll() {
        if (rolling) return;
        if (!Casino.placeBet(bet)) { document.getElementById('dice-msg').textContent = 'Not enough chips!'; return; }
        rolling = true;
        document.getElementById('dice-roll-btn').disabled = true;
        Casino.playSound('click');

        const result = Math.floor(Math.random() * 100) + 1;
        let count = 0;
        const interval = setInterval(() => {
            document.getElementById('dice-result').textContent = Math.floor(Math.random() * 100) + 1;
            count++;
            if (count > 15) {
                clearInterval(interval);
                document.getElementById('dice-result').textContent = result;
                checkResult(result);
                rolling = false;
                document.getElementById('dice-roll-btn').disabled = false;
            }
        }, 60);
    }

    function checkResult(result) {
        const won = (prediction === 'over' && result > target) || (prediction === 'under' && result < target);
        const msg = document.getElementById('dice-msg');
        const resEl = document.getElementById('dice-result');
        if (won) {
            const mult = parseFloat(calcMultiplier(prediction));
            const winnings = Math.floor(bet * mult);
            Casino.changeBalance(winnings);
            msg.textContent = `🎉 Rolled ${result} — ${prediction.toUpperCase()} ${target}! Won $${winnings}!`;
            msg.className = 'game-message win';
            resEl.style.color = '#22c55e';
            Casino.playSound(mult >= 5 ? 'jackpot' : 'win');
            if (winnings >= 500) Casino.showWinEffect(winnings, { bet, particles: ['🎲','💰','✨','🍀','💎'], accent: '#06b6d4', themeLabel: 'Hi-Lo Dice' });
        } else {
            msg.textContent = `Rolled ${result} — not ${prediction} ${target}. You lose!`;
            msg.className = 'game-message lose';
            resEl.style.color = '#ef4444';
            Casino.playSound('lose');
        }
        setTimeout(() => { resEl.style.color = '#d4a843'; }, 1500);
    }

    function destroy() { rolling = false; }

    Casino.games.dice = { init, destroy, _roll: roll, _setBet: setBet, _setTarget: setTarget, _setPrediction: setPrediction };
})();
