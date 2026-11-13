🚜 Excavadora IoT - Sistema de Teleoperación Completo
Este repositorio contiene el ecosistema completo (Frontend y Backend) para el control en tiempo real de un vehículo IoT (Excavadora controlada mediante un microcontrolador ESP8266 y registros de desplazamiento 74HC595). El proyecto integra una interfaz web responsiva con una arquitectura de microservicios en la nube utilizando FastAPI, WebSockets y una base de datos relacional.

🏗️ Arquitectura del Proyecto
El sistema se divide en dos componentes principales que se comunican de forma segura mediante túneles:

💻 Frontend: Control de Excavadora Web
Aplicación responsiva (Mobile First) diseñada para controlar el vehículo en tiempo real mediante el consumo de servicios REST y conexión constante por WebSocket.

Tecnologías: HTML5, CSS3, Bootstrap 5 y Vanilla JavaScript (Módulos ES6).

Estructura del Código:

index.html: Interfaz de usuario semántica y adaptable.

style.css: Estilos visuales, adaptaciones táctiles y diseño de los joysticks.

config.js: Variables de entorno y rutas de conexión hacia AWS.

api.js: Cliente REST para peticiones asíncronas (Fetch/Async-Await).

main.js: Lógica principal de UI, gestión de conexión WebSocket y catálogos de Demos.

⚙️ Backend: API REST & WebSocket
Motor lógico y de persistencia desarrollado para gestionar el control manual, el historial de operaciones y la ejecución de rutinas automáticas secuenciales.

Tecnologías: Python, FastAPI, WebSockets y MySQL.

Infraestructura y Despliegue: La API se ejecuta de manera persistente en Amazon EC2 (Windows Server 2025) y almacena sus datos de forma segura en Amazon RDS. Los puertos locales están expuestos mediante túneles seguros de Ngrok para cumplir con los requerimientos públicos de HTTPS y WSS.

📚 Documentación de la API (HTTP REST)
El backend integra 21 Stored Procedures administrados a través de endpoints convencionales (GET, POST, PUT, DELETE), organizados por categorías funcionales.

La documentación completa e interactiva, lista para ejecutar pruebas directas, está expuesta de forma pública a través de:
👉 Swagger UI - API IoT (Accesible en la ruta /docs del servidor desplegado).

🔌 Documentación de WebSocket (WSS)
El canal de monitoreo bidireccional y telemetría en tiempo real opera a través de un WebSocket seguro. Debido a que Swagger UI no documenta conexiones WSS de forma nativa, la especificación de eventos se detalla a continuación:

URL de Conexión: wss://mutual-spearhead-factoid.ngrok-free.dev/ws

Comportamiento Inicial: Inmediatamente al establecer la conexión, el servidor consulta RDS y devuelve el último estado del vehículo para sincronizar la interfaz.

📦 Estructura de Mensajes JSON (Eventos)
1. Evento de Estado (Movimiento Individual Manual)
Se emite automáticamente a todos los clientes conectados tras recibir un POST válido en /api/vehiculos/{id}/movimiento. Este evento sí se registra en el historial de la base de datos.

JSON
{
  "vehiculo": 1,
  "status": 2,
  "comando_nombre": "AVANZANDO"
}
2. Eventos de Ejecución Autónoma (DEMO)
Se emiten en cascada al iniciar una rutina programada mediante un POST a /api/vehiculos/{id}/demo/{id_demo}/iniciar. Estos comandos modifican el estado visual y los actuadores físicos, pero NO ensucian la tabla del historial en la base de datos.

Inicio de secuencia DEMO:

JSON
{ "type": "DEMO_INICIO", "vehiculo": 1 }
Ejecución de un paso activo:

JSON
{ "status": 10, "duracion": 1500 }
Pausa programada entre movimientos:

JSON
{ "status": 13, "pausa": 300 }
Finalización exitosa de la rutina:

JSON
{ "status": 13, "type": "DEMO_FIN" }
3. Interrupción / Cancelación de Emergencia
Si se lanza una petición POST al endpoint de cancelación durante la ejecución de una DEMO, el ciclo asíncrono se rompe inmediatamente y el servidor transmite un estado de seguridad.

JSON
{ "status": 13 } // 13 = Vehículo Detenido
🚀 Requisitos y Ejecución Local
Backend: Requiere activar el entorno virtual (.venv) e instalar las dependencias de Python. Se inicializa el servidor ASGI localmente utilizando uvicorn app.main:app --host 0.0.0.0 --port 8000.

Frontend: Al utilizar módulos de ES6, la aplicación no requiere Node.js de fondo, pero debe ejecutarse a través de un servidor local (por ejemplo, la extensión Live Server en VS Code) para resolver correctamente las importaciones de JavaScript sin ser bloqueado por el navegador.

Desarrollado por Erick Brachiel Silva Barriga - Instituto Tecnológico de Pachuca
