const WebSocket = require('ws');

// Replace with your Alchemy WebSocket URL for BNB Chain mainnet
const ALCHEMY_WS_URL = 'wss://eth-mainnet.g.alchemy.com/v2/pcd64O6ye9sMw0BCMRmFVE9QEMfTNFmo';

// Replace these with lowercase addresses you want to filter
// const FROM_ADDRESS = '0xyourfromaddresshere'.toLowerCase();
const TO_ADDRESS = '0x7a250d5630b4cf539739df2c5dacb4c659f2488d'.toLowerCase();

const ws = new WebSocket(ALCHEMY_WS_URL);

ws.on('open', () => {
  console.log('WebSocket connection established');

  // Subscribe to all pending transactions - no server-side filter allowed on BNB Chain currently
  const subscribePayload = {
    id: 1,
    jsonrpc: '2.0',
    method: 'eth_subscribe',
    params: ['newPendingTransactions']
  };

  ws.send(JSON.stringify(subscriptionPayload));
  console.log('Subscription request sent, listening for all pending transactions...');
});

ws.on('message', (data) => {
    const messageStr = data.toString('utf8');
    console.log(messageStr);
    try {
      const response = JSON.parse(messageStr);
      
      // Ignore subscription confirmation
      if (response.id === 1 && response.result && typeof response.result === 'string') {
        console.log(`Subscription confirmed with ID: ${response.result}`);
        return;
      }
  
      // Process pending transaction notifications
      if (response.method === 'alchemy_pendingTransactions' && response.params) {
        const tx = response.params.result;
        if (tx.to && tx.to.toLowerCase() === TO_ADDRESS.toLowerCase()) {
          console.log('Matched Pending Transaction:', tx);
        }
      }
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  });

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
});

ws.on('close', () => {
  console.log('WebSocket connection closed');
});