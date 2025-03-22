import requests
from dotenv import load_dotenv
import os
from datetime import datetime, timedelta

def load_environment():
    load_dotenv()
    client_id = os.getenv("naver_client_id")
    client_secret = os.getenv("naver_client_secret")
    return client_id, client_secret

def get_seoul_districts():
    return [
        "서울 종로구", "서울 중구", "서울 용산구", "서울 성동구", "서울 광진구",
        "서울 동대문구", "서울 중랑구", "서울 성북구", "서울 강북구", "서울 도봉구",
        "서울 노원구", "서울 은평구", "서울 서대문구", "서울 마포구", "서울 양천구",
        "서울 강서구", "서울 구로구", "서울 금천구", "서울 영등포구", "서울 동작구",
        "서울 관악구", "서울 서초구", "서울 강남구", "서울 송파구", "서울 강동구"
    ]

def get_search_keywords(district):
    base_exclusions = "-비자 -컴퓨터 -인터넷 -수리 -이사 -대출 -호텔 -웨딩홀 -정치"
    
    keywords = [
        f'"{district}" +숨은 {base_exclusions}',
        f'"{district}" +우연 {base_exclusions}',
        f'"{district}" +나만 아는 {base_exclusions}',
        f'"{district}" +꿀팁 |방문 {base_exclusions}',
        f'"{district}" +이색 +체험 {base_exclusions}',
        f'"{district}" +데이트 {base_exclusions}',
        f'"{district}" +꿀팁 |여행 {base_exclusions}',
        f'"{district}" +핫플 {base_exclusions}',
        f'"{district}" +즐길거리 {base_exclusions}',
    ]
    return keywords

def search_naver_blog(query, client_id, client_secret, display=100, start=1):
    url = "https://openapi.naver.com/v1/search/blog.json"
    headers = {
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": client_secret
    }
    params = {
        "query": query,
        "display": display,
        "start": start,
        "sort": "sim"
    }
    
    response = requests.get(url, headers=headers, params=params)
    
    if response.status_code == 200:
        return response.json()
    else:
        print("Error:", response.status_code, response.text)
        return None

def get_blog_results(query, client_id, client_secret, total_results=600):
    all_items = []
    
    # 100개씩 6번 요청
    for start in range(1, total_results + 1, 100):
        data = search_naver_blog(query, client_id, client_secret, display=100, start=start)
        if data and 'items' in data:
            all_items.extend(data['items'])
        else:
            break
    
    return all_items

def save_links_to_file(links, filename="naver_blog_data.txt"):
    with open(filename, 'w', encoding='utf-8') as f:
        for link in links:
            f.write(link + '\n')
    print(f"링크가 {filename}에 저장되었습니다.")

def main():
    # 환경 변수 로드
    client_id, client_secret = load_environment()
    if not client_id or not client_secret:
        print("Error: API credentials not found in .env file")
        return

    # 서울시 구 목록 가져오기
    seoul_gu = get_seoul_districts()
    
    # 검색 결과 저장할 set
    all_links = set()
    
    # 현재 날짜 계산
    current_date = datetime.now()
    one_year_ago = current_date - timedelta(days=365)
    
    # 각 구별로 검색 실행
    for gu in seoul_gu:
        print(f"\n=== {gu} 검색 시작 ===")
        
        # 각 키워드로 검색
        for search_query in get_search_keywords(gu):
            print(f"\n검색 키워드: {search_query}")
            
            # 600개 결과 가져오기
            items = get_blog_results(search_query, client_id, client_secret)
            print(f"검색된 결과 수: {len(items)}")
            
            for item in items:
                try:
                    post_date = datetime.strptime(item.get("postdate"), "%Y%m%d")
                    if post_date >= one_year_ago:
                        all_links.add(item.get("link"))
                except (ValueError, TypeError):
                    continue
    
    print(f"\n총 수집된 고유 링크 수: {len(all_links)}")
    
    # 결과를 파일로 저장
    save_links_to_file(all_links)

if __name__ == "__main__":
    main() 