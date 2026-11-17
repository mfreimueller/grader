// Calls every bridge method once and probes the sandbox, then prints a JSON report into #report.
// tests/e2e/plugins.test.ts reads the report; nothing here runs in production.
(async () => {
  const report = {};
  const step = async (name, fn) => {
    try {
      report[name] = await fn();
    } catch (error) {
      report[name] = { threw: String((error && error.message) || error) };
    }
  };
  const grader = window.grader;

  report.globals = {
    grader: typeof grader,
    grdr: typeof window.grdr,
    require: typeof window.require,
    process: typeof window.process,
    ipcRenderer: typeof window.ipcRenderer,
  };

  await step('context', () => grader.context());
  const context = report.context && report.context.ok ? report.context.value : null;
  const student = context && context.students[0];
  const mitarbeit = context && context.categories.find((c) => c.isMitarbeit);

  await step('kvMissing', () => grader.storage.get('counts'));
  await step('kvSet', () => grader.storage.set('counts', { [student ? student.id : 'x']: 2 }));
  await step('kvGet', () => grader.storage.get('counts'));
  await step('kvGlobalSet', () => grader.storage.global.set('counts', 'global'));
  await step('kvGlobalGet', () => grader.storage.global.get('counts'));
  await step('kvKeys', () => grader.storage.keys());
  await step('kvBadKey', () => grader.storage.set('not a key', 1));
  await step('kvUndefined', () => grader.storage.set('u', undefined));
  await step('kvDelete', () => grader.storage.delete('counts'));
  await step('kvAfterDelete', () => grader.storage.get('counts'));

  if (student && mitarbeit) {
    await step('createToday', () =>
      grader.assessment.createImpromptu({ studentId: student.id, categoryId: mitarbeit.id, symbol: 'PLUS' }),
    );
    await step('createPast', () =>
      grader.assessment.createImpromptu({
        studentId: student.id,
        categoryId: mitarbeit.id,
        symbol: 'MINUS',
        session: { kind: 'date', date: '2020-01-02' },
      }),
    );
    await step('createFuture', () =>
      grader.assessment.createImpromptu({
        studentId: student.id,
        categoryId: mitarbeit.id,
        symbol: 'PLUS',
        session: { kind: 'date', date: '2999-01-01' },
      }),
    );
    await step('createForeignStudent', () =>
      grader.assessment.createImpromptu({ studentId: 'someone-else', categoryId: mitarbeit.id, symbol: 'PLUS' }),
    );
    await step('createSmuggled', () =>
      grader.assessment.createImpromptu({
        studentId: student.id,
        categoryId: mitarbeit.id,
        symbol: 'WELLE',
        courseId: 'another-course',
        pluginId: 'at.example.other',
      }),
    );
    if (report.createPast && report.createPast.ok) {
      await step('deletePast', () => grader.assessment.deleteImpromptu(report.createPast.value.assessmentId));
    }
  }
  await step('deleteForeign', () => grader.assessment.deleteImpromptu('not-mine'));
  await step('listAssessments', () => grader.assessment.list());

  await step('secretsMissing', () => grader.secrets.get('token'));
  await step('secretsSet', () => grader.secrets.set('token', 'ghp_e2e_secret'));
  await step('secretsGet', () => grader.secrets.get('token'));
  await step('secretsBadKey', () => grader.secrets.set('not a key', 'x'));
  await step('secretsBadValue', () => grader.secrets.set('token2', 42));
  await step('secretsDelete', () => grader.secrets.delete('token'));
  await step('secretsAfterDelete', () => grader.secrets.get('token'));

  // The policy this page was served with: connect-src names exactly the granted origin.
  await step('csp', async () => (await fetch('/index.html')).headers.get('content-security-policy'));

  // What a plugin must not be able to do.
  await step('fetchWeb', async () => (await fetch('https://example.com/')).status);
  await step('fetchWebPost', async () =>
    (await fetch('https://example.com/', { method: 'POST', headers: { Authorization: 'Bearer x' }, body: '{}' })).status,
  );
  await step('fetchOtherPlugin', async () => (await fetch('grdr-plugin://at.example.other/index.html')).status);
  await step('fetchOwnManifest', async () => (await fetch('/plugin.json')).status);
  await step('fetchTraversal', async () => (await fetch('/..%2F..%2Fsettings.json')).status);
  await step('fetchFile', async () => (await fetch('file:///etc/hosts')).status);

  document.getElementById('report').textContent = JSON.stringify(report);
  document.body.dataset.done = 'true';
})();
