
# clientePredict
Proyecto de ejemplo que integra frontend y backend en un único servidor FastAPI.

## Estructura
- backend/main.py -> servidor FastAPI
- backend/services/datacenter.py -> lógica de ejemplo (Poisson)
- backend/static/* -> frontend (index.html, app.js, styles.css)

## Ejecutar (Windows PowerShell)
1. Crear entorno virtual:
   python -m venv venv
2. Activar:
   .\venv\Scripts\Activate.ps1
3. Instalar dependencias:
   pip install -r requirements.txt
4. Ejecutar:
   uvicorn backend.main:app --reload
5. Abrir en el navegador:
   http://127.0.0.1:8000