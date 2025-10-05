document.addEventListener('DOMContentLoaded', function () {

    const googleSheetUrl = 'PEGA_AQUÍ_LA_URL_DE_TU_CSV_PUBLICADO';

    // --- VARIABLES GLOBALES ---
    let originalData = []; // Almacenará todos los datos sin filtrar.
    let charts = {}; // Objeto para guardar nuestras instancias de gráficos y poder actualizarlos.

    // --- ELEMENTOS DEL DOM ---
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const serviceTypeFilter = document.getElementById('serviceTypeFilter');

    // Función para convertir fechas de formato "DD/MM/YYYY" a objetos Date de JS.
    function parseCustomDate(dateString) {
        if (!dateString || typeof dateString !== 'string') return null;
        // El formato de fecha en la hoja es D/M/YYYY o DD/MM/YYYY
        const parts = dateString.split(' ')[0].split('/');
        if (parts.length === 3) {
            // new Date(año, mes - 1, día)
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        return null;
    }

    function fetchData() {
        Papa.parse(googleSheetUrl, {
            download: true,
            header: true,
            dynamicTyping: true,
            transformHeader: header => header.trim(),
            complete: (results) => {
                let cleanData = results.data.filter(row => row['Folio Recepción'] != null && String(row['Folio Recepción']).trim() !== '');

                // Pre-procesamiento de datos: Convertir todas las fechas a objetos Date.
                cleanData.forEach(row => {
                    row.fechaRecepcionObj = parseCustomDate(row['Fecha Recepción']);
                    row.fechaEstimadaObj = parseCustomDate(row['Fecha Estimada de Entrega de Diagnóstico/Equipo']);
                    row.fechaCierreObj = parseCustomDate(row['Fecha Cierre']);
                });
                
                originalData = cleanData;
                initializeDashboard(originalData);
            },
            error: (error) => console.error("Error al cargar los datos:", error)
        });
    }

    function initializeDashboard(data) {
        // Llenar el filtro de tipo de servicio con opciones únicas.
        const serviceTypes = [...new Set(data.map(row => row.TipoServicio).filter(Boolean))];
        serviceTypes.sort();
        serviceTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            serviceTypeFilter.appendChild(option);
        });

        // Crear las instancias de los gráficos por primera vez.
        createCharts(data);
        
        // Actualizar todos los elementos del dashboard.
        updateDashboard(data);

        // Añadir "event listeners" para que los filtros funcionen.
        startDateInput.addEventListener('change', applyFilters);
        endDateInput.addEventListener('change', applyFilters);
        serviceTypeFilter.addEventListener('change', applyFilters);
    }
    
    function applyFilters() {
        let filteredData = [...originalData];

        const startDate = startDateInput.valueAsDate;
        const endDate = endDateInput.valueAsDate;
        const serviceType = serviceTypeFilter.value;

        // 1. Filtrar por fecha
        if (startDate && endDate) {
            filteredData = filteredData.filter(row => {
                const rowDate = row.fechaRecepcionObj;
                return rowDate >= startDate && rowDate <= endDate;
            });
        }
        
        // 2. Filtrar por tipo de servicio
        if (serviceType && serviceType !== 'todos') {
            filteredData = filteredData.filter(row => row.TipoServicio === serviceType);
        }

        // 3. Actualizar el dashboard con los datos filtrados.
        updateDashboard(filteredData);
    }

    function updateDashboard(data) {
        updateKPIs(data);
        updateCharts(data);
        displayTopModels(data);
    }
    
    function updateKPIs(data) {
        // KPI 1: Total de servicios
        document.getElementById('total-servicios').textContent = data.length;

        // KPI 2: Puntualidad
        let onTimeCount = 0;
        let validForPunctuality = 0;
        data.forEach(row => {
            if (row.fechaCierreObj && row.fechaEstimadaObj) {
                validForPunctuality++;
                if (row.fechaCierreObj <= row.fechaEstimadaObj) {
                    onTimeCount++;
                }
            }
        });
        const punctualityRate = validForPunctuality > 0 ? (onTimeCount / validForPunctuality * 100).toFixed(1) : 0;
        document.getElementById('puntualidad').textContent = `${punctualityRate}%`;

        // KPI 3: Tiempo promedio de cierre
        let totalDays = 0;
        let closedCount = 0;
        const oneDay = 24 * 60 * 60 * 1000; // milisegundos en un día
        data.forEach(row => {
            if (row.fechaRecepcionObj && row.fechaCierreObj) {
                const diffDays = Math.round(Math.abs((row.fechaCierreObj - row.fechaRecepcionObj) / oneDay));
                totalDays += diffDays;
                closedCount++;
            }
        });
        const avgDays = closedCount > 0 ? (totalDays / closedCount).toFixed(1) : 0;
        document.getElementById('tiempo-promedio').textContent = `${avgDays} días`;
    }

    function countOccurrences(data, columnName) {
        const counts = {};
        for (const row of data) {
            const value = row[columnName];
            if (value) {
                counts[value] = (counts[value] || 0) + 1;
            }
        }
        return counts;
    }

    function createCharts() {
        // Esta función ahora solo crea las instancias vacías de los gráficos.
        const servicesCtx = document.getElementById('serviciosChart').getContext('2d');
        charts.servicios = new Chart(servicesCtx, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Número de Servicios', data: [], backgroundColor: 'rgba(178, 34, 34, 0.7)', borderColor: 'rgba(178, 34, 34, 1)', borderWidth: 1 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
        });

        const marcasCtx = document.getElementById('marcasChart').getContext('2d');
        charts.marcas = new Chart(marcasCtx, {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: ['#B22222', '#8B1A1A', '#25D366', '#1877F2', '#FF9800', '#6c757d', '#34A853', '#EA4335'], hoverOffset: 4 }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    
    function updateCharts(data) {
        // Actualizar gráfico de Servicios
        const serviciosData = countOccurrences(data, 'TipoServicio');
        const sortedServicios = Object.entries(serviciosData).sort(([,a],[,b]) => b-a);
        charts.servicios.data.labels = sortedServicios.map(item => item[0]);
        charts.servicios.data.datasets[0].data = sortedServicios.map(item => item[1]);
        charts.servicios.update();

        // Actualizar gráfico de Marcas
        const marcasData = countOccurrences(data, 'Marca');
        const sortedMarcas = Object.entries(marcasData).sort(([,a],[,b]) => b-a);
        charts.marcas.data.labels = sortedMarcas.map(item => item[0]);
        charts.marcas.data.datasets[0].data = sortedMarcas.map(item => item[1]);
        charts.marcas.update();
    }
    
    function displayTopModels(data) {
        const modelsData = countOccurrences(data, 'Modelo_ver');
        const sortedModels = Object.entries(modelsData).sort(([,a],[,b]) => b - a).slice(0, 5);
        const listElement = document.getElementById('topModelsList');
        listElement.innerHTML = '';
        sortedModels.forEach(model => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `${model[0]} <span>${model[1]}</span>`;
            listElement.appendChild(listItem);
        });
    }

    fetchData();
});
