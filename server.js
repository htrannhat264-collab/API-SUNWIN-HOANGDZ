const axios = require('axios');
const express = require('express');
const https = require('https');

// ======================
// CẤU HÌNH HỆ THỐNG
// ======================
const BASE = "https://aibcr.me";
const LOGIN_URL = `${BASE}/login`;
const LOBBY_URL = `${BASE}/ae/lobby`;

// THAY ĐỔI CỐT LÕI: Dùng GETTABLE thay cho GETNEWRESULT để lôi bằng được số PHIÊN cược
const GETTABLE_URL = `${BASE}/baccarat/gettable`; 

const USERNAME = "Hoang2285";
const PASSWORD = "hoang2010";

const agent = new https.Agent({ rejectUnauthorized: false });
let cookieJar = '';
let baccaratData = [];
let lastUpdate = null;

// ======================
// CẤU HÌNH AXIOS GIẢ LẬP TRÌNH DUYỆT THẬT
// ======================
const session = axios.create({
    baseURL: BASE,
    timeout: 20000,
    httpsAgent: agent,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
    }
});

// Bộ quản lý Cookie thông minh - Không lo mất Token session khi lặp dữ liệu
session.interceptors.request.use(config => {
    if (cookieJar) {
        config.headers.Cookie = cookieJar;
    }
    return config;
}, error => Promise.reject(error));

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
                const name = rawParts.substring(0, eqIndex).trim();
                const value = rawParts.substring(eqIndex + 1).trim();
                cookieMap.set(name, value);
            }
        });
        let newJar = [];
        cookieMap.forEach((val, key) => {
            if (key) newJar.push(`${key}=${val}`);
        });
        cookieJar = newJar.join('; ') + ';';
    }
    return res;
}, error => Promise.reject(error));

// Trích xuất CSRF Token an toàn
function getCsrfToken(html) {
    if (!html || typeof html !== 'string') return null;
    const match = html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/);
    return match ? match[1] : null;
}

// ======================
// LOGIC API CHÍNH
// ======================
async function login() {
    try {
        console.log('[AUTH] Đang tải trang đăng nhập...');
        cookieJar = ''; 
        const getResp = await session.get(LOGIN_URL);
        const token = getCsrfToken(getResp.data);
        
        if (!token) {
            console.error('[ERROR] Không lấy được CSRF Token từ HTML!');
            return false;
        }
        
        const formData = new URLSearchParams();
        formData.append('username', USERNAME);
        formData.append('password', PASSWORD);
        formData.append('_token', token);
        formData.append('action', 'Login');
        
        const headers = {
            'Referer': LOGIN_URL,
            'Origin': BASE,
            'Content-Type': 'application/x-www-form-urlencoded'
        };
        
        console.log('[AUTH] Gửi request đăng nhập...');
        const loginResp = await session.post(LOGIN_URL, formData.toString(), { headers });
        
        if (loginResp.status === 200) {
            return true;
        }
        return false;
    } catch (error) {
        console.error('[ERROR LOGIN]:', error.message);
        return false;
    }
}

async function goToLobby() {
    try {
        console.log('[LOBBY] Kích hoạt Session sảnh AE...');
        await session.get(LOBBY_URL, { 
            headers: { 'Referer': BASE } 
        });
        return true;
    } catch (error) {
        console.error('[ERROR LOBBY]:', error.message);
        return false;
    }
}

async function fetchBaccaratData() {
    try {
        let xsrfToken = '';
        const xsrfMatch = cookieJar.match(/XSRF-TOKEN=([^;]+)/);
        if (xsrfMatch) xsrfToken = decodeURIComponent(xsrfMatch[1]);
        
        const headers = {
            'Referer': LOBBY_URL,
            'Origin': BASE,
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrfToken,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        };
        
        const formData = new URLSearchParams();
        formData.append('gameCode', 'ae'); 
        
        // Gọi API gettable để vét cạn toàn bộ thông tin phiên
        const resp = await session.post(GETTABLE_URL, formData.toString(), { headers });
        
        // Trường hợp bị đá session văng ra ngoài sảnh
        if (resp.data && typeof resp.data === 'string' && (resp.data.includes('login') || resp.data.includes('Sign In'))) {
            throw new Error('SessionExpired');
        }

        if (resp.data && resp.data.data) {
            let listRaw = [];
            if (Array.isArray(resp.data.data)) {
                listRaw = resp.data.data;
            } else if (typeof resp.data.data === 'object') {
                listRaw = Object.values(resp.data.data); 
            }

            baccaratData = listRaw.map(item => {
                // Lọc sạch toàn bộ các biến thể đặt tên key của nhà cái
                const currentBoot = item.bootNo || item.shoeId || item.shoeNo || item.boot_no || item.bootno || '0';
                const currentRound = item.roundNo || item.round || item.round_no || item.roundNoStage || item.roundno || '0';
                
                return {
                    table: String(item.table_name || item.tableCode || item.tableName || item.table || 'Unknown'),
                    bootNo: String(currentBoot),   // Mã Cơ (Số ID Bộ bài)
                    roundNo: String(currentRound), // Mã Ván (Số phiên hiện tại trong cơ bài)
                    result: String(item.result || item.results || item.history || item.cards || ''),
                    status: String(item.status || 'OPEN')
                };
            });

            lastUpdate = new Date().toISOString();
        } else {
            console.log('[⚠️ CẢNH BÁO] Hệ thống không phản hồi mảng dữ liệu bàn.');
        }
        return baccaratData;
    } catch (error) {
        if (error.message === 'SessionExpired' || (error.response && error.response.status === 401)) {
            console.warn('[⚠️ TÁI CẤP QUYỀN] Mất phiên sảnh! Đang tự động kết nối lại...');
            const relogin = await login();
            if (relogin) await goToLobby();
        } else {
            console.error('[FETCH ERROR]:', error.message);
        }
        return [];
    }
}

// Vòng lặp cập nhật liên tục 2.5 giây/lần
async function autoUpdate() {
    while (true) {
        try {
            await fetchBaccaratData();
        } catch (e) {
            console.error('[LOOP ERROR]:', e.message);
        }
        await new Promise(resolve => setTimeout(resolve, 2500));
    }
}

// ======================
// KHỞI TẠO HTTP SERVER
// ======================
const app = express();

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Content-Type', 'application/json; charset=utf-8');
    next();
});

app.get('/api/baccarat', (req, res) => {
    res.json({
        success: true,
        total: baccaratData.length,
        lastUpdate: lastUpdate,
        data: baccaratData
    });
});

app.get('/api/baccarat/:table', (req, res) => {
    const tableName = req.params.table.trim().toLowerCase();
    const found = baccaratData.find(item => item.table.toLowerCase() === tableName || item.table.toLowerCase().includes(tableName));
    
    if (found) {
        res.json({ success: true, data: found });
    } else {
        res.json({ success: false, message: `Không tìm thấy bàn: ${req.params.table}` });
    }
});

// ======================
// KHỞI CHẠY KHỞI ĐỘNG
// ======================
async function start() {
    console.log('=== KHỞI ĐỘNG HỆ THỐNG GIẢI QUYẾT MẤT PHIÊN ===');
    const isOk = await login();
    if (!isOk) {
        console.error('[FATAL] Không thể đăng nhập. Vui lòng check thông tin Acc!');
        process.exit(1);
    }
    console.log('[OK] Đăng nhập thành công.');
    
    await goToLobby();
    console.log('[OK] Khởi tạo dữ liệu sảnh hoàn tất.');
    
    await fetchBaccaratData();
    console.log(`[OK] Thành công! Số lượng bàn bóc tách được: ${baccaratData.length}`);
    
    console.log('\n📊 DANH SÁCH PHIÊN BÀN HIỆN TẠI:');
    baccaratData.forEach(item => {
        console.log(` > Bàn: ${item.table.padEnd(6)} | Phiên: Cơ ${item.bootNo.padEnd(3)} - Ván ${item.roundNo.padEnd(3)} | KQ: ${item.result.substring(0,12)}...`);
    });

    autoUpdate();
    
    const PORT = 5000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🚀 API ĐANG CHẠY: http://localhost:${PORT}/api/baccarat`);
    });
}

start();
