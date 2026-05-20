/* Blackjack Game — Upgraded with Split, Insurance, Multi-hand, 3D flip animations */
(function() {
    let deck, hands = [], currentHandIdx = 0, dealerHand = [], mainBet = 100, gameOver = true, area, insuranceBet = 0;
    const DEFAULT_BET = 100;

    // Shared 3D flippable card (defined in app.js).
    const makeFlipCard = (card) => Casino.createFlipCard(card);

    function init(gameArea) {
        area = gameArea;
        mainBet = DEFAULT_BET;
        renderUI();
    }

    function renderUI() {
        area.innerHTML = `
            <div class="blackjack-table" style="position:relative; overflow:hidden;">
                <!-- Deck visual for animations -->
                <div id="bj-deck-pos" style="position:absolute; top:-50px; right:-50px; width:72px; height:100px;"></div>
                
                <div class="bj-section" id="bj-dealer-section">
                    <div class="bj-label">Dealer<span class="bj-drawing-dot" id="bj-drawing-dot"></span></div>
                    <div class="card-hand" id="bj-dealer" style="min-height:100px;"></div>
                    <div class="bj-score" id="bj-dealer-score" style="min-height:24px;"></div>
                </div>
                
                <hr class="bj-divider">
                
                <div class="bj-section" id="bj-player-area">
                    <!-- Hands will be injected here -->
                </div>
                
                <div class="game-message" id="bj-msg" style="min-height:28px; margin:8px 0;">Place your bet and deal!</div>
                
                <div class="bj-actions" id="bj-actions">
                    ${getBettingControls()}
                </div>
            </div>`;
    }

    function getBettingControls() {
        return `
            <button class="action-btn secondary" onclick="Casino.games.blackjack._setBet(50)">$50</button>
            <button class="action-btn secondary" onclick="Casino.games.blackjack._setBet(100)">$100</button>
            <button class="action-btn secondary" onclick="Casino.games.blackjack._setBet(250)">$250</button>
            <button class="action-btn secondary" onclick="Casino.games.blackjack._setBet(500)">$500</button>
            <button class="action-btn primary" id="bj-deal-btn" onclick="Casino.games.blackjack._deal()" style="margin-left:16px;">DEAL — $${mainBet}</button>`;
    }

    function setBet(b) {
        if (!gameOver) return;
        mainBet = b;
        const btn = document.getElementById('bj-deal-btn');
        if (btn) btn.textContent = `DEAL — $${b}`;
        Casino.playSound('click');
    }

    function msg(text, type) {
        const el = document.getElementById('bj-msg');
        if (el) {
            el.textContent = text;
            el.className = 'game-message ' + (type || '');
        }
    }

    async function deal() {
        if (!Casino.placeBet(mainBet)) { msg('Not enough chips!', 'lose'); return; }
        
        gameOver = false;
        insuranceBet = 0;
        deck = Casino.createDeck();
        
        // Initialize player hands (supporting split later)
        hands = [{ cards: [], bet: mainBet, status: 'playing', score: 0 }];
        currentHandIdx = 0;
        dealerHand = [];
        
        setupPlayerArea();
        document.getElementById('bj-actions').innerHTML = ''; // Hide buttons during deal
        msg('Dealing...', '');

        // Deal sequence: Player 1, Dealer 1, Player 2, Dealer 2 (hidden)
        await dealCardToHand(hands[0].cards, false, 'hand-0');
        await dealCardToDealer(false);
        await dealCardToHand(hands[0].cards, false, 'hand-0');
        await dealCardToDealer(true);

        updateScores();

        // Check Insurance
        if (dealerHand[0].display === 'A' && Casino.balance >= mainBet / 2) {
            offerInsurance();
            return;
        }

        checkInitialBlackjack();
    }

    function setupPlayerArea() {
        const pArea = document.getElementById('bj-player-area');
        pArea.innerHTML = '';

        hands.forEach((h, idx) => {
            const div = document.createElement('div');
            div.className = `player-hand-container ${idx === currentHandIdx && !gameOver ? 'active-hand' : ''}`;
            div.style.cssText = `display:inline-block; margin:0 10px; padding:10px; border-radius:12px; transition:all 0.3s; border:2px solid ${idx === currentHandIdx && !gameOver ? 'var(--gold)' : 'transparent'}; background:${idx === currentHandIdx && !gameOver ? 'rgba(212,168,67,0.1)' : 'transparent'}`;
            div.innerHTML = `
                <div class="bj-label" style="display:flex; justify-content:center; gap:8px;">
                    <span>Hand ${idx + 1}</span>
                    <span style="color:var(--gold-light)">$${h.bet}</span>
                </div>
                <div class="card-hand" id="hand-${idx}" style="min-height:100px;"></div>
                <div class="bj-score" id="score-${idx}" style="min-height:24px;"></div>
            `;
            pArea.appendChild(div);
            // Re-render existing cards (so we don't lose them when re-rendering the area).
            const handDiv = div.querySelector('.card-hand');
            h.cards.forEach(c => {
                const el = makeFlipCard(c);
                el.classList.add('flipped'); // already revealed
                handDiv.appendChild(el);
            });
        });
    }

    async function dealCardToHand(handArr, faceDown, containerId) {
        return new Promise(resolve => {
            const card = deck.pop();
            handArr.push(card);

            const container = document.getElementById(containerId);
            const el = makeFlipCard(card);
            if (faceDown) el.dataset.facedown = 'true';

            // Slide animation setup — card flies in from the deck position
            // (top-right) and lands; once it lands, it flips face-up (unless
            // it's the dealer's hole card).
            el.style.transform = 'translate(180px, -200px) rotate(35deg)';
            el.style.opacity = '0';
            container.appendChild(el);

            Casino.playSound('click'); // card flick sound

            requestAnimationFrame(() => {
                el.style.transition = 'transform 0.42s cubic-bezier(0.34, 1.4, 0.5, 1), opacity 0.42s';
                el.style.transform = 'translate(0, 0) rotate(0)';
                el.style.opacity = '1';
                setTimeout(() => {
                    if (!faceDown) {
                        el.classList.add('flipped');
                        // Tiny flip whoosh.
                        if (Casino.playTones) Casino.playTones([
                            { freq: 600, wave: 'triangle', dur: 0.08, vol: 0.03 },
                            { freq: 900, wave: 'sine', start: 0.05, dur: 0.06, vol: 0.025 }
                        ]);
                    }
                    setTimeout(resolve, faceDown ? 0 : 350);
                }, 400);
            });
        });
    }

    async function dealCardToDealer(faceDown) {
        return dealCardToHand(dealerHand, faceDown, 'bj-dealer');
    }

    function flipDealerHoleCard() {
        const dContainer = document.getElementById('bj-dealer');
        if (!dContainer) return;
        const hole = dContainer.querySelector('.flip-card[data-facedown="true"]');
        if (hole) {
            hole.classList.add('flipped');
            delete hole.dataset.facedown;
            if (Casino.playTones) Casino.playTones([
                { freq: 500, wave: 'triangle', dur: 0.1, vol: 0.04 },
                { freq: 700, wave: 'sine', start: 0.06, dur: 0.08, vol: 0.03 }
            ]);
        }
    }

    function updateScores() {
        // Dealer score (hide second card if game not over)
        const dScoreEl = document.getElementById('bj-dealer-score');
        if (dScoreEl) {
            dScoreEl.textContent = gameOver ? handValue(dealerHand) : handValue([dealerHand[0]]) + ' + ?';
        }

        // Player scores
        hands.forEach((h, idx) => {
            h.score = handValue(h.cards);
            const pScoreEl = document.getElementById(`score-${idx}`);
            if (pScoreEl) {
                pScoreEl.textContent = h.score;
                if (h.score > 21) pScoreEl.innerHTML += ' <span style="color:var(--red);font-size:14px;">(BUST)</span>';
            }
        });
    }

    function handValue(hand) {
        let val = 0, aces = 0;
        hand.forEach(c => { val += c.value; if (c.display === 'A') aces++; });
        while (val > 21 && aces > 0) { val -= 10; aces--; }
        return val;
    }

    function offerInsurance() {
        msg('Insurance? (Pays 2:1)', 'push');
        const acts = document.getElementById('bj-actions');
        acts.innerHTML = `
            <button class="action-btn primary" onclick="Casino.games.blackjack._takeInsurance()">Yes ($${mainBet/2})</button>
            <button class="action-btn secondary" onclick="Casino.games.blackjack._declineInsurance()">No</button>`;
    }

    function takeInsurance() {
        const cost = mainBet / 2;
        if (Casino.placeBet(cost)) {
            insuranceBet = cost;
            checkInitialBlackjack();
        } else {
            msg('Not enough chips for insurance!', 'lose');
            declineInsurance();
        }
    }

    function declineInsurance() {
        insuranceBet = 0;
        checkInitialBlackjack();
    }

    function checkInitialBlackjack() {
        const dVal = handValue(dealerHand);
        const pVal = hands[0].score;
        const dBJ = dealerHand.length === 2 && dVal === 21;
        const pBJ = hands[0].cards.length === 2 && pVal === 21;

        if (dBJ) {
            // Flip the dealer's hole card in place.
            flipDealerHoleCard();
            gameOver = true;
            updateScores();
            
            let w = 0;
            if (insuranceBet > 0) {
                w += insuranceBet * 3; // Pays 2:1 plus original
                msg('Dealer Blackjack! Insurance paid.', 'win');
            } else if (pBJ) {
                w += mainBet; // Push
                msg('Push. Both have Blackjack.', 'push');
            } else {
                msg('Dealer has Blackjack. You lose.', 'lose');
            }
            
            if (w > 0) Casino.changeBalance(w);
            resetRound();
        } else {
            if (insuranceBet > 0) msg('Nobody home! Insurance lost.', '');
            if (pBJ) {
                gameOver = true;
                const win = Math.floor(mainBet * 2.5); // 3:2 payout
                Casino.changeBalance(win);
                msg(`BLACKJACK! You win $${win}!`, 'win');
                Casino.playSound('jackpot');
                Casino.showWinEffect(win, { bet: mainBet, particles: ['🃏','♠️','♥️','♦️','♣️','💰','✨'], accent: '#22c55e', themeLabel: 'Blackjack' });
                resetRound();
            } else {
                playCurrentHand();
            }
        }
    }

    function playCurrentHand() {
        if (currentHandIdx >= hands.length) {
            dealerTurn();
            return;
        }

        const hand = hands[currentHandIdx];
        if (hand.status !== 'playing') {
            currentHandIdx++;
            playCurrentHand();
            return;
        }

        setupPlayerArea(); // update active styling
        msg(`Playing Hand ${currentHandIdx + 1}...`, '');
        showActions();
    }

    function showActions() {
        const acts = document.getElementById('bj-actions');
        const hand = hands[currentHandIdx];
        
        const canDouble = hand.cards.length === 2 && Casino.balance >= hand.bet;
        // Split allowed if 2 cards of same display value AND only 1 split so far (max 2 hands for UI simplicity)
        const canSplit = hand.cards.length === 2 && hand.cards[0].display === hand.cards[1].display && hands.length < 2 && Casino.balance >= hand.bet;

        acts.innerHTML = `
            <button class="action-btn primary" onclick="Casino.games.blackjack._hit()">Hit</button>
            <button class="action-btn danger" onclick="Casino.games.blackjack._stand()">Stand</button>
            ${canDouble ? `<button class="action-btn secondary" onclick="Casino.games.blackjack._double()">Double ($${hand.bet})</button>` : ''}
            ${canSplit ? `<button class="action-btn secondary" onclick="Casino.games.blackjack._split()">Split ($${hand.bet})</button>` : ''}
        `;
    }

    async function hit() {
        const hand = hands[currentHandIdx];
        document.getElementById('bj-actions').innerHTML = ''; // prevent rapid clicks
        
        await dealCardToHand(hand.cards, false, `hand-${currentHandIdx}`);
        updateScores();
        
        if (hand.score > 21) {
            hand.status = 'bust';
            Casino.playSound('lose');
            setTimeout(() => {
                currentHandIdx++;
                playCurrentHand();
            }, 800);
        } else if (hand.score === 21) {
            stand();
        } else {
            showActions();
        }
    }

    function stand() {
        hands[currentHandIdx].status = 'stand';
        currentHandIdx++;
        playCurrentHand();
    }

    async function doubleDown() {
        const hand = hands[currentHandIdx];
        if (!Casino.placeBet(hand.bet)) return;
        
        hand.bet *= 2;
        setupPlayerArea(); // Update bet display
        document.getElementById('bj-actions').innerHTML = '';
        
        await dealCardToHand(hand.cards, false, `hand-${currentHandIdx}`);
        updateScores();
        
        if (hand.score > 21) {
            hand.status = 'bust';
            Casino.playSound('lose');
        } else {
            hand.status = 'stand';
        }
        
        setTimeout(() => {
            currentHandIdx++;
            playCurrentHand();
        }, 800);
    }

    async function split() {
        const hand = hands[currentHandIdx];
        if (!Casino.placeBet(hand.bet)) return;

        document.getElementById('bj-actions').innerHTML = '';
        
        // Create new hand
        const newHand = { cards: [hand.cards.pop()], bet: hand.bet, status: 'playing', score: 0 };
        hands.push(newHand);
        
        setupPlayerArea(); // re-render containers
        
        // Deal second card to first hand
        await dealCardToHand(hand.cards, false, `hand-0`);
        // Deal second card to second hand
        await dealCardToHand(hands[1].cards, false, `hand-1`);
        
        updateScores();
        playCurrentHand();
    }

    async function dealerTurn() {
        gameOver = true;

        const dealerSection = document.getElementById('bj-dealer-section');
        if (dealerSection) dealerSection.classList.add('dealer-drawing');

        // Reveal the dealer's hole card with a 3D flip.
        flipDealerHoleCard();
        await new Promise(r => setTimeout(r, 500));
        updateScores();

        // Check if all hands busted
        const allBusted = hands.every(h => h.status === 'bust');

        if (!allBusted) {
            // Dealer draws to 17
            while (handValue(dealerHand) < 17) {
                await new Promise(r => setTimeout(r, 600));
                await dealCardToDealer(false);
                updateScores();
            }
        }

        if (dealerSection) dealerSection.classList.remove('dealer-drawing');

        finalizeRound();
    }

    function finalizeRound() {
        const dVal = handValue(dealerHand);
        let totalWin = 0;
        let msgs = [];

        hands.forEach((h, i) => {
            let label = hands.length > 1 ? `Hand ${i+1}: ` : '';
            if (h.status === 'bust') {
                msgs.push(`${label}Bust`);
            } else if (dVal > 21) {
                const w = h.bet * 2;
                totalWin += w;
                msgs.push(`${label}Win (Dealer Bust)`);
            } else if (h.score > dVal) {
                const w = h.bet * 2;
                totalWin += w;
                msgs.push(`${label}Win ($${w})`);
            } else if (h.score === dVal) {
                totalWin += h.bet;
                msgs.push(`${label}Push`);
            } else {
                msgs.push(`${label}Lose`);
            }
        });

        if (totalWin > 0) {
            Casino.changeBalance(totalWin);
            msg(msgs.join(' | '), 'win');
            if (totalWin > mainBet * 2) { Casino.playSound('jackpot'); Casino.showWinEffect(totalWin, { bet: mainBet, particles: ['🃏','♠️','♥️','♦️','♣️','💰','✨'], accent: '#22c55e', themeLabel: 'Blackjack' }); }
            else Casino.playSound('win');
        } else {
            msg(msgs.join(' | '), 'lose');
            Casino.playSound('lose');
        }

        resetRound();
    }

    function resetRound() {
        setupPlayerArea(); // removes active highlight
        document.getElementById('bj-actions').innerHTML = getBettingControls();
    }

    function destroy() { gameOver = true; }

    Casino.games.blackjack = { init, destroy, _deal: deal, _hit: hit, _stand: stand, _double: doubleDown, _split: split, _takeInsurance: takeInsurance, _declineInsurance: declineInsurance, _setBet: setBet };
})();
