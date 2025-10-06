export const CONFIG = {
  // BSC Mainnet RPC - Using Chainstack endpoint that supports eth_getLogs
  RPC_URL: 'https://bsc-mainnet.core.chainstack.com/7727aa61bd5196fbf1467872aa973933',
  
  // Four.meme Factory Contract
  FACTORY_ADDRESS: '0x5c952063c7fc8610FFDB798152D69F0B9550762b' as const,
  
  // Event signatures - using the actual topic that exists in the logs
  TOKEN_CREATED_EVENT: '0x7db52723a3b2cdd6164364b3b766e65e540d7be48ffa89582956d8eaebe62942',
  
  // Monitoring settings
  START_BLOCK: 62121000, // Start from a very recent block
  BLOCKS_PER_BATCH: 50, // Very small batches for Chainstack limits
  POLLING_INTERVAL: 3000, // 3 seconds
  
  // Output settings
  OUTPUT_DIR: './output',
  CSV_FILE_PREFIX: 'creator_pattern_',
  
  // Pattern matching tolerance
  GAS_PRICE_TOLERANCE: 0.01, // 0.01 BNB tolerance for gas prices
  FEE_TOLERANCE: 1000, // 1000 wei tolerance for fees
} as const;
