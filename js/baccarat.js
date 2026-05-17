/* Baccarat Game */
(function() {
    let bet = 100, betType = 'player', area;

    function init(gameArea) {
        area = gameArea;
        renderUI();
    }

    function renderUI() {
        area.innerHTML = `
            <div style="text-align:center">
                <div style="background:linear-gradient(180deg,#1a2744,#0f1b33);border:2px solid #d4a843;border-radius:20px;padding:30px 20px;margin-bottom:20px;box-shadow:inset 0 0 60px rgba(0,0,0,0.3)">
                    <div style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:20px">
                        <div>
                            <div class="bj-label">Player</div>
                            <div class="card-hand" id="bac-player"></div>
                            <div class="bj-score" id="bac-player-score">—</div>
                        </div>
                        <div style="display:flex;align-items:center;font-size:24px;color:#d4a843;font-weight:800">VS</div>
                        <div>
                            <div class="bj-label">Banker</div>
                            <div class="card-hand" id="bac-banker"></div>
                            <div class="bj-score" id="bac-banker-score">—</div>
                        </div>
                    </div>
                </div>
                <div class="game-message" id="bac-msg">Choose Player, Banker, or Tie — then deal!</div>
                <div style="display:flex;gap:10px;justify-content:center;margin:16px 0;flex-wrap:wrap">
                    <button class="action-btn ${betType==='player'?'success':'secondary'}" onclick="Casino.games.baccarat._setBetType('player')">Player<br><small style="opacity:0.7">1:1</small></button>
                    <button class="action-btn ${betType==='banker'?'success':'secondary'}" onclick="Casino.games.baccarat._setBetType('banker')">Banker<br><small style="opacity:0.7">0.95:1</small></button>
                    <button class="action-btn ${betType==='tie'?'success':'secondary'}" onclick="Casino.games.baccarat._setBetType('tie')">Tie<br><small style="opacity:0.7">8:1</small></button>
                </div>
                <div class="game-controls">
                    <div class="bet-group">
                        <span class="bet-label">Bet</span>
                        <button class="bet-btn" onclick="Casino.games.baccarat._setBet(50)">$50</button>
                        <button class="bet-btn" onclick="Casino.games.baccarat._setBet(100)">$100</button>
                        <button class="bet-btn" onclick="Casino.games.baccarat._setBet(250)">$250</button>
                        <button class="bet-btn" onclick="Casino.games.baccarat._setBet(500)">$500</button>
                    </div>
                    <button class="action-btn primary" onclick="Casino.games.baccarat._deal()">DEAL — $${bet}</button>
                </div>
            </div>`;
    }

    function setBet(b) { bet = b; Casino.playSound('click'); renderUI(); }
    function setBetType(t) { betType = t; Casino.playSound('click'); renderUI(); }

    function baccaratValue(cards) {
        let total = 0;
        cards.forEach(c => {
            let v = c.value;
            if (v >= 10) v = 0;
            if (c.display === 'A') v = 1;
            total += v;
        });
        return total % 10;
    }

    function deal() {
        if (!Casino.placeBet(bet)) { document.getElementById('bac-msg').textContent = 'Not enough chips!'; return; }
        Casino.playSound('click');

        const deck = makeBacDeck();
        let player = [deck.pop(), deck.pop()];
        let banker = [deck.pop(), deck.pop()];
        let pScore = baccaratValue(player);
        let bScore = baccaratValue(banker);

        // Natural check
        if (pScore < 8 && bScore < 8) {
            // Player third card rule
            if (pScore <= 5) {
                player.push(deck.pop());
                pScore = baccaratValue(player);
                const pThird = player[2].value >= 10 ? 0 : (player[2].display === 'A' ? 1 : player[2].value);
                // Banker third card rules
                if (bScore <= 2) banker.push(deck.pop());
                else if (bScore === 3 && pThird !== 8) banker.push(deck.pop());
                else if (bScore === 4 && pThird >= 2 && pThird <= 7) banker.push(deck.pop());
                else if (bScore === 5 && pThird >= 4 && pThird <= 7) banker.push(deck.pop());
                else if (bScore === 6 && pThird >= 6 && pThird <= 7) banker.push(deck.pop());
            } else {
                if (bScore <= 5) banker.push(deck.pop());
            }
        }

        pScore = baccaratValue(player);
        bScore = baccaratValue(banker);

        // Render cards
        const pe = document.getElementById('bac-player');
        const be = document.getElementById('bac-banker');
        pe.innerHTML = ''; be.innerHTML = '';
        player.forEach(c => pe.appendChild(Casino.createCardElement(c, false)));
        banker.forEach(c => be.appendChild(Casino.createCardElement(c, false)));
        document.getElementById('bac-player-score').textContent = pScore;
        document.getElementById('bac-banker-score').textContent = bScore;

        // Determine winner
        let winner, msg;
        if (pScore > bScore) { winner = 'player'; msg = `Player wins! ${pScore} vs ${bScore}`; }
        else if (bScore > pScore) { winner = 'banker'; msg = `Banker wins! ${bScore} vs ${pScore}`; }
        else { winner = 'tie'; msg = `Tie! Both ${pScore}`; }

        const msgEl = document.getElementById('bac-msg');
        if (betType === winner) {
            let winnings;
            if (betType === 'player') winnings = bet * 2;
            else if (betType === 'banker') winnings = Math.floor(bet * 1.95);
            else winnings = bet * 9;
            Casino.changeBalance(winnings);
            msgEl.textContent = `${msg} — You win $${winnings}!`;
            msgEl.className = 'game-message win';
            Casino.playSound(betType === 'tie' ? 'jackpot' : 'win');
            if (winnings >= 500) Casino.showWinEffect(winnings);
        } else {
            msgEl.textContent = `${msg} — You lose.`;
            msgEl.className = 'game-message lose';
            Casino.playSound('lose');
        }
    }

    function makeBacDeck() {
        const suits = ['♠','♥','♦','♣'];
        const vals = [{v:1,d:'A'},{v:2,d:'2'},{v:3,d:'3'},{v:4,d:'4'},{v:5,d:'5'},{v:6,d:'6'},{v:7,d:'7'},{v:8,d:'8'},{v:9,d:'9'},{v:10,d:'10'},{v:10,d:'J'},{v:10,d:'Q'},{v:10,d:'K'}];
        const deck = [];
        for (let d = 0; d < 6; d++) suits.forEach(s => vals.forEach(v => deck.push({ value: v.v, display: v.d, suit: s, rank: 0 })));
        return Casino.shuffle(deck);
    }

    function destroy() {}

    Casino.games.baccarat = { init, destroy, _deal: deal, _setBet: setBet, _setBetType: setBetType };
})();
