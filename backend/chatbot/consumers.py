import json
import asyncio
from dotenv import load_dotenv
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import ChatSession, ChatMessage
import os
from account.models import User
import jwt
from django.conf import settings
from urllib.parse import parse_qs
import weakref
from .graph_chatbot import get_graph_instance, graph_ready

# 전역 변수로 연결 관리
_active_connections = weakref.WeakSet()

load_dotenv()
NAVER_CLIENT_ID = os.getenv("NAVER_CLIENT_ID")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


class ChatConsumer(AsyncWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.room_name = None
        self.room_group_name = None
        self.user = None
        self.message_history = None
        self._active = False

    async def connect(self):
        try:
            if self._active:
                return

            # 토큰 인증 처리
            query_string = self.scope.get("query_string", b"").decode()
            query_params = parse_qs(query_string)

            # 토큰 추출 및 검증
            token = query_params.get("token", [None])[0]
            if not token:
                print("WebSocket 연결에 토큰이 없음")
                await self.close()
                return

            try:
                # Bearer 접두사 제거
                if token.startswith("Bearer "):
                    token = token[7:]

                # JWT 토큰 디코딩
                decoded_token = jwt.decode(
                    token, settings.SECRET_KEY, algorithms=["HS256"]
                )
                username = decoded_token.get("username")

                if not username:
                    print("토큰에 username이 없음")
                    print("토큰 내용:", decoded_token)
                    await self.close()
                    return

                self.user = await self.get_user_from_username(username)
                if not self.user:
                    print("유효하지 않은 사용자")
                    await self.close()
                    return

            except jwt.InvalidTokenError as e:
                print(f"토큰 검증 실패: {e}")
                await self.close()
                return
            except Exception as e:
                print(f"인증 처리 중 오류 발생: {e}")
                await self.close()
                return

            self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
            self.room_group_name = f"chat_{self.room_name}"

            # 메세지 히스토리 로드
            self.message_history = await self.load_chat_history()

            # 채널 그룹에 추가
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)

            # WebSocket 연결 수락
            await self.accept()
            self._active = True
            _active_connections.add(self)
            print(f"WebSocket 연결 성공: {self.user.username}, 세션: {self.room_name}")

        except Exception as e:
            print(f"Connection error: {e}")
            if hasattr(self, "close"):
                await self.close(code=1011)
            raise

    async def disconnect(self, close_code):
        # 채널 그룹에서 제거
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(
                self.room_group_name, self.channel_name
            )
        self._active = False
        _active_connections.discard(self)

    # 웹소켓에서 메세지 수신
    async def receive(self, text_data):
        """클라이언트로부터 메시지 수신"""
        print(f"받은 데이터: {text_data}")

        try:
            text_data_json = json.loads(text_data)
            print(f"파싱된 JSON: {text_data_json}")

            message = text_data_json.get("message", "")
            session_id = text_data_json.get("sessionId")

            print(
                f"추출된 메시지: '{message}', 세션 ID: {session_id or self.room_name}"
            )

            if not message.strip():
                print("빈 메시지 무시")
                return

            # 메시지 저장
            session, is_new = await self.save_message_and_get_response(
                message, session_id
            )
            print(f"메시지 저장 완료, 새 세션: {is_new}")

            # 클라이언트에게 메시지 수신 알림 (is_user 대신 is_bot=False 사용)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "message": message,
                    "is_bot": False,  # 사용자 메시지는 is_bot=False
                    "session_id": str(session.id),
                },
            )

            # 백그라운드에서 AI 응답 처리
            print("AI 응답 처리 시작")
            task = asyncio.create_task(
                self.process_message_in_background(message, session)
            )
            print(f"백그라운드 태스크 생성됨: {task}")

            # 태스크 예외 처리를 위한 콜백 추가
            def handle_task_exception(task):
                try:
                    exception = task.exception()
                    if exception:
                        print(f"백그라운드 태스크 예외 발생: {exception}")
                except asyncio.CancelledError:
                    print("백그라운드 태스크가 취소됨")
                except Exception as e:
                    print(f"백그라운드 태스크 예외 처리 중 오류: {e}")

            task.add_done_callback(handle_task_exception)
            print("백그라운드 태스크 예외 처리 콜백 추가됨")

        except json.JSONDecodeError as e:
            print(f"JSON 파싱 오류: {e}")
        except Exception as e:
            print(f"메시지 수신 중 오류: {e}")
            import traceback

            print(f"자세한 오류: {traceback.format_exc()}")

    async def process_message_in_background(self, message, session):
        """백그라운드에서 메시지 처리"""
        animation_task = None
        try:
            print("\n=== AI 응답 처리 시작 ===")
            # LangGraph 인스턴스 대기
            print(f"=== LangGraph 준비 상태: {graph_ready.is_set()} ===")
            wait_count = 0
            while not graph_ready.is_set():
                wait_count += 1
                if wait_count % 10 == 0:  # 10번마다 로그 출력 (약 1초마다)
                    print(f"=== LangGraph 대기 중... {wait_count/10}초 경과 ===")
                await asyncio.sleep(0.1)

            print("=== LangGraph 대기 완료, 인스턴스 가져오기 시도 ===")
            try:
                graph = get_graph_instance()
                print("=== LangGraph 인스턴스 가져옴 ===")
            except Exception as graph_init_error:
                print(f"=== LangGraph 인스턴스 가져오기 실패: {graph_init_error} ===")
                raise

            # 상태 업데이트 시작 - 애니메이션 효과를 위한 반복
            ellipsis_patterns = ["", ".", "..", "..."]
            animation_count = 0

            # 애니메이션 태스크 정의
            async def animate_ellipsis():
                nonlocal animation_count
                while True:
                    pattern = ellipsis_patterns[
                        animation_count % len(ellipsis_patterns)
                    ]
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            "type": "chat_message",
                            "message": f"맞춤 장소를 찾아보는 중입니다{pattern}",
                            "is_bot": True,
                            "is_streaming": True,
                            "session_id": str(session.id),
                        },
                    )
                    animation_count += 1
                    await asyncio.sleep(0.5)  # 0.5초마다 업데이트

            # 애니메이션 시작
            print("=== 애니메이션 태스크 시작 ===")
            animation_task = asyncio.create_task(animate_ellipsis())
            print("=== 애니메이션 태스크 생성됨 ===")

            # LangGraph 실행 (비동기 호출)
            print("=== LangGraph 비동기 호출 시작 ===")
            try:
                result = await graph.ainvoke({"question": message})

                if "answer" in result:
                    content = result["answer"]
                    print(f"=== 응답 받음: 길이 {len(content)} ===")
                    print(f"=== 응답 미리보기: {content[:100]}... ===")
                    final_response = content
                else:
                    print(
                        f"=== 응답에 'answer' 키가 없음, 가능한 키: {list(result.keys())} ==="
                    )
                    final_response = ""
            except Exception as graph_error:
                print(f"=== LangGraph 처리 중 오류: {graph_error} ===")
                final_response = f"죄송합니다, 응답을 생성하는 중에 오류가 발생했습니다: {str(graph_error)}"

            # 응답이 비어있으면 기본 응답 설정
            if not final_response or final_response.strip() == "":
                final_response = "죄송합니다, 요청하신 정보를 찾을 수 없습니다. 다른 질문을 해주시겠어요?"
                print("=== 응답이 비어있어 기본 응답으로 대체합니다 ===")
            else:
                print(f"=== 최종 응답 길이: {len(final_response)} ===")
                print(f"=== 최종 응답 미리보기: {final_response[:100]}... ===")

            # 데이터베이스에 응답 저장
            print("=== 응답 데이터베이스에 저장 ===")
            await self.save_bot_response(session, final_response)

            # 최종 메시지 전송
            print("=== 최종 응답 전송 시작 ===")
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "message": final_response,
                    "is_bot": True,
                    "is_streaming": False,
                    "session_id": str(session.id),
                },
            )
            print("=== 최종 응답 전송 완료 ===")

        except Exception as e:
            error_message = f"오류가 발생했습니다: {str(e)}"
            print(f"=== AI 응답 생성 중 오류: {e} ===")
            import traceback

            print(f"=== 자세한 오류: {traceback.format_exc()} ===")

            # 오류 메시지 전송
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "message": error_message,
                    "is_bot": True,
                    "is_error": True,
                    "session_id": str(session.id),
                },
            )
        finally:
            # 애니메이션 태스크가 존재하면 취소
            if animation_task and not animation_task.done():
                print("=== 애니메이션 태스크 취소 ===")
                animation_task.cancel()
                try:
                    await animation_task
                    print("=== 애니메이션 태스크 취소 완료 ===")
                except asyncio.CancelledError:
                    print("=== 애니메이션 태스크 취소됨 ===")
                    pass

    async def chat_message(self, event):
        """채팅 메시지를 클라이언트에게 전송"""
        try:
            is_bot = event.get("is_bot", False)
            is_streaming = event.get("is_streaming", False)

            # 스트리밍이 아닌 경우에만 로그 출력
            if not is_streaming:
                message_preview = event.get("message", "")[:50]
                print(
                    f"=== 클라이언트로 메시지 전송: 타입={'봇' if is_bot else '사용자'}, 스트리밍={is_streaming}, 내용={message_preview}... ==="
                )

            # 메시지 전송
            await self.send(text_data=json.dumps(event))

            # 스트리밍이 아닌 경우에만 로그 출력
            if not is_streaming:
                print(f"=== 메시지 전송 완료: 길이={len(event.get('message', ''))} ===")

        except Exception as e:
            print(f"=== 메시지 전송 중 오류: {e} ===")
            try:
                # 오류 발생 시 간단한 오류 메시지 전송 시도
                await self.send(
                    text_data=json.dumps(
                        {
                            "type": "chat_message",
                            "message": f"메시지 전송 중 오류가 발생했습니다: {str(e)}",
                            "is_bot": True,
                            "is_error": True,
                            "session_id": event.get("session_id", "unknown"),
                        }
                    )
                )
            except Exception as e2:
                print(f"=== 오류 메시지 전송 시도 중 2차 오류: {e2} ===")

    @database_sync_to_async
    def load_chat_history(self):
        # 현재 세션의 모든 메시지를 시간순으로 가져옴
        try:
            # room_name 대신 id 필드 사용 (room_name은 URL에서 가져온 세션 ID)
            session = ChatSession.objects.filter(id=self.room_name).first()
            if session:
                messages = ChatMessage.objects.filter(session=session).order_by(
                    "created_at"
                )
                return [
                    {
                        "content": msg.content,
                        "is_user": not msg.is_bot,
                        "timestamp": msg.created_at.isoformat(),
                    }
                    for msg in messages
                ]
            return []
        except Exception as e:
            print(f"채팅 히스토리 로드 중 오류: {e}")
            return []

    @database_sync_to_async
    def save_message_and_get_response(self, message, session_id):
        # 사용자 메시지 저장
        try:
            # session_id가 있으면 해당 세션을 사용하고, 없으면 self.room_name(URL의 세션 ID)을 사용
            session_id_to_use = session_id if session_id else self.room_name

            # room_name 필드 제거하고 id로 세션 찾기
            try:
                session = ChatSession.objects.get(id=session_id_to_use)
                created = False
            except ChatSession.DoesNotExist:
                # 세션이 없으면 새로 생성
                session = ChatSession.objects.create(
                    user=self.user, title=f"새 채팅 {self.user.username}"
                )
                created = True

            ChatMessage.objects.create(session=session, content=message, is_bot=False)
            return session, created
        except Exception as e:
            print(f"메시지 저장 중 오류: {e}")
            # 오류 발생 시 기본적으로 새 세션 생성
            session = ChatSession.objects.create(
                user=self.user, title=f"오류 복구 채팅 {self.user.username}"
            )
            ChatMessage.objects.create(session=session, content=message, is_bot=False)
            return session, True

    @database_sync_to_async
    def save_bot_response(self, session, response):
        ChatMessage.objects.create(session=session, content=response, is_bot=True)

    @database_sync_to_async
    def get_user_from_username(self, username):
        try:
            return User.objects.get(username=username)
        except User.DoesNotExist:
            return None
