/* Wheel of Fortune */
(function() {
    let bet = 100, spinning = false, area, rotation = 0;
    const SEGMENTS = [
        { label: '2x', mult: 2, color: '#3b82f6', weight: 30 },
        { label: '3x', mult: 3, color: '#8b5cf6', weight: 20 },
        { label: '5x', mult: 5, color: '#22c55e', weight: 15 },
        { label: '0x', mult: 0, color: '#374151', weight: 10 },
        { label: '2x', mult: 2, color: '#3b82f6', weight: 30 },
        { label: '10x', mult: 10, color: '#f59e0b', weight: 8 },
        { label: '0x', mult: 0, color: '#374151', weight: 10 },
        { label: '3x', mult: 3, color: '#8b5cf6', weight: 20 },
        { label: '1x', mult: 1, color: '#6b7280', weight: 35 },
        { label: '50x', mult: 50, color: '#ef4444', weight: 2 },
        { label: '2x', mult: 2, color: '#3b82f6', weight: 30 },
        { label: '0x', mult: 0, color: '#374151', weight: 10 },
        { label: '5x', mult: 5, color: '#22c55e', weight: 15 },
        { label: '1x', mult: 1, color: '#6b7280', weight: 35 },
        { label: '3x', mult: 3, color: '#8b5cf6', weight: 20 },
        { label: '20x', mult: 20, color: '#d4a843', weight: 4 },
    ];
    const SEG_ANGLE = 360 / SEGMENTS.length;

    function init(gameArea) {
        area = gameArea;
        area.innerHTML = `
            <div style="text-align:center">
                <div style="position:relative;width:300px;height:300px;margin:0 auto 24px">
                    <div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);font-size:28px;z-index:10;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">▼</div>
                    <canvas id="wh-canvas" width="300" height="300" style="border-radius:50%;box-shadow:0 0 30px rgba(212,168,67,0.3)"></canvas>
                </div>
                <div class="game-message" id="wh-msg">Spin the wheel!</div>
                <div class="game-controls">
                    <div class="bet-group">
                        <span class="bet-label">Bet</span>
                        <button class="bet-btn" onclick="Casino.games.wheel._setBet(50)">$50</button>
                        <button class="bet-btn" onclick="Casino.games.wheel._setBet(100)">$100</button>
                        <button class="bet-btn" onclick="Casino.games.wheel._setBet(250)">$250</button>
                        <button class="bet-btn" onclick="Casino.games.wheel._setBet(500)">$500</button>
                    </div>
                    <button class="action-btn primary" id="wh-spin-btn" onclick="Casino.games.wheel._spin()">SPIN — $${bet}</button>
                </div>
            </div>`;
        drawWheel(0);
    }

    function drawWheel(rot) {
        const canvas = document.getElementById('wh-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const cx = 150, cy = 150, r = 140;
        ctx.clearRect(0, 0, 300, 300);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot * Math.PI / 180);
        SEGMENTS.forEach((seg, i) => {
            const startAngle = (i * SEG_ANGLE - 90) * Math.PI / 180;
            const endAngle = ((i + 1) * SEG_ANGLE - 90) * Math.PI / 180;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, r, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = seg.color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Label
            ctx.save();
            ctx.rotate(startAngle + (endAngle - startAngle) / 2);
            ctx.translate(r * 0.7, 0);
            ctx.rotate(Math.PI / 2);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(seg.label, 0, 0);
            ctx.restore();
        });
        ctx.restore();
        // Center circle
        ctx.beginPath();
        ctx.arc(cx, cy, 25, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0e1a';
        ctx.fill();
        ctx.strokeStyle = '#d4a843';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    function setBet(b) { bet = b; document.getElementById('wh-spin-btn').textContent = `SPIN — $${b}`; Casino.playSound('click'); }

    function spin() {
        if (spinning) return;
        if (!Casino.placeBet(bet)) { document.getElementById('wh-msg').textContent = 'Not enough chips!'; return; }
        spinning = true;
        document.getElementById('wh-spin-btn').disabled = true;
        Casino.playSound('click');
        document.getElementById('wh-msg').textContent = 'Spinning...';
        document.getElementById('wh-msg').className = 'game-message';

        // Pick result weighted
        const totalWeight = SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
        let rand = Math.random() * totalWeight, segIdx = 0;
        for (let i = 0; i < SEGMENTS.length; i++) {
            rand -= SEGMENTS[i].weight;
            if (rand <= 0) { segIdx = i; break; }
        }

        const targetAngle = 360 - (segIdx * SEG_ANGLE + SEG_ANGLE / 2);
        const totalSpin = 360 * (5 + Math.floor(Math.random() * 3)) + targetAngle;

        let startTime = null;
        const duration = 4000;
        function animate(ts) {
            if (!startTime) startTime = ts;
            const elapsed = ts - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentAngle = rotation + eased * totalSpin;
            drawWheel(currentAngle);
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                rotation = currentAngle % 360;
                showResult(segIdx);
            }
        }
        requestAnimationFrame(animate);
    }

    function showResult(segIdx) {
        const seg = SEGMENTS[segIdx];
        spinning = false;
        document.getElementById('wh-spin-btn').disabled = false;
        const msg = document.getElementById('wh-msg');
        if (seg.mult > 0) {
            const winnings = bet * seg.mult;
            Casino.changeBalance(winnings);
            msg.textContent = `${seg.label}! You win $${winnings}!`;
            msg.className = 'game-message win';
            Casino.playSound(seg.mult >= 10 ? 'jackpot' : 'win');
            if (winnings >= 500) Casino.showWinEffect(winnings, { bet, particles: ['🎡','💰','✨','⭐','🎉'], accent: '#8b5cf6', themeLabel: 'Wheel of Fortune' });
        } else {
            msg.textContent = 'Landed on 0x — no win!';
            msg.className = 'game-message lose';
            Casino.playSound('lose');
        }
    }

    function destroy() { spinning = false; }

    Casino.games.wheel = { init, destroy, _spin: spin, _setBet: setBet };
})();
