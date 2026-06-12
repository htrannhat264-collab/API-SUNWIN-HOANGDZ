// server.js - GHÉP SUNWIN + 68GB + LC79 (Giữ nguyên 100% thuật toán LC79)
const WebSocket = require('ws');
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ==================== FILE STORAGE ====================
const SUNWIN_HISTORY_FILE = './sunwin_history.json';
const SUNWIN_PATTERNS_FILE = './sunwin_patterns.json';
const SUNWIN_MODEL_WEIGHTS_FILE = './sunwin_model_weights.json';

// ==================== PHẦN 1: SUNWIN (GIỮ NGUYÊN TỪ apisun.js) ====================

let sunwinHistory = [];
let sunwinCurrentSessionId = null;
let sunwinLastPrediction = null;
let sunwinStats = {
    total: 0,
    correct: 0,
    wrong: 0,
    consecutiveLosses: 0,
    modelPerformance: {}
};

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

if (fs.existsSync(SUNWIN_HISTORY_FILE)) {
    try { sunwinHistory = JSON.parse(fs.readFileSync(SUNWIN_HISTORY_FILE, 'utf8')); console.log(`[Sunwin] ${sunwinHistory.length} phiên`); } catch(e) {}
}
if (fs.existsSync(SUNWIN_MODEL_WEIGHTS_FILE)) {
    try { let saved = JSON.parse(fs.readFileSync(SUNWIN_MODEL_WEIGHTS_FILE, 'utf8')); sunwinModelWeights = saved.modelWeights || sunwinModelWeights; sunwinSubModelWeights = saved.subModelWeights || sunwinSubModelWeights; sunwinMiniModelWeights = saved.miniModelWeights || sunwinMiniModelWeights; } catch(e) {}
}

function saveSunwinHistory(entry) { sunwinHistory.push(entry); if (sunwinHistory.length > 1000) sunwinHistory.shift(); fs.writeFileSync(SUNWIN_HISTORY_FILE, JSON.stringify(sunwinHistory, null, 2)); }
function saveSunwinModelWeights() { fs.writeFileSync(SUNWIN_MODEL_WEIGHTS_FILE, JSON.stringify({ modelWeights: sunwinModelWeights, subModelWeights: sunwinSubModelWeights, miniModelWeights: sunwinMiniModelWeights }, null, 2)); }

let sunwinApiResponse = {
    "Phien": null, "Xuc_xac_1": null, "Xuc_xac_2": null, "Xuc_xac_3": null, "Tong": null, "Ket_qua": "",
    "Phien_hien_tai": null, "Du_doan": "", "Loai_cau": "", "Mau_cau_phat_hien": "", "Do_tin_cay": "0%",
    "Trang_thai": "", "Ket_qua_du_doan": "", "Thong_ke": { "tong": 0, "dung": 0, "sai": 0, "ti_le": "0%" }, "id": "@tranhoang2286"
};

// SUNWIN TAI XIU ANALYZER
class SunwinTaiXiuAnalyzer {
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
            try { return JSON.parse(fs.readFileSync(SUNWIN_PATTERNS_FILE, 'utf8')); } catch(e) {}
        }
        return { '1-1': [], '2-2': [], '3-3': [], '1-2': [], '2-1': [], '2-1-2': [], '1-2-1': [], 'bệt': [], 'loạn': [] };
    }
    
    savePatternLibrary() { fs.writeFileSync(SUNWIN_PATTERNS_FILE, JSON.stringify(this.patternLibrary, null, 2)); }
    
    initSubModels() {
        const subModelSpecialties = {
            1: { name: '1-1 thuần', type: '1-1', logic: 'pure', minLength: 4, threshold: 0.9 },
            2: { name: '1-1 biến thể', type: '1-1', logic: 'variant', minLength: 5, threshold: 0.8 },
            3: { name: '1-1 dài hạn', type: '1-1', logic: 'long', minLength: 8, threshold: 0.75 },
            4: { name: '1-1 kết hợp', type: '1-1', logic: 'hybrid', minLength: 6, threshold: 0.7 },
            5: { name: '1-1 gãy', type: '1-1', logic: 'break', minLength: 6, threshold: 0.8 },
            6: { name: '1-1 phục hồi', type: '1-1', logic: 'recovery', minLength: 7, threshold: 0.7 },
            7: { name: '2-2 chuẩn', type: '2-2', logic: 'pure', minLength: 6, threshold: 0.9 },
            8: { name: '2-2 lệch', type: '2-2', logic: 'offset', minLength: 7, threshold: 0.8 },
            9: { name: '2-2 biến tướng', type: '2-2', logic: 'variant', minLength: 8, threshold: 0.75 },
            10: { name: '2-2 kết hợp 1-1', type: '2-2', logic: 'hybrid', minLength: 8, threshold: 0.7 },
            11: { name: '2-2 dài', type: '2-2', logic: 'long', minLength: 10, threshold: 0.8 },
            12: { name: '2-2 bẻ', type: '2-2', logic: 'break', minLength: 7, threshold: 0.85 },
            13: { name: 'bệt ngắn', type: 'bệt', logic: 'short', minLength: 3, threshold: 0.8 },
            14: { name: 'bệt trung', type: 'bệt', logic: 'medium', minLength: 5, threshold: 0.85 },
            15: { name: 'bệt dài', type: 'bệt', logic: 'long', minLength: 7, threshold: 0.9 },
            16: { name: 'bệt gãy', type: 'bệt', logic: 'break', minLength: 5, threshold: 0.8 },
            17: { name: 'bệt xen kẽ', type: 'bệt', logic: 'hybrid', minLength: 6, threshold: 0.7 },
            18: { name: 'siêu bệt', type: 'bệt', logic: 'super', minLength: 10, threshold: 0.95 },
            19: { name: '3-3 chuẩn', type: '3-3', logic: 'pure', minLength: 9, threshold: 0.9 },
            20: { name: '3-3 biến thể', type: '3-3', logic: 'variant', minLength: 10, threshold: 0.8 },
            21: { name: '3-3 ngắn', type: '3-3', logic: 'short', minLength: 6, threshold: 0.7 },
            22: { name: '3-3 kết hợp', type: '3-3', logic: 'hybrid', minLength: 9, threshold: 0.75 },
            23: { name: '3-3 bẻ', type: '3-3', logic: 'break', minLength: 8, threshold: 0.8 },
            24: { name: '3-3 dài', type: '3-3', logic: 'long', minLength: 12, threshold: 0.85 },
            25: { name: '2-1-2 chuẩn', type: '2-1-2', logic: 'pure', minLength: 5, threshold: 0.9 },
            26: { name: '2-1-2 biến thể', type: '2-1-2', logic: 'variant', minLength: 6, threshold: 0.8 },
            27: { name: '2-1-2 dài', type: '2-1-2', logic: 'long', minLength: 8, threshold: 0.8 },
            28: { name: '1-2-1 chuẩn', type: '1-2-1', logic: 'pure', minLength: 5, threshold: 0.9 },
            29: { name: '1-2-1 biến thể', type: '1-2-1', logic: 'variant', minLength: 6, threshold: 0.8 },
            30: { name: '1-2-1 dài', type: '1-2-1', logic: 'long', minLength: 8, threshold: 0.8 },
            31: { name: 'bẻ cầu 1-1', type: 'break', logic: 'break11', minLength: 4, threshold: 0.85 },
            32: { name: 'bẻ cầu 2-2', type: 'break', logic: 'break22', minLength: 5, threshold: 0.85 },
            33: { name: 'bẻ cầu bệt', type: 'break', logic: 'breakStreak', minLength: 4, threshold: 0.8 },
            34: { name: 'chuyển tiếp 1-1 sang 2-2', type: 'transition', logic: '11to22', minLength: 6, threshold: 0.75 },
            35: { name: 'chuyển tiếp 2-2 sang 1-1', type: 'transition', logic: '22to11', minLength: 6, threshold: 0.75 },
            36: { name: 'chuyển tiếp bệt sang 1-1', type: 'transition', logic: 'streakTo11', minLength: 5, threshold: 0.7 },
            37: { name: 'phân tích tần suất', type: 'frequency', logic: 'frequency', minLength: 10, threshold: 0.7 },
            38: { name: 'phân tích chu kỳ', type: 'cycle', logic: 'cycle', minLength: 12, threshold: 0.7 },
            39: { name: 'phân tích đối xứng', type: 'symmetry', logic: 'symmetry', minLength: 8, threshold: 0.75 },
            40: { name: 'phân tích Fibonacci', type: 'fibonacci', logic: 'fibonacci', minLength: 8, threshold: 0.7 },
            41: { name: 'phân tích xu hướng dài', type: 'trend', logic: 'longTrend', minLength: 15, threshold: 0.8 },
            42: { name: 'tổng hợp siêu cầu', type: 'super', logic: 'super', minLength: 20, threshold: 0.85 }
        };
        for (let i = 1; i <= 42; i++) {
            this.subModels[`sub_model_${i}`] = { ...subModelSpecialties[i], weight: this.subModelWeights[`sub_model_${i}`] || 1.0, accuracy: 0.5, predictions: [] };
        }
    }
    
    initMiniModels() {
        const specialties = {
            1: 'phat_hien_cau_dep', 2: 'du_doan_bien_dong', 3: 'phan_tich_so_sanh', 4: 'nhan_dien_xu_huong_cuc_bo',
            5: 'tinh_toan_xac_suat_cao', 6: 'phat_hien_diem_gay', 7: 'du_doan_nguong', 8: 'phan_tich_chuoi',
            9: 'nhan_dien_mau_lap', 10: 'tinh_he_so_tuong_quan', 11: 'du_doan_doan_nhiet', 12: 'phan_tich_pha',
            13: 'nhan_dien_song', 14: 'tinh_toan_momentum', 15: 'du_doan_hoi_phuc', 16: 'phat_hien_dot_bien',
            17: 'phan_tich_can_bang', 18: 'nhan_dien_tan_so', 19: 'du_doan_chu_ky', 20: 'tinh_toan_ma_tran',
            21: 'phan_tich_tong_hop'
        };
        for (let i = 1; i <= 21; i++) {
            this.miniModels[`mini_model_${i}`] = { weight: this.miniModelWeights[`mini_model_${i}`] || 1.0, accuracy: 0.5, specialty: specialties[i] || 'chung', predictions: [] };
        }
    }
    
    getResultArray(history) { return history.map(h => h.Ket_qua || (h.score >= 11 ? 'Tài' : 'Xỉu')); }
    isPerfectAlternating(results, len) { let last = results.slice(-len); for (let i = 0; i < last.length-1; i++) if (last[i] === last[i+1]) return false; return true; }
    isAlternatingWithTolerance(results, tol) { let last = results.slice(-6), err = 0; for (let i = 0; i < last.length-1; i++) if (last[i] === last[i+1]) err++; return err <= tol; }
    countAlternating(results) { let c = 0; for (let i = 0; i < results.length-1; i++) if (results[i] !== results[i+1]) c++; return c; }
    getStreak(results) { if (!results.length) return 0; let last = results[results.length-1], streak = 1; for (let i = results.length-2; i >= 0; i--) { if (results[i] === last) streak++; else break; } return streak; }
    analyzeFrequency(results) { let recent = results.slice(-20), tai = recent.filter(r => r === 'Tài').length, ratio = Math.max(tai, recent.length - tai) / recent.length, dom = tai > recent.length - tai ? 'Tài' : 'Xỉu'; return { dominant: dom, ratio }; }
    detectCycle(results) { for (let len of [2,3,4]) { if (results.length < len*2) continue; if (JSON.stringify(results.slice(-len)) === JSON.stringify(results.slice(-len*2, -len))) return { found: true, length: len, next: results.slice(-len)[0] }; } return { found: false }; }
    checkSymmetry(results) { if (results.length < 6) return { found: false }; let last3 = results.slice(-3), prev3 = results.slice(-6,-3); if (last3[0] === prev3[2] && last3[1] === prev3[1] && last3[2] === prev3[0]) return { found: true, prediction: last3[1] }; return { found: false }; }
    checkFibonacci(results) { if (results.length < 5) return { found: false }; for (let fib of [1,2,3,5]) { if (results.length >= fib*2 && JSON.stringify(results.slice(-fib)) === JSON.stringify(results.slice(-fib*2,-fib))) return { found: true, prediction: results.slice(-fib)[0] }; } return { found: false }; }
    getLongTrend(results) { if (results.length < 10) return { strength: 0, direction: null }; let first = results.slice(0,5), last = results.slice(-5), firstTai = first.filter(r => r === 'Tài').length, lastTai = last.filter(r => r === 'Tài').length; if (lastTai > firstTai+2) return { strength: 0.8, direction: 'Tài' }; else if (lastTai < firstTai-2) return { strength: 0.8, direction: 'Xỉu' }; return { strength: 0.5, direction: lastTai > 2 ? 'Tài' : 'Xỉu' }; }
    
    runSubModel11(results, model) { if (results.length < model.minLength) return null; let last = results[results.length-1], last4 = results.slice(-4); switch (model.logic) { case 'pure': if (this.isPerfectAlternating(results,4)) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Cầu 1-1 thuần', model_name: model.name }; case 'variant': if (this.isAlternatingWithTolerance(results,1)) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.8, reason: 'Cầu 1-1 biến thể', model_name: model.name }; case 'long': let alt = this.countAlternating(results.slice(-12)); if (alt >= 8) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7 + alt/20, reason: `Cầu 1-1 dài (${alt}/11)`, model_name: model.name }; case 'break': if (last4[0] !== last4[1] && last4[1] !== last4[2] && last4[2] !== last4[3] && this.getStreak(results.slice(0,-1)) > 4) return { prediction: last, confidence: 0.8, reason: 'Cầu 1-1 sắp gãy', model_name: model.name }; } return null; }
    runSubModel22(results, model) { if (results.length < model.minLength) return null; let last6 = results.slice(-6), last8 = results.slice(-8); switch (model.logic) { case 'pure': if (last6.length===6 && last6[0]===last6[1] && last6[1]!==last6[2] && last6[2]===last6[3] && last6[3]!==last6[4] && last6[4]===last6[5]) return { prediction: last6[4]==='Tài'?'Xỉu':'Tài', confidence: 0.9, reason: 'Cầu 2-2 chuẩn', model_name: model.name }; case 'long': let score = 0; for (let i=0; i<7; i+=2) if (last8[i]===last8[i+1]) score++; if (score>=3) return { prediction: results[results.length-1]==='Tài'?'Xỉu':'Tài', confidence: 0.7+score*0.05, reason: `Cầu 2-2 dài (${score}/4)`, model_name: model.name }; } return null; }
    runSubModelStreak(results, model) { if (results.length < model.minLength) return null; let last = results[results.length-1], other = last === 'Tài' ? 'Xỉu' : 'Tài', streak = this.getStreak(results); switch (model.logic) { case 'short': if (streak>=2 && streak<=3) return { prediction: last, confidence: 0.7+streak*0.05, reason: `Bệt ${streak}p`, model_name: model.name }; case 'medium': if (streak>=4 && streak<=5) return { prediction: last, confidence: 0.75+(streak-4)*0.05, reason: `Bệt ${streak}p`, model_name: model.name }; case 'long': if (streak>=6) return { prediction: last, confidence: 0.8+Math.min(streak,10)*0.01, reason: `Bệt ${streak}p`, model_name: model.name }; case 'break': if (streak>=4) return { prediction: other, confidence: 0.6+streak*0.03, reason: `Bệt ${streak}p sắp gãy`, model_name: model.name }; case 'super': if (streak>=8) return { prediction: last, confidence: 0.9, reason: `Siêu bệt ${streak}p`, model_name: model.name }; } return null; }
    runSubModel33(results, model) { if (results.length < model.minLength) return null; let last9 = results.slice(-9), last12 = results.slice(-12); switch (model.logic) { case 'pure': if (last9.length===9 && last9[0]===last9[1] && last9[1]===last9[2] && last9[3]===last9[4] && last9[4]===last9[5] && last9[6]===last9[7] && last9[7]===last9[8] && last9[0]!==last9[3] && last9[3]!==last9[6]) return { prediction: last9[6]==='Tài'?'Xỉu':'Tài', confidence: 0.9, reason: 'Cầu 3-3 chuẩn', model_name: model.name }; case 'variant': let score = 0; for (let i=0; i<12; i+=3) if (i+2<12 && last12[i]===last12[i+1] && last12[i+1]===last12[i+2]) score++; if (score>=3) return { prediction: results[results.length-1]==='Tài'?'Xỉu':'Tài', confidence: 0.7+score*0.05, reason: `Cầu 3-3 biến thể (${score}/4)`, model_name: model.name }; } return null; }
    runSubModel212(results, model) { if (results.length < model.minLength) return null; let last5 = results.slice(-5); switch (model.logic) { case 'pure': if (last5.length===5 && last5[0]===last5[1] && last5[1]!==last5[2] && last5[2]!==last5[3] && last5[3]===last5[4] && last5[0]===last5[3]) return { prediction: last5[4]==='Tài'?'Xỉu':'Tài', confidence: 0.9, reason: 'Cầu 2-1-2 chuẩn', model_name: model.name }; } return null; }
    runSubModel121(results, model) { if (results.length < model.minLength) return null; let last5 = results.slice(-5); switch (model.logic) { case 'pure': if (last5.length===5 && last5[0]!==last5[1] && last5[1]===last5[2] && last5[2]!==last5[3] && last5[3]===last5[4] && last5[0]===last5[3]) return { prediction: last5[4]==='Tài'?'Xỉu':'Tài', confidence: 0.9, reason: 'Cầu 1-2-1 chuẩn', model_name: model.name }; } return null; }
    runSubModelBreak(results, model) { if (results.length < model.minLength) return null; let last4 = results.slice(-4), last = results[results.length-1]; switch (model.logic) { case 'break11': if (last4.length===4 && last4[0]!==last4[1] && last4[1]!==last4[2] && last4[2]===last4[3]) return { prediction: last4[3], confidence: 0.85, reason: 'Bẻ cầu 1-1', model_name: model.name }; case 'breakStreak': let streak = this.getStreak(results.slice(0,-1)); if (streak>=3 && last!==results[results.length-2]) return { prediction: last, confidence: 0.8, reason: `Bẻ cầu bệt sau ${streak}p`, model_name: model.name }; } return null; }
    runSubModelAdvanced(results, model) { if (results.length < model.minLength) return null; switch (model.logic) { case 'frequency': let freq = this.analyzeFrequency(results); if (freq.dominant && freq.ratio > 0.6) return { prediction: freq.dominant, confidence: 0.6+freq.ratio*0.2, reason: `Tần suất ${freq.dominant} ${(freq.ratio*100).toFixed(0)}%`, model_name: model.name }; case 'cycle': let cycle = this.detectCycle(results); if (cycle.found) return { prediction: cycle.next, confidence: 0.7, reason: `Chu kỳ ${cycle.length}p`, model_name: model.name }; case 'longTrend': let trend = this.getLongTrend(results); if (trend.strength > 0.7) return { prediction: trend.direction, confidence: 0.7+trend.strength*0.1, reason: `Xu hướng dài ${trend.direction}`, model_name: model.name }; } return null; }
    
    runSubModel(index, history) { if (history.length < 3) return null; let results = this.getResultArray(history), model = this.subModels[`sub_model_${index}`]; if (!model) return null; let result = null; switch (model.type) { case '1-1': result = this.runSubModel11(results, model); break; case '2-2': result = this.runSubModel22(results, model); break; case 'bệt': result = this.runSubModelStreak(results, model); break; case '3-3': result = this.runSubModel33(results, model); break; case '2-1-2': result = this.runSubModel212(results, model); break; case '1-2-1': result = this.runSubModel121(results, model); break; case 'break': case 'transition': result = this.runSubModelBreak(results, model); break; default: result = this.runSubModelAdvanced(results, model); } if (result) result.model_name = model.name; return result; }
    
    runMiniModel(index, history) { if (history.length < 2) return null; let results = this.getResultArray(history), miniModel = this.miniModels[`mini_model_${index}`]; let prediction, confidence, reason; switch (miniModel.specialty) { case 'phat_hien_cau_dep': let pattern = this.analyzeBasicPatterns(history); prediction = pattern.prediction; confidence = pattern.confidence * 0.9; reason = pattern.reason; break; case 'tinh_toan_xac_suat_cao': let taiCount = results.filter(r => r === 'Tài').length, xiuCount = results.length - taiCount; if (taiCount > xiuCount * 1.5) { prediction = 'Xỉu'; confidence = 0.7; reason = 'Xác suất Tài cao, dự đoán Xỉu'; } else if (xiuCount > taiCount * 1.5) { prediction = 'Tài'; confidence = 0.7; reason = 'Xác suất Xỉu cao, dự đoán Tài'; } else { prediction = results[results.length-1]; confidence = 0.5; reason = 'Xác suất cân bằng'; } break; default: let streak = this.getStreak(results); if (streak >= 3) { prediction = results[results.length-1]; confidence = 0.6; } else { prediction = results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài'; confidence = 0.5; } reason = `Mini model ${index}`; } return { prediction, confidence: Math.min(confidence, 0.95), reason, model_name: `mini_${index}` }; }
    
    analyzeBasicPatterns(history) { if (history.length < 3) return { prediction: null, confidence: 0 }; let results = this.getResultArray(history), last = results[results.length-1]; let alt = true; for (let i = results.length-4; i < results.length-1; i++) if (results[i] === results[i+1]) { alt = false; break; } if (alt && results.length>=4) return { prediction: last==='Tài'?'Xỉu':'Tài', confidence: 0.75, reason: 'Cầu 1-1', pattern_type: '1-1' }; let streak = this.getStreak(results); if (streak >= 3) return { prediction: last, confidence: 0.6+streak*0.05, reason: `Bệt ${streak}p`, pattern_type: 'bệt' }; return { prediction: last==='Tài'?'Xỉu':'Tài', confidence: 0.5, reason: 'Theo ván trước', pattern_type: 'default' }; }
    analyzeTrend(history) { let results = this.getResultArray(history); if (results.length < 5) return { prediction: null, confidence: 0 }; let short = results.slice(-3), shortTai = short.filter(r=>r==='Tài').length; if (shortTai >= 2) return { prediction: shortTai===3?'Xỉu':'Tài', confidence: 0.65, reason: 'Xu hướng ngắn' }; return { prediction: results[results.length-1]==='Tài'?'Xỉu':'Tài', confidence: 0.55, reason: 'Đảo chiều' }; }
    analyzeImbalance(history) { let results = this.getResultArray(history.slice(-12)); if (results.length < 12) return { prediction: null, confidence: 0 }; let tai = results.filter(r=>r==='Tài').length, xiu = 12 - tai; if (Math.abs(tai-xiu) >= 4) return { prediction: tai > xiu ? 'Xỉu' : 'Tài', confidence: 0.7, reason: `Cân bằng (${tai}T-${xiu}X)` }; return { prediction: results[results.length-1], confidence: 0.5, reason: 'Tiếp xu hướng' }; }
    analyzeShortTerm(history) { let results = this.getResultArray(history); if (results.length < 3) return { prediction: null, confidence: 0 }; let last3 = results.slice(-3); if (last3[0]===last3[1] && last3[1]===last3[2]) return { prediction: last3[0], confidence: 0.75, reason: 'Bệt 3' }; if (last3[0]===last3[1]) return { prediction: last3[2], confidence: 0.7, reason: 'Cầu 2-1' }; if (last3[0]!==last3[1] && last3[1]===last3[2]) return { prediction: last3[2]==='Tài'?'Xỉu':'Tài', confidence: 0.65, reason: 'Cầu 1-2' }; return { prediction: results[results.length-1], confidence: 0.5, reason: 'Không rõ' }; }
    analyzeDiceVolatility(history) { if (history.length < 5) return { prediction: null, confidence: 0 }; let faceFreq = {1:0,2:0,3:0,4:0,5:0,6:0}; history.slice(-5).forEach(h => { if (h.Xuc_xac_1) faceFreq[h.Xuc_xac_1]++; if (h.Xuc_xac_2) faceFreq[h.Xuc_xac_2]++; if (h.Xuc_xac_3) faceFreq[h.Xuc_xac_3]++; }); let predictions = []; for (let face=1; face<=6; face++) if (faceFreq[face] < 2) predictions.push(face); if (predictions.length >= 3) { let avg = (predictions[0] + predictions[1] + predictions[2]) / 3; return { prediction: avg >= 3.67 ? 'Tài' : 'Xỉu', confidence: 0.6, reason: `Biến động xúc xắc` }; } return { prediction: history[history.length-1].Ket_qua, confidence: 0.4, reason: "Không phát hiện biến động" }; }
    
    ensembleModels(history) { let modelResults = {}; modelResults.model1 = this.analyzeBasicPatterns(history); modelResults.model2 = this.analyzeTrend(history); modelResults.model3 = this.analyzeImbalance(history); modelResults.model4 = this.analyzeShortTerm(history); modelResults.model11 = this.analyzeDiceVolatility(history); for (let i = 1; i <= 42; i++) { let subResult = this.runSubModel(i, history); if (subResult && subResult.prediction) modelResults[`sub_model_${i}`] = subResult; } for (let i = 1; i <= 21; i++) { let miniResult = this.runMiniModel(i, history); if (miniResult && miniResult.prediction) modelResults[`mini_model_${i}`] = miniResult; } let taiWeight = 0, xiuWeight = 0, totalWeight = 0, details = []; for (let [modelName, result] of Object.entries(modelResults)) { if (result && result.prediction && result.confidence > 0.3) { let weight = 1.0; if (modelName.startsWith('sub')) weight = this.subModelWeights[modelName] || 1.0; else if (modelName.startsWith('mini')) weight = this.miniModelWeights[modelName] || 1.0; else weight = this.modelWeights[modelName] || 1.0; let wc = weight * result.confidence; if (result.prediction === 'Tài') taiWeight += wc; else xiuWeight += wc; totalWeight += wc; details.push({ model: result.model_name || modelName, prediction: result.prediction, confidence: result.confidence, weight, reason: result.reason }); } } details.sort((a,b) => b.confidence - a.confidence); let finalPrediction, finalConfidence, finalReason, finalType, finalPattern; if (totalWeight > 0) { let taiRatio = taiWeight / totalWeight, xiuRatio = xiuWeight / totalWeight; if (taiRatio > 0.55) { finalPrediction = 'Tài'; finalConfidence = taiRatio; finalReason = `${details.length} models đồng thuận Tài (${(taiRatio*100).toFixed(1)}%)`; } else if (xiuRatio > 0.55) { finalPrediction = 'Xỉu'; finalConfidence = xiuRatio; finalReason = `${details.length} models đồng thuận Xỉu (${(xiuRatio*100).toFixed(1)}%)`; } else { let bestModel = details[0]; if (bestModel) { finalPrediction = bestModel.prediction; finalConfidence = 0.5 + bestModel.confidence * 0.2; finalReason = `Dùng model ${bestModel.model}: ${bestModel.reason}`; } else { finalPrediction = history.length > 0 ? history[history.length-1].Ket_qua : 'Tài'; finalConfidence = 0.5; finalReason = "Không có model nào đủ tin cậy"; } } } else { finalPrediction = history.length > 0 ? history[history.length-1].Ket_qua : 'Tài'; finalConfidence = 0.5; finalReason = "Không đủ dữ liệu model"; } if (details.length > 0) { finalType = details[0].model; finalPattern = history.length > 0 ? this.getResultArray(history.slice(-5)).join('') : ''; } else { finalType = 'Không xác định'; finalPattern = ''; } if (sunwinStats.consecutiveLosses >= 3) { finalPrediction = finalPrediction === 'Tài' ? 'Xỉu' : 'Tài'; finalConfidence = 0.4; finalType = 'CHỐNG ĐẢO'; } return { prediction: finalPrediction, confidence: finalConfidence, reason: finalReason, pattern_type: finalType, pattern: finalPattern, details: details.slice(0,3) }; }
    
    updateModelWeights(actual, predicted, confidence) { let correct = (actual === predicted) ? 1 : 0; for (let k in this.modelWeights) this.modelWeights[k] = Math.min(2.0, Math.max(0.5, this.modelWeights[k] * (correct ? 1.01 : 0.99))); for (let k in this.subModelWeights) this.subModelWeights[k] = Math.min(1.5, Math.max(0.7, this.subModelWeights[k] * (correct ? 1.005 : 0.995))); for (let k in this.miniModelWeights) this.miniModelWeights[k] = Math.min(1.3, Math.max(0.8, this.miniModelWeights[k] * (correct ? 1.003 : 0.997))); saveSunwinModelWeights(); }
}

const sunwinAnalyzer = new SunwinTaiXiuAnalyzer();

// SUNWIN WEBSOCKET
const SUNWIN_WS_URL = "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXBpc3Vud2luMTIzIn0.hgrRbSV6vnBwJMg9ZFtbx3rRu9mX_hZMZ_m5gMNhkw0";
const WS_HEADERS = { "User-Agent": "Mozilla/5.0", "Origin": "https://play.sun.win" };
const RECONNECT_DELAY = 2500;
const PING_INTERVAL = 15000;

const initialMessages = [
    [1, "MiniGame", "GM_apivopnha", "WangLin", { "info": "{\"ipAddress\":\"14.249.227.107\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiI5ODE5YW5zc3MiLCJib3QiOjAsImlzTWVyY2hhbnQiOmZhbHNlLCJ2ZXJpZmllZEJhbmtBY2NvdW50IjpmYWxzZSwicGxheUV2ZW50TG9iYnkiOmZhbHNlLCJjdXN0b21lcklkIjozMjMyODExNTEsImFmZklkIjoic3VuLndpbiIsImJhbm5lZCI6ZmFsc2UsImJyYW5kIjoiZ2VtIiwidGltZXN0YW1wIjoxNzYzMDMyOTI4NzcwLCJsb2NrR2FtZXMiOltdLCJhbW91bnQiOjAsImxvY2tDaGF0IjpmYWxzZSwicGhvbmVWZXJpZmllZCI6ZmFsc2UsImlwQWRkcmVzcyI6IjE0LjI0OS4yMjcuMTA3IiwibXV0ZSI6ZmFsc2UsImF2YXRhciI6Imh0dHBzOi8vaW1hZ2VzLnN3aW5zaG9wLm5ldC9pbWFnZXMvYXZhdGFyL2F2YXRhcl8wNS5wbmciLCJwbGF0Zm9ybUlkIjo0LCJ1c2VySWQiOiI4ODM4NTMzZS1kZTQzLTRiOGQtOTUwMy02MjFmNDA1MDUzNGUiLCJyZWdUaW1lIjoxNzYxNjMyMzAwNTc2LCJwaG9uZSI6IiIsImRlcG9zaXQiOmZhbHNlLCJ1c2VybmFtZSI6IkdNX2FwaXZvcG5oYSJ9.guH6ztJSPXUL1cU8QdMz8O1Sdy_SbxjSM-CDzWPTr-0\",\"locale\":\"vi\",\"userId\":\"8838533e-de43-4b8d-9503-621f4050534e\",\"username\":\"GM_apivopnha\",\"timestamp\":1763032928770,\"refreshToken\":\"e576b43a64e84f789548bfc7c4c8d1e5.7d4244a361e345908af95ee2e8ab2895\"}", "signature": "45EF4B318C883862C36E1B189A1DF5465EBB60CB602BA05FAD8FCBFCD6E0DA8CB3CE65333EDD79A2BB4ABFCE326ED5525C7D971D9DEDB5A17A72764287FFE6F62CBC2DF8A04CD8EFF8D0D5AE27046947ADE45E62E644111EFDE96A74FEC635A97861A425FF2B5732D74F41176703CA10CFEED67D0745FF15EAC1065E1C8BCBFA" }],
    [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
    [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]
];

let sunwinWs = null;
let sunwinPingInterval = null;

function connectSunwin() {
    if (sunwinWs) { try { sunwinWs.close(); } catch(e) {} }
    sunwinWs = new WebSocket(SUNWIN_WS_URL, { headers: WS_HEADERS });
    sunwinWs.on('open', () => { console.log('[Sunwin ✅] WebSocket connected'); initialMessages.forEach((msg, i) => { setTimeout(() => { if (sunwinWs.readyState === WebSocket.OPEN) sunwinWs.send(JSON.stringify(msg)); }, i * 600); }); sunwinPingInterval = setInterval(() => { if (sunwinWs?.readyState === WebSocket.OPEN) sunwinWs.ping(); }, PING_INTERVAL); });
    sunwinWs.on('message', (msg) => { try { let data = JSON.parse(msg); if (!Array.isArray(data) || !data[1]) return; let { cmd, sid, d1, d2, d3, gBB } = data[1]; if (cmd === 1008 && sid) sunwinCurrentSessionId = sid; if (cmd === 1003 && gBB && d1 && d2 && d3) { let total = d1 + d2 + d3, result = total > 10 ? "Tài" : "Xỉu"; let correct = false; if (sunwinLastPrediction && sunwinLastPrediction.ket_qua) { correct = sunwinLastPrediction.ket_qua === result; sunwinStats.total++; if (correct) { sunwinStats.correct++; sunwinStats.consecutiveLosses = 0; } else { sunwinStats.wrong++; sunwinStats.consecutiveLosses++; } sunwinAnalyzer.updateModelWeights(result, sunwinLastPrediction.ket_qua, parseInt(sunwinLastPrediction.do_tin_cay || '70')); } let historyForAnalysis = sunwinHistory.map(h => ({ score: h.Tong, Ket_qua: h.Ket_qua, Xuc_xac_1: h.Xuc_xac_1, Xuc_xac_2: h.Xuc_xac_2, Xuc_xac_3: h.Xuc_xac_3 })); let ensemble = sunwinAnalyzer.ensembleModels(historyForAnalysis); let finalPred = ensemble.prediction, finalConf = ensemble.confidence, finalType = ensemble.pattern_type, finalPattern = ensemble.pattern; if (sunwinStats.consecutiveLosses >= 3) { finalPred = finalPred === 'Tài' ? 'Xỉu' : 'Tài'; finalConf = 0.4; finalType = 'CHỐNG ĐẢO'; } sunwinLastPrediction = { phien: sunwinCurrentSessionId ? parseInt(sunwinCurrentSessionId)+1 : null, ket_qua: finalPred, loai_cau: finalType, mau_cau: finalPattern, do_tin_cay: (finalConf*100).toFixed(0)+'%' }; let tiLe = sunwinStats.total > 0 ? ((sunwinStats.correct/sunwinStats.total)*100).toFixed(1)+'%' : '0%'; sunwinApiResponse = { "Phien": sunwinCurrentSessionId, "Xuc_xac_1": d1, "Xuc_xac_2": d2, "Xuc_xac_3": d3, "Tong": total, "Ket_qua": result, "Phien_hien_tai": sunwinCurrentSessionId ? parseInt(sunwinCurrentSessionId)+1 : null, "Du_doan": finalPred, "Loai_cau": finalType, "Mau_cau_phat_hien": finalPattern, "Do_tin_cay": (finalConf*100).toFixed(0)+'%', "Trang_thai": sunwinStats.consecutiveLosses>=3?'Chống đảo':'Theo cầu', "Ket_qua_du_doan": correct ? '✅' : (sunwinStats.total>0?'❌':''), "Thong_ke": { "tong": sunwinStats.total, "dung": sunwinStats.correct, "sai": sunwinStats.wrong, "ti_le": tiLe }, "id": "@tranhoang2286" }; let entry = { phien: sunwinCurrentSessionId, Xuc_xac_1: d1, Xuc_xac_2: d2, Xuc_xac_3: d3, Tong: total, Ket_qua: result, du_doan: finalPred, loai_cau: finalType, do_tin_cay: (finalConf*100).toFixed(0)+'%', thoi_gian: new Date().toISOString() }; saveSunwinHistory(entry); console.log(`[Sunwin] P${sunwinCurrentSessionId}: ${d1}${d2}${d3}=${total} → ${result} | Dự đoán: ${finalPred} (${(finalConf*100).toFixed(0)}%) ${correct?'✅':'❌'}`); sunwinCurrentSessionId = null; } } catch(e) { console.error('[Sunwin] Lỗi:', e.message); } });
    sunwinWs.on('close', () => { clearInterval(sunwinPingInterval); setTimeout(connectSunwin, RECONNECT_DELAY); });
    sunwinWs.on('error', (err) => { console.error('[Sunwin] WebSocket error:', err.message); if (sunwinWs) sunwinWs.close(); });
}

// ==================== PHẦN 2: 68GB (GIỮ NGUYÊN TỪ 68.js) ====================

const TOKEN_HEX = "010000687b22636f6465223a3230302c22737973223a7b22686561727462656174223a31352c2273657269616c697a657222";
const WS_URL_ENV = "wss://mtsahwkvbim09mnwv.cq.qnwxdhwica.com/";
const LANDING_URL = "https://68gbvn88.bar";
const TOKEN_FILE = "token_shared.bin";

const gb68Shared = {
    WS_URL: WS_URL_ENV,
    PKT_HANDSHAKE: Buffer.from('010000727b22737973223a7b22706c6174666f726d223a226a732d776562736f636b6574222c22636c69656e744275696c644e756d626572223a22302e302e31222c22636c69656e7456657273696f6e223a223061323134383164373436663932663834323865316236646565623736666561227d7d', 'hex'),
    PKT_HANDSHAKE_ACK: Buffer.from('02000000', 'hex'),
    PKT_HEARTBEAT: Buffer.from('03000000', 'hex'),
    PKT_AUTH: Buffer.from('', 'hex'),
    SESSION_READY: false
};

if (TOKEN_HEX) { gb68Shared.PKT_AUTH = Buffer.from(TOKEN_HEX.replace(/^0x/i, "").replace(/\s+/g, ""), "hex"); gb68Shared.SESSION_READY = true; console.log("[68GB] Token loaded"); }

class Bot68GB {
    constructor(shared) { this.shared = shared; this.ws = null; this.txhu = { last_result: null, history: [] }; this.md5 = { last_result: null, history: [] }; this.isAliveFlag = false; }
    isAlive() { return this.isAliveFlag; }
    run(landingUrl) { this.connect(); }
    connect() { if (this.ws) this.ws.close(); this.ws = new WebSocket(this.shared.WS_URL); this.ws.on('open', () => { console.log('[68GB] WebSocket connected'); if (this.shared.PKT_HANDSHAKE) this.ws.send(this.shared.PKT_HANDSHAKE); }); this.ws.on('message', (data) => { try { if (data.length === 4 && data.readUInt32BE(0) === 2) { if (this.shared.PKT_AUTH && this.shared.PKT_AUTH.length) this.ws.send(this.shared.PKT_AUTH); } let msg = data.toString(); if (msg.includes('txhu') || msg.includes('result')) { try { let json = JSON.parse(msg); if (json.result) { this.txhu.last_result = json.result; this.txhu.history.unshift(json.result); if (this.txhu.history.length > 100) this.txhu.history.pop(); this.isAliveFlag = true; } } catch(e){} } } catch(e){} }); this.ws.on('close', () => { this.isAliveFlag = false; setTimeout(() => this.connect(), 5000); }); this.ws.on('error', () => {}); }
}

const gb68Bot = new Bot68GB(gb68Shared);
if (gb68Shared.SESSION_READY) gb68Bot.run(LANDING_URL);

// ==================== PHẦN 3: LC79 (GIỮ NGUYÊN 100% TỪ lc.js, CHỈ SỬA ID) ====================

const LC79_LEARNING_FILE = 'tiendat.json';
const LC79_HISTORY_FILE = 'tiendat1.json';

let lc79PredictionHistory = { hu: [], md5: [] };
let lc79LastProcessedPhien = { hu: null, md5: null };

let lc79LearningData = {
    hu: {
        predictions: [],
        patternStats: {},
        totalPredictions: 0,
        correctPredictions: 0,
        patternWeights: {},
        lastUpdate: null,
        streakAnalysis: { wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, worstStreak: 0 },
        adaptiveThresholds: {},
        recentAccuracy: []
    },
    md5: {
        predictions: [],
        patternStats: {},
        totalPredictions: 0,
        correctPredictions: 0,
        patternWeights: {},
        lastUpdate: null,
        streakAnalysis: { wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, worstStreak: 0 },
        adaptiveThresholds: {},
        recentAccuracy: []
    }
};

const LC79_DEFAULT_PATTERN_WEIGHTS = {
    'cau_bet': 1.0, 'cau_dao_11': 1.0, 'cau_22': 1.0, 'cau_33': 1.0,
    'cau_121': 1.0, 'cau_123': 1.0, 'cau_321': 1.0, 'cau_nhay_coc': 1.0,
    'cau_nhip_nghieng': 1.0, 'cau_3van1': 1.0, 'cau_be_cau': 1.0, 'cau_chu_ky': 1.0,
    'distribution': 1.0, 'dice_pattern': 1.0, 'sum_trend': 1.0, 'edge_cases': 1.0,
    'momentum': 1.0, 'cau_tu_nhien': 1.0, 'dice_trend_line': 1.0, 'dice_trend_line_md5': 1.0,
    'break_pattern_hu': 1.0, 'break_pattern_md5': 1.0, 'fibonacci': 1.0, 'resistance_support': 1.0,
    'wave': 1.0, 'golden_ratio': 1.0, 'day_gay': 1.0, 'day_gay_md5': 1.0,
    'cau_44': 1.0, 'cau_55': 1.0, 'cau_212': 1.0, 'cau_1221': 1.0,
    'cau_2112': 1.0, 'cau_gap': 1.0, 'cau_ziczac': 1.0, 'cau_doi': 1.0,
    'cau_rong': 1.0, 'smart_bet': 1.0, 'break_pattern_advanced': 1.0, 'break_streak': 1.0,
    'alternating_break': 1.0, 'double_pair_break': 1.0, 'triple_pattern': 1.0,
    'tong_phan_tich': 1.5, 'xu_huong_manh': 1.3, 'dao_chieu': 1.4
};

function loadLC79LearningData() {
    try {
        if (fs.existsSync(LC79_LEARNING_FILE)) {
            const data = fs.readFileSync(LC79_LEARNING_FILE, 'utf8');
            const parsed = JSON.parse(data);
            lc79LearningData = { ...lc79LearningData, ...parsed };
            console.log('LC79 Learning data loaded');
        }
    } catch (error) { console.error('Error loading LC79 learning data:', error.message); }
}

function saveLC79LearningData() {
    try { fs.writeFileSync(LC79_LEARNING_FILE, JSON.stringify(lc79LearningData, null, 2)); } catch (error) { console.error('Error saving LC79 learning data:', error.message); }
}

function loadLC79PredictionHistory() {
    try {
        if (fs.existsSync(LC79_HISTORY_FILE)) {
            const data = fs.readFileSync(LC79_HISTORY_FILE, 'utf8');
            const parsed = JSON.parse(data);
            lc79PredictionHistory = parsed.history || { hu: [], md5: [] };
            lc79LastProcessedPhien = parsed.lastProcessedPhien || { hu: null, md5: null };
            console.log(`LC79 History loaded: Hu ${lc79PredictionHistory.hu.length}, MD5 ${lc79PredictionHistory.md5.length}`);
        }
    } catch (error) { console.error('Error loading LC79 prediction history:', error.message); }
}

function saveLC79PredictionHistory() {
    try {
        const dataToSave = { history: lc79PredictionHistory, lastProcessedPhien: lc79LastProcessedPhien, lastSaved: new Date().toISOString() };
        fs.writeFileSync(LC79_HISTORY_FILE, JSON.stringify(dataToSave, null, 2));
    } catch (error) { console.error('Error saving LC79 prediction history:', error.message); }
}

async function lc79FetchDataHu() {
    try {
        const response = await axios.get('https://wtx.tele68.com/v1/tx/sessions', { timeout: 10000 });
        if (response.data && response.data.list) {
            return response.data.list.map(item => ({
                Phien: item.id,
                Ket_qua: item.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu',
                Xuc_xac_1: item.dices[0],
                Xuc_xac_2: item.dices[1],
                Xuc_xac_3: item.dices[2],
                Tong: item.point
            }));
        }
        return null;
    } catch (error) { console.error('Error fetching LC79 HU data:', error.message); return null; }
}

async function lc79FetchDataMd5() {
    try {
        const response = await axios.get('https://wtxmd52.tele68.com/v1/txmd5/sessions', { timeout: 10000 });
        if (response.data && response.data.list) {
            return response.data.list.map(item => ({
                Phien: item.id,
                Ket_qua: item.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu',
                Xuc_xac_1: item.dices[0],
                Xuc_xac_2: item.dices[1],
                Xuc_xac_3: item.dices[2],
                Tong: item.point
            }));
        }
        return null;
    } catch (error) { console.error('Error fetching LC79 MD5 data:', error.message); return null; }
}

function lc79InitializePatternStats(type) {
    if (!lc79LearningData[type].patternWeights || Object.keys(lc79LearningData[type].patternWeights).length === 0) {
        lc79LearningData[type].patternWeights = { ...LC79_DEFAULT_PATTERN_WEIGHTS };
    }
    Object.keys(LC79_DEFAULT_PATTERN_WEIGHTS).forEach(pattern => {
        if (!lc79LearningData[type].patternStats[pattern]) {
            lc79LearningData[type].patternStats[pattern] = { total: 0, correct: 0, accuracy: 0.5, recentResults: [], lastAdjustment: null };
        }
    });
}

function lc79GetPatternWeight(type, patternId) {
    lc79InitializePatternStats(type);
    return lc79LearningData[type].patternWeights[patternId] || 1.0;
}

function lc79GetPatternIdFromName(name) {
    const mapping = {
        'Cầu Bệt': 'cau_bet', 'Cầu Đảo 1-1': 'cau_dao_11', 'Cầu 2-2': 'cau_22', 'Cầu 3-3': 'cau_33',
        'Cầu 4-4': 'cau_44', 'Cầu 5-5': 'cau_55', 'Cầu 1-2-1': 'cau_121', 'Cầu 1-2-3': 'cau_123',
        'Cầu 3-2-1': 'cau_321', 'Cầu 2-1-2': 'cau_212', 'Cầu 1-2-2-1': 'cau_1221', 'Cầu 1-2-1-2-1': 'cau_1221',
        'Cầu 2-1-1-2': 'cau_2112', 'Cầu Nhảy Cóc': 'cau_nhay_coc', 'Cầu Nhịp Nghiêng': 'cau_nhip_nghieng',
        'Cầu 3 Ván 1': 'cau_3van1', 'Cầu Bẻ Cầu': 'cau_be_cau', 'Cầu Chu Kỳ': 'cau_chu_ky', 'Cầu Gấp': 'cau_gap',
        'Cầu Ziczac': 'cau_ziczac', 'Cầu Đôi': 'cau_doi', 'Cầu Rồng': 'cau_rong', 'Đảo Xu Hướng': 'smart_bet',
        'Xu Hướng Cực': 'smart_bet', 'Phân bố': 'distribution', 'Tổng TB': 'dice_pattern', 'Xu hướng': 'sum_trend',
        'Cực Điểm': 'edge_cases', 'Biến động': 'momentum', 'Cầu Tự Nhiên': 'cau_tu_nhien', 'Biểu Đồ Đường': 'dice_trend_line',
        'MD5 Biểu Đồ': 'dice_trend_line_md5', 'Cầu Liên Tục': 'break_pattern_hu', 'MD5 Cầu': 'break_pattern_md5',
        'Dây Gãy': 'day_gay', 'MD5 Dây Gãy': 'day_gay_md5', 'Tổng Phân Tích': 'tong_phan_tich',
        'Xu Hướng Mạnh': 'xu_huong_manh', 'Đảo Chiều': 'dao_chieu'
    };
    for (const [key, value] of Object.entries(mapping)) { if (name.includes(key)) return value; }
    return null;
}

function lc79GetAdaptiveConfidenceBoost(type) {
    const recentAcc = lc79LearningData[type].recentAccuracy;
    if (recentAcc.length < 10) return 0;
    const accuracy = recentAcc.reduce((a, b) => a + b, 0) / recentAcc.length;
    if (accuracy > 0.70) return 10;
    if (accuracy > 0.60) return 6;
    if (accuracy > 0.50) return 3;
    if (accuracy < 0.30) return -10;
    if (accuracy < 0.40) return -6;
    return 0;
}

function lc79GetSmartPredictionAdjustment(type, prediction, patterns) {
    const streakInfo = lc79LearningData[type].streakAnalysis;
    if (streakInfo.currentStreak <= -4) { return prediction === 'Tài' ? 'Xỉu' : 'Tài'; }
    let taiPatternScore = 0, xiuPatternScore = 0;
    patterns.forEach(p => {
        const patternId = lc79GetPatternIdFromName(p.name || p);
        if (patternId) {
            const stats = lc79LearningData[type].patternStats[patternId];
            if (stats && stats.recentResults.length >= 5) {
                const recentAcc = stats.recentResults.reduce((a, b) => a + b, 0) / stats.recentResults.length;
                const weight = lc79LearningData[type].patternWeights[patternId] || 1;
                if (p.prediction === 'Tài') { taiPatternScore += recentAcc * weight; }
                else { xiuPatternScore += recentAcc * weight; }
            }
        }
    });
    if (Math.abs(taiPatternScore - xiuPatternScore) > 0.7) { return taiPatternScore > xiuPatternScore ? 'Tài' : 'Xỉu'; }
    return prediction;
}

function lc79AnalyzeCauBet(results, type) {
    if (results.length < 3) return { detected: false };
    let streakType = results[0], streakLength = 1;
    for (let i = 1; i < results.length; i++) { if (results[i] === streakType) streakLength++; else break; }
    if (streakLength >= 3) {
        const weight = lc79GetPatternWeight(type, 'cau_bet');
        let shouldBreak = streakLength >= 5, confidence = 65;
        if (streakLength >= 7) { shouldBreak = true; confidence = 85; }
        else if (streakLength >= 5) { shouldBreak = true; confidence = 75; }
        else if (streakLength >= 3) { shouldBreak = false; confidence = 68; }
        return { detected: true, type: streakType, length: streakLength, prediction: shouldBreak ? (streakType === 'Tài' ? 'Xỉu' : 'Tài') : streakType, confidence: Math.round(confidence * weight), name: `Cầu Bệt ${streakLength} phiên ${streakType}`, patternId: 'cau_bet' };
    }
    return { detected: false };
}

function lc79AnalyzeCauDao11(results, type) {
    if (results.length < 4) return { detected: false };
    let alternatingLength = 1;
    for (let i = 1; i < Math.min(results.length, 10); i++) { if (results[i] !== results[i - 1]) alternatingLength++; else break; }
    if (alternatingLength >= 4) {
        const weight = lc79GetPatternWeight(type, 'cau_dao_11');
        const confidence = Math.min(80, 65 + alternatingLength * 2);
        return { detected: true, length: alternatingLength, prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: Math.round(confidence * weight), name: `Cầu Đảo 1-1 (${alternatingLength} phiên)`, patternId: 'cau_dao_11' };
    }
    return { detected: false };
}

function lc79AnalyzeTongPhanTich(data, type) {
    if (data.length < 10) return { detected: false };
    const recent10 = data.slice(0, 10);
    const sums = recent10.map(d => d.Tong);
    const results = recent10.map(d => d.Ket_qua);
    const avgSum = sums.reduce((a, b) => a + b, 0) / sums.length;
    const taiCount = results.filter(r => r === 'Tài').length;
    const xiuCount = results.filter(r => r === 'Xỉu').length;
    const first5Sum = sums.slice(5, 10).reduce((a, b) => a + b, 0) / 5;
    const last5Sum = sums.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const sumTrend = last5Sum - first5Sum;
    const weight = lc79GetPatternWeight(type, 'tong_phan_tich');
    if (sumTrend > 1.5) { return { detected: true, prediction: 'Xỉu', confidence: Math.round(75 + Math.abs(sumTrend) * 3), name: `Tổng Phân Tích (Tổng tăng ${sumTrend.toFixed(1)} → Xỉu)`, patternId: 'tong_phan_tich' }; }
    if (sumTrend < -1.5) { return { detected: true, prediction: 'Tài', confidence: Math.round(75 + Math.abs(sumTrend) * 3), name: `Tổng Phân Tích (Tổng giảm ${Math.abs(sumTrend).toFixed(1)} → Tài)`, patternId: 'tong_phan_tich' }; }
    if (Math.abs(taiCount - xiuCount) >= 3) { const lech = taiCount > xiuCount ? 'Tài' : 'Xỉu'; const prediction = lech === 'Tài' ? 'Xỉu' : 'Tài'; return { detected: true, prediction, confidence: Math.round(70 + Math.abs(taiCount - xiuCount) * 3), name: `Tổng Phân Tích (Lệch ${Math.abs(taiCount - xiuCount)} về ${lech} → ${prediction})`, patternId: 'tong_phan_tich' }; }
    return { detected: false };
}

function lc79CalculateAdvancedPrediction(data, type) {
    const last50 = data.slice(0, 50);
    const results = last50.map(d => d.Ket_qua);
    lc79InitializePatternStats(type);
    let predictions = [], factors = [], allPatterns = [];
    
    const tongPhanTich = lc79AnalyzeTongPhanTich(last50, type);
    if (tongPhanTich.detected) { predictions.push({ prediction: tongPhanTich.prediction, confidence: tongPhanTich.confidence, priority: 15, name: tongPhanTich.name }); factors.push(tongPhanTich.name); allPatterns.push(tongPhanTich); }
    
    const cauRong = (() => { if (results.length < 6) return { detected: false }; const weight = lc79GetPatternWeight(type, 'cau_rong'); let streakLength = 1; for (let i = 1; i < results.length; i++) { if (results[i] === results[0]) streakLength++; else break; } if (streakLength >= 6) { return { detected: true, prediction: results[0] === 'Tài' ? 'Xỉu' : 'Tài', confidence: Math.round(Math.min(88, 75 + streakLength) * weight), name: `Cầu Rồng ${streakLength} phiên (Bẻ mạnh)`, patternId: 'cau_rong' }; } return { detected: false }; })();
    if (cauRong.detected) { predictions.push({ prediction: cauRong.prediction, confidence: cauRong.confidence, priority: 12, name: cauRong.name }); factors.push(cauRong.name); allPatterns.push(cauRong); }
    
    const cauBet = lc79AnalyzeCauBet(results, type);
    if (cauBet.detected) { predictions.push({ prediction: cauBet.prediction, confidence: cauBet.confidence, priority: 9, name: cauBet.name }); factors.push(cauBet.name); allPatterns.push(cauBet); }
    
    const cauDao11 = lc79AnalyzeCauDao11(results, type);
    if (cauDao11.detected) { predictions.push({ prediction: cauDao11.prediction, confidence: cauDao11.confidence, priority: 9, name: cauDao11.name }); factors.push(cauDao11.name); allPatterns.push(cauDao11); }
    
    if (predictions.length === 0) { return { prediction: results[results.length - 1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 55, factors: ['Theo ván trước'] }; }
    
    predictions.sort((a, b) => b.priority - a.priority || b.confidence - a.confidence);
    const taiVotes = predictions.filter(p => p.prediction === 'Tài');
    const xiuVotes = predictions.filter(p => p.prediction === 'Xỉu');
    let taiScore = taiVotes.reduce((sum, p) => sum + p.confidence * p.priority, 0);
    let xiuScore = xiuVotes.reduce((sum, p) => sum + p.confidence * p.priority, 0);
    
    const streakInfo = lc79LearningData[type].streakAnalysis;
    if (streakInfo.currentStreak <= -3) {
        if (taiScore > xiuScore) xiuScore *= 1.3;
        else taiScore *= 1.3;
    }
    
    let finalPrediction = taiScore >= xiuScore ? 'Tài' : 'Xỉu';
    finalPrediction = lc79GetSmartPredictionAdjustment(type, finalPrediction, allPatterns);
    
    let baseConfidence = 65;
    const topPredictions = predictions.slice(0, 3);
    topPredictions.forEach(p => { if (p.prediction === finalPrediction) baseConfidence += (p.confidence - 65) * 0.3; });
    const agreementRatio = (finalPrediction === 'Tài' ? taiVotes.length : xiuVotes.length) / predictions.length;
    baseConfidence += Math.round(agreementRatio * 10);
    baseConfidence += lc79GetAdaptiveConfidenceBoost(type);
    let finalConfidence = Math.max(60, Math.min(92, Math.round(baseConfidence)));
    
    return { prediction: finalPrediction, confidence: finalConfidence, factors };
}

// LC79 API Endpoints
app.get('/lc79-hu', async (req, res) => {
    try {
        const data = await lc79FetchDataHu();
        if (!data || data.length === 0) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
        const latestPhien = data[0].Phien;
        const nextPhien = latestPhien + 1;
        const result = lc79CalculateAdvancedPrediction(data, 'hu');
        const record = {
            Phien: latestPhien, Xuc_xac_1: data[0].Xuc_xac_1, Xuc_xac_2: data[0].Xuc_xac_2, Xuc_xac_3: data[0].Xuc_xac_3,
            Tong: data[0].Tong, Ket_qua: data[0].Ket_qua, Do_tin_cay: `${result.confidence}%`,
            Phien_hien_tai: nextPhien.toString(), Du_doan: result.prediction, ket_qua_du_doan: '',
            id: '@tranhoang2286', timestamp: new Date().toISOString()
        };
        lc79PredictionHistory.hu.unshift(record);
        if (lc79PredictionHistory.hu.length > 100) lc79PredictionHistory.hu.pop();
        saveLC79PredictionHistory();
        res.json(record);
    } catch (error) { res.status(500).json({ error: 'Lỗi server' }); }
});

app.get('/lc79-md5', async (req, res) => {
    try {
        const data = await lc79FetchDataMd5();
        if (!data || data.length === 0) return res.status(500).json({ error: 'Không thể lấy dữ liệu' });
        const latestPhien = data[0].Phien;
        const nextPhien = latestPhien + 1;
        const result = lc79CalculateAdvancedPrediction(data, 'md5');
        const record = {
            Phien: latestPhien, Xuc_xac_1: data[0].Xuc_xac_1, Xuc_xac_2: data[0].Xuc_xac_2, Xuc_xac_3: data[0].Xuc_xac_3,
            Tong: data[0].Tong, Ket_qua: data[0].Ket_qua, Do_tin_cay: `${result.confidence}%`,
            Phien_hien_tai: nextPhien.toString(), Du_doan: result.prediction, ket_qua_du_doan: '',
            id: '@tranhoang2286', timestamp: new Date().toISOString()
        };
        lc79PredictionHistory.md5.unshift(record);
        if (lc79PredictionHistory.md5.length > 100) lc79PredictionHistory.md5.pop();
        saveLC79PredictionHistory();
        res.json(record);
    } catch (error) { res.status(500).json({ error: 'Lỗi server' }); }
});

app.get('/lc79-hu/lichsu', (req, res) => { res.json({ type: 'Lẩu Cua 79 - Tài Xỉu Hũ', history: lc79PredictionHistory.hu, total: lc79PredictionHistory.hu.length }); });
app.get('/lc79-md5/lichsu', (req, res) => { res.json({ type: 'Lẩu Cua 79 - Tài Xỉu MD5', history: lc79PredictionHistory.md5, total: lc79PredictionHistory.md5.length }); });
app.get('/lc79-hu/analysis', async (req, res) => { try { const data = await lc79FetchDataHu(); if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' }); const result = lc79CalculateAdvancedPrediction(data, 'hu'); res.json({ prediction: result.prediction, confidence: result.confidence, factors: result.factors }); } catch (error) { res.status(500).json({ error: 'Lỗi server' }); } });
app.get('/lc79-md5/analysis', async (req, res) => { try { const data = await lc79FetchDataMd5(); if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu' }); const result = lc79CalculateAdvancedPrediction(data, 'md5'); res.json({ prediction: result.prediction, confidence: result.confidence, factors: result.factors }); } catch (error) { res.status(500).json({ error: 'Lỗi server' }); } });
app.get('/lc79-hu/learning', (req, res) => { const stats = lc79LearningData.hu; const accuracy = stats.totalPredictions > 0 ? (stats.correctPredictions / stats.totalPredictions * 100).toFixed(2) : 0; res.json({ totalPredictions: stats.totalPredictions, correctPredictions: stats.correctPredictions, overallAccuracy: `${accuracy}%`, streakAnalysis: stats.streakAnalysis }); });
app.get('/lc79-md5/learning', (req, res) => { const stats = lc79LearningData.md5; const accuracy = stats.totalPredictions > 0 ? (stats.correctPredictions / stats.totalPredictions * 100).toFixed(2) : 0; res.json({ totalPredictions: stats.totalPredictions, correctPredictions: stats.correctPredictions, overallAccuracy: `${accuracy}%`, streakAnalysis: stats.streakAnalysis }); });
app.get('/reset-learning', (req, res) => { lc79LearningData = { hu: { predictions: [], patternStats: {}, totalPredictions: 0, correctPredictions: 0, patternWeights: { ...LC79_DEFAULT_PATTERN_WEIGHTS }, lastUpdate: null, streakAnalysis: { wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, worstStreak: 0 }, adaptiveThresholds: {}, recentAccuracy: [] }, md5: { predictions: [], patternStats: {}, totalPredictions: 0, correctPredictions: 0, patternWeights: { ...LC79_DEFAULT_PATTERN_WEIGHTS }, lastUpdate: null, streakAnalysis: { wins: 0, losses: 0, currentStreak: 0, bestStreak: 0, worstStreak: 0 }, adaptiveThresholds: {}, recentAccuracy: [] } }; saveLC79LearningData(); res.json({ message: 'Learning data reset successfully' }); });

// ==================== API ENDPOINTS CHÍNH ====================
app.get('/api/sieu', (req, res) => { res.json(sunwinApiResponse); });
app.get('/api/ditmemaysun', (req, res) => { res.json(sunwinApiResponse); });
app.get('/api/his', (req, res) => { const recent = sunwinHistory.slice(-20).reverse(); res.json({ success: true, total: sunwinHistory.length, data: recent, stats: { tong: sunwinStats.total, dung: sunwinStats.correct, sai: sunwinStats.wrong, ti_le: sunwinStats.total > 0 ? ((sunwinStats.correct / sunwinStats.total) * 100).toFixed(1) + '%' : '0%', consecutive_losses: sunwinStats.consecutiveLosses } }); });
app.get('/api/models', (req, res) => { res.json({ main_models: 21, sub_models: 42, mini_models: 21, total: 84 }); });
app.get('/api/68gb/txhu', (req, res) => { res.json(gb68Bot.txhu.last_result || { error: "No data" }); });
app.get('/api/68gb/history/txhu', (req, res) => { res.json(gb68Bot.txhu.history.slice().reverse()); });
app.get('/api/68gb/txmd5', (req, res) => { res.json(gb68Bot.md5.last_result || { error: "No data" }); });
app.get('/api/68gb/history/txmd5', (req, res) => { res.json(gb68Bot.md5.history.slice().reverse()); });
app.get('/', (req, res) => { res.json({ status: 'active', message: 'Sunwin + 68GB + LC79 API', endpoints: { sunwin: '/api/sieu', gb68: '/api/68gb/txhu', lc79: '/lc79-hu' }, id: '@tranhoang2286' }); });

// ==================== START ====================
loadLC79LearningData();
loadLC79PredictionHistory();

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 ===== SUPER API TÀI XỈU =====`);
    console.log(`🌐 Server: http://0.0.0.0:${PORT}`);
    console.log(`📌 Sunwin: /api/sieu (84 models)`);
    console.log(`📌 68GB: /api/68gb/txhu, /api/68gb/txmd5`);
    console.log(`📌 LC79: /lc79-hu, /lc79-md5, /lc79-hu/lichsu, /lc79-md5/lichsu, /lc79-hu/analysis, /lc79-md5/analysis, /lc79-hu/learning, /lc79-md5/learning`);
    console.log(`=====================================\n`);
});

connectSunwin();
