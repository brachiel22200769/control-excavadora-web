import {
    obtenerDashboardAdmin,
    obtenerUsuariosAdmin,
    obtenerModelosAdmin,
    crearModeloAdmin,
    actualizarModeloAdmin,
    obtenerInventarioAdmin,
    registrarUnidadAdmin,
    editarUnidadCompletaAdmin,
    asignarPropietarioAdmin,
    cambiarEstadoUnidadAdmin,
    obtenerAuditoriaAdmin,
    obtenerComandosVehiculo,
    actualizarComandoAdmin,
} from './api.js';
import { montarGestorDemos, escapeHtml } from './demoEditor.js';

let cacheUsuarios = [];
let cacheModelos = [];
let cacheUnidades = [];
let initialized = false;

export async function iniciarPanelAdmin() {
    if (!initialized) {
        configurarEventosAdmin();
        initialized = true;
    }
    await recargarTodoAdmin();
}

export async function recargarTodoAdmin() {
    await Promise.all([
        cargarDashboard(),
        cargarUsuariosYModelos(),
        cargarInventario(),
        cargarAuditoria(),
    ]);
}

async function cargarDashboard() {
    const el = document.getElementById('adminMetricsBar');
    if (!el) return;
    const res = await obtenerDashboardAdmin();
    if (!res.ok) return;
    const d = res.data;
    el.innerHTML = `
        <div class="col-6 col-md-2"><div class="metric-box"><div class="metric-val">${d.total_unidades}</div><div class="metric-lbl">Unidades</div></div></div>
        <div class="col-6 col-md-2"><div class="metric-box"><div class="metric-val text-success">${d.vendidas}</div><div class="metric-lbl">Vendidas</div></div></div>
        <div class="col-6 col-md-2"><div class="metric-box"><div class="metric-val text-warning">${d.exhibicion}</div><div class="metric-lbl">Exhibición</div></div></div>
        <div class="col-6 col-md-2"><div class="metric-box"><div class="metric-val text-info">${d.disponibles}</div><div class="metric-lbl">Disponibles</div></div></div>
        <div class="col-6 col-md-2"><div class="metric-box"><div class="metric-val text-light">${d.total_clientes}</div><div class="metric-lbl">Clientes</div></div></div>
        <div class="col-6 col-md-2"><div class="metric-box"><div class="metric-val text-danger">${d.invitados_activos}</div><div class="metric-lbl">Invitados On</div></div></div>
    `;
}

async function cargarUsuariosYModelos() {
    const [resUsers, resMods] = await Promise.all([
        obtenerUsuariosAdmin(),
        obtenerModelosAdmin(),
    ]);
    if (resUsers.ok) cacheUsuarios = resUsers.data || [];
    if (resMods.ok) {
        cacheModelos = resMods.data || [];
        renderTablaModelos();
    }
}

async function cargarInventario() {
    const tbody = document.getElementById('tbodyInventario');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3 text-secondary">Cargando unidades...</td></tr>`;
    const res = await obtenerInventarioAdmin();
    if (!res.ok) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-3">${escapeHtml(res.error)}</td></tr>`;
        return;
    }
    cacheUnidades = res.data || [];
    if (!cacheUnidades.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-secondary py-3">Sin unidades registradas.</td></tr>`;
        return;
    }

    tbody.innerHTML = cacheUnidades
        .map((u) => {
            const propTxt = u.propietario_nombre
                ? `👤 ${escapeHtml(u.propietario_nombre)} (${escapeHtml(u.propietario_username)} · ID: ${u.id_propietario})`
                : `<span class="text-secondary">Sin asignar</span>`;
            return `
            <tr>
                <td class="fw-bold">${u.id_vehiculo}</td>
                <td>
                    <div class="fw-bold text-warning">${escapeHtml(u.nombre)}</div>
                    <div class="small text-secondary">${escapeHtml(u.modelo_comercial || u.modelo || 'Sin modelo')}</div>
                </td>
                <td><span class="serie-badge">${escapeHtml(u.numero_serie || 'N/A')}</span></td>
                <td><span class="badge badge-${escapeHtml(u.estado_comercial)}">${escapeHtml(u.estado_comercial)}</span></td>
                <td>${propTxt}</td>
                <td class="text-nowrap">
                    <button type="button" class="btn btn-sm btn-info text-dark fw-bold me-1 js-act-owner" data-id="${u.id_vehiculo}" title="Cambiar dueño">👤</button>
                    <button type="button" class="btn btn-sm btn-warning text-dark fw-bold me-1 js-act-status" data-id="${u.id_vehiculo}" title="Cambiar estado comercial">🔄</button>
                    <button type="button" class="btn btn-sm btn-outline-light fw-bold js-act-edit" data-id="${u.id_vehiculo}" title="Editar todo (datos, comandos y demos)">✏️ Editar</button>
                </td>
            </tr>`;
        })
        .join('');

    tbody.querySelectorAll('.js-act-owner').forEach((b) =>
        b.addEventListener('click', () => abrirModalPropietario(Number(b.dataset.id)))
    );
    tbody.querySelectorAll('.js-act-status').forEach((b) =>
        b.addEventListener('click', () => abrirModalEstado(Number(b.dataset.id)))
    );
    tbody.querySelectorAll('.js-act-edit').forEach((b) =>
        b.addEventListener('click', () => abrirModalEditarTodo(Number(b.dataset.id)))
    );
}

function renderTablaModelos() {
    const tbody = document.getElementById('tbodyModelos');
    if (!tbody) return;
    if (!cacheModelos.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary py-3">No hay modelos registrados.</td></tr>`;
        return;
    }
    tbody.innerHTML = cacheModelos
        .map(
            (m) => `
        <tr>
            <td>${m.id_modelo}</td>
            <td class="fw-bold text-warning">${escapeHtml(m.nombre)}</td>
            <td>${escapeHtml(m.descripcion || '')}</td>
            <td class="small text-secondary">${escapeHtml(m.especificaciones || '')}</td>
            <td>
                <button type="button" class="btn btn-sm btn-outline-warning js-edit-model" data-id="${m.id_modelo}">✏️ Editar</button>
            </td>
        </tr>`
        )
        .join('');

    tbody.querySelectorAll('.js-edit-model').forEach((b) => {
        b.addEventListener('click', () => {
            const m = cacheModelos.find((x) => x.id_modelo === Number(b.dataset.id));
            if (!m) return;
            document.getElementById('modeloModalTitle').textContent = `Editar Modelo #${m.id_modelo}`;
            document.getElementById('modeloIdInput').value = m.id_modelo;
            document.getElementById('modeloNombreInput').value = m.nombre;
            document.getElementById('modeloDescInput').value = m.descripcion || '';
            document.getElementById('modeloSpecsInput').value = m.especificaciones || '';
            document.getElementById('modeloMcuInput').value = m.microcontrolador_base || 'ESP8266';
            bootstrap.Modal.getOrCreateInstance(document.getElementById('modalModelo')).show();
        });
    });
}

async function cargarAuditoria() {
    const tbody = document.getElementById('tbodyAuditoria');
    if (!tbody) return;
    const res = await obtenerAuditoriaAdmin(100);
    if (!res.ok) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">${escapeHtml(res.error)}</td></tr>`;
        return;
    }
    const rows = res.data || [];
    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary py-3">Sin registros en bitácora.</td></tr>`;
        return;
    }
    tbody.innerHTML = rows
        .map((r) => {
            const fecha = r.fecha_hora ? new Date(r.fecha_hora).toLocaleString('es-MX') : '';
            return `
            <tr>
                <td>${r.id_auditoria}</td>
                <td class="text-warning fw-semibold">${escapeHtml(r.correo_actor || r.username_actor)}</td>
                <td><span class="badge bg-secondary">${escapeHtml(r.accion)}</span></td>
                <td>${escapeHtml(r.detalles || '')}</td>
                <td class="small text-secondary text-nowrap">${escapeHtml(fecha)}</td>
            </tr>`;
        })
        .join('');
}

function llenarSelectUsuarios(selectEl, seleccionado = null) {
    const compradores = cacheUsuarios.filter((u) => u.rol === 'USUARIO');
    selectEl.innerHTML =
        `<option value="">-- Sin propietario asignado --</option>` +
        compradores
            .map(
                (u) =>
                    `<option value="${u.id_usuario}" ${
                        Number(seleccionado) === u.id_usuario ? 'selected' : ''
                    }>${escapeHtml(u.nombre)} (@${escapeHtml(u.username)} · ID ${u.id_usuario})</option>`
            )
            .join('');
}

function llenarSelectModelos(selectEl, seleccionado = null) {
    selectEl.innerHTML = cacheModelos
        .map(
            (m) =>
                `<option value="${m.id_modelo}" ${
                    Number(seleccionado) === m.id_modelo ? 'selected' : ''
                }>${escapeHtml(m.nombre)}</option>`
        )
        .join('');
}

// ==========================================
// MODALES DE ACCIÓN
// ==========================================
function abrirModalPropietario(idVehiculo) {
    const u = cacheUnidades.find((x) => x.id_vehiculo === idVehiculo);
    if (!u) return;
    document.getElementById('ownerUnidadId').value = u.id_vehiculo;
    document.getElementById('ownerUnidadLabel').textContent = `#${u.id_vehiculo} - ${u.nombre} (${u.numero_serie})`;
    llenarSelectUsuarios(document.getElementById('ownerSelectUsuario'), u.id_propietario);
    document.getElementById('ownerSelectEstado').value = u.estado_comercial;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCambiarDueno')).show();
}

function abrirModalEstado(idVehiculo) {
    const u = cacheUnidades.find((x) => x.id_vehiculo === idVehiculo);
    if (!u) return;
    document.getElementById('estadoUnidadId').value = u.id_vehiculo;
    document.getElementById('estadoUnidadLabel').textContent = `#${u.id_vehiculo} - ${u.nombre}`;
    document.getElementById('estadoSelectNuevo').value = u.estado_comercial;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCambiarEstado')).show();
}

async function abrirModalEditarTodo(idVehiculo) {
    const u = cacheUnidades.find((x) => x.id_vehiculo === idVehiculo);
    if (!u) return;

    document.getElementById('editUnidadTitle').textContent = `Editar Unidad #${u.id_vehiculo} — ${u.nombre}`;
    document.getElementById('editUnidadId').value = u.id_vehiculo;
    document.getElementById('editUnidadNombre').value = u.nombre || '';
    document.getElementById('editUnidadSerie').value = u.numero_serie || '';
    document.getElementById('editUnidadDesc').value = u.descripcion || '';
    document.getElementById('editUnidadMcu').value = u.microcontrolador || 'ESP8266';
    document.getElementById('editUnidadEstado').value = u.estado_comercial || 'DISPONIBLE';
    document.getElementById('editUnidadActivo').checked = Boolean(u.activo);

    llenarSelectModelos(document.getElementById('editUnidadModelo'), u.id_modelo);
    llenarSelectUsuarios(document.getElementById('editUnidadPropietario'), u.id_propietario);

    // Cargar pestaña Comandos del vehículo
    cargarComandosModalAdmin(u.id_vehiculo);
    // Cargar pestaña Demos y Movimientos del vehículo (funciona aunque esté VENDIDO)
    montarGestorDemos(document.getElementById('editUnidadDemosContainer'), u.id_vehiculo, recargarTodoAdmin);

    // Mostrar primera pestaña interna por defecto
    const firstTab = document.querySelector('#editUnitTabs button[data-bs-target="#tabEditGeneral"]');
    if (firstTab) bootstrap.Tab.getOrCreateInstance(firstTab).show();

    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalEditarUnidad')).show();
}

async function cargarComandosModalAdmin(idVehiculo) {
    const box = document.getElementById('editUnidadComandosContainer');
    box.innerHTML = `<div class="small text-secondary">Cargando comandos...</div>`;
    const res = await obtenerComandosVehiculo(idVehiculo);
    if (!res.ok) {
        box.innerHTML = `<div class="alert alert-danger py-2">${escapeHtml(res.error)}</div>`;
        return;
    }
    const cmds = res.data || [];
    box.innerHTML = `
        <div class="table-responsive">
            <table class="table table-sm table-iot align-middle">
                <thead><tr><th>Código</th><th>Nombre</th><th>Descripción</th><th>Activo</th><th></th></tr></thead>
                <tbody>
                    ${cmds
                        .map(
                            (c) => `
                        <tr>
                            <td><span class="badge bg-warning text-dark">${c.codigo}</span></td>
                            <td><input type="text" class="form-control form-control-sm js-cmd-name" value="${escapeHtml(c.nombre)}"></td>
                            <td><input type="text" class="form-control form-control-sm js-cmd-desc" value="${escapeHtml(c.descripcion || '')}"></td>
                            <td class="text-center"><input type="checkbox" class="form-check-input js-cmd-act" ${c.activo ? 'checked' : ''}></td>
                            <td><button type="button" class="btn btn-sm btn-success js-cmd-save" data-id="${c.id_comando}" data-code="${c.codigo}">💾</button></td>
                        </tr>`
                        )
                        .join('')}
                </tbody>
            </table>
        </div>`;

    box.querySelectorAll('.js-cmd-save').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const tr = btn.closest('tr');
            const r = await actualizarComandoAdmin(Number(btn.dataset.id), {
                nombre: tr.querySelector('.js-cmd-name').value.trim(),
                codigo: Number(btn.dataset.code),
                descripcion: tr.querySelector('.js-cmd-desc').value.trim(),
                activo: tr.querySelector('.js-cmd-act').checked,
            });
            if (!r.ok) return alert(r.error);
            btn.textContent = '✅';
            setTimeout(() => (btn.textContent = '💾'), 1200);
        });
    });
}

// ==========================================
// EVENTOS DE FORMULARIOS ADMIN
// ==========================================
function configurarEventosAdmin() {
    document.getElementById('btnRefreshInv')?.addEventListener('click', recargarTodoAdmin);
    document.getElementById('btnRefreshMod')?.addEventListener('click', cargarUsuariosYModelos);
    document.getElementById('btnRefreshAud')?.addEventListener('click', cargarAuditoria);

    // Abrir modal Nuevo Modelo
    document.getElementById('btnNuevoModelo')?.addEventListener('click', () => {
        document.getElementById('modeloModalTitle').textContent = 'Nuevo Modelo Comercial';
        document.getElementById('modeloIdInput').value = '';
        document.getElementById('formModelo').reset();
        document.getElementById('modeloMcuInput').value = 'ESP8266';
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalModelo')).show();
    });

    // Guardar Modelo (crear o editar)
    document.getElementById('formModelo')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('modeloIdInput').value;
        const payload = {
            nombre: document.getElementById('modeloNombreInput').value.trim(),
            descripcion: document.getElementById('modeloDescInput').value.trim(),
            especificaciones: document.getElementById('modeloSpecsInput').value.trim(),
            microcontrolador_base: document.getElementById('modeloMcuInput').value.trim() || 'ESP8266',
            activo: true,
        };
        const r = id ? await actualizarModeloAdmin(Number(id), payload) : await crearModeloAdmin(payload);
        if (!r.ok) return alert(r.error);
        bootstrap.Modal.getInstance(document.getElementById('modalModelo'))?.hide();
        await recargarTodoAdmin();
    });

    // Abrir modal Registrar Unidad
    document.getElementById('btnRegistrarUnidad')?.addEventListener('click', () => {
        document.getElementById('formNuevaUnidad').reset();
        llenarSelectModelos(document.getElementById('newUnidadModelo'));
        llenarSelectUsuarios(document.getElementById('newUnidadPropietario'));
        document.getElementById('newUnidadMcu').value = 'ESP8266';
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNuevaUnidad')).show();
    });

    // Guardar Nueva Unidad
    document.getElementById('formNuevaUnidad')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const propVal = document.getElementById('newUnidadPropietario').value;
        const payload = {
            nombre: document.getElementById('newUnidadNombre').value.trim(),
            id_modelo: Number(document.getElementById('newUnidadModelo').value),
            numero_serie: document.getElementById('newUnidadSerie').value.trim(),
            descripcion: document.getElementById('newUnidadDesc').value.trim(),
            microcontrolador: document.getElementById('newUnidadMcu').value.trim() || 'ESP8266',
            estado_comercial: document.getElementById('newUnidadEstado').value,
            id_propietario: propVal ? Number(propVal) : null,
            activo: true,
        };
        const r = await registrarUnidadAdmin(payload);
        if (!r.ok) return alert(r.error);
        bootstrap.Modal.getInstance(document.getElementById('modalNuevaUnidad'))?.hide();
        await recargarTodoAdmin();
    });

    // Guardar Cambio de Dueño
    document.getElementById('formCambiarDueno')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = Number(document.getElementById('ownerUnidadId').value);
        const propVal = document.getElementById('ownerSelectUsuario').value;
        const estado = document.getElementById('ownerSelectEstado').value;
        const r = await asignarPropietarioAdmin(id, {
            id_propietario: propVal ? Number(propVal) : null,
            estado_comercial: estado,
        });
        if (!r.ok) return alert(r.error);
        bootstrap.Modal.getInstance(document.getElementById('modalCambiarDueno'))?.hide();
        await recargarTodoAdmin();
    });

    // Guardar Cambio de Estado Comercial
    document.getElementById('formCambiarEstado')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = Number(document.getElementById('estadoUnidadId').value);
        const estado = document.getElementById('estadoSelectNuevo').value;
        const r = await cambiarEstadoUnidadAdmin(id, estado);
        if (!r.ok) return alert(r.error);
        bootstrap.Modal.getInstance(document.getElementById('modalCambiarEstado'))?.hide();
        await recargarTodoAdmin();
    });

    // Guardar Edición Completa de Unidad
    document.getElementById('formEditarUnidad')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = Number(document.getElementById('editUnidadId').value);
        const propVal = document.getElementById('editUnidadPropietario').value;
        const payload = {
            nombre: document.getElementById('editUnidadNombre').value.trim(),
            id_modelo: Number(document.getElementById('editUnidadModelo').value),
            numero_serie: document.getElementById('editUnidadSerie').value.trim(),
            descripcion: document.getElementById('editUnidadDesc').value.trim(),
            microcontrolador: document.getElementById('editUnidadMcu').value.trim() || 'ESP8266',
            estado_comercial: document.getElementById('editUnidadEstado').value,
            id_propietario: propVal ? Number(propVal) : null,
            activo: document.getElementById('editUnidadActivo').checked,
        };
        const r = await editarUnidadCompletaAdmin(id, payload);
        if (!r.ok) return alert(r.error);
        bootstrap.Modal.getInstance(document.getElementById('modalEditarUnidad'))?.hide();
        await recargarTodoAdmin();
    });
}