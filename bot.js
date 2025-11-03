
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
// ID канала в формате -100xxxxxxxxxx (бот должен быть админом канала для проверки подписки)
const channelId = process.env.CHANNEL_ID;
// Публичная ссылка на канал (для отправки пользователю)
const channelLink = process.env.CHANNEL_LINK || 'https://t.me/your_channel';

// Ключевые слова и соответствующие лид-магниты
const leadMagnets = {
  'n8n': process.env.LEADMAGNET_N8N || 'https://n8n.io/',
};

if (!token) {
  console.error('BOT_TOKEN is not set. Please configure your .env file.');
  process.exit(1);
}

if (!channelId) {
  console.error('CHANNEL_ID is not set. Please configure your .env file.');
  process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(token, { polling: true });

// Простейшее состояние диалога в памяти процесса (используется только для локального dev)
// В проде по вебхуку нельзя полагаться на память — используем callback_data с ключом
const awaitingKeyword = Object.create(null);

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcome =
    `Привет! На связи MindGate.\n\n` +
    `Напиши ключевое слово из видео, и я сразу пришлю тебе твой бонус.`;

  bot.sendMessage(chatId, welcome, { disable_web_page_preview: true });

  if (msg.from && msg.from.id) {
    awaitingKeyword[msg.from.id] = true;
  }
});

// Универсальный обработчик сообщений
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from && msg.from.id;
  const text = (msg.text || '').trim();

  // Пропускаем команды (их обрабатывает onText)
  if (!text || text.startsWith('/')) return;

  // Если ждём ключевое слово — сохраняем его, а отправку бонуса делаем по кнопке "Подписался"
  if (userId && awaitingKeyword[userId]) {
    const keyword = text.toLowerCase();

    if (!leadMagnets[keyword]) {
      await bot.sendMessage(chatId, 'Я не узнал ключевое слово. Отправь слово из видео (например: n8n).');
      return;
    }
    // Отправляем шаг с подпиской + кнопка. Кодируем ключевое слово в callback_data,
    // чтобы не зависеть от памяти процесса (stateless вебхуки)
    const subscribeStep =
      `Остался последний шаг! Нужно быть подписанным на телеграм‑канал: ${channelLink}`;
    await bot.sendMessage(chatId, subscribeStep, {
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[{ text: 'Подписка оформлена!', callback_data: `confirm_subscribed:${keyword}` }]],
      },
    });
    return;
  }

  // Если ключ не ожидался — подскажем:
  await bot.sendMessage(chatId, 'Нажми /start и следуй инструкции, чтобы получить бонус.');
});

// Обработка нажатия на кнопку "Подписался"
bot.on('callback_query', async (query) => {
  const userId = query.from && query.from.id;
  const chatId = (query.message && query.message.chat && query.message.chat.id) || null;
  const data = query.data;

  if (!data || !data.startsWith('confirm_subscribed') || !userId || !chatId) {
    return bot.answerCallbackQuery(query.id);
  }

  // Подтверждаем нажатие
  await bot.answerCallbackQuery(query.id, { text: 'Проверяю подписку…', show_alert: false });

  const parts = data.split(':');
  const keyword = parts[1] ? String(parts[1]).toLowerCase() : '';

  if (!keyword) {
    await bot.sendMessage(chatId, 'Сначала отправь ключевое слово из видео (например: n8n).');
    return;
  }

  try {
    const member = await bot.getChatMember(channelId, userId);
    const status = member && member.status;
    const isSubscribed = status === 'creator' || status === 'administrator' || status === 'member';

    if (!isSubscribed) {
      await bot.sendMessage(
        chatId,
        'Ой, кажется, подписки пока нет. 🧐\n\nПожалуйста, убедись, что ты подписался на канал, и попробуй нажать на кнопку ещё раз. Вот ссылка на канал: ' + channelLink,
        {
          disable_web_page_preview: true,
          reply_markup: {
            inline_keyboard: [[{ text: 'Теперь точно подписан!', callback_data: 'confirm_subscribed' }]],
          },
        }
      );
      return;
    }

    const link = leadMagnets[keyword];
    await bot.sendMessage(chatId, `Держи твой бонус: ${link}`, { disable_web_page_preview: false });

    // Сбрасываем состояние
    awaitingKeyword[userId] = false;
  } catch (e) {
    console.log('getChatMember error:', (e && e.message) || e);
    await bot.sendMessage(chatId, 'Не удалось проверить подписку. Убедись, что бот — админ канала и попробуй ещё раз.');
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.log('Polling error:', error);
});

// Log bot startup
console.log('Bot is running...');
