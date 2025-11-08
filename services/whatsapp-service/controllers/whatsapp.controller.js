const {
  sendTestTemplate,
  sendAppointmentReminder,
} = require('../services/whatsapp.sender');

async function sendTest(req, res) {
  try {
    const { phone } = req.body; // ej: 52155XXXXXXXX
    if (!phone) return res.status(400).json({ error: 'PHONE_REQUIRED' });

    const data = await sendTestTemplate(phone);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err });
  }
}

async function sendReminder(req, res) {
  try {
    const { phone, patientName, date, time } = req.body;
    if (!phone || !patientName || !date || !time) {
      return res.status(400).json({ error: 'MISSING_FIELDS' });
    }

    const data = await sendAppointmentReminder({ to: phone, patientName, date, time });
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err });
  }
}

module.exports = {
  sendTest,
  sendReminder,
};
