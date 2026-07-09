#!/usr/bin/env python3
"""Convert recruit-jp typo detector to ONNX for browser (Transformers.js)."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "proof" / "models"
MODEL_ID = "recruit-jp/japanese-typo-detector-roberta-base"
TMP = ROOT / "scripts" / ".cache" / "proof-model"


def run(cmd: list[str]) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


def write_tokenizer_json(vocab_path: Path, dest: Path) -> None:
    vocab = [line.strip() for line in vocab_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    tokenizer_json = {
        "version": "1.0",
        "truncation": None,
        "padding": None,
        "added_tokens": [
            {"id": 0, "content": "<s>", "single_word": False, "lstrip": False, "rstrip": False, "normalized": False, "special": True},
            {"id": 1, "content": "<pad>", "single_word": False, "lstrip": False, "rstrip": False, "normalized": False, "special": True},
            {"id": 2, "content": "</s>", "single_word": False, "lstrip": False, "rstrip": False, "normalized": False, "special": True},
            {"id": 3, "content": "<unk>", "single_word": False, "lstrip": False, "rstrip": False, "normalized": False, "special": True},
        ],
        "normalizer": None,
        "pre_tokenizer": {"type": "Split", "pattern": {"Regex": "."}, "behavior": "Isolated", "invert": False},
        "post_processor": {
            "type": "RobertaProcessing",
            "sep": ["</s>", 2],
            "cls": ["<s>", 0],
            "trim_offsets": True,
            "add_prefix_space": False,
        },
        "decoder": {"type": "ByteLevel", "add_prefix_space": False, "trim_offsets": True},
        "model": {
            "type": "WordPiece",
            "unk_token": "<unk>",
            "continuing_subword_prefix": "",
            "max_input_chars_per_word": 100,
            "vocab": {tok: i for i, tok in enumerate(vocab)},
        },
    }
    dest.write_text(json.dumps(tokenizer_json, ensure_ascii=False), encoding="utf-8")


def main() -> int:
  try:
    from optimum.onnxruntime import ORTQuantizer
    from optimum.onnxruntime.configuration import AutoQuantizationConfig
    from transformers import AutoTokenizer
  except ImportError:
    print("Missing deps. Run: pip install optimum[onnxruntime] transformers torch sentencepiece", file=sys.stderr)
    return 1

  if TMP.exists():
    shutil.rmtree(TMP)
  TMP.mkdir(parents=True, exist_ok=True)

  run([
    "optimum-cli", "export", "onnx",
    "--model", MODEL_ID,
    "--task", "token-classification",
    str(TMP / "fp32"),
  ])

  quantizer = ORTQuantizer.from_pretrained(TMP / "fp32")
  qconfig = AutoQuantizationConfig.avx512_vnni(is_static=False, per_channel=False)
  quant_dir = TMP / "q8"
  quantizer.quantize(save_dir=quant_dir, quantization_config=qconfig)

  tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
  tokenizer.save_pretrained(quant_dir)
  write_tokenizer_json(quant_dir / "vocab.txt", quant_dir / "tokenizer.json")

  if OUT.exists():
    shutil.rmtree(OUT)
  OUT.mkdir(parents=True)
  onnx_dir = OUT / "onnx"
  onnx_dir.mkdir()

  for name in ("config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "vocab.txt"):
    shutil.copy2(quant_dir / name, OUT / name)

  shutil.copy2(quant_dir / "model_quantized.onnx", onnx_dir / "model_quantized.onnx")

  size_mb = (onnx_dir / "model_quantized.onnx").stat().st_size / (1024 * 1024)
  print(f"Done: {OUT} ({size_mb:.1f} MB ONNX)")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
