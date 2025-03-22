def read_keywords_file(filename):
    categories = {}
    special_events = {}
    
    with open(filename, "r", encoding="utf-8") as f:
        current_category = None
        for line in f:
            line = line.strip()
            if not line: continue
            
            if line.startswith("[") and line.endswith("]"):
                current_category = line[1:-1]
                if current_category != "특별이벤트":
                    categories[current_category] = {}
            elif current_category == "특별이벤트" and ":" in line:
                event, value = line.split(":", 1)
                special_events[event.strip()] = value.strip()
            elif line.startswith(("keywords:", "companions:", "description:")):
                key, value = line.split(":", 1)
                categories[current_category][key] = value.strip()
                
    return categories, special_events

def get_best_category(text, categories):
    max_score = 0
    best_category = None
    
    for category, info in categories.items():
        score = 0
        keywords = info.get('keywords', '').split(', ')
        
        # 키워드별 가중치 계산
        for keyword in keywords:
            count = text.lower().count(keyword)
            # content에서 발견된 키워드에 더 높은 가중치 부여
            if count > 0:
                # 키워드가 제목에 있으면 가중치 3배
                if keyword in text.split('\n')[0].lower():  # 첫 줄은 제목
                    score += count * 3
                else:  # 내용에 있으면 가중치 2배
                    score += count * 2
        
        if score > max_score:
            max_score = score
            best_category = category
    
    # 점수가 0이면 기본값 반환
    if max_score == 0:
        return "예술과 문화가 어우러진 복합 문화 공간"
        
    return categories[best_category]['description']

def analyze_title_only(title):
    """제목만으로 분위기를 분석하는 함수"""
    title_lower = title.lower()
    
    if "뮤지컬" in title_lower:
        return "웅장한 무대와 감동적인 스토리가 어우러진 공연 공간"
    elif "콘서트" in title_lower or "공연" in title_lower:
        return "라이브 공연을 통해 감동을 느낄 수 있는 열정적인 분위기"
    elif "사진전" in title_lower:
        return "사진 작품을 통해 새로운 시각적 경험을 제공하는 예술 공간"
    elif "특별전" in title_lower:
        return "특별히 선별된 작품들로 구성된 기획 전시 공간"
    else:
        return "예술과 문화가 어우러진 복합 문화 공간"

def extract_atmosphere(title, content, tag):
    # 내용이 없는 경우
    if not content or content == "상세 내용을 가져올 수 없습니다.":
        return analyze_title_only(title)
    
    # 내용 기반 분석
    content_lower = content.lower()
    
    # 미디어아트/디지털 전시
    if any(term in content_lower for term in ["미디어아트", "디지털", "인터랙티브", "몰입형"]):
        if "인상주의" in content_lower:
            return "인상주의 명작들을 현대적 미디어아트로 재해석한 몰입형 전시 공간"
        return "첨단 기술과 예술이 만나 관객과 상호작용하는 몰입형 미디어아트 공간"
    
    # 사진전
    if "사진" in content_lower:
        themes = []
        if any(term in content_lower for term in ["다큐멘터리", "기록", "역사"]):
            themes.append("시대와 역사의 순간")
        if any(term in content_lower for term in ["일상", "감성", "미학"]):
            themes.append("일상의 아름다움")
        if themes:
            return f"사진을 통해 {' 및 '.join(themes)}을 포착한 감각적인 전시 공간"
    
    # 역사/전통 전시
    if any(term in content_lower for term in ["조선시대", "역사", "전통"]):
        if "문화재" in content_lower:
            return "전통 문화유산의 가치와 아름다움을 느낄 수 있는 고즈넉한 전시 공간"
        return "역사적 의미와 시대적 가치를 되새겨보는 의미 있는 전시 공간"
    
    # 현대미술
    if any(term in content_lower for term in ["현대미술", "컨템포러리"]):
        if "실험" in content_lower:
            return "현대 미술의 실험적 시도와 새로운 예술적 표현을 경험할 수 있는 혁신적인 공간"
        if "자연" in content_lower:
            return "자연과 도시의 경계를 탐구하는 현대적 감성의 예술 공간"
    
    # 공예/디자인
    if any(term in content_lower for term in ["공예", "디자인", "텍스타일"]):
        return "장인의 섬세한 손길과 현대적 감각이 어우러진 예술적인 공간"
    
    # 어린이/체험
    if any(term in content_lower for term in ["어린이", "체험", "미피"]):
        return "아이들의 호기심과 상상력을 자극하는 즐겁고 교육적인 체험 공간"
    
    # 공연
    if tag == "공연" or tag == "콘서트":
        if "뮤지컬" in title.lower():
            return "웅장한 무대와 감동적인 스토리가 어우러진 공연 공간"
        return "라이브 공연을 통해 감동을 느낄 수 있는 열정적인 분위기"
    
    # 내용 길이에 따른 기본값
    if len(content) > 300:
        return "독특한 예술적 시도와 창의적인 표현이 어우러진 전시 공간"
    return "예술과 문화가 어우러진 복합 문화 공간"

def extract_companions(title, content, tag):
    categories, special_events = read_keywords_file("trip_data/tripdotcom/companions_keywords.txt")
    
    for event, companions in special_events.items():
        if event in title:
            return companions
            
    return "친구, 연인, 가족"

def add_atmosphere_companions(input_file="trip_data/tripdotcom/seoul_events_data_raw.txt", 
                           output_file="trip_data/tripdotcom/fin_fin_events_data.txt"):
    with open(input_file, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("tag, title, time, location, content, atmosphere, companions\n")
        
        for line in lines[1:]:  # 헤더 제외
            try:
                # content는 쌍따옴표로 묶여있으므로, 이를 기준으로 분리
                before_content, content_part = line.strip().rsplit('"', 2)[0:2]
                parts = before_content.strip().split(',')
                
                tag = parts[0].strip()
                title = parts[1].strip()
                content = content_part.strip()  # 따옴표 안의 내용만 추출
                
                # content가 있는 경우에만 상세 분석
                if content and content != "상세 내용을 가져올 수 없습니다.":
                    atmosphere = extract_atmosphere(title, content, tag)
                else:
                    # content가 없는 경우 기본적인 분석
                    atmosphere = extract_atmosphere(title, "", tag)
                    
                companions = extract_companions(title, content, tag)
                
                f.write(f"{line.strip()}, {atmosphere}, \"{companions}\"\n")
            except Exception as e:
                print(f"라인 처리 중 오류 발생: {line[:50]}...")
                print(f"오류 내용: {e}")
                continue
    
    print(f"분위기와 동행 정보가 추가된 파일이 {output_file}에 저장되었습니다.")

if __name__ == "__main__":
    add_atmosphere_companions()