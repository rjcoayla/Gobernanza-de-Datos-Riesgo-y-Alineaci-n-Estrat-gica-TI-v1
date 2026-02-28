/**
 * GRC Mining Dashboard — js/app.js
 * Modelo de Gobernanza de Datos, Riesgo y Alineación Estratégica TI-Negocio
 * Datos simulados con fines de demostración.
 */

'use strict';

// ════════════════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════════════════
const state = {
  view: 'dashboard',          // 'dashboard' | 'explorer'
  focus: 'gobierno',          // 'gobierno' | 'riesgo' | 'alinea' | 'datos'
  filters: {
    fechaDesde: '',
    fechaHasta: '',
    areaTi: '',
    riesgo: '',
    prioridad: ''
  },
  data: {
    governance: [],
    quality: [],
    projects: [],
    policies: []
  },
  filtered: [],
  charts: {},
  explorer: {
    tab: 'governance',
    page: 1,
    pageSize: 10,
    search: ''
  }
};

// ════════════════════════════════════════════════════════════
//  DATA LOADING
// ════════════════════════════════════════════════════════════
async function loadAllData() {
  try {
    const [gov, dq, proj, pol] = await Promise.all([
      fetch('data/governance_risk_data.json').then(r => r.json()),
      fetch('data/data_quality.json').then(r => r.json()),
      fetch('data/projects_alignment.json').then(r => r.json()),
      fetch('data/policies_catalog.json').then(r => r.json())
    ]);
    state.data.governance = gov;
    state.data.quality     = dq;
    state.data.projects    = proj;
    state.data.policies    = pol;
    state.filtered         = [...gov];
    return true;
  } catch(e) {
    console.error('Error cargando datos:', e);
    return false;
  }
}

// ════════════════════════════════════════════════════════════
//  FILTERS
// ════════════════════════════════════════════════════════════
function applyFilters() {
  const f = state.filters;
  state.filtered = state.data.governance.filter(d => {
    if (f.fechaDesde && d.fecha < f.fechaDesde) return false;
    if (f.fechaHasta && d.fecha > f.fechaHasta) return false;
    if (f.areaTi     && d.area_ti.toLowerCase() !== f.areaTi.toLowerCase()) return false;
    if (f.riesgo     && d.riesgo.toLowerCase()  !== f.riesgo.toLowerCase())  return false;
    if (f.prioridad  && d.prioridad.toLowerCase() !== f.prioridad.toLowerCase()) return false;
    return true;
  });
}

function resetFilters() {
  state.filters = { fechaDesde:'', fechaHasta:'', areaTi:'', riesgo:'', prioridad:'' };
  document.getElementById('f-desde').value    = '';
  document.getElementById('f-hasta').value    = '';
  document.getElementById('f-area').value     = '';
  document.getElementById('f-riesgo').value   = '';
  document.getElementById('f-prioridad').value = '';
  applyFilters();
  renderAll();
}

// ════════════════════════════════════════════════════════════
//  KPI CALCULATIONS
// ════════════════════════════════════════════════════════════
function calcKPIs() {
  const d = state.filtered;
  if (!d.length) return { maturity:'N/A', politicas:'N/A', alineadas:'N/A', calidad:'N/A', altosRiesgos:0 };

  const avg  = arr => arr.reduce((s,v)=>s+v,0)/arr.length;

  const maturity   = avg(d.map(r=>r.maturity_cobit)).toFixed(1);
  const politicas  = avg(d.map(r=>r.porc_politicas_institucionalizadas)).toFixed(0);
  const alineadas  = avg(d.map(r=>r.porc_iniciativas_ti_alineadas)).toFixed(0);
  const calidad    = avg(state.data.quality.map(r=>r.calidad_datos_pct)).toFixed(0);
  const altosRiesgos = d.filter(r=>r.riesgo==='alto').length;

  return { maturity, politicas, alineadas, calidad, altosRiesgos };
}

function renderKPIs() {
  const k = calcKPIs();
  const total = state.filtered.length || 1;
  const altosMax = state.data.governance.length;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if(el) el.textContent = val;
  };

  set('kpi-maturity',    k.maturity   !== 'N/A' ? k.maturity   : '—');
  set('kpi-politicas',   k.politicas  !== 'N/A' ? k.politicas+'%' : '—');
  set('kpi-alineadas',   k.alineadas  !== 'N/A' ? k.alineadas+'%' : '—');
  set('kpi-calidad',     k.calidad    !== 'N/A' ? k.calidad+'%' : '—');
  set('kpi-riesgos',     k.altosRiesgos);

  // Barras de progreso
  setBar('bar-maturity',  (parseFloat(k.maturity)/5)*100);
  setBar('bar-politicas', parseFloat(k.politicas));
  setBar('bar-alineadas', parseFloat(k.alineadas));
  setBar('bar-calidad',   parseFloat(k.calidad));
  setBar('bar-riesgos',   (k.altosRiesgos/altosMax)*100, true);

  // Sub labels
  set('sub-maturity',  `${state.filtered.length} registros`);
  set('sub-riesgos',   `de ${state.filtered.length} evaluados`);
}

function setBar(id, pct, inverse=false) {
  const el = document.getElementById(id);
  if(!el) return;
  const safeVal = isNaN(pct) ? 0 : Math.min(100, Math.max(0, pct));
  el.style.width = safeVal + '%';
}

// ════════════════════════════════════════════════════════════
//  CHARTS — helpers
// ════════════════════════════════════════════════════════════
const COLORS = {
  cyan:   '#00d4ff',
  green:  '#00e17a',
  amber:  '#ffb700',
  red:    '#ff3d5a',
  blue:   '#4db8ff',
  purple: '#a78bfa',
  muted:  '#2a3149'
};

const chartDefaults = {
  font: { family: "'JetBrains Mono', monospace", size: 10 },
  color: '#7d8aaa'
};

Chart.defaults.color = chartDefaults.color;
Chart.defaults.font  = chartDefaults.font;

function destroyChart(key) {
  if(state.charts[key]) {
    state.charts[key].destroy();
    delete state.charts[key];
  }
}

// ════════════════════════════════════════════════════════════
//  CHART 1 — Madurez COBIT por dominio (Radar)
// ════════════════════════════════════════════════════════════
function buildChartMaturity() {
  destroyChart('maturity');
  const dominios = ['Planificar','Construir','Ejecutar','Monitorizar'];
  const avg = dom => {
    const subset = state.filtered.filter(d=>d.dominio_cobit===dom);
    if(!subset.length) return 0;
    return subset.reduce((s,d)=>s+d.maturity_cobit,0)/subset.length;
  };
  const values = dominios.map(avg);

  const ctx = document.getElementById('chart-maturity')?.getContext('2d');
  if(!ctx) return;

  state.charts.maturity = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: dominios,
      datasets: [{
        label: 'Madurez Promedio',
        data: values,
        borderColor: COLORS.cyan,
        backgroundColor: 'rgba(0,212,255,0.08)',
        pointBackgroundColor: COLORS.cyan,
        pointBorderColor: COLORS.cyan,
        pointRadius: 5,
        borderWidth: 2,
        fill: true
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        r: {
          min: 0, max: 5,
          ticks: { stepSize: 1, color: '#424e68', font:{size:9}, backdropColor:'transparent' },
          grid: { color: '#1f2535' },
          pointLabels: { color: '#7d8aaa', font:{size:10, family:"'JetBrains Mono', monospace"} },
          angleLines: { color: '#1f2535' }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `Madurez: ${ctx.raw.toFixed(2)}/5`
          }
        }
      }
    }
  });
}

// ════════════════════════════════════════════════════════════
//  CHART 2 — Controles efectivos vs planeados (Barras)
// ════════════════════════════════════════════════════════════
function buildChartControls() {
  destroyChart('controls');
  const areas = [...new Set(state.filtered.map(d=>d.area_ti))].sort();
  const efectivos = areas.map(a => {
    const s = state.filtered.filter(d=>d.area_ti===a);
    return s.reduce((acc,d)=>acc+d.controles_efectivos,0);
  });
  const planeados = areas.map(a => {
    const s = state.filtered.filter(d=>d.area_ti===a);
    return s.reduce((acc,d)=>acc+d.controles_planeados,0);
  });

  const ctx = document.getElementById('chart-controls')?.getContext('2d');
  if(!ctx) return;

  state.charts.controls = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: areas,
      datasets: [
        {
          label: 'Controles Efectivos',
          data: efectivos,
          backgroundColor: 'rgba(0,225,122,0.7)',
          borderColor: COLORS.green,
          borderWidth: 1,
          borderRadius: 3
        },
        {
          label: 'Controles Planeados',
          data: planeados,
          backgroundColor: 'rgba(0,212,255,0.15)',
          borderColor: COLORS.cyan,
          borderWidth: 1,
          borderRadius: 3
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#7d8aaa', font:{size:9}, boxWidth:10, padding:10 }
        }
      },
      scales: {
        x: { grid: { color: '#1f2535' }, ticks: { color: '#7d8aaa', font:{size:9} } },
        y: { grid: { color: '#1f2535' }, ticks: { color: '#7d8aaa', font:{size:9} } }
      }
    }
  });
}

// ════════════════════════════════════════════════════════════
//  CHART 3 — Calidad de datos por dominio (barras horizontales)
// ════════════════════════════════════════════════════════════
function buildChartQuality() {
  destroyChart('quality');
  const data = [...state.data.quality].sort((a,b)=>a.calidad_datos_pct-b.calidad_datos_pct);
  const labels = data.map(d=>d.dominio_datos);
  const values = data.map(d=>d.calidad_datos_pct);
  const colors = values.map(v =>
    v >= 90 ? 'rgba(0,225,122,0.7)' :
    v >= 80 ? 'rgba(0,212,255,0.6)' :
    v >= 70 ? 'rgba(255,183,0,0.7)' :
              'rgba(255,61,90,0.7)'
  );
  const borders = values.map(v =>
    v >= 90 ? COLORS.green : v >= 80 ? COLORS.cyan : v >= 70 ? COLORS.amber : COLORS.red
  );

  const ctx = document.getElementById('chart-quality')?.getContext('2d');
  if(!ctx) return;

  state.charts.quality = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Calidad (%)',
        data: values,
        backgroundColor: colors,
        borderColor: borders,
        borderWidth: 1,
        borderRadius: 3
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          min: 0, max: 100,
          grid: { color: '#1f2535' },
          ticks: { color: '#7d8aaa', font:{size:9}, callback: v => v+'%' }
        },
        y: { grid: { color: 'transparent' }, ticks: { color: '#7d8aaa', font:{size:9} } }
      }
    }
  });
}

// ════════════════════════════════════════════════════════════
//  CHART 4 — Proyectos TI vs impacto logrado (bubble-bar)
// ════════════════════════════════════════════════════════════
function buildChartProjects() {
  destroyChart('projects');
  const data   = state.data.projects.slice(0, 10);
  const labels = data.map(d => d.proyecto_ti.length > 22 ? d.proyecto_ti.slice(0,20)+'…' : d.proyecto_ti);
  const impact  = data.map(d=>d.impacto_logrado);
  const align   = data.map(d=>d.alineacion_score);

  const ctx = document.getElementById('chart-projects')?.getContext('2d');
  if(!ctx) return;

  state.charts.projects = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Impacto Logrado',
          data: impact,
          backgroundColor: 'rgba(167,139,250,0.7)',
          borderColor: COLORS.purple,
          borderWidth: 1,
          borderRadius: 3,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Score Alineación',
          data: align,
          borderColor: COLORS.amber,
          backgroundColor: 'rgba(255,183,0,0.1)',
          pointBackgroundColor: COLORS.amber,
          pointRadius: 4,
          borderWidth: 2,
          tension: 0.3,
          yAxisID: 'y'
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#7d8aaa', font:{size:9}, boxWidth:10, padding:10 }
        }
      },
      scales: {
        x: { grid:{color:'#1f2535'}, ticks:{color:'#7d8aaa',font:{size:9},maxRotation:35} },
        y: { min:0, max:100, grid:{color:'#1f2535'}, ticks:{color:'#7d8aaa',font:{size:9},callback:v=>v+'%'} }
      }
    }
  });
}

// ════════════════════════════════════════════════════════════
//  HEATMAP — Riesgo actual vs nivel aceptado
// ════════════════════════════════════════════════════════════
function buildHeatmap() {
  const container = document.getElementById('heatmap-grid');
  if(!container) return;

  // 5x5: eje X = riesgo_score (0-20,21-40,41-60,61-80,81-100)
  //       eje Y = nivel_riesgo_aceptado (mismo rango, invertido)
  const xLabels = ['0–20','21–40','41–60','61–80','81–100'];
  const yLabels = ['81–100','61–80','41–60','21–40','0–20'];
  const xRanges = [[0,20],[21,40],[41,60],[61,80],[81,100]];
  const yRanges = [[81,100],[61,80],[41,60],[21,40],[0,20]];

  const grid = Array.from({length:5},()=>Array(5).fill(0));
  const items = Array.from({length:5},()=>Array(5).fill([]));

  state.filtered.forEach(d => {
    const xi = xRanges.findIndex(([lo,hi])=>d.riesgo_score>=lo && d.riesgo_score<=hi);
    const yi = yRanges.findIndex(([lo,hi])=>d.nivel_riesgo_aceptado>=lo && d.nivel_riesgo_aceptado<=hi);
    if(xi>=0 && yi>=0) {
      grid[yi][xi]++;
      items[yi][xi] = [...items[yi][xi], d];
    }
  });

  const maxVal = Math.max(...grid.flat(), 1);

  let html = '';
  grid.forEach((row, ri) => {
    html += '<div class="hm-row">';
    row.forEach((val, ci) => {
      let cls='hm-empty', label='';
      if(val > 0) {
        label = val;
        // Determinar criticidad basada en posición en heatmap (diagonal peligrosa)
        const risk = ci + ri; // suma de índices: mayor = más crítico
        if(risk >= 6) cls = 'hm-critical';
        else if(risk >= 4) cls = 'hm-high';
        else if(risk >= 2) cls = 'hm-medium';
        else cls = 'hm-low';
      }
      const ids = val > 0 ? items[ri][ci].map(d=>d.id).join(', ') : '';
      html += `<div class="hm-cell ${cls}" title="Riesgo: ${xLabels[ci]} | Aceptado: ${yLabels[ri]} | Registros: ${val}${ids?' ('+ids+')':''}">${label || '·'}</div>`;
    });
    html += '</div>';
  });

  // X-axis labels
  html += '<div class="hm-x-labels">';
  xLabels.forEach(l => html += `<div class="hm-x-label">${l}</div>`);
  html += '</div>';

  container.innerHTML = html;

  // Y-axis labels
  const yContainer = document.getElementById('heatmap-y');
  if(yContainer) {
    yContainer.innerHTML = yLabels.map(l=>`<div class="hm-y-label">${l}</div>`).join('');
  }
}

// ════════════════════════════════════════════════════════════
//  BOTTOM TABLE — Decisiones y trazabilidad
// ════════════════════════════════════════════════════════════
function buildBottomTable() {
  const tbody = document.getElementById('table-body');
  if(!tbody) return;

  // Combinar datos de governance con projects para trazabilidad
  const merged = state.filtered.slice(0,15);

  tbody.innerHTML = merged.map(d => {
    const proj = state.data.projects.find(p=>p.area_ti===d.area_ti) || {};
    const pol  = state.data.policies.find(p=>p.area_ti===d.area_ti) || {};
    const rBadge = riesgoBadge(d.riesgo);
    const mBadge = maturityBadge(d.maturity_cobit);
    return `
      <tr>
        <td><span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted)">${d.id}</span></td>
        <td>${d.fecha}</td>
        <td>${d.area_ti}</td>
        <td>${d.dominio_cobit}</td>
        <td>${mBadge}</td>
        <td>${rBadge}</td>
        <td>
          <div style="width:80px;background:var(--border);border-radius:2px;height:4px;display:inline-block;vertical-align:middle;margin-right:5px">
            <div style="height:100%;width:${d.riesgo_score}%;background:${d.riesgo_score>60?'var(--red)':d.riesgo_score>35?'var(--amber)':'var(--green)'};border-radius:2px"></div>
          </div>
          <span style="font-family:var(--font-mono);font-size:11px">${d.riesgo_score}</span>
        </td>
        <td>${d.controles_efectivos}<span style="color:var(--text-muted)">/${d.controles_planeados}</span></td>
        <td>${pol.politica ? `<span class="badge badge-cyan">${pol.id||'—'}</span>` : '<span class="badge badge-muted">N/A</span>'}</td>
        <td>${prioridadBadge(d.prioridad)}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('table-count').textContent = `${state.filtered.length} registros`;
}

function riesgoBadge(r) {
  const m = {alto:'badge-red',medio:'badge-amber',bajo:'badge-green'};
  return `<span class="badge ${m[r]||'badge-muted'}">${r}</span>`;
}

function maturityBadge(v) {
  const colors = ['','badge-red','badge-amber','badge-amber','badge-green','badge-cyan'];
  return `<span class="badge ${colors[v]||'badge-muted'}">${v}/5</span>`;
}

function prioridadBadge(p) {
  const m = {alta:'badge-red',media:'badge-amber',baja:'badge-muted'};
  return `<span class="badge ${m[p]||'badge-muted'}">${p||'—'}</span>`;
}

// ════════════════════════════════════════════════════════════
//  DB EXPLORER
// ════════════════════════════════════════════════════════════
const DB_TABS = {
  governance: {
    name: 'Riesgo TI y Controles',
    file: 'governance_risk_data.json',
    key: 'governance',
    cols: [
      {key:'id',         label:'ID'},
      {key:'fecha',      label:'Fecha'},
      {key:'area_ti',    label:'Área TI'},
      {key:'dominio_cobit', label:'Dominio COBIT'},
      {key:'maturity_cobit', label:'Madurez',    render: v => maturityBadge(v)},
      {key:'riesgo',     label:'Riesgo',         render: v => riesgoBadge(v)},
      {key:'riesgo_score',label:'Score Riesgo',  render: v => `<span style="font-family:var(--font-mono)">${v}</span>`},
      {key:'nivel_riesgo_aceptado', label:'Nivel Aceptado'},
      {key:'controles_efectivos', label:'Controles Ef.'},
      {key:'controles_planeados', label:'Controles Plan.'},
      {key:'prioridad',  label:'Prioridad',      render: v => prioridadBadge(v)}
    ]
  },
  quality: {
    name: 'Calidad de Datos',
    file: 'data_quality.json',
    key: 'quality',
    cols: [
      {key:'id',          label:'ID'},
      {key:'dominio_datos',label:'Dominio'},
      {key:'sistema_origen',label:'Sistema Origen'},
      {key:'calidad_datos_pct', label:'Calidad %', render: v => qualityBar(v)},
      {key:'registros_total', label:'Registros', render:v=>v.toLocaleString('es')},
      {key:'registros_inconsistentes', label:'Inconsistentes', render:v=>`<span style="color:var(--amber)">${v.toLocaleString('es')}</span>`},
      {key:'completitud_pct', label:'Completitud'},
      {key:'precision_pct', label:'Precisión'},
      {key:'consistencia_pct', label:'Consistencia'},
      {key:'estado', label:'Estado', render: v => estadoBadge(v)},
      {key:'responsable', label:'Responsable'},
      {key:'ult_revision', label:'Últ. Revisión'}
    ]
  },
  projects: {
    name: 'Proyectos TI y Estrategia',
    file: 'projects_alignment.json',
    key: 'projects',
    cols: [
      {key:'id',           label:'ID'},
      {key:'proyecto_ti',  label:'Proyecto'},
      {key:'area_ti',      label:'Área TI'},
      {key:'objetivo_estrategico', label:'Objetivo Est.'},
      {key:'sponsor',      label:'Sponsor'},
      {key:'estado',       label:'Estado', render: v => estadoProyBadge(v)},
      {key:'impacto_logrado', label:'Impacto %', render: v => qualityBar(v)},
      {key:'alineacion_score', label:'Alineación', render: v => qualityBar(v)},
      {key:'presupuesto_musd', label:'Presup. MUSD', render: v=>`$${v}M`},
      {key:'prioridad',    label:'Prioridad', render: v => prioridadBadge(v)},
      {key:'fin_estimado', label:'Fin Est.'}
    ]
  },
  policies: {
    name: 'Catálogo de Políticas',
    file: 'policies_catalog.json',
    key: 'policies',
    cols: [
      {key:'id',          label:'ID'},
      {key:'politica',    label:'Política'},
      {key:'dominio',     label:'Dominio'},
      {key:'area_ti',     label:'Área TI'},
      {key:'version',     label:'Versión'},
      {key:'estado',      label:'Estado', render: v => estadoBadge(v)},
      {key:'nivel_institucionalizacion', label:'Institucional. %', render: v => qualityBar(v)},
      {key:'criticidad',  label:'Criticidad', render: v => prioridadBadge(v)},
      {key:'propietario', label:'Propietario'},
      {key:'fecha_aprobacion', label:'Aprobación'},
      {key:'ult_revision', label:'Últ. Revisión'}
    ]
  }
};

function qualityBar(v) {
  const color = v>=90 ? 'var(--green)' : v>=80 ? 'var(--cyan)' : v>=70 ? 'var(--amber)' : 'var(--red)';
  return `<div style="display:flex;align-items:center;gap:6px">
    <div style="width:60px;background:var(--border);border-radius:2px;height:4px">
      <div style="height:100%;width:${v}%;background:${color};border-radius:2px"></div>
    </div>
    <span style="font-family:var(--font-mono);font-size:11px;color:${color}">${v}%</span>
  </div>`;
}

function estadoBadge(v) {
  const m = {
    'vigente':      'badge-green',
    'conforme':     'badge-green',
    'en revisión':  'badge-amber',
    'observado':    'badge-amber',
    'no conforme':  'badge-red'
  };
  return `<span class="badge ${m[v]||'badge-muted'}">${v}</span>`;
}

function estadoProyBadge(v) {
  const m = {
    'completado':      'badge-green',
    'en ejecución':    'badge-cyan',
    'en planificación':'badge-blue',
    'pausado':         'badge-amber'
  };
  return `<span class="badge ${m[v]||'badge-muted'}">${v}</span>`;
}

function renderExplorerTable() {
  const tabKey  = state.explorer.tab;
  const tabDef  = DB_TABS[tabKey];
  const allData = state.data[tabDef.key] || [];

  // Búsqueda
  const q = state.explorer.search.toLowerCase();
  const filtered = q
    ? allData.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(q)))
    : allData;

  // Totales y paginación
  const total    = filtered.length;
  const pages    = Math.max(1, Math.ceil(total / state.explorer.pageSize));
  state.explorer.page = Math.min(state.explorer.page, pages);
  const start    = (state.explorer.page - 1) * state.explorer.pageSize;
  const pageData = filtered.slice(start, start + state.explorer.pageSize);

  // Actualizar cabecera
  document.getElementById('db-table-name').textContent = tabDef.name;
  document.getElementById('db-row-count').innerHTML = `<span>${total}</span> registros`;
  document.getElementById('db-file-name').textContent = `data/${tabDef.file}`;

  // Header de tabla
  const thead = document.getElementById('db-thead');
  if(thead) thead.innerHTML = `<tr>${tabDef.cols.map(c=>`<th>${c.label}</th>`).join('')}</tr>`;

  // Body de tabla
  const tbody = document.getElementById('db-tbody');
  if(tbody) {
    if(!pageData.length) {
      tbody.innerHTML = `<tr><td colspan="${tabDef.cols.length}" style="text-align:center;padding:32px;color:var(--text-muted);font-family:var(--font-mono);font-size:11px">Sin resultados para "${q}"</td></tr>`;
    } else {
      tbody.innerHTML = pageData.map(row => `
        <tr>
          ${tabDef.cols.map(c => {
            const val = row[c.key];
            const rendered = c.render ? c.render(val) : (val !== undefined ? String(val) : '—');
            return `<td>${rendered}</td>`;
          }).join('')}
        </tr>
      `).join('');
    }
  }

  // Paginación
  renderPagination(pages, total, start, pageData.length);
}

function renderPagination(pages, total, start, count) {
  const container = document.getElementById('db-pagination');
  if(!container) return;

  const cur = state.explorer.page;
  let html = '';

  html += `<span class="page-info">${start+1}–${start+count} de ${total}</span>`;
  html += `<button class="page-btn" id="p-prev" ${cur<=1?'disabled':''}>‹ Ant.</button>`;

  const range = pageRange(cur, pages);
  range.forEach(p => {
    if(p === '…') html += `<span class="page-info">…</span>`;
    else html += `<button class="page-btn ${p===cur?'active':''}" data-page="${p}">${p}</button>`;
  });

  html += `<button class="page-btn" id="p-next" ${cur>=pages?'disabled':''}>Sig. ›</button>`;
  container.innerHTML = html;

  container.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => { state.explorer.page = +btn.dataset.page; renderExplorerTable(); });
  });
  const prev = container.querySelector('#p-prev');
  const next = container.querySelector('#p-next');
  if(prev) prev.addEventListener('click', ()=>{ state.explorer.page--; renderExplorerTable(); });
  if(next) next.addEventListener('click', ()=>{ state.explorer.page++; renderExplorerTable(); });
}

function pageRange(cur, total) {
  if(total<=7) return Array.from({length:total},(_,i)=>i+1);
  const pages = [1];
  if(cur>3) pages.push('…');
  for(let i=Math.max(2,cur-1); i<=Math.min(total-1,cur+1); i++) pages.push(i);
  if(cur<total-2) pages.push('…');
  pages.push(total);
  return pages;
}

// ════════════════════════════════════════════════════════════
//  VIEW SWITCHING
// ════════════════════════════════════════════════════════════
function showView(view) {
  state.view = view;
  document.getElementById('dashboard-view').style.display = view==='dashboard' ? '' : 'none';
  document.getElementById('explorer-view').style.display  = view==='explorer'  ? 'flex' : 'none';
  document.getElementById('btn-dashboard').classList.toggle('active', view==='dashboard');
  document.getElementById('btn-explorer').classList.toggle('active',  view==='explorer');
  document.getElementById('filters-bar').style.display    = view==='dashboard' ? '' : 'none';
  if(view==='explorer') renderExplorerTable();
}

function switchExplorerTab(tab) {
  state.explorer.tab  = tab;
  state.explorer.page = 1;
  state.explorer.search = '';
  const searchEl = document.getElementById('db-search');
  if(searchEl) searchEl.value = '';
  document.querySelectorAll('.db-tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
  renderExplorerTable();
}

function setFocus(focus) {
  state.focus = focus;
  document.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', c.dataset.focus===focus);
  });
}

// ════════════════════════════════════════════════════════════
//  RENDER ALL (dashboard)
// ════════════════════════════════════════════════════════════
function renderAll() {
  renderKPIs();
  buildChartMaturity();
  buildChartControls();
  buildChartQuality();
  buildChartProjects();
  buildHeatmap();
  buildRiskSummary();
  buildBottomTable();
  document.getElementById('filter-count-val').textContent = state.filtered.length;
}

// Expose state globally for inline scripts
window.appState = state;

// ════════════════════════════════════════════════════════════
//  CLOCK
// ════════════════════════════════════════════════════════════
function startClock() {
  const el = document.getElementById('header-time');
  const update = () => {
    if(el) el.textContent = new Date().toLocaleString('es-PE', {
      year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit'
    });
  };
  update();
  setInterval(update, 1000);
}

// ════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ════════════════════════════════════════════════════════════
function bindEvents() {
  // Vista nav
  document.getElementById('btn-dashboard').addEventListener('click', ()=>showView('dashboard'));
  document.getElementById('btn-explorer').addEventListener('click',  ()=>showView('explorer'));

  // Focus chips
  document.querySelectorAll('.chip[data-focus]').forEach(chip => {
    chip.addEventListener('click', ()=>setFocus(chip.dataset.focus));
  });

  // Filtros
  ['f-desde','f-hasta','f-area','f-riesgo','f-prioridad'].forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('change', e => {
      const map = {'f-desde':'fechaDesde','f-hasta':'fechaHasta','f-area':'areaTi','f-riesgo':'riesgo','f-prioridad':'prioridad'};
      state.filters[map[id]] = e.target.value;
      applyFilters();
      renderAll();
    });
  });

  document.getElementById('btn-reset').addEventListener('click', resetFilters);

  // Explorer tabs
  document.querySelectorAll('.db-tab[data-tab]').forEach(tab => {
    tab.addEventListener('click', ()=>switchExplorerTab(tab.dataset.tab));
  });

  // Explorer search
  const searchEl = document.getElementById('db-search');
  if(searchEl) {
    let timer;
    searchEl.addEventListener('input', e => {
      clearTimeout(timer);
      timer = setTimeout(()=>{
        state.explorer.search = e.target.value;
        state.explorer.page   = 1;
        renderExplorerTable();
      }, 250);
    });
  }
}

// ════════════════════════════════════════════════════════════
//  RISK SUMMARY (panel lateral del heatmap)
// ════════════════════════════════════════════════════════════
function buildRiskSummary() {
  const container = document.getElementById('risk-summary');
  if(!container) return;
  const d = state.filtered;
  const areas = ['Seguridad','Operaciones','Datos','Infraestructura'];
  let html = '<div style="padding:0 4px">';
  areas.forEach(area => {
    const subset = d.filter(r=>r.area_ti===area);
    if(!subset.length) return;
    const altos  = subset.filter(r=>r.riesgo==='alto').length;
    const medios = subset.filter(r=>r.riesgo==='medio').length;
    const bajos  = subset.filter(r=>r.riesgo==='bajo').length;
    const total  = subset.length;
    html += `
      <div style="padding:12px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
          <span style="font-family:var(--font-display);font-size:14px;font-weight:600;letter-spacing:0.04em">${area}</span>
          <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted)">${total} reg.</span>
        </div>
        <div style="display:flex;gap:3px;height:8px;border-radius:4px;overflow:hidden">
          ${altos  ? `<div style="flex:${altos};background:var(--red);opacity:0.8"></div>`  : ''}
          ${medios ? `<div style="flex:${medios};background:var(--amber);opacity:0.8"></div>` : ''}
          ${bajos  ? `<div style="flex:${bajos};background:var(--green);opacity:0.7"></div>`  : ''}
        </div>
        <div style="display:flex;gap:12px;margin-top:6px">
          ${altos  ? `<span style="font-family:var(--font-mono);font-size:9px;color:var(--red)">▲ ${altos} alto${altos>1?'s':''}</span>` : ''}
          ${medios ? `<span style="font-family:var(--font-mono);font-size:9px;color:var(--amber)">◆ ${medios} medio${medios>1?'s':''}</span>` : ''}
          ${bajos  ? `<span style="font-family:var(--font-mono);font-size:9px;color:var(--green)">● ${bajos} bajo${bajos>1?'s':''}</span>` : ''}
        </div>
      </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

// ════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════
async function init() {
  startClock();
  const ok = await loadAllData();
  if(!ok) {
    document.getElementById('loading-overlay').innerHTML =
      '<p style="color:var(--red);font-family:var(--font-mono);font-size:13px">⚠ Error al cargar datos. Asegúrese de servir los archivos desde un servidor HTTP.</p>';
    return;
  }
  document.getElementById('loading-overlay')?.remove();
  bindEvents();
  showView('dashboard');
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
