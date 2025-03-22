const BACKEND_BASE_URL = 'http://43.200.96.32:8000';

// 디버깅용 로그
console.log('캘린더 페이지 로드됨');
console.log('토큰 상태:', localStorage.getItem('access_token') ? '있음' : '없음');
// 문제 해결 후 이 코드는 삭제하세요

// 백엔드 서버 연결 확인
async function checkServerConnection() {
    try {
        // 존재하는 API 경로로 변경 (로그인 API 사용)
        const response = await fetch(`${BACKEND_BASE_URL}/login/`, { 
            method: 'OPTIONS'
        });
        console.log('서버 연결 상태:', response.status);
        return true;
    } catch (error) {
        console.error('서버 연결 실패:', error);
        return false;
    }
}

// 페이지 로드 시 서버 연결 확인
checkServerConnection().then(isConnected => {
    if (!isConnected) {
        console.warn('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
    } else {
        console.log('백엔드 서버 연결 성공');
    }
});

// 로그아웃 함수
async function logout() {
    console.log('로그아웃 함수 실행됨');
    try {
        const refreshToken = localStorage.getItem('refresh_token');
        const accessToken = localStorage.getItem('access_token');
        
        if (refreshToken && accessToken) {
            try {
                console.log('로그아웃 API 호출...');
                // 서버에 맞는 로그아웃 경로 사용
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
        // 로컬 스토리지에서 토큰 제거
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('username');
        
        alert('로그아웃 되었습니다.');
        window.location.replace('./pages/login.html');
    }
}

// UI 업데이트 함수
function updateUI() {
    // 사용자 이름 표시
    const userNickname = localStorage.getItem('userNickname');
    const profileNavLink = document.getElementById('profileNavLink');
    
    // 사용자 닉네임이 있으면 프로필 링크 텍스트 업데이트
    if (userNickname && profileNavLink) {
        profileNavLink.textContent = `${userNickname}님의 프로필`;
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    const navLinks = document.querySelectorAll('nav.main-nav a');
    
    if (navLinks.length >= 3) {
        // 홈 링크는 이미 활성화 상태
        
        // 프로필 링크
        navLinks[1].addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = './pages/profile.html';
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

// 로그인 상태 확인 함수
function checkLoginStatus() {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        window.location.replace('./pages/login.html');
        return false;
    }
    return true;
}

class Calendar {
    constructor() {
        this.date = new Date();
        this.currentMonth = this.date.getMonth();
        this.currentYear = this.date.getFullYear();
        this.selectedDate = null;
        
        // 오늘 날짜 정보 저장 제거
        
        this.monthYearElement = document.querySelector('.month-year');
        this.daysContainer = document.querySelector('#calendar-days');
        
        this.initializeControls();
        this.render();
        this.fetchMonthlySchedules();
    }

    initializeControls() {
        document.querySelector('.prev-month').addEventListener('click', () => {
            this.currentMonth--;
            if (this.currentMonth < 0) {
                this.currentMonth = 11;
                this.currentYear--;
            }
            this.render();
            this.fetchMonthlySchedules();
        });

        document.querySelector('.next-month').addEventListener('click', () => {
            this.currentMonth++;
            if (this.currentMonth > 11) {
                this.currentMonth = 0;
                this.currentYear++;
            }
            this.render();
            this.fetchMonthlySchedules();
        });
    }

    async fetchMonthlySchedules() {
        try {
            // 로딩 상태 표시 (선택사항)
            this.showLoading();
            
            // 정확한 API URL 구성
            const apiUrl = `${BACKEND_BASE_URL}/calendar/schedules/?year=${this.currentYear}&month=${this.currentMonth + 1}`;
            
            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
            });
            
            // 로딩 상태 제거
            this.hideLoading();
            
            // 상태 코드 처리
            if (response.status === 401) {
                console.error('인증 실패: 다시 로그인이 필요합니다.');
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('username');
                window.location.replace('./pages/login.html');
                return;
            }
            
            if (!response.ok) {
                console.error(`API 오류 ${response.status}: ${apiUrl}`);
                const errorText = await response.text();
                console.error('응답 내용:', errorText);
                
                // 오류 메시지 표시
                this.showErrorMessage(`서버 오류 (${response.status}): 관리자에게 문의하세요.`);
                return;
            }
            
            // JSON 응답 파싱
            const data = await response.json();
            
            // 일정 및 날씨 데이터 처리
            if (data.schedules) {
                this.updateCalendarWithSchedules(data.schedules, data.weather || []);
            } else {
                this.updateCalendarWithSchedules([]);
            }
            
        } catch (error) {
            console.error('스케줄 가져오기 오류:', error);
            this.hideLoading();
            this.showErrorMessage('서버 통신 중 오류가 발생했습니다.');
        }
    }

    updateCalendarWithSchedules(schedules, weatherData = []) {
        // 현재 표시 중인 년월 계산
        const currentYearMonth = `${this.currentYear}${(this.currentMonth + 1).toString().padStart(2, '0')}`;
        
        // 날씨 데이터 처리 (이미 작동하는 코드)
        const currentMonthWeather = weatherData.filter(w => {
            return w.date.substring(0, 6) === currentYearMonth;
        });
        
        const simplifiedWeather = currentMonthWeather.map(w => {
            return {
                date: w.date.slice(-2).replace(/^0/, ''), // "01" → "1" 변환
                icon: w.icon
            };
        });
        
        // 일정 데이터 처리 - 연월일 모두 확인하도록 개선
        console.log('캘린더에 표시할 일정:', schedules, '현재 연월:', this.currentYear, this.currentMonth + 1);
        
        // 현재 표시 중인 연도와 월에 해당하는 일정만 필터링
        const currentMonthSchedules = Array.isArray(schedules) ? schedules.filter(schedule => {
            if (!schedule.date) return false;
            
            try {
                // 날짜 파싱 - 다양한 형식 지원
                let scheduleYear, scheduleMonth, scheduleDay;
                
                // YYYY-MM-DD 형식
                if (typeof schedule.date === 'string' && schedule.date.includes('-')) {
                    const parts = schedule.date.split('-');
                    scheduleYear = parseInt(parts[0], 10);
                    scheduleMonth = parseInt(parts[1], 10);
                    scheduleDay = parseInt(parts[2], 10);
                } 
                // YYYYMMDD 형식
                else if (typeof schedule.date === 'string' && schedule.date.length === 8) {
                    scheduleYear = parseInt(schedule.date.substring(0, 4), 10);
                    scheduleMonth = parseInt(schedule.date.substring(4, 6), 10);
                    scheduleDay = parseInt(schedule.date.substring(6, 8), 10);
                }
                // Date 객체
                else if (schedule.date instanceof Date) {
                    scheduleYear = schedule.date.getFullYear();
                    scheduleMonth = schedule.date.getMonth() + 1;
                    scheduleDay = schedule.date.getDate();
                }
                // 그 외 형식 (처리 불가능)
                else {
                    console.warn('알 수 없는 날짜 형식:', schedule.date);
                    return false;
                }
                
                // 현재 보고 있는 연도와 월이 일치하는지 확인
                const isCurrentMonth = scheduleYear === this.currentYear && scheduleMonth === (this.currentMonth + 1);
                
                if (isCurrentMonth) {
                    console.log(`일정 날짜(${scheduleYear}-${scheduleMonth}-${scheduleDay})가 현재 월(${this.currentYear}-${this.currentMonth + 1})과 일치함`);
                } else {
                    console.log(`일정 날짜(${scheduleYear}-${scheduleMonth}-${scheduleDay})가 현재 월(${this.currentYear}-${this.currentMonth + 1})과 불일치함`);
                }
                
                return isCurrentMonth;
            } catch (error) {
                console.error('일정 날짜 파싱 오류:', error, schedule);
                return false;
            }
        }) : [];
        
        console.log('현재 월에 표시할 일정:', currentMonthSchedules);
        
        // 간소화된 일정 데이터 생성 (일(day)만 포함)
        const simplifiedSchedules = currentMonthSchedules.map(schedule => {
            // 일정 날짜에서 일(day) 부분만 추출
            let day = '';
            if (schedule.date) {
                // YYYY-MM-DD 형식
                if (schedule.date.includes('-')) {
                    day = schedule.date.split('-')[2].replace(/^0/, '');
                } 
                // YYYYMMDD 형식
                else if (schedule.date.length === 8) {
                    day = schedule.date.slice(-2).replace(/^0/, '');
                }
                // Date 객체인 경우
                else if (schedule.date instanceof Date) {
                    day = schedule.date.getDate().toString();
                }
                // 그 외 형식
                else {
                    day = schedule.date.toString().replace(/^0/, '');
                }
            }
            
            return {
                date: day,
                details: schedule
            };
        });
        
        document.querySelectorAll('.day').forEach(day => {
            // 기존 콘텐츠 초기화
            day.classList.remove('has-event');
            const weatherIcon = day.querySelector('.weather-icon');
            if (weatherIcon) {
                weatherIcon.remove();
            }
            
            // 날짜 정보 가져오기
            const dateAttr = day.getAttribute('data-date');
            if (!dateAttr) return;
            
            // 해당 날짜의 일정 확인
            const hasSchedule = simplifiedSchedules.some(s => s.date === dateAttr);
            
            if (hasSchedule) {
                day.classList.add('has-event');
            }
            
            // 날씨 정보 표시
            const weatherInfo = simplifiedWeather.find(w => w.date === dateAttr);
            
            if (weatherInfo && weatherInfo.icon) {
                // 날씨 아이콘 표시
                const weatherIconDiv = document.createElement('div');
                weatherIconDiv.className = 'weather-icon';
                weatherIconDiv.textContent = weatherInfo.icon;
                day.appendChild(weatherIconDiv);
            }
        });
    }

    render() {
        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
        const startingDay = firstDay.getDay();
        const monthLength = lastDay.getDate();

        // 오늘 날짜 정보 가져오기
        const today = new Date();
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth();
        const todayDate = today.getDate();

        // Update month and year display
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
        this.monthYearElement.textContent = `${months[this.currentMonth]} ${this.currentYear}`;

        // Clear previous days
        this.daysContainer.innerHTML = '';

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'day empty';
            this.daysContainer.appendChild(emptyDay);
        }

        // Add days of the month
        for (let day = 1; day <= monthLength; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'day';
            
            // 오늘 날짜인지 확인
            if (day === todayDate && 
                this.currentMonth === todayMonth && 
                this.currentYear === todayYear) {
                dayElement.classList.add('today');
            }
            
            dayElement.textContent = day;
            dayElement.setAttribute('data-date', day);

            // Add click event
            dayElement.addEventListener('click', () => {
                // Remove previous selection
                const previousSelected = document.querySelector('.day.selected');
                if (previousSelected) {
                    previousSelected.classList.remove('selected');
                }
                
                // Add new selection
                dayElement.classList.add('selected');
                this.selectedDate = new Date(this.currentYear, this.currentMonth, day);
                
                // Navigate to add schedule page with date parameter
                // UTC 변환을 방지하기 위해 toISOString 대신 로컬 날짜 형식 사용
                const year = this.selectedDate.getFullYear();
                const month = (this.selectedDate.getMonth() + 1).toString().padStart(2, '0');
                const dayVal = this.selectedDate.getDate().toString().padStart(2, '0');
                const dateStr = `${year}-${month}-${dayVal}`;
                console.log(`선택한 날짜: ${year}년 ${month}월 ${dayVal}일, URL 파라미터: ${dateStr}`);
                window.location.href = `./pages/add-schedule.html?date=${dateStr}`;
            });

            this.daysContainer.appendChild(dayElement);
        }
    }

    // 오류 메시지 표시
    showErrorMessage(message) {
        // 기존 에러 메시지 제거
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.color = 'red';
        errorDiv.style.padding = '10px';
        errorDiv.style.margin = '10px 0';
        errorDiv.style.border = '1px solid red';
        errorDiv.style.borderRadius = '5px';
        errorDiv.style.backgroundColor = '#ffebee';
        errorDiv.style.fontSize = '14px';
        errorDiv.textContent = message;
        
        // 캘린더 위에 오류 메시지 추가
        const calendarContainer = document.querySelector('.calendar-container');
        if (calendarContainer) {
            calendarContainer.prepend(errorDiv);
        } else {
            // 캘린더 컨테이너가 없으면 body에 추가
            document.body.prepend(errorDiv);
        }
    }

    // 로딩 표시 함수 추가
    showLoading() {
        const calendarContainer = document.querySelector('.calendar-container');
        if (!calendarContainer) return;
        
        // 이미 로딩 메시지가 있는지 확인
        if (document.querySelector('.loading-message')) return;
        
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-message';
        loadingDiv.textContent = '데이터 로딩 중...';
        loadingDiv.style.position = 'absolute';
        loadingDiv.style.top = '50%';
        loadingDiv.style.left = '50%';
        loadingDiv.style.transform = 'translate(-50%, -50%)';
        loadingDiv.style.padding = '10px 20px';
        loadingDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
        loadingDiv.style.color = 'white';
        loadingDiv.style.borderRadius = '5px';
        loadingDiv.style.zIndex = '1000';
        
        calendarContainer.style.position = 'relative';
        calendarContainer.appendChild(loadingDiv);
    }

    // 로딩 숨김 함수 추가
    hideLoading() {
        const loadingDiv = document.querySelector('.loading-message');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }
}

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    // 로그인 상태 확인
    if (!checkLoginStatus()) return;
    
    // UI 업데이트
    updateUI();
    
    // 이벤트 리스너 설정
    setupEventListeners();
    
    // 캘린더 초기화
    new Calendar();
}); 