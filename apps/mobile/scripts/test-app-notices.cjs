const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { prepareAppAlert, presentNotice } = require('../src/ui/appNoticeModel.cjs');
const { describeHoursError } = require('../src/utils/hoursNotice.cjs');

const SRC = path.join(__dirname, '..', 'src');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function alertTitles(source) {
  const titles = [];
  const re = /appAlert\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match = re.exec(source);
  while (match) {
    titles.push(match[2].replace(/\\n/g, '\n').replace(/\\'/g, "'"));
    match = re.exec(source);
  }
  return titles;
}

function show(notice) {
  const shown = presentNotice(notice);
  assert.ok(shown.title.trim(), 'la alerta necesita título');
  assert.ok(shown.primaryLabel.trim(), 'la alerta necesita botón principal');
  assert.ok(Array.isArray(shown.points));
  return shown;
}

test('cada appAlert del proyecto se puede mostrar', () => {
  const titles = [];
  for (const file of walk(SRC)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const title of alertTitles(source)) {
      titles.push({ file: path.relative(SRC, file), title });
    }
  }
  assert.ok(titles.length >= 40, `se esperaban las alertas de la app, se hallaron ${titles.length}`);
  for (const { file, title } of titles) {
    const notice = prepareAppAlert(title, 'Detalle de prueba.');
    assert.ok(notice, `${file}: "${title}" quedó oculta con los avisos activos`);
    const shown = show(notice);
    assert.equal(shown.title, title);
    assert.equal(shown.primaryLabel, 'Entendido');
    assert.equal(shown.secondaryLabel, undefined);
  }
});

test('confirmaciones de dos botones ejecutan solo el botón pulsado', () => {
  const cases = [
    {
      title: 'Eliminar estudiante',
      message: 'Se eliminará a Ana.\n\nEsto borra su cuenta.\n\nEsta acción no se puede deshacer.',
      buttons: [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive' },
      ],
    },
    {
      title: 'Solicitar datos',
      message: 'Se enviará una notificación.',
      buttons: [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar' },
      ],
    },
    {
      title: 'Permiso de notificaciones',
      message: 'El celular bloqueó los avisos.',
      buttons: [
        { text: 'Ahora no', style: 'cancel' },
        { text: 'Abrir Ajustes' },
      ],
    },
    {
      title: 'Confirmar',
      message: '¿Eliminar docente?',
      buttons: [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive' },
      ],
    },
  ];

  for (const item of cases) {
    let primary = 0;
    let secondary = 0;
    const buttons = item.buttons.map((button) => ({
      ...button,
      onPress: () => {
        if (button.style === 'cancel') secondary += 1;
        else primary += 1;
      },
    }));
    const notice = prepareAppAlert(item.title, item.message, buttons);
    const shown = show(notice);
    assert.equal(shown.kind, 'confirm', item.title);
    assert.equal(shown.primaryLabel, item.buttons[1].text);
    assert.equal(shown.secondaryLabel, item.buttons[0].text);
    if (item.message.includes('\n')) assert.ok(shown.points.length >= 1, item.title);
    shown.onPrimary();
    assert.equal(primary, 1);
    assert.equal(secondary, 0);
    shown.onSecondary();
    assert.equal(primary, 1);
    assert.equal(secondary, 1);
  }
});

test('errores y confirmaciones siguen saliendo si se apagan los avisos informativos', () => {
  const off = { notificationsEnabled: false };
  assert.equal(prepareAppAlert('Clase creada', 'Lista.', undefined, off), null);
  assert.equal(prepareAppAlert('Al día', 'Todo completo.', undefined, off), null);
  assert.ok(prepareAppAlert('Error', 'Falló la red.', undefined, off));
  assert.ok(prepareAppAlert('No se pudo enviar', 'Intenta de nuevo.', undefined, off));
  assert.ok(prepareAppAlert('URL inválida', 'Revisa el enlace.', undefined, off));
  const confirm = prepareAppAlert('Eliminar estudiante', '¿Seguro?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Eliminar', style: 'destructive' },
  ], off);
  assert.equal(confirm.primaryLabel, 'Eliminar');
  assert.equal(confirm.destructive, true);
});

test('avisos de horario cubren los códigos del servidor', () => {
  const offday = show({
    ...describeHoursError({ error: 'NotScheduledToday', today: 'MONDAY' }),
    kicker: 'Aviso de horario',
    primaryLabel: 'Entendido',
  });
  assert.equal(offday.kind, 'offday');
  assert.equal(offday.kicker, 'Aviso de horario');
  assert.equal(offday.title, 'Hoy no hay esta clase');
  assert.match(offday.subtitle, /lunes/);
  assert.equal(offday.points.length, 3);
  assert.equal(offday.primaryLabel, 'Entendido');

  const early = describeHoursError({ error: 'TooEarlyForPhoto', scheduledTime: '07:00' });
  assert.equal(early.kind, 'early');
  assert.match(early.subtitle, /07:00/);
  assert.equal(describeHoursError({ error: 'TooEarlyForQR' }).kind, 'early');

  const late = describeHoursError({ error: 'TooLateForQR' });
  assert.equal(late.kind, 'late');
  assert.equal(late.title, 'Fuera del horario de clase');
  assert.equal(describeHoursError({ error: 'OutsideSchedule', message: 'Ya cerró.' }).subtitle, 'Ya cerró.');

  const noDay = describeHoursError({ error: 'NotScheduledToday' });
  assert.match(noDay.subtitle, /no está en el horario/);
  assert.equal(describeHoursError({ error: 'Otro' }), null);
  assert.equal(describeHoursError(null), null);
});

test('cerrar por fuera usa cancelar cuando existe y el botón principal cuando no', () => {
  const alone = show(prepareAppAlert('Sesión inválida', 'Vuelve a entrar.'));
  assert.equal(alone.secondaryLabel, undefined);

  const choice = show(prepareAppAlert('Solicitar datos', 'Se enviará una notificación.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Enviar' },
  ]));
  const outside = choice.secondaryLabel ? 'secondary' : 'primary';
  assert.equal(outside, 'secondary');
  const outsideAlone = alone.secondaryLabel ? 'secondary' : 'primary';
  assert.equal(outsideAlone, 'primary');
});

test('el aviso se monta en un Modal, por encima de la pantalla', () => {
  const host = fs.readFileSync(path.join(SRC, 'ui', 'appNotice.js'), 'utf8');
  assert.match(host, /<Modal/);
  assert.match(host, /visible=\{!!shown\}/);
  assert.doesNotMatch(host, /pointerEvents="box-none"/);
});
