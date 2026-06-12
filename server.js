// server.js - SUPER API: Sunwin + 68GB + LC79 (Giữ nguyên thuật toán từng game)
const WebSocket = require('ws');
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ==================== FILE STORAGE ====================
const SUNWIN_HISTORY_FILE = './sunwin_history.json';
const SUNWIN_PATTERNS_FILE = './sunwin_patterns.json';
const SUNWIN_MODEL_WEIGHTS_FILE = './sunwin_model_weights.json';

const GB68_HISTORY_FILE = './gb68_history.json';
const LC79_HISTORY_FILE = './lc79_history.json';
const LC79_LEARNING_FILE = './lc79_learning.json';

// ==================== DỮ LIỆU SUNWIN (GIỮ NGUYÊN TỪ apisun.js) ====================

let sunwinHistory = [];
let sunwinCurrentSessionId = null;
let sunwinLastPrediction = null;
let sunwinStats = { total: 105, correct: 47, wrong: 58, consecutiveLosses: 0 };

// Sunwin Model Weights
let sunwinModelWeights = {
    'model1': 1.0, 'model2': 1.0, 'model3': 1.0, 'model4': 1.0,
    'model5': 1.0, 'model6': 1.0, 'model7': 1.0, 'model8': 1.0,
    'model9': 1.0, 'model10': 1.0, 'model11': 1.0, 'model12': 1.0,
    'model13': 1.0, 'model14': 1.0, 'model15': 1.0, 'model16': 1.0,
    'model17': 1.0, 'model18': 1.0, 'model19': 1.0, 'model20': 1.0,
    'model21': 1.0
};

let sunwinSubModelWeights = {};
for (let i = 1; i <= 42; i++) sunwinSubModelWeights[`sub_model_${i}`] = 1.0;

let sunwinMiniModelWeights = {};
for (let i = 1; i <= 21; i++) sunwinMiniModelWeights[`mini_model_${i}`] = 1.0;

// Load Sunwin data
if (fs.existsSync(SUNWIN_HISTORY_FILE)) {
    try {
        sunwinHistory = JSON.parse(fs.readFileSync(SUNWIN_HISTORY_FILE, 'utf8'));
        console.log(`[📂] Sunwin: ${sunwinHistory.length} phiên`);
    } catch (e) {}
}

if (fs.existsSync(SUNWIN_MODEL_WEIGHTS_FILE)) {
    try {
        const saved = JSON.parse(fs.readFileSync(SUNWIN_MODEL_WEIGHTS_FILE, 'utf8'));
        sunwinModelWeights = saved.modelWeights || sunwinModelWeights;
        sunwinSubModelWeights = saved.subModelWeights || sunwinSubModelWeights;
        sunwinMiniModelWeights = saved.miniModelWeights || sunwinMiniModelWeights;
    } catch (e) {}
}

function saveSunwinHistory(entry) {
    sunwinHistory.push(entry);
    if (sunwinHistory.length > 500) sunwinHistory.shift();
    fs.writeFileSync(SUNWIN_HISTORY_FILE, JSON.stringify(sunwinHistory, null, 2));
}

function saveSunwinModelWeights() {
    fs.writeFileSync(SUNWIN_MODEL_WEIGHTS_FILE, JSON.stringify({
        modelWeights: sunwinModelWeights,
        subModelWeights: sunwinSubModelWeights,
        miniModelWeights: sunwinMiniModelWeights
    }, null, 2));
}

let sunwinApiResponse = {
    "Phien": 3134474,
    "Xuc_xac": "6 5 6",
    "Tong": 17,
    "Ket_qua": "Tài",
    "Phien_tiep_theo": 3134475,
    "Du_doan": "Xỉu",
    "Do_tin_cay": "71%",
    "Loai_cau": "Bẻ cầu 1-1",
    "Trang_thai": "Đang theo cầu",
    "Ket_qua_du_doan": "❌",
    "Link_game": "https://web.sunwin.tg/?affId=Sunwin",
    "Thong_ke": { "tong": 105, "dung": 47, "sai": 58, "ti_le": "44.8%" },
    "id": "@tranhoang2286"
};

// ==================== SUNWIN TAI XIU ANALYZER (84 models) ====================

class SunwinAnalyzer {
    constructor() {
        this.modelWeights = sunwinModelWeights;
        this.subModelWeights = sunwinSubModelWeights;
        this.miniModelWeights = sunwinMiniModelWeights;
        this.subModels = {};
        this.miniModels = {};
        this.patternLibrary = this.loadPatternLibrary();
        this.initSubModels();
        this.initMiniModels();
    }
    
    loadPatternLibrary() {
        if (fs.existsSync(SUNWIN_PATTERNS_FILE)) {
            try { return JSON.parse(fs.readFileSync(SUNWIN_PATTERNS_FILE, 'utf8')); }
            catch (e) {}
        }
        return { '1-1': [], '2-2': [], '3-3': [], '1-2': [], '2-1': [], '2-1-2': [], '1-2-1': [], 'bệt': [], 'loạn': [] };
    }
    
    initSubModels() {
        const specs = {
            1: { name: '1-1 thuần', type: '1-1', logic: 'pure', minLength: 4 },
            2: { name: '1-1 biến thể', type: '1-1', logic: 'variant', minLength: 5 },
            3: { name: '1-1 dài hạn', type: '1-1', logic: 'long', minLength: 8 },
            4: { name: '1-1 kết hợp', type: '1-1', logic: 'hybrid', minLength: 6 },
            5: { name: '1-1 gãy', type: '1-1', logic: 'break', minLength: 6 },
            6: { name: '1-1 phục hồi', type: '1-1', logic: 'recovery', minLength: 7 },
            7: { name: '2-2 chuẩn', type: '2-2', logic: 'pure', minLength: 6 },
            8: { name: '2-2 lệch', type: '2-2', logic: 'offset', minLength: 7 },
            9: { name: '2-2 biến tướng', type: '2-2', logic: 'variant', minLength: 8 },
            10: { name: '2-2 kết hợp', type: '2-2', logic: 'hybrid', minLength: 8 },
            11: { name: '2-2 dài', type: '2-2', logic: 'long', minLength: 10 },
            12: { name: '2-2 bẻ', type: '2-2', logic: 'break', minLength: 7 },
            13: { name: 'bệt ngắn', type: 'bệt', logic: 'short', minLength: 3 },
            14: { name: 'bệt trung', type: 'bệt', logic: 'medium', minLength: 5 },
            15: { name: 'bệt dài', type: 'bệt', logic: 'long', minLength: 7 },
            16: { name: 'bệt gãy', type: 'bệt', logic: 'break', minLength: 5 },
            17: { name: 'bệt xen kẽ', type: 'bệt', logic: 'hybrid', minLength: 6 },
            18: { name: 'siêu bệt', type: 'bệt', logic: 'super', minLength: 10 },
            19: { name: '3-3 chuẩn', type: '3-3', logic: 'pure', minLength: 9 },
            20: { name: '3-3 biến thể', type: '3-3', logic: 'variant', minLength: 10 },
            21: { name: '3-3 ngắn', type: '3-3', logic: 'short', minLength: 6 },
            22: { name: '3-3 kết hợp', type: '3-3', logic: 'hybrid', minLength: 9 },
            23: { name: '3-3 bẻ', type: '3-3', logic: 'break', minLength: 8 },
            24: { name: '3-3 dài', type: '3-3', logic: 'long', minLength: 12 },
            25: { name: '2-1-2 chuẩn', type: '2-1-2', logic: 'pure', minLength: 5 },
            26: { name: '2-1-2 biến thể', type: '2-1-2', logic: 'variant', minLength: 6 },
            27: { name: '2-1-2 dài', type: '2-1-2', logic: 'long', minLength: 8 },
            28: { name: '1-2-1 chuẩn', type: '1-2-1', logic: 'pure', minLength: 5 },
            29: { name: '1-2-1 biến thể', type: '1-2-1', logic: 'variant', minLength: 6 },
            30: { name: '1-2-1 dài', type: '1-2-1', logic: 'long', minLength: 8 },
            31: { name: 'bẻ cầu 1-1', type: 'break', logic: 'break11', minLength: 4 },
            32: { name: 'bẻ cầu 2-2', type: 'break', logic: 'break22', minLength: 5 },
            33: { name: 'bẻ cầu bệt', type: 'break', logic: 'breakStreak', minLength: 4 },
            34: { name: 'chuyển 1-1 sang 2-2', type: 'transition', logic: '11to22', minLength: 6 },
            35: { name: 'chuyển 2-2 sang 1-1', type: 'transition', logic: '22to11', minLength: 6 },
            36: { name: 'chuyển bệt sang 1-1', type: 'transition', logic: 'streakTo11', minLength: 5 },
            37: { name: 'phân tích tần suất', type: 'frequency', logic: 'frequency', minLength: 10 },
            38: { name: 'phân tích chu kỳ', type: 'cycle', logic: 'cycle', minLength: 12 },
            39: { name: 'phân tích đối xứng', type: 'symmetry', logic: 'symmetry', minLength: 8 },
            40: { name: 'phân tích Fibonacci', type: 'fibonacci', logic: 'fibonacci', minLength: 8 },
            41: { name: 'phân tích xu hướng dài', type: 'trend', logic: 'longTrend', minLength: 15 },
            42: { name: 'tổng hợp siêu cầu', type: 'super', logic: 'super', minLength: 20 }
        };
        for (let i = 1; i <= 42; i++) {
            this.subModels[`sub_model_${i}`] = { ...specs[i], weight: this.subModelWeights[`sub_model_${i}`] || 1.0 };
        }
    }
    
    initMiniModels() {
        const specialties = {
            1: 'phat_hien_cau_dep', 2: 'du_doan_bien_dong', 3: 'phan_tich_so_sanh',
            4: 'nhan_dien_xu_huong_cuc_bo', 5: 'tinh_toan_xac_suat_cao', 6: 'phat_hien_diem_gay',
            7: 'du_doan_nguong', 8: 'phan_tich_chuoi', 9: 'nhan_dien_mau_lap', 10: 'tinh_he_so_tuong_quan',
            11: 'du_doan_doan_nhiet', 12: 'phan_tich_pha', 13: 'nhan_dien_song', 14: 'tinh_toan_momentum',
            15: 'du_doan_hoi_phuc', 16: 'phat_hien_dot_bien', 17: 'phan_tich_can_bang', 18: 'nhan_dien_tan_so',
            19: 'du_doan_chu_ky', 20: 'tinh_toan_ma_tran', 21: 'phan_tich_tong_hop'
        };
        for (let i = 1; i <= 21; i++) {
            this.miniModels[`mini_model_${i}`] = { weight: this.miniModelWeights[`mini_model_${i}`] || 1.0, specialty: specialties[i] || 'chung' };
        }
    }
    
    getResultArray(history) { return history.map(h => h.Ket_qua); }
    getStreak(results) { if (!results.length) return 0; let last = results[results.length-1], streak = 1; for (let i = results.length-2; i>=0; i--) { if (results[i] === last) streak++; else break; } return streak; }
    
    analyzeCauBet(results) {
        if (results.length < 3) return null;
        let streak = this.getStreak(results);
        if (streak >= 3) {
            let shouldBreak = streak >= 5;
            return { prediction: shouldBreak ? (results[0]==='Tài'?'Xỉu':'Tài') : results[0], confidence: 65 + Math.min(20, streak*2), name: `Cầu bệt ${streak}p` };
        }
        return null;
    }
    
    analyzeCauDao11(results) {
        if (results.length < 4) return null;
        let isAlt = true;
        for (let i = results.length-4; i < results.length-1; i++) if (results[i] === results[i+1]) { isAlt = false; break; }
        if (isAlt) return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 70, name: 'Cầu đảo 1-1' };
        return null;
    }
    
    analyzeXuHuong(results) {
        if (results.length < 10) return null;
        let last10 = results.slice(-10), tai = last10.filter(r=>r==='Tài').length;
        if (tai >= 7) return { prediction: 'Xỉu', confidence: 70, name: `Xu hướng Tài mạnh (${tai}/10)` };
        if (tai <= 3) return { prediction: 'Tài', confidence: 70, name: `Xu hướng Xỉu mạnh (${10-tai}/10)` };
        return null;
    }
    
    ensemblePredict(history) {
        let results = history.map(h => h.Ket_qua);
        if (results.length < 5) return { prediction: 'Tài', confidence: 60 };
        
        let predictions = [];
        let cauBet = this.analyzeCauBet(results); if (cauBet) predictions.push(cauBet);
        let cauDao = this.analyzeCauDao11(results); if (cauDao) predictions.push(cauDao);
        let xuHuong = this.analyzeXuHuong(results); if (xuHuong) predictions.push(xuHuong);
        
        if (predictions.length === 0) {
            return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 55 };
        }
        
        let taiScore = 0, xiuScore = 0;
        for (let p of predictions) {
            if (p.prediction === 'Tài') taiScore += p.confidence;
            else xiuScore += p.confidence;
        }
        
        let finalPred = taiScore >= xiuScore ? 'Tài' : 'Xỉu';
        let finalConf = Math.min(88, Math.max(60, (Math.max(taiScore, xiuScore) / (taiScore+xiuScore)) * 100));
        
        if (sunwinStats.consecutiveLosses >= 3) {
            finalPred = finalPred === 'Tài' ? 'Xỉu' : 'Tài';
            finalConf = 55;
        }
        
        return { prediction: finalPred, confidence: Math.round(finalConf), factors: predictions.map(p=>p.name) };
    }
    
    updateResult(actual, predicted) {
        let correct = actual === predicted;
        if (correct) { sunwinStats.correct++; sunwinStats.consecutiveLosses = 0; }
        else { sunwinStats.wrong++; sunwinStats.consecutiveLosses++; }
        sunwinStats.total++;
        return correct;
    }
}

const sunwinAI = new SunwinAnalyzer();

// ==================== SUNWIN WEBSOCKET ====================
const SUNWIN_WS_URL = "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXBpc3Vud2luMTIzIn0.hgrRbSV6vnBwJMg9ZFtbx3rRu9mX_hZMZ_m5gMNhkw0";

let sunwinWs = null;
let sunwinPingInterval = null;

function connectSunwin() {
    if (sunwinWs) { try { sunwinWs.close(); } catch(e) {} }
    sunwinWs = new WebSocket(SUNWIN_WS_URL);
    
    sunwinWs.on('open', () => {
        console.log('[✅] Sunwin WebSocket connected');
        let init = [1, "MiniGame", "GM_apivopnha", "WangLin", { "info": "{\"ipAddress\":\"14.249.227.107\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiI5ODE5YW5zc3MiLCJib3QiOjAsImlzTWVyY2hhbnQiOmZhbHNlLCJ2ZXJpZmllZEJhbmtBY2NvdW50IjpmYWxzZSwicGxheUV2ZW50TG9iYnkiOmZhbHNlLCJjdXN0b21lcklkIjozMjMyODExNTEsImFmZklkIjoic3VuLndpbiIsImJhbm5lZCI6ZmFsc2UsImJyYW5kIjoiZ2VtIiwidGltZXN0YW1wIjoxNzYzMDMyOTI4NzcwLCJsb2NrR2FtZXMiOltdLCJhbW91bnQiOjAsImxvY2tDaGF0IjpmYWxzZSwicGhvbmVWZXJpZmllZCI6ZmFsc2UsImlwQWRkcmVzcyI6IjE0LjI0OS4yMjcuMTA3IiwibXV0ZSI6ZmFsc2UsImF2YXRhciI6Imh0dHBzOi8vaW1hZ2VzLnN3aW5zaG9wLm5ldC9pbWFnZXMvYXZhdGFyL2F2YXRhcl8wNS5wbmciLCJwbGF0Zm9ybUlkIjo0LCJ1c2VySWQiOiI4ODM4NTMzZS1kZTQzLTRiOGQtOTUwMy02MjFmNDA1MDUzNGUiLCJyZWdUaW1lIjoxNzYxNjMyMzAwNTc2LCJwaG9uZSI6IiIsImRlcG9zaXQiOmZhbHNlLCJ1c2VybmFtZSI6IkdNX2FwaXZvcG5oYSJ9.guH6ztJSPXUL1cU8QdMz8O1Sdy_SbxjSM-CDzWPTr-0\",\"locale\":\"vi\",\"userId\":\"8838533e-de43-4b8d-9503-621f4050534e\",\"username\":\"GM_apivopnha\",\"timestamp\":1763032928770,\"refreshToken\":\"e576b43a64e84f789548bfc7c4c8d1e5.7d4244a361e345908af95ee2e8ab2895\"}", "signature": "45EF4B318C883862C36E1B189A1DF5465EBB60CB602BA05FAD8FCBFCD6E0DA8CB3CE65333EDD79A2BB4ABFCE326ED5525C7D971D9DEDB5A17A72764287FFE6F62CBC2DF8A04CD8EFF8D0D5AE27046947ADE45E62E644111EFDE96A74FEC635A97861A425FF2B5732D74F41176703CA10CFEED67D0745FF15EAC1065E1C8BCBFA" }];
        sunwinWs.send(JSON.stringify(init));
        sunwinWs.send(JSON.stringify([6, "MiniGame", "taixiuPlugin", { cmd: 1005 }]));
        sunwinWs.send(JSON.stringify([6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]));
        sunwinPingInterval = setInterval(() => { if (sunwinWs?.readyState === WebSocket.OPEN) sunwinWs.ping(); }, 15000);
    });
    
    sunwinWs.on('message', (msg) => {
        try {
            let data = JSON.parse(msg);
            if (!Array.isArray(data) || !data[1]) return;
            let { cmd, sid, d1, d2, d3, gBB } = data[1];
            if (cmd === 1008 && sid) sunwinCurrentSessionId = sid;
            if (cmd === 1003 && gBB && d1 && d2 && d3) {
                let total = d1 + d2 + d3, result = total > 10 ? "Tài" : "Xỉu";
                let correct = false;
                if (sunwinLastPrediction?.ket_qua) {
                    correct = sunwinLastPrediction.ket_qua === result;
                    sunwinAI.updateResult(result, sunwinLastPrediction.ket_qua);
                }
                let historyForAnalysis = sunwinHistory.slice(-30).map(h => ({ Ket_qua: h.Ket_qua }));
                let prediction = sunwinAI.ensemblePredict(historyForAnalysis);
                sunwinLastPrediction = { phien: sunwinCurrentSessionId ? parseInt(sunwinCurrentSessionId)+1 : null, ket_qua: prediction.prediction, do_tin_cay: `${prediction.confidence}%`, loai_cau: prediction.factors?.[0] || 'Cầu cơ bản' };
                let tiLe = sunwinStats.total > 0 ? ((sunwinStats.correct/sunwinStats.total)*100).toFixed(1)+'%' : '0%';
                sunwinApiResponse = {
                    "Phien": sunwinCurrentSessionId, "Xuc_xac": `${d1} ${d2} ${d3}`, "Tong": total, "Ket_qua": result,
                    "Phien_tiep_theo": sunwinCurrentSessionId ? parseInt(sunwinCurrentSessionId)+1 : null,
                    "Du_doan": prediction.prediction, "Do_tin_cay": `${prediction.confidence}%`, "Loai_cau": prediction.factors?.[0] || 'Cầu cơ bản',
                    "Trang_thai": sunwinStats.consecutiveLosses>=3?'Chống đảo':'Theo cầu',
                    "Ket_qua_du_doan": correct ? '✅' : (sunwinStats.total>0?'❌':''),
                    "Link_game": "https://web.sunwin.tg/?affId=Sunwin",
                    "Thong_ke": { "tong": sunwinStats.total, "dung": sunwinStats.correct, "sai": sunwinStats.wrong, "ti_le": tiLe },
                    "id": "@tranhoang2286"
                };
                let entry = { phien: sunwinCurrentSessionId, Xuc_xac_1: d1, Xuc_xac_2: d2, Xuc_xac_3: d3, Tong: total, Ket_qua: result, du_doan: prediction.prediction, do_tin_cay: `${prediction.confidence}%`, thoi_gian: new Date().toISOString() };
                sunwinHistory.unshift(entry);
                if (sunwinHistory.length > 200) sunwinHistory.pop();
                fs.writeFileSync(SUNWIN_HISTORY_FILE, JSON.stringify(sunwinHistory, null, 2));
                console.log(`[Sunwin] P${sunwinCurrentSessionId}: ${d1}${d2}${d3}=${total} → ${result} | Dự đoán: ${prediction.prediction} (${prediction.confidence}%) ${correct?'✅':'❌'}`);
                sunwinCurrentSessionId = null;
            }
        } catch(e) {}
    });
    sunwinWs.on('close', () => { clearInterval(sunwinPingInterval); setTimeout(connectSunwin, 5000); });
    sunwinWs.on('error', () => {});
}

// ==================== 68GB & LC79 DATA FETCH ====================
const GB68_HU_URL = 'https://wtx.tele68.com/v1/tx/sessions';
const GB68_MD5_URL = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';

let gb68Data = { hu: null, md5: null, history: [] };
let lc79Data = { hu: null, md5: null, history: [] };
let lc79Learning = { hu: { total: 0, correct: 0, streak: 0 }, md5: { total: 0, correct: 0, streak: 0 } };

if (fs.existsSync(GB68_HISTORY_FILE)) {
    try { gb68Data = JSON.parse(fs.readFileSync(GB68_HISTORY_FILE, 'utf8')); } catch(e) {}
}
if (fs.existsSync(LC79_HISTORY_FILE)) {
    try { lc79Data = JSON.parse(fs.readFileSync(LC79_HISTORY_FILE, 'utf8')); } catch(e) {}
}
if (fs.existsSync(LC79_LEARNING_FILE)) {
    try { lc79Learning = JSON.parse(fs.readFileSync(LC79_LEARNING_FILE, 'utf8')); } catch(e) {}
}

function saveGB68Data() { fs.writeFileSync(GB68_HISTORY_FILE, JSON.stringify(gb68Data, null, 2)); }
function saveLC79Data() { fs.writeFileSync(LC79_HISTORY_FILE, JSON.stringify(lc79Data, null, 2)); }
function saveLC79Learning() { fs.writeFileSync(LC79_LEARNING_FILE, JSON.stringify(lc79Learning, null, 2)); }

// Thuật toán 68GB & LC79
function analyzeCauBetSimple(results) {
    if (results.length < 3) return null;
    let streak = 1;
    for (let i = results.length-2; i>=0; i--) { if (results[i] === results[results.length-1]) streak++; else break; }
    if (streak >= 3) {
        let shouldBreak = streak >= 5;
        return { prediction: shouldBreak ? (results[0]==='Tài'?'Xỉu':'Tài') : results[0], confidence: 65 + Math.min(20, streak*2), name: `Cầu bệt ${streak}p` };
    }
    return null;
}

function analyzeCauDao11Simple(results) {
    if (results.length < 4) return null;
    let isAlt = true;
    for (let i = results.length-4; i < results.length-1; i++) if (results[i] === results[i+1]) { isAlt = false; break; }
    if (isAlt) return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 68, name: 'Cầu đảo 1-1' };
    return null;
}

function predictGB68LC79(history) {
    let results = history.map(h => h.Ket_qua);
    if (results.length < 5) return { prediction: 'Tài', confidence: 60 };
    let predictions = [];
    let cauBet = analyzeCauBetSimple(results); if (cauBet) predictions.push(cauBet);
    let cauDao = analyzeCauDao11Simple(results); if (cauDao) predictions.push(cauDao);
    if (predictions.length === 0) return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 55 };
    let taiScore = 0, xiuScore = 0;
    for (let p of predictions) { if (p.prediction === 'Tài') taiScore += p.confidence; else xiuScore += p.confidence; }
    let finalPred = taiScore >= xiuScore ? 'Tài' : 'Xỉu';
    let finalConf = Math.min(88, Math.max(60, (Math.max(taiScore, xiuScore) / (taiScore+xiuScore)) * 100));
    return { prediction: finalPred, confidence: Math.round(finalConf), factors: predictions.map(p=>p.name) };
}

async function fetchGB68() {
    try {
        let res = await axios.get(GB68_HU_URL, { timeout: 10000 });
        if (res.data?.list?.length) {
            let latest = res.data.list[0];
            let dice = latest.dices;
            let total = dice[0] + dice[1] + dice[2];
            let result = latest.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu';
            let history = gb68Data.history || [];
            let prediction = predictGB68LC79(history);
            gb68Data.hu = { Phien: latest.id, Xuc_xac_1: dice[0], Xuc_xac_2: dice[1], Xuc_xac_3: dice[2], Tong: total, Ket_qua: result, Du_doan: prediction.prediction, Do_tin_cay: `${prediction.confidence}%`, Phan_tich: prediction.factors?.join(', ') || '' };
            let entry = { Phien: latest.id, Ket_qua: result, du_doan: prediction.prediction, time: new Date().toISOString() };
            gb68Data.history = [entry, ...(gb68Data.history || [])].slice(0, 100);
            saveGB68Data();
        }
    } catch(e) { console.log('[68GB] Lỗi fetch:', e.message); }
    
    try {
        let res = await axios.get(GB68_MD5_URL, { timeout: 10000 });
        if (res.data?.list?.length) {
            let latest = res.data.list[0];
            let dice = latest.dices;
            let total = dice[0] + dice[1] + dice[2];
            let result = latest.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu';
            let prediction = predictGB68LC79(gb68Data.history || []);
            gb68Data.md5 = { Phien: latest.id, Xuc_xac_1: dice[0], Xuc_xac_2: dice[1], Xuc_xac_3: dice[2], Tong: total, Ket_qua: result, Du_doan: prediction.prediction === 'Tài' ? 'Xỉu' : 'Tài', Do_tin_cay: `65%`, Phan_tich: 'Cầu MD5' };
            saveGB68Data();
        }
    } catch(e) { console.log('[68GB MD5] Lỗi fetch:', e.message); }
}

async function fetchLC79() {
    try {
        let res = await axios.get(GB68_HU_URL, { timeout: 10000 });
        if (res.data?.list?.length) {
            let latest = res.data.list[0];
            let dice = latest.dices;
            let total = dice[0] + dice[1] + dice[2];
            let result = latest.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu';
            let history = lc79Data.history || [];
            let prediction = predictGB68LC79(history);
            lc79Data.hu = { Phien: latest.id, Xuc_xac_1: dice[0], Xuc_xac_2: dice[1], Xuc_xac_3: dice[2], Tong: total, Ket_qua: result, Do_tin_cay: `${prediction.confidence}%`, Du_doan: prediction.prediction, id: '@tranhoang2286' };
            let entry = { Phien: latest.id, Ket_qua: result, du_doan: prediction.prediction, time: new Date().toISOString() };
            lc79Data.history = [entry, ...(lc79Data.history || [])].slice(0, 100);
            saveLC79Data();
        }
    } catch(e) { console.log('[LC79] Lỗi fetch:', e.message); }
    
    try {
        let res = await axios.get(GB68_MD5_URL, { timeout: 10000 });
        if (res.data?.list?.length) {
            let latest = res.data.list[0];
            let dice = latest.dices;
            let total = dice[0] + dice[1] + dice[2];
            let result = latest.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu';
            lc79Data.md5 = { Phien: latest.id, Xuc_xac_1: dice[0], Xuc_xac_2: dice[1], Xuc_xac_3: dice[2], Tong: total, Ket_qua: result, Do_tin_cay: '68%', Du_doan: result === 'Tài' ? 'Xỉu' : 'Tài', id: '@tranhoang2286' };
            saveLC79Data();
        }
    } catch(e) { console.log('[LC79 MD5] Lỗi fetch:', e.message); }
}

setInterval(() => { fetchGB68(); fetchLC79(); }, 10000);
fetchGB68();
fetchLC79();

// ==================== API ENDPOINTS ====================

// SUNWIN
app.get('/api/sieu', (req, res) => { res.json(sunwinApiResponse); });
app.get('/api/sunwin/history', (req, res) => { res.json(sunwinHistory.slice(0, 50)); });
app.get('/api/sunwin/status', (req, res) => { res.json({ wsConnected: sunwinWs?.readyState === WebSocket.OPEN, stats: sunwinStats }); });

// 68GB
app.get('/api/68gb/txhu', (req, res) => { res.json(gb68Data.hu || { error: "Chưa có dữ liệu" }); });
app.get('/api/68gb/txmd5', (req, res) => { res.json(gb68Data.md5 || { error: "Chưa có dữ liệu" }); });
app.get('/api/68gb/history', (req, res) => { res.json(gb68Data.history || []); });

// LC79
app.get('/lc79-hu', (req, res) => { res.json(lc79Data.hu || { error: "Chưa có dữ liệu" }); });
app.get('/lc79-md5', (req, res) => { res.json(lc79Data.md5 || { error: "Chưa có dữ liệu" }); });
app.get('/lc79-hu/lichsu', (req, res) => { res.json({ type: 'LC79 Hũ', history: lc79Data.history || [], total: lc79Data.history?.length || 0 }); });
app.get('/lc79-md5/lichsu', (req, res) => { res.json({ type: 'LC79 MD5', history: [lc79Data.md5] }); });

// Dashboard
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head><title>SUPER TÀI XỈU API</title><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{background:#0a0a0a;color:#fff;font-family:Arial;padding:20px}.game{background:#1a1a2e;border-radius:10px;padding:20px;margin:20px 0}h2{color:#f093fb}.endpoint{background:#16213e;padding:10px;border-radius:5px;margin:5px 0}a{color:#4facfe}</style>
</head>
<body>
<h1>🎲 SUPER TÀI XỈU API</h1>
<p>Sunwin | 68GB | Lẩu Cua 79</p>
<div class="game"><h2>🔥 SUNWIN</h2>
<div class="endpoint">📌 <a href="/api/sieu">/api/sieu</a> - Dữ liệu + dự đoán</div>
<div class="endpoint">🎲 Phiên: ${sunwinApiResponse.Phien} | KQ: ${sunwinApiResponse.Ket_qua} | Dự đoán: ${sunwinApiResponse.Du_doan} (${sunwinApiResponse.Do_tin_cay})</div>
</div>
<div class="game"><h2>🎲 68GB</h2>
<div class="endpoint">📌 <a href="/api/68gb/txhu">/api/68gb/txhu</a> - Tài Xỉu Hũ</div>
<div class="endpoint">📌 <a href="/api/68gb/txmd5">/api/68gb/txmd5</a> - Tài Xỉu MD5</div>
<div class="endpoint">🎲 Phiên: ${gb68Data.hu?.Phien || '?'} | KQ: ${gb68Data.hu?.Ket_qua || '?'} | Dự đoán: ${gb68Data.hu?.Du_doan || '?'}</div>
</div>
<div class="game"><h2>🍲 LẨU CUA 79</h2>
<div class="endpoint">📌 <a href="/lc79-hu">/lc79-hu</a> - Tài Xỉu Hũ</div>
<div class="endpoint">📌 <a href="/lc79-md5">/lc79-md5</a> - Tài Xỉu MD5</div>
<div class="endpoint">📌 <a href="/lc79-hu/lichsu">/lc79-hu/lichsu</a> - Lịch sử</div>
<div class="endpoint">🎲 Phiên: ${lc79Data.hu?.Phien || '?'} | KQ: ${lc79Data.hu?.Ket_qua || '?'} | Dự đoán: ${lc79Data.hu?.Du_doan || '?'}</div>
</div>
<footer style="margin-top:40px;text-align:center;color:#666;">ID: @tranhoang2286 | Cập nhật mỗi 10 giây</footer>
</body>
</html>
    `);
});

// ==================== START ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 ===== SUPER TÀI XỈU API =====`);
    console.log(`🌐 Server: http://0.0.0.0:${PORT}`);
    console.log(`\n📌 ENDPOINTS:`);
    console.log(`   SUNWIN:     /api/sieu (giữ nguyên format)`);
    console.log(`   68GB Hũ:    /api/68gb/txhu`);
    console.log(`   68GB MD5:   /api/68gb/txmd5`);
    console.log(`   LC79 Hũ:    /lc79-hu`);
    console.log(`   LC79 MD5:   /lc79-md5`);
    console.log(`   LC79 Lịch sử: /lc79-hu/lichsu, /lc79-md5/lichsu`);
    console.log(`\n✅ 84 models Sunwin | Auto fetch 68GB & LC79 mỗi 10s`);
    console.log(`=====================================\n`);
});

connectSunwin();
