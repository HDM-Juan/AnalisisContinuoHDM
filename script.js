document.addEventListener('DOMContentLoaded', function () {
    // --- URLs DE DATOS ---
    const gid_base = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxKT2sTncuJZP4_Bov1Gw1j7ixqNTfW7yGNn8nmAz8gDPauVeBt-8zqCEZWABXI0-BBDEQ4eTvZZkV/pub?single=true&output=csv';
    const serviciosUrl = `${gid_base}&gid=748915905`;
    const egresosUrl = `${gid_base}&gid=1961448383`;
    const anticiposUrl = `${gid_base}&gid=46329458`;
    const ventasUrl = `${gid_base}&gid=681275414`;
    const detalleVentaUrl = `${gid_base}&gid=553669204`;

    // --- VARIABLES GLOBALES ---
    let originalData = {};
    let charts = {};

    // --- ELEMENTOS DEL DOM ---
    const validezFilter = document.getElementById('validez-filter');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const convenioFilter = document.getElementById('convenio-filter');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // --- LÓGICA PRINCIPAL ---
    
    function fetchData(url) {
        return new Promise(resolve => Papa.parse(url, { download: true, header: true, dynamicTyping: true, transformHeader: h => h.trim(), complete: res => resolve(res.data) }));
    }

    Promise.all([
        fetchData(serviciosUrl), fetchData(egresosUrl), fetchData(anticiposUrl), fetchData(ventasUrl), fetchData(detalleVentaUrl)
    ]).then(([servicios, egresos, anticipos, ventas, detalleVenta]) => {
        originalData = {
            servicios: servicios.filter(r => r['Folio Recepción']).map(r => ({ ...r, fechaRecepcionObj: parseCustomDate(r['Fecha Recepción']) })),
            egresos: egresos.filter(r => r['Folio Egreso']).map(r => ({ ...r, fechaCompraObj: parseCustomDate(r['Fecha y Hora Compra']) })),
            anticipos: anticipos.filter(r => r['Folio Anticipo']).map(r => ({ ...r, fechaAnticipoObj: parseCustomDate(r['Fecha Anticipo']) })),
            ventas: ventas.filter(r => r['Folio Ventas']).map(r => ({ ...r, fechaVentaObj: parseCustomDate(r['Fecha Ventas']), FolioRecepcion: r['Folio Recepción Final'] })),
            detalleVenta: detalleVenta.filter(r => r['Folio Venta'])
        };
        initializeDashboard();
    }).catch(error => console.error("Error crítico al cargar datos:", error));

    function initializeDashboard() {
        tabButtons.forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
        [validezFilter, startDateInput, endDateInput, convenioFilter].forEach(el => el.addEventListener('change', masterFilterAndUpdate));
        
        initializeServiciosTab();
        initializeComprasTab();
        initializeAnticiposTab();
        initializeVentasTab();

        masterFilterAndUpdate();
    }

    function switchTab(tabId) {
        tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
        tabContents.forEach(content => content.classList.toggle('active', content.id === `${tabId}-content`));
    }

    function masterFilterAndUpdate() {
        const validez = validezFilter.value;
        const filterByValidez = data => data.filter(r => validez === 'todos' || (validez === 'validos' && r.Validez !== 'CANCELADO') || (validez === 'cancelados' && r.Validez === 'CANCELADO'));
        
        const startDate = startDateInput.valueAsDate;
        const endDate = endDateInput.valueAsDate;
        const filterByDate = (data, dateCol) => !startDate || !endDate ? data : data.filter(r => r[dateCol] >= startDate && r[dateCol] <= endDate);

        const fServicios = filterByDate(filterByValidez(originalData.servicios), 'fechaRecepcionObj');
        const fEgresos = filterByDate(filterByValidez(originalData.egresos), 'fechaCompraObj');
        const fAnticipos = filterByDate(filterByValidez(originalData.anticipos), 'fechaAnticipoObj');
        let fVentas = filterByDate(filterByValidez(originalData.ventas), 'fechaVentaObj');
        
        if (!convenioFilter.checked) {
            fVentas = fVentas.filter(r => r['¿Convenio?'] !== true);
        }

        updateServiciosTab(fServicios);
        updateComprasTab(fEgresos);
        updateAnticiposTab(fAnticipos);
        updateVentasTab(fVentas);
    }
    
    // --- PESTAÑA "SERVICIOS" (CÓDIGO RESTAURADO) ---
    function initializeServiciosTab() {
        document.getElementById('servicios-content').innerHTML = `
            <section class="kpi-grid">
                <div class="kpi-card"><h4>Total Servicios</h4><p id="total-servicios">...</p></div>
            </section>
            <section class="charts-grid">
                <div class="chart-container"><h3>Servicios por Tipo</h3><canvas id="serviciosChart"></canvas></div>
                <div class="chart-container"><h3>Equipos por Marca</h3><canvas id="marcasChart"></canvas></div>
            </section>`;
        charts.servicios = createChart('serviciosChart', 'bar');
        charts.marcas = createChart('marcasChart', 'doughnut');
    }
    function updateServiciosTab(data) {
        document.getElementById('total-servicios').textContent = data.length;
        updateChartData(charts.servicios, data, 'TipoServicio');
        updateChartData(charts.marcas, data, 'Marca');
    }

    // --- PESTAÑA "COMPRAS" (CÓDIGO RESTAURADO) ---
    function initializeComprasTab() {
        document.getElementById('compras-content').innerHTML = `
            <section class="kpi-grid">
                <div class="kpi-card"><h4>Total Egresos</h4><p id="total-egresos">...</p></div>
                <div class="kpi-card"><h4># de Compras</h4><p id="num-compras">...</p></div>
            </section>
            <section class="charts-grid">
                <div class="chart-container"><h3>Egresos por Tipo</h3><canvas id="egresosTipoChart"></canvas></div>
            </section>
            <section class="table-container"><h3>Detalle de Egresos</h3><div class="table-wrapper">
                <table class="data-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto/Artículo</th><th>Monto</th></tr></thead><tbody id="egresos-table-body"></tbody></table>
            </div></section>`;
        charts.egresosTipo = createChart('egresosTipoChart', 'pie');
    }
    function updateComprasTab(data) {
        const totalEgresos = data.reduce((sum, r) => sum + (r.Monto || 0), 0);
        document.getElementById('total-egresos').textContent = `$${totalEgresos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        document.getElementById('num-compras').textContent = data.length;
        updateChartData(charts.egresosTipo, data, 'Tipo', 'Monto');
        const tableBody = document.getElementById('egresos-table-body');
        tableBody.innerHTML = '';
        data.slice(0, 100).forEach(r => {
            tableBody.innerHTML += `<tr><td>${r['Fecha y Hora Compra'] || ''}</td><td>${r.Tipo || ''}</td><td>${r['Artículo a Comprar'] || r.Concepto || ''}</td><td>$${(r.Monto || 0).toFixed(2)}</td></tr>`;
        });
    }

    // --- PESTAÑA "ANTICIPOS" (CÓDIGO RESTAURADO) ---
    function initializeAnticiposTab() {
        document.getElementById('anticipos-content').innerHTML = `
            <section class="kpi-grid">
                <div class="kpi-card"><h4>Anticipos Recibidos</h4><p id="total-anticipos">...</p></div>
                <div class="kpi-card"><h4>Costo Total Piezas</h4><p id="costo-piezas">...</p></div>
                <div class="kpi-card"><h4># Piezas Pedidas</h4><p id="num-piezas">...</p></div>
            </section>
            <section class="table-container"><h3>Detalle de Anticipos</h3><div class="table-wrapper"><table class="data-table">
            <thead><tr><th>Fecha</th><th>Folio</th><th>Modelo</th><th>Pieza</th><th>Costo</th><th>Anticipo</th><th>Llegada Est.</th></tr></thead>
            <tbody id="anticipos-table-body"></tbody></table></div>`;
    }
    function updateAnticiposTab(data) {
        const totalAnticipos = data.reduce((sum, r) => sum + (r['Cantidad Anticipo'] || 0), 0);
        const costoPiezas = data.reduce((sum, r) => sum + (r.Costo || 0), 0);
        document.getElementById('total-anticipos').textContent = `$${totalAnticipos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        document.getElementById('costo-piezas').textContent = `$${costoPiezas.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        document.getElementById('num-piezas').textContent = data.length;
        const tableBody = document.getElementById('anticipos-table-body');
        tableBody.innerHTML = '';
        data.slice(0, 100).forEach(r => {
            tableBody.innerHTML += `<tr>
                <td>${r['Fecha Anticipo'] || ''}</td><td>${r['Folio Anticipo'] || ''}</td>
                <td>${r.Modelo_Ver || ''}</td><td>${r.Pieza || ''}</td>
                <td>$${(r.Costo || 0).toFixed(2)}</td><td>$${(r['Cantidad Anticipo'] || 0).toFixed(2)}</td>
                <td>${r['Fecha estimada Arribo'] || ''}</td>
            </tr>`;
        });
    }

    // --- PESTAÑA "VENTAS" (CÓDIGO NUEVO) ---
    function initializeVentasTab() {
        const container = document.getElementById('ventas-content');
        container.querySelector('#ventas-kpi-container').innerHTML = `
            <div class="kpi-card"><h4>Ingresos Totales</h4><p id="total-ventas">...</p></div>
            <div class="kpi-card"><h4>Pagos Recibidos</h4><p id="total-pagos">...</p></div>
            <div class="kpi-card"><h4># de Ventas</h4><p id="num-ventas">...</p></div>`;
        container.querySelector('#ventas-charts-grid').innerHTML = `
            <div class="chart-container"><h3>Ventas por Tipo de Servicio</h3><canvas id="ventasServicioChart"></canvas></div>
            <div class="chart-container"><h3>Resultados de Servicio</h3><canvas id="resultadosChart"></canvas></div>`;
        container.querySelector('#ventas-table-container').innerHTML = `
            <h3>Detalle de Ventas</h3><div class="table-wrapper"><table class="data-table">
            <thead><tr><th>Fecha</th><th>Folio Venta</th><th>Folio Recepción</th><th>Folio Anticipo</th><th>Total Venta</th><th>Total Pagos</th></tr></thead>
            <tbody id="ventas-table-body"></tbody></table></div>`;
        
        charts.ventasServicio = createChart('ventasServicioChart', 'bar');
        charts.resultados = createChart('resultadosChart', 'pie');
        container.querySelector('#ventas-table-body').addEventListener('click', handleTraceClick);
    }
    function updateVentasTab(data) {
        const totalVentas = data.reduce((sum, r) => sum + (r['Total Venta'] || 0), 0);
        const totalPagos = data.reduce((sum, r) => sum + (r['Total Pagos'] || 0), 0);
        document.getElementById('total-ventas').textContent = `$${totalVentas.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
        document.getElementById('total-pagos').textContent = `$${totalPagos.toLocaleString('es-MX', {minimumFractionDigits: 2})}`;
        document.getElementById('num-ventas').textContent = data.length;
        updateChartData(charts.ventasServicio, data, 'TipoServicio', 'Total Venta');
        updateChartData(charts.resultados, data, 'Resultado Servicio');
        const tableBody = document.getElementById('ventas-table-body');
        tableBody.innerHTML = '';
        data.slice(0, 100).forEach(r => {
            const folioRecepcionHTML = r.FolioRecepcion ? `<span class="trace-link" data-folio="${r.FolioRecepcion}" data-target-tab="servicios">${r.FolioRecepcion}</span>` : '';
            const folioAnticipoHTML = r['Folio Anticipo'] ? `<span class="trace-link" data-folio="${r['Folio Anticipo']}" data-target-tab="anticipos">${r['Folio Anticipo']}</span>` : '';
            tableBody.innerHTML += `<tr>
                <td>${r['Fecha Ventas'] || ''}</td><td>${r['Folio Ventas']}</td>
                <td>${folioRecepcionHTML}</td><td>${folioAnticipoHTML}</td>
                <td>$${(r['Total Venta'] || 0).toFixed(2)}</td><td>$${(r['Total Pagos'] || 0).toFixed(2)}</td>
            </tr>`;
        });
    }

    // --- LÓGICA DE TRAZABILIDAD ---
    function handleTraceClick(event) {
        if (event.target.classList.contains('trace-link')) {
            const folio = event.target.dataset.folio;
            const tabId = event.target.dataset.targetTab;
            alert(`Trazabilidad: Buscando Folio ${folio} en la pestaña ${tabId}. \n(La funcionalidad de auto-filtrado se implementará en el siguiente paso)`);
            switchTab(tabId);
        }
    }

    // --- FUNCIONES UTILITARIAS ---
    function parseCustomDate(dateString) { if (!dateString || typeof dateString !== 'string') return null; const parts = dateString.split(' ')[0].split('/'); return parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : null; }
    function createChart(canvasId, type) { const ctx = document.getElementById(canvasId).getContext('2d'); const chartConfig = { type, options: { responsive: true, maintainAspectRatio: false } }; if (type === 'bar') chartConfig.options.indexAxis = 'y'; return new Chart(ctx, chartConfig); }
    function updateChartData(chart, data, categoryCol, sumCol = null) { const counts = data.reduce((acc, row) => { const category = row[categoryCol]; if (category) { const value = sumCol ? (row[sumCol] || 0) : 1; acc[category] = (acc[category] || 0) + value; } return acc; }, {}); let sorted = Object.entries(counts).sort(([, a], [, b]) => b - a); chart.data.labels = sorted.map(item => item[0]); chart.data.datasets = [{ data: sorted.map(item => item[1]), backgroundColor: ['#B22222', '#8B1A1A', '#DC3545', '#6c757d', '#1877F2', '#25D366', '#FF9800'] }]; chart.update(); }
});
