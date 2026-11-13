import { CONFIG } from './config.js';
import { enviarComandoRest, checkApiHealth } from './api.js';

// ==========================================
// REFERENCIAS HTML
// ==========================================
const wsDot = document.getElementById("led-ws");
const apiDot = document.getElementById("led-api");
const rdsDot = document.getElementById("led-rds");
const historyList = document.getElementById("historyList");

let ws;
let modoSimulado = false;
let lastCommand = 13;

const nombresAcciones = {
    1: "GIRANDO IZQUIERDA", 2: "AVANZANDO", 3: "RETROCEDIENDO", 4: "GIRANDO DERECHA",
    5: "SONIDO ON/OFF", 7: "ROTANDO CABINA IZQ", 8: "MODO AUX",
    9: "LUCES ON/OFF", 10: "SUBIR BRAZO", 11: "BAJAR BRAZO", 12: "ROTANDO CABINA DER", 13: "DETENIDO"
};

// ==========================================
// 1. CONEXIÓN WEBSOCKET Y SALUD
// ==========================================
function iniciarWebSocket() {
    try {
        ws = new WebSocket(CONFIG.WS_URL);
        ws.onopen = () => { 
            modoSimulado = false;
            wsDot.className = "dot on"; 
        };
        ws.onmessage = (event) => { console.log("WS:", event.data) };
        ws.onclose = () => {
            if (!modoSimulado) {
                wsDot.className = "dot err";
                setTimeout(iniciarWebSocket, 3000);
            }
        };
        ws.onerror = () => {
            modoSimulado = true;
            wsDot.className = "dot err";
        };
    } catch (e) {
        modoSimulado = true;
        wsDot.className = "dot err";
    }
}

async function monitorearSalud() {
    apiDot.className = "dot sim";
    rdsDot.className = "dot sim";
    const apiViva = await checkApiHealth();
    if (apiViva) {
        apiDot.className = "dot on";
        rdsDot.className = "dot on";
    } else {
        apiDot.className = "dot err";
        rdsDot.className = "dot err";
    }
}

// ==========================================
// 2. HISTORIAL Y ENVÍO DE COMANDOS
// ==========================================
function agregarAlHistorial(texto) {
    const li = document.createElement("li");
    const timeStr = new Date().toTimeString().split(' ')[0];
    li.innerHTML = `[${timeStr}] <b>${texto}</b>`;
    historyList.prepend(li);
    if (historyList.children.length > 25) historyList.removeChild(historyList.lastChild);
}

async function enviarComando(cmdId) {
    if(cmdId !== 13 && cmdId === lastCommand) return; 
    lastCommand = cmdId;

    const nombreComando = nombresAcciones[cmdId] || `COMANDO ${cmdId}`;
    agregarAlHistorial(`Solicitado: ${nombreComando}`);

    if (modoSimulado) return;

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ status: cmdId }));
    }

    const res = await enviarComandoRest(cmdId);
    if (!res.ok) {
        agregarAlHistorial(`<span style="color: #e74c3c;">[ERROR API] ${res.error}</span>`);
    } else {
        agregarAlHistorial(`<span style="color: #3498db;">[API] Comando Aceptado</span>`);
    }
}

// Botones centrales
document.getElementById('btn-7').addEventListener('click', function() {
    enviarComando(7); this.classList.toggle('active-toggle');
});
document.getElementById('btn-5').addEventListener('click', function() {
    enviarComando(5); this.classList.toggle('active-toggle');
});
document.getElementById('btn-8').addEventListener('click', function() {
    enviarComando(8);
});
document.getElementById('btn-stop').addEventListener('click', function() {
    enviarComando(13);
});

// ==========================================
// 3. CATÁLOGO Y EJECUCIÓN DE DEMOS
// ==========================================
async function cargarDemos() {
    try {
        const resp = await fetch(`${CONFIG.API_BASE}/vehiculos/${CONFIG.VEHICULO_ID}/demos`, {
            method: 'GET',
            headers: { 
                'ngrok-skip-browser-warning': 'true', 
                'Accept': 'application/json' 
            }
        });
        
        if (!resp.ok) throw new Error("Error en red");
        const demos = await resp.json();
        
        const select = document.querySelector('.demo-select');
        select.innerHTML = '<option value="">Seleccione una DEMO...</option>';
        
        demos.forEach(demo => {
            let opt = document.createElement('option');
            opt.value = demo.id_demo;
            opt.text = `${demo.id_demo} - ${demo.nombre}`;
            select.appendChild(opt);
        });
    } catch (error) {
        console.error("Fallo al cargar las demos:", error);
    }
}

document.querySelector('.btn-play').addEventListener('click', async () => {
    const idDemo = document.querySelector('.demo-select').value;
    if (!idDemo) { alert("Selecciona una demo de la lista primero."); return; }

    try {
        agregarAlHistorial(`Iniciando Demo ${idDemo}...`);
        await fetch(`${CONFIG.API_BASE}/vehiculos/${CONFIG.VEHICULO_ID}/demo/${idDemo}/iniciar`, {
            method: 'POST',
            headers: { 'ngrok-skip-browser-warning': 'true', 'Accept': 'application/json' }
        });
    } catch (e) {
        agregarAlHistorial(`<span style="color: #e74c3c;">Error al iniciar demo</span>`);
    }
});

document.querySelector('.btn-clear').addEventListener('click', async () => {
    try {
        agregarAlHistorial(`Cancelando Demo...`);
        await fetch(`${CONFIG.API_BASE}/vehiculos/${CONFIG.VEHICULO_ID}/demo/cancelar`, {
            method: 'POST',
            headers: { 'ngrok-skip-browser-warning': 'true', 'Accept': 'application/json' }
        });
    } catch (e) {
        console.error("Error al cancelar demo", e);
    }
});

// ==========================================
// 4. LÓGICA DE LOS JOYSTICKS
// ==========================================
function setupJoystick(joystickId, mapConfig) {
    const stick = document.getElementById(joystickId);
    const maxDist = 50; 
    let isDragging = false;
    let activeCommand = 13;

    function onStart(e) {
        isDragging = true;
        stick.style.transition = "none";
    }

    function onMove(e) {
        if (!isDragging) return;
        e.preventDefault(); 
        const rect = stick.parentElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let clientX = e.clientX || (e.touches && e.touches[0].clientX);
        let clientY = e.clientY || (e.touches && e.touches[0].clientY);

        let dx = clientX - centerX;
        let dy = clientY - centerY;
        
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > maxDist) {
            dx = (dx / distance) * maxDist;
            dy = (dy / distance) * maxDist;
        }

        stick.style.transform = `translate(${dx}px, ${dy}px)`;

        let newCommand = 13;
        if (distance > 25) { 
            if (Math.abs(dx) > Math.abs(dy)) {
                newCommand = dx > 0 ? mapConfig.right : mapConfig.left;
            } else {
                newCommand = dy > 0 ? mapConfig.down : mapConfig.up;
            }
        }

        if(newCommand !== activeCommand) {
            activeCommand = newCommand;
            if(activeCommand !== 13) enviarComando(activeCommand);
        }
    }

    function onEnd(e) {
        if (!isDragging) return;
        isDragging = false;
        stick.style.transition = "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
        stick.style.transform = `translate(0px, 0px)`;
        activeCommand = 13;
        enviarComando(13); 
    }

    stick.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    
    stick.addEventListener('touchstart', onStart, {passive: false});
    window.addEventListener('touchmove', onMove, {passive: false});
    window.addEventListener('touchend', onEnd);
}

setupJoystick('joyLeft', { up: 2, down: 3, left: 4, right: 1 });
setupJoystick('joyRight', { up: 10, down: 11, left: 9, right: 12 });

// ==========================================
// 5. INICIO AUTOMÁTICO
// ==========================================
window.onload = () => {
    iniciarWebSocket();
    monitorearSalud();
    setInterval(monitorearSalud, 10000);
    cargarDemos();
    agregarAlHistorial("INTERFAZ CARGADA");
};

// ==========================================
// 6. NAVEGACIÓN ENTRE SUBPÁGINAS (VISTAS)
// ==========================================
const tabControl = document.getElementById('tab-control');
const tabHistorial = document.getElementById('tab-historial');
const viewControl = document.getElementById('view-control');
const viewHistorial = document.getElementById('view-historial');

tabControl.addEventListener('click', () => {
    // Mostrar Control, ocultar Historial
    viewControl.style.display = 'block';
    viewHistorial.style.display = 'none';
    tabControl.className = 'tab-btn active';
    // Cambiar estilos de los botones (Activo / Inactivo)
    // tabControl.className = 'btn btn-warning active';
    tabHistorial.className = 'tab-btn inactive';
});

tabHistorial.addEventListener('click', () => {
    // Mostrar Historial, ocultar Control
    viewHistorial.style.display = 'block';
    viewControl.style.display = 'none';
    tabHistorial.className = 'tab-btn active';
    // Cambiar estilos de los botones (Activo / Inactivo)
    // tabHistorial.className = 'btn btn-warning active';
    tabControl.className = 'tab-btn inactive';
});