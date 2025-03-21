from django.apps import AppConfig
import threading
import os
import logging
from .graph_chatbot import initialize_graph

# 로깅 설정
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class ChatbotConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "chatbot"

    def ready(self):
        """서버 시작 시 LangGraph 초기화"""
        # 자동 리로드 시 중복 초기화 방지
        if os.environ.get("RUN_MAIN") != "true":
            logger.info("RUN_MAIN이 true가 아니므로 초기화 건너뜀")
            return

        # 이미 초기화된 경우 중복 초기화 방지
        from .graph_chatbot import _graph_instance, _initialization_in_progress

        if _graph_instance is not None:
            logger.info("LangGraph 인스턴스가 이미 존재하므로 초기화 건너뜀")
            return

        if _initialization_in_progress:
            logger.info("LangGraph 초기화가 이미 진행 중이므로 건너뜀")
            return

        # 백그라운드에서 초기화 시작
        logger.info("LangGraph 초기화 시작 (apps.py)")
        from .graph_chatbot import initialize_graph_in_background

        threading.Thread(target=initialize_graph_in_background, daemon=True).start()
        logger.info("LangGraph 초기화 태스크 시작됨")
