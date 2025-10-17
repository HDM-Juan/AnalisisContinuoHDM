document.addEventListener('DOMContentLoaded', function () {
    // --- URLs DE DATOS ---
    const toProxyUrl = (originalUrl) => `/api/data?url=${encodeURIComponent(originalUrl)}`;
    const gid_base = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxKT2sTncuJZP4_Bov1Gw1j7ixqNTfW7yGNn8nmAz8gDPauVeBt-8zqCEZWABXI0-BBDEQ4eTvZZkV/pub?single=true&output=csv';

    const serviciosUrl = toProxyUrl(`${gid_base}&gid=748915905`);
    const egresosUrl = toProxyUrl(`${gid_base}&gid=1961448383`);
    const anticiposUrl = toProxyUrl(`${gid_base}&gid=46329458`);
    const ventasUrl = toProxyUrl(`${gid_base}&gid=681275414`);
    const detalleVentaUrl = toProxyUrl(`${gid_base}&gid=553669204`);

    // --- VARIABLES GLOBALES ---
    let originalData = {
        servicios: [],
        compras: [],
        anticipos: [],
        ventas: [],
        detalleVenta: []
    };
    let charts = {};
    let detalleVentaIndex = new Map();
    let comprasSkuIndex = new Map();
    let activeFolioFilter = null;

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
        masterFilterAndUpdate();
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

    // --- INICIALIZACIÓN DE LA UI ---
    // Se configura la UI y los listeners de inmediato
    function initializeUI() {
        // Listeners de Navegación Principal
        sectionLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = link.hash.replace('#', '');
                showDashboard(tabId);
            });
        });
        backToLandingButton.addEventListener('click', (e) => {
            e.preventDefault();
            showLandingPage();
        });

        // Listeners del Dashboard
        tabButtons.forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
        applyFiltersButton.addEventListener('click', masterFilterAndUpdate);
        folioFilterStatus.addEventListener('click', clearFolioFilter);
        dashboardView.addEventListener('click', handleTraceClick);

        // Inicializar la estructura de las Pestañas
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

    // --- CARGA DE DATOS ---
    // Se cargan los datos en segundo plano y se actualiza la UI cuando estén listos
    function loadData() {
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
            detalleVentaIndex = buildDetalleIndex(originalData.detalleVenta);
            comprasSkuIndex = buildComprasSkuIndex(originalData.compras);
            // Una vez cargados los datos, se actualizan las vistas que lo necesiten
            masterFilterAndUpdate();
        }).catch(error => {
            console.error("Error crítico al cargar datos:", error);
            // Opcional: Mostrar un mensaje de error en la UI
        });
    }

    initializeUI();
    loadData();

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
        const validez = validezFilter.value;
        const filterByValidez = data => {
            if (validez === 'todos') return data;
            return data.filter(r => r.Validez === validez);
        };
        
        const startDate = startDateInput.valueAsDate;
        const endDate = endDateInput.valueAsDate;
        if (endDate) {
            endDate.setHours(23, 59, 59, 999);
        }

        const filterByDate = (data, dateCol) => {
            if (!startDate && !endDate) return data;
            return data.filter(r => {
                const rowDate = r[dateCol];
                if (!(rowDate instanceof Date) || isNaN(rowDate)) return false;
                if (startDate && rowDate < startDate) return false;
                if (endDate && rowDate > endDate) return false;
                return true;
            });
        };

        let fServicios = filterByDate(filterByValidez(originalData.servicios), 'fechaRecepcionObj');
        let fCompras = filterByDate(filterByValidez(originalData.compras), 'fechaCompraObj');
        let fAnticipos = filterByDate(filterByValidez(originalData.anticipos), 'fechaAnticipoObj');
        let fVentas = filterByDate(filterByValidez(originalData.ventas), 'fechaVentaObj');
        
        // Filtros específicos para Servicios
        const serviciosVigenciaFilter = document.getElementById('servicios-vigencia-filter');
        if (serviciosVigenciaFilter && serviciosVigenciaFilter.value !== 'todos') {
            fServicios = fServicios.filter(r => r.Vigencia === serviciosVigenciaFilter.value);
        }
        const serviciosEstatusFilter = document.getElementById('servicios-estatus-filter');
        if (serviciosEstatusFilter && serviciosEstatusFilter.value !== 'todos') {
            fServicios = fServicios.filter(r => r.Estatus === serviciosEstatusFilter.value);
        }

        // Filtros específicos para Anticipos
        const anticiposVigenciaFilter = document.getElementById('anticipos-vigencia-filter');
        if (anticiposVigenciaFilter && anticiposVigenciaFilter.value !== 'todos') {
            fAnticipos = fAnticipos.filter(r => r.Vigencia === anticiposVigenciaFilter.value);
        }
        const anticiposEstatusFilter = document.getElementById('anticipos-estatus-filter');
        if (anticiposEstatusFilter && anticiposEstatusFilter.value !== 'todos') {
            fAnticipos = fAnticipos.filter(r => r.Estatus === anticiposEstatusFilter.value);
        }

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
        updateVentasTab(fVentas, { servicios: fServicios, anticipos: fAnticipos, compras: fCompras });
    }
    
    function initializeServiciosTab() {
        document.getElementById('servicios-content').innerHTML = `
            <div class="specific-filter-container">
                <div class="filter-group">
                    <label for="servicios-vigencia-filter">Vigencia:</label>
                    <select id="servicios-vigencia-filter">
                        <option value="todos">Todos</option>
                        <option value="Vigente">Vigente</option>
                        <option value="Vencido">Vencido</option>
                        <option value="Mes Vencido">Mes Vencido</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label for="servicios-estatus-filter">Estatus:</label>
                    <select id="servicios-estatus-filter">
                        <option value="todos">Todos</option>
                        <option value="Abierto">Abierto</option>
                        <option value="Sin Comenzar">Sin Comenzar</option>
                        <option value="Cerrado">Cerrado</option>
                        <option value="En Trámite">En Trámite</option>
                    </select>
                </div>
            </div>
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
            <div class="specific-filter-container">
                <div class="filter-group">
                    <label for="anticipos-vigencia-filter">Vigencia:</label>
                    <select id="anticipos-vigencia-filter">
                        <option value="todos">Todos</option>
                        <option value="Vigente">Vigente</option>
                        <option value="Vencido">Vencido</option>
                        <option value="Mes Vencido">Mes Vencido</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label for="anticipos-estatus-filter">Estatus:</label>
                    <select id="anticipos-estatus-filter">
                        <option value="todos">Todos</option>
                        <option value="Abierto">Abierto</option>
                        <option value="Utilizado">Utilizado</option>
                        <option value="En Trámite">En Trámite</option>
                    </select>
                </div>
            </div>
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
            const folioRecepcionHTML = r['Folio Recepción Final'] ? `<span class="trace-link" data-folio="${r['Folio Recepción Final']}" data-target-tab="servicios">${r['Folio Recepción Final']}</span>` : '';
            const folioAnticipoHTML = r['Folio Anticipo'] ? `<span class="trace-link" data-folio="${r['Folio Anticipo']}" data-target-tab="anticipos">${r['Folio Anticipo']}</span>` : '';
            tableBody.innerHTML += `<tr>
                <td>${r['Fecha Venta'] || ''}</td><td>${r['Folio Venta']}</td>
                <td>${folioRecepcionHTML}</td><td>${folioAnticipoHTML}</td>
                <td>$${(r['Total Venta'] || 0).toFixed(2)}</td><td>$${(r['Total Pagos'] || 0).toFixed(2)}</td>
            </tr>`;
        });
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

    function parseCustomDate(dateString) {
        if (!dateString || typeof dateString !== 'string') return null;
        const parts = dateString.split(' ')[0].split('/');
        if (parts.length !== 3) return null;
        const [day, month, year] = parts.map(Number);
        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
        // Create date in local time to match valueAsDate
        return new Date(year, month - 1, day);
    }
    function updateChartData(chart, data, categoryCol, sumCol = null) {
        if (!chart) return;
        const filteredData = data.filter(row => row && row[categoryCol] && String(row[categoryCol]).trim());

        const counts = filteredData.reduce((acc, row) => {
            const category = row[categoryCol];
            const value = sumCol ? (parseFloat(row[sumCol]) || 0) : 1;
            acc[category] = (acc[category] || 0) + value;
            return acc;
        }, {});

        const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
        chart.data.labels = sorted.map(item => item[0]);
        chart.data.datasets = [{
            data: sorted.map(item => item[1]),
            backgroundColor: ['#B22222', '#8B1A1A', '#DC3545', '#6c757d', '#1877F2', '#25D366', '#FF9800']
        }];
        chart.update();
    }

    function setChartData(chart, labels, datasets) {
        if (!chart) return;
        chart.data.labels = labels;
        chart.data.datasets = datasets;
        chart.update();
    }

    function renderTopPiezas(items) {
        const body = document.getElementById('top-piezas-body');
        if (!body) return;
        body.innerHTML = '';
        items.forEach(item => {
            body.innerHTML += `<tr><td>${item.sku || ''}</td><td>${item.descripcion || ''}</td><td>${item.cantidad}</td><td>${formatCurrency(item.venta)}</td><td>${formatCurrency(item.costo)}</td><td>${formatCurrency(item.margen)}</td></tr>`;
        });
    }

    function renderMarcaModelo(items) {
        const body = document.getElementById('marca-modelo-body');
        if (!body) return;
        body.innerHTML = '';
        items.forEach(item => {
            const modelos = item.modelos.length > 0
                ? item.modelos.slice(0, 3).map(m => `${m.nombre} (${m.count})`).join('<br>')
                : 'Sin datos';
            body.innerHTML += `<tr><td>${item.marca}</td><td>${modelos}</td><td>${formatCurrency(item.venta)}</td><td>${item.count}</td><td>${formatCurrency(item.ticketPromedio)}</td></tr>`;
        });
    }

    function renderEgresosRelacionados(items) {
        const body = document.getElementById('egresos-relacionados-body');
        if (!body) return;
        body.innerHTML = '';
        items.forEach(item => {
            body.innerHTML += `<tr><td>${item.categoria}</td><td>${formatCurrency(item.monto)}</td><td>${item.detalle}</td></tr>`;
        });
    }

    function buildDetalleIndex(rows) {
        const index = new Map();
        if (!Array.isArray(rows)) return index;
        rows.forEach(row => {
            const folio = normalizeFolio(getRowValue(row, ['Folio Venta', 'Folio Venta#', 'Folio##Venta']));
            if (!folio) return;
            if (!index.has(folio)) index.set(folio, []);
            index.get(folio).push(row);
        });
        return index;
    }

    function buildComprasSkuIndex(rows) {
        const index = new Map();
        if (!Array.isArray(rows)) return index;
        rows.forEach(row => {
            const sku = normalizeSku(getRowValue(row, ['SKU Refacción', 'Sku Refacción', 'SKURefacción', 'skurefacción', 'SKU Refaccion', 'SKU', 'Refacción SKU']));
            if (!sku) return;
            const monto = parseAmount(getRowValue(row, ['Monto', 'Costo', 'Costo Pieza', 'Costo pieza', 'Costo Unitario']));
            if (!index.has(sku)) {
                index.set(sku, { sku, montoTotal: 0, registros: [] });
            }
            const entry = index.get(sku);
            entry.montoTotal += monto;
            entry.registros.push(row);
        });
        return index;
    }

    function buildSalesAnalytics(ventas, contexto) {
        const servicios = Array.isArray(contexto.servicios) ? contexto.servicios : [];
        const anticipos = Array.isArray(contexto.anticipos) ? contexto.anticipos : [];
        const compras = Array.isArray(contexto.compras) ? contexto.compras : [];

        const serviciosPorFolio = new Map();
        const serviciosPorRecepcionFinal = new Map();
        servicios.forEach(row => {
            const folioRecepcion = normalizeFolio(getRowValue(row, ['Folio Recepción', 'Folio##Recepción', 'Folio Recepcion']));
            const folioRecepcionFinal = normalizeFolio(getRowValue(row, ['Folio Recepción Final', 'Folio Recepcion Final']));
            if (folioRecepcion) serviciosPorFolio.set(folioRecepcion, row);
            if (folioRecepcionFinal) serviciosPorRecepcionFinal.set(folioRecepcionFinal, row);
        });

        const anticiposPorFolio = new Map();
        const anticiposPorRecepcion = new Map();
        anticipos.forEach(row => {
            const folioAnticipo = normalizeFolio(getRowValue(row, ['Folio Anticipo', 'Folio##Anticipo']));
            const folioRecepcion = normalizeFolio(getRowValue(row, ['Folio Recepción', 'Folio Recepcion', 'Folio Recepción Ligado']));
            if (folioAnticipo) anticiposPorFolio.set(folioAnticipo, row);
            if (folioRecepcion) anticiposPorRecepcion.set(folioRecepcion, row);
        });

        const serviciosFolios = new Set([...serviciosPorFolio.keys(), ...serviciosPorRecepcionFinal.keys()]);
        const anticiposFolios = new Set([...anticiposPorFolio.keys(), ...anticiposPorRecepcion.keys()]);

        const tendenciaMapa = new Map();
        const marcaModeloMapa = new Map();
        const origen = {
            anticipos: { monto: 0, count: 0 },
            servicios: { monto: 0, count: 0 },
            directas: { monto: 0, count: 0 }
        };
        const margenPorTipo = new Map();
        const topPiezasMapa = new Map();

        const ventasFolios = new Set();

        ventas.forEach(venta => {
            const folioVenta = normalizeFolio(getRowValue(venta, ['Folio Venta', 'Folio##Venta']));
            if (folioVenta) ventasFolios.add(folioVenta);
            const montoVenta = parseAmount(venta['Total Venta']);
            const fecha = venta.fechaVentaObj instanceof Date && !isNaN(venta.fechaVentaObj) ? venta.fechaVentaObj : parseCustomDate(venta['Fecha Venta']);
            if (fecha instanceof Date && !isNaN(fecha)) {
                const periodo = `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
                tendenciaMapa.set(periodo, (tendenciaMapa.get(periodo) || 0) + montoVenta);
            }

            const folioRecepcion = normalizeFolio(getRowValue(venta, ['Folio Recepción Final', 'Folio Recepción', 'Folio Recepcion Final']));
            const folioAnticipo = normalizeFolio(getRowValue(venta, ['Folio Anticipo', 'Anticipo en Recepción', 'Datos Anticipo']));

            const servicio = folioRecepcion ? (serviciosPorRecepcionFinal.get(folioRecepcion) || serviciosPorFolio.get(folioRecepcion)) : null;
            const anticipo = folioAnticipo ? anticiposPorFolio.get(folioAnticipo) : (folioRecepcion ? anticiposPorRecepcion.get(folioRecepcion) : null);

            if (anticipo) {
                origen.anticipos.monto += montoVenta;
                origen.anticipos.count += 1;
            } else if (servicio) {
                origen.servicios.monto += montoVenta;
                origen.servicios.count += 1;
            } else {
                origen.directas.monto += montoVenta;
                origen.directas.count += 1;
            }

            const tipoServicio = getRowValue(servicio, ['TipoServicio', 'Tipo de Servicio', 'tipo de solicitud']);

            const marca = getRowValue(servicio, ['Marca', 'marca', 'Marca Servicio']) || getRowValue(anticipo, ['Marca', 'marca']) || getRowValue(venta, ['Marca']);
            const modelo = getRowValue(servicio, ['Modelo', 'modelo', 'Modelo ver', 'modelo_ver']) || getRowValue(anticipo, ['ver_modelo', 'Modelo', 'Modelo Ver']) || getRowValue(venta, ['Modelo']);
            const marcaKey = marca || 'Sin Marca';
            if (!marcaModeloMapa.has(marcaKey)) {
                marcaModeloMapa.set(marcaKey, { marca: marcaKey, venta: 0, count: 0, modelos: new Map() });
            }
            const marcaEntry = marcaModeloMapa.get(marcaKey);
            marcaEntry.venta += montoVenta;
            marcaEntry.count += 1;
            if (modelo) {
                const modeloKey = modelo;
                marcaEntry.modelos.set(modeloKey, (marcaEntry.modelos.get(modeloKey) || 0) + 1);
            }

            const tipoClave = tipoServicio || 'Sin Tipo';
            if (!margenPorTipo.has(tipoClave)) {
                margenPorTipo.set(tipoClave, { venta: 0, costo: 0 });
            }
            const margenEntry = margenPorTipo.get(tipoClave);
            margenEntry.venta += montoVenta;

            let costoVenta = 0;
            const detalles = folioVenta ? detalleVentaIndex.get(folioVenta) : null;
            if (detalles && detalles.length > 0) {
                detalles.forEach(det => {
                    const sku = normalizeSku(getRowValue(det, ['SKU', 'SKU Refacción', 'Sku Refacción', 'SKURefacción', 'SkuRefacción']));
                    const descripcion = getRowValue(det, ['Descripción', 'Descripcion', 'Detalle', 'Pieza', 'Concepto']) || (sku || 'Detalle no especificado');
                    const cantidad = parseFloat(getRowValue(det, ['Cantidad', 'Qty', 'Cantidad Vendida'])) || 1;
                    const importe = parseAmount(getRowValue(det, ['Importe', 'Total', 'Subtotal']));
                    const precioUnitario = parseAmount(getRowValue(det, ['Precio Venta', 'Precio unitario', 'Precio Unitario']));
                    let totalLinea = importe;
                    if (totalLinea === 0 && precioUnitario > 0) {
                        totalLinea = precioUnitario * cantidad;
                    }
                    if (totalLinea === 0 && detalles.length > 0) {
                        totalLinea = montoVenta / detalles.length;
                    }
                    if (totalLinea === 0) {
                        totalLinea = montoVenta;
                    }

                    const costoDetalle = parseAmount(getRowValue(det, ['Costo', 'Costo Pieza', 'Costo Unitario']));
                    let costoAsignado = 0;
                    if (costoDetalle > 0) {
                        costoAsignado = costoDetalle;
                    } else if (sku && comprasSkuIndex.has(sku)) {
                        const compraInfo = comprasSkuIndex.get(sku);
                        costoAsignado = (compraInfo.montoTotal / Math.max(compraInfo.registros.length, 1)) * cantidad;
                    }
                    const key = sku || descripcion;
                    if (!topPiezasMapa.has(key)) {
                        topPiezasMapa.set(key, { sku, descripcion, cantidad: 0, venta: 0, costo: 0 });
                    }
                    const entry = topPiezasMapa.get(key);
                    entry.cantidad += cantidad;
                    entry.venta += totalLinea;
                    entry.costo += costoAsignado;
                    costoVenta += costoAsignado;
                });
            } else {
                const sku = normalizeSku(getRowValue(anticipo, ['SKU Refacción', 'Sku Refacción', 'SKU']));
                const descripcion = getRowValue(anticipo, ['Pieza', 'Pieza solicitada', 'Detalle']) || getRowValue(servicio, ['Detalle servicio', 'Detalle Servicio']);
                if (sku || descripcion) {
                    const key = sku || descripcion;
                    if (!topPiezasMapa.has(key)) {
                        topPiezasMapa.set(key, { sku, descripcion: descripcion || sku, cantidad: 0, venta: 0, costo: 0 });
                    }
                    const entry = topPiezasMapa.get(key);
                    entry.cantidad += 1;
                    entry.venta += montoVenta;
                    if (sku && comprasSkuIndex.has(sku)) {
                        const compraInfo = comprasSkuIndex.get(sku);
                        const costoPromedio = compraInfo.montoTotal / Math.max(compraInfo.registros.length, 1);
                        entry.costo += costoPromedio;
                        costoVenta += costoPromedio;
                    }
                }
            }

            margenEntry.costo += costoVenta;
        });

        const piezasConMargen = Array.from(topPiezasMapa.values()).map(item => {
            const costoEstimado = item.costo;
            const margen = item.venta - costoEstimado;
            return { ...item, costo: costoEstimado, margen };
        }).sort((a, b) => b.venta - a.venta);

        const topPiezas = piezasConMargen.slice(0, 10);

        const serviciosPorTipo = Array.from(margenPorTipo.entries()).map(([tipo, valores]) => {
            return { tipo, venta: valores.venta, costo: valores.costo, margen: valores.venta - valores.costo };
        });

        const tendencia = Array.from(tendenciaMapa.entries()).sort(([a], [b]) => a.localeCompare(b));

        const marcaModelo = Array.from(marcaModeloMapa.values()).map(entry => {
            const modelos = Array.from(entry.modelos.entries()).map(([nombre, count]) => ({ nombre, count }))
                .sort((a, b) => b.count - a.count);
            return {
                marca: entry.marca,
                venta: entry.venta,
                count: entry.count,
                ticketPromedio: entry.count > 0 ? entry.venta / entry.count : 0,
                modelos
            };
        }).sort((a, b) => b.venta - a.venta).slice(0, 15);

        const egresosResumen = calcularEgresosRelacionados(compras, {
            serviciosFolios,
            anticiposFolios,
            ventasFolios,
            piezas: piezasConMargen
        });

        const margenTotal = piezasConMargen.reduce((sum, item) => sum + item.margen, 0);

        return {
            origen,
            tendencia: {
                labels: tendencia.map(([periodo]) => periodo),
                valores: tendencia.map(([, valor]) => valor)
            },
            ventasPorMarca: {
                labels: marcaModelo.map(item => item.marca),
                valores: marcaModelo.map(item => item.venta)
            },
            serviciosPorTipo: {
                labels: serviciosPorTipo.map(item => item.tipo),
                valores: serviciosPorTipo.map(item => item.venta)
            },
            margenPorTipo: {
                labels: serviciosPorTipo.map(item => item.tipo),
                valores: serviciosPorTipo.map(item => item.margen)
            },
            topPiezas: {
                labels: topPiezas.map(item => item.descripcion || item.sku || 'Sin descripción'),
                valores: topPiezas.map(item => item.venta),
                detalle: topPiezas
            },
            marcaModelo,
            egresos: egresosResumen,
            margen: { total: margenTotal }
        };
    }

    function calcularEgresosRelacionados(compras, referencias) {
        let relacionados = 0;
        let relacionadosLogistica = 0;
        let otros = 0;
        const resumenTabla = [];
        const skuSet = new Set((referencias.piezas || []).map(item => normalizeSku(item.sku)).filter(Boolean));

        compras.forEach(row => {
            const monto = parseAmount(getRowValue(row, ['Monto', 'Costo', 'Costo Pieza', 'Costo pieza', 'Importe']));
            if (monto === 0) return;
            const folioRecepcion = normalizeFolio(getRowValue(row, ['Folio Recepción', 'Folio Recepcion']));
            const folioAnticipo = normalizeFolio(getRowValue(row, ['Folio Anticipo', 'Folio##Anticipo']));
            const folioVenta = normalizeFolio(getRowValue(row, ['Folio Venta', 'Folio##Venta']));
            const sku = normalizeSku(getRowValue(row, ['SKU Refacción', 'Sku Refacción', 'SKU']));
            const tipo = (getRowValue(row, ['Tipo', 'tipo']) || '').toString().toLowerCase();
            const subtipo = (getRowValue(row, ['Subtipo', 'subtipo', 'Subtipo solicitud']) || '').toString().toLowerCase();
            const tipoServicio = (getRowValue(row, ['Tipo Servicio', 'tipo servicio']) || '').toString().toLowerCase();
            const esLogistica = tipo.includes('log') || subtipo.includes('log') || tipoServicio.includes('log');

            const relacionado = (folioRecepcion && referencias.serviciosFolios.has(folioRecepcion)) ||
                (folioAnticipo && referencias.anticiposFolios.has(folioAnticipo)) ||
                (folioVenta && referencias.ventasFolios.has(folioVenta)) ||
                (sku && skuSet.has(sku));

            if (relacionado) {
                relacionados += monto;
                if (esLogistica) {
                    relacionadosLogistica += monto;
                }
            } else {
                otros += monto;
            }
        });

        if (relacionados > 0) {
            resumenTabla.push({ categoria: 'Costos ligados a ventas', monto: relacionados, detalle: 'Compras, refacciones y logística asociada a los folios filtrados' });
        }
        if (relacionadosLogistica > 0) {
            resumenTabla.push({ categoria: 'Logística asociada', monto: relacionadosLogistica, detalle: 'Servicios de logística vinculados a recepciones o anticipos' });
        }
        if (otros > 0) {
            resumenTabla.push({ categoria: 'Otros egresos', monto: otros, detalle: 'Gastos sin vínculo directo con las ventas filtradas' });
        }

        return {
            relacionados: {
                total: relacionados,
                logistica: relacionadosLogistica
            },
            otros,
            resumenTabla
        };
    }

    function getRowValue(row, keys) {
        if (!row) return null;
        for (const key of keys) {
            if (key in row && row[key] != null && String(row[key]).trim() !== '') {
                return row[key];
            }
        }
        return null;
    }

    function parseAmount(value) {
        if (!value && value !== 0) return 0;
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : 0;
        }
        const normalized = String(value).replace(/[^0-9,.-]/g, '').replace(/,/g, '.');
        const parsed = parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function formatCurrency(value) {
        const amount = Number(value);
        const safeAmount = Number.isFinite(amount) ? amount : 0;
        return `$${safeAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function normalizeFolio(value) {
        if (!value) return null;
        return String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    function normalizeSku(value) {
        if (!value) return null;
        return String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
});
