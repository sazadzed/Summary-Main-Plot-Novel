# StoryMind — Kế hoạch nâng cấp (chưa code)

Repo: `sazadzed/Summary-Main-Plot-Novel` · Ngày lập: 2026-11-14

---

## 1. Chẩn đoán: vì sao tóm tắt "chán"

Vấn đề không nằm ở giao diện. **App hiện tại không tóm tắt gì cả.** Nó dò từ khoá rồi in ra nhãn có sẵn. Chi tiết (đường dẫn theo repo):

| # | Chỗ | Đang làm gì | Hậu quả |
|---|-----|-------------|---------|
| 1 | `Front End/app.py` `_build_summary` | Ghép 10 dòng kiểu `Setting: X`, `Tone: Y`, `Characters: A, B` | Không có câu nào kể **chuyện gì đã xảy ra**. Đây là lỗi gốc. |
| 2 | `_detect_tone/_setting/_conflict/_ending/_extract_lore` | `if "từ" in lower` (so chuỗi con) rồi trả về nhãn cố định | `"old"` khớp `told/bold/hold` nên gần như chương nào cũng ra "Historical Lore". `"trust"` → "Betrayal". `"will"` → "Determined". `"home"` → "Nostalgic". Nhãn sai, chung chung, chương nào cũng giống nhau. |
| 3 | `_build_character_cards` | Tính **một** cảm xúc cho cả văn bản rồi gán cho mọi nhân vật. Vai trò xét theo thứ tự tần suất (người thứ 1 = "Protagonist", người thứ 2 = "Ally / Antagonist") | Thẻ nhân vật toàn đồ giả. `relationships` luôn là "nature TBD". |
| 4 | `_extract_beats` | Lấy **15 câu đầu** nguyên văn làm timeline (JS fallback lấy 12) | Phần còn lại của chương bị bỏ qua hoàn toàn, kể cả cao trào và kết. |
| 5 | `_regex_names` | Từ viết hoa xuất hiện ≥2 lần = tên nhân vật | Các từ đứng đầu câu như "When", "After", "Then" thành nhân vật, lại được cộng điểm ưu tiên (+2). |
| 6 | spaCy `en_core_web_sm` | Chỉ hiểu tiếng Anh | Truyện tiếng Việt/convert thì NER gần như vô dụng. |
| 7 | Không có trí nhớ giữa các chương | Mỗi chương phân tích riêng lẻ | Tên repo là "Summary **Main Plot** Novel" nhưng app không bao giờ biết cốt truyện chính. |
| 8 | `Back End/app.js` `clientSideGenerate` | Viết lại cùng bộ heuristic đó bằng JS | Hai bản copy của cùng một logic tệ, phải bảo trì cả hai. |

Lỗi vặt (sửa luôn khi đụng tới): tên thư mục bị đảo (`Front End/` chứa backend, `Back End/` chứa frontend). `app.py` parse doc 2 lần (dòng `sentences = _build_doc(raw_text)` thừa). SPEC ghi "No backend", mâu thuẫn với README. README dùng đường dẫn Windows của máy cũ. Văn bản bị cắt ở 10.000 từ.

**Kết luận:** chỉnh thêm regex hay đổi model spaCy cũng không cứu được. Muốn có bản tóm tắt thật thì phải có thứ *đọc hiểu* được văn bản, tức là một LLM.

---

## 2. Hướng nâng cấp (một câu)

Thay toàn bộ engine heuristic bằng **một lệnh gọi Claude API có structured output** ở backend. Lệnh gọi trả về **đúng schema JSON mà frontend đang render**, cộng thêm vài field mới. Sau đó thêm **"story so far"** để nối các chương lại thành cốt truyện chính.

Lý do chọn cách này thay vì cách to hơn:
- Chương truyện (5–20k từ) nằm gọn trong context 1M token, nên **không cần chunking/map-reduce, không cần vector DB, không cần RAG**.
- Giữ schema cũ thì `renderOutput()` và `doExport()` gần như không phải sửa.
- Xoá được khoảng 400 dòng heuristic Python + khoảng 200 dòng JS fallback, bỏ được dependency spaCy. Code **ít đi**, không nhiều lên.

---

## 3. Các phase

### Phase 0 — Bộ đo chất lượng (làm trước, ~1 giờ)
Không có cái này thì không biết sửa xong có "hết chán" thật không.
- Thư mục `eval/`: 3–5 chương thật bạn hay đọc, **trộn tiếng Việt và tiếng Anh**, gồm 1 chương dài (>15k từ) và 1 chương liền sau chương khác (để thử Phase 3).
- Mỗi chương một file `*.check.md` bạn tự viết: 5–8 sự kiện bắt buộc phải có, các nhân vật chính và quan hệ đúng, cái kết chương thực sự là gì.
- Chấm tay theo 4 tiêu chí, mỗi tiêu chí 0–2 điểm: **Đủ sự kiện · Đúng (không bịa) · Nhân vật/quan hệ đúng · Đọc có thấy thích không**.
- Chạy bản cũ một lần để lấy điểm gốc. Mỗi lần sửa prompt thì chạy lại.

### Phase 1 — Engine LLM (lõi, giải quyết chính vấn đề)

**Backend (`app.py`, viết lại gọn):**
1. Xoá hết `_detect_*`, `_extract_*`, `_build_*`, `_regex_names`, các bảng từ khoá, và spaCy.
2. Định nghĩa schema bằng Pydantic, giữ nguyên tên field cũ:
   - `overall_summary`: giữ `bullets, tone, conflict, ending_type, setting`, **thêm** `logline` (1–2 câu) và `narrative` (2–4 đoạn văn kể lại chương, có nhân quả).
   - `timeline.plot_beats[]`: `beat_number, type, characters, text`, **thêm** `evidence` (trích nguyên văn ngắn để chống bịa) và `significance` (vì sao beat này quan trọng). Phủ **cả chương**, 6–15 beat tuỳ độ dài.
   - `characters.cards[]`: `name, role, emotional_state, key_actions, relationships`, trong đó cảm xúc và quan hệ **riêng cho từng nhân vật**, và thêm `change_in_chapter` (nhân vật thay đổi thế nào trong chương).
   - `lore.items[]`: `category, detail`, chỉ ghi khi văn bản thực sự có.
   - **Mới:** `open_threads[]` (bí ẩn hoặc lời hứa chưa giải quyết), `key_quotes[]`, `foreshadowing[]`.
   - Bỏ `top_verbs`, `entities.objects`, `sentiment.score` (chỉ là số trang trí).
3. Gọi API theo kiểu sau (Python SDK `anthropic`, cú pháp đã đối chiếu tài liệu skill):
   ```python
   client.messages.parse(model="claude-opus-5-5", max_tokens=16000,
       output_config={"effort": "medium"},
       system=SYSTEM_PROMPT, messages=[...], output_format=KnowledgePackage)
   ```
   Chương rất dài hoặc output lớn thì dùng streaming + `get_final_message()`. Bật `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) để xử lý `stop_reason == "refusal"`. Truyện có bạo lực/18+ có thể gặp trường hợp này, và frontend phải hiện được lý do.
4. **Ranh giới tin cậy (không được cắt):**
   - API key chỉ đọc từ biến môi trường `ANTHROPIC_API_KEY` ở server, **không bao giờ** đưa lên trình duyệt.
   - Giới hạn input (ví dụ ≤ 200k ký tự, quá thì báo lỗi rõ ràng, không cắt lặng lẽ).
   - Bắt lỗi theo chuỗi: `RateLimitError` → 429, `APIStatusError` → 502 kèm thông báo, `APIConnectionError` → 503.
   - CORS chỉ cho phép origin local, không để mở `*`.
5. Cho phép chọn **ngôn ngữ đầu ra** (`"vi"` / `"en"` / `"giữ ngôn ngữ gốc"`), gửi qua field `output_language` trong request.

**Prompt hệ thống, bản nháp** (đây là chỗ quyết định 80% chất lượng):
```
You are a literary analyst producing a knowledge package for one novel chapter.
Rules:
- Narrate WHAT HAPPENS and WHY: causes, decisions, consequences. No generic labels.
- Cover the whole chapter in order; the ending matters most.
- Every plot beat cites a short verbatim quote in `evidence`. If something is
  implied but not stated, say "implied". Never invent events, names or motives.
- Per-character emotional state and relationships must come from this chapter.
- If "story so far" is given, use it only for context; mark what is NEW here
  and update open threads (resolved / still open / new).
- Write in {output_language}. Keep character names exactly as in the source.
- Be specific and vivid; a reader who skipped the chapter should not miss anything important.
```
Mỗi lần sửa prompt thì chạy lại Phase 0 để so điểm.

**Frontend (`app.js`):**
- Xoá `clientSideGenerate` và các hàm `detect*`. Khi backend offline thì hiện lỗi rõ ràng ("Backend chưa chạy / thiếu API key") thay vì trả về kết quả giả.
- `renderOutput()`: thêm block `logline` + `narrative` ở đầu folder Summary, thêm `evidence` dưới mỗi beat, thêm folder `05_OPEN_THREADS` thay cho folder Verb Analysis.
- `doExport()`: thêm các field mới. Nên có thêm export `.md` (dễ dán vào Notion hoặc Obsidian).
- Bỏ animation giả 2.5 giây. Hiện trạng thái thật (đang gửi → đang phân tích → xong).

**Kiểm tra:** một file `test_app.py` mock client Anthropic, khẳng định response `/api/analyze` có đủ các key mà `renderOutput()` đọc. Cộng thêm điểm Phase 0 phải tăng rõ rệt so với bản cũ.

### Phase 2 — Trí nhớ giữa các chương ("Main Plot")
Đây là phần biến app từ "tóm tắt 1 chương" thành "theo dõi cốt truyện", đúng như tên repo.
- Thêm vào response field `story_state`: tóm tắt cốt truyện đến hết chương này (≤ 400 từ), danh sách nhân vật kèm trạng thái hiện tại, và `open_threads`.
- Frontend lưu `story_state` của lần chạy trước vào `localStorage` (bọc try/catch), có nút **"Tiếp tục từ chương trước"** và nút tải/nạp file `story_state.json` (để không mất dữ liệu khi xoá cache).
- Request tiếp theo gửi kèm `story_so_far`. Model cập nhật state và đánh dấu thread nào đã giải quyết, thread nào mới.
- Không cần DB: chỉ một người dùng, một bộ truyện mỗi lần. *Nâng cấp khi*: cần lưu nhiều bộ truyện thì mới thêm SQLite.

### Phase 3 — Dọn dẹp (làm cùng lúc với Phase 1)
- Đổi tên thư mục: `backend/app.py`, `frontend/{index.html,app.js,style.css}`.
- `requirements.txt`: `flask`, `flask-cors`, `anthropic`, `pydantic`. Bỏ spaCy.
- Viết lại README (cách chạy, biến môi trường, chi phí) và sửa SPEC mục 6 cho đúng kiến trúc mới.

---

## 4. Chi phí & lựa chọn model (bạn quyết)

Ước tính cho chương 5.000 từ, khoảng 7k token vào và khoảng 3k token ra (chưa tính token suy nghĩ):

| Model | ~ $/chương | Ghi chú |
|-------|-----------|---------|
| `claude-opus-5-5` (mặc định đề xuất) | ~$0.09 | Chất lượng văn tốt nhất, đáng dùng cho truyện |
| `claude-sonnet-5-5` | ~$0.045 | Nếu đọc nhiều chương mỗi ngày |
| `claude-haiku-5-5` | ~$0.002 | Rẻ, nhưng tóm tắt sẽ phẳng hơn, nên kiểm bằng Phase 0 trước |

Có thể để chọn model ngay trên UI (một dropdown, chỉ là 1 field trong request).

---

## 5. Thứ tự làm & tiêu chí xong

1. Phase 0: có bộ eval + điểm gốc của bản cũ.
2. Phase 1 + 3: engine LLM, xoá heuristic, dọn repo. **Xong khi** điểm eval trung bình ≥ 6/8 và không còn chương nào có sự kiện bịa.
3. Phase 2: story state. **Xong khi** chạy 2 chương liên tiếp mà chương 2 nhắc đúng thread của chương 1.

## 6. Cố ý KHÔNG làm (và khi nào mới cần)
- Chunking / map-reduce: chỉ cần khi một lần phân tích cả cuốn sách hơn 500k từ.
- Vector DB / RAG: chỉ cần khi muốn hỏi đáp trên cả trăm chương.
- Đăng nhập, multi-user, deploy công khai: hiện là tool cá nhân. Nếu deploy thì **bắt buộc** thêm auth + rate limit, vì API key là tiền của bạn.
- Giữ spaCy làm "fallback offline": nó chính là thứ làm kết quả chán, giữ lại chỉ thêm code bảo trì.
