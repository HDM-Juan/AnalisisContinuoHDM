// Espera a que todo el contenido del HTML esté cargado antes de ejecutar el script.
document.addEventListener('DOMContentLoaded', function () {

    // --- CONFIGURACIÓN ---
    // ¡IMPORTANTE! Pega aquí la URL que obtuviste de Google Sheets.
    const googleSheetUrl = 'PEGA_AQUÍ_LA_URL_DE_TU_CSV_PUBLICADO';

    // Función para obtener y procesar los datos del CSV.
    function fetchData() {
        Papa.parse(googleSheetUrl, {
            download: true,
            header: true, // Trata la primera fila como encabezados de columna.
            dynamicTyping: true, // Convierte números y booleanos automáticamente.
            complete: (results) => {
                // Filtramos filas que no tengan un Folio para limpiar los datos.
                const cleanData = results.data.filter(row => row['Folio Recepción'] != null && row['Folio Recepción'] !== '');
                // Una vez que los datos están listos, inicializamos el dashboard.
                initializeDashboard(cleanData);
            },
            error: (error) => {
                console.error("Error al cargar o procesar los datos:", error);
                alert("Hubo un error al cargar los datos desde Google Sheets. Revisa la URL y tu conexión.");
            }
        });
    }

    // Función principal que coordina la creación de todos los elementos del dashboard.
    function initializeDashboard(data) {
        console.log("Datos cargados y limpios:", data);

        // Actualizamos los KPIs
        updateKPIs(data);

        // Creamos los gráficos
        createServiciosChart(data);
        createMarcasChart(data);
        displayTopModels(data);
    }
    
    // --- FUNCIONES DE ANÁLISIS Y VISUALIZACIÓN ---

    function updateKPIs(data) {
        const totalServicios = data.length;
        document.getElementById('total-servicios').textContent = totalServicios;
    }

    /**
     * Calcula la frecuencia de un valor en una columna específica.
     * @param {Array<Object>} data - El array de datos.
     * @param {string} columnName - El nombre de la columna a analizar.
     * @returns {Object} Un objeto con los valores como llaves y su frecuencia como valor.
     */
    function countOccurrences(data, columnName) {
        const counts = {};
        for (const row of data) {
            const value = row[columnName];
            if (value) { // Solo contamos si el valor no es nulo o vacío
                counts[value] = (counts[value] || 0) + 1;
            }
        }
        return counts;
    }

    function createServiciosChart(data) {
        const ctx = document.getElementById('serviciosChart').getContext('2d');
        const serviciosData = countOccurrences(data, 'TipoServicio');

        // Ordenamos los datos para mostrar los más frecuentes primero.
        const sortedServicios = Object.entries(serviciosData).sort(([,a],[,b]) => b-a);
        
        const labels = sortedServicios.map(item => item[0]);
        const values = sortedServicios.map(item => item[1]);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Número de Servicios',
                    data: values,
                    backgroundColor: 'rgba(178, 34, 34, 0.7)', // Color corporativo con transparencia
                    borderColor: 'rgba(178, 34, 34, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y', // Hace que las barras sean horizontales para mejor lectura.
                scales: {
                    x: {
                        beginAtZero: true
                    }
                },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    function createMarcasChart(data) {
        const ctx = document.getElementById('marcasChart').getContext('2d');
        const marcasData = countOccurrences(data, 'Marca');

        const sortedMarcas = Object.entries(marcasData).sort(([,a],[,b]) => b-a);

        const labels = sortedMarcas.map(item => item[0]);
        const values = sortedMarcas.map(item => item[1]);

        new Chart(ctx, {
            type: 'doughnut', // Gráfico de dona (pastel con un hoyo).
            data: {
                labels: labels,
                datasets: [{
                    label: 'Distribución por Marca',
                    data: values,
                    backgroundColor: [ // Paleta de colores variada
                        '#B22222', '#8B1A1A', '#25D366', '#1877F2',
                        '#FF9800', '#6c757d', '#34A853', '#EA4335'
                    ],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
    
    function displayTopModels(data) {
        const modelsData = countOccurrences(data, 'Modelo_ver');
        
        // Ordenamos los modelos por frecuencia y tomamos los 5 primeros.
        const sortedModels = Object.entries(modelsData)
                               .sort(([,a],[,b]) => b - a)
                               .slice(0, 5);

        const listElement = document.getElementById('topModelsList');
        listElement.innerHTML = ''; // Limpiamos la lista antes de agregar nuevos elementos.

        sortedModels.forEach(model => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `${model[0]} <span>${model[1]}</span>`;
            listElement.appendChild(listItem);
        });
    }


    // --- INICIO DE LA APLICACIÓN ---
    fetchData();

});
