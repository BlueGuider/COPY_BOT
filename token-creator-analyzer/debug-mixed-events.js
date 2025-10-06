import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';

const client = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-mainnet.core.chainstack.com/7727aa61bd5196fbf1467872aa973933'),
});

async function debugMixedEvents() {
  console.log('🔍 Analyzing mixed event types with same topic...');
  
  try {
    const latestBlock = await client.getBlockNumber();
    const fromBlock = latestBlock - 10n;
    const toBlock = latestBlock;
    
    console.log(`📊 Checking blocks ${fromBlock} to ${toBlock}`);
    
    const logs = await client.getLogs({
      address: '0x5c952063c7fc8610FFDB798152D69F0B9550762b',
      topics: ['0x7db52723a3b2cdd6164364b3b766e65e540d7be48ffa89582956d8eaebe62942'],
      fromBlock: fromBlock,
      toBlock: toBlock,
    });
    
    console.log(`✅ Found ${logs.length} events with topic 0x7db52723a3b2cdd6164364b3b766e65e540d7be48ffa89582956d8eaebe62942`);
    
    // Group logs by data length
    const logsByDataLength = {};
    logs.forEach(log => {
      const dataLength = log.data.length;
      if (!logsByDataLength[dataLength]) {
        logsByDataLength[dataLength] = [];
      }
      logsByDataLength[dataLength].push(log);
    });
    
    console.log('\n📊 Events grouped by data length:');
    Object.keys(logsByDataLength).sort().forEach(dataLength => {
      const logs = logsByDataLength[dataLength];
      console.log(`\n📋 Data length ${dataLength} (${logs.length} events):`);
      
      // Show first example
      const sampleLog = logs[0];
      console.log(`   Sample: ${sampleLog.transactionHash}`);
      console.log(`   Data: ${sampleLog.data}`);
      
      // Parse data to see what we get
      const data = sampleLog.data.slice(2);
      const paramCount = Math.floor(data.length / 64);
      console.log(`   Parameters: ${paramCount} (${data.length} chars ÷ 64 = ${paramCount})`);
      
      if (paramCount > 0) {
        console.log(`   First param: 0x${data.slice(0, 64)}`);
      }
    });
    
    // Check if we have the expected 8-parameter events
    const validLogs = logsByDataLength['514'] || [];
    const invalidLogs = logs.filter(log => log.data.length !== 514);
    
    console.log(`\n📈 Summary:`);
    console.log(`   ✅ Valid events (514 chars): ${validLogs.length}`);
    console.log(`   ❌ Invalid events (other lengths): ${invalidLogs.length}`);
    
    if (validLogs.length > 0) {
      console.log('\n🎉 Found valid token creation events!');
      const sample = validLogs[0];
      console.log(`   Sample: ${sample.transactionHash}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugMixedEvents();




