import { CONFIG } from './config.js';
import {
    getToken,
    getUser,
    getGuestExpiry,
    saveSession,
    clearSession,
    checkSystemHealth,
    obtenerCatalogoPublico,
    loginRest,
    registerRest,
    startGuestRest,
    getMeRest,
    logoutRest,
    obtenerMisVehiculos,
    obtenerComandosVehiculo,
    obtenerEstadoVehiculo,
    obtenerHistorialVehiculo,
    enviarComandoRest,
    obtenerDemosVehiculo,
    iniciarDemoRest,
    cancelarDemoRest,
} from './api.js';
import { iniciarPanelAdmin } from './admin.js';
import { montarGestorDemos, escapeHtml } from './demoEditor.js';

// ==========================================
// ESTADO GLOBAL DE LA APP
// ==========================================
const wsDot = document.getElementById('led-ws');
const apiDot = document.getElementById('led-api');
const rdsDot = document.getElementById('led-rds');
const rdsLabelEl = document.getElementById('rds-label');

let ws = null;
let wsReconnectTimer = null;
let guestCountdownInterval = null;
let activeVehicleId = null;
let lastCommand = 13;
let misVehiculos = [];
let comandosActivosSet = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);

const nombresAcciones = {
    1: 'GIRANDO IZQUIERDA',
    2: 'AVANZANDO',
    3: 'RETROCEDIENDO',
    4: 'GIRANDO DERECHA',
    5: 'SONIDO ON/OFF',
    6: 'ON/OFF',
    7: 'LUCES ON/OFF',
    8: 'MODO AUX',
    9: 'ROTANDO CABINA IZQ',
    10: 'SUBIR BRAZO',
    11: 'BAJAR BRAZO',
    12: 'ROTANDO CABINA DER',
    13: 'DETENIDO',
};

// ==========================================
// 1. INDICADORES INDEPENDIENTES (WSS / API / RDS)
// ==========================================
async function monitorearSalud() {
    const salud = await checkSystemHealth();
    apiDot.className = salud.api ? 'dot on' : 'dot err';
    rdsDot.className = salud.rds ? 'dot on' : 'dot err';
    if (rdsLabelEl) {
        rdsLabelEl.textContent = salud.rds ? 'RDS' : 'RDS (SIN VERIFICAR)';
    }
}

function setTelemetryState(texto, colorClass = 'text-warning') {
    const el = document.getElementById('telemetryAck');
    if (!el) return;
    el.className = `ack-pill ${colorClass}`;
    el.textContent = texto;
}

function actualizarUltimoMovimiento(nombreComando) {
    const colorFlash = nombreComando === 'DETENIDO' ? 'rgba(231, 76, 60, 1)' : 'rgba(46, 204, 113, 1)';
    ['last-move-control', 'last-move-history', 'last-move-demos'].forEach((id) => {
        const d = document.getElementById(id);
        if (d) {
            d.innerHTML = `<span class="cmd-text" style="text-shadow: 0 0 15px ${colorFlash};">${escapeHtml(nombreComando)}</span>`;
        }
    });
}

// ==========================================
// 2. WEBSOCKET AISLADO POR VEHÍCULO
// ==========================================
function cerrarWebSocket() {
    if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
    }
    if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
    }
    wsDot.className = 'dot sim';
}

function conectarWebSocketVehiculo(idVehiculo) {
    cerrarWebSocket();
    const token = getToken();
    if (!token || !idVehiculo) return;

    const url = `${CONFIG.WS_BASE}/ws/vehiculos/${idVehiculo}?token=${encodeURIComponent(token)}`;
    try {
        ws = new WebSocket(url);
        ws.onopen = () => {
            wsDot.className = 'dot on';
        };
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'SESION_REVOCADA') {
                    alert(`Sesión cerrada: ${data.motivo || 'Permisos actualizados'}`);
                    ejecutarLogoutLocal();
                    return;
                }

                // Ignorar eventos de otro vehículo por seguridad
                if (data.vehiculo && Number(data.vehiculo) !== Number(activeVehicleId)) return;

                if (data.esp_conectado !== undefined) {
                    const espBadge = document.getElementById('espHardwareBadge');
                    if (espBadge) {
                        espBadge.textContent = data.esp_conectado ? 'ESP8266: Conectado' : 'ESP8266: Sin señal';
                        espBadge.className = `badge ${data.esp_conectado ? 'bg-success' : 'bg-secondary'}`;
                    }
                }

                if (data.status !== undefined) {
                    const cmdCode = parseInt(data.status, 10);
                    animarInterfazFantasma(cmdCode);
                    const nombre = data.comando_nombre || nombresAcciones[cmdCode] || `COMANDO ${cmdCode}`;
                    actualizarUltimoMovimiento(nombre);

                    if (data.type === 'DEMO_PASO' || data.type === 'DEMO_PAUSA') {
                        setTelemetryState(`DEMO en curso: ${nombre}`, 'text-info');
                    } else if (data.type === 'DEMO_FIN') {
                        setTelemetryState('DEMO finalizada (DETENIDO)', 'text-success');
                    } else if (data.type === 'MOVIMIENTO_MANUAL') {
                        setTelemetryState(`Reportado WSS: ${nombre}`, 'text-success');
                        // Reconciliar historial real desde RDS (sin meter pasos de DEMO)
                        cargarHistorialRDS(activeVehicleId);
                    }
                }
            } catch {
                // dato no JSON
            }
        };
        ws.onclose = () => {
            wsDot.className = 'dot err';
            if (getToken() && activeVehicleId === idVehiculo) {
                wsReconnectTimer = setTimeout(() => conectarWebSocketVehiculo(idVehiculo), 3500);
            }
        };
        ws.onerror = () => {
            wsDot.className = 'dot err';
        };
    } catch {
        wsDot.className = 'dot err';
    }
}

// ==========================================
// 3. ENVÍO DE COMANDOS Y HISTORIAL REAL RDS
// ==========================================
async function enviarComando(cmdCode) {
    if (!activeVehicleId) return;
    const esToggle = [5, 7, 8].includes(cmdCode);
    if (!esToggle && cmdCode !== 13 && cmdCode === lastCommand) return;
    if (!comandosActivosSet.has(cmdCode) && cmdCode !== 13) {
        setTelemetryState(`Comando ${cmdCode} deshabilitado en esta unidad`, 'text-danger');
        return;
    }

    lastCommand = cmdCode;
    const nombre = nombresAcciones[cmdCode] || `COMANDO ${cmdCode}`;
    actualizarUltimoMovimiento(nombre);
    setTelemetryState(`Solicitado: ${nombre}...`, 'text-warning');

    const res = await enviarComandoRest(activeVehicleId, cmdCode, 'Botonera Web');
    if (!res.ok) {
        setTelemetryState(`Rechazado (${res.status}): ${res.error}`, 'text-danger');
        if (res.status === 401) {
            alert(res.error);
            ejecutarLogoutLocal();
        }
        return;
    }
    setTelemetryState(`Aceptado API: ${res.data?.comando || nombre}`, 'text-info');
    cargarHistorialRDS(activeVehicleId);
}

function formatearFechaMX(fechaStr) {
    if (!fechaStr) return '';
    const limpia = String(fechaStr).trim().replace(' ', 'T');
    const isoUtc = /[zZ]|[+-]\d{2}:\d{2}$/.test(limpia) ? limpia : `${limpia}Z`;
    return new Date(isoUtc).toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
    });
}

async function cargarHistorialRDS(idVehiculo) {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody || !idVehiculo) return;
    const res = await obtenerHistorialVehiculo(idVehiculo);
    if (!res.ok) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-2">${escapeHtml(res.error)}</td></tr>`;
        return;
    }
    const items = (res.data || []).slice(0, 10);
    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-secondary py-3">Sin movimientos persistidos en RDS todavía.</td></tr>`;
        return;
    }
    tbody.innerHTML = items
        .map((h) => {
            const fecha = formatearFechaMX(h.fecha_hora);
            return `
            <tr>
                <td class="small text-secondary">${escapeHtml(fecha)}</td>
                <td class="fw-bold text-warning">${escapeHtml(h.comando || `CMD ${h.codigo}`)}</td>
                <td><span class="badge bg-dark border border-secondary">${escapeHtml(h.codigo ?? '')}</span></td>
                <td><span class="badge bg-secondary">${escapeHtml(h.origen || 'MANUAL')}</span></td>
            </tr>`;
        })
        .join('');
}

async function cargarDemosSelect(idVehiculo) {
    const select = document.getElementById('demoSelect');
    if (!select || !idVehiculo) return;
    const res = await obtenerDemosVehiculo(idVehiculo);
    if (!res.ok) {
        select.innerHTML = '<option value="">Error al cargar demos</option>';
        return;
    }
    const demos = res.data || [];
    select.innerHTML = '<option value="">Seleccione una DEMO...</option>';
    demos.forEach((d) => {
        const opt = document.createElement('option');
        opt.value = d.id_demo;
        opt.textContent = `${d.id_demo} - ${d.nombre}`;
        select.appendChild(opt);
    });
}

async function seleccionarVehiculo(idVehiculo) {
    activeVehicleId = Number(idVehiculo);
    lastCommand = 13;

    const v = misVehiculos.find((x) => x.id_vehiculo === activeVehicleId);
    const infoEl = document.getElementById('activeVehicleBadge');
    if (infoEl && v) {
        infoEl.textContent = `${v.nombre} (${v.numero_serie || 'ID ' + v.id_vehiculo})`;
    }

    // Cargar comandos permitidos, estado inicial, demos e historial real de RDS
    const [resCmds, resEstado] = await Promise.all([
        obtenerComandosVehiculo(activeVehicleId),
        obtenerEstadoVehiculo(activeVehicleId),
        cargarDemosSelect(activeVehicleId),
        cargarHistorialRDS(activeVehicleId),
    ]);

    if (resCmds.ok) {
        comandosActivosSet = new Set((resCmds.data || []).filter((c) => c.activo).map((c) => c.codigo));
    }

    if (resEstado.ok && resEstado.data?.length) {
        const est = resEstado.data[0];
        actualizarUltimoMovimiento(est.comando || 'DETENIDO');
        const espBadge = document.getElementById('espHardwareBadge');
        if (espBadge) {
            espBadge.textContent = est.esp_conectado ? 'ESP8266: Conectado' : 'ESP8266: Sin señal';
            espBadge.className = `badge ${est.esp_conectado ? 'bg-success' : 'bg-secondary'}`;
        }
    }

    // Si es USUARIO (no invitado), montar el editor de Mis Demos para esta unidad
    const user = getUser();
    if (user?.rol === 'USUARIO') {
        montarGestorDemos(
            document.getElementById('misDemosContainer'),
            activeVehicleId,
            () => cargarDemosSelect(activeVehicleId)
        );
    }

    conectarWebSocketVehiculo(activeVehicleId);
}

// ==========================================
// 4. ENRUTAMIENTO POR ROL (LOGIN / ADMIN / USUARIO / INVITADO)
// ==========================================
function mostrarSoloSeccion(idSeccion) {
    ['view-auth', 'view-user-app', 'view-admin-panel'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === idSeccion ? 'block' : 'none';
    });
}

function detenerCronometroInvitado() {
    if (guestCountdownInterval) {
        clearInterval(guestCountdownInterval);
        guestCountdownInterval = null;
    }
}

function iniciarCronometroInvitado(expiraIso) {
    detenerCronometroInvitado();
    const banner = document.getElementById('guestBanner');
    const timerEl = document.getElementById('guestCountdown');
    if (!banner || !timerEl || !expiraIso) return;
    banner.style.display = 'flex';

    const expMs = new Date(expiraIso).getTime();
    const tick = () => {
        const restSeg = Math.max(0, Math.floor((expMs - Date.now()) / 1000));
        const mm = String(Math.floor(restSeg / 60)).padStart(2, '0');
        const ss = String(restSeg % 60).padStart(2, '0');
        timerEl.textContent = `${mm}:${ss}`;
        if (restSeg <= 0) {
            detenerCronometroInvitado();
            alert('Tu tiempo de prueba de 5 minutos en Modo Invitado ha terminado.');
            ejecutarLogoutLocal();
        }
    };
    tick();
    guestCountdownInterval = setInterval(tick, 1000);
}

async function cargarCatalogoEn(containerId) {
    const box = document.getElementById(containerId);
    if (!box) return;
    const res = await obtenerCatalogoPublico();
    if (!res.ok) {
        box.innerHTML = `<div class="small text-danger">${escapeHtml(res.error)}</div>`;
        return;
    }
    const modelos = res.data || [];
    if (!modelos.length) {
        box.innerHTML = `<div class="small text-secondary">No hay modelos disponibles en el catálogo.</div>`;
        return;
    }
    box.innerHTML = modelos
        .map(
            (m) => `
        <div class="col-md-6">
            <div class="p-3 rounded border border-secondary bg-dark bg-opacity-75 h-100">
                <h6 class="text-warning fw-bold mb-1">${escapeHtml(m.nombre)}</h6>
                <p class="small text-light mb-1">${escapeHtml(m.descripcion || '')}</p>
                <div class="small text-info">${escapeHtml(m.especificaciones || m.microcontrolador_base)}</div>
            </div>
        </div>`
        )
        .join('');
}

async function cargarInterfazSegunRol(user) {
    const pill = document.getElementById('headerUserPill');
    const logoutBtn = document.getElementById('btnLogout');
    if (pill) {
        pill.textContent = `${user.nombre} (${user.rol})`;
        pill.style.display = 'inline-block';
    }
    if (logoutBtn) logoutBtn.style.display = 'inline-block';

    // ROL ADMIN: entra ÚNICAMENTE a la vista de Administración
    if (user.rol === 'ADMIN') {
        cerrarWebSocket();
        detenerCronometroInvitado();
        mostrarSoloSeccion('view-admin-panel');
        await iniciarPanelAdmin();
        return;
    }

    // ROL USUARIO o INVITADO: entra directo a Control
    mostrarSoloSeccion('view-user-app');
    const esInvitado = user.rol === 'INVITADO';

    // Configurar pestañas según rol
    document.getElementById('tab-mis-demos').style.display = esInvitado ? 'none' : 'inline-block';
    document.getElementById('tab-catalogo-inv').style.display = esInvitado ? 'inline-block' : 'none';
    document.getElementById('guestBanner').style.display = esInvitado ? 'flex' : 'none';
    document.getElementById('vehicleSelectorWrap').style.display = esInvitado ? 'none' : 'flex';

    cambiarPestanaUsuario('control');

    if (esInvitado) {
        iniciarCronometroInvitado(getGuestExpiry());
        cargarCatalogoEn('guestCatalogoGrid');
    } else {
        detenerCronometroInvitado();
    }

    // Cargar vehículos asignados al usuario o unidad de exhibición del invitado
    const resV = await obtenerMisVehiculos();
    misVehiculos = resV.ok ? resV.data || [] : [];

    const selectVeh = document.getElementById('userVehicleSelect');
    const emptyAlert = document.getElementById('noVehiclesAlert');
    const controlBody = document.getElementById('userControlContent');

    if (!misVehiculos.length) {
        if (emptyAlert) emptyAlert.style.display = 'block';
        if (controlBody) controlBody.style.display = 'none';
        return;
    }

    if (emptyAlert) emptyAlert.style.display = 'none';
    if (controlBody) controlBody.style.display = 'flex';

    if (selectVeh) {
        selectVeh.innerHTML = misVehiculos
            .map((v) => `<option value="${v.id_vehiculo}">${escapeHtml(v.nombre)} — ${escapeHtml(v.numero_serie || 'ID ' + v.id_vehiculo)}</option>`)
            .join('');
    }

    await seleccionarVehiculo(misVehiculos[0].id_vehiculo);
}

function ejecutarLogoutLocal() {
    detenerCronometroInvitado();
    cerrarWebSocket();
    clearSession();
    activeVehicleId = null;
    misVehiculos = [];
    document.getElementById('headerUserPill').style.display = 'none';
    document.getElementById('btnLogout').style.display = 'none';
    mostrarSoloSeccion('view-auth');
    cargarCatalogoEn('publicCatalogoGrid');
}

// ==========================================
// 5. PESTAÑAS DE USUARIO / INVITADO
// ==========================================
function cambiarPestanaUsuario(tabKey) {
    const mapa = {
        control: { btn: 'tab-control', view: 'view-control', display: 'block' },
        historial: { btn: 'tab-historial', view: 'view-historial', display: 'flex' },
        misDemos: { btn: 'tab-mis-demos', view: 'view-mis-demos', display: 'flex' },
        catalogo: { btn: 'tab-catalogo-inv', view: 'view-catalogo-inv', display: 'block' },
    };
    Object.entries(mapa).forEach(([key, cfg]) => {
        const b = document.getElementById(cfg.btn);
        const v = document.getElementById(cfg.view);
        if (b) b.className = key === tabKey ? 'tab-btn active' : 'tab-btn inactive';
        if (v) v.style.display = key === tabKey ? cfg.display : 'none';
    });
    if (tabKey === 'historial' && activeVehicleId) {
        cargarHistorialRDS(activeVehicleId);
    }
}

// ==========================================
// 6. JOYSTICKS, BOTONES Y ANIMACIÓN FANTASMA
// ==========================================
function setupJoystick(joystickId, mapConfig) {
    const stick = document.getElementById(joystickId);
    if (!stick) return;
    const maxDist = 50;
    let isDragging = false;
    let activeCommand = 13;

    function onStart() {
        isDragging = true;
        stick.style.transition = 'none';
    }

    function onMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        const rect = stick.parentElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
        const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);
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

    function onEnd() {
        if (!isDragging) return;
        isDragging = false;
        stick.style.transition = 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        stick.style.transform = 'translate(0px, 0px)';
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

function animarInterfazFantasma(cmdId) {
    const joyLeft = document.getElementById('joyLeft');
    const joyRight = document.getElementById('joyRight');
    if (!joyLeft || !joyRight) return;

    joyLeft.style.transform = 'translate(0px, 0px)';
    joyRight.style.transform = 'translate(0px, 0px)';

    switch (cmdId) {
        case 2: joyLeft.style.transform = 'translate(0px, -50px)'; break;
        case 3: joyLeft.style.transform = 'translate(0px, 50px)'; break;
        case 4: joyLeft.style.transform = 'translate(-50px, 0px)'; break;
        case 1: joyLeft.style.transform = 'translate(50px, 0px)'; break;
        case 10: joyRight.style.transform = 'translate(0px, -50px)'; break;
        case 11: joyRight.style.transform = 'translate(0px, 50px)'; break;
        case 9: joyRight.style.transform = 'translate(-50px, 0px)'; break;
        case 12: joyRight.style.transform = 'translate(50px, 0px)'; break;
        case 7:
        case 5:
        case 8: {
            const btn = document.getElementById(`btn-${cmdId}`);
            if (btn) {
                btn.classList.add('active-toggle');
                setTimeout(() => btn.classList.remove('active-toggle'), 500);
            }
            break;
        }
    }
}

// ==========================================
// 7. INICIALIZACIÓN Y EVENTOS
// ==========================================
function inicializarEventos() {
    // Login
    document.getElementById('formLogin')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errBox = document.getElementById('authError');
        errBox.style.display = 'none';
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        const res = await loginRest(username, password);
        if (!res.ok) {
            errBox.textContent = res.error;
            errBox.style.display = 'block';
            return;
        }
        saveSession(res.data.access_token, res.data.usuario, res.data.expira_en);
        await cargarInterfazSegunRol(res.data.usuario);
    });

    // Registro (exclusivo clientes USUARIO)
    document.getElementById('formRegister')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errBox = document.getElementById('registerError');
        const okBox = document.getElementById('registerSuccess');
        errBox.style.display = 'none';
        okBox.style.display = 'none';

        const res = await registerRest({
            nombre: document.getElementById('regNombre').value.trim(),
            correo: document.getElementById('regCorreo').value.trim(),
            username: document.getElementById('regUsername').value.trim(),
            password: document.getElementById('regPassword').value,
        });
        if (!res.ok) {
            errBox.textContent = res.error;
            errBox.style.display = 'block';
            return;
        }
        okBox.textContent = 'Cuenta creada con éxito. Ahora inicia sesión con tu usuario y contraseña.';
        okBox.style.display = 'block';
        document.getElementById('formRegister').reset();
    });

    // Botón Modo Invitado (5 min)
    document.getElementById('btnModoInvitado')?.addEventListener('click', async () => {
        const errBox = document.getElementById('authError');
        errBox.style.display = 'none';
        const res = await startGuestRest();
        if (!res.ok) {
            errBox.textContent = res.error;
            errBox.style.display = 'block';
            return;
        }
        saveSession(res.data.access_token, res.data.usuario, res.data.expira_en);
        await cargarInterfazSegunRol(res.data.usuario);
    });

    // Logout general y finalizar invitado
    const hacerLogout = async () => {
        await logoutRest();
        ejecutarLogoutLocal();
    };
    document.getElementById('btnLogout')?.addEventListener('click', hacerLogout);
    document.getElementById('btnEndGuest')?.addEventListener('click', hacerLogout);

    // Selector de vehículo (si el comprador tiene más de 1)
    document.getElementById('userVehicleSelect')?.addEventListener('change', (e) => {
        seleccionarVehiculo(Number(e.target.value));
    });

    // Pestañas Usuario
    document.getElementById('tab-control')?.addEventListener('click', () => cambiarPestanaUsuario('control'));
    document.getElementById('tab-historial')?.addEventListener('click', () => cambiarPestanaUsuario('historial'));
    document.getElementById('tab-mis-demos')?.addEventListener('click', () => cambiarPestanaUsuario('misDemos'));
    document.getElementById('tab-catalogo-inv')?.addEventListener('click', () => cambiarPestanaUsuario('catalogo'));

    // Botones centrales del control
    document.getElementById('btn-7')?.addEventListener('click', function () {
        enviarComando(7);
        this.classList.toggle('active-toggle');
    });
    document.getElementById('btn-5')?.addEventListener('click', function () {
        enviarComando(5);
        this.classList.toggle('active-toggle');
    });
    document.getElementById('btn-8')?.addEventListener('click', () => enviarComando(8));
    document.getElementById('btn-stop')?.addEventListener('click', () => enviarComando(13));

    // Ejecutar / Cancelar DEMO
    document.getElementById('btn-run-demo')?.addEventListener('click', async () => {
        const idDemo = Number(document.getElementById('demoSelect').value);
        if (!idDemo) return alert('Selecciona una demo de la lista primero.');
        const res = await iniciarDemoRest(activeVehicleId, idDemo);
        if (!res.ok) return alert(res.error);
        setTelemetryState(`DEMO #${idDemo} iniciada`, 'text-info');
    });

    document.getElementById('btn-cancel-demo')?.addEventListener('click', async () => {
        await cancelarDemoRest(activeVehicleId);
        setTelemetryState('DEMO cancelada — DETENIDO', 'text-warning');
    });

    document.getElementById('btnRefreshHistory')?.addEventListener('click', () => {
        if (activeVehicleId) cargarHistorialRDS(activeVehicleId);
    });

    // Joysticks (mismo mapeo que ya validaste con tu ESP8266)
    setupJoystick('joyLeft', { up: 2, down: 3, left: 4, right: 1 });
    setupJoystick('joyRight', { up: 10, down: 11, left: 9, right: 12 });
}

window.addEventListener('DOMContentLoaded', async () => {
    inicializarEventos();
    monitorearSalud();
    setInterval(monitorearSalud, 10000);

    const token = getToken();
    const savedUser = getUser();
    if (token && savedUser) {
        const me = await getMeRest();
        if (me.ok) {
            await cargarInterfazSegunRol({ ...savedUser, ...me.data });
            return;
        }
        clearSession();
    }
    mostrarSoloSeccion('view-auth');
    cargarCatalogoEn('publicCatalogoGrid');
});


// Toggle visual fijo en amarillo para LUCES, SONIDO y AUX
document.querySelectorAll('.center-panel .btn-center').forEach((btn) => {
    btn.addEventListener('click', () => {
        btn.classList.toggle('btn-toggle-on');
    });
});