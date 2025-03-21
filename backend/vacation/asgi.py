import os

# DJANGO_SETTINGS_MODULE 환경 변수 설정
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vacation.settings")

# 이후에 Django 모듈을 가져옵니다
from django.core.asgi import get_asgi_application

# 먼저 Django 애플리케이션을 로드합니다
django_asgi_app = get_asgi_application()

# 그 다음에 다른 모듈을 임포트합니다
from channels.routing import ProtocolTypeRouter, URLRouter
from chatbot.routing import websocket_urlpatterns, TokenAuthMiddlewareStack

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": TokenAuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
    }
)

# Daphne 설정
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
        "CONFIG": {
            "capacity": 1000,
        },
    },
}

# WebSocket 타임아웃 설정
WEBSOCKET_TIMEOUT = 300  # 5분
WEBSOCKET_CONNECT_TIMEOUT = 20  # 20초
