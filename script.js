document.addEventListener('DOMContentLoaded', function () {
    // --- URLs DE DATOS ---
    const serviciosUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxKT2sTncuJZP4_Bov1Gw1j7ixqNTfW7yGNn8nmAz8gDPauVeBt-8zqCEZWABXI0-BBDEQ4eTvZZkV/pub?gid=748915905&single=true&output=csv';
    const egresosUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxKT2sTncuJZP4_Bov1Gw1j7ixqNTfW7yGNn8nmAz8gDPauVeBt-8zqCEZWABXI0-BBDEQ4eTvZZkV/pub?gid=1961448383&single=true&output=csv';
    const anticiposUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxKT2sTncuJZP4_Bov1Gw1j7ixqNTfW7yGNn8nmAz8gDPauVeBt-8zqCEZWABXI0-BBDEQ4eTvZZkV/pub?gid=46329458&single=true&output=csv';

    // --- VARIABLES GLOBALES ---
    let originalServiciosData = [];
    let originalEgresosData = [];
    let originalAnticiposData = [];
    let charts = {};

    // --- ELEMENTOS DEL DOM ---
    const validezFilter = document.getElementById('validez-filter');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // --- LÓGICA PRINCIPAL ---
    
    function fetchData(url) {
        return new Promise((resolve, reject) => {
            Papa.parse(url, {
                download: true, header: true, dynamicTyping: true, transformHeader: h => h.trim(),
                complete: results => resolve(results.data),
                error: error => reject(error)
            });
        });
    }

    Promise.all([fetchData(serviciosUrl), fetchData(egresosUrl), fetchData(anticiposUrl)])
        .then(([serviciosData, egresosData, anticiposData]) => {
            // Limpieza y pre-procesamiento de datos
            originalServiciosData = serviciosData.filter(r => r['Folio Recepción']).map(r => ({ ...r, fechaRecepcionObj: parseCustomDate(r['Fecha Recepción']) }));
            originalEgresosData = egresosData.filter(r => r['Folio Egreso']).map(r => ({ ...r, fechaCompraObj: parseCustomDate(r['Fecha y Hora Compra']) }));
            originalAnticiposData = anticiposData.filter(r => r['Folio Anticipo']).map(r => ({ ...r, fechaAnticipoObj: parseCustomDate(r['Fecha Anticipo']) }));
            
            initializeDashboard();
        })
        .catch(error => console.error("Error crítico al cargar datos:", error));

    function initializeDashboard() {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                button.classList.add('active');
                document.getElementById(button.dataset.tab + '-content').classList.add('active');
            });
        });

        [validezFilter, startDateInput, endDateInput].forEach(el => el.addEventListener('change', masterFilterAndUpdate));
        
        initializeServiciosTab();
        initializeComprasTab();
        initializeAnticiposTab();

        masterFilterAndUpdate();
    }

    function masterFilterAndUpdate() {
        const validez = validezFilter.value;
        const filterByValidez = (data) => data.filter(r => {
            const isCancelled = r.Validez === 'CANCELADO';
            if (validez === 'validos') return !isCancelled;
            if (validez === 'cancelados') return isCancelled;
            return true;
        });

        const startDate = startDateInput.valueAsDate;
        const endDate = endDateInput.valueAsDate;
        const filterByDate = (data, dateColumn) => {
            if (!startDate || !endDate) return data;
            return data.filter(r => r[dateColumn] >= startDate && r[dateColumn] <= endDate);
        };

        updateServiciosTab(filterByDate(filterByValidez(originalServiciosData), 'fechaRecepcionObj'));
        updateComprasTab(filterByDate(filterByValidez(originalEgresosData), 'fechaCompraObj'));
        updateAnticiposTab(filterByDate(filterByValidez(originalAnticiposData), 'fechaAnticipoObj'));
    }

    // --- PESTAÑA "SOLICITUD DE SERVICIOS" ---
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

    // --- PESTAÑA "COMPRAS Y GASTOS" ---
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

    // --- NUEVA PESTAÑA "ANTICIPOS Y REFACCIONES" ---
    function initializeAnticiposTab() {
        document.getElementById('anticipos-kpi-container').innerHTML = `
            <div class="kpi-card"><h4>Anticipos Recibidos</h4><p id="total-anticipos">...</p></div>
            <div class="kpi-card"><h4>Costo Total Piezas</h4><p id="costo-piezas">...</p></div>
            <div class="kpi-card"><h4># Piezas Pedidas</h4><p id="num-piezas">...</p></div>`;
        document.getElementById('anticipos-table-container').innerHTML = `
            <h3>Detalle de Anticipos</h3><div class="table-wrapper"><table class="data-table">
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

    // --- FUNCIONES UTILITARIAS ---
    function parseCustomDate(dateString) { if (!dateString || typeof dateString !== 'string') return null; const parts = dateString.split(' ')[0].split('/'); return parts.length === 3 ? new Date(parts[2], parts[1] - 1, parts[0]) : null; }
    function createChart(canvasId, type) { const ctx = document.getElementById(canvasId).getContext('2d'); const chartType = type === 'pie' || type === 'doughnut' ? { type } : { type, options: { indexAxis: 'y' } }; return new Chart(ctx, { ...chartType, data: { labels: [], datasets: [{ data: [] }] }, options: { ...chartType.options, responsive: true, maintainAspectRatio: false } }); }
    function updateChartData(chart, data, categoryColumn, sumColumn = null) { const counts = data.reduce((acc, row) => { const category = row[categoryColumn]; if (category) { const value = sumColumn ? (row[sumColumn] || 0) : 1; acc[category] = (acc[category] || 0) + value; } return acc; }, {}); let sorted = Object.entries(counts).sort(([, a], [, b]) => b - a); chart.data.labels = sorted.map(item => item[0]); chart.data.datasets[0].data = sorted.map(item => item[1]); chart.data.datasets[0].backgroundColor = ['#B22222', '#8B1A1A', '#DC3545', '#6c757d', '#1877F2', '#25D366']; chart.update(); }
});
