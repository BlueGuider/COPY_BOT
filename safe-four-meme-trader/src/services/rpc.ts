import { createPublicClient, http, fallback, createWalletClient as viemCreateWalletClient, PublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bsc } from 'viem/chains';
import { config } from '../config';

/**
 * RPC service with multiple provider fallbacks and retry logic
 */

// Multiple BSC RPC endpoints for redundancy (public first to reduce CU burn on paid providers)
const BSC_RPC_ENDPOINTS: string[] = (() => {
  const fromEnv = (process.env.BSC_RPC_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;

  const defaults: string[] = [
    // Public endpoints first
    'https://bsc-rpc.publicnode.com',
    'https://bsc.publicnode.com',
    'https://bsc.meowrpc.com',
    // Configured single URL (if provided)
    config.BSC_RPC_URL,
    // Other fallbacks
    'https://go.getblock.io/143bad395797494787f59f3647669e5d',
    // Paid endpoints LAST (avoid burning CUs unless needed)
    'https://bsc-mainnet.rpcfast.com?api_key=9aC7rb178eGD3tx949iD4kVSinSo5ZaptebOBkqGvt6UIUp50dlXSAlDttR6ei2E',
    'https://bsc-mainnet.rpcfast.com?api_key=Gs2pjm79Fc7KjNH2Ey4Js89zbRMgZTpPajhFxlIt3jkE9WTYQr5PRT38dCO5pxi1',
  ].filter(Boolean);

  // De-duplicate while preserving order
  return Array.from(new Set(defaults));
})();

// --- CU instrumentation and rate limiter ---
type RpcMethodName = string;

type RpcPayload = { id?: number | string; method: RpcMethodName; params?: any[] } | Array<{ id?: number | string; method: RpcMethodName; params?: any[] }>;

const DEFAULT_CU_WEIGHTS: Record<RpcMethodName, number> = {
  // Light
  eth_chainId: 1,
  net_version: 1,
  web3_clientVersion: 1,
  eth_blockNumber: 1,
  eth_gasPrice: 2,
  // Medium
  eth_getBalance: 3,
  eth_getCode: 4,
  eth_getTransactionByHash: 3,
  eth_getTransactionReceipt: 8,
  eth_getTransactionCount: 3,
  eth_call: 6,
  // Heavy
  eth_getLogs: 20,
  eth_sendRawTransaction: 15,
  eth_getBlockByNumber: 8, // adjusted higher if includeTransactions=true
  eth_getBlockByHash: 8,   // adjusted higher if includeTransactions=true
};

const USER_CU_WEIGHTS: Partial<Record<RpcMethodName, number>> = (() => {
  try {
    return process.env.RPC_CU_WEIGHTS ? JSON.parse(process.env.RPC_CU_WEIGHTS) : {};
  } catch {
    return {};
  }
})();

function weightFor(method: RpcMethodName, params?: any[]): number {
  // Include-transactions boost
  if ((method === 'eth_getBlockByNumber' || method === 'eth_getBlockByHash') && Array.isArray(params)) {
    const includeTxs = Boolean(params[1]);
    const base = USER_CU_WEIGHTS[method] ?? DEFAULT_CU_WEIGHTS[method] ?? 5;
    return includeTxs ? base * 4 : base; // heuristic multiplier
  }
  return USER_CU_WEIGHTS[method] ?? DEFAULT_CU_WEIGHTS[method] ?? 5;
}

const metrics = {
  callsByMethod: new Map<RpcMethodName, number>(),
  estCusByMethod: new Map<RpcMethodName, number>(),
  estCusTimeline: [] as Array<{ ts: number; cus: number; endpoint: string }>,
  byEndpoint: new Map<string, { calls: number; estCus: number }>(),
  headerCusTotal: 0,
  headerLastSeen: {} as Record<string, string>,
};

function recordUsage(endpointUrl: string, methodWeights: Array<{ method: RpcMethodName; weight: number }>) {
  const now = Date.now();
  let reqCus = 0;
  for (const { method, weight } of methodWeights) {
    reqCus += weight;
    metrics.callsByMethod.set(method, (metrics.callsByMethod.get(method) || 0) + 1);
    metrics.estCusByMethod.set(method, (metrics.estCusByMethod.get(method) || 0) + weight);
  }
  metrics.estCusTimeline.push({ ts: now, cus: reqCus, endpoint: endpointUrl });
  const ep = metrics.byEndpoint.get(endpointUrl) || { calls: 0, estCus: 0 };
  ep.calls += 1;
  ep.estCus += reqCus;
  metrics.byEndpoint.set(endpointUrl, ep);

  // Trim old entries (> 5 minutes) to bound memory
  const cutoff = now - 5 * 60_000;
  if (metrics.estCusTimeline.length > 5000) {
    metrics.estCusTimeline = metrics.estCusTimeline.filter((e) => e.ts >= cutoff);
  }
}

function parsePayload(body: any): Array<{ method: RpcMethodName; params?: any[] }> {
  try {
    const s = typeof body === 'string' ? body : body?.toString?.();
    if (!s) return [];
    const json = JSON.parse(s) as RpcPayload;
    if (Array.isArray(json)) {
      return json.map((j) => ({ method: j.method, params: j.params }));
    }
    return json && (json as any).method ? [{ method: (json as any).method, params: (json as any).params }] : [];
  } catch {
    return [];
  }
}

// Simple global CU token bucket (optional; disabled unless RPC_CU_BUDGET_PER_SEC set)
const CU_BUDGET_PER_SEC = process.env.RPC_CU_BUDGET_PER_SEC ? Math.max(1, parseInt(process.env.RPC_CU_BUDGET_PER_SEC)) : undefined;
let cuTokens = CU_BUDGET_PER_SEC ?? 0;
let lastRefill = Date.now();

function refillTokens() {
  if (CU_BUDGET_PER_SEC === undefined) return;
  const now = Date.now();
  const elapsedSec = (now - lastRefill) / 1000;
  if (elapsedSec > 0) {
    cuTokens = Math.min(CU_BUDGET_PER_SEC, cuTokens + elapsedSec * CU_BUDGET_PER_SEC);
    lastRefill = now;
  }
}

async function enforceBudget(needed: number) {
  if (CU_BUDGET_PER_SEC === undefined) return; // limiter disabled
  // Busy-wait with small sleeps until tokens sufficient
  // Use coarse sleeps to avoid tight loops
  // eslint-disable-next-line no-constant-condition
  while (true) {
    refillTokens();
    if (cuTokens >= needed) {
      cuTokens -= needed;
      return;
    }
    const deficit = needed - cuTokens;
    const waitMs = Math.max(5, Math.ceil((deficit / CU_BUDGET_PER_SEC) * 1000));
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 200)));
  }
}

function instrumentedFetchFor(endpointUrl: string) {
  const baseFetch = (globalThis as any).fetch as typeof fetch;
  const endpointHost = (() => {
    try { return new URL(endpointUrl).host; } catch { return endpointUrl; }
  })();

  return async (url: any, init?: any) => {
    // Estimate request CU before sending
    const calls = parsePayload(init?.body);
    const methodWeights = calls.map(({ method, params }) => ({ method, weight: weightFor(method, params) }));
    const reqCu = methodWeights.reduce((s, c) => s + c.weight, 0);
    await enforceBudget(reqCu);

    const res = await baseFetch(url, init);

    // Record header-based CUs if provider exposes them
    try {
      for (const [k, v] of (res.headers as any).entries?.() || []) {
        const key = String(k).toLowerCase();
        if (key.includes('cu') || key.includes('compute') || key.includes('ratelimit')) {
          metrics.headerLastSeen[key] = String(v);
          const maybeNum = Number(v);
          if (!Number.isNaN(maybeNum) && /cu|compute/.test(key)) {
            metrics.headerCusTotal += maybeNum;
          }
        }
      }
    } catch {}

    // Record our estimate
    recordUsage(endpointHost, methodWeights);
    return res;
  };
}

// Create transport with fallback
const createTransport = () => {
  const transports = BSC_RPC_ENDPOINTS.map((url) =>
    http(url, {
      timeout: 1500,
      retryCount: 0,
      retryDelay: 100,
      fetch: instrumentedFetchFor(url),
    })
  );

  return fallback(transports, {
    rank: false,
    retryCount: 1,
    retryDelay: 150,
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
    return 'Endpoint working (check metrics for usage details)';
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

/**
 * Get a snapshot of RPC usage for observability.
 * windowMs: time window to aggregate over (default: 60s)
 */
export function getRpcMetricsSnapshot(windowMs: number = 60_000): {
  callsByMethod: Record<string, number>;
  estCusByMethod: Record<string, number>;
  estCusTotal: number;
  estCusPerSecAvg: number;
  estCusPerSecCurrent: number;
  byEndpoint: Record<string, { calls: number; estCus: number }>;
  headerCusTotal: number;
  headerLastSeen: Record<string, string>;
} {
  const now = Date.now();
  const since = now - windowMs;
  const inWindow = metrics.estCusTimeline.filter((e) => e.ts >= since);
  const estCusTotal = inWindow.reduce((s, e) => s + e.cus, 0);

  // Current second usage
  const currentSecond = now - 1000;
  const currentCus = metrics.estCusTimeline
    .filter((e) => e.ts >= currentSecond)
    .reduce((s, e) => s + e.cus, 0);

  const callsByMethod: Record<string, number> = {};
  for (const [k, v] of metrics.callsByMethod.entries()) callsByMethod[k] = v;
  const estCusByMethod: Record<string, number> = {};
  for (const [k, v] of metrics.estCusByMethod.entries()) estCusByMethod[k] = v;
  const byEndpoint: Record<string, { calls: number; estCus: number }> = {};
  for (const [k, v] of metrics.byEndpoint.entries()) byEndpoint[k] = v;

  return {
    callsByMethod,
    estCusByMethod,
    estCusTotal,
    estCusPerSecAvg: estCusTotal / (windowMs / 1000),
    estCusPerSecCurrent: currentCus,
    byEndpoint,
    headerCusTotal: metrics.headerCusTotal,
    headerLastSeen: { ...metrics.headerLastSeen },
  };
}

/**
 * Reset metrics (useful in tests)
 */
export function resetRpcMetrics(): void {
  metrics.callsByMethod.clear();
  metrics.estCusByMethod.clear();
  metrics.estCusTimeline.length = 0;
  metrics.byEndpoint.clear();
  metrics.headerCusTotal = 0;
  metrics.headerLastSeen = {};
}
