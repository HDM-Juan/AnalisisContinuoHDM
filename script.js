document.addEventListener('DOMContentLoaded', function () {
    // --- URLs DE DATOS ---
    const serviciosUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxKT2sTncuJZP4_Bov1Gw1j7ixqNTfW7yGNn8nmAz8gDPauVeBt-8zqCEZWABXI0-BBDEQ4eTvZZkV/pub?gid=748915905&single=true&output=csv';
    const egresosUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxKT2sTncuJZP4_Bov1Gw1j7ixqNTfW7yGNn8nmAz8gDPauVeBt-8zqCEZWABXI0-BBDEQ4eTvZZkV/pub?gid=1961448383&single=true&output=csv';

    // --- VARIABLES GLOBALES ---
    let originalServiciosData = [];
    let originalEgresosData = [];
    let charts = {};

    // --- ELEMENTOS DEL DOM ---
    const validezFilter = document.getElementById('validez-filter');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // --- LÓGICA PRINCIPAL ---
    
    // Carga los datos de una URL de Google Sheet.
    function fetchData(url) {
        return new Promise((resolve, reject) => {
            Papa.parse(url, {
                download: true, header: true, dynamicTyping: true, transformHeader: h => h.trim(),
                complete: results => resolve(results.data),
                error: error => reject(error)
            });
        });
    }

    // Carga todos los datos y luego inicializa el dashboard.
    Promise.all([fetchData(serviciosUrl), fetchData(egresosUrl)])
        .then(([serviciosData, egresosData]) => {
            // Limpieza y pre-procesamiento de datos
            originalServiciosData = serviciosData.filter(r => r['Folio Recepción'] != null).map(r => ({
                ...r,
                fechaRecepcionObj: parseCustomDate(r['Fecha Recepción']),
                fechaCierreObj: parseCustomDate(r['Fecha Cierre'])
            }));
            originalEgresosData = egresosData.filter(r => r['Folio Egreso'] != null).map(r => ({
                ...r,
                fechaCompraObj: parseCustomDate(r['Fecha y Hora Compra'])
            }));
            
            initializeDashboard();
        })
        .catch(error => console.error("Error crítico al cargar datos:", error));

    function initializeDashboard() {
        // Configurar la lógica de las pestañas
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                button.classList.add('active');
                document.getElementById(button.dataset.tab + '-content').classList.add('active');
            });
        });

        // Configurar los filtros globales
        [validezFilter, startDateInput, endDateInput].forEach(el => {
            el.addEventListener('change', masterFilterAndUpdate);
        });
        
        // Inicializar cada pestaña
        initializeServiciosTab();
        initializeComprasTab();

        // Cargar datos por primera vez
        masterFilterAndUpdate();
    }

    function masterFilterAndUpdate() {
        // 1. Aplicar filtro de validez a ambos conjuntos de datos
        const validez = validezFilter.value;
        const validServicios = originalServiciosData.filter(r => {
            const isCancelled = r.Validez === 'CANCELADO';
            if (validez === 'validos') return !isCancelled;
            if (validez === 'cancelados') return isCancelled;
            return true; // 'todos'
        });
        const validEgresos = originalEgresosData.filter(r => {
            const isCancelled = r.Validez === 'CANCELADO';
            if (validez === 'validos') return !isCancelled;
            if (validez === 'cancelados') return isCancelled;
            return true; // 'todos'
        });

        // 2. Aplicar filtros de fecha
        const startDate = startDateInput.valueAsDate;
        const endDate = endDateInput.valueAsDate;
        
        const dateFilteredServicios = startDate && endDate ? validServicios.filter(r => r.fechaRecepcionObj >= startDate && r.fechaRecepcionObj <= endDate) : validServicios;
        const dateFilteredEgresos = startDate && endDate ? validEgresos.filter(r => r.fechaCompraObj >= startDate && r.fechaCompraObj <= endDate) : validEgresos;

        // 3. Actualizar ambas pestañas
        updateServiciosTab(dateFilteredServicios);
        updateComprasTab(dateFilteredEgresos);
    }

    // --- FUNCIONES DE LA PESTAÑA "SOLICITUD DE SERVICIOS" ---
    
    function initializeServiciosTab() {
        // Aquí puedes recrear la estructura HTML interna si es necesario
        document.getElementById('kpi-container').innerHTML = `
            <div class="kpi-card"><h4>Total de Servicios</h4><p id="total-servicios">...</p></div>
            <div class="kpi-card"><h4>Puntualidad</h4><p id="puntualidad">...</p></div>`;
        document.querySelector('.charts-grid').innerHTML = `
            <div class="chart-container"><h3>Servicios por Tipo</h3><canvas id="serviciosChart"></canvas></div>
            <div class="chart-container"><h3>Equipos por Marca</h3><canvas id="marcasChart"></canvas></div>`;
        
        charts.servicios = createChart('serviciosChart', 'bar', 'Número de Servicios');
        charts.marcas = createChart('marcasChart', 'doughnut', 'Equipos por Marca');
    }

    function updateServiciosTab(data) {
        // Actualizar KPIs
        document.getElementById('total-servicios').textContent = data.length;
        const onTime = data.filter(r => r.fechaCierreObj && r.fechaRecepcionObj && r.fechaCierreObj <= r.fechaRecepcionObj).length;
        document.getElementById('puntualidad').textContent = data.length > 0 ? `${((onTime / data.length) * 100).toFixed(1)}%` : '0%';
        
        // Actualizar Gráficos
        updateChartData(charts.servicios, data, 'TipoServicio');
        updateChartData(charts.marcas, data, 'Marca');
    }

    // --- FUNCIONES DE LA PESTAÑA "COMPRAS Y GASTOS" ---

    function initializeComprasTab() {
        document.getElementById('compras-kpi-container').innerHTML = `
            <div class="kpi-card"><h4>Total Egresos</h4><p id="total-egresos">...</p></div>
            <div class="kpi-card"><h4># de Compras</h4><p id="num-compras">...</p></div>`;
        document.getElementById('compras-charts-grid').innerHTML = `
            <div class="chart-container"><h3>Egresos por Tipo</h3><canvas id="egresosTipoChart"></canvas></div>
            <div class="chart-container"><h3>Top 5 Proveedores</h3><canvas id="proveedoresChart"></canvas></div>`;
        document.getElementById('compras-table-container').innerHTML = `
            <h3>Detalle de Egresos</h3><div class="table-wrapper"><table class="data-table">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto/Artículo</th><th>Proveedor</th><th>Monto</th></tr></thead>
            <tbody id="egresos-table-body"></tbody></table></div>`;

        charts.egresosTipo = createChart('egresosTipoChart', 'pie', 'Egresos por Tipo');
        charts.proveedores = createChart('proveedoresChart', 'bar', 'Top 5 Proveedores');
    }

    function updateComprasTab(data) {
        // Actualizar KPIs
        const totalEgresos = data.reduce((sum, r) => sum + (r.Monto || 0), 0);
        document.getElementById('total-egresos').textContent = `$${totalEgresos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        document.getElementById('num-compras').textContent = data.length;

        // Actualizar Gráficos (sumando montos, no solo contando)
        updateChartData(charts.egresosTipo, data, 'Tipo', 'Monto');
        updateChartData(charts.proveedores, data, 'Proveedor', 'Monto', 5);

        // Actualizar Tabla
        const tableBody = document.getElementById('egresos-table-body');
        tableBody.innerHTML = '';
        data.slice(0, 100).forEach(r => { // Mostrar solo los primeros 100 para no sobrecargar
            const row = `<tr>
                <td>${r['Fecha y Hora Compra'] || ''}</td>
                <td>${r.Tipo || ''}</td>
                <td>${r['Artículo a Comprar'] || r.Concepto || ''}</td>
                <td>${r.Proveedor || ''}</td>
                <td>$${(r.Monto || 0).toFixed(2)}</td>
            </tr>`;
            tableBody.innerHTML += row;
        });
    }

    // --- FUNCIONES UTILITARIAS ---

    function parseCustomDate(dateString) {
        if (!dateString || typeof dateString !== 'string') return null;
        const parts = dateString.split(' ')[0].split('/');
        return parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : null;
    }

    function createChart(canvasId, type, label) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        const chartType = type === 'pie' || type === 'doughnut' ? { type } : { type, options: { indexAxis: 'y' } };
        return new Chart(ctx, {
            ...chartType,
            data: { labels: [], datasets: [{ label, data: [] }] },
            options: { ...chartType.options, responsive: true, maintainAspectRatio: false }
        });
    }

    function updateChartData(chart, data, categoryColumn, sumColumn = null, topN = null) {
        const counts = data.reduce((acc, row) => {
            const category = row[categoryColumn];
            if (category) {
                const value = sumColumn ? (row[sumColumn] || 0) : 1;
                acc[category] = (acc[category] || 0) + value;
            }
            return acc;
        }, {});
        
        let sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
        if (topN) sorted = sorted.slice(0, topN);

        chart.data.labels = sorted.map(item => item[0]);
        chart.data.datasets[0].data = sorted.map(item => item[1]);
        chart.data.datasets[0].backgroundColor = ['#B22222', '#8B1A1A', '#DC3545', '#6c757d', '#1877F2', '#25D366'];
        chart.update();
    }
});
