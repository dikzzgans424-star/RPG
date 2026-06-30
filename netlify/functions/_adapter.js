// _adapter.js — bikin handler gaya Vercel (req, res) bisa jalan di Netlify Functions
// tanpa perlu ubah logic asli sama sekali.

function wrap(handler) {
    return async function (event, context) {
        let statusCode = 200;
        const headers = {};
        let responseBody = '';

        // query string -> object plain (mirip req.query di Vercel)
        const query = event.queryStringParameters || {};

        const req = {
            method: event.httpMethod,
            query,
            headers: event.headers || {},
            // body dikirim mentah (string), handler asli sudah JSON.parse sendiri kalau perlu
            body: event.body,
        };

        let resolved = false;
        const res = {
            setHeader(key, value) {
                headers[key] = value;
                return res;
            },
            status(code) {
                statusCode = code;
                return res;
            },
            json(obj) {
                if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
                responseBody = JSON.stringify(obj);
                resolved = true;
                return res;
            },
            send(data) {
                responseBody = typeof data === 'string' ? data : JSON.stringify(data);
                resolved = true;
                return res;
            },
            end(data) {
                if (data) responseBody = data;
                resolved = true;
                return res;
            },
        };

        try {
            await handler(req, res);
        } catch (err) {
            console.error('Unhandled function error:', err);
            statusCode = 500;
            headers['Content-Type'] = 'application/json';
            responseBody = JSON.stringify({ error: 'Server error: ' + (err && err.message ? err.message : String(err)) });
        }

        return {
            statusCode,
            headers,
            body: responseBody,
        };
    };
}

module.exports = { wrap };
