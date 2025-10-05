document.addEventListener('DOMContentLoaded', function () {

    const googleSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxKT2sTncuJZP4_Bov1Gw1j7ixqNTfW7yGNn8nmAz8gDPauVeBt-8zqCEZWABXI0-BBDEQ4eTvZZkV/pub?output=csv';

    // --- VARIABLES GLOBALES ---
    let originalData = []; 
    let charts = {}; 

    // --- ELEMENTOS DEL DOM (GENERALES) ---
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const serviceTypeFilter = document.getElementById('serviceTypeFilter');

    // --- ELEMENTOS DEL DOM (ANÁLISIS DE COSTOS) ---
    const deviceSelect = document.getElementById('device-select');
    const brandSelect = document.getElementById('brand-select');
    const modelSelect = document.getElementById('model-select');
    const pieceSelect = document.getElementById('piece-select');
    const variantSelect = document.getElementById('variant-select');
    const pieceCostResult = document.getElementById('piece-cost-result');
    const serviceCostSelect = document.getElementById('service-cost-select');
    const serviceCostResult = document.getElementById('service-cost-result');

    // Función para convertir fechas de formato "DD/MM/YYYY" a objetos Date de JS.
    function parseCustomDate(dateString) {
        if (!dateString || typeof dateString !== 'string') return null;
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
        // Inicialización de filtros y gráficos existentes
        const serviceTypes = [...new Set(data.map(row => row.TipoServicio).filter(Boolean))];
        serviceTypes.sort().forEach(type => {
            serviceTypeFilter.appendChild(new Option(type, type));
        });

        createCharts();
        updateDashboard(data);

        startDateInput.addEventListener('change', applyFilters);
        endDateInput.addEventListener('change', applyFilters);
        serviceTypeFilter.addEventListener('change', applyFilters);

        // --- INICIALIZACIÓN DE NUEVOS ANALIZADORES DE COSTOS ---
        setupPieceCostAnalyzer(data);
        setupServiceCostAnalyzer(data);
    }
    
    function applyFilters() {
        let filteredData = [...originalData];

        const startDate = startDateInput.valueAsDate;
        const endDate = endDateInput.valueAsDate;
        const serviceType = serviceTypeFilter.value;

        if (startDate && endDate) {
            filteredData = filteredData.filter(row => {
                const rowDate = row.fechaRecepcionObj;
                return rowDate >= startDate && rowDate <= endDate;
            });
        }
        
        if (serviceType && serviceType !== 'todos') {
            filteredData = filteredData.filter(row => row.TipoServicio === serviceType);
        }

        updateDashboard(filteredData);
    }

    function updateDashboard(data) {
        updateKPIs(data);
        updateCharts(data);
        displayTopModels(data);
    }
    
    function updateKPIs(data) {
        document.getElementById('total-servicios').textContent = data.length;

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

        let totalDays = 0;
        let closedCount = 0;
        const oneDay = 24 * 60 * 60 * 1000;
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
        const serviciosData = countOccurrences(data, 'TipoServicio');
        const sortedServicios = Object.entries(serviciosData).sort(([,a],[,b]) => b-a);
        charts.servicios.data.labels = sortedServicios.map(item => item[0]);
        charts.servicios.data.datasets[0].data = sortedServicios.map(item => item[1]);
        charts.servicios.update();

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

    // --- NUEVAS FUNCIONES PARA ANÁLISIS DE COSTOS ---
    
    function setupPieceCostAnalyzer(data) {
        const populateSelect = (selectElement, options) => {
            selectElement.innerHTML = `<option>${selectElement.firstElementChild.textContent}</option>`;
            [...new Set(options)].sort().forEach(option => {
                if (option) selectElement.appendChild(new Option(option, option));
            });
        };

        populateSelect(deviceSelect, data.map(r => r.Dispositivo));

        deviceSelect.addEventListener('change', () => {
            const selection = deviceSelect.value;
            const filteredData = data.filter(r => r.Dispositivo === selection);
            populateSelect(brandSelect, filteredData.map(r => r.Marca));
            resetSelects([modelSelect, pieceSelect, variantSelect]);
        });

        brandSelect.addEventListener('change', () => {
            const device = deviceSelect.value;
            const brand = brandSelect.value;
            const filteredData = data.filter(r => r.Dispositivo === device && r.Marca === brand);
            populateSelect(modelSelect, filteredData.map(r => r.Modelo_ver));
            resetSelects([pieceSelect, variantSelect]);
        });

        modelSelect.addEventListener('change', () => {
            const model = modelSelect.value;
            const filteredData = data.filter(r => r.Modelo_ver === model);
            populateSelect(pieceSelect, filteredData.map(r => r.Pieza));
            resetSelects([variantSelect]);
        });
        
        pieceSelect.addEventListener('change', () => {
            const model = modelSelect.value;
            const piece = pieceSelect.value;
            const filteredData = data.filter(r => r.Modelo_ver === model && r.Pieza === piece);
            populateSelect(variantSelect, filteredData.map(r => r.Variante1));
        });

        [deviceSelect, brandSelect, modelSelect, pieceSelect, variantSelect].forEach(sel => {
            sel.addEventListener('change', findPieceCost);
        });

        const resetSelects = (selects) => {
            selects.forEach(sel => sel.innerHTML = `<option>${sel.firstElementChild.textContent}</option>`);
            pieceCostResult.innerHTML = `<p>Selecciona una configuración para ver el costo.</p>`;
        }
    }

    function findPieceCost() {
        const filters = {
            Dispositivo: deviceSelect.value,
            Marca: brandSelect.value,
            Modelo_ver: modelSelect.value,
            Pieza: pieceSelect.value,
            Variante1: variantSelect.value
        };

        let filteredData = originalData;
        for (const key in filters) {
            if (filters[key] && !filters[key].startsWith('Dispositivo') && !filters[key].startsWith('Marca') && !filters[key].startsWith('Modelo') && !filters[key].startsWith('Pieza') && !filters[key].startsWith('Variante')) {
                filteredData = filteredData.filter(row => (row[key] || '') === filters[key]);
            }
        }
        
        if (filteredData.length > 0 && filteredData[0]['Costo Pieza'] != null) {
            const item = filteredData[0];
            const cost = typeof item['Costo Pieza'] === 'number' ? item['Costo Pieza'].toFixed(2) : item['Costo Pieza'];
            pieceCostResult.innerHTML = `
                <p><strong>SKU:</strong> <span>${item['SKU Refacción'] || 'No disponible'}</span></p>
                <p><strong>Costo:</strong> <span>$${cost}</span></p>
            `;
        } else {
             pieceCostResult.innerHTML = `<p>No se encontró un costo para la selección actual.</p>`;
        }
    }

    function setupServiceCostAnalyzer(data) {
        const serviceTypes = [...new Set(data.map(row => row.TipoServicio).filter(Boolean))];
        serviceTypes.sort().forEach(type => {
            serviceCostSelect.appendChild(new Option(type, type));
        });

        serviceCostSelect.addEventListener('change', () => {
            const selectedService = serviceCostSelect.value;
            if (selectedService && !selectedService.startsWith('Selecciona')) {
                const serviceData = data.filter(row => row.TipoServicio === selectedService);
                const costs = serviceData.map(row => row['Servicio Mínimo']).filter(cost => typeof cost === 'number');

                if (costs.length > 0) {
                    const minCost = Math.min(...costs).toFixed(2);
                    const maxCost = Math.max(...costs).toFixed(2);
                    const avgCost = (costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(2);

                    serviceCostResult.innerHTML = `
                        <p><strong>Costo Mínimo:</strong> <span>$${minCost}</span></p>
                        <p><strong>Costo Promedio:</strong> <span>$${avgCost}</span></p>
                        <p><strong>Costo Máximo:</strong> <span>$${maxCost}</span></p>
                    `;
                } else {
                    serviceCostResult.innerHTML = `<p>No hay datos de costos numéricos para este servicio.</p>`;
                }
            } else {
                 serviceCostResult.innerHTML = `<p>Selecciona un servicio para ver sus costos.</p>`;
            }
        });
    }

    fetchData();
});
