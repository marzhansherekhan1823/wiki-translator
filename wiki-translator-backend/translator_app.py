from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import re
import torch

MODEL_NAME = "Helsinki-NLP/opus-mt-en-trk"
TGT_TOKEN = ">>kaz_Cyrl<<"   # Kazakh Cyrillic token required by this model

app = FastAPI(title="EN→KK Translator (OPUS-MT en-trk)")

class Req(BaseModel):
    text: str

device = "cpu"
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME).to(device)
model.eval()

def split_sentences(text: str):
    return [s for s in re.split(r'(?<=[.!?])\s+', text.strip()) if s]

def make_chunks(text: str, max_chars: int = 1200):
    text = text.replace("\r\n", "\n").strip()
    if not text:
        return []
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    chunks = []
    for para in paragraphs:
        buf = ""
        for s in split_sentences(para):
            if len(s) > max_chars:
                if buf:
                    chunks.append(buf.strip()); buf = ""
                for i in range(0, len(s), max_chars):
                    chunks.append(s[i:i+max_chars].strip())
                continue
            if len(buf) + len(s) + 1 <= max_chars:
                buf = (buf + " " + s).strip()
            else:
                if buf:
                    chunks.append(buf.strip())
                buf = s.strip()
        if buf:
            chunks.append(buf.strip())
    return chunks

def translate_batch(texts, max_new_tokens=256):
    # IMPORTANT: add target language token required by model
    texts = [f"{TGT_TOKEN} {t}" for t in texts]

    inputs = tokenizer(
        texts,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=512
    ).to(device)

    with torch.no_grad():
        out = model.generate(**inputs, num_beams=1, max_new_tokens=max_new_tokens)

    return tokenizer.batch_decode(out, skip_special_tokens=True)

@app.post("/translate")
def translate(req: Req):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    chunks = make_chunks(text, max_chars=1200)
    if not chunks:
        return {"translated": ""}

    translated_parts = []
    batch_size = 6
    for i in range(0, len(chunks), batch_size):
        translated_parts.extend(translate_batch(chunks[i:i+batch_size]))

    return {"translated": "\n\n".join(t.strip() for t in translated_parts if t.strip())}