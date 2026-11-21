import {
    obtenerDemosVehiculo,
    obtenerComandosVehiculo,
    crearDemoRest,
    actualizarDemoRest,
    eliminarDemoRest,
    obtenerMovimientosDemo,
    agregarMovimientoDemoRest,
    actualizarMovimientoDemoRest,
    eliminarMovimientoDemoRest,
} from './api.js';

export function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Monta un gestor completo de Demos + Editor de Movimientos en cualquier contenedor.
 * Se usa tanto en "Mis Demos" (Usuario) como en "Editar Todo > Demos" (Admin).
 */
export async function montarGestorDemos(container, idVehiculo, onDemosChanged = null) {
    if (!container || !idVehiculo) return;
    container.innerHTML = `<div class="text-center py-3 text-secondary">Cargando demos del vehículo #${idVehiculo}...</div>`;

    const [resDemos, resCmds] = await Promise.all([
        obtenerDemosVehiculo(idVehiculo),
        obtenerComandosVehiculo(idVehiculo),
    ]);

    if (!resDemos.ok) {
        container.innerHTML = `<div class="alert alert-danger mb-0">${escapeHtml(resDemos.error)}</div>`;
        return;
    }

    const demos = resDemos.data || [];
    const comandos = (resCmds.data || []).filter((c) => c.activo);
    let demoActivaId = null;

    container.innerHTML = `
        <div class="mb-3">
            <label class="form-label small text-warning fw-bold">➕ Crear nueva demo</label>
            <div class="row g-2">
                <div class="col-md-5">
                    <input type="text" class="form-control form-control-sm js-new-demo-name" placeholder="Nombre de la demo" maxlength="80">
                </div>
                <div class="col-md-5">
                    <input type="text" class="form-control form-control-sm js-new-demo-desc" placeholder="Descripción breve" maxlength="200">
                </div>
                <div class="col-md-2 d-grid">
                    <button type="button" class="btn btn-warning btn-sm fw-bold js-btn-add-demo">Crear</button>
                </div>
            </div>
        </div>

        <div class="js-demos-list d-flex flex-column gap-2 mb-3"></div>
        <div class="js-steps-panel border-top border-secondary pt-3" style="display:none;"></div>
    `;

    const listEl = container.querySelector('.js-demos-list');
    const stepsPanel = container.querySelector('.js-steps-panel');

    const renderLista = (lista) => {
        if (!lista.length) {
            listEl.innerHTML = `<div class="alert alert-secondary py-2 mb-0 small">No hay demos registradas en esta unidad todavía.</div>`;
            return;
        }
        listEl.innerHTML = lista
            .map(
                (d) => `
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 p-2 rounded border border-secondary bg-dark bg-opacity-50">
                <div>
                    <span class="fw-bold text-warning">#${d.id_demo} ${escapeHtml(d.nombre)}</span>
                    <span class="badge ${d.tipo_demo === 'PRIVADA' ? 'bg-info text-dark' : 'bg-secondary'} ms-1">${escapeHtml(d.tipo_demo || 'EMPRESA')}</span>
                    <div class="small text-secondary">${escapeHtml(d.descripcion || 'Sin descripción')}</div>
                </div>
                <div class="btn-group btn-group-sm">
                    <button type="button" class="btn btn-outline-warning js-open-steps" data-id="${d.id_demo}" data-name="${escapeHtml(d.nombre)}">✏️ Pasos</button>
                    <button type="button" class="btn btn-outline-light js-rename-demo" data-id="${d.id_demo}" data-name="${escapeHtml(d.nombre)}" data-desc="${escapeHtml(d.descripcion || '')}">📝</button>
                    <button type="button" class="btn btn-outline-danger js-del-demo" data-id="${d.id_demo}" data-name="${escapeHtml(d.nombre)}">🗑️</button>
                </div>
            </div>`
            )
            .join('');

        listEl.querySelectorAll('.js-open-steps').forEach((btn) => {
            btn.addEventListener('click', () => {
                demoActivaId = Number(btn.dataset.id);
                cargarPasos(demoActivaId, btn.dataset.name);
            });
        });

        listEl.querySelectorAll('.js-rename-demo').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const nuevoNombre = prompt('Nuevo nombre para la demo:', btn.dataset.name);
                if (!nuevoNombre || !nuevoNombre.trim()) return;
                const nuevaDesc = prompt('Nueva descripción:', btn.dataset.desc) ?? btn.dataset.desc;
                const r = await actualizarDemoRest(Number(btn.dataset.id), nuevoNombre.trim(), nuevaDesc.trim(), true);
                if (!r.ok) return alert(r.error);
                if (onDemosChanged) await onDemosChanged();
                await montarGestorDemos(container, idVehiculo, onDemosChanged);
            });
        });

        listEl.querySelectorAll('.js-del-demo').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (!confirm(`¿Eliminar permanentemente la demo "${btn.dataset.name}" y todos sus pasos?`)) return;
                const r = await eliminarDemoRest(Number(btn.dataset.id));
                if (!r.ok) return alert(r.error);
                if (onDemosChanged) await onDemosChanged();
                await montarGestorDemos(container, idVehiculo, onDemosChanged);
            });
        });
    };

    const cargarPasos = async (idDemo, nombreDemo) => {
        stepsPanel.style.display = 'block';
        stepsPanel.innerHTML = `<div class="small text-secondary">Cargando pasos...</div>`;

        const res = await obtenerMovimientosDemo(idDemo);
        if (!res.ok) {
            stepsPanel.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(res.error)}</div>`;
            return;
        }
        const pasos = res.data || [];
        const siguienteOrden = pasos.length ? Math.max(...pasos.map((p) => p.orden)) + 1 : 1;

        const opcionesCmd = comandos
            .map((c) => `<option value="${c.id_comando}">${c.codigo} - ${escapeHtml(c.nombre)}</option>`)
            .join('');

        stepsPanel.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="text-warning mb-0">🎬 Secuencia de pasos: ${escapeHtml(nombreDemo)} (ID ${idDemo})</h6>
                <button type="button" class="btn btn-sm btn-outline-secondary js-close-steps">Cerrar pasos</button>
            </div>

            <div class="table-responsive mb-3">
                <table class="table table-sm table-iot align-middle">
                    <thead>
                        <tr>
                            <th>Orden</th>
                            <th>Comando</th>
                            <th>Duración (ms)</th>
                            <th>Pausa (ms)</th>
                            <th class="text-end">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            pasos.length === 0
                                ? `<tr><td colspan="5" class="text-center text-secondary py-3">Sin pasos todavía. Agrega el primero abajo.</td></tr>`
                                : pasos
                                      .map(
                                          (p, idx) => `
                                <tr>
                                    <td><span class="badge bg-warning text-dark">#${p.orden}</span></td>
                                    <td>
                                        <select class="form-select form-select-sm js-step-cmd" data-id="${p.id_demo_movimiento}">
                                            ${comandos
                                                .map(
                                                    (c) =>
                                                        `<option value="${c.id_comando}" ${
                                                            c.id_comando === p.id_comando ? 'selected' : ''
                                                        }>${c.codigo} - ${escapeHtml(c.nombre)}</option>`
                                                )
                                                .join('')}
                                        </select>
                                    </td>
                                    <td style="max-width:110px;">
                                        <input type="number" class="form-control form-control-sm js-step-dur" min="100" max="15000" step="100" value="${p.duracion_ms}">
                                    </td>
                                    <td style="max-width:100px;">
                                        <input type="number" class="form-control form-control-sm js-step-pausa" min="0" max="10000" step="100" value="${p.pausa_ms}">
                                    </td>
                                    <td class="text-end text-nowrap">
                                        <button type="button" class="btn btn-sm btn-outline-light js-move-up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Subir">⬆️</button>
                                        <button type="button" class="btn btn-sm btn-outline-light js-move-down" data-idx="${idx}" ${idx === pasos.length - 1 ? 'disabled' : ''} title="Bajar">⬇️</button>
                                        <button type="button" class="btn btn-sm btn-success js-save-step" data-id="${p.id_demo_movimiento}" data-orden="${p.orden}" title="Guardar cambios">💾</button>
                                        <button type="button" class="btn btn-sm btn-danger js-del-step" data-id="${p.id_demo_movimiento}" title="Eliminar paso">🗑️</button>
                                    </td>
                                </tr>`
                                      )
                                      .join('')
                        }
                    </tbody>
                </table>
            </div>

            <div class="p-2 rounded bg-black bg-opacity-25 border border-secondary">
                <div class="small fw-bold text-light mb-2">➕ Agregar paso #${siguienteOrden}</div>
                <div class="row g-2 align-items-end">
                    <div class="col-md-5">
                        <label class="form-label small mb-1">Comando</label>
                        <select class="form-select form-select-sm js-add-cmd">${opcionesCmd}</select>
                    </div>
                    <div class="col-6 col-md-3">
                        <label class="form-label small mb-1">Duración (ms)</label>
                        <input type="number" class="form-control form-control-sm js-add-dur" min="100" max="15000" step="100" value="1500">
                    </div>
                    <div class="col-6 col-md-2">
                        <label class="form-label small mb-1">Pausa (ms)</label>
                        <input type="number" class="form-control form-control-sm js-add-pausa" min="0" max="10000" step="100" value="300">
                    </div>
                    <div class="col-md-2 d-grid">
                        <button type="button" class="btn btn-success btn-sm fw-bold js-btn-add-step">Agregar</button>
                    </div>
                </div>
            </div>
        `;

        stepsPanel.querySelector('.js-close-steps').addEventListener('click', () => {
            stepsPanel.style.display = 'none';
            demoActivaId = null;
        });

        // Agregar paso
        stepsPanel.querySelector('.js-btn-add-step').addEventListener('click', async () => {
            const id_comando = Number(stepsPanel.querySelector('.js-add-cmd').value);
            const duracion_ms = Number(stepsPanel.querySelector('.js-add-dur').value);
            const pausa_ms = Number(stepsPanel.querySelector('.js-add-pausa').value);
            if (!id_comando || duracion_ms < 100 || duracion_ms > 15000) {
                return alert('Duración permitida entre 100 ms y 15000 ms.');
            }
            const r = await agregarMovimientoDemoRest(idDemo, {
                id_comando,
                orden: siguienteOrden,
                duracion_ms,
                pausa_ms,
            });
            if (!r.ok) return alert(r.error);
            await cargarPasos(idDemo, nombreDemo);
        });

        // Guardar cambios en un paso
        stepsPanel.querySelectorAll('.js-save-step').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const tr = btn.closest('tr');
                const idMov = Number(btn.dataset.id);
                const orden = Number(btn.dataset.orden);
                const id_comando = Number(tr.querySelector('.js-step-cmd').value);
                const duracion_ms = Number(tr.querySelector('.js-step-dur').value);
                const pausa_ms = Number(tr.querySelector('.js-step-pausa').value);
                const r = await actualizarMovimientoDemoRest(idMov, { id_comando, orden, duracion_ms, pausa_ms });
                if (!r.ok) return alert(r.error);
                await cargarPasos(idDemo, nombreDemo);
            });
        });

        // Eliminar paso
        stepsPanel.querySelectorAll('.js-del-step').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const r = await eliminarMovimientoDemoRest(Number(btn.dataset.id));
                if (!r.ok) return alert(r.error);
                await cargarPasos(idDemo, nombreDemo);
            });
        });

        // Intercambiar orden seguro (evita choque con UNIQUE (id_demo, orden))
        const intercambiar = async (idxA, idxB) => {
            const a = pasos[idxA];
            const b = pasos[idxB];
            const tempOrden = 199;
            let r = await actualizarMovimientoDemoRest(a.id_demo_movimiento, {
                id_comando: a.id_comando,
                orden: tempOrden,
                duracion_ms: a.duracion_ms,
                pausa_ms: a.pausa_ms,
            });
            if (!r.ok) return alert(r.error);
            r = await actualizarMovimientoDemoRest(b.id_demo_movimiento, {
                id_comando: b.id_comando,
                orden: a.orden,
                duracion_ms: b.duracion_ms,
                pausa_ms: b.pausa_ms,
            });
            if (!r.ok) return alert(r.error);
            r = await actualizarMovimientoDemoRest(a.id_demo_movimiento, {
                id_comando: a.id_comando,
                orden: b.orden,
                duracion_ms: a.duracion_ms,
                pausa_ms: a.pausa_ms,
            });
            if (!r.ok) return alert(r.error);
            await cargarPasos(idDemo, nombreDemo);
        };

        stepsPanel.querySelectorAll('.js-move-up').forEach((btn) => {
            btn.addEventListener('click', () => {
                const i = Number(btn.dataset.idx);
                if (i > 0) intercambiar(i, i - 1);
            });
        });
        stepsPanel.querySelectorAll('.js-move-down').forEach((btn) => {
            btn.addEventListener('click', () => {
                const i = Number(btn.dataset.idx);
                if (i < pasos.length - 1) intercambiar(i, i + 1);
            });
        });
    };

    // Botón crear demo
    container.querySelector('.js-btn-add-demo').addEventListener('click', async () => {
        const nameInput = container.querySelector('.js-new-demo-name');
        const descInput = container.querySelector('.js-new-demo-desc');
        const nombre = nameInput.value.trim();
        const desc = descInput.value.trim() || 'Secuencia personalizada';
        if (!nombre) return alert('Escribe un nombre para la demo.');
        const r = await crearDemoRest(idVehiculo, nombre, desc);
        if (!r.ok) return alert(r.error);
        if (onDemosChanged) await onDemosChanged();
        await montarGestorDemos(container, idVehiculo, onDemosChanged);
    });

    renderLista(demos);
}