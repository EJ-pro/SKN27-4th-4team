from django.http import JsonResponse
from django.views import View
from .models import Exercise

DIFF_NUM = {'초급': 1, '중급': 2, '고급': 3}


class ExerciseListView(View):
    def get(self, request):
        qs = Exercise.objects.values(
            'exercise_id', 'name_kor', 'name_eng', 'category',
            'target_primary', 'target_secondary', 'equipment',
            'difficulty', 'guide', 'caution',
        )
        results = [
            {
                'id': ex['exercise_id'],
                'name_kor': ex['name_kor'],
                'name_eng': ex['name_eng'] or '',
                'category': ex['category'],
                'target_primary': ex['target_primary'],
                'target_secondary': ex['target_secondary'],
                'equipment': ex['equipment'] or '',
                'difficulty': DIFF_NUM.get(ex['difficulty'], 1),
                'guide': ex['guide'],
                'caution': ex['caution'],
            }
            for ex in qs
        ]
        return JsonResponse(results, safe=False)
