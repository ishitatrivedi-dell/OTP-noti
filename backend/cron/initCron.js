const cron = require('node-cron');

function initCron({ logger }) {
  cron.schedule('* * * * *', () => {
    logger.info('CRON', 'CRON job executed').catch((error) => {
      console.error(`❌ Failed to persist cron log: ${error.message}`);
    });
  });
}

module.exports = { initCron };
