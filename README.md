# 音樂學習需求評估問卷

學生填完問卷後，答案會透過 Formspree 寄到老師的 Email。

## 檔案說明

| 檔案 | 用途 | 你常會改嗎 |
|---|---|---|
| `src/questions.js` | 所有題目選項 | ✅ 想改選項就改這裡 |
| `src/config.js` | Formspree 收件網址 | 換收件服務時才改 |
| `src/index.css` | 網站配色與字體 | 想換顏色時改 |
| `src/App.jsx` | 問卷畫面與流程 | 改題目文字時才需要 |

## 在自己電腦上執行

```bash
npm install     # 第一次才需要，安裝套件
npm run dev     # 開啟本機預覽，網址會顯示在終端機
```

## 部署到 GitHub Pages

1. 在 GitHub 建立 repository `music-questionnaire`，用「uploading an existing file」把這個資料夾**裡面**的所有東西（包含 `.github` 和 `src` 資料夾）拖進去，按 Commit changes。
2. 到 repository 的 **Settings → Pages**，把 Source 改成 **GitHub Actions**。
3. 到 **Actions** 分頁，點左邊的「Deploy to GitHub Pages」→ 右邊「Run workflow」。等它出現綠色勾勾。
4. 網址是：`https://你的帳號.github.io/music-questionnaire/`

之後在 GitHub 上修改任何檔案（例如 `src/questions.js`），網站都會自動重新建置更新。

## 送出前要先做的事

第一次正式使用前，自己先填一份，確認 Formspree 有寄 Email 給你。
Formspree 第一次收到資料時，可能會要求你到信箱點確認。
