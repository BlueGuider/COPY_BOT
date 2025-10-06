const { ethers } = require('ethers');

async function main() {
  const wsUrl = 'wss://lb.drpc.live/bsc/AqI3Ie1juUWKoPU70_eGdMDb-J5BomIR8IEIwg8TMB_n';
  const provider = new ethers.WebSocketProvider(wsUrl);

  provider.on('pending', async (txHash) => {
    try {
      const tx = await provider.getTransaction(txHash);
      if (!tx) return; // Skip if no tx object returned
      if (tx && tx.to?.toLowerCase() === '0x5c952063c7fc8610ffdb798152d69f0b9550762b') {
        console.log('Matched pending transaction:', tx);
      }
    } catch (error) {
      if (error.code === 26 && error.message.includes("Unknown block")) {
        // Expected transient error for mempool tx, ignore or log at debug level
        console.debug('Transient Unknown block error for tx:', txHash);
      } else {
        // Unexpected error, log or raise alert
        console.error('Error fetching tx:', error);
      }
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