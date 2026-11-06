import { CONFIG } from './config.js';
import { enviarComando, obtenerDemos, checkApiHealth } from './api.js';

const ledWs = document.getElementById('led-ws');
const ledApi = document.getElementById('led-api');
const ledRds = document.getElementById('led-rds');
const historialBox = document.getElementById('historial');

// Helper para agregar texto al Historial de la UI
function logHistorial(mensaje) {
    const time = new Date().toLocaleTimeString('es-MX', { hour12: false });
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `<span class="history-time">[${time}]</span> <span class="history-cmd">${mensaje}</span>`;
    historialBox.prepend(div);
}

// 1. WebSocket (Control de LED)
function conectarWebSocket() {
    ledWs.className = "led led-yellow"; 
    const ws = new WebSocket(CONFIG.WS_URL);
    
    ws.onopen = () => { ledWs.className = "led led-green"; };
    ws.onclose = () => {
        ledWs.className = "led led-red";
        setTimeout(conectarWebSocket, 5000);
    };
    ws.onmessage = (event) => {
        logHistorial(`WS: ${event.data.substring(0, 15)}`);
    };
}
conectarWebSocket();

// 2. Monitoreo API y RDS (Control de LEDs)
async function monitorearSalud() {
    ledApi.className = "led led-yellow";
    ledRds.className = "led led-yellow";
    
    const apiViva = await checkApiHealth();
    if (apiViva) {
        ledApi.className = "led led-green";
        ledRds.className = "led led-green"; 
    } else {
        ledApi.className = "led led-red";
        ledRds.className = "led led-red";
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

// 4. Controlador de envíos
async function procesarComando(cmd, nombreCmd) {
    logHistorial(`Enviando: ${nombreCmd}`);
    const exito = await enviarComando(cmd);
    if (!exito) logHistorial(`Error API: ${nombreCmd}`);
}

// 5. Botones
document.getElementById('btn-13').addEventListener('click', () => procesarComando(13, 'DETENER TODO'));
document.getElementById('btn-7').addEventListener('click', () => procesarComando(7, 'LUCES ON/OFF'));
document.getElementById('btn-5').addEventListener('click', () => procesarComando(5, 'SONIDO'));
document.getElementById('btn-8').addEventListener('click', () => procesarComando(8, 'AUX'));

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
            procesarComando(13, 'DETENIDO (Centro)');
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
        let nombreCmd = 'DETENIDO';
        if (y < -20) { newCmd = mapeo.up; nombreCmd = 'ARRIBA'; }
        else if (y > 20) { newCmd = mapeo.down; nombreCmd = 'ABAJO'; }
        else if (x < -20) { newCmd = mapeo.left; nombreCmd = 'IZQUIERDA'; }
        else if (x > 20) { newCmd = mapeo.right; nombreCmd = 'DERECHA'; }

        if (newCmd !== currentCmd && newCmd !== 13) {
            currentCmd = newCmd;
            procesarComando(currentCmd, nombreCmd);
        }
    };

    stick.addEventListener('mousedown', startDrag);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('mousemove', drag);
    
    stick.addEventListener('touchstart', startDrag, {passive: false});
    window.addEventListener('touchend', endDrag);
    window.addEventListener('touchmove', drag, {passive: false});
}

configurarJoystick('joyLeft', { up: 2, down: 3, left: 4, right: 1 });
configurarJoystick('joyRight', { up: 10, down: 11, left: 9, right: 12 });