const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

// 日本時間（JST）で今日の日付（YYYYMMDD）を作る関数
function getTodayJST() {
  const now = new Date(Date.now() + ((new Date().getTimezoneOffset() + (9 * 60)) * 60 * 1000));
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

async function fetchHTML(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    },
    timeout: 10000
  });
  return response.data;
}

app.get('/api/race', async (req, res) => {
  const { jhd, rno, hd } = req.query;
  if (!jhd || !rno) return res.status(400).json({ success: false, error: 'jhd and rno required' });

  const targetDate = hd || getTodayJST();

  try {
    const listUrl = `https://www.boatrace.jp/owpc/pc/race/racelist?rno=${rno}&jcd=${jhd}&hd=${targetDate}`;
    const beforeUrl = `https://www.boatrace.jp/owpc/pc/race/beforeinfo?rno=${rno}&jcd=${jhd}&hd=${targetDate}`;

    const [listHtml, beforeHtml] = await Promise.all([
      fetchHTML(listUrl),
      fetchHTML(beforeUrl)
    ]);

    const $list = cheerio.load(listHtml);
    const $before = cheerio.load(beforeHtml);

    const racerBodies = $list('.table1 tbody.is-fs12');
    if (racerBodies.length < 6) {
      return res.json({ success: false, date: targetDate, message: '本日は非開催か、データが見つかりません' });
    }

    const racers = [];

    for (let i = 0; i < 6; i++) {
      const body = racerBodies.eq(i);

      const name = body.find('.is-fs18.is-fBold a').text().replace(/\s+/g, ' ').trim() || `選手${i + 1}`;
      const rank = body.find('.is-fs11').first().text().replace(/[^A-B1-2]/g, '').trim() || '-';

      const tds = body.find('tr').first().find('td');
      const stText = tds.eq(3).text().trim().split(/\s+/);
      const avgSt = stText[2] || '-';

      const tourStCell = body.find('tr').eq(3).find('td');
      let tourSt = '-';
      tourStCell.each((_, el) => {
        const txt = $list(el).text().trim();
        if (/^[F\.]\d{2}/.test(txt)) {
          tourSt = txt;
        }
      });

      const beforeRow = $before('.table1').eq(1).find('tbody').eq(i).find('tr').first();
      const exTime = beforeRow.find('td').eq(4).text().trim() || '-';

      let exSt = '-';
      $before('.table1_boatImage1').each((_, el) => {
        const boatNum = $before(el).find('.table1_boatImage1Number').text().trim();
        if (String(boatNum) === String(i + 1)) {
          exSt = $before(el).find('.table1_boatImage1Time').text().trim() || '-';
        }
      });

      racers.push({
        lane: i + 1,
        name,
        rank,
        exTime,
        avgSt,
        tourSt,
        exSt
      });
    }

    res.json({ success: true, date: targetDate, venue: jhd, race: rno, racers });
  } catch (err) {
    res.status(500).json({ success: false, date: targetDate, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
