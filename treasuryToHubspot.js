const axios = require('axios');
const Papa = require('papaparse');

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const CONTACT_ID = process.env.CONTACT_ID;
const PROPERTY_NAME = 'current_treasury_rate';

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

async function updateHubspot(rate) {
  const url = `https://api.hubapi.com/crm/v3/objects/contacts/${CONTACT_ID}`;
  const payload = {
    properties: {
      [PROPERTY_NAME]: rate
    }
  };

  const headers = {
    Authorization: `Bearer ${HUBSPOT_TOKEN}`,
    'Content-Type': 'application/json'
  };

  await axios.patch(url, payload, { headers });
  console.log(`✅ Updated HubSpot: ${PROPERTY_NAME} = ${rate}`);
}

(async () => {
  try {
    const csv = await fetchCSV();
    const { rate, date } = extractRate(csv);
    await updateHubspot(rate);
  } catch (err) {
    console.error("❌ HubSpot update failed:", {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message
    });
  }
})();
