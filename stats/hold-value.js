/**
 * 获取 GMGN 的持仓价值
 * @author: Cheng
 * @x: https://x.com/SolitaryCheng
 * @date: 2025-08-27
 * @update: 2025-09-03
 */
(async () => {
  const formatReadableNumber = (num, decimals = 1) => {
    if (num === 0) return '0';
    if (!num) return '';
    
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    
    const units = [
      { threshold: 1000000000000, suffix: 'T' },
      { threshold: 1000000000, suffix: 'B' },
      { threshold: 1000000, suffix: 'M' },
      { threshold: 1000, suffix: 'K' }
    ];
    
    for (const unit of units) {
      if (absNum >= unit.threshold) {
        const value = (absNum / unit.threshold).toFixed(decimals);
        return `${sign}${value}${unit.suffix}`.replace(/\.0+([KMBT])$/, '$1');
      }
    }
    
    return `${sign}${absNum.toFixed(3)}`;
  };

  try {
    // 获取钱包地址
    let WALLET = ''; // 钱包地址，若留空则从当前 URL 中提取
    if (!WALLET) {
      WALLET = window.location.pathname.split('/').pop().split('_').pop();
      console.log(`🔑 从 URL 中提取钱包地址: ${WALLET}`);
    }

    // 验证钱包地址
    if (!WALLET || WALLET.length < 32) {
      console.error('❌ 无效的钱包地址，请检查 URL 或手动设置 WALLET 变量');
      return;
    }

    console.log(`🚀 开始获取钱包 ${WALLET} 的持仓信息...`);

    // API 基础参数
    const baseParams = {
      device_id: localStorage.key_device_id,
      fp_did: localStorage.key_fp_did,
      client_id: 'gmgn_web_20250826-2999-3795ae5',
      from_app: 'gmgn',
      app_ver: '20250826-2999-3795ae5',
      tz_name: 'Asia%2FShanghai',
      tz_offset: '28800',
      app_lang: 'zh-CN',
      os: 'web',
      limit: '50',
      orderby: 'last_active_timestamp',
      direction: 'desc',
      showsmall: 'true',
      sellout: 'false',
      hide_airdrop: 'true',
      hide_abnormal: 'false'
    };

    // 构建查询参数
    const buildQueryString = (params) => {
      return Object.entries(params)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
    };

    // 获取持仓数据的函数
    const fetchHoldings = async (wallet, cursor = null) => {
      const params = { ...baseParams };
      if (cursor) {
        params.cursor = cursor;
      }

      const queryString = buildQueryString(params);
      const url = `https://gmgn.ai/api/v1/wallet_holdings/sol/${wallet}?${queryString}`;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        console.error(`❌ 获取持仓数据失败:`, error);
        throw error;
      }
    };

    // 处理持仓数据
    const processHoldings = (holdings) => {
      let totalValue = 0;
      const tokenDetails = [];

      holdings.forEach(hold => {
        const usdValue = Number(hold.usd_value) || 0;
        const symbol = hold.token?.symbol || 'Unknown';
        const amount = Number(hold.balance) || 0;
        
        if (usdValue > 0) {
          totalValue += usdValue;
          tokenDetails.push({
            symbol,
            amount,
            usdValue,
            price: usdValue / amount
          });
          
          console.log(`💰 代币 ${symbol} 当前持仓价值 $${usdValue.toFixed(2)}`);
        }
      });

      return { totalValue, tokenDetails };
    };

    // 主函数：获取所有分页数据
    const getAllHoldings = async (wallet) => {
      let allHoldings = [];
      let cursor = null;
      let pageCount = 0;

      do {
        pageCount++;
        console.log(`📄 正在获取第 ${pageCount} 页数据...`);
        
        const response = await fetchHoldings(wallet, cursor);
        
        if (!response.data || !response.data.holdings) {
          console.error('❌ 响应数据格式错误:', response);
          break;
        }

        allHoldings = allHoldings.concat(response.data.holdings);
        cursor = response.data.next;
        
        // 添加延迟避免请求过快
        if (cursor) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } while (cursor);

      console.log(`✅ 共获取 ${pageCount} 页数据，总计 ${allHoldings.length} 个持仓`);
      return allHoldings;
    };

    // 执行主流程
    const allHoldings = await getAllHoldings(WALLET);
    
    if (allHoldings.length === 0) {
      console.log('📭 该钱包暂无持仓数据');
      return;
    }

    // 处理所有持仓数据
    const { totalValue, tokenDetails } = processHoldings(allHoldings);

    // 计算 SOL 价值（假设 1 SOL = $205）
    const solValue = totalValue / 205;

    // 输出结果
    console.log('\n' + '='.repeat(18));
    console.log(`📊 持仓汇总报告`);
    console.log('='.repeat(18));
    console.log(`💰 总价值: $${totalValue.toFixed(2)}`);
    console.log(`🪙 约等于: ${solValue.toFixed(4)} SOL`);
    console.log(`📈 持仓代币数量: ${tokenDetails.length}`);
    console.log('='.repeat(18));

    // 按价值排序显示前10个代币
    if (tokenDetails.length > 0) {
      console.log('\n🏆 价值最高的代币:');
      tokenDetails
        .sort((a, b) => b.usdValue - a.usdValue)
        .slice(0, 10)
        .forEach((token, index) => {
          console.log(`${index + 1}. ${token.symbol}: $${token.usdValue.toFixed(2)} (${formatReadableNumber(token.amount)})`);
        });
    }

  } catch (error) {
    console.error('❌ 程序执行失败:', error);
  }
})();