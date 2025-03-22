import os
from typing import List, Any, Tuple
from pathlib import Path
import pandas as pd
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS


# Django 설정 임포트 방식 변경
# django.setup()를 직접 호출하지 않음 - Django 앱 내에서는 이미 설정됨
# 이 파일이 직접 실행될 때만 Django 설정을 로드하도록 함
def _init_django():
    import django
    import sys
    import os

    # 현재 Django 앱이 이미 설정되어 있는지 확인
    if "DJANGO_SETTINGS_MODULE" not in os.environ:
        # 프로젝트 루트 디렉토리 추가
        project_root = Path(__file__).resolve().parent.parent.parent
        sys.path.append(str(project_root))
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
        django.setup()


# Django 모델은 필요한 함수 내에서 지연 임포트
# 이렇게 하면 django.setup()가 호출되기 전에 모델을 임포트하지 않음


def load_data(query_type: str) -> Tuple[List[Document], Any]:
    """데이터 로드 함수

    쿼리 타입에 따라 이벤트 데이터 또는 일반 데이터를 로드합니다.

    Args:
        query_type: 쿼리 타입 ("event" 또는 "general")

    Returns:
        (documents, vectorstore) 튜플
    """
    # Django 모델 지연 임포트
    _init_django()
    from chatbot.models import Event, NaverBlog, NaverBlogFaiss

    # 현재 프로젝트 디렉토리 경로 얻기
    current_dir = Path(__file__).resolve().parent.parent.parent  # Backend 디렉토리까지

    embeddings = OpenAIEmbeddings(model="text-embedding-ada-002")

    if query_type == "event":
        # 이벤트 데이터 벡터스토어 경로
        event_vectorstore_path = current_dir / "data/event_db/vectorstore"

        # 이벤트 문서 변환
        event_docs = []
        # Django ORM을 사용하여 Event 모델에서 데이터 가져오기
        event_queryset = Event.objects.all()

        if not event_queryset.exists():
            raise ValueError("이벤트 데이터가 데이터베이스에 존재하지 않습니다.")

        for event in event_queryset:
            try:
                address_full = (
                    f"{event.location} {event.address} {event.address_detail}"
                )
                page_content = f"{event.title}\n위치: {address_full}\n시간: {event.time}\n내용: {event.content}\n분위기: {event.atmosphere}\n추천 동반자: {event.companions}"

                doc = Document(
                    page_content=page_content,
                    metadata={
                        "title": event.title,
                        "date": event.time,
                        "location": event.location,
                        "address": event.address,
                        "address_detail": event.address_detail,
                        "type": "event",
                        "tag": event.tag,
                    },
                )
                event_docs.append(doc)
            except Exception as e:
                print(f"이벤트 문서 변환 중 오류 발생: {str(e)}")
                continue

        # 이벤트 벡터스토어 로드 또는 생성
        try:
            event_vectorstore = FAISS.load_local(
                str(event_vectorstore_path),
                embeddings,
                allow_dangerous_deserialization=True,
            )
        except Exception:
            ValueError("이벤트 문서가 없어 벡터스토어를 생성할 수 없습니다.")

        return event_docs, event_vectorstore

    else:
        # 일반 데이터 벡터스토어 경로
        vectorstore_path = current_dir / "data/db/vectorstore"

        # 일반 문서 변환
        docs = []
        # Django ORM을 사용하여 NaverBlog 모델에서 데이터 가져오기
        naverblog_queryset = NaverBlog.objects.all()
        print(naverblog_queryset[0].page_content)

        if not naverblog_queryset.exists():
            raise ValueError("일반 데이터가 데이터베이스에 존재하지 않습니다.")

        for blog in naverblog_queryset:
            try:
                doc = Document(
                    page_content=blog.page_content,
                    metadata={
                        "url": blog.url,
                        "line_number": blog.line_number,
                        "type": "general",
                    },
                )
                docs.append(doc)
            except Exception as e:
                print(f"일반 문서 변환 중 오류 발생: {str(e)}")
                continue

        # 일반 벡터스토어 로드 또는 생성
        try:
            vectorstore = FAISS.load_local(
                str(vectorstore_path), embeddings, allow_dangerous_deserialization=True
            )
        except Exception:
            raise ValueError("일반 문서가 없어 벡터스토어를 생성할 수 없습니다.")

        return docs, vectorstore
