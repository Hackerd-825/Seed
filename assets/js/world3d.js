const container = document.getElementById('canvas-container');
const coordsDisplay = document.getElementById('coords-display');
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel = document.getElementById('settings-panel');

const teleX = document.getElementById('tele-x');
const teleY = document.getElementById('tele-y');
const teleZ = document.getElementById('tele-z');
const btnTeleport = document.getElementById('btn-teleport');
const seedChanger = document.getElementById('seed-changer');
const btnApplySeed = document.getElementById('btn-apply-seed');
const btnRandomSeed = document.getElementById('btn-random-seed');

const seed = Router.getSeedOrRedirect();
document.getElementById('seed-display').textContent = seed;
const noiseSystem = new WorldNoise(seed);

document.getElementById('btn-to-2d').addEventListener('click', () => Router.navigateTo('world2d.html', seed));

settingsToggle.addEventListener('click', () => {
    settingsToggle.classList.toggle('active');
    settingsPanel.classList.toggle('open');
});

const scene = new THREE.Scene();
const skyColor = 0x0b132b; 
scene.background = new THREE.Color(skyColor);

// Pas de brouillard pour préserver un horizon dégagé
scene.fog = null;

// Caméra avec une énorme distance d'affichage lointaine (100 000) pour voir à l'infini
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 100000);
camera.position.set(0, 80, 120);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2.1;
controls.minDistance = 2; 

// LIBÉRATION TOTALE DU DEZOOM : Permet d'aller jusqu'à 80 000 de distance
controls.maxDistance = 80000; 

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xfff3d1, 1.1); sunLight.position.set(100, 150, 50); scene.add(sunLight);

const chunkSize = 60;
const chunksMap = new Map();

const treeLeavesMat = new THREE.MeshBasicMaterial({ color: 0x015c3d });
const treeTrunkMat = new THREE.MeshBasicMaterial({ color: 0x5c2c16 });
const realisticMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });

const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0f4c81,
    transparent: true,
    opacity: 0.82,
    roughness: 0.1,
    metalness: 0.1,
    flatShading: true
});

const activeWaterPlanes = [];

function createChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (chunksMap.has(key)) return;

    // Ajustement de la subdivision du chunk pour les performances mobiles
    const subDiv = 20;

    const geo = new THREE.PlaneGeometry(chunkSize, chunkSize, subDiv, subDiv);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = [];
    const scale = 0.0012; 
    const chunkGroup = new THREE.Group();

    for (let i = 0; i < pos.count; i++) {
        const worldX = pos.getX(i) + cx * chunkSize;
        const worldZ = pos.getZ(i) + cz * chunkSize;

        const el = noiseSystem.getNoise2D(worldX * scale, worldZ * scale, 4, 0.5, 2.0);
        const mo = noiseSystem.getNoise2D((worldX + 3000) * scale, (worldZ + 3000) * scale, 2, 0.5, 2.0);

        let y = el * 35;
        if (y < -2) y = -2 + (y + 2) * 0.15; 
        pos.setY(i, y);

        const col = getBiomeColor(el, mo);
        colors.push(col.r, col.g, col.b);

        if (el > 0.08 && el < 0.5 && mo > 0.0 && i % 15 === 0) {
            const treeNoise = noiseSystem.getNoise2D(worldX * 0.1, worldZ * 0.1, 1, 0.5, 2.0);
            if (treeNoise > 0.3) {
                const tree = createVisualTree();
                tree.position.set(pos.getX(i), y, pos.getZ(i));
                chunkGroup.add(tree);
            }
        }
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, realisticMat);
    chunkGroup.add(mesh);

    const waterGeo = new THREE.PlaneGeometry(chunkSize, chunkSize, 8, 8);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.y = -0.5; 
    chunkGroup.add(waterMesh);
    activeWaterPlanes.push({ mesh: waterMesh, cx: cx, cz: cz });

    chunkGroup.position.set(cx * chunkSize, 0, cz * chunkSize);
    scene.add(chunkGroup);
    chunksMap.set(key, chunkGroup);
}

function createVisualTree() {
    const group = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.25, 2.0, 4);
    const trunk = new THREE.Mesh(trunkGeo, treeTrunkMat);
    trunk.position.y = 1.0;
    group.add(trunk);

    const leavesGeo = new THREE.ConeGeometry(0.9, 2.8, 4);
    const leaves = new THREE.Mesh(leavesGeo, treeLeavesMat);
    leaves.position.y = 3.0;
    group.add(leaves);

    return group;
}

function updateChunks() {
    const playerX = Math.floor(controls.target.x / chunkSize);
    const playerZ = Math.floor(controls.target.z / chunkSize);
    
    // GENERATION ET DISPLAY DYNAMIQUE : Le rayon de rendu augmente avec la distance de recul de la caméra !
    // Si la caméra est très haute (dezoom infini), on augmente automatiquement la zone visible pour couvrir TOUT l'écran sans aucun vide.
    const camDist = camera.position.distanceTo(controls.target);
    let viewRadius = 6; 
    if (camDist > 500) viewRadius = 12;
    if (camDist > 1500) viewRadius = 20;
    if (camDist > 4000) viewRadius = 35; // Génération géante pour remplir tout l'écran à haute altitude

    for (let x = -viewRadius; x <= viewRadius; x++) {
        for (let z = -viewRadius; z <= viewRadius; z++) {
            createChunk(playerX + x, playerZ + z);
        }
    }

    // Nettoyage intelligent des chunks éloignés pour libérer de la mémoire
    for (const [key, chunk] of chunksMap.entries()) {
        const [cx, cz] = key.split(',').map(Number);
        if (Math.abs(cx - playerX) > viewRadius + 2 || Math.abs(cz - playerZ) > viewRadius + 2) {
            scene.remove(chunk);
            chunksMap.delete(key);
            const idx = activeWaterPlanes.findIndex(wp => wp.cx === cx && wp.cz === cz);
            if (idx !== -1) activeWaterPlanes.splice(idx, 1);
        }
    }
}

function getBiomeColor(el, mo) {
    if (el < -0.15) return new THREE.Color(0x0e1e38); 
    if (el < 0.0) return new THREE.Color(0x1e3a8a);  
    if (el < 0.06) return new THREE.Color(0xfef08a); 
    if (el > 0.55) return el > 0.7 ? new THREE.Color(0xffffff) : new THREE.Color(0x4b5563); 
    return mo > 0.2 ? new THREE.Color(0x065f46) : new THREE.Color(0x15803d);
}

btnTeleport.addEventListener('click', () => {
    const x = parseFloat(teleX.value) || 0;
    const y = parseFloat(teleY.value) || 0;
    const z = parseFloat(teleZ.value) || 0;
    controls.target.set(x, y, z);
    camera.position.set(x, y + 80, z + 120);
});

btnApplySeed.addEventListener('click', () => {
    const nextSeed = seedChanger.value.trim();
    if(nextSeed) Router.navigateTo('world3d.html', nextSeed);
});

btnRandomSeed.addEventListener('click', () => {
    Router.navigateTo('world3d.html', Router.generateRandomSeed());
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

let clock = new THREE.Clock();

function animateWater() {
    const elapsedTime = clock.getElapsedTime();

    // Tsunamis cycliques toutes les 45 secondes
    const tsunamiCycle = 45;
    const tsunamiTime = elapsedTime % tsunamiCycle;
    let tsunamiHeight = 0;
    
    if (tsunamiTime < 10) {
        tsunamiHeight = Math.sin((tsunamiTime / 10) * Math.PI) * 4.5;
    }

    activeWaterPlanes.forEach(wp => {
        const pos = wp.mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i) + wp.cx * chunkSize;
            const vz = pos.getZ(i) + wp.cz * chunkSize;

            const wave1 = Math.sin(vx * 0.12 + elapsedTime * 1.5) * 0.4;
            const wave2 = Math.cos(vz * 0.08 + elapsedTime * 1.0) * 0.3;
            const wave3 = Math.sin((vx + vz) * 0.05 + elapsedTime * 2.0) * 0.15;

            const tsunamiWave = Math.sin(vz * 0.02 - elapsedTime * 2.0) * tsunamiHeight;

            pos.setY(i, wave1 + wave2 + wave3 + tsunamiWave);
        }
        wp.mesh.geometry.computeVertexNormals();
        wp.mesh.geometry.attributes.position.needsUpdate = true;
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateChunks();
    animateWater();

    coordsDisplay.textContent = `X: ${Math.round(controls.target.x)}, Y: ${Math.round(controls.target.y)}, Z: ${Math.round(controls.target.z)}`;
    renderer.render(scene, camera);
}

updateChunks();
animate();
