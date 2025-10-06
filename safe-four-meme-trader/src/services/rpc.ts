import { createPublicClient, http, fallback, createWalletClient as viemCreateWalletClient, PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { config } from '../config';

/**
 * RPC service with multiple provider fallbacks and retry logic
 */

// Multiple BSC RPC endpoints for redundancy - OPTIMIZED BY SPEED
const BSC_RPC_ENDPOINTS = [
  // FASTEST ENDPOINTS FIRST (from speed test results)
  'https://bsc-rpc.publicnode.com',           // 21.33ms - FASTEST
  'https://bsc.publicnode.com',               // 23.33ms - FAST
  'https://bsc.meowrpc.com',                  // 29.67ms - FAST
  
  // RELIABLE BINANCE ENDPOINTS (as fallbacks)
  'https://bsc-dataseed1.binance.org',        // 64.33ms - RELIABLE
  'https://bsc-dataseed2.binance.org',        // 85.33ms - RELIABLE
  'https://bsc-dataseed3.binance.org',
  'https://bsc-dataseed4.binance.org',
  
  // OTHER FALLBACKS
  'https://go.getblock.io/143bad395797494787f59f3647669e5d', // 43.67ms - GOOD
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed2.defibit.io',
  'https://bsc-dataseed1.ninicoin.io',
  'https://bsc-dataseed2.ninicoin.io',
  'https://bsc-dataseed.binance.org',
  
  // LAST RESORT FALLBACKS
  // 'https://bsc-mainnet.public.blastapi.io',   // 39.00ms - SLOWER THAN PUBLICNODE
  // 'https://muddy-serene-fog.bsc.quiknode.pro/9cf0f2833b90790c97339c587a75e927fa0361ef', // 97.33ms - SLOWEST
];

// Create transport with fallback
const createTransport = () => {
  const transports = BSC_RPC_ENDPOINTS.map(url => 
    http(url, {
      timeout: 1200, // tighter timeout for lower latency
      retryCount: 0, // do not retry per endpoint, let fallback handle it
      retryDelay: 100 // short delay if any
    })
  );
  
  return fallback(transports, {
    rank: false, // Don't rank by response time - use order in array
    retryCount: 1, // minimal retries across transports
    retryDelay: 150 // quicker fallback between endpoints
  });
};

// Create public client with fallback transport
export const publicClient: PublicClient = createPublicClient({
  chain: bsc,
  transport: createTransport()
});

/**
 * Create wallet client for transaction signing
 */
export const createWalletClient = (privateKey: `0x${string}`): any => {
  return viemCreateWalletClient({
    account: privateKeyToAccount(privateKey),
    transport: createTransport(),
    chain: bsc
  });
};

/**
 * Retry function with exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error instanceof Error) {
        if (error.message.includes('insufficient funds') || 
            error.message.toLowerCase().includes('nonce') ||
            error.message.includes('invalid signature') ||
            error.message.includes('already known') ||
            error.message.includes('replacement transaction underpriced')) {
          throw error;
        }
      }
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`Retry attempt ${attempt + 1}/${maxRetries + 1} in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

/**
 * Get current gas price with retry logic
 */
export const getCurrentGasPrice = async (): Promise<bigint> => {
  return retryWithBackoff(async () => {
    const mode = config.trading.gasPriceMode || 'network';
    const minGasPrice = parseFloat(config.trading.minGasPrice);
    const maxGasPrice = parseFloat(config.trading.maxGasPrice);
    const multiplier = config.trading.gasPriceMultiplier;

    if (mode === 'fixed' && config.trading.fixedGasPrice) {
      const fixed = Math.max(Math.min(parseFloat(config.trading.fixedGasPrice), maxGasPrice), minGasPrice);
      console.log(`Using fixed gas price from env: ${fixed} gwei`);
      return BigInt(Math.floor(fixed * 1e9));
    }

    const gasPrice = await publicClient.getGasPrice();
    const gasPriceGwei = Number(gasPrice) / 1e9;
    console.log(`Current network gas price: ${gasPriceGwei} gwei`);

    let adjustedGasPrice = gasPriceGwei * multiplier;
    adjustedGasPrice = Math.max(adjustedGasPrice, minGasPrice);
    adjustedGasPrice = Math.min(adjustedGasPrice, maxGasPrice);
    console.log(`Adjusted gas price: ${adjustedGasPrice} gwei (multiplier: ${multiplier})`);

    return BigInt(Math.floor(adjustedGasPrice * 1e9));
  });
};

/**
 * Get current block number with retry logic
 */
export const getCurrentBlockNumber = async (): Promise<bigint> => {
  return retryWithBackoff(async () => {
    return await publicClient.getBlockNumber();
  });
};

/**
 * Get transaction count (nonce) for an address with retry logic
 */
export const getTransactionCount = async (address: `0x${string}`): Promise<number> => {
  return retryWithBackoff(async () => {
    // Use pending to include queued transactions, reducing nonce-too-low errors
    return await publicClient.getTransactionCount({ address, blockTag: 'pending' });
  });
};

/**
 * Get balance for an address with retry logic
 */
export const getBalance = async (address: `0x${string}`): Promise<bigint> => {
  return retryWithBackoff(async () => {
    return await publicClient.getBalance({ address });
  });
};

/**
 * Wait for transaction confirmation with retry logic
 */
export const waitForTransaction = async (txHash: `0x${string}`, confirmations: number = 1): Promise<any> => {
  return retryWithBackoff(async () => {
    return await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations
    });
  });
};

/**
 * Check if address is a contract with retry logic
 */
export const isContract = async (address: `0x${string}`): Promise<boolean> => {
  return retryWithBackoff(async () => {
    try {
      const code = await publicClient.getCode({ address });
      return code !== '0x';
    } catch (error) {
      console.error('Error checking if address is contract:', error);
      return false;
    }
  });
};

/**
 * Get block timestamp with retry logic
 */
export const getBlockTimestamp = async (blockNumber: bigint): Promise<bigint> => {
  return retryWithBackoff(async () => {
    const block = await publicClient.getBlock({ blockNumber });
    return block.timestamp;
  });
};

/**
 * Send raw transaction with retry logic
 */
export const sendRawTransaction = async (serializedTransaction: `0x${string}`): Promise<`0x${string}`> => {
  return retryWithBackoff(async () => {
    return await publicClient.sendRawTransaction({ serializedTransaction });
  }, 2, 400);
};

/**
 * Get block with retry logic
 */
export const getBlock = async (blockNumber: bigint) => {
  return retryWithBackoff(async () => {
    return await publicClient.getBlock({ blockNumber });
  });
};

/**
 * Test which RPC endpoint is currently being used
 */
export const getCurrentRPCEndpoint = async (): Promise<string> => {
  try {
    // Make a simple call to see which endpoint responds
    await publicClient.getBlockNumber();
    return 'Endpoint working (check logs for actual URL)';
  } catch (error) {
    return `Error: ${(error as Error).message}`;
  }
};

/**
 * Test RPC connectivity
 */
export const testRPCConnectivity = async (): Promise<{ success: boolean; workingEndpoints: string[]; errors: string[] }> => {
  const workingEndpoints: string[] = [];
  const errors: string[] = [];
  
  for (const endpoint of BSC_RPC_ENDPOINTS) {
    try {
      const testClient = createPublicClient({
        chain: bsc,
        transport: http(endpoint, { timeout: 5000 })
      });
      
      await testClient.getBlockNumber();
      workingEndpoints.push(endpoint);
      console.log(`✅ RPC endpoint working: ${endpoint}`);
    } catch (error) {
      const errorMsg = `${endpoint}: ${(error as Error).message}`;
      errors.push(errorMsg);
      console.log(`❌ RPC endpoint failed: ${errorMsg}`);
    }
  }
  
  return {
    success: workingEndpoints.length > 0,
    workingEndpoints,
    errors
  };
};
