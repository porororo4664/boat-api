const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const cors = require('cors');

const app = express();
app.use(cors());

// ボートレース公式のHTMLはShift_JISなのでバッファをデコードする
async function fetchHTML(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return iconv.decode(Buffer.from(response.data), 'Shift_JIS');
}

// 出走表＆直前情報取得のエンドポイント例
app.api = app.get('/api/race', async (req, res) => {
  const { jhd, rno, date } = req.query; // jhd=場番(01~24), rno=R(1~12), date=日付(YYYYMMDD)
  if (!jhd || !rno) return res.status(400).json({ error: 'jhd and rno required' });

  try {
    // 直前情報ページ（展示タイム・展示ST等）
    const beforeUrl = `https://www.boatrace.jp/owpc/pc/race/beforeinfo?jcd=${jhd}&rno=${rno}${date ? '&hd='+date : ''}`;
    const html = await fetchHTML(beforeUrl);
    const $ = cheerio.load(html);

    const racers = [];
    // 公式サイトの構造に合わせてパース処理を記述
    // ※実際のスクレイピングセレクタは公式のHTML構造に合わせて微調整します
    
    res.json({ success: true, venue: jhd, race: rno, racers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
