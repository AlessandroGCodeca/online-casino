/* Roulette — European wheel with chip-stack multi-betting.
   Players place chips of a chosen denomination on any number of inside
   or outside bets simultaneously, then spin once to evaluate all of them. */
(function() {
    const NUMBERS = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
    const RED_NUMS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

    const CHIPS = [
        { value: 5,    color: '#dc2626', label: '$5'   },
        { value: 25,   color: '#3b82f6', label: '$25'  },
        { value: 100,  color: '#22c55e', label: '$100' },
        { value: 500,  color: '#a855f7', label: '$500' },
        { value: 1000, color: '#fbbf24', label: '$1K'  }
    ];

    let chipValue = 25;
    let activeBets = {};      // { betKey: chipAmount }
    let lastBets = {};        // for "Repeat"
    let placeOrder = [];      // [{ key, value }] for "Undo"
    let spinning = false;
    let area;
    let history = [];

    // Animation state
    let wheelAngle = 0;
    let ballAngle = 0;
    let ballRadius = 0;
    let animFrame = null;
    let spinResult = -1;

    function isRed(n) { return RED_NUMS.includes(n); }
    function getColor(n) { return n === 0 ? '#22c55e' : (isRed(n) ? '#ef4444' : '#1e293b'); }
    function totalBet() { return Object.values(activeBets).reduce((s, v) => s + v, 0); }
    function getChip(v) { return CHIPS.find(c => c.value === v) || CHIPS[0]; }

    function init(gameArea) {
        area = gameArea;
        activeBets = {};
        placeOrder = [];
        renderUI();
        drawStaticWheel();
        refreshBetUI();
        updateSpinBtn();
    }

    function renderUI() {
        area.innerHTML = `
            <div class="roulette-game">
                <div class="r-top-row">
                    <div class="r-wheel-wrap">
                        <canvas id="r-canvas" width="300" height="300"></canvas>
                        <div class="roulette-pointer">▼</div>
                    </div>
                    <div class="r-history-box">
                        <h4>History</h4>
                        <div id="r-history" class="r-history-list">${renderHistory()}</div>
                    </div>
                </div>

                <div class="game-message" id="r-msg">Pick a chip and click bets to place stacks!</div>

                <div class="r-chips-row">
                    <span class="bet-label">Chip:</span>
                    ${CHIPS.map(c => `
                        <button class="r-chip-btn${c.value === chipValue ? ' active' : ''}" type="button"
                                data-chip="${c.value}" style="--chip-color:${c.color}">${c.label}</button>
                    `).join('')}
                    <div class="r-actions">
                        <button class="r-action-btn" type="button" data-action="undo" title="Remove last chip">↶ Undo</button>
                        <button class="r-action-btn" type="button" data-action="clear" title="Clear all bets">Clear</button>
                        <button class="r-action-btn" type="button" data-action="repeat" title="Place same bets as last spin">Repeat</button>
                    </div>
                </div>

                <div class="game-controls r-spin-row">
                    <div class="r-total">Total bet: <b id="r-total">$0</b></div>
                    <button class="action-btn primary" type="button" id="r-spin-btn">SELECT A BET</button>
                </div>

                <div class="r-table">
                    <div class="r-table-zero">
                        <button class="r-grid-btn" type="button" data-bet="0" style="height:100%; border-color:#22c55e; color:#22c55e;">0</button>
                    </div>
                    <div class="r-table-grid">
                        ${[3,6,9,12,15,18,21,24,27,30,33,36].map(n => `<button class="r-grid-btn" type="button" data-bet="${n}" style="border-color:${getColor(n)}; color:${getColor(n)}">${n}</button>`).join('')}
                        ${[2,5,8,11,14,17,20,23,26,29,32,35].map(n => `<button class="r-grid-btn" type="button" data-bet="${n}" style="border-color:${getColor(n)}; color:${getColor(n)}">${n}</button>`).join('')}
                        ${[1,4,7,10,13,16,19,22,25,28,31,34].map(n => `<button class="r-grid-btn" type="button" data-bet="${n}" style="border-color:${getColor(n)}; color:${getColor(n)}">${n}</button>`).join('')}
                    </div>
                </div>

                <div class="r-outside">
                    <div class="r-outside-row3">
                        <button class="r-out-btn" type="button" data-bet="1st12">1st 12</button>
                        <button class="r-out-btn" type="button" data-bet="2nd12">2nd 12</button>
                        <button class="r-out-btn" type="button" data-bet="3rd12">3rd 12</button>
                    </div>
                    <div class="r-outside-row6">
                        <button class="r-out-btn" type="button" data-bet="low">1–18</button>
                        <button class="r-out-btn" type="button" data-bet="even">Even</button>
                        <button class="r-out-btn red" type="button" data-bet="red">♦ RED</button>
                        <button class="r-out-btn black" type="button" data-bet="black">♠ BLACK</button>
                        <button class="r-out-btn" type="button" data-bet="odd">Odd</button>
                        <button class="r-out-btn" type="button" data-bet="high">19–36</button>
                    </div>
                </div>

                <div class="r-hint">💡 Click bets to place chips · right-click to remove · place multiple bets on different spots</div>
            </div>`;

        injectStyles();
        wireListeners();
    }

    function wireListeners() {
        area.querySelectorAll('.r-chip-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                chipValue = parseInt(btn.dataset.chip, 10);
                area.querySelectorAll('.r-chip-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.chip, 10) === chipValue));
                Casino.playSound('click');
            });
        });

        area.querySelectorAll('.r-grid-btn, .r-out-btn').forEach(btn => {
            btn.addEventListener('click', () => placeChip(btn.dataset.bet));
            btn.addEventListener('contextmenu', e => {
                e.preventDefault();
                removeChip(btn.dataset.bet);
            });
        });

        area.querySelectorAll('.r-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.action === 'undo') undoLast();
                else if (btn.dataset.action === 'clear') clearAllBets();
                else if (btn.dataset.action === 'repeat') repeatLast();
            });
        });

        document.getElementById('r-spin-btn').addEventListener('click', spin);
    }

    function injectStyles() {
        if (document.getElementById('roulette-styles')) return;
        const style = document.createElement('style');
        style.id = 'roulette-styles';
        style.textContent = `
            .roulette-game { display: flex; flex-direction: column; align-items: center; gap: 16px; }
            .r-top-row { display: flex; gap: 24px; flex-wrap: wrap; justify-content: center; width: 100%; }
            .r-wheel-wrap { position: relative; width: 300px; height: 300px; }
            #r-canvas { width: 100%; height: 100%; filter: drop-shadow(0 0 20px rgba(212,168,67,0.2)); }
            .roulette-pointer { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); font-size: 28px; color: var(--gold-light); z-index: 5; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
            .r-history-box { background: var(--bg-card); border: 1px solid var(--glass-border); border-radius: 12px; padding: 16px; min-width: 140px; display: flex; flex-direction: column; }
            .r-history-box h4 { color: var(--text-secondary); margin-bottom: 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; text-align: center; }
            .r-history-list { display: flex; flex-direction: column; gap: 6px; align-items: center; }
            .r-history-empty { color: var(--text-muted); font-size: 12px; text-align: center; padding: 10px; }
            .r-history-chip { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; color: #fff; border: 2px solid rgba(255,255,255,0.1); box-shadow: 0 2px 5px rgba(0,0,0,0.3); }

            .r-chips-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 16px; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 14px; width: 100%; max-width: 700px; }
            .r-chip-btn { width: 54px; height: 54px; border-radius: 50%; border: 3px dashed rgba(255,255,255,0.55); background: var(--chip-color); color: #fff; font-weight: 900; font-size: 13px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.35); position: relative; flex-shrink: 0; }
            .r-chip-btn:hover { transform: translateY(-2px); }
            .r-chip-btn.active { box-shadow: 0 0 0 3px var(--gold), 0 4px 10px rgba(0,0,0,0.4); transform: translateY(-3px); }

            .r-actions { display: flex; gap: 6px; margin-left: auto; }
            .r-action-btn { padding: 8px 12px; border-radius: 8px; border: 1px solid var(--glass-border); background: var(--glass-bg); color: var(--text); cursor: pointer; font-weight: 700; font-size: 12px; transition: all 0.2s; }
            .r-action-btn:hover { background: var(--bg-card-hover); border-color: var(--gold); }

            .r-spin-row { width: 100%; max-width: 700px; justify-content: space-between; }
            .r-total { font-weight: 700; color: var(--text-secondary); font-size: 14px; }
            .r-total b { color: var(--gold-light); font-size: 16px; font-variant-numeric: tabular-nums; }

            .r-table { display: flex; width: 100%; max-width: 700px; gap: 2px; }
            .r-table-zero { width: 50px; }
            .r-table-grid { flex: 1; display: grid; grid-template-columns: repeat(12, 1fr); grid-template-rows: repeat(3, 1fr); gap: 2px; }
            .r-grid-btn { background: var(--glass-bg); border: 1px solid; border-radius: 4px; font-weight: 800; font-size: 14px; cursor: pointer; transition: all 0.2s; min-height: 38px; position: relative; padding: 0; }
            .r-grid-btn:hover { background: var(--bg-card-hover); filter: brightness(1.5); }

            .r-outside { display: flex; flex-direction: column; gap: 4px; width: 100%; max-width: 700px; padding-left: 52px; }
            .r-outside-row3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
            .r-outside-row6 { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; }
            .r-out-btn { background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 6px; padding: 12px 0; font-weight: 700; color: var(--text); cursor: pointer; transition: all 0.2s; font-size: 13px; position: relative; }
            .r-out-btn:hover { border-color: var(--gold); }
            .r-out-btn.red { color: #ef4444; }
            .r-out-btn.black { color: #94a3b8; }

            /* Chip stacks placed on bets */
            .r-bet-chip {
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                min-width: 32px; height: 32px; padding: 0 6px;
                border-radius: 16px;
                background: var(--chip-color, var(--gold));
                color: #fff;
                font-weight: 900;
                font-size: 11px;
                display: flex; align-items: center; justify-content: center;
                border: 2px solid rgba(255,255,255,0.55);
                box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                pointer-events: none;
                z-index: 5;
                animation: chipPop 0.25s cubic-bezier(0.2, 1.4, 0.4, 1);
            }
            @keyframes chipPop { from { transform: translate(-50%, -50%) scale(0); } to { transform: translate(-50%, -50%) scale(1); } }

            .r-result-tag { display: inline-block; padding: 4px 12px; border-radius: 50px; font-weight: 900; font-size: 16px; color: #fff; margin-right: 6px; }

            .r-hint { font-size: 12px; color: var(--text-muted); text-align: center; padding: 4px 0; }

            @media (max-width: 700px) {
                .r-chips-row { padding: 8px; gap: 6px; }
                .r-chip-btn { width: 44px; height: 44px; font-size: 11px; border-width: 2px; }
                .r-actions { width: 100%; margin-left: 0; justify-content: center; }
                .r-grid-btn { font-size: 11px; min-height: 32px; }
                .r-bet-chip { min-width: 24px; height: 24px; font-size: 10px; }
                .r-out-btn { font-size: 11px; padding: 9px 0; }
                .r-outside { padding-left: 42px; }
                .r-table-zero { width: 40px; }
            }
        `;
        document.head.appendChild(style);
    }

    function placeChip(betKey) {
        if (spinning) return;
        const newTotal = totalBet() + chipValue;
        if (Casino.balance < newTotal) {
            msg('Not enough chips for this bet.', 'lose');
            return;
        }
        activeBets[betKey] = (activeBets[betKey] || 0) + chipValue;
        placeOrder.push({ key: betKey, value: chipValue });
        refreshBetUI();
        updateSpinBtn();
        Casino.playSound('click');
    }

    function removeChip(betKey) {
        if (spinning || !activeBets[betKey]) return;
        for (let i = placeOrder.length - 1; i >= 0; i--) {
            if (placeOrder[i].key === betKey) {
                activeBets[betKey] -= placeOrder[i].value;
                if (activeBets[betKey] <= 0) delete activeBets[betKey];
                placeOrder.splice(i, 1);
                break;
            }
        }
        refreshBetUI();
        updateSpinBtn();
        Casino.playSound('click');
    }

    function undoLast() {
        if (spinning || placeOrder.length === 0) return;
        const last = placeOrder.pop();
        activeBets[last.key] -= last.value;
        if (activeBets[last.key] <= 0) delete activeBets[last.key];
        refreshBetUI();
        updateSpinBtn();
        Casino.playSound('click');
    }

    function clearAllBets() {
        if (spinning) return;
        activeBets = {};
        placeOrder = [];
        refreshBetUI();
        updateSpinBtn();
        Casino.playSound('click');
    }

    function repeatLast() {
        if (spinning || !Object.keys(lastBets).length) return;
        const total = Object.values(lastBets).reduce((s, v) => s + v, 0);
        if (Casino.balance < total) {
            msg('Not enough chips to repeat last bets.', 'lose');
            return;
        }
        activeBets = Object.assign({}, lastBets);
        placeOrder = Object.entries(lastBets).map(([key, value]) => ({ key, value }));
        refreshBetUI();
        updateSpinBtn();
        Casino.playSound('click');
    }

    function refreshBetUI() {
        const total = totalBet();
        const totalEl = document.getElementById('r-total');
        if (totalEl) totalEl.textContent = '$' + total.toLocaleString();

        area.querySelectorAll('.r-grid-btn, .r-out-btn').forEach(btn => {
            const key = btn.dataset.bet;
            const oldChip = btn.querySelector('.r-bet-chip');
            if (oldChip) oldChip.remove();
            if (activeBets[key]) {
                const chip = document.createElement('span');
                chip.className = 'r-bet-chip';
                const denominations = placeOrder.filter(p => p.key === key).map(p => p.value);
                const top = denominations.length ? Math.max(...denominations) : chipValue;
                chip.style.setProperty('--chip-color', getChip(top).color);
                chip.textContent = '$' + activeBets[key];
                btn.appendChild(chip);
            }
        });
    }

    function updateSpinBtn() {
        const total = totalBet();
        const btn = document.getElementById('r-spin-btn');
        if (!btn) return;
        btn.disabled = spinning || total === 0;
        btn.textContent = total > 0 ? `SPIN — $${total.toLocaleString()}` : 'SELECT A BET';
    }

    function drawStaticWheel() {
        const canvas = document.getElementById('r-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const cx = 150, cy = 150, r = 140;

        ctx.clearRect(0, 0, 300, 300);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(wheelAngle);

        const segAngle = (Math.PI * 2) / 37;
        // Place the slot for NUMBERS[0] at the TOP (pointer position) so its
        // segment sits centred at angle -π/2 (canvas: 12 o'clock).
        const baseOffset = -Math.PI / 2;
        for (let i = 0; i < 37; i++) {
            const num = NUMBERS[i];
            const a0 = baseOffset + i * segAngle - segAngle / 2;
            const a1 = baseOffset + (i + 1) * segAngle - segAngle / 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, r, a0, a1);
            ctx.fillStyle = getColor(num);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.save();
            ctx.rotate(baseOffset + i * segAngle);
            ctx.translate(0, -r + 18);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(num.toString(), 0, 0);
            ctx.restore();
        }

        // Center hub
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#d4a843';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();

        ctx.restore();

        // Outer gold rim
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#d4a843';
        ctx.stroke();

        if (ballRadius > 0) {
            ctx.beginPath();
            const bx = cx + Math.cos(ballAngle) * ballRadius;
            const by = cy + Math.sin(ballAngle) * ballRadius;
            ctx.arc(bx, by, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#f8fafc';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 6;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    function renderHistory() {
        if (history.length === 0) return '<div class="r-history-empty">No spins yet</div>';
        return history.map(n => `<div class="r-history-chip" style="background:${getColor(n)}">${n}</div>`).join('');
    }
    function updateHistory(n) {
        history.unshift(n);
        if (history.length > 5) history.pop();
        const el = document.getElementById('r-history');
        if (el) el.innerHTML = renderHistory();
    }

    function spin() {
        if (spinning) return;
        const total = totalBet();
        if (total === 0) { msg('Place at least one chip!', ''); return; }
        if (!Casino.placeBet(total)) { msg('Not enough chips!', 'lose'); return; }

        lastBets = Object.assign({}, activeBets);
        spinning = true;
        updateSpinBtn();
        msg('Spinning...', '');
        if (Casino.playTones) Casino.playTones([{ freq: 600, wave: 'sine', dur: 0.1, vol: 0.04 }]);

        spinResult = Math.floor(Math.random() * 37);
        const duration = 5000;
        const startTime = performance.now();
        const index = NUMBERS.indexOf(spinResult);
        const segAngle = (Math.PI * 2) / 37;
        const targetWheelAngle = -(index * segAngle);
        const startWheelAngle = wheelAngle;
        const startBallAngle = -Math.PI / 2;
        let lastTick = 0;

        function animate(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);

            wheelAngle = startWheelAngle + (Math.PI * 2 * 3 * easeOut) + (targetWheelAngle - startWheelAngle) * progress;
            ballAngle = startBallAngle - (Math.PI * 2 * 8 * easeOut);

            if (progress < 0.7) {
                ballRadius = 130;
            } else {
                const dropProgress = (progress - 0.7) / 0.3;
                ballRadius = 130 - (30 * dropProgress);
                const finalBallAngle = -Math.PI / 2;
                ballAngle = ballAngle * (1 - dropProgress) + finalBallAngle * dropProgress;
            }

            drawStaticWheel();

            if (progress < 0.85 && elapsed - lastTick > 120 + (progress * 250)) {
                if (Casino.playTones) Casino.playTones([{ freq: 1200, wave: 'sine', dur: 0.03, vol: 0.025 }]);
                lastTick = elapsed;
            }

            if (progress < 1) animFrame = requestAnimationFrame(animate);
            else finalizeSpin();
        }
        animFrame = requestAnimationFrame(animate);
    }

    function finalizeSpin() {
        updateHistory(spinResult);

        let totalPayout = 0;
        const winners = [];
        Object.entries(activeBets).forEach(([key, amt]) => {
            const payout = checkBet(key, amt, spinResult);
            if (payout > 0) {
                totalPayout += payout;
                winners.push({ key, payout });
            }
        });

        const c = getColor(spinResult);
        const tag = `<span class="r-result-tag" style="background:${c}">${spinResult}</span>`;
        const m = document.getElementById('r-msg');
        if (totalPayout > 0) {
            Casino.changeBalance(totalPayout);
            const wins = winners.length;
            if (m) {
                m.innerHTML = `${tag} ${wins} winning bet${wins > 1 ? 's' : ''} — Won $${totalPayout.toLocaleString()}!`;
                m.className = 'game-message win';
            }
            Casino.playSound(totalPayout >= totalBet() * 10 ? 'jackpot' : 'win');
            if (totalPayout >= 500) Casino.showWinEffect(totalPayout, { bet: totalBet(), particles: ['🎡','🎰','💰','✨','♠️','♦️'], accent: '#8b5cf6', themeLabel: 'Roulette' });
        } else {
            if (m) {
                m.innerHTML = `${tag} No winning bets.`;
                m.className = 'game-message lose';
            }
            Casino.playSound('lose');
        }

        activeBets = {};
        placeOrder = [];
        refreshBetUI();
        spinning = false;
        updateSpinBtn();
    }

    function checkBet(key, amt, n) {
        const numericKey = parseInt(key, 10);
        if (!isNaN(numericKey) && key === numericKey.toString() && numericKey === n) return amt * 36;
        switch (key) {
            case 'red':   return n > 0 && isRed(n) ? amt * 2 : 0;
            case 'black': return n > 0 && !isRed(n) ? amt * 2 : 0;
            case 'odd':   return n > 0 && n % 2 === 1 ? amt * 2 : 0;
            case 'even':  return n > 0 && n % 2 === 0 ? amt * 2 : 0;
            case 'low':   return n >= 1 && n <= 18 ? amt * 2 : 0;
            case 'high':  return n >= 19 && n <= 36 ? amt * 2 : 0;
            case '1st12': return n >= 1 && n <= 12 ? amt * 3 : 0;
            case '2nd12': return n >= 13 && n <= 24 ? amt * 3 : 0;
            case '3rd12': return n >= 25 && n <= 36 ? amt * 3 : 0;
            default: return 0;
        }
    }

    function msg(text, type) {
        const el = document.getElementById('r-msg');
        if (el) {
            el.textContent = text;
            el.className = 'game-message ' + (type || '');
        }
    }

    function destroy() {
        spinning = false;
        if (animFrame) cancelAnimationFrame(animFrame);
    }

    Casino.games.roulette = { init, destroy };
})();
