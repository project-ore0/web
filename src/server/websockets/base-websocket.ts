import { WebSocketServer, WebSocket, ServerOptions } from 'ws';
import { IncomingMessage } from 'http';
import { EventEmitter } from 'events';

/**
 * Base WebSocket server class that provides common functionality
 * for both client and control WebSocket servers
 */
export class BaseWS {
  private wss: WebSocketServer;
  public eventBus: EventEmitter;
  public clients: Set<WebSocket>;

  constructor(eventBus: EventEmitter, options: ServerOptions = {}) {
    options.noServer = true;
    this.wss = new WebSocketServer(options);
    this.eventBus = eventBus;
    this.clients = new Set(); // Track connected clients
    
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.clients.add(ws); // Add client
      
      ws.on('message', (message: Buffer, isBinary: boolean) => {
        this.onMessage(message, isBinary);
      });
      
      ws.on('error', (error: Error) => {
        this.onError(error);
      });
      
      ws.on('close', () => {
        this.clients.delete(ws); // Remove client on close
        this.onDisconnect(ws);
        this.onClose();
      });
      
      this.onConnection(ws, req);
    });
  }

  handleUpgrade(req: IncomingMessage, socket: any, head: Buffer, callback: ((ws: WebSocket, req: IncomingMessage) => void) | null = null): void {
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      // Emit connection event to trigger the connection handlers
      this.wss.emit('connection', ws, req);
      
      // Call the callback if provided
      if (callback) {
        callback(ws, req);
      }
    });
  }

  onConnection(ws: WebSocket, req: IncomingMessage): void {
    // Get client IP address from various possible headers or socket
    const ip = 
      req.headers['x-forwarded-for'] || 
      req.headers['x-real-ip'] ||
      req.socket.remoteAddress ||
      'unknown';
    
    console.log('WS client connected:', ip);
  }

  onDisconnect(ws: WebSocket): void {
    console.log('WS client disconnected');
  }

  onMessage(message: Buffer, isBinary: boolean): void {
    if (isBinary) {
      console.log('WS binary length:', message.length);
    } else {
      console.log(`WS text: ${message.toString()}`);
    }
  }

  onError(error: Error): void {
    console.error(`WS error: ${error.message}`);
  }

  onClose(): void {
    console.log('WS closed');
  }

  broadcast(data: Uint8Array, binary: boolean = true): void {
    this.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(data, { binary });
      }
    });
  }
}
