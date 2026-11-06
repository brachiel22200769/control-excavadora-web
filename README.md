# Control Excavadora Web (IoT)

Aplicación frontend responsiva (Mobile First) para el control en tiempo real de un vehículo IoT mediante REST y WebSocket. Desarrollado con HTML5, CSS3, Bootstrap 5 y Vanilla JavaScript (Módulos ES6).

## Estructura del Proyecto
- `index.html`: UI semántica responsiva.
- `style.css`: Estilos visuales, adaptaciones táctiles y joystick.
- `config.js`: Variables de entorno y conexión AWS.
- `api.js`: Cliente REST (Fetch/Async-Await).
- `main.js`: Lógica de UI, WebSocket y manejo de Demos.

## Requisitos y Ejecución Local
No requiere Node.js. Al usar módulos ES6, debe ejecutarse mediante un servidor local (ej. Live Server en VS Code).

## Integración con la API
Consume los 21 servicios alojados en AWS EC2 (FastAPI), comunicándose por HTTPS y WSS mediante un túnel seguro.
