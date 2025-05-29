const axios = require('axios');
const Papa = require('papaparse');

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
    date: latest[0]
  };
}

async function updateHubDB(rate, date) {
  const tableId = '119957807';
  const url = `https://api.hubapi.com/hubdb/api/v2/tables/${tableId}/rows`;

  const headers = {
    Authorization: `Bearer ${HUBSPOT_TOKEN}`,
    'Content-Type': 'application/json'
  };

  // First, check if there are any rows in the table
  const getRes = await axios.get(url, { headers });
  const rows = getRes.data.objects;

  if (rows.length > 0) {
    // Update the first row
    const rowId = rows[0].id;
    const updateUrl = `${url}/${rowId}`;
    const payload = {
      values: {
        [PROPERTY_NAME]: rate,
        date: date
      }
    };

    await axios.patch(updateUrl, payload, { headers });
    console.log(`✅ Updated HubDB row ${rowId}: ${PROPERTY_NAME} = ${rate}, date = ${date}`);
  } else {
    // Create a new row
    const payload = {
      values: {
        [PROPERTY_NAME]: rate,
        date: date
      }
    };

    const createRes = await axios.post(url, payload, { headers });
    console.log(`✅ Created new HubDB row ${createRes.data.id}: ${PROPERTY_NAME} = ${rate}, date = ${date}`);
  }
}

(async () => {
  try {
    const csv = await fetchCSV();
    const { rate, date } = extractRate(csv);
    await updateHubDB(rate, date);
  } catch (err) {
    console.error("❌ HubSpot update failed:", {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message
    });
  }
})();
