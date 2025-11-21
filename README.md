# Proyecto: Visualizador de Bitácora

Pequeña app Flask que carga `data/itbitacora1.csv` y muestra gráficas con Plotly en el frontend.

Pasos rápidos:

1. Crear entorno virtual y activarlo:
```bash
python -m venv .venv
source .venv/bin/activate
```
2. Instalar dependencias:
```bash
pip install -r requirements.txt
```
3. Ejecutar la app:
```bash
python app.py
# Abrir http://127.0.0.1:5000
```

El endpoint `/data` devuelve JSON con `columns` y `rows`.
# proyectoresidencias