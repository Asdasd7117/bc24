async function fetchIndicators(symbol) {
    try {
        let response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`);
        if (!response.ok) throw new Error(`فشل في جلب بيانات ${symbol}`);
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

async function getAllSymbols() {
    try {
        let response = await fetch("https://api.binance.com/api/v3/ticker/price");
        if (!response.ok) throw new Error("فشل في جلب قائمة العملات.");
        let data = await response.json();

        let symbols = data.map(item => item.symbol).filter(symbol => symbol.endsWith("USDT"));
        console.log("العملات المتاحة:", symbols);

        return symbols;
    } catch (error) {
        console.error("خطأ في جلب العملات:", error);
        return [];
    }
}

async function checkWhaleActivity() {
    // مسح التخزين المحلي عند كل تحديث
    localStorage.clear();
    
    let symbols = await getAllSymbols();
    if (symbols.length === 0) return;

    let now = Date.now();
    let alertContainer = document.getElementById("alertContainer");
    alertContainer.innerHTML = ""; // مسح التنبيهات القديمة من الواجهة

    for (let symbol of symbols.slice(0, 10)) { // تجربة 10 عملات لتجنب الضغط الزائد
        let indicators = await fetchIndicators(symbol);
        if (!indicators) continue;

        let { rsi, macd, signal } = indicators;

        if (rsi < 30 && macd > signal) {
            showAlert(symbol, `✅ فرصة شراء: ${symbol} RSI = ${rsi.toFixed(2)}`, now);
        } else if (rsi > 70 && macd < signal) {
            showAlert(symbol, `⚠️ تحذير خروج: ${symbol} RSI = ${rsi.toFixed(2)}`, now);
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
    return `منذ ${diffHours} ساعة`;

    let diffDays = Math.floor(diffHours / 24);
    return `منذ ${diffDays} يوم`;
}

function removeAlert(symbol) {
    let alertBox = document.querySelector(`.alertBox[data-symbol='${symbol}']`);
    if (alertBox) alertBox.remove();
}

window.onload = function() {
    checkWhaleActivity();
};

setInterval(checkWhaleActivity, 60000); // تحديث كل دقيقة
setInterval(updateAlertTimes, 60000);
