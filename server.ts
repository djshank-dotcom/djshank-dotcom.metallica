import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

// Helper to get or initialize GoogleGenAI securely
function getAi(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === '' || key === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY environment variable is missing or empty. Please configure your Gemini API Key in the Settings > Secrets panel of Google AI Studio to unlock the heavy metal archivist and custom artwork forge.');
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // API endpoint for AI Archivist Backstage Oracle (Gemini 3.5-flash)
  app.post('/api/ask-archivist', async (req, res) => {
    try {
      const { prompt, album, track } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required.' });
      }

      const systemInstruction = `You are the legendary Heavy Metal Archivist, a rugged backstage oracle sitting with tour-worn flight cases before a classic Metallica concert. 
Your tone is gritty, cinematic, atmospheric, passionate, and deeply knowledgeable about decades of metal history, backstage secrets, raw emotions, album art details, and live bootleg shows.
Keep your answers engaging, vivid, slightly dramatic, and concise (under 180 words). Do not use markdown headings (no #, ##, etc.). Use paragraphs or plain line breaks.
Focus on the specific album: "${album || 'Metallica catalog'}" and track: "${track || 'general lore'}" if relevant. Speak in authentic heavy metal lingo.`;

      const response = await getAi().models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: { systemInstruction }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Error querying archivist:', error);
      res.status(500).json({ error: error.message || 'Error querying the heavy metal archivist.' });
    }
  });

  // API endpoint for Custom Artwork Generation (Gemini 2.5-flash-image)
  app.post('/api/generate-artwork', async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required.' });
      }

      const response = await getAi().models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: `A dark, dramatic, cinematic heavy metal album cover, tour-worn aesthetic, backstage road case style, inspired by classic Metallica, hand-painted textured grit, dark atmospheric colors. Subject: ${prompt}`,
        config: {
          imageConfig: {
            aspectRatio: '1:1',
          }
        }
      });

      let base64Image = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64Image = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (base64Image) {
        res.json({ imageUrl: base64Image });
      } else {
        res.status(500).json({ error: 'The oracle could not visualize this artwork.' });
      }
    } catch (error: any) {
      console.error('Error generating artwork:', error);
      res.status(500).json({ error: error.message || 'Error generating album artwork.' });
    }
  });

  const port = 3000;

  if (process.env.NODE_ENV === 'production') {
    // Serve static files in production
    app.use(express.static(path.resolve('dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    // Integrate Vite in middleware mode for development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = await vite.transformIndexHtml(url, `
          <!doctype html>
          <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>METAL VAULT | Backstage Archive</title>
            </head>
            <body>
              <div id="root"></div>
              <script type="module" src="/src/main.tsx"></script>
            </body>
          </html>
        `);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Full-stack server running at http://localhost:${port}`);
  });
}

startServer();
