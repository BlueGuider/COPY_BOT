import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';

const client = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-mainnet.core.chainstack.com/7727aa61bd5196fbf1467872aa973933'),
});

async function debugLogStructure() {
  console.log('🔍 Debugging log structure with very small range...');
  
  try {
    const latestBlock = await client.getBlockNumber();
    const fromBlock = latestBlock - 10n; // Just 10 blocks
    const toBlock = latestBlock;
    
    console.log(`📊 Checking blocks ${fromBlock} to ${toBlock} (${toBlock - fromBlock} blocks)`);
    
    const logs = await client.getLogs({
      address: '0x5c952063c7fc8610FFDB798152D69F0B9550762b',
      topics: ['0x396d5e902b675b032348d3d2e9517ee8f0c4a926603fbc075d3d282ff00cad20'],
      fromBlock: fromBlock,
      toBlock: toBlock,
    });
    
    console.log(`✅ Found ${logs.length} token creation events`);
    
    if (logs.length > 0) {
      const sampleLog = logs[0];
      console.log('\n📋 Sample log structure:');
      console.log('Transaction Hash:', sampleLog.transactionHash);
      console.log('Block Number:', sampleLog.blockNumber);
      console.log('Topics:', sampleLog.topics);
      console.log('Topics length:', sampleLog.topics?.length);
      console.log('Data:', sampleLog.data);
      console.log('Data length:', sampleLog.data.length);
      
      // Check if we have enough topics
      if (sampleLog.topics && sampleLog.topics.length >= 3) {
        console.log('\n✅ Topics structure analysis:');
        console.log('Topic[0] (event signature):', sampleLog.topics[0]);
        console.log('Topic[1] (token):', sampleLog.topics[1]);
        console.log('Topic[2] (creator):', sampleLog.topics[2]);
        
        // Parse the data field
        const data = sampleLog.data.slice(2); // Remove '0x' prefix
        const dataParams = [];
        for (let i = 0; i < data.length; i += 64) {
          dataParams.push('0x' + data.slice(i, i + 64));
        }
        console.log('\n📊 Data parameters:');
        console.log('Number of data parameters:', dataParams.length);
        dataParams.forEach((param, i) => {
          console.log(`  [${i}]: ${param}`);
        });
      } else {
        console.log('❌ Not enough topics:', sampleLog.topics?.length);
      }
    } else {
      console.log('❌ No logs found in this small range');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugLogStructure();




