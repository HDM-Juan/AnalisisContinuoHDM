document.addEventListener('DOMContentLoaded', function () {
    // --- URLs DE DATOS ---
    const toProxyUrl = (originalUrl) => `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`;
    const gid_base = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxKT2sTncuJZP4_Bov1Gw1j7ixqNTfW7yGNn8nmAz8gDPauVeBt-8zqCEZWABXI0-BBDEQ4eTvZZkV/pub?single=true&output=csv';

    const serviciosUrl = toProxyUrl(`${gid_base}&gid=748915905`);
    const egresosUrl = toProxyUrl(`${gid_base}&gid=1961448383`);
    const anticiposUrl = toProxyUrl(`${gid_base}&gid=46329458`);
    const ventasUrl = toProxyUrl(`${gid_base}&gid=681275414`);
    const detalleVentaUrl = toProxyUrl(`${gid_base}&gid=553669204`);

    // --- VARIABLES GLOBALES ---
    let originalData = {};
    let charts = {};
    let activeFolioFilter = null;
    let dataLoaded = false;

    // --- ELEMENTOS DEL DOM ---
    const landingView = document.getElementById('landing-view');
    const dashboardView = document.getElementById('dashboard-view');
    const backToLandingButton = document.getElementById('back-to-landing');
    const sectionLinks = document.querySelectorAll('.section-link');
    const mainTitle = document.getElementById('main-title');

    const validezFilter = document.getElementById('validez-filter');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const folioFilterStatus = document.getElementById('folio-filter-status');
    const applyFiltersButton = document.getElementById('apply-filters-button');
    
    // --- MAPEO DE COLUMNAS DE FOLIO ---
    const folioColumns = {
        servicios: { primary: 'Folio Recepción', links: { 'Folio Cierre': 'ventas', 'Folio Anticipo que Dejó': 'anticipos' } },
        compras: { primary: 'Folio Egreso', links: { 'Folio Recepción': 'servicios', 'Folio Anticipo': 'anticipos' } },
        anticipos: { primary: 'Folio Anticipo', links: { 'Folio Recepción': 'servicios', 'Folio Cierre': 'ventas' } },
        ventas: { primary: 'Folio Venta', links: { 'Folio Recepción Final': 'servicios', 'Folio Anticipo': 'anticipos', 'Anticipo en Recepción': 'anticipos' } }
    };

    // --- LÓGICA DE NAVEGACIÓN Y VISTAS ---
    function showDashboard(tabId = 'ventas') {
        landingView.style.display = 'none';
        dashboardView.style.display = 'block';
        backToLandingButton.style.display = 'inline-block';
        mainTitle.textContent = 'Dashboard de Análisis de Negocio';
        switchTab(tabId);
        if (dataLoaded) {
            masterFilterAndUpdate();
        }
    }

    function showLandingPage() {
        dashboardView.style.display = 'none';
        backToLandingButton.style.display = 'none';
        landingView.style.display = 'block';
        mainTitle.textContent = 'Análisis de Negocio';
        activeFolioFilter = null; // Limpiar filtro al volver al inicio
        window.location.hash = ''; // Limpiar hash de la URL
    }

    // --- LÓGICA PRINCIPAL ---
    function fetchAndCleanData(url, primaryKey) {
        return new Promise((resolve, reject) => {
            Papa.parse(url, {
                download: true,
                header: true,
                skipEmptyLines: true,
                transformHeader: h => h.trim(),
                complete: (results) => {
                    const data = results.data;
                    if (!data || data.length === 0) return resolve([]);
                    // Corregir 'Folio Ventas' a 'Folio Venta' si es necesario
                    if (data.length > 0 && 'Folio Ventas' in data[0] && !('Folio Venta' in data[0])) {
                        results.data.forEach(r => {
                            r['Folio Venta'] = r['Folio Ventas'];
                            delete r['Folio Ventas'];
                        });
                    }
                    const cleanedData = data.filter(r => r[primaryKey] != null && String(r[primaryKey]).trim() !== '');
                    resolve(cleanedData);
                },
                error: (error) => reject(error)
            });
        });
    }

    Promise.all([
        fetchAndCleanData(serviciosUrl, 'Folio Recepción'),
        fetchAndCleanData(egresosUrl, 'Folio Egreso'),
        fetchAndCleanData(anticiposUrl, 'Folio Anticipo'),
        fetchAndCleanData(ventasUrl, 'Folio Venta'),
        fetchAndCleanData(detalleVentaUrl, 'Folio Venta')
    ]).then(([servicios, compras, anticipos, ventas, detalleVenta]) => {
        originalData = {
            servicios: servicios.map(r => ({ ...r, fechaRecepcionObj: parseCustomDate(r['Fecha Recepción']) })),
            compras: compras.map(r => ({ ...r, fechaCompraObj: parseCustomDate(r['Fecha y Hora Compra']) })),
            anticipos: anticipos.map(r => ({ ...r, fechaAnticipoObj: parseCustomDate(r['Fecha Anticipo']) })),
            ventas: ventas.map(r => ({ ...r, fechaVentaObj: parseCustomDate(r['Fecha Venta']) })),
            detalleVenta: detalleVenta
        };
        dataLoaded = true;
        initializeDashboard();
    }).catch(error => console.error("Error crítico al cargar datos:", error));

    function initializeDashboard() {
        // Listeners del Dashboard
        tabButtons.forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
        applyFiltersButton.addEventListener('click', masterFilterAndUpdate);
        folioFilterStatus.addEventListener('click', clearFolioFilter);
        dashboardView.addEventListener('click', handleTraceClick);

        // Listeners de Navegación Principal
        sectionLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = new URL(link.href).hash.replace('#', '');
                showDashboard(tabId);
            });
        });
        backToLandingButton.addEventListener('click', (e) => {
            e.preventDefault();
            showLandingPage();
        });

        // Inicializar Pestañas
        initializeServiciosTab();
        initializeComprasTab();
        initializeAnticiposTab();
        initializeVentasTab();

        // Decidir vista inicial
        const initialTab = window.location.hash.replace('#', '');
        if (initialTab && folioColumns[initialTab]) {
            showDashboard(initialTab);
        } else {
            showLandingPage();
        }
    }

    function switchTab(tabId) {
        if (!document.getElementById(`${tabId}-content`)) {
            tabId = 'ventas';
        }
        tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
        tabContents.forEach(content => content.classList.toggle('active', content.id === `${tabId}-content`));
        window.location.hash = tabId;
        masterFilterAndUpdate(); // Actualizar al cambiar de pestaña
    }

    function masterFilterAndUpdate() {
        if (!dataLoaded) return;
        const validez = validezFilter.value;
        const filterByValidez = data => data.filter(r => validez === 'todos' || (validez === 'validos' && r.Validez !== 'CANCELADO') || (validez === 'cancelados' && r.Validez === 'CANCELADO'));
        
        const startDate = startDateInput.valueAsDate;
        const endDate = endDateInput.valueAsDate;
        const filterByDate = (data, dateCol) => !startDate || !endDate ? data : data.filter(r => r[dateCol] >= startDate && r[dateCol] <= endDate);

        let fServicios = filterByDate(filterByValidez(originalData.servicios), 'fechaRecepcionObj');
        let fCompras = filterByDate(filterByValidez(originalData.compras), 'fechaCompraObj');
        let fAnticipos = filterByDate(filterByValidez(originalData.anticipos), 'fechaAnticipoObj');
        let fVentas = filterByDate(filterByValidez(originalData.ventas), 'fechaVentaObj');
        
        const convenioFilter = document.getElementById('convenio-filter');
        if (convenioFilter && !convenioFilter.checked) {
            fVentas = fVentas.filter(r => String(r['¿Convenio?']).toUpperCase() === 'FALSE' || !r['¿Convenio?']);
        }

        if (activeFolioFilter) {
            const { value } = activeFolioFilter;
            const folioNumber = String(value).match(/\d+/g)?.join('') || value;

            const findRelated = (data, folio) => data.filter(r =>
                Object.values(r).some(cell => {
                    if (!cell) return false;
                    const cellFolioNumber = String(cell).match(/\d+/g)?.join('');
                    return cellFolioNumber && cellFolioNumber.includes(folio);
                })
            );

            fServicios = findRelated(fServicios, folioNumber);
            fCompras = findRelated(fCompras, folioNumber);
            fAnticipos = findRelated(fAnticipos, folioNumber);
            fVentas = findRelated(fVentas, folioNumber);

            folioFilterStatus.innerHTML = `Filtrando por Folio: <strong>${value}</strong> <span class="clear-filter">(quitar)</span>`;
            folioFilterStatus.style.display = 'flex';
        } else {
            folioFilterStatus.style.display = 'none';
        }

        updateServiciosTab(fServicios);
        updateComprasTab(fCompras);
        updateAnticiposTab(fAnticipos);
        updateVentasTab(fVentas);
    }
    
    function initializeServiciosTab() {
        document.getElementById('servicios-content').innerHTML = `
            <section class="kpi-grid">
                <div class="kpi-card"><h4>Total Servicios</h4><p id="total-servicios">...</p></div>
                <div class="kpi-card"><h4>Servicios Exitosos</h4><p id="servicios-exitosos">...</p></div>
            </section>
            <section class="table-container"><h3>Detalle de Servicios</h3><div class="table-wrapper">
                <table class="data-table"><thead><tr><th>Fecha</th><th>Folio Recepción</th><th>Folio Cierre</th><th>Folio Anticipo</th><th>Cliente</th><th>Marca</th><th>Modelo</th><th>Tipo Servicio</th><th>Estado</th></tr></thead>
                <tbody id="servicios-table-body"></tbody></table></div></section>`;
    }
    function updateServiciosTab(data) {
        document.getElementById('total-servicios').textContent = data.length;
        document.getElementById('servicios-exitosos').textContent = data.filter(r => r.Estado === 'ENTREGADO CON EXITO').length;
        renderTable('servicios-table-body', data, ['Fecha Recepción', 'Folio Recepción', 'Folio Cierre', 'Folio Anticipo que Dejó', 'Cliente', 'Marca', 'Modelo', 'TipoServicio', 'Estado'], folioColumns.servicios);
    }

    function initializeComprasTab() {
        document.getElementById('compras-content').innerHTML = `
            <section class="kpi-grid">
                <div class="kpi-card"><h4>Total Egresos</h4><p id="total-egresos">...</p></div>
                <div class="kpi-card"><h4># de Compras</h4><p id="num-compras">...</p></div>
            </section>
            <section class="table-container"><h3>Detalle de Egresos</h3><div class="table-wrapper">
                <table class="data-table"><thead><tr><th>Fecha</th><th>Folio Egreso</th><th>Folio Recepción</th><th>Folio Anticipo</th><th>Concepto</th><th>Monto</th></tr></thead>
                <tbody id="egresos-table-body"></tbody></table></div></section>`;
    }
    function updateComprasTab(data) {
        const totalEgresos = data.reduce((sum, r) => sum + parseFloat(r.Monto || 0), 0);
        document.getElementById('total-egresos').textContent = `$${totalEgresos.toLocaleString('es-MX')}`;
        document.getElementById('num-compras').textContent = data.length;
        renderTable('egresos-table-body', data, ['Fecha y Hora Compra', 'Folio Egreso', 'Folio Recepción', 'Folio Anticipo', 'Concepto', 'Monto'], folioColumns.compras);
    }

    function initializeAnticiposTab() {
        document.getElementById('anticipos-content').innerHTML = `
            <section class="kpi-grid">
                <div class="kpi-card"><h4>Anticipos Recibidos</h4><p id="total-anticipos">...</p></div>
                <div class="kpi-card"><h4># Piezas Pedidas</h4><p id="num-piezas">...</p></div>
            </section>
            <section class="table-container"><h3>Detalle de Anticipos</h3><div class="table-wrapper">
                <table class="data-table"><thead><tr><th>Fecha</th><th>Folio Anticipo</th><th>Folio Recepción</th><th>Folio Cierre</th><th>Cliente</th><th>Pieza</th><th>Anticipo</th></tr></thead>
                <tbody id="anticipos-table-body"></tbody></table></div></section>`;
    }
    function updateAnticiposTab(data) {
        const totalAnticipos = data.reduce((sum, r) => sum + parseFloat(r['Cantidad Anticipo'] || 0), 0);
        document.getElementById('total-anticipos').textContent = `$${totalAnticipos.toLocaleString('es-MX')}`;
        document.getElementById('num-piezas').textContent = data.length;
        renderTable('anticipos-table-body', data, ['Fecha Anticipo', 'Folio Anticipo', 'Folio Recepción', 'Folio Cierre', 'Cliente', 'Pieza', 'Cantidad Anticipo'], folioColumns.anticipos);
    }

    function initializeVentasTab() {
        const ventasContent = document.getElementById('ventas-content');
        ventasContent.innerHTML = `
            <div class="specific-filter-container">
                <label class="switch">
                    <input type="checkbox" id="convenio-filter" checked>
                    <span class="slider"></span>
                </label>
                <label for="convenio-filter">Incluir ventas por Convenio</label>
            </div>
            <section class="kpi-grid">
                <div class="kpi-card"><h4>Total Ventas</h4><p id="total-ventas">...</p></div>
                <div class="kpi-card"><h4>Total Pagos</h4><p id="total-pagos">...</p></div>
                <div class="kpi-card"><h4># de Ventas</h4><p id="num-ventas">...</p></div>
            </section>
            <section class="charts-grid">
                <div class="chart-container"><h3>Ventas por Tipo de Servicio</h3><canvas id="ventasServicioChart"></canvas></div>
                <div class="chart-container"><h3>Resultados de Servicios</h3><canvas id="resultadosChart"></canvas></div>
            </section>
            <section class="table-container">
                <h3>Detalle de Ventas</h3>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Fecha Venta</th><th>Folio Venta</th><th>Folio Recepción Final</th><th>Folio Anticipo</th><th>Anticipo en Recepción</th><th>Total Venta</th><th>Total Pagos</th></tr></thead>
                        <tbody id="ventas-table-body"></tbody>
                    </table>
                </div>
            </section>
        `;
        const convenioFilter = document.getElementById('convenio-filter');
        if(convenioFilter) {
            convenioFilter.addEventListener('change', masterFilterAndUpdate);
        }
        charts.ventasServicio = createChart('ventasServicioChart', 'bar');
        charts.resultados = createChart('resultadosChart', 'pie');
    }

    function updateVentasTab(data) {
        const totalVentasEl = document.getElementById('total-ventas');
        const totalPagosEl = document.getElementById('total-pagos');
        const numVentasEl = document.getElementById('num-ventas');

        if(totalVentasEl && totalPagosEl && numVentasEl) {
            const totalVentas = data.reduce((sum, r) => sum + parseFloat(r['Total Venta'] || 0), 0);
            const totalPagos = data.reduce((sum, r) => sum + parseFloat(r['Total Pagos'] || 0), 0);
            totalVentasEl.textContent = `$${totalVentas.toLocaleString('es-MX')}`;
            totalPagosEl.textContent = `$${totalPagos.toLocaleString('es-MX')}`;
            numVentasEl.textContent = data.length;
        }
        updateChartData(charts.ventasServicio, data, 'TipoServicio', 'Total Venta');
        updateChartData(charts.resultados, data, 'Resultado Servicio');
        renderTable('ventas-table-body', data, ['Fecha Venta', 'Folio Venta', 'Folio Recepción Final', 'Folio Anticipo', 'Anticipo en Recepción', 'Total Venta', 'Total Pagos'], folioColumns.ventas);
    }

    function handleTraceClick(event) {
        const target = event.target;
        if (target.classList.contains('trace-link')) {
            const folio = target.dataset.folio;
            const tabId = target.dataset.targetTab;
            const folioType = target.dataset.folioType;

            if (!folio || !tabId) return;

            activeFolioFilter = { type: folioType, value: folio };
            showDashboard(tabId);
        }
    }

    function clearFolioFilter() {
        activeFolioFilter = null;
        masterFilterAndUpdate();
    }

    function renderTable(bodyId, data, columns, folioConfig) {
        const tableBody = document.getElementById(bodyId);
        if (!tableBody) return;
        tableBody.innerHTML = '';
        data.slice(0, 150).forEach(row => {
            const cells = columns.map(col => {
                const value = row[col] || '';
                let cellHTML = `<td>${value}</td>`;
                if (folioConfig && value) {
                    if (folioConfig.links[col]) {
                        cellHTML = `<td><span class="trace-link" data-folio="${value}" data-target-tab="${folioConfig.links[col]}" data-folio-type="${col}">${value}</span></td>`;
                    } else if (folioConfig.primary === col) {
                         cellHTML = `<td><strong>${value}</strong></td>`;
                    }
                }
                return cellHTML;
            });
            tableBody.innerHTML += `<tr>${cells.join('')}</tr>`;
        });
    }

    function parseCustomDate(dateString) { if (!dateString || typeof dateString !== 'string') return null; const parts = dateString.split(' ')[0].split('/'); return parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : null; }
    function createChart(canvasId, type) { const ctx = document.getElementById(canvasId); if (!ctx) return null; const chartConfig = { type, options: { responsive: true, maintainAspectRatio: false } }; if (type === 'bar') chartConfig.options.indexAxis = 'y'; return new Chart(ctx.getContext('2d'), chartConfig); }
    function updateChartData(chart, data, categoryCol, sumCol = null) {
        if (!chart) return;
        const filteredData = data.filter(row => row[categoryCol] && String(row[categoryCol]).trim());

        const counts = filteredData.reduce((acc, row) => {
            const category = row[categoryCol];
            const value = sumCol ? (parseFloat(row[sumCol]) || 0) : 1;
            acc[category] = (acc[category] || 0) + value;
            return acc;
        }, {});

        let sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
        chart.data.labels = sorted.map(item => item[0]);
        chart.data.datasets = [{
            data: sorted.map(item => item[1]),
            backgroundColor: ['#B22222', '#8B1A1A', '#DC3545', '#6c757d', '#1877F2', '#25D366', '#FF9800']
        }];
        chart.update();
    }
});