import { CONFIG } from './config.js';

const TOKEN_KEY = 'iot_jwt_token';
const USER_KEY = 'iot_user_data';
const GUEST_EXP_KEY = 'iot_guest_exp';

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
    try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function getGuestExpiry() {
    return localStorage.getItem(GUEST_EXP_KEY);
}

export function saveSession(token, usuario, expiraEn = null) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(usuario));
    if (usuario.rol === 'INVITADO' && expiraEn) {
        localStorage.setItem(GUEST_EXP_KEY, expiraEn);
    } else {
        localStorage.removeItem(GUEST_EXP_KEY);
    }
}

export function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(GUEST_EXP_KEY);
}

export async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = {
        'ngrok-skip-browser-warning': 'true',
        'Accept': 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    };

    try {
        const res = await fetch(`${CONFIG.API_BASE}${path}`, {
            ...options,
            headers,
        });
        let data = null;
        const text = await res.text();
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = { detail: text };
        }

        if (!res.ok) {
            return {
                ok: false,
                status: res.status,
                error: data?.detail || `Error HTTP ${res.status}`,
                data,
            };
        }
        return { ok: true, status: res.status, data };
    } catch (e) {
        return { ok: false, status: 0, error: e.message || 'Sin conexión con el servidor' };
    }
}

// ==========================================
// SALUD Y CATÁLOGO PÚBLICO
// ==========================================
export async function checkSystemHealth() {
    const res = await apiFetch('/health');
    if (!res.ok) return { api: false, rds: false, rdsLabel: 'SIN VERIFICAR' };
    const rdsOk = res.data?.rds === 'OK';
    return {
        api: res.data?.api === 'OK',
        rds: rdsOk,
        rdsLabel: res.data?.rds || 'SIN VERIFICAR',
    };
}

export const obtenerCatalogoPublico = () => apiFetch('/catalogo/modelos');

// ==========================================
// AUTENTICACIÓN E INVITADO
// ==========================================
export const loginRest = (username, password) =>
    apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });

export const registerRest = (payload) =>
    apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

export const startGuestRest = () =>
    apiFetch('/auth/guest', { method: 'POST' });

export const getMeRest = () => apiFetch('/auth/me');

export const logoutRest = () => apiFetch('/auth/logout', { method: 'POST' });

// ==========================================
// OPERACIÓN DE VEHÍCULOS (Usuario / Invitado)
// ==========================================
export const obtenerMisVehiculos = () => apiFetch('/vehiculos/mios');
export const obtenerComandosVehiculo = (idVehiculo) => apiFetch(`/vehiculos/${idVehiculo}/comandos`);
export const obtenerEstadoVehiculo = (idVehiculo) => apiFetch(`/vehiculos/${idVehiculo}/estado`);
export const obtenerHistorialVehiculo = (idVehiculo) => apiFetch(`/vehiculos/${idVehiculo}/historial`);

export const enviarComandoRest = (idVehiculo, comandoId, origen = 'Botonera Web') =>
    apiFetch(`/vehiculos/${idVehiculo}/movimiento`, {
        method: 'POST',
        body: JSON.stringify({ id_comando: comandoId, origen }),
    });

// ==========================================
// DEMOS Y MOVIMIENTOS
// ==========================================
export const obtenerDemosVehiculo = (idVehiculo) => apiFetch(`/vehiculos/${idVehiculo}/demos`);

export const crearDemoRest = (idVehiculo, nombre, descripcion = 'Secuencia personalizada') =>
    apiFetch(`/vehiculos/${idVehiculo}/demos`, {
        method: 'POST',
        body: JSON.stringify({ nombre, descripcion, activo: true }),
    });

export const actualizarDemoRest = (idDemo, nombre, descripcion, activo = true) =>
    apiFetch(`/demos/${idDemo}`, {
        method: 'PUT',
        body: JSON.stringify({ nombre, descripcion, activo }),
    });

export const eliminarDemoRest = (idDemo) =>
    apiFetch(`/demos/${idDemo}`, { method: 'DELETE' });

export const iniciarDemoRest = (idVehiculo, idDemo) =>
    apiFetch(`/vehiculos/${idVehiculo}/demo/${idDemo}/iniciar`, { method: 'POST' });

export const cancelarDemoRest = (idVehiculo) =>
    apiFetch(`/vehiculos/${idVehiculo}/demo/cancelar`, { method: 'POST' });

export const obtenerMovimientosDemo = (idDemo) =>
    apiFetch(`/demos/${idDemo}/movimientos`);

export const agregarMovimientoDemoRest = (idDemo, payload) =>
    apiFetch(`/demos/${idDemo}/movimientos`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });

export const actualizarMovimientoDemoRest = (idMov, payload) =>
    apiFetch(`/movimientos_demo/${idMov}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });

export const eliminarMovimientoDemoRest = (idMov) =>
    apiFetch(`/movimientos_demo/${idMov}`, { method: 'DELETE' });

// ==========================================
// ADMINISTRACIÓN (Exclusivo ADMIN)
// ==========================================
export const obtenerDashboardAdmin = () => apiFetch('/admin/dashboard');
export const obtenerUsuariosAdmin = () => apiFetch('/admin/usuarios');
export const obtenerModelosAdmin = () => apiFetch('/admin/modelos');
export const crearModeloAdmin = (payload) =>
    apiFetch('/admin/modelos', { method: 'POST', body: JSON.stringify(payload) });
export const actualizarModeloAdmin = (idModelo, payload) =>
    apiFetch(`/admin/modelos/${idModelo}`, { method: 'PUT', body: JSON.stringify(payload) });

export const obtenerInventarioAdmin = () => apiFetch('/admin/vehiculos');
export const registrarUnidadAdmin = (payload) =>
    apiFetch('/admin/vehiculos', { method: 'POST', body: JSON.stringify(payload) });
export const editarUnidadCompletaAdmin = (idVehiculo, payload) =>
    apiFetch(`/admin/vehiculos/${idVehiculo}`, { method: 'PUT', body: JSON.stringify(payload) });
export const asignarPropietarioAdmin = (idVehiculo, payload) =>
    apiFetch(`/admin/vehiculos/${idVehiculo}/propietario`, { method: 'PATCH', body: JSON.stringify(payload) });
export const cambiarEstadoUnidadAdmin = (idVehiculo, estado_comercial) =>
    apiFetch(`/admin/vehiculos/${idVehiculo}/estado`, { method: 'PATCH', body: JSON.stringify({ estado_comercial }) });

export const obtenerAuditoriaAdmin = (limit = 100) => apiFetch(`/admin/auditoria?limit=${limit}`);

export const crearComandoAdmin = (idVehiculo, payload) =>
    apiFetch(`/vehiculos/${idVehiculo}/comandos`, { method: 'POST', body: JSON.stringify(payload) });
export const actualizarComandoAdmin = (idComando, payload) =>
    apiFetch(`/comandos/${idComando}`, { method: 'PUT', body: JSON.stringify(payload) });
export const eliminarComandoAdmin = (idComando) =>
    apiFetch(`/comandos/${idComando}`, { method: 'DELETE' });