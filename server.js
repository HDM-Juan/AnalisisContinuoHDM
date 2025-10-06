const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Servir los archivos estáticos del frontend (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '/')));

// Endpoint del proxy para obtener los datos de Google Sheets
app.get('/api/data', async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).send('La URL de Google Sheets es requerida');
    }

    try {
        const response = await axios.get(url, {
            responseType: 'stream'
        });
        // Pipe la respuesta de Google Sheets directamente al cliente
        response.data.pipe(res);
    } catch (error) {
        console.error('Error al obtener datos de Google Sheets:', error.message);
        res.status(500).send('Error al obtener los datos de Google Sheets');
    }
});

// Ruta principal para servir index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor proxy corriendo en http://localhost:${PORT}`);
});