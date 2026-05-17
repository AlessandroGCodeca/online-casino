/* Video Poker — Jacks or Better */
(function() {
    const HANDS = [
        { name: 'Royal Flush', pay: 250 },
        { name: 'Straight Flush', pay: 50 },
        { name: 'Four of a Kind', pay: 25 },
        { name: 'Full House', pay: 9 },
        { name: 'Flush', pay: 6 },
        { name: 'Straight', pay: 4 },
        { name: 'Three of a Kind', pay: 3 },
        { name: 'Two Pair', pay: 2 },
        { name: 'Jacks or Better', pay: 1 }
    ];
    let deck, hand, held, bet, phase, area;

    function init(gameArea) {
        area = gameArea;
        bet = 100; phase = 'bet';
        area.innerHTML = `
            <div class="poker-game">
                <div class="poker-paytable" id="pk-paytable">
                    ${HANDS.map(h => `<span class="hand-name">${h.name}</span><span class="hand-pay">${h.pay}x</span>`).join('')}
                </div>
                <div class="poker-cards" id="pk-cards"></div>
                <div class="game-message" id="pk-msg">Deal to start!</div>
                <div class="game-controls">
                    <div class="bet-group">
                        <span class="bet-label">Bet</span>
                        <button class="bet-btn" onclick="Casino.games.poker._setBet(50)">$50</button>
                        <button class="bet-btn" onclick="Casino.games.poker._setBet(100)">$100</button>
                        <button class="bet-btn" onclick="Casino.games.poker._setBet(250)">$250</button>
                    </div>
                    <button class="action-btn primary" id="pk-btn" onclick="Casino.games.poker._action()">DEAL — $${bet}</button>
                </div>
            </div>`;
        renderEmpty();
    }

    function renderEmpty() {
        const c = document.getElementById('pk-cards');
        c.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const w = document.createElement('div');
            w.className = 'poker-card-wrapper';
            const card = document.createElement('div');
            card.className = 'playing-card face-down';
            const label = document.createElement('div');
            label.className = 'hold-label';
            w.appendChild(card);
            w.appendChild(label);
            c.appendChild(w);
        }
    }

    function setBet(b) { if (phase === 'bet') { bet = b; document.getElementById('pk-btn').textContent = `DEAL — $${b}`; Casino.playSound('click'); } }

    function action() {
        if (phase === 'bet') dealCards();
        else if (phase === 'draw') drawCards();
    }

    function dealCards() {
        if (!Casino.placeBet(bet)) { msg('Not enough chips!', 'lose'); return; }
        deck = makePokerDeck();
        hand = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
        held = [false, false, false, false, false];
        phase = 'draw';
        renderHand();
        msg('Click cards to hold, then draw', '');
        document.getElementById('pk-btn').textContent = 'DRAW';
        Casino.playSound('click');
    }

    function drawCards() {
        Casino.playSound('click');
        for (let i = 0; i < 5; i++) {
            if (!held[i]) hand[i] = deck.pop();
        }
        phase = 'bet';
        renderHand();
        evaluate();
        document.getElementById('pk-btn').textContent = `DEAL — $${bet}`;
    }

    function renderHand() {
        const c = document.getElementById('pk-cards');
        c.innerHTML = '';
        hand.forEach((card, i) => {
            const w = document.createElement('div');
            w.className = 'poker-card-wrapper';
            const el = Casino.createCardElement(card, false);
            if (held[i]) el.classList.add('held');
            el.addEventListener('click', () => {
                if (phase !== 'draw') return;
                held[i] = !held[i];
                Casino.playSound('click');
                renderHand();
            });
            const label = document.createElement('div');
            label.className = 'hold-label';
            label.textContent = held[i] ? 'HELD' : '';
            w.appendChild(el);
            w.appendChild(label);
            c.appendChild(w);
        });
    }

    function evaluate() {
        const result = getHandRank();
        highlightPaytable(result.index);
        if (result.index >= 0) {
            const pay = HANDS[result.index].pay;
            const winnings = bet * pay;
            Casino.changeBalance(winnings);
            msg(`${result.name}! Won $${winnings}!`, 'win');
            Casino.playSound(pay >= 25 ? 'jackpot' : 'win');
            if (winnings >= 500) Casino.showWinEffect(winnings);
        } else {
            msg('No winning hand — try again!', 'lose');
            Casino.playSound('lose');
        }
    }

    function highlightPaytable(idx) {
        const rows = document.querySelectorAll('#pk-paytable span');
        rows.forEach(r => r.classList.remove('active'));
        if (idx >= 0) {
            rows[idx * 2].classList.add('active');
            rows[idx * 2 + 1].classList.add('active');
        }
    }

    function getHandRank() {
        const suits = hand.map(c => c.suit);
        const ranks = hand.map(c => c.rank).sort((a,b) => a - b);
        const isFlush = suits.every(s => s === suits[0]);
        const isStraight = checkStraight(ranks);
        const counts = {};
        ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
        const vals = Object.values(counts).sort((a,b) => b - a);
        const keys = Object.keys(counts).map(Number);

        if (isFlush && isStraight && ranks[4] === 12 && ranks[0] === 8) return { name: 'Royal Flush', index: 0 };
        if (isFlush && isStraight) return { name: 'Straight Flush', index: 1 };
        if (vals[0] === 4) return { name: 'Four of a Kind', index: 2 };
        if (vals[0] === 3 && vals[1] === 2) return { name: 'Full House', index: 3 };
        if (isFlush) return { name: 'Flush', index: 4 };
        if (isStraight) return { name: 'Straight', index: 5 };
        if (vals[0] === 3) return { name: 'Three of a Kind', index: 6 };
        if (vals[0] === 2 && vals[1] === 2) return { name: 'Two Pair', index: 7 };
        if (vals[0] === 2) {
            const pairRank = keys.find(k => counts[k] === 2);
            if (pairRank >= 9) return { name: 'Jacks or Better', index: 8 };
        }
        return { name: 'No Hand', index: -1 };
    }

    function checkStraight(ranks) {
        if (ranks[4] - ranks[0] === 4 && new Set(ranks).size === 5) return true;
        if (ranks[0]===0 && ranks[1]===1 && ranks[2]===2 && ranks[3]===3 && ranks[4]===12) return true;
        return false;
    }

    function makePokerDeck() {
        const suits = ['♠','♥','♦','♣'];
        const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        const deck = [];
        suits.forEach(s => values.forEach((v, i) => {
            deck.push({ value: i < 9 ? i+2 : 10, display: v, suit: s, rank: i });
        }));
        return Casino.shuffle(deck);
    }

    function msg(t, type) { const el = document.getElementById('pk-msg'); el.textContent = t; el.className = 'game-message ' + (type||''); }
    function destroy() {}

    Casino.games.poker = { init, destroy, _action: action, _setBet: setBet };
})();
