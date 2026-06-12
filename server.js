// server.js - GHÉP 3 API: Sunwin + 68GB + LC79 (Giữ nguyên toàn bộ thuật toán)
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

// ==================== FILE STORAGE CHUNG ====================
const SUNWIN_HISTORY_FILE = './sunwin_history.json';
const SUNWIN_PATTERNS_FILE = './sunwin_patterns.json';
const SUNWIN_MODEL_WEIGHTS_FILE = './sunwin_model_weights.json';

const GB68_HISTORY_FILE = './gb68_history.json';
const LC79_HISTORY_FILE = './lc79_history.json';
const LC79_LEARNING_FILE = './lc79_learning.json';

// ==================== PHẦN 1: SUNWIN (GIỮ NGUYÊN TỪ apisun.js) ====================

let sunwinHistory = [];
let sunwinCurrentSessionId = null;
let sunwinLastPrediction = null;
let sunwinStats = { total: 0, correct: 0, wrong: 0, consecutiveLosses: 0, modelPerformance: {} };

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

// SUNWIN TAI XIU ANALYZER (GIỮ NGUYÊN)
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
    isPerfectAlternating(results, length) { let last = results.slice(-length); for (let i = 0; i < last.length - 1; i++) if (last[i] === last[i+1]) return false; return true; }
    isAlternatingWithTolerance(results, tolerance) { let last = results.slice(-6), errors = 0; for (let i = 0; i < last.length - 1; i++) if (last[i] === last[i+1]) errors++; return errors <= tolerance; }
    countAlternating(results) { let count = 0; for (let i = 0; i < results.length - 1; i++) if (results[i] !== results[i+1]) count++; return count; }
    getStreak(results) { if (results.length === 0) return 0; let last = results[results.length - 1], streak = 1; for (let i = results.length - 2; i >= 0; i--) { if (results[i] === last) streak++; else break; } return streak; }
    
    analyzeFrequency(results) { let recent = results.slice(-20), taiCount = recent.filter(r => r === 'Tài').length, ratio = Math.max(taiCount, recent.length - taiCount) / recent.length, dominant = taiCount > recent.length - taiCount ? 'Tài' : 'Xỉu'; return { dominant, ratio }; }
    detectCycle(results) { for (let cycleLen of [2, 3, 4]) { if (results.length < cycleLen * 2) continue; if (JSON.stringify(results.slice(-cycleLen)) === JSON.stringify(results.slice(-cycleLen*2, -cycleLen))) return { found: true, length: cycleLen, next: results.slice(-cycleLen)[0] }; } return { found: false }; }
    checkSymmetry(results) { if (results.length < 6) return { found: false }; let last3 = results.slice(-3), prev3 = results.slice(-6, -3); if (last3[0] === prev3[2] && last3[1] === prev3[1] && last3[2] === prev3[0]) return { found: true, prediction: last3[1] }; return { found: false }; }
    checkFibonacci(results) { if (results.length < 5) return { found: false }; for (let fib of [1, 2, 3, 5]) { if (results.length >= fib * 2 && JSON.stringify(results.slice(-fib)) === JSON.stringify(results.slice(-fib*2, -fib))) return { found: true, prediction: results.slice(-fib)[0] }; } return { found: false }; }
    getLongTrend(results) { if (results.length < 10) return { strength: 0, direction: null }; let first = results.slice(0,5), last = results.slice(-5), firstTai = first.filter(r => r === 'Tài').length, lastTai = last.filter(r => r === 'Tài').length; if (lastTai > firstTai + 2) return { strength: 0.8, direction: 'Tài' }; else if (lastTai < firstTai - 2) return { strength: 0.8, direction: 'Xỉu' }; return { strength: 0.5, direction: lastTai > 2 ? 'Tài' : 'Xỉu' }; }
    
    runSubModel11(results, model) { if (results.length < model.minLength) return null; let last = results[results.length - 1], last4 = results.slice(-4); switch (model.logic) { case 'pure': if (this.isPerfectAlternating(results, 4)) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Phát hiện cầu 1-1 thuần túy', model_name: model.name }; case 'variant': if (this.isAlternatingWithTolerance(results, 1)) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.8, reason: 'Phát hiện cầu 1-1 biến thể', model_name: model.name }; case 'long': let altCount = this.countAlternating(results.slice(-12)); if (altCount >= 8) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7 + (altCount / 20), reason: `Cầu 1-1 dài hạn với ${altCount}/11 cặp xen kẽ`, model_name: model.name }; case 'hybrid': let recent = results.slice(-5); if (recent[0] !== recent[1] && recent[1] !== recent[2] && recent[3] !== recent[4]) return { prediction: last === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7, reason: 'Phát hiện cầu 1-1 kết hợp', model_name: model.name }; case 'break': if (last4[0] !== last4[1] && last4[1] !== last4[2] && last4[2] !== last4[3]) { let streak = this.getStreak(results.slice(0, -1)); if (streak > 4) return { prediction: last, confidence: 0.8, reason: 'Cầu 1-1 dài sắp gãy, dự đoán giữ nguyên', model_name: model.name }; } case 'recovery': if (last4[0] === last4[1] && last4[1] !== last4[2] && last4[2] !== last4[3]) return { prediction: last4[3] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7, reason: 'Cầu 1-1 đang phục hồi sau gãy', model_name: model.name }; } return null; }
    runSubModel22(results, model) { if (results.length < model.minLength) return null; let last6 = results.slice(-6), last8 = results.slice(-8); switch (model.logic) { case 'pure': if (last6.length === 6 && last6[0] === last6[1] && last6[1] !== last6[2] && last6[2] === last6[3] && last6[3] !== last6[4] && last6[4] === last6[5]) return { prediction: last6[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Phát hiện cầu 2-2 chuẩn', model_name: model.name }; case 'offset': if (last6.length === 6 && last6[0] === last6[1] && last6[1] !== last6[2] && last6[2] !== last6[3] && last6[3] === last6[4] && last6[4] !== last6[5]) return { prediction: last6[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.8, reason: 'Phát hiện cầu 2-2 lệch', model_name: model.name }; case 'variant': if (last8.length === 8 && last8[0] === last8[1] && last8[1] !== last8[2] && last8[2] === last8[3] && last8[3] !== last8[4] && last8[4] === last8[5] && last8[5] !== last8[6] && last8[6] === last8[7]) return { prediction: last8[6] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.75, reason: 'Phát hiện cầu 2-2 biến tướng', model_name: model.name }; case 'hybrid': if (last6.length === 6 && last6[0] === last6[1] && last6[1] !== last6[2] && last6[2] !== last6[3] && last6[3] !== last6[4] && last6[4] === last6[5]) return { prediction: last6[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7, reason: 'Cầu 2-2 kết hợp 1-1', model_name: model.name }; case 'long': let score = 0; for (let i = 0; i < 7; i+=2) if (last8[i] === last8[i+1]) score++; if (score >= 3) return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7 + (score * 0.05), reason: `Cầu 2-2 dài với ${score}/4 cặp đúng`, model_name: model.name }; case 'break': if (last6.length === 6 && last6[0] === last6[1] && last6[1] !== last6[2] && last6[2] === last6[3] && last6[3] !== last6[4] && last6[4] !== last6[5]) return { prediction: last6[4], confidence: 0.85, reason: 'Phát hiện bẻ cầu 2-2', model_name: model.name }; } return null; }
    runSubModelStreak(results, model) { if (results.length < model.minLength) return null; let last = results[results.length - 1], other = last === 'Tài' ? 'Xỉu' : 'Tài', streak = this.getStreak(results); switch (model.logic) { case 'short': if (streak >= 2 && streak <= 3) return { prediction: last, confidence: 0.7 + (streak * 0.05), reason: `Bệt ngắn ${streak} phiên`, model_name: model.name }; case 'medium': if (streak >= 4 && streak <= 5) return { prediction: last, confidence: 0.75 + ((streak - 4) * 0.05), reason: `Bệt trung ${streak} phiên`, model_name: model.name }; case 'long': if (streak >= 6) return { prediction: last, confidence: 0.8 + (Math.min(streak, 10) * 0.01), reason: `Bệt dài ${streak} phiên`, model_name: model.name }; case 'break': if (streak >= 4) return { prediction: other, confidence: 0.6 + (streak * 0.03), reason: `Bệt ${streak} phiên, dự đoán sắp gãy`, model_name: model.name }; case 'hybrid': if (streak >= 3) { let prev = results[results.length - streak - 1]; if (prev && prev !== last) return { prediction: last, confidence: 0.7, reason: `Bệt sau khi đảo từ ${prev}`, model_name: model.name }; } case 'super': if (streak >= 8) return { prediction: last, confidence: 0.9, reason: `Siêu bệt ${streak} phiên`, model_name: model.name }; } return null; }
    runSubModel33(results, model) { if (results.length < model.minLength) return null; let last9 = results.slice(-9), last12 = results.slice(-12); switch (model.logic) { case 'pure': if (last9.length === 9 && last9[0] === last9[1] && last9[1] === last9[2] && last9[3] === last9[4] && last9[4] === last9[5] && last9[6] === last9[7] && last9[7] === last9[8] && last9[0] !== last9[3] && last9[3] !== last9[6]) return { prediction: last9[6] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Phát hiện cầu 3-3 chuẩn', model_name: model.name }; case 'variant': let score = 0; for (let i = 0; i < 12; i+=3) if (i+2 < 12 && last12[i] === last12[i+1] && last12[i+1] === last12[i+2]) score++; if (score >= 3) return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7 + (score * 0.05), reason: `Cầu 3-3 biến thể với ${score}/4 bộ ba`, model_name: model.name }; case 'short': if (results.length >= 6) { let last6 = results.slice(-6); if (last6[0] === last6[1] && last6[1] === last6[2] && last6[3] === last6[4] && last6[4] === last6[5]) return { prediction: last6[3] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7, reason: 'Cầu 3-3 ngắn (6 phiên)', model_name: model.name }; } case 'hybrid': if (last9.length === 9 && last9[0] === last9[1] && last9[1] === last9[2] && last9[3] !== last9[4] && last9[5] === last9[6] && last9[6] === last9[7]) return { prediction: last9[6] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.75, reason: 'Cầu 3-3 kết hợp', model_name: model.name }; case 'break': if (last9.length === 9 && last9[0] === last9[1] && last9[1] === last9[2] && last9[3] === last9[4] && last9[4] === last9[5] && last9[6] !== last9[7]) return { prediction: last9[6], confidence: 0.8, reason: 'Phát hiện bẻ cầu 3-3', model_name: model.name }; case 'long': if (results.length >= 15) { let last15 = results.slice(-15), pattern = []; for (let i = 0; i < 15; i+=3) if (i+2 < 15 && last15[i] === last15[i+1] && last15[i+1] === last15[i+2]) pattern.push(last15[i]); if (pattern.length >= 4 && pattern[0] !== pattern[1] && pattern[1] !== pattern[2]) return { prediction: pattern[pattern.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.8, reason: 'Cầu 3-3 dài hạn', model_name: model.name }; } } return null; }
    runSubModel212(results, model) { if (results.length < model.minLength) return null; let last5 = results.slice(-5), last7 = results.slice(-7); switch (model.logic) { case 'pure': if (last5.length === 5 && last5[0] === last5[1] && last5[1] !== last5[2] && last5[2] !== last5[3] && last5[3] === last5[4] && last5[0] === last5[3]) return { prediction: last5[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Phát hiện cầu 2-1-2 chuẩn', model_name: model.name }; case 'variant': if (last7.length === 7 && last7[0] === last7[1] && last7[1] !== last7[2] && last7[3] === last7[4] && last7[4] !== last7[5] && last7[0] === last7[3]) return { prediction: last7[5] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.8, reason: 'Phát hiện cầu 2-1-2 biến thể', model_name: model.name }; case 'long': if (results.length >= 10) { let last10 = results.slice(-10), count = 0; for (let i = 0; i < 5; i+=2) if (i+4 < 10 && last10[i] === last10[i+1] && last10[i+1] !== last10[i+2] && last10[i+3] === last10[i+4]) count++; if (count >= 2) return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.75, reason: 'Cầu 2-1-2 dài hạn', model_name: model.name }; } } return null; }
    runSubModel121(results, model) { if (results.length < model.minLength) return null; let last5 = results.slice(-5), last7 = results.slice(-7); switch (model.logic) { case 'pure': if (last5.length === 5 && last5[0] !== last5[1] && last5[1] === last5[2] && last5[2] !== last5[3] && last5[3] === last5[4] && last5[0] === last5[3]) return { prediction: last5[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.9, reason: 'Phát hiện cầu 1-2-1 chuẩn', model_name: model.name }; case 'variant': if (last7.length === 7 && last7[0] !== last7[1] && last7[1] === last7[2] && last7[3] !== last7[4] && last7[4] === last7[5] && last7[0] === last7[3]) return { prediction: last7[5] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.8, reason: 'Phát hiện cầu 1-2-1 biến thể', model_name: model.name }; case 'long': if (results.length >= 10) { let last10 = results.slice(-10), count = 0; for (let i = 0; i < 5; i+=2) if (i+4 < 10 && last10[i] !== last10[i+1] && last10[i+1] === last10[i+2] && last10[i+3] === last10[i+4]) count++; if (count >= 2) return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.75, reason: 'Cầu 1-2-1 dài hạn', model_name: model.name }; } } return null; }
    runSubModelBreak(results, model) { if (results.length < model.minLength) return null; let last4 = results.slice(-4), last5 = results.slice(-5), last6 = results.slice(-6), last = results[results.length-1]; switch (model.logic) { case 'break11': if (last4.length === 4 && last4[0] !== last4[1] && last4[1] !== last4[2] && last4[2] === last4[3]) return { prediction: last4[3], confidence: 0.85, reason: 'Phát hiện bẻ cầu 1-1', model_name: model.name }; case 'break22': if (last5.length === 5 && last5[0] === last5[1] && last5[1] !== last5[2] && last5[2] === last5[3] && last5[3] !== last5[4] && last5[0] === last5[4]) return { prediction: last5[4], confidence: 0.85, reason: 'Phát hiện bẻ cầu 2-2', model_name: model.name }; case 'breakStreak': let streak = this.getStreak(results.slice(0, -1)); if (streak >= 3 && last !== results[results.length - 2]) return { prediction: last, confidence: 0.8, reason: `Phát hiện bẻ cầu bệt sau ${streak} phiên`, model_name: model.name }; case '11to22': if (last6.length === 6 && last6[0] !== last6[1] && last6[1] !== last6[2] && last6[2] === last6[3] && last6[3] !== last6[4] && last6[4] === last6[5]) return { prediction: last6[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.75, reason: 'Chuyển từ cầu 1-1 sang 2-2', model_name: model.name }; case '22to11': if (last6.length === 6 && last6[0] === last6[1] && last6[1] !== last6[2] && last6[2] !== last6[3] && last6[3] !== last6[4] && last6[4] !== last6[5]) return { prediction: last6[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.75, reason: 'Chuyển từ cầu 2-2 sang 1-1', model_name: model.name }; case 'streakTo11': if (last5.length === 5 && last5[0] === last5[1] && last5[1] === last5[2] && last5[2] !== last5[3] && last5[3] !== last5[4]) return { prediction: last5[4] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.7, reason: 'Chuyển từ bệt sang cầu 1-1', model_name: model.name }; } return null; }
    runSubModelAdvanced(results, model) { if (results.length < model.minLength) return null; switch (model.logic) { case 'frequency': let freq = this.analyzeFrequency(results); if (freq.dominant && freq.ratio > 0.6) return { prediction: freq.dominant, confidence: 0.6 + (freq.ratio * 0.2), reason: `Tần suất ${freq.dominant} chiếm ${(freq.ratio*100).toFixed(0)}%`, model_name: model.name }; case 'cycle': let cycle = this.detectCycle(results); if (cycle.found) return { prediction: cycle.next, confidence: 0.7, reason: `Phát hiện chu kỳ ${cycle.length} phiên`, model_name: model.name }; case 'symmetry': let symmetry = this.checkSymmetry(results); if (symmetry.found) return { prediction: symmetry.prediction, confidence: 0.75, reason: 'Phát hiện cầu đối xứng', model_name: model.name }; case 'fibonacci': let fib = this.checkFibonacci(results); if (fib.found) return { prediction: fib.prediction, confidence: 0.7, reason: 'Phát hiện cầu Fibonacci', model_name: model.name }; case 'longTrend': let trend = this.getLongTrend(results); if (trend.strength > 0.7) return { prediction: trend.direction, confidence: 0.7 + (trend.strength * 0.1), reason: `Xu hướng dài ${trend.direction} với độ mạnh ${(trend.strength*100).toFixed(0)}%`, model_name: model.name }; case 'super': let superAnalysis = this.superAnalysis(results); if (superAnalysis.confidence > 0.8) return superAnalysis; } return null; }
    
    superAnalysis(results) { let freq = this.analyzeFrequency(results), trend = this.getLongTrend(results), cycle = this.detectCycle(results); let score = 0, predictions = []; if (freq.ratio > 0.6) { predictions.push({ pred: freq.dominant, weight: freq.ratio }); score++; } if (trend.strength > 0.7) { predictions.push({ pred: trend.direction, weight: trend.strength }); score++; } if (cycle.found) { predictions.push({ pred: cycle.next, weight: 0.7 }); score++; } if (score >= 2) { let taiWeight = predictions.filter(p => p.pred === 'Tài').reduce((sum, p) => sum + p.weight, 0); let xiuWeight = predictions.filter(p => p.pred === 'Xỉu').reduce((sum, p) => sum + p.weight, 0); if (taiWeight > xiuWeight * 1.5) return { prediction: 'Tài', confidence: 0.85, reason: 'Siêu phân tích đồng thuận Tài' }; else if (xiuWeight > taiWeight * 1.5) return { prediction: 'Xỉu', confidence: 0.85, reason: 'Siêu phân tích đồng thuận Xỉu' }; } return { confidence: 0 }; }
    
    runSubModel(index, history) { if (history.length < 3) return null; let results = this.getResultArray(history), model = this.subModels[`sub_model_${index}`]; if (!model) return null; let result = null; switch (model.type) { case '1-1': result = this.runSubModel11(results, model); break; case '2-2': result = this.runSubModel22(results, model); break; case 'bệt': result = this.runSubModelStreak(results, model); break; case '3-3': result = this.runSubModel33(results, model); break; case '2-1-2': result = this.runSubModel212(results, model); break; case '1-2-1': result = this.runSubModel121(results, model); break; case 'break': case 'transition': result = this.runSubModelBreak(results, model); break; default: result = this.runSubModelAdvanced(results, model); } if (result) result.model_name = model.name; return result; }
    
    runMiniModel(index, history) { if (history.length < 2) return null; let results = this.getResultArray(history), miniModel = this.miniModels[`mini_model_${index}`]; let prediction, confidence, reason; switch (miniModel.specialty) { case 'phat_hien_cau_dep': let pattern = this.analyzeBasicPatterns(history); prediction = pattern.prediction; confidence = pattern.confidence * 0.9; reason = pattern.reason; break; case 'du_doan_bien_dong': let dice = this.analyzeDiceVolatility(history); prediction = dice.prediction; confidence = dice.confidence * 0.8; reason = dice.reason; break; case 'nhan_dien_xu_huong_cuc_bo': let short = this.analyzeShortTerm(history); prediction = short.prediction; confidence = short.confidence * 0.85; reason = short.reason; break; case 'tinh_toan_xac_suat_cao': let taiCount = results.filter(r => r === 'Tài').length, xiuCount = results.length - taiCount; if (taiCount > xiuCount * 1.5) { prediction = 'Xỉu'; confidence = 0.7; reason = 'Xác suất Tài cao, dự đoán Xỉu để cân bằng'; } else if (xiuCount > taiCount * 1.5) { prediction = 'Tài'; confidence = 0.7; reason = 'Xác suất Xỉu cao, dự đoán Tài để cân bằng'; } else { prediction = results[results.length - 1]; confidence = 0.5; reason = 'Xác suất cân bằng'; } break; case 'phan_tich_so_sanh': let currentPattern = results.slice(-5).join(''), matchFound = false; for (let [type, patterns] of Object.entries(this.patternLibrary)) { if (patterns.includes(currentPattern)) { matchFound = true; prediction = results[results.length - 1] === 'Tài' ? 'Xỉu' : 'Tài'; confidence = 0.75; reason = `Khớp mẫu ${type} trong thư viện`; break; } } if (!matchFound) { prediction = results[results.length - 1]; confidence = 0.4; reason = 'Không tìm thấy mẫu tương tự'; } break; default: let random = Math.random(); if (random < 0.4) { prediction = results[results.length - 1]; confidence = 0.5; } else if (random < 0.7) { prediction = results[results.length - 1] === 'Tài' ? 'Xỉu' : 'Tài'; confidence = 0.5; } else { let streak = this.getStreak(results); if (streak >= 3) { prediction = results[results.length - 1]; confidence = 0.6; } else { prediction = results[results.length - 1] === 'Tài' ? 'Xỉu' : 'Tài'; confidence = 0.5; } } reason = `Mini model ${index} (${miniModel.specialty})`; } return { prediction, confidence: Math.min(confidence, 0.95), reason, model_name: `mini_${index}_${miniModel.specialty}` }; }
    
    analyzeBasicPatterns(history) { if (history.length < 3) return { prediction: null, confidence: 0, reason: 'Không đủ dữ liệu' }; let results = this.getResultArray(history); let patterns = { '1-1': this.checkAlternatingPattern(results), '1-2-1': this.checkPattern121(results), '2-1-2': this.checkPattern212(results), '3-1': this.checkPattern31(results), '1-3': this.checkPattern13(results), '2-2': this.checkPattern22(results), 'cầu_bệt': this.checkStreakPattern(results), 'cầu_đảo': this.checkReversalPattern(results) }; let validPatterns = {}; for (let [key, value] of Object.entries(patterns)) if (value && value.confidence > 0) validPatterns[key] = value; if (Object.keys(validPatterns).length === 0) return { prediction: results[results.length - 1], confidence: 0.3, reason: 'Không phát hiện pattern rõ ràng' }; let bestPattern = null, bestConfidence = 0, bestKey = ''; for (let [key, value] of Object.entries(validPatterns)) if (value.confidence > bestConfidence) { bestConfidence = value.confidence; bestPattern = value; bestKey = key; } return { prediction: bestPattern.prediction, confidence: bestPattern.confidence, pattern_type: bestKey, reason: `Phát hiện cầu ${bestKey} với độ tin cậy ${(bestPattern.confidence * 100).toFixed(0)}%` }; }
    checkAlternatingPattern(results) { if (results.length < 2) return { prediction: null, confidence: 0 }; let last = results[results.length - 1], pred = last === 'Tài' ? 'Xỉu' : 'Tài', confidence = 0.5; for (let i = results.length - 2; i >= Math.max(results.length - 6, 0); i -= 2) { if (results[i] === last) confidence += 0.1; else break; } return { prediction: pred, confidence: Math.min(confidence, 0.95) }; }
    checkPattern121(results) { if (results.length < 3) return { prediction: null, confidence: 0 }; if (results[results.length - 3] === results[results.length - 1] && results[results.length - 2] !== results[results.length - 1]) return { prediction: results[results.length - 1], confidence: 0.7 }; else return { prediction: results[results.length - 1], confidence: 0.3 }; }
    checkPattern212(results) { if (results.length < 3) return { prediction: null, confidence: 0 }; if (results[results.length - 3] !== results[results.length - 1] && results[results.length - 2] === results[results.length - 1]) return { prediction: results[results.length - 2], confidence: 0.7 }; else return { prediction: results[results.length - 1], confidence: 0.3 }; }
    checkPattern31(results) { if (results.length < 4) return { prediction: null, confidence: 0 }; if (results[results.length - 4] === results[results.length - 3] && results[results.length - 3] === results[results.length - 2] && results[results.length - 2] !== results[results.length - 1]) return { prediction: results[results.length - 1], confidence: 0.8 }; else return { prediction: results[results.length - 1], confidence: 0.2 }; }
    checkPattern13(results) { if (results.length < 4) return { prediction: null, confidence: 0 }; if (results[results.length - 4] !== results[results.length - 3] && results[results.length - 3] === results[results.length - 2] && results[results.length - 2] === results[results.length - 1]) return { prediction: results[results.length - 1], confidence: 0.8 }; else return { prediction: results[results.length - 1], confidence: 0.2 }; }
    checkPattern22(results) { if (results.length < 4) return { prediction: null, confidence: 0 }; if (results[results.length - 4] === results[results.length - 3] && results[results.length - 2] === results[results.length - 1] && results[results.length - 3] !== results[results.length - 2]) return { prediction: results[results.length - 1], confidence: 0.75 }; else return { prediction: results[results.length - 1], confidence: 0.25 }; }
    checkStreakPattern(results) { let streak = 1; for (let i = results.length - 2; i >= 0; i--) { if (results[i] === results[results.length - 1]) streak++; else break; } if (streak >= 3) { let confidence = 0.6 + (streak * 0.05); return { prediction: results[results.length - 1], confidence: Math.min(confidence, 0.9) }; } else { let other = results[results.length - 1] === 'Tài' ? 'Xỉu' : 'Tài'; if (streak >= 6) return { prediction: other, confidence: 0.65 }; return { prediction: results[results.length - 1], confidence: 0.4 }; } }
    checkReversalPattern(results) { if (results.length < 3) return { prediction: null, confidence: 0 }; if (results[results.length - 2] !== results[results.length - 1]) return { prediction: results[results.length - 1], confidence: 0.5 }; else { let other = results[results.length - 1] === 'Tài' ? 'Xỉu' : 'Tài'; return { prediction: other, confidence: 0.4 }; } }
    analyzeTrend(history) { if (history.length < 5) return { prediction: null, confidence: 0, reason: 'Không đủ dữ liệu' }; let results = this.getResultArray(history); let shortTerm = results.slice(-3), shortCounts = this.countResults(shortTerm), shortTrend = this.getMostCommon(shortCounts); let longTerm = results.slice(-10), longCounts = this.countResults(longTerm), longTrend = this.getMostCommon(longCounts); let momentum = this.calculateMomentum(results); if (shortTrend.count >= 2 && longTrend.count >= 6) return { prediction: shortTrend.value, confidence: Math.min(0.7 + momentum * 0.1, 0.95), momentum: momentum, reason: `Xu hướng ngắn và dài đều nghiêng về ${shortTrend.value}` }; else if (shortTrend.count >= 2) return { prediction: shortTrend.value, confidence: Math.min(0.6 + momentum * 0.1, 0.95), momentum: momentum, reason: `Xu hướng ngắn hạn nghiêng về ${shortTrend.value}` }; else if (longTrend.count >= 6) return { prediction: longTrend.value, confidence: Math.min(0.6 + momentum * 0.1, 0.95), momentum: momentum, reason: `Xu hướng dài hạn nghiêng về ${longTrend.value}` }; else { let other = results[results.length - 1] === 'Tài' ? 'Xỉu' : 'Tài'; return { prediction: other, confidence: 0.5, momentum: momentum, reason: "Không có trend rõ ràng, dự đoán đảo chiều" }; } }
    countResults(results) { let counts = { 'Tài': 0, 'Xỉu': 0 }; results.forEach(r => counts[r]++); return counts; }
    getMostCommon(counts) { if (counts['Tài'] >= counts['Xỉu']) return { value: 'Tài', count: counts['Tài'] }; else return { value: 'Xỉu', count: counts['Xỉu'] }; }
    calculateMomentum(results) { if (results.length < 5) return 0; let recent = results.slice(-5), taiCount = recent.filter(r => r === 'Tài').length; if (taiCount === 5 || taiCount === 0) return 0.3; if (taiCount >= 3 || taiCount <= 2) return 0.15; return 0; }
    analyzeImbalance(history) { if (history.length < 12) return { prediction: null, confidence: 0, reason: 'Không đủ 12 phiên' }; let results = this.getResultArray(history.slice(-12)), countTai = results.filter(r => r === 'Tài').length, countXiu = results.length - countTai, imbalanceRatio = Math.abs(countTai - countXiu) / 12; if (imbalanceRatio > 0.4) { if (countTai > countXiu) return { prediction: 'Xỉu', confidence: Math.min(0.7 + imbalanceRatio * 0.2, 0.95), tai_count: countTai, xiu_count: countXiu, reason: `Chênh lệch lớn (${countTai}T - ${countXiu}X), dự đoán Xỉu để cân bằng` }; else return { prediction: 'Tài', confidence: Math.min(0.7 + imbalanceRatio * 0.2, 0.95), tai_count: countTai, xiu_count: countXiu, reason: `Chênh lệch lớn (${countTai}T - ${countXiu}X), dự đoán Tài để cân bằng` }; } else return { prediction: results[results.length - 1], confidence: 0.5, tai_count: countTai, xiu_count: countXiu, reason: `Chênh lệch ${countTai}T - ${countXiu}X trong 12 phiên, tiếp tục xu hướng` }; }
    analyzeShortTerm(history) { if (history.length < 3) return { prediction: null, confidence: 0, reason: 'Không đủ dữ liệu' }; let results = this.getResultArray(history), last3 = results.slice(-3), patterns = []; if (last3[0] === last3[1] && last3[1] === last3[2]) patterns.push({ type: 'bệt', prediction: last3[0], confidence: 0.75 }); if (last3[0] === last3[1] && last3[1] !== last3[2]) patterns.push({ type: '2-1', prediction: last3[2], confidence: 0.7 }); if (last3[0] !== last3[1] && last3[1] === last3[2]) { let other = last3[2] === 'Tài' ? 'Xỉu' : 'Tài'; patterns.push({ type: '1-2', prediction: other, confidence: 0.65 }); } if (results.length >= 4) { let last4 = results.slice(-4); if (last4[0] !== last4[1] && last4[1] !== last4[2] && last4[2] !== last4[3]) { let other = last4[3] === 'Tài' ? 'Xỉu' : 'Tài'; patterns.push({ type: 'xen_kẽ', prediction: other, confidence: 0.8 }); } } if (patterns.length > 0) { let bestPattern = patterns.reduce((best, current) => current.confidence > best.confidence ? current : best); return { prediction: bestPattern.prediction, confidence: bestPattern.confidence, pattern: bestPattern.type, reason: `Phát hiện pattern ${bestPattern.type} trong ngắn hạn` }; } else return { prediction: results[results.length - 1], confidence: 0.4, pattern: 'không_rõ', reason: "Không phát hiện pattern ngắn hạn rõ ràng" }; }
    analyzeDiceVolatility(history) { if (history.length < 5) return { prediction: null, confidence: 0, reason: 'Không đủ dữ liệu' }; let faceSequences = []; history.forEach(h => { if (h.Xuc_xac_1) faceSequences.push(h.Xuc_xac_1); if (h.Xuc_xac_2) faceSequences.push(h.Xuc_xac_2); if (h.Xuc_xac_3) faceSequences.push(h.Xuc_xac_3); }); if (faceSequences.length === 0) return { prediction: null, confidence: 0, reason: 'Không có dữ liệu mặt xúc xắc' }; let faceFreq = {}; for (let i = 1; i <= 6; i++) faceFreq[i] = 0; faceSequences.forEach(f => faceFreq[f]++); let recentFaces = []; let recentHistory = history.slice(-5); recentHistory.forEach(h => { if (h.Xuc_xac_1) recentFaces.push(h.Xuc_xac_1); if (h.Xuc_xac_2) recentFaces.push(h.Xuc_xac_2); if (h.Xuc_xac_3) recentFaces.push(h.Xuc_xac_3); }); let recentFreq = {}; for (let i = 1; i <= 6; i++) recentFreq[i] = 0; recentFaces.forEach(f => recentFreq[f]++); let predictions = []; for (let face = 1; face <= 6; face++) if (recentFreq[face] < 2) { let prob = 0.3 + (2 - recentFreq[face]) * 0.1; predictions.push({ face, prob }); } if (predictions.length > 0) { predictions.sort((a, b) => b.prob - a.prob); let topFaces = predictions.slice(0, 3); if (topFaces.length >= 3) { let predictedScores = []; for (let i = 0; i < topFaces.length; i++) for (let j = i; j < topFaces.length; j++) for (let k = j; k < topFaces.length; k++) predictedScores.push(topFaces[i].face + topFaces[j].face + topFaces[k].face); if (predictedScores.length > 0) { let avgPredicted = predictedScores.reduce((a, b) => a + b, 0) / predictedScores.length; let predType = avgPredicted >= 11 ? 'Tài' : 'Xỉu'; return { prediction: predType, confidence: 0.65, predicted_faces: topFaces.map(f => f.face), reason: `Dựa trên biến động xúc xắc, các mặt ${topFaces.map(f => f.face).join(',')} có khả năng xuất hiện cao` }; } } else if (topFaces.length === 2) { let predictedScores = []; for (let i = 0; i < topFaces.length; i++) for (let j = i; j < topFaces.length; j++) for (let k = j; k < topFaces.length; k++) predictedScores.push(topFaces[i].face + topFaces[j].face + topFaces[k].face); if (predictedScores.length > 0) { let avgPredicted = predictedScores.reduce((a, b) => a + b, 0) / predictedScores.length; let predType = avgPredicted >= 11 ? 'Tài' : 'Xỉu'; return { prediction: predType, confidence: 0.6, predicted_faces: topFaces.map(f => f.face), reason: `Dựa trên biến động xúc xắc, các mặt ${topFaces.map(f => f.face).join(',')} có khả năng xuất hiện cao` }; } } else { let face = topFaces[0].face; let avgOther = 3.5; let avgPredicted = face + avgOther + avgOther; let predType = avgPredicted >= 11 ? 'Tài' : 'Xỉu'; return { prediction: predType, confidence: 0.55, predicted_faces: [face], reason: `Dựa trên biến động xúc xắc, mặt ${face} có khả năng xuất hiện cao` }; } } return { prediction: history[history.length - 1].Ket_qua || (history[history.length - 1].score >= 11 ? 'Tài' : 'Xỉu'), confidence: 0.4, reason: "Không phát hiện biến động đặc biệt" }; }
    
    ensembleModels(history) { let modelResults = {}; modelResults.model1 = this.analyzeBasicPatterns(history); modelResults.model2 = this.analyzeTrend(history); modelResults.model3 = this.analyzeImbalance(history); modelResults.model4 = this.analyzeShortTerm(history); modelResults.model11 = this.analyzeDiceVolatility(history); for (let i = 1; i <= 42; i++) { let subResult = this.runSubModel(i, history); if (subResult && subResult.prediction) modelResults[`sub_model_${i}`] = subResult; } for (let i = 1; i <= 21; i++) { let miniResult = this.runMiniModel(i, history); if (miniResult && miniResult.prediction) modelResults[`mini_model_${i}`] = miniResult; } let taiWeight = 0, xiuWeight = 0, totalWeight = 0, details = []; for (let [modelName, result] of Object.entries(modelResults)) { if (result && result.prediction && result.confidence > 0.3) { let weight = 1.0; if (modelName.startsWith('sub')) weight = this.subModelWeights[modelName] || 1.0; else if (modelName.startsWith('mini')) weight = this.miniModelWeights[modelName] || 1.0; else weight = this.modelWeights[modelName] || 1.0; let weightedConfidence = weight * result.confidence; if (result.prediction === 'Tài') taiWeight += weightedConfidence; else if (result.prediction === 'Xỉu') xiuWeight += weightedConfidence; totalWeight += weightedConfidence; details.push({ model: result.model_name || modelName, prediction: result.prediction, confidence: result.confidence, weight: weight, reason: result.reason }); } } details.sort((a, b) => b.confidence - a.confidence); let finalPrediction, finalConfidence, finalReason, finalPattern, finalType; if (totalWeight > 0) { let taiRatio = taiWeight / totalWeight, xiuRatio = xiuWeight / totalWeight; if (taiRatio > 0.55) { finalPrediction = 'Tài'; finalConfidence = taiRatio; finalReason = `${details.length} models đồng thuận Tài (${(taiRatio*100).toFixed(1)}%)`; } else if (xiuRatio > 0.55) { finalPrediction = 'Xỉu'; finalConfidence = xiuRatio; finalReason = `${details.length} models đồng thuận Xỉu (${(xiuRatio*100).toFixed(1)}%)`; } else { let bestModel = details[0]; if (bestModel) { finalPrediction = bestModel.prediction; finalConfidence = 0.5 + bestModel.confidence * 0.2; finalReason = `Tỉ lệ cân bằng, dùng model ${bestModel.model}: ${bestModel.reason}`; } else { finalPrediction = history.length > 0 ? (history[history.length - 1].Ket_qua || (history[history.length - 1].score >= 11 ? 'Tài' : 'Xỉu')) : 'Tài'; finalConfidence = 0.5; finalReason = "Không có model nào đủ tin cậy"; } } } else { finalPrediction = history.length > 0 ? (history[history.length - 1].Ket_qua || (history[history.length - 1].score >= 11 ? 'Tài' : 'Xỉu')) : 'Tài'; finalConfidence = 0.5; finalReason = "Không đủ dữ liệu model"; } if (details.length > 0) { finalType = details[0].model; finalPattern = history.length > 0 ? this.getResultArray(history.slice(-5)).join('') : ''; } else { finalType = 'Không xác định'; finalPattern = ''; } if (sunwinStats.consecutiveLosses >= 3) { finalPrediction = finalPrediction === 'Tài' ? 'Xỉu' : 'Tài'; finalConfidence = 0.4; finalType = 'CHỐNG ĐẢO'; } return { prediction: finalPrediction, confidence: finalConfidence, reason: finalReason, pattern_type: finalType, pattern: finalPattern, details: details.slice(0, 5) }; }
    
    updateModelWeights(actual, predicted, confidence) { let correct = (actual === predicted) ? 1 : 0; for (let modelName in this.modelWeights) { if (correct) this.modelWeights[modelName] = Math.min(this.modelWeights[modelName] * 1.01, 2.0); else this.modelWeights[modelName] = Math.max(this.modelWeights[modelName] * 0.99, 0.5); } for (let modelName in this.subModelWeights) { if (correct) this.subModelWeights[modelName] = Math.min(this.subModelWeights[modelName] * 1.005, 1.5); else this.subModelWeights[modelName] = Math.max(this.subModelWeights[modelName] * 0.995, 0.7); } for (let modelName in this.miniModelWeights) { if (correct) this.miniModelWeights[modelName] = Math.min(this.miniModelWeights[modelName] * 1.003, 1.3); else this.miniModelWeights[modelName] = Math.max(this.miniModelWeights[modelName] * 0.997, 0.8); } saveSunwinModelWeights(); }
}

const sunwinAI = new SunwinAnalyzer();

// ==================== SUNWIN WEBSOCKET ====================
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
let sunwinReconnectTimeout = null;

function connectSunwin() {
    if (sunwinWs) { try { sunwinWs.removeAllListeners(); sunwinWs.close(); } catch(e) {} }
    sunwinWs = new WebSocket(SUNWIN_WS_URL, { headers: WS_HEADERS });
    sunwinWs.on('open', () => {
        console.log('[✅] Sunwin WebSocket connected');
        initialMessages.forEach((msg, i) => { setTimeout(() => { if (sunwinWs.readyState === WebSocket.OPEN) sunwinWs.send(JSON.stringify(msg)); }, i * 600); });
        sunwinPingInterval = setInterval(() => { if (sunwinWs.readyState === WebSocket.OPEN) sunwinWs.ping(); }, PING_INTERVAL);
    });
    sunwinWs.on('message', (msg) => {
        try {
            let data = JSON.parse(msg);
            if (!Array.isArray(data) || typeof data[1] !== 'object') return;
            let { cmd, sid, d1, d2, d3, gBB } = data[1];
            if (cmd === 1008 && sid) sunwinCurrentSessionId = sid;
            if (cmd === 1003 && gBB && d1 && d2 && d3) {
                let total = d1 + d2 + d3, result = total > 10 ? "Tài" : "Xỉu";
                let predictionCorrect = false;
                if (sunwinLastPrediction && sunwinLastPrediction.ket_qua) {
                    predictionCorrect = sunwinLastPrediction.ket_qua === result;
                    sunwinStats.total++; if (predictionCorrect) { sunwinStats.correct++; sunwinStats.consecutiveLosses = 0; } else { sunwinStats.wrong++; sunwinStats.consecutiveLosses++; }
                    sunwinAI.updateModelWeights(result, sunwinLastPrediction.ket_qua, sunwinLastPrediction.do_tin_cay);
                }
                let historyEntry = { phien: sunwinCurrentSessionId, Xuc_xac_1: d1, Xuc_xac_2: d2, Xuc_xac_3: d3, Tong: total, Ket_qua: result, du_doan: sunwinLastPrediction ? sunwinLastPrediction.ket_qua : null, loai_cau: sunwinLastPrediction ? sunwinLastPrediction.loai_cau : null, do_tin_cay: sunwinLastPrediction ? sunwinLastPrediction.do_tin_cay : null, thoi_gian: new Date().toISOString() };
                saveSunwinHistory(historyEntry);
                let historyForAnalyzer = sunwinHistory.map(h => ({ score: h.Tong, Ket_qua: h.Ket_qua, Xuc_xac_1: h.Xuc_xac_1, Xuc_xac_2: h.Xuc_xac_2, Xuc_xac_3: h.Xuc_xac_3 }));
                let ensembleResult = sunwinAI.ensembleModels(historyForAnalyzer);
                let finalPrediction = ensembleResult.prediction, finalConfidence = ensembleResult.confidence, finalType = ensembleResult.pattern_type, finalPattern = ensembleResult.pattern;
                if (sunwinStats.consecutiveLosses >= 3) { finalPrediction = finalPrediction === 'Tài' ? 'Xỉu' : 'Tài'; finalConfidence = 0.4; finalType = 'CHỐNG ĐẢO (SAU ' + sunwinStats.consecutiveLosses + ' LẦN THUA)'; finalPattern = ''; }
                sunwinLastPrediction = { phien: sunwinCurrentSessionId ? parseInt(sunwinCurrentSessionId) + 1 : null, ket_qua: finalPrediction, loai_cau: finalType, mau_cau: finalPattern, do_tin_cay: (finalConfidence * 100).toFixed(0) + '%' };
                let trangThai = finalType.includes('CHỐNG') ? 'Chống đảo' : 'Đang theo cầu';
                let tiLe = sunwinStats.total > 0 ? ((sunwinStats.correct / sunwinStats.total) * 100).toFixed(1) + '%' : '0%';
                sunwinApiResponse = { "Phien": sunwinCurrentSessionId, "Xuc_xac_1": d1, "Xuc_xac_2": d2, "Xuc_xac_3": d3, "Tong": total, "Ket_qua": result, "Phien_hien_tai": sunwinCurrentSessionId ? parseInt(sunwinCurrentSessionId) + 1 : null, "Du_doan": finalPrediction, "Loai_cau": finalType, "Mau_cau_phat_hien": finalPattern, "Do_tin_cay": (finalConfidence * 100).toFixed(0) + '%', "Trang_thai": trangThai, "Ket_qua_du_doan": predictionCorrect ? '✅' : (sunwinStats.total > 0 ? '❌' : ''), "Thong_ke": { "tong": sunwinStats.total, "dung": sunwinStats.correct, "sai": sunwinStats.wrong, "ti_le": tiLe }, "id": "@tranhoang2286" };
                console.log(`[Sunwin] P${sunwinApiResponse.Phien} | KQ: ${result} | Dự đoán: ${finalPrediction} (${(finalConfidence*100).toFixed(0)}%) ${predictionCorrect?'✅':'❌'}`);
                sunwinCurrentSessionId = null;
            }
        } catch(e) { console.error('[Sunwin] Lỗi:', e.message); }
    });
    sunwinWs.on('close', () => { clearInterval(sunwinPingInterval); clearTimeout(sunwinReconnectTimeout); sunwinReconnectTimeout = setTimeout(connectSunwin, RECONNECT_DELAY); });
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

// ==================== PHẦN 3: LC79 (GIỮ NGUYÊN TỪ lc.js) ====================

const lc79App = express();
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

// LC79 endpoints (gắn vào app chính)
app.get('/lc79-hu', async (req, res) => { try { let data = await fetchLC79Data('hu'); if (!data || data.length === 0) return res.json({ error: 'Không thể lấy dữ liệu' }); let result = calculateLC79Prediction(data, 'hu'); let latest = data[0]; let record = { Phien: latest.Phien, Xuc_xac_1: latest.Xuc_xac_1, Xuc_xac_2: latest.Xuc_xac_2, Xuc_xac_3: latest.Xuc_xac_3, Tong: latest.Tong, Ket_qua: latest.Ket_qua, Do_tin_cay: `${result.confidence}%`, Phien_hien_tai: latest.Phien + 1, Du_doan: result.prediction, ket_qua_du_doan: '', id: '@tranhoang2286', timestamp: new Date().toISOString() }; lc79PredictionHistory.hu.unshift(record); if (lc79PredictionHistory.hu.length > 100) lc79PredictionHistory.hu.pop(); saveLC79History(); res.json(record); } catch(e) { res.status(500).json({ error: e.message }); } });
app.get('/lc79-md5', async (req, res) => { try { let data = await fetchLC79Data('md5'); if (!data || data.length === 0) return res.json({ error: 'Không thể lấy dữ liệu' }); let result = calculateLC79Prediction(data, 'md5'); let latest = data[0]; let record = { Phien: latest.Phien, Xuc_xac_1: latest.Xuc_xac_1, Xuc_xac_2: latest.Xuc_xac_2, Xuc_xac_3: latest.Xuc_xac_3, Tong: latest.Tong, Ket_qua: latest.Ket_qua, Do_tin_cay: `${result.confidence}%`, Phien_hien_tai: latest.Phien + 1, Du_doan: result.prediction, ket_qua_du_doan: '', id: '@tranhoang2286', timestamp: new Date().toISOString() }; lc79PredictionHistory.md5.unshift(record); if (lc79PredictionHistory.md5.length > 100) lc79PredictionHistory.md5.pop(); saveLC79History(); res.json(record); } catch(e) { res.status(500).json({ error: e.message }); } });
app.get('/lc79-hu/lichsu', (req, res) => { res.json({ type: 'Lẩu Cua 79 - Tài Xỉu Hũ', history: lc79PredictionHistory.hu, total: lc79PredictionHistory.hu.length }); });
app.get('/lc79-md5/lichsu', (req, res) => { res.json({ type: 'Lẩu Cua 79 - Tài Xỉu MD5', history: lc79PredictionHistory.md5, total: lc79PredictionHistory.md5.length }); });

// ==================== API ENDPOINTS CHÍNH ====================
app.get('/api/sieu', (req, res) => { res.json(sunwinApiResponse); });
app.get('/api/ditmemaysun', (req, res) => { res.json(sunwinApiResponse); });
app.get('/api/his', (req, res) => { let recent = sunwinHistory.slice(-20).reverse(); res.json({ success: true, total: sunwinHistory.length, data: recent, stats: { tong: sunwinStats.total, dung: sunwinStats.correct, sai: sunwinStats.wrong, ti_le: sunwinStats.total > 0 ? ((sunwinStats.correct / sunwinStats.total) * 100).toFixed(1) + '%' : '0%', consecutive_losses: sunwinStats.consecutiveLosses } }); });
app.get('/api/models', (req, res) => { res.json({ main_models: Object.keys(sunwinModelWeights).length, sub_models: Object.keys(sunwinSubModelWeights).length, mini_models: Object.keys(sunwinMiniModelWeights).length, total: 84, weights: { main: sunwinModelWeights, sub: sunwinSubModelWeights, mini: sunwinMiniModelWeights } }); });

// 68GB endpoints
app.get('/api/68gb/txhu', (req, res) => { res.json(gb68Bot.txhu.last_result || { error: "No data" }); });
app.get('/api/68gb/history/txhu', (req, res) => { res.json(gb68Bot.txhu.history.slice().reverse()); });
app.get('/api/68gb/txmd5', (req, res) => { res.json(gb68Bot.md5.last_result || { error: "No data" }); });
app.get('/api/68gb/history/txmd5', (req, res) => { res.json(gb68Bot.md5.history.slice().reverse()); });

app.get('/', (req, res) => { res.json({ status: 'active', message: 'Sunwin + 68GB + LC79 API', endpoints: { sunwin: '/api/sieu', gb68: '/api/68gb/txhu', lc79: '/lc79-hu' }, id: '@tranhoang2286' }); });

// ==================== START ====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 ===== SUPER API TÀI XỈU =====`);
    console.log(`🌐 Server: http://0.0.0.0:${PORT}`);
    console.log(`📌 Sunwin: /api/sieu (84 models, WebSocket realtime)`);
    console.log(`📌 68GB: /api/68gb/txhu, /api/68gb/txmd5 (WebSocket realtime)`);
    console.log(`📌 LC79: /lc79-hu, /lc79-md5, /lc79-hu/lichsu, /lc79-md5/lichsu (Fetch API)`);
    console.log(`=====================================\n`);
});

connectSunwin();
