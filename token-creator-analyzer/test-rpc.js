import { createPublicClient, http } from 'viem';

// Test different RPC endpoints for eth_getLogs support
const rpcEndpoints = [
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org', 
  'https://bsc-dataseed3.binance.org',
  'https://bsc-dataseed4.binance.org',
  'https://rpc.ankr.com/bsc',
  'https://bsc-mainnet.nodereal.io/v1/64a9df0874fb4a93b9d0a384',
  'https://bsc-mainnet.nodereal.io/v1/64a9df0874fb4a93b9d0a384',
  'https://bsc.meowrpc.com',
  'https://bsc.publicnode.com',
  'https://bsc-mainnet.public.blastapi.io'
];

const factoryAddress = '0x5c952063c7fc8610FFDB798152D69F0B9550762b';

async function testRpcEndpoint(url) {
  console.log(`\n🔍 Testing RPC: ${url}`);
  
  try {
    const client = createPublicClient({
      transport: http(url),
    });

    // Test with a small block range
    const fromBlock = 62109000;
    const toBlock = 62109100;
    
    console.log(`   📊 Testing eth_getLogs from block ${fromBlock} to ${toBlock}`);
    
    const logs = await client.getLogs({
      address: factoryAddress,
      fromBlock: BigInt(fromBlock),
      toBlock: BigInt(toBlock),
    });

    console.log(`   ✅ SUCCESS! Found ${logs.length} logs`);
    
    if (logs.length > 0) {
      console.log(`   📋 Sample log:`, {
        blockNumber: logs[0].blockNumber,
        transactionHash: logs[0].transactionHash,
        topics: logs[0].topics
      });
    }
    
    return { success: true, logs: logs.length, url };
    
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    return { success: false, error: error.message, url };
  }
}

async function testAllEndpoints() {
  console.log('🚀 Testing RPC endpoints for eth_getLogs support...\n');
  
  const results = [];
  
  for (const url of rpcEndpoints) {
    const result = await testRpcEndpoint(url);
    results.push(result);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 SUMMARY:');
  console.log('==========');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Working endpoints: ${successful.length}`);
  successful.forEach(r => {
    console.log(`   - ${r.url} (${r.logs} logs found)`);
  });
  
  console.log(`\n❌ Failed endpoints: ${failed.length}`);
  failed.forEach(r => {
    console.log(`   - ${r.url}: ${r.error}`);
  });
  
  if (successful.length > 0) {
    console.log(`\n🎯 RECOMMENDED: Use ${successful[0].url}`);
    return successful[0].url;
  } else {
    console.log(`\n⚠️  No working endpoints found for eth_getLogs`);
    return null;
  }
}

testAllEndpoints().then(bestEndpoint => {
  if (bestEndpoint) {
    console.log(`\n💡 Update your config to use: ${bestEndpoint}`);
  }
  process.exit(0);
}).catch(console.error);




