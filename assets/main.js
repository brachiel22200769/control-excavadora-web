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

        // AQUI ESTÁ LA MAGIA: Escuchamos los comandos en tiempo real
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                // Si la API nos manda un "status", es un paso de la DEMO ejecutándose
                if (data.status !== undefined) {
                    const cmdId = parseInt(data.status);

                    // 1. Movemos los joysticks físicamente
                    animarInterfazFantasma(cmdId);

                    // 2. Actualizamos el texto en el Liquid Glass
                    const nombreComando = nombresAcciones[cmdId] || `COMANDO ${cmdId}`;
                    actualizarUltimoMovimiento(nombreComando);

                    // 3. NUEVO: Lo agregamos al historial (ignorando los DETENIDO = 13)
                    if (cmdId !== 13) {
                        // Le ponemos un color naranja para saber que es un movimiento de la DEMO
                        agregarAlHistorial(`<span style="color: #f39c12;">[DEMO] ${nombreComando}</span>`);
                    }
                }
            } catch (e) {
                console.log("Dato crudo WS:", event.data);
            }
        };

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
// 2. HISTORIAL, PANELES Y ENVÍO DE COMANDOS
// ==========================================
function agregarAlHistorial(texto) {
    const li = document.createElement("li");
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-MX');
    const timeStr = now.toLocaleTimeString('es-MX');

    li.innerHTML = `[${dateStr} ${timeStr}] <b>${texto}</b>`;
    historyList.prepend(li);

    // Lo limitamos exactamente a los últimos 10 movimientos limpios
    if (historyList.children.length > 10) {
        historyList.removeChild(historyList.lastChild);
    }
}
// Punto 2: Función para actualizar los cristales en ambas vistas
function actualizarUltimoMovimiento(nombreComando) {
    const colorFlash = nombreComando === "DETENIDO" ? "rgba(231, 76, 60, 1)" : "rgba(46, 204, 113, 1)";
    const displays = [
        document.getElementById('last-move-control'),
        document.getElementById('last-move-history')
    ];
    displays.forEach(d => {
        if (d) {
            d.innerHTML = `<span class="cmd-text" style="text-shadow: 0 0 15px ${colorFlash};">${nombreComando}</span>`;
        }
    });
}

async function enviarComando(cmdId) {
    if (cmdId !== 13 && cmdId === lastCommand) return;
    lastCommand = cmdId;

    const nombreComando = nombresAcciones[cmdId] || `COMANDO ${cmdId}`;

    // FILTRO VISUAL: Solo lo agregamos a la lista negra si NO es "DETENIDO"
    if (cmdId !== 13) {
        agregarAlHistorial(`Solicitado: ${nombreComando}`);
    }

    // El Liquid Glass de la derecha SÍ debe decir "DETENIDO" para que sepas el estado actual
    actualizarUltimoMovimiento(nombreComando);

    if (modoSimulado) return;

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ status: cmdId }));
    }

    const res = await enviarComandoRest(cmdId);
    if (!res.ok) {
        // Solo avisamos si hay un error crítico, borramos el spam de "Comando Aceptado"
        agregarAlHistorial(`<span style="color: #e74c3c;">[ERROR API] ${res.error}</span>`);
    }
}
// Botones centrales
document.getElementById('btn-7').addEventListener('click', function () {
    enviarComando(7); this.classList.toggle('active-toggle');
});
document.getElementById('btn-5').addEventListener('click', function () {
    enviarComando(5); this.classList.toggle('active-toggle');
});
document.getElementById('btn-8').addEventListener('click', function () {
    enviarComando(8);
});
document.getElementById('btn-stop').addEventListener('click', function () {
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

        if (newCommand !== activeCommand) {
            activeCommand = newCommand;
            if (activeCommand !== 13) enviarComando(activeCommand);
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

    stick.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
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
    viewControl.style.display = 'flex';  // <-- Cambiado a flex
    viewHistorial.style.display = 'none';
    tabControl.className = 'tab-btn active';
    tabHistorial.className = 'tab-btn inactive';
});

tabHistorial.addEventListener('click', () => {
    viewHistorial.style.display = 'flex'; // <-- Cambiado a flex
    viewControl.style.display = 'none';
    tabHistorial.className = 'tab-btn active';
    tabControl.className = 'tab-btn inactive';
});


// ==========================================
// 7. ANIMACIÓN FANTASMA PARA LAS DEMOS (PUNTO 3)
// ==========================================
function animarInterfazFantasma(cmdId) {
    const joyLeft = document.getElementById('joyLeft');
    const joyRight = document.getElementById('joyRight');

    // 1. Reiniciamos ambos joysticks al centro por defecto
    joyLeft.style.transform = 'translate(0px, 0px)';
    joyRight.style.transform = 'translate(0px, 0px)';

    // 2. Aplicamos el movimiento visual según el comando
    switch (cmdId) {
        // Orugas (Joystick Izquierdo)
        case 2: joyLeft.style.transform = 'translate(0px, -50px)'; break; // Avanza
        case 3: joyLeft.style.transform = 'translate(0px, 50px)'; break;  // Retrocede
        case 4: joyLeft.style.transform = 'translate(-50px, 0px)'; break; // Izquierda
        case 1: joyLeft.style.transform = 'translate(50px, 0px)'; break;  // Derecha

        // Cabina y Brazo (Joystick Derecho)
        case 10: joyRight.style.transform = 'translate(0px, -50px)'; break; // Sube Brazo
        case 11: joyRight.style.transform = 'translate(0px, 50px)'; break;  // Baja Brazo
        case 9: joyRight.style.transform = 'translate(-50px, 0px)'; break; // Cabina Izq
        case 12: joyRight.style.transform = 'translate(50px, 0px)'; break;  // Cabina Der

        // Botones Centrales (Los hacemos parpadear medio segundo)
        case 7:
        case 5:
        case 8:
            const btn = document.getElementById(`btn-${cmdId}`);
            if (btn) {
                btn.classList.add('active-toggle');
                setTimeout(() => btn.classList.remove('active-toggle'), 500);
            }
            break;
    }
}