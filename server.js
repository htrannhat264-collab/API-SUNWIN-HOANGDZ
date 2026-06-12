// apisun.js - Cập nhật link game Sunwin
const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3001;

// ==================== FILE STORAGE ====================
const HISTORY_FILE = './history.json';
const PATTERNS_FILE = './patterns.json';
const MODEL_WEIGHTS_FILE = './model_weights.json';

// Load history if exists
let resultHistory = [];
if (fs.existsSync(HISTORY_FILE)) {
    try {
        resultHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        console.log(`[📂] Đã tải ${resultHistory.length} phiên từ history.json`);
    } catch (e) {
        console.error('[❌] Lỗi đọc history.json:', e.message);
    }
}

// Nếu không có lịch sử, tạo dữ liệu mẫu
if (resultHistory.length === 0) {
    console.log('[📝] Không có lịch sử, tạo dữ liệu mẫu...');
    const sampleData = [
        { phien: 3134470, Xuc_xac_1: 4, Xuc_xac_2: 2, Xuc_xac_3: 3, Tong: 9, Ket_qua: "Xỉu", du_doan: "Xỉu", loai_cau: "Cầu bệt", do_tin_cay: "75%", thoi_gian: new Date().toISOString() },
        { phien: 3134471, Xuc_xac_1: 5, Xuc_xac_2: 1, Xuc_xac_3: 6, Tong: 12, Ket_qua: "Tài", du_doan: "Tài", loai_cau: "Cầu đảo", do_tin_cay: "70%", thoi_gian: new Date().toISOString() },
        { phien: 3134472, Xuc_xac_1: 3, Xuc_xac_2: 3, Xuc_xac_3: 3, Tong: 9, Ket_qua: "Xỉu", du_doan: "Xỉu", loai_cau: "Cầu bệt", do_tin_cay: "80%", thoi_gian: new Date().toISOString() },
        { phien: 3134473, Xuc_xac_1: 6, Xuc_xac_2: 4, Xuc_xac_3: 1, Tong: 11, Ket_qua: "Tài", du_doan: "Xỉu", loai_cau: "Bẻ cầu 1-1", do_tin_cay: "71%", thoi_gian: new Date().toISOString() },
        { phien: 3134474, Xuc_xac_1: 6, Xuc_xac_2: 5, Xuc_xac_3: 6, Tong: 17, Ket_qua: "Tài", du_doan: "Xỉu", loai_cau: "Bẻ cầu 1-1", do_tin_cay: "71%", thoi_gian: new Date().toISOString() }
    ];
    resultHistory.push(...sampleData);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(resultHistory, null, 2));
    console.log('[✅] Đã tạo dữ liệu mẫu');
}

// Load model weights if exists
let modelWeights = {
    'model1': 1.0, 'model2': 1.0, 'model3': 1.0, 'model4': 1.0,
    'model5': 1.0, 'model6': 1.0, 'model7': 1.0, 'model8': 1.0,
    'model9': 1.0, 'model10': 1.0, 'model11': 1.0, 'model12': 1.0,
    'model13': 1.0, 'model14': 1.0, 'model15': 1.0, 'model16': 1.0,
    'model17': 1.0, 'model18': 1.0, 'model19': 1.0, 'model20': 1.0,
    'model21': 1.0
};

let subModelWeights = {};
for (let i = 1; i <= 42; i++) {
    subModelWeights[`sub_model_${i}`] = 1.0;
}

let miniModelWeights = {};
for (let i = 1; i <= 21; i++) {
    miniModelWeights[`mini_model_${i}`] = 1.0;
}

if (fs.existsSync(MODEL_WEIGHTS_FILE)) {
    try {
        const savedWeights = JSON.parse(fs.readFileSync(MODEL_WEIGHTS_FILE, 'utf8'));
        modelWeights = savedWeights.modelWeights || modelWeights;
        subModelWeights = savedWeights.subModelWeights || subModelWeights;
        miniModelWeights = savedWeights.miniModelWeights || miniModelWeights;
        console.log('[📂] Đã tải model_weights.json');
    } catch (e) {
        console.error('[❌] Lỗi đọc model_weights.json:', e.message);
    }
}

// Save history
function saveHistory(entry) {
    resultHistory.push(entry);
    if (resultHistory.length > 1000) resultHistory.shift();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(resultHistory, null, 2));
}

// Save model weights
function saveModelWeights() {
    const weights = {
        modelWeights,
        subModelWeights,
        miniModelWeights
    };
    fs.writeFileSync(MODEL_WEIGHTS_FILE, JSON.stringify(weights, null, 2));
}

// ==================== GLOBAL VARIABLES ====================
let currentSessionId = 3134474;
let lastResult = null;
let lastPrediction = {
    phien: 3134475,
    ket_qua: "Xỉu",
    loai_cau: "Bẻ cầu 1-1",
    mau_cau: "Xỉu Tài Xỉu Tài",
    do_tin_cay: "71%"
};
let stats = {
    total: 105,
    correct: 47,
    wrong: 58,
    consecutiveLosses: 0,
    modelPerformance: {}
};

let apiResponseData = {
    "Phien": 3134474,
    "Xuc_xac_1": 6,
    "Xuc_xac_2": 5,
    "Xuc_xac_3": 6,
    "Tong": 17,
    "Ket_qua": "Tài",
    "Phien_hien_tai": 3134475,
    "Du_doan": "Xỉu",
    "Loai_cau": "Bẻ cầu 1-1",
    "Mau_cau_phat_hien": "Xỉu Tài Xỉu Tài",
    "Do_tin_cay": "71%",
    "Trang_thai": "Đang theo cầu",
    "Ket_qua_du_doan": "❌",
    "Link_game": "https://web.sunwin.tg/?affId=Sunwin",
    "Thong_ke": {
        "tong": 105,
        "dung": 47,
        "sai": 58,
        "ti_le": "44.8%"
    },
    "id": "@tranhoang2286"
};

// ==================== TAI XIU ANALYZER (GIỮ NGUYÊN THUẬT TOÁN) ====================

class TaiXiuAnalyzer {
    constructor() {
        this.modelWeights = modelWeights;
        this.subModelWeights = subModelWeights;
        this.miniModelWeights = miniModelWeights;
        this.subModels = {};
        this.miniModels = {};
        this.patternLibrary = this.loadPatternLibrary();
        this.initSubModels();
        this.initMiniModels();
    }
    
    loadPatternLibrary() {
        if (fs.existsSync(PATTERNS_FILE)) {
            try { return JSON.parse(fs.readFileSync(PATTERNS_FILE, 'utf8')); }
            catch (e) {}
        }
        return { '1-1': [], '2-2': [], '3-3': [], '1-2': [], '2-1': [], '2-1-2': [], '1-2-1': [], 'bệt': [], 'loạn': [] };
    }
    
    savePatternLibrary() { fs.writeFileSync(PATTERNS_FILE, JSON.stringify(this.patternLibrary, null, 2)); }
    
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
            this.subModels[`sub_model_${i}`] = {
                ...subModelSpecialties[i],
                weight: this.subModelWeights[`sub_model_${i}`] || 1.0,
                accuracy: 0.5,
                predictions: []
            };
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
                accuracy: 0.5,
                specialty: specialties[i] || 'chung',
                predictions: []
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
            case 'pure': if (this.isPerfectAlternating(results,4)) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Phát hiện cầu 1-1 thuần túy', model_name: model.name }; break;
            case 'variant': if (this.isAlternatingWithTolerance(results,1)) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.8, reason: 'Phát hiện cầu 1-1 biến thể', model_name: model.name }; break;
            case 'long': let altCount = this.countAlternating(results.slice(-12)); if (altCount >= 8) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7 + (altCount / 20), reason: `Cầu 1-1 dài hạn với ${altCount}/11 cặp xen kẽ`, model_name: model.name }; break;
            case 'hybrid': let recent = results.slice(-5); if (recent[0] !== recent[1] && recent[1] !== recent[2] && recent[3] !== recent[4]) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7, reason: 'Phát hiện cầu 1-1 kết hợp', model_name: model.name }; break;
            case 'break': let last4 = results.slice(-4); if (last4[0] !== last4[1] && last4[1] !== last4[2] && last4[2] !== last4[3]) { let streak = this.getStreak(results.slice(0, -1)); if (streak > 4) return { prediction: last, confidence: 0.8, reason: 'Cầu 1-1 dài sắp gãy, dự đoán giữ nguyên', model_name: model.name }; } break;
            case 'recovery': if (last4[0] === last4[1] && last4[1] !== last4[2] && last4[2] !== last4[3]) return { prediction: last4[3] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7, reason: 'Cầu 1-1 đang phục hồi sau gãy', model_name: model.name }; break;
        }
        return null;
    }
    
    runSubModel22(results, model) {
        if (results.length < model.minLength) return null;
        let last6 = results.slice(-6), last8 = results.slice(-8);
        switch (model.logic) {
            case 'pure': if (last6.length === 6 && last6[0] === last6[1] && last6[1] !== last6[2] && last6[2] === last6[3] && last6[3] !== last6[4] && last6[4] === last6[5]) return { prediction: last6[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Phát hiện cầu 2-2 chuẩn', model_name: model.name }; break;
            case 'offset': if (last6.length === 6 && last6[0] === last6[1] && last6[1] !== last6[2] && last6[2] !== last6[3] && last6[3] === last6[4] && last6[4] !== last6[5]) return { prediction: last6[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.8, reason: 'Phát hiện cầu 2-2 lệch', model_name: model.name }; break;
            case 'variant': if (last8.length === 8 && last8[0] === last8[1] && last8[1] !== last8[2] && last8[2] === last8[3] && last8[3] !== last8[4] && last8[4] === last8[5] && last8[5] !== last8[6] && last8[6] === last8[7]) return { prediction: last8[6] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.75, reason: 'Phát hiện cầu 2-2 biến tướng', model_name: model.name }; break;
            case 'hybrid': if (last6.length === 6 && last6[0] === last6[1] && last6[1] !== last6[2] && last6[2] !== last6[3] && last6[3] !== last6[4] && last6[4] === last6[5]) return { prediction: last6[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7, reason: 'Cầu 2-2 kết hợp 1-1', model_name: model.name }; break;
            case 'long': let score = 0; for (let i = 0; i < 7; i+=2) if (last8[i] === last8[i+1]) score++; if (score >= 3) return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7 + (score * 0.05), reason: `Cầu 2-2 dài với ${score}/4 cặp đúng`, model_name: model.name }; break;
            case 'break': if (last6.length === 6 && last6[0] === last6[1] && last6[1] !== last6[2] && last6[2] === last6[3] && last6[3] !== last6[4] && last6[4] !== last6[5]) return { prediction: last6[4], confidence: 0.85, reason: 'Phát hiện bẻ cầu 2-2', model_name: model.name }; break;
        }
        return null;
    }
    
    runSubModelStreak(results, model) {
        if (results.length < model.minLength) return null;
        let last = results[results.length-1], other = last === 'Tài' ? 'Xỉu' : 'Tài';
        let streak = 1;
        for (let i = results.length-2; i >= 0; i--) { if (results[i] === last) streak++; else break; }
        switch (model.logic) {
            case 'short': if (streak >= 2 && streak <= 3) return { prediction: last, confidence: 0.7 + (streak * 0.05), reason: `Bệt ngắn ${streak} phiên`, model_name: model.name };
            case 'medium': if (streak >= 4 && streak <= 5) return { prediction: last, confidence: 0.75 + ((streak - 4) * 0.05), reason: `Bệt trung ${streak} phiên`, model_name: model.name };
            case 'long': if (streak >= 6) return { prediction: last, confidence: 0.8 + (Math.min(streak, 10) * 0.01), reason: `Bệt dài ${streak} phiên`, model_name: model.name };
            case 'break': if (streak >= 4) return { prediction: other, confidence: 0.6 + (streak * 0.03), reason: `Bệt ${streak} phiên, dự đoán sắp gãy`, model_name: model.name };
            case 'hybrid': if (streak >= 3) { let prev = results[results.length - streak - 1]; if (prev && prev !== last) return { prediction: last, confidence: 0.7, reason: `Bệt sau khi đảo từ ${prev}`, model_name: model.name }; } break;
            case 'super': if (streak >= 8) return { prediction: last, confidence: 0.9, reason: `Siêu bệt ${streak} phiên`, model_name: model.name };
        }
        return null;
    }
    
    runSubModel33(results, model) {
        if (results.length < model.minLength) return null;
        let last9 = results.slice(-9), last12 = results.slice(-12);
        switch (model.logic) {
            case 'pure': if (last9.length === 9 && last9[0] === last9[1] && last9[1] === last9[2] && last9[3] === last9[4] && last9[4] === last9[5] && last9[6] === last9[7] && last9[7] === last9[8] && last9[0] !== last9[3] && last9[3] !== last9[6]) return { prediction: last9[6] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Phát hiện cầu 3-3 chuẩn', model_name: model.name }; break;
            case 'variant': let score = 0; for (let i = 0; i < 12; i+=3) if (i+2 < 12 && last12[i] === last12[i+1] && last12[i+1] === last12[i+2]) score++; if (score >= 3) return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7 + (score * 0.05), reason: `Cầu 3-3 biến thể với ${score}/4 bộ ba`, model_name: model.name }; break;
            case 'short': if (results.length >= 6) { let last6 = results.slice(-6); if (last6[0] === last6[1] && last6[1] === last6[2] && last6[3] === last6[4] && last6[4] === last6[5]) return { prediction: last6[3] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7, reason: 'Cầu 3-3 ngắn (6 phiên)', model_name: model.name }; } break;
            case 'hybrid': if (last9.length === 9 && last9[0] === last9[1] && last9[1] === last9[2] && last9[3] !== last9[4] && last9[5] === last9[6] && last9[6] === last9[7]) return { prediction: last9[6] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.75, reason: 'Cầu 3-3 kết hợp', model_name: model.name }; break;
            case 'break': if (last9.length === 9 && last9[0] === last9[1] && last9[1] === last9[2] && last9[3] === last9[4] && last9[4] === last9[5] && last9[6] !== last9[7]) return { prediction: last9[6], confidence: 0.8, reason: 'Phát hiện bẻ cầu 3-3', model_name: model.name }; break;
            case 'long': if (results.length >= 15) { let last15 = results.slice(-15), pattern = []; for (let i = 0; i < 15; i+=3) if (i+2 < 15 && last15[i] === last15[i+1] && last15[i+1] === last15[i+2]) pattern.push(last15[i]); if (pattern.length >= 4 && pattern[0] !== pattern[1] && pattern[1] !== pattern[2]) return { prediction: pattern[pattern.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.8, reason: 'Cầu 3-3 dài hạn', model_name: model.name }; } break;
        }
        return null;
    }
    
    runSubModel212(results, model) {
        if (results.length < model.minLength) return null;
        let last5 = results.slice(-5), last7 = results.slice(-7);
        switch (model.logic) {
            case 'pure': if (last5.length === 5 && last5[0] === last5[1] && last5[1] !== last5[2] && last5[2] !== last5[3] && last5[3] === last5[4] && last5[0] === last5[3]) return { prediction: last5[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Phát hiện cầu 2-1-2 chuẩn', model_name: model.name }; break;
            case 'variant': if (last7.length === 7 && last7[0] === last7[1] && last7[1] !== last7[2] && last7[3] === last7[4] && last7[4] !== last7[5] && last7[0] === last7[3]) return { prediction: last7[5] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.8, reason: 'Phát hiện cầu 2-1-2 biến thể', model_name: model.name }; break;
            case 'long': if (results.length >= 10) { let last10 = results.slice(-10), count = 0; for (let i = 0; i < 5; i+=2) if (i+4 < 10 && last10[i] === last10[i+1] && last10[i+1] !== last10[i+2] && last10[i+3] === last10[i+4]) count++; if (count >= 2) return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.75, reason: 'Cầu 2-1-2 dài hạn', model_name: model.name }; } break;
        }
        return null;
    }
    
    runSubModel121(results, model) {
        if (results.length < model.minLength) return null;
        let last5 = results.slice(-5), last7 = results.slice(-7);
        switch (model.logic) {
            case 'pure': if (last5.length === 5 && last5[0] !== last5[1] && last5[1] === last5[2] && last5[2] !== last5[3] && last5[3] === last5[4] && last5[0] === last5[3]) return { prediction: last5[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Phát hiện cầu 1-2-1 chuẩn', model_name: model.name }; break;
            case 'variant': if (last7.length === 7 && last7[0] !== last7[1] && last7[1] === last7[2] && last7[3] !== last7[4] && last7[4] === last7[5] && last7[0] === last7[3]) return { prediction: last7[5] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.8, reason: 'Phát hiện cầu 1-2-1 biến thể', model_name: model.name }; break;
            case 'long': if (results.length >= 10) { let last10 = results.slice(-10), count = 0; for (let i = 0; i < 5; i+=2) if (i+4 < 10 && last10[i] !== last10[i+1] && last10[i+1] === last10[i+2] && last10[i+3] === last10[i+4]) count++; if (count >= 2) return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.75, reason: 'Cầu 1-2-1 dài hạn', model_name: model.name }; } break;
        }
        return null;
    }
    
    runSubModelBreak(results, model) {
        if (results.length < model.minLength) return null;
        let last = results[results.length-1], last4 = results.slice(-4), last5 = results.slice(-5), last6 = results.slice(-6);
        switch (model.logic) {
            case 'break11': if (last4.length === 4 && last4[0] !== last4[1] && last4[1] !== last4[2] && last4[2] === last4[3]) return { prediction: last4[3], confidence: 0.85, reason: 'Phát hiện bẻ cầu 1-1', model_name: model.name }; break;
            case 'break22': if (last5.length === 5 && last5[0] === last5[1] && last5[1] !== last5[2] && last5[2] === last5[3] && last5[3] !== last5[4] && last5[0] === last5[4]) return { prediction: last5[4], confidence: 0.85, reason: 'Phát hiện bẻ cầu 2-2', model_name: model.name }; break;
            case 'breakStreak': let streak = this.getStreak(results.slice(0, -1)); if (streak >= 3 && last !== results[results.length - 2]) return { prediction: last, confidence: 0.8, reason: `Phát hiện bẻ cầu bệt sau ${streak} phiên`, model_name: model.name }; break;
            case '11to22': if (last6.length === 6 && last6[0] !== last6[1] && last6[1] !== last6[2] && last6[2] === last6[3] && last6[3] !== last6[4] && last6[4] === last6[5]) return { prediction: last6[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.75, reason: 'Chuyển từ cầu 1-1 sang 2-2', model_name: model.name }; break;
            case '22to11': if (last6.length === 6 && last6[0] === last6[1] && last6[1] !== last6[2] && last6[2] !== last6[3] && last6[3] !== last6[4] && last6[4] !== last6[5]) return { prediction: last6[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.75, reason: 'Chuyển từ cầu 2-2 sang 1-1', model_name: model.name }; break;
            case 'streakTo11': if (last5.length === 5 && last5[0] === last5[1] && last5[1] === last5[2] && last5[2] !== last5[3] && last5[3] !== last5[4]) return { prediction: last5[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7, reason: 'Chuyển từ bệt sang cầu 1-1', model_name: model.name }; break;
        }
        return null;
    }
    
    runSubModelAdvanced(results, model) {
        if (results.length < model.minLength) return null;
        switch (model.logic) {
            case 'frequency': let freq = this.analyzeFrequency(results); if (freq.dominant && freq.ratio > 0.6) return { prediction: freq.dominant, confidence: 0.6 + (freq.ratio * 0.2), reason: `Tần suất ${freq.dominant} chiếm ${(freq.ratio*100).toFixed(0)}%`, model_name: model.name }; break;
            case 'cycle': let cycle = this.detectCycle(results); if (cycle.found) return { prediction: cycle.next, confidence: 0.7, reason: `Phát hiện chu kỳ ${cycle.length} phiên`, model_name: model.name }; break;
            case 'symmetry': let symmetry = this.checkSymmetry(results); if (symmetry.found) return { prediction: symmetry.prediction, confidence: 0.75, reason: 'Phát hiện cầu đối xứng', model_name: model.name }; break;
            case 'fibonacci': let fib = this.checkFibonacci(results); if (fib.found) return { prediction: fib.prediction, confidence: 0.7, reason: 'Phát hiện cầu Fibonacci', model_name: model.name }; break;
            case 'longTrend': let trend = this.getLongTrend(results); if (trend.strength > 0.7) return { prediction: trend.direction, confidence: 0.7 + (trend.strength * 0.1), reason: `Xu hướng dài ${trend.direction} với độ mạnh ${(trend.strength*100).toFixed(0)}%`, model_name: model.name }; break;
            case 'super': let superAnalysis = this.superAnalysis(results); if (superAnalysis.confidence > 0.8) return superAnalysis; break;
        }
        return null;
    }
    
    superAnalysis(results) {
        let freq = this.analyzeFrequency(results), trend = this.getLongTrend(results), cycle = this.detectCycle(results);
        let score = 0, predictions = [];
        if (freq.ratio > 0.6) { predictions.push({ pred: freq.dominant, weight: freq.ratio }); score++; }
        if (trend.strength > 0.7) { predictions.push({ pred: trend.direction, weight: trend.strength }); score++; }
        if (cycle.found) { predictions.push({ pred: cycle.next, weight: 0.7 }); score++; }
        if (score >= 2) {
            let taiWeight = predictions.filter(p => p.pred === 'Tài').reduce((sum, p) => sum + p.weight, 0);
            let xiuWeight = predictions.filter(p => p.pred === 'Xỉu').reduce((sum, p) => sum + p.weight, 0);
            if (taiWeight > xiuWeight * 1.5) return { prediction: 'Tài', confidence: 0.85, reason: 'Siêu phân tích đồng thuận Tài' };
            else if (xiuWeight > taiWeight * 1.5) return { prediction: 'Xỉu', confidence: 0.85, reason: 'Siêu phân tích đồng thuận Xỉu' };
        }
        return { confidence: 0 };
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
            case '3-3': result = this.runSubModel33(results, model); break;
            case '2-1-2': result = this.runSubModel212(results, model); break;
            case '1-2-1': result = this.runSubModel121(results, model); break;
            case 'break': case 'transition': result = this.runSubModelBreak(results, model); break;
            default: result = this.runSubModelAdvanced(results, model);
        }
        if (result) result.model_name = model.name;
        return result;
    }
    
    runMiniModel(index, history) {
        if (history.length < 2) return null;
        let results = this.getResultArray(history), miniModel = this.miniModels[`mini_model_${index}`];
        let prediction, confidence, reason;
        switch (miniModel.specialty) {
            case 'phat_hien_cau_dep': let pattern = this.analyzeBasicPatterns(history); prediction = pattern.prediction; confidence = pattern.confidence * 0.9; reason = pattern.reason; break;
            case 'du_doan_bien_dong': let dice = this.analyzeDiceVolatility(history); prediction = dice.prediction; confidence = dice.confidence * 0.8; reason = dice.reason; break;
            case 'nhan_dien_xu_huong_cuc_bo': let short = this.analyzeShortTerm(history); prediction = short.prediction; confidence = short.confidence * 0.85; reason = short.reason; break;
            case 'tinh_toan_xac_suat_cao': let taiCount = results.filter(r => r === 'Tài').length, xiuCount = results.length - taiCount; if (taiCount > xiuCount * 1.5) { prediction = 'Xỉu'; confidence = 0.7; reason = 'Xác suất Tài cao, dự đoán Xỉu để cân bằng'; } else if (xiuCount > taiCount * 1.5) { prediction = 'Tài'; confidence = 0.7; reason = 'Xác suất Xỉu cao, dự đoán Tài để cân bằng'; } else { prediction = results[results.length - 1]; confidence = 0.5; reason = 'Xác suất cân bằng'; } break;
            case 'phan_tich_so_sanh': let currentPattern = results.slice(-5).join(''), matchFound = false; for (let [type, patterns] of Object.entries(this.patternLibrary)) { if (patterns.includes(currentPattern)) { matchFound = true; prediction = results[results.length - 1] === 'Tài' ? 'Xỉu' : 'Tài'; confidence = 0.75; reason = `Khớp mẫu ${type} trong thư viện`; break; } } if (!matchFound) { prediction = results[results.length - 1]; confidence = 0.4; reason = 'Không tìm thấy mẫu tương tự'; } break;
            default: let random = Math.random(); if (random < 0.4) { prediction = results[results.length - 1]; confidence = 0.5; } else if (random < 0.7) { prediction = results[results.length - 1] === 'Tài' ? 'Xỉu' : 'Tài'; confidence = 0.5; } else { let streak = this.getStreak(results); if (streak >= 3) { prediction = results[results.length - 1]; confidence = 0.6; } else { prediction = results[results.length - 1] === 'Tài' ? 'Xỉu' : 'Tài'; confidence = 0.5; } } reason = `Mini model ${index} (${miniModel.specialty})`;
        }
        return { prediction, confidence: Math.min(confidence, 0.95), reason, model_name: `mini_${index}_${miniModel.specialty}` };
    }
    
    analyzeBasicPatterns(history) {
        if (history.length < 3) return { prediction: null, confidence: 0, reason: 'Không đủ dữ liệu' };
        let results = this.getResultArray(history);
        let patterns = {
            '1-1': this.checkAlternatingPattern(results),
            '1-2-1': this.checkPattern121(results), '2-1-2': this.checkPattern212(results),
            '3-1': this.checkPattern31(results), '1-3': this.checkPattern13(results),
            '2-2': this.checkPattern22(results), 'cầu_bệt': this.checkStreakPattern(results),
            'cầu_đảo': this.checkReversalPattern(results)
        };
        let validPatterns = {};
        for (let [key, value] of Object.entries(patterns)) if (value && value.confidence > 0) validPatterns[key] = value;
        if (Object.keys(validPatterns).length === 0) return { prediction: results[results.length - 1], confidence: 0.3, reason: 'Không phát hiện pattern rõ ràng' };
        let bestPattern = null, bestConfidence = 0, bestKey = '';
        for (let [key, value] of Object.entries(validPatterns)) if (value.confidence > bestConfidence) { bestConfidence = value.confidence; bestPattern = value; bestKey = key; }
        return { prediction: bestPattern.prediction, confidence: bestPattern.confidence, pattern_type: bestKey, reason: `Phát hiện cầu ${bestKey} với độ tin cậy ${(bestPattern.confidence * 100).toFixed(0)}%` };
    }
    
    checkAlternatingPattern(results) {
        if (results.length < 2) return { prediction: null, confidence: 0 };
        let last = results[results.length - 1], pred = last === 'Tài' ? 'Xỉu' : 'Tài', confidence = 0.5;
        for (let i = results.length - 2; i >= Math.max(results.length - 6, 0); i -= 2) { if (results[i] === last) confidence += 0.1; else break; }
        return { prediction: pred, confidence: Math.min(confidence, 0.95) };
    }
    
    checkPattern121(results) {
        if (results.length < 3) return { prediction: null, confidence: 0 };
        if (results[results.length - 3] === results[results.length - 1] && results[results.length - 2] !== results[results.length - 1]) return { prediction: results[results.length - 1], confidence: 0.7 };
        else return { prediction: results[results.length - 1], confidence: 0.3 };
    }
    
    checkPattern212(results) {
        if (results.length < 3) return { prediction: null, confidence: 0 };
        if (results[results.length - 3] !== results[results.length - 1] && results[results.length - 2] === results[results.length - 1]) return { prediction: results[results.length - 2], confidence: 0.7 };
        else return { prediction: results[results.length - 1], confidence: 0.3 };
    }
    
    checkPattern31(results) {
        if (results.length < 4) return { prediction: null, confidence: 0 };
        if (results[results.length - 4] === results[results.length - 3] && results[results.length - 3] === results[results.length - 2] && results[results.length - 2] !== results[results.length - 1]) return { prediction: results[results.length - 1], confidence: 0.8 };
        else return { prediction: results[results.length - 1], confidence: 0.2 };
    }
    
    checkPattern13(results) {
        if (results.length < 4) return { prediction: null, confidence: 0 };
        if (results[results.length - 4] !== results[results.length - 3] && results[results.length - 3] === results[results.length - 2] && results[results.length - 2] === results[results.length - 1]) return { prediction: results[results.length - 1], confidence: 0.8 };
        else return { prediction: results[results.length - 1], confidence: 0.2 };
    }
    
    checkPattern22(results) {
        if (results.length < 4) return { prediction: null, confidence: 0 };
        if (results[results.length - 4] === results[results.length - 3] && results[results.length - 2] === results[results.length - 1] && results[results.length - 3] !== results[results.length - 2]) return { prediction: results[results.length - 1], confidence: 0.75 };
        else return { prediction: results[results.length - 1], confidence: 0.25 };
    }
    
    checkStreakPattern(results) {
        let streak = 1;
        for (let i = results.length - 2; i >= 0; i--) { if (results[i] === results[results.length - 1]) streak++; else break; }
        if (streak >= 3) { let confidence = 0.6 + (streak * 0.05); return { prediction: results[results.length - 1], confidence: Math.min(confidence, 0.9) }; }
        else { let other = results[results.length - 1] === 'Tài' ? 'Xỉu' : 'Tài'; if (streak >= 6) return { prediction: other, confidence: 0.65 }; return { prediction: results[results.length - 1], confidence: 0.4 }; }
    }
    
    checkReversalPattern(results) {
        if (results.length < 3) return { prediction: null, confidence: 0 };
        if (results[results.length - 2] !== results[results.length - 1]) return { prediction: results[results.length - 1], confidence: 0.5 };
        else { let other = results[results.length - 1] === 'Tài' ? 'Xỉu' : 'Tài'; return { prediction: other, confidence: 0.4 }; }
    }
    
    analyzeTrend(history) {
        if (history.length < 5) return { prediction: null, confidence: 0, reason: 'Không đủ dữ liệu' };
        let results = this.getResultArray(history);
        let shortTerm = results.slice(-3), shortCounts = this.countResults(shortTerm), shortTrend = this.getMostCommon(shortCounts);
        let longTerm = results.slice(-10), longCounts = this.countResults(longTerm), longTrend = this.getMostCommon(longCounts);
        let momentum = this.calculateMomentum(results);
        if (shortTrend.count >= 2 && longTrend.count >= 6) return { prediction: shortTrend.value, confidence: Math.min(0.7 + momentum * 0.1, 0.95), momentum: momentum, reason: `Xu hướng ngắn và dài đều nghiêng về ${shortTrend.value}` };
        else if (shortTrend.count >= 2) return { prediction: shortTrend.value, confidence: Math.min(0.6 + momentum * 0.1, 0.95), momentum: momentum, reason: `Xu hướng ngắn hạn nghiêng về ${shortTrend.value}` };
        else if (longTrend.count >= 6) return { prediction: longTrend.value, confidence: Math.min(0.6 + momentum * 0.1, 0.95), momentum: momentum, reason: `Xu hướng dài hạn nghiêng về ${longTrend.value}` };
        else { let other = results[results.length - 1] === 'Tài' ? 'Xỉu' : 'Tài'; return { prediction: other, confidence: 0.5, momentum: momentum, reason: "Không có trend rõ ràng, dự đoán đảo chiều" }; }
    }
    
    countResults(results) { let counts = { 'Tài': 0, 'Xỉu': 0 }; results.forEach(r => counts[r]++); return counts; }
    getMostCommon(counts) { if (counts['Tài'] >= counts['Xỉu']) return { value: 'Tài', count: counts['Tài'] }; else return { value: 'Xỉu', count: counts['Xỉu'] }; }
    calculateMomentum(results) { if (results.length < 5) return 0; let recent = results.slice(-5), taiCount = recent.filter(r => r === 'Tài').length; if (taiCount === 5 || taiCount === 0) return 0.3; if (taiCount >= 3 || taiCount <= 2) return 0.15; return 0; }
    
    analyzeImbalance(history) {
        if (history.length < 12) return { prediction: null, confidence: 0, reason: 'Không đủ 12 phiên' };
        let results = this.getResultArray(history.slice(-12)), countTai = results.filter(r => r === 'Tài').length, countXiu = results.length - countTai, imbalanceRatio = Math.abs(countTai - countXiu) / 12;
        if (imbalanceRatio > 0.4) { if (countTai > countXiu) return { prediction: 'Xỉu', confidence: Math.min(0.7 + imbalanceRatio * 0.2, 0.95), tai_count: countTai, xiu_count: countXiu, reason: `Chênh lệch lớn (${countTai}T - ${countXiu}X), dự đoán Xỉu để cân bằng` };
        else return { prediction: 'Tài', confidence: Math.min(0.7 + imbalanceRatio * 0.2, 0.95), tai_count: countTai, xiu_count: countXiu, reason: `Chênh lệch lớn (${countTai}T - ${countXiu}X), dự đoán Tài để cân bằng` }; }
        else return { prediction: results[results.length - 1], confidence: 0.5, tai_count: countTai, xiu_count: countXiu, reason: `Chênh lệch ${countTai}T - ${countXiu}X trong 12 phiên, tiếp tục xu hướng` };
    }
    
    analyzeShortTerm(history) {
        if (history.length < 3) return { prediction: null, confidence: 0, reason: 'Không đủ dữ liệu' };
        let results = this.getResultArray(history), last3 = results.slice(-3), patterns = [];
        if (last3[0] === last3[1] && last3[1] === last3[2]) patterns.push({ type: 'bệt', prediction: last3[0], confidence: 0.75 });
        if (last3[0] === last3[1] && last3[1] !== last3[2]) patterns.push({ type: '2-1', prediction: last3[2], confidence: 0.7 });
        if (last3[0] !== last3[1] && last3[1] === last3[2]) { let other = last3[2] === 'Tài' ? 'Xỉu' : 'Tài'; patterns.push({ type: '1-2', prediction: other, confidence: 0.65 }); }
        if (results.length >= 4) { let last4 = results.slice(-4); if (last4[0] !== last4[1] && last4[1] !== last4[2] && last4[2] !== last4[3]) { let other = last4[3] === 'Tài' ? 'Xỉu' : 'Tài'; patterns.push({ type: 'xen_kẽ', prediction: other, confidence: 0.8 }); } }
        if (patterns.length > 0) { let bestPattern = patterns.reduce((best, current) => current.confidence > best.confidence ? current : best); return { prediction: bestPattern.prediction, confidence: bestPattern.confidence, pattern: bestPattern.type, reason: `Phát hiện pattern ${bestPattern.type} trong ngắn hạn` }; }
        else return { prediction: results[results.length - 1], confidence: 0.4, pattern: 'không_rõ', reason: "Không phát hiện pattern ngắn hạn rõ ràng" };
    }
    
    analyzeDiceVolatility(history) {
        if (history.length < 5) return { prediction: null, confidence: 0, reason: 'Không đủ dữ liệu' };
        let faceSequences = [];
        history.forEach(h => { if (h.Xuc_xac_1) faceSequences.push(h.Xuc_xac_1); if (h.Xuc_xac_2) faceSequences.push(h.Xuc_xac_2); if (h.Xuc_xac_3) faceSequences.push(h.Xuc_xac_3); });
        if (faceSequences.length === 0) return { prediction: null, confidence: 0, reason: 'Không có dữ liệu mặt xúc xắc' };
        let faceFreq = {}; for (let i = 1; i <= 6; i++) faceFreq[i] = 0; faceSequences.forEach(f => faceFreq[f]++);
        let recentFaces = []; let recentHistory = history.slice(-5);
        recentHistory.forEach(h => { if (h.Xuc_xac_1) recentFaces.push(h.Xuc_xac_1); if (h.Xuc_xac_2) recentFaces.push(h.Xuc_xac_2); if (h.Xuc_xac_3) recentFaces.push(h.Xuc_xac_3); });
        let recentFreq = {}; for (let i = 1; i <= 6; i++) recentFreq[i] = 0; recentFaces.forEach(f => recentFreq[f]++);
        let predictions = [];
        for (let face = 1; face <= 6; face++) if (recentFreq[face] < 2) { let prob = 0.3 + (2 - recentFreq[face]) * 0.1; predictions.push({ face, prob }); }
        if (predictions.length > 0) {
            predictions.sort((a, b) => b.prob - a.prob);
            let topFaces = predictions.slice(0, 3);
            if (topFaces.length >= 3) {
                let predictedScores = [];
                for (let i = 0; i < topFaces.length; i++) for (let j = i; j < topFaces.length; j++) for (let k = j; k < topFaces.length; k++) predictedScores.push(topFaces[i].face + topFaces[j].face + topFaces[k].face);
                if (predictedScores.length > 0) { let avgPredicted = predictedScores.reduce((a, b) => a + b, 0) / predictedScores.length; let predType = avgPredicted >= 11 ? 'Tài' : 'Xỉu'; return { prediction: predType, confidence: 0.65, predicted_faces: topFaces.map(f => f.face), reason: `Dựa trên biến động xúc xắc, các mặt ${topFaces.map(f => f.face).join(',')} có khả năng xuất hiện cao` }; }
            } else if (topFaces.length === 2) {
                let predictedScores = [];
                for (let i = 0; i < topFaces.length; i++) for (let j = i; j < topFaces.length; j++) for (let k = j; k < topFaces.length; k++) predictedScores.push(topFaces[i].face + topFaces[j].face + topFaces[k].face);
                if (predictedScores.length > 0) { let avgPredicted = predictedScores.reduce((a, b) => a + b, 0) / predictedScores.length; let predType = avgPredicted >= 11 ? 'Tài' : 'Xỉu'; return { prediction: predType, confidence: 0.6, predicted_faces: topFaces.map(f => f.face), reason: `Dựa trên biến động xúc xắc, các mặt ${topFaces.map(f => f.face).join(',')} có khả năng xuất hiện cao` }; }
            } else { let face = topFaces[0].face; let avgOther = 3.5; let avgPredicted = face + avgOther + avgOther; let predType = avgPredicted >= 11 ? 'Tài' : 'Xỉu'; return { prediction: predType, confidence: 0.55, predicted_faces: [face], reason: `Dựa trên biến động xúc xắc, mặt ${face} có khả năng xuất hiện cao` }; }
        }
        return { prediction: history[history.length - 1].Ket_qua || (history[history.length - 1].score >= 11 ? 'Tài' : 'Xỉu'), confidence: 0.4, reason: "Không phát hiện biến động đặc biệt" };
    }
    
    ensembleModels(history) {
        let modelResults = {};
        modelResults.model1 = this.analyzeBasicPatterns(history);
        modelResults.model2 = this.analyzeTrend(history);
        modelResults.model3 = this.analyzeImbalance(history);
        modelResults.model4 = this.analyzeShortTerm(history);
        modelResults.model11 = this.analyzeDiceVolatility(history);
        for (let i = 1; i <= 42; i++) { let subResult = this.runSubModel(i, history); if (subResult && subResult.prediction) modelResults[`sub_model_${i}`] = subResult; }
        for (let i = 1; i <= 21; i++) { let miniResult = this.runMiniModel(i, history); if (miniResult && miniResult.prediction) modelResults[`mini_model_${i}`] = miniResult; }
        let taiWeight = 0, xiuWeight = 0, totalWeight = 0, details = [];
        for (let [modelName, result] of Object.entries(modelResults)) {
            if (result && result.prediction && result.confidence > 0.3) {
                let weight = 1.0;
                if (modelName.startsWith('sub')) weight = this.subModelWeights[modelName] || 1.0;
                else if (modelName.startsWith('mini')) weight = this.miniModelWeights[modelName] || 1.0;
                else weight = this.modelWeights[modelName] || 1.0;
                let weightedConfidence = weight * result.confidence;
                if (result.prediction === 'Tài') taiWeight += weightedConfidence;
                else if (result.prediction === 'Xỉu') xiuWeight += weightedConfidence;
                totalWeight += weightedConfidence;
                details.push({ model: result.model_name || modelName, prediction: result.prediction, confidence: result.confidence, weight: weight, reason: result.reason });
            }
        }
        details.sort((a, b) => b.confidence - a.confidence);
        let finalPrediction, finalConfidence, finalReason, finalPattern, finalType;
        if (totalWeight > 0) {
            let taiRatio = taiWeight / totalWeight, xiuRatio = xiuWeight / totalWeight;
            if (taiRatio > 0.55) { finalPrediction = 'Tài'; finalConfidence = taiRatio; finalReason = `${details.length} models đồng thuận Tài (${(taiRatio*100).toFixed(1)}%)`; }
            else if (xiuRatio > 0.55) { finalPrediction = 'Xỉu'; finalConfidence = xiuRatio; finalReason = `${details.length} models đồng thuận Xỉu (${(xiuRatio*100).toFixed(1)}%)`; }
            else { let bestModel = details[0]; if (bestModel) { finalPrediction = bestModel.prediction; finalConfidence = 0.5 + bestModel.confidence * 0.2; finalReason = `Tỉ lệ cân bằng, dùng model ${bestModel.model}: ${bestModel.reason}`; } else { finalPrediction = history.length > 0 ? (history[history.length - 1].Ket_qua || (history[history.length - 1].score >= 11 ? 'Tài' : 'Xỉu')) : 'Tài'; finalConfidence = 0.5; finalReason = "Không có model nào đủ tin cậy"; } }
        } else { finalPrediction = history.length > 0 ? (history[history.length - 1].Ket_qua || (history[history.length - 1].score >= 11 ? 'Tài' : 'Xỉu')) : 'Tài'; finalConfidence = 0.5; finalReason = "Không đủ dữ liệu model"; }
        if (details.length > 0) { finalType = details[0].model; finalPattern = history.length > 0 ? this.getResultArray(history.slice(-5)).join('') : ''; }
        else { finalType = 'Không xác định'; finalPattern = ''; }
        return { prediction: finalPrediction, confidence: finalConfidence, reason: finalReason, pattern_type: finalType, pattern: finalPattern, details: details.slice(0, 5) };
    }
    
    updateModelWeights(actual, predicted, confidence) {
        let correct = (actual === predicted) ? 1 : 0;
        for (let modelName in this.modelWeights) { if (correct) this.modelWeights[modelName] = Math.min(this.modelWeights[modelName] * 1.01, 2.0); else this.modelWeights[modelName] = Math.max(this.modelWeights[modelName] * 0.99, 0.5); }
        for (let modelName in this.subModelWeights) { if (correct) this.subModelWeights[modelName] = Math.min(this.subModelWeights[modelName] * 1.005, 1.5); else this.subModelWeights[modelName] = Math.max(this.subModelWeights[modelName] * 0.995, 0.7); }
        for (let modelName in this.miniModelWeights) { if (correct) this.miniModelWeights[modelName] = Math.min(this.miniModelWeights[modelName] * 1.003, 1.3); else this.miniModelWeights[modelName] = Math.max(this.miniModelWeights[modelName] * 0.997, 0.8); }
        saveModelWeights();
    }
}

const analyzer = new TaiXiuAnalyzer();

// ==================== WEBSOCKET ====================
const WEBSOCKET_URL = "wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXBpc3Vud2luMTIzIn0.hgrRbSV6vnBwJMg9ZFtbx3rRu9mX_hZMZ_m5gMNhkw0";
const WS_HEADERS = { "User-Agent": "Mozilla/5.0", "Origin": "https://play.sun.win" };
const RECONNECT_DELAY = 3000;
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

function startWatchdog() {
    if (watchdogInterval) clearInterval(watchdogInterval);
    watchdogInterval = setInterval(() => {
        let timeSinceLastMessage = (Date.now() - lastMessageTime) / 1000;
        if (timeSinceLastMessage > 60) {
            console.log(`[⚠️] ${timeSinceLastMessage.toFixed(0)}s không có dữ liệu`);
            if (ws && ws.readyState === WebSocket.OPEN) { try { ws.ping(); } catch(e) { ws.terminate(); } }
            else { connectWebSocket(); }
        }
        if (timeSinceLastMessage > 120) { console.log('[🚨] Force reconnect!'); if (ws) ws.terminate(); connectWebSocket(); }
    }, 30000);
}

function connectWebSocket() {
    if (ws) { try { ws.removeAllListeners(); ws.close(); } catch(e) {} ws = null; }
    console.log(`[🔌] Kết nối WebSocket (lần ${reconnectAttempts + 1})...`);
    ws = new WebSocket(WEBSOCKET_URL, { headers: WS_HEADERS });
    let connectionTimeout = setTimeout(() => { if (ws && ws.readyState !== WebSocket.OPEN) { console.log('[❌] Timeout kết nối'); ws.terminate(); } }, 10000);
    ws.on('open', () => {
        clearTimeout(connectionTimeout);
        console.log('[✅] WebSocket đã kết nối!');
        reconnectAttempts = 0;
        lastMessageTime = Date.now();
        initialMessages.forEach((msg, i) => { setTimeout(() => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); }, i * 600); });
        clearInterval(pingInterval);
        pingInterval = setInterval(() => { if (ws && ws.readyState === WebSocket.OPEN) ws.ping(); }, PING_INTERVAL);
    });
    ws.on('message', (message) => {
        lastMessageTime = Date.now();
        try {
            let data = JSON.parse(message);
            if (!Array.isArray(data) || typeof data[1] !== 'object') return;
            let { cmd, sid, d1, d2, d3, gBB } = data[1];
            if (cmd === 1008 && sid) currentSessionId = sid;
            if (cmd === 1003 && gBB && d1 && d2 && d3) {
                let total = d1 + d2 + d3, result = total > 10 ? "Tài" : "Xỉu";
                let predictionCorrect = false;
                if (lastPrediction && lastPrediction.ket_qua) {
                    predictionCorrect = lastPrediction.ket_qua === result;
                    stats.total++; if (predictionCorrect) { stats.correct++; stats.consecutiveLosses = 0; } else { stats.wrong++; stats.consecutiveLosses++; }
                    analyzer.updateModelWeights(result, lastPrediction.ket_qua, lastPrediction.do_tin_cay);
                }
                let historyEntry = { phien: currentSessionId, Xuc_xac_1: d1, Xuc_xac_2: d2, Xuc_xac_3: d3, Tong: total, Ket_qua: result, du_doan: lastPrediction ? lastPrediction.ket_qua : null, loai_cau: lastPrediction ? lastPrediction.loai_cau : null, do_tin_cay: lastPrediction ? lastPrediction.do_tin_cay : null, thoi_gian: new Date().toISOString() };
                saveHistory(historyEntry);
                let historyForAnalyzer = resultHistory.map(h => ({ score: h.Tong, Ket_qua: h.Ket_qua, Xuc_xac_1: h.Xuc_xac_1, Xuc_xac_2: h.Xuc_xac_2, Xuc_xac_3: h.Xuc_xac_3 }));
                let ensembleResult = analyzer.ensembleModels(historyForAnalyzer);
                let finalPrediction = ensembleResult.prediction, finalConfidence = ensembleResult.confidence, finalType = ensembleResult.pattern_type, finalPattern = ensembleResult.pattern, finalReason = ensembleResult.reason;
                if (stats.consecutiveLosses >= 3) { finalPrediction = finalPrediction === 'Tài' ? 'Xỉu' : 'Tài'; finalConfidence = 0.4; finalType = 'CHỐNG ĐẢO (SAU ' + stats.consecutiveLosses + ' LẦN THUA)'; finalPattern = ''; finalReason = 'Chống đảo do thua liên tiếp'; }
                lastPrediction = { phien: currentSessionId ? parseInt(currentSessionId) + 1 : null, ket_qua: finalPrediction, loai_cau: finalType, mau_cau: finalPattern, do_tin_cay: (finalConfidence * 100).toFixed(0) + '%' };
                let trangThai = finalType.includes('CHỐNG') ? 'Chống đảo' : (finalType.includes('THEO') ? 'Đang theo kết quả' : 'Đang theo cầu');
                let tiLe = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) + '%' : '0%';
                apiResponseData = { "Phien": currentSessionId, "Xuc_xac_1": d1, "Xuc_xac_2": d2, "Xuc_xac_3": d3, "Tong": total, "Ket_qua": result, "Phien_hien_tai": currentSessionId ? parseInt(currentSessionId) + 1 : null, "Du_doan": finalPrediction, "Loai_cau": finalType, "Mau_cau_phat_hien": finalPattern, "Do_tin_cay": (finalConfidence * 100).toFixed(0) + '%', "Trang_thai": trangThai, "Ket_qua_du_doan": predictionCorrect ? '✅' : (stats.total > 0 ? '❌' : ''), "Link_game": "https://web.sunwin.tg/?affId=Sunwin", "Thong_ke": { "tong": stats.total, "dung": stats.correct, "sai": stats.wrong, "ti_le": tiLe }, "id": "@tranhoang2286" };
                console.log(`\n🎲 Phiên ${apiResponseData.Phien} | KQ: ${result} | Dự đoán: ${finalPrediction} (${(finalConfidence * 100).toFixed(0)}%) ${predictionCorrect ? '✅' : '❌'}`);
                lastResult = result;
                currentSessionId = null;
            }
        } catch (e) { console.error('[❌] Lỗi xử lý message:', e.message); }
    });
    ws.on('pong', () => { lastMessageTime = Date.now(); });
    ws.on('close', () => {
        clearTimeout(connectionTimeout);
        console.log('[🔌] WebSocket đóng');
        clearInterval(pingInterval);
        reconnectAttempts++;
        let delay = Math.min(5000 * reconnectAttempts, 30000);
        setTimeout(connectWebSocket, delay);
    });
    ws.on('error', (err) => { clearTimeout(connectionTimeout); console.error('[❌] Lỗi WebSocket:', err.message); if (ws) ws.terminate(); });
}

// ==================== EXPRESS API ====================
app.get('/api/sieu', (req, res) => { res.json(apiResponseData); });
app.get('/api/ditmemaysun', (req, res) => { res.json(apiResponseData); });
app.get('/api/his', (req, res) => {
    let recent = resultHistory.slice(-20).reverse();
    res.json({ success: true, total: resultHistory.length, data: recent, stats: { tong: stats.total, dung: stats.correct, sai: stats.wrong, ti_le: stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) + '%' : '0%', consecutive_losses: stats.consecutiveLosses } });
});
app.get('/api/models', (req, res) => {
    res.json({ main_models: Object.keys(analyzer.modelWeights).length, sub_models: Object.keys(analyzer.subModels).length, mini_models: Object.keys(analyzer.miniModels).length, total: 84, weights: { main: analyzer.modelWeights, sub: analyzer.subModelWeights, mini: analyzer.miniModelWeights } });
});
app.get('/api/status', (req, res) => {
    res.json({ wsConnected: ws?.readyState === WebSocket.OPEN, readyState: ws?.readyState, hasData: apiResponseData.Phien !== null, lastPhien: apiResponseData.Phien, stats });
});
app.get('/', (req, res) => { res.json(apiResponseData); });

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 ===== SUNWIN TÀI XỈU API =====`);
    console.log(`🌐 Server: http://0.0.0.0:${PORT}`);
    console.log(`📌 Endpoint: /api/sieu`);
    console.log(`🎲 Link game: https://web.sunwin.tg/?affId=Sunwin`);
    console.log(`[🤖] Total models: 84 (21 main + 42 sub + 21 mini)`);
    console.log(`=====================================\n`);
});

connectWebSocket();
setTimeout(() => startWatchdog(), 5000);
