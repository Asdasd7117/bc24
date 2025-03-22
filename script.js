async function fetchIndicators(symbol) {
    try {
        let response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`);
        if (!response.ok) throw new Error("فشل في جلب بيانات المؤشرات.");
        let data = await response.json();

        let closingPrices = data.map(candle => parseFloat(candle[4])); // أسعار الإغلاق
        let rsi = calculateRSI(closingPrices);
        let { macd, signal } = calculateMACD(closingPrices);

        return { rsi, macd, signal };
    } catch (error) {
        console.error("خطأ في جلب المؤشرات:", error);
        return null;
    }
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
    let symbols = await getAllSymbols();
    if (symbols.length === 0) return;
    
    let now = Date.now();
    let alertContainer = document.getElementById("alertContainer");
    alertContainer.innerHTML = ""; 

    for (let symbol of symbols) {
        let indicators = await fetchIndicators(symbol);
        if (!indicators) continue;

        let { rsi, macd, signal } = indicators;
        let savedTime = localStorage.getItem(symbol);

        if (rsi < 30 && macd > signal) {
            showAlert(symbol, `✅ فرصة شراء: ${symbol} في تشبع بيعي RSI = ${rsi.toFixed(2)}`, now);
        } 
        else if (rsi > 70 && macd < signal) {
            showAlert(symbol, `⚠️ تحذير خروج: ${symbol} في تشبع شرائي RSI = ${rsi.toFixed(2)}`, now);
        }
    }

    updateAlertTimes();
    removeExpiredAlerts();
}

function showAlert(symbol, message, time) {
    let alertContainer = document.getElementById("alertContainer");
    let alertBox = document.createElement("div");
    alertBox.className = "alertBox";
    alertBox.setAttribute("data-symbol", symbol);
    alertBox.setAttribute("data-time", time);
    
    let timeElapsed = calculateElapsedTime(time);
    alertBox.innerHTML = `${message} <span class='time-elapsed'>${timeElapsed}</span> 
        <button onclick='removeAlert("${symbol}")'>×</button>`;
    
    alertContainer.appendChild(alertBox);
    localStorage.setItem(symbol, time);
}

function updateAlertTimes() {
    let alerts = document.querySelectorAll(".alertBox");
    let now = Date.now();

    alerts.forEach(alert => {
        let time = parseInt(alert.getAttribute("data-time"), 10);
        let elapsed = calculateElapsedTime(time);
        alert.querySelector(".time-elapsed").innerText = elapsed;
    });
}

function calculateElapsedTime(time) {
    let now = Date.now();
    let diffMinutes = Math.floor((now - time) / 60000);
    
    if (diffMinutes < 1) return "منذ الآن";
    if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
    
    let diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;

    let diffDays = Math.floor(diffHours / 24);
    return `منذ ${diffDays} يوم`;
}

function removeExpiredAlerts() {
    let now = Date.now();
    let expirationTime = 12 * 60 * 60 * 1000; // 12 ساعة

    for (let i = 0; i < localStorage.length; i++) {
        let symbol = localStorage.key(i);
        let savedTime = parseInt(localStorage.getItem(symbol), 10);
        
        if (!isNaN(savedTime) && now - savedTime > expirationTime) {
            localStorage.removeItem(symbol);
            let alertBox = document.querySelector(`.alertBox[data-symbol='${symbol}']`);
            if (alertBox) alertBox.remove();
        }
    }
}

function removeAlert(symbol) {
    localStorage.removeItem(symbol);
    let alertBox = document.querySelector(`.alertBox[data-symbol='${symbol}']`);
    if (alertBox) alertBox.remove();
}

function loadSavedAlerts() {
    let alertContainer = document.getElementById("alertContainer");
    alertContainer.innerHTML = ""; 

    let now = Date.now();
    for (let i = 0; i < localStorage.length; i++) {
        let symbol = localStorage.key(i);
        let savedTime = parseInt(localStorage.getItem(symbol), 10);

        if (!isNaN(savedTime)) {
            let message = savedTime % 2 === 0 
                ? `✅ فرصة شراء: ${symbol} `
                : `⚠️ تحذير خروج: ${symbol} `;
            
            showAlert(symbol, message, savedTime);
        }
    }
    updateAlertTimes();
}

window.onload = function() {
    loadSavedAlerts();
    checkWhaleActivity();
};

setInterval(checkWhaleActivity, 60000);
setInterval(updateAlertTimes, 60000);
