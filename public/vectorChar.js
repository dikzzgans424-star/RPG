// public/vectorChar.js — Vector silhouette renderer untuk player (stickman)
// dan monster (blob creature). Dipanggil dari battle2d.js, menggantikan
// ctx.fillText(emoji,...). Tidak menyentuh game logic sama sekali — cuma
// menggambar berdasarkan state yang sudah ada (atkAnim, dashing, hitFlash, dst).

const VectorChar = (() => {

    // Warna silhouette per role (cocok sama tema crimson-gold)
    const ROLE_COLOR = {
        fighter:   '#e04444',
        mage:      '#3478c4',
        assassin:  '#7a3fa0',
        defender:  '#c9963c',
        archer:    '#3da870',
        wraith:    '#9a9080',
        alchemist: '#38a89d',
    };
    const ROLE_ACCENT = {
        fighter:   '#ffb3b3',
        mage:      '#a9d4ff',
        assassin:  '#d8b3ff',
        defender:  '#ffe6b3',
        archer:    '#b3ffd1',
        wraith:    '#e8e8e8',
        alchemist: '#a3fff0',
    };

    // ─── PLAYER STICKMAN ───
    // Digambar dalam local space: origin = di tanah (kaki), menghadap +x.
    // Tinggi total ~56px biar sepadan sama ukuran lama (font 56px).
    function drawPlayer(ctx, p, role, anim) {
        const color = ROLE_COLOR[role] || '#e04444';
        const accent = ROLE_ACCENT[role] || '#ffffff';

        const H = 56; // tinggi total
        const headR = H * 0.16;
        const torsoLen = H * 0.36;
        const legLen = H * 0.46;
        const armLen = H * 0.30;

        const hipY = -legLen;
        const shoulderY = hipY - torsoLen;
        const headY = shoulderY - headR * 1.3;

        // animation params (radians)
        const t = anim.runPhase || 0;
        const isMoving = anim.moving && !anim.dashing && !anim.defending;
        const legSwing = isMoving ? Math.sin(t) * 0.65 : 0;
        const legSwing2 = isMoving ? Math.sin(t + Math.PI) * 0.65 : 0;
        const armIdleSwing = isMoving ? Math.sin(t + Math.PI) * 0.35 : Math.sin((anim.idleT || 0) * 1.4) * 0.05;
        const armIdleSwing2 = isMoving ? Math.sin(t) * 0.35 : -Math.sin((anim.idleT || 0) * 1.4) * 0.05;

        // attack swing overrides front arm
        const atk = anim.atkAnim || 0; // 0..1, decaying
        const atkSwing = atk > 0 ? -1.9 + Math.sin((1 - atk) * Math.PI) * 2.4 : null;

        // dash = lean forward + legs tucked
        const lean = anim.dashing ? 0.45 : (atk > 0 ? 0.12 : 0);
        // defending = crouch + shield arm up
        const crouch = anim.defending ? H * 0.08 : 0;
        const bodyTilt = lean;

        ctx.save();
        ctx.translate(0, -crouch);
        ctx.rotate(bodyTilt);

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // back leg
        drawLimb(ctx, 0, hipY, legLen * 0.5, legSwing2 * 0.6, -0.3, color, H * 0.075, true);
        // back arm
        if (!anim.defending) {
            drawLimb(ctx, 0, shoulderY, armLen, armIdleSwing2, 0.3, color, H * 0.06, true);
        }

        // torso (silhouette capsule)
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 2;
        roundedCapsule(ctx, 0, shoulderY, 0, hipY, H * 0.135);
        ctx.fill(); ctx.stroke();

        // head
        ctx.beginPath();
        ctx.arc(0, headY, headR, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill(); ctx.stroke();
        // face accent (visor/eye glow direction = facing handled by outer scale)
        ctx.beginPath();
        ctx.fillStyle = accent;
        ctx.arc(headR * 0.35, headY - headR * 0.05, headR * 0.22, 0, Math.PI * 2);
        ctx.fill();

        // front leg
        drawLimb(ctx, 0, hipY, legLen * 0.5, legSwing, 0.3, color, H * 0.078, true);

        // front arm + weapon
        if (anim.defending) {
            // shield arm raised across body
            drawLimb(ctx, 0, shoulderY, armLen * 0.85, -1.3, 0.2, color, H * 0.065, true);
            drawShield(ctx, headR * 1.3, shoulderY + armLen * 0.5, accent, color);
        } else {
            const swing = atkSwing !== null ? atkSwing : armIdleSwing;
            const handPos = drawLimb(ctx, 0, shoulderY, armLen, swing, 0.25, color, H * 0.065, true);
            drawWeapon(ctx, role, handPos.x, handPos.y, swing, accent, atk);
        }

        // hit flash overlay
        if (anim.hitFlash > 0) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = `rgba(255,255,255,${0.5 * anim.hitFlash})`;
            ctx.fillRect(-H, headY - headR * 2, H * 2, H * 2);
            ctx.globalCompositeOperation = 'source-over';
        }

        // dash motion streak
        if (anim.dashing) {
            ctx.strokeStyle = `rgba(255,255,255,0.35)`;
            ctx.lineWidth = 3;
            for (let i = 1; i <= 3; i++) {
                ctx.beginPath();
                ctx.moveTo(-i * 14, hipY + 4);
                ctx.lineTo(-i * 14 - 10, hipY + 4);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(-i * 13, shoulderY - 4);
                ctx.lineTo(-i * 13 - 9, shoulderY - 4);
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    // Draw a single limb segment (thigh/upper-arm + shin/forearm bent slightly),
    // returns end point (hand/foot position) in local coords pre-rotation.
    function drawLimb(ctx, x0, y0, len, angle, bend, color, width, withFoot) {
        // angle: 0 = straight down, positive = forward(+x), measured from vertical
        const midX = x0 + Math.sin(angle) * len * 0.55;
        const midY = y0 + Math.cos(angle) * len * 0.55;
        const angle2 = angle + bend;
        const endX = midX + Math.sin(angle2) * len * 0.55;
        const endY = midY + Math.cos(angle2) * len * 0.55;

        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(midX, midY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // joint + tip caps for chunkier silhouette look
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(midX, midY, width * 0.5, 0, Math.PI * 2); ctx.fill();
        if (withFoot) {
            ctx.beginPath(); ctx.arc(endX, endY, width * 0.55, 0, Math.PI * 2); ctx.fill();
        }
        return { x: endX, y: endY };
    }

    function roundedCapsule(ctx, x0, y0, x1, y1, r) {
        const dx = x1 - x0, dy = y1 - y0;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len * r, ny = dx / len * r;
        ctx.beginPath();
        ctx.moveTo(x0 + nx, y0 + ny);
        ctx.lineTo(x1 + nx, y1 + ny);
        ctx.arc(x1, y1, r, Math.atan2(ny, nx), Math.atan2(-ny, -nx));
        ctx.lineTo(x0 - nx, y0 - ny);
        ctx.arc(x0, y0, r, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
        ctx.closePath();
    }

    function drawWeapon(ctx, role, hx, hy, swing, accent, atk) {
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(swing);
        ctx.strokeStyle = accent;
        ctx.fillStyle = accent;
        ctx.lineCap = 'round';

        if (role === 'mage' || role === 'alchemist') {
            // staff with glowing orb tip
            ctx.lineWidth = 3.5;
            ctx.strokeStyle = '#6b4a2a';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -26); ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, -29, atk > 0 ? 5 + atk * 3 : 4, 0, Math.PI * 2);
            ctx.fillStyle = accent;
            ctx.shadowColor = accent; ctx.shadowBlur = atk > 0 ? 12 : 4;
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (role === 'archer') {
            // bow (arc) — held, not bow-and-string animated in detail
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#8a6a3a';
            ctx.beginPath();
            ctx.arc(0, -10, 14, -1.2, 1.2);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(0, -10 - 14 * Math.sin(1.2));
            ctx.lineTo(0, -10 + 14 * Math.sin(1.2));
            ctx.stroke();
        } else if (role === 'defender') {
            // mace
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#6b4a2a';
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -24); ctx.stroke();
            ctx.fillStyle = accent;
            ctx.beginPath(); ctx.arc(0, -27, 6, 0, Math.PI * 2); ctx.fill();
        } else {
            // sword / dagger (fighter, assassin, wraith default)
            const blade = role === 'assassin' ? 18 : 26;
            ctx.lineWidth = role === 'assassin' ? 3 : 4;
            ctx.strokeStyle = '#cfd6dd';
            if (atk > 0) { ctx.shadowColor = accent; ctx.shadowBlur = 10; }
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -blade); ctx.stroke();
            ctx.shadowBlur = 0;
            // hilt
            ctx.strokeStyle = '#5a4a2a';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(4, 2); ctx.stroke();
        }
        ctx.restore();
    }

    function drawShield(ctx, x, y, accent, color) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = color;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.quadraticCurveTo(10, -10, 10, 2);
        ctx.quadraticCurveTo(10, 10, 0, 14);
        ctx.quadraticCurveTo(-10, 10, -10, 2);
        ctx.quadraticCurveTo(-10, -10, 0, -12);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
    }

    // ─── MONSTER BLOB ───
    // Organic creature silhouette: body blob + eyes + limbs/spikes that
    // react to windup (attack telegraph), hitFlash, and stunned state.
    function drawMonster(ctx, m, anim) {
        const baseR = 30 * (anim.sizeMult || 1);
        const t = anim.idleT || 0;
        const squish = 1 + Math.sin(t * 2.2) * 0.04;
        const windupPulse = anim.windup > 0 ? 1 + (1 - anim.windupT) * 0.18 : 1;

        ctx.save();

        // color derived from a hash of monster name, for visual variety
        const hue = anim.hue != null ? anim.hue : 280;
        const bodyColor = `hsl(${hue}, 55%, 38%)`;
        const darkColor = `hsl(${hue}, 60%, 22%)`;
        const eyeColor = anim.stunned ? '#facc15' : (anim.windup > 0 ? '#ff5050' : '#ffe7a0');

        // back spikes
        ctx.fillStyle = darkColor;
        for (let i = -2; i <= 2; i++) {
            const ang = i * 0.45;
            const sx = Math.sin(ang) * baseR * 0.75;
            const sy = -Math.cos(ang) * baseR * 0.75 - baseR * 0.3;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx - 5, sy + 16);
            ctx.lineTo(sx + 5, sy + 16);
            ctx.closePath();
            ctx.fill();
        }

        // body blob (squash/stretch + windup pulse)
        ctx.save();
        ctx.scale(squish * windupPulse, (1 / squish) * windupPulse);
        ctx.beginPath();
        ctx.ellipse(0, -baseR * 0.5, baseR, baseR * 0.95, 0, 0, Math.PI * 2);
        ctx.fillStyle = bodyColor;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2.5;
        ctx.fill(); ctx.stroke();
        ctx.restore();

        // windup glow (telegraph)
        if (anim.windup > 0) {
            ctx.save();
            ctx.globalAlpha = 0.5 * (1 - anim.windupT);
            ctx.beginPath();
            ctx.ellipse(0, -baseR * 0.5, baseR * 1.25, baseR * 1.15, 0, 0, Math.PI * 2);
            ctx.strokeStyle = '#ff5050';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();
        }

        // legs (simple stubby)
        ctx.fillStyle = darkColor;
        [-1, 1].forEach(side => {
            const lx = side * baseR * 0.5;
            const wobble = Math.sin(t * 3 + side) * 3;
            ctx.beginPath();
            ctx.ellipse(lx + wobble, -baseR * 0.05, baseR * 0.22, baseR * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
        });

        // eyes
        const eyeY = -baseR * 0.65;
        [-1, 1].forEach(side => {
            ctx.beginPath();
            ctx.fillStyle = '#1a1010';
            ctx.ellipse(side * baseR * 0.32, eyeY, baseR * 0.16, baseR * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.fillStyle = eyeColor;
            ctx.shadowColor = eyeColor; ctx.shadowBlur = 8;
            ctx.ellipse(side * baseR * 0.32, eyeY, baseR * 0.08, baseR * 0.1, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        // stunned stars
        if (anim.stunned) {
            ctx.fillStyle = '#facc15';
            ctx.font = `${baseR * 0.5}px serif`;
            ctx.textAlign = 'center';
            ctx.fillText('✦', Math.sin(t * 4) * baseR * 0.5, -baseR * 1.5);
        }

        // hit flash
        if (anim.hitFlash > 0) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = `rgba(255,255,255,${0.55 * anim.hitFlash})`;
            ctx.beginPath();
            ctx.ellipse(0, -baseR * 0.5, baseR * 1.3, baseR * 1.3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.restore();
    }

    // simple deterministic hash for hue from monster name
    function hueFromName(name) {
        if (!name) return 280;
        let h = 0;
        for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
        return h;
    }

    return { drawPlayer, drawMonster, hueFromName };
})();
