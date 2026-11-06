import { CONFIG } from './config.js';

export async function enviarComando(comandoId) {
    try {
        const resp = await fetch(`${CONFIG.API_BASE}/vehiculos/${CONFIG.VEHICULO_ID}/movimiento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_comando: comandoId, origen: 'WEB' })
        });
        return resp.ok;
    } catch (e) { return false; }
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
        const resp = await fetch(`${CONFIG.API_BASE}/vehiculos/${CONFIG.VEHICULO_ID}/estado`);
        return resp.ok;
    } catch (e) { return false; }
}