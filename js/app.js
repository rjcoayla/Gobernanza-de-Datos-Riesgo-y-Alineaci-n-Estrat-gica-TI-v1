/**
 * GRC Mining Dashboard — js/app.js v2
 * Mayor dinamismo: focus modes, animaciones KPI, chart switching,
 * tema claro/oscuro. Datos simulados para demostración.
 */

'use strict';

// ═══════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════
const state = {
  view:    'dashboard',
  focus:   'gobierno',
  theme:   'dark',
  filters: { fechaDesde:'', fechaHasta:'', areaTi:'', riesgo:'', prioridad:'' },
  data:    { governance:[], quality:[], projects:[], policies:[] },
  filtered:[],
  charts:  {},
  explorer:{ tab:'governance', page:1, pageSize:10, search:'' }
};
window.appState = state;

// ═══════════════════════════════════════════════
//  FOCUS CONFIG — defines which panels highlight
//  and what chart data/variant to use per focus
// ═══════════════════════════════════════════════
const FOCUS_CONFIG = {
  gobierno: {
    label: 'MODO: Gobierno TI — Madurez COBIT y Políticas',
    highlight:  ['panel-maturity','panel-controls','kpi-0','kpi-1'],
    dim:        ['panel-quality','panel-projects','kpi-3'],
    chartMode:  'default'
  },
  riesgo: {
    label: 'MODO: Riesgo TI — Heatmap y Score de Riesgo',
    highlight:  ['heatmap-wrap','risk-right','kpi-4','panel-controls'],
    dim:        ['panel-maturity','panel-quality','kpi-1','kpi-2'],
    chartMode:  'risk'
  },
  alinea: {
    label: 'MODO: Alineación TI–Negocio — Proyectos Estratégicos',
    highlight:  ['panel-projects','kpi-2','kpi-1','panel-maturity'],
    dim:        ['heatmap-wrap','kpi-4','panel-quality'],
    chartMode:  'alignment'
  },
  datos: {
    label: 'MODO: Gobierno de Datos — Calidad y Cobertura',
    highlight:  ['panel-quality','kpi-3','kpi-2'],
    dim:        ['heatmap-wrap','risk-right','kpi-4','panel-controls'],
    chartMode:  'data'
  }
};

// ═══════════════════════════════════════════════
//  DATA LOADING
// ═══════════════════════════════════════════════
async function loadAllData() {
  try {
    const [gov, dq, proj, pol] = await Promise.all([
      fetch('data/governance_risk_data.json').then(r=>r.json()),
      fetch('data/data_quality.json').then(r=>r.json()),
      fetch('data/projects_alignment.json').then(r=>r.json()),
      fetch('data/policies_catalog.json').then(r=>r.json())
    ]);
    state.data.governance = gov;
    state.data.quality    = dq;
    state.data.projects   = proj;
    state.data.policies   = pol;
    state.filtered        = [...gov];
    return true;
  } catch(e) {
    console.error('Error cargando datos:', e);
    return false;
  }
}

// ═══════════════════════════════════════════════
//  FILTERS
// ═══════════════════════════════════════════════
function applyFilters() {
  const f = state.filters;
  state.filtered = state.data.governance.filter(d => {
    if (f.fechaDesde && d.fecha < f.fechaDesde) return false;
    if (f.fechaHasta && d.fecha > f.fechaHasta) return false;
    if (f.areaTi     && d.area_ti.toLowerCase()   !== f.areaTi.toLowerCase())   return false;
    if (f.riesgo     && d.riesgo.toLowerCase()    !== f.riesgo.toLowerCase())    return false;
    if (f.prioridad  && d.prioridad.toLowerCase() !== f.prioridad.toLowerCase()) return false;
    return true;
  });
}

function resetFilters() {
  state.filters = { fechaDesde:'', fechaHasta:'', areaTi:'', riesgo:'', prioridad:'' };
  ['f-desde','f-hasta','f-area','f-riesgo','f-prioridad'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  applyFilters();
  renderAll();
}

// ═══════════════════════════════════════════════
//  KPI CALCULATIONS
// ═══════════════════════════════════════════════
function calcKPIs() {
  const d  = state.filtered;
  const f  = state.focus;
  if (!d.length) return { maturity:'0.0', politicas:'0', alineadas:'0', calidad:'0', altosRiesgos:0 };

  const avg = arr => arr.length ? arr.reduce((s,v)=>s+v,0)/arr.length : 0;

  // Varía el KPI visible dependiendo del focus para más drama
  let maturity  = avg(d.map(r=>r.maturity_cobit)).toFixed(1);
  let politicas = avg(d.map(r=>r.porc_politicas_institucionalizadas)).toFixed(0);
  let alineadas = avg(d.map(r=>r.porc_iniciativas_ti_alineadas)).toFixed(0);
  let calidad   = avg(state.data.quality.map(r=>r.calidad_datos_pct)).toFixed(0);
  let altosRiesgos = d.filter(r=>r.riesgo==='alto').length;

  // En modo riesgo: maturity refleja el score de riesgo promedio
  if(f === 'riesgo') {
    maturity = (avg(d.map(r=>r.riesgo_score))/20).toFixed(1); // scale to 1-5
  }
  // En modo alinea: muestra impacto promedio de proyectos
  if(f === 'alinea') {
    const filt = state.data.projects.filter(p =>
      !state.filters.areaTi || p.area_ti.toLowerCase() === state.filters.areaTi.toLowerCase()
    );
    alineadas = avg(filt.map(p=>p.alineacion_score)).toFixed(0);
    calidad   = avg(filt.map(p=>p.impacto_logrado)).toFixed(0);
  }
  // En modo datos: solo stats de calidad
  if(f === 'datos') {
    const filt = state.data.quality;
    calidad   = avg(filt.map(q=>q.calidad_datos_pct)).toFixed(0);
    alineadas = avg(filt.map(q=>q.completitud_pct||90)).toFixed(0);
  }

  return { maturity, politicas, alineadas, calidad, altosRiesgos };
}

// ═══════════════════════════════════════════════
//  KPI RENDER with flip animation
// ═══════════════════════════════════════════════
const kpiPrev = {};

function animateKPI(id, newVal) {
  const el = document.getElementById(id);
  if (!el) return;
  if (kpiPrev[id] === newVal) return;
  kpiPrev[id] = newVal;
  el.classList.remove('animating');
  void el.offsetWidth; // reflow
  el.textContent = newVal;
  el.classList.add('animating');
  setTimeout(() => el.classList.remove('animating'), 500);
}

function renderKPIs() {
  const k = calcKPIs();
  const total = state.filtered.length || 1;
  const max   = state.data.governance.length || 1;

  animateKPI('kpi-maturity',  k.maturity);
  animateKPI('kpi-politicas', k.politicas+'%');
  animateKPI('kpi-alineadas', k.alineadas+'%');
  animateKPI('kpi-calidad',   k.calidad+'%');
  animateKPI('kpi-riesgos',   String(k.altosRiesgos));

  setBar('bar-maturity',  (parseFloat(k.maturity)/5)*100);
  setBar('bar-politicas', parseFloat(k.politicas));
  setBar('bar-alineadas', parseFloat(k.alineadas));
  setBar('bar-calidad',   parseFloat(k.calidad));
  setBar('bar-riesgos',   (k.altosRiesgos/max)*100);

  const el = document.getElementById('sub-maturity');
  if(el) el.textContent = `${state.filtered.length} de ${max} registros`;
  const el2 = document.getElementById('sub-riesgos');
  if(el2) el2.textContent = `de ${state.filtered.length} evaluados`;

  document.getElementById('filter-count-val').textContent = state.filtered.length;
}

function setBar(id, pct) {
  const el = document.getElementById(id);
  if(!el) return;
  el.style.width = Math.min(100, Math.max(0, isNaN(pct)?0:pct)) + '%';
}

// ═══════════════════════════════════════════════
//  CHART COLORS / HELPERS
// ═══════════════════════════════════════════════
function getThemeColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    cyan:   s.getPropertyValue('--cyan').trim()   || '#00d4ff',
    green:  s.getPropertyValue('--green').trim()  || '#00e17a',
    amber:  s.getPropertyValue('--amber').trim()  || '#ffb700',
    red:    s.getPropertyValue('--red').trim()    || '#ff3d5a',
    blue:   s.getPropertyValue('--blue').trim()   || '#4db8ff',
    purple: s.getPropertyValue('--purple').trim() || '#a78bfa',
    accent: s.getPropertyValue('--accent').trim() || '#00d4ff',
    grid:   s.getPropertyValue('--border').trim() || '#1f2535',
    text:   s.getPropertyValue('--text-secondary').trim() || '#7d8aaa',
    mutedText: s.getPropertyValue('--text-muted').trim() || '#424e68',
  };
}

function destroyChart(key) {
  if(state.charts[key]) { state.charts[key].destroy(); delete state.charts[key]; }
}

function flashPanel(canvasId) {
  const wrap = document.getElementById(canvasId)?.closest('.chart-wrap');
  if(wrap) {
    wrap.classList.add('chart-updating');
    setTimeout(()=>wrap.classList.remove('chart-updating'), 400);
  }
}

// ═══════════════════════════════════════════════
//  CHART 1 — MATURITY (Radar default | Bar risk)
// ═══════════════════════════════════════════════
function buildChartMaturity() {
  destroyChart('maturity');
  flashPanel('chart-maturity');
  const C = getThemeColors();
  const mode = FOCUS_CONFIG[state.focus].chartMode;
  const ctx  = document.getElementById('chart-maturity')?.getContext('2d');
  if(!ctx) return;

  const dominios = ['Planificar','Construir','Ejecutar','Monitorizar'];
  const avg = dom => {
    const s = state.filtered.filter(d=>d.dominio_cobit===dom);
    return s.length ? s.reduce((a,d)=>a+d.maturity_cobit,0)/s.length : 0;
  };

  if(mode === 'risk') {
    // En modo riesgo: muestra score de riesgo promedio por dominio
    const avgRisk = dom => {
      const s = state.filtered.filter(d=>d.dominio_cobit===dom);
      return s.length ? s.reduce((a,d)=>a+d.riesgo_score,0)/s.length : 0;
    };
    state.charts.maturity = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dominios,
        datasets: [{
          label: 'Score Riesgo Promedio',
          data: dominios.map(avgRisk),
          backgroundColor: dominios.map(d=>{
            const v = avgRisk(d);
            return v>60?'rgba(255,61,90,0.7)':v>35?'rgba(255,183,0,0.7)':'rgba(0,225,122,0.7)';
          }),
          borderColor: dominios.map(d=>{
            const v = avgRisk(d); return v>60?C.red:v>35?C.amber:C.green;
          }),
          borderWidth:1, borderRadius:4
        }]
      },
      options: baseBarOpts(C, 0, 100, v=>v.toFixed(0))
    });
  } else {
    state.charts.maturity = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: dominios,
        datasets: [{
          label: 'Madurez',
          data: dominios.map(avg),
          borderColor: C.accent,
          backgroundColor: hexAlpha(C.accent, 0.08),
          pointBackgroundColor: C.accent,
          pointBorderColor: C.accent,
          pointRadius: 5, borderWidth: 2, fill: true
        }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        scales: {
          r: {
            min:0, max:5,
            ticks: { stepSize:1, color:C.mutedText, font:{size:9}, backdropColor:'transparent' },
            grid: { color: C.grid },
            pointLabels: { color: C.text, font:{size:10, family:"'JetBrains Mono'"} },
            angleLines: { color: C.grid }
          }
        },
        plugins: {
          legend: { display:false },
          tooltip: { callbacks: { label: c=>`Madurez: ${c.raw.toFixed(2)}/5` } }
        },
        animation: { duration: 600, easing:'easeInOutQuart' }
      }
    });
  }
}

// ═══════════════════════════════════════════════
//  CHART 2 — CONTROLS (Bar default | Pie risk | Scatter align)
// ═══════════════════════════════════════════════
function buildChartControls() {
  destroyChart('controls');
  flashPanel('chart-controls');
  const C    = getThemeColors();
  const mode = FOCUS_CONFIG[state.focus].chartMode;
  const ctx  = document.getElementById('chart-controls')?.getContext('2d');
  if(!ctx) return;

  const areas = [...new Set(state.filtered.map(d=>d.area_ti))].sort();

  if(mode === 'risk') {
    // Doughnut: distribución de niveles de riesgo
    const altos  = state.filtered.filter(d=>d.riesgo==='alto').length;
    const medios = state.filtered.filter(d=>d.riesgo==='medio').length;
    const bajos  = state.filtered.filter(d=>d.riesgo==='bajo').length;
    state.charts.controls = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Alto','Medio','Bajo'],
        datasets: [{
          data: [altos, medios, bajos],
          backgroundColor: ['rgba(255,61,90,0.75)','rgba(255,183,0,0.75)','rgba(0,225,122,0.75)'],
          borderColor:     [C.red, C.amber, C.green],
          borderWidth: 2, hoverOffset: 8
        }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins: {
          legend: { position:'bottom', labels:{color:C.text, font:{size:9}, padding:10, boxWidth:10} },
          tooltip: { callbacks: { label: c=>`${c.label}: ${c.raw} registros` } }
        },
        animation: { duration:700, easing:'easeInOutBack' }
      }
    });

  } else if(mode === 'alignment') {
    // Horizontal bar: score de alineación por proyecto
    const projs = state.data.projects.slice(0,8);
    const labels= projs.map(p=>p.proyecto_ti.slice(0,18)+'…');
    state.charts.controls = new Chart(ctx, {
      type:'bar',
      data:{
        labels,
        datasets:[{
          label:'Score Alineación',
          data: projs.map(p=>p.alineacion_score),
          backgroundColor: projs.map(p=>p.alineacion_score>=85?'rgba(0,225,122,0.7)':'rgba(0,212,255,0.6)'),
          borderColor:     projs.map(p=>p.alineacion_score>=85?C.green:C.cyan),
          borderWidth:1, borderRadius:4
        }]
      },
      options: { ...baseBarOpts(C,0,100,v=>v+'%'), indexAxis:'y' }
    });

  } else {
    // Default: controles efectivos vs planeados
    const ef  = areas.map(a => state.filtered.filter(d=>d.area_ti===a).reduce((s,d)=>s+d.controles_efectivos,0));
    const pl  = areas.map(a => state.filtered.filter(d=>d.area_ti===a).reduce((s,d)=>s+d.controles_planeados,0));
    state.charts.controls = new Chart(ctx, {
      type:'bar',
      data:{
        labels: areas,
        datasets:[
          { label:'Controles Efectivos', data:ef, backgroundColor:'rgba(0,225,122,0.7)', borderColor:C.green, borderWidth:1, borderRadius:3 },
          { label:'Controles Planeados', data:pl, backgroundColor:'rgba(0,212,255,0.15)', borderColor:C.cyan, borderWidth:1, borderRadius:3 }
        ]
      },
      options:{
        ...baseBarOpts(C),
        plugins:{ legend:{ display:true, position:'top', labels:{color:C.text,font:{size:9},boxWidth:10,padding:10} } }
      }
    });
  }
}

// ═══════════════════════════════════════════════
//  CHART 3 — DATA QUALITY
// ═══════════════════════════════════════════════
function buildChartQuality() {
  destroyChart('quality');
  flashPanel('chart-quality');
  const C    = getThemeColors();
  const mode = FOCUS_CONFIG[state.focus].chartMode;
  const ctx  = document.getElementById('chart-quality')?.getContext('2d');
  if(!ctx) return;

  if(mode === 'data') {
    // Grouped bar: completitud, precisión, consistencia
    const items  = [...state.data.quality].sort((a,b)=>a.calidad_datos_pct-b.calidad_datos_pct);
    const labels = items.map(d=>d.dominio_datos.slice(0,10));
    state.charts.quality = new Chart(ctx, {
      type:'bar',
      data:{
        labels,
        datasets:[
          { label:'Completitud',   data:items.map(d=>d.completitud_pct),  backgroundColor:'rgba(0,212,255,0.65)', borderColor:C.cyan,  borderWidth:1, borderRadius:2 },
          { label:'Precisión',     data:items.map(d=>d.precision_pct),    backgroundColor:'rgba(0,225,122,0.65)', borderColor:C.green, borderWidth:1, borderRadius:2 },
          { label:'Consistencia',  data:items.map(d=>d.consistencia_pct), backgroundColor:'rgba(167,139,250,0.65)',borderColor:C.purple,borderWidth:1, borderRadius:2 }
        ]
      },
      options:{
        ...baseBarOpts(C,50,100,v=>v+'%'),
        plugins:{ legend:{ display:true, position:'top', labels:{color:C.text,font:{size:9},boxWidth:8,padding:8} } }
      }
    });
  } else {
    // Default: horizontal bar calidad overall
    const items  = [...state.data.quality].sort((a,b)=>a.calidad_datos_pct-b.calidad_datos_pct);
    const labels = items.map(d=>d.dominio_datos);
    const vals   = items.map(d=>d.calidad_datos_pct);
    const colors = vals.map(v=>v>=90?'rgba(0,225,122,0.7)':v>=80?'rgba(0,212,255,0.6)':v>=70?'rgba(255,183,0,0.7)':'rgba(255,61,90,0.7)');
    const bColors= vals.map(v=>v>=90?C.green:v>=80?C.cyan:v>=70?C.amber:C.red);
    state.charts.quality = new Chart(ctx, {
      type:'bar',
      data:{ labels, datasets:[{ label:'Calidad %', data:vals, backgroundColor:colors, borderColor:bColors, borderWidth:1, borderRadius:3 }] },
      options:{ ...baseBarOpts(C,0,100,v=>v+'%'), indexAxis:'y', plugins:{ legend:{display:false} } }
    });
  }
}

// ═══════════════════════════════════════════════
//  CHART 4 — PROJECTS
// ═══════════════════════════════════════════════
function buildChartProjects() {
  destroyChart('projects');
  flashPanel('chart-projects');
  const C    = getThemeColors();
  const mode = FOCUS_CONFIG[state.focus].chartMode;
  const ctx  = document.getElementById('chart-projects')?.getContext('2d');
  if(!ctx) return;

  if(mode === 'data') {
    // Pie: estado de conformidad de datos
    const conforme   = state.data.quality.filter(q=>q.estado==='conforme').length;
    const observado  = state.data.quality.filter(q=>q.estado==='observado').length;
    const noConf     = state.data.quality.filter(q=>q.estado==='no conforme').length;
    state.charts.projects = new Chart(ctx, {
      type:'pie',
      data:{
        labels:['Conforme','Observado','No Conforme'],
        datasets:[{
          data:[conforme,observado,noConf],
          backgroundColor:['rgba(0,225,122,0.75)','rgba(255,183,0,0.75)','rgba(255,61,90,0.75)'],
          borderColor:[C.green,C.amber,C.red], borderWidth:2, hoverOffset:10
        }]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{position:'bottom',labels:{color:C.text,font:{size:9},padding:10,boxWidth:10}} },
        animation:{ duration:700, easing:'easeInOutBack' }
      }
    });

  } else if(mode === 'risk') {
    // Scatter: riesgo_score vs nivel_riesgo_aceptado por área
    const areaColors = { Seguridad:C.red, Operaciones:C.amber, Datos:C.green, Infraestructura:C.blue };
    const areas = [...new Set(state.filtered.map(d=>d.area_ti))];
    state.charts.projects = new Chart(ctx, {
      type:'scatter',
      data:{
        datasets: areas.map(area => ({
          label: area,
          data: state.filtered.filter(d=>d.area_ti===area).map(d=>({x:d.nivel_riesgo_aceptado, y:d.riesgo_score})),
          backgroundColor: hexAlpha(areaColors[area]||C.cyan, 0.7),
          borderColor: areaColors[area]||C.cyan,
          pointRadius: 7, pointHoverRadius: 10
        }))
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        scales:{
          x:{ min:0,max:100, title:{display:true,text:'Nivel Aceptado',color:C.mutedText,font:{size:9}}, grid:{color:C.grid}, ticks:{color:C.mutedText,font:{size:9}} },
          y:{ min:0,max:100, title:{display:true,text:'Score Riesgo',color:C.mutedText,font:{size:9}}, grid:{color:C.grid}, ticks:{color:C.mutedText,font:{size:9}} }
        },
        plugins:{ legend:{display:true,position:'top',labels:{color:C.text,font:{size:9},boxWidth:8,padding:8}} },
        animation:{ duration:600 }
      }
    });

  } else {
    // Default / alignment: bar + line
    const data   = state.data.projects.slice(0,10);
    const labels = data.map(d=>d.proyecto_ti.length>22?d.proyecto_ti.slice(0,20)+'…':d.proyecto_ti);
    state.charts.projects = new Chart(ctx, {
      type:'bar',
      data:{
        labels,
        datasets:[
          { label:'Impacto Logrado',  data:data.map(d=>d.impacto_logrado),  backgroundColor:'rgba(167,139,250,0.7)', borderColor:C.purple, borderWidth:1, borderRadius:3 },
          { type:'line', label:'Score Alineación', data:data.map(d=>d.alineacion_score), borderColor:C.amber, backgroundColor:hexAlpha(C.amber,0.08), pointBackgroundColor:C.amber, pointRadius:4, borderWidth:2, tension:0.3, yAxisID:'y' }
        ]
      },
      options:{
        ...baseBarOpts(C,0,100,v=>v+'%'),
        plugins:{ legend:{ display:true, position:'top', labels:{color:C.text,font:{size:9},boxWidth:10,padding:10} } }
      }
    });
  }
}

// ═══════════════════════════════════════════════
//  BASE CHART OPTIONS
// ═══════════════════════════════════════════════
function baseBarOpts(C, yMin=undefined, yMax=undefined, tickCb=undefined) {
  const yOpts = { grid:{color:C.grid}, ticks:{color:C.mutedText,font:{size:9}} };
  if(yMin !== undefined) yOpts.min = yMin;
  if(yMax !== undefined) yOpts.max = yMax;
  if(tickCb) yOpts.ticks.callback = tickCb;
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{display:false} },
    scales:{
      x:{ grid:{color:C.grid}, ticks:{color:C.mutedText,font:{size:9},maxRotation:35} },
      y: yOpts
    },
    animation:{ duration:600, easing:'easeInOutQuart' }
  };
}

function hexAlpha(hex, alpha) {
  // handles both hex and rgb strings
  if(hex.startsWith('#')) {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return hex.replace('rgb(','rgba(').replace(')',`,${alpha})`);
}

// ═══════════════════════════════════════════════
//  HEATMAP
// ═══════════════════════════════════════════════
function buildHeatmap() {
  const container = document.getElementById('heatmap-grid');
  if(!container) return;

  const xLabels = ['0–20','21–40','41–60','61–80','81–100'];
  const yLabels = ['81–100','61–80','41–60','21–40','0–20'];
  const xRanges = [[0,20],[21,40],[41,60],[61,80],[81,100]];
  const yRanges = [[81,100],[61,80],[41,60],[21,40],[0,20]];

  const grid = Array.from({length:5},()=>Array(5).fill(0));
  state.filtered.forEach(d => {
    const xi = xRanges.findIndex(([lo,hi])=>d.riesgo_score>=lo&&d.riesgo_score<=hi);
    const yi = yRanges.findIndex(([lo,hi])=>d.nivel_riesgo_aceptado>=lo&&d.nivel_riesgo_aceptado<=hi);
    if(xi>=0&&yi>=0) grid[yi][xi]++;
  });

  let html = '';
  grid.forEach((row, ri) => {
    html += '<div class="hm-row">';
    row.forEach((val, ci) => {
      let cls='hm-empty', label='';
      if(val>0) {
        label=val;
        const risk=ci+ri;
        cls = risk>=6?'hm-critical':risk>=4?'hm-high':risk>=2?'hm-medium':'hm-low';
      }
      const delay = (ri*5+ci)*30;
      html += `<div class="hm-cell ${cls} entering" style="animation-delay:${delay}ms" title="Riesgo Score: ${xLabels[ci]} | Nivel Aceptado: ${yLabels[ri]} | Registros: ${val}">${label||'·'}</div>`;
    });
    html += '</div>';
  });

  html += '<div class="hm-x-labels">';
  xLabels.forEach(l=>html+=`<div class="hm-x-label">${l}</div>`);
  html += '</div>';
  container.innerHTML = html;

  const yEl = document.getElementById('heatmap-y');
  if(yEl) yEl.innerHTML = yLabels.map(l=>`<div class="hm-y-label">${l}</div>`).join('');
}

// ═══════════════════════════════════════════════
//  RISK SUMMARY PANEL
// ═══════════════════════════════════════════════
function buildRiskSummary() {
  const container = document.getElementById('risk-summary');
  if(!container) return;
  const d = state.filtered;
  const areas = ['Seguridad','Operaciones','Datos','Infraestructura'];
  let html = '<div style="padding:0 4px">';
  areas.forEach(area => {
    const subset = d.filter(r=>r.area_ti===area);
    if(!subset.length) { html += `<div style="padding:10px 0;border-bottom:1px solid var(--border);opacity:0.35"><span style="font-family:var(--font-display);font-size:13px;color:var(--text-muted)">${area} — sin datos</span></div>`; return; }
    const altos  = subset.filter(r=>r.riesgo==='alto').length;
    const medios = subset.filter(r=>r.riesgo==='medio').length;
    const bajos  = subset.filter(r=>r.riesgo==='bajo').length;
    const avgScore = (subset.reduce((s,d)=>s+d.riesgo_score,0)/subset.length).toFixed(0);
    html += `
      <div style="padding:11px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-family:var(--font-display);font-size:14px;font-weight:700;letter-spacing:0.04em">${area}</span>
          <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);background:var(--bg-card);padding:1px 7px;border-radius:3px;border:1px solid var(--border)">Score avg: ${avgScore}</span>
        </div>
        <div style="display:flex;gap:3px;height:8px;border-radius:4px;overflow:hidden">
          ${altos ?`<div style="flex:${altos};background:var(--red);opacity:0.8;transition:flex 0.7s ease"></div>`:''}
          ${medios?`<div style="flex:${medios};background:var(--amber);opacity:0.8;transition:flex 0.7s ease"></div>`:''}
          ${bajos ?`<div style="flex:${bajos};background:var(--green);opacity:0.75;transition:flex 0.7s ease"></div>`:''}
        </div>
        <div style="display:flex;gap:10px;margin-top:6px">
          ${altos ?`<span style="font-family:var(--font-mono);font-size:9px;color:var(--red)">▲ ${altos} alto</span>`:''}
          ${medios?`<span style="font-family:var(--font-mono);font-size:9px;color:var(--amber)">◆ ${medios} medio</span>`:''}
          ${bajos ?`<span style="font-family:var(--font-mono);font-size:9px;color:var(--green)">● ${bajos} bajo</span>`:''}
        </div>
      </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

// ═══════════════════════════════════════════════
//  BOTTOM TABLE
// ═══════════════════════════════════════════════
function buildBottomTable() {
  const tbody = document.getElementById('table-body');
  if(!tbody) return;

  // En modo alinea: muestra proyectos; en modo datos: calidad; else: governance
  if(state.focus === 'alinea') {
    buildProjectsTable(tbody);
  } else if(state.focus === 'datos') {
    buildQualityTable(tbody);
  } else {
    buildGovernanceTable(tbody);
  }
  const tc = document.getElementById('table-count');
  if(tc) tc.textContent = `${state.filtered.length} registros`;
}

function buildGovernanceTable(tbody) {
  const rows = state.filtered.slice(0,12);
  tbody.innerHTML = rows.map((d,i) => {
    const pol = state.data.policies.find(p=>p.area_ti===d.area_ti)||{};
    return `<tr style="animation-delay:${i*30}ms">
      <td><span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted)">${d.id}</span></td>
      <td>${d.fecha}</td>
      <td>${d.area_ti}</td>
      <td>${d.dominio_cobit}</td>
      <td>${maturityBadge(d.maturity_cobit)}</td>
      <td>${riesgoBadge(d.riesgo)}</td>
      <td>
        <div style="width:70px;background:var(--border);border-radius:2px;height:4px;display:inline-block;vertical-align:middle;margin-right:5px">
          <div style="height:100%;width:${d.riesgo_score}%;background:${d.riesgo_score>60?'var(--red)':d.riesgo_score>35?'var(--amber)':'var(--green)'};border-radius:2px;transition:width 0.8s ease"></div>
        </div>
        <span style="font-family:var(--font-mono);font-size:11px">${d.riesgo_score}</span>
      </td>
      <td>${d.controles_efectivos}<span style="color:var(--text-muted)">/${d.controles_planeados}</span></td>
      <td>${pol.id?`<span class="badge badge-cyan">${pol.id}</span>`:'<span class="badge badge-muted">N/A</span>'}</td>
      <td>${prioridadBadge(d.prioridad)}</td>
    </tr>`;
  }).join('');
}

function buildProjectsTable(tbody) {
  const rows = state.data.projects.slice(0,10);
  tbody.innerHTML = rows.map((p,i) => `
    <tr style="animation-delay:${i*30}ms">
      <td><span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted)">${p.id}</span></td>
      <td>${p.proyecto_ti}</td>
      <td>${p.area_ti}</td>
      <td>${p.objetivo_estrategico}</td>
      <td>${estadoProyBadge(p.estado)}</td>
      <td>${qualityInline(p.impacto_logrado)}</td>
      <td>${qualityInline(p.alineacion_score)}</td>
      <td>$${p.presupuesto_musd}M</td>
      <td>${prioridadBadge(p.prioridad)}</td>
    </tr>
  `).join('');
}

function buildQualityTable(tbody) {
  const rows = state.data.quality;
  tbody.innerHTML = rows.map((q,i) => `
    <tr style="animation-delay:${i*30}ms">
      <td><span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted)">${q.id}</span></td>
      <td>${q.dominio_datos}</td>
      <td>${q.sistema_origen}</td>
      <td>${qualityInline(q.calidad_datos_pct)}</td>
      <td>${q.registros_total.toLocaleString('es')}</td>
      <td><span style="color:var(--amber);font-family:var(--font-mono)">${q.registros_inconsistentes.toLocaleString('es')}</span></td>
      <td>${estadoBadge(q.estado)}</td>
      <td>${q.responsable}</td>
      <td>${q.ult_revision}</td>
    </tr>
  `).join('');
}

function qualityInline(v) {
  const c=v>=90?'var(--green)':v>=80?'var(--cyan)':v>=70?'var(--amber)':'var(--red)';
  return `<div style="display:flex;align-items:center;gap:6px">
    <div style="width:55px;background:var(--border);border-radius:2px;height:4px">
      <div style="height:100%;width:${v}%;background:${c};border-radius:2px;transition:width 0.8s"></div>
    </div>
    <span style="font-family:var(--font-mono);font-size:11px;color:${c}">${v}%</span>
  </div>`;
}

function riesgoBadge(r)    { return `<span class="badge badge-${{alto:'red',medio:'amber',bajo:'green'}[r]||'muted'}">${r}</span>`; }
function maturityBadge(v)  { return `<span class="badge badge-${['','red','amber','amber','green','cyan'][v]||'muted'}">${v}/5</span>`; }
function prioridadBadge(p) { return `<span class="badge badge-${{alta:'red',media:'amber',baja:'muted'}[p]||'muted'}">${p||'—'}</span>`; }
function estadoBadge(v)    { const m={'vigente':'green','conforme':'green','en revisión':'amber','observado':'amber','no conforme':'red'}; return `<span class="badge badge-${m[v]||'muted'}">${v}</span>`; }
function estadoProyBadge(v){ const m={'completado':'green','en ejecución':'cyan','en planificación':'blue','pausado':'amber'}; return `<span class="badge badge-${m[v]||'muted'}">${v}</span>`; }

// ═══════════════════════════════════════════════
//  FOCUS MODE MANAGEMENT
// ═══════════════════════════════════════════════
function setFocus(focus) {
  state.focus = focus;
  const cfg = FOCUS_CONFIG[focus];

  // Update HTML attribute for CSS accent changes
  document.documentElement.setAttribute('data-focus', focus);

  // Update chip styles
  document.querySelectorAll('.chip[data-focus]').forEach(c => {
    c.classList.toggle('active', c.dataset.focus === focus);
  });

  // Focus label bar
  const lbar = document.getElementById('focus-label');
  if(lbar) {
    lbar.textContent = cfg.label;
    lbar.closest('.focus-label-bar')?.classList.add('fade-in');
  }

  // Highlight / dim panels
  const allPanelIds = ['panel-maturity','panel-controls','panel-quality','panel-projects','heatmap-wrap','risk-right','kpi-0','kpi-1','kpi-2','kpi-3','kpi-4'];
  allPanelIds.forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    el.classList.remove('highlighted','dimmed');
    if(cfg.highlight.includes(id)) el.classList.add('highlighted');
    else if(cfg.dim.includes(id))  el.classList.add('dimmed');
  });

  // Update table section title
  const st = document.getElementById('table-section-title');
  const titles = {
    gobierno: 'Registro de Gobierno TI — Decisiones y Controles',
    riesgo:   'Registro de Riesgos TI Activos',
    alinea:   'Portafolio de Proyectos TI — Alineación Estratégica',
    datos:    'Índice de Calidad de Datos por Dominio'
  };
  if(st) st.textContent = titles[focus] || titles.gobierno;

  // Re-render all charts with new mode
  renderAll();
}

// ═══════════════════════════════════════════════
//  THEME TOGGLE
// ═══════════════════════════════════════════════
function toggleTheme() {
  const html = document.documentElement;
  const btn  = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-icon');
  const text = document.getElementById('theme-text');

  if(html.classList.contains('light-theme')) {
    html.classList.remove('light-theme');
    state.theme = 'dark';
    if(icon) icon.textContent = '☀';
    if(text) text.textContent = 'Claro';
  } else {
    html.classList.add('light-theme');
    state.theme = 'light';
    if(icon) icon.textContent = '🌙';
    if(text) text.textContent = 'Oscuro';
  }

  // Rebuild charts after a tick (CSS variables need to update first)
  setTimeout(() => {
    buildChartMaturity();
    buildChartControls();
    buildChartQuality();
    buildChartProjects();
  }, 60);
}

// ═══════════════════════════════════════════════
//  RENDER ALL
// ═══════════════════════════════════════════════
function renderAll() {
  renderKPIs();
  buildChartMaturity();
  buildChartControls();
  buildChartQuality();
  buildChartProjects();
  buildHeatmap();
  buildRiskSummary();
  buildBottomTable();
}

// ═══════════════════════════════════════════════
//  VIEW SWITCHING
// ═══════════════════════════════════════════════
function showView(view) {
  state.view = view;
  document.getElementById('dashboard-view').style.display = view==='dashboard' ? '' : 'none';
  document.getElementById('explorer-view').style.display  = view==='explorer'  ? 'flex' : 'none';
  document.getElementById('btn-dashboard').classList.toggle('active', view==='dashboard');
  document.getElementById('btn-explorer').classList.toggle('active',  view==='explorer');
  document.getElementById('filters-bar').style.display    = view==='dashboard' ? '' : 'none';
  document.querySelector('.focus-label-bar').style.display = view==='dashboard' ? '' : 'none';
  if(view==='explorer') renderExplorerTable();
}

// ═══════════════════════════════════════════════
//  DB EXPLORER (unchanged from v1)
// ═══════════════════════════════════════════════
const DB_TABS = {
  governance: {
    name:'Riesgo TI y Controles', file:'governance_risk_data.json', key:'governance',
    cols:[
      {key:'id',label:'ID'}, {key:'fecha',label:'Fecha'}, {key:'area_ti',label:'Área TI'},
      {key:'dominio_cobit',label:'Dominio COBIT'},
      {key:'maturity_cobit',label:'Madurez',render:v=>maturityBadge(v)},
      {key:'riesgo',label:'Riesgo',render:v=>riesgoBadge(v)},
      {key:'riesgo_score',label:'Score',render:v=>`<span style="font-family:var(--font-mono)">${v}</span>`},
      {key:'nivel_riesgo_aceptado',label:'Nivel Aceptado'},
      {key:'controles_efectivos',label:'Controles Ef.'}, {key:'controles_planeados',label:'Controles Plan.'},
      {key:'prioridad',label:'Prioridad',render:v=>prioridadBadge(v)}
    ]
  },
  quality: {
    name:'Calidad de Datos', file:'data_quality.json', key:'quality',
    cols:[
      {key:'id',label:'ID'},{key:'dominio_datos',label:'Dominio'},{key:'sistema_origen',label:'Sistema Origen'},
      {key:'calidad_datos_pct',label:'Calidad %',render:v=>qualityInline(v)},
      {key:'registros_total',label:'Registros',render:v=>v.toLocaleString('es')},
      {key:'registros_inconsistentes',label:'Inconsistentes',render:v=>`<span style="color:var(--amber)">${v.toLocaleString('es')}</span>`},
      {key:'completitud_pct',label:'Completitud'},{key:'precision_pct',label:'Precisión'},{key:'consistencia_pct',label:'Consistencia'},
      {key:'estado',label:'Estado',render:v=>estadoBadge(v)},
      {key:'responsable',label:'Responsable'},{key:'ult_revision',label:'Últ. Revisión'}
    ]
  },
  projects: {
    name:'Proyectos TI y Estrategia', file:'projects_alignment.json', key:'projects',
    cols:[
      {key:'id',label:'ID'},{key:'proyecto_ti',label:'Proyecto'},{key:'area_ti',label:'Área TI'},
      {key:'objetivo_estrategico',label:'Objetivo Est.'},{key:'sponsor',label:'Sponsor'},
      {key:'estado',label:'Estado',render:v=>estadoProyBadge(v)},
      {key:'impacto_logrado',label:'Impacto %',render:v=>qualityInline(v)},
      {key:'alineacion_score',label:'Alineación',render:v=>qualityInline(v)},
      {key:'presupuesto_musd',label:'Presup. MUSD',render:v=>`$${v}M`},
      {key:'prioridad',label:'Prioridad',render:v=>prioridadBadge(v)},
      {key:'fin_estimado',label:'Fin Est.'}
    ]
  },
  policies: {
    name:'Catálogo de Políticas', file:'policies_catalog.json', key:'policies',
    cols:[
      {key:'id',label:'ID'},{key:'politica',label:'Política'},{key:'dominio',label:'Dominio'},
      {key:'area_ti',label:'Área TI'},{key:'version',label:'Versión'},
      {key:'estado',label:'Estado',render:v=>estadoBadge(v)},
      {key:'nivel_institucionalizacion',label:'Institucional. %',render:v=>qualityInline(v)},
      {key:'criticidad',label:'Criticidad',render:v=>prioridadBadge(v)},
      {key:'propietario',label:'Propietario'},
      {key:'fecha_aprobacion',label:'Aprobación'},{key:'ult_revision',label:'Últ. Revisión'}
    ]
  }
};

function renderExplorerTable() {
  const tabKey  = state.explorer.tab;
  const tabDef  = DB_TABS[tabKey];
  const allData = state.data[tabDef.key]||[];
  const q       = state.explorer.search.toLowerCase();
  const filtered= q ? allData.filter(row=>Object.values(row).some(v=>String(v).toLowerCase().includes(q))) : allData;
  const total   = filtered.length;
  const pages   = Math.max(1, Math.ceil(total/state.explorer.pageSize));
  state.explorer.page = Math.min(state.explorer.page, pages);
  const start   = (state.explorer.page-1)*state.explorer.pageSize;
  const pageData= filtered.slice(start, start+state.explorer.pageSize);

  document.getElementById('db-table-name').textContent = tabDef.name;
  document.getElementById('db-row-count').innerHTML = `<span>${total}</span> registros`;
  document.getElementById('db-file-name').textContent = `data/${tabDef.file}`;

  const thead = document.getElementById('db-thead');
  if(thead) thead.innerHTML = `<tr>${tabDef.cols.map(c=>`<th>${c.label}</th>`).join('')}</tr>`;

  const tbody = document.getElementById('db-tbody');
  if(tbody) {
    tbody.innerHTML = pageData.length
      ? pageData.map(row=>`<tr>${tabDef.cols.map(c=>{const v=row[c.key]; return `<td>${c.render?c.render(v):(v!==undefined?String(v):'—')}</td>`;}).join('')}</tr>`).join('')
      : `<tr><td colspan="${tabDef.cols.length}" style="text-align:center;padding:32px;color:var(--text-muted);font-family:var(--font-mono);font-size:11px">Sin resultados para "${q}"</td></tr>`;
  }

  renderPagination(pages, total, start, pageData.length);
}

function renderPagination(pages, total, start, count) {
  const container = document.getElementById('db-pagination');
  if(!container) return;
  const cur = state.explorer.page;
  let html = `<span class="page-info">${start+1}–${start+count} de ${total}</span>`;
  html += `<button class="page-btn" id="p-prev" ${cur<=1?'disabled':''}>‹ Ant.</button>`;
  pageRange(cur,pages).forEach(p => {
    if(p==='…') html+=`<span class="page-info">…</span>`;
    else html+=`<button class="page-btn ${p===cur?'active':''}" data-page="${p}">${p}</button>`;
  });
  html += `<button class="page-btn" id="p-next" ${cur>=pages?'disabled':''}>Sig. ›</button>`;
  container.innerHTML = html;
  container.querySelectorAll('[data-page]').forEach(btn=>btn.addEventListener('click',()=>{state.explorer.page=+btn.dataset.page;renderExplorerTable();}));
  container.querySelector('#p-prev')?.addEventListener('click',()=>{state.explorer.page--;renderExplorerTable();});
  container.querySelector('#p-next')?.addEventListener('click',()=>{state.explorer.page++;renderExplorerTable();});
}

function pageRange(cur,total) {
  if(total<=7) return Array.from({length:total},(_,i)=>i+1);
  const pages=[1];
  if(cur>3) pages.push('…');
  for(let i=Math.max(2,cur-1);i<=Math.min(total-1,cur+1);i++) pages.push(i);
  if(cur<total-2) pages.push('…');
  pages.push(total);
  return pages;
}

function switchExplorerTab(tab) {
  state.explorer.tab=tab; state.explorer.page=1; state.explorer.search='';
  const s=document.getElementById('db-search'); if(s) s.value='';
  document.querySelectorAll('.db-tab[data-tab]').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  renderExplorerTable();
}

// ═══════════════════════════════════════════════
//  CLOCK
// ═══════════════════════════════════════════════
function startClock() {
  const el = document.getElementById('header-time');
  const update = () => { if(el) el.textContent = new Date().toLocaleString('es-PE',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}); };
  update(); setInterval(update, 1000);
}

// ═══════════════════════════════════════════════
//  GLOBAL CHART DEFAULTS
// ═══════════════════════════════════════════════
Chart.defaults.color = '#7d8aaa';
Chart.defaults.font  = { family:"'JetBrains Mono', monospace", size:10 };

// ═══════════════════════════════════════════════
//  EVENT LISTENERS
// ═══════════════════════════════════════════════
function bindEvents() {
  document.getElementById('btn-dashboard').addEventListener('click',()=>showView('dashboard'));
  document.getElementById('btn-explorer').addEventListener('click',()=>showView('explorer'));
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  document.querySelectorAll('.chip[data-focus]').forEach(chip=>{
    chip.addEventListener('click', ()=>setFocus(chip.dataset.focus));
  });

  const filterMap = {'f-desde':'fechaDesde','f-hasta':'fechaHasta','f-area':'areaTi','f-riesgo':'riesgo','f-prioridad':'prioridad'};
  Object.entries(filterMap).forEach(([id,key])=>{
    document.getElementById(id)?.addEventListener('change',e=>{
      state.filters[key]=e.target.value;
      applyFilters();
      renderAll();
    });
  });

  document.getElementById('btn-reset')?.addEventListener('click', resetFilters);

  document.querySelectorAll('.db-tab[data-tab]').forEach(tab=>{
    tab.addEventListener('click', ()=>switchExplorerTab(tab.dataset.tab));
  });

  const searchEl = document.getElementById('db-search');
  if(searchEl) {
    let timer;
    searchEl.addEventListener('input',e=>{
      clearTimeout(timer);
      timer = setTimeout(()=>{ state.explorer.search=e.target.value; state.explorer.page=1; renderExplorerTable(); }, 250);
    });
  }
}

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
async function init() {
  startClock();
  const ok = await loadAllData();
  if(!ok) {
    const ol = document.getElementById('loading-overlay');
    if(ol) ol.innerHTML = '<p style="color:var(--red);font-family:var(--font-mono);font-size:13px;max-width:400px;text-align:center">⚠ Error al cargar datos.<br>Use un servidor HTTP local: python3 -m http.server 8080</p>';
    return;
  }
  document.getElementById('loading-overlay')?.remove();
  bindEvents();
  showView('dashboard');
  setFocus('gobierno'); // trigger initial focus
}

document.addEventListener('DOMContentLoaded', init);
