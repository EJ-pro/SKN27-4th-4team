from django.db import models

FITNESS_LEVEL = [('초급', '초급'), ('중급', '중급'), ('고급', '고급')]
SENDER = [('user', 'user'), ('bot', 'bot')]
RELATION_TYPE = [('synergist', 'synergist'), ('antagonist', 'antagonist'), ('part_of', 'part_of')]
ROLE = [('primary', 'primary'), ('secondary', 'secondary')]


class AppUser(models.Model):
    user_id = models.AutoField(primary_key=True)
    email = models.CharField(max_length=255, unique=True)
    password_hash = models.CharField(max_length=255)
    nickname = models.CharField(max_length=50)
    fitness_level = models.CharField(max_length=10, choices=FITNESS_LEVEL, default='초급')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'users'


class UserPainLog(models.Model):
    pain_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(AppUser, on_delete=models.CASCADE, db_column='user_id')
    body_part = models.CharField(max_length=50)
    severity = models.SmallIntegerField()
    logged_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'user_pain_logs'


class Exercise(models.Model):
    exercise_id = models.IntegerField(primary_key=True)
    name_kor = models.CharField(max_length=100)
    name_eng = models.CharField(max_length=100, null=True, blank=True)
    category = models.CharField(max_length=50)
    target_primary = models.CharField(max_length=100, null=True, blank=True)
    target_secondary = models.JSONField(null=True, blank=True)
    equipment = models.CharField(max_length=50, null=True, blank=True)
    difficulty = models.CharField(max_length=10, choices=FITNESS_LEVEL, default='초급')
    default_duration_min = models.IntegerField(default=10)
    video_url = models.CharField(max_length=500, null=True, blank=True)
    guide = models.TextField(null=True, blank=True)
    caution = models.TextField(null=True, blank=True)
    # embedding vector(1536) — 벡터 유사도 검색은 raw SQL로 처리

    class Meta:
        managed = False
        db_table = 'exercises'


class ChatSession(models.Model):
    session_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(AppUser, on_delete=models.CASCADE, db_column='user_id', null=True, blank=True)
    device_uuid = models.UUIDField(null=True, blank=True)
    title = models.CharField(max_length=100, default='새 상담')
    extracted_conditions = models.JSONField(null=True, blank=True)
    is_converted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'chat_sessions'


class ChatMessage(models.Model):
    message_id = models.AutoField(primary_key=True)
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, db_column='session_id')
    sender = models.CharField(max_length=10, choices=SENDER)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'chat_messages'


class WeeklyScheduler(models.Model):
    scheduler_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(AppUser, on_delete=models.CASCADE, db_column='user_id')
    session = models.ForeignKey(
        ChatSession, on_delete=models.SET_NULL,
        null=True, blank=True, db_column='session_id'
    )
    year = models.IntegerField()
    week_number = models.IntegerField()
    weekly_review = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'weekly_schedulers'


class DailyRoutine(models.Model):
    daily_routine_id = models.AutoField(primary_key=True)
    scheduler = models.ForeignKey(WeeklyScheduler, on_delete=models.CASCADE, db_column='scheduler_id')
    exercise = models.ForeignKey(
        Exercise, on_delete=models.DO_NOTHING,
        null=True, blank=True, db_column='exercise_id'
    )
    scheduled_date = models.DateField()
    # day_of_week: DB GENERATED ALWAYS AS 컬럼 — 직접 수정 불가, scheduled_date 변경 시 자동 갱신
    day_of_week = models.CharField(max_length=3, editable=False)
    routine_order = models.FloatField()
    recommended_sets = models.IntegerField(default=4)
    recommended_reps = models.IntegerField(default=10)
    target_sets = models.IntegerField(default=4)
    target_reps = models.IntegerField(default=10)
    is_custom_added = models.BooleanField(default=False)
    is_completed = models.BooleanField(default=False)
    daily_issue = models.TextField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        managed = False
        db_table = 'daily_routines'


class Muscle(models.Model):
    muscle_id = models.AutoField(primary_key=True)
    name_kor = models.CharField(max_length=60, unique=True)
    name_eng = models.CharField(max_length=100)
    muscle_group = models.CharField(max_length=30)
    action_text = models.TextField(null=True, blank=True)
    origin = models.TextField(null=True, blank=True)
    insertion = models.TextField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'muscles'


class MuscleRelation(models.Model):
    relation_id = models.AutoField(primary_key=True)
    source_muscle = models.ForeignKey(
        Muscle, on_delete=models.CASCADE,
        db_column='source_muscle', related_name='outgoing'
    )
    target_muscle = models.ForeignKey(
        Muscle, on_delete=models.CASCADE,
        db_column='target_muscle', related_name='incoming'
    )
    relation_type = models.CharField(max_length=12, choices=RELATION_TYPE)

    class Meta:
        managed = False
        db_table = 'muscle_relations'


class ExerciseMuscle(models.Model):
    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE, db_column='exercise_id')
    muscle = models.ForeignKey(Muscle, on_delete=models.CASCADE, db_column='muscle_id')
    role = models.CharField(max_length=10, choices=ROLE)

    class Meta:
        managed = False
        db_table = 'exercise_muscles'
