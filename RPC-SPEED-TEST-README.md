# RPC Speed Test Scripts

These scripts help you find the fastest RPC endpoints for your copy trading bot.

## 🚀 Quick Start

### 1. Simple Test (Recommended)
```bash
cd /root/New_Four_Meme_Trading_bot
node simple-rpc-test.mjs
```

### 2. Comprehensive Test
```bash
cd /root/New_Four_Meme_Trading_bot
node rpc-speed-test.mjs
```

## 🔧 Customizing RPC URLs

### Edit the Simple Test
Open `simple-rpc-test.js` and modify the `CUSTOM_RPC_URLS` array:

```javascript
const CUSTOM_RPC_URLS = [
  // Add your RPC URLs here
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org',
  'https://your-private-rpc.com',
  'https://your-chainstack-endpoint.com',
];
```

### Edit the Comprehensive Test
Open `rpc-speed-test.js` and modify the `RPC_ENDPOINTS` array (around line 11).

## 📊 Understanding Results

### Response Times
- **< 200ms**: Excellent (private node quality)
- **200-500ms**: Good (fast public RPC)
- **500-1000ms**: Acceptable (standard public RPC)
- **> 1000ms**: Slow (avoid for copy trading)

### Success Rate
- **100%**: Perfect reliability
- **90-99%**: Very good
- **80-89%**: Good (some occasional failures)
- **< 80%**: Poor (frequent failures)

## 🎯 Copy Trading Optimization

### For Maximum Speed:
1. **Use the fastest 2-3 endpoints** in your RPC fallback list
2. **Consider a private RPC provider** for sub-200ms response times
3. **Update your RPC config** after testing

### Update Your RPC Configuration:
Edit `safe-four-meme-trader/src/services/rpc.ts` and replace the `BSC_RPC_ENDPOINTS` array:

```javascript
const BSC_RPC_ENDPOINTS = [
  'https://your-fastest-rpc.com',      // Fastest
  'https://your-second-fastest.com',   // Backup
  'https://your-third-fastest.com',    // Fallback
  // Keep some public endpoints as final fallbacks
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org',
];
```

## 🔍 Test Options

### Simple Test Options:
- **3 requests per endpoint** (good for quick testing)
- **8 second timeout** (reasonable for most endpoints)
- **Tests getBlockNumber** (most important for copy trading)

### Comprehensive Test Options:
```bash
# More requests for better accuracy
node rpc-speed-test.js --requests 10

# Shorter timeout
node rpc-speed-test.js --timeout 5000

# Concurrent testing (faster but less accurate)
node rpc-speed-test.js --concurrent
```

## 📈 Expected Improvements

### Current Setup (Public RPCs):
- **Buy delay**: ~1 second
- **Sell delay**: ~3-4 seconds

### With Optimized RPCs:
- **Buy delay**: ~200-500ms
- **Sell delay**: ~1-2 seconds

### With Private RPC:
- **Buy delay**: ~100-200ms
- **Sell delay**: ~500ms-1 second

## 🛠️ Troubleshooting

### Common Issues:
1. **"Connection refused"**: RPC endpoint is down
2. **"Timeout"**: RPC is slow or overloaded
3. **"Rate limited"**: Too many requests (normal for public RPCs)

### Solutions:
1. **Remove failed endpoints** from your list
2. **Use fewer requests** if getting rate limited
3. **Consider private RPC** for consistent performance

## 💡 Private RPC Providers

For maximum speed, consider these providers:

### Budget Options ($50-100/month):
- **Chainstack**: Good performance, reliable
- **Alchemy**: Excellent API, good documentation
- **Infura**: Popular choice, stable

### Premium Options ($100-500/month):
- **QuickNode**: Very fast, low latency
- **Moralis**: Developer-friendly
- **GetBlock**: High performance

### Self-Hosted:
- **Run your own BSC node**: Maximum control, but requires technical expertise

## 📝 Notes

- **Test during different times** of day (RPC performance varies)
- **Keep public endpoints** as fallbacks even with private RPC
- **Monitor your bot's performance** after updating RPC endpoints
- **Consider geographic location** when choosing private RPC providers
