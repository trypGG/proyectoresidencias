
from flask import Flask, render_template, jsonify, request, make_response
from io import BytesIO
from datetime import datetime
import pandas as pd
import numpy as np
import os
import matplotlib
matplotlib.use('Agg')
from matplotlib.figure import Figure
from matplotlib.backends.backend_pdf import PdfPages

app = Flask(__name__)

DATA_PATH = os.path.join('data', 'itbitacora1.csv')

@app.route('/top3_by_event')
def top3_by_event():
    # Parámetros: weeks=1,2,3  (opcional), n=3 (top n)
    weeks_param = request.args.get('weeks', default=None, type=str)
    n = request.args.get('n', default=3, type=int)
    df = _load_dataframe()
    if 'WEEK#' in df.columns and weeks_param:
        try:
            sel = [int(w) for w in weeks_param.split(',') if w.strip()]
            df = df[df['WEEK#'].isin(sel)]
        except ValueError:
            pass
    # Puede llamarse 'EVENT/PROBLEM DESCRIPCION' o similar, buscar columna
    col_candidates = [c for c in df.columns if 'EVENT' in c or 'PROBLEM' in c or 'DESCRIPCION' in c or 'DESCRIPCIÓN' in c]
    col = col_candidates[0] if col_candidates else None
    if not col or 'T. MUERTO' not in df.columns:
        return jsonify({'events': [], 'values': []})
    grouped = df.groupby(col)['T. MUERTO'].sum()
    grouped = grouped.dropna()
    grouped = grouped.sort_values(ascending=False).head(n)
    events = grouped.index.astype(str).tolist()
    values = [float(x) for x in grouped.values]
    return jsonify({'events': events, 'values': values})

@app.route('/top3_by_class')
def top3_by_class():
    # Parámetros: weeks=1,2,3  (opcional), n=3 (top n), agg=sum
    weeks_param = request.args.get('weeks', default=None, type=str)
    n = request.args.get('n', default=3, type=int)
    df = _load_dataframe()
    if 'WEEK#' in df.columns and weeks_param:
        try:
            sel = [int(w) for w in weeks_param.split(',') if w.strip()]
            df = df[df['WEEK#'].isin(sel)]
        except ValueError:
            pass
    if 'CLASS' not in df.columns or 'T. MUERTO' not in df.columns:
        return jsonify({'classes': [], 'values': []})
    grouped = df.groupby('CLASS')['T. MUERTO'].sum()
    grouped = grouped.dropna()
    grouped = grouped.sort_values(ascending=False).head(n)
    classes = grouped.index.astype(str).tolist()
    values = [float(x) for x in grouped.values]
    return jsonify({'classes': classes, 'values': values})

def _load_dataframe(path=DATA_PATH, nrows=None):
    # Helper: devuelve DataFrame limpio
    # Intentar con UTF-8, si falla usar Latin-1
    try:
        df = pd.read_csv(path, dtype=str, keep_default_na=False, nrows=nrows, encoding='utf-8')
    except UnicodeDecodeError:
        df = pd.read_csv(path, dtype=str, keep_default_na=False, nrows=nrows, encoding='latin-1')
    # Eliminar columnas Unnamed creadas por comas extras
    df.columns = df.columns.str.strip()
    df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
    df = df.applymap(lambda x: x.strip() if isinstance(x, str) else x)

    if 'FECHA' in df.columns:
        df['FECHA'] = pd.to_datetime(df['FECHA'], errors='coerce', dayfirst=False)

    # Limpiar WEEK# (extraer números de formatos como "W30" o "30")
    if 'WEEK#' in df.columns:
        df['WEEK#'] = df['WEEK#'].astype(str).str.replace(r'[^0-9]', '', regex=True)
        df['WEEK#'] = pd.to_numeric(df['WEEK#'], errors='coerce')

    numeric_candidates = ['T. ESPERA', 'T. SOLUCION', 'T. MUERTO', 'T. MUERTO TI']
    for col in numeric_candidates:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # Eliminar columnas completamente vacías
    non_empty = [c for c in df.columns if df[c].notna().any() and (df[c].astype(str).str.strip() != '').any()]
    df = df[non_empty]
    return df


def load_data(path=DATA_PATH, nrows=None):
    df = _load_dataframe(path=path, nrows=nrows)

    def clean_row(row):
        out = {}
        for k, v in row.items():
            if isinstance(v, pd.Timestamp):
                out[k] = v.strftime('%Y-%m-%d')
            elif pd.isna(v):
                out[k] = None
            else:
                out[k] = v
        return out

    rows = []
    for idx, row in df.iterrows():
        clean = clean_row(row.to_dict())
        clean['_csvIndex'] = int(idx)  # Agregar índice original del CSV
        rows.append(clean)
    
    return {'columns': df.columns.tolist(), 'rows': rows}


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/data')
def data():
    # optional: ?n=100 to limit rows
    n = request.args.get('n', default=None, type=int)
    result = load_data(nrows=n)
    return jsonify(result)


@app.route('/debug')
def debug():
    # Devuelve columnas y primeras 5 filas para depuración
    result = load_data(nrows=5)
    print('DEBUG /debug:', result['columns'])
    for i, row in enumerate(result['rows']):
        print(f'Fila {i+1}:', row)
    return jsonify(result)


@app.route('/meta')
def meta():
    # Devuelve valores únicos útiles (WEEK#, AREA, MONTHS)
    df = _load_dataframe()
    weeks = []
    if 'WEEK#' in df.columns:
        weeks = sorted([int(x) for x in df['WEEK#'].dropna().unique().astype(int)])
    areas = sorted([a for a in df['AREA'].dropna().unique().astype(str)]) if 'AREA' in df.columns else []
    classes = sorted([c for c in df['CLASS'].dropna().unique().astype(str)]) if 'CLASS' in df.columns else []
    
    # Extraer meses y años únicos de FECHA
    months = []
    years = []
    if 'FECHA' in df.columns:
        df_with_dates = df[df['FECHA'].notna()].copy()
        if len(df_with_dates) > 0:
            df_with_dates['MONTH'] = df_with_dates['FECHA'].dt.to_period('M').astype(str)
            months = sorted(df_with_dates['MONTH'].unique().tolist())
            years = sorted(df_with_dates['FECHA'].dt.year.dropna().unique().astype(int).tolist())

    return jsonify({'weeks': weeks, 'areas': areas, 'months': months, 'years': years, 'classes': classes})


@app.route('/downtime_per_week')
def downtime_per_week():
    # Parámetros: weeks=1,2,3 (opcional)
    weeks_param = request.args.get('weeks', default=None, type=str)
    df = _load_dataframe()
    
    if 'WEEK#' not in df.columns or 'T. MUERTO' not in df.columns:
        return jsonify({'weeks': [], 'values': []})
    
    # Agrupar por semana
    grouped = df.groupby('WEEK#')['T. MUERTO'].sum()
    grouped = grouped.dropna()
    grouped = grouped.sort_index()
    
    # Filtrar semanas seleccionadas
    if weeks_param:
        try:
            sel = [int(w) for w in weeks_param.split(',') if w.strip()]
            grouped = grouped[grouped.index.isin(sel)]
        except ValueError:
            pass
    
    weeks = [int(x) for x in grouped.index]
    values = [float(x) for x in grouped.values]
    return jsonify({'weeks': weeks, 'values': values})


@app.route('/frequency_per_month')
def frequency_per_month():
    # Parámetros: months=2024-07,2024-08 (opcional)
    months_param = request.args.get('months', default=None, type=str)
    df = _load_dataframe()
    
    if 'FECHA' not in df.columns:
        return jsonify({'months': [], 'values': []})
    
    df_with_dates = df[df['FECHA'].notna()].copy()
    if len(df_with_dates) == 0:
        return jsonify({'months': [], 'values': []})
    
    # Crear columna de mes
    df_with_dates['MONTH'] = df_with_dates['FECHA'].dt.to_period('M').astype(str)
    
    # Contar número de registros por mes
    grouped = df_with_dates.groupby('MONTH').size()
    grouped = grouped.sort_index()
    
    # Filtrar meses seleccionados
    if months_param:
        sel = [m.strip() for m in months_param.split(',') if m.strip()]
        grouped = grouped[grouped.index.isin(sel)]
    
    months = grouped.index.tolist()
    values = [int(x) for x in grouped.values]
    return jsonify({'months': months, 'values': values})


@app.route('/downtime_per_month')
def downtime_per_month():
    # Parámetros: months=2024-07,2024-08 (opcional)
    months_param = request.args.get('months', default=None, type=str)
    df = _load_dataframe()
    
    if 'FECHA' not in df.columns or 'T. MUERTO TI' not in df.columns:
        return jsonify({'months': [], 'values': []})
    
    df_with_dates = df[df['FECHA'].notna()].copy()
    if len(df_with_dates) == 0:
        return jsonify({'months': [], 'values': []})
    
    # Crear columna de mes
    df_with_dates['MONTH'] = df_with_dates['FECHA'].dt.to_period('M').astype(str)
    
    # Sumar tiempo muerto TI por mes
    grouped = df_with_dates.groupby('MONTH')['T. MUERTO TI'].sum()
    grouped = grouped.dropna()
    grouped = grouped.sort_index()
    
    # Filtrar meses seleccionados
    if months_param:
        sel = [m.strip() for m in months_param.split(',') if m.strip()]
        grouped = grouped[grouped.index.isin(sel)]
    
    months = grouped.index.tolist()
    values = [float(x) for x in grouped.values]
    return jsonify({'months': months, 'values': values})


@app.route('/top3_by_area')
def top3_by_area():
    # Parámetros: weeks=1,2,3  (opcional), n=3 (top n), agg=sum|max
    weeks_param = request.args.get('weeks', default=None, type=str)
    n = request.args.get('n', default=3, type=int)
    agg = request.args.get('agg', default='sum', type=str)

    df = _load_dataframe()
    if 'WEEK#' in df.columns and weeks_param:
        try:
            sel = [int(w) for w in weeks_param.split(',') if w.strip()]
            df = df[df['WEEK#'].isin(sel)]
        except ValueError:
            pass

    if 'AREA' not in df.columns or 'T. MUERTO' not in df.columns:
        return jsonify({'areas': [], 'values': []})

    if agg == 'max':
        grouped = df.groupby('AREA')['T. MUERTO'].max()
    else:
        grouped = df.groupby('AREA')['T. MUERTO'].sum()

    grouped = grouped.dropna()
    grouped = grouped.sort_values(ascending=False).head(n)
    areas = grouped.index.astype(str).tolist()
    values = [float(x) for x in grouped.values]
    return jsonify({'areas': areas, 'values': values})


@app.route('/entries', methods=['POST'])
def add_entry():
    payload = request.get_json(silent=True) or {}

    required_fields = {
        'fecha': 'Fecha',
        'class': 'Clase',
        'area': 'Área',
        't_espera': 'Tiempo de espera',
        't_solucion': 'Tiempo de solución',
        'descripcion': 'Descripción del evento'
    }

    missing = [label for key, label in required_fields.items() if not str(payload.get(key, '')).strip()]
    if missing:
        return jsonify({'error': f"Faltan campos obligatorios: {', '.join(missing)}"}), 400

    fecha_raw = str(payload.get('fecha')).strip()
    fecha_obj = None
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y'):
        try:
            fecha_obj = datetime.strptime(fecha_raw, fmt)
            break
        except ValueError:
            continue
    if not fecha_obj:
        return jsonify({'error': 'Formato de fecha inválido. Usa AAAA-MM-DD.'}), 400

    espera_raw = str(payload.get('t_espera', '')).replace(',', '.').strip()
    solucion_raw = str(payload.get('t_solucion', '')).replace(',', '.').strip()

    try:
        t_espera = float(espera_raw)
    except ValueError:
        return jsonify({'error': 'Tiempo de espera debe ser numérico.'}), 400

    try:
        t_solucion = float(solucion_raw)
    except ValueError:
        return jsonify({'error': 'Tiempo de solución debe ser numérico.'}), 400

    if t_espera < 0 or t_solucion < 0:
        return jsonify({'error': 'Los tiempos de espera y solución deben ser positivos.'}), 400

    t_muerto = t_espera + t_solucion

    t_muerto_ti = payload.get('t_muerto_ti')
    if t_muerto_ti not in (None, '', []):
        try:
            t_muerto_ti = float(str(t_muerto_ti).replace(',', '.'))
        except (TypeError, ValueError):
            return jsonify({'error': 'Tiempo muerto TI debe ser numérico.'}), 400
    else:
        t_muerto_ti = ''

    if not os.path.exists(DATA_PATH):
        return jsonify({'error': 'No se encontró el archivo de datos.'}), 500

    try:
        df_raw = pd.read_csv(DATA_PATH, dtype=str, keep_default_na=False, encoding='utf-8')
    except UnicodeDecodeError:
        df_raw = pd.read_csv(DATA_PATH, dtype=str, keep_default_na=False, encoding='latin-1')
    df_raw.columns = df_raw.columns.str.strip()
    df_raw = df_raw.loc[:, ~df_raw.columns.str.contains('^Unnamed')]

    if df_raw.empty:
        columns = ['FECHA', 'SHIFT', 'PROBLEM DESCRIPTION/SOLUTION', 'NOMBRE OPERADOR / USUARIOS', 'CLASS', 'AREA', 'WEEK#',
                   'T. ESPERA', 'T. SOLUCION', 'T. MUERTO', 'T. MUERTO TI', 'ORIGINADOR']
        df_raw = pd.DataFrame(columns=columns)

    new_row = {col: '' for col in df_raw.columns}
    iso_week = fecha_obj.isocalendar()[1]
    new_row['FECHA'] = fecha_obj.strftime('%m/%d/%Y')
    if 'SHIFT' in new_row:
        new_row['SHIFT'] = str(payload.get('shift', '')).strip()
    desc_col = 'PROBLEM DESCRIPTION/SOLUTION'
    if desc_col in new_row:
        new_row[desc_col] = str(payload.get('descripcion', '')).strip()
    oper_col = 'NOMBRE OPERADOR / USUARIOS'
    if oper_col in new_row:
        new_row[oper_col] = str(payload.get('operador', '')).strip()
    new_row['CLASS'] = str(payload.get('class', '')).strip()
    new_row['AREA'] = str(payload.get('area', '')).strip()
    new_row['WEEK#'] = str(iso_week)
    def _format_decimal(value):
        if value is None or value == '':
            return ''
        value = float(value)
        if value.is_integer():
            return str(int(value))
        return f'{value:.2f}'.rstrip('0').rstrip('.')

    if 'T. ESPERA' in new_row:
        new_row['T. ESPERA'] = _format_decimal(t_espera)
    if 'T. SOLUCION' in new_row:
        new_row['T. SOLUCION'] = _format_decimal(t_solucion)
    new_row['T. MUERTO'] = _format_decimal(t_muerto)
    if 'T. MUERTO TI' in new_row:
        new_row['T. MUERTO TI'] = '' if t_muerto_ti == '' else _format_decimal(t_muerto_ti)
    if 'ORIGINADOR' in new_row:
        new_row['ORIGINADOR'] = str(payload.get('originador', '')).strip()

    df_raw = pd.concat([df_raw, pd.DataFrame([new_row])], ignore_index=True)
    df_raw.to_csv(DATA_PATH, index=False, encoding='utf-8')

    return jsonify({'status': 'ok'}), 201


@app.route('/entries', methods=['DELETE'])
def delete_entries():
    """Elimina uno o más registros de la bitácora basándose en sus índices"""
    payload = request.get_json(silent=True) or {}
    indices = payload.get('indices', [])
    
    if not indices or not isinstance(indices, list):
        return jsonify({'error': 'Debe proporcionar una lista de índices a eliminar'}), 400
    
    if not os.path.exists(DATA_PATH):
        return jsonify({'error': 'No se encontró el archivo de datos'}), 500
    
    try:
        # Cargar el DataFrame
        try:
            df = pd.read_csv(DATA_PATH, dtype=str, keep_default_na=False, encoding='utf-8')
        except UnicodeDecodeError:
            df = pd.read_csv(DATA_PATH, dtype=str, keep_default_na=False, encoding='latin-1')
        
        df.columns = df.columns.str.strip()
        df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
        
        # Validar que los índices existan
        invalid_indices = [i for i in indices if i < 0 or i >= len(df)]
        if invalid_indices:
            return jsonify({'error': f'Índices inválidos: {invalid_indices}'}), 400
        
        # Eliminar las filas
        df = df.drop(indices).reset_index(drop=True)
        
        # Guardar el archivo actualizado
        df.to_csv(DATA_PATH, index=False, encoding='utf-8')
        
        return jsonify({
            'status': 'ok',
            'message': f'{len(indices)} registro(s) eliminado(s) exitosamente',
            'deleted_count': len(indices)
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Error al eliminar registros: {str(e)}'}), 500


def _create_bar_figure(labels, values, title, ylabel='', color='#1f77b4', rotation=0):
    fig = Figure(figsize=(8.27, 4.5))  # tamaño A4 horizontal
    ax = fig.subplots()
    positions = range(len(labels))
    ax.bar(positions, values, color=color)
    ax.set_title(title)
    if ylabel:
        ax.set_ylabel(ylabel)
    ax.set_xticks(list(positions))
    ax.set_xticklabels(labels, rotation=rotation, ha='right' if rotation else 'center')
    ax.grid(axis='y', linestyle='--', alpha=0.3)
    for idx, val in enumerate(values):
        if pd.notna(val):
            ax.text(idx, val, f'{val:.0f}', ha='center', va='bottom', fontsize=9)
    fig.tight_layout()
    return fig


def _create_text_page(title, lines):
    fig = Figure(figsize=(8.27, 11.69))  # tamaño A4 vertical
    ax = fig.subplots()
    ax.axis('off')
    ax.text(0.05, 0.95, title, fontsize=16, fontweight='bold', va='top')
    y = 0.85
    for line in lines:
        ax.text(0.05, y, line, fontsize=12, va='top')
        y -= 0.05
    return fig


def _format_minutes(value):
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return '0 min'
    try:
        value = float(value)
    except (TypeError, ValueError):
        return str(value)
    if abs(value - round(value)) < 1e-6:
        return f'{int(round(value))} min'
    return f'{value:.1f} min'


def _wrap_label(text, width=28):
    if not text:
        return ''
    words = str(text).split()
    lines = []
    current = ''
    for word in words:
        candidate = f"{current} {word}".strip()
        if len(candidate) <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return '\n'.join(lines)


def _autoscale_table(table, col_widths=None, base_height=0.30, line_height=0.12):
    cells = table.get_celld()
    row_indices = sorted({rc[0] for rc in cells if isinstance(rc[0], int)})
    col_indices = sorted({rc[1] for rc in cells if isinstance(rc[1], int)})

    if col_widths:
        for col_idx, width in enumerate(col_widths):
            for row_idx in row_indices:
                key = (row_idx, col_idx)
                if key in cells:
                    cells[key].set_width(width)

    for row_idx in row_indices:
        max_lines = 1
        for col_idx in col_indices:
            key = (row_idx, col_idx)
            if key not in cells:
                continue
            text = cells[key].get_text().get_text() or ''
            line_count = text.count('\n') + 1
            max_lines = max(max_lines, line_count)
        height = base_height if row_idx == 0 else base_height + (max_lines - 1) * line_height
        for col_idx in col_indices:
            key = (row_idx, col_idx)
            if key in cells:
                cells[key].set_height(height)
                cells[key].PAD = 0.02
                cells[key].get_text().set_va('center')


def _draw_ranked_table(ax, title, header_label, series, accent_color='#c0392b', max_rows=3):
    ax.axis('off')
    ax.set_title(title, loc='left', fontsize=12, fontweight='bold', color=accent_color, pad=8)
    if series is None or series.empty:
        ax.text(0, 0.5, 'Sin datos disponibles', fontsize=10, color='#555', va='center')
        return
    top_series = series.head(max_rows)
    table_rows = [[f"{idx + 1}. {_wrap_label(label, 22)}", _format_minutes(value)] for idx, (label, value) in enumerate(top_series.items())]
    total_value = _format_minutes(top_series.sum())
    table_rows.append(['Total', total_value])

    col_labels = [header_label, 'Tiempo']
    table = ax.table(cellText=table_rows,
                     colLabels=col_labels,
                     loc='upper left', bbox=[0, 0, 1, 0.88],
                     cellLoc='left',
                     colLoc='left')
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    try:
        table.auto_set_column_width(col=list(range(len(col_labels))))
    except AttributeError:
        widths = [0.72, 0.28]
        n_rows = len(table_rows) + 1  # include header
        for col_idx, width in enumerate(widths):
            for row_idx in range(n_rows):
                cell = table[(row_idx, col_idx)]
                cell.set_width(width)
    table.scale(1.08, 1.30)
    _autoscale_table(table, col_widths=[0.72, 0.28])

    total_row_index = len(table_rows)
    for (row, col), cell in table.get_celld().items():
        cell.set_edgecolor('#2c3e50')
        if row == 0:
            cell.set_facecolor('#1f1f1f')
            cell.get_text().set_color('white')
            cell.get_text().set_fontweight('bold')
        elif row == total_row_index:  # total row
            cell.set_facecolor('#ecf0f1')
            cell.get_text().set_fontweight('bold')
        else:
            cell.set_facecolor('white')


def _draw_detail_table(ax, title, series, accent_color='#34495e', max_rows=4):
    ax.axis('off')
    ax.set_title(title, loc='left', fontsize=11, fontweight='bold', color=accent_color, pad=6)
    if series is None or series.empty:
        ax.text(0, 0.5, 'Sin datos', fontsize=9, color='#777', va='center')
        return
    subset = series.head(max_rows)
    rows = [[f"{idx + 1}. {_wrap_label(label, 20)}", _format_minutes(value)] for idx, (label, value) in enumerate(subset.items())]
    rows.append(['Total', _format_minutes(subset.sum())])
    col_labels = ['Descripción', 'Tiempo']
    table = ax.table(cellText=rows,
                     colLabels=col_labels,
                     loc='upper left', bbox=[0, 0, 1, 0.88], cellLoc='left', colLoc='left')
    table.auto_set_font_size(False)
    table.set_fontsize(8.5)
    try:
        table.auto_set_column_width(col=list(range(len(col_labels))))
    except AttributeError:
        widths = [0.7, 0.3]
        n_rows = len(rows) + 1
        for col_idx, width in enumerate(widths):
            for row_idx in range(n_rows):
                cell = table[(row_idx, col_idx)]
                cell.set_width(width)
    table.scale(1.08, 1.28)
    _autoscale_table(table, col_widths=[0.7, 0.3], base_height=0.30)
    total_row_index = len(rows)
    for (row, _), cell in table.get_celld().items():
        cell.set_edgecolor('#95a5a6')
        if row == 0:
            cell.set_facecolor('#2c3e50')
            cell.get_text().set_color('white')
            cell.get_text().set_fontweight('bold')
        elif row == total_row_index:
            cell.set_facecolor('#ecf0f1')
            cell.get_text().set_fontweight('bold')


def _plot_bar(ax, labels, values, title, color='#1f77b4', highlight_top=True):
    ax.set_title(title, fontsize=12, fontweight='bold', color='#2c3e50')
    if not labels or not values:
        ax.text(0.5, 0.5, 'Sin datos', ha='center', va='center', color='#777')
        ax.set_xticks([])
        ax.set_yticks([])
        return
    positions = np.arange(len(labels))
    bars = ax.bar(positions, values, color=color)
    ax.set_xticks(positions)
    ax.set_xticklabels(labels, rotation=25, ha='right', fontsize=8)
    ax.tick_params(axis='y', labelsize=9)
    ax.tick_params(axis='x', labelsize=8)
    ax.grid(axis='y', linestyle='--', alpha=0.3)
    max_val = max(values) if values else 1
    ax.set_ylim(0, max_val * 1.15)
    for rect, value in zip(bars, values):
        ax.text(rect.get_x() + rect.get_width() / 2, rect.get_height() + max_val * 0.03,
                int(round(value)), ha='center', va='bottom', fontsize=8, fontweight='bold')
    if highlight_top and bars:
        bars[0].set_color('#3498db')


def _plot_weekly_chart(ax, week_series):
    ax.set_title('IT Downtime per Week', fontsize=12, fontweight='bold', color='#2c3e50')
    if week_series is None or week_series.empty:
        ax.text(0.5, 0.5, 'Sin datos', ha='center', va='center', color='#777')
        ax.set_xticks([])
        ax.set_yticks([])
        return
    labels = [f'W{int(w)}' for w in week_series.index]
    values = [float(v) for v in week_series.values]
    positions = np.arange(len(labels))
    bars = ax.bar(positions, values, color='#2980b9')
    ax.set_xticks(positions)
    ax.set_xticklabels(labels, rotation=0, fontsize=9)
    ax.tick_params(axis='y', labelsize=9)
    ax.grid(axis='y', linestyle='--', alpha=0.3)
    max_val = max(values) if values else 1
    ax.set_ylim(0, max_val * 1.15)
    for rect, value in zip(bars, values):
        ax.text(rect.get_x() + rect.get_width() / 2, rect.get_height() + max_val * 0.03,
                int(round(value)), ha='center', va='bottom', fontsize=8, fontweight='bold')
    ax.axhline(83, color='#e67e22', linestyle='--', linewidth=1.5, label='Target 83 min')
    ax.legend(loc='upper right', fontsize=8)


def _plot_monthly_downtime(ax, month_series):
    ax.set_title('IT Downtime per Month', fontsize=12, fontweight='bold', color='#2c3e50')
    if month_series is None or month_series.empty:
        ax.text(0.5, 0.5, 'Sin datos', ha='center', va='center', color='#777')
        ax.set_xticks([])
        ax.set_yticks([])
        return
    month_names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    labels = []
    for m in month_series.index:
        try:
            year, month = m.split('-')
            labels.append(f'{month_names[int(month) - 1]} {year}')
        except (ValueError, IndexError):
            labels.append(m)
    values = [float(v) for v in month_series.values]
    positions = np.arange(len(labels))
    bars = ax.bar(positions, values, color='#8e44ad', alpha=0.85, label='Downtime')
    ax.set_xticks(positions)
    ax.set_xticklabels(labels, rotation=0, fontsize=9)
    ax.tick_params(axis='y', labelsize=9)
    ax.grid(axis='y', linestyle='--', alpha=0.3)
    max_val = max(values) if values else 1
    ax.set_ylim(0, max_val * 1.15)
    for rect, value in zip(bars, values):
        ax.text(rect.get_x() + rect.get_width() / 2, rect.get_height() + max_val * 0.03,
                int(round(value)), ha='center', va='bottom', fontsize=8, fontweight='bold')
    if len(values) >= 2:
        x = np.arange(len(values))
        slope, intercept = np.polyfit(x, values, 1)
        trend = slope * x + intercept
    else:
        trend = values
    ax.plot(positions, trend, color='#e67e22', marker='o', linewidth=2, label='Tendencia')
    ax.legend(loc='upper right', fontsize=8)


def _plot_monthly_frequency(ax, freq_series):
    ax.set_title('IT Frequency Issues per Month', fontsize=12, fontweight='bold', color='#2c3e50')
    if freq_series is None or freq_series.empty:
        ax.text(0.5, 0.5, 'Sin datos', ha='center', va='center', color='#777')
        ax.set_xticks([])
        ax.set_yticks([])
        return
    month_names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    labels = []
    for m in freq_series.index:
        try:
            year, month = m.split('-')
            labels.append(f'{month_names[int(month) - 1]} {year}')
        except (ValueError, IndexError):
            labels.append(m)
    values = [int(v) for v in freq_series.values]
    positions = np.arange(len(labels))
    bars = ax.bar(positions, values, color='#27ae60', alpha=0.85)
    ax.set_xticks(positions)
    ax.set_xticklabels(labels, rotation=0, fontsize=9)
    ax.tick_params(axis='y', labelsize=9)
    ax.grid(axis='y', linestyle='--', alpha=0.3)
    max_val = max(values) if values else 1
    ax.set_ylim(0, max_val * 1.15)
    for rect, value in zip(bars, values):
        ax.text(rect.get_x() + rect.get_width() / 2, rect.get_height() + max_val * 0.03,
                value, ha='center', va='bottom', fontsize=8, fontweight='bold')


def _create_top3_analysis_figure(period_label, top_area, top_class, top_event, event_label):
    fig = Figure(figsize=(11.69, 8.27))
    fig.suptitle(f'Análisis Top 3 Soporte {period_label}', fontsize=18, fontweight='bold', y=0.98)

    grid = fig.add_gridspec(2, 3, height_ratios=[1.05, 1.45], hspace=0.5, wspace=0.35)

    sections = [
        ('Top 3 by Area', 'Área', top_area, '#2980b9'),
        ('Top 3 by Class', 'Tipo de falla', top_class, '#d35400'),
        ('Top 3 by Event', event_label or 'Evento / Problema', top_event, '#16a085')
    ]

    for idx, (title, header, series, color) in enumerate(sections):
        table_ax = fig.add_subplot(grid[0, idx])
        _draw_ranked_table(table_ax, title, header, series, accent_color=color)

        chart_ax = fig.add_subplot(grid[1, idx])
        if series is None or series.empty:
            _plot_bar(chart_ax, [], [], title, color=color, highlight_top=False)
        else:
            top_labels = [
                _wrap_label(label, 18) for label in series.head(3).index.astype(str)
            ]
            top_values = [float(v) for v in series.head(3).values]
            _plot_bar(chart_ax, top_labels, top_values, title, color=color, highlight_top=False)

    fig.tight_layout(rect=[0, 0, 1, 0.94])
    return fig


def _create_failure_types_figure(period_label, top_class, class_event_details):
    fig = Figure(figsize=(11.69, 8.27))
    fig.suptitle(f'Tipos de Falla {period_label}', fontsize=18, fontweight='bold', y=0.98)

    grid = fig.add_gridspec(2, 2, hspace=0.45, wspace=0.4)

    _draw_detail_table(fig.add_subplot(grid[0, 0]), 'Top 3 Tipos de falla', top_class, accent_color='#2c3e50', max_rows=3)

    slots = [(0, 1), (1, 0), (1, 1)]
    detail_count = min(len(class_event_details), len(slots))
    for idx in range(detail_count):
        class_name, series = class_event_details[idx]
        row, col = slots[idx]
        title = f"Top 3 {class_name}"
        ax = fig.add_subplot(grid[row, col])
        _draw_detail_table(ax, title, series, accent_color='#34495e', max_rows=3)

    for idx in range(detail_count, len(slots)):
        row, col = slots[idx]
        ax = fig.add_subplot(grid[row, col])
        ax.axis('off')
        ax.text(0.1, 0.5, 'Sin datos disponibles', fontsize=9, color='#888', va='center')

    fig.tight_layout(rect=[0, 0, 1, 0.94])
    return fig


def _create_trend_figure(period_label, week_series, month_downtime_series, month_freq_series):
    fig = Figure(figsize=(11.69, 8.27))
    outer = fig.add_gridspec(2, 2, height_ratios=[1.3, 1.1], hspace=0.45, wspace=0.4)
    fig.suptitle(f'Tendencia Top 3 Soporte {period_label}', fontsize=18, fontweight='bold', y=0.98)

    _plot_weekly_chart(fig.add_subplot(outer[0, 0]), week_series)
    _plot_monthly_downtime(fig.add_subplot(outer[0, 1]), month_downtime_series)
    freq_ax = fig.add_subplot(outer[1, :])
    _plot_monthly_frequency(freq_ax, month_freq_series)

    fig.tight_layout(rect=[0, 0, 1, 0.94])
    return fig


def _create_critical_events_figure(period_label, critical_series, event_label):
    fig = Figure(figsize=(11.69, 8.27))
    fig.suptitle(f'Fallas Críticas a Atender {period_label}', fontsize=18, fontweight='bold', y=0.98)
    ax = fig.add_subplot(111)
    if critical_series is None or critical_series.empty:
        ax.axis('off')
        ax.text(0.5, 0.5, 'Sin datos disponibles', ha='center', va='center', fontsize=12, color='#555')
    else:
        _draw_detail_table(ax, f'Top 3 {event_label or "Eventos"}', critical_series, accent_color='#c0392b', max_rows=3)
    fig.tight_layout(rect=[0, 0, 1, 0.94])
    return fig


@app.route('/generate_report', methods=['POST'])
def generate_report():
    df = _load_dataframe()
    if df.empty:
        return 'No hay datos disponibles para generar el reporte.', 400

    weeks_raw = request.form.getlist('week')
    years_raw = request.form.getlist('year')
    months_raw = request.form.getlist('month')

    weeks = []
    years = []
    months = []

    for w in weeks_raw:
        w = w.strip()
        if w.isdigit():
            weeks.append(int(w))

    for y in years_raw:
        y = y.strip()
        if y.isdigit():
            years.append(int(y))

    for m in months_raw:
        m = m.strip()
        if m:
            months.append(m)

    df_filtered = df.copy()

    if weeks and 'WEEK#' in df_filtered.columns:
        df_filtered = df_filtered[df_filtered['WEEK#'].isin(weeks)]

    if years and 'FECHA' in df_filtered.columns:
        df_filtered = df_filtered[df_filtered['FECHA'].dt.year.isin(years)]

    if months and 'FECHA' in df_filtered.columns:
        df_filtered = df_filtered[df_filtered['FECHA'].notna()]
        df_filtered = df_filtered[df_filtered['FECHA'].dt.to_period('M').astype(str).isin(months)]

    if df_filtered.empty:
        return 'No hay datos para los filtros seleccionados.', 400

    buffer = BytesIO()

    def _get_period_label():
        week_values = []
        if 'WEEK#' in df_filtered.columns:
            week_values = sorted({int(w) for w in df_filtered['WEEK#'].dropna().astype(int)})
        if week_values:
            if len(week_values) == 1:
                return f"Week #{week_values[0]}"
            return "Weeks #" + ', '.join(str(w) for w in week_values)
        return 'Week #N/A'

    period_label = _get_period_label()

    event_col_candidates = [c for c in df_filtered.columns if any(keyword in c.upper() for keyword in ['EVENT', 'PROBLEM', 'DESCRIPCION', 'DESCRIPCIÓN'])]
    event_col = event_col_candidates[0] if event_col_candidates else None
    event_label = event_col.replace('_', ' ').title() if event_col else 'Evento / Problema'

    top_area = pd.Series(dtype=float)
    if {'AREA', 'T. MUERTO'}.issubset(df_filtered.columns):
        top_area = df_filtered.groupby('AREA')['T. MUERTO'].sum().dropna().sort_values(ascending=False)

    top_class = pd.Series(dtype=float)
    if {'CLASS', 'T. MUERTO'}.issubset(df_filtered.columns):
        top_class = df_filtered.groupby('CLASS')['T. MUERTO'].sum().dropna().sort_values(ascending=False)

    top_event = pd.Series(dtype=float)
    if event_col and 'T. MUERTO' in df_filtered.columns:
        top_event = df_filtered.groupby(event_col)['T. MUERTO'].sum().dropna().sort_values(ascending=False)

    class_event_details = []
    if not top_class.empty and event_col and 'T. MUERTO' in df_filtered.columns:
        for class_name in top_class.head(3).index:
            subset = df_filtered[df_filtered['CLASS'] == class_name]
            series = subset.groupby(event_col)['T. MUERTO'].sum().dropna().sort_values(ascending=False)
            class_event_details.append((class_name, series))

    week_series = pd.Series(dtype=float)
    if {'WEEK#', 'T. MUERTO'}.issubset(df_filtered.columns):
        week_series = df_filtered.groupby('WEEK#')['T. MUERTO'].sum().dropna().sort_index()

    month_downtime_series = pd.Series(dtype=float)
    month_freq_series = pd.Series(dtype=float)
    if 'FECHA' in df_filtered.columns:
        df_with_dates = df_filtered[df_filtered['FECHA'].notna()].copy()
        if len(df_with_dates) > 0:
            df_with_dates['MONTH'] = df_with_dates['FECHA'].dt.to_period('M').astype(str)
            if 'T. MUERTO' in df_with_dates.columns:
                month_downtime_series = df_with_dates.groupby('MONTH')['T. MUERTO'].sum().dropna().sort_index()
            month_freq_series = df_with_dates.groupby('MONTH').size().sort_index()

    figures = [
        _create_top3_analysis_figure(period_label, top_area, top_class, top_event, event_label),
        _create_failure_types_figure(period_label, top_class, class_event_details),
        _create_trend_figure(period_label, week_series, month_downtime_series, month_freq_series),
        _create_critical_events_figure(period_label, top_event.head(3), event_label)
    ]

    with PdfPages(buffer) as pdf:
        for fig in figures:
            pdf.savefig(fig)

    buffer.seek(0)
    response = make_response(buffer.read())
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = 'attachment; filename="reporte_soporte_ti.pdf"'
    return response

if __name__ == '__main__':
    print('Iniciando app Flask...')
    # Al arrancar, muestra columnas detectadas y primeras filas
    debug_data = load_data(nrows=3)
    print('Columnas detectadas:', debug_data['columns'])
    for i, row in enumerate(debug_data['rows']):
        print(f'Fila {i+1}:', row)
    app.run(debug=True, port=5001)
