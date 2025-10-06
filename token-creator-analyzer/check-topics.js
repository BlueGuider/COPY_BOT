import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';

const client = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-mainnet.core.chainstack.com/7727aa61bd5196fbf1467872aa973933'),
});

async function checkBothTopics() {
  console.log('🔍 Checking both event topics...');
  
  try {
    const latestBlock = await client.getBlockNumber();
    const fromBlock = latestBlock - 10n;
    const toBlock = latestBlock;
    
    // Check the OLD topic
    console.log('📊 Checking OLD topic: 0x7db52723a3b2cdd6164364b3b766e65e540d7be48ffa89582956d8eaebe62942');
    const oldLogs = await client.getLogs({
      address: '0x5c952063c7fc8610FFDB798152D69F0B9550762b',
      topics: ['0x7db52723a3b2cdd6164364b3b766e65e540d7be48ffa89582956d8eaebe62942'],
      fromBlock: fromBlock,
      toBlock: toBlock,
    });
    console.log(`✅ Found ${oldLogs.length} events with OLD topic`);
    
    // Check the NEW topic
    console.log('📊 Checking NEW topic: 0x396d5e902b675b032348d3d2e9517ee8f0c4a926603fbc075d3d282ff00cad20');
    const newLogs = await client.getLogs({
      address: '0x5c952063c7fc8610FFDB798152D69F0B9550762b',
      topics: ['0x396d5e902b675b032348d3d2e9517ee8f0c4a926603fbc075d3d282ff00cad20'],
      fromBlock: fromBlock,
      toBlock: toBlock,
    });
    console.log(`✅ Found ${newLogs.length} events with NEW topic`);
    
    if (newLogs.length > 0) {
      console.log('📋 Sample NEW topic log:');
      const log = newLogs[0];
      console.log('Topics:', log.topics);
      console.log('Data length:', log.data.length);
      console.log('Data:', log.data);
    }
    
    // Check ALL logs from the factory (no topic filter)
    console.log('📊 Checking ALL logs from factory (no topic filter)');
    const allLogs = await client.getLogs({
      address: '0x5c952063c7fc8610FFDB798152D69F0B9550762b',
      fromBlock: fromBlock,
      toBlock: toBlock,
    });
    console.log(`✅ Found ${allLogs.length} total events from factory`);
    
    if (allLogs.length > 0) {
      console.log('📋 All unique topics found:');
      const uniqueTopics = [...new Set(allLogs.map(log => log.topics[0]))];
      uniqueTopics.forEach((topic, i) => {
        console.log(`  ${i+1}. ${topic}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkBothTopics();




