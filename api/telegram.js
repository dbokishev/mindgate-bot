// Serverless webhook handler for Vercel (Node.js)
// Telegram will POST updates here. We pass them to node-telegram-bot-api.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(200).send('OK');
  }

  try {
    const expectedSecret = process.env.WEBHOOK_SECRET || '';
    const gotSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (expectedSecret && gotSecret !== expectedSecret) {
      return res.status(401).send('unauthorized');
    }

    const { bot } = require('../bot');
    await bot.processUpdate(req.body);
    return res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook handler error:', err && err.message ? err.message : err);
    return res.status(500).send('error');
  }
};



