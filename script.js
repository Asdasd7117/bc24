const API_SOURCES = [
    "https://api.binance.com/api/v3/",
    "https://api1.binance.com/api/v3/",
    "https://api2.binance.com/api/v3/",
    "https://api3.binance.com/api/v3/"
];

async function fetchWithBackup(endpoint) {
    for (let api of API_SOURCES) {
        try {
            let response = await fetch(api + endpoint);
            if (response.ok) return await response.json();
        } catch (error) {
            console.warn(`⚠️ خطأ في API ${api}, المحاولة مع API آخر...`);
        }
    }
    console.error("❌ جميع مصادر API فشلت!");
    return null;
}

async function getAllSymbols() {
    let data = await fetchWithBackup("ticker/price");
    return data ? data.map(item => item.symbol).filter(s => s.endsWith("USDT")) : [];
}

async function fetchIndicators(symbol) {
    let data = await fetchWithBackup(`klines?symbol=${symbol}&interval=1h&limit=100`);
    if (!data) return null;

    let closingPrices = data.map(candle => parseFloat(candle[4])); 
    let rsi = calculateRSI(closingPrices);
    let { macd, signal } = calculateMACD(closingPrices);
    return { rsi, macd, signal };
}

function calculateRSI(closingPrices, period = 14) {
    let gains = [], losses = [];
    for (let i = 1; i < closingPrices.length; i++) {
        let diff = closingPrices[i] - closingPrices[i - 1];
        gains.push(diff > 0 ? diff : 0);
        losses.push(diff < 0 ? Math.abs(diff) : 0);
    }

    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < gains.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }

    let rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function calculateMACD(closingPrices, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
    function ema(prices, period) {
        let k = 2 / (period + 1);
        return prices.reduce((acc, price, i) => {
            if (i === 0) return [price];
            acc.push(price * k + acc[i - 1] * (1 - k));
            return acc;
        }, []);
    }

    let shortEMA = ema(closingPrices, shortPeriod);
    let longEMA = ema(closingPrices, longPeriod);
    let macdLine = shortEMA.map((val, i) => val - longEMA[i]);
    let signalLine = ema(macdLine, signalPeriod);

    return { macd: macdLine[macdLine.length - 1], signal: signalLine[signalLine.length - 1] };
}

async function checkWhaleActivity() {
    console.log("🔍 جلب الرموز...");
    let symbols = await getAllSymbols();
    if (symbols.length === 0) return;

    let alertContainer = document.getElementById("alertContainer");
    alertContainer.innerHTML = "";  
    localStorage.clear();  

    for (let symbol of symbols) {
        let indicators = await fetchIndicators(symbol);
        if (!indicators) continue;

        let { rsi, macd, signal } = indicators;
        let now = Date.now();

        if (rsi < 30 && macd > signal) {
            showAlert(symbol, `✅ فرصة شراء: ${symbol} في تشبع بيعي RSI = ${rsi.toFixed(2)}`, now);
        } 
        else if (rsi > 70 && macd < signal) {
            showAlert(symbol, `⚠️ تحذير خروج: ${symbol} في تشبع شرائي RSI = ${rsi.toFixed(2)}`, now);
        }
    }
    
    updateAlertTimes();
}

function showAlert(symbol, message, time) {
    let alertContainer = document.getElementById("alertContainer");
    let alertBox = document.createElement("div");
    alertBox.className = "alertBox";
    alertBox.setAttribute("data-symbol", symbol);
    alertBox.setAttribute("data-time", time);
    alertBox.innerHTML = `${message} <span class='time-elapsed'></span> <button onclick='this.parentElement.remove()'>×</button>`;
    alertContainer.appendChild(alertBox);
}

function updateAlertTimes() {
    let alerts = document.querySelectorAll(".alertBox");
    alerts.forEach(alert => {
        let timeElapsed = Math.floor((Date.now() - alert.getAttribute("data-time")) / 3600000);
        alert.querySelector(".time-elapsed").textContent = `منذ ${timeElapsed} ساعة`;
    });
}

checkWhaleActivity();
setInterval(checkWhaleActivity, 60000);
setInterval(updateAlertTimes, 60000);
