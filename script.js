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
    const headerAliases = {
        'folio##recepción': 'Folio Recepción',
        'folio##recepcion': 'Folio Recepción',
        'folio recepcion': 'Folio Recepción',
        'folio recepcíon': 'Folio Recepción',
        'folio recepción': 'Folio Recepción',
        'folio recepcion final': 'Folio Recepción Final',
        'folio recepción final': 'Folio Recepción Final',
        'folio##recepción final': 'Folio Recepción Final',
        'folio##recepcion final': 'Folio Recepción Final',
        'folio##anticipo': 'Folio Anticipo',
        'folio anticipo': 'Folio Anticipo',
        'folio##anticipo que dejó': 'Folio Anticipo que Dejó',
        'folio anticipo que dejó': 'Folio Anticipo que Dejó',
        'folio anticipo que dejo': 'Folio Anticipo que Dejó',
        'folio##cierre': 'Folio Cierre',
        'folio cierre': 'Folio Cierre',
        'folio##venta': 'Folio Venta',
        'folio venta': 'Folio Venta',
        'folio ventas': 'Folio Venta',
        'datos##anticipo': 'Anticipo en Recepción',
        'anticipo en recepción': 'Anticipo en Recepción',
        'anticipo en recepcion': 'Anticipo en Recepción',
        'datos anticipo': 'Anticipo en Recepción',
        'fecha recepcion': 'Fecha Recepción',
        'fecha recepción': 'Fecha Recepción',
        'fecha recepción final': 'Fecha Recepción Final',
        'fecha recepcion final': 'Fecha Recepción Final',
        'fecha venta ': 'Fecha Venta',
        'fecha y hora compra': 'Fecha y Hora Compra',
        'fecha compra': 'Fecha y Hora Compra',
        'sku refacción': 'Sku Refacción',
        'sku refaccion': 'Sku Refacción',
        'sku_refacción': 'Sku Refacción',
        'sku_refaccion': 'Sku Refacción',
        'skurefacción': 'Sku Refacción',
        'skurefaccion': 'Sku Refacción',
        'sku': 'Sku Refacción',
        'refacción sku': 'Sku Refacción',
        'sku ref': 'Sku Refacción',
        'sku refacc': 'Sku Refacción',
        'marca servicio': 'Marca',
        'marca ': 'Marca',
        'marca': 'Marca',
        'modelo ver': 'Modelo',
        'modelo': 'Modelo',
        'modelo_ver': 'Modelo',
        'ver_modelo': 'Modelo',
        'tipo de solicitud': 'Tipo de Solicitud',
        'subtipo solicitud': 'Subtipo Solicitud',
        'detalle servicio': 'Detalle Servicio',
        'tiposervicio': 'TipoServicio',
        'tipo servicio': 'TipoServicio',
        'tipo de servicio': 'TipoServicio',
        'servicio mínimo': 'Servicio Mínimo',
        'servicio minimo': 'Servicio Mínimo',
        'servicio min': 'Servicio Mínimo',
        'costo pieza': 'Costo Pieza',
        'costo': 'Costo',
        'costo total': 'Costo',
        'total venta ': 'Total Venta',
        'total venta': 'Total Venta',
        'total pagos': 'Total Pagos',
        'resultado del servicio': 'Resultado Servicio',
        'resultado servicio': 'Resultado Servicio',
        'validez ': 'Validez',
        'validez': 'Validez',
        'vigencia ': 'Vigencia',
        'vigencia': 'Vigencia',
        'estatus': 'Estatus',
        'estado': 'Estado',
        'cantidad anticipo': 'Cantidad Anticipo',
        'folio egreso': 'Folio Egreso',
        'egreso id': 'Folio Egreso'
    };

    function normalizeHeaderKey(key) {
        if (!key) return '';
        const trimmed = String(key).trim();
        const alias = headerAliases[trimmed.toLowerCase()];
        return alias || trimmed;
    }

    function normalizeRowKeys(row) {
        if (!row || typeof row !== 'object') return row;
        const normalized = {};
        Object.keys(row).forEach(originalKey => {
            const canonicalKey = normalizeHeaderKey(originalKey);
            const value = row[originalKey];
            if (!(canonicalKey in normalized) || (normalized[canonicalKey] == null && value != null)) {
                normalized[canonicalKey] = value;
            }
        });
        return normalized;
    }

    function ensurePrimaryKeys(row, keys) {
        for (const key of keys) {
            const canonical = normalizeHeaderKey(key);
            const value = row[canonical];
            if (value != null && String(value).trim() !== '') {
                return true;
            }
        }
        return false;
    }

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
                    const data = (results.data || []).map(normalizeRowKeys);
                    if (!data || data.length === 0) return resolve([]);
                    // Corregir 'Folio Ventas' a 'Folio Venta' si es necesario
                    if (data.length > 0 && 'Folio Ventas' in data[0] && !('Folio Venta' in data[0])) {
                        data.forEach(r => {
                            r['Folio Venta'] = r['Folio Ventas'];
                            delete r['Folio Ventas'];
                        });
                    }
                    const primaryKeys = Array.isArray(primaryKey) ? primaryKey : [primaryKey];
                    const cleanedData = data.filter(r => ensurePrimaryKeys(r, primaryKeys));
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

        const startDate = normalizeDateInput(startDateInput.value, false);
        const endDate = normalizeDateInput(endDateInput.value, true);
        const filterByDate = (data, dateCol, rawCol) => {
            if (!startDate && !endDate) return data;
            return data.filter(r => {
                let rowDate = r[dateCol];
                if (!(rowDate instanceof Date) || isNaN(rowDate)) {
                    if (rawCol) {
                        rowDate = parseCustomDate(r[rawCol]);
                        if (rowDate) {
                            r[dateCol] = rowDate;
                        }
                    }
                }
                if (!(rowDate instanceof Date) || isNaN(rowDate)) return false;
                if (startDate && rowDate < startDate) return false;
                if (endDate && rowDate > endDate) return false;
                return true;
            });
        };

        let fServicios = filterByDate(filterByValidez(originalData.servicios), 'fechaRecepcionObj', 'Fecha Recepción');
        let fCompras = filterByDate(filterByValidez(originalData.compras), 'fechaCompraObj', 'Fecha y Hora Compra');
        let fAnticipos = filterByDate(filterByValidez(originalData.anticipos), 'fechaAnticipoObj', 'Fecha Anticipo');
        let fVentas = filterByDate(filterByValidez(originalData.ventas), 'fechaVentaObj', 'Fecha Venta');
        
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
            <section class="kpi-grid secondary-kpis">
                <div class="kpi-card"><h4>Ventas con Anticipo</h4><p id="ventas-desde-anticipos">...</p><small id="ventas-desde-anticipos-count"></small></div>
                <div class="kpi-card"><h4>Ventas por Servicio</h4><p id="ventas-desde-servicios">...</p><small id="ventas-desde-servicios-count"></small></div>
                <div class="kpi-card"><h4>Ventas Directas</h4><p id="ventas-directas">...</p><small id="ventas-directas-count"></small></div>
                <div class="kpi-card"><h4>Costos Relacionados</h4><p id="total-costos-ligados">...</p><small id="egresos-logistica"></small></div>
                <div class="kpi-card"><h4>Otros Egresos</h4><p id="otros-egresos">...</p></div>
                <div class="kpi-card"><h4>Margen Estimado</h4><p id="margen-estimado">...</p><small id="margen-porcentaje"></small></div>
            </section>
            <section class="charts-grid">
                <div class="chart-container"><h3>Ventas por Tipo de Servicio</h3><canvas id="ventasServicioChart"></canvas></div>
                <div class="chart-container"><h3>Resultados de Servicios</h3><canvas id="resultadosChart"></canvas></div>
                <div class="chart-container"><h3>Tendencia de Ventas</h3><canvas id="ventasTrendChart"></canvas></div>
                <div class="chart-container"><h3>Ventas por Marca</h3><canvas id="ventasMarcaChart"></canvas></div>
                <div class="chart-container"><h3>Top 10 Piezas Vendidas</h3><canvas id="topPiezasChart"></canvas></div>
                <div class="chart-container"><h3>Margen por Tipo de Servicio</h3><canvas id="margenServicioChart"></canvas></div>
            </section>
            <section class="table-container">
                <h3>Top de Refacciones y Piezas Vendidas</h3>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>SKU</th><th>Descripción</th><th>Cantidad</th><th>Total Venta</th><th>Costo Estimado</th><th>Margen</th></tr></thead>
                        <tbody id="top-piezas-body"></tbody>
                    </table>
                </div>
            </section>
            <section class="table-container">
                <h3>Resumen por Marca y Modelo</h3>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Marca</th><th>Modelos Principales</th><th>Ventas</th><th># Operaciones</th><th>Ticket Promedio</th></tr></thead>
                        <tbody id="marca-modelo-body"></tbody>
                    </table>
                </div>
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
            <section class="table-container">
                <h3>Resumen de Egresos Relacionados</h3>
                <div class="table-wrapper">
                    <table class="data-table">
                        <thead><tr><th>Categoría</th><th>Monto</th><th>Detalle</th></tr></thead>
                        <tbody id="egresos-relacionados-body"></tbody>
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
        charts.ventasTrend = createChart('ventasTrendChart', 'line');
        charts.ventasMarca = createChart('ventasMarcaChart', 'bar');
        charts.topPiezas = createChart('topPiezasChart', 'bar');
        charts.margenServicio = createChart('margenServicioChart', 'bar');
    }

    function updateVentasTab(data, context = {}) {
        const totalVentasEl = document.getElementById('total-ventas');
        const totalPagosEl = document.getElementById('total-pagos');
        const numVentasEl = document.getElementById('num-ventas');

        const totalVentas = data.reduce((sum, r) => sum + parseAmount(r['Total Venta']), 0);
        const totalPagos = data.reduce((sum, r) => sum + parseAmount(r['Total Pagos']), 0);

        if (totalVentasEl && totalPagosEl && numVentasEl) {
            totalVentasEl.textContent = formatCurrency(totalVentas);
            totalPagosEl.textContent = formatCurrency(totalPagos);
            numVentasEl.textContent = data.length;
        }

        const analytics = buildSalesAnalytics(data, {
            servicios: context.servicios || [],
            anticipos: context.anticipos || [],
            compras: context.compras || []
        });

        const anticiposMontoEl = document.getElementById('ventas-desde-anticipos');
        const anticiposCountEl = document.getElementById('ventas-desde-anticipos-count');
        if (anticiposMontoEl) anticiposMontoEl.textContent = formatCurrency(analytics.origen.anticipos.monto);
        if (anticiposCountEl) anticiposCountEl.textContent = `${analytics.origen.anticipos.count} operaciones`;

        const serviciosMontoEl = document.getElementById('ventas-desde-servicios');
        const serviciosCountEl = document.getElementById('ventas-desde-servicios-count');
        if (serviciosMontoEl) serviciosMontoEl.textContent = formatCurrency(analytics.origen.servicios.monto);
        if (serviciosCountEl) serviciosCountEl.textContent = `${analytics.origen.servicios.count} operaciones`;

        const directasMontoEl = document.getElementById('ventas-directas');
        const directasCountEl = document.getElementById('ventas-directas-count');
        if (directasMontoEl) directasMontoEl.textContent = formatCurrency(analytics.origen.directas.monto);
        if (directasCountEl) directasCountEl.textContent = `${analytics.origen.directas.count} operaciones`;

        const costosRelacionadosEl = document.getElementById('total-costos-ligados');
        if (costosRelacionadosEl) costosRelacionadosEl.textContent = formatCurrency(analytics.egresos.relacionados.total);
        const costosLogisticaEl = document.getElementById('egresos-logistica');
        if (costosLogisticaEl) costosLogisticaEl.textContent = analytics.egresos.relacionados.logistica > 0
            ? `Logística: ${formatCurrency(analytics.egresos.relacionados.logistica)}`
            : '';
        const otrosEgresosEl = document.getElementById('otros-egresos');
        if (otrosEgresosEl) otrosEgresosEl.textContent = formatCurrency(analytics.egresos.otros);

        const margenEstimadoEl = document.getElementById('margen-estimado');
        const margenPorcentajeEl = document.getElementById('margen-porcentaje');
        if (margenEstimadoEl) margenEstimadoEl.textContent = formatCurrency(analytics.margen.total);
        if (margenPorcentajeEl) margenPorcentajeEl.textContent = totalVentas > 0
            ? `(${(analytics.margen.total / totalVentas * 100).toFixed(1)}%)`
            : '';

        if (charts.ventasServicio) {
            const palette = ['#1877F2', '#6c757d', '#DC3545', '#25D366', '#FF9800', '#B22222', '#8B1A1A'];
            const colors = analytics.serviciosPorTipo.labels.map((_, idx) => palette[idx % palette.length]);
            setChartData(charts.ventasServicio, analytics.serviciosPorTipo.labels, [{
                label: 'Monto Vendido',
                data: analytics.serviciosPorTipo.valores,
                backgroundColor: colors
            }]);
        }
        updateChartData(charts.resultados, data, 'Resultado Servicio');
        if (charts.ventasTrend) {
            setChartData(charts.ventasTrend, analytics.tendencia.labels, [{
                label: 'Ventas',
                data: analytics.tendencia.valores,
                borderColor: '#B22222',
                backgroundColor: 'rgba(178,34,34,0.2)',
                fill: true,
                tension: 0.25
            }]);
        }
        if (charts.ventasMarca) {
            const palette = ['#6c757d', '#DC3545', '#25D366', '#FF9800', '#1877F2', '#B22222', '#8B1A1A'];
            const colors = analytics.ventasPorMarca.labels.map((_, idx) => palette[idx % palette.length]);
            setChartData(charts.ventasMarca, analytics.ventasPorMarca.labels, [{
                label: 'Monto Vendido',
                data: analytics.ventasPorMarca.valores,
                backgroundColor: colors
            }]);
        }
        if (charts.topPiezas) {
            const palette = ['#FF9800', '#B22222', '#6c757d', '#25D366', '#1877F2'];
            const colors = analytics.topPiezas.labels.map((_, idx) => palette[idx % palette.length]);
            setChartData(charts.topPiezas, analytics.topPiezas.labels, [{
                label: 'Total Venta',
                data: analytics.topPiezas.valores,
                backgroundColor: colors
            }]);
        }
        if (charts.margenServicio) {
            const palette = ['#25D366', '#1877F2', '#FF9800', '#DC3545', '#6c757d'];
            const colors = analytics.margenPorTipo.labels.map((_, idx) => palette[idx % palette.length]);
            setChartData(charts.margenServicio, analytics.margenPorTipo.labels, [{
                label: 'Margen Estimado',
                data: analytics.margenPorTipo.valores,
                backgroundColor: colors
            }]);
        }

        renderTable('ventas-table-body', data, ['Fecha Venta', 'Folio Venta', 'Folio Recepción Final', 'Folio Anticipo', 'Anticipo en Recepción', 'Total Venta', 'Total Pagos'], folioColumns.ventas);
        renderTopPiezas(analytics.topPiezas.detalle);
        renderMarcaModelo(analytics.marcaModelo);
        renderEgresosRelacionados(analytics.egresos.resumenTabla);
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

    function parseCustomDate(dateValue) {
        if (!dateValue) return null;
        if (dateValue instanceof Date) {
            return isNaN(dateValue) ? null : dateValue;
        }

        const raw = String(dateValue).trim();
        if (!raw) return null;

        // Intentar formato ISO (YYYY-MM-DD)
        const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            const year = parseInt(isoMatch[1], 10);
            const month = parseInt(isoMatch[2], 10);
            const day = parseInt(isoMatch[3], 10);
            if (isValidDateParts(year, month, day)) {
                return new Date(Date.UTC(year, month - 1, day));
            }
        }

        // Intentar formatos con separadores (DD/MM/AAAA, MM/DD/AAAA, AAAA/MM/DD, etc.)
        const generalMatch = raw.match(/(\d{1,4})[\/-](\d{1,2})[\/-](\d{2,4})/);
        if (generalMatch) {
            let part1 = parseInt(generalMatch[1], 10);
            let part2 = parseInt(generalMatch[2], 10);
            let part3 = parseInt(generalMatch[3], 10);

            if (generalMatch[3].length === 2) {
                part3 += part3 >= 70 ? 1900 : 2000;
            }

            let day, month, year;
            if (generalMatch[1].length === 4) {
                year = part1;
                month = part2;
                day = part3;
            } else if (part1 > 12 && part2 <= 12) {
                day = part1;
                month = part2;
                year = part3;
            } else if (part2 > 12 && part1 <= 12) {
                month = part1;
                day = part2;
                year = part3;
            } else {
                day = part1;
                month = part2;
                year = part3;
            }

            if (isValidDateParts(year, month, day)) {
                return new Date(Date.UTC(year, month - 1, day));
            }
        }

        // Intentar interpretación por número de serie de Excel
        const serial = Number(raw);
        if (!Number.isNaN(serial) && serial > 59) {
            const excelEpoch = Date.UTC(1899, 11, 30);
            return new Date(excelEpoch + serial * 24 * 60 * 60 * 1000);
        }

        return null;
    }

    function isValidDateParts(year, month, day) {
        if (!year || !month || !day) return false;
        if (month < 1 || month > 12 || day < 1 || day > 31) return false;
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    }
    function normalizeDateInput(value, endOfDay) {
        if (!value) return null;
        const [year, month, day] = value.split('-').map(Number);
        if (!year || !month || !day) return null;
        const hours = endOfDay ? 23 : 0;
        const minutes = endOfDay ? 59 : 0;
        const seconds = endOfDay ? 59 : 0;
        const millis = endOfDay ? 999 : 0;
        return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds, millis));
    }
    function createChart(canvasId, type) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        const config = {
            type,
            data: { labels: [], datasets: [] },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        };
        if (type === 'bar') {
            config.options.indexAxis = 'y';
            config.options.scales = {
                x: { beginAtZero: true },
                y: { ticks: { autoSkip: false } }
            };
        }
        if (type === 'line') {
            config.options.scales = {
                x: { type: 'category', ticks: { autoSkip: true } },
                y: { beginAtZero: true }
            };
        }
        return new Chart(canvas.getContext('2d'), config);
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
