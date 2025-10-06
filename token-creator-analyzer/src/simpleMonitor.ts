import { createPublicClient, http, formatUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { CONFIG } from './config.js';
import { CSVManager } from './csvManager.js';
import { PatternAnalyzer } from './patternAnalyzer.js';
import { TokenCreationEvent } from './types.js';

export class SimpleMonitor {
  private static instance: SimpleMonitor;
  private client: any;
  private currentBlock: number;
  private csvManager: CSVManager;
  private patternAnalyzer: PatternAnalyzer;

  constructor() {
    // Create a custom chain for BSC
    const bscChain = {
      ...mainnet,
      id: 56,
      name: 'BNB Smart Chain',
      network: 'bsc',
      nativeCurrency: {
        decimals: 18,
        name: 'BNB',
        symbol: 'BNB',
      },
      rpcUrls: {
        default: {
          http: [CONFIG.RPC_URL],
        },
        public: {
          http: [CONFIG.RPC_URL],
        },
      },
      blockExplorers: {
        default: {
          name: 'BSCScan',
          url: 'https://bscscan.com',
        },
      },
    };

    this.client = createPublicClient({
      chain: bscChain,
      transport: http(CONFIG.RPC_URL),
    });

    this.currentBlock = CONFIG.START_BLOCK;
    this.csvManager = CSVManager.getInstance();
    this.patternAnalyzer = PatternAnalyzer.getInstance();
  }

  static getInstance(): SimpleMonitor {
    if (!SimpleMonitor.instance) {
      SimpleMonitor.instance = new SimpleMonitor();
    }
    return SimpleMonitor.instance;
  }

  /**
   * Start monitoring by checking recent transactions
   */
  async startMonitoring(): Promise<void> {
    console.log(`🚀 Starting simple monitoring from block ${this.currentBlock}`);
    
    const monitor = async () => {
      try {
        const latestBlock = await this.client.getBlockNumber();
        
        if (latestBlock > this.currentBlock) {
          console.log(`🔍 Checking new blocks ${this.currentBlock + 1} to ${latestBlock}...`);
          
          // Check each new block for transactions to the factory contract
          for (let blockNum = this.currentBlock + 1; blockNum <= latestBlock; blockNum++) {
            await this.checkBlock(Number(blockNum));
          }
          
          this.currentBlock = Number(latestBlock);
        }
        
      } catch (error) {
        console.error(`❌ Error in monitoring:`, error);
      }
      
      // Schedule next check
      setTimeout(monitor, CONFIG.POLLING_INTERVAL);
    };
    
    monitor();
  }

  /**
   * Check a specific block for token creation transactions
   */
  private async checkBlock(blockNumber: number): Promise<void> {
    try {
      const block = await this.client.getBlock({ 
        blockNumber: BigInt(blockNumber),
        includeTransactions: true 
      });

      if (!block.transactions) return;

      for (const tx of block.transactions) {
        if (typeof tx === 'object' && tx.to?.toLowerCase() === CONFIG.FACTORY_ADDRESS.toLowerCase()) {
          await this.analyzeTransaction(tx, blockNumber, block.timestamp);
        }
      }
    } catch (error) {
      console.error(`❌ Error checking block ${blockNumber}:`, error);
    }
  }

  /**
   * Analyze a transaction to extract token creation data
   */
  private async analyzeTransaction(tx: any, blockNumber: number, timestamp: bigint): Promise<void> {
    try {
      console.log(`🔍 Analyzing transaction ${tx.hash} in block ${blockNumber}`);
      
      // Get transaction receipt to see events
      const receipt = await this.client.getTransactionReceipt({ hash: tx.hash });
      
      if (!receipt.logs || receipt.logs.length === 0) {
        console.log(`   No logs found in transaction ${tx.hash}`);
        return;
      }

      // Look for token creation events
      for (const log of receipt.logs) {
        if (this.isTokenCreationLog(log)) {
          const event = this.parseTokenCreationLog(log, blockNumber, timestamp);
          if (event) {
            await this.processTokenCreationEvent(event);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error analyzing transaction ${tx.hash}:`, error);
    }
  }

  /**
   * Check if a log is a token creation event
   */
  private isTokenCreationLog(log: any): boolean {
    // Check if it's from the factory contract
    if (log.address.toLowerCase() !== CONFIG.FACTORY_ADDRESS.toLowerCase()) {
      return false;
    }

    // Check if it has the right number of topics (token creation events have specific structure)
    // Token creation events typically have multiple topics and data
    return log.topics.length >= 2 && log.data && log.data.length > 2;
  }

  /**
   * Parse a token creation log
   */
  private parseTokenCreationLog(log: any, blockNumber: number, timestamp: bigint): TokenCreationEvent | null {
    try {
      // This is a simplified parser - in a real implementation, you'd need to decode the event data
      // For now, we'll create a mock event to demonstrate the structure
      
      const event: TokenCreationEvent = {
        blockNumber,
        transactionHash: log.transactionHash,
        tokenAddress: log.topics[1] || '0x0000000000000000000000000000000000000000',
        creatorAddress: log.topics[2] || '0x0000000000000000000000000000000000000000',
        // Transaction parameters (unique to creator) - would need to be extracted from transaction
        transactionGasPrice: 0n, // TODO: Extract from actual transaction
        transactionGasLimit: 0n, // TODO: Extract from actual transaction
        // Token parameters (fixed by four.meme)
        createFee: 0n,
        buyGasPrice: 0n,
        buyGasLimit: 0n,
        sellGasPrice: undefined,
        sellGasLimit: undefined,
        sellFee: undefined,
        timestamp: new Date(Number(timestamp) * 1000),
      };

      console.log(`   📊 Parsed token creation event:`);
      console.log(`      Token: ${event.tokenAddress}`);
      console.log(`      Creator: ${event.creatorAddress}`);
      console.log(`      Block: ${blockNumber}`);

      return event;
    } catch (error) {
      console.error(`❌ Error parsing log:`, error);
      return null;
    }
  }

  /**
   * Process a token creation event
   */
  private async processTokenCreationEvent(event: TokenCreationEvent): Promise<void> {
    console.log(`🪙 Processing token creation event:`);
    console.log(`   Token: ${event.tokenAddress}`);
    console.log(`   Creator: ${event.creatorAddress}`);

    // Classify the event
    const classification = this.patternAnalyzer.classifyEvent(event);
    
    if (classification.isNewPattern) {
      console.log(`   🆕 NEW PATTERN: ${classification.patternId}`);
    } else {
      console.log(`   🔄 EXISTING PATTERN: ${classification.patternId}`);
    }

    // Print pattern statistics
    this.printPatternStats(classification.patternId);
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
  async saveAllData(): Promise<void> {
    console.log('\n💾 Saving data to CSV files...');
    
    try {
      const patterns = this.patternAnalyzer.getAllPatterns();
      
      // Save individual pattern files
      for (const [patternId, pattern] of patterns) {
        const events: TokenCreationEvent[] = []; // In a real implementation, you'd store events by pattern
        if (events.length > 0) {
          await this.csvManager.savePatternToCSV(pattern, events);
        }
      }
      
      // Save summary files
      await this.csvManager.savePatternSummary(patterns);
      await this.csvManager.saveCreatorAnalysis(patterns);
      
      console.log('✅ Data saved successfully!');
      
    } catch (error) {
      console.error('❌ Error saving data:', error);
    }
  }
}
