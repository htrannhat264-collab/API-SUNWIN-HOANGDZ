// server.js - SUPER API: Sunwin + LC79 (Giữ nguyên thuật toán từng game)
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

const LC79_HISTORY_FILE = './lc79_history.json';
const LC79_LEARNING_FILE = './lc79_learning.json';

// ==================== SUNWIN - GIỮ NGUYÊN TỪ apisun.js ====================

// Load Sunwin history
let sunwinHistory = [];
if (fs.existsSync(SUNWIN_HISTORY_FILE)) {
    try {
        sunwinHistory = JSON.parse(fs.readFileSync(SUNWIN_HISTORY_FILE, 'utf8'));
        console.log(`[📂] Sunwin: Đã tải ${sunwinHistory.length} phiên`);
    } catch (e) {}
}

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
    if (sunwinHistory.length > 1000) sunwinHistory.shift();
    fs.writeFileSync(SUNWIN_HISTORY_FILE, JSON.stringify(sunwinHistory, null, 2));
}

function saveSunwinModelWeights() {
    fs.writeFileSync(SUNWIN_MODEL_WEIGHTS_FILE, JSON.stringify({
        modelWeights: sunwinModelWeights,
        subModelWeights: sunwinSubModelWeights,
        miniModelWeights: sunwinMiniModelWeights
    }, null, 2));
}

// Sunwin Global Variables
let sunwinCurrentSessionId = null;
let sunwinLastPrediction = null;
let sunwinStats = { total: 0, correct: 0, wrong: 0, consecutiveLosses: 0 };

let sunwinApiResponse = {
    "Phien": null, "Xuc_xac_1": null, "Xuc_xac_2": null, "Xuc_xac_3": null,
    "Tong": null, "Ket_qua": "", "Phien_hien_tai": null, "Du_doan": "",
    "Loai_cau": "", "Mau_cau_phat_hien": "", "Do_tin_cay": "0%",
    "Trang_thai": "", "Ket_qua_du_doan": "", "Thong_ke": { "tong": 0, "dung": 0, "sai": 0, "ti_le": "0%" },
    "id": "@tranhoang2286"
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
    
    loadPatternLibrary() {
        if (fs.existsSync(SUNWIN_PATTERNS_FILE)) {
            try { return JSON.parse(fs.readFileSync(SUNWIN_PATTERNS_FILE, 'utf8')); }
            catch (e) {}
        }
        return { '1-1': [], '2-2': [], '3-3': [], '1-2': [], '2-1': [], '2-1-2': [], '1-2-1': [], 'bệt': [], 'loạn': [] };
    }
    
    savePatternLibrary() { fs.writeFileSync(SUNWIN_PATTERNS_FILE, JSON.stringify(this.patternLibrary, null, 2)); }
    
    initSubModels() {
        const specs = {
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
            this.subModels[`sub_model_${i}`] = { ...specs[i], weight: this.subModelWeights[`sub_model_${i}`] || 1.0, accuracy: 0.5, predictions: [] };
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
            this.miniModels[`mini_model_${i}`] = {
                weight: this.miniModelWeights[`mini_model_${i}`] || 1.0,
                accuracy: 0.5, specialty: specialties[i] || 'chung', predictions: []
            };
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
    getLongTrend(results) { if (results.length < 10) return { strength: 0, direction: null }; let first = results.slice(0,5), last = results.slice(-5), firstTai = first.filter(r => r === 'Tài').length, lastTai = last.filter(r => r === 'Tài').length; if (lastTai > firstTai+2) return { strength: 0.8, direction: 'Tài' }; if (lastTai < firstTai-2) return { strength: 0.8, direction: 'Xỉu' }; return { strength: 0.5, direction: lastTai > 2 ? 'Tài' : 'Xỉu' }; }
    
    runSubModel11(results, model) {
        if (results.length < model.minLength) return null;
        let last = results[results.length-1];
        switch (model.logic) {
            case 'pure': if (this.isPerfectAlternating(results,4)) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Cầu 1-1 thuần', model_name: model.name }; break;
            case 'variant': if (this.isAlternatingWithTolerance(results,1)) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.8, reason: 'Cầu 1-1 biến thể', model_name: model.name }; break;
            case 'long': let alt = this.countAlternating(results.slice(-12)); if (alt >= 8) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7 + alt/20, reason: `Cầu 1-1 dài (${alt}/11)`, model_name: model.name }; break;
            case 'break': let last4 = results.slice(-4); if (last4[0] !== last4[1] && last4[1] !== last4[2] && last4[2] !== last4[3] && this.getStreak(results.slice(0,-1)) > 4) return { prediction: last, confidence: 0.8, reason: 'Cầu 1-1 sắp gãy', model_name: model.name }; break;
        }
        return null;
    }
    
    runSubModel22(results, model) {
        if (results.length < model.minLength) return null;
        let last6 = results.slice(-6), last8 = results.slice(-8);
        switch (model.logic) {
            case 'pure': if (last6.length===6 && last6[0]===last6[1] && last6[1]!==last6[2] && last6[2]===last6[3] && last6[3]!==last6[4] && last6[4]===last6[5]) return { prediction: last6[4]==='Tài'?'Xỉu':'Tài', confidence: 0.9, reason: 'Cầu 2-2 chuẩn', model_name: model.name }; break;
            case 'long': let score = 0; for (let i=0; i<7; i+=2) if (last8[i]===last8[i+1]) score++; if (score>=3) return { prediction: results[results.length-1]==='Tài'?'Xỉu':'Tài', confidence: 0.7+score*0.05, reason: `Cầu 2-2 dài (${score}/4)`, model_name: model.name }; break;
        }
        return null;
    }
    
    runSubModelStreak(results, model) {
        if (results.length < model.minLength) return null;
        let last = results[results.length-1], streak = this.getStreak(results);
        switch (model.logic) {
            case 'short': if (streak>=2 && streak<=3) return { prediction: last, confidence: 0.7+streak*0.05, reason: `Bệt ${streak}p`, model_name: model.name };
            case 'medium': if (streak>=4 && streak<=5) return { prediction: last, confidence: 0.75+(streak-4)*0.05, reason: `Bệt ${streak}p`, model_name: model.name };
            case 'long': if (streak>=6) return { prediction: last, confidence: 0.8+Math.min(streak,10)*0.01, reason: `Bệt ${streak}p`, model_name: model.name };
            case 'break': if (streak>=4) return { prediction: last==='Tài'?'Xỉu':'Tài', confidence: 0.6+streak*0.03, reason: `Bệt ${streak}p sắp gãy`, model_name: model.name };
            case 'super': if (streak>=8) return { prediction: last, confidence: 0.9, reason: `Siêu bệt ${streak}p`, model_name: model.name };
        }
        return null;
    }
    
    runSubModel(index, history) {
        if (history.length < 3) return null;
        let results = this.getResultArray(history), model = this.subModels[`sub_model_${index}`];
        if (!model) return null;
        let result = null;
        switch (model.type) {
            case '1-1': result = this.runSubModel11(results, model); break;
            case '2-2': result = this.runSubModel22(results, model); break;
            case 'bệt': result = this.runSubModelStreak(results, model); break;
            default: return null;
        }
        if (result) result.model_name = model.name;
        return result;
    }
    
    analyzeBasicPatterns(history) {
        let results = this.getResultArray(history);
        if (results.length < 3) return { prediction: null, confidence: 0, reason: 'Không đủ dữ liệu' };
        let last = results[results.length-1], alt = true;
        for (let i = results.length-4; i < results.length-1; i++) if (results[i] === results[i+1]) { alt = false; break; }
        if (alt && results.length>=4) return { prediction: last==='Tài'?'Xỉu':'Tài', confidence: 0.75, reason: 'Cầu 1-1', pattern_type: '1-1' };
        let streak = this.getStreak(results);
        if (streak >= 3) return { prediction: last, confidence: 0.6+streak*0.05, reason: `Bệt ${streak}p`, pattern_type: 'bệt' };
        return { prediction: last==='Tài'?'Xỉu':'Tài', confidence: 0.5, reason: 'Theo ván trước', pattern_type: 'default' };
    }
    
    analyzeTrend(history) {
        let results = this.getResultArray(history);
        if (results.length < 5) return { prediction: null, confidence: 0 };
        let short = results.slice(-3), shortTai = short.filter(r=>r==='Tài').length;
        if (shortTai >= 2) return { prediction: shortTai===3?'Xỉu':'Tài', confidence: 0.65, reason: 'Xu hướng ngắn' };
        return { prediction: results[results.length-1]==='Tài'?'Xỉu':'Tài', confidence: 0.55, reason: 'Đảo chiều' };
    }
    
    analyzeImbalance(history) {
        let results = this.getResultArray(history.slice(-12));
        if (results.length < 12) return { prediction: null, confidence: 0 };
        let tai = results.filter(r=>r==='Tài').length, xiu = 12 - tai;
        if (Math.abs(tai-xiu) >= 4) return { prediction: tai > xiu ? 'Xỉu' : 'Tài', confidence: 0.7, reason: `Cân bằng (${tai}T-${xiu}X)` };
        return { prediction: results[results.length-1], confidence: 0.5, reason: 'Tiếp xu hướng' };
    }
    
    analyzeShortTerm(history) {
        let results = this.getResultArray(history);
        if (results.length < 3) return { prediction: null, confidence: 0 };
        let last3 = results.slice(-3);
        if (last3[0]===last3[1] && last3[1]===last3[2]) return { prediction: last3[0], confidence: 0.75, reason: 'Bệt 3' };
        if (last3[0]===last3[1]) return { prediction: last3[2], confidence: 0.7, reason: 'Cầu 2-1' };
        if (last3[0]!==last3[1] && last3[1]===last3[2]) return { prediction: last3[2]==='Tài'?'Xỉu':'Tài', confidence: 0.65, reason: 'Cầu 1-2' };
        return { prediction: results[results.length-1], confidence: 0.5, reason: 'Không rõ' };
    }
    
    ensembleModels(history) {
        let results = this.getResultArray(history);
        if (results.length < 5) return { prediction: 'Tài', confidence: 0.5, reason: 'Không đủ dữ liệu', pattern_type: 'default', pattern: '', details: [] };
        
        let predictions = [];
        let basic = this.analyzeBasicPatterns(history);
        if (basic.prediction) predictions.push({ prediction: basic.prediction, confidence: basic.confidence, weight: 1.0, model: 'basic', reason: basic.reason });
        
        let trend = this.analyzeTrend(history);
        if (trend.prediction) predictions.push({ prediction: trend.prediction, confidence: trend.confidence, weight: 1.0, model: 'trend', reason: trend.reason });
        
        let imbalance = this.analyzeImbalance(history);
        if (imbalance.prediction) predictions.push({ prediction: imbalance.prediction, confidence: imbalance.confidence, weight: 1.0, model: 'imbalance', reason: imbalance.reason });
        
        let short = this.analyzeShortTerm(history);
        if (short.prediction) predictions.push({ prediction: short.prediction, confidence: short.confidence, weight: 1.0, model: 'short', reason: short.reason });
        
        for (let i = 1; i <= 42; i++) {
            let sub = this.runSubModel(i, history);
            if (sub && sub.prediction) predictions.push({ prediction: sub.prediction, confidence: sub.confidence, weight: this.subModelWeights[`sub_model_${i}`]||1.0, model: sub.model_name, reason: sub.reason });
        }
        
        let taiScore = 0, xiuScore = 0;
        for (let p of predictions) {
            let wc = p.confidence * p.weight;
            if (p.prediction === 'Tài') taiScore += wc;
            else xiuScore += wc;
        }
        
        let finalPrediction = taiScore >= xiuScore ? 'Tài' : 'Xỉu';
        let finalConfidence = Math.min(0.9, Math.max(0.55, (Math.max(taiScore, xiuScore) / (taiScore+xiuScore))));
        if (sunwinStats.consecutiveLosses >= 3) finalPrediction = finalPrediction === 'Tài' ? 'Xỉu' : 'Tài', finalConfidence = 0.5;
        
        let best = predictions.sort((a,b)=>b.confidence - a.confidence)[0];
        return { prediction: finalPrediction, confidence: finalConfidence, reason: best?.reason || 'Ensemble', pattern_type: best?.model || 'unknown', pattern: results.slice(-5).join(''), details: predictions.slice(0,3) };
    }
    
    updateModelWeights(actual, predicted, confidence) {
        let correct = actual === predicted;
        for (let k in this.modelWeights) this.modelWeights[k] = Math.min(2.0, Math.max(0.5, this.modelWeights[k] * (correct ? 1.01 : 0.99)));
        for (let k in this.subModelWeights) this.subModelWeights[k] = Math.min(1.5, Math.max(0.7, this.subModelWeights[k] * (correct ? 1.005 : 0.995)));
        for (let k in this.miniModelWeights) this.miniModelWeights[k] = Math.min(1.3, Math.max(0.8, this.miniModelWeights[k] * (correct ? 1.003 : 0.997)));
        saveSunwinModelWeights();
    }
}

const sunwinAnalyzer = new SunwinAnalyzer();

// ==================== SUNWIN WEBSOCKET ====================
const SUNWIN_WS_URL = "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXBpc3Vud2luMTIzIn0.hgrRbSV6vnBwJMg9ZFtbx3rRu9mX_hZMZ_m5gMNhkw0";

let sunwinWs = null;
let sunwinPingInterval = null;
let sunwinReconnectTimeout = null;

function connectSunwin() {
    if (sunwinWs) { sunwinWs.removeAllListeners(); sunwinWs.close(); }
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
                    sunwinStats.total++; correct ? (sunwinStats.correct++, sunwinStats.consecutiveLosses = 0) : (sunwinStats.wrong++, sunwinStats.consecutiveLosses++);
                    sunwinAnalyzer.updateModelWeights(result, sunwinLastPrediction.ket_qua, parseInt(sunwinLastPrediction.do_tin_cay));
                }
                let historyForAnalysis = sunwinHistory.map(h => ({ Ket_qua: h.Ket_qua, score: h.Tong, Xuc_xac_1: h.Xuc_xac_1, Xuc_xac_2: h.Xuc_xac_2, Xuc_xac_3: h.Xuc_xac_3 }));
                let ensemble = sunwinAnalyzer.ensembleModels(historyForAnalysis);
                let finalPred = ensemble.prediction, finalConf = ensemble.confidence, finalType = ensemble.pattern_type, finalPattern = ensemble.pattern;
                if (sunwinStats.consecutiveLosses >= 3) finalPred = finalPred === 'Tài' ? 'Xỉu' : 'Tài', finalConf = 0.4, finalType = 'CHỐNG ĐẢO';
                sunwinLastPrediction = { phien: sunwinCurrentSessionId ? parseInt(sunwinCurrentSessionId)+1 : null, ket_qua: finalPred, loai_cau: finalType, mau_cau: finalPattern, do_tin_cay: (finalConf*100).toFixed(0)+'%' };
                let tiLe = sunwinStats.total > 0 ? ((sunwinStats.correct/sunwinStats.total)*100).toFixed(1)+'%' : '0%';
                sunwinApiResponse = {
                    "Phien": sunwinCurrentSessionId, "Xuc_xac_1": d1, "Xuc_xac_2": d2, "Xuc_xac_3": d3,
                    "Tong": total, "Ket_qua": result, "Phien_hien_tai": sunwinCurrentSessionId ? parseInt(sunwinCurrentSessionId)+1 : null,
                    "Du_doan": finalPred, "Loai_cau": finalType, "Mau_cau_phat_hien": finalPattern,
                    "Do_tin_cay": (finalConf*100).toFixed(0)+'%', "Trang_thai": sunwinStats.consecutiveLosses>=3?'Chống đảo':'Theo cầu',
                    "Ket_qua_du_doan": correct ? '✅' : (sunwinStats.total>0?'❌':''), "Thong_ke": { "tong": sunwinStats.total, "dung": sunwinStats.correct, "sai": sunwinStats.wrong, "ti_le": tiLe },
                    "id": "@tranhoang2286"
                };
                let entry = { phien: sunwinCurrentSessionId, Xuc_xac_1: d1, Xuc_xac_2: d2, Xuc_xac_3: d3, Tong: total, Ket_qua: result, du_doan: finalPred, loai_cau: finalType, do_tin_cay: (finalConf*100).toFixed(0)+'%', thoi_gian: new Date().toISOString() };
                saveSunwinHistory(entry);
                console.log(`[Sunwin] P${sunwinCurrentSessionId}: ${d1}${d2}${d3}=${total} → ${result} | Dự đoán: ${finalPred} (${(finalConf*100).toFixed(0)}%) ${correct?'✅':'❌'}`);
                sunwinCurrentSessionId = null;
            }
        } catch(e) {}
    });
    sunwinWs.on('close', () => { clearInterval(sunwinPingInterval); setTimeout(connectSunwin, 5000); });
    sunwinWs.on('error', () => {});
}

// ==================== LC79 - GIỮ NGUYÊN TỪ lc.js ====================

const LC79_HU_URL = 'https://wtx.tele68.com/v1/tx/sessions';
const LC79_MD5_URL = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';

let lc79PredictionHistory = { hu: [], md5: [] };
let lc79LearningData = {
    hu: { totalPredictions: 0, correctPredictions: 0, streakAnalysis: { currentStreak: 0 } },
    md5: { totalPredictions: 0, correctPredictions: 0, streakAnalysis: { currentStreak: 0 } }
};

if (fs.existsSync(LC79_HISTORY_FILE)) {
    try { lc79PredictionHistory = JSON.parse(fs.readFileSync(LC79_HISTORY_FILE, 'utf8')); } catch(e) {}
}
if (fs.existsSync(LC79_LEARNING_FILE)) {
    try { lc79LearningData = JSON.parse(fs.readFileSync(LC79_LEARNING_FILE, 'utf8')); } catch(e) {}
}

function saveLC79History() { fs.writeFileSync(LC79_HISTORY_FILE, JSON.stringify(lc79PredictionHistory, null, 2)); }
function saveLC79Learning() { fs.writeFileSync(LC79_LEARNING_FILE, JSON.stringify(lc79LearningData, null, 2)); }

async function fetchLC79(type) {
    try {
        let url = type === 'hu' ? LC79_HU_URL : LC79_MD5_URL;
        let res = await axios.get(url, { timeout: 10000 });
        if (res.data?.list) return res.data.list.map(item => ({
            Phien: item.id, Ket_qua: item.resultTruyenThong === 'TAI' ? 'Tài' : 'Xỉu',
            Xuc_xac_1: item.dices[0], Xuc_xac_2: item.dices[1], Xuc_xac_3: item.dices[2], Tong: item.point
        }));
        return null;
    } catch(e) { console.error(`[LC79] Error:`, e.message); return null; }
}

function analyzeCauBetLC79(results) {
    if (results.length < 3) return null;
    let streak = 1;
    for (let i = results.length-2; i>=0; i--) { if (results[i] === results[results.length-1]) streak++; else break; }
    if (streak >= 3) {
        let shouldBreak = streak >= 5;
        return { prediction: shouldBreak ? (results[0]==='Tài'?'Xỉu':'Tài') : results[0], confidence: 65 + Math.min(20, streak*2), name: `Cầu bệt ${streak}p` };
    }
    return null;
}

function analyzeCauDao11LC79(results) {
    if (results.length < 4) return null;
    let isAlt = true;
    for (let i = results.length-4; i < results.length-1; i++) if (results[i] === results[i+1]) { isAlt = false; break; }
    if (isAlt) return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 70, name: 'Cầu đảo 1-1' };
    return null;
}

function calculateLC79Prediction(data, type) {
    let results = data.map(d => d.Ket_qua);
    if (results.length < 5) return { prediction: 'Tài', confidence: 60, factors: ['Không đủ dữ liệu'] };
    let predictions = [];
    let cauBet = analyzeCauBetLC79(results); if (cauBet) predictions.push(cauBet);
    let cauDao = analyzeCauDao11LC79(results); if (cauDao) predictions.push(cauDao);
    if (predictions.length === 0) return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 55, factors: ['Theo ván trước'] };
    let taiScore = 0, xiuScore = 0;
    for (let p of predictions) { if (p.prediction === 'Tài') taiScore += p.confidence; else xiuScore += p.confidence; }
    let finalPred = taiScore >= xiuScore ? 'Tài' : 'Xỉu';
    let finalConf = Math.min(92, Math.max(60, (Math.max(taiScore, xiuScore) / (taiScore+xiuScore)) * 100));
    let streak = lc79LearningData[type].streakAnalysis.currentStreak;
    if (streak <= -3) finalPred = finalPred === 'Tài' ? 'Xỉu' : 'Tài', finalConf = Math.min(finalConf, 68);
    return { prediction: finalPred, confidence: Math.round(finalConf), factors: predictions.map(p => p.name) };
}

function updateLC79Result(type, actual, predicted) {
    let correct = actual === predicted;
    let data = lc79LearningData[type];
    if (correct) { data.correctPredictions++; if (data.streakAnalysis.currentStreak >= 0) data.streakAnalysis.currentStreak++; else data.streakAnalysis.currentStreak = 1; }
    else { if (data.streakAnalysis.currentStreak <= 0) data.streakAnalysis.currentStreak--; else data.streakAnalysis.currentStreak = -1; }
    data.totalPredictions++;
    saveLC79Learning();
    return correct;
}

// ==================== API ENDPOINTS ====================

// Sunwin - GIỮ NGUYÊN ENDPOINT /api/sieu
app.get('/api/sieu', (req, res) => {
    res.json(sunwinApiResponse);
});

app.get('/api/sunwin/history', (req, res) => {
    res.json({ success: true, total: sunwinHistory.length, data: sunwinHistory.slice(-20).reverse(), stats: { tong: sunwinStats.total, dung: sunwinStats.correct, sai: sunwinStats.wrong, ti_le: sunwinStats.total>0?((sunwinStats.correct/sunwinStats.total)*100).toFixed(1)+'%':'0%' } });
});

app.get('/api/sunwin/models', (req, res) => {
    res.json({ main: Object.keys(sunwinModelWeights).length, sub: Object.keys(sunwinSubModelWeights).length, mini: Object.keys(sunwinMiniModelWeights).length, total: 84 });
});

// LC79 endpoints
app.get('/lc79-hu', async (req, res) => {
    try {
        let data = await fetchLC79('hu');
        if (!data?.length) return res.json({ error: 'Không thể lấy dữ liệu' });
        let prediction = calculateLC79Prediction(data, 'hu');
        let latest = data[0];
        let record = { Phien: latest.Phien, Xuc_xac_1: latest.Xuc_xac_1, Xuc_xac_2: latest.Xuc_xac_2, Xuc_xac_3: latest.Xuc_xac_3, Tong: latest.Tong, Ket_qua: latest.Ket_qua, Do_tin_cay: `${prediction.confidence}%`, Phien_hien_tai: latest.Phien + 1, Du_doan: prediction.prediction, ket_qua_du_doan: '', id: '@tranhoang2286', timestamp: new Date().toISOString() };
        lc79PredictionHistory.hu.unshift(record);
        if (lc79PredictionHistory.hu.length > 100) lc79PredictionHistory.hu.pop();
        saveLC79History();
        res.json(record);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/lc79-md5', async (req, res) => {
    try {
        let data = await fetchLC79('md5');
        if (!data?.length) return res.json({ error: 'Không thể lấy dữ liệu' });
        let prediction = calculateLC79Prediction(data, 'md5');
        let latest = data[0];
        let record = { Phien: latest.Phien, Xuc_xac_1: latest.Xuc_xac_1, Xuc_xac_2: latest.Xuc_xac_2, Xuc_xac_3: latest.Xuc_xac_3, Tong: latest.Tong, Ket_qua: latest.Ket_qua, Do_tin_cay: `${prediction.confidence}%`, Phien_hien_tai: latest.Phien + 1, Du_doan: prediction.prediction, ket_qua_du_doan: '', id: '@tranhoang2286', timestamp: new Date().toISOString() };
        lc79PredictionHistory.md5.unshift(record);
        if (lc79PredictionHistory.md5.length > 100) lc79PredictionHistory.md5.pop();
        saveLC79History();
        res.json(record);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/lc79-hu/lichsu', (req, res) => {
    res.json({ type: 'Lẩu Cua 79 - Tài Xỉu Hũ', history: lc79PredictionHistory.hu, total: lc79PredictionHistory.hu.length });
});

app.get('/lc79-md5/lichsu', (req, res) => {
    res.json({ type: 'Lẩu Cua 79 - Tài Xỉu MD5', history: lc79PredictionHistory.md5, total: lc79PredictionHistory.md5.length });
});

app.get('/lc79-hu/learning', (req, res) => {
    let stats = lc79LearningData.hu;
    res.json({ totalPredictions: stats.totalPredictions, correctPredictions: stats.correctPredictions, overallAccuracy: stats.totalPredictions>0?((stats.correctPredictions/stats.totalPredictions)*100).toFixed(2)+'%':'0%', streakAnalysis: stats.streakAnalysis });
});

app.get('/lc79-md5/learning', (req, res) => {
    let stats = lc79LearningData.md5;
    res.json({ totalPredictions: stats.totalPredictions, correctPredictions: stats.correctPredictions, overallAccuracy: stats.totalPredictions>0?((stats.correctPredictions/stats.totalPredictions)*100).toFixed(2)+'%':'0%', streakAnalysis: stats.streakAnalysis });
});

// Root
app.get('/', (req, res) => {
    res.json({
        status: 'active', message: 'SUPER API - Sunwin + LC79', version: '1.0',
        endpoints: { sunwin: ['/api/sieu', '/api/sunwin/history', '/api/sunwin/models'], lc79: ['/lc79-hu', '/lc79-md5', '/lc79-hu/lichsu', '/lc79-md5/lichsu', '/lc79-hu/learning', '/lc79-md5/learning'] },
        id: '@tranhoang2286'
    });
});

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 ===== SUPER API TÀI XỈU =====`);
    console.log(`🌐 Server: http://0.0.0.0:${PORT}`);
    console.log(`\n📌 ENDPOINTS:`);
    console.log(`   Sunwin:     /api/sieu (GIỮ NGUYÊN)`);
    console.log(`   Sunwin:     /api/sunwin/history, /api/sunwin/models`);
    console.log(`   LC79 Hũ:    /lc79-hu, /lc79-hu/lichsu, /lc79-hu/learning`);
    console.log(`   LC79 MD5:   /lc79-md5, /lc79-md5/lichsu, /lc79-md5/learning`);
    console.log(`\n✅ Sunwin API giữ nguyên format 84 models`);
    console.log(`✅ LC79 API giữ nguyên thuật toán từ lc.js`);
    console.log(`=====================================\n`);
});

connectSunwin();
