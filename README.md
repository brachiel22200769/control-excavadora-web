# 🚜 Excavadora IoT - Interfaz Web de Teleoperación y Administración

Frontend web responsivo para el control en tiempo real, gestión de secuencias autónomas (**Demos**) y administración comercial de vehículos IoT basados en **ESP8266 + 74HC595**.

🌐 **Despliegue en producción (GitHub Pages):**
`https://brachiel22200769.github.io/control-excavadora-web/`

---

## ✨ Funcionalidades Principales

* **Autenticación JWT y Control por Roles:**
  * **Inicio de sesión y registro** para usuarios propietarios (`USUARIO`).
  * **Modo Invitado** con reserva exclusiva de 5 minutos, cronómetro en vivo y acceso directo a la unidad en exhibición con su **Demo de Fábrica**.
  * **Panel de Administración (`ADMIN`)** con métricas en tiempo real, gestión de inventario de unidades, catálogo de modelos comerciales, asignación de propietarios y bitácora de auditoría.
* **Control de Teleoperación en Tiempo Real:**
  * Joysticks virtuales para **Orugas** (`Fwd`, `Rev`, `Izq`, `Der`) y **Cabina / Brazo** (`Sube`, `Baja`, `C.Izq`, `C.Der`) con botón de paro de emergencia **`DETENER TODO (13)`**.
  * Botones centrales **LUCES**, **SONIDO** y **AUX** con estado visual tipo *toggle* fijo en amarillo hasta volver a presionarlos.
  * **Animación Fantasma (Ghosting):** Los controles reaccionan visualmente a los eventos recibidos por WebSocket durante la ejecución de rutinas automáticas.
* **Editor de Secuencias ("Mis Demos"):** Creación, edición y eliminación de demos personalizadas paso a paso (comando, orden, duración y pausa en milisegundos).
* **Historial en Vivo con Hora Local:** Muestra los últimos 10 movimientos persistidos en Amazon RDS, convirtiendo automáticamente las marcas de tiempo UTC del servidor a la zona horaria **`America/Mexico_City`**.
* **UX Adaptativa:** Interfaz con efecto *Liquid Glass*, scroll habilitado en todas las vistas (Login, Admin, Historial y Mis Demos) y vista fija sin scroll en la pantalla de Control para una operación cómoda.
* **Indicadores de Salud (LEDs):** Monitoreo independiente de **API**, **RDS** y **WSS** (más el badge de estado de conexión del **ESP8266** físico).

---

## 🗂️ Estructura del Proyecto

```text
control_excavadora_web/
├── IMG/
│   └── Fondo.jpg            # Imagen de fondo principal
├── assets/
│   ├── config.js            # Configuración centralizada de host API (HTTPS) y WebSocket (WSS)
│   ├── api.js               # Cliente HTTP REST con inyección automática de token JWT
│   ├── main.js              # Controlador principal: Auth, roles, WebSocket, teleoperación y hora MX
│   ├── demoEditor.js        # CRUD completo de Demos y pasos de secuencia
│   ├── admin.js             # Lógica del Panel de Administración (Inventario, Modelos y Bitácora)
│   ├── style.css            # Estilos base del control y componentes Liquid Glass
│   └── admin-theme.css      # Tema oscuro, layout proporcional del control, toggles y scroll adaptativo
├── index.html               # Aplicación SPA multi-vista (Login, Operador/Invitado y Admin)
├── .nojekyll                # Desactiva procesamiento Jekyll en GitHub Pages
├── favicon.ico
└── README.md
```

---

## ⚙️ Configuración y Despliegue

1. **Apuntar al backend activo** editando `assets/config.js`:
   ```javascript
   const NGROK_HOST = "mutual-spearhead-factoid.ngrok-free.dev";

   export const CONFIG = {
       API_BASE: `https://${NGROK_HOST}/api`,
       WS_BASE: `wss://${NGROK_HOST}`,
   };
   ```
2. **Pruebas locales:** Abrir `index.html` con **Live Server** en VS Code.
3. **Publicación en GitHub Pages:**
   ```powershell
   git add .
   git commit -m "Actualización de interfaz de control IoT"
   git push origin main
   ```

---

## ✅ Flujo de Comprobación y Testing

1. **Carga inicial (Login):**
   * Los indicadores **API** y **RDS** deben encender en verde mediante `GET /api/health` y el catálogo público de modelos debe cargarse desde RDS.
2. **Panel de Administración (`ADMIN`):**
   * Al iniciar sesión como administrador, se muestran las pestañas **Inventario**, **Modelos Comerciales** y **Bitácora de Auditoría** con fechas en hora local de México. *(El LED `WSS` permanece en amarillo/espera porque el administrador opera solo por API REST).*
3. **Teleoperación (`USUARIO`):**
   * Al iniciar sesión como propietario, el LED **WSS** cambia a verde al abrir `/ws/vehiculos/{id}?token=<JWT>`.
   * Al conectar el ESP8266 físico al endpoint `/ws/device/{id}?key=...`, el indicador superior cambia a **`ESP8266: Conectado`**.
   * Cada comando manual se registra en **Historial en Vivo** con la hora local y en **Mis Demos** se pueden gestionar rutinas personalizadas.
4. **Modo Invitado (`INVITADO`):**
   * Reserva la unidad en `EXHIBICION` por 5 minutos, muestra el cronómetro regresivo y permite operar manualmente o ejecutar la **`Demo de Fábrica`**.
   * Al presionar **DETENER TODO (13)** o **CANCELAR**, la rutina se interrumpe de inmediato enviando `status: 13`.

---

Desarrollado por **Erick Brachiel Silva Barriga** — Ingeniería en Sistemas Computacionales, Instituto Tecnológico de Pachuca (2026).
