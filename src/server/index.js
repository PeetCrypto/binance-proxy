import express from "express";
import cors from "cors";
import compression from "compression";
import { Router } from "express";
import { createProxyMiddleware } from 'http-proxy-middleware';

const NodeRateLimiter = require('node-rate-limiter');
const nodeRateLimiter = new NodeRateLimiter();


const routeLimiter = async (proxyReq: http.ClientRequest, req: http.IncomingMessage): void {
  const requestBody = (req as Request).body;

  if (!requestBody || !Object.keys(requestBody).length) {
    return;
  }

  const contentType = proxyReq.getHeader('Content-Type') as string;
  const writeBody = (bodyData: string) => {
    // deepcode ignore ContentLengthInCode: bodyParser fix
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  };

  if (contentType && contentType.includes('application/json')) {
    writeBody(JSON.stringify(requestBody));
  }

  if (contentType === 'application/x-www-form-urlencoded') {
    writeBody(querystring.stringify(requestBody));
  }
}

const getServer = async (client) => {
    const app = express();
    const router = new Router();
    const speedLimiter = slowDown({
	windowMs: 1 * 60 * 1000,  // 1 minute
        delayAfter: 100
    });

    app.use(cors());
    app.use(compression());
    app.use(express.json());

    router.get('/api/v3/klines', async (req, res) => {
        client.getCandles(req.query.symbol, req.query.interval).then(result => res.send(result))
    });

    router.get('/debug/on', async (req, res) => {
        client.setDebug(true);
    });

    router.get('/debug/off', async (req, res) => {
        client.setDebug(false);
    });

    router.use(createProxyMiddleware({
        target: 'https://api.binance.com', changeOrigin: true, onProxyReq: routeLimiter
    }));

    app.use("/", router);
    return app
}

export default getServer
