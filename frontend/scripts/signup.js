const BACKEND_BASE_URL = 'http://43.200.96.32:8000';

document.addEventListener('DOMContentLoaded', () => {
    console.log('signup.js loaded');
    const signupForm = document.getElementById('signupForm');
    
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const nickname = document.getElementById('nickname').value;
        const email = document.getElementById('email').value;
        const address = document.getElementById('address').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // 비밀번호 확인
        if (password !== confirmPassword) {
            alert('비밀번호가 일치하지 않습니다.');
            return;
        }
        
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/signup/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    nickname,
                    email,
                    user_address: address,
                    password
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // 회원가입 성공 시 바로 로그인 페이지로 이동
                // 현재 "Login here" 링크의 href 속성 값을 가져와서 사용
                const loginLink = document.querySelector('.login-link a');
                if (loginLink) {
                    // 로그인 링크의 href 값으로 페이지 이동
                    window.location.href = loginLink.getAttribute('href');
                } else {
                    // 링크를 찾지 못한 경우 기본 경로 사용
                    window.location.href = '../pages/login.html';
                }
            } else {
                // 서버에서 반환된 에러 메시지 처리
                if (data.errors) {
                    const errorMessages = [];
                    for (const field in data.errors) {
                        errorMessages.push(`${field}: ${data.errors[field].join(' ')}`);
                    }
                    alert(errorMessages.join('\n'));
                } else {
                    alert(data.message || '회원가입에 실패했습니다.');
                }
            }
        } catch (error) {
            console.error('Error:', error);
            alert('서버와의 통신 중 오류가 발생했습니다.');
        }
    });
}); 