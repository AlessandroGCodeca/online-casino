/* Plinko — Canvas-based ball drop with risk levels */
(function() {
    let bet = 100, rows = 12, risk = 'medium', area, canvas, ctx, animId;
    let balls = [], pegs = [], slots = [], sparks = [];
    let dropping = false;

    /* Spawn a burst of spark particles for peg hits / slot landings. */
    function spawnSparks(x, y, count, color, upward) {
        for (let i = 0; i < count; i++) {
            const angle = upward
                ? -Math.PI / 2 + (Math.random() - 0.5) * Math.PI
                : Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * (upward ? 5.5 : 3);
            sparks.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - (upward ? 1.5 : 0),
                life: 1,
                color: color,
                size: 1.5 + Math.random() * 3
            });
        }
        if (sparks.length > 260) sparks.splice(0, sparks.length - 260);
    }

    const RISKS = {
        low:    { 8: [3, 2, 1.2, 0.9, 0.4, 0.9, 1.2, 2, 3],
                 12: [5, 2.5, 1.5, 1.1, 0.7, 0.5, 0.3, 0.5, 0.7, 1.1, 1.5, 2.5, 5],
                 16: [10, 5, 2.5, 1.5, 1.1, 0.9, 0.6, 0.4, 0.2, 0.4, 0.6, 0.9, 1.1, 1.5, 2.5, 5, 10] },
        medium: { 8: [15, 3, 1.2, 0.7, 0.3, 0.7, 1.2, 3, 15],
                 12: [29, 10, 4, 1.5, 0.9, 0.5, 0.3, 0.5, 0.9, 1.5, 4, 10, 29],
                 16: [110, 35, 12, 4, 1.5, 0.9, 0.5, 0.3, 0.2, 0.3, 0.5, 0.9, 1.5, 4, 12, 35, 110] },
        high:   { 8: [25, 5, 1, 0.3, 0.1, 0.3, 1, 5, 25],
                 12: [120, 25, 5, 1.5, 0.6, 0.3, 0.1, 0.3, 0.6, 1.5, 5, 25, 120],
                 16: [500, 100, 25, 5, 1, 0.5, 0.3, 0.1, 0.05, 0.1, 0.3, 0.5, 1, 5, 25, 100, 500] }
    };

    const PEG_R = 4, BALL_R = 7;
    const GRAVITY = 0.25, BOUNCE = 0.6, FRICTION = 0.99;

    function init(gameArea) {
        area = gameArea;
        renderUI();
        setupCanvas();
        buildPegs();
        drawFrame();
    }

    function renderUI() {
        const mults = getMultipliers();
        area.innerHTML = `
            <div style="text-align:center;">
                <canvas id="plinko-canvas" width="600" height="500" style="width:100%;max-width:600px;height:auto;display:block;margin:0 auto;border-radius:var(--radius-lg);border:1px solid var(--glass-border);background:linear-gradient(180deg, rgba(10,14,26,0.95), rgba(13,5,32,0.95));"></canvas>
                
                <div class="game-message" id="pl-msg" style="min-height:28px;margin-top:12px;">Drop a ball!</div>
                
                <div class="game-controls" style="flex-wrap:wrap;justify-content:center;">
                    <div class="bet-group">
                        <span class="bet-label">Bet</span>
                        <button class="bet-btn" onclick="Casino.games.plinko._setBet(50)">$50</button>
                        <button class="bet-btn" onclick="Casino.games.plinko._setBet(100)">$100</button>
                        <button class="bet-btn" onclick="Casino.games.plinko._setBet(250)">$250</button>
                        <button class="bet-btn" onclick="Casino.games.plinko._setBet(500)">$500</button>
                    </div>
                    <div class="bet-group">
                        <span class="bet-label">Rows</span>
                        <button class="bet-btn ${rows===8?'active':''}" style="${rows===8?'background:var(--gold);color:#000;':''}" onclick="Casino.games.plinko._setRows(8)">8</button>
                        <button class="bet-btn ${rows===12?'active':''}" style="${rows===12?'background:var(--gold);color:#000;':''}" onclick="Casino.games.plinko._setRows(12)">12</button>
                        <button class="bet-btn ${rows===16?'active':''}" style="${rows===16?'background:var(--gold);color:#000;':''}" onclick="Casino.games.plinko._setRows(16)">16</button>
                    </div>
                    <div class="bet-group">
                        <span class="bet-label">Risk</span>
                        <button class="bet-btn ${risk==='low'?'active':''}" style="${risk==='low'?'background:var(--green);color:#000;':''}" onclick="Casino.games.plinko._setRisk('low')">Low</button>
                        <button class="bet-btn ${risk==='medium'?'active':''}" style="${risk==='medium'?'background:var(--orange);color:#000;':''}" onclick="Casino.games.plinko._setRisk('medium')">Med</button>
                        <button class="bet-btn ${risk==='high'?'active':''}" style="${risk==='high'?'background:var(--red);color:#fff;':''}" onclick="Casino.games.plinko._setRisk('high')">High</button>
                    </div>
                    <button class="action-btn primary" id="pl-drop-btn" onclick="Casino.games.plinko._drop()">DROP — $${bet}</button>
                </div>
            </div>`;
    }

    function getMultipliers() { return RISKS[risk][rows]; }

    function setupCanvas() {
        canvas = document.getElementById('plinko-canvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
    }

    function buildPegs() {
        pegs = [];
        slots = [];
        const w = 600, h = 500;
        const startY = 60;
        const endY = h - 60;
        const rowGap = (endY - startY) / rows;
        const centerX = w / 2;

        for (let r = 0; r < rows; r++) {
            const numPegs = r + 3;
            const spacing = (w - 80) / (numPegs - 1);
            const rowStartX = centerX - (spacing * (numPegs - 1)) / 2;
            const y = startY + r * rowGap;
            for (let p = 0; p < numPegs; p++) {
                pegs.push({ x: rowStartX + p * spacing, y: y });
            }
        }

        // Build slot positions (bottom)
        const mults = getMultipliers();
        const numSlots = mults.length;
        const slotWidth = (w - 40) / numSlots;
        for (let s = 0; s < numSlots; s++) {
            slots.push({
                x: 20 + s * slotWidth,
                w: slotWidth,
                y: endY + 5,
                mult: mults[s]
            });
        }
    }

    function setBet(b) { if (!dropping) { bet = b; renderUI(); setupCanvas(); buildPegs(); drawFrame(); Casino.playSound('click'); } }
    function setRows(r) { if (!dropping) { rows = r; renderUI(); setupCanvas(); buildPegs(); drawFrame(); Casino.playSound('click'); } }
    function setRisk(r) { if (!dropping) { risk = r; renderUI(); setupCanvas(); buildPegs(); drawFrame(); Casino.playSound('click'); } }

    function drop() {
        if (!Casino.placeBet(bet)) {
            const m = document.getElementById('pl-msg');
            if(m) { m.textContent = 'Not enough chips!'; m.className = 'game-message lose'; }
            return;
        }
        Casino.playSound('click');

        // Create ball at top center with tiny random offset
        const ball = {
            x: 300 + (Math.random() - 0.5) * 20,
            y: 10,
            vx: 0,
            vy: 0,
            active: true,
            bet: bet,
            trail: []
        };
        balls.push(ball);

        const m = document.getElementById('pl-msg');
        if (m) { m.textContent = 'Dropping...'; m.className = 'game-message'; }

        if (!dropping) {
            dropping = true;
            animate();
        }
    }

    function animate() {
        if (!canvas) return;
        let anyActive = false;

        balls.forEach(ball => {
            if (!ball.active) return;
            anyActive = true;

            // Gravity
            ball.vy += GRAVITY;
            ball.vx *= FRICTION;

            ball.x += ball.vx;
            ball.y += ball.vy;

            // Trail
            ball.trail.push({ x: ball.x, y: ball.y });
            if (ball.trail.length > 12) ball.trail.shift();

            // Peg collision
            pegs.forEach(peg => {
                const dx = ball.x - peg.x;
                const dy = ball.y - peg.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = PEG_R + BALL_R;
                if (dist < minDist) {
                    // Bounce
                    const angle = Math.atan2(dy, dx);
                    const overlap = minDist - dist;
                    ball.x += Math.cos(angle) * overlap;
                    ball.y += Math.sin(angle) * overlap;

                    // Reflect velocity
                    const nx = Math.cos(angle);
                    const ny = Math.sin(angle);
                    const dot = ball.vx * nx + ball.vy * ny;
                    ball.vx -= 2 * dot * nx * BOUNCE;
                    ball.vy -= 2 * dot * ny * BOUNCE;

                    // Add randomness on each bounce
                    ball.vx += (Math.random() - 0.5) * 1.5;

                    // Light the peg up briefly + spark particles.
                    peg.litUntil = Date.now() + 220;
                    spawnSparks(peg.x, peg.y, 4, '#fde047');

                    // Tick sound (single shared AudioContext via Casino.playTones).
                    if (Casino.playTones) {
                        Casino.playTones([{
                            freq: 800 + Math.random() * 400,
                            wave: 'sine',
                            dur: 0.03,
                            vol: 0.02
                        }]);
                    }
                }
            });

            // Wall bounce
            if (ball.x < BALL_R + 10) { ball.x = BALL_R + 10; ball.vx = Math.abs(ball.vx) * BOUNCE; }
            if (ball.x > 590 - BALL_R) { ball.x = 590 - BALL_R; ball.vx = -Math.abs(ball.vx) * BOUNCE; }

            // Check if landed in slot
            if (ball.y >= slots[0].y) {
                ball.active = false;
                ball.vy = 0;
                ball.vx = 0;
                ball.landedTime = Date.now();

                // Find which slot
                let slotIdx = 0;
                for (let s = 0; s < slots.length; s++) {
                    if (ball.x >= slots[s].x && ball.x < slots[s].x + slots[s].w) {
                        slotIdx = s;
                        break;
                    }
                }
                const mult = slots[slotIdx].mult;
                const winnings = Math.floor(ball.bet * mult);

                ball.landedSlot = slotIdx;

                // Landing burst — color + intensity scale with the multiplier.
                const slot = slots[slotIdx];
                const burstColor = mult >= 10 ? '#ef4444' : mult >= 3 ? '#f59e0b' : mult >= 1 ? '#22c55e' : '#6b7280';
                const burstCount = mult >= 10 ? 26 : mult >= 3 ? 18 : mult >= 1 ? 12 : 6;
                spawnSparks(slot.x + slot.w / 2, slot.y, burstCount, burstColor, true);
                slot.litUntil = Date.now() + 500;

                if (winnings > 0) {
                    Casino.changeBalance(winnings);
                }

                const m = document.getElementById('pl-msg');
                if (m) {
                    if (mult >= 5) {
                        m.textContent = `🎉 ${mult}x! Won $${winnings.toLocaleString()}!`;
                        m.className = 'game-message win';
                        Casino.playSound('jackpot');
                        if (winnings >= 500) Casino.showWinEffect(winnings, { bet: ball.bet, particles: ['🟢','🟡','🔴','💰','✨','⚪'], accent: '#22c55e', themeLabel: 'Plinko' });
                    } else if (mult >= 1) {
                        m.textContent = `${mult}x — Won $${winnings}`;
                        m.className = 'game-message win';
                        Casino.playSound('win');
                    } else {
                        m.textContent = `${mult}x — Lost $${Math.floor(ball.bet * (1 - mult))}`;
                        m.className = 'game-message lose';
                        Casino.playSound('lose');
                    }
                }
            }
        });

        // Update spark particles.
        sparks.forEach(s => {
            s.vy += 0.16;
            s.x += s.vx;
            s.y += s.vy;
            s.life -= 0.035;
        });
        sparks = sparks.filter(s => s.life > 0);

        // Remove balls that have been landed for > 700ms (clear visual clutter).
        const now = Date.now();
        balls = balls.filter(b => b.active || (b.landedTime && now - b.landedTime < 700));

        drawFrame();

        if (anyActive || balls.length > 0 || sparks.length > 0) {
            animId = requestAnimationFrame(animate);
        } else {
            dropping = false;
        }
    }

    function drawFrame() {
        if (!ctx || !canvas) return;
        const w = 600, h = 500;
        ctx.clearRect(0, 0, w, h);

        // Draw pegs — recently-hit pegs flash white and glow.
        const nowT = Date.now();
        pegs.forEach(peg => {
            const lit = peg.litUntil && nowT < peg.litUntil;
            ctx.beginPath();
            ctx.arc(peg.x, peg.y, lit ? PEG_R + 2 : PEG_R, 0, Math.PI * 2);
            ctx.fillStyle = lit ? '#fff' : '#d4a843';
            ctx.shadowColor = lit ? 'rgba(253,224,71,0.95)' : 'rgba(212,168,67,0.3)';
            ctx.shadowBlur = lit ? 16 : 6;
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        // Draw slots
        const mults = getMultipliers();
        slots.forEach((slot, i) => {
            const mult = slot.mult;
            let color;
            if (mult >= 10) color = '#ef4444';
            else if (mult >= 3) color = '#f59e0b';
            else if (mult >= 1) color = '#22c55e';
            else color = '#6b7280';

            const lit = slot.litUntil && nowT < slot.litUntil;

            // Slot background — brightens briefly after a landing.
            ctx.fillStyle = color + (lit ? 'aa' : '22');
            ctx.fillRect(slot.x + 1, slot.y, slot.w - 2, 35);

            // Slot border
            ctx.strokeStyle = lit ? color : color + '66';
            ctx.lineWidth = lit ? 2 : 1;
            if (lit) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
            ctx.strokeRect(slot.x + 1, slot.y, slot.w - 2, 35);
            ctx.shadowBlur = 0;

            // Multiplier text
            ctx.fillStyle = color;
            ctx.font = `bold ${mults.length > 13 ? 10 : 12}px Inter`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(mult + 'x', slot.x + slot.w / 2, slot.y + 18);
        });

        // Draw balls
        const now = Date.now();
        balls.forEach(ball => {
            // Fade out landed balls in the last 300ms before they're removed (700ms total lifetime).
            let alpha = 1;
            if (!ball.active && ball.landedTime) {
                const sinceLanded = now - ball.landedTime;
                if (sinceLanded > 400) alpha = Math.max(0, 1 - (sinceLanded - 400) / 300);
            }
            if (alpha <= 0) return;
            ctx.globalAlpha = alpha;

            // Trail
            if (ball.trail && ball.trail.length > 1) {
                ctx.beginPath();
                ctx.moveTo(ball.trail[0].x, ball.trail[0].y);
                ball.trail.forEach((p, i) => {
                    if (i > 0) ctx.lineTo(p.x, p.y);
                });
                ctx.strokeStyle = 'rgba(240,208,96,0.15)';
                ctx.lineWidth = BALL_R * 1.5;
                ctx.lineCap = 'round';
                ctx.stroke();
            }

            // Ball
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
            const grad = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, BALL_R);
            grad.addColorStop(0, '#fff');
            grad.addColorStop(0.4, '#f0d060');
            grad.addColorStop(1, '#a07830');
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.shadowColor = 'rgba(240,208,96,0.4)';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;

        // Draw spark particles.
        sparks.forEach(s => {
            ctx.globalAlpha = Math.max(0, s.life);
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size * Math.max(0.3, s.life), 0, Math.PI * 2);
            ctx.fillStyle = s.color;
            ctx.shadowColor = s.color;
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
        });
        ctx.globalAlpha = 1;
    }

    function destroy() {
        dropping = false;
        balls = [];
        sparks = [];
        cancelAnimationFrame(animId);
    }

    Casino.games.plinko = { init, destroy, _drop: drop, _setBet: setBet, _setRows: setRows, _setRisk: setRisk };
})();
