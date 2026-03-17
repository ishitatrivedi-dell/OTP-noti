const cron = require('node-cron');

function initCron({ logger }) {
  // Every minute
  cron.schedule('* * * * *', async () => {
    await logger.info('CRON', 'CRON job executed');
  });
}

module.exports = { initCron };

