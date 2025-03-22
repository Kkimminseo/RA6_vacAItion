from selenium import webdriver
from selenium.webdriver.common.by import By
import time
from selenium.webdriver.common.keys import Keys
from tqdm import tqdm
from datetime import datetime
import re

# 특수문자 제거 함수
def clean_text(text):
    text = re.sub(r'[^\w\s\[\]().,~\-:년월일]', '', text)
    text = ' '.join(text.split())
    return text

# 스크롤 다운 함수
def scroll_down(driver):
    driver.find_element(By.TAG_NAME, "body").send_keys(Keys.END)
    time.sleep(2)

# 드라이버 설정 함수
def setup_driver():
    options = webdriver.ChromeOptions()

    # 자동화 방지 옵션 추가 
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)

    # 크롬 드라이버 실행
    driver = webdriver.Chrome(options=options)
    driver.implicitly_wait(3)
    return driver

# 서울 지역 선택 함수
def select_seoul_region(driver):
    try:
        # 위치 선택 버튼 클릭
        location_button = driver.find_element(By.XPATH, "//div[@class='select-tagname']/span[text()='위치']/..")
        location_button.click()
        time.sleep(2)

        # 서울 지역 선택
        seoul_option = driver.find_element(By.XPATH, "//div[contains(@class, 'city-item') and contains(text(), '서울')]")
        seoul_option.click()
        time.sleep(3)
    except Exception as e:
        print("지역 선택 중 오류 발생:", e)

# 이벤트 상세 정보 크롤링 함수
def get_event_details(card, driver):
    try:
        # 기본 정보 추출
        title = card.find_element(By.CLASS_NAME, "title").text.strip()
        time_info = card.find_element(By.CLASS_NAME, "time").text.strip()
        location = card.find_element(By.CLASS_NAME, "location").text.strip()
        tag = card.find_element(By.CLASS_NAME, "tags").text.strip()

        # 제목 정제
        if '|' in title:
            title = title.split('|')[0].strip()

        # 상세 페이지 처리
        link = card.find_element(By.TAG_NAME, "a").get_attribute("href")
        driver.execute_script(f"window.open('{link}', '_blank');")
        time.sleep(3)
        driver.switch_to.window(driver.window_handles[-1])
        time.sleep(3)

        # 상세 내용 크롤링
        content = get_content(driver)
        address = get_address(driver)

        # 탭 정리
        driver.close()
        driver.switch_to.window(driver.window_handles[0])
        time.sleep(1)

        return {
            "tag": tag,
            "title": title,
            "time": time_info,
            "location": location,
            "address": address,
            "content": content
        }

    except Exception as e:
        # 예외 발생 시 탭 정리
        if len(driver.window_handles) > 1:
            driver.close()
            driver.switch_to.window(driver.window_handles[0])
        return None

# 상세 내용 크롤링 함수
def get_content(driver):
    try:
        # 상세 내용 섹션 찾기
        content_div = driver.find_element(By.ID, "content")
        paragraphs = content_div.find_elements(By.TAG_NAME, "p")
        
        if paragraphs:
            return "\n\n".join([p.text.strip() for p in paragraphs if p.text.strip()])
        
    except Exception:
        pass
    return "상세 내용을 가져올 수 없습니다."

# 주소 크롤링 함수
def get_address(driver):
    try:
        # 주소 섹션 찾기
        address_div = driver.find_element(By.CLASS_NAME, "address-left")
        if address_div:
            return address_div.text.strip()
        
    except Exception:
        pass
    return "주소를 가져올 수 없습니다."

# 중복 제거 함수
def remove_duplicates(data_list):
    seen_events = set()
    unique_data_list = []
    
    for event in data_list:
        # 중복 제거 키 생성
        event_key = f"{event['tag']}_{event['title']}_{event['time']}_{event['location']}_{event['address']}"
        
        if event_key not in seen_events:
            seen_events.add(event_key)
            unique_data_list.append(event)
    return unique_data_list

# 파일 저장 함수    
def save_to_file(data_list, filename):
    with open(filename, "w", encoding="utf-8") as f:
        f.write("tag, title, time, location, address, content\n")
        for event in data_list:
            f.write(f"{clean_text(event['tag'])}, \"{clean_text(event['title'])}\", {clean_text(event['time'])}, "
                   f"{clean_text(event['location'])}, {clean_text(event['address'])}, \"{clean_text(event['content'])}\"\n")

def main():
    # 크롤링 시작
    start_time = datetime.now()
    print(f"크롤링 시작 시간: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")

    # 드라이버 설정
    driver = setup_driver()

    # 크롤링 대상 URL
    url = "https://kr.trip.com/events/2764875-2025-03-south-korea-collection/"
    driver.get(url)
    time.sleep(5)

    # 서울 지역 선택
    select_seoul_region(driver)

    # 데이터 저장 리스트
    data_list = []

    # 페이지 번호
    page_num = 1

    while True:
        print(f"=== {page_num}페이지 크롤링 중 ===")
        for _ in range(3):
            scroll_down(driver)

        print("카드 리스트 찾는 중...")
        cardlist = driver.find_element(By.CLASS_NAME, "cardlist")
        cards = cardlist.find_elements(By.CLASS_NAME, "card-item")
        print(f"발견된 전체 카드 수: {len(cards)}")

        # 활성 카드 필터링
        active_cards = [card for card in cards if not card.find_elements(By.CLASS_NAME, "end")]

        # 카드 상세 정보 크롤링
        for card in tqdm(active_cards, desc="카드 상세 정보 크롤링 중"):
            event_data = get_event_details(card, driver)

            if event_data:
                data_list.append(event_data)

        # 다음 페이지 확인
        try:
            next_button = driver.find_element(By.XPATH, "//button[contains(@class, 'btn-next')]")
            if 'disabled' in next_button.get_attribute('class'):
                print("마지막 페이지 도달")
                break
            next_button.click()
            time.sleep(3)

        except Exception as e:
            print("다음 페이지 버튼을 찾을 수 없음:", e)
            break

        page_num += 1

    # 드라이버 종료
    driver.quit()

    # 중복 제거
    data_list = remove_duplicates(data_list)
    print(f"총 {len(data_list)}개의 유효한 이벤트가 크롤링되었습니다.")

    # 파일 저장
    save_to_file(data_list, "data/tripdotcom/seoul_events_data_raw2.txt")

    # 종료 시간 기록
    end_time = datetime.now()
    duration = end_time - start_time
    print(f"크롤링 종료 시간: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"총 소요 시간: {duration}")
    print("크롤링 완료 - 결과가 txt 파일로 저장되었습니다.")

if __name__ == "__main__":
    main()