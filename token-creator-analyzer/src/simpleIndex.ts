import { SimpleMonitor } from './simpleMonitor.js';

class SimpleTokenAnalyzer {
  private monitor: SimpleMonitor;

  constructor() {
    this.monitor = SimpleMonitor.getInstance();
  }

  /**
   * Start the analyzer
   */
  async start(): Promise<void> {
    console.log('🎯 Starting Simple Four.meme Token Creator Analyzer');
    console.log('===============================================');
    console.log('⚠️  Note: This is a simplified version that monitors recent transactions');
    console.log('⚠️  For full historical analysis, you need a premium RPC endpoint with eth_getLogs support');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down gracefully...');
      await this.monitor.saveAllData();
      process.exit(0);
    });

    // Start monitoring
    await this.monitor.startMonitoring();

    // Save data periodically
    setInterval(() => {
      this.monitor.saveAllData();
    }, 300000); // Every 5 minutes
  }
}

// Start the analyzer
const analyzer = new SimpleTokenAnalyzer();
analyzer.start().catch(console.error);
