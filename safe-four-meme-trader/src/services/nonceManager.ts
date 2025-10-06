import { publicClient } from '../utils/web3';

/**
 * Lightweight per-address nonce manager with pending-aware fetching and locking.
 * Ensures sequential nonce allocation across concurrent callers within this process.
 */
class AsyncMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async lock(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      const unlock = () => {
        const next = this.queue.shift();
        if (next) next();
        else this.locked = false;
      };

      if (this.locked) {
        this.queue.push(() => resolve(unlock));
      } else {
        this.locked = true;
        resolve(unlock);
      }
    });
  }
}

type Address = `0x${string}`;

type NonceState = {
  currentNonce?: number;
  lastSyncMs: number;
  mutex: AsyncMutex;
};

const ADDRESS_STATE = new Map<Address, NonceState>();

const getOrCreateState = (address: Address): NonceState => {
  const lower = address.toLowerCase() as Address;
  let state = ADDRESS_STATE.get(lower);
  if (!state) {
    state = { currentNonce: undefined, lastSyncMs: 0, mutex: new AsyncMutex() };
    ADDRESS_STATE.set(lower, state);
  }
  return state;
};

export class NonceManager {
  /**
   * Returns the next nonce for the given address, reserving it for immediate use.
   * Always uses chain "pending" count when uninitialized or when a resync is requested.
   */
  static async getNextNonce(address: Address, forceResync: boolean = false): Promise<number> {
    const state = getOrCreateState(address);
    const unlock = await state.mutex.lock();
    try {
      const now = Date.now();
      const needsSync = forceResync || state.currentNonce === undefined || now - state.lastSyncMs > 10_000;

      if (needsSync) {
        // Use pending tag to include queued transactions
        const chainPending = await publicClient.getTransactionCount({ address, blockTag: 'pending' });
        state.currentNonce = chainPending;
        state.lastSyncMs = now;
        console.log(`[NonceManager] Resynced pending nonce for ${address.slice(0, 8)}... -> ${chainPending}`);
      }

      const next = state.currentNonce!;
      state.currentNonce = next + 1;
      console.log(`[NonceManager] Reserved nonce ${next} for ${address.slice(0, 8)}...`);
      return next;
    } finally {
      unlock();
    }
  }

  /**
   * Forces a resync from chain for the given address. Use after nonce-related errors.
   */
  static async resync(address: Address): Promise<void> {
    const state = getOrCreateState(address);
    const unlock = await state.mutex.lock();
    try {
      const chainPending = await publicClient.getTransactionCount({ address, blockTag: 'pending' });
      state.currentNonce = chainPending;
      state.lastSyncMs = Date.now();
      console.log(`[NonceManager] Forced resync for ${address.slice(0, 8)}... -> ${chainPending}`);
    } finally {
      unlock();
    }
  }
}

export default NonceManager;
