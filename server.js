const axios = require('axios');
const express = require('express');
const https = require('https');

// ======================
// CẤU HÌNH HỆ THỐNG
// ======================
const BASE = "https://aibcr.me";
const LOGIN_URL = `${BASE}/login`;
const LOBBY_URL = `${BASE}/ae/lobby`;

// THAY ĐỔI QUAN TRỌNG: Đổi endpoint từ getnewresult sang endpoint lấy cấu trúc bàn (Gettable)
const GET_TABLE_URL = `${BASE}/baccarat/gettable`; 

const USERNAME = "Hoang2285";
const PASSWORD = "hoang2010";

const agent = new https.Agent({ rejectUnauthorized: false });
let cookieJar = '';
let baccaratData = [];
let lastUpdate = null;

const session = axios.create({
    baseURL: BASE,
    timeout: 15000,
    httpsAgent: agent,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'X-Requested-With': 'XMLHttpRequest'
    }
});

// Đồng bộ hóa Cookie
session.interceptors.request.use(config => {
    if (cookieJar) config.headers.Cookie = cookieJar;
    return config;
});

session.interceptors.response.use(res => {
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
        let cookieMap = new Map();
        if (cookieJar) {
            cookieJar.split(';').forEach(c => {
                const parts = c.trim().split('=');
                if (parts[0]) cookieMap.set(parts[0], parts.slice(1).join('='));
            });
        }
        setCookie.forEach(cookie => {
            const rawParts = cookie.split(';')[0];
            const eqIndex = rawParts.indexOf('=');
            if (eqIndex > 0) {
                cookieMap.set(rawParts.substring(0, eqIndex).trim(), rawParts.substring(eqIndex + 1).trim());
            }
        });
        let newJar = [];
        cookieMap.forEach((val, key) => { if (key) newJar.push(`${key}=${val}`); });
        cookieJar = newJar.join('; ') + ';';
    }
    return res;
});

function getCsrfToken(html) {
    if (!html || typeof html !== 'string') return null;
    const match = html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/);
    return match ? match[1] : null;
}

// ======================
// BIỆN PHÁP XÁC THỰC
// ======================
async function login() {
    try {
        cookieJar = ''; 
        const getResp = await session.get(LOGIN_URL);
        const token = getCsrfToken(getResp.data);
        if (!token) return false;
        
        const formData = new URLSearchParams();
        formData.append('username', USERNAME);
        formData.append('password', PASSWORD);
        formData.append('_token', token);
        formData.append('action', 'Login');
        
        const loginResp = await session.post(LOGIN_URL, formData.toString(), {
            headers: { 'Referer': LOGIN_URL, 'Origin': BASE, 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return loginResp.status === 200;
    } catch (error) {
        console.error('[!] Đăng nhập lỗi:', error.message);
        return false;
    }
}

async function goToLobby() {
    try {
        await session.get(LOBBY_URL, { headers: { 'Referer': BASE } });
        return true;
    } catch (error) {
        return false;
    }
}

// ======================
// HÀM LẤY PHIÊN CHUẨN XÁC
// ======================
async function fetchBaccaratData() {
    try {
        let xsrfToken = '';
        const xsrfMatch = cookieJar.match(/XSRF-TOKEN=([^;]+)/);
        if (xsrfMatch) xsrfToken = decodeURIComponent(xsrfMatch[1]);
        
        const headers = {
            'Referer': LOBBY_URL,
            'Origin': BASE,
            'X-XSRF-TOKEN': xsrfToken,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        };
        
        const formData = new URLSearchParams();
        formData.append('gameCode', 'ae'); // Sảnh AE Sexy
        
        // Gọi API gettable để lấy cấu trúc full trạng thái của bàn chơi
        const resp = await session.post(GET_TABLE_URL, formData.toString(), { headers });
        
        if (resp.data && typeof resp.data === 'string' && resp.data.includes('login')) {
            throw new Error('SessionExpired');
        }

        // Đọc dữ liệu mảng bàn chơi
        let rawData = resp.data.data || resp.data;
        if (rawData) {
            let listRaw = Array.isArray(rawData) ? rawData : Object.values(rawData);
            
            baccaratData = listRaw.map(item => {
                // In log kiểm tra nếu gặp lỗi (chỉ debug ván đầu)
                if(!lastUpdate) {
                    console.log(`[DEBUG RAW BÀN ${item.table_name || item.tableCode}]:`, JSON.stringify(item));
                }

                return {
                    table: String(item.table_name || item.tableCode || item.tableName || 'Unknown'),
                    // Ép lọc toàn bộ trường có khả năng lưu Số Cơ (Mã bộ bài)
                    bootNo: String(item.bootNo || item.shoeId || item.shoeNo || item.boot_no || item.game_no || '0'),
                    // Ép lọc toàn bộ trường lưu Số Phiên (Ván thứ bao nhiêu của cơ đó)
                    roundNo: String(item.roundNo || item.round || item.round_no || item.roundNoStage || '0'),
                    result: String(item.result || item.results || item.cards || ''),
                    status: String(item.status || 'OPEN')
                };
            });
            lastUpdate = new Date().toISOString();
        }
        return baccaratData;
    } catch (error) {
        if (error.message === 'SessionExpired') {
            console.warn('[⚠️] Hết phiên đăng nhập, đang cấp lại...');
            if (await login()) await goToLobby();
        } else {
            console.error('[!] Lỗi lấy phiên bàn:', error.message);
        }
        return [];
    }
}

// Vòng lặp lấy dữ liệu liên tục mỗi 2.5 giây
async function autoUpdate() {
    while (true) {
        try {
            await fetchBaccaratData();
        } catch (e) {}
        await new Promise(resolve => setTimeout(resolve, 2500));
    }
}

// ======================
// API SERVER EXPRESS
// ======================
const app = express();
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Content-Type', 'application/json; charset=utf-8');
    next();
});

app.get('/api/baccarat', (req, res) => {
    res.json({ success: true, total: baccaratData.length, lastUpdate: lastUpdate, data: baccaratData });
});

// ======================
// CHẠY HỆ THỐNG
// ======================
async function start() {
    console.log('🔄 Đang kết nối tài khoản Hoang2285...');
    if (!await login() || !await goToLobby()) {
        console.error('❌ Thất bại! Vui lòng chạy lại.');
        process.exit(1);
    }
    console.log('✅ Đăng nhập và nạp sảnh AE thành công.');
    
    console.log('📊 Đang đồng bộ hóa dữ liệu và bóc tách Số Phiên...');
    await fetchBaccaratData();
    
    console.log(`\n======================================================`);
    console.log(`DANH SÁCH BÀN VÀ PHIÊN HIỆN TẠI (ĐÃ ĐƯỢC FIX):`);
    console.log(`======================================================`);
    baccaratData.forEach(item => {
        console.log(` Bàn: ${item.table.padEnd(5)} | Số Cơ (Boot): ${item.bootNo.padEnd(3)} | Phiên (Ván): ${item.roundNo.padEnd(3)}`);
    });
    
    autoUpdate();
    app.listen(5000, '0.0.0.0', () => {
        console.log(`\n🚀 API SẴN SÀNG: http://localhost:5000/api/baccarat`);
    });
}

start();
