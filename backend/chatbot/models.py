from django.db import models
from vacation.settings import AUTH_USER_MODEL  # AUTH USER MODEL 불러오기
from django.contrib.auth.models import User
from django.conf import settings  # settings import 추가

# Create your models here.
class Chat(models.Model):
    user = models.ForeignKey(
        AUTH_USER_MODEL, on_delete=models.CASCADE
    )  # 채팅 참여자, 비회원 또한 채팅 참여 가능
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class ChatSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    session_id = models.CharField(max_length=100, null=True, blank=True)  # null 허용
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s chat - {self.title}"


class ChatMessage(models.Model):
    session = models.ForeignKey(
        ChatSession, related_name="messages", on_delete=models.CASCADE
    )
    content = models.TextField()
    is_bot = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{'Bot' if self.is_bot else 'User'}: {self.content[:50]}..."


# 원본 문서 모델
class NaverBlog(models.Model):
    line_number = models.IntegerField(primary_key=True)  # 원본 문서 라인 번호
    page_content = models.TextField()
    url = models.TextField()


class NaverBlogFaiss(models.Model):  # 청크로 인해 달라진 id 맞춰줌
    faiss_index = models.IntegerField(primary_key=True)  # 벡터 인덱스
    line_number = models.ForeignKey(NaverBlog, on_delete=models.CASCADE)


class Event(models.Model):
    faiss_index = models.IntegerField(
        primary_key=True
    )  # 벡터 인덱스 = 원본 문서 라인 번호
    tag = models.TextField()
    title = models.TextField()
    time = models.TextField()
    location = models.TextField()
    address = models.TextField()
    address_detail = models.TextField()
    content = models.TextField()
    atmosphere = models.TextField()
    companions = models.TextField()