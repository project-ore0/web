# ORE0 Control Panel - Nuxt.js Implementation

This project is a modern Nuxt.js implementation of the ORE0 control panel, providing a web interface for controlling and monitoring the ORE0 device.

## Features

- Real-time WebSocket communication with the ORE0 device
- Camera feed display
- Motor control via keyboard and touch/mouse
- Battery level and distance monitoring
- Responsive design for both desktop and mobile devices

## Project Structure

```
src/
├── app.vue                  # Main application component
├── components/              # Vue components
│   └── ControlPanel.vue     # Main control panel component
├── server/                  # Server-side code
│   ├── plugins/             # Nitro server plugins
│   │   └── websocket.ts     # WebSocket server plugin
│   ├── utils/               # Utility functions
│   │   ├── event-bus.ts     # Event bus for communication between WebSocket gateways
│   │   └── message-protocol.ts # Message protocol definitions and helpers
│   └── websockets/          # WebSocket gateways
│       ├── base-websocket.ts # Base WebSocket class
│       ├── client-gateway.ts # Client WebSocket gateway (/ws endpoint)
│       ├── control-gateway.ts # Control WebSocket gateway (/wsc endpoint)
│       └── websocket-module.ts # WebSocket module setup
└── public/                  # Static files
```

## WebSocket Endpoints

- **/ws**: For client connections (browser)
- **/wsc**: For control connections (ORE0 device)

## Message Protocol

The message protocol follows the same structure as the original implementation and includes message types for:

- Motor state
- Telemetry
- Camera control
- Camera chunks
- Motor control
- Move control
- Battery level
- Distance reading

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm or yarn

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/ore0-mark3-web.git
   cd ore0-mark3-web
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Building for Production

To build the application for production:

```
npm run build
```

To preview the production build:

```
npm run preview
```

## License

[MIT](LICENSE)
