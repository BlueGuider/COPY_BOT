import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';

const client = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-mainnet.core.chainstack.com/7727aa61bd5196fbf1467872aa973933'),
});

async function debugDetailedLogs() {
  console.log('🔍 Detailed log structure analysis...');
  
  try {
    const latestBlock = await client.getBlockNumber();
    const fromBlock = latestBlock - 5n; // Just 5 blocks
    const toBlock = latestBlock;
    
    console.log(`📊 Checking blocks ${fromBlock} to ${toBlock} (${toBlock - fromBlock} blocks)`);
    
    // Get logs with the topic we're using in the analyzer
    const logs = await client.getLogs({
      address: '0x5c952063c7fc8610FFDB798152D69F0B9550762b',
      topics: ['0x396d5e902b675b032348d3d2e9517ee8f0c4a926603fbc075d3d282ff00cad20'],
      fromBlock: fromBlock,
      toBlock: toBlock,
    });
    
    console.log(`✅ Found ${logs.length} events with topic 0x396d5e902b675b032348d3d2e9517ee8f0c4a926603fbc075d3d282ff00cad20`);
    
    if (logs.length > 0) {
      const log = logs[0];
      console.log('\n📋 DETAILED LOG ANALYSIS:');
      console.log('=====================================');
      console.log('Transaction Hash:', log.transactionHash);
      console.log('Block Number:', log.blockNumber);
      console.log('Address:', log.address);
      console.log('Topics:', log.topics);
      console.log('Topics length:', log.topics?.length);
      console.log('Data:', log.data);
      console.log('Data length:', log.data.length);
      
      console.log('\n🔍 PARSING ATTEMPT:');
      console.log('=====================================');
      
      // Step 1: Check topics
      console.log('1. Topics check:');
      if (!log.topics || log.topics.length < 1) {
        console.log('   ❌ FAIL: Not enough topics');
      } else {
        console.log('   ✅ PASS: Has topics');
        console.log('   Topic[0]:', log.topics[0]);
      }
      
      // Step 2: Parse data
      console.log('\n2. Data parsing:');
      const data = log.data.slice(2); // Remove '0x' prefix
      console.log('   Raw data (no 0x):', data);
      console.log('   Data length:', data.length);
      
      const dataParams = [];
      for (let i = 0; i < data.length; i += 64) {
        const param = '0x' + data.slice(i, i + 64);
        dataParams.push(param);
        console.log(`   Param[${dataParams.length-1}]: ${param}`);
      }
      
      console.log('\n3. Parameter count check:');
      console.log(`   Found ${dataParams.length} parameters`);
      if (dataParams.length < 8) {
        console.log('   ❌ FAIL: Not enough parameters (expected 8)');
        console.log('   This is why the analyzer says "Invalid log structure"');
      } else {
        console.log('   ✅ PASS: Enough parameters');
      }
      
      // Step 3: Try to extract addresses
      console.log('\n4. Address extraction:');
      if (dataParams.length >= 2) {
        const tokenAddress = '0x' + dataParams[0].slice(-40);
        const creatorAddress = '0x' + dataParams[1].slice(-40);
        console.log('   Token Address:', tokenAddress);
        console.log('   Creator Address:', creatorAddress);
      } else {
        console.log('   ❌ FAIL: Not enough parameters for address extraction');
      }
      
      // Step 4: Show what the analyzer would do
      console.log('\n5. Analyzer parsing result:');
      console.log('=====================================');
      if (!log.topics || log.topics.length < 1) {
        console.log('   Result: ⚠️ Invalid log structure (not enough topics)');
      } else if (dataParams.length < 8) {
        console.log('   Result: ⚠️ Invalid log structure (not enough data parameters)');
      } else {
        console.log('   Result: ✅ Would parse successfully');
      }
      
    } else {
      console.log('❌ No logs found with the specified topic');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugDetailedLogs();




