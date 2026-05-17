/* Crash Game */
(function() {
    let bet = 100, running = false, crashed = false, multiplier = 1, crashPoint, animId, canvas, ctx, area;
    let graphData = [];

    function init(gameArea) {
        area = gameArea;
        area.innerHTML = `
            <div class="crash-game">
                <div class="crash-display">
                    <div class="crash-multiplier rising" id="cr-mult">1.00x</div>
                    <canvas class="crash-graph" id="cr-graph" width="800" height="200"></canvas>
                    <div class="crash-status" id="cr-status">Place your bet and launch!</div>
                </div>
                <div class="game-message" id="cr-msg"></div>
                <div class="game-controls">
                    <div class="bet-group">
                        <span class="bet-label">Bet</span>
                        <button class="bet-btn" onclick="Casino.games.crash._setBet(50)">$50</button>
                        <button class="bet-btn" onclick="Casino.games.crash._setBet(100)">$100</button>
                        <button class="bet-btn" onclick="Casino.games.crash._setBet(250)">$250</button>
                        <button class="bet-btn" onclick="Casino.games.crash._setBet(500)">$500</button>
                    </div>
                    <button class="action-btn primary" id="cr-btn" onclick="Casino.games.crash._action()">LAUNCH — $${bet}</button>
                </div>
            </div>`;
        canvas = document.getElementById('cr-graph');
        ctx = canvas.getContext('2d');
        drawEmptyGraph();
    }

    function setBet(b) {
        if (!running) { bet = b; document.getElementById('cr-btn').textContent = `LAUNCH — $${b}`; Casino.playSound('click'); }
    }

    function action() {
        if (!running && !crashed) startRound();
        else if (running && !crashed) cashOut();
    }

    function startRound() {
        if (!Casino.placeBet(bet)) { msg('Not enough chips!', 'lose'); return; }
        running = true; crashed = false; multiplier = 1; graphData = [];
        crashPoint = Math.max(1.01, 0.99 / Math.random());
        if (Math.random() < 0.02) crashPoint = Math.max(crashPoint, 10 + Math.random() * 40);
        const btn = document.getElementById('cr-btn');
        btn.textContent = 'CASH OUT';
        btn.className = 'action-btn success';
        document.getElementById('cr-mult').className = 'crash-multiplier rising';
        msg('', '');
        document.getElementById('cr-status').textContent = 'Rising...';
        Casino.playSound('click');
        let startTime = performance.now();
        function tick() {
            const elapsed = (performance.now() - startTime) / 1000;
            multiplier = Math.pow(Math.E, elapsed * 0.5);
            if (multiplier >= crashPoint) {
                multiplier = crashPoint;
                crash();
                return;
            }
            graphData.push(multiplier);
            updateDisplay();
            animId = requestAnimationFrame(tick);
        }
        animId = requestAnimationFrame(tick);
    }

    function cashOut() {
        if (!running || crashed) return;
        running = false;
        cancelAnimationFrame(animId);
        const winnings = Math.floor(bet * multiplier);
        Casino.changeBalance(winnings);
        document.getElementById('cr-mult').className = 'crash-multiplier cashed';
        document.getElementById('cr-status').textContent = `Cashed out at ${multiplier.toFixed(2)}x`;
        msg(`You won $${winnings.toLocaleString()}!`, 'win');
        Casino.playSound(multiplier >= 5 ? 'jackpot' : 'win');
        if (winnings >= 500) Casino.showWinEffect(winnings);
        resetBtn();
    }

    function crash() {
        running = false; crashed = true;
        cancelAnimationFrame(animId);
        graphData.push(multiplier);
        updateDisplay();
        document.getElementById('cr-mult').textContent = `${crashPoint.toFixed(2)}x`;
        document.getElementById('cr-mult').className = 'crash-multiplier crashed';
        document.getElementById('cr-status').textContent = `Crashed at ${crashPoint.toFixed(2)}x!`;
        msg('💥 Crashed! You lost.', 'lose');
        Casino.playSound('lose');
        setTimeout(() => { crashed = false; resetBtn(); }, 1500);
    }

    function resetBtn() {
        const btn = document.getElementById('cr-btn');
        btn.textContent = `LAUNCH — $${bet}`;
        btn.className = 'action-btn primary';
    }

    function updateDisplay() {
        document.getElementById('cr-mult').textContent = `${multiplier.toFixed(2)}x`;
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
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(0, h - (h/5)*i); ctx.lineTo(w, h - (h/5)*i); ctx.stroke(); }
        if (graphData.length < 2) return;
        const maxMult = Math.max(2, ...graphData) * 1.1;
        const xStep = w / Math.max(graphData.length, 100);
        const gradient = ctx.createLinearGradient(0, h, 0, 0);
        gradient.addColorStop(0, '#22c55e');
        gradient.addColorStop(0.5, '#f59e0b');
        gradient.addColorStop(1, '#ef4444');
        ctx.strokeStyle = crashed ? '#ef4444' : gradient;
        ctx.lineWidth = 3;
        ctx.beginPath();
        graphData.forEach((v, i) => {
            const x = i * xStep;
            const y = h - ((v - 1) / (maxMult - 1)) * h;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.strokeStyle = 'rgba(34,197,94,0.1)';
        ctx.lineWidth = 1;
        ctx.lineTo(graphData.length * xStep, h);
        ctx.lineTo(0, h);
        ctx.fillStyle = crashed ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)';
        ctx.fill();
    }

    function msg(t, type) { const el = document.getElementById('cr-msg'); el.textContent = t; el.className = 'game-message ' + (type||''); }

    function destroy() { running = false; crashed = false; cancelAnimationFrame(animId); }

    Casino.games.crash = { init, destroy, _action: action, _setBet: setBet };
})();
