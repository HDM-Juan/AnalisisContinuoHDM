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
    let activeFolioFilter = null;

    // --- ELEMENTOS DEL DOM ---
    const validezFilter = document.getElementById('validez-filter');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const convenioFilter = document.getElementById('convenio-filter');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const folioFilterStatus = document.getElementById('folio-filter-status');
    
    // --- MAPEO DE COLUMNAS DE FOLIO PARA TRAZABILIDAD ---
    const folioColumns = {
        servicios: { primary: 'Folio Recepción', links: { 'Folio Cierre': 'ventas', 'Folio Anticipo que Dejó': 'anticipos' } },
        compras: { primary: 'Folio Egreso', links: { 'Folio Recepción': 'servicios', 'Folio Anticipo': 'anticipos' } },
        anticipos: { primary: 'Folio Anticipo', links: { 'Folio Recepción': 'servicios', 'Folio Cierre': 'ventas' } },
        ventas: { primary: 'Folio Venta', links: { 'Folio Recepción Final': 'servicios', 'Folio Anticipo': 'anticipos', 'Anticipo en Recepción': 'anticipos' } }
    };

    // --- LÓGICA PRINCIPAL ---
    function fetchAndCleanData(url, primaryKey) {
        return new Promise((resolve, reject) => {
            Papa.parse(url, {
                download: true,
                header: false,
                skipEmptyLines: true,
                complete: (results) => {
                    const data = results.data;
                    if (!data || data.length < 2) {
                        return resolve([]);
                    }

                    const headerRow = data[0];
                    const dataRows = data.slice(1);

                    const primaryKeyIndex = headerRow.findIndex(h => typeof h === 'string' && h.trim() === primaryKey);

                    if (primaryKeyIndex === -1) {
                         // Fallback for slightly different primary key names
                        const altPrimaryKey = primaryKey.replace('Ventas', 'Venta');
                        const altIndex = headerRow.findIndex(h => typeof h === 'string' && h.trim() === altPrimaryKey);
                        if(altIndex !== -1) {
                            primaryKeyIndex = altIndex;
                        } else {
                            console.error(`Clave primaria "${primaryKey}" no encontrada en ${url}`);
                            return resolve([]);
                        }
                    }

                    const headers = headerRow;
                    const cleanedData = dataRows.map(row => {
                        let obj = {};
                        headers.forEach((header, index) => {
                            if (header) {
                                obj[String(header).trim()] = row[index];
                            }
                        });
                        return obj;
                    }).filter(r => r[primaryKey] || r[primaryKey.replace('Ventas', 'Venta')]);

                    resolve(cleanedData);
                },
                error: (error) => {
                    console.error(`Error al parsear ${url}:`, error);
                    reject(error);
                }
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
        initializeDashboard();
    }).catch(error => console.error("Error crítico al cargar datos:", error));

    function initializeDashboard() {
        tabButtons.forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
        [validezFilter, startDateInput, endDateInput, convenioFilter].forEach(el => el.addEventListener('change', masterFilterAndUpdate));
        folioFilterStatus.addEventListener('click', clearFolioFilter);
        document.querySelector('.container').addEventListener('click', handleTraceClick);

        initializeServiciosTab();
        initializeComprasTab();
        initializeAnticiposTab();
        initializeVentasTab();

        const initialTab = window.location.hash.replace('#', '') || 'ventas';
        switchTab(initialTab);
        masterFilterAndUpdate();
    }

    function switchTab(tabId) {
        if (!document.getElementById(`${tabId}-content`)) {
            tabId = 'ventas';
        }
        tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
        tabContents.forEach(content => content.classList.toggle('active', content.id === `${tabId}-content`));
    }

    function masterFilterAndUpdate() {
        const validez = validezFilter.value;
        const filterByValidez = data => data.filter(r => validez === 'todos' || (validez === 'validos' && r.Validez !== 'CANCELADO') || (validez === 'cancelados' && r.Validez === 'CANCELADO'));
        
        const startDate = startDateInput.valueAsDate;
        const endDate = endDateInput.valueAsDate;
        const filterByDate = (data, dateCol) => !startDate || !endDate ? data : data.filter(r => r[dateCol] >= startDate && r[dateCol] <= endDate);

        let fServicios = filterByDate(filterByValidez(originalData.servicios), 'fechaRecepcionObj');
        let fCompras = filterByDate(filterByValidez(originalData.compras), 'fechaCompraObj');
        let fAnticipos = filterByDate(filterByValidez(originalData.anticipos), 'fechaAnticipoObj');
        let fVentas = filterByDate(filterByValidez(originalData.ventas), 'fechaVentaObj');
        
        if (convenioFilter && !convenioFilter.checked) {
            fVentas = fVentas.filter(r => r['¿Convenio?'] !== true);
        }

        if (activeFolioFilter) {
            const { value } = activeFolioFilter;
            const folioNumber = String(value).match(/\d+/g)?.join('');

            const findRelated = (data, folio) => data.filter(r => {
                return Object.values(r).some(cell => {
                    if (!cell) return false;
                    const cellFolioNumber = String(cell).match(/\d+/g)?.join('');
                    return cellFolioNumber && cellFolioNumber === folio;
                });
            });

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
        const totalEgresos = data.reduce((sum, r) => sum + (r.Monto || 0), 0);
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
        const totalAnticipos = data.reduce((sum, r) => sum + (r['Cantidad Anticipo'] || 0), 0);
        document.getElementById('total-anticipos').textContent = `$${totalAnticipos.toLocaleString('es-MX')}`;
        document.getElementById('num-piezas').textContent = data.length;
        renderTable('anticipos-table-body', data, ['Fecha Anticipo', 'Folio Anticipo', 'Folio Recepción', 'Folio Cierre', 'Cliente', 'Pieza', 'Cantidad Anticipo'], folioColumns.anticipos);
    }

    function initializeVentasTab() {
        charts.ventasServicio = createChart('ventasServicioChart', 'bar');
        charts.resultados = createChart('resultadosChart', 'pie');
    }

    function updateVentasTab(data) {
        const totalVentas = data.reduce((sum, r) => sum + (r['Total Venta'] || 0), 0);
        document.getElementById('total-ventas').textContent = `$${totalVentas.toLocaleString('es-MX')}`;
        document.getElementById('total-pagos').textContent = `$${data.reduce((sum, r) => sum + (r['Total Pagos'] || 0), 0).toLocaleString('es-MX')}`;
        document.getElementById('num-ventas').textContent = data.length;
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
            switchTab(tabId);
            masterFilterAndUpdate();
        }
    }

    function clearFolioFilter(event) {
        if (event.target.classList.contains('clear-filter')) {
            activeFolioFilter = null;
            masterFilterAndUpdate();
        }
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
    function updateChartData(chart, data, categoryCol, sumCol = null) { if (!chart) return; const counts = data.reduce((acc, row) => { const category = row[categoryCol]; if (category) { const value = sumCol ? (row[sumCol] || 0) : 1; acc[category] = (acc[category] || 0) + value; } return acc; }, {}); let sorted = Object.entries(counts).sort(([, a], [, b]) => b - a); chart.data.labels = sorted.map(item => item[0]); chart.data.datasets = [{ data: sorted.map(item => item[1]), backgroundColor: ['#B22222', '#8B1A1A', '#DC3545', '#6c757d', '#1877F2', '#25D366', '#FF9800'] }]; chart.update(); }
});