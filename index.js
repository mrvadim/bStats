const express = require('express');
const port = 4000;
const app = express()
const Influx = require('influx');
const {Spot} = require('@binance/connector');
const client = new Spot();

const currencies = ['BNBUSDT', 'BNBBTC', 'BTCEUR', 'AXSBUSD', 'BUSDUSDT'];
const wsStream = currencies.map(el => el.toLowerCase() + '@aggTrade');
const db_options = {
    host: '127.0.0.1',
    database: 'binance_history',
    measurement: 'prices',
}

const influx = new Influx.InfluxDB({
    host: db_options.host,
    database: db_options.database,
    schema: [
        {
            measurement: db_options.measurement,
            fields: {
                price: Influx.FieldType.FLOAT
            },
            tags: ['currency', 'name']
        }
    ]
})

const callbacks = {
    open: () => {
        console.log('open');
    },
    close: () => {
        console.log('closed');
    },
    message: async response => {
        const {data} = JSON.parse(response);
        try {
           await influx.writeMeasurement(db_options.measurement, [
                {tags: {currency: data.s}, fields: {price: data.p}}
            ]);
        } catch (e) {
            console.error('error:', e);
        }
    }
}
const wsRef = client.combinedStreams(wsStream, callbacks);

app.use(express.static('public'));
app.get('/api/:cur', async (req, res) => {
    const {cur} = req.params
    if (!currencies.includes(cur)) return res.status(400).json({error: true, message: 'wrong currency'})
    const query = `select time, price from ${db_options.measurement} where currency = '${cur}' order by time asc`
    try {
        const results = await influx.query(query)
        return res.status(200).json(results)
    } catch (e) {
        console.log(e.message)
    }
})

app.listen(port, async () => {
    try {
        const databases = await influx.getDatabaseNames();
        console.log(databases)
        if (!databases.includes(db_options.database)) {
            await influx.createDatabase(db_options.database);
        }
    } catch (e) {
        console.error(`Error creating Influx database!`);
    }
    console.log(`Example app listening on port ${port}`);
})