import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';

const client = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-mainnet.core.chainstack.com/7727aa61bd5196fbf1467872aa973933'),
});

async function testEventTopic() {
  console.log('🔍 Testing event topic: 0x396d5e902b675b032348d3d2e9517ee8f0c4a926603fbc075d3d282ff00cad20');
  
  try {
    // Test with a recent block range
    const latestBlock = await client.getBlockNumber();
    const fromBlock = latestBlock - 1000n;
    const toBlock = latestBlock;
    
    console.log(`📊 Checking blocks ${fromBlock} to ${toBlock}`);
    
    const logs = await client.getLogs({
      address: '0x5c952063c7fc8610FFDB798152D69F0B9550762b',
      topics: ['0x396d5e902b675b032348d3d2e9517ee8f0c4a926603fbc075d3d282ff00cad20'],
      fromBlock: fromBlock,
      toBlock: toBlock,
    });
    
    console.log(`✅ Found ${logs.length} token creation events in the last 1000 blocks`);
    
    if (logs.length > 0) {
      console.log('📋 Recent events:');
      const sampleLog = logs[0];
      console.log('Sample log structure:');
      console.log('Transaction Hash:', sampleLog.transactionHash);
      console.log('Block Number:', sampleLog.blockNumber);
      console.log('Topics:', sampleLog.topics);
      console.log('Topics length:', sampleLog.topics?.length);
      console.log('Data:', sampleLog.data);
      console.log('Data length:', sampleLog.data.length);
      
      // Check if we have enough topics
      if (sampleLog.topics && sampleLog.topics.length >= 3) {
        console.log('✅ Topics structure looks correct');
        console.log('Topic[1] (token):', sampleLog.topics[1]);
        console.log('Topic[2] (creator):', sampleLog.topics[2]);
      } else {
        console.log('❌ Not enough topics:', sampleLog.topics?.length);
      }
    } else {
      console.log('❌ No events found. This could mean:');
      console.log('   1. No tokens were created in the last 1000 blocks');
      console.log('   2. The event topic is still incorrect');
      console.log('   3. The factory address is wrong');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('Block range limit exceeded')) {
      console.log('💡 Chainstack has block range limits. Let me try with smaller range...');
      
      const latestBlock = await client.getBlockNumber();
      const fromBlock = latestBlock - 100n;
      const toBlock = latestBlock;
      
      console.log(`📊 Trying smaller range: ${fromBlock} to ${toBlock}`);
      
      const logs = await client.getLogs({
        address: '0x5c952063c7fc8610FFDB798152D69F0B9550762b',
        topics: ['0x396d5e902b675b032348d3d2e9517ee8f0c4a926603fbc075d3d282ff00cad20'],
        fromBlock: fromBlock,
        toBlock: toBlock,
      });
      
      console.log(`✅ Found ${logs.length} token creation events in the last 100 blocks`);
    }
  }
}

testEventTopic();
