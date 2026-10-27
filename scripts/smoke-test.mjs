// FPMS end-to-end API smoke test (development seed data). Exits non-zero on the first failed check.
const base = process.argv[2] ?? 'https://localhost:44311';
const PW = 'Fpms@2026';
let failures = 0;

function check(cond, label, extra) {
  if (cond) { console.log(`  ok   ${label}`); return; }
  failures++; console.log(`  FAIL ${label}${extra ? ' — ' + JSON.stringify(extra).slice(0, 400) : ''}`);
}

async function call(method, path, { token, tenantId, body, form, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers['Abp-TenantId'] = String(tenantId);
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(base + path, { method, headers, body: payload });
  if (raw) return res;
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
}

const app = (svc, action) => `/api/services/app/${svc}/${action}`;

async function login(farmCode, user, password = PW) {
  let tenantId = null;
  if (farmCode) {
    const t = await call('POST', app('Account', 'IsTenantAvailable'), { body: { tenancyName: farmCode } });
    tenantId = t.json?.result?.tenantId;
  }
  const r = await call('POST', '/api/TokenAuth/Authenticate', { tenantId, body: { userNameOrEmailAddress: user, password } });
  if (!r.json?.result?.accessToken) console.log(`  (login ${farmCode ?? 'host'}/${user}: tenantId=${tenantId}, ${r.json?.error?.details ?? r.status})`);
  return { tenantId, token: r.json?.result?.accessToken, mustChange: r.json?.result?.shouldChangePassword, status: r.status, json: r.json };
}

(async () => {
  console.log(`FPMS smoke test against ${base}`);
  const health = await call('GET', '/health');
  check(health.status === 200, 'health endpoint');

  // ---- Farm Owner
  const owner = await login('pilot-farm', 'owner');
  check(!!owner.token, 'owner signs in with farm code', owner.json);
  const o = { token: owner.token, tenantId: owner.tenantId };

  const session = await call('GET', app('Session', 'GetCurrentLoginInformations'), o);
  check(session.json?.result?.user?.roleName === 'FarmOwner', 'session reports Farm Owner role', session.json);

  const dash = await call('GET', app('Dashboard', 'Get'), o);
  check(dash.status === 200 && dash.json.result.ponds.length >= 3, 'dashboard loads with pond grid', dash.json?.error);
  check(dash.json?.result?.waterQualityAlerts?.every(a => a.readings?.length > 0 && a.farmDate), 'dashboard water-quality alerts are grouped per pond and day', dash.json?.result?.waterQualityAlerts?.[0]);
  check(Array.isArray(dash.json?.result?.highMortality) && typeof dash.json?.result?.kpis?.blankDailyRecordsYesterday === 'number', 'dashboard has high-mortality and blank-record summaries (DEC-49, DEC-50)', dash.json?.result?.kpis);

  // ---- Pond names and prefixes (step B, conversion 14)
  const pondList = await call('GET', app('Pond', 'GetAll'), o);
  const allPonds = pondList.json?.result ?? [];
  console.log('       ponds: ' + allPonds.map(p => `${p.pondCode}=${p.name}`).join(', '));
  check(allPonds.length > 0 && allPonds.every(p => p.number >= 1 && p.prefixId && /^.+ \d+$/.test(p.name ?? '')), 'every pond has a prefix, a number and a generated name', allPonds);
  const prefixList = await call('GET', app('Pond', 'GetPrefixes'), o);
  const shortCodes = (prefixList.json?.result ?? []).map(x => x.shortCode);
  check(['GP', 'NP', 'R'].every(c => shortCodes.includes(c)), 'farm has the default pond name prefixes', shortCodes);

  // ---- Hatchery short codes and certificates, buyer types (step B, conversions 11 and 12)
  const hatcheries = (await call('GET', app('Hatchery', 'GetAll'), o)).json?.result ?? [];
  console.log('       hatcheries: ' + hatcheries.map(h => `${h.shortCode}=${h.name} [${h.healthCertificateNo ?? 'no certificate'}]`).join(', '));
  check(hatcheries.length > 0 && hatcheries.every(h => /^[A-Z]{2,6}$/.test(h.shortCode ?? '')), 'every hatchery has a short code', hatcheries);
  check(hatcheries.some(h => h.healthCertificateNo), 'hatchery health certificate carried into the certificate history');
  const buyers = (await call('GET', app('Buyer', 'GetAll'), o)).json?.result ?? [];
  check(buyers.length > 0 && buyers.every(b => b.name && (b.buyerType === 1 || b.buyerType === 2)), 'every buyer has a name and a type', buyers);

  // ---- Production model (step C, conversions 1–3)
  const cyclesRes = (await call('GET', app('Cycle', 'GetAll'), o)).json?.result ?? [];
  console.log('       cycles: ' + cyclesRes.map(c => `${c.cycleCode}=${c.status === 2 ? 'Active' : 'Closed'} [${c.hatcheryBatchNumber}, ${c.plStocked}/${c.plReceived} PL]`).join(', '));
  check(cyclesRes.length > 0 && cyclesRes.every(c => c.fryDeliveryId && c.plReceived > 0 && (c.status === 2 || c.status === 4)), 'every cycle has a fry delivery and an Active or Closed status', cyclesRes);
  const deliveriesRes = await call('GET', app('FryDelivery', 'GetAll'), o);
  check(deliveriesRes.status === 200 && deliveriesRes.json.result.items.length >= Math.min(cyclesRes.length, 25), 'fry deliveries list (one page)', deliveriesRes.json?.error);
  const stockingOptions = await call('GET', app('Cycle', 'GetStockingOptions'), o);
  check(stockingOptions.status === 200, 'Create Batch stepper options load', stockingOptions.json?.error);
  const allBatches = (await call('GET', app('Batch', 'GetAll'), o)).json?.result ?? [];
  check(allBatches.every(b => b.letter && b.status >= 2), 'every batch has a letter and no Planned status', allBatches.filter(b => !b.letter || b.status < 2));
  const pondStatuses = (await call('GET', app('Pond', 'GetAll'), o)).json?.result ?? [];
  console.log('       pond status: ' + pondStatuses.map(p => `${p.pondCode}=${p.status}`).join(', '));

  const batches = await call('GET', app('Batch', 'GetAll'), o);
  const current = batches.json?.result?.find(b => b.batchCode === 'B-2026-02-P02');
  check(!!current, 'batch list includes the in-production batch', batches.json?.error);

  const reference = batches.json?.result?.find(b => b.batchCode === 'B-2026-01-P01');
  const refDetail = await call('GET', app('Batch', 'Get') + `?id=${reference?.id}`, o);
  check(refDetail.json?.result?.indicators?.finalFcr === 1.2, 'reference batch final FCR = 1.2', refDetail.json?.result?.indicators);
  check(refDetail.json?.result?.indicators?.survivalRatePct === 71.25, 'reference batch survival = 71.25 %');

  const lots = await call('GET', app('Inventory', 'GetLotOptions') + '?category=1', o);
  const feedLot = lots.json?.result?.[0];
  check(!!feedLot, 'feed lot options load', lots.json?.error);

  // ---- Operations (step D, conversions 4–6 and 10)
  const refSessions = (await call('GET', app('Feeding', 'GetList') + `?batchId=${reference?.id}`, o)).json?.result?.items ?? [];
  check(refSessions.length > 0 && refSessions.every(x => x.session === 1 || x.session === 2), 'converted feeding rounds appear as AM/PM sessions', refSessions.slice(0, 3));
  const oldFeedingLogs = (await call('GET', app('Log', 'GetList') + '?logType=3&maxResultCount=10', o)).json?.result?.items ?? [];
  check(oldFeedingLogs.length === 0, 'no feeding logs remain visible after conversion', oldFeedingLogs.length);
  const mortalityLogs = (await call('GET', app('Log', 'GetList') + '?logType=7&maxResultCount=100', o)).json?.result?.items ?? [];
  check(mortalityLogs.every(l => [1, 4, 7].includes(l.mortality?.cause) && (l.mortality.cause !== 1 || l.mortality.diseaseName) && (l.mortality.cause !== 7 || l.mortality.otherCause)),
    'mortality causes are Disease, Water quality or Others with their detail', mortalityLogs.filter(l => ![1, 4, 7].includes(l.mortality?.cause)).slice(0, 3));
  const feedLotDetail = (await call('GET', app('Inventory', 'GetMovements') + `?lotId=${feedLot?.lotId}`, o)).json?.result ?? [];
  check(feedLotDetail.filter(m => m.type === 2).every(m => m.feedingSessionId || m.sourceLogId), 'every usage movement has exactly one source', feedLotDetail.filter(m => m.type === 2 && !m.feedingSessionId && !m.sourceLogId).slice(0, 3));

  const sheet = await call('GET', app('Feeding', 'GetSheet') + `?cycleId=${current?.cycleId}&feedDate=${new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)}`, o);
  check(sheet.status === 200 && sheet.json.result.rows.some(r => r.batchId === current?.id), 'feeding sheet lists the cycle\'s open batches', sheet.json?.error);
  const requestId = crypto.randomUUID();
  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const feed = { batchId: current?.id, feedDate: today, session: 2, clientRequestId: requestId, lines: [{ lotId: feedLot?.lotId, kg: 12.5 }] };
  const saved = await call('POST', app('Feeding', 'Save'), { ...o, body: feed });
  check(saved.status === 200 && saved.json?.result?.session?.kg === 12.5, 'PM feeding session saves', saved.json?.error);
  const again = await call('POST', app('Feeding', 'Save'), { ...o, body: feed });
  check(again.json?.result?.wasDuplicate === true, 'retry with same ClientRequestId is not duplicated');
  const corrected = await call('POST', app('Feeding', 'Save'), { ...o, body: { ...feed, clientRequestId: crypto.randomUUID(), lines: [{ lotId: feedLot?.lotId, kg: 11 }] } });
  check(corrected.json?.result?.wasUpdate === true && corrected.json.result.session.kg === 11, 'saving PM again corrects the same session', corrected.json?.error);
  const voided = await call('POST', app('Feeding', 'Void'), { ...o, body: { id: saved.json?.result?.session?.id, reason: 'Smoke test' } });
  check(voided.status === 200, 'Owner voids a feeding session with a reason', voided.json?.error);

  // ---- v2.5 retrofit (DEC-49 to DEC-54)
  const notFed = await call('POST', app('Feeding', 'Save'), { ...o, body: { batchId: current?.id, feedDate: today, session: 2, clientRequestId: crypto.randomUUID(), status: 2, lines: [] } });
  check(notFed.status === 200 && notFed.json?.result?.session?.status === 2 && notFed.json.result.session.kg === 0, 'PM saved as Not fed with no stock drawn', notFed.json?.error);
  const notFedLines = await call('POST', app('Feeding', 'Save'), { ...o, body: { batchId: current?.id, feedDate: today, session: 2, clientRequestId: crypto.randomUUID(), status: 2, lines: [{ lotId: feedLot?.lotId, kg: 1 }] } });
  check(notFedLines.status !== 200, 'Not fed with feed lines is rejected');
  const status = await call('GET', app('Feeding', 'GetDailyStatus') + '?days=7', o);
  const statusRow = status.json?.result?.rows?.find(r => r.batchId === current?.id);
  check(status.status === 200 && statusRow?.days?.length === 7 && statusRow.days.at(-1).pm === 2, 'daily log status shows today\'s PM as Not fed', status.json?.error ?? statusRow?.days?.at(-1));
  await call('POST', app('Feeding', 'Void'), { ...o, body: { id: notFed.json?.result?.session?.id, reason: 'Smoke test' } });
  const farmSheet = await call('GET', app('Feeding', 'GetSheet') + `?feedDate=${today}`, o);
  check(farmSheet.status === 200 && farmSheet.json.result.cycleId === null && farmSheet.json.result.rows.some(r => r.batchId === current?.id), 'farm-wide feeding sheet without a cycle', farmSheet.json?.error);
  const closeCheck = await call('GET', app('Batch', 'GetCloseCheck') + `?id=${current?.id}`, o);
  check(closeCheck.status === 200 && typeof closeCheck.json.result.blankDaysTotal === 'number', 'close check lists blank daily records', closeCheck.json?.error);
  check(refDetail.json?.result?.farmingSystemAtStocking != null && refDetail.json.result.constructionTypeAtStocking != null && refDetail.json.result.densityFlag != null,
    'existing batches have farming-system, construction and density snapshots', { fs: refDetail.json?.result?.farmingSystemAtStocking, ct: refDetail.json?.result?.constructionTypeAtStocking, df: refDetail.json?.result?.densityFlag });
  // ---- v2.6 production changes (DEC-56 to DEC-68)
  const standards = await call('GET', app('FarmStandards', 'Get'), o);
  check(standards.status === 200 && standards.json.result.densityBands.length === 9 && standards.json.result.parameters.some(p => p.code === 'DO' && p.standardMin === 4),
    'Farm Standards show the 2025 water ranges and 9 density bands', standards.json?.error ?? standards.json?.result?.densityBands?.length);
  const stockOpts = await call('GET', app('Cycle', 'GetStockingOptions'), o);
  check(stockOpts.status === 200 && typeof stockOpts.json.result.stockingWindowDays === 'number', 'stocking options carry the stocking window', stockOpts.json?.error);
  check(refDetail.json?.result?.farmingSystemAtStocking <= 3 && refDetail.json?.result?.constructionTypeAtStocking <= 3, 'no batch keeps a removed farming system or construction type');
  const v26Ponds = (await call('GET', app('Pond', 'GetAll'), o)).json?.result ?? [];
  check(v26Ponds.every(p => p.constructionType >= 1 && p.constructionType <= 3 && p.farmingSystem >= 1 && p.farmingSystem <= 3), 'ponds use only the v2.6 farming systems and construction types');
  const lateFeed = await call('POST', app('Feeding', 'Save'), { ...o, body: { batchId: reference?.id, feedDate: today, session: 1, clientRequestId: crypto.randomUUID(), lines: [{ lotId: feedLot?.lotId, kg: 1 }] } });
  check(lateFeed.status !== 200 && /Total harvest/.test(lateFeed.json?.error?.message ?? ''), 'feeding dated after the Total harvest is rejected', lateFeed.json?.error);

  const supp = (await call('GET', app('Inventory', 'GetLotOptions') + '?category=2', o)).json?.result?.[0];
  if (supp) {
    const chem = await call('POST', app('Log', 'Create'), { ...o, body: { batchId: current?.id, logType: 6, observedAt: new Date(Date.now() - 90000).toISOString(), clientRequestId: crypto.randomUUID(), chemicalApplication: { reason: 'Smoke test', usages: [{ lotId: supp.lotId, quantity: 0.5 }] } } });
    check(chem.status === 200 && chem.json?.result?.log?.usages?.length === 1, 'chemical and supplement application deducts stock', chem.json?.error);
    const chemVoid = await call('POST', app('Log', 'Void'), { ...o, body: { id: chem.json?.result?.log?.id, reason: 'Smoke test' } });
    check(chemVoid.status === 200, 'Owner voids the application; stock is returned', chemVoid.json?.error);
  }

  const wq = await call('POST', app('Log', 'Create'), { ...o, body: { batchId: current?.id, logType: 4, observedAt: new Date(Date.now() - 30000).toISOString(), clientRequestId: crypto.randomUUID(), readings: [{ parameterCode: 'DO', value: 3.9 }, { parameterCode: 'PH', value: 8.3 }] } });
  check(wq.json?.result?.log?.hasOutOfRange === true && wq.json.result.warnings.length === 1, 'DO 3.9 flagged, pH 8.3 in range (PNS/BAFS 197:2025 defaults)', wq.json?.error);
  const bad = await call('POST', app('Log', 'Create'), { ...o, body: { batchId: current?.id, logType: 4, observedAt: new Date().toISOString(), clientRequestId: crypto.randomUUID(), readings: [{ parameterCode: 'PH', value: 15 }] } });
  check(bad.status >= 400, 'pH 15 rejected', bad.status);

  const perf = await call('GET', app('Report', 'GetCyclePerformance') + `?cycleId=${reference?.cycleId}`, o);
  check(perf.status === 200 && perf.json.result.batches.length >= 2, 'cycle performance report', perf.json?.error);
  const hs = await call('GET', app('Report', 'GetHarvestSummary') + '?From=2026-09-08&To=2026-09-08', o);
  check(hs.json?.result?.totalKg === 2500, 'harvest summary uses Asia/Manila day (8 Sep = 2,500 kg)', hs.json?.result?.totalKg);

  // ---- Harvest and sales (step E: grade lines, dispatch receipts, payments, overdue; finance removed)
  const salesAll = await call('GET', app('Sale', 'GetAll'), o);
  const saleRows = salesAll.json?.result?.items ?? [];
  console.log('       sales: ' + saleRows.map(x => `${x.dispatchReceiptNo} paid=${x.paid}/${x.total} due=${x.dueDate} overdue=${x.isOverdue}`).join('; '));
  const todayPh = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  check(saleRows.length > 0 && saleRows.every(x => !!x.dispatchReceiptNo && x.isOverdue === (!!x.dueDate && x.dueDate < todayPh && x.balance > 0)), 'every sale has a receipt number; Overdue = unpaid after the due date (DEC-67)', saleRows[0]);
  const overTop = await call('GET', app('Sale', 'GetAll') + '?MaxResultCount=101', o);
  check(overTop.status === 400, 'a page of more than 100 rows is refused (AC-27)', overTop.status);
  const pageOne = await call('GET', app('Sale', 'GetAll') + '?MaxResultCount=1&Sorting=total%20desc', o);
  check(pageOne.status === 200 && pageOne.json.result.items.length === 1 && pageOne.json.result.totalCount === saleRows.length && pageOne.json.result.totalAmount >= pageOne.json.result.items[0].total, 'sales page reports the total of every match', pageOne.json?.error);
  const overdueOnly = await call('GET', app('Sale', 'GetAll') + '?OverdueOnly=true', o);
  check(overdueOnly.json?.result?.items?.every(x => x.isOverdue), 'Overdue filter', overdueOnly.json?.error);
  const sellable = (await call('GET', app('Sale', 'GetSellableLines'), o)).json?.result ?? [];
  const buyer = (await call('GET', app('Buyer', 'GetLookup'), o)).json?.result?.find(b => b.isActive);
  const gl = sellable.find(l => l.unsoldKg >= 2);
  if (gl && buyer) {
    const sale = await call('POST', app('Sale', 'Create'), { ...o, body: { buyerId: buyer.id, saleDate: new Date().toISOString().slice(0, 10), lines: [{ harvestGradeLineId: gl.harvestGradeLineId, kg: 2, buyerAcceptedKg: 1.9, pricePerKg: 300 }], initialPayment: { paidOn: new Date().toISOString().slice(0, 10), amount: 100, method: 'cash' } } });
    const sr = sale.json?.result;
    check(sale.status === 200 && /^DR-\d{4}-\d{4}$/.test(sr?.dispatchReceiptNo ?? '') && sr.total === 570 && sr.paid === 100, 'sale on a grade line gets a DR number; amount uses buyer kg', sale.json?.error ?? sr);
    const tooMuch = await call('POST', app('Sale', 'Create'), { ...o, body: { buyerId: buyer.id, saleDate: new Date().toISOString().slice(0, 10), lines: [{ harvestGradeLineId: gl.harvestGradeLineId, kg: gl.unsoldKg + 1, pricePerKg: 300 }] } });
    check(tooMuch.status >= 400, 'selling more than the unsold kg is rejected', tooMuch.status);
    const pay = await call('POST', app('Sale', 'AddPayment'), { ...o, body: { saleId: sr?.id, paidOn: new Date().toISOString().slice(0, 10), amount: 470 } });
    check(pay.json?.result?.paymentStatus === 3, 'second payment settles the sale', pay.json?.error ?? pay.json?.result?.paymentStatus);
    const voided = await call('POST', app('Sale', 'Void'), { ...o, body: { id: sr?.id, reason: 'Smoke test' } });
    check(voided.status === 200, 'Owner voids the smoke-test sale', voided.json?.error);
  } else {
    check(false, 'a sellable grade line and an active buyer exist', { sellable: sellable.length, buyer: !!buyer });
  }
  const oldFinance = await call('GET', app('Transaction', 'GetAll'), o);
  check(oldFinance.status === 404, 'income and expense records removed', oldFinance.status);

  // ---- Compliance records (D-30: reference numbers and dates; no files, no approval)
  const cats = await call('GET', app('Compliance', 'GetCategories'), o);
  const fish = cats.json?.result?.find(c => c.name === 'Fisheries (BFAR)');
  const bfar = fish?.presets?.find(p => p.name === 'BFAR Fishpond / Aquafarm Registration');
  const refNo = 'BFAR-SMOKE-' + Date.now().toString().slice(-6);
  const rec = { categoryId: fish?.id, presetId: bfar?.id, documentNumber: refNo, issueDate: '2026-01-01', expiryDate: '2027-01-01', isPerpetual: false, notes: 'Smoke test' };
  const savedDoc = await call('POST', app('Compliance', 'CreateDocument'), { ...o, body: rec });
  const docId = savedDoc.json?.result;
  check(savedDoc.status === 200 && !!docId, 'compliance record saved from a preset', savedDoc.json?.error);
  const dup = await call('POST', app('Compliance', 'CreateDocument'), { ...o, body: rec });
  check(dup.status >= 400, 'duplicate reference number rejected', dup.status);
  const perpetual = await call('POST', app('Compliance', 'CreateDocument'), { ...o, body: { ...rec, documentNumber: refNo + '-P', isPerpetual: true, expiryDate: null } });
  check(perpetual.status >= 400, 'perpetual refused where the category requires an expiry date', perpetual.status);
  const oldUpload = await call('POST', '/api/compliance-documents/upload', { ...o, form: new FormData() });
  check(oldUpload.status === 404 || oldUpload.status === 405, 'file upload endpoint removed', oldUpload.status);

  // ---- Farm isolation
  const owner2 = await login('test-farm-b', 'owner');
  const o2 = { token: owner2.token, tenantId: owner2.tenantId };
  const other = await call('GET', app('Batch', 'Get') + `?id=${reference?.id}`, o2);
  check(other.status >= 400 && !JSON.stringify(other.json).includes('B-2026-01-P01'), 'second farm cannot read the pilot batch', other.status);
  const doc2 = await call('GET', app('Compliance', 'GetDocument') + `?id=${docId}`, o2);
  check(doc2.status >= 400 && !JSON.stringify(doc2.json).includes(refNo), 'second farm cannot read the pilot compliance record', doc2.status);

  // ---- Technician limits
  // The seeded Technician must be active for these checks; reactivate it if an earlier session left it switched off.
  const farmUsers = (await call('GET', app('FarmUser', 'GetAll'), o)).json?.result ?? [];
  const seededTech = farmUsers.find(u => u.userName === 'tech');
  if (seededTech) {
    await call('POST', app('FarmUser', 'SetActive'), { ...o, body: { id: seededTech.id, isActive: true } });
  }
  const tech = await login('pilot-farm', 'tech');
  check(!!tech.token, 'seeded technician signs in (needed for the limits below)', tech.json);
  const t = { token: tech.token, tenantId: tech.tenantId };
  const techSales = await call('GET', app('Sale', 'GetAll'), t);
  check(techSales.status === 403, 'technician denied sales', techSales.status);

  // ---- Forced password change for a new account
  const uname = 'smoke' + Date.now().toString().slice(-6);
  const created = await call('POST', app('FarmUser', 'Create'), { ...o, body: { name: 'Smoke', surname: 'Tech', userName: uname, emailAddress: `${uname}@example.test`, roleName: 'FarmTechnician', temporaryPassword: 'Temp1234x' } });
  check(created.status === 200, 'owner creates technician', created.json?.error);
  const first = await login('pilot-farm', uname, 'Temp1234x');
  check(first.mustChange === true, 'new account must change password');
  const blocked = await call('GET', app('Pond', 'GetAll'), { token: first.token, tenantId: first.tenantId });
  check(blocked.status === 403, 'temporary-password token is limited to changing the password', blocked.status);
  const changed = await call('POST', app('Profile', 'ChangeMyPassword'), { token: first.token, tenantId: first.tenantId, body: { currentPassword: 'Temp1234x', newPassword: 'Changed123x' } });
  check(changed.status === 200, 'password changed', changed.json?.error);
  const second = await login('pilot-farm', uname, 'Changed123x');
  const ponds = await call('GET', app('Pond', 'GetAll'), { token: second.token, tenantId: second.tenantId });
  check(second.mustChange === false && ponds.status === 200, 'signs in normally after change');

  // ---- System Administrator
  let admin = await login(null, 'admin');
  if (!admin.token) admin = await login(null, 'admin', '123qwe'); // databases created by the original template
  check(!!admin.token, 'System Administrator signs in (host)', admin.json);
  const a = { token: admin.token };
  const farms = await call('GET', app('SystemFarm', 'GetFarms'), a);
  check(farms.status === 200 && farms.json.result.length >= 2, 'system farm list', farms.json?.error);
  const adminPonds = await call('GET', app('Pond', 'GetAll'), a);
  check(adminPonds.status === 403, 'System Administrator denied farm production data', adminPonds.status);
  const attempts = await call('GET', app('SecurityLog', 'GetLoginAttempts'), a);
  check(attempts.status === 200 && attempts.json.result.items.length > 0, 'security log shows sign-in attempts');
  if (failures) console.log(JSON.stringify(attempts.json?.result?.items?.slice(0, 4)));

  // ---- Exports (step F, Owner only, audit-logged)
  const exp = await call('POST', app('Export', 'ExportList'), { ...o, body: { list: 'Sales' } });
  const expBytes = exp.json?.result?.contentBase64 ? Buffer.from(exp.json.result.contentBase64, 'base64') : Buffer.alloc(0);
  check(exp.status === 200 && expBytes.length > 3 && expBytes[0] === 0xEF && expBytes[1] === 0xBB && expBytes[2] === 0xBF, 'sales CSV export starts with a UTF-8 byte-order mark', exp.json?.error);
  check(/_Sales_\d{8}-\d{4}\.csv$/.test(exp.json?.result?.fileName ?? ''), 'export file name follows the pattern', exp.json?.result?.fileName);
  const expTech = await call('POST', app('Export', 'ExportList'), { ...t, body: { list: 'Sales' } });
  check(expTech.status === 403, 'Technician cannot export', expTech.status);

  // ---- Health page (System Administrator only; AC-26)
  const healthPage = await call('GET', app('SystemHealth', 'GetHealth'), a);
  check(healthPage.status === 200 && typeof healthPage.json.result.appVersion === 'string' && Array.isArray(healthPage.json.result.alerts), 'system health page loads for the System Administrator', healthPage.json?.error);
  const healthOwner = await call('GET', app('SystemHealth', 'GetHealth'), o);
  check(healthOwner.status === 403, 'Owner cannot open the system health page', healthOwner.status);
  const banner = await call('GET', app('HealthBanner', 'Get'), o);
  check(banner.status === 200 && typeof banner.json?.result?.needsAttention === 'boolean', 'Owner health banner answers', banner.json?.error);

  // ---- Tampered / missing token
  const tampered = await call('GET', app('Pond', 'GetAll'), { token: (owner.token ?? 'x.y.z').slice(0, -4) + 'abcd', tenantId: owner.tenantId });
  check(tampered.status === 401, 'tampered JWT rejected', tampered.status);
  const anon = await call('GET', app('Pond', 'GetAll'), { tenantId: owner.tenantId });
  check(anon.status === 401, 'missing JWT rejected', anon.status);

  console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
