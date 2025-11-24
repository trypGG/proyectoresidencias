async function fetchTop3Event(weeks = [], n = 3) {
  const qs = new URLSearchParams();
  if (weeks.length) qs.set('weeks', weeks.join(','));
  qs.set('n', String(n));
  const res = await fetch(`/top3_by_event?${qs.toString()}`);
  return res.json();
}

function plotTop3Event(data) {
  const events = data.events || [];
  const values = data.values || [];

  // helper: wrap text into multiple lines on word boundaries
  function wrapText(s, maxChars) {
    if (!s) return '';
    const words = String(s).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length <= maxChars) {
        cur = (cur + ' ' + w).trim();
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.join('<br>');
  }

  const MAX_CHARS = 25; // Aumentado para mostrar más texto
  const wrapped = events.map(e => wrapText(e, MAX_CHARS));
  const trace = {
    x: wrapped,
    y: values,
    type: 'bar',
    marker: { color: '#2ca02c' },
    text: values.map(v => (v === null || v === undefined) ? '' : String(v)),
    textposition: 'outside',
    textfont: { size: 12 },
    cliponaxis: false,
    hoverinfo: 'text',
    hovertext: events.map((e, i) => `${e}\nValor: ${values[i]}`)
  };
  const layout = {
    title: 'TOP 3 POR EVENTO',
    margin: { t: 100, b: 350, l: 80, r: 80},
    xaxis: { 
      tickangle: -45, 
      automargin: true,
      tickfont: { size: 11 }
    },
    yaxis: { automargin: true },
    height: 650,
    bargap: 0.2
  };
  Plotly.newPlot('chart-top3event', [trace], layout, {responsive: true, displayModeBar: false});
}
// Main frontend for bitacora charts
async function fetchData(n = 200) {
  const res = await fetch(`/data?n=${n}`);
  return res.json();
}

async function fetchMeta() {
  const res = await fetch('/meta');
  return res.json();
}

async function fetchTop3(weeks = [], n = 3) {
  const qs = new URLSearchParams();
  if (weeks.length) qs.set('weeks', weeks.join(','));
  qs.set('n', String(n));
  qs.set('agg', 'sum');
  const res = await fetch(`/top3_by_area?${qs.toString()}`);
  return res.json();
}

async function fetchBitacoraData() {
  const res = await fetch('/data');
  return res.json();
}

async function fetchTop3Class(weeks = [], n = 3) {
  const qs = new URLSearchParams();
  if (weeks.length) qs.set('weeks', weeks.join(','));
  qs.set('n', String(n));
  const res = await fetch(`/top3_by_class?${qs.toString()}`);
  return res.json();
}

function pickDefaultColumns(columns, rows) {
  let x = columns.includes('FECHA') ? 'FECHA' : columns[0];
  let y = null;
  if (rows.length > 0) {
    for (const c of columns) {
      const vals = rows.map(r => r[c]);
      if (vals.some(v => typeof v === 'number')) { y = c; break; }
      if (vals.every(v => v === '' || v === null || !isNaN(Number(v)))) { y = c; break; }
    }
  }
  if (!y) y = columns.length > 1 ? columns[1] : columns[0];
  return { x, y };
}

function toTrace(rows, xKey, yKey, type) {
  const x = rows.map(r => r[xKey]);
  const y = rows.map(r => {
    const v = r[yKey];
    const n = Number(v);
    return isNaN(n) ? null : n;
  });
  const trace = { x, y, type: type === 'bar' ? 'bar' : 'scatter', mode: 'lines+markers', name: yKey };
  return trace;
}

function populateSelectors(columns, defaultX, defaultY) {
  const sx = document.getElementById('select-x');
  const sy = document.getElementById('select-y');
  if (!sx || !sy) return;
  sx.innerHTML = '';
  sy.innerHTML = '';
  for (const c of columns) {
    const o1 = document.createElement('option'); o1.value = c; o1.textContent = c; if (c === defaultX) o1.selected = true;
    const o2 = document.createElement('option'); o2.value = c; o2.textContent = c; if (c === defaultY) o2.selected = true;
    sx.appendChild(o1);
    sy.appendChild(o2);
  }
}

function buildWeeksDropdown(weeks, panelId, toggleId) {
  const panel = document.getElementById(panelId);
  const toggle = document.getElementById(toggleId);
  if (!panel || !toggle) return;
  
  // Limpiar panel y remover listeners previos clonando el botón
  panel.innerHTML = '';
  const newToggle = toggle.cloneNode(true);
  toggle.parentNode.replaceChild(newToggle, toggle);
  const toggleBtn = document.getElementById(toggleId); // Referencia al nuevo botón
  
  if (!weeks || !weeks.length) {
    const span = document.createElement('div'); span.textContent = 'No hay semanas'; panel.appendChild(span);
    toggleBtn.disabled = true;
    toggleBtn.textContent = 'Sin semanas disponibles';
    return;
  }
  
  toggleBtn.disabled = false;
  for (const w of weeks) {
    const id = `${panelId}-week-${w}`;
    const label = document.createElement('label');
    label.style.display = 'block';
    const cb = document.createElement('input'); 
    cb.type = 'checkbox'; 
    cb.value = String(w); 
    cb.id = id; 
    cb.className = 'week-checkbox';
    const txt = document.createTextNode(' Semana ' + String(w));
    label.appendChild(cb); 
    label.appendChild(txt);
    panel.appendChild(label);
  }

  const updateToggleLabel = () => {
    const checked = Array.from(panel.querySelectorAll('.week-checkbox:checked')).map(i => i.value);
    toggleBtn.textContent = checked.length > 0 
      ? `Semanas seleccionadas (${checked.length})`
      : 'Seleccionar semanas (0)';
  };

  panel.addEventListener('change', updateToggleLabel);
  updateToggleLabel();

  // Toggle behavior
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
  });

  // Close when clicking outside
  const closePanel = (e) => {
    if (!panel.contains(e.target) && !toggleBtn.contains(e.target)) {
      panel.style.display = 'none';
    }
  };
  document.addEventListener('click', closePanel);
}

function buildMonthsDropdown(months, panelId, toggleId) {
  const panel = document.getElementById(panelId);
  const toggle = document.getElementById(toggleId);
  if (!panel || !toggle) return;
  
  // Limpiar panel y remover listeners previos clonando el botón
  panel.innerHTML = '';
  const newToggle = toggle.cloneNode(true);
  toggle.parentNode.replaceChild(newToggle, toggle);
  const toggleBtn = document.getElementById(toggleId); // Referencia al nuevo botón
  
  if (!months || !months.length) {
    const span = document.createElement('div'); span.textContent = 'No hay meses'; panel.appendChild(span);
    toggleBtn.disabled = true;
    toggleBtn.textContent = 'Sin meses disponibles';
    return;
  }
  
  toggleBtn.disabled = false;
  for (const m of months) {
    const id = `${panelId}-month-${m}`;
    const label = document.createElement('label');
    label.style.display = 'block';
    const cb = document.createElement('input'); 
    cb.type = 'checkbox'; 
    cb.value = String(m); 
    cb.id = id; 
    cb.className = 'month-checkbox';
    const txt = document.createTextNode(' ' + String(m));
    label.appendChild(cb); 
    label.appendChild(txt);
    panel.appendChild(label);
  }

  const updateToggleLabel = () => {
    const checked = Array.from(panel.querySelectorAll('.month-checkbox:checked')).map(i => i.value);
    toggleBtn.textContent = checked.length > 0 
      ? `Meses seleccionados (${checked.length})`
      : 'Seleccionar meses (0)';
  };

  panel.addEventListener('change', updateToggleLabel);
  updateToggleLabel();

  // Toggle behavior
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
  });

  // Close when clicking outside
  const closePanel = (e) => {
    if (!panel.contains(e.target) && !toggleBtn.contains(e.target)) {
      panel.style.display = 'none';
    }
  };
  document.addEventListener('click', closePanel);
}

function buildYearsDropdown(years, panelId, toggleId) {
  const panel = document.getElementById(panelId);
  const toggle = document.getElementById(toggleId);
  if (!panel || !toggle) return;
  
  // Limpiar panel y remover listeners previos clonando el botón
  panel.innerHTML = '';
  const newToggle = toggle.cloneNode(true);
  toggle.parentNode.replaceChild(newToggle, toggle);
  const toggleBtn = document.getElementById(toggleId); // Referencia al nuevo botón
  
  if (!years || !years.length) {
    const span = document.createElement('div'); 
    span.textContent = 'No hay años'; 
    panel.appendChild(span); 
    toggleBtn.disabled = true; 
    toggleBtn.textContent = 'Sin años disponibles'; 
    return;
  }
  
  toggleBtn.disabled = false;
  for (const y of years) {
    const id = `${panelId}-year-${y}`;
    const label = document.createElement('label');
    label.style.display = 'block';
    const cb = document.createElement('input'); 
    cb.type = 'checkbox'; 
    cb.value = String(y); 
    cb.id = id; 
    cb.className = 'year-checkbox';
    const txt = document.createTextNode(' ' + String(y));
    label.appendChild(cb); 
    label.appendChild(txt);
    panel.appendChild(label);
  }

  const updateToggleLabel = () => {
    const checked = Array.from(panel.querySelectorAll('.year-checkbox:checked')).map(i => i.value);
    toggleBtn.textContent = checked.length > 0 
      ? `Años seleccionados (${checked.length})`
      : 'Seleccionar años (0)';
  };

  panel.addEventListener('change', updateToggleLabel);
  updateToggleLabel();

  // Toggle behavior
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isVisible = panel.style.display === 'block';
    panel.style.display = isVisible ? 'none' : 'block';
  });

  // Close when clicking outside
  const closePanel = (e) => {
    if (!panel.contains(e.target) && !toggleBtn.contains(e.target)) {
      panel.style.display = 'none';
    }
  };
  document.addEventListener('click', closePanel);
}

function populateReportForm(meta) {
  buildWeeksDropdown(meta.weeks || [], 'report-weeks-panel', 'report-weeks-toggle');
  buildYearsDropdown(meta.years || [], 'report-years-panel', 'report-years-toggle');
  buildMonthsDropdown(meta.months || [], 'report-months-panel', 'report-months-toggle');
}

function getCheckedValues(panelSelector, checkboxSelector) {
  const panel = typeof panelSelector === 'string' ? document.querySelector(panelSelector) : panelSelector;
  if (!panel) return [];
  return Array.from(panel.querySelectorAll(checkboxSelector)).filter(cb => cb.checked).map(cb => cb.value);
}

const BITACORA_LIMIT = 50;
let bitacoraAllRows = [];
const bitacoraFilters = { date: '', weeks: [], areas: [], classes: [], showAll: false };

function setBitacoraData(rows) {
  bitacoraAllRows = (rows || []).map((row, idx) => ({ ...row, _idx: idx }));
}

function normalizeBitacoraDate(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [month, day, year] = trimmed.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return '';
}

function applyBitacoraFilters() {
  let filtered = bitacoraAllRows;

  if (bitacoraFilters.date) {
    filtered = filtered.filter(row => normalizeBitacoraDate(row.FECHA) === bitacoraFilters.date);
  }
  if (bitacoraFilters.weeks && bitacoraFilters.weeks.length) {
    const weekSet = new Set(bitacoraFilters.weeks.map((w) => parseInt(w, 10)).filter((n) => !Number.isNaN(n)));
    filtered = filtered.filter(row => {
      const value = row['WEEK#'];
      if (value === undefined || value === null || value === '') return false;
      const numeric = parseInt(String(value).trim(), 10);
      return !Number.isNaN(numeric) && weekSet.has(numeric);
    });
  }
  if (bitacoraFilters.areas && bitacoraFilters.areas.length) {
    const areaSet = new Set(bitacoraFilters.areas.map((s) => s.trim()));
    filtered = filtered.filter(row => areaSet.has((row.AREA || '').trim()));
  }
  if (bitacoraFilters.classes && bitacoraFilters.classes.length) {
    const classSet = new Set(bitacoraFilters.classes.map((s) => s.trim()));
    filtered = filtered.filter(row => classSet.has((row.CLASS || '').trim()));
  }

  const sortByDateAsc = (rows) => rows.slice().sort((a, b) => {
    const dateA = normalizeBitacoraDate(a.FECHA);
    const dateB = normalizeBitacoraDate(b.FECHA);
    const cmp = dateA.localeCompare(dateB);
    if (cmp !== 0) return cmp;
    return (a._idx ?? 0) - (b._idx ?? 0);
  });
  const sortByWeekThenDateAsc = (rows) => rows.slice().sort((a, b) => {
    const weekA = parseInt(String(a['WEEK#'] ?? '').trim(), 10);
    const weekB = parseInt(String(b['WEEK#'] ?? '').trim(), 10);
    const validWeekA = Number.isNaN(weekA) ? Number.MAX_SAFE_INTEGER : weekA;
    const validWeekB = Number.isNaN(weekB) ? Number.MAX_SAFE_INTEGER : weekB;
    if (validWeekA !== validWeekB) return validWeekA - validWeekB;
    const dateA = normalizeBitacoraDate(a.FECHA);
    const dateB = normalizeBitacoraDate(b.FECHA);
    const dateCmp = dateA.localeCompare(dateB);
    if (dateCmp !== 0) return dateCmp;
    return (a._idx ?? 0) - (b._idx ?? 0);
  });
  const hasFilters = Boolean(bitacoraFilters.date || (bitacoraFilters.weeks && bitacoraFilters.weeks.length) || (bitacoraFilters.areas && bitacoraFilters.areas.length) || (bitacoraFilters.classes && bitacoraFilters.classes.length));
  const showAll = bitacoraFilters.showAll;
  let visibleRows;
  if (hasFilters) {
    visibleRows = sortByDateAsc(filtered);
  } else if (showAll) {
    visibleRows = sortByWeekThenDateAsc(filtered);
  } else {
    // Mostrar los últimos N registros PERO ordenados por semana y fecha
    const lastChunk = filtered.slice(-BITACORA_LIMIT);
    visibleRows = sortByWeekThenDateAsc(lastChunk);
  }
  renderBitacoraTable(visibleRows);

  const infoEl = document.getElementById('bitacora-table-info');
  if (infoEl) {
    if (filtered.length === 0) {
      infoEl.textContent = 'Sin resultados para los filtros seleccionados.';
    } else {
      if (hasFilters) {
        infoEl.textContent = `Mostrando ${visibleRows.length} registros que cumplen los filtros.`;
      } else if (showAll) {
        infoEl.textContent = `Mostrando todos los ${visibleRows.length} registros disponibles.`;
      } else {
        infoEl.textContent = `Mostrando ${visibleRows.length} registros más recientes (de ${filtered.length} totales).`;
      }
    }
  }
}

function updateBitacoraFiltersFromInputs() {
  const dateInput = document.getElementById('bitacora-filter-date');
  const weekPanel = document.getElementById('bitacora-week-panel');
  const areaPanel = document.getElementById('bitacora-area-panel');
  const classPanel = document.getElementById('bitacora-class-panel');
  const showAllCheckbox = document.getElementById('bitacora-show-all');

  bitacoraFilters.date = dateInput && dateInput.value ? dateInput.value : '';
  bitacoraFilters.weeks = weekPanel ? Array.from(weekPanel.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value) : [];
  bitacoraFilters.areas = areaPanel ? Array.from(areaPanel.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value) : [];
  bitacoraFilters.classes = classPanel ? Array.from(classPanel.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value) : [];
  bitacoraFilters.showAll = showAllCheckbox ? showAllCheckbox.checked : false;

  applyBitacoraFilters();
}

async function reloadBitacoraData(options = {}) {
  const { updateMeta = true } = options;
  let data;
  try {
    data = await fetchBitacoraData();
  } catch (error) {
    console.error('Error al obtener la bitácora', error);
    throw error;
  }

  setBitacoraData((data && data.rows) || []);

  if (updateMeta) {
    try {
      const meta = await fetchMeta();
      populateBitacoraSelects(meta);
    } catch (error) {
      console.error('Error al actualizar metadatos de la bitácora', error);
    }
  }

  updateBitacoraFiltersFromInputs();
  return data;
}

function calculateIsoWeekFromDateString(dateString) {
  if (!dateString) return null;
  const parts = dateString.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [year, month, day] = parts;
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(utcDate.getTime())) return null;
  const dayNumber = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7);
  return { week, year: utcDate.getUTCFullYear() };
}

function setWeekNumberFromDateInputValue(dateString, targetInput) {
  if (!targetInput) return;
  const result = calculateIsoWeekFromDateString(dateString);
  targetInput.value = result ? String(result.week) : '';
}

function updateTiempoMuertoField(esperaInput, solucionInput, targetInput) {
  if (!targetInput) return;
  const esperaRaw = esperaInput && esperaInput.value !== undefined ? esperaInput.value : '';
  const solucionRaw = solucionInput && solucionInput.value !== undefined ? solucionInput.value : '';
  const espera = parseFloat(esperaRaw);
  const solucion = parseFloat(solucionRaw);
  const esperaValid = !Number.isNaN(espera);
  const solucionValid = !Number.isNaN(solucion);
  if (!esperaValid && !solucionValid) {
    targetInput.value = '';
    return;
  }
  const total = (esperaValid ? espera : 0) + (solucionValid ? solucion : 0);
  if (!Number.isFinite(total)) {
    targetInput.value = '';
    return;
  }
  const normalized = Math.round(total * 100) / 100;
  targetInput.value = normalized.toString();
}

function populateBitacoraSelects(meta) {
  const datalistWeeks = document.getElementById('weeks-datalist');
  if (datalistWeeks) {
    datalistWeeks.innerHTML = '';
    (meta.weeks || []).forEach((w) => {
      const option = document.createElement('option');
      option.value = String(w);
      datalistWeeks.appendChild(option);
    });
  }

  const areaSelect = document.getElementById('entry-area');
  if (areaSelect) {
    const prev = areaSelect.value;
    areaSelect.innerHTML = '<option value="">Selecciona un área</option>';
    (meta.areas || []).forEach((area) => {
      const option = document.createElement('option');
      option.value = area;
      option.textContent = area;
      areaSelect.appendChild(option);
    });
    if (meta.areas && meta.areas.includes(prev)) areaSelect.value = prev;
  }

  const classSelect = document.getElementById('entry-class');
  if (classSelect) {
    const prev = classSelect.value;
    classSelect.innerHTML = '<option value="">Selecciona una clase</option>';
    (meta.classes || []).forEach((cls) => {
      const option = document.createElement('option');
      option.value = cls;
      option.textContent = cls;
      classSelect.appendChild(option);
    });
    if (meta.classes && meta.classes.includes(prev)) classSelect.value = prev;
  }

  const buildPanel = (panelId, toggleId, items, labelFormatter = (v) => v) => {
    const existingPanel = document.getElementById(panelId);
    const toggle = document.getElementById(toggleId);
    if (!existingPanel || !toggle) return;

    const previous = new Set(Array.from(existingPanel.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value));
    let panel = existingPanel;
    if (existingPanel.firstChild) {
      const cloned = existingPanel.cloneNode(false);
      existingPanel.parentNode.replaceChild(cloned, existingPanel);
      panel = cloned;
    } else {
      panel.textContent = '';
    }

    if (!items || !items.length) {
      const empty = document.createElement('div');
      empty.textContent = 'Sin opciones disponibles';
      empty.style.fontSize = '12px';
      empty.style.color = '#666';
      panel.appendChild(empty);
      toggle.disabled = true;
      toggle.textContent = 'Sin opciones';
      return;
    }

    toggle.disabled = false;

    items.forEach((item) => {
      const safeId = String(item).replace(/[^a-zA-Z0-9_-]/g, '_');
      const id = `${panelId}-${safeId}`;
      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = String(item);
      checkbox.id = id;
      checkbox.checked = previous.has(String(item));
      const span = document.createElement('span');
      span.textContent = labelFormatter(item);
      label.appendChild(checkbox);
      label.appendChild(span);
      panel.appendChild(label);
    });

    const updateToggleLabel = () => {
      const selectedInputs = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked'));
      if (!selectedInputs.length) {
        toggle.textContent = toggle.dataset.defaultLabel || 'Seleccionar';
        return;
      }
      const labels = selectedInputs.slice(0, 2).map(cb => labelFormatter(cb.value));
      let text = labels.join(', ');
      if (selectedInputs.length > 2) {
        text += ` +${selectedInputs.length - 2}`;
      }
      toggle.textContent = text;
    };

    panel.addEventListener('change', () => {
      updateToggleLabel();
      updateBitacoraFiltersFromInputs();
    });

    if (!toggle.dataset.toggleListenerBound) {
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const targetPanel = document.getElementById(panelId);
        if (!targetPanel) return;
        targetPanel.style.display = targetPanel.style.display === 'block' ? 'none' : 'block';
      });
      toggle.dataset.toggleListenerBound = 'true';
    }

    if (!toggle.dataset.outsideListenerBound) {
      document.addEventListener('click', (event) => {
        const targetPanel = document.getElementById(panelId);
        const targetToggle = document.getElementById(toggleId);
        if (!targetPanel || !targetToggle) return;
        if (!targetPanel.contains(event.target) && event.target !== targetToggle) {
          targetPanel.style.display = 'none';
        }
      });
      toggle.dataset.outsideListenerBound = 'true';
    }

    if (!toggle.dataset.defaultLabel) {
      toggle.dataset.defaultLabel = toggle.textContent || 'Seleccionar';
    }

    updateToggleLabel();
    panel.style.display = 'none';
  };

  buildPanel('bitacora-week-panel', 'bitacora-week-toggle', meta.weeks || [], (value) => `Semana ${value}`);
  buildPanel('bitacora-area-panel', 'bitacora-area-toggle', meta.areas || []);
  buildPanel('bitacora-class-panel', 'bitacora-class-toggle', meta.classes || []);

  const filterAreaSelect = document.getElementById('bitacora-filter-area');
  if (filterAreaSelect) {
    const prev = filterAreaSelect.value;
    filterAreaSelect.innerHTML = '<option value="">Todas las áreas</option>';
    (meta.areas || []).forEach((area) => {
      const option = document.createElement('option');
      option.value = area;
      option.textContent = area;
      filterAreaSelect.appendChild(option);
    });
    if (meta.areas && meta.areas.includes(prev)) {
      filterAreaSelect.value = prev;
    } else {
      filterAreaSelect.value = '';
    }
  }

  const filterClassSelect = document.getElementById('bitacora-filter-class');
  if (filterClassSelect) {
    const prev = filterClassSelect.value;
    filterClassSelect.innerHTML = '<option value="">Todas las clases</option>';
    (meta.classes || []).forEach((cls) => {
      const option = document.createElement('option');
      option.value = cls;
      option.textContent = cls;
      filterClassSelect.appendChild(option);
    });
    if (meta.classes && meta.classes.includes(prev)) {
      filterClassSelect.value = prev;
    } else {
      filterClassSelect.value = '';
    }
  }
}

function renderBitacoraTable(rows) {
  const tbody = document.getElementById('bitacora-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!rows || !rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 11;
    td.style.textAlign = 'center';
    td.style.padding = '16px';
    td.textContent = 'No hay registros disponibles.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    tr.dataset.rowIndex = row._csvIndex !== undefined ? row._csvIndex : index;
    tr.dataset.rowData = JSON.stringify(row);
    
    // Columna de checkbox
    const tdCheck = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'row-checkbox';
    checkbox.addEventListener('change', updateActionButtons);
    tdCheck.appendChild(checkbox);
    tr.appendChild(tdCheck);
    
    const cols = ['FECHA', 'WEEK#', 'AREA', 'CLASS', 'PROBLEM DESCRIPTION/SOLUTION', 'NOMBRE OPERADOR / USUARIOS', 'SHIFT', 'T. ESPERA', 'T. SOLUCION', 'T. MUERTO'];
    cols.forEach((key) => {
      const td = document.createElement('td');
      const value = row[key];
      td.textContent = value === undefined || value === null ? '' : String(value);
      tr.appendChild(td);
    });
    
    // Click en la fila selecciona/deselecciona
    tr.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox') {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      }
    });
    
    tbody.appendChild(tr);
  });
  
  updateActionButtons();
}

function updateActionButtons() {
  const editBtn = document.getElementById('bitacora-edit-btn');
  const deleteBtn = document.getElementById('bitacora-delete-btn');
  const selectedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
  const selectedCount = selectedCheckboxes.length;
  
  // Actualizar clases selected en las filas
  document.querySelectorAll('#bitacora-tbody tr').forEach(tr => {
    const checkbox = tr.querySelector('.row-checkbox');
    if (checkbox && checkbox.checked) {
      tr.classList.add('selected');
    } else {
      tr.classList.remove('selected');
    }
  });
  
  if (editBtn) {
    editBtn.disabled = selectedCount !== 1;
  }
  if (deleteBtn) {
    deleteBtn.disabled = selectedCount === 0;
  }
}

function plotTop3(data) {
  const areas = data.areas || [];
  const values = data.values || [];
  const trace = {
    x: areas,
    y: values,
    type: 'bar',
    marker: { color: '#1f77b4' },
    text: values.map(v => (v === null || v === undefined) ? '' : String(v)),
    textposition: 'outside',
    textfont: { size: 12 },
    cliponaxis: false,
    hoverinfo: 'x+y'
  };
  const layout = { 
    title: 'TOP 3 POR ÁREA', 
    margin: { t: 100, b: 250, l: 80, r: 80}, 
    yaxis: { automargin: true },
    xaxis: { 
      tickangle: -45, 
      automargin: true,
      tickfont: { size: 11 }
    },
    height: 580,
    bargap: 0.2
  };
  Plotly.newPlot('chart-top3', [trace], layout, {responsive: true, displayModeBar: false});
}

function plotTop3Class(data) {
  const classes = data.classes || [];
  const values = data.values || [];

  // Reutilizar el wrapText del chart de eventos
  function wrapText(s, maxChars) {
    if (!s) return '';
    const words = String(s).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length <= maxChars) {
        cur = (cur + ' ' + w).trim();
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.join('<br>');
  }
  const MAX_CHARS = 25; // Aumentado para mostrar más texto
  const wrapped = classes.map(e => wrapText(e, MAX_CHARS));
  const trace = {
    x: wrapped,
    y: values,
    type: 'bar',
    marker: { color: '#ff7f0e' },
    text: values.map(v => (v === null || v === undefined) ? '' : String(v)),
    textposition: 'outside',
    textfont: { size: 12 },
    cliponaxis: false,
    hoverinfo: 'text',
    hovertext: classes.map((e, i) => `${e}\nValor: ${values[i]}`)
  };
  const layout = {
    title: 'TOP 3 POR CLASE',
    margin: { t: 100, b: 350, l: 80, r: 80},
    xaxis: { 
      tickangle: -45, 
      automargin: true,
      tickfont: { size: 11 }
    },
    yaxis: { automargin: true },
    height: 650,
    bargap: 0.2
  };
  Plotly.newPlot('chart-top3class', [trace], layout, {responsive: true, displayModeBar: false});
}

// Nuevas funciones para gráficas temporales
async function fetchDowntimePerWeek(weeks = []) {
  const qs = new URLSearchParams();
  if (weeks.length) qs.set('weeks', weeks.join(','));
  const res = await fetch(`/downtime_per_week?${qs.toString()}`);
  return res.json();
}

async function fetchFrequencyPerMonth(months = []) {
  const qs = new URLSearchParams();
  if (months.length) qs.set('months', months.join(','));
  const res = await fetch(`/frequency_per_month?${qs.toString()}`);
  return res.json();
}

async function fetchDowntimePerMonth(months = []) {
  const qs = new URLSearchParams();
  if (months.length) qs.set('months', months.join(','));
  const res = await fetch(`/downtime_per_month?${qs.toString()}`);
  return res.json();
}

function plotDowntimePerWeek(data) {
  const weeks = data.weeks || [];
  const values = data.values || [];
  
  const trace = {
    x: weeks.map(w => `Semana ${w}`),
    y: values,
    type: 'bar',
    marker: { color: '#9467bd' },
    text: values.map(v => (v === null || v === undefined) ? '' : String(v)),
    textposition: 'outside',
    textfont: { size: 12 },
    cliponaxis: false,
    hoverinfo: 'x+y',
    name: 'Tiempo Muerto'
  };
  
  // Línea de target en 83
  const targetTrace = {
    x: weeks.map(w => `Semana ${w}`),
    y: Array(weeks.length).fill(83),
    type: 'scatter',
    mode: 'lines',
    name: 'Objetivo (83)',
    line: { color: 'red', width: 2, dash: 'dash' },
    hoverinfo: 'y'
  };
  
  // Calcular bargap dinámicamente según el número de barras
  let bargap = 0.3;
  if (weeks.length > 20) bargap = 0.1;
  else if (weeks.length > 10) bargap = 0.2;
  else if (weeks.length <= 5) bargap = 0.5;
  
  const layout = {
    title: 'TIEMPO MUERTO TI POR SEMANA',
    margin: { t: 100, b: 180, l: 80, r: 80 },
    xaxis: { 
      automargin: true,
      tickangle: -45,
      tickfont: { size: 10 }
    },
    yaxis: { automargin: true, title: 'Tiempo Muerto' },
    height: 540,
    bargap: bargap,
    showlegend: true,
    barmode: 'group'
  };
  
  Plotly.newPlot('chart-downtime-week', [trace, targetTrace], layout, {responsive: true, displayModeBar: false});
}

function plotFrequencyPerMonth(data) {
  const months = data.months || [];
  const values = data.values || [];
  
  // Formatear fechas: "2025-07" -> "Jul 2025"
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const formattedMonths = months.map(m => {
    const [year, month] = m.split('-');
    const monthIndex = parseInt(month) - 1;
    return `${monthNames[monthIndex]} ${year}`;
  });
  
  const trace = {
    x: formattedMonths,
    y: values,
    type: 'bar',
    marker: { color: '#8c564b' },
    text: values.map(v => (v === null || v === undefined) ? '' : String(v)),
    textposition: 'outside',
    textfont: { size: 12 },
    cliponaxis: false,
    hoverinfo: 'text',
    hovertext: months.map((m, i) => `${m}\nSoportes: ${values[i]}`),
    name: 'Número de soportes'
  };
  
  const layout = {
    title: 'FRECUENCIA DE INCIDENCIAS TI POR MES',
    margin: { t: 100, b: 180, l: 80, r: 80 },
    xaxis: { 
      automargin: true, 
      tickangle: -45,
      tickfont: { size: 10 }
    },
    yaxis: { automargin: true, title: 'Número de Soportes' },
    height: 540,
    bargap: 0.3,
    showlegend: true
  };
  
  Plotly.newPlot('chart-frequency-month', [trace], layout, {responsive: true, displayModeBar: false});
}

function plotDowntimePerMonth(data) {
  const months = data.months || [];
  const values = data.values || [];
  
  // Formatear fechas: "2025-07" -> "Jul 2025"
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const formattedMonths = months.map(m => {
    const [year, month] = m.split('-');
    const monthIndex = parseInt(month) - 1;
    return `${monthNames[monthIndex]} ${year}`;
  });
  
  const trace = {
    x: formattedMonths,
    y: values,
    type: 'bar',
    marker: { color: '#e377c2' },
    text: values.map(v => (v === null || v === undefined) ? '' : String(v)),
    textposition: 'outside',
    textfont: { size: 12 },
    cliponaxis: false,
    hoverinfo: 'text',
    hovertext: months.map((m, i) => `${m}\nDowntime: ${values[i]}`),
    name: 'Downtime total'
  };
  
  const layout = {
    title: 'TIEMPO MUERTO TI POR MES',
    margin: { t: 100, b: 180, l: 80, r: 80 },
    xaxis: { 
      automargin: true, 
      tickangle: -45,
      tickfont: { size: 10 }
    },
    yaxis: { automargin: true, title: 'Tiempo Muerto Total' },
    height: 540,
    bargap: 0.3,
    showlegend: true
  };
  
  Plotly.newPlot('chart-downtime-month', [trace], layout, {responsive: true, displayModeBar: false});
}

document.addEventListener('DOMContentLoaded', async () => {
  // cargar datos principales
  const data = await fetchBitacoraData();
  const columns = data.columns || [];
  const rows = data.rows || [];
  setBitacoraData(rows);

  const dateInput = document.getElementById('entry-date');
  const weekInput = document.getElementById('entry-week');
  let applyWeekFromDate = null;
  if (dateInput && weekInput) {
    applyWeekFromDate = () => setWeekNumberFromDateInputValue(dateInput.value, weekInput);
    dateInput.addEventListener('change', applyWeekFromDate);
    dateInput.addEventListener('input', applyWeekFromDate);
  }

  const tEsperaInput = document.getElementById('entry-t-espera');
  const tSolucionInput = document.getElementById('entry-t-solucion');
  const tMuertoInput = document.getElementById('entry-t-muerto');
  let updateMuerto = null;
  if (tEsperaInput && tSolucionInput && tMuertoInput) {
    updateMuerto = () => updateTiempoMuertoField(tEsperaInput, tSolucionInput, tMuertoInput);
    tEsperaInput.addEventListener('input', updateMuerto);
    tSolucionInput.addEventListener('input', updateMuerto);
  }

  const filterDateInput = document.getElementById('bitacora-filter-date');
  const showAllCheckbox = document.getElementById('bitacora-show-all');
  const handleFiltersChange = () => updateBitacoraFiltersFromInputs();
  if (filterDateInput) filterDateInput.addEventListener('input', handleFiltersChange);
  if (showAllCheckbox) showAllCheckbox.addEventListener('change', handleFiltersChange);

  // La UI principal (select-x/select-y/chart) puede haber sido removida.
  // Solo inicializamos los selectores y la gráfica principal si existen.
  const sx = document.getElementById('select-x');
  const sy = document.getElementById('select-y');
  const chartEl = document.getElementById('chart');
  if (sx && sy && chartEl) {
    const { x: dx, y: dy } = pickDefaultColumns(columns, rows);
    populateSelectors(columns, dx, dy);

    const plot = () => {
      const xKey = (document.getElementById('select-x') || {}).value;
      const yKey = (document.getElementById('select-y') || {}).value;
      const type = (document.getElementById('select-type') || {}).value || 'bar';
      const trace = toTrace(rows, xKey, yKey, type);
      const layout = { margin: { t: 30 }, title: `${yKey} vs ${xKey}` };
      Plotly.newPlot('chart', [trace], layout, {responsive: true});
    };

    const btnPlot = document.getElementById('btn-plot'); if (btnPlot) btnPlot.addEventListener('click', plot);
    plot();
  }

  // cargar meta y Top3
  let meta = { weeks: [], months: [], years: [], areas: [], classes: [] };
  try {
    meta = await fetchMeta();
  } catch (error) {
    console.error('Error al obtener metadatos', error);
  }
  if (meta.weeks && meta.weeks.length) {
    buildWeeksDropdown(meta.weeks, 'weeks-panel', 'weeks-toggle');
    buildWeeksDropdown(meta.weeks, 'weeksclass-panel', 'weeksclass-toggle');
    buildWeeksDropdown(meta.weeks, 'weeksevent-panel', 'weeksevent-toggle');
    buildWeeksDropdown(meta.weeks, 'weeksdowntime-panel', 'weeksdowntime-toggle');
  }
  if (meta.months && meta.months.length) {
    buildMonthsDropdown(meta.months, 'monthsfreq-panel', 'monthsfreq-toggle');
    buildMonthsDropdown(meta.months, 'monthsdowntime-panel', 'monthsdowntime-toggle');
  }
  populateReportForm(meta);
  populateBitacoraSelects(meta);
  updateBitacoraFiltersFromInputs();

  const bitacoraRefreshBtn = document.getElementById('bitacora-refresh-btn');
  if (bitacoraRefreshBtn) {
    bitacoraRefreshBtn.addEventListener('click', async () => {
      const originalText = bitacoraRefreshBtn.textContent;
      bitacoraRefreshBtn.disabled = true;
      bitacoraRefreshBtn.textContent = 'Actualizando...';
      try {
        await reloadBitacoraData({ updateMeta: true });
      } catch (error) {
        console.error('Error al actualizar la bitácora manualmente', error);
      } finally {
        bitacoraRefreshBtn.disabled = false;
        bitacoraRefreshBtn.textContent = originalText;
      }
    });
  }

  // Report form submission handler to show error without leaving page
  const reportForm = document.getElementById('report-form');
  if (reportForm) {
    reportForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const errorEl = document.getElementById('report-error');
      if (errorEl) errorEl.style.display = 'none';

      const weeksSelected = getCheckedValues('#report-weeks-panel', '.week-checkbox');
      const yearsSelected = getCheckedValues('#report-years-panel', '.year-checkbox');
      const monthsSelected = getCheckedValues('#report-months-panel', '.month-checkbox');

      const formData = new FormData();
      weeksSelected.forEach(val => formData.append('week', val));
      yearsSelected.forEach(val => formData.append('year', val));
      monthsSelected.forEach(val => formData.append('month', val));

      try {
        const response = await fetch('/generate_report', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          if (errorEl) errorEl.style.display = 'block';
          return;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'reporte_soporte_ti.pdf';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Error al generar el reporte', err);
        if (errorEl) errorEl.style.display = 'block';
      }
    });
  }

  const bitacoraForm = document.getElementById('bitacora-form');
  if (bitacoraForm) {
    bitacoraForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (applyWeekFromDate) applyWeekFromDate();
      if (updateMuerto) updateMuerto();
      const statusEl = document.getElementById('bitacora-status');
      if (statusEl) {
        statusEl.textContent = 'Guardando registro...';
        statusEl.className = 'bitacora-status';
      }

      const formData = new FormData(bitacoraForm);
      const payload = Object.fromEntries(formData.entries());

      try {
        const response = await fetch('/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: 'No se pudo guardar el registro.' }));
          if (statusEl) {
            statusEl.textContent = data.error || 'No se pudo guardar el registro.';
            statusEl.classList.add('error');
          }
          return;
        }

        const updatedMeta = await fetchMeta();
        populateReportForm(updatedMeta);
        populateBitacoraSelects(updatedMeta);

        const updatedData = await fetchBitacoraData();
        setBitacoraData((updatedData.rows || []));
        updateBitacoraFiltersFromInputs();

        // Refrescar gráficas para reflejar los datos nuevos
        plotTop3(await fetchTop3([], 3));
        plotTop3Class(await fetchTop3Class([], 3));
        plotTop3Event(await fetchTop3Event([], 3));
        plotDowntimePerWeek(await fetchDowntimePerWeek([]));
        plotFrequencyPerMonth(await fetchFrequencyPerMonth([]));
        plotDowntimePerMonth(await fetchDowntimePerMonth([]));

        bitacoraForm.reset();
        const today = new Date().toISOString().split('T')[0];
        if (dateInput) {
          dateInput.value = today;
          if (applyWeekFromDate) applyWeekFromDate();
        }
        if (updateMuerto) updateMuerto();

        if (statusEl) {
          statusEl.textContent = 'Registro guardado correctamente.';
          statusEl.classList.add('success');
        }
      } catch (error) {
        console.error('Error al guardar registro', error);
        if (statusEl) {
          statusEl.textContent = 'Ocurrió un error al guardar el registro.';
          statusEl.classList.add('error');
        }
      }
    });

    const today = new Date().toISOString().split('T')[0];
    if (dateInput) {
      dateInput.value = today;
      if (applyWeekFromDate) applyWeekFromDate();
    }
    if (updateMuerto) updateMuerto();
  }

  // Top 3 By Area
  document.getElementById('btn-top3').addEventListener('click', async () => {
    const panel = document.getElementById('weeks-panel');
    const checked = panel ? Array.from(panel.querySelectorAll('.week-checkbox:checked')).map(i => i.value) : [];
    const top = await fetchTop3(checked, 3);
    plotTop3(top);
    if (panel) panel.style.display = 'none';
  });
  const top0 = await fetchTop3([], 3);
  plotTop3(top0);

  // Top 3 By Class
  document.getElementById('btn-top3class').addEventListener('click', async () => {
    const panel = document.getElementById('weeksclass-panel');
    const checked = panel ? Array.from(panel.querySelectorAll('.week-checkbox:checked')).map(i => i.value) : [];
    const top = await fetchTop3Class(checked, 3);
    plotTop3Class(top);
    if (panel) panel.style.display = 'none';
  });
  const top0class = await fetchTop3Class([], 3);
  plotTop3Class(top0class);

  // Top 3 By Event/Problem Descripción
  document.getElementById('btn-top3event').addEventListener('click', async () => {
    const panel = document.getElementById('weeksevent-panel');
    const checked = panel ? Array.from(panel.querySelectorAll('.week-checkbox:checked')).map(i => i.value) : [];
    const top = await fetchTop3Event(checked, 3);
    plotTop3Event(top);
    if (panel) panel.style.display = 'none';
  });
  const top0event = await fetchTop3Event([], 3);
  plotTop3Event(top0event);

  // Downtime Per Week
  const btnDowntimeWeek = document.getElementById('btn-downtime-week');
  if (btnDowntimeWeek) {
    btnDowntimeWeek.addEventListener('click', async () => {
      const panel = document.getElementById('weeksdowntime-panel');
      const checked = panel ? Array.from(panel.querySelectorAll('.week-checkbox:checked')).map(i => i.value) : [];
      const data = await fetchDowntimePerWeek(checked);
      plotDowntimePerWeek(data);
      if (panel) panel.style.display = 'none';
    });
    const data0 = await fetchDowntimePerWeek([]);
    plotDowntimePerWeek(data0);
  }

  // Frequency Per Month
  const btnFrequencyMonth = document.getElementById('btn-frequency-month');
  if (btnFrequencyMonth) {
    btnFrequencyMonth.addEventListener('click', async () => {
      const panel = document.getElementById('monthsfreq-panel');
      const checked = panel ? Array.from(panel.querySelectorAll('.month-checkbox:checked')).map(i => i.value) : [];
      const data = await fetchFrequencyPerMonth(checked);
      plotFrequencyPerMonth(data);
      if (panel) panel.style.display = 'none';
    });
    const data0 = await fetchFrequencyPerMonth([]);
    plotFrequencyPerMonth(data0);
  }

  // Downtime Per Month
  const btnDowntimeMonth = document.getElementById('btn-downtime-month');
  if (btnDowntimeMonth) {
    btnDowntimeMonth.addEventListener('click', async () => {
      const panel = document.getElementById('monthsdowntime-panel');
      const checked = panel ? Array.from(panel.querySelectorAll('.month-checkbox:checked')).map(i => i.value) : [];
      const data = await fetchDowntimePerMonth(checked);
      plotDowntimePerMonth(data);
      if (panel) panel.style.display = 'none';
    });
    const data0 = await fetchDowntimePerMonth([]);
    plotDowntimePerMonth(data0);
  }

  // Checkbox "Seleccionar todos" en bitácora
  const selectAllCheckbox = document.getElementById('bitacora-select-all');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const checkboxes = document.querySelectorAll('.row-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
      });
      updateActionButtons();
    });
  }

  // Botones de editar y eliminar
  const editBtn = document.getElementById('bitacora-edit-btn');
  const deleteBtn = document.getElementById('bitacora-delete-btn');

  if (editBtn) {
    editBtn.addEventListener('click', () => {
      const selected = document.querySelector('.row-checkbox:checked');
      if (!selected) return;
      
      const tr = selected.closest('tr');
      const rowData = JSON.parse(tr.dataset.rowData);
      
      // Llenar el formulario de inserción con los datos del registro
      const dateInput = document.getElementById('entry-date');
      const weekInput = document.getElementById('entry-week');
      const shiftInput = document.getElementById('entry-shift');
      const areaInput = document.getElementById('entry-area');
      const classInput = document.getElementById('entry-class');
      const operatorInput = document.getElementById('entry-operator');
      const originInput = document.getElementById('entry-origin');
      const tEsperaInput = document.getElementById('entry-t-espera');
      const tSolucionInput = document.getElementById('entry-t-solucion');
      const tMuertoInput = document.getElementById('entry-t-muerto');
      const tMuertoTiInput = document.getElementById('entry-t-muerto-ti');
      const descriptionInput = document.getElementById('entry-description');
      
      if (dateInput) dateInput.value = normalizeBitacoraDate(rowData.FECHA) || '';
      if (weekInput) weekInput.value = rowData['WEEK#'] || '';
      if (shiftInput) shiftInput.value = rowData.SHIFT || '';
      if (areaInput) areaInput.value = rowData.AREA || '';
      if (classInput) classInput.value = rowData.CLASS || '';
      if (operatorInput) operatorInput.value = rowData['NOMBRE OPERADOR / USUARIOS'] || '';
      if (originInput) originInput.value = rowData.ORIGINADOR || '';
      if (tEsperaInput) tEsperaInput.value = rowData['T. ESPERA'] || '';
      if (tSolucionInput) tSolucionInput.value = rowData['T. SOLUCION'] || '';
      if (tMuertoInput) tMuertoInput.value = rowData['T. MUERTO'] || '';
      if (tMuertoTiInput) tMuertoTiInput.value = rowData['T. MUERTO TI'] || '';
      if (descriptionInput) descriptionInput.value = rowData['PROBLEM DESCRIPTION/SOLUTION'] || '';
      
      // Scroll al formulario
      document.getElementById('insertar').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const selectedCheckboxes = document.querySelectorAll('.row-checkbox:checked');
      if (selectedCheckboxes.length === 0) return;
      
      const confirmMessage = selectedCheckboxes.length === 1 
        ? '¿Estás seguro de eliminar este registro?' 
        : `¿Estás seguro de eliminar ${selectedCheckboxes.length} registros?`;
      
      if (!confirm(confirmMessage)) return;
      
      // Obtener los índices de las filas seleccionadas
      const rowIndices = Array.from(selectedCheckboxes).map(cb => {
        const tr = cb.closest('tr');
        return parseInt(tr.dataset.rowIndex);
      });
      
      try {
        const response = await fetch('/entries', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ indices: rowIndices })
        });
        
        const result = await response.json();
        
        if (response.ok) {
          // Forzar recarga completa sin caché
          const timestamp = Date.now();
          const dataRes = await fetch(`/data?_t=${timestamp}`);
          const freshData = await dataRes.json();
          setBitacoraData((freshData && freshData.rows) || []);
          
          // Actualizar metadatos
          const metaRes = await fetch(`/meta?_t=${timestamp}`);
          const freshMeta = await metaRes.json();
          populateBitacoraSelects(freshMeta);
          
          // Aplicar filtros actuales
          updateBitacoraFiltersFromInputs();
          
          alert(`✓ ${result.message || 'Registros eliminados correctamente'}`);
        } else {
          alert(`✗ Error: ${result.error || 'No se pudieron eliminar los registros'}`);
        }
      } catch (error) {
        console.error('Error al eliminar:', error);
        alert('✗ Error de conexión al eliminar los registros');
      }
    });
  }
});
async function fetchData(n = 200) {
  const res = await fetch(`/data?n=${n}`);
  return res.json();
}

async function fetchMeta() {
  const res = await fetch('/meta');
  return res.json();
}

async function fetchTop3(weeks = [], n = 3, agg = 'sum') {
  const qs = new URLSearchParams();
  if (weeks.length) qs.set('weeks', weeks.join(','));
  qs.set('n', String(n));
  qs.set('agg', agg);
  const res = await fetch(`/top3_by_area?${qs.toString()}`);
  return res.json();
}

function pickDefaultColumns(columns, rows) {
  let x = columns.includes('FECHA') ? 'FECHA' : columns[0];
  let y = null;
  if (rows.length > 0) {
    for (const c of columns) {
      const vals = rows.map(r => r[c]);
      if (vals.some(v => typeof v === 'number')) { y = c; break; }
      if (vals.every(v => v === '' || v === null || !isNaN(Number(v)))) { y = c; break; }
    }
  }
  if (!y) y = columns.length > 1 ? columns[1] : columns[0];
  return { x, y };
}

function toTrace(rows, xKey, yKey, type) {
  const x = rows.map(r => r[xKey]);
  const y = rows.map(r => {
    const v = r[yKey];
    const n = Number(v);
    return isNaN(n) ? null : n;
  });
  const trace = { x, y, type: type === 'bar' ? 'bar' : 'scatter', mode: 'lines+markers', name: yKey };
  return trace;
}

function populateSelectors(columns, defaultX, defaultY) {
  const sx = document.getElementById('select-x');
  const sy = document.getElementById('select-y');
  sx.innerHTML = '';
  sy.innerHTML = '';
  for (const c of columns) {
    const o1 = document.createElement('option'); o1.value = c; o1.textContent = c; if (c === defaultX) o1.selected = true;
    const o2 = document.createElement('option'); o2.value = c; o2.textContent = c; if (c === defaultY) o2.selected = true;
    sx.appendChild(o1);
    sy.appendChild(o2);
  }
}

function populateWeeks(weeks) {
  const sel = document.getElementById('select-weeks');
  sel.innerHTML = '';
  for (const w of weeks) {
    const o = document.createElement('option'); o.value = String(w); o.textContent = String(w);
    sel.appendChild(o);
  }
}

async function fetchData(n=200) {
  const res = await fetch(`/data?n=${n}`);
  return res.json();
}

function isNumericArray(arr) {
  return arr.every(v => v === null || v === undefined || typeof v === 'number');
}

function pickDefaultColumns(columns, rows) {
  // Prefer FECHA as x and a numeric column as y
  const colSet = new Set(columns);
  let x = columns.includes('FECHA') ? 'FECHA' : columns[0];
  let y = null;
  if (rows.length > 0) {
    for (const c of columns) {
      const vals = rows.map(r => r[c]);
      if (vals.some(v => typeof v === 'number')) { y = c; break; }
      // try numeric coercion
      if (vals.every(v => v === '' || v === null || !isNaN(Number(v)))) { y = c; break; }
    }
  }
  if (!y) y = columns.length > 1 ? columns[1] : columns[0];
  return {x,y};
}

function toTrace(rows, xKey, yKey, type) {
  const x = rows.map(r => r[xKey]);
  const y = rows.map(r => {
    const v = r[yKey];
    const n = Number(v);
    return isNaN(n) ? null : n;
  });
  const trace = { x, y, type: type === 'bar' ? 'bar' : 'scatter', mode: 'lines+markers', name: yKey };
  return trace;
}

