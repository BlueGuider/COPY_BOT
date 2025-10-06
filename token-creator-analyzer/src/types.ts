export interface TokenCreationEvent {
  blockNumber: number;
  transactionHash: string;
  tokenAddress: string;
  creatorAddress: string;
  // Transaction parameters (unique to creator)
  transactionGasPrice: bigint;  // Gas price used for the transaction
  transactionGasLimit: bigint;  // Gas limit set for the transaction
  // Token parameters (fixed by four.meme - same for all tokens)
  createFee: bigint;
  buyGasPrice: bigint;
  buyGasLimit: bigint;
  sellGasPrice?: bigint;
  sellGasLimit?: bigint;
  sellFee?: bigint;
  timestamp: Date;
}

export interface CreatorPattern {
  patternId: string;
  // Transaction parameters (used for pattern classification)
  transactionGasPrice: bigint;  // Gas price pattern
  transactionGasLimit: bigint;  // Gas limit pattern
  // Token parameters (fixed by four.meme - for reference only)
  createFee: bigint;
  buyGasPrice: bigint;
  buyGasLimit: bigint;
  sellGasPrice?: bigint;
  sellGasLimit?: bigint;
  sellFee?: bigint;
  creatorAddresses: Set<string>;
  tokenAddresses: string[];
  firstSeen: Date;
  lastSeen: Date;
  count: number;
}

export interface CreatorClassification {
  patternId: string;
  pattern: CreatorPattern;
  isNewPattern: boolean;
}
