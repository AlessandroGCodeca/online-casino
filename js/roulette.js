/* Roulette Game */
(function() {
    const RED_NUMS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    let bet = 100, selectedBet = null, spinning = false, area, currentRotation = 0;

    function isRed(n) { return RED_NUMS.includes(n); }

    function init(gameArea) {
        area = gameArea;
        area.innerHTML = `
            <div class="roulette-game">
                <div class="roulette-wheel-wrapper">
                    <div class="roulette-pointer">▼</div>
                    <div class="roulette-wheel" id="r-wheel"></div>
                    <div class="roulette-center" id="r-center">—</div>
                </div>
                <div class="roulette-result" id="r-result"></div>
                <div class="game-message" id="r-msg">Pick a bet type, then spin!</div>
                <div style="margin-bottom:16px">
                    <div class="bet-group" style="justify-content:center;margin-bottom:12px">
                        <span class="bet-label">Bet</span>
                        <button class="bet-btn" onclick="Casino.games.roulette._setBet(50)">$50</button>
                        <button class="bet-btn" onclick="Casino.games.roulette._setBet(100)">$100</button>
                        <button class="bet-btn" onclick="Casino.games.roulette._setBet(250)">$250</button>
                        <button class="bet-btn" onclick="Casino.games.roulette._setBet(500)">$500</button>
                    </div>
                </div>
                <div class="roulette-bets" id="r-bets">
                    <button class="roulette-bet-btn red-btn" data-bet="red">🔴 Red</button>
                    <button class="roulette-bet-btn black-btn" data-bet="black">⚫ Black</button>
                    <button class="roulette-bet-btn" data-bet="green" style="border-color:#22c55e">🟢 Zero</button>
                    <button class="roulette-bet-btn" data-bet="odd">Odd</button>
                    <button class="roulette-bet-btn" data-bet="even">Even</button>
                    <button class="roulette-bet-btn" data-bet="low">1-18</button>
                    <button class="roulette-bet-btn" data-bet="high">19-36</button>
                    <button class="roulette-bet-btn" data-bet="1st12">1st 12</button>
                    <button class="roulette-bet-btn" data-bet="2nd12">2nd 12</button>
                    <button class="roulette-bet-btn" data-bet="3rd12">3rd 12</button>
                </div>
                <div style="margin-top:16px"><button class="action-btn primary" id="r-spin-btn" onclick="Casino.games.roulette._spin()">SPIN — $${bet}</button></div>
            </div>`;
        document.querySelectorAll('.roulette-bet-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.roulette-bet-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedBet = btn.dataset.bet;
                Casino.playSound('click');
            });
        });
    }

    function setBet(b) { bet = b; document.getElementById('r-spin-btn').textContent = `SPIN — $${b}`; Casino.playSound('click'); }

    function spin() {
        if (spinning) return;
        if (!selectedBet) { msg('Select a bet type first!', ''); return; }
        if (!Casino.placeBet(bet)) { msg('Not enough chips!', 'lose'); return; }
        spinning = true;
        document.getElementById('r-spin-btn').disabled = true;
        msg('Spinning...', '');
        Casino.playSound('click');

        const result = Math.floor(Math.random() * 37);
        const extraSpins = 5 + Math.floor(Math.random() * 3);
        const targetAngle = (result / 37) * 360;
        const totalRotation = currentRotation + extraSpins * 360 + (360 - targetAngle);

        const wheel = document.getElementById('r-wheel');
        wheel.style.transition = 'transform 4s cubic-bezier(0.15, 0.6, 0.25, 1)';
        wheel.style.transform = `rotate(${totalRotation}deg)`;
        currentRotation = totalRotation;

        setTimeout(() => {
            const color = result === 0 ? 'green' : (isRed(result) ? 'red' : 'black-num');
            document.getElementById('r-center').textContent = result;
            document.getElementById('r-result').textContent = result;
            document.getElementById('r-result').className = 'roulette-result ' + color;

            let won = checkWin(result);
            if (won > 0) {
                const winnings = bet + won;
                Casino.changeBalance(winnings);
                msg(`${result} ${result===0?'🟢':isRed(result)?'🔴':'⚫'} — You win $${winnings}!`, 'win');
                Casino.playSound('win');
                if (winnings >= 500) Casino.showWinEffect(winnings);
            } else {
                msg(`${result} ${result===0?'🟢':isRed(result)?'🔴':'⚫'} — No win`, 'lose');
                Casino.playSound('lose');
            }
            spinning = false;
            document.getElementById('r-spin-btn').disabled = false;
        }, 4200);
    }

    function checkWin(n) {
        switch(selectedBet) {
            case 'red': return n > 0 && isRed(n) ? bet : 0;
            case 'black': return n > 0 && !isRed(n) ? bet : 0;
            case 'green': return n === 0 ? bet * 35 : 0;
            case 'odd': return n > 0 && n % 2 === 1 ? bet : 0;
            case 'even': return n > 0 && n % 2 === 0 ? bet : 0;
            case 'low': return n >= 1 && n <= 18 ? bet : 0;
            case 'high': return n >= 19 && n <= 36 ? bet : 0;
            case '1st12': return n >= 1 && n <= 12 ? bet * 2 : 0;
            case '2nd12': return n >= 13 && n <= 24 ? bet * 2 : 0;
            case '3rd12': return n >= 25 && n <= 36 ? bet * 2 : 0;
            default: return 0;
        }
    }

    function msg(text, type) {
        const el = document.getElementById('r-msg');
        el.textContent = text;
        el.className = 'game-message ' + (type || '');
    }

    function destroy() { spinning = false; }

    Casino.games.roulette = { init, destroy, _spin: spin, _setBet: setBet };
})();
