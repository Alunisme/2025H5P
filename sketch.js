// =================================================================
// 步驟一：模擬成績數據接收
// -----------------------------------------------------------------


// 初始提示與全域變數（預設為 0，並提供友善提示）
let finalScore = 0;
let maxScore = 0;
let scoreText = "尚未收到分數，等待 H5P 傳送..."; // 用於 p5.js 繪圖的文字


window.addEventListener('message', function (event) {
    // 執行來源驗證... 可視情況補強
    const data = event.data;

    // debug 日誌：印出來源與內容，方便追蹤是否真有收到 H5P 的 postMessage
    try {
        console.log('收到 postMessage => origin:', event.origin, 'type:', (data && data.type) || typeof data, 'data:', data);
    } catch (e) {}

    // 輔助函式：遞迴搜尋物件中可能的 score / max 值（xAPI 等不同結構）
    function extractScoreFromObject(obj) {
        const result = { score: null, maxScore: null, scaled: null };
        const seen = new Set();

        function recurse(o) {
            if (!o || typeof o !== 'object' || seen.has(o)) return;
            seen.add(o);

            for (const key in o) {
                if (!Object.prototype.hasOwnProperty.call(o, key)) continue;
                const val = o[key];
                const k = String(key).toLowerCase();

                // 直接數值或數字字串
                if ((k.includes('score') || k === 'raw' || k === 'scaled') && (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val))))) {
                    const n = Number(val);
                    if (k.includes('max')) {
                        result.maxScore = result.maxScore ?? n;
                    } else if (k === 'scaled') {
                        result.scaled = n; // 0..1
                    } else if (k === 'raw' || k.includes('score')) {
                        // 優先把 raw/score 當作實際得分
                        result.score = result.score ?? n;
                    }
                }

                // 常見命名：max、maximum
                if ((k === 'max' || k === 'maximum' || k === 'maxscore') && (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val))))) {
                    result.maxScore = result.maxScore ?? Number(val);
                }

                // 若為物件則繼續遞迴
                if (typeof val === 'object') recurse(val);
            }
        }

        recurse(obj);
        return result;
    }

    // 嘗試多種方式解析分數：優先使用明確 type，否則廣泛解析 payload
    let parsed = { found: false, score: 0, max: 0 };

    // 1) 明確格式（你的原本預期）
    if (data && data.type === 'H5P_SCORE_RESULT') {
        parsed.found = true;
        parsed.score = Number(data.score) || 0;
        parsed.max = Number(data.maxScore) || 0;
        console.log('解析路徑：H5P_SCORE_RESULT');
    }

    // 2) 如果沒有找到，再檢查是否是直接的 {score, maxScore}
    if (!parsed.found && data && typeof data === 'object') {
        if ((('score' in data) || ('maxScore' in data) || ('max' in data))) {
            const s = Number(data.score ?? data.raw ?? data.value);
            const m = Number(data.maxScore ?? data.max ?? data.maximum);
            if (!isNaN(s)) parsed.score = s;
            if (!isNaN(m)) parsed.max = m;
            if ((parsed.score || parsed.max)) parsed.found = true;
            if (parsed.found) console.log('解析路徑：top-level score/max');
        }
    }

    // 3) 廣泛遞迴搜尋（處理 xAPI statement 與其他結構）
    if (!parsed.found && data && typeof data === 'object') {
        const ex = extractScoreFromObject(data);
        if (ex.score != null || ex.scaled != null) {
            parsed.found = true;
            // 若找到 scaled (0..1)，預設 max 為 100
            if (ex.score != null) parsed.score = Number(ex.score);
            if (ex.maxScore != null) parsed.max = Number(ex.maxScore);
            if ((parsed.max === 0 || isNaN(parsed.max)) && ex.scaled != null) {
                // scaled 有值，把 scaled 當作得分比例
                parsed.score = ex.scaled * 100;
                parsed.max = 100;
            }
            // 若只有 score 而沒有 max，猜測 max 為 100
            if (parsed.score && (!parsed.max || parsed.max === 0)) parsed.max = 100;
            console.log('解析路徑：遞迴搜尋 xAPI-like 結構', ex);
        }
    }

    // 最後，如果解析到分數才寫入並記錄
    if (parsed.found) {
        finalScore = Number(parsed.score) || 0;
        maxScore = Number(parsed.max) || 0;
        scoreText = `最終成績分數: ${finalScore}/${maxScore}`;
        console.log('新的分數已接收:', scoreText, '（來源 origin:', event.origin, '）');

        // 嘗試初始化 SCORM (wrapper 會忽略重複初始化)
        try { if (typeof scormInit === 'function') scormInit(); } catch (e) {}

        // 增加嘗試次數（會儲存在 cmi.suspend_data 中）
        try { if (typeof scormIncrementAttempt === 'function') scormIncrementAttempt(); } catch (e) {}

        // 記錄分數到 LMS（SCORM 1.2）
        try { if (typeof scormRecordScore === 'function') scormRecordScore(finalScore, maxScore); } catch (e) {}

        // 強制 commit
        try { if (typeof scormCommit === 'function') scormCommit(); } catch (e) {}

        // 重新繪製畫面（若你用 noLoop() 或是想立即 redraw）
        try { if (typeof redraw === 'function') redraw(); } catch (e) {}
    } else {
        // 沒有解析到分數的情況：印出方便 debug 的提示
        try { console.log('postMessage 未包含可解析的分數。檢查 payload keys：', Object.keys(data || {})); } catch (e) {}
    }
}, false);


// =================================================================
// 步驟二：使用 p5.js 繪製分數 (在網頁 Canvas 上顯示)
// -----------------------------------------------------------------

// 浮動粒子系統
let particles = [];

class Particle {
    constructor() {
        this.x = random(width);
        this.y = random(height);
        this.size = random(2, 8);
        this.speedX = random(-0.5, 0.5);
        this.speedY = random(-0.3, -0.8);
        this.opacity = random(30, 100);
        this.life = 255;
    }
    
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= 1.5;
        this.opacity = map(this.life, 255, 0, 100, 0);
    }
    
    display() {
        fill(100, 180, 255, this.opacity);
        noStroke();
        circle(this.x, this.y, this.size);
    }
    
    isDead() {
        return this.life <= 0;
    }
}

// 繪製深色質感背景
function drawGradientBackground() {
    // 主要背景 - 深藍灰色漸層
    for (let y = 0; y < height; y++) {
        let inter = map(y, 0, height, 0, 1);
        // 從深藍灰到深紫灰的漸層
        let r = lerp(25, 40, inter);
        let g = lerp(30, 50, inter);
        let b = lerp(45, 70, inter);
        stroke(r, g, b);
        line(0, y, width, y);
    }
    
    // 添加噪音紋理效果
    for (let i = 0; i < 200; i++) {
        let x = random(width);
        let y = random(height);
        let size = random(1, 3);
        fill(100, 120, 150, random(10, 30));
        noStroke();
        circle(x, y, size);
    }
}

// 更新和顯示粒子
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].display();
        
        if (particles[i].isDead()) {
            particles.splice(i, 1);
        }
    }
}

// 視窗調整時重新計算 canvas 大小
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}
