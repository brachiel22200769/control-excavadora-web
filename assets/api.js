import { CONFIG } from './config.js';

export async function enviarComandoRest(comandoId) {
    try {
        const res = await fetch(`${CONFIG.API_BASE}/vehiculos/${CONFIG.VEHICULO_ID}/movimiento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_comando: comandoId, origen: 'Botonera Web' })
        });
        if (!res.ok) {
            const data = await res.json();
            return { ok: false, error: data.detail || res.status };
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

export async function obtenerDemos() {
    try {
        const resp = await fetch(`${CONFIG.API_BASE}/vehiculos/${CONFIG.VEHICULO_ID}/demos`);
        if (!resp.ok) return [];
        return await resp.json();
    } catch (e) { return []; }
}

export async function checkApiHealth() {
    try {
        const resp = await fetch(`${CONFIG.API_BASE}/vehiculos/${CONFIG.VEHICULO_ID}/estado`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        return resp.ok;
    } catch (e) { return false; }
}

// Página de administración de demos: crear y eliminar demos
export async function crearDemoRest(nombre, descripcion = "Secuencia personalizada") {
    try {
        const res = await fetch(`${CONFIG.API_BASE}/vehiculos/${CONFIG.VEHICULO_ID}/demos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, descripcion })
        });
        return res.ok;
    } catch (e) {
        return false;
    }
}

export async function eliminarDemoRest(idDemo) {
    try {
        const res = await fetch(`${CONFIG.API_BASE}/vehiculos/${CONFIG.VEHICULO_ID}/demo/${idDemo}`, {
            method: 'DELETE'
        });
        return res.ok;
    } catch (e) {
        return false;
    }
}