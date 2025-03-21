import os
import threading
import asyncio
from typing import Dict, List, Annotated, TypedDict, Tuple, Optional, Any, Iterator
from threading import Event
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import pandas as pd
import re
import numpy as np
from pathlib import Path
from dotenv import load_dotenv
import langgraph
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages, MessageGraph
import random
from .graph_modules import (
    GraphState,
    query_analyzer,
    hybrid_retriever,
    naver_search,
    response_generator,
)
import logging

# 로깅 설정
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# LangGraph 인스턴스 준비 상태를 나타내는 이벤트
graph_ready = asyncio.Event()

# 전역 변수로 LangGraph 인스턴스 저장
_graph_instance = None

# 싱글톤 그래프 인스턴스와 초기화 상태
_initialization_in_progress = False  # 초기화가 진행 중인지 확인하는 플래그

# 환경 변수 로드
load_dotenv()

# OpenAI API 키 설정
openai_api_key = os.getenv("OPENAI_API_KEY")
if openai_api_key:
    os.environ["OPENAI_API_KEY"] = openai_api_key
else:
    print("Warning: OPENAI_API_KEY environment variable is not set")


def get_graph_instance():
    """그래프 인스턴스를 반환하는 함수"""
    global _graph_instance
    if _graph_instance is None:
        logger.info("LangGraph 인스턴스가 없음, 새로 생성 시도")
        # 여기서 그래프를 생성하는 로직 추가
        try:
            _graph_instance = create_graph()
            logger.info("LangGraph 인스턴스 생성 성공")
            # 그래프 생성 성공 시 이벤트 설정
            if not graph_ready.is_set():
                logger.info("graph_ready 이벤트 설정 (get_graph_instance에서)")
                graph_ready.set()
        except Exception as e:
            logger.error(f"LangGraph 인스턴스 생성 실패: {e}")
            raise
    return _graph_instance


def create_graph():
    """LangGraph 생성 함수"""
    logger.info("create_graph 함수 호출됨")
    try:
        # 상태 그래프 생성
        workflow = StateGraph(GraphState)

        # 노드 추가
        workflow.add_node("query_analyzer", query_analyzer)
        workflow.add_node("hybrid_retriever", hybrid_retriever)
        workflow.add_node("naver_search", naver_search)
        workflow.add_node("response_generator", response_generator)

        # 엣지 연결
        workflow.set_entry_point("query_analyzer")
        workflow.add_edge("query_analyzer", "hybrid_retriever")
        workflow.add_edge("hybrid_retriever", "naver_search")
        workflow.add_edge("naver_search", "response_generator")
        workflow.add_edge("response_generator", END)

        # 그래프 컴파일
        graph = workflow.compile()

        # 생성 성공 메시지와 함께 그래프 반환
        logger.info("LangGraph 생성 성공")
        return graph
    except Exception as e:
        logger.error(f"LangGraph 생성 중 오류 발생: {e}")
        raise


def initialize_graph():
    """백그라운드 스레드에서 그래프 초기화"""
    logger.info("initialize_graph 함수 호출됨")
    try:
        # 그래프 인스턴스 생성
        instance = get_graph_instance()
        logger.info("LangGraph 인스턴스 초기화 성공")

        # 이벤트 설정 (get_graph_instance에서 이미 처리됨)
        if not graph_ready.is_set():
            logger.info("graph_ready 이벤트 설정 (initialize_graph에서)")
            graph_ready.set()
            logger.info(f"graph_ready 이벤트 설정 완료: {graph_ready.is_set()}")
        else:
            logger.info(f"graph_ready 이벤트가 이미 설정됨: {graph_ready.is_set()}")
    except Exception as e:
        logger.error(f"LangGraph 초기화 중 오류 발생: {e}")
        # 초기화 실패해도 이벤트는 설정하여 무한 대기 방지
        if not graph_ready.is_set():
            logger.warning("오류 발생으로 인한 graph_ready 이벤트 설정")
            graph_ready.set()


# 백그라운드에서 그래프 초기화
def initialize_graph_in_background():
    """백그라운드에서 그래프 초기화"""
    global _initialization_in_progress, _graph_instance

    # 이미 초기화가 완료된 경우
    if _graph_instance is not None:
        print("=== LangGraph 인스턴스가 이미 초기화되어 있습니다 ===")
        return

    # 이미 초기화가 진행 중인 경우
    if _initialization_in_progress:
        print("=== LangGraph 초기화가 이미 진행 중입니다 ===")
        return

    # 초기화 진행 중 플래그 설정
    _initialization_in_progress = True

    try:
        print("=== LangGraph 초기화 시작 ===")
        initialize_graph()
        print("=== LangGraph 초기화 완료 - 이제 응답 생성이 가능합니다 ===")
    except Exception as e:
        print(f"=== LangGraph 초기화 중 오류 발생: {str(e)} ===")
        # 오류 발생 시 플래그 초기화
        _initialization_in_progress = False


# 서버 시작 시 자동 초기화 (나중에 apps.py로 이동할 수 있음)
if _graph_instance is None and not _initialization_in_progress:
    print("=== 서버 시작: LangGraph 초기화 시작 ===")
    threading.Thread(target=initialize_graph_in_background, daemon=True).start()
