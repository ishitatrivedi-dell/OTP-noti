const Log = require('../models/Log');

async function exportLogs(req, res) {
  const logger = req.app.get('logger');
  
  try {
    const { format = 'json', limit = 1000, action } = req.query;
    const limitNum = Math.min(Number(limit), 5000);
    
    const filter = {};
    if (action) filter.action = action;
    
    const logs = await Log.find(filter)
      .sort({ timestamp: -1 })
      .limit(limitNum)
      .lean();
    
    await logger.info('EXPORT', `Exporting logs in ${format} format`, {
      meta: { 
        format, 
        count: logs.length,
        action: action || 'all'
      }
    });
    
    if (format === 'csv') {
      // Convert to CSV
      const csvHeaders = ['Timestamp', 'User ID', 'Action', 'Message', 'Metadata'];
      const csvRows = logs.map(log => [
        log.timestamp ? new Date(log.timestamp).toISOString() : '',
        log.userId || '',
        log.action || '',
        log.message || '',
        log.meta ? JSON.stringify(log.meta).replace(/"/g, '""') : ''
      ]);
      
      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="logs-${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csvContent);
    } else {
      // Default to JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="logs-${new Date().toISOString().split('T')[0]}.json"`);
      return res.json({
        exportDate: new Date().toISOString(),
        totalLogs: logs.length,
        filters: { action: action || 'all' },
        logs
      });
    }
  } catch (error) {
    console.error('Export error:', error);
    await logger?.info('ERROR', 'Export failed', {
      meta: { error: String(error) }
    });
    res.status(500).json({ message: 'Export failed' });
  }
}

module.exports = { exportLogs };
