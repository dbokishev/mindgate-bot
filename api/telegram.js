// Serverless webhook handler for Vercel (Node.js)
// Telegram will POST updates here. We pass them to node-telegram-bot-api.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).send('OK');
  }

  try {
    const expectedSecret = process.env.WEBHOOK_SECRET || '';
    const gotSecret = req.headers['x-telegram-bot-api-secret-token'];
    // If secret is configured and present but mismatched, reject; otherwise accept to avoid drops due to missing header
    if (expectedSecret && gotSecret && gotSecret !== expectedSecret) {
      return res.status(401).send('unauthorized');
    }

    const { bot } = require('../bot');
    const update = req.body || {};
    // Lightweight runtime logs to diagnose delivery issues
    try {
      const kind = update.message ? 'message' : update.callback_query ? 'callback_query' : 'other';
      const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
      console.log('Incoming update:', { kind, chatId, hasText: Boolean(update.message?.text), hasData: Boolean(update.callback_query?.data) });
    } catch (_) {}

    // Respond immediately to Telegram to avoid timeouts; process update asynchronously
    res.status(200).send('OK');
    try {
      await bot.processUpdate(update);
    } catch (e) {
      console.error('processUpdate error:', e && e.message ? e.message : e);
    }
    return;
  } catch (err) {
    console.error('Webhook handler error:', err && err.message ? err.message : err);
    return res.status(500).send('error');
  }
};



