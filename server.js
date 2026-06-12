// server.js - FULL CODE: Sunwin + 68GB + LC79 (Giữ nguyên toàn bộ thuật toán)
const WebSocket = require('ws');
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const { exec, execSync, spawn } = require('child_process');

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

function saveSunwinHistory(entry) { sunwinHistory.push(entry); if (sunwinHistory.length > 500) sunwinHistory.shift(); fs.writeFileSync(SUNWIN_HISTORY_FILE, JSON.stringify(sunwinHistory, null, 2)); }
function saveSunwinModelWeights() { fs.writeFileSync(SUNWIN_MODEL_WEIGHTS_FILE, JSON.stringify({ modelWeights: sunwinModelWeights, subModelWeights: sunwinSubModelWeights, miniModelWeights: sunwinMiniModelWeights }, null, 2)); }

let sunwinApiResponse = {
    "Phien": null, "Xuc_xac_1": null, "Xuc_xac_2": null, "Xuc_xac_3": null, "Tong": null, "Ket_qua": "",
    "Phien_hien_tai": null, "Du_doan": "", "Loai_cau": "", "Mau_cau_phat_hien": "", "Do_tin_cay": "0%",
    "Trang_thai": "", "Ket_qua_du_doan": "", "Thong_ke": { "tong": 0, "dung": 0, "sai": 0, "ti_le": "0%" }, "id": "@tranhoang2286"
};

// ==================== SUNWIN TAI XIU ANALYZER (GIỮ NGUYÊN) ====================

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
    
    loadPatternLibrary() { if (fs.existsSync(SUNWIN_PATTERNS_FILE)) { try { return JSON.parse(fs.readFileSync(SUNWIN_PATTERNS_FILE, 'utf8')); } catch(e) {} } return { '1-1': [], '2-2': [], '3-3': [], '1-2': [], '2-1': [], '2-1-2': [], '1-2-1': [], 'bệt': [], 'loạn': [] }; }
    savePatternLibrary() { fs.writeFileSync(SUNWIN_PATTERNS_FILE, JSON.stringify(this.patternLibrary, null, 2)); }
    
    initSubModels() {
        let specs = {
            1: { name: '1-1 thuần', type: '1-1', logic: 'pure', minLength: 4 }, 2: { name: '1-1 biến thể', type: '1-1', logic: 'variant', minLength: 5 },
            3: { name: '1-1 dài hạn', type: '1-1', logic: 'long', minLength: 8 }, 4: { name: '1-1 kết hợp', type: '1-1', logic: 'hybrid', minLength: 6 },
            5: { name: '1-1 gãy', type: '1-1', logic: 'break', minLength: 6 }, 6: { name: '1-1 phục hồi', type: '1-1', logic: 'recovery', minLength: 7 },
            7: { name: '2-2 chuẩn', type: '2-2', logic: 'pure', minLength: 6 }, 8: { name: '2-2 lệch', type: '2-2', logic: 'offset', minLength: 7 },
            9: { name: '2-2 biến tướng', type: '2-2', logic: 'variant', minLength: 8 }, 10: { name: '2-2 kết hợp', type: '2-2', logic: 'hybrid', minLength: 8 },
            11: { name: '2-2 dài', type: '2-2', logic: 'long', minLength: 10 }, 12: { name: '2-2 bẻ', type: '2-2', logic: 'break', minLength: 7 },
            13: { name: 'bệt ngắn', type: 'bệt', logic: 'short', minLength: 3 }, 14: { name: 'bệt trung', type: 'bệt', logic: 'medium', minLength: 5 },
            15: { name: 'bệt dài', type: 'bệt', logic: 'long', minLength: 7 }, 16: { name: 'bệt gãy', type: 'bệt', logic: 'break', minLength: 5 },
            17: { name: 'bệt xen kẽ', type: 'bệt', logic: 'hybrid', minLength: 6 }, 18: { name: 'siêu bệt', type: 'bệt', logic: 'super', minLength: 10 },
            19: { name: '3-3 chuẩn', type: '3-3', logic: 'pure', minLength: 9 }, 20: { name: '3-3 biến thể', type: '3-3', logic: 'variant', minLength: 10 },
            21: { name: '3-3 ngắn', type: '3-3', logic: 'short', minLength: 6 }, 22: { name: '3-3 kết hợp', type: '3-3', logic: 'hybrid', minLength: 9 },
            23: { name: '3-3 bẻ', type: '3-3', logic: 'break', minLength: 8 }, 24: { name: '3-3 dài', type: '3-3', logic: 'long', minLength: 12 },
            25: { name: '2-1-2 chuẩn', type: '2-1-2', logic: 'pure', minLength: 5 }, 26: { name: '2-1-2 biến thể', type: '2-1-2', logic: 'variant', minLength: 6 },
            27: { name: '2-1-2 dài', type: '2-1-2', logic: 'long', minLength: 8 }, 28: { name: '1-2-1 chuẩn', type: '1-2-1', logic: 'pure', minLength: 5 },
            29: { name: '1-2-1 biến thể', type: '1-2-1', logic: 'variant', minLength: 6 }, 30: { name: '1-2-1 dài', type: '1-2-1', logic: 'long', minLength: 8 },
            31: { name: 'bẻ cầu 1-1', type: 'break', logic: 'break11', minLength: 4 }, 32: { name: 'bẻ cầu 2-2', type: 'break', logic: 'break22', minLength: 5 },
            33: { name: 'bẻ cầu bệt', type: 'break', logic: 'breakStreak', minLength: 4 }, 34: { name: 'chuyển 1-1 sang 2-2', type: 'transition', logic: '11to22', minLength: 6 },
            35: { name: 'chuyển 2-2 sang 1-1', type: 'transition', logic: '22to11', minLength: 6 }, 36: { name: 'chuyển bệt sang 1-1', type: 'transition', logic: 'streakTo11', minLength: 5 },
            37: { name: 'phân tích tần suất', type: 'frequency', logic: 'frequency', minLength: 10 }, 38: { name: 'phân tích chu kỳ', type: 'cycle', logic: 'cycle', minLength: 12 },
            39: { name: 'phân tích đối xứng', type: 'symmetry', logic: 'symmetry', minLength: 8 }, 40: { name: 'phân tích Fibonacci', type: 'fibonacci', logic: 'fibonacci', minLength: 8 },
            41: { name: 'phân tích xu hướng dài', type: 'trend', logic: 'longTrend', minLength: 15 }, 42: { name: 'tổng hợp siêu cầu', type: 'super', logic: 'super', minLength: 20 }
        };
        for (let i = 1; i <= 42; i++) this.subModels[`sub_model_${i}`] = { ...specs[i], weight: this.subModelWeights[`sub_model_${i}`] || 1.0, accuracy: 0.5, predictions: [] };
    }
    
    initMiniModels() {
        let specialties = { 1: 'phat_hien_cau_dep', 2: 'du_doan_bien_dong', 3: 'phan_tich_so_sanh', 4: 'nhan_dien_xu_huong_cuc_bo', 5: 'tinh_toan_xac_suat_cao', 6: 'phat_hien_diem_gay', 7: 'du_doan_nguong', 8: 'phan_tich_chuoi', 9: 'nhan_dien_mau_lap', 10: 'tinh_he_so_tuong_quan', 11: 'du_doan_doan_nhiet', 12: 'phan_tich_pha', 13: 'nhan_dien_song', 14: 'tinh_toan_momentum', 15: 'du_doan_hoi_phuc', 16: 'phat_hien_dot_bien', 17: 'phan_tich_can_bang', 18: 'nhan_dien_tan_so', 19: 'du_doan_chu_ky', 20: 'tinh_toan_ma_tran', 21: 'phan_tich_tong_hop' };
        for (let i = 1; i <= 21; i++) this.miniModels[`mini_model_${i}`] = { weight: this.miniModelWeights[`mini_model_${i}`] || 1.0, accuracy: 0.5, specialty: specialties[i] || 'chung', predictions: [] };
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
    getLongTrend(results) { if (results.length < 10) return { strength: 0, direction: null }; let first = results.slice(0,5), last = results.slice(-5), firstTai = first.filter(r => r === 'Tài').length, lastTai = last.filter(r => r === 'Tài').length; if (lastTai > firstTai+2) return { strength: 0.8, direction: 'Tài' }; if (lastTai < firstTai-2) return { strength: 0.8, direction: 'Xỉu' }; return { strength: 0.5, direction: lastTai > 2 ? 'Tài' : 'Xỉu' }; }
    
    runSubModel11(results, model) { if (results.length < model.minLength) return null; let last = results[results.length-1]; switch (model.logic) { case 'pure': if (this.isPerfectAlternating(results,4)) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Cầu 1-1 thuần', model_name: model.name }; case 'variant': if (this.isAlternatingWithTolerance(results,1)) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.8, reason: 'Cầu 1-1 biến thể', model_name: model.name }; case 'long': let alt = this.countAlternating(results.slice(-12)); if (alt >= 8) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7 + alt/20, reason: `Cầu 1-1 dài (${alt}/11)`, model_name: model.name }; case 'break': let last4 = results.slice(-4); if (last4[0] !== last4[1] && last4[1] !== last4[2] && last4[2] !== last4[3] && this.getStreak(results.slice(0,-1)) > 4) return { prediction: last, confidence: 0.8, reason: 'Cầu 1-1 sắp gãy', model_name: model.name }; } return null; }
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

const sunwinAI = new SunwinAnalyzer();

// ==================== SUNWIN WEBSOCKET ====================
const SUNWIN_WS_URL = "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXBpc3Vud2luMTIzIn0.hgrRbSV6vnBwJMg9ZFtbx3rRu9mX_hZMZ_m5gMNhkw0";
let sunwinWs = null, sunwinPingInterval = null, sunwinReconnectTimeout = null;

function connectSunwin() {
    if (sunwinWs) { try { sunwinWs.removeAllListeners(); sunwinWs.close(); } catch(e) {} }
    sunwinWs = new WebSocket(SUNWIN_WS_URL);
    sunwinWs.on('open', () => {
        console.log('[✅] Sunwin WebSocket connected');
        let init = [1, "MiniGame", "GM_apivopnha", "WangLin", { "info": "{\"ipAddress\":\"14.249.227.107\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiI5ODE5YW5zc3MiLCJib3QiOjAsImlzTWVyY2hhbnQiOmZhbHNlLCJ2ZXJpZmllZEJhbmtBY2NvdW50IjpmYWxzZSwicGxheUV2ZW50TG9iYnkiOmZhbHNlLCJjdXN0b21lcklkIjozMjMyODExNTEsImFmZklkIjoic3VuLndpbiIsImJhbm5lZCI6ZmFsc2UsImJyYW5kIjoiZ2VtIiwidGltZXN0YW1wIjoxNzYzMDMyOTI4NzcwLCJsb2NrR2FtZXMiOltdLCJhbW91bnQiOjAsImxvY2tDaGF0IjpmYWxzZSwicGhvbmVWZXJpZmllZCI6ZmFsc2UsImlwQWRkcmVzcyI6IjE0LjI0OS4yMjcuMTA3IiwibXV0ZSI6ZmFsc2UsImF2YXRhciI6Imh0dHBzOi8vaW1hZ2VzLnN3aW5zaG9wLm5ldC9pbWFnZXMvYXZhdGFyL2F2YXRhcl8wNS5wbmciLCJwbGF0Zm9ybUlkIjo0LCJ1c2VySWQiOiI4ODM4NTMzZS1kZTQzLTRiOGQtOTUwMy02MjFmNDA1MDUzNGUiLCJyZWdUaW1lIjoxNzYxNjMyMzAwNTc2LCJwaG9uZSI6IiIsImRlcG9zaXQiOmZhbHNlLCJ1c2VybmFtZSI6IkdNX2FwaXZvcG5oYSJ9.guH6ztJSPXUL1cU8QdMz8O1Sdy_SbxjSM-CDzWPTr-0\",\"locale\":\"vi\",\"userId\":\"8838533e-de43-4b8d-9503-621f4050534e\",\"username\":\"GM_apivopnha\",\"timestamp\":1763032928770,\"refreshToken\":\"e576b43a64e84f789548bfc7c4c8d1e5.7d4244a361e345908af95ee2e8ab2895\"}", "signature": "45EF4B318C883862C36E1B189A1DF5465EBB60CB602BA05FAD8FCBFCD6E0DA8CB3CE65333EDD79A2BB4ABFCE326ED5525C7D971D9DEDB5A17A72764287FFE6F62CBC2DF8A04CD8EFF8D0D5AE27046947ADE45E62E644111EFDE96A74FEC635A97861A425FF2B5732D74F41176703CA10CFEED67D0745FF15EAC1065E1C8BCBFA" }];
        sunwinWs.send(JSON.stringify(init));
        sunwinWs.send(JSON.stringify([6, "MiniGame", "taixiuPlugin", { cmd: 1005 }]));
        sunwinWs.send(JSON.stringify([6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]));
        sunwinPingInterval = setInterval(() => { if (sunwinWs?.readyState === WebSocket.OPEN) sunwinWs.ping(); }, 15000);
    });
    sunwinWs.on('message', (msg) => { try { let data = JSON.parse(msg); if (!Array.isArray(data) || !data[1]) return; let { cmd, sid, d1, d2, d3, gBB } = data[1]; if (cmd === 1008 && sid) sunwinCurrentSessionId = sid; if (cmd === 1003 && gBB && d1 && d2 && d3) { let total = d1 + d2 + d3, result = total > 10 ? "Tài" : "Xỉu"; let correct = false; if (sunwinLastPrediction && sunwinLastPrediction.ket_qua) { correct = sunwinLastPrediction.ket_qua === result; sunwinStats.total++; if (correct) { sunwinStats.correct++; sunwinStats.consecutiveLosses = 0; } else { sunwinStats.wrong++; sunwinStats.consecutiveLosses++; } sunwinAI.updateModelWeights(result, sunwinLastPrediction.ket_qua, parseInt(sunwinLastPrediction.do_tin_cay || '70')); } let historyForAnalysis = sunwinHistory.map(h => ({ score: h.Tong, Ket_qua: h.Ket_qua, Xuc_xac_1: h.Xuc_xac_1, Xuc_xac_2: h.Xuc_xac_2, Xuc_xac_3: h.Xuc_xac_3 })); let ensemble = sunwinAI.ensembleModels(historyForAnalysis); let finalPred = ensemble.prediction, finalConf = ensemble.confidence, finalType = ensemble.pattern_type, finalPattern = ensemble.pattern; if (sunwinStats.consecutiveLosses >= 3) { finalPred = finalPred === 'Tài' ? 'Xỉu' : 'Tài'; finalConf = 0.4; finalType = 'CHỐNG ĐẢO'; } sunwinLastPrediction = { phien: sunwinCurrentSessionId ? parseInt(sunwinCurrentSessionId)+1 : null, ket_qua: finalPred, loai_cau: finalType, mau_cau: finalPattern, do_tin_cay: (finalConf*100).toFixed(0)+'%' }; let tiLe = sunwinStats.total > 0 ? ((sunwinStats.correct/sunwinStats.total)*100).toFixed(1)+'%' : '0%'; sunwinApiResponse = { "Phien": sunwinCurrentSessionId, "Xuc_xac_1": d1, "Xuc_xac_2": d2, "Xuc_xac_3": d3, "Tong": total, "Ket_qua": result, "Phien_hien_tai": sunwinCurrentSessionId ? parseInt(sunwinCurrentSessionId)+1 : null, "Du_doan": finalPred, "Loai_cau": finalType, "Mau_cau_phat_hien": finalPattern, "Do_tin_cay": (finalConf*100).toFixed(0)+'%', "Trang_thai": sunwinStats.consecutiveLosses>=3?'Chống đảo':'Theo cầu', "Ket_qua_du_doan": correct ? '✅' : (sunwinStats.total>0?'❌':''), "Thong_ke": { "tong": sunwinStats.total, "dung": sunwinStats.correct, "sai": sunwinStats.wrong, "ti_le": tiLe }, "id": "@tranhoang2286" }; let entry = { phien: sunwinCurrentSessionId, Xuc_xac_1: d1, Xuc_xac_2: d2, Xuc_xac_3: d3, Tong: total, Ket_qua: result, du_doan: finalPred, loai_cau: finalType, do_tin_cay: (finalConf*100).toFixed(0)+'%', thoi_gian: new Date().toISOString() }; saveSunwinHistory(entry); console.log(`[Sunwin] P${sunwinCurrentSessionId}: ${d1}${d2}${d3}=${total} → ${result} | Dự đoán: ${finalPred} (${(finalConf*100).toFixed(0)}%) ${correct?'✅':'❌'}`); sunwinCurrentSessionId = null; } } catch(e) { console.error('[Sunwin] Lỗi:', e.message); } });
    sunwinWs.on('close', () => { clearInterval(sunwinPingInterval); clearTimeout(sunwinReconnectTimeout); sunwinReconnectTimeout = setTimeout(connectSunwin, 5000); });
    sunwinWs.on('error', (err) => { console.error('[Sunwin] WebSocket error:', err.message); if (sunwinWs) sunwinWs.close(); });
}

// ==================== 68GB BOT (GIỮ NGUYÊN TỪ 68.js) ====================

const TOKEN_HEX = "010000687b22636f6465223a3230302c22737973223a7b22686561727462656174223a31352c2273657269616c697a657222";
const WS_URL_ENV = "wss://mtsahwkvbim09mnwv.cq.qnwxdhwica.com/";
const LANDING_URL = "https://68gbvn88.bar";
const TOKEN_FILE = "token_shared.bin";

const shared = { WS_URL: WS_URL_ENV, PKT_HANDSHAKE: Buffer.from('010000727b22737973223a7b22706c6174666f726d223a226a732d776562736f636b6574222c22636c69656e744275696c644e756d626572223a22302e302e31222c22636c69656e7456657273696f6e223a223061323134383164373436663932663834323865316236646565623736666561227d7d', 'hex'), PKT_HANDSHAKE_ACK: Buffer.from('02000000', 'hex'), PKT_HEARTBEAT: Buffer.from('03000000', 'hex'), PKT_AUTH: Buffer.from('', 'hex'), SESSION_READY: false };

if (TOKEN_HEX) { shared.PKT_AUTH = Buffer.from(TOKEN_HEX.replace(/^0x/i, "").replace(/\s+/g, ""), "hex"); shared.SESSION_READY = true; console.log("[68GB] Token loaded"); }

class Bot68GB {
    constructor(shared) { this.shared = shared; this.ws = null; this.txhu = { last_result: null, history: [] }; this.md5 = { last_result: null, history: [] }; this.isAliveFlag = false; }
    isAlive() { return this.isAliveFlag; }
    run(landingUrl) { this.connect(); }
    connect() { if (this.ws) this.ws.close(); this.ws = new WebSocket(this.shared.WS_URL); this.ws.on('open', () => { console.log('[68GB] WebSocket connected'); if (this.shared.PKT_HANDSHAKE) this.ws.send(this.shared.PKT_HANDSHAKE); }); this.ws.on('message', (data) => { try { if (data.length === 4 && data.readUInt32BE(0) === 2) { if (this.shared.PKT_AUTH && this.shared.PKT_AUTH.length) this.ws.send(this.shared.PKT_AUTH); } let msg = data.toString(); if (msg.includes('txhu') || msg.includes('result')) { try { let json = JSON.parse(msg); if (json.result) { this.txhu.last_result = json.result; this.txhu.history.unshift(json.result); if (this.txhu.history.length > 100) this.txhu.history.pop(); this.isAliveFlag = true; } } catch(e){} } } catch(e){} }); this.ws.on('close', () => { this.isAliveFlag = false; setTimeout(() => this.connect(), 5000); }); this.ws.on('error', () => {}); }
}

const gb68Bot = new Bot68GB(shared);
if (shared.SESSION_READY) gb68Bot.run(LANDING_URL);

// ==================== LC79 API (GIỮ NGUYÊN TỪ lc.js) ====================

const LC79_API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const LC79_API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';

let lc79PredictionHistory = { hu: [], md5: [] };
let lc79LearningData = { hu: { totalPredictions: 0, correctPredictions: 0, streakAnalysis: { currentStreak: 0 } }, md5: { totalPredictions: 0, correctPredictions: 0, streakAnalysis: { currentStreak: 0 } } };

if (fs.existsSync(LC79_HISTORY_FILE)) { try { lc79PredictionHistory = JSON.parse(fs.readFileSync(LC79_HISTORY_FILE, 'utf8')); } catch(e) {} }
if (fs.existsSync(LC79_LEARNING_FILE)) { try { lc79LearningData = JSON.parse(fs.readFileSync(LC79_LEARNING_FILE, 'utf8')); } catch(e) {} }

function saveLC79History() { fs.writeFileSync(LC79_HISTORY_FILE, JSON.stringify(lc79PredictionHistory, null, 2)); }
function saveLC79Learning() { fs.writeFileSync(LC79_LEARNING_FILE, JSON.stringify(lc79LearningData, null, 2)); }

async function fetchLC79Data(type) { try { let url = type === 'hu' ? LC79_API_URL_HU : LC79_API_URL_MD5; let res = await axios.get(url, { timeout: 10000 }); if (res.data?.list) return res.data.list.map(item => ({ Phien: item.id, Ket_qua: item.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu', Xuc_xac_1: item.dices[0], Xuc_xac_2: item.dices[1], Xuc_xac_3: item.dices[2], Tong: item.point })); return null; } catch(e) { console.error('[LC79] Error:', e.message); return null; } }

function analyzeCauBetLC79(results) { if (results.length < 3) return null; let streak = 1; for (let i = results.length-2; i>=0; i--) { if (results[i] === results[results.length-1]) streak++; else break; } if (streak >= 3) { let shouldBreak = streak >= 5; return { prediction: shouldBreak ? (results[0]==='Tài'?'Xỉu':'Tài') : results[0], confidence: 65 + Math.min(20, streak*2), name: `Cầu bệt ${streak}p` }; } return null; }
function analyzeCauDao11LC79(results) { if (results.length < 4) return null; let isAlt = true; for (let i = results.length-4; i < results.length-1; i++) if (results[i] === results[i+1]) { isAlt = false; break; } if (isAlt) return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 70, name: 'Cầu đảo 1-1' }; return null; }
function calculateLC79Prediction(data, type) { let results = data.map(d => d.Ket_qua); if (results.length < 5) return { prediction: 'Tài', confidence: 60, factors: ['Không đủ dữ liệu'] }; let predictions = []; let cauBet = analyzeCauBetLC79(results); if (cauBet) predictions.push(cauBet); let cauDao = analyzeCauDao11LC79(results); if (cauDao) predictions.push(cauDao); if (predictions.length === 0) return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 55, factors: ['Theo ván trước'] }; let taiScore = 0, xiuScore = 0; for (let p of predictions) { if (p.prediction === 'Tài') taiScore += p.confidence; else xiuScore += p.confidence; } let finalPred = taiScore >= xiuScore ? 'Tài' : 'Xỉu'; let finalConf = Math.min(92, Math.max(60, (Math.max(taiScore, xiuScore) / (taiScore+xiuScore)) * 100)); let streak = lc79LearningData[type].streakAnalysis.currentStreak; if (streak <= -3) { finalPred = finalPred === 'Tài' ? 'Xỉu' : 'Tài'; finalConf = Math.min(finalConf, 68); } return { prediction: finalPred, confidence: Math.round(finalConf), factors: predictions.map(p => p.name) }; }
function updateLC79Result(type, actual, predicted) { let correct = actual === predicted; let data = lc79LearningData[type]; if (correct) { data.correctPredictions++; if (data.streakAnalysis.currentStreak >= 0) data.streakAnalysis.currentStreak++; else data.streakAnalysis.currentStreak = 1; } else { if (data.streakAnalysis.currentStreak <= 0) data.streakAnalysis.currentStreak--; else data.streakAnalysis.currentStreak = -1; } data.totalPredictions++; saveLC79Learning(); return correct; }

// ==================== API ENDPOINTS ====================

// Sunwin
app.get('/api/sieu', (req, res) => { res.json(sunwinApiResponse); });
app.get('/api/sunwin/history', (req, res) => { res.json(sunwinHistory.slice(0, 50)); });
app.get('/api/sunwin/models', (req, res) => { res.json({ main: 21, sub: 42, mini: 21, total: 84 }); });

// 68GB
app.get('/api/68gb/txhu', (req, res) => { res.json(gb68Bot.txhu.last_result || { error: "No data" }); });
app.get('/api/68gb/history/txhu', (req, res) => { res.json(gb68Bot.txhu.history.slice().reverse()); });
app.get('/api/68gb/txmd5', (req, res) => { res.json(gb68Bot.md5.last_result || { error: "No data" }); });
app.get('/api/68gb/history/txmd5', (req, res) => { res.json(gb68Bot.md5.history.slice().reverse()); });

// LC79
app.get('/lc79-hu', async (req, res) => { try { let data = await fetchLC79Data('hu'); if (!data || data.length === 0) return res.json({ error: 'Không thể lấy dữ liệu' }); let result = calculateLC79Prediction(data, 'hu'); let latest = data[0]; let record = { Phien: latest.Phien, Xuc_xac_1: latest.Xuc_xac_1, Xuc_xac_2: latest.Xuc_xac_2, Xuc_xac_3: latest.Xuc_xac_3, Tong: latest.Tong, Ket_qua: latest.Ket_qua, Do_tin_cay: `${result.confidence}%`, Phien_hien_tai: latest.Phien + 1, Du_doan: result.prediction, ket_qua_du_doan: '', id: '@tranhoang2286', timestamp: new Date().toISOString() }; lc79PredictionHistory.hu.unshift(record); if (lc79PredictionHistory.hu.length > 100) lc79PredictionHistory.hu.pop(); saveLC79History(); res.json(record); } catch(e) { res.status(500).json({ error: e.message }); } });
app.get('/lc79-md5', async (req, res) => { try { let data = await fetchLC79Data('md5'); if (!data || data.length === 0) return res.json({ error: 'Không thể lấy dữ liệu' }); let result = calculateLC79Prediction(data, 'md5'); let latest = data[0]; let record = { Phien: latest.Phien, Xuc_xac_1: latest.Xuc_xac_1, Xuc_xac_2: latest.Xuc_xac_2, Xuc_xac_3: latest.Xuc_xac_3, Tong: latest.Tong, Ket_qua: latest.Ket_qua, Do_tin_cay: `${result.confidence}%`, Phien_hien_tai: latest.Phien + 1, Du_doan: result.prediction, ket_qua_du_doan: '', id: '@tranhoang2286', timestamp: new Date().toISOString() }; lc79PredictionHistory.md5.unshift(record); if (lc79PredictionHistory.md5.length > 100) lc79PredictionHistory.md5.pop(); saveLC79History(); res.json(record); } catch(e) { res.status(500).json({ error: e.message }); } });
app.get('/lc79-hu/lichsu', (req, res) => { res.json({ type: 'Lẩu Cua 79 - Tài Xỉu Hũ', history: lc79PredictionHistory.hu, total: lc79PredictionHistory.hu.length }); });
app.get('/lc79-md5/lichsu', (req, res) => { res.json({ type: 'Lẩu Cua 79 - Tài Xỉu MD5', history: lc79PredictionHistory.md5, total: lc79PredictionHistory.md5.length }); });

// Root
app.get('/', (req, res) => { res.json({ status: 'active', message: 'Sunwin + 68GB + LC79 API', endpoints: { sunwin: '/api/sieu', gb68: '/api/68gb/txhu', lc79: '/lc79-hu' }, id: '@tranhoang2286' }); });

// ==================== START ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 ===== SUPER API TÀI XỈU =====`);
    console.log(`🌐 Server: http://0.0.0.0:${PORT}`);
    console.log(`📌 Sunwin: /api/sieu (giữ nguyên 84 models)`);
    console.log(`📌 68GB: /api/68gb/txhu, /api/68gb/txmd5`);
    console.log(`📌 LC79: /lc79-hu, /lc79-md5, /lc79-hu/lichsu, /lc79-md5/lichsu`);
    console.log(`=====================================\n`);
});

connectSunwin();
