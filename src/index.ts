#!/usr/bin/env node
import { runMcp } from '@chrischall/mcp-utils';
import { VERSION } from './version.js';
import { registerProductTools } from './tools/products.js';
import { registerAttractionTools } from './tools/attractions.js';
import { registerAvailabilityTools } from './tools/availability.js';
import { registerSearchTools } from './tools/search.js';
import { registerReferenceTools } from './tools/reference.js';

// The ViatorClient is a module-level singleton (imported by each tool module)
// that defers its config error to the first request — so the server boots and
// answers the host's install-time tools/list probe even without VIATOR_API_KEY.
await runMcp({
  name: 'viator-mcp',
  version: VERSION,
  banner: '[viator-mcp] This project was developed and is maintained by AI (Claude). Use at your own discretion.',
  tools: [
    registerProductTools,
    registerAttractionTools,
    registerAvailabilityTools,
    registerSearchTools,
    registerReferenceTools,
  ],
});
