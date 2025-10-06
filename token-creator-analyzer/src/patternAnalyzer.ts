import { TokenCreationEvent, CreatorPattern, CreatorClassification } from './types.js';
import { CONFIG } from './config.js';

export class PatternAnalyzer {
  private static instance: PatternAnalyzer;
  private patterns: Map<string, CreatorPattern> = new Map();

  static getInstance(): PatternAnalyzer {
    if (!PatternAnalyzer.instance) {
      PatternAnalyzer.instance = new PatternAnalyzer();
    }
    return PatternAnalyzer.instance;
  }

  /**
   * Classify a token creation event into existing or new pattern
   */
  classifyEvent(event: TokenCreationEvent): CreatorClassification {
    const existingPattern = this.findMatchingPattern(event);
    
    if (existingPattern) {
      // Update existing pattern
      this.updatePattern(existingPattern, event);
      return {
        patternId: existingPattern.patternId,
        pattern: existingPattern,
        isNewPattern: false
      };
    } else {
      // Create new pattern
      const newPattern = this.createNewPattern(event);
      this.patterns.set(newPattern.patternId, newPattern);
      return {
        patternId: newPattern.patternId,
        pattern: newPattern,
        isNewPattern: true
      };
    }
  }

  /**
   * Find a matching pattern for the event
   */
  private findMatchingPattern(event: TokenCreationEvent): CreatorPattern | null {
    for (const pattern of this.patterns.values()) {
      if (this.isPatternMatch(pattern, event)) {
        return pattern;
      }
    }
    return null;
  }

  /**
   * Check if an event matches a pattern
   * Focus on transaction parameters (unique to creator) for pattern classification
   */
  private isPatternMatch(pattern: CreatorPattern, event: TokenCreationEvent): boolean {
    // Check transaction gas price (with tolerance) - KEY PATTERN INDICATOR
    if (!this.isWithinTolerance(pattern.transactionGasPrice, event.transactionGasPrice, CONFIG.GAS_PRICE_TOLERANCE)) {
      return false;
    }

    // Check transaction gas limit (exact match) - KEY PATTERN INDICATOR
    if (pattern.transactionGasLimit !== event.transactionGasLimit) {
      return false;
    }

    // Note: We don't check the four.meme fixed parameters (createFee, buyGasPrice, etc.)
    // because they are the same for all tokens and don't help identify creator patterns

    return true;
  }

  /**
   * Check if two values are within tolerance
   */
  private isWithinTolerance(value1: bigint, value2: bigint, tolerance: number): boolean {
    if (value1 === value2) return true;
    
    const diff = value1 > value2 ? value1 - value2 : value2 - value1;
    
    // For gas prices, tolerance is a percentage (e.g., 0.01 = 1%)
    // Calculate the percentage difference
    const avg = (value1 + value2) / 2n;
    if (avg === 0n) return false;
    
    const percentageDiff = Number(diff * 10000n / avg) / 10000; // Convert to decimal
    return percentageDiff <= tolerance;
  }

  /**
   * Create a new pattern from an event
   */
  private createNewPattern(event: TokenCreationEvent): CreatorPattern {
    const patternId = this.generatePatternId(event);
    
    return {
      patternId,
      // Transaction parameters (used for pattern classification)
      transactionGasPrice: event.transactionGasPrice,
      transactionGasLimit: event.transactionGasLimit,
      // Token parameters (fixed by four.meme - for reference only)
      createFee: event.createFee,
      buyGasPrice: event.buyGasPrice,
      buyGasLimit: event.buyGasLimit,
      sellGasPrice: event.sellGasPrice,
      sellGasLimit: event.sellGasLimit,
      sellFee: event.sellFee,
      creatorAddresses: new Set([event.creatorAddress]),
      tokenAddresses: [event.tokenAddress],
      firstSeen: event.timestamp,
      lastSeen: event.timestamp,
      count: 1
    };
  }

  /**
   * Update an existing pattern with a new event
   */
  private updatePattern(pattern: CreatorPattern, event: TokenCreationEvent): void {
    pattern.creatorAddresses.add(event.creatorAddress);
    pattern.tokenAddresses.push(event.tokenAddress);
    pattern.lastSeen = event.timestamp;
    pattern.count++;
  }

  /**
   * Generate a unique pattern ID based on transaction parameters
   */
  private generatePatternId(event: TokenCreationEvent): string {
    // Use transaction parameters for pattern ID (not four.meme fixed parameters)
    const components = [
      event.transactionGasPrice.toString(),
      event.transactionGasLimit.toString()
    ];
    
    const hash = this.simpleHash(components.join('_'));
    return `pattern_${hash}`;
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Get all patterns
   */
  getAllPatterns(): Map<string, CreatorPattern> {
    return this.patterns;
  }

  /**
   * Get pattern statistics
   */
  getPatternStatistics(): {
    totalPatterns: number;
    totalTokens: number;
    totalCreators: number;
    averageTokensPerPattern: number;
    patternsByCreatorCount: Record<number, number>;
  } {
    const totalPatterns = this.patterns.size;
    const totalTokens = Array.from(this.patterns.values()).reduce((sum, pattern) => sum + pattern.count, 0);
    const totalCreators = Array.from(this.patterns.values()).reduce((sum, pattern) => sum + pattern.creatorAddresses.size, 0);
    const averageTokensPerPattern = totalPatterns > 0 ? totalTokens / totalPatterns : 0;

    const patternsByCreatorCount: Record<number, number> = {};
    for (const pattern of this.patterns.values()) {
      const creatorCount = pattern.creatorAddresses.size;
      patternsByCreatorCount[creatorCount] = (patternsByCreatorCount[creatorCount] || 0) + 1;
    }

    return {
      totalPatterns,
      totalTokens,
      totalCreators,
      averageTokensPerPattern,
      patternsByCreatorCount
    };
  }
}
