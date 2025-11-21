#!/usr/bin/env python3
"""
Script para corregir la codificación del archivo CSV.
Detecta automáticamente la codificación original y lo convierte a UTF-8.
"""
import pandas as pd
import chardet
import shutil
from datetime import datetime

CSV_PATH = 'data/itbitacora1.csv'
BACKUP_PATH = f'data/itbitacora1_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'

def detect_encoding(file_path):
    """Detecta la codificación del archivo."""
    with open(file_path, 'rb') as f:
        result = chardet.detect(f.read())
    return result['encoding']

def fix_csv_encoding():
    """Convierte el CSV a UTF-8."""
    print(f"📂 Analizando archivo: {CSV_PATH}")
    
    # Detectar codificación actual
    original_encoding = detect_encoding(CSV_PATH)
    print(f"🔍 Codificación detectada: {original_encoding}")
    
    # Crear backup
    print(f"💾 Creando backup en: {BACKUP_PATH}")
    shutil.copy2(CSV_PATH, BACKUP_PATH)
    
    # Leer con la codificación detectada
    print(f"📖 Leyendo archivo con codificación {original_encoding}...")
    try:
        df = pd.read_csv(CSV_PATH, encoding=original_encoding, dtype=str, keep_default_na=False)
    except Exception as e:
        print(f"⚠️  Error con {original_encoding}, intentando con latin-1...")
        df = pd.read_csv(CSV_PATH, encoding='latin-1', dtype=str, keep_default_na=False)
    
    print(f"✅ Leídas {len(df)} filas y {len(df.columns)} columnas")
    
    # Mostrar algunas celdas para verificación
    print("\n📋 Muestra de datos (primeras 3 filas):")
    for col in df.columns[:5]:  # Mostrar primeras 5 columnas
        print(f"\n  {col}:")
        for i, val in enumerate(df[col].head(3)):
            if val and len(str(val)) > 0:
                print(f"    [{i}] {val[:50]}...")
    
    # Guardar en UTF-8
    print(f"\n💾 Guardando archivo en UTF-8...")
    df.to_csv(CSV_PATH, index=False, encoding='utf-8')
    
    print(f"\n✨ ¡Listo! El archivo ha sido convertido a UTF-8")
    print(f"   Backup guardado en: {BACKUP_PATH}")
    
    # Verificar resultado
    print(f"\n🔍 Verificando conversión...")
    df_test = pd.read_csv(CSV_PATH, encoding='utf-8', dtype=str, keep_default_na=False)
    print(f"✅ Verificación exitosa: {len(df_test)} filas")

if __name__ == '__main__':
    try:
        fix_csv_encoding()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print(f"   El backup está en: {BACKUP_PATH}")
