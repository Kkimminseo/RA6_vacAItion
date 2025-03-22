const BACKEND_BASE_URL = 'http://43.200.96.32:8000';

document.addEventListener('DOMContentLoaded', () => {
    // 이미 로그인된 상태인지 확인
    checkAlreadyLoggedIn();
    
    const loginForm = document.getElementById('loginForm');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/login/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    password
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // 토큰을 로컬 스토리지에 저장
                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('refresh_token', data.refresh_token);
                localStorage.setItem('username', data.username);
                
                // 알림창 없이 바로 채팅 페이지로 이동
                window.location.href = '../index.html';
            } else {
                alert(data.message || '로그인에 실패했습니다.');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('서버와의 통신 중 오류가 발생했습니다.');
        }
    });
});

// 이미 로그인된 상태인지 확인하는 함수
function checkAlreadyLoggedIn() {
    // URL 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    const fromDeleteAccount = urlParams.get('fromDeleteAccount');
    
    // 회원 탈퇴 후 이동한 경우 검사를 건너뜀
    if (fromDeleteAccount === 'true') {
        return;
    }
    
    // 액세스 토큰이 있는지 확인
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
        // 이미 로그인되어 있다면 채팅 페이지로 이동
        window.location.href = '../index.html';
    }
}
