import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Serves /api/wa-* during `npm run dev` using the very same code the Netlify
 * Functions run in production, so local and deployed behaviour cannot diverge.
 * Without this, these routes would only exist once deployed and the broadcast
 * page would be untestable locally.
 */
function whatsappDevApi(env: Record<string, string>): Plugin {
  return {
    name: 'milkylush-whatsapp-dev-api',
    configureServer(server) {
      // The handlers read credentials from process.env, exactly as they do on
      // Netlify. These come from .env and never reach the browser bundle.
      for (const key of ['GETGABS_API_KEY', 'GETGABS_CAMPAIGN_ID', 'GETGABS_SENDER', 'GETGABS_WELCOME_TEMPLATE', 'GETGABS_HEADER_IMAGE']) {
        if (env[key]) process.env[key] = env[key];
      }

      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0];
        if (path !== '/api/wa-templates' && path !== '/api/wa-broadcast') return next();

        const { handleTemplates, handleBroadcast } = await server.ssrLoadModule(
          '/netlify/lib/handlers.mjs'
        );

        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };

        try {
          if (path === '/api/wa-templates') {
            const { status, body } = await handleTemplates();
            return send(status, body);
          }

          if (req.method !== 'POST') return send(405, { error: 'Use POST' });

          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const payload = JSON.parse(Buffer.concat(chunks).toString() || '{}');

          const { status, body } = await handleBroadcast(payload);
          return send(status, body);
        } catch (err: any) {
          return send(500, { error: err?.message || 'Dev API error' });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // '' as the prefix loads unprefixed vars too, which is how the server-side
  // Getgabs credentials stay out of the browser bundle.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), whatsappDevApi(env)],
  }
})
