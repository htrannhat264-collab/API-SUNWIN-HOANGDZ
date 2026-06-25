const axios = require('axios');
const express = require('express');
const https = require('https');

// ======================
// CẤU HÌNH
// ======================
const BASE = "https://aibcr.me";
const LOGIN_URL = `${BASE}/login`;
const LOBBY_URL = `${BASE}/ae/lobby`;
const GETNEWRESULT_URL = `${BASE}/baccarat/getnewresult`;

const USERNAME = "Hoang2285";
const PASSWORD = "hoang2010";

const agent = new https.Agent({ rejectUnauthorized: false });
let cookieJar = '';
let baccaratData = [];
let lastUpdate = null;
let isLobbyLoaded = false;

// ======================
// SESSION AXIOS
// ======================
const session = axios.create({
    baseURL: BASE,
    timeout: 15000, // Giảm xuống 15s để xử lý timeout nhanh hơn
    httpsAgent: agent,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
    }
});

// Interceptor quản lý cookie động một cách chính xác hơn
session.interceptors.request.use(config => {
    if (cookieJar) config.headers.Cookie = cookieJar;
    return config;
}, error => Promise.reject(error));

session.interceptors.response.use(res => {
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
        setCookie.forEach(cookie => {
            const rawParts = cookie.split(';')[0];
            const eqIndex = rawParts.indexOf('=');
            if (eqIndex > 0) {
                const name = rawParts.substring(0, eqIndex).trim();
                const value = rawParts.substring(eqIndex + 1).trim();
                
                // Xóa cookie cũ nếu trùng tên để tránh ghi đè chồng chéo chuỗi
                if (cookieJar.includes(`${name}=`)) {
                    cookieJar = cookieJar.replace(new RegExp(`${name}=[^;]+;?\\s*`), '');
                }
                cookieJar += `${name}=${value}; `;
            }
        });
    }
    return res;
}, error => Promise.reject(error));

// Trích xuất CSRF Token từ HTML dạng <meta>
function getCsrfToken(html) {
    if (!html || typeof html !== 'string') return null;
    const match = html.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/);
    return match ? match[1] : null;
}

// ======================
// HÀM XỬ LÝ ĐĂNG NHẬP CHÍNH XÁC
// ======================
async function login() {
    try {
        console.log('[AUTH] Đang tải trang login lấy Token...');
        cookieJar = ''; // Reset cookie khi đăng nhập lại
        const getResp = await session.get(LOGIN_URL);
        const token = getCsrfToken(getResp.data);
        
        if (!token) {
            console.error('[ERROR] Không tìm thấy CSRF Token trên trang đăng nhập.');
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
        
        console.log('[AUTH] Đang gửi yêu cầu đăng nhập...');
        const loginResp = await session.post(LOGIN_URL, formData.toString(), { headers });
        
        if (loginResp.status === 200) {
            isLobbyLoaded = false;
            return true;
        }
        return false;
    } catch (error) {
        console.error('[ERROR LOGIN]:', error.message);
        return false;
    }
}

// Kích hoạt session vào Lobby sảnh AE
async function goToLobby() {
    try {
        console.log('[LOBBY] Đang đồng bộ sảnh AE...');
        await session.get(LOBBY_URL, {
            headers: { 'Referer': BASE }
        });
        isLobbyLoaded = true;
        return true;
    } catch (error) {
        console.error('[ERROR LOBBY]:', error.message);
        isLobbyLoaded = false;
        return false;
    }
}

// ======================
// LẤY DỮ LIỆU PHIÊN & KẾT QUẢ TỪNG BÀN
// ======================
async function fetchBaccaratData() {
    try {
        // Tách XSRF-TOKEN từ cookie jar phục vụ Ajax Request của Laravel/Backend
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
        
        const resp = await session.post(GETNEWRESULT_URL, formData.toString(), { headers });
        
        // Kiểm tra nếu bị redirect về trang login (Hết hạn session)
        if (resp.data && (typeof resp.data === 'string') && resp.data.includes('login')) {
            throw new Error('SessionExpired');
        }

        if (resp.data && resp.data.data) {
            // Sửa lỗi mapping: Lấy chính xác bootNo (mã cơ), roundNo (mã ván hiện tại) và trạng thái
            baccaratData = resp.data.data.map(item => ({
                table: item.table_name || item.tableCode || 'Unknown',
                bootNo: item.bootNo || item.shoeId || '0',   // Khớp số ID của bộ bài/cơ đang chơi
                roundNo: item.roundNo || item.round || '0', // Khớp số phiên/vòng đang chạy
                result: item.result || '',                  // Chuỗi kết quả lịch sử ván cược
                status: item.status || 'OPEN'               // Trạng thái bàn (Mở/Bảo trì)
            }));
            lastUpdate = new Date().toISOString();
        }
        return baccaratData;
    } catch (error) {
        if (error.message === 'SessionExpired' || (error.response && error.response.status === 401)) {
            console.warn('[⚠️ WARNING] Session hết hạn! Đang tiến hành tái cấp quyền...');
            const relogin = await login();
            if (relogin) await goToLobby();
        } else {
            console.error('[FETCH ERROR]:', error.message);
        }
        return [];
    }
}

// Vòng lặp lấy data tự động vô hạn (Có try-catch an toàn)
async function autoUpdate() {
    while (true) {
        try {
            if (!isLobbyLoaded) {
                await goToLobby();
            }
            await fetchBaccaratData();
        } catch (e) {
            console.error('[LOOP ERROR]:', e.message);
        }
        // Nghỉ 2 giây trước khi kéo tiếp
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

// ======================
// KHỞI TẠO API ENDPOINTS
// ======================
const app = express();

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Content-Type', 'application/json; charset=utf-8');
    next();
});

// Lấy toàn bộ danh sách bàn kèm thông tin phiên cụ thể
app.get('/api/baccarat', (req, res) => {
    res.json({
        success: true,
        total: baccaratData.length,
        lastUpdate: lastUpdate,
        data: baccaratData
    });
});

// Tìm kiếm bàn chuẩn xác hơn (không phân biệt chữ hoa, chữ thường)
app.get('/api/baccarat/:table', (req, res) => {
    const tableName = req.params.table.trim().toLowerCase();
    const found = baccaratData.find(item => item.table.toLowerCase() === tableName);
    
    if (found) {
        res.json({ success: true, data: found });
    } else {
        res.json({ success: false, message: `Không tìm thấy thông tin bàn [${req.params.table}]` });
    }
});

// ======================
// TIẾN TRÌNH KHỞI CHẠY
// ======================
async function start() {
    console.log('========================================');
    console.log('       SỰ KIỆN KHỞI CHẠY BACCARAT API   ');
    console.log('========================================');
    
    const loginOk = await login();
    if (!loginOk) {
        console.error('[FATAL] Khởi động thất bại do không thể Đăng nhập!');
        process.exit(1);
    }
    console.log('[OK] Xác thực thành công tài khoản.');
    
    await goToLobby();
    console.log('[OK] Thiết lập sảnh AE thành công.');
    
    console.log('[🛠️] Đang đồng bộ hóa dữ liệu ban đầu...');
    await fetchBaccaratData();
    
    console.log(`[OK] Đã cấu hình thành công dữ liệu cho ${baccaratData.length} bàn chơi.`);
    console.log('\n📊 THÔNG TIN PHIÊN CÁC BÀN HIỆN TẠI:');
    baccaratData.forEach(item => {
        console.log(`   Bàn: ${item.table.padEnd(5)} | Phiên: Cơ ${item.bootNo.toString().padEnd(3)} - Ván ${item.roundNo.toString().padEnd(3)} | Kết quả: ${item.result.substring(0, 20)}...`);
    });

    // Kích hoạt Worker chạy ngầm cập nhật liên tục
    autoUpdate();
    
    const PORT = 5000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🚀 HỆ THỐNG API ĐANG HOẠT ĐỘNG TẠI:`);
        console.log(`   👉 TẤT CẢ BÀN: http://localhost:${PORT}/api/baccarat`);
        console.log(`   👉 CHI TIẾT BÀN: http://localhost:${PORT}/api/baccarat/C01`);
    });
}

start();
