/* Roulette Game — Upgraded with Canvas Wheel, Ball, Number Grid, and History */
(function() {
    const NUMBERS = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
    const RED_NUMS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    
    let bet = 100, selectedBet = null, spinning = false, area;
    let history = [];
    
    // Animation state
    let wheelAngle = 0;
    let ballAngle = 0;
    let ballRadius = 0; // Distance from center
    let animFrame = null;
    let spinResult = -1;

    function isRed(n) { return RED_NUMS.includes(n); }
    function getColor(n) { return n === 0 ? '#22c55e' : (isRed(n) ? '#ef4444' : '#1e293b'); }

    function init(gameArea) {
        area = gameArea;
        renderUI();
        drawStaticWheel();
    }

    function renderUI() {
        area.innerHTML = `
            <div class="roulette-game" style="display:flex; flex-direction:column; align-items:center;">
                
                <div style="display:flex; gap:24px; flex-wrap:wrap; justify-content:center; width:100%; margin-bottom:20px;">
                    <!-- Wheel Canvas -->
                    <div style="position:relative; width:300px; height:300px;">
                        <canvas id="r-canvas" width="300" height="300" style="width:100%; height:100%; drop-shadow(0 0 20px rgba(212,168,67,0.2));"></canvas>
                        <div class="roulette-pointer" style="top:-10px;">▼</div>
                    </div>
                    
                    <!-- Bet History -->
                    <div style="background:var(--bg-card); border:1px solid var(--glass-border); border-radius:12px; padding:16px; min-width:140px; display:flex; flex-direction:column;">
                        <h4 style="color:var(--text-secondary); margin-bottom:12px; font-size:12px; text-transform:uppercase; letter-spacing:1px; text-align:center;">History</h4>
                        <div id="r-history" style="display:flex; flex-direction:column; gap:6px; flex:1; justify-content:flex-start; align-items:center;">
                            ${renderHistory()}
                        </div>
                    </div>
                </div>

                <div class="game-message" id="r-msg" style="min-height:28px; margin-bottom:16px;">Pick a number or outside bet!</div>
                
                <!-- Betting Controls -->
                <div class="game-controls" style="width:100%; max-width:600px; padding:12px; margin-bottom:16px;">
                    <div class="bet-group" style="justify-content:center;">
                        <span class="bet-label">Bet</span>
                        <button class="bet-btn" onclick="Casino.games.roulette._setBet(50)">$50</button>
                        <button class="bet-btn" onclick="Casino.games.roulette._setBet(100)">$100</button>
                        <button class="bet-btn" onclick="Casino.games.roulette._setBet(250)">$250</button>
                        <button class="bet-btn" onclick="Casino.games.roulette._setBet(500)">$500</button>
                    </div>
                    <button class="action-btn primary" id="r-spin-btn" onclick="Casino.games.roulette._spin()" style="margin-left:auto;">SPIN — $${bet}</button>
                </div>

                <!-- Number Grid (Inside Bets) -->
                <div style="display:flex; margin-bottom:8px; width:100%; max-width:600px;">
                    <!-- Zero -->
                    <button class="r-grid-btn" data-bet="0" style="width:60px; border-radius:8px 0 0 8px; border-color:#22c55e; color:#22c55e;">0</button>
                    
                    <!-- 1-36 Grid -->
                    <div style="display:grid; grid-template-columns:repeat(12, 1fr); grid-template-rows:repeat(3, 1fr); flex:1; gap:2px; margin-left:2px;">
                        ${[3,6,9,12,15,18,21,24,27,30,33,36].map(n => `<button class="r-grid-btn" data-bet="${n}" style="border-color:${getColor(n)}; color:${getColor(n)}">${n}</button>`).join('')}
                        ${[2,5,8,11,14,17,20,23,26,29,32,35].map(n => `<button class="r-grid-btn" data-bet="${n}" style="border-color:${getColor(n)}; color:${getColor(n)}">${n}</button>`).join('')}
                        ${[1,4,7,10,13,16,19,22,25,28,31,34].map(n => `<button class="r-grid-btn" data-bet="${n}" style="border-color:${getColor(n)}; color:${getColor(n)}">${n}</button>`).join('')}
                    </div>
                </div>

                <!-- Outside Bets -->
                <div style="display:flex; flex-direction:column; gap:4px; width:100%; max-width:600px; padding-left:62px;">
                    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:4px;">
                        <button class="r-out-btn" data-bet="1st12">1st 12</button>
                        <button class="r-out-btn" data-bet="2nd12">2nd 12</button>
                        <button class="r-out-btn" data-bet="3rd12">3rd 12</button>
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:4px;">
                        <button class="r-out-btn" data-bet="low">1-18</button>
                        <button class="r-out-btn" data-bet="even">Even</button>
                        <button class="r-out-btn" data-bet="red" style="color:#ef4444; font-size:18px;">♦</button>
                        <button class="r-out-btn" data-bet="black" style="color:#94a3b8; font-size:18px;">♠</button>
                        <button class="r-out-btn" data-bet="odd">Odd</button>
                        <button class="r-out-btn" data-bet="high">19-36</button>
                    </div>
                </div>
            </div>`;
            
        // Inject styles for grid
        if (!document.getElementById('roulette-styles')) {
            const style = document.createElement('style');
            style.id = 'roulette-styles';
            style.textContent = `
                .r-grid-btn { background:var(--glass-bg); border:1px solid; border-radius:4px; font-weight:700; font-size:14px; cursor:pointer; transition:all 0.2s; }
                .r-grid-btn:hover { background:var(--bg-card-hover); filter:brightness(1.5); }
                .r-grid-btn.active { background:var(--gold); color:#000 !important; border-color:var(--gold) !important; transform:scale(1.05); z-index:10; box-shadow:0 0 10px var(--gold); }
                .r-out-btn { background:var(--glass-bg); border:1px solid var(--glass-border); border-radius:6px; padding:10px 0; font-weight:600; color:var(--text); cursor:pointer; transition:all 0.2s; font-size:13px;}
                .r-out-btn:hover { border-color:var(--gold); }
                .r-out-btn.active { background:rgba(212,168,67,0.2); border-color:var(--gold); color:var(--gold); box-shadow:inset 0 0 10px rgba(212,168,67,0.2); }
            `;
            document.head.appendChild(style);
        }

        // Attach listeners
        document.querySelectorAll('.r-grid-btn, .r-out-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (spinning) return;
                document.querySelectorAll('.r-grid-btn, .r-out-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedBet = btn.dataset.bet;
                Casino.playSound('click');
            });
        });
    }

    function drawStaticWheel() {
        const canvas = document.getElementById('r-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const cx = 150, cy = 150, r = 140;
        
        ctx.clearRect(0,0,300,300);
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(wheelAngle);
        
        // Draw segments
        const segAngle = (Math.PI * 2) / 37;
        for (let i = 0; i < 37; i++) {
            const num = NUMBERS[i];
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, r, i * segAngle - segAngle/2, (i+1) * segAngle - segAngle/2);
            ctx.fillStyle = getColor(num);
            ctx.fill();
            ctx.stroke();
            
            // Draw numbers
            ctx.save();
            ctx.rotate(i * segAngle);
            ctx.translate(0, -r + 20);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(num.toString(), 0, 0);
            ctx.restore();
        }
        
        // Center hub
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI*2);
        ctx.fillStyle = '#1e293b';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#d4a843'; // gold
        ctx.stroke();
        
        // Inner detail
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI*2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        
        // Gold rim
        ctx.restore();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI*2);
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#d4a843';
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#a07830';
        ctx.stroke();
        
        // Draw Ball
        if (ballRadius > 0) {
            ctx.beginPath();
            const bx = cx + Math.cos(ballAngle) * ballRadius;
            const by = cy + Math.sin(ballAngle) * ballRadius;
            ctx.arc(bx, by, 6, 0, Math.PI*2);
            ctx.fillStyle = '#f8fafc'; // white ball
            ctx.fill();
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;
            ctx.stroke();
            ctx.shadowColor = 'transparent'; // reset
        }
    }

    function renderHistory() {
        if (history.length === 0) return '<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:10px;">No spins yet</div>';
        return history.map(n => `
            <div style="width:32px; height:32px; border-radius:50%; background:${getColor(n)}; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:14px; border:2px solid rgba(255,255,255,0.1); box-shadow:0 2px 5px rgba(0,0,0,0.3);">
                ${n}
            </div>
        `).join('');
    }

    function updateHistory(n) {
        history.unshift(n);
        if (history.length > 5) history.pop();
        const el = document.getElementById('r-history');
        if (el) el.innerHTML = renderHistory();
    }

    function setBet(b) { 
        if (spinning) return;
        bet = b; 
        document.getElementById('r-spin-btn').textContent = `SPIN — $${b}`; 
        Casino.playSound('click'); 
    }

    function spin() {
        if (spinning) return;
        if (!selectedBet) { msg('Select a number or outside bet first!', ''); return; }
        if (!Casino.placeBet(bet)) { msg('Not enough chips!', 'lose'); return; }
        
        spinning = true;
        document.getElementById('r-spin-btn').disabled = true;
        msg('Spinning...', '');
        Casino.playSound('click'); // spin sound trigger

        spinResult = Math.floor(Math.random() * 37);
        
        // Animation config
        const duration = 5000; // 5 seconds
        const startTime = performance.now();
        
        // Target angle logic
        const index = NUMBERS.indexOf(spinResult);
        const segAngle = (Math.PI * 2) / 37;
        const targetWheelAngle = -(index * segAngle); // Where the wheel should stop
        
        // Starting states
        const startWheelAngle = wheelAngle;
        const startBallAngle = 0;
        
        // Ticks for sound
        let lastTick = 0;

        function animate(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease out cubic
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            // Wheel spins clockwise 3 times
            wheelAngle = startWheelAngle + (Math.PI * 2 * 3 * easeOut) + (targetWheelAngle - startWheelAngle) * progress;
            
            // Ball spins counter-clockwise fast, slows down, moves inward
            // 8 full rotations
            ballAngle = startBallAngle - (Math.PI * 2 * 8 * easeOut);
            
            // Ball radius moves from outer rim (130) to inner slots (100)
            if (progress < 0.7) {
                ballRadius = 130; // Outer rim
            } else {
                // Drop in
                const dropProgress = (progress - 0.7) / 0.3;
                ballRadius = 130 - (30 * dropProgress); // Move to 100
                
                // Match ball angle to wheel slot angle at the end
                const finalBallAngle = targetWheelAngle - Math.PI/2; // -90deg to align with top pointer
                ballAngle = ballAngle * (1-dropProgress) + finalBallAngle * dropProgress;
            }

            drawStaticWheel();
            
            // Ticking sound
            if (progress < 0.8 && elapsed - lastTick > 150 + (progress * 200)) {
                Casino.playSound('click');
                lastTick = elapsed;
            }

            if (progress < 1) {
                animFrame = requestAnimationFrame(animate);
            } else {
                finalizeSpin();
            }
        }
        
        animFrame = requestAnimationFrame(animate);
    }

    function finalizeSpin() {
        updateHistory(spinResult);
        
        let won = checkWin(spinResult);
        if (won > 0) {
            Casino.changeBalance(won); // `won` includes bet if they win
            msg(`Result: ${spinResult} — You win $${won.toLocaleString()}!`, 'win');
            Casino.playSound(won >= bet * 10 ? 'jackpot' : 'win');
            if (won >= 500) Casino.showWinEffect(won);
        } else {
            msg(`Result: ${spinResult} — No win.`, 'lose');
            Casino.playSound('lose');
        }
        
        spinning = false;
        document.getElementById('r-spin-btn').disabled = false;
    }

    function checkWin(n) {
        // Returns total payout INCLUDING original bet
        // e.g. Straight up pays 35:1, returns bet * 36
        const isStr = selectedBet.toString();
        
        if (isStr === n.toString()) return bet * 36; // Straight up (0-36)
        
        switch(selectedBet) {
            case 'red': return n > 0 && isRed(n) ? bet * 2 : 0;
            case 'black': return n > 0 && !isRed(n) ? bet * 2 : 0;
            case 'odd': return n > 0 && n % 2 === 1 ? bet * 2 : 0;
            case 'even': return n > 0 && n % 2 === 0 ? bet * 2 : 0;
            case 'low': return n >= 1 && n <= 18 ? bet * 2 : 0;
            case 'high': return n >= 19 && n <= 36 ? bet * 2 : 0;
            case '1st12': return n >= 1 && n <= 12 ? bet * 3 : 0;
            case '2nd12': return n >= 13 && n <= 24 ? bet * 3 : 0;
            case '3rd12': return n >= 25 && n <= 36 ? bet * 3 : 0;
            default: return 0;
        }
    }

    function msg(text, type) {
        const el = document.getElementById('r-msg');
        if(el) {
            el.textContent = text;
            el.className = 'game-message ' + (type || '');
        }
    }

    function destroy() { 
        spinning = false; 
        if (animFrame) cancelAnimationFrame(animFrame);
    }

    Casino.games.roulette = { init, destroy, _spin: spin, _setBet: setBet };
})();
