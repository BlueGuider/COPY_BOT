import { createPublicClient, http, parseAbiItem, formatUnits } from 'viem';
import { mainnet } from 'viem/chains';
import { TokenCreationEvent } from './types.js';
import { CONFIG } from './config.js';
import { FACTORY_ABI } from './contracts.js';

export class EventMonitor {
  private static instance: EventMonitor;
  private client: any;
  private currentBlock: number;

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
  }

  static getInstance(): EventMonitor {
    if (!EventMonitor.instance) {
      EventMonitor.instance = new EventMonitor();
    }
    return EventMonitor.instance;
  }

  /**
   * Start monitoring token creation events
   */
  async startMonitoring(
    onNewEvents: (events: TokenCreationEvent[]) => Promise<void>
  ): Promise<void> {
    console.log(`🚀 Starting event monitoring from block ${this.currentBlock}`);
    
    // First, catch up with historical events
    await this.catchUpHistoricalEvents(onNewEvents);
    
    // Then start real-time monitoring
    this.startRealTimeMonitoring(onNewEvents);
  }

  /**
   * Catch up with historical events
   */
  private async catchUpHistoricalEvents(
    onNewEvents: (events: TokenCreationEvent[]) => Promise<void>
  ): Promise<void> {
    const latestBlock = await this.client.getBlockNumber();
    console.log(`📊 Latest block: ${latestBlock}, Starting from: ${this.currentBlock}`);

    let fromBlock = this.currentBlock;
    
    while (fromBlock < latestBlock) {
      const toBlock = Math.min(fromBlock + CONFIG.BLOCKS_PER_BATCH - 1, Number(latestBlock));
      
      console.log(`🔍 Scanning blocks ${fromBlock} to ${toBlock}...`);
      
      try {
        const events = await this.getTokenCreationEvents(fromBlock, toBlock);
        
        if (events.length > 0) {
          console.log(`📈 Found ${events.length} token creation events in blocks ${fromBlock}-${toBlock}`);
          await onNewEvents(events);
        }
        
        fromBlock = toBlock + 1;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error scanning blocks ${fromBlock}-${toBlock}:`, error);
        // Continue with next batch
        fromBlock = toBlock + 1;
      }
    }
    
    this.currentBlock = Number(latestBlock);
    console.log(`✅ Historical catch-up complete. Current block: ${this.currentBlock}`);
  }

  /**
   * Start real-time monitoring
   */
  private startRealTimeMonitoring(
    onNewEvents: (events: TokenCreationEvent[]) => Promise<void>
  ): void {
    console.log(`👀 Starting real-time monitoring...`);
    
    const monitor = async () => {
      try {
        const latestBlock = await this.client.getBlockNumber();
        
        if (latestBlock > this.currentBlock) {
          console.log(`🔍 Checking new blocks ${this.currentBlock + 1} to ${latestBlock}...`);
          
          const events = await this.getTokenCreationEvents(
            this.currentBlock + 1,
            Number(latestBlock)
          );
          
          if (events.length > 0) {
            console.log(`📈 Found ${events.length} new token creation events`);
            await onNewEvents(events);
          }
          
          this.currentBlock = Number(latestBlock);
        }
        
      } catch (error) {
        console.error(`❌ Error in real-time monitoring:`, error);
      }
      
      // Schedule next check
      setTimeout(monitor, CONFIG.POLLING_INTERVAL);
    };
    
    monitor();
  }

  /**
   * Get token creation events from a block range
   */
  private async getTokenCreationEvents(
    fromBlock: number,
    toBlock: number
  ): Promise<TokenCreationEvent[]> {
    try {
      // Get logs with the specific TokenCreated event topic
      const logs = await this.client.getLogs({
        address: CONFIG.FACTORY_ADDRESS,
        topics: [CONFIG.TOKEN_CREATED_EVENT],
        fromBlock: BigInt(fromBlock),
        toBlock: BigInt(toBlock),
      });

      const events: TokenCreationEvent[] = [];

      for (const log of logs) {
        try {
          const block = await this.client.getBlock({ blockNumber: log.blockNumber });
          
          // Get transaction details to extract gas parameters
          const tx = await this.client.getTransaction({ hash: log.transactionHash! });
          
          // Manually decode the raw log data
          // Based on actual log structure:
          // topics[0]: event signature (0x396d5e902b675b032348d3d2e9517ee8f0c4a926603fbc075d3d282ff00cad20)
          // data: all parameters including token address, creator address, and other params
          
          if (!log.topics || log.topics.length < 1) {
            console.warn(`⚠️ Invalid log structure for ${log.transactionHash}`);
            continue;
          }

          // Parse the data field - all parameters are in the data field
          const data = log.data.slice(2); // Remove '0x' prefix
          const dataParams = [];
          for (let i = 0; i < data.length; i += 64) {
            dataParams.push('0x' + data.slice(i, i + 64));
          }
          
          // Filter for valid token creation events (should have 8 parameters = 514 chars)
          if (dataParams.length < 8 || log.data.length !== 514) {
            // Skip non-token-creation events (they have different data lengths)
            continue;
          }

          // Extract addresses from data (they're the first two parameters)
          const tokenAddress = '0x' + dataParams[0].slice(-40); // Remove 0x and take last 40 chars
          const creatorAddress = '0x' + dataParams[1].slice(-40); // Remove 0x and take last 40 chars
          
          const event: TokenCreationEvent = {
            blockNumber: Number(log.blockNumber),
            transactionHash: log.transactionHash!,
            tokenAddress: tokenAddress,
            creatorAddress: creatorAddress,
            // Transaction parameters (unique to creator)
            transactionGasPrice: tx.gasPrice || 0n,
            transactionGasLimit: tx.gas || 0n,
            // Token parameters (fixed by four.meme) - from decoded data (skip first 2 params which are addresses)
            createFee: BigInt(dataParams[2] || '0'),
            buyGasPrice: BigInt(dataParams[3] || '0'),
            buyGasLimit: BigInt(dataParams[4] || '0'),
            sellGasPrice: BigInt(dataParams[5] || '0'),
            sellGasLimit: BigInt(dataParams[6] || '0'),
            sellFee: BigInt(dataParams[7] || '0'),
            timestamp: new Date(Number(block.timestamp) * 1000),
          };

          events.push(event);
        } catch (error) {
          console.error(`❌ Error processing log ${log.transactionHash}:`, error);
        }
      }

      return events;
    } catch (error) {
      console.error(`❌ Error fetching logs from blocks ${fromBlock}-${toBlock}:`, error);
      return [];
    }
  }

  /**
   * Get current block number
   */
  async getCurrentBlock(): Promise<number> {
    const blockNumber = await this.client.getBlockNumber();
    return Number(blockNumber);
  }
}
