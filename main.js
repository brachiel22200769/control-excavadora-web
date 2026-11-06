import { CONFIG } from './config.js';
import { enviarComando, obtenerDemos, checkApiHealth } from './api.js';

// Referencias a LEDs y UI
const ledWs = document.getElementById('led-ws');
const ledApi = document.getElementById('led-api');
const ledRds = document.getElementById('led-rds');
const actionStatus = document.getElementById('action-status');

// 1. WebSocket
function conectarWebSocket() {
    ledWs.className = "led led-yellow"; // Conectando
    const ws = new WebSocket(CONFIG.WS_URL);
    
    ws.onopen = () => { ledWs.className = "led led-green"; };
    ws.onclose = () => {
        ledWs.className = "led led-red";
        setTimeout(conectarWebSocket, 5000);
    };
    ws.onmessage = (event) => {
        // Regla 4.5: Mostrar "evento recibido"
        actionStatus.innerText = `Evento recibido: ${event.data.substring(0, 20)}...`;
        actionStatus.className = "badge bg-success border border-success fs-6 font-monospace";
    };
}
conectarWebSocket();

// 2. Monitoreo API y RDS
async function monitorearSalud() {
    const apiViva = await checkApiHealth();
    if (apiViva) {
        ledApi.className = "led led-green";
        ledRds.className = "led led-green"; // Simulamos RDS viva si la API responde
    } else {
        ledApi.className = "led led-red";
        ledRds.className = "led led-gray"; // Sin verificar
    }
}
setInterval(monitorearSalud, 10000);
monitorearSalud();

// 3. Catálogo de Demos
async function cargarDemos() {
    const select = document.getElementById('demoSelect');
    const demos = await obtenerDemos();
    select.innerHTML = '<option value="">Seleccione una DEMO...</option>';
    demos.forEach(d => {
        select.innerHTML += `<option value="${d.id_demo}">${d.nombre}</option>`;
    });
}
cargarDemos();

// 4. Controlador de envíos con retroalimentación visual (Regla 4.5)
async function procesarComando(cmd) {
    actionStatus.innerText = `Solicitado comando ${cmd}...`;
    actionStatus.className = "badge bg-warning text-dark border border-warning fs-6 font-monospace";
    
    const exito = await enviarComando(cmd);
    if (exito) {
        actionStatus.innerText = "Aceptado por API";
        actionStatus.className = "badge bg-primary border border-primary fs-6 font-monospace";
    } else {
        actionStatus.innerText = "Error de red/API";
        actionStatus.className = "badge bg-danger border border-danger fs-6 font-monospace";
    }
}

// 5. Botones sueltos
document.getElementById('btn-13').addEventListener('click', () => procesarComando(13));
document.getElementById('btn-7').addEventListener('click', () => procesarComando(7));
document.getElementById('btn-5').addEventListener('click', () => procesarComando(5));
document.getElementById('btn-8').addEventListener('click', () => procesarComando(8));

// 6. Joysticks
function configurarJoystick(elementId, mapeo) {
    const stick = document.getElementById(elementId);
    let active = false;
    let currentCmd = 13;

    const startDrag = () => active = true;
    const endDrag = () => {
        active = false;
        stick.style.transform = `translate(-50%, -50%)`;
        if (currentCmd !== 13) {
            currentCmd = 13;
            procesarComando(13);
        }
    };

    const drag = (e) => {
        if (!active) return;
        e.preventDefault();
        
        const rect = stick.parentElement.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        let x = clientX - rect.left - (rect.width/2);
        let y = clientY - rect.top - (rect.height/2);
        
        const r = 40; 
        const dist = Math.sqrt(x*x + y*y);
        if (dist > r) { x = (x/dist)*r; y = (y/dist)*r; }
        
        stick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

        let newCmd = 13;
        if (y < -20) newCmd = mapeo.up;
        else if (y > 20) newCmd = mapeo.down;
        else if (x < -20) newCmd = mapeo.left;
        else if (x > 20) newCmd = mapeo.right;

        if (newCmd !== currentCmd && newCmd !== 13) {
            currentCmd = newCmd;
            procesarComando(currentCmd);
        }
    };

    stick.addEventListener('mousedown', startDrag);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('mousemove', drag);
    
    stick.addEventListener('touchstart', startDrag, {passive: false});
    window.addEventListener('touchend', endDrag);
    window.addEventListener('touchmove', drag, {passive: false});
}

// Mapeos ya corregidos
configurarJoystick('joyLeft', { up: 2, down: 3, left: 4, right: 1 });
configurarJoystick('joyRight', { up: 10, down: 11, left: 9, right: 12 });