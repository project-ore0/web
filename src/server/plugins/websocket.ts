import { defineNitroPlugin } from 'nitropack/runtime';
import { IncomingMessage, ServerResponse } from 'http';
import type { H3Event } from 'h3';
import { clientWS } from '../websockets/client-gateway';
import { controlWS } from '../websockets/control-gateway';
import { setupWebSocketModule } from '../websockets/websocket-module';
import { createReadStream } from 'fs';
import { join } from 'path';

/**
 * Nitro plugin to handle WebSocket connections and static file serving
 * This plugin sets up the WebSocket endpoints at /ws and /wsc
 * and serves static files from the public directory
 */
export default defineNitroPlugin((nitroApp) => {
  // Initialize WebSocket module
  setupWebSocketModule();

  // Handle WebSocket upgrade requests
  nitroApp.hooks.hook('request', async (event: H3Event) => {
    const req = event.node.req as IncomingMessage;
    const res = event.node.res as ServerResponse;

    // Handle WebSocket upgrade requests
    if (req.headers.upgrade?.toLowerCase() === 'websocket') {
      const socket = req.socket;
      const head = Buffer.from([]);

      if (req.url === '/ws') {
        // Handle client WebSocket connections
        event._handled = true; // Mark as handled for Nitro
        
        // Use a callback to properly handle the upgrade
        clientWS.handleUpgrade(req, socket, head, () => {
          console.log('Client WebSocket connection established');
        });
        
        return;
      } else if (req.url === '/wsc') {
        // Handle control WebSocket connections
        event._handled = true; // Mark as handled for Nitro
        
        // Use a callback to properly handle the upgrade
        controlWS.handleUpgrade(req, socket, head, () => {
          console.log('Control WebSocket connection established');
        });
        
        return;
      }
    }

    // Serve static files from public/ directory for backward compatibility
    // This is in addition to Nuxt's built-in static file serving
    if (req.url?.startsWith('/public/')) {
      const filePath = join(process.cwd(), req.url);
      
      try {
        const fileStream = createReadStream(filePath);
        
        fileStream.on('open', () => {
          // Handle mime types
          const mimeTypes: Record<string, string> = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.json': 'application/json',
          };
          
          const ext = filePath.split('.').pop() || '';
          const contentType = mimeTypes[`.${ext}`] || 'application/octet-stream';
          
          res.writeHead(200, { 'Content-Type': contentType });
          fileStream.pipe(res);
        });
        
        fileStream.on('error', () => {
          // Let Nuxt handle the 404 response
          return;
        });
      } catch (error) {
        // Let Nuxt handle the error
        return;
      }
    }
  });

  console.log('WebSocket plugin initialized');
});
