/**
 * P31 Collective: website applications → this Google Sheet.
 *
 * Every "Join P31 Collective" application sent from thep31collective.org/join is added as a
 * new row here, right after the last person already in the sheet, and shaded purple so
 * website applications stand out. Answers are matched to this sheet's column headings by
 * question (e.g. "First and Last Name", "Email Address"), so an existing sheet keeps its
 * layout. Anything the sheet has no column for gets a new column at the end.
 *
 * Set up once, signed in to the Google account that owns P31's sheet (or one with edit access):
 *   1. Open the sheet → Extensions → Apps Script. Delete what's there and paste this whole file.
 *   2. Change TOKEN below to a long random phrase only you know (letters and numbers, 30+ characters).
 *      If the rows should go to a specific tab, put its name in SHEET_NAME.
 *   3. Save, then Deploy → New deployment → type "Web app".
 *      Execute as: Me.  Who has access: Anyone.  Deploy, and allow access when Google asks.
 *   4. Copy the Web app URL (ends in /exec). In Supabase → Edge Functions → Secrets add:
 *        JOIN_SHEET_URL   = that URL
 *        JOIN_SHEET_TOKEN = the same phrase as TOKEN
 * "Anyone" only means the website can reach it: without the token it adds nothing.
 */
const TOKEN = 'CHANGE-ME-to-a-long-random-phrase';
const SHEET_NAME = ''; // the tab to add rows to; leave '' for the first tab
const WEBSITE_COLOR = '#E9DAFB'; // shading for rows that came from the website; '' for none

// Other headings a sheet might use for the same question.
const ALIASES = {
  'first and last name': ['name', 'full name', 'first and last name'],
  'name of your business or ministry': ['business', 'business name', 'business or ministry', 'ministry'],
  'email address': ['email', 'e mail'],
  'phone number': ['phone', 'phone number', 'cell', 'mobile'],
  'city state': ['city', 'city state', 'location'],
  'birthday month day': ['birthday', 'birth date', 'date of birth'],
  'social media handle s': ['social media', 'socials', 'instagram', 'social media handles'],
  'timestamp': ['timestamp', 'date', 'submitted'],
};

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!TOKEN || TOKEN.indexOf('CHANGE-ME') === 0 || body.token !== TOKEN) return reply({ ok: false, error: 'token' });
    const row = body.row || {};
    const keys = Object.keys(row);
    lock.waitLock(20000);

    const book = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = SHEET_NAME ? book.getSheetByName(SHEET_NAME) : book.getSheets()[0];
    if (!sheet) return reply({ ok: false, error: 'no tab named ' + SHEET_NAME });
    if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, keys.length).setValues([keys]);

    // Match each answer to a column heading; anything unmatched gets a new column at the end.
    const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(String);
    const used = {};
    const cells = []; // [column number, value]
    headers.forEach((heading, i) => {
      const h = norm(heading);
      if (!h) return;
      const k = keys.find((x) => !used[x] && norm(x) === h)
        || keys.find((x) => !used[x] && (ALIASES[norm(x)] || []).indexOf(h) !== -1);
      if (!k) return;
      used[k] = true;
      cells.push([i + 1, row[k]]);
    });
    keys.filter((k) => !used[k]).forEach((k) => {
      headers.push(k);
      sheet.getRange(1, headers.length).setValue(k);
      cells.push([headers.length, row[k]]);
    });

    // The row right after the last person in the sheet. Only the answer columns are checked,
    // so formatting, checkboxes or formulas further down don't push new people to the bottom.
    const target = nextRow(sheet, cells.map((c) => c[0]));
    cells.forEach((c) => sheet.getRange(target, c[0]).setValue(c[1]));
    if (WEBSITE_COLOR) sheet.getRange(target, 1, 1, headers.length).setBackground(WEBSITE_COLOR);
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) { /* not held */ }
  }
}

function nextRow(sheet, cols) {
  const last = sheet.getLastRow();
  if (last < 2) return 2;
  const first = Math.min.apply(null, cols);
  const width = Math.max.apply(null, cols) - first + 1;
  const data = sheet.getRange(2, first, last - 1, width).getDisplayValues();
  for (let r = data.length - 1; r >= 0; r--) {
    if (cols.some((c) => String(data[r][c - first]).trim() !== '')) return r + 3;
  }
  return 2;
}

// Open the web app URL in a browser to check it's live.
function doGet() {
  return reply({ ok: true, ready: TOKEN.indexOf('CHANGE-ME') !== 0 });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
