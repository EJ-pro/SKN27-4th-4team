"""
Fine-tuning 학습 데이터 준비
실행: python ai/finetune/dataset.py
출력: ai/finetune/data/train.jsonl
"""
import json
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "data"
OUTPUT_DIR.mkdir(exist_ok=True)


def build_training_sample(user_message: str, assistant_response: str) -> dict:
    """OpenAI fine-tuning 포맷 (chat completions)"""
    return {
        "messages": [
            {"role": "system", "content": "당신은 전문 피트니스 트레이너입니다."},
            {"role": "user", "content": user_message},
            {"role": "assistant", "content": assistant_response},
        ]
    }


def main():
    # TODO: DB 또는 JSON에서 실제 대화 데이터 로드
    samples = []

    output_path = OUTPUT_DIR / "train.jsonl"
    with open(output_path, "w", encoding="utf-8") as f:
        for sample in samples:
            f.write(json.dumps(sample, ensure_ascii=False) + "\n")

    print(f"[INFO] 학습 데이터 생성 완료: {len(samples)}개 → {output_path}")


if __name__ == "__main__":
    main()
