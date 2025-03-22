const BACKEND_BASE_URL = 'http://localhost:8000';

document.addEventListener('DOMContentLoaded', () => {
    // 로그인 상태 확인
    checkLoginStatus();
    
    // 현재 프로필 데이터 로드
    loadProfileData();
    
    // 문자 수 카운팅 초기화
    setupCharacterCounting();
    
    // 폼 제출 이벤트 리스너
    const form = document.getElementById('edit-profile-form');
    if (form) {
        form.addEventListener('submit', saveProfileData);
    }
    
    // 로그아웃 버튼 이벤트 리스너
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
});

// 로그인 상태 확인 함수
function checkLoginStatus() {
    const accessToken = localStorage.getItem('access_token');
    const loginLink = document.getElementById('loginLink');
    const signupLink = document.getElementById('signupLink');
    const logoutLink = document.getElementById('logoutLink');
    
    if (!accessToken) {
        // 비로그인 상태면 로그인 페이지로 리다이렉트
        alert('로그인이 필요한 페이지입니다.');
        window.location.href = '../pages/login.html';
        return;
    }
    
    // 로그인 상태
    if (loginLink) loginLink.style.display = 'none';
    if (signupLink) signupLink.style.display = 'none';
    if (logoutLink) logoutLink.style.display = 'block';
}

// 문자 수 카운팅 설정
function setupCharacterCounting() {
    const nicknameInput = document.getElementById('nickname');
    const nicknameCount = document.getElementById('nickname-count');
    
    const addressInput = document.getElementById('user_address');
    const introCount = document.getElementById('intro-count');
    
    if (nicknameInput && nicknameCount) {
        nicknameInput.addEventListener('input', () => {
            nicknameCount.textContent = nicknameInput.value.length;
        });
    }
    
    if (addressInput && introCount) {
        addressInput.addEventListener('input', () => {
            introCount.textContent = addressInput.value.length;
        });
    }
}

// 프로필 데이터 로드 함수
async function loadProfileData() {
    const accessToken = localStorage.getItem('access_token');
    const username = localStorage.getItem('username');
    
    if (!accessToken || !username) {
        return; // 토큰이나 사용자명이 없으면 함수 종료
    }
    
    try {
        // 백엔드 API URL 경로
        const response = await fetch(`${BACKEND_BASE_URL}/users/${username}/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        const data = await response.json();
        console.log('프로필 데이터 로드:', data);
        
        if (response.ok) {
            // 각 입력 필드에 현재 값 설정
            const nicknameInput = document.getElementById('nickname');
            const emailInput = document.getElementById('email');
            const addressInput = document.getElementById('user_address');
            
            if (nicknameInput) {
                nicknameInput.value = data.nickname || '';
                document.getElementById('nickname-count').textContent = nicknameInput.value.length;
            }
            
            if (emailInput) emailInput.value = data.email || '';
            
            if (addressInput) {
                addressInput.value = data.user_address || '';
                document.getElementById('intro-count').textContent = addressInput.value.length;
            }
        } else {
            showStatusMessage(data.message || '프로필 정보를 불러올 수 없습니다.', false);
        }
    } catch (error) {
        console.error('네트워크 오류:', error);
        showStatusMessage('서버 연결에 실패했습니다.', false);
    }
}

// 프로필 저장 함수
async function saveProfileData(event) {
    event.preventDefault();
    
    const accessToken = localStorage.getItem('access_token');
    const username = localStorage.getItem('username');
    
    if (!accessToken || !username) {
        showStatusMessage('로그인이 필요합니다.', false);
        return;
    }
    
    const nickname = document.getElementById('nickname').value.trim();
    const email = document.getElementById('email').value.trim();
    const user_address = document.getElementById('user_address').value.trim();
    
    // 필수 필드 검증
    if (!nickname || !email) {
        showStatusMessage('필수 항목을 모두 입력해주세요.', false);
        return;
    }
    
    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showStatusMessage('올바른 이메일 형식이 아닙니다.', false);
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_BASE_URL}/users/${username}/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                nickname,
                email,
                user_address
            })
        });
        
        const data = await response.json();
        console.log('프로필 저장 응답:', data);
        
        if (response.ok) {
            showStatusMessage('회원 정보가 성공적으로 수정되었습니다.', true);
            setTimeout(() => {
                window.location.href = '../pages/profile.html';
            }, 1500);
        } else {
            showStatusMessage(data.message || data.error || '회원 정보 수정에 실패했습니다.', false);
        }
    } catch (error) {
        console.error('네트워크 오류:', error);
        showStatusMessage('서버 연결에 실패했습니다.', false);
    }
}

// 상태 메시지 표시 함수
function showStatusMessage(message, isSuccess) {
    const statusMessageElement = document.getElementById('status-message');
    if (statusMessageElement) {
        statusMessageElement.textContent = message;
        statusMessageElement.className = isSuccess ? 'status-message success' : 'status-message error';
        statusMessageElement.style.display = 'block';
        
        // 3초 후 메시지 숨기기
        setTimeout(() => {
            statusMessageElement.style.display = 'none';
        }, 3000);
    }
}

// 로그아웃 함수
async function logout() {
    try {
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (!refreshToken) {
            alert('이미 로그아웃 되었습니다.');
            window.location.href = '../pages/login.html';
            return;
        }
        
        const response = await fetch(`${BACKEND_BASE_URL}/api/account/logout/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            },
            body: JSON.stringify({
                refresh: refreshToken
            })
        });
        
        // 로컬 스토리지에서 토큰 제거
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('username');
        
        alert('로그아웃 되었습니다.');
        window.location.href = '../pages/login.html';
    } catch (error) {
        console.error('로그아웃 에러:', error);
        // 에러가 발생해도 로컬 스토리지는 비우기
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('username');
        alert('로그아웃 처리 중 오류가 발생했습니다.');
        window.location.href = '../pages/login.html';
    }
} 