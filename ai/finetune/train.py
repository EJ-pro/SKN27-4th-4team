"""
OpenAI Fine-tuning 실행
실행: python ai/finetune/train.py
"""
import os
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

TRAIN_FILE = Path(__file__).parent / "data" / "train.jsonl"


def upload_and_finetune(model: str = "gpt-4o-mini-2024-07-18"):
    # 1. 학습 파일 업로드
    with open(TRAIN_FILE, "rb") as f:
        upload = client.files.create(file=f, purpose="fine-tune")
    print(f"[INFO] 파일 업로드 완료: {upload.id}")

    # 2. Fine-tuning 잡 생성
    job = client.fine_tuning.jobs.create(
        training_file=upload.id,
        model=model,
    )
    print(f"[INFO] Fine-tuning 잡 시작: {job.id}")
    print(f"[INFO] 상태 확인: https://platform.openai.com/finetune/{job.id}")
    return job.id


if __name__ == "__main__":
    upload_and_finetune()
