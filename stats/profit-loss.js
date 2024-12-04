/**
 * 获取 GMGN 的盈亏记录
 * @author: Cheng
 * @x: https://x.com/SolitaryCheng
 * @date: 2024-12-03
 * @update: 2024-12-05
 */
(async()=>{
    let WALLET = ''; // 钱包地址，若留空则从当前 URL 中提取
    if(!WALLET){
        WALLET = window.location.pathname.slice(-44);
        console.log(`🔑 从 URL 中提取钱包地址: ${WALLET}`);
    }
    const CAPITAL = 0; // 本金（美元）
    const PERIOD = '7d'; // 1d, 7d, 30d, 90d, 180d, 365d, all

    const TRADE_DETAIL = false; // 不推荐。是否获取每单交易详情，以将结算时间改为首次交易时间。如果为 true，速度会较慢，且 PERIOD 将强制大于等于 7d。
    const SHOW_DETAIL = true; // 是否回显详细日志
    const FETCH_DELAY = 450; // 每次请求的延迟时间，单位：毫秒
    const FETCH_DELAY_RANDOM = 100; // 每次请求的延迟时间随机范围，单位：毫秒
    const HIGHLIGHT_PNL = 200; // 计入高光时刻的百分比
    const HIGHLIGHT_PROFIT = 800; // 计入高光时刻的盈利金额

    const RECORDS = [];
    const LOGS = [];
    const HIGHLIGHTS = [];
    let blockIndex = 0;
    let profitCount = 0, lossCount = 0;
    let totalBalance = 0;

    // 检查日期是否在指定时间段内
    const isInPeriod = (timestamp) => {
        if(PERIOD === 'all') return true;
        let days = parseInt(PERIOD);
        if(TRADE_DETAIL && days < 7) {days = 7};

        const periodTodayEnd = new Date(Date.now() - days*24*60*60*1000).setHours(23, 59, 59, 999) / 1000;
        return timestamp > periodTodayEnd;
    };

    // 日期格式化函数
    const formatDate = (timestamp, format = 'date') => {
        const date = new Date(timestamp * 1000);
        const pad = (num) => String(num).padStart(2, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());
        return format === 'date' ? 
            `${year}-${month}-${day}` : 
            `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    // 获取所有盈亏记录
    async function getRecords(cursor = ''){
        const url = `https://gmgn.ai/api/v1/wallet_holdings/sol/${WALLET}?limit=50&orderby=last_active_timestamp&direction=desc&showsmall=true&sellout=true&tx30d=true${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;

        const {data} = await fetch(url).then(r=>r.json());
        for(let {last_active_timestamp, total_profit, realized_pnl, balance, token} of data.holdings){
            // 进一步获取交易详情
            if(TRADE_DETAIL){
                await new Promise(resolve => setTimeout(resolve, FETCH_DELAY + Math.random() * FETCH_DELAY_RANDOM));
                const {data} = await fetch(`https://gmgn.ai/defi/quotation/v1/smartmoney/sol/walletstat/${WALLET}?token_address=${token.address}&period=1d`).then(r=>r.json());
                const {trades} = data;
                if(Array.isArray(trades) && trades.length){last_active_timestamp = trades[0].timestamp;} // 以第一次交易时间为准
            }
            if(!isInPeriod(last_active_timestamp)) return;

            const profit = Number(Number(total_profit).toFixed(2));
            realized_pnl = Number((Number(realized_pnl)*100).toFixed(2));
            profit > 0 ? profitCount++ : lossCount++;
            totalBalance += profit;

            const logEntry = `${formatDate(last_active_timestamp, 'date')} ${Number(balance) ? '持有' : '清仓'} ${token.symbol} ${profit > 0 ? '盈' : '亏'}: $${profit}（${realized_pnl}%）`;
            LOGS.push(logEntry);
            SHOW_DETAIL && console.log(logEntry);

            // 高光时刻
            if(profit >= HIGHLIGHT_PROFIT || realized_pnl >= HIGHLIGHT_PNL){
                HIGHLIGHTS.push({timestamp: last_active_timestamp, profit, realized_pnl, symbol: token.symbol});
            }
            
            RECORDS.push({timestamp: last_active_timestamp, profit, symbol: token.symbol});
        }

        if(data.next){
            const lastTimestamp = data.holdings[data.holdings.length-1].last_active_timestamp;
            console.log(`即将获取第 ${++blockIndex + 1} 块交易数据; 最后一条记录时间: ${formatDate(lastTimestamp, 'datetime')}`);
            await new Promise(resolve => setTimeout(resolve, FETCH_DELAY + Math.random() * FETCH_DELAY_RANDOM));
            await getRecords(data.next);
        }
    }
    await getRecords();
    console.log('所有盈亏记录:', RECORDS);

    // 计算每日收益汇总
    const dailyProfitSummary = records => 
        Object.values(records.reduce((acc, {timestamp, profit}) => {
            const date = formatDate(timestamp);
            acc[date] = acc[date] || { date, total_profit: 0 };
            acc[date].total_profit += profit;
            return acc;
        }, {}))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(({date, total_profit}) => ({
            date,
            total_profit: Number(total_profit.toFixed(2))
        }));

    LOGS.push('', '--------------------------------', '');
    LOGS.push('## 高光时刻 ##', HIGHLIGHTS.map(({timestamp, profit, realized_pnl, symbol}) => 
        `${formatDate(timestamp, 'datetime')} ${symbol} ${profit > 0 ? '盈' : '亏'}: $${profit}（${realized_pnl}%）`
    ).join('\n'));
    LOGS.push('', '--------------------------------', '');

    const summary = dailyProfitSummary(RECORDS);
    const profitDays = summary.filter(({total_profit}) => total_profit > 0).length;
    const lossDays = summary.filter(({total_profit}) => total_profit < 0).length;
    LOGS.push('每日收益汇总: ' + summary.map(({date, total_profit}) => 
        `${date} ${total_profit >= 0 ? '盈' : '亏'} $${total_profit}`).join('、')
    );
    console.log('每日收益汇总:', summary);
    
    const finalProfit = (totalBalance - CAPITAL).toFixed(2);
    const finalLogs = [
        `盈亏总计：$${finalProfit}`,
        `盈亏次数：${profitCount}+, ${lossCount}-`,
        `盈亏天数：${profitDays}+, ${lossDays}-`,
        `统计周期：${PERIOD}`
    ];
    LOGS.push(...finalLogs);
    finalLogs.forEach(log => console.log(log));

    navigator.clipboard.writeText(LOGS.join('\n'));
    console.log(`🔎 详细盈亏记录已复制到剪贴板`);
})();