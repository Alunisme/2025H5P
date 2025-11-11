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
        console.log('收到 postMessage => origin:', event.origin, 'data:', data);
    } catch (e) {}

    if (data && data.type === 'H5P_SCORE_RESULT') {
        // 更新全域變數，並確保轉為數字（避免字串或 undefined 導致 NaN）
        finalScore = Number(data.score) || 0;
        maxScore = Number(data.maxScore) || 0;
        scoreText = `最終成績分數: ${finalScore}/${maxScore}`;
        console.log("新的分數已接收:", scoreText);

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

function setup() { 
    // ... (其他設置)
    createCanvas(windowWidth, windowHeight); 
    particles = [];
    loop(); // 啟用持續動畫
} 

// score_display.js 中的 draw() 函數片段

function draw() { 
    // 深色質感背景 - 使用漸層效果
    drawGradientBackground();
    
    // 更新並顯示粒子
    updateParticles();
    
    // 定期生成新粒子
    if (random(1) < 0.3) {
        particles.push(new Particle());
    }

    // 安全計算百分比（避免除以 0 或得到 NaN）
    let hasScore = maxScore > 0;
    let percentage = hasScore ? (finalScore / maxScore) * 100 : 0;
    // 限制到 0-100 範圍
    percentage = constrain(isFinite(percentage) ? percentage : 0, 0, 100);

    textSize(80);
    textAlign(CENTER);

    // 如果還沒收到分數就顯示提示文字
    if (!hasScore) {
        fill(150);
        text(scoreText, width / 2, height / 2);

        // 顯示簡短提示（小字）
        textSize(24);
        fill(180);
        text("（可在 console 使用 window.postMessage 測試）", width / 2, height / 2 + 40);

    } else {
        // -----------------------------------------------------------------
        // A. 根據分數區間改變文本顏色和內容 (畫面反映一)
        // -----------------------------------------------------------------
        if (percentage >= 90) {
            // 滿分或高分：顯示鼓勵文本，使用鮮豔顏色
            fill(0, 200, 50); // 綠色 [6]
            text("恭喜！優異成績！", width / 2, height / 2 - 50);

        } else if (percentage >= 60) {
            // 中等分數：顯示一般文本，使用黃色 [6]
            fill(255, 181, 35);
            text("成績良好，請再接再厲。", width / 2, height / 2 - 50);

        } else {
            // 低分：顯示警示文本，使用紅色 [6]
            fill(200, 0, 0);
            text("需要加強努力！", width / 2, height / 2 - 50);
        }

        // 顯示具體分數與百分比
        textSize(50);
        fill(220);
        text(`得分: ${finalScore}/${maxScore} (${Math.round(percentage)}%)`, width / 2, height / 2 + 50);
    }
    
    
    // -----------------------------------------------------------------
    // B. 根據分數觸發不同的幾何圖形反映 (畫面反映二)
    // -----------------------------------------------------------------
    
    if (percentage >= 90) {
        // 畫一個會脈動的圓圈代表完美
        let pulseSize = 150 + sin(frameCount * 0.05) * 20;
        fill(0, 200, 50, 200); 
        noStroke();
        circle(width / 2, height / 2 + 150, pulseSize);
        
        // 外圍光暈
        fill(0, 200, 50, 50);
        circle(width / 2, height / 2 + 150, pulseSize + 30);
        
    } else if (percentage >= 60) {
        // 畫一個會旋轉的方形
        push();
        translate(width / 2, height / 2 + 150);
        rotate(frameCount * 0.02);
        fill(255, 181, 35, 200);
        rectMode(CENTER);
        rect(0, 0, 150, 150);
        
        // 外圍邊框
        stroke(255, 181, 35, 100);
        strokeWeight(2);
        rect(0, 0, 180, 180);
        pop();
        
    } else if (percentage > 0) {
        // 低分顯示警示動畫
        let waveSize = 100 + abs(sin(frameCount * 0.08)) * 30;
        fill(255, 100, 100, 150);
        noStroke();
        circle(width / 2, height / 2 + 150, waveSize);
        
        fill(255, 100, 100, 80);
        circle(width / 2, height / 2 + 150, waveSize + 40);
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
