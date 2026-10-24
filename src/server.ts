import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();
const backendUrl = new URL(process.env['BACKEND_URL'] ?? 'http://localhost:8081');

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use('/backend', async (req, res) => {
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (
        value !== undefined &&
        !['connection', 'content-length', 'host', 'transfer-encoding'].includes(name)
      ) {
        headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const requestBody = chunks.length
      ? new Blob([new Uint8Array(Buffer.concat(chunks))])
      : undefined;
    const requestPath = req.originalUrl.replace(/^\/backend/, '') || '/';
    const response = await fetch(new URL(requestPath, backendUrl), {
      method: req.method,
      headers,
      body: requestBody,
      redirect: 'manual',
    });

    for (const [name, value] of response.headers) {
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(name)) {
        res.setHeader(name, value);
      }
    }
    res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('Unable to forward API request to the backend.', error);
    res
      .status(502)
      .json({ message: 'Unable to reach the library API. Check that the backend is running.' });
  }
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
