async function getAllSymbols() {
    try {
        let response = await fetch("https://api.binance.com/api/v3/ticker/24hr");
        if (!response.ok) throw new Error("فشل في جلب بيانات الرموز.");
        let data = await response.json();
        return data.map(ticker => ticker.symbol).filter(symbol => symbol.endsWith("USDT"));
    } catch (error) {
        console.error("خطأ في جلب جميع العملات:", error);
        return [];
    }
}

async function fetchIndicators(symbol) {
    try {
        let response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`);
        if (!response.ok) throw new Error("فشل في جلب بيانات المؤشرات.");
        let data = await response.json();

        let closingPrices = data.map(candle => parseFloat(candle[4]));
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
    
    let alertContainer = document.getElementById("alertContainer");
    alertContainer.innerHTML = ""; 

    for (let symbol of symbols) {
        let indicators = await fetchIndicators(symbol);
        if (!indicators) continue;

        let { rsi, macd, signal } = indicators;
        let now = Date.now();
        let savedTime = localStorage.getItem(symbol);

        if (rsi < 30 && macd > signal) {
            showAlert(symbol, `✅ فرصة شراء: ${symbol} في تشبع بيعي RSI = ${rsi.toFixed(2)}`, now);
            localStorage.setItem(symbol, now);
        } 
        else if (rsi > 70 && macd < signal) {
            showAlert(symbol, `⚠️ تحذير خروج: ${symbol} في تشبع شرائي RSI = ${rsi.toFixed(2)}`, now);
            localStorage.setItem(symbol, now);
        }
    }
    
    updateAlertTimes();
    removeExpiredAlerts(symbols);
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
    let now = Date.now();
    document.querySelectorAll(".alertBox").forEach(alertBox => {
        let savedTime = parseInt(alertBox.getAttribute("data-time"), 10);
        let elapsed = Math.floor((now - savedTime) / 60000); // بالمللي ثانية → دقائق

        let timeText = "منذ الآن";
        if (elapsed >= 1440) timeText = "منذ يوم";
        else if (elapsed >= 60) timeText = `منذ ${Math.floor(elapsed / 60)} ساعة`;
        else if (elapsed > 0) timeText = `منذ ${elapsed} دقيقة`;

        alertBox.querySelector(".time-elapsed").textContent = timeText;
    });

    // ترتيب التنبيهات حسب الأحدث
    let alerts = Array.from(document.querySelectorAll(".alertBox"));
    alerts.sort((a, b) => parseInt(b.getAttribute("data-time"), 10) - parseInt(a.getAttribute("data-time"), 10));
    let alertContainer = document.getElementById("alertContainer");
    alertContainer.innerHTML = "";
    alerts.forEach(alert => alertContainer.appendChild(alert));
}

function removeExpiredAlerts(symbols) {
    let now = Date.now();
    let alertContainer = document.getElementById("alertContainer");
    symbols.forEach(symbol => {
        let savedTime = localStorage.getItem(symbol);
        if (savedTime && (now - savedTime > 86400000)) { // 24 ساعة
            localStorage.removeItem(symbol);
            let alertBoxes = [...alertContainer.getElementsByClassName("alertBox")];
            alertBoxes.forEach(alertBox => {
                if (alertBox.getAttribute("data-symbol") === symbol) {
                    alertBox.remove();
                }
            });
        }
    });
}

checkWhaleActivity();
setInterval(checkWhaleActivity, 60000);
setInterval(updateAlertTimes, 60000);
