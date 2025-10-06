import { EventMonitor } from './eventMonitor.js';
import { PatternAnalyzer } from './patternAnalyzer.js';
import { CSVManager } from './csvManager.js';
import { TokenCreationEvent } from './types.js';

class TokenCreatorAnalyzer {
  private eventMonitor: EventMonitor;
  private patternAnalyzer: PatternAnalyzer;
  private csvManager: CSVManager;
  private eventsByPattern: Map<string, TokenCreationEvent[]> = new Map();

  constructor() {
    this.eventMonitor = EventMonitor.getInstance();
    this.patternAnalyzer = PatternAnalyzer.getInstance();
    this.csvManager = CSVManager.getInstance();
  }

  /**
   * Start the analyzer
   */
  async start(): Promise<void> {
    console.log('🎯 Starting Four.meme Token Creator Analyzer');
    console.log('=====================================');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down gracefully...');
      await this.saveAllData();
      process.exit(0);
    });

    // Start monitoring events
    await this.eventMonitor.startMonitoring(this.handleNewEvents.bind(this));

    // Save data periodically
    setInterval(() => {
      this.saveAllData();
    }, 300000); // Every 5 minutes
  }

  /**
   * Handle new token creation events
   */
  private async handleNewEvents(events: TokenCreationEvent[]): Promise<void> {
    for (const event of events) {
      console.log(`\n🪙 New Token Created:`);
      console.log(`   Token: ${event.tokenAddress}`);
      console.log(`   Creator: ${event.creatorAddress}`);
      console.log(`   Create Fee: ${this.formatWei(event.createFee)} BNB`);
      console.log(`   Buy Gas Price: ${this.formatWei(event.buyGasPrice)} BNB`);
      console.log(`   Buy Gas Limit: ${event.buyGasLimit}`);
      
      if (event.sellGasPrice) {
        console.log(`   Sell Gas Price: ${this.formatWei(event.sellGasPrice)} BNB`);
        console.log(`   Sell Gas Limit: ${event.sellGasLimit}`);
        console.log(`   Sell Fee: ${this.formatWei(event.sellFee || 0n)} BNB`);
      }

      // Classify the event
      const classification = this.patternAnalyzer.classifyEvent(event);
      
      if (classification.isNewPattern) {
        console.log(`   🆕 NEW PATTERN: ${classification.patternId}`);
        this.eventsByPattern.set(classification.patternId, [event]);
      } else {
        console.log(`   🔄 EXISTING PATTERN: ${classification.patternId}`);
        const existingEvents = this.eventsByPattern.get(classification.patternId) || [];
        existingEvents.push(event);
        this.eventsByPattern.set(classification.patternId, existingEvents);
      }

      // Print pattern statistics
      this.printPatternStats(classification.patternId);
    }
  }

  /**
   * Format wei to BNB
   */
  private formatWei(wei: bigint): string {
    return (Number(wei) / 1e18).toFixed(6);
  }

  /**
   * Print pattern statistics
   */
  private printPatternStats(patternId: string): void {
    const pattern = this.patternAnalyzer.getAllPatterns().get(patternId);
    if (pattern) {
      console.log(`   📊 Pattern Stats:`);
      console.log(`      Creators: ${pattern.creatorAddresses.size}`);
      console.log(`      Tokens: ${pattern.count}`);
      console.log(`      First Seen: ${pattern.firstSeen.toISOString()}`);
      console.log(`      Last Seen: ${pattern.lastSeen.toISOString()}`);
    }
  }

  /**
   * Save all data to CSV files
   */
  private async saveAllData(): Promise<void> {
    console.log('\n💾 Saving data to CSV files...');
    
    try {
      const patterns = this.patternAnalyzer.getAllPatterns();
      
      // Save individual pattern files
      for (const [patternId, pattern] of patterns) {
        const events = this.eventsByPattern.get(patternId) || [];
        if (events.length > 0) {
          await this.csvManager.savePatternToCSV(pattern, events);
        }
      }
      
      // Save summary files
      await this.csvManager.savePatternSummary(patterns);
      await this.csvManager.saveCreatorAnalysis(patterns);
      
      // Print overall statistics
      const stats = this.patternAnalyzer.getPatternStatistics();
      console.log(`\n📈 Overall Statistics:`);
      console.log(`   Total Patterns: ${stats.totalPatterns}`);
      console.log(`   Total Tokens: ${stats.totalTokens}`);
      console.log(`   Total Creators: ${stats.totalCreators}`);
      console.log(`   Average Tokens per Pattern: ${stats.averageTokensPerPattern.toFixed(2)}`);
      
      console.log(`\n📊 Patterns by Creator Count:`);
      for (const [creatorCount, patternCount] of Object.entries(stats.patternsByCreatorCount)) {
        console.log(`   ${creatorCount} creator(s): ${patternCount} pattern(s)`);
      }
      
      console.log('✅ Data saved successfully!');
      
    } catch (error) {
      console.error('❌ Error saving data:', error);
    }
  }
}

// Start the analyzer
const analyzer = new TokenCreatorAnalyzer();
analyzer.start().catch(console.error);




