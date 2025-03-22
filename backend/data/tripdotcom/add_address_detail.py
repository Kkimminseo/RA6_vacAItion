import csv

# 파일 읽기 및 쓰기
with open('trip_data/tripdotcom/fin_fin_events_data.txt', 'r', encoding='utf-8') as f1, \
     open('trip_data/tripdotcom/address_detail.txt', 'r', encoding='utf-8') as f2, \
     open('trip_data/tripdotcom/fin_fin_fin_events_data.txt', 'w', encoding='utf-8', newline='') as f3:
    
    # address_detail 목록 읽기 (헤더 건너뛰기)
    next(f2)
    address_details = f2.readlines()
    address_details = [addr.strip() for addr in address_details]
    
    # 첫 줄(헤더) 읽기
    header_line = f1.readline().strip()
    
    # 새 헤더 작성 (address_detail 추가)
    headers = header_line.split(',')
    new_header = ','.join(headers[:5] + ['address_detail'] + headers[5:])
    f3.write(new_header + '\n')
    
    # 각 라인 처리
    for i, line in enumerate(f1):
        try:
            # 콤마로 분리 (큰따옴표 내의 콤마는 무시)
            parts = []
            current_part = ''
            in_quotes = False
            
            for char in line:
                if char == '"':
                    in_quotes = not in_quotes
                    current_part += char
                elif char == ',' and not in_quotes:
                    parts.append(current_part.strip())
                    current_part = ''
                else:
                    current_part += char
            parts.append(current_part.strip())
            
            # address_detail 추가
            if i < len(address_details):
                address_detail = address_details[i]
            else:
                address_detail = "주소 정보 없음"
            
            # 새 라인 구성
            new_parts = parts[:5] + [address_detail] + parts[5:]
            new_line = ','.join(new_parts)
            
            # 파일에 쓰기
            f3.write(new_line + '\n')
            
        except Exception as e:
            print(f"Error processing line {i+1}: {e}")
            continue