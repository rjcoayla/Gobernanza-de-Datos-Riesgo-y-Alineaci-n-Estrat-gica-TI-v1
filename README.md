# Modelo de Gobernanza de Datos, Riesgo y Alineación Estratégica TI–Negocio — Minería

> Dashboard web interactivo para equipos de TI, Riesgo, Datos y Gobierno Corporativo en operaciones mineras.

---

## Propósito

Este dashboard implementa un **Modelo de Gobernanza de TI y Datos** bajo los marcos de referencia COBIT 2019, DAMA-DMBOK e ISO/IEC 38500, orientado a la industria minera. Permite a los responsables:

- **Monitorear la madurez de gobernanza TI** por dominio COBIT (Planificar, Construir, Ejecutar, Monitorizar).
- **Analizar riesgos TI vs. controles** implementados y planeados (enfoque GRC — *Governance, Risk & Compliance*).
- **Evaluar la calidad de datos** por dominio y sistema origen (DQ Index).
- **Visualizar la alineación de proyectos TI** con objetivos estratégicos del negocio minero.
- **Explorar los catálogos de datos** que respaldan el modelo (4 datasets con vista tipo explorador de BD).

Los datos son **simulados** con fines de demostración.

---

## Estructura del proyecto

```
grc-mining/
├── index.html              # Punto de entrada del dashboard
├── css/
│   └── styles.css          # Estilos: tema industrial oscuro
├── js/
│   └── app.js              # Lógica modular: carga, filtros, KPIs, gráficos, explorador
├── data/
│   ├── governance_risk_data.json   # Riesgo TI y controles COBIT
│   ├── data_quality.json           # Calidad de datos por dominio
│   ├── projects_alignment.json     # Proyectos TI y alineación estratégica
│   └── policies_catalog.json       # Catálogo de políticas y procedimientos
└── README.md
```

---

## Datasets (`/data`)

### `governance_risk_data.json`
Registro principal de gobernanza TI. Contiene:
- `fecha`, `area_ti`, `dominio_cobit` — contexto del registro
- `maturity_cobit` (1–5) — nivel de madurez según COBIT 2019
- `riesgo` / `riesgo_score` (0–100) — evaluación cualitativa y cuantitativa del riesgo
- `nivel_riesgo_aceptado` — umbral aprobado por el Comité de Riesgo
- `controles_efectivos` / `controles_planeados` — estado de controles GRC
- `prioridad`, `porc_politicas_institucionalizadas`, `porc_iniciativas_ti_alineadas`

### `data_quality.json`
Índice de calidad de datos por dominio funcional:
- `dominio_datos`, `sistema_origen` — identificación del activo de datos
- `calidad_datos_pct`, `completitud_pct`, `precision_pct`, `consistencia_pct`
- `registros_total`, `registros_inconsistentes`
- `estado` (conforme / observado / no conforme), `responsable`, `ult_revision`

### `projects_alignment.json`
Portafolio de proyectos TI y su alineación estratégica:
- `proyecto_ti`, `area_ti`, `objetivo_estrategico`, `sponsor`
- `estado` (completado / en ejecución / en planificación / pausado)
- `impacto_logrado` (0–100%), `alineacion_score` (0–100)
- `presupuesto_musd`, `prioridad`, `decision`, `beneficio_esperado`

### `policies_catalog.json`
Catálogo de políticas y procedimientos corporativos:
- `id`, `politica`, `dominio`, `area_ti`, `propietario`
- `estado` (vigente / en revisión), `version`, `criticidad`
- `nivel_institucionalizacion` (%) — adopción efectiva en la organización
- `fecha_aprobacion`, `ult_revision`, `procedimientos_asociados`

---

## KPIs del Dashboard

| KPI | Descripción | Fuente |
|-----|-------------|--------|
| **Madurez COBIT Promedio** | Media de `maturity_cobit` (escala 1–5) | governance_risk_data |
| **% Políticas Institucionalizadas** | Promedio de `porc_politicas_institucionalizadas` | governance_risk_data |
| **% Iniciativas TI Alineadas** | Promedio de `porc_iniciativas_ti_alineadas` | governance_risk_data |
| **Calidad de Datos Promedio** | Media de `calidad_datos_pct` sobre todos los dominios | data_quality |
| **Riesgos Altos Activos** | Conteo de registros con `riesgo = "alto"` | governance_risk_data |

---

## Visualizaciones

| Gráfico | Tipo | Descripción |
|---------|------|-------------|
| **Madurez COBIT por Dominio** | Radar | Nivel promedio por Planificar/Construir/Ejecutar/Monitorizar |
| **Controles Efectivos vs Planeados** | Barras agrupadas | Brecha de controles por área TI |
| **Calidad de Datos por Dominio** | Barras horizontales | DQ Index con umbrales de color |
| **Impacto vs Alineación de Proyectos** | Bar + línea (combo) | Top 10 proyectos: impacto logrado y score estratégico |
| **Heatmap de Riesgo** | Mapa de calor 5×5 | Score riesgo actual vs nivel aceptado |
| **Distribución de Riesgos por Área** | Barras apiladas | Alto/Medio/Bajo por área TI |

---

## Módulo Explorador de Bases de Datos

Accesible desde el botón **"Explorador de BD"** en la barra de navegación.

Funcionalidades:
- **4 pestañas** de datasets independientes
- **Búsqueda** en tiempo real sobre cualquier campo
- **Paginación** configurable (10 registros por página)
- **Indicadores visuales** embebidos (badges, barras de progreso)
- Estilo tipo *data viewer* profesional con headers fijos

---

## Conceptos de referencia

- **COBIT 2019** — Marco de gobernanza y gestión de TI empresarial (ISACA)
- **GRC** — Governance, Risk & Compliance: integración de gobierno, riesgo y cumplimiento
- **DAMA-DMBOK** — Marco de gestión de datos (Data Management Body of Knowledge)
- **KPI/KRI** — Indicadores clave de rendimiento y riesgo para TI
- **ISO/IEC 38500** — Gobernanza de TI a nivel corporativo
- **Heatmap de riesgo** — Matriz probabilidad × impacto adaptada a riesgo TI

---

## Cómo ejecutar

### Opción 1 — Servidor HTTP local (recomendado)

```bash
# Python 3
python3 -m http.server 8080

# Node.js (npx)
npx serve .

# PHP
php -S localhost:8080
```

Abrir en el navegador: `http://localhost:8080`

### Opción 2 — VS Code Live Server
Instalar la extensión **Live Server** y hacer clic en *"Go Live"*.

> ⚠ **No abrir `index.html` directamente** con `file://` ya que los `fetch()` a los JSON fallarán por política CORS del navegador.

---

## Nota sobre los datos

Todos los datos contenidos en la carpeta `/data` son **completamente simulados** y han sido generados con fines de demostración técnica. No representan información real de ninguna operación minera ni organización.

---

*Dashboard desarrollado con HTML5, CSS3 (CSS Grid), Chart.js 4.4 y JavaScript puro (ES2022+). Sin dependencias de frameworks.*
