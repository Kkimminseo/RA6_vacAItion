// 상수 정의
const BACKEND_BASE_URL = 'http://43.200.96.32:8000'; // 백엔드 기본 URL
const ACCESS_TOKEN_KEY = 'access_token'; // 로컬 스토리지에 저장된 토큰 키 이름
const USERNAME_KEY = 'username';

// 전역 상태 플래그 초기화
window.isProcessingDelete = false; // 일정 삭제 처리 중인지 여부 (기존 플래그)
window.deleteInProgress = false;   // 새로운 삭제 진행 중 플래그

// 전역 변수로 요청 중 상태 관리
let isSubmitting = false;

// UI 업데이트 함수
function updateUI() {
    const userNickname = localStorage.getItem('userNickname');
    const profileNavLink = document.getElementById('profileNavLink');
    
    if (userNickname && profileNavLink) {
        profileNavLink.textContent = `${userNickname}님의 프로필`;
    }
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
    // 직접 일정 불러오기 함수 호출 추가
    loadScheduleDirectly();
    
    // 로그인 상태 확인
    if (!checkLoginStatus()) {
        return;
    }
    
    // UI 업데이트 추가
    updateUI();
    
    // 일정을 불러오는 중임을 표시
    showInfoMessage('일정을 불러오는 중입니다...');
    
    // 네비게이션 링크 설정 (로그아웃 기능 등록)
    setupNavLinks();
    
    // with Who? 입력 필드를 카테고리 선택 태그로 변경
    const companionInput = document.getElementById('companion');
    if (companionInput) {
        const companionLabel = companionInput.parentNode.querySelector('label');
        const selectElement = document.createElement('select');
        selectElement.id = 'companion';
        selectElement.name = 'companion';
        
        // 카테고리 옵션 추가
        const categories = ['', '친구', '가족', '연인', '혼자'];
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category || '선택하기';
            selectElement.appendChild(option);
        });
        
        // 기존 입력 필드 대체
        companionInput.parentNode.replaceChild(selectElement, companionInput);
        
        // 라벨 텍스트 업데이트
        if (companionLabel) {
            companionLabel.textContent = 'with Who?';
        }
    }
    
    // 버튼 존재 여부 확인
    const saveBtn = document.querySelector('.save-btn');
    const submitBtn = document.querySelector('.submit-btn');
    const deleteBtn = document.querySelector('.delete-btn');
    
    // URL에서 날짜 파라미터 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    
    if (dateParam) {
        // 날짜 파싱 (ISO 형식이 아닐 수 있으므로 직접 파싱)
        const dateParts = dateParam.split('-');
        if (dateParts.length === 3) {
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // JavaScript의 월은 0부터 시작
            const day = parseInt(dateParts[2], 10);
            const selectedDate = new Date(year, month, day);
            
            if (!isNaN(selectedDate.getTime())) {
                // 유효한 날짜인 경우
                // 날짜 표시 업데이트
                updateDateDisplay(selectedDate);
                // 미니 캘린더 생성
                initializeMiniCalendar(selectedDate);
                // 해당 날짜에 저장된 일정 불러오기
                fetchScheduleForDate(dateParam);
                return;
            }
        }
        
        // 날짜 파싱 실패시 fallback
        updateDateDisplay(dateParam);
        try {
            initializeMiniCalendar(new Date(dateParam));
            // 해당 날짜에 저장된 일정 불러오기
            fetchScheduleForDate(dateParam);
        } catch (e) {
            // 오류 처리
        }
    } else {
        // 날짜 파라미터가 없으면 오늘 날짜 사용
        const today = new Date();
        const dateStr = formatLocalDate(today);
        updateDateDisplay(today);
        initializeMiniCalendar(today);
        // 오늘 날짜의 일정 불러오기
        fetchScheduleForDate(dateStr);
    }
    
    // 로그아웃 이벤트 리스너 설정
    setupNavLinks();
    
    // 폼 제출 이벤트 리스너 설정
    setupForm();
});

// 직접 일정 데이터를 불러오는 새로운 함수 추가
async function loadScheduleDirectly() {
    try {
        // URL에서 날짜 가져오기
        const urlParams = new URLSearchParams(window.location.search);
        const dateParam = urlParams.get('date');
        if (!dateParam) {
            return;
        }
        
        // 날짜 정규화
        const normalizedDate = normalizeDate(dateParam);
        
        if (!normalizedDate) {
            return;
        }
        
        // 토큰 가져오기
        const token = localStorage.getItem('access_token');
        if (!token) {
            return;
        }
        
        // 일정을 불러오는 중임을 표시
        showInfoMessage('일정을 불러오는 중입니다...');
        
        // 해당 날짜의 일정 가져오기 (서버 측 필터링)
        const response = await fetch(`${BACKEND_BASE_URL}/calendar/schedules/?date=${normalizedDate}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            showErrorMessage('일정을 불러올 수 없습니다.');
            return;
        }
        
        // 응답 데이터
        const data = await response.json();
        
        // 일정 배열 추출
        const schedules = Array.isArray(data) ? data : 
                         (data.schedules && Array.isArray(data.schedules)) ? data.schedules : 
                         (data ? [data] : []);
        
        // 정확히 일치하는 일정 찾기
        let foundSchedule = null;
        
        for (const schedule of schedules) {
            if (!schedule.date) continue;
            
            // 날짜 정규화하여 비교
            const scheduleNormalizedDate = normalizeDate(schedule.date);
            
            // 전체 날짜가 일치하면 사용
            if (scheduleNormalizedDate === normalizedDate) {
                foundSchedule = schedule;
                break;
            }
        }
        
        // 일정이 있으면 폼에 입력
        if (foundSchedule) {
            // DOM 요소 직접 접근
            const locationInput = document.getElementById('location');
            const companionInput = document.getElementById('companion');
            const memoInput = document.getElementById('memo');
            
            if (locationInput) {
                locationInput.value = foundSchedule.location || '';
            }
            
            if (companionInput) {
                companionInput.value = foundSchedule.companion || '';
            }
            
            if (memoInput) {
                memoInput.value = foundSchedule.memo || '';
            }
            
            // 일정 로드 성공 메시지 표시
            showSuccessMessage('저장된 일정을 불러왔습니다.');
        } else {
            // 일정이 없을 경우 메시지 표시
            showInfoMessage('해당 날짜에 저장된 일정이 없습니다.');
        }
    } catch (error) {
        // 오류 메시지 표시
        showErrorMessage('일정을 불러오는 중 오류가 발생했습니다.');
    }
}

// 로그인 상태 확인 함수
function checkLoginStatus() {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        // 비로그인 상태: 로그인 페이지로 리다이렉트
        window.location.replace('../pages/login.html');
        return false;
    }
    return true;
}

// 날짜 문자열 생성 함수 (YYYY-MM-DD) - 로컬 시간대 기준
function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 미니 캘린더 초기화 함수
function initializeMiniCalendar(selectedDate) {
    const miniCalendar = document.querySelector('.mini-calendar');
    if (!miniCalendar) {
        return;
    }
    
    // 기존 캘린더 내용 제거
    miniCalendar.innerHTML = '';
    
    try {
        const currentMonth = selectedDate.getMonth();
        const currentYear = selectedDate.getFullYear();
        
        // 월 제목 추가
        const monthTitle = document.querySelector('.month-title');
        if (monthTitle) {
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
            monthTitle.textContent = `${months[currentMonth]} ${currentYear}`;
        }
        
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const startingDay = firstDay.getDay();
        const monthLength = lastDay.getDate();

        // Create calendar grid
        const calendarGrid = document.createElement('div');
        calendarGrid.className = 'calendar-grid';
        
        // Add weekday headers
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        weekdays.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.textContent = day;
            dayHeader.className = 'calendar-header';
            calendarGrid.appendChild(dayHeader);
        });

        // Add empty cells
        for (let i = 0; i < startingDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day empty';
            calendarGrid.appendChild(emptyDay);
        }

        // Add days
        for (let day = 1; day <= monthLength; day++) {
            const dayElement = document.createElement('div');
            dayElement.textContent = day;
            dayElement.className = 'calendar-day';
            
            // 선택된 날짜 하이라이트
            if (day === selectedDate.getDate()) {
                dayElement.classList.add('selected');
            }
            
            // 날짜 클릭 이벤트
            dayElement.addEventListener('click', () => {
                // 날짜 생성 (UTC 변환 없이 로컬 날짜 유지)
                const newDate = new Date(currentYear, currentMonth, day);
                // ISO 문자열 대신 로컬 날짜 형식 사용
                const dateStr = formatLocalDate(newDate);
                window.location.href = `../pages/add-schedule.html?date=${dateStr}`;
            });
            
            calendarGrid.appendChild(dayElement);
        }

        miniCalendar.appendChild(calendarGrid);
    } catch (error) {
        // 오류 처리
    }
}

// 날짜 표시 업데이트 함수
function updateDateDisplay(date) {
    // Date 객체가 아니면 변환 시도
    if (!(date instanceof Date)) {
        try {
            date = new Date(date);
        } catch (e) {
            return;
        }
    }
    
    if (!isNaN(date.getTime())) {
        const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const weekday = weekdays[date.getDay()];
        
        // 날짜 형식화 (날씨 아이콘은 별도로 추가됨)
        const formattedDate = `${year}.${month}.${day} ${weekday}`;
        
        const selectedDateElement = document.querySelector('.selected-date');
        if (selectedDateElement) {
            // 일단 날짜만 표시하고, 날씨 아이콘은 날씨 데이터를 가져온 후 추가
            selectedDateElement.textContent = formattedDate;
            
            // 날씨 데이터 가져오기
            fetchWeatherForDate(`${year}-${month}-${day}`).then(weatherData => {
                if (weatherData) {
                    // 날씨 아이콘 추가
                    let displayText = formattedDate;
                    
                    // 아이콘이 있으면 추가
                    if (weatherData.icon) {
                        displayText += ` ${weatherData.icon}`;
                    }
                    
                    selectedDateElement.textContent = displayText;
                    
                    // 텍스트 정보가 있으면 툴크으로 추가 (선택 사항)
                    if (weatherData.text) {
                        selectedDateElement.title = `날씨: ${weatherData.text}`;
                        
                        // description이 있고 text와 다르면 추가 정보로 표시
                        if (weatherData.description && weatherData.description !== weatherData.text) {
                            selectedDateElement.title += ` (${weatherData.description})`;
                        }
                    }
                }
            });
        }
        
        // 미니 캘린더 월 제목 업데이트
        const monthTitleElement = document.querySelector('.month-title');
        if (monthTitleElement) {
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
            monthTitleElement.textContent = `${months[date.getMonth()]} ${year}`;
        }
    }
}

// 특정 날짜의 날씨 정보 가져오기
async function fetchWeatherForDate(dateStr) {
    try {
        // 1. 접근 토큰 확인
        const token = localStorage.getItem('access_token');
        if (!token) {
            return null;
        }
        
        // 2. 날짜 정규화 - YYYY-MM-DD 형식 확보
        const normalizedDate = normalizeDate(dateStr);
        if (!normalizedDate) {
            return null;
        }
        
        // 3. 일정 API 요청으로 날씨 데이터 가져오기 
        // (백엔드에는 별도 weather API가 없고 일정 API에서 날씨 정보를 포함하여 반환)
        const response = await fetch(`${BACKEND_BASE_URL}/calendar/schedules/`, {
            headers: {'Authorization': `Bearer ${token}`}
        });
        
        if (!response.ok) {
            return null;
        }
        
        // 4. 응답 데이터 가져오기
        const data = await response.json();
        
        // 5. 날씨 데이터 추출
        const weatherData = data.weather || [];
        
        if (!weatherData || weatherData.length === 0) {
            return {
                icon: '⏳',
                text: '날씨 정보 없음',
                description: '날씨 정보를 가져올 수 없습니다.'
            };
        }
        
        // 6. 특정 날짜의 날씨 찾기
        const weatherForDate = weatherData.find(item => 
            item.date === normalizedDate || 
            normalizeDate(item.date) === normalizedDate
        );
        
        // 7. 날씨 정보 추출 (이모티콘과 텍스트 설명 모두)
        if (weatherForDate) {
            const result = {
                icon: null,
                text: null,
                description: null,
                raw: weatherForDate // 원본 날씨 데이터 전체
            };
            
            // 아이콘 설정
            if (weatherForDate.icon) {
                result.icon = weatherForDate.icon;
            }
            
            // 텍스트 정보 설정 (날씨 설명)
            if (weatherForDate.sky) {
                result.text = weatherForDate.sky;
            } else if (weatherForDate.description) {
                result.text = weatherForDate.description;
            } else if (weatherForDate.weather_main) {
                result.text = weatherForDate.weather_main;
            }
            
            // 상세 설명 설정
            if (weatherForDate.description) {
                result.description = weatherForDate.description;
            } else if (weatherForDate.weather_description) {
                result.description = weatherForDate.weather_description;
            }
            
            // PTY(강수형태) 코드가 있으면 텍스트 정보에 추가
            if (weatherForDate.pty) {
                const ptyText = getPtyText(weatherForDate.pty);
                if (ptyText) {
                    result.text = result.text ? `${result.text}, ${ptyText}` : ptyText;
                }
            }
            
            // 날씨 정보가 없는 경우 기본값 설정
            if (!result.text) {
                if (result.icon) {
                    // 아이콘을 기반으로 텍스트 추론
                    result.text = getWeatherTextFromIcon(result.icon);
    } else {
                    result.text = '알 수 없는 날씨';
                }
            }
            
            // 아이콘이 없는 경우 텍스트를 기반으로 아이콘 생성
            if (!result.icon && result.text) {
                result.icon = mapWeatherConditionToIcon(result.text);
            }
            
            return result;
        }
        
        // 날씨 정보가 없는 경우 기본 값 반환
        return {
            icon: '🔭',
            text: '날씨 정보 없음',
            description: '해당 날짜의 날씨 정보를 찾을 수 없습니다.'
        };
        
    } catch (error) {
        return {
            icon: '⏳',
            text: '오류 발생',
            description: '날씨 정보를 가져오는 중 오류가 발생했습니다.'
        };
    }
}

// PTY(강수형태) 코드를 텍스트로 변환
function getPtyText(ptyCode) {
    const ptyMap = {
        '0': '없음',
        '1': '비',
        '2': '비/눈',
        '3': '눈',
        '4': '소나기'
    };
    
    return ptyMap[ptyCode.toString()] || null;
}

// 날씨 아이콘에서 텍스트 추출
function getWeatherTextFromIcon(icon) {
    const iconToText = {
        '☀️': '맑음',
        '🌤️': '구름조금',
        '⛅': '구름많음',
        '☁️': '흐림',
        '🌧️': '비',
        '❄️': '눈',
        '🌨️': '비/눈',
        '🌦️': '소나기',
        '🌫️': '안개',
        '⚡': '번개',
        '🌪️': '폭풍'
    };
    
    return iconToText[icon] || '알 수 없는 날씨';
}

// 네비게이션 링크 설정
function setupNavLinks() {
    const navLinks = document.querySelectorAll('nav a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (this.textContent.includes('Home')) {
                window.location.href = '../index.html';
            } else if (this.id === 'profileNavLink') {
                window.location.href = '../pages/profile.html';
            } else if (this.textContent.includes('Logout')) {
                logout();
            }
        });
    });
}

// 폼 제출 이벤트 설정
function setupForm() {
    // 날짜 표시
    displayDate();
    
    // 일정 로드
    loadSchedule();
}

// 이벤트 핸들러 함수들
function handleSave(e) {
    e.preventDefault();
    saveScheduleToDB();
}

function handleSubmit(e) {
    e.preventDefault();
    submitSchedule();
}

function handleDelete(e) {
    e.preventDefault();
    try {
        // 전역 함수 호출
        if (typeof window.deleteSchedule === 'function') {
            window.deleteSchedule();
        } else {
            alert('일정 삭제 기능을 불러올 수 없습니다. 페이지를 새로고침 해주세요.');
        }
    } catch (error) {
        alert('일정 삭제 중 오류가 발생했습니다.');
    }
}

// Django 형식의 날짜 문자열로 변환 (YYYY-MM-DD)
function formatDateForDjango(dateStr) {
    // 이미 올바른 형식이면 그대로 반환
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }
    
    // 날짜 파싱 (ISO 형식이 아닐 수 있으므로 직접 파싱)
    const dateParts = dateStr.split('-');
    if (dateParts.length === 3) {
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // JavaScript의 월은 0부터 시작
        const day = parseInt(dateParts[2], 10);
        const parsedDate = new Date(year, month, day);
        
        if (!isNaN(parsedDate.getTime())) {
            // 유효한 날짜인 경우, 로컬 날짜 형식으로 반환
            return formatLocalDate(parsedDate);
        }
    }
    
    // 다른 형식이라면 Date 객체를 통해 변환
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            throw new Error('유효하지 않은 날짜');
        }
        // toISOString 대신 formatLocalDate 사용
        return formatLocalDate(date);
    } catch (error) {
        return dateStr; // 변환 실패 시 원본 반환
    }
}

// DB 저장 함수 - 현재 페이지에서 일정 저장 (수정 또는 생성)
async function saveScheduleToDB() {
    // 이미 요청 중이면 중복 요청 방지
    if (isSubmitting) {
        return;
    }
    
    // 요청 중 상태로 설정
    isSubmitting = true;
    
    // URL에서 날짜 파라미터 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    
    if (!dateParam) {
        isSubmitting = false;
        return;
    }
    
    // 날짜 정규화 (YYYY-MM-DD 형식으로 변환)
    const normalizedDate = normalizeDate(dateParam);
    if (!normalizedDate) {
        isSubmitting = false;
        return;
    }
    
    // 날짜 파싱 - 연,월,일 분리
    const [year, month, day] = normalizedDate.split('-').map(num => parseInt(num, 10));
    
    const location = document.getElementById('location').value.trim();
    const companion = document.getElementById('companion').value.trim();
    const memo = document.getElementById('memo').value.trim();
    
    // 필수 필드 검증
    if (!location) {
        document.getElementById('location').focus();
        isSubmitting = false;
        return;
    }
    
    // 구나 동 단위 입력 검증
    if (!validateLocationFormat(location)) {
        document.getElementById('location').focus();
        isSubmitting = false;
        return;
    }
    
    // 저장 버튼 비활성화
    const saveBtn = document.querySelector('.save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '저장 중...';
    }
    
    try {
        // 요청 데이터 준비
        const scheduleData = {
            date: normalizedDate,
            location: location,
            companion: companion || '',
            memo: memo || ''
        };
        
        // 인증 토큰 확인
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            window.location.replace('../pages/login.html');
            return;
        }
        
        // 기존 일정이 있는지 먼저 확인 (중복 저장 방지)
        const checkResponse = await fetch(`${BACKEND_BASE_URL}/calendar/schedules/`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
        if (!checkResponse.ok) {
            throw new Error(`일정 조회 실패: ${checkResponse.status}`);
        }
        
        const data = await checkResponse.json();
        
        // 데이터를 항상 배열로 변환
        const schedules = Array.isArray(data) ? data :
                         (data.schedules && Array.isArray(data.schedules)) ? data.schedules :
                         (data ? [data] : []);
        
        // 정확히 일치하는 일정 찾기 (연-월-일 전체 비교)
        let existingSchedule = null;
        
        for (const schedule of schedules) {
            if (!schedule.date) continue;
            
            // 날짜 정규화하여 비교
            const scheduleNormalizedDate = normalizeDate(schedule.date);
            if (!scheduleNormalizedDate) continue;
            
            // 연, 월, 일이 모두 일치하는지 확인
            const [scheduleYear, scheduleMonth, scheduleDay] = scheduleNormalizedDate.split('-').map(num => parseInt(num, 10));
            
            if (scheduleYear === year && scheduleMonth === month && scheduleDay === day) {
                existingSchedule = schedule;
                break;
            }
        }
        
        let response;
        
        // 기존 일정이 있으면 업데이트(PUT), 없으면 새로 생성(POST)
        if (existingSchedule) {
            response = await fetch(`${BACKEND_BASE_URL}/calendar/schedules/${existingSchedule.id}/`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(scheduleData)
            });
        } else {
            response = await fetch(`${BACKEND_BASE_URL}/calendar/schedules/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(scheduleData)
            });
        }
        
        // 응답 처리
        if (response.ok) {
            const result = await response.json();
            
            // 새로운 일정 데이터로 폼 업데이트
            document.getElementById('location').value = location;
            document.getElementById('companion').value = companion;
            document.getElementById('memo').value = memo;
        } else {
            const errorData = await response.json().catch(e => ({ error: '오류 응답을 파싱할 수 없습니다' }));
        }
        
    } catch (error) {
        // 오류 처리
    } finally {
        // 저장 버튼 상태 복원
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = '저장하기';
        }
        
        // 요청 완료 상태로 설정
        isSubmitting = false;
    }
}

/**
 * 성공 메시지를 화면에 표시합니다
 * @param {string} message - 표시할 메시지
 */
function showSuccessMessage(message) {
    showMessage(message, 'success');
}

/**
 * 정보 메시지를 화면에 표시합니다
 * @param {string} message - 표시할 메시지
 */
function showInfoMessage(message) {
    showMessage(message, 'info');
}

/**
 * 오류 메시지를 화면에 표시합니다
 * @param {string} message - 표시할 메시지
 */
function showErrorMessage(message, inputField = null) {
    showMessage(message, 'error');
    
    // 입력 필드에 오류 스타일 적용
    if (inputField) {
        // 모든 필드의 오류 스타일 초기화
        document.querySelectorAll('.form-group input, .form-group select, .form-group textarea').forEach(
            field => field.classList.remove('error-field')
        );
        
        // 오류가 있는 필드에 오류 스타일 추가
        const fieldElement = typeof inputField === 'string' 
            ? document.getElementById(inputField) 
            : inputField;
            
        if (fieldElement) {
            fieldElement.classList.add('error-field');
            fieldElement.focus();
        }
    }
}

/**
 * 메시지를 화면에 표시하는 공통 함수
 * @param {string} message - 표시할 메시지
 * @param {string} type - 메시지 타입 (success, info, error)
 */
function showMessage(message, type) {
    // 기존 메시지 요소가 있으면 제거
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // 메시지 요소 생성
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}-message`;
    messageElement.textContent = message;
    
    // 날짜 문자열 요소 찾기
    const selectedDateElement = document.querySelector('.selected-date');
    
    if (selectedDateElement) {
        // 메시지 컨테이너 찾기 또는 생성
        let messageContainer = document.querySelector('.message-container');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.className = 'message-container';
            
            // 날짜 문자열 바로 다음에 추가
            selectedDateElement.insertAdjacentElement('afterend', messageContainer);
        }
        
        // 메시지 추가
        messageContainer.appendChild(messageElement);
    } else {
        // 날짜 문자열 요소가 없는 경우 기존 방식으로 표시
        let messageContainer = document.querySelector('.message-container');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.className = 'message-container';
            
            // 페이지의 상단에 추가 (폼 바로 위)
            const formContainer = document.querySelector('.form-container') || document.querySelector('form') || document.body.firstChild;
            document.body.insertBefore(messageContainer, formContainer);
        }
        
        // 메시지 추가
        messageContainer.appendChild(messageElement);
    }
    
    // 일정 시간 후 메시지 자동 제거 (성공 및 정보 메시지만)
    if (type === 'success' || type === 'info') {
    setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.remove();
            }
        }, 5000);
    }
}

/**
 * 폼을 초기화하는 함수
 */
function resetForm() {
    const locationInput = document.getElementById('location');
    const contentTextarea = document.getElementById('content');
    
    if (locationInput) locationInput.value = '';
    if (contentTextarea) contentTextarea.value = '';
}

// 일정 제출 함수 - 저장 후 캘린더로 이동
async function submitSchedule() {
    // 이미 요청 중이면 중복 요청 방지
    if (isSubmitting) {
        return;
    }
    
    // 요청 중 상태로 설정
    isSubmitting = true;
    
    // 필수 데이터 확인
    const location = document.getElementById('location').value.trim();
    if (!location) {
        document.getElementById('location').focus();
        isSubmitting = false;
        return;
    }
    
    // 구나 동 단위 입력 검증
    if (!validateLocationFormat(location)) {
        document.getElementById('location').focus();
        isSubmitting = false;
        return;
    }
    
    // 버튼 상태 변경
    const submitBtn = document.querySelector('.submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '저장 중...';
    }
    
    try {
    // 데이터 준비
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
        if (!dateParam) {
            throw new Error('날짜 정보가 없습니다.');
        }
        
        // 날짜 정규화
        const normalizedDate = normalizeDate(dateParam);
        
        if (!normalizedDate) {
            throw new Error('유효하지 않은 날짜 형식입니다.');
        }
        
        const companion = document.getElementById('companion').value.trim();
        const memo = document.getElementById('memo').value.trim();
        
        // 일정 데이터 객체
    const scheduleData = {
            date: normalizedDate,
        location: location,
            companion: companion || '',
            memo: memo || ''
    };
    
        // 토큰 확인
        const accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            window.location.href = '../pages/login.html';
            return;
        }
        
        // 1. 기존 일정 확인 (같은 날짜의 일정 찾기)
        const getResponse = await fetch(`${BACKEND_BASE_URL}/calendar/schedules/`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!getResponse.ok) {
            throw new Error(`일정 조회 실패 (${getResponse.status})`);
        }
        
        const data = await getResponse.json();
        
        // 일정 배열 추출
        const schedules = Array.isArray(data) ? data : 
                         (data.schedules && Array.isArray(data.schedules)) ? data.schedules : 
                         (data ? [data] : []);
        
        // 같은 날짜의 일정 찾기
        const [year, month, day] = normalizedDate.split('-').map(num => parseInt(num, 10));
        
        let existingSchedule = null;
        for (const item of schedules) {
            if (!item.date) continue;
            
            // 모든 날짜를 YYYY-MM-DD 형식으로 정규화
            const itemNormalizedDate = normalizeDate(item.date);
            if (!itemNormalizedDate) continue;
            
            // 연, 월, 일이 모두 일치하는지 확인
            const [itemYear, itemMonth, itemDay] = itemNormalizedDate.split('-').map(num => parseInt(num, 10));
            
            if (itemYear === year && itemMonth === month && itemDay === day) {
                existingSchedule = item;
                break;
            }
        }
        
        let response;
        
        // 2. 기존 일정이 있으면 업데이트, 없으면 새로 생성
        if (existingSchedule) {
            response = await fetch(`${BACKEND_BASE_URL}/calendar/schedules/${existingSchedule.id}/`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(scheduleData)
            });
        } else {
            response = await fetch(`${BACKEND_BASE_URL}/calendar/schedules/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(scheduleData)
            });
        }
        
                // 3. 응답 처리
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`일정 저장 실패 (${response.status})`);
                }
                
                // 캘린더로 이동
                
                // 방법 1: 직접 window.location.href 변경 (기본 방법)
                try {
        window.location.href = '../index.html';
                } catch (e) {
                    // 방법 1 실패
                }
        
                // 방법 2: setTimeout으로 지연 후 이동 시도
        setTimeout(() => {
                    try {
                        window.location.replace('../index.html');
                    } catch (e) {
                        // 방법 2 실패
                        
                        // 방법 3: window.open 사용
                        try {
                            window.open('../index.html', '_self');
                        } catch (e2) {
                            // 방법 3 실패
                            
                            // 방법 4: 홈 버튼 찾아서 클릭
                            const homeButton = document.querySelector('a[href="../index.html"]');
            if (homeButton) {
                homeButton.click();
            } else {
                                // 방법 5: history API 사용
                                window.history.pushState({}, '', '../index.html');
                                window.location.reload();
            }
                        }
                    }
                }, 500);
                
    } catch (error) {
                // 오류 처리
    } finally {
                // 버튼 상태 복원 (에러 발생 시에만 필요)
                if (isSubmitting) { // 이미 페이지 이동 중이 아닌 경우에만
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = '저장 후 캘린더로 이동';
                    }
        isSubmitting = false;
                }
    }
}

// 로그아웃 함수
async function logout() {
    try {
        const refreshToken = localStorage.getItem('refresh_token');
        const accessToken = localStorage.getItem('access_token');
        
                // 로그아웃 API, 호출 시도
        if (refreshToken && accessToken) {
            try {
                const response = await fetch(`${BACKEND_BASE_URL}/logout/`, {
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
                        // API 호출 오류
            }
        }
    } catch (error) {
                // 처리 오류
    } finally {
        // 로컬 스토리지에서 토큰 제거 (항상 실행)
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('username');
        
                // 페이지 이동
        setTimeout(() => {
            window.location.href = '../pages/login.html';
                }, 500);
    }
}

// 특정 날짜의 일정 불러오기
async function fetchScheduleForDate(date) {
            try {
                // 1. 접근 토큰 확인
                const token = localStorage.getItem('access_token');
                if (!token) {
            return;
        }
        
                // 2. 날짜 정규화 - YYYY-MM-DD 형식 확보
                const normalizedDate = normalizeDate(date);
                
                if (!normalizedDate) {
                    return;
                }
                
                // 일정을 불러오는 중임을 표시
                showInfoMessage('일정을 불러오는 중입니다...');
                
                // 날짜 파싱
                const [year, month, day] = normalizedDate.split('-').map(num => parseInt(num, 10));
                
                // 3. 해당 날짜로 직접 API 요청 (서버 측 필터링)
                const response = await fetch(`${BACKEND_BASE_URL}/calendar/schedules/?date=${normalizedDate}`, {
                    headers: {'Authorization': `Bearer ${token}`}
                });
        
        if (!response.ok) {
                    showErrorMessage('일정을 불러올 수 없습니다.');
            return;
        }
        
                // 4. 응답 데이터 가져오기
        const data = await response.json();
                
                // 5. 배열 형태로 변환
                let schedules = [];
                if (Array.isArray(data)) {
                    schedules = data;
                } else if (data.schedules && Array.isArray(data.schedules)) {
                    schedules = data.schedules;
                } else if (typeof data === 'object' && data !== null) {
                    schedules = [data]; // 객체 하나면 배열로 변환
                }
                
                // 6. 정규화된 날짜가 일치하는 일정 찾기
                let foundSchedule = null;
                for (const item of schedules) {
                    if (!item.date) continue;
                    
                    // 모든 날짜를 YYYY-MM-DD 형식으로 정규화
                    const itemNormalizedDate = normalizeDate(item.date);
                    if (!itemNormalizedDate) continue;
                    
                    // 연, 월, 일이 모두 일치하는지 확인
                    const [itemYear, itemMonth, itemDay] = itemNormalizedDate.split('-').map(num => parseInt(num, 10));
                    
                    if (itemYear === year && itemMonth === month && itemDay === day) {
                        foundSchedule = item;
                        break;
                    }
                }
                
                // 7. 일정이 있으면 폼에 데이터 표시
                if (foundSchedule) {
                    // a. 요소 찾기
                    const locationInput = document.getElementById('location');
                    const companionInput = document.getElementById('companion');
                    const memoInput = document.getElementById('memo');
                    
                    // b. 데이터 채우기 (null 체크 포함)
                    if (locationInput) locationInput.value = foundSchedule.location || '';
                    if (companionInput) companionInput.value = foundSchedule.companion || '';
                    if (memoInput) memoInput.value = foundSchedule.memo || '';
                    
                    // 성공 메시지 표시
                    showSuccessMessage('저장된 일정을 불러왔습니다.');
                    
                    return true;
                } else {
                    // 폼 초기화
                    const locationInput = document.getElementById('location');
                    const companionInput = document.getElementById('companion');
                    const memoInput = document.getElementById('memo');
                    
                    if (locationInput) locationInput.value = '';
                    if (companionInput) companionInput.value = '';
                    if (memoInput) memoInput.value = '';
                    
                    // 정보 메시지 표시
                    showInfoMessage('해당 날짜에 저장된 일정이 없습니다.');
                    
                    return false;
                }
            } catch (error) {
                // 오류 메시지 표시
        showErrorMessage('일정을 불러오는 중 오류가 발생했습니다.');
                return false;
    }
}

        // 일정 삭제 함수
window.deleteSchedule = function() {
    // 이미 실행 중이면 중복 실행 방지
    if (window.deleteInProgress === true) {
        return;
    }
    
    // 실행 중 표시
    window.deleteInProgress = true;
    
    try {
        // URL에서 날짜 매개변수 추출
        const urlParams = new URLSearchParams(window.location.search);
        const dateParam = urlParams.get('date');
        if (!dateParam) {
            window.deleteInProgress = false;
            return;
        }
        
                // 날짜 정규화
                const normalizedDate = normalizeDate(dateParam);
                
                if (!normalizedDate) {
            window.deleteInProgress = false;
            return;
        }
        
                // 날짜를 연월일로 분리
                const [year, month, day] = normalizedDate.split('-').map(num => parseInt(num, 10));
                
                // 토큰 확인
                const token = localStorage.getItem('access_token');
                if (!token) {
            window.deleteInProgress = false;
            return;
        }
        
                // 확인 대화상자
                if (!confirm('이 일정을 삭제하시겠습니까?')) {
            window.deleteInProgress = false;
            return;
        }
        
                // 삭제 버튼 상태 변경
                const deleteBtn = document.querySelector('.delete-btn');
                if (deleteBtn) {
                    deleteBtn.disabled = true;
                    deleteBtn.textContent = '삭제 중...';
                }
                
                // 모든 일정 조회 (서버측 필터링 사용하지 않음)
                fetch(`${BACKEND_BASE_URL}/calendar/schedules/`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                .then(response => response.json())
                .then(data => {
                    // 데이터를 항상 배열로 변환
                    const schedules = Array.isArray(data) ? data :
                                     (data.schedules && Array.isArray(data.schedules)) ? data.schedules :
                                     (data ? [data] : []);
                    
                    // 정확히 일치하는 일정 찾기 (연-월-일 전체 비교)
                    const matchingSchedule = schedules.find(schedule => {
                        if (!schedule.date) return false;
                        
                        // 날짜 정규화하여 비교
                        const scheduleNormalizedDate = normalizeDate(schedule.date);
                        if (!scheduleNormalizedDate) return false;
                        
                        // 연, 월, 일이 모두 일치하는지 확인
                        const [scheduleYear, scheduleMonth, scheduleDay] = scheduleNormalizedDate.split('-').map(num => parseInt(num, 10));
                        
                        return scheduleYear === year && scheduleMonth === month && scheduleDay === day;
                    });
                    
                    if (!matchingSchedule) {
                        window.deleteInProgress = false;
                        
                        // 버튼 상태 복원
                        if (deleteBtn) {
                            deleteBtn.disabled = false;
                            deleteBtn.textContent = '일정 삭제하기';
                        }
                        
                        return;
                    }
                    
                    // 일정 ID로 삭제 요청
                    return fetch(`${BACKEND_BASE_URL}/calendar/schedules/${matchingSchedule.id}/`, {
                method: 'DELETE',
                headers: {
                            'Authorization': `Bearer ${token}`
                }
            });
        })
        .then(response => {
                    if (!response) return; // 이전 단계에서 오류 발생
            
            if (response.status === 204 || response.status === 200) {
                        // 삭제 성공
                        
                        // 1. 폼 필드 초기화
                        document.getElementById('location').value = '';
                        document.getElementById('companion').value = '';
                        document.getElementById('memo').value = '';
                        
                        // 2. 1.5초 후 캘린더로 이동 (색상 업데이트 위해)
                setTimeout(() => {
                    window.location.href = '../index.html';
                        }, 500);
            } else {
                        // 삭제 실패
                        
                        // 버튼 상태 복원
                        if (deleteBtn) {
                            deleteBtn.disabled = false;
                            deleteBtn.textContent = '일정 삭제하기';
                        }
                    }
                    
                    window.deleteInProgress = false;
        })
        .catch(error => {
                    // 버튼 상태 복원
            if (deleteBtn) {
                deleteBtn.disabled = false;
                deleteBtn.textContent = '일정 삭제하기';
            }
            
            window.deleteInProgress = false;
        });
            } catch (error) {
                window.deleteInProgress = false;
        
                // 버튼 상태 복원
        const deleteBtn = document.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.textContent = '일정 삭제하기';
                }
            }
        };
        
        // 전역 함수로 명시적 등록 (파일 끝에 추가)
        window.saveScheduleToDB = saveScheduleToDB;
        window.submitSchedule = submitSchedule;
        window.deleteSchedule = deleteSchedule;
        window.fetchWeatherForDate = fetchWeatherForDate;
        window.validateLocationFormat = validateLocationFormat;
        
        // 날짜 정규화 함수 - 다양한 형식을 YYYY-MM-DD로 통일
        function normalizeDate(dateInput) {
            if (!dateInput) return null;
            
            try {
                // 이미 YYYY-MM-DD 형식이면 그대로 반환
                if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
                    return dateInput;
                }
                
                let date;
                
                // 문자열 형식 처리
                if (typeof dateInput === 'string') {
                    // ISO 형식 (YYYY-MM-DDT00:00:00) 처리
                    if (dateInput.includes('T')) {
                        dateInput = dateInput.split('T')[0];
                        
                        // 이미 YYYY-MM-DD 형식이면 그대로 반환
                        if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
                            return dateInput;
                        }
                    }
                    
                    // YYYYMMDD 형식
                    if (/^\d{8}$/.test(dateInput)) {
                        const year = dateInput.substring(0, 4);
                        const month = dateInput.substring(4, 6);
                        const day = dateInput.substring(6, 8);
                        return `${year}-${month}-${day}`;
                    }
                    // YYYY-MM-DD 형식 (하이픈 포함)
                    else if (dateInput.includes('-')) {
                        const parts = dateInput.split('-');
                        if (parts.length === 3) {
                            const year = parts[0];
                            const month = parts[1].padStart(2, '0');
                            const day = parts[2].padStart(2, '0');
                            return `${year}-${month}-${day}`;
                        }
                    }
                    
                    // 기타 형식 (Date 생성자로 파싱 시도)
                    date = new Date(dateInput);
                }
                // Date 객체 처리
                else if (dateInput instanceof Date) {
                    date = dateInput;
                }
                // 숫자 형식 (타임스탬프)
                else if (typeof dateInput === 'number') {
                    date = new Date(dateInput);
                }
                // 객체 형식 (예: {year: 2023, month: 5, day: 15})
                else if (typeof dateInput === 'object' && dateInput !== null) {
                    if ('year' in dateInput && 'month' in dateInput && 'day' in dateInput) {
                        date = new Date(dateInput.year, dateInput.month - 1, dateInput.day);
                    } else if ('date' in dateInput) {
                        // 재귀적으로 date 속성 처리
                        return normalizeDate(dateInput.date);
                    } else {
                        return null;
                    }
                } else {
                    return null;
                }
                
                // 유효한 날짜인지 확인
                if (isNaN(date.getTime())) {
                    return null;
                }
                
                // YYYY-MM-DD 형식으로 변환 (로컬 시간대 기준)
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                
                const normalized = `${year}-${month}-${day}`;
                
                return normalized;
            } catch (error) {
                return null;
            }
        }
        
        // 장소 입력 형식 검증 함수 - 구나 동 단위 제한 없이 아무 값이나 입력 가능
        function validateLocationFormat(location) {
            // 빈 값만 체크 (최소 1글자 이상 입력 필요)
            return location != null && location.trim().length > 0;
        }
        
        // 날씨 상태를 이모티콘으로 변환
        function mapWeatherConditionToIcon(condition) {
            // 한국 기상청 날씨 코드에 따른 아이콘 매핑
            const weatherIcons = {
                '맑음': '☀️',
                '구름조금': '🌤️',
                '구름많음': '⛅',
                '흐림': '☁️',
                '비': '🌧️',
                '눈': '❄️',
                '비/눈': '🌨️',
                '소나기': '🌦️',
                '안개': '🌫️',
                '번개': '⚡',
                '폭풍': '🌪️'
            };
            
            // 숫자 코드(pty)에 따른 아이콘 매핑
            const ptyIcons = {
                '0': '☀️', // 맑음
                '1': '🌧️', // 비
                '2': '🌨️', // 비/눈
                '3': '❄️', // 눈
                '4': '🌦️'  // 소나기
            };
            
            // 영어 날씨 텍스트에 대한 매핑 추가
            const englishToIcon = {
                'clear': '☀️',
                'sunny': '☀️',
                'partly cloudy': '🌤️',
                'mostly cloudy': '⛅',
                'cloudy': '☁️',
                'rain': '🌧️',
                'snow': '❄️',
                'sleet': '🌨️',
                'shower': '🌦️',
                'fog': '🌫️',
                'mist': '🌫️',
                'haze': '🌫️',
                'thunderstorm': '⚡',
                'storm': '🌪️'
            };
            
            if (typeof condition === 'string') {
                // 먼저 한글 매핑 확인
                if (weatherIcons[condition]) {
                    return weatherIcons[condition];
                }
                
                // 영어 매핑 확인 (소문자로 변환하여 비교)
                const lowerCondition = condition.toLowerCase();
                for (const [key, value] of Object.entries(englishToIcon)) {
                    if (lowerCondition.includes(key)) {
                        return value;
                    }
                }
                
                return '🌤️'; // 기본 아이콘
            } else if (typeof condition === 'number' || !isNaN(parseInt(condition))) {
                return ptyIcons[condition.toString()] || '🌤️';
            }
            
            return '🌤️'; // 기본 아이콘
        }