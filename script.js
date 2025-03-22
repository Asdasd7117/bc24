async function getAllSymbols() {
    try {
        let response = await fetch("https://api.binance.com/api/v3/ticker/24hr");
        if (!response.ok) throw new Error("فشل في جلب بيانات الرموز.");
        let data = await response.json();
        return data.map(ticker => ticker.symbol).filter(symbol => symbol.endsWith("USDT"));
    } catch (error) {
        showError("خطأ في جلب جميع العملات: " + error.message);
        return [];
    }
}

async function fetchMarketData(symbols) {
    try {
        let responses = await Promise.all(symbols.map(async symbol => {
            let ticker = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
                .then(res => res.ok ? res.json() : Promise.reject("فشل في جلب البيانات."));
            
            let klines = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=14`)
                .then(res => res.ok ? res.json() : Promise.reject("فشل في جلب بيانات السعر."));
            
            let prices = klines.map(candle => parseFloat(candle[4])); // أسعار الإغلاق
            let avgPrice = (parseFloat(klines[13][1]) + parseFloat(klines[13][4])) / 2; // متوسط السعر

            let rsi = calculateRSI(prices);
            let macdData = calculateMACD(prices);

            return { ...ticker, avgPrice, rsi, macd: macdData.macd, signal: macdData.signal };
        }));
        return responses;
    } catch (error) {
        showError("خطأ في جلب بيانات السوق: " + error);
        return [];
    }
}

function calculateRSI(prices) {
    let gains = [], losses = [];
    for (let i = 1; i < prices.length; i++) {
        let change = prices[i] - prices[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? -change : 0);
    }

    let avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;
    let avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
    
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function calculateMACD(prices) {
    function ema(data, period) {
        let k = 2 / (period + 1);
        return data.reduce((acc, val, i) => i === 0 ? val : (val * k) + (acc * (1 - k)));
    }

    let shortEMA = ema(prices, 12);
    let longEMA = ema(prices, 26);
    let macd = shortEMA - longEMA;
    let signal = ema([macd, ...prices.slice(-8)], 9);
    
    return { macd, signal };
}

async function checkWhaleActivity() {
    let symbols = await getAllSymbols();
    if (symbols.length === 0) return;
    
    let marketData = await fetchMarketData(symbols);
    let alertContainer = document.getElementById("alertContainer");
    alertContainer.innerHTML = ""; 
    
    marketData.forEach(data => {
        let symbol = data.symbol;
        let priceChange = parseFloat(data.priceChangePercent);
        let volume = parseFloat(data.quoteVolume);
        let avgPrice = parseFloat(data.avgPrice);
        let currentPrice = parseFloat(data.lastPrice);
        let rsi = data.rsi;
        let macd = data.macd;
        let signal = data.signal;

        let thresholdChange = -3;
        let thresholdVolume = volume > 100000000 ? 5000000 : 1000000;
        let now = Date.now();
        let savedTime = localStorage.getItem(symbol);

        let trend = currentPrice > avgPrice ? "🔼 صعود" : "🔽 هبوط";
        let rsiStatus = rsi < 30 ? "🟢 تشبع بيعي" : rsi > 70 ? "🔴 تشبع شرائي" : "⚪️ متوازن";
        let macdStatus = macd > signal ? "📈 صعود قوي" : "📉 هبوط قوي";

        if (priceChange < thresholdChange && volume > thresholdVolume) {
            if (!savedTime) {
                localStorage.setItem(symbol, now);
            }
            showAlert(symbol, `🔥 ${symbol} انخفاض ${priceChange}% وتجميع الحيتان! (${trend}, ${rsiStatus}, ${macdStatus})`, "entry");
        } else if (savedTime && now - savedTime < 86400000) {
            showAlert(symbol, `⚠️ الحيتان تتراجع من ${symbol} (${trend}, ${rsiStatus}, ${macdStatus})`, "exit");
        }
    });

    updateAlertTimes();
    removeExpiredAlerts(symbols);
}

function showAlert(symbol, message, type) {
    let alertContainer = document.getElementById("alertContainer");
    let alertBox = document.createElement("div");
    alertBox.className = type === "entry" ? "alertBox entry" : "alertBox exit";
    alertBox.setAttribute("data-symbol", symbol);
    alertBox.innerHTML = `${message} <span class='time-elapsed'></span> <button onclick='this.parentElement.remove()'>×</button>`;
    alertContainer.appendChild(alertBox);
}

function updateAlertTimes() {
    let now = Date.now();
    document.querySelectorAll(".alertBox").forEach(alertBox => {
        let symbol = alertBox.getAttribute("data-symbol");
        let savedTime = localStorage.getItem(symbol);
        if (savedTime) {
            let elapsed = Math.floor((now - savedTime) / 60000);
            let timeText = elapsed < 60 ? `${elapsed} دقيقة` : `${Math.floor(elapsed / 60)} ساعة`;
            if (elapsed >= 1440) timeText = "24 ساعة";
            alertBox.querySelector(".time-elapsed").textContent = ` منذ ${timeText}`;
        }
    });
}

function removeExpiredAlerts(symbols) {
    let now = Date.now();
    symbols.forEach(symbol => {
        let savedTime = localStorage.getItem(symbol);
        if (savedTime && (now - savedTime > 86400000)) {
            localStorage.removeItem(symbol);
            document.querySelectorAll(`[data-symbol='${symbol}']`).forEach(alert => alert.remove());
        }
    });
}

checkWhaleActivity();
setInterval(checkWhaleActivity, 60000);
setInterval(updateAlertTimes, 60000);
