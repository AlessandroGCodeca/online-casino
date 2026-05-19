/* Video Poker — Upgraded with Variants */
(function() {
    const VARIANTS = {
        'JOB': {
            name: 'Jacks or Better',
            hands: [
                { id: 'rf', name: 'Royal Flush', pay: 250 },
                { id: 'sf', name: 'Straight Flush', pay: 50 },
                { id: '4k', name: 'Four of a Kind', pay: 25 },
                { id: 'fh', name: 'Full House', pay: 9 },
                { id: 'fl', name: 'Flush', pay: 6 },
                { id: 'st', name: 'Straight', pay: 4 },
                { id: '3k', name: 'Three of a Kind', pay: 3 },
                { id: '2p', name: 'Two Pair', pay: 2 },
                { id: 'jb', name: 'Jacks or Better', pay: 1 }
            ]
        },
        'DW': {
            name: 'Deuces Wild',
            hands: [
                { id: 'rf', name: 'Royal Flush (Natural)', pay: 800 },
                { id: '4d', name: 'Four Deuces', pay: 200 },
                { id: 'wrf', name: 'Wild Royal Flush', pay: 25 },
                { id: '5k', name: 'Five of a Kind', pay: 15 },
                { id: 'sf', name: 'Straight Flush', pay: 9 },
                { id: '4k', name: 'Four of a Kind', pay: 5 },
                { id: 'fh', name: 'Full House', pay: 3 },
                { id: 'fl', name: 'Flush', pay: 2 },
                { id: 'st', name: 'Straight', pay: 2 },
                { id: '3k', name: 'Three of a Kind', pay: 1 }
            ]
        },
        'BP': {
            name: 'Bonus Poker',
            hands: [
                { id: 'rf', name: 'Royal Flush', pay: 250 },
                { id: 'sf', name: 'Straight Flush', pay: 50 },
                { id: '4ka', name: '4 of a Kind (Aces)', pay: 80 },
                { id: '4k2', name: '4 of a Kind (2,3,4)', pay: 40 },
                { id: '4k5', name: '4 of a Kind (5-K)', pay: 25 },
                { id: 'fh', name: 'Full House', pay: 8 },
                { id: 'fl', name: 'Flush', pay: 5 },
                { id: 'st', name: 'Straight', pay: 4 },
                { id: '3k', name: 'Three of a Kind', pay: 3 },
                { id: '2p', name: 'Two Pair', pay: 2 },
                { id: 'jb', name: 'Jacks or Better', pay: 1 }
            ]
        }
    };

    let currentVariant = 'JOB';
    let deck, hand, held, bet, phase, area;

    function init(gameArea) {
        area = gameArea;
        bet = 100; phase = 'bet';
        renderUI();
    }

    function renderUI() {
        area.innerHTML = `
            <div class="poker-game" style="display:flex; flex-direction:column; align-items:center;">
                <!-- Variant Selector -->
                <div style="display:flex; gap:8px; margin-bottom:16px; background:var(--glass-bg); padding:4px; border-radius:12px; border:1px solid var(--glass-border);">
                    <button class="variant-btn ${currentVariant==='JOB'?'active':''}" onclick="Casino.games.poker._setVariant('JOB')">Jacks or Better</button>
                    <button class="variant-btn ${currentVariant==='DW'?'active':''}" onclick="Casino.games.poker._setVariant('DW')">Deuces Wild</button>
                    <button class="variant-btn ${currentVariant==='BP'?'active':''}" onclick="Casino.games.poker._setVariant('BP')">Bonus Poker</button>
                </div>

                <div class="poker-paytable" id="pk-paytable">
                    ${renderPaytable()}
                </div>
                
                <div class="poker-cards" id="pk-cards" style="min-height:160px;"></div>
                
                <div class="game-message" id="pk-msg" style="min-height:28px;">Deal to start!</div>
                
                <div class="game-controls" style="margin-top:16px;">
                    <div class="bet-group">
                        <span class="bet-label">Bet</span>
                        <button class="bet-btn" onclick="Casino.games.poker._setBet(50)">$50</button>
                        <button class="bet-btn" onclick="Casino.games.poker._setBet(100)">$100</button>
                        <button class="bet-btn" onclick="Casino.games.poker._setBet(250)">$250</button>
                    </div>
                    <button class="action-btn primary" id="pk-btn" onclick="Casino.games.poker._action()">DEAL — $${bet}</button>
                </div>
            </div>`;
        
        // Inject styles
        if (!document.getElementById('poker-styles')) {
            const style = document.createElement('style');
            style.id = 'poker-styles';
            style.textContent = `
                .variant-btn { background:transparent; border:none; color:var(--text-secondary); padding:8px 16px; border-radius:8px; font-weight:600; cursor:pointer; transition:all 0.2s; }
                .variant-btn:hover { color:var(--text); }
                .variant-btn.active { background:var(--gold); color:#000; box-shadow:0 2px 10px rgba(212,168,67,0.3); }
            `;
            document.head.appendChild(style);
        }

        renderEmpty();
    }

    function renderPaytable() {
        return VARIANTS[currentVariant].hands.map((h, i) => 
            `<span class="hand-name" data-idx="${i}">${h.name}</span><span class="hand-pay" data-idx="${i}">${h.pay}x</span>`
        ).join('');
    }

    function setVariant(v) {
        if (phase !== 'bet') return; // Cannot change mid-hand
        currentVariant = v;
        Casino.playSound('click');
        renderUI();
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

        // Auto-hold logic could go here
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
            
            // Visual indicator for wild deuces
            const isWild = currentVariant === 'DW' && card.display === '2';
            
            const el = Casino.createCardElement(card, false);
            if (held[i]) el.classList.add('held');
            if (isWild) el.style.boxShadow = 'inset 0 0 15px rgba(212,168,67,0.5)';

            el.addEventListener('click', () => {
                if (phase !== 'draw') return;
                held[i] = !held[i];
                Casino.playSound('click');
                renderHand(); // re-render to update classes
            });
            const label = document.createElement('div');
            label.className = 'hold-label';
            label.textContent = held[i] ? 'HELD' : (isWild ? 'WILD' : '');
            if (isWild && !held[i]) label.style.color = '#fff';
            
            w.appendChild(el);
            w.appendChild(label);
            c.appendChild(w);
        });
    }

    function evaluate() {
        const result = getHandRank();
        highlightPaytable(result.index);
        
        if (result.index >= 0) {
            const pay = VARIANTS[currentVariant].hands[result.index].pay;
            const winnings = bet * pay;
            Casino.changeBalance(winnings);
            msg(`${result.name}! Won $${winnings}!`, 'win');
            Casino.playSound(pay >= 25 ? 'jackpot' : 'win');
            if (winnings >= 500) Casino.showWinEffect(winnings, { bet, particles: ['♠️','♥️','♦️','♣️','💰','✨'], accent: '#3b82f6', themeLabel: 'Video Poker' });
        } else {
            msg('No winning hand — try again!', 'lose');
            Casino.playSound('lose');
        }
    }

    function highlightPaytable(idx) {
        const rows = document.querySelectorAll('#pk-paytable span');
        rows.forEach(r => r.classList.remove('active'));
        if (idx >= 0) {
            document.querySelectorAll(`.hand-name[data-idx="${idx}"]`).forEach(el => el.classList.add('active'));
            document.querySelectorAll(`.hand-pay[data-idx="${idx}"]`).forEach(el => el.classList.add('active'));
        }
    }

    function getHandRank() {
        // Evaluate based on variant
        if (currentVariant === 'DW') return evaluateDeucesWild();
        
        // Standard evaluation (JOB & BP)
        const suits = hand.map(c => c.suit);
        const ranks = hand.map(c => c.rank).sort((a,b) => a - b);
        const isFlush = suits.every(s => s === suits[0]);
        const isStraight = checkStraight(ranks);
        
        const counts = {};
        ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
        const vals = Object.values(counts).sort((a,b) => b - a);
        const keys = Object.keys(counts).map(Number);

        // Common top hands
        if (isFlush && isStraight && ranks[4] === 12 && ranks[0] === 8) return getResultObj('rf');
        if (isFlush && isStraight) return getResultObj('sf');
        
        if (vals[0] === 4) {
            if (currentVariant === 'BP') {
                const quadRank = keys.find(k => counts[k] === 4);
                if (quadRank === 12) return getResultObj('4ka'); // Aces
                if (quadRank >= 0 && quadRank <= 2) return getResultObj('4k2'); // 2, 3, 4
                return getResultObj('4k5'); // 5-K
            }
            return getResultObj('4k');
        }
        
        if (vals[0] === 3 && vals[1] === 2) return getResultObj('fh');
        if (isFlush) return getResultObj('fl');
        if (isStraight) return getResultObj('st');
        if (vals[0] === 3) return getResultObj('3k');
        if (vals[0] === 2 && vals[1] === 2) return getResultObj('2p');
        if (vals[0] === 2) {
            const pairRank = keys.find(k => counts[k] === 2);
            if (pairRank >= 9) return getResultObj('jb'); // Jacks or better
        }
        
        return { name: 'No Hand', index: -1 };
    }

    function evaluateDeucesWild() {
        const suits = hand.map(c => c.suit);
        const ranks = hand.map(c => c.rank);
        
        const deuces = ranks.filter(r => r === 0).length; // rank 0 is '2'
        
        if (deuces === 4) return getResultObj('4d'); // Four Deuces
        if (deuces === 0) {
            // Natural Evaluation
            const isFlush = suits.every(s => s === suits[0]);
            const sortedRanks = [...ranks].sort((a,b) => a - b);
            const isStraight = checkStraight(sortedRanks);
            if (isFlush && isStraight && sortedRanks[4] === 12 && sortedRanks[0] === 8) return getResultObj('rf');
            
            // Standard evaluation fallback for no deuces
            const counts = {};
            sortedRanks.forEach(r => counts[r] = (counts[r] || 0) + 1);
            const vals = Object.values(counts).sort((a,b) => b - a);
            
            if (isFlush && isStraight) return getResultObj('sf');
            if (vals[0] === 4) return getResultObj('4k');
            if (vals[0] === 3 && vals[1] === 2) return getResultObj('fh');
            if (isFlush) return getResultObj('fl');
            if (isStraight) return getResultObj('st');
            if (vals[0] === 3) return getResultObj('3k');
            // Two pair and high pair don't pay in DW
            return { name: 'No Hand', index: -1 };
        }

        // Wild Evaluation
        const nonDeuceCards = hand.filter(c => c.rank !== 0);
        const ndRanks = nonDeuceCards.map(c => c.rank);
        const ndSuits = nonDeuceCards.map(c => c.suit);
        
        const counts = {};
        ndRanks.forEach(r => counts[r] = (counts[r] || 0) + 1);
        const vals = Object.values(counts).sort((a,b) => b - a);
        const maxSameRank = vals[0] || 0;
        
        // 5 of a kind
        if (maxSameRank + deuces === 5) return getResultObj('5k');
        
        // Wild Royal Flush & Straight Flush
        const isFlushWild = ndSuits.every(s => s === ndSuits[0]);
        if (isFlushWild) {
            // Check Straight Flush Wild
            let isStraightWild = false;
            let isRoyalWild = false;
            
            const uniqueRanks = [...new Set(ndRanks)].sort((a,b) => a-b);
            
            // Special case A,2,3,4,5 with wilds
            const lowAceRanks = uniqueRanks.map(r => r === 12 ? -1 : r).sort((a,b) => a-b);
            
            if (uniqueRanks[uniqueRanks.length-1] - uniqueRanks[0] <= 4 && uniqueRanks.length === ndRanks.length) {
                isStraightWild = true;
                if (uniqueRanks[0] >= 8) isRoyalWild = true; // 10 or higher
            } else if (lowAceRanks[lowAceRanks.length-1] - lowAceRanks[0] <= 4 && lowAceRanks.length === ndRanks.length) {
                isStraightWild = true;
            }
            
            if (isRoyalWild) return getResultObj('wrf');
            if (isStraightWild) return getResultObj('sf');
        }

        if (maxSameRank + deuces === 4) return getResultObj('4k');
        
        // Full House
        // 1 deuce + two pair OR 1 deuce + 3 of a kind
        // 2 deuces + any 3 cards (can always make 3 of a kind, but full house only if 2 are paired)
        if ((deuces === 1 && vals[0] === 2 && vals[1] === 2) || 
            (deuces === 2 && vals[0] === 2) ||
            (deuces >= 3)) { // 3 deuces + 2 random = FH always, but 4k pays more
            return getResultObj('fh');
        }

        if (isFlushWild) return getResultObj('fl');

        // Straight Wild check (not flush)
        const uniqueRanks = [...new Set(ndRanks)].sort((a,b) => a-b);
        const lowAceRanks = uniqueRanks.map(r => r === 12 ? -1 : r).sort((a,b) => a-b);
        
        if ((uniqueRanks[uniqueRanks.length-1] - uniqueRanks[0] <= 4 && uniqueRanks.length === ndRanks.length) ||
            (lowAceRanks[lowAceRanks.length-1] - lowAceRanks[0] <= 4 && lowAceRanks.length === ndRanks.length)) {
            return getResultObj('st');
        }

        if (maxSameRank + deuces === 3) return getResultObj('3k');

        return { name: 'No Hand', index: -1 };
    }

    function getResultObj(id) {
        const h = VARIANTS[currentVariant].hands.findIndex(x => x.id === id);
        if (h === -1) return { name: 'No Hand', index: -1 };
        return { name: VARIANTS[currentVariant].hands[h].name, index: h };
    }

    function checkStraight(ranks) {
        if (ranks[4] - ranks[0] === 4 && new Set(ranks).size === 5) return true;
        if (ranks[0]===0 && ranks[1]===1 && ranks[2]===2 && ranks[3]===3 && ranks[4]===12) return true; // A,2,3,4,5
        return false;
    }

    function makePokerDeck() {
        const suits = ['♠','♥','♦','♣'];
        const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
        const deck = [];
        suits.forEach(s => values.forEach((v, i) => {
            deck.push({ value: i < 9 ? i+2 : 10, display: v, suit: s, rank: i }); // rank 0 = 2, rank 12 = A
        }));
        return Casino.shuffle(deck);
    }

    function msg(t, type) { 
        const el = document.getElementById('pk-msg'); 
        if(el) { el.textContent = t; el.className = 'game-message ' + (type||''); }
    }
    
    function destroy() {}

    Casino.games.poker = { init, destroy, _action: action, _setBet: setBet, _setVariant: setVariant };
})();
