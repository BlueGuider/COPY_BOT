import { createObjectCsvWriter } from 'csv-writer';
import { TokenCreationEvent, CreatorPattern } from './types.js';
import { CONFIG } from './config.js';
import fs from 'fs';
import path from 'path';

export class CSVManager {
  private static instance: CSVManager;
  private outputDir: string;

  constructor() {
    this.outputDir = CONFIG.OUTPUT_DIR;
    this.ensureOutputDir();
  }

  static getInstance(): CSVManager {
    if (!CSVManager.instance) {
      CSVManager.instance = new CSVManager();
    }
    return CSVManager.instance;
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate a unique filename for a creator pattern
   * Based on transaction parameters (the key pattern indicators)
   */
  private generatePatternFileName(pattern: CreatorPattern): string {
    const transactionGasPrice = pattern.transactionGasPrice.toString();
    const transactionGasLimit = pattern.transactionGasLimit.toString();
    
    const patternHash = this.hashPattern({
      transactionGasPrice,
      transactionGasLimit
    });
    
    return `${CONFIG.CSV_FILE_PREFIX}${patternHash}.csv`;
  }

  /**
   * Create a simple hash for the pattern
   */
  private hashPattern(pattern: Record<string, string>): string {
    const str = Object.values(pattern).join('_');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Save token creation events to CSV for a specific pattern
   */
  async savePatternToCSV(pattern: CreatorPattern, events: TokenCreationEvent[]): Promise<void> {
    const fileName = this.generatePatternFileName(pattern);
    const filePath = path.join(this.outputDir, fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'blockNumber', title: 'Block Number' },
        { id: 'transactionHash', title: 'Transaction Hash' },
        { id: 'tokenAddress', title: 'Token Address' },
        { id: 'creatorAddress', title: 'Creator Address' },
        { id: 'transactionGasPrice', title: 'Transaction Gas Price (wei)' },
        { id: 'transactionGasLimit', title: 'Transaction Gas Limit' },
        { id: 'createFee', title: 'Create Fee (wei)' },
        { id: 'buyGasPrice', title: 'Buy Gas Price (wei)' },
        { id: 'buyGasLimit', title: 'Buy Gas Limit' },
        { id: 'sellGasPrice', title: 'Sell Gas Price (wei)' },
        { id: 'sellGasLimit', title: 'Sell Gas Limit' },
        { id: 'sellFee', title: 'Sell Fee (wei)' }
      ]
    });

    const csvData = events.map(event => ({
      timestamp: event.timestamp.toISOString(),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      tokenAddress: event.tokenAddress,
      creatorAddress: event.creatorAddress,
      transactionGasPrice: event.transactionGasPrice.toString(),
      transactionGasLimit: event.transactionGasLimit.toString(),
      createFee: event.createFee.toString(),
      buyGasPrice: event.buyGasPrice.toString(),
      buyGasLimit: event.buyGasLimit.toString(),
      sellGasPrice: event.sellGasPrice?.toString() || '',
      sellGasLimit: event.sellGasLimit?.toString() || '',
      sellFee: event.sellFee?.toString() || ''
    }));

    await csvWriter.writeRecords(csvData);
    console.log(`📊 Saved ${events.length} events to ${fileName}`);
  }

  /**
   * Save pattern summary to CSV
   */
  async savePatternSummary(patterns: Map<string, CreatorPattern>): Promise<void> {
    const fileName = path.join(this.outputDir, 'pattern_summary.csv');
    
    const csvWriter = createObjectCsvWriter({
      path: fileName,
      header: [
        { id: 'patternId', title: 'Pattern ID' },
        { id: 'transactionGasPrice', title: 'Transaction Gas Price (wei)' },
        { id: 'transactionGasLimit', title: 'Transaction Gas Limit' },
        { id: 'createFee', title: 'Create Fee (wei)' },
        { id: 'buyGasPrice', title: 'Buy Gas Price (wei)' },
        { id: 'buyGasLimit', title: 'Buy Gas Limit' },
        { id: 'sellGasPrice', title: 'Sell Gas Price (wei)' },
        { id: 'sellGasLimit', title: 'Sell Gas Limit' },
        { id: 'sellFee', title: 'Sell Fee (wei)' },
        { id: 'creatorCount', title: 'Unique Creators' },
        { id: 'tokenCount', title: 'Total Tokens' },
        { id: 'firstSeen', title: 'First Seen' },
        { id: 'lastSeen', title: 'Last Seen' }
      ]
    });

    const summaryData = Array.from(patterns.values()).map(pattern => ({
      patternId: pattern.patternId,
      transactionGasPrice: pattern.transactionGasPrice.toString(),
      transactionGasLimit: pattern.transactionGasLimit.toString(),
      createFee: pattern.createFee.toString(),
      buyGasPrice: pattern.buyGasPrice.toString(),
      buyGasLimit: pattern.buyGasLimit.toString(),
      sellGasPrice: pattern.sellGasPrice?.toString() || '',
      sellGasLimit: pattern.sellGasLimit?.toString() || '',
      sellFee: pattern.sellFee?.toString() || '',
      creatorCount: pattern.creatorAddresses.size,
      tokenCount: pattern.count,
      firstSeen: pattern.firstSeen.toISOString(),
      lastSeen: pattern.lastSeen.toISOString()
    }));

    await csvWriter.writeRecords(summaryData);
    console.log(`📋 Saved pattern summary to pattern_summary.csv`);
  }

  /**
   * Create a detailed creator analysis CSV
   */
  async saveCreatorAnalysis(patterns: Map<string, CreatorPattern>): Promise<void> {
    const fileName = path.join(this.outputDir, 'creator_analysis.csv');
    
    const csvWriter = createObjectCsvWriter({
      path: fileName,
      header: [
        { id: 'creatorAddress', title: 'Creator Address' },
        { id: 'patternId', title: 'Pattern ID' },
        { id: 'tokenCount', title: 'Tokens Created' },
        { id: 'firstToken', title: 'First Token' },
        { id: 'lastToken', title: 'Last Token' },
        { id: 'transactionGasPrice', title: 'Transaction Gas Price (wei)' },
        { id: 'transactionGasLimit', title: 'Transaction Gas Limit' },
        { id: 'createFee', title: 'Create Fee (wei)' },
        { id: 'buyGasPrice', title: 'Buy Gas Price (wei)' },
        { id: 'sellGasPrice', title: 'Sell Gas Price (wei)' }
      ]
    });

    const analysisData: any[] = [];
    
    for (const pattern of patterns.values()) {
      for (const creatorAddress of pattern.creatorAddresses) {
        const creatorTokens = pattern.tokenAddresses.filter((_, index) => 
          Array.from(pattern.creatorAddresses)[index] === creatorAddress
        );
        
        analysisData.push({
          creatorAddress,
          patternId: pattern.patternId,
          tokenCount: creatorTokens.length,
          firstToken: creatorTokens[0] || '',
          lastToken: creatorTokens[creatorTokens.length - 1] || '',
          transactionGasPrice: pattern.transactionGasPrice.toString(),
          transactionGasLimit: pattern.transactionGasLimit.toString(),
          createFee: pattern.createFee.toString(),
          buyGasPrice: pattern.buyGasPrice.toString(),
          sellGasPrice: pattern.sellGasPrice?.toString() || ''
        });
      }
    }

    await csvWriter.writeRecords(analysisData);
    console.log(`👤 Saved creator analysis to creator_analysis.csv`);
  }
}
