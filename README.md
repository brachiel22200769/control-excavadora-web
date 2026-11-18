🚜 Excavadora IoT - Sistema de Teleoperación Completo
Este repositorio contiene el ecosistema completo (Frontend y Backend) para el control en tiempo real de un vehículo IoT (Excavadora controlada mediante un microcontrolador ESP8266 y registros de desplazamiento 74HC595). El proyecto integra una interfaz web responsiva con una arquitectura de microservicios en la nube utilizando FastAPI, WebSockets y una base de datos relacional.

🌟 Ampliación 4.2 - Mejoras de Interfaz y Lógica en Tiempo Real
Esta versión integra mejoras significativas en la experiencia de usuario (UI/UX) y la eficiencia del servidor:

Efecto Liquid Glass: Paneles laterales de cristal translúcido para indicadores de estado e interfaces de catálogo.

Animación Fantasma (Ghosting): Los joysticks virtuales y botones del frontend reaccionan físicamente a los comandos recibidos vía WebSocket durante la ejecución de rutinas automáticas (Demos).

Filtro de Historial Inteligente: Lógica implementada en db_service.py y main.js para discriminar eventos inactivos (Comando 13 - Detenido), optimizando la capacidad de la tabla visual a 10 movimientos reales puros.

Refactorización de Assets: Aislamiento total de estilos, lógica y variables de entorno para un despliegue limpio y mantenible.

🏗️ Arquitectura del Proyecto y Mapa de Módulos
El sistema se divide en dos componentes principales estructurados bajo un modelo de separación de responsabilidades:

💻 Frontend: Control Web
Estructura organizada para despliegue estático o mediante GitHub Pages.

Plaintext
/control-excavadora-web
 ├── 📁 IMG/
 │    └── Fondo.jpg           # Recursos gráficos (Background optimizado)
 ├── 📁 assets/
 │    ├── style.css           # Estilos visuales, Liquid Glass y diseño responsivo
 │    ├── main.js             # Lógica Core: UI, WebSockets, Historial y UI Ghosting
 │    ├── api.js              # Cliente REST (Fetch/Async-Await)
 │    └── config.js           # Contratos de URLs para Ngrok y AWS
 ├── index.html               # Semántica y layout principal
 └── favicon.ico
⚙️ Backend: API REST & WebSocket
Estructura persistente en Python (FastAPI).

Plaintext
/websocket_iot/app
 ├── main.py                  # Endpoints REST, WebSockets y Middlewares
 └── 📁 services/
      └── db_service.py       # Capa de base de datos, filtros de historial y Stored Procedures
☁️ Contratos de Infraestructura (AWS & Redes)
El proyecto requiere una cadena de servicios activa para garantizar la telemetría bidireccional y la persistencia de datos:

Amazon EC2 (Windows Server 2025): Servidor host para la API ASGI de Python. Mantiene la lógica del negocio en operación 24/7.

Amazon RDS (MySQL): Motor de base de datos relacional para gestionar la tabla vehiculo_iot, incluyendo el historial de transacciones y los catálogos de rutinas (Demos).

Ngrok Tunnels: Proveedor de túneles inversos para exponer de forma pública y segura (HTTPS / WSS) los puertos del servidor EC2, evadiendo restricciones de NAT corporativas o de proveedores de internet.

🚀 Pasos de Ejecución
1. Inicialización de Backend (AWS EC2)
Iniciar la instancia de base de datos en AWS RDS.

Acceder al servidor EC2 y activar el entorno virtual (.venv).

Ejecutar el servidor ASGI:

Bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
Levantar el túnel seguro de Ngrok apuntando al puerto local:

Bash
ngrok http 8000
2. Configuración de Frontend
Copiar las URLs generadas por Ngrok (HTTPS y WSS).

Actualizar los contratos en el archivo assets/config.js:

JavaScript
export const CONFIG = {
    API_BASE: "https://<tu-url-ngrok>.ngrok-free.dev/api",
    WS_URL: "wss://<tu-url-ngrok>.ngrok-free.dev/ws",
    VEHICULO_ID: 1
};
Lanzar el index.html mediante un servidor local (Live Server en VS Code) o desplegar el repositorio en GitHub Pages.

✅ Criterios de Comprobación y Testing
Fase 1: Carga Inicial (Initial Load)
Health Check de LEDs: Al cargar la página, los indicadores superiores (WSS, API, RDS) deben pasar de color ámbar a verde intenso.

Sincronización de Último Estado: El panel de Liquid Glass derecho ("ÚLTIMO MOVIMIENTO") debe iluminarse con el comando registrado previamente en la base de datos (Ej. DETENIDO).

Catálogo Dinámico: El menú desplegable de "CATÁLOGO DE DEMOS" debe rellenarse automáticamente consultando los registros de RDS a través de la API.

Fase 2: Actualización en Tiempo Real (Real-Time Telemetry)
Filtrado de Historial: Al operar los joysticks libremente, la lista de "HISTORIAL DE OPERACIONES" debe actualizarse al instante mostrando la hora y comando exacto, manteniendo un máximo de 10 registros limpios (omitiendo por completo el comando 13 "DETENIDO").

Animación Fantasma (Ejecución de Demos): Al seleccionar y dar "EJECUTAR" a una demo, el usuario debe soltar el ratón y observar cómo:

Los joysticks virtuales se mueven físicamente en la pantalla.

Los botones centrales destellan en amarillo según la secuencia.

El panel de Liquid Glass refleja el cambio de comandos a alta velocidad.

El historial inyecta los nuevos registros con la etiqueta y color especial [DEMO].

Corte de Emergencia: Al presionar "DETENER TODO (13)" o "CANCELAR", la secuencia autónoma debe abortarse de inmediato, el historial dejará de registrar eventos de Demo, y el Liquid Glass marcará DETENIDO en color rojo.

Desarrollado por Erick Brachiel Silva Barriga - Instituto Tecnológico de Pachuca
