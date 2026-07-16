const canvas = document.getElementById('world-canvas');
const ctx = canvas.getContext('2d');
const coordsDisplay = document.getElementById('coords-display');
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');

const teleX = document.getElementById('tele-x');
const teleY = document.getElementById('tele-y');
const btnTeleport = document.getElementById('btn-teleport');
const seedChanger = document.getElementById('seed-changer');
const btnApplySeed = document.getElementById('btn-apply-seed');
const btnRandomSeed = document.getElementById('btn-random-seed');

const seed = Router.getSeedOrRedirect();
document.getElementById('seed-display').textContent = seed;
const noise = new WorldNoise(seed);

let camera = { x: 0, y: 0, zoom: 1.5 };
let isDragging = false;
let lastTouchX = 0, lastTouchY = 0;
let initialPinchDistance = 0;
let initialZoom = 1.5;

settingsToggle.addEventListener('click', () => {
    settingsToggle.classList.toggle('active');
    settingsPanel.classList.toggle('open');
});

btnTeleport.addEventListener('click', () => {
    const x = parseFloat(teleX.value) || 0;
    const y = parseFloat(teleY.value) || 0;
    camera.x = x; camera.y = y;
    draw();
});

btnApplySeed.addEventListener('click', () => {
    const nextSeed = seedChanger.value.trim();
    if(nextSeed) Router.navigateTo('world2d.html', nextSeed);
});

btnRandomSeed.addEventListener('click', () => {
    Router.navigateTo('world2d.html', Router.generateRandomSeed());
});

document.getElementById('btn-to-3d').addEventListener('click', () => Router.navigateTo('world3d.html', seed));

function resize() {
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    draw();
}
window.addEventListener('resize', resize);

function getRealisticColor(elevation, moisture) {
    if (elevation < -0.2) return '#0f172a';
    if (elevation < 0.0) return '#1d4ed8';
    if (elevation < 0.07) return '#fef08a';
    if (elevation > 0.6) {
        if (elevation > 0.75) return '#ffffff';
        return '#4b5563';
    }
    if (moisture > 0.3) return '#065f46';
    if (moisture < -0.2) return '#a3e635';
    return '#15803d';
}

function draw() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    
    // OPTIMISATION MOBILE : Ajustement dynamique de l'incrément de tracé (step)
    // Plus on dézoome (caméra lointaine), plus on augmente l'incrément de balayage pour éviter de ramer,
    // mais on dessine des rectangles lisses adaptés à la taille de l'incrément pour ne pas voir d'effet "gros pixel".
    let step = 1;
    if (camera.zoom > 3.0) step = 2;
    if (camera.zoom > 8.0) step = 3;
    if (camera.zoom > 18.0) step = 5;
    if (camera.zoom > 35.0) step = 8;

    const noiseScale = 0.0006;

    for (let py = 0; py < h; py += step) {
        const wy = (py - h/2) * camera.zoom + camera.y;
        for (let px = 0; px < w; px += step) {
            const wx = (px - w/2) * camera.zoom + camera.x;

            const el = noise.getNoise2D(wx * noiseScale, wy * noiseScale, 3, 0.5, 2.0);
            const mo = noise.getNoise2D((wx+5000)*noiseScale, (wy+5000)*noiseScale, 2, 0.5, 2.0);

            ctx.fillStyle = getRealisticColor(el, mo);
            ctx.fillRect(px, py, step, step);
        }
    }

    // Dessin d'arbres optimisé et fluide
    if (camera.zoom < 3.5) {
        const treeSpacing = 45; 
        const startX = Math.floor((camera.x - (w/2) * camera.zoom) / treeSpacing) * treeSpacing;
        const endX = Math.ceil((camera.x + (w/2) * camera.zoom) / treeSpacing) * treeSpacing;
        const startY = Math.floor((camera.y - (h/2) * camera.zoom) / treeSpacing) * treeSpacing;
        const endY = Math.ceil((camera.y + (h/2) * camera.zoom) / treeSpacing) * treeSpacing;

        for (let wy = startY; wy <= endY; wy += treeSpacing) {
            for (let wx = startX; wx <= endX; wx += treeSpacing) {
                const el = noise.getNoise2D(wx * noiseScale, wy * noiseScale, 3, 0.5, 2.0);
                const mo = noise.getNoise2D((wx+5000)*noiseScale, (wy+5000)*noiseScale, 2, 0.5, 2.0);

                if (el > 0.08 && el < 0.55 && mo > -0.1) {
                    const treeNoise = noise.getNoise2D(wx * 0.1, wy * 0.1, 1, 0.5, 2.0);
                    if (treeNoise > 0.25) {
                        const px = (wx - camera.x) / camera.zoom + w/2;
                        const py = (wy - camera.y) / camera.zoom + h/2;

                        ctx.beginPath();
                        ctx.fillStyle = "#047857";
                        ctx.arc(px, py, Math.max(1.2, 3.5 / camera.zoom), 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }
    }

    coordsDisplay.textContent = `X: ${Math.round(camera.x)}, Y: ${Math.round(camera.y)}`;
}

function getPinchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function startDrag(x, y) { isDragging = true; lastTouchX = x; lastTouchY = y; }
function moveDrag(x, y) {
    if (!isDragging) return;
    camera.x -= (x - lastTouchX) * camera.zoom;
    camera.y -= (y - lastTouchY) * camera.zoom;
    lastTouchX = x; lastTouchY = y;
    draw();
}
function stopDrag() { isDragging = false; }

canvas.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY));
window.addEventListener('mousemove', (e) => moveDrag(e.clientX, e.clientY));
window.addEventListener('mouseup', stopDrag);

canvas.addEventListener('touchstart', (e) => { 
    if (e.touches.length === 1) {
        startDrag(e.touches[0].clientX, e.touches[0].clientY); 
    } else if (e.touches.length === 2) {
        isDragging = false;
        initialPinchDistance = getPinchDistance(e.touches);
        initialZoom = camera.zoom;
    }
});

canvas.addEventListener('touchmove', (e) => { 
    if (e.touches.length === 1) {
        moveDrag(e.touches[0].clientX, e.touches[0].clientY); 
    } else if (e.touches.length === 2) {
        const currentDistance = getPinchDistance(e.touches);
        if (initialPinchDistance > 0) {
            const factor = initialPinchDistance / currentDistance;
            camera.zoom = initialZoom * factor;
            draw();
        }
    }
});

canvas.addEventListener('touchend', (e) => {
    stopDrag();
    if (e.touches.length < 2) initialPinchDistance = 0;
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY > 0) camera.zoom *= 1.15; else camera.zoom /= 1.15;
    draw();
}, { passive: false });

resize();
