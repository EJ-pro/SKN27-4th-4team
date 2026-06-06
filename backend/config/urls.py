"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from api.views import ExerciseListView, SessionListView, SessionDetailView, MessageListView, RoutineView

from api.auth_views import CsrfCookieView, RegisterView, LoginView, LogoutView, MeView

urlpatterns = [
    # 기존 API 
    path('admin/', admin.site.urls),
    path('api/exercises/', ExerciseListView.as_view()),
    path('api/sessions/', SessionListView.as_view()),
    path('api/sessions/<int:session_id>/', SessionDetailView.as_view()),
    path('api/sessions/<int:session_id>/messages/', MessageListView.as_view()),
    path('api/routines/', RoutineView.as_view()),

    # 로그인, 인증/인가 API
    path('api/auth/csrf/', CsrfCookieView.as_view()),
    path('api/auth/register/', RegisterView.as_view()),
    path('api/auth/login/', LoginView.as_view()),
    path('api/auth/logout/', LogoutView.as_view()),
    path('api/auth/me/', MeView.as_view()),
]
