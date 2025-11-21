# Deployment Instructions for Azure App Service

## Archivos ya creados ✅

Los siguientes archivos se han creado para permitir el despliegue en Azure:

1. **requirements.txt** - Actualizado con gunicorn
2. **startup.sh** - Script de inicio para Azure
3. **runtime.txt** - Especifica Python 3.12
4. **Procfile** - Configuración para el servidor web
5. **.deployment** - Configuración de build de Azure

## Pasos para desplegar en Azure App Service

### 1. Configurar Azure App Service (Portal Azure)

1. Ve a tu recurso "itbitacora" en el portal de Azure
2. En **Configuration** → **General settings**:
   - **Stack**: Python
   - **Python version**: 3.12
   - **Startup Command**: `bash startup.sh`

3. En **Configuration** → **Application settings**, agrega:
   - `SCM_DO_BUILD_DURING_DEPLOYMENT` = `true`
   - `WEBSITES_PORT` = `8000`

### 2. Opción A: Desplegar con GitHub Actions (Recomendado)

El archivo `.github/workflows/main_itbitacora.yml` ya está configurado.

**Pasos:**
1. Haz commit de todos los archivos:
   ```bash
   git add .
   git commit -m "Preparar para despliegue en Azure"
   git push origin main
   ```

2. El workflow se ejecutará automáticamente y desplegará la app

3. Verifica en GitHub Actions que el workflow se ejecute correctamente

### 3. Opción B: Desplegar con Azure CLI

Si prefieres desplegar manualmente:

```bash
# Instalar Azure CLI si no lo tienes
# https://docs.microsoft.com/en-us/cli/azure/install-azure-cli

# Login en Azure
az login

# Desplegar desde el repositorio local
az webapp up --name itbitacora --resource-group <tu-resource-group> --runtime "PYTHON:3.12"
```

### 4. Opción C: Desplegar con VS Code

1. Instala la extensión "Azure App Service" en VS Code
2. Click derecho en la carpeta del proyecto
3. Selecciona "Deploy to Web App..."
4. Elige tu app "itbitacora"

## Verificación después del despliegue

1. **Accede a tu app**: `https://itbitacora.azurewebsites.net`

2. **Verifica los logs** en el portal de Azure:
   - App Service → Log stream
   - O usa: `az webapp log tail --name itbitacora --resource-group <resource-group>`

3. **Si hay problemas**:
   - Verifica que el archivo CSV esté en `data/itbitacora1.csv`
   - Revisa los logs de Application Insights
   - Verifica las configuraciones en el portal

## Estructura de archivos a subir

```
proyectoresidencias/
├── .deployment
├── .github/
│   └── workflows/
│       └── main_itbitacora.yml
├── app.py
├── Procfile
├── runtime.txt
├── startup.sh
├── requirements.txt
├── data/
│   └── itbitacora1.csv
├── static/
│   ├── css/
│   └── js/
│       └── main.js
└── templates/
    └── index.html
```

## Notas importantes

- ⚠️ El archivo CSV (`data/itbitacora1.csv`) debe estar en el repositorio
- ⚠️ Azure App Service puede tardar 5-10 minutos en el primer despliegue
- ⚠️ Si usas GitHub Actions, los secretos ya están configurados en el workflow
- ✅ Gunicorn manejará múltiples conexiones simultáneas
- ✅ El timeout está configurado en 600 segundos para reportes largos

## Troubleshooting

### Error: "Application Error"
- Revisa los logs: `az webapp log tail --name itbitacora --resource-group <rg>`
- Verifica que startup.sh tenga permisos de ejecución

### Error: "Module not found"
- Asegúrate de que `requirements.txt` esté completo
- Verifica que `SCM_DO_BUILD_DURING_DEPLOYMENT=true`

### Error: CSV no encontrado
- Confirma que `data/itbitacora1.csv` esté en el repo
- Verifica la ruta en `app.py` (línea 15)

## Comandos útiles

```bash
# Ver logs en tiempo real
az webapp log tail --name itbitacora --resource-group <resource-group>

# Reiniciar la app
az webapp restart --name itbitacora --resource-group <resource-group>

# Ver configuración
az webapp config show --name itbitacora --resource-group <resource-group>
```
