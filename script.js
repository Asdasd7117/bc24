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
        console.log("العملات المتاحة:", symbols); // تصحيح لمعرفة العملات المتاحة

        return symbols;
    } catch (error) {
        console.error("خطأ في جلب العملات:", error);
        return [];
    }
}

async function checkWhaleActivity() {
    let symbols = await getAllSymbols();
    if (symbols.length === 0) return;

    let now = Date.now();
    let alertContainer = document.getElementById("alertContainer");

    for (let symbol of symbols.slice(0, 10)) { // تجربة 10 عملات لتجنب الضغط الزائد
        let indicators = await fetchIndicators(symbol);
        if (!indicators) continue;

        let { rsi, macd, signal } = indicators;
        let savedTime = localStorage.getItem(symbol);

        if (rsi < 30 && macd > signal) {
            if (!savedTime) showAlert(symbol, `✅ فرصة شراء: ${symbol} RSI = ${rsi.toFixed(2)}`, now);
        } else if (rsi > 70 && macd < signal) {
            if (!savedTime) showAlert(symbol, `⚠️ تحذير خروج: ${symbol} RSI = ${rsi.toFixed(2)}`, now);
        }
    }

    updateAlertTimes();
    removeExpiredAlerts();
}

function showAlert(symbol, message, time) {
    let alertContainer = document.getElementById("alertContainer");

    // إذا كانت العملة موجودة بالفعل، لا تضفها مرة أخرى
    if (document.querySelector(`.alertBox[data-symbol='${symbol}']`)) return;

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
                ? `✅ فرصة شراء: ${symbol}`
                : `⚠️ تحذير خروج: ${symbol}`;

            showAlert(symbol, message, savedTime);
        }
    }
    updateAlertTimes();
}

window.onload = function() {
    loadSavedAlerts();
    checkWhaleActivity();
};

setInterval(checkWhaleActivity, 60000); // تحديث كل دقيقة
setInterval(updateAlertTimes, 60000);
