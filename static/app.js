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
                intersect.object.material.color.setHex(parseInt(currentColor.replace('#', '0x')));
            }
        }
        else if (currentTool === 'add') {
            const mat = new THREE.MeshStandardMaterial({ color: parseInt(currentColor.replace('#', '0x')), roughness: 0.3 });
            const voxel = new THREE.Mesh(cubeGeo, mat);
            voxel.position.copy(intersect.point).add(intersect.face.normal);
            voxel.position.divideScalar(50).floor().multiplyScalar(50).addScalar(25);
            scene.add(voxel);
            objects.push(voxel);
        }
    }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    if (fileName.endsWith('.json')) {
        reader.onload = function (e) {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    clearScene();
                    data.forEach(item => {
                        const mat = new THREE.MeshStandardMaterial({ color: parseInt(item.color.replace('#', '0x')), roughness: 0.3 });
                        const voxel = new THREE.Mesh(cubeGeo, mat);
                        voxel.position.set(item.x, item.y, item.z);
                        scene.add(voxel);
                        objects.push(voxel);
                    });
                }
            } catch (err) {
                alert('Error al leer el archivo JSON.');
            }
        };
        reader.readAsText(file);
    } 
    else if (fileName.endsWith('.obj')) {
        reader.onload = function (e) {
            const loader = new OBJLoader();
            const obj = loader.parse(e.target.result);
            voxelizeAndLoad(obj);
        };
        reader.readAsText(file);
    } 
    else if (fileName.endsWith('.gltf') || fileName.endsWith('.glb')) {
        reader.onload = function (e) {
            const loader = new GLTFLoader();
            loader.parse(e.target.result, '', (gltf) => {
                voxelizeAndLoad(gltf.scene);
            }, (err) => {
                alert('Error al procesar el archivo GLTF/GLB.');
            });
        };
        reader.readAsArrayBuffer(file);
    }
    event.target.value = '';
}

function voxelizeAndLoad(object3D) {
    clearScene();
    const bbox = new THREE.Box3().setFromObject(object3D);
    const center = bbox.getCenter(new THREE.Vector3());

    object3D.traverse((child) => {
        if (child.isMesh) {
            const geometry = child.geometry;
            const positionAttribute = geometry.attributes.position;
            const colorToUse = child.material && child.material.color ? '#' + child.material.color.getHexString() : currentColor;

            for (let i = 0; i < positionAttribute.count; i++) {
                const vertex = new THREE.Vector3();
                vertex.fromBufferAttribute(positionAttribute, i);
                child.localToWorld(vertex);

                const vx = Math.floor((vertex.x - center.x) / 50) * 50 + 25;
                const vy = Math.max(25, Math.floor((vertex.y - bbox.min.y) / 50) * 50 + 25);
                const vz = Math.floor((vertex.z - center.z) / 50) * 50 + 25;

                const exists = objects.some(o => o !== plane && o.position.x === vx && o.position.y === vy && o.position.z === vz);

                if (!exists) {
                    const mat = new THREE.MeshStandardMaterial({ color: parseInt(colorToUse.replace('#', '0x')), roughness: 0.3 });
                    const voxel = new THREE.Mesh(cubeGeo, mat);
                    voxel.position.set(vx, vy, vz);
                    scene.add(voxel);
                    objects.push(voxel);
                }
            }
        }
    });
}

function exportModel() {
    const voxelMeshes = objects.filter(obj => obj !== plane);

    if (voxelMeshes.length === 0) {
        alert('No hay vóxeles en la escena para descargar.');
        return;
    }

    const format = document.getElementById('exportFormat').value;

    if (format === 'obj') {
        const exporter = new OBJExporter();
        const group = new THREE.Group();
        voxelMeshes.forEach(mesh => group.add(mesh.clone()));
        
        const result = exporter.parse(group);
        triggerDownload(new Blob([result], { type: 'text/plain' }), 'modelo_voxel.obj');
    } 
    else if (format === 'gltf') {
        const exporter = new GLTFExporter();
        const group = new THREE.Group();
        voxelMeshes.forEach(mesh => group.add(mesh.clone()));

        exporter.parse(
            group,
            function (gltf) {
                const blob = new Blob([gltf], { type: 'application/octet-stream' });
                triggerDownload(blob, 'modelo_voxel.glb');
            },
            function (error) { console.error('Error al exportar GLTF:', error); },
            { binary: true }
        );
    } 
    else if (format === 'json') {
        const data = voxelMeshes.map(obj => ({
            x: obj.position.x,
            y: obj.position.y,
            z: obj.position.z,
            color: '#' + obj.material.color.getHexString()
        }));
        const jsonStr = JSON.stringify(data, null, 2);
        triggerDownload(new Blob([jsonStr], { type: 'application/json' }), 'modelo_voxel.json');
    }
}

function triggerDownload(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

function clearScene() {
    const toRemove = objects.filter(obj => obj !== plane);
    toRemove.forEach(obj => scene.remove(obj));
    objects = [plane];
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
