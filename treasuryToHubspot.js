const axios = require('axios');
const Papa = require('papaparse');
const cheerio = require('cheerio');

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const CONTACT_ID = process.env.CONTACT_ID;
const PROPERTY_NAME = 'rate';

async function fetchCSV() {
  const url = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2025/all?type=daily_treasury_yield_curve&field_tdr_date_value=2025&page&_format=csv';
  const response = await axios.get(url);
  return response.data;
}

function extractRate(csvText) {
  const parsed = Papa.parse(csvText, { skipEmptyLines: true });
  const [header, latest] = parsed.data;
  const threeMonth = parseFloat(latest[3]);
  return {
    rate: `${threeMonth.toFixed(2)}%`,
    date: new Date(latest[0]).getTime()
  };
}

async function fetchMs7DayRate() {
  const url = 'https://www.morganstanley.com/im/en-us/individual-investor/product-and-performance/mutual-funds/taxable-fixed-income/ultra-short-income-portfolio.shareClass.IR.html';
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  let rate = null;

  // Find the table row with the label and get the next cell's text
  $('tr').each((i, el) => {
    const label = $(el).find('td.name').text().trim();
    if (label.startsWith('7-Day Current Yield Subsidized')) {
      rate = $(el).find('td.data').text().trim();
      return false; // break loop
    }
  });

  if (!rate) throw new Error('7-day subsidized yield not found!');
  return rate;
}

async function updateHubDB(rate, date, ms7DayRate) {
  const tableId = '119957807';
  const url = `https://api.hubapi.com/hubdb/api/v2/tables/${tableId}/rows`;

  const headers = {
    Authorization: `Bearer ${HUBSPOT_TOKEN}`,
    'Content-Type': 'application/json'
  };

  const getRes = await axios.get(url, { headers });
  const rows = getRes.data.objects;

  const payload = {
    values: {
      '1': rate,
      '2': date,
      '3': ms7DayRate // Make sure '3' matches your new column ID in HubDB
    }
  };

  if (rows.length > 0) {
    const rowId = rows[0].id;
    const updateUrl = `${url}/${rowId}`;
    await axios.patch(updateUrl, payload, { headers });
    console.log(`✅ Updated HubDB row ${rowId}: rate = ${rate}, date = ${date}, ms_7_day_rate = ${ms7DayRate}`);
  } else {
    const createRes = await axios.post(url, payload, { headers });
    console.log(`✅ Created new HubDB row ${createRes.data.id}: rate = ${rate}, date = ${date}, ms_7_day_rate = ${ms7DayRate}`);
  }
}

(async () => {
  try {
    const csv = await fetchCSV();
    const { rate, date } = extractRate(csv);
    const ms7DayRate = await fetchMs7DayRate();
    await updateHubDB(rate, date, ms7DayRate);
  } catch (err) {
    console.error("❌ HubSpot update failed:", {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message
    });
  }
})();
