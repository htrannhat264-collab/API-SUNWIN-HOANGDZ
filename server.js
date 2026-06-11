// server.js - CAO THỦ TÀI XỈU v5.0 (FULL with Watchdog & Auto Reconnect)
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ==================== FILE STORAGE ====================
const DATA_DIR = process.env.RENDER ? '/tmp' : '.';
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const PATTERN_DB_FILE = path.join(DATA_DIR, 'pattern_db.json');

let resultHistory = [];

// Load lịch sử
if (fs.existsSync(HISTORY_FILE)) {
    try {
        resultHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        console.log(`[📂] Đã tải ${resultHistory.length} phiên lịch sử`);
    } catch (e) {}
}

// ==================== THUẬT TOÁN CAO THỦ ====================

class CaoThuTaiXiu {
    constructor() {
        // Bộ nhớ pattern đã học
        this.patternDB = {
            threeDice: new Map(),
            fiveResult: new Map(),
            totalPattern: new Map(),
            cauTrust: {
                '1-1': 0.5,
                '2-2': 0.5,
                'bet': 0.5,
                '3-3': 0.5,
                '2-1-2': 0.5
            }
        };
        
        // Bộ nhớ tạm
        this.recentPredictions = [];
        this.recentResults = [];
        this.consecutiveWrong = 0;
        this.mode = 'normal';
        this.lastStrategy = 'unknown';
        
        // Tải pattern DB nếu có
        this.loadPatternDB();
        
        // Học từ lịch sử có sẵn
        this.learnFromHistory();
    }
    
    loadPatternDB() {
        if (fs.existsSync(PATTERN_DB_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(PATTERN_DB_FILE, 'utf8'));
                this.patternDB.threeDice = new Map(Object.entries(data.threeDice || {}));
                this.patternDB.fiveResult = new Map(Object.entries(data.fiveResult || {}));
                this.patternDB.totalPattern = new Map(Object.entries(data.totalPattern || {}));
                this.patternDB.cauTrust = data.cauTrust || this.patternDB.cauTrust;
                console.log('[📂] Đã tải Pattern DB');
            } catch (e) {}
        }
    }
    
    savePatternDB() {
        const data = {
            threeDice: Object.fromEntries(this.patternDB.threeDice),
            fiveResult: Object.fromEntries(this.patternDB.fiveResult),
            totalPattern: Object.fromEntries(this.patternDB.totalPattern),
            cauTrust: this.patternDB.cauTrust
        };
        try {
            fs.writeFileSync(PATTERN_DB_FILE, JSON.stringify(data, null, 2));
        } catch (e) {}
    }
    
    learnFromHistory() {
        if (resultHistory.length < 50) return;
        
        console.log('[🧠] Đang học từ lịch sử...');
        
        // 1. Học pattern 3 mặt xúc xắc
        for (let i = 0; i < resultHistory.length - 1; i++) {
            const current = resultHistory[i];
            const next = resultHistory[i + 1];
            
            const diceKey = `${current.Xuc_xac_1}${current.Xuc_xac_2}${current.Xuc_xac_3}`;
            const nextResult = next.Ket_qua;
            
            if (!this.patternDB.threeDice.has(diceKey)) {
                this.patternDB.threeDice.set(diceKey, { Tai: 0, Xiu: 0, total: 0 });
            }
            const stat = this.patternDB.threeDice.get(diceKey);
            stat[nextResult === 'Tài' ? 'Tai' : 'Xiu']++;
            stat.total++;
        }
        
        // 2. Học pattern 5 kết quả liên tiếp
        for (let i = 0; i < resultHistory.length - 5; i++) {
            const pattern = resultHistory.slice(i, i + 5).map(h => h.Ket_qua).join('');
            const nextResult = resultHistory[i + 5].Ket_qua;
            
            if (!this.patternDB.fiveResult.has(pattern)) {
                this.patternDB.fiveResult.set(pattern, { Tai: 0, Xiu: 0, total: 0 });
            }
            const stat = this.patternDB.fiveResult.get(pattern);
            stat[nextResult === 'Tài' ? 'Tai' : 'Xiu']++;
            stat.total++;
        }
        
        // 3. Học pattern tổng điểm
        for (let i = 0; i < resultHistory.length - 1; i++) {
            const total = resultHistory[i].Tong;
            const nextResult = resultHistory[i + 1].Ket_qua;
            
            const totalKey = total.toString();
            if (!this.patternDB.totalPattern.has(totalKey)) {
                this.patternDB.totalPattern.set(totalKey, { Tai: 0, Xiu: 0, total: 0 });
            }
            const stat = this.patternDB.totalPattern.get(totalKey);
            stat[nextResult === 'Tài' ? 'Tai' : 'Xiu']++;
            stat.total++;
        }
        
        // 4. Tính độ tin cậy cho từng loại cầu
        this.calculateCauTrust();
        
        this.savePatternDB();
        console.log(`[✅] Đã học xong! ThreeDice: ${this.patternDB.threeDice.size}, FiveResult: ${this.patternDB.fiveResult.size}, TotalPattern: ${this.patternDB.totalPattern.size}`);
    }
    
    calculateCauTrust() {
        const results = resultHistory.map(h => h.Ket_qua);
        if (results.length < 50) return;
        
        // Cầu 1-1
        let cau11Dung = 0, cau11Tong = 0;
        for (let i = 2; i < results.length - 1; i++) {
            if (results[i-2] !== results[i-1] && results[i-1] !== results[i]) {
                cau11Tong++;
                if (results[i+1] !== results[i]) cau11Dung++;
            }
        }
        this.patternDB.cauTrust['1-1'] = cau11Tong > 0 ? Math.min(0.85, cau11Dung / cau11Tong) : 0.5;
        
        // Cầu 2-2
        let cau22Dung = 0, cau22Tong = 0;
        for (let i = 3; i < results.length - 1; i++) {
            if (results[i-3] === results[i-2] && results[i-2] !== results[i-1] && results[i-1] === results[i]) {
                cau22Tong++;
                if (results[i+1] !== results[i]) cau22Dung++;
            }
        }
        this.patternDB.cauTrust['2-2'] = cau22Tong > 0 ? Math.min(0.85, cau22Dung / cau22Tong) : 0.5;
        
        // Cầu bệt
        let betDung = 0, betTong = 0;
        for (let i = 2; i < results.length - 1; i++) {
            if (results[i-2] === results[i-1] && results[i-1] === results[i]) {
                betTong++;
                if (results[i+1] === results[i]) betDung++;
            }
        }
        this.patternDB.cauTrust['bet'] = betTong > 0 ? Math.min(0.85, betDung / betTong) : 0.5;
        
        console.log(`📊 Độ tin cậy cầu: 1-1=${(this.patternDB.cauTrust['1-1']*100).toFixed(0)}%, 2-2=${(this.patternDB.cauTrust['2-2']*100).toFixed(0)}%, bệt=${(this.patternDB.cauTrust['bet']*100).toFixed(0)}%`);
    }
    
    // Phân tích pattern xúc xắc
    analyzeThreeDice(d1, d2, d3) {
        const diceKey = `${d1}${d2}${d3}`;
        const stat = this.patternDB.threeDice.get(diceKey);
        
        if (stat && stat.total >= 3) {
            const taiRatio = stat.Tai / stat.total;
            const prediction = taiRatio > 0.5 ? 'Tài' : 'Xỉu';
            const confidence = Math.min(0.85, Math.abs(taiRatio - 0.5) * 2);
            
            return {
                prediction: prediction,
                confidence: confidence,
                weight: 1.2,
                reason: `🎲 Pattern ${diceKey}: ${prediction} (${stat.Tai}/${stat.total})`
            };
        }
        return null;
    }
    
    // Phân tích pattern 5 kết quả
    analyzeFiveResult(results) {
        if (results.length < 5) return null;
        
        const last5 = results.slice(-5);
        const pattern = last5.join('');
        const stat = this.patternDB.fiveResult.get(pattern);
        
        if (stat && stat.total >= 2) {
            const taiRatio = stat.Tai / stat.total;
            const prediction = taiRatio > 0.5 ? 'Tài' : 'Xỉu';
            const confidence = Math.min(0.9, Math.abs(taiRatio - 0.5) * 1.8);
            
            return {
                prediction: prediction,
                confidence: confidence,
                weight: 1.3,
                reason: `📊 Pattern "${pattern}": ${prediction} (${stat.Tai}/${stat.total})`
            };
        }
        return null;
    }
    
    // Phân tích tổng điểm
    analyzeTotal(total) {
        const stat = this.patternDB.totalPattern.get(total.toString());
        
        if (stat && stat.total >= 5) {
            const taiRatio = stat.Tai / stat.total;
            const prediction = taiRatio > 0.5 ? 'Tài' : 'Xỉu';
            const confidence = Math.min(0.85, Math.abs(taiRatio - 0.5) * 1.5);
            
            return {
                prediction: prediction,
                confidence: confidence,
                weight: 1.1,
                reason: `🔢 Tổng ${total}: ${prediction} (${stat.Tai}/${stat.total})`
            };
        }
        return null;
    }
    
    // Cầu cổ điển có trọng số
    analyzeClassicCau(results) {
        if (results.length < 4) return null;
        
        const last4 = results.slice(-4);
        const last3 = results.slice(-3);
        
        // Cầu 1-1
        if (last4[0] !== last4[1] && last4[1] !== last4[2] && last4[2] !== last4[3]) {
            const trust = this.patternDB.cauTrust['1-1'];
            const prediction = last4[3] === 'Tài' ? 'Xỉu' : 'Tài';
            return {
                prediction: prediction,
                confidence: Math.min(0.8, 0.55 + trust * 0.25),
                weight: trust,
                reason: `🔄 Cầu 1-1 (độ tin ${(trust*100).toFixed(0)}%)`
            };
        }
        
        // Cầu 2-2
        if (last4[0] === last4[1] && last4[1] !== last4[2] && last4[2] === last4[3]) {
            const trust = this.patternDB.cauTrust['2-2'];
            const prediction = last4[3] === 'Tài' ? 'Xỉu' : 'Tài';
            return {
                prediction: prediction,
                confidence: Math.min(0.8, 0.55 + trust * 0.25),
                weight: trust,
                reason: `🔄 Cầu 2-2 (độ tin ${(trust*100).toFixed(0)}%)`
            };
        }
        
        // Cầu bệt
        if (last3[0] === last3[1] && last3[1] === last3[2]) {
            const trust = this.patternDB.cauTrust['bet'];
            const prediction = last3[0];
            return {
                prediction: prediction,
                confidence: Math.min(0.8, 0.55 + trust * 0.3),
                weight: trust,
                reason: `📈 Cầu bệt (độ tin ${(trust*100).toFixed(0)}%)`
            };
        }
        
        return null;
    }
    
    // Cân bằng lệch
    analyzeBalance(results) {
        if (results.length < 20) return null;
        
        const last20 = results.slice(-20);
        const taiCount = last20.filter(r => r === 'Tài').length;
        const xiuCount = 20 - taiCount;
        
        if (Math.abs(taiCount - xiuCount) >= 6) {
            const prediction = taiCount > xiuCount ? 'Xỉu' : 'Tài';
            const confidence = Math.min(0.75, 0.55 + Math.abs(taiCount - xiuCount) / 40);
            return {
                prediction: prediction,
                confidence: confidence,
                weight: 0.9,
                reason: `⚖️ Cân bằng: ${taiCount}T-${xiuCount}X → ${prediction}`
            };
        }
        return null;
    }
    
    // Phân tích chu kỳ
    analyzeCycle(results) {
        if (results.length < 30) return null;
        
        const cycles = [3, 4, 5, 6, 7];
        let bestCycle = null;
        let bestMatch = 0;
        
        for (let cycle of cycles) {
            if (results.length < cycle * 2) continue;
            
            let matchCount = 0;
            const recent = results.slice(-cycle);
            
            for (let i = results.length - cycle * 2; i <= results.length - cycle - 1; i++) {
                let match = true;
                for (let j = 0; j < cycle; j++) {
                    if (results[i + j] !== recent[j]) {
                        match = false;
                        break;
                    }
                }
                if (match) matchCount++;
            }
            
            if (matchCount > bestMatch && matchCount >= 1) {
                bestMatch = matchCount;
                bestCycle = cycle;
            }
        }
        
        if (bestCycle && bestMatch >= 1) {
            const nextInCycle = results[results.length - bestCycle];
            if (nextInCycle) {
                return {
                    prediction: nextInCycle,
                    confidence: Math.min(0.75, 0.55 + bestMatch * 0.05),
                    weight: 0.85,
                    reason: `🔄 Chu kỳ ${bestCycle}p (lặp ${bestMatch}x)`
                };
            }
        }
        return null;
    }
    
    // Xu hướng dài hạn
    analyzeTrend(results) {
        if (results.length < 15) return null;
        
        const last15 = results.slice(-15);
        const taiCount = last15.filter(r => r === 'Tài').length;
        
        if (taiCount >= 10) {
            return {
                prediction: 'Xỉu',
                confidence: 0.6,
                weight: 0.8,
                reason: `📉 Xu hướng Tài mạnh (${taiCount}/15) → Xỉu`
            };
        }
        if (taiCount <= 5) {
            return {
                prediction: 'Tài',
                confidence: 0.6,
                weight: 0.8,
                reason: `📈 Xu hướng Xỉu mạnh (${15-taiCount}/15) → Tài`
            };
        }
        return null;
    }
    
    // Xử lý mâu thuẫn thông minh
    resolveConflicts(predictions) {
        if (predictions.length === 0) return null;
        
        const taiPredictions = predictions.filter(p => p.prediction === 'Tài');
        const xiuPredictions = predictions.filter(p => p.prediction === 'Xỉu');
        
        let taiScore = taiPredictions.reduce((sum, p) => sum + (p.confidence * p.weight), 0);
        let xiuScore = xiuPredictions.reduce((sum, p) => sum + (p.confidence * p.weight), 0);
        
        // Điều chỉnh theo chế độ
        if (this.mode === 'cautious') {
            const lastResults = this.recentResults.slice(-5);
            const taiRecent = lastResults.filter(r => r === 'Tài').length;
            if (taiRecent >= 3) xiuScore *= 1.3;
            else if (taiRecent <= 1) taiScore *= 1.3;
        }
        
        const totalScore = taiScore + xiuScore;
        if (totalScore === 0) return null;
        
        const taiRatio = taiScore / totalScore;
        const prediction = taiRatio > 0.5 ? 'Tài' : 'Xỉu';
        const confidence = Math.min(0.92, Math.abs(taiRatio - 0.5) * 2);
        
        const mainReason = taiRatio > 0.5 ? 
            taiPredictions.sort((a,b) => b.confidence - a.confidence)[0] :
            xiuPredictions.sort((a,b) => b.confidence - a.confidence)[0];
        
        return {
            prediction: prediction,
            confidence: confidence,
            taiRatio: taiRatio,
            mainReason: mainReason?.reason || 'Ensemble tổng hợp',
            conflictCount: Math.abs(taiPredictions.length - xiuPredictions.length)
        };
    }
    
    // Tổng hợp dự đoán
    superPredict(history, d1, d2, d3, total) {
        const results = history.map(h => h.Ket_qua);
        
        const predictions = [];
        
        const dicePred = this.analyzeThreeDice(d1, d2, d3);
        if (dicePred) predictions.push(dicePred);
        
        const fivePred = this.analyzeFiveResult(results);
        if (fivePred) predictions.push(fivePred);
        
        const totalPred = this.analyzeTotal(total);
        if (totalPred) predictions.push(totalPred);
        
        const cauPred = this.analyzeClassicCau(results);
        if (cauPred) predictions.push(cauPred);
        
        const balancePred = this.analyzeBalance(results);
        if (balancePred) predictions.push(balancePred);
        
        const cyclePred = this.analyzeCycle(results);
        if (cyclePred) predictions.push(cyclePred);
        
        const trendPred = this.analyzeTrend(results);
        if (trendPred) predictions.push(trendPred);
        
        const final = this.resolveConflicts(predictions);
        
        if (!final) {
            const last10 = results.slice(-10);
            const taiCount = last10.filter(r => r === 'Tài').length;
            this.lastStrategy = 'trend_10';
            return {
                prediction: taiCount >= 5 ? 'Tài' : 'Xỉu',
                confidence: 0.55,
                taiRatio: taiCount / 10,
                mainReason: '📊 Xu hướng 10 phiên',
                conflictCount: 0
            };
        }
        
        this.lastStrategy = final.mainReason;
        return final;
    }
    
    // Cập nhật sau mỗi phiên
    update(actual, predicted, confidence) {
        const correct = actual === predicted;
        
        this.recentResults.push(actual);
        if (this.recentResults.length > 50) this.recentResults.shift();
        
        this.recentPredictions.push({ predicted, correct, confidence });
        if (this.recentPredictions.length > 20) this.recentPredictions.shift();
        
        if (correct) {
            this.consecutiveWrong = 0;
        } else {
            this.consecutiveWrong++;
        }
        
        // Điều chỉnh chế độ
        if (this.consecutiveWrong >= 3) {
            this.mode = 'cautious';
        } else if (this.consecutiveWrong === 0 && this.mode === 'cautious') {
            this.mode = 'normal';
        }
        
        // Cập nhật độ tin cậy cầu
        this.updateCauTrust(actual);
        
        return correct;
    }
    
    updateCauTrust(actual) {
        const factor = actual === 'Tài' ? 1.01 : 0.99;
        for (let key in this.patternDB.cauTrust) {
            this.patternDB.cauTrust[key] = Math.max(0.35, Math.min(0.85, this.patternDB.cauTrust[key] * factor));
        }
    }
    
    getStats() {
        const recent20 = this.recentPredictions.slice(-20);
        const accuracy = recent20.length > 0 ? 
            recent20.filter(p => p.correct).length / recent20.length * 100 : 0;
        
        return {
            mode: this.mode,
            consecutiveWrong: this.consecutiveWrong,
            recentAccuracy: accuracy.toFixed(1),
            lastStrategy: this.lastStrategy,
            patternCount: {
                threeDice: this.patternDB.threeDice.size,
                fiveResult: this.patternDB.fiveResult.size,
                totalPattern: this.patternDB.totalPattern.size
            },
            cauTrust: this.patternDB.cauTrust
        };
    }
}

// ==================== KHỞI TẠO ====================
const caothu = new CaoThuTaiXiu();

let currentSessionId = null;
let lastPrediction = null;
let stats = { total: 0, correct: 0, wrong: 0, consecutiveLosses: 0 };
let last10Results = [];

// ==================== WEBSOCKET WITH WATCHDOG ====================

const WEBSOCKET_URL = "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXBpc3Vud2luMTIzIn0.hgrRbSV6vnBwJMg9ZFtbx3rRu9mX_hZMZ_m5gMNhkw0";
const WS_HEADERS = { "User-Agent": "Mozilla/5.0", "Origin": "https://play.sun.win" };
const RECONNECT_DELAY = 2500;
const PING_INTERVAL = 15000;

const initialMessages = [
    [1, "MiniGame", "GM_apivopnha", "WangLin", { "info": "{\"ipAddress\":\"14.249.227.107\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiI5ODE5YW5zc3MiLCJib3QiOjAsImlzTWVyY2hhbnQiOmZhbHNlLCJ2ZXJpZmllZEJhbmtBY2NvdW50IjpmYWxzZSwicGxheUV2ZW50TG9iYnkiOmZhbHNlLCJjdXN0b21lcklkIjozMjMyODExNTEsImFmZklkIjoic3VuLndpbiIsImJhbm5lZCI6ZmFsc2UsImJyYW5kIjoiZ2VtIiwidGltZXN0YW1wIjoxNzYzMDMyOTI4NzcwLCJsb2NrR2FtZXMiOltdLCJhbW91bnQiOjAsImxvY2tDaGF0IjpmYWxzZSwicGhvbmVWZXJpZmllZCI6ZmFsc2UsImlwQWRkcmVzcyI6IjE0LjI0OS4yMjcuMTA3IiwibXV0ZSI6ZmFsc2UsImF2YXRhciI6Imh0dHBzOi8vaW1hZ2VzLnN3aW5zaG9wLm5ldC9pbWFnZXMvYXZhdGFyL2F2YXRhcl8wNS5wbmciLCJwbGF0Zm9ybUlkIjo0LCJ1c2VySWQiOiI4ODM4NTMzZS1kZTQzLTRiOGQtOTUwMy02MjFmNDA1MDUzNGUiLCJyZWdUaW1lIjoxNzYxNjMyMzAwNTc2LCJwaG9uZSI6IiIsImRlcG9zaXQiOmZhbHNlLCJ1c2VybmFtZSI6IkdNX2FwaXZvcG5oYSJ9.guH6ztJSPXUL1cU8QdMz8O1Sdy_SbxjSM-CDzWPTr-0\",\"locale\":\"vi\",\"userId\":\"8838533e-de43-4b8d-9503-621f4050534e\",\"username\":\"GM_apivopnha\",\"timestamp\":1763032928770,\"refreshToken\":\"e576b43a64e84f789548bfc7c4c8d1e5.7d4244a361e345908af95ee2e8ab2895\"}", "signature": "45EF4B318C883862C36E1B189A1DF5465EBB60CB602BA05FAD8FCBFCD6E0DA8CB3CE65333EDD79A2BB4ABFCE326ED5525C7D971D9DEDB5A17A72764287FFE6F62CBC2DF8A04CD8EFF8D0D5AE27046947ADE45E62E644111EFDE96A74FEC635A97861A425FF2B5732D74F41176703CA10CFEED67D0745FF15EAC1065E1C8BCBFA" }],
    [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
    [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]
];

let ws = null;
let pingInterval = null;
let reconnectTimeout = null;
let lastMessageTime = Date.now();
let watchdogInterval = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

function saveHistory(entry) {
    resultHistory.push(entry);
    if (resultHistory.length > 1000) resultHistory.shift();
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(resultHistory, null, 2));
    } catch (e) {}
}

// Watchdog - kiểm tra kết nối
function startWatchdog() {
    if (watchdogInterval) clearInterval(watchdogInterval);
    
    watchdogInterval = setInterval(() => {
        const timeSinceLastMessage = (Date.now() - lastMessageTime) / 1000;
        
        if (timeSinceLastMessage > 60) {
            console.log(`[⚠️] ${timeSinceLastMessage.toFixed(0)}s không có dữ liệu`);
            
            if (ws && ws.readyState === WebSocket.OPEN) {
                try {
                    ws.ping();
                } catch (e) {
                    console.log('[❌] Ping thất bại');
                    ws.terminate();
                }
            } else {
                console.log('[🔌] WebSocket đã đóng, kết nối lại...');
                connectWebSocket();
            }
        }
        
        if (timeSinceLastMessage > 120) {
            console.log('[🚨] Quá 120s không có dữ liệu, force reconnect!');
            if (ws) ws.terminate();
            connectWebSocket();
        }
    }, 30000);
}

function connectWebSocket() {
    if (ws) {
        try {
            ws.removeAllListeners();
            ws.terminate();
        } catch (e) {}
        ws = null;
    }
    
    console.log(`[🔌] Kết nối WebSocket (lần ${reconnectAttempts + 1})...`);
    ws = new WebSocket(WEBSOCKET_URL, { headers: WS_HEADERS });
    
    const connectionTimeout = setTimeout(() => {
        if (ws && ws.readyState !== WebSocket.OPEN) {
            console.log('[❌] Timeout kết nối');
            ws.terminate();
        }
    }, 10000);
    
    ws.on('open', () => {
        clearTimeout(connectionTimeout);
        console.log('[✅] WebSocket đã kết nối!');
        reconnectAttempts = 0;
        lastMessageTime = Date.now();
        
        initialMessages.forEach((msg, i) => {
            setTimeout(() => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(msg));
                    console.log(`[📤] Đã gửi tin nhắn ${i + 1}`);
                }
            }, i * 600);
        });
        
        clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) ws.ping();
        }, PING_INTERVAL);
    });
    
    ws.on('message', (message) => {
        lastMessageTime = Date.now();
        try {
            const data = JSON.parse(message);
            if (!Array.isArray(data) || typeof data[1] !== 'object') return;
            const { cmd, sid, d1, d2, d3, gBB } = data[1];
            
            if (cmd === 1008 && sid) {
                currentSessionId = sid;
                console.log(`[📡] Session ID: ${sid}`);
            }
            
            if (cmd === 1003 && gBB && d1 && d2 && d3) {
                const total = d1 + d2 + d3;
                const result = total > 10 ? "Tài" : "Xỉu";
                
                let predictionCorrect = false;
                if (lastPrediction && lastPrediction.ket_qua) {
                    predictionCorrect = lastPrediction.ket_qua === result;
                    stats.total++;
                    if (predictionCorrect) {
                        stats.correct++;
                        stats.consecutiveLosses = 0;
                    } else {
                        stats.wrong++;
                        stats.consecutiveLosses++;
                    }
                    
                    caothu.update(result, lastPrediction.ket_qua, lastPrediction.do_tin_cay);
                    
                    last10Results.push(predictionCorrect ? 1 : 0);
                    if (last10Results.length > 10) last10Results.shift();
                }
                
                const caoThuStats = caothu.getStats();
                const historyForAnalyzer = resultHistory.map(h => ({ Ket_qua: h.Ket_qua }));
                const prediction = caothu.superPredict(historyForAnalyzer, d1, d2, d3, total);
                
                let finalPrediction = prediction.prediction;
                let finalConfidence = prediction.confidence;
                let mainReason = prediction.mainReason;
                
                if (caoThuStats.mode === 'cautious' && stats.consecutiveLosses >= 2) {
                    finalPrediction = finalPrediction === 'Tài' ? 'Xỉu' : 'Tài';
                    finalConfidence = 0.55;
                    mainReason = `⚠️ CHẾ ĐỘ THẬN TRỌNG (sai ${caoThuStats.consecutiveWrong} liên tiếp)`;
                }
                
                lastPrediction = {
                    phien: currentSessionId ? parseInt(currentSessionId) + 1 : null,
                    ket_qua: finalPrediction,
                    do_tin_cay: (finalConfidence * 100).toFixed(0) + '%',
                    reason: mainReason
                };
                
                const tiLe = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) + '%' : '0%';
                const last10Acc = last10Results.length > 0 ? 
                    (last10Results.reduce((a,b) => a+b, 0) / last10Results.length * 100).toFixed(0) + '%' : 'N/A';
                
                console.log(`\n🎲 ===== PHIÊN ${currentSessionId || '?'} =====`);
                console.log(`🎯 Xúc xắc: ${d1} ${d2} ${d3} (Tổng ${total}) → Kết quả: ${result} ${predictionCorrect ? '✅' : '❌'}`);
                console.log(`🤖 Dự đoán tiếp: ${finalPrediction} | Độ tin cậy: ${(finalConfidence*100).toFixed(0)}%`);
                console.log(`📊 Thống kê: ${stats.correct}/${stats.total} (${tiLe}) | 10 gần nhất: ${last10Acc}`);
                console.log(`🧠 Chế độ: ${caoThuStats.mode} | ${mainReason}`);
                console.log(`=====================================\n`);
                
                const historyEntry = {
                    phien: currentSessionId, Xuc_xac_1: d1, Xuc_xac_2: d2, Xuc_xac_3: d3,
                    Tong: total, Ket_qua: result, du_doan: lastPrediction.ket_qua,
                    do_tin_cay: lastPrediction.do_tin_cay, thoi_gian: new Date().toISOString()
                };
                saveHistory(historyEntry);
                
                currentSessionId = null;
            }
        } catch (e) {
            console.error('[❌] Lỗi xử lý message:', e.message);
        }
    });
    
    ws.on('pong', () => {
        lastMessageTime = Date.now();
    });
    
    ws.on('close', (code, reason) => {
        clearTimeout(connectionTimeout);
        console.log(`[🔌] WebSocket đóng. Code: ${code}`);
        clearInterval(pingInterval);
        
        reconnectAttempts++;
        const delay = Math.min(5000 * reconnectAttempts, 30000);
        console.log(`[⏳] Thử lại sau ${delay/1000}s (lần ${reconnectAttempts})`);
        
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
            connectWebSocket();
        }, delay);
    });
    
    ws.on('error', (err) => {
        clearTimeout(connectionTimeout);
        console.error('[❌] WebSocket lỗi:', err.message);
        if (ws) ws.terminate();
    });
}

// ==================== API ====================
app.get('/api/sieu', (req, res) => {
    const lastEntry = resultHistory[resultHistory.length - 1];
    const caoThuStats = caothu.getStats();
    
    if (lastEntry && lastPrediction) {
        const response = {
            "Phien": lastEntry.phien,
            "Xuc_xac": `${lastEntry.Xuc_xac_1} ${lastEntry.Xuc_xac_2} ${lastEntry.Xuc_xac_3}`,
            "Tong": lastEntry.Tong,
            "Ket_qua": lastEntry.Ket_qua,
            "Phien_tiep_theo": lastPrediction.phien,
            "Du_doan": lastPrediction.ket_qua,
            "Do_tin_cay": lastPrediction.do_tin_cay,
            "Phan_tich": lastPrediction.reason,
            "Che_do": caoThuStats.mode,
            "Do_tin_cay_cau": caoThuStats.cauTrust,
            "Thong_ke": {
                "tong": stats.total,
                "dung": stats.correct,
                "sai": stats.wrong,
                "ti_le": stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) + '%' : '0%'
            },
            "id": "@caothu"
        };
        res.json(response);
    } else {
        res.json({ status: "waiting", message: "Đang chờ dữ liệu từ WebSocket..." });
    }
});

app.get('/api/stats', (req, res) => {
    const caoThuStats = caothu.getStats();
    res.json({
        ...stats,
        ti_le: stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) + '%' : '0%',
        last10_accuracy: last10Results.length > 0 ? 
            (last10Results.reduce((a,b) => a+b, 0) / last10Results.length * 100).toFixed(1) + '%' : 'N/A',
        caoThu: caoThuStats
    });
});

app.get('/api/history', (req, res) => res.json(resultHistory.slice(-30).reverse()));
app.get('/api/patterns', (req, res) => res.json({
    threeDice: Array.from(caothu.patternDB.threeDice.entries()).slice(-20),
    cauTrust: caothu.patternDB.cauTrust
}));

app.get('/api/ping', (req, res) => {
    const timeSinceLastMessage = (Date.now() - lastMessageTime) / 1000;
    res.json({
        status: 'alive',
        time: new Date().toISOString(),
        lastMessage: `${timeSinceLastMessage.toFixed(0)}s ago`,
        wsState: ws ? ws.readyState : 'null',
        reconnectAttempts: reconnectAttempts,
        stats: {
            total: stats.total,
            correct: stats.correct,
            ti_le: stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) + '%' : '0%'
        }
    });
});

app.get('/', (req, res) => res.json({ 
    status: 'active', 
    message: 'CAO THỦ TÀI XỈU v5.0 - Học từ lịch sử + Watchdog',
    version: '5.0',
    endpoints: ['/api/sieu', '/api/stats', '/api/history', '/api/patterns', '/api/ping']
}));

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🏆 ===== CAO THỦ TÀI XỈU v5.0 =====`);
    console.log(`🌐 API: http://0.0.0.0:${PORT}`);
    console.log(`📊 Đã học từ ${resultHistory.length} phiên lịch sử`);
    console.log(`🧠 Chiến lược: Pattern Xúc xắc | 5 KQ | Tổng điểm | Cầu có trọng số | Chu kỳ | Cân bằng | Xu hướng`);
    console.log(`👁️ Watchdog: Tự động kiểm tra và reconnect mỗi 30s`);
    console.log(`====================================\n`);
});

// Khởi động WebSocket và Watchdog
connectWebSocket();
setTimeout(() => {
    startWatchdog();
    console.log('[👁️] Watchdog đã khởi động!');
}, 5000);
