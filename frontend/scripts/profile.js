const BACKEND_BASE_URL = 'http://localhost:8000';

document.addEventListener('DOMContentLoaded', () => {
    // 로그인 상태 확인
    checkLoginStatus();
    
    // 프로필 데이터 로드
    loadProfileData();
    
    // 로그아웃 버튼 이벤트 리스너
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
    
    // 프로필 편집 아이콘 이벤트 리스너
    const editProfileIcon = document.getElementById('editProfileIcon');
    if (editProfileIcon) {
        editProfileIcon.addEventListener('click', (e) => {
            e.preventDefault();
            redirectToEditProfile();
        });
    }
    
    // 비밀번호 변경 링크 이벤트 리스너
    const changePasswordLink = document.getElementById('changePasswordLink');
    if (changePasswordLink) {
        changePasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            alert('비밀번호 변경 기능은 아직 개발 중입니다.');
        });
    }
    
    // 계정 삭제 링크 이벤트 리스너
    const deleteAccountLink = document.getElementById('deleteAccountLink');
    if (deleteAccountLink) {
        deleteAccountLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '../pages/delete-account.html';
        });
    }
});

// 로그인 상태 확인 함수
function checkLoginStatus() {
    const accessToken = localStorage.getItem('access_token');
    const loginLink = document.getElementById('loginLink');
    const signupLink = document.getElementById('signupLink');
    const logoutLink = document.getElementById('logoutLink');
    
    if (accessToken) {
        // 로그인 상태
        if (loginLink) loginLink.style.display = 'none';
        if (signupLink) signupLink.style.display = 'none';
        if (logoutLink) logoutLink.style.display = 'block';
    } else {
        // 비로그인 상태면 로그인 페이지로 리다이렉트
        alert('로그인이 필요한 페이지입니다.');
        window.location.href = '../pages/login.html';
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
        const response = await fetch(`${BACKEND_BASE_URL}/users/${username}/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        const data = await response.json();
        console.log('프로필 API 응답:', data);
        
        if (response.ok) {
            // 각 요소 참조
            const nicknameEl = document.getElementById('profile-nickname');
            const emailEl = document.getElementById('profile-email');
            const addressEl = document.getElementById('profile-address');
            const profileNavLink = document.getElementById('profileNavLink');
            
            // 프로필 데이터 표시
            if (nicknameEl) nicknameEl.textContent = data.nickname || '정보 없음';
            if (emailEl) emailEl.textContent = data.email || '정보 없음';
            if (addressEl) addressEl.textContent = data.user_address || '정보 없음';
            
            // 내비게이션 바의 프로필 링크 텍스트 업데이트
            if (profileNavLink && data.nickname) {
                profileNavLink.textContent = `${data.nickname}님의 프로필`;
            }
            
            // 닉네임을 로컬 스토리지에 저장 (다른 페이지에서 사용하기 위해)
            if (data.nickname) {
                localStorage.setItem('userNickname', data.nickname);
            }
        } else {
            console.error('프로필 정보 로드 실패:', data);
            console.error('API 오류:', data.message || data.detail || '알 수 없는 오류');
        }
    } catch (error) {
        console.error('네트워크 오류:', error);
    }
}

// 회원정보 수정 페이지로 이동하는 함수
function redirectToEditProfile() {
    // 회원정보 수정 페이지로 이동
    window.location.href = '../pages/edit-profile.html';
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