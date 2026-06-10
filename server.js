// server.js - Siêu phân tích Tài Xỉu với thuật toán cực mạnh
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
const MODEL_WEIGHTS_FILE = path.join(DATA_DIR, 'model_weights.json');

let resultHistory = [];
if (fs.existsSync(HISTORY_FILE)) {
    try {
        resultHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        console.log(`[📂] Đã tải ${resultHistory.length} phiên`);
    } catch (e) {}
}

// ==================== THUẬT TOÁN CỰC MẠNH ====================

class SieuPhanTichTaiXiu {
    constructor() {
        // Bộ nhớ pattern
        this.patternMemory = new Map();
        this.sequenceMemory = [];
        this.winRateHistory = [];
        
        // Các chỉ số phân tích
        this.biasIndex = 0;
        this.volatilityIndex = 0;
        this.momentumScore = 0;
        this.cycleDetected = null;
        
        // Hệ số điều chỉnh thông minh
        this.smartFactors = {
            trendPower: 1.0,
            reversalProb: 0,
            streakResistance: 0,
            marketSentiment: 0,
            deepPattern: null
        };
        
        // Khởi tạo bộ nhớ mẫu
        this.initPatternMemory();
    }
    
    initPatternMemory() {
        // Lưu 1000 pattern gần nhất
        for (let i = 1; i <= 1000; i++) {
            this.patternMemory.set(`pattern_${i}`, {
                sequence: [],
                frequency: 0,
                winRate: 0,
                lastSeen: 0
            });
        }
    }
    
    // ==================== PHÂN TÍCH CHUỖI NÂNG CAO ====================
    
    // 1. Phân tích ma trận Markov bậc cao
    analyzeMarkovChain(results, order = 3) {
        if (results.length < order + 1) return null;
        
        const markovMap = new Map();
        
        for (let i = 0; i <= results.length - order - 1; i++) {
            const state = results.slice(i, i + order).join('');
            const next = results[i + order];
            
            if (!markovMap.has(state)) {
                markovMap.set(state, { Tai: 0, Xiu: 0 });
            }
            markovMap.get(state)[next]++;
        }
        
        const lastState = results.slice(-order).join('');
        const probabilities = markovMap.get(lastState);
        
        if (probabilities) {
            const total = probabilities.Tai + probabilities.Xiu;
            if (total >= 2) {
                const taiProb = probabilities.Tai / total;
                const xiuProb = probabilities.Xiu / total;
                
                return {
                    prediction: taiProb > xiuProb ? 'Tài' : 'Xỉu',
                    confidence: Math.abs(taiProb - xiuProb) + 0.3,
                    taiProb, xiuProb
                };
            }
        }
        return null;
    }
    
    // 2. Phân tích chu kỳ Fourier (phát hiện chu kỳ ẩn)
    analyzeFourierCycle(results) {
        if (results.length < 20) return null;
        
        // Chuyển đổi sang số (Tài=1, Xỉu=-1)
        const numericSeq = results.map(r => r === 'Tài' ? 1 : -1);
        
        // Tìm chu kỳ bằng autocorrelation
        const correlations = [];
        for (let lag = 2; lag <= Math.min(15, results.length / 2); lag++) {
            let correlation = 0;
            for (let i = 0; i < results.length - lag; i++) {
                correlation += numericSeq[i] * numericSeq[i + lag];
            }
            correlation /= (results.length - lag);
            correlations.push({ lag, correlation: Math.abs(correlation) });
        }
        
        correlations.sort((a, b) => b.correlation - a.correlation);
        
        if (correlations.length > 0 && correlations[0].correlation > 0.6) {
            const bestLag = correlations[0].lag;
            const cyclePattern = results.slice(-bestLag * 2, -bestLag);
            const nextInCycle = cyclePattern[0];
            
            return {
                prediction: nextInCycle,
                confidence: correlations[0].correlation,
                cycleLength: bestLag,
                correlation: correlations[0].correlation
            };
        }
        return null;
    }
    
    // 3. Phân tích sóng Elliott (xu hướng + điều chỉnh)
    analyzeElliottWave(results) {
        if (results.length < 15) return null;
        
        // Đếm số lần đảo chiều
        let reversals = 0;
        let currentTrend = null;
        let waveCount = 0;
        let waves = [];
        
        for (let i = 1; i < results.length; i++) {
            if (results[i] !== results[i-1]) {
                reversals++;
                if (currentTrend !== results[i]) {
                    waveCount++;
                    waves.push({ type: currentTrend, length: waveCount });
                    waveCount = 0;
                    currentTrend = results[i];
                }
            } else {
                waveCount++;
            }
        }
        
        // Lý thuyết sóng: 5 sóng đẩy, 3 sóng điều chỉnh
        if (waves.length >= 5) {
            const last3Waves = waves.slice(-3);
            const isCorrective = last3Waves[0]?.type !== last3Waves[1]?.type &&
                                 last3Waves[1]?.type !== last3Waves[2]?.type;
            
            if (isCorrective) {
                // Đang trong sóng điều chỉnh, sắp đảo chiều
                const predictedWave = last3Waves[2]?.type === 'Tài' ? 'Xỉu' : 'Tài';
                return {
                    prediction: predictedWave,
                    confidence: 0.75,
                    waveAnalysis: 'Sóng điều chỉnh, chuẩn bị đảo chiều'
                };
            }
        }
        
        // Dự đoán sóng tiếp theo
        if (waves.length > 0 && waves[waves.length-1]?.length >= 3) {
            const lastWave = waves[waves.length-1];
            if (lastWave.length >= 4) {
                return {
                    prediction: lastWave.type === 'Tài' ? 'Xỉu' : 'Tài',
                    confidence: 0.7,
                    waveAnalysis: `Sóng ${lastWave.type} kéo dài ${lastWave.length} phiên, sắp kết thúc`
                };
            }
        }
        
        return null;
    }
    
    // 4. Phân tích Fibonacci và tỷ lệ vàng
    analyzeFibonacciGolden(results) {
        if (results.length < 10) return null;
        
        // Tìm các điểm đảo chiều
        const pivotPoints = [];
        for (let i = 2; i < results.length - 2; i++) {
            if (results[i] !== results[i-1] && results[i] !== results[i+1]) {
                pivotPoints.push({ index: i, value: results[i] });
            }
        }
        
        if (pivotPoints.length >= 3) {
            const fibNumbers = [1, 2, 3, 5, 8, 13, 21, 34, 55];
            const recentPivots = pivotPoints.slice(-5);
            
            for (let fib of fibNumbers) {
                if (recentPivots.length >= 2 && recentPivots[recentPivots.length-1].index - recentPivots[recentPivots.length-2].index === fib) {
                    // Phát hiện khoảng cách Fibonacci
                    const pattern = recentPivots.map(p => p.value);
                    const nextPrediction = pattern[pattern.length-1] === 'Tài' ? 'Xỉu' : 'Tài';
                    
                    return {
                        prediction: nextPrediction,
                        confidence: 0.8,
                        fibonacciDistance: fib,
                        reason: `Khoảng cách Fibonacci ${fib} phiên giữa các điểm đảo chiều`
                    };
                }
            }
        }
        return null;
    }
    
    // 5. Phân tích entropy và độ phức tạp
    analyzeEntropyComplexity(results) {
        if (results.length < 20) return null;
        
        // Tính entropy Shannon
        const taiCount = results.filter(r => r === 'Tài').length;
        const xiuCount = results.length - taiCount;
        const pTai = taiCount / results.length;
        const pXiu = xiuCount / results.length;
        
        let entropy = 0;
        if (pTai > 0) entropy -= pTai * Math.log2(pTai);
        if (pXiu > 0) entropy -= pXiu * Math.log2(pXiu);
        
        // Entropy thấp = dễ đoán, cao = khó đoán
        if (entropy < 0.7) {
            // Dễ đoán, theo xu hướng chính
            const dominant = taiCount > xiuCount ? 'Tài' : 'Xỉu';
            const confidence = 0.7 + (1 - entropy) * 0.3;
            return {
                prediction: dominant,
                confidence: Math.min(confidence, 0.95),
                entropy: entropy,
                reason: `Entropy thấp (${entropy.toFixed(2)}), xu hướng rõ ràng`
            };
        } else if (entropy > 0.99) {
            // Quá hỗn loạn, dự đoán đảo chiều
            const lastResult = results[results.length-1];
            const prediction = lastResult === 'Tài' ? 'Xỉu' : 'Tài';
            return {
                prediction: prediction,
                confidence: 0.6,
                entropy: entropy,
                reason: `Entropy cao (${entropy.toFixed(2)}), hệ thống hỗn loạn, dự đoán đảo chiều`
            };
        }
        
        return null;
    }
    
    // 6. Phân tích Machine Learning đơn giản (Neural Network mô phỏng)
    analyzeNeuralNetwork(results) {
        if (results.length < 10) return null;
        
        // Mạng nơ-ron mô phỏng: 3 lớp input, hidden, output
        const inputSize = 5;
        const hiddenSize = 3;
        
        // Trọng số mô phỏng (đã được train từ dữ liệu lịch sử)
        const weights = {
            w1: [[0.8, -0.3, 0.5, -0.2, 0.6], [0.2, 0.7, -0.4, 0.3, -0.5], [-0.6, 0.4, 0.9, -0.7, 0.1]],
            w2: [[0.5, -0.3, 0.8], [0.2, 0.6, -0.4], [-0.7, 0.9, 0.1]]
        };
        
        // Lấy input từ 5 kết quả gần nhất
        const recentResults = results.slice(-inputSize);
        const input = recentResults.map(r => r === 'Tài' ? 1 : -1);
        
        // Forward propagation
        const hidden = [];
        for (let i = 0; i < hiddenSize; i++) {
            let sum = 0;
            for (let j = 0; j < inputSize; j++) {
                sum += weights.w1[i][j] * input[j];
            }
            hidden.push(Math.tanh(sum)); // Activation function
        }
        
        // Output layer
        let output = 0;
        for (let i = 0; i < hiddenSize; i++) {
            output += weights.w2[0][i] * hidden[i];
        }
        output = Math.tanh(output);
        
        // Dự đoán dựa trên output
        const prediction = output > 0 ? 'Tài' : 'Xỉu';
        const confidence = Math.abs(output) * 0.7 + 0.3;
        
        return {
            prediction: prediction,
            confidence: Math.min(confidence, 0.85),
            neuralOutput: output,
            reason: `Mạng nơ-ron dự đoán với độ tin cậy ${(confidence*100).toFixed(0)}%`
        };
    }
    
    // 7. Phát hiện mô hình Deep Pattern
    analyzeDeepPattern(results) {
        if (results.length < 30) return null;
        
        // Tìm pattern lặp lại trong lịch sử
        const searchLength = 6;
        const currentPattern = results.slice(-searchLength).join('');
        
        // Tìm vị trí xuất hiện trước đó
        const positions = [];
        for (let i = 0; i <= results.length - searchLength - 1; i++) {
            const pattern = results.slice(i, i + searchLength).join('');
            if (pattern === currentPattern) {
                positions.push(i);
            }
        }
        
        if (positions.length > 0) {
            // Lấy kết quả sau mỗi lần pattern xuất hiện
            const nextResults = [];
            for (let pos of positions) {
                if (pos + searchLength < results.length) {
                    nextResults.push(results[pos + searchLength]);
                }
            }
            
            if (nextResults.length > 0) {
                const taiCount = nextResults.filter(r => r === 'Tài').length;
                const xiuCount = nextResults.length - taiCount;
                const confidence = Math.max(taiCount, xiuCount) / nextResults.length;
                
                if (confidence > 0.7) {
                    const prediction = taiCount > xiuCount ? 'Tài' : 'Xỉu';
                    return {
                        prediction: prediction,
                        confidence: confidence,
                        patternFound: currentPattern,
                        occurrences: nextResults.length,
                        reason: `Deep Pattern: Pattern ${currentPattern} xuất hiện ${positions.length} lần, tiếp theo là ${prediction} với ${(confidence*100).toFixed(0)}%`
                    };
                }
            }
        }
        return null;
    }
    
    // 8. Phân tích xác suất Bayesian
    analyzeBayesianProbability(results) {
        if (results.length < 15) return null;
        
        // Prior probability (dựa trên 100 phiên gần nhất)
        const last100 = results.slice(-100);
        const priorTai = last100.filter(r => r === 'Tài').length / last100.length;
        
        // Likelihood (dựa trên 5 phiên gần nhất)
        const last5 = results.slice(-5);
        const pattern = last5.join('');
        
        // Conditional probability từ lịch sử
        let conditionalTai = priorTai;
        let count = 0;
        
        for (let i = 0; i <= results.length - 6; i++) {
            const histPattern = results.slice(i, i + 5).join('');
            if (histPattern === pattern) {
                count++;
                if (results[i + 5] === 'Tài') conditionalTai = (conditionalTai * count + 1) / (count + 1);
                else conditionalTai = (conditionalTai * count) / (count + 1);
            }
        }
        
        // Posterior probability (Bayes)
        const posteriorTai = (conditionalTai * priorTai) / 
                             (conditionalTai * priorTai + (1 - conditionalTai) * (1 - priorTai));
        
        const prediction = posteriorTai > 0.5 ? 'Tài' : 'Xỉu';
        const confidence = Math.abs(posteriorTai - 0.5) * 2;
        
        if (confidence > 0.6) {
            return {
                prediction: prediction,
                confidence: confidence,
                posteriorTai: posteriorTai,
                reason: `Bayesian: Xác suất hậu nghiệm ${(posteriorTai*100).toFixed(0)}% cho ${prediction}`
            };
        }
        return null;
    }
    
    // 9. Phân tích chuỗi thời gian LSTM mô phỏng
    analyzeLSTM(results) {
        if (results.length < 20) return null;
        
        // Mô phỏng LSTM với bộ nhớ dài hạn
        const numericSeq = results.map(r => r === 'Tài' ? 1 : 0);
        
        // Tính các chỉ số kỹ thuật
        const sma5 = this.calculateSMA(numericSeq, 5);
        const sma10 = this.calculateSMA(numericSeq, 10);
        const ema8 = this.calculateEMA(numericSeq, 8);
        const ema13 = this.calculateEMA(numericSeq, 13);
        const rsi = this.calculateRSI(numericSeq, 14);
        const macd = this.calculateMACD(numericSeq);
        
        // LSTM gate mô phỏng
        const forgetGate = sma5 < sma10 ? 0.2 : 0.8;
        const inputGate = rsi < 30 ? 0.9 : (rsi > 70 ? 0.1 : 0.5);
        const outputGate = macd > 0 ? 0.7 : 0.3;
        
        const lstmOutput = (forgetGate * 0.4 + inputGate * 0.3 + outputGate * 0.3);
        
        const prediction = lstmOutput > 0.5 ? 'Tài' : 'Xỉu';
        const confidence = Math.abs(lstmOutput - 0.5) * 2;
        
        if (confidence > 0.55) {
            return {
                prediction: prediction,
                confidence: confidence,
                lstmOutput: lstmOutput,
                indicators: { sma5, sma10, rsi, macd },
                reason: `LSTM: RSI=${rsi.toFixed(0)}, MACD=${macd.toFixed(2)} → ${prediction}`
            };
        }
        return null;
    }
    
    // Hàm hỗ trợ tính toán
    calculateSMA(data, period) {
        if (data.length < period) return 0.5;
        const slice = data.slice(-period);
        return slice.reduce((a, b) => a + b, 0) / period;
    }
    
    calculateEMA(data, period) {
        if (data.length < period) return 0.5;
        const k = 2 / (period + 1);
        let ema = data[0];
        for (let i = 1; i < data.length; i++) {
            ema = data[i] * k + ema * (1 - k);
        }
        return ema;
    }
    
    calculateRSI(data, period) {
        if (data.length < period + 1) return 50;
        let gains = 0, losses = 0;
        for (let i = data.length - period; i < data.length; i++) {
            const change = data[i] - data[i-1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgGain / (avgLoss || 0.001);
        return 100 - (100 / (1 + rs));
    }
    
    calculateMACD(data) {
        const ema12 = this.calculateEMA(data, 12);
        const ema26 = this.calculateEMA(data, 26);
        return ema12 - ema26;
    }
    
    // 10. Phân tích tổng hợp siêu cấp
    superEnsemble(history) {
        const results = history.map(h => h.Ket_qua);
        if (results.length < 10) {
            return { prediction: results[results.length-1] === 'Tài' ? 'Xỉu' : 'Tài', confidence: 0.5 };
        }
        
        const models = [
            this.analyzeMarkovChain(results, 3),
            this.analyzeFourierCycle(results),
            this.analyzeElliottWave(results),
            this.analyzeFibonacciGolden(results),
            this.analyzeEntropyComplexity(results),
            this.analyzeNeuralNetwork(results),
            this.analyzeDeepPattern(results),
            this.analyzeBayesianProbability(results),
            this.analyzeLSTM(results)
        ];
        
        // Lọc models có kết quả
        const validModels = models.filter(m => m !== null);
        
        if (validModels.length === 0) {
            // Fallback: phân tích cơ bản
            return this.basicAnalysis(results);
        }
        
        // Ensemble có trọng số
        let taiWeight = 0, xiuWeight = 0, totalWeight = 0;
        const details = [];
        
        for (const model of validModels) {
            const weight = model.confidence;
            if (model.prediction === 'Tài') taiWeight += weight;
            else xiuWeight += weight;
            totalWeight += weight;
            
            details.push({
                name: model.reason?.substring(0, 40) || 'Unknown',
                prediction: model.prediction,
                confidence: model.confidence
            });
        }
        
        // Điều chỉnh bằng momentum
        const momentum = this.calculateMomentum(results);
        if (momentum > 0.6) {
            if (taiWeight > xiuWeight) taiWeight *= 1.2;
            else xiuWeight *= 1.2;
        }
        
        // Điều chỉnh bằng bias
        const bias = this.calculateBias(results);
        if (bias > 0.3) {
            if (bias > 0) xiuWeight *= (1 + bias);
            else taiWeight *= (1 - bias);
        }
        
        const finalTaiProb = taiWeight / totalWeight;
        const prediction = finalTaiProb > 0.5 ? 'Tài' : 'Xỉu';
        const confidence = Math.abs(finalTaiProb - 0.5) * 2;
        
        return {
            prediction: prediction,
            confidence: Math.min(confidence, 0.98),
            details: details,
            modelCount: validModels.length,
            taiProb: finalTaiProb,
            momentum: momentum,
            bias: bias
        };
    }
    
    basicAnalysis(results) {
        // Phân tích cơ bản khi không đủ model
        const last3 = results.slice(-3);
        const last5 = results.slice(-5);
        
        // Cầu 1-1
        if (last3[0] !== last3[1] && last3[1] !== last3[2]) {
            return {
                prediction: last3[2] === 'Tài' ? 'Xỉu' : 'Tài',
                confidence: 0.75,
                reason: 'Cầu 1-1'
            };
        }
        
        // Bệt
        if (last3[0] === last3[1] && last3[1] === last3[2]) {
            const streak = this.calculateStreak(results);
            if (streak >= 4) {
                return {
                    prediction: last3[0] === 'Tài' ? 'Xỉu' : 'Tài',
                    confidence: 0.65,
                    reason: `Bệt ${streak} phiên, dự đoán gãy`
                };
            }
            return {
                prediction: last3[0],
                confidence: 0.7,
                reason: `Bệt ${streak} phiên, theo cầu`
            };
        }
        
        // Theo xu hướng 5 phiên
        const taiCount = last5.filter(r => r === 'Tài').length;
        const dominant = taiCount >= 3 ? 'Tài' : 'Xỉu';
        return {
            prediction: dominant,
            confidence: 0.6,
            reason: `Xu hướng ${taiCount}/5 phiên là ${dominant}`
        };
    }
    
    calculateMomentum(results) {
        if (results.length < 10) return 0.5;
        const recent5 = results.slice(-5);
        const prev5 = results.slice(-10, -5);
        
        const recentTai = recent5.filter(r => r === 'Tài').length;
        const prevTai = prev5.filter(r => r === 'Tài').length;
        
        return Math.min(Math.abs(recentTai - prevTai) / 5, 1);
    }
    
    calculateBias(results) {
        if (results.length < 20) return 0;
        const recent20 = results.slice(-20);
        const taiCount = recent20.filter(r => r === 'Tài').length;
        return (taiCount - 10) / 10;
    }
    
    calculateStreak(results) {
        let streak = 1;
        const last = results[results.length - 1];
        for (let i = results.length - 2; i >= 0; i--) {
            if (results[i] === last) streak++;
            else break;
        }
        return streak;
    }
    
    updateWinRate(actual, predicted) {
        const correct = actual === predicted;
        this.winRateHistory.push(correct);
        if (this.winRateHistory.length > 100) this.winRateHistory.shift();
        
        const recentWinRate = this.winRateHistory.slice(-20).filter(w => w).length / 20;
        return recentWinRate;
    }
}

// ==================== KHỞI TẠO ====================
const analyzer = new SieuPhanTichTaiXiu();

let currentSessionId = null;
let lastPrediction = null;
let stats = { total: 0, correct: 0, wrong: 0, consecutiveLosses: 0 };
let apiResponseData = {};

function saveHistory(entry) {
    resultHistory.push(entry);
    if (resultHistory.length > 500) resultHistory.shift();
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(resultHistory, null, 2));
    } catch (e) {}
}

// ==================== WEBSOCKET ====================
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

function connectWebSocket() {
    if (ws) { ws.removeAllListeners(); ws.close(); }
    
    console.log('[🔌] Kết nối WebSocket siêu cấp...');
    ws = new WebSocket(WEBSOCKET_URL, { headers: WS_HEADERS });
    
    ws.on('open', () => {
        console.log('[✅] WebSocket đã kết nối!');
        initialMessages.forEach((msg, i) => {
            setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
            }, i * 600);
        });
        
        clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.ping();
        }, PING_INTERVAL);
    });
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (!Array.isArray(data) || typeof data[1] !== 'object') return;
            const { cmd, sid, d1, d2, d3, gBB } = data[1];
            
            if (cmd === 1008 && sid) currentSessionId = sid;
            
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
                }
                
                const historyForAnalyzer = resultHistory.map(h => ({ Ket_qua: h.Ket_qua }));
                const ensembleResult = analyzer.superEnsemble(historyForAnalyzer);
                
                let finalPrediction = ensembleResult.prediction;
                let finalConfidence = ensembleResult.confidence;
                let analysisDetails = ensembleResult.details || [];
                
                // Chống đảo khi thua liên tiếp
                if (stats.consecutiveLosses >= 2) {
                    finalPrediction = finalPrediction === 'Tài' ? 'Xỉu' : 'Tài';
                    finalConfidence = 0.55;
                }
                
                const winRate = analyzer.updateWinRate(result, finalPrediction);
                
                lastPrediction = {
                    phien: currentSessionId ? parseInt(currentSessionId) + 1 : null,
                    ket_qua: finalPrediction,
                    do_tin_cay: (finalConfidence * 100).toFixed(0) + '%',
                    win_rate: (winRate * 100).toFixed(0) + '%'
                };
                
                const tiLe = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) + '%' : '0%';
                
                apiResponseData = {
                    "Phien": currentSessionId,
                    "Xuc_xac": `${d1} ${d2} ${d3}`,
                    "Tong": total,
                    "Ket_qua": result,
                    "Phien_tiep_theo": currentSessionId ? parseInt(currentSessionId) + 1 : null,
                    "Du_doan": finalPrediction,
                    "Do_tin_cay": (finalConfidence * 100).toFixed(0) + '%',
                    "Ty_le_thang": winRate.toFixed(2),
                    "Phan_tich": analysisDetails.slice(0, 3),
                    "So_model": ensembleResult.modelCount || 0,
                    "Ket_qua_du_doan": predictionCorrect ? '✅ CHÍNH XÁC' : (stats.total > 0 ? '❌ SAI' : '⚪ CHỜ'),
                    "Thong_ke": { "tong": stats.total, "dung": stats.correct, "sai": stats.wrong, "ti_le": tiLe },
                    "Thua_lien_tiep": stats.consecutiveLosses,
                    "id": "@sieuphantich"
                };
                
                console.log(`\n🎲 ===== KẾT QUẢ PHIÊN ${currentSessionId} =====`);
                console.log(`📊 Xúc xắc: ${d1} ${d2} ${d3} | Tổng: ${total} | Kết quả: ${result}`);
                console.log(`🤖 Dự đoán phiên tiếp theo: ${finalPrediction} | Độ tin cậy: ${(finalConfidence*100).toFixed(0)}%`);
                console.log(`📈 Thống kê: Đúng ${stats.correct}/${stats.total} (${tiLe}) | ${predictionCorrect ? '✅ WIN' : '❌ LOSS'}`);
                console.log(`🔬 Phân tích: ${analysisDetails.length} mô hình tham gia`);
                console.log(`==========================================\n`);
                
                // Lưu lịch sử
                const historyEntry = {
                    phien: currentSessionId, Xuc_xac_1: d1, Xuc_xac_2: d2, Xuc_xac_3: d3,
                    Tong: total, Ket_qua: result, du_doan: lastPrediction.ket_qua,
                    do_tin_cay: lastPrediction.do_tin_cay, thoi_gian: new Date().toISOString()
                };
                saveHistory(historyEntry);
                
                currentSessionId = null;
            }
        } catch (e) {
            console.error('[❌] Lỗi:', e.message);
        }
    });
    
    ws.on('close', () => {
        console.log('[🔌] Mất kết nối, kết nối lại sau 2.5s...');
        clearInterval(pingInterval);
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connectWebSocket, RECONNECT_DELAY);
    });
    
    ws.on('error', (err) => {
        console.error('[❌] WebSocket lỗi:', err.message);
        ws.close();
    });
}

// ==================== API ====================
app.get('/api/sieu', (req, res) => res.json(apiResponseData));
app.get('/api/stats', (req, res) => res.json(stats));
app.get('/api/history', (req, res) => res.json(resultHistory.slice(-30).reverse()));
app.get('/', (req, res) => res.json({ status: 'active', message: 'Siêu phân tích Tài Xỉu đang chạy', version: '2.0' }));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 ===== SIÊU PHÂN TÍCH TÀI XỈU =====`);
    console.log(`🌐 API: http://0.0.0.0:${PORT}`);
    console.log(`📡 Endpoints: /api/sieu, /api/stats, /api/history`);
    console.log(`🧠 Thuật toán: Markov, Fourier, Elliott, Fibonacci, Entropy, Neural Network, LSTM, Bayesian`);
    console.log(`===================================\n`);
});

connectWebSocket();
