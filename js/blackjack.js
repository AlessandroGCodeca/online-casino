/* Blackjack Game */
(function() {
    let deck, playerHand, dealerHand, bet, gameOver, area;
    const DEFAULT_BET = 100;

    function init(gameArea) {
        area = gameArea;
        bet = DEFAULT_BET;
        area.innerHTML = `
            <div class="blackjack-table">
                <div class="bj-section"><div class="bj-label">Dealer</div><div class="card-hand" id="bj-dealer"></div><div class="bj-score" id="bj-dealer-score"></div></div>
                <hr class="bj-divider">
                <div class="bj-section"><div class="bj-label">You</div><div class="card-hand" id="bj-player"></div><div class="bj-score" id="bj-player-score"></div></div>
                <div class="game-message" id="bj-msg">Place your bet and deal!</div>
                <div class="bj-actions" id="bj-actions">
                    <button class="action-btn secondary" onclick="Casino.games.blackjack._setBet(50)">$50</button>
                    <button class="action-btn secondary" onclick="Casino.games.blackjack._setBet(100)">$100</button>
                    <button class="action-btn secondary" onclick="Casino.games.blackjack._setBet(250)">$250</button>
                    <button class="action-btn secondary" onclick="Casino.games.blackjack._setBet(500)">$500</button>
                </div>
                <div class="bj-actions"><button class="action-btn primary" id="bj-deal-btn" onclick="Casino.games.blackjack._deal()">DEAL — $${bet}</button></div>
            </div>`;
    }

    function setBet(b) { bet = b; const btn = document.getElementById('bj-deal-btn'); if(btn) btn.textContent = `DEAL — $${b}`; Casino.playSound('click'); }

    function deal() {
        if (!Casino.placeBet(bet)) { msg('Not enough chips!', 'lose'); return; }
        deck = Casino.createDeck();
        playerHand = [deck.pop(), deck.pop()];
        dealerHand = [deck.pop(), deck.pop()];
        gameOver = false;
        render(true);
        const ps = handValue(playerHand);
        if (ps === 21) { endRound(); return; }
        showActions();
        msg('Hit or Stand?', '');
    }

    function showActions() {
        const acts = document.getElementById('bj-actions');
        const canDouble = playerHand.length === 2 && Casino.balance >= bet;
        acts.innerHTML = `
            <button class="action-btn primary" onclick="Casino.games.blackjack._hit()">Hit</button>
            <button class="action-btn danger" onclick="Casino.games.blackjack._stand()">Stand</button>
            ${canDouble ? '<button class="action-btn secondary" onclick="Casino.games.blackjack._double()">Double</button>' : ''}`;
    }

    function hit() {
        if (gameOver) return;
        playerHand.push(deck.pop());
        Casino.playSound('click');
        render(true);
        if (handValue(playerHand) > 21) endRound();
        else if (handValue(playerHand) === 21) stand();
    }

    function stand() {
        if (gameOver) return;
        gameOver = true;
        while (handValue(dealerHand) < 17) dealerHand.push(deck.pop());
        render(false);
        endRound();
    }

    function doubleDown() {
        if (gameOver) return;
        if (!Casino.placeBet(bet)) return;
        bet *= 2;
        playerHand.push(deck.pop());
        render(true);
        if (handValue(playerHand) > 21) endRound();
        else stand();
    }

    function endRound() {
        gameOver = true;
        render(false);
        const pv = handValue(playerHand), dv = handValue(dealerHand);
        const pbj = playerHand.length === 2 && pv === 21;
        let result, winnings = 0;
        if (pv > 21) { result = 'Bust! You lose.'; msg(result, 'lose'); Casino.playSound('lose'); }
        else if (dv > 21) { winnings = bet * 2; result = `Dealer busts! You win $${winnings}!`; }
        else if (pbj && !(dealerHand.length === 2 && dv === 21)) { winnings = Math.floor(bet * 2.5); result = `Blackjack! You win $${winnings}!`; }
        else if (pv > dv) { winnings = bet * 2; result = `You win $${winnings}!`; }
        else if (pv === dv) { winnings = bet; result = 'Push — bet returned.'; msg(result, 'push'); Casino.changeBalance(winnings); showDealBtn(); bet = DEFAULT_BET; return; }
        else { result = 'Dealer wins.'; msg(result, 'lose'); Casino.playSound('lose'); }
        if (winnings > 0) {
            Casino.changeBalance(winnings);
            msg(result, 'win');
            Casino.playSound(winnings >= bet * 2.5 ? 'jackpot' : 'win');
            if (winnings >= 500) Casino.showWinEffect(winnings);
        }
        showDealBtn();
        bet = DEFAULT_BET;
    }

    function showDealBtn() {
        document.getElementById('bj-actions').innerHTML = `
            <button class="action-btn secondary" onclick="Casino.games.blackjack._setBet(50)">$50</button>
            <button class="action-btn secondary" onclick="Casino.games.blackjack._setBet(100)">$100</button>
            <button class="action-btn secondary" onclick="Casino.games.blackjack._setBet(250)">$250</button>
            <button class="action-btn secondary" onclick="Casino.games.blackjack._setBet(500)">$500</button>`;
        document.getElementById('bj-actions').innerHTML += `<button class="action-btn primary" id="bj-deal-btn" onclick="Casino.games.blackjack._deal()">DEAL — $${bet}</button>`;
    }

    function render(hideDealer) {
        const de = document.getElementById('bj-dealer');
        const pe = document.getElementById('bj-player');
        de.innerHTML = ''; pe.innerHTML = '';
        dealerHand.forEach((c,i) => de.appendChild(Casino.createCardElement(c, hideDealer && i === 1)));
        playerHand.forEach(c => pe.appendChild(Casino.createCardElement(c, false)));
        document.getElementById('bj-dealer-score').textContent = hideDealer ? handValue([dealerHand[0]]) + ' + ?' : handValue(dealerHand);
        document.getElementById('bj-player-score').textContent = handValue(playerHand);
    }

    function handValue(hand) {
        let val = 0, aces = 0;
        hand.forEach(c => { val += c.value; if (c.display === 'A') aces++; });
        while (val > 21 && aces > 0) { val -= 10; aces--; }
        return val;
    }

    function msg(text, type) {
        const el = document.getElementById('bj-msg');
        el.textContent = text;
        el.className = 'game-message ' + (type || '');
    }

    function destroy() {}

    Casino.games.blackjack = { init, destroy, _deal: deal, _hit: hit, _stand: stand, _double: doubleDown, _setBet: setBet };
})();
