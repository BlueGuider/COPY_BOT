const { ethers } = require('ethers');

async function main() {
  const wsUrl = 'wss://bsc-mainnet.rpcfast.com/ws?api_key=9aC7rb178eGD3tx949iD4kVSinSo5ZaptebOBkqGvt6UIUp50dlXSAlDttR6ei2E';
  const provider = new ethers.WebSocketProvider(wsUrl);

  // Watch both SwapX proxy and Four.meme TokenManager V2
  const WATCH_TO_ADDRESSES = new Set([
    '0x5c952063c7fc8610ffdb798152d69f0b9550762b', // TokenManager V2
    '0x1de460f363af910f51726def188f9004276bf4bc'  // SwapX proxy
  ]);

  // Only watch transactions from this target wallet
  const TARGET_FROM_ADDRESS = '0x345beee2ce2d8e3294ac7353cf19ece3ff61b507';

  provider.on('pending', async (txHash) => {
    try {
      const tx = await provider.getTransaction(txHash);
      if (!tx) return; // Skip if no tx object returned
      const fromLower = tx.from?.toLowerCase();
      const toLower = tx.to?.toLowerCase();
      if (fromLower === TARGET_FROM_ADDRESS && toLower && WATCH_TO_ADDRESSES.has(toLower)) {
        console.log('Matched pending transaction (from target -> watched contract):', tx);
      }
    } catch (error) {
      // Handle ethers v6 nested error shapes for Unknown block
      const innerCode = error?.error?.code ?? error?.info?.error?.code;
      const topCode = error?.code;
      const messageStr = String(error?.error?.message || error?.message || error?.shortMessage || '');
      if ((innerCode === 26 || topCode === 26 || messageStr.includes('Unknown block'))) {
        // Expected transient error for mempool tx, ignore or log at debug level
        console.debug('Transient Unknown block error for tx:', txHash);
        return;
      }
      // Unexpected error, log or raise alert
      console.error('Error fetching tx:', error);
    }
  });

  provider.on('error', (error) => {
    console.error('WebSocket Provider error:', error);
  });

  provider._websocket?.addEventListener('close', (event) => {
    console.error(`WebSocket closed with code ${event.code}`);
    // Add reconnect logic here if needed
  });

  console.log('Listening for pending txs...');
}

main().catch(console.error);