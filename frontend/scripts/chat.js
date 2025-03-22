const BACKEND_BASE_URL = 'http://43.200.96.32:8000';
// 디버깅을 위한 로그 활성화
const DEBUG = true;

let currentSession = null;
let currentDate = null; // 현재 선택된 날짜 저장

document.addEventListener('DOMContentLoaded', () => {
    if (DEBUG) console.log('DOM 로드됨, 이벤트 리스너 등록 시작');
    
    // URL에서 날짜 파라미터 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    currentDate = urlParams.get('date');
    
    if (DEBUG && currentDate) console.log('URL에서 날짜 파라미터 발견:', currentDate);
    
    // 로그인 상태 확인
    checkLoginStatus();
    
    // UI 업데이트 추가
    updateUI();
    
    // 네비게이션 이벤트 리스너 설정
    setupEventListeners();
    
    // 폼 제출 이벤트 리스너
    const messageForm = document.getElementById('messageForm');
    if (messageForm) {
        console.log('메시지 폼 찾음, submit 이벤트 리스너 등록');
        messageForm.addEventListener('submit', sendMessage);
        
        // 직접 버튼 클릭 이벤트 추가
        const sendButton = document.querySelector('.send-btn');
        if (sendButton) {
            console.log('전송 버튼 찾음, click 이벤트 리스너 등록');
            sendButton.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('전송 버튼 클릭됨');
                sendMessage(e);
            });
        } else {
            console.error('전송 버튼을 찾을 수 없음');
        }
    } else {
        console.error('메시지 폼을 찾을 수 없음');
    }
    
    // 로그아웃 버튼 이벤트 리스너
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
    
    // 초기 채팅 세션 로드
    loadChatSessions();
});

// 로그인 상태 확인 함수
function checkLoginStatus() {
    const accessToken = localStorage.getItem('access_token');
    
    if (!accessToken) {
        // 비로그인 상태: 로그인 페이지로 리다이렉트
        alert('채팅을 사용하려면 로그인이 필요합니다.');
        window.location.href = '../pages/login.html';
        return;
    }
    
    // 로그인 상태: UI 업데이트
    const loginLink = document.getElementById('loginLink');
    const signupLink = document.getElementById('signupLink');
    const profileLink = document.getElementById('profileLink');
    const logoutLink = document.getElementById('logoutLink');
    
    if (loginLink) loginLink.style.display = 'none';
    if (signupLink) signupLink.style.display = 'none';
    if (profileLink) profileLink.style.display = 'block';
    if (logoutLink) logoutLink.style.display = 'block';
}

// 날짜 표시 형식으로 변환 (YYYY-MM-DD -> YYYY.MM.DD)
function formatDateForDisplay(dateStr) {
    if (!dateStr) return '';
    
    // YYYY-MM-DD 형식을 YYYY.MM.DD 형식으로 변환
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[0]}.${parts[1]}.${parts[2]}`;
    }
    return dateStr;
}

// 날짜에 대한 새 세션 생성 함수
async function createSessionForDate(date) {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) return;
    
    try {
        const formattedDate = formatDateForDisplay(date);
        const title = `${formattedDate} 일정 추천`;
        
        const response = await fetch(`${BACKEND_BASE_URL}/chat/api/sessions/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ title })
        });
        
        if (response.ok) {
            const session = await response.json();
            // 새로운 세션 생성 후 해당 세션으로 이동
            await loadChatSession(session.id);
            updateSessionTitle(formattedDate);
        } else {
            console.error('세션 생성 실패:', response.statusText);
            alert('새 채팅방 생성에 실패했습니다.');
        }
    } catch (error) {
        console.error('세션 생성 에러:', error);
        alert('새 채팅방 생성 중 오류가 발생했습니다.');
    }
}

// 세션 제목 업데이트 함수
function updateSessionTitle(dateStr) {
    // 제목 업데이트
    const currentSessionTitle = document.getElementById('currentSessionTitle');
    if (currentSessionTitle) {
        currentSessionTitle.textContent = `${dateStr} 일정 추천`;
    }
}

// 채팅 초기화 함수 수정
async function loadChatSession(sessionId) {
    try {
        currentSession = sessionId;
        // 새로운 WebSocket 연결 생성 (싱글톤 패턴 사용)
        new ChatWebSocket(sessionId);
        
        // 메시지 로드
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) return;
        
        const response = await fetch(`${BACKEND_BASE_URL}/chat/api/messages/${sessionId}/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            const messages = await response.json();
            displayChatMessages(messages);
        } else {
            console.error('메시지 로드 실패:', response.statusText);
        }
    } catch (error) {
        console.error('세션 로드 에러:', error);
    }
}

// 채팅 세션 목록 로드 함수
async function loadChatSessions() {
    console.log('Loading chat sessions...');
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) return;
    
    try {
        const response = await fetch(`${BACKEND_BASE_URL}/chat/api/sessions/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            const sessions = await response.json();
            
            // 현재 날짜 설정 (URL 파라미터 또는 오늘 날짜)
            const targetDate = currentDate || new Date().toISOString().split('T')[0];
            const formattedTargetDate = formatDateForDisplay(targetDate);
            console.log(`대상 날짜: ${formattedTargetDate}`);
            
            // 해당 날짜의 세션 찾기
            const dateSession = sessions.find(session => 
                session.title.includes(formattedTargetDate));
                
            if (dateSession) {
                // 해당 날짜의 세션이 있으면 해당 세션만 로드
                console.log(`${formattedTargetDate}에 해당하는 세션 발견:`, dateSession);
                await loadChatSession(dateSession.id);
                // 세션 제목 업데이트
                updateSessionTitle(formattedTargetDate);
            } else {
                // 해당 날짜의 세션이 없으면 새로 생성
                console.log(`${formattedTargetDate}에 해당하는 세션이 없어 새로 생성합니다.`);
                await createSessionForDate(targetDate);
            }
        } else {
            console.error('세션 로드 실패:', response.statusText);
        }
    } catch (error) {
        console.error('세션 로드 에러:', error);
    }
}

class ChatWebSocket {
    constructor(sessionId) {
        console.log('ChatWebSocket 생성, 세션 ID:', sessionId);
        
        if (ChatWebSocket.instance && ChatWebSocket.instance.sessionId === sessionId) {
            console.log('이미 동일한 세션 ID의 WebSocket 인스턴스가 있음');
            return ChatWebSocket.instance;
        }
        
        this.sessionId = sessionId;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.manualClose = false;
        this.connectionStatus = 'none'; // 연결 상태 추적
        
        if (ChatWebSocket.instance) {
            console.log('기존 WebSocket 인스턴스 닫음');
            ChatWebSocket.instance.close();
        }
        
        ChatWebSocket.instance = this;
        this.setupWebSocket();
        
        return this;
    }

    setupWebSocket() {
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            console.error('No access token found');
            this.connectionStatus = 'no_token';
            return;
        }

        try {
            if (this.ws) {
                console.log('기존 WebSocket 연결 닫음');
                this.ws.close();
            }
            
            this.connectionStatus = 'connecting';
            console.log('WebSocket 연결 시도 중...');
            
            const wsUrl = `ws://43.200.96.32:8000/ws/chat/${this.sessionId}/?token=${accessToken}`;
            console.log('연결 URL:', wsUrl);
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket 연결 성공!');
                this.connectionStatus = 'connected';
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
                
                // 연결 성공 알림 표시
                const statusElement = document.getElementById('connection-status');
                if (statusElement) {
                    statusElement.textContent = '연결됨';
                    statusElement.className = 'status-connected';
                }
            };

            this.ws.onmessage = (event) => {
                console.log('WebSocket 메시지 수신:', event.data);
                try {
                    const data = JSON.parse(event.data);
                    console.log('파싱된 메시지:', data);
                    
                    // 연결 확인 메시지 처리
                    if (data.type === 'connection_established' || data.is_system) {
                        console.log('시스템 메시지:', data.message);
                        
                        // 연결 상태 표시 업데이트
                        const statusElement = document.getElementById('connection-status');
                        if (statusElement) {
                            statusElement.textContent = '연결됨';
                            statusElement.className = 'status-connected';
                        }
                        
                        // 시스템 메시지를 채팅창에 표시 (선택적)
                        // displaySystemMessage(data.message);
                        return;
                    }
                    
                    // 봇 메시지 처리
                    if (data.is_bot) {
                        if (data.is_streaming) {
                            // 스트리밍 메시지는 로그 출력하지 않음
                            let streamingMsg = document.querySelector('.message.bot.streaming');
                            if (streamingMsg) {
                                // 기존 스트리밍 메시지 업데이트 - textContent 사용
                                const contentDiv = streamingMsg.querySelector('.message-content');
                                // 현재 텍스트와 다른 경우에만 업데이트
                                if (contentDiv.textContent !== data.message) {
                                    contentDiv.textContent = data.message;
                                }
                            } else {
                                // 새 스트리밍 메시지 생성
                                displayMessage(data.message, true, true);
                            }
                        } else {
                            // 일반 메시지는 로그 출력
                            console.log('봇 메시지 수신:', data.message);
                            // 스트리밍이 아닌 일반 메시지는 새로 표시
                            // 기존 스트리밍 메시지가 있다면 제거
                            const streamingMsg = document.querySelector('.message.bot.streaming');
                            if (streamingMsg) {
                                streamingMsg.remove();
                            }
                            displayMessage(data.message, true);
                        }
                    }
                    // 사용자 메시지 처리 - is_user 대신 is_bot이 false인지 확인
                    else if (data.is_bot === false) {
                        // 사용자 메시지를 표시합니다.
                        displayMessage(data.message, false);
                        console.log('User message displayed');
                    }
                } catch (error) {
                    console.error('메시지 파싱 오류:', error);
                }
            };

            this.ws.onclose = (event) => {
                console.log('WebSocket 연결 닫힘, 코드:', event.code, '이유:', event.reason);
                this.connectionStatus = 'closed';
                
                // 연결 상태 표시 업데이트
                const statusElement = document.getElementById('connection-status');
                if (statusElement) {
                    statusElement.textContent = '연결 끊김';
                    statusElement.className = 'status-disconnected';
                }
                
                if (!this.manualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
                    console.log('재연결 시도 중...');
                    setTimeout(() => {
                        this.reconnectAttempts++;
                        this.setupWebSocket();
                    }, this.reconnectDelay);
                    this.reconnectDelay *= 2; // 지수 백오프
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket 오류:', error);
                this.connectionStatus = 'error';
                
                // 연결 상태 표시 업데이트
                const statusElement = document.getElementById('connection-status');
                if (statusElement) {
                    statusElement.textContent = '연결 오류';
                    statusElement.className = 'status-error';
                }
            };

        } catch (error) {
            console.error('WebSocket 설정 오류:', error);
            this.connectionStatus = 'setup_error';
        }
    }

    sendMessage(message) {
        console.log('sendMessage 호출됨, 메시지:', message);
        console.log('WebSocket 상태:', this.connectionStatus);
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket이 연결되지 않음. 현재 상태:', this.ws ? this.ws.readyState : 'null');
            
            // 연결 상태가 아니라면 재연결 시도
            if (this.connectionStatus !== 'connecting') {
                console.log('WebSocket 재연결 시도');
                this.setupWebSocket();
                // 재연결 후 잠시 기다렸다가 메시지 전송 재시도
                setTimeout(() => {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.sendActualMessage(message);
                    } else {
                        console.error('재연결 후에도 WebSocket이 열리지 않음');
                        return false;
                    }
                }, 1000);
            }
            return false;
        }

        return this.sendActualMessage(message);
    }
    
    sendActualMessage(message) {
        try {
            console.log('WebSocket으로 메시지 전송:', message);
            this.ws.send(JSON.stringify({ message }));
            return true;
        } catch (error) {
            console.error('메시지 전송 중 오류 발생:', error);
            return false;
        }
    }

    close() {
        console.log('WebSocket 수동 종료');
        this.manualClose = true;
        this.connectionStatus = 'closed';
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// 싱글톤 인스턴스 저장을 위한 정적 속성
ChatWebSocket.instance = null;

// 채팅 메시지 표시 함수
function displayChatMessages(messages) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    chatMessages.innerHTML = '';
    
    if (messages.length === 0) {
        // 첫 메시지가 없을 때는 빈 채팅방으로 시작
        return;
    }
    
    messages.forEach(message => {
        const messageDiv = document.createElement('div');
        // 수정: API에서 받은 메시지도 is_bot 필드를 사용하도록 변경
        // (message.is_bot이 없으면 is_user의 반대값을 사용)
        const isBot = message.hasOwnProperty('is_bot') ? message.is_bot : !message.is_user;
        messageDiv.className = `message ${isBot ? 'bot' : 'user'}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // 메시지 내용을 처리
        if (isBot) {
            try {
                // HTML 태그가 이미 포함된 경우 직접 사용, 그렇지 않은 경우 마크다운 변환
                if (message.content.includes('<b>') || message.content.includes('<i>') || message.content.includes('<u>')) {
                    console.log('HTML 태그가 발견되어 직접 렌더링:', message.content.substring(0, 50) + '...');
                    // 줄바꿈 문자(\n)를 <br> 태그로 변환 (HTML 태그 사용 시)
                    let content = message.content.replace(/\n/g, '<br>');
                    contentDiv.innerHTML = content;
                } 
                // 마크다운 렌더링을 위한 설정
                else if (typeof marked !== 'undefined') {
                    // 마크다운 처리 옵션 설정
                    marked.setOptions({
                        breaks: true,        // 줄바꿈 허용
                        gfm: true,           // GitHub Flavored Markdown 사용
                        headerIds: false,    // 헤더 ID 생성 비활성화
                        mangle: false,       // 이메일 주소 변경 방지
                        sanitize: false      // HTML 허용 (주의: XSS 위험)
                    });
                    
                    // 마크다운을 HTML로 변환
                    contentDiv.innerHTML = marked.parse(message.content);
                    console.log('마크다운으로 처리됨 (히스토리):', message.content.substring(0, 50) + '...');
                } else {
                    console.warn('Marked 라이브러리가 로드되지 않았습니다.');
                    // 마크다운 없이 표시할 때도 줄바꿈 보존
                    contentDiv.innerHTML = message.content.replace(/\n/g, '<br>');
                }
            } catch (error) {
                console.error('마크다운 처리 중 오류:', error);
                // 오류 발생 시에도 줄바꿈 보존
                contentDiv.innerHTML = message.content.replace(/\n/g, '<br>');
            }
        } else {
            // 사용자 메시지도 줄바꿈 보존
            contentDiv.innerHTML = message.content.replace(/\n/g, '<br>');
        }
        
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
    });
    
    // 스크롤을 항상 최신 메시지로 이동
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 메시지 표시 함수
function displayMessage(content, isBot, isStreaming = false) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isBot ? 'bot' : 'user'}${isStreaming ? ' streaming' : ''}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (isBot) {
        try {
            // HTML 태그가 이미 포함된 경우 직접 사용, 그렇지 않은 경우 마크다운 변환
            if (content.includes('<b>') || content.includes('<i>') || content.includes('<u>')) {
                console.log('HTML 태그가 발견되어 직접 렌더링:', content.substring(0, 50) + '...');
                
                // 줄바꿈 문자(\n)를 <br> 태그로 변환 (HTML 태그 사용 시)
                content = content.replace(/\n/g, '<br>');
                contentDiv.innerHTML = content;
            }
            // 마크다운 처리
            else if (typeof marked !== 'undefined') {
                marked.setOptions({
                    breaks: true,
                    gfm: true,
                    headerIds: false,
                    mangle: false,
                    sanitize: false
                });
                
                contentDiv.innerHTML = marked.parse(content);
                console.log('마크다운으로 처리됨:', content.substring(0, 50) + '...');
            } else {
                console.warn('Marked 라이브러리가 로드되지 않았습니다.');
                // 마크다운 없이 표시할 때도 줄바꿈 보존
                contentDiv.innerHTML = content.replace(/\n/g, '<br>');
            }
        } catch (error) {
            console.error('마크다운 처리 중 오류:', error);
            // 오류 발생 시에도 줄바꿈 보존
            contentDiv.innerHTML = content.replace(/\n/g, '<br>');
        }
    } else {
        // 사용자 메시지도 줄바꿈 보존
        contentDiv.innerHTML = content.replace(/\n/g, '<br>');
    }
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    // 스크롤을 최신 메시지로 이동
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 메시지 전송 함수 수정
async function sendMessage(e) {
    console.log('sendMessage 함수 호출됨', e);
    e.preventDefault();
    
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    console.log('입력된 메시지:', message);
    
    if (!message) {
        console.log('메시지가 비어있음');
        return;
    }
    
    if (!currentSession) {
        console.warn('현재 세션이 없습니다.');
        
        // 날짜 기반으로 세션 생성
        try {
            console.log('세션 생성 시도');
            const date = currentDate || new Date().toISOString().split('T')[0];
            await createSessionForDate(date);
            
            // 약간의 지연 후 다시 시도
            setTimeout(() => {
                if (currentSession) {
                    console.log('새 세션 생성 후 메시지 재전송 시도');
                    sendMessageToSocket(message, messageInput);
                }
            }, 1000);
        } catch (error) {
            console.error('새 세션 생성 실패:', error);
        }
        return;
    }

    sendMessageToSocket(message, messageInput);
}

// 메시지 전송 로직을 별도 함수로 분리
function sendMessageToSocket(message, messageInput) {
    console.log('WebSocket으로 메시지 전송 시도:', message);
    console.log('현재 WebSocket 상태:', ChatWebSocket.instance ? ChatWebSocket.instance.ws.readyState : 'instance 없음');
    
    // 메시지 전송
    if (ChatWebSocket.instance && ChatWebSocket.instance.sendMessage(message)) {
        console.log('WebSocket으로 메시지 전송 성공');
        // 사용자 메시지는 서버에서 받아서 표시하도록 수정 (여기서 표시하지 않음)
        // displayMessage(message, false);
        // 입력창 초기화
        messageInput.value = '';
    } else {
        console.error('WebSocket 연결이 없거나 메시지 전송 실패');
        alert('메시지 전송에 실패했습니다. 페이지를 새로고침 후 다시 시도해주세요.');
    }
}

// 로그아웃 함수
async function logout() {
    console.log('로그아웃 함수 실행됨');
    try {
        const refreshToken = localStorage.getItem('refresh_token');
        const accessToken = localStorage.getItem('access_token');
        
        if (refreshToken && accessToken) {
            try {
                console.log('로그아웃 API 호출...');
                await fetch(`${BACKEND_BASE_URL}/logout/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        refresh: refreshToken
                    })
                });
            } catch (error) {
                console.error('로그아웃 API 에러:', error);
            }
        }
    } finally {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('username');
        
        alert('로그아웃 되었습니다.');
        window.location.replace('../pages/login.html');
    }
}

// UI 업데이트 함수
function updateUI() {
    const userNickname = localStorage.getItem('userNickname');
    const profileNavLink = document.getElementById('profileNavLink');
    
    if (userNickname && profileNavLink) {
        profileNavLink.textContent = `${userNickname}님의 프로필`;
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    const navLinks = document.querySelectorAll('nav.main-nav a');
    
    if (navLinks.length >= 3) {  // Chat 링크가 제거되어 3개로 변경
        // 홈 링크
        navLinks[0].addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '../index.html';
        });
        
        // 프로필 링크
        navLinks[1].addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = '../pages/profile.html';
        });
        
        // 로그아웃 링크
        navLinks[2].addEventListener('click', function(e) {
            e.preventDefault();
            console.log('로그아웃 링크 클릭됨');
            logout();
        });
    } else {
        console.warn('네비게이션 링크를 찾을 수 없습니다:', navLinks);
    }
}

// 채팅 세션 삭제 함수 수정
async function deleteChatSession(sessionId) {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        alert('로그인이 필요한 기능입니다.');
        window.location.href = '../pages/login.html';
        return;
    }
    
    try {
        const response = await fetch(`${BACKEND_BASE_URL}/chat/api/sessions/${sessionId}/`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            console.log('채팅방 삭제 성공:', sessionId);
            
            // 현재 선택된 채팅방이 삭제된 경우
            if (currentSession === sessionId) {
                currentSession = null;
                // 웹소켓 연결 종료
                if (ChatWebSocket.instance) {
                    ChatWebSocket.instance.close();
                }
                // 채팅창 비우기
                const chatMessages = document.getElementById('chatMessages');
                if (chatMessages) {
                    chatMessages.innerHTML = '';
                }
                // 세션 제목 초기화
                const currentSessionTitle = document.getElementById('currentSessionTitle');
                if (currentSessionTitle) {
                    currentSessionTitle.textContent = '';
                }
                
                // 새 세션 생성
                if (currentDate) {
                    await createSessionForDate(currentDate);
                } else {
                    const today = new Date().toISOString().split('T')[0];
                    await createSessionForDate(today);
                }
            }
        } else {
            console.error('채팅방 삭제 실패:', response.statusText);
            alert('채팅방 삭제에 실패했습니다.');
        }
    } catch (error) {
        console.error('채팅방 삭제 에러:', error);
        alert('채팅방 삭제 중 오류가 발생했습니다.');
    }
}

// 시스템 메시지 표시 함수
function displaySystemMessage(content) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const contentP = document.createElement('p');
    contentP.textContent = content;
    
    contentDiv.appendChild(contentP);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    
    // 스크롤을 맨 아래로
    chatMessages.scrollTop = chatMessages.scrollHeight;
} 