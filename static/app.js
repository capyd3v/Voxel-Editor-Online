import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, controls;
let plane, gridHelper, raycaster, pointer;
let objects = [];
let cubeGeo;
let currentColor = '#ff0000';
let currentTool = 'add'; // 'add', 'paint', 'erase'

// Variables para controlar el arrastre del mouse / toque táctil
let pointerDownPos = { x: 0, y: 0 };

init();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e1e24);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(500, 800, 1300);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
    directionalLight.position.set(1, 1, 0.5).normalize();
    scene.add(directionalLight);

    gridHelper = new THREE.GridHelper(1000, 20, 0x444455, 0x333344);
    scene.add(gridHelper);

    const geometry = new THREE.PlaneGeometry(1000, 1000);
    geometry.rotateX(-Math.PI / 2);
    plane = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ visible: false }));
    scene.add(plane);
    objects.push(plane);

    cubeGeo = new THREE.BoxGeometry(50, 50, 50);
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Suaviza la interacción táctil y con el ratón

    window.addEventListener('resize', onWindowResize);
    
    // Capturar posición al pulsar y ejecutar acción solo al soltar
    document.addEventListener('pointerdown', (e) => {
        pointerDownPos = { x: e.clientX, y: e.clientY };
    });
    document.addEventListener('pointerup', onPointerUp);

    document.getElementById('colorPicker').addEventListener('change', (e) => currentColor = e.target.value);
    document.getElementById('planeSize').addEventListener('change', (e) => updatePlaneSize(parseFloat(e.target.value)));

    // Herramientas
    document.getElementById('toolAdd').addEventListener('click', () => setTool('add'));
    document.getElementById('toolPaint').addEventListener('click', () => setTool('paint'));
    document.getElementById('toolErase').addEventListener('click', () => setTool('erase'));

    // Archivos y acciones
    document.getElementById('fileInput').addEventListener('change', handleFileUpload);
    document.getElementById('clearBtn').addEventListener('click', clearScene);
    document.getElementById('downloadBtn').addEventListener('click', exportModel);

    animate();
}

function updatePlaneSize(newSize) {
    if (isNaN(newSize) || newSize <= 0) return;

    scene.remove(gridHelper);
    gridHelper = new THREE.GridHelper(newSize, Math.floor(newSize / 50), 0x444455, 0x333344);
    scene.add(gridHelper);

    plane.geometry.dispose();
    const newGeo = new THREE.PlaneGeometry(newSize, newSize);
    newGeo.rotateX(-Math.PI / 2);
    plane.geometry = newGeo;
}

function setTool(tool) {
    currentTool = tool;
    document.getElementById('toolAdd').classList.toggle('active', tool === 'add');
    document.getElementById('toolPaint').classList.toggle('active', tool === 'paint');
    document.getElementById('toolErase').classList.toggle('active', tool === 'erase');
}

function onPointerUp(event) {
    // Evitar acciones si la interacción ocurre dentro del contenedor de la interfaz (#ui)
    const uiElement = document.getElementById('ui');
    if (uiElement && uiElement.contains(event.target)) return;

    // Detectar si fue un arrastre de cámara o desplazamiento táctil (threshold de 8px)
    const moveDist = Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y);
    if (moveDist > 8) return;

    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersects = raycaster.intersectObjects(objects, false);

    if (intersects.length > 0 && (event.button === 0 || event.pointerType === 'touch')) {
        const intersect = intersects[0];

        if (currentTool === 'erase' || event.shiftKey) {
            if (intersect.object !== plane) {
                scene.remove(intersect.object);
                objects.splice(objects.indexOf(intersect.object), 1);
            }
        } 
        else if (currentTool === 'paint') {
            if (intersect.object !== plane) {
                intersect.
