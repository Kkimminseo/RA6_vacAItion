from django.apps import AppConfig
import threading
import os
from .graph_chatbot import initialize_graph


class ChatbotConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "chatbot"

    def ready(self):
        """서버 시작 시 LangGraph 초기화"""
        # 자동 리로드 시 중복 초기화 방지
        if os.environ.get("RUN_MAIN") != "true":
            return

        # 이미 초기화된 경우 중복 초기화 방지
        from .graph_chatbot import _graph_instance, _initialization_in_progress

        if _graph_instance is not None:
            print("=== LangGraph가 이미 초기화되어 있습니다 ===")
            return

        if _initialization_in_progress:
            print("=== LangGraph 초기화가 이미 진행 중입니다 ===")
            return

        def initialize_in_background():
            try:
                print("\n=== 서버 시작: LangGraph 초기화 시작 ===")
                initialize_graph()
                print("=== LangGraph 초기화 완료 ===\n")
            except Exception as e:
                print(f"=== LangGraph 초기화 실패: {e} ===\n")

        # 백그라운드 스레드에서 초기화 실행
        threading.Thread(target=initialize_in_background, daemon=True).start()
