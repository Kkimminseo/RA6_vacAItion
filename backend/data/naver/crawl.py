# 네이버 검색 API 예제 - 블로그 검색
from datetime import date
import os
import sys
import json
import urllib.request
import urllib.parse
import requests
from bs4 import BeautifulSoup
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm  # 진행률 표시를 위한 라이브러리


def crawl_blog_content(blog_url):
    try:
        # 과도한 요청 방지를 위한 딜레이
        time.sleep(0.001)

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3"
        }

        # 네이버 블로그 모바일 버전 URL로 변환
        if "blog.naver.com" in blog_url:
            blog_url = blog_url.replace("blog.naver.com", "m.blog.naver.com")

        response = requests.get(blog_url, headers=headers)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # 모바일 버전 네이버 블로그의 본문 내용 찾기
        content = soup.select_one(".se-main-container")  # 일반 에디터
        if not content:
            content = soup.select_one(".post-view")  # 구버전 에디터
        if not content:
            content = soup.select_one("#viewTypeSelector")  # 다른 형식

        if content:
            # HTML 태그 제거 및 텍스트 정리
            text = content.get_text(
                separator="\t", strip=True
            )  # 줄바꿈 대신 탭으로 구분
            return text.replace("\n", "\t")  # 남아있는 줄바꿈을 탭으로 변경
        else:
            return "블로그 내용을 찾을 수 없습니다."

    except Exception as e:
        return f"크롤링 중 오류 발생: {e}"


def process_url(url_data):
    url, total = url_data
    content = crawl_blog_content(url)
    return url, content


def main():
    # 결과를 저장할 디렉토리 생성
    output_dir = "crawled_contents"
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # 오늘 날짜를 파일명에 포함
    today = date.today().strftime("%Y%m%d")
    output_file = os.path.join(output_dir, f"blog_contents_{today}.txt")

    # naver_blog_links.txt 파일에서 URL 읽기
    with open("naver_blog_link.txt", "r", encoding="utf-8") as f:
        urls = [url.strip() for url in f.readlines() if url.strip()]

    # 결과를 저장할 리스트
    results = []

    # ThreadPoolExecutor를 사용하여 병렬 처리
    max_workers = 10  # 동시에 실행할 최대 쓰레드 수
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # URL과 전체 URL 수를 함께 전달
        futures = [executor.submit(process_url, (url, len(urls))) for url in urls]

        # tqdm으로 진행률 표시
        with tqdm(total=len(urls), desc="크롤링 진행률") as pbar:
            for future in as_completed(futures):
                url, content = future.result()
                results.append((url, content))
                pbar.update(1)

    # 결과를 파일에 저장
    with open(output_file, "w", encoding="utf-8") as f:
        for url, content in results:
            f.write(f"{url}\t{content}\n")

    print(f"\n모든 컨텐츠가 다음 파일에 저장되었습니다: {output_file}")


if __name__ == "__main__":
    main()
