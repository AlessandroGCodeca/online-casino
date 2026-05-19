/* Crash Game — Upgraded with History and Auto-Cashout */
(function() {
    let bet = 100, autoCashout = 2.0, useAutoCashout = false;
    let running = false, crashed = false, multiplier = 1, crashPoint, animId, canvas, ctx, area;
    let graphData = [];
    let history = []; // stores last crash points

    function init(gameArea) {
        area = gameArea;
        renderUI();
        canvas = document.getElementById('cr-graph');
        ctx = canvas.getContext('2d');
        drawEmptyGraph();
    }

    function renderUI() {
        area.innerHTML = `
            <div class="crash-game" style="display:flex; flex-direction:column; align-items:center;">
                <!-- History Strip -->
                <div style="width:100%; max-width:800px; display:flex; justify-content:flex-end; gap:8px; margin-bottom:12px; overflow:hidden;" id="cr-history">
                    ${renderHistory()}
                </div>

                <div class="crash-display" style="width:100%; max-width:800px;">
                    <div class="crash-multiplier rising" id="cr-mult">1.00x</div>
                    <canvas class="crash-graph" id="cr-graph" width="800" height="250"></canvas>
                    <div class="crash-status" id="cr-status">Place your bet and launch!</div>
                </div>
                
                <div class="game-message" id="cr-msg" style="min-height:28px;"></div>
                
                <div class="game-controls" style="width:100%; max-width:800px; justify-content:space-between; flex-wrap:wrap; gap:20px;">
                    <!-- Bet Control -->
                    <div class="bet-group" style="flex:1; min-width:280px; justify-content:center;">
                        <span class="bet-label">Bet</span>
                        <button class="bet-btn" onclick="Casino.games.crash._setBet(50)">$50</button>
                        <button class="bet-btn" onclick="Casino.games.crash._setBet(100)">$100</button>
                        <button class="bet-btn" onclick="Casino.games.crash._setBet(250)">$250</button>
                        <button class="bet-btn" onclick="Casino.games.crash._setBet(500)">$500</button>
                    </div>
                    
                    <!-- Auto Cashout Control -->
                    <div style="flex:1; min-width:280px; display:flex; align-items:center; justify-content:center; gap:12px; background:var(--bg-card); padding:8px 16px; border-radius:8px; border:1px solid var(--glass-border);">
                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:14px; font-weight:600; color:var(--text-secondary);">
                            <input type="checkbox" id="cr-auto-toggle" onchange="Casino.games.crash._toggleAuto()" ${useAutoCashout ? 'checked' : ''} style="width:16px; height:16px;">
                            Auto Cashout:
                        </label>
                        <input type="number" id="cr-auto-val" value="${autoCashout.toFixed(2)}" step="0.1" min="1.01" max="100" style="width:70px; background:var(--bg-secondary); border:1px solid var(--glass-border); color:var(--gold); border-radius:6px; padding:4px 8px; font-weight:700; text-align:center;" ${useAutoCashout ? '' : 'disabled'} onchange="Casino.games.crash._updateAutoVal(this.value)">
                        <span style="color:var(--text-muted); font-weight:700;">x</span>
                    </div>

                    <!-- Launch Button -->
                    <div style="flex:1; min-width:280px; display:flex; justify-content:center;">
                        <button class="action-btn primary" id="cr-btn" onclick="Casino.games.crash._action()" style="width:100%; max-width:300px;">LAUNCH — $${bet}</button>
                    </div>
                </div>
            </div>`;
    }

    function renderHistory() {
        if (history.length === 0) return '<div style="color:var(--text-muted); font-size:13px; font-weight:600;">No recent crashes</div>';
        return history.map(h => {
            const color = h >= 10 ? 'var(--gold)' : (h >= 2 ? 'var(--green)' : 'var(--red)');
            return `<div style="background:var(--bg-card); border:1px solid ${color}; color:${color}; padding:4px 10px; border-radius:12px; font-weight:800; font-size:13px;">${h.toFixed(2)}x</div>`;
        }).join('');
    }

    function updateHistory(mult) {
        history.unshift(mult);
        if (history.length > 10) history.pop(); // Keep last 10
        const el = document.getElementById('cr-history');
        if (el) el.innerHTML = renderHistory();
    }

    function toggleAuto() {
        useAutoCashout = document.getElementById('cr-auto-toggle').checked;
        document.getElementById('cr-auto-val').disabled = !useAutoCashout;
    }

    function updateAutoVal(val) {
        autoCashout = Math.max(1.01, parseFloat(val) || 2.0);
        document.getElementById('cr-auto-val').value = autoCashout.toFixed(2);
    }

    function setBet(b) {
        if (!running) { 
            bet = b; 
            document.getElementById('cr-btn').textContent = `LAUNCH — $${b}`; 
            Casino.playSound('click'); 
        }
    }

    function action() {
        if (!running && !crashed) startRound();
        else if (running && !crashed) cashOut();
    }

    function startRound() {
        if (!Casino.placeBet(bet)) { msg('Not enough chips!', 'lose'); return; }
        
        running = true; 
        crashed = false; 
        multiplier = 1; 
        graphData = [];
        
        // Generate crash point (1% instant bust, otherwise log-normalish distribution)
        crashPoint = Math.max(1.01, 0.99 / Math.random());
        if (Math.random() < 0.01) crashPoint = 1.00; // 1% chance of instant crash
        else if (Math.random() < 0.05) crashPoint = Math.max(crashPoint, 10 + Math.random() * 90); // 5% moon chance
        
        const btn = document.getElementById('cr-btn');
        btn.textContent = 'CASH OUT';
        btn.className = 'action-btn success';
        document.getElementById('cr-mult').className = 'crash-multiplier rising';
        document.getElementById('cr-mult').textContent = '1.00x';
        msg('', '');
        document.getElementById('cr-status').textContent = 'Rising...';
        
        Casino.playSound('click');
        let startTime = performance.now();
        
        function tick() {
            if (!running) return;
            const elapsed = (performance.now() - startTime) / 1000;
            
            // Equation for multiplier growth: e^(t * rate)
            // Rate increases slightly over time to make it curve up faster
            const rate = 0.3 + (elapsed * 0.02); 
            multiplier = Math.pow(Math.E, elapsed * rate);
            
            // Check Auto Cashout
            if (useAutoCashout && multiplier >= autoCashout) {
                multiplier = autoCashout;
                cashOut(true);
                return;
            }

            if (multiplier >= crashPoint) {
                multiplier = crashPoint;
                crash();
                return;
            }
            
            graphData.push({time: elapsed, mult: multiplier});
            updateDisplay();
            
            // Sound effect ticking (pitch goes up with multiplier)
            if (elapsed % 0.5 < 0.05) {
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain); gain.connect(ctx.destination);
                    osc.frequency.value = 200 + (multiplier * 50);
                    gain.gain.setValueAtTime(0.02, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
                    osc.start(); osc.stop(ctx.currentTime + 0.1);
                } catch(e) {}
            }

            animId = requestAnimationFrame(tick);
        }
        
        if (crashPoint === 1.00) crash(); // Instant bust
        else animId = requestAnimationFrame(tick);
    }

    function cashOut(isAuto = false) {
        if (!running || crashed) return;
        running = false;
        cancelAnimationFrame(animId);
        
        const winnings = Math.floor(bet * multiplier);
        Casino.changeBalance(winnings);
        
        document.getElementById('cr-mult').className = 'crash-multiplier cashed';
        document.getElementById('cr-status').textContent = `${isAuto ? 'Auto-' : ''}Cashed out at ${multiplier.toFixed(2)}x`;
        msg(`You won $${winnings.toLocaleString()}!`, 'win');
        
        Casino.playSound(multiplier >= 5 ? 'jackpot' : 'win');
        if (winnings >= bet * 5) Casino.showWinEffect(winnings, { bet, particles: ['🚀','💥','⭐','🔥','💰','✨'], accent: '#f97316', themeLabel: 'Crash' });
        
        resetBtn();
        
        // Let graph continue drawing a ghost line until actual crash (visual flair)
        finishGhostGraph();
    }

    function finishGhostGraph() {
        const fakeStart = performance.now();
        const startMult = multiplier;
        const startElapsed = graphData.length > 0 ? graphData[graphData.length-1].time : 0;
        
        function ghostTick() {
            if (crashed) return; // real crash happened
            
            const elapsed = startElapsed + ((performance.now() - fakeStart) / 1000);
            const rate = 0.3 + (elapsed * 0.02);
            let ghostMult = Math.pow(Math.E, elapsed * rate);
            
            if (ghostMult >= crashPoint) {
                ghostMult = crashPoint;
                crash(true); // true = already cashed out, just animate the crash
                return;
            }
            
            graphData.push({time: elapsed, mult: ghostMult, ghost: true});
            drawGraph();
            requestAnimationFrame(ghostTick);
        }
        requestAnimationFrame(ghostTick);
    }

    function crash(wasCashed = false) {
        running = false; 
        crashed = true;
        cancelAnimationFrame(animId);
        
        graphData.push({time: graphData.length>0 ? graphData[graphData.length-1].time + 0.1 : 0, mult: crashPoint, ghost: wasCashed});
        updateDisplay();
        
        document.getElementById('cr-mult').textContent = `${crashPoint.toFixed(2)}x`;
        
        if (!wasCashed) {
            document.getElementById('cr-mult').className = 'crash-multiplier crashed';
            document.getElementById('cr-status').textContent = `Crashed at ${crashPoint.toFixed(2)}x!`;
            msg('💥 Crashed! You lost.', 'lose');
            Casino.playSound('lose');
        } else {
            // Already cashed out, just show it crashed
            document.getElementById('cr-status').textContent += ` (Crashed at ${crashPoint.toFixed(2)}x)`;
        }
        
        updateHistory(crashPoint);
        
        setTimeout(() => { 
            crashed = false; 
            if (!wasCashed) resetBtn(); 
        }, 1500);
    }

    function resetBtn() {
        const btn = document.getElementById('cr-btn');
        if (btn) {
            btn.textContent = `LAUNCH — $${bet}`;
            btn.className = 'action-btn primary';
        }
    }

    function updateDisplay() {
        if (running) document.getElementById('cr-mult').textContent = `${multiplier.toFixed(2)}x`;
        drawGraph();
    }

    function drawEmptyGraph() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, canvas.height); ctx.lineTo(canvas.width, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, canvas.height); ctx.stroke();
    }

    function drawGraph() {
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        
        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) { 
            ctx.beginPath(); ctx.moveTo(0, h - (h/5)*i); ctx.lineTo(w, h - (h/5)*i); ctx.stroke(); 
        }
        
        if (graphData.length < 2) return;
        
        const maxTime = Math.max(graphData[graphData.length-1].time, 5); // min 5s width
        const maxMult = Math.max(2, ...graphData.map(d => d.mult)) * 1.1;
        
        const getX = (t) => (t / maxTime) * w;
        const getY = (m) => h - ((m - 1) / (maxMult - 1)) * h;

        // Draw main line
        const gradient = ctx.createLinearGradient(0, h, 0, 0);
        gradient.addColorStop(0, '#22c55e');
        gradient.addColorStop(0.5, '#f59e0b');
        gradient.addColorStop(1, '#ef4444');
        
        ctx.strokeStyle = crashed ? '#ef4444' : gradient;
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        
        // Main path
        ctx.beginPath();
        let firstGhostIdx = -1;
        
        graphData.forEach((pt, i) => {
            if (pt.ghost && firstGhostIdx === -1) firstGhostIdx = i;
            
            const x = getX(pt.time);
            const y = getY(pt.mult);
            if (i === 0) ctx.moveTo(x, y); 
            else if (!pt.ghost) ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Ghost path (if player cashed out early)
        if (firstGhostIdx !== -1) {
            ctx.beginPath();
            ctx.strokeStyle = crashed ? '#ef4444' : 'rgba(255,255,255,0.2)';
            ctx.setLineDash([5, 5]);
            // start from last real point
            const startPt = graphData[firstGhostIdx - 1] || graphData[0];
            ctx.moveTo(getX(startPt.time), getY(startPt.mult));
            
            for (let i = firstGhostIdx; i < graphData.length; i++) {
                ctx.lineTo(getX(graphData[i].time), getY(graphData[i].mult));
            }
            ctx.stroke();
            ctx.setLineDash([]); // reset
        }

        // Fill under graph (only for real data)
        const realData = graphData.filter(d => !d.ghost);
        if (realData.length > 1) {
            ctx.beginPath();
            ctx.moveTo(getX(realData[0].time), getY(realData[0].mult));
            realData.forEach(pt => ctx.lineTo(getX(pt.time), getY(pt.mult)));
            ctx.lineTo(getX(realData[realData.length-1].time), h);
            ctx.lineTo(0, h);
            
            let fillGrad = ctx.createLinearGradient(0, 0, 0, h);
            fillGrad.addColorStop(0, crashed ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.3)');
            fillGrad.addColorStop(1, 'rgba(0,0,0,0)');
            
            ctx.fillStyle = fillGrad;
            ctx.fill();
        }
    }

    function msg(t, type) { const el = document.getElementById('cr-msg'); if(el){ el.textContent = t; el.className = 'game-message ' + (type||''); } }

    function destroy() { running = false; crashed = false; cancelAnimationFrame(animId); }

    Casino.games.crash = { init, destroy, _action: action, _setBet: setBet, _toggleAuto: toggleAuto, _updateAutoVal: updateAutoVal };
})();
