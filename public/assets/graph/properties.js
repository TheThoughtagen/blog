// Display values are invented from public demo identities. Never read source
// property bags, record IDs, timestamps, or endpoints into this panel.
import { demoSeed as seed, signalProfile, signalSample, DEMO_SNAPSHOT_TIME } from './signals.js';
const pick = (node, values) => values[seed(node) % values.length];
const number = value => value.toLocaleString('en');
const code = (node, prefix) => `${prefix}-${node.label.match(/\d+$/)?.[0].padStart(3, '0') || '001'}`;
const volume = node => 8000 + seed(node) % 17 * 500;
const revision = node => pick(node, ['A', 'B', 'C']);
const amperage = node => pick(node, [16, 20, 32, 63]);

export function nodeProperties(node, index) {
  const related = (record, type, direction = 'out') => {
    if (!record) return [];
    return (index.relationships.get(record.id) || [])
      .filter(edge => edge.type === type && (direction === 'out' ? edge.source : edge.target) === record.id)
      .map(edge => index.nodes.get(direction === 'out' ? edge.target : edge.source))
      .filter(Boolean).sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }));
  };
  const links = (type, direction) => related(node, type, direction);
  const labels = records => records.map(record => record.label).join(', ') || 'Not linked';
  const linked = (type, direction) => labels(links(type, direction));
  const quantity = amount => `${number(amount)} L`;
  const batchVolume = schedule => volume(related(schedule, 'mes:EXECUTES_BATCH')[0] || schedule);
  const equipment = type => ['Equipment', linked(type)];
  const review = ['Review status', 'Approved'];

  switch (node.type) {
    case 'Cell': return [
      ['Area code', code(node, 'AREA')], ['Class', 'Process area'],
      ['Equipment units', number(links('CONTAINS').length)], ['Model status', 'Reviewed'],
    ];
    case 'Unit': return [
      ['Equipment code', code(node, 'EQ')],
      ['Class', pick(node, ['Process vessel', 'Transfer skid', 'Processing unit'])],
      ['Design capacity', quantity(volume(node) + 12000)], ['Lifecycle', 'In service'],
      ['Historian signals', number(links('MAPS_TO', 'in').length)],
      ['Scheduled runs', number(links('mes:SCHEDULED_ON', 'in').length)],
      ['Maintenance plans', number(links('cmms:MAINTAINS', 'in').filter(record => record.type === 'cmms:MaintenancePlan').length)],
    ];
    case 'Tag': {
      const profile = signalProfile(node);
      const value = signalSample(node, DEMO_SNAPSHOT_TIME).value;
      return [['Signal code', code(node, 'SIG')], ['Measurement', profile.measurement],
        ['Snapshot value', `${value} ${profile.unit}`], ['Engineering range', `${profile.min}–${profile.max} ${profile.unit}`],
        ['Quality', 'Good'], equipment('MAPS_TO')];
    }
    case 'PnIDDocument':
    case 'DrawingDocument': return [
      ['Document code', code(node, 'DWG')], ['Revision', revision(node)],
      ['Discipline', node.type === 'PnIDDocument' ? 'Process engineering' : pick(node, ['Mechanical', 'Electrical', 'Controls'])],
      ['Document type', node.type === 'PnIDDocument' ? 'P&ID' : 'Engineering drawing'], review,
    ];
    case 'ModelBuild': return [
      ['Build code', code(node, 'MODEL')], ['Version', `1.${seed(node) % 8}.0`],
      ['Format', '3D scene'], ['Build status', 'Validated'],
    ];
    case 'mes:ProductionOrder': return [
      ['Order number', code(node, 'PO')], ['Status', 'Complete'],
      ['Planned quantity', quantity(links('mes:HAS_SCHEDULE_ORDER').reduce((sum, schedule) => sum + batchVolume(schedule), 0))],
      ['Scheduled runs', number(links('mes:HAS_SCHEDULE_ORDER').length)], ['Master recipe', linked('mes:USES_RECIPE')],
    ];
    case 'mes:ScheduleOrder': return [
      ['Schedule number', code(node, 'SO')], ['Status', 'Complete'],
      ['Batch quantity', quantity(batchVolume(node))], equipment('mes:SCHEDULED_ON'),
      ['Batch', linked('mes:EXECUTES_BATCH')], ['Execution recipe', linked('mes:USES_RECIPE')],
      ['Input lots', number(links('mes:CONSUMED_LOT').length)], ['Output lot', linked('mes:PRODUCED_LOT')],
    ];
    case 'isa88:MasterRecipe': return [
      ['Recipe code', code(node, 'RCP')], ['Version', `1.${seed(node) % 4}`],
      ['Release status', 'Approved'], ['Procedure', linked('isa88:HAS_PROCEDURE')],
      ['Executions', number(links('isa88:DERIVED_FROM', 'in').length)],
    ];
    case 'isa88:ControlRecipe': {
      const master = links('isa88:DERIVED_FROM')[0];
      return [['Recipe code', code(node, 'EXE')], ['Version', `1.${seed(master || node) % 4}`],
        ['Master recipe', labels(master ? [master] : [])], ['Procedure', linked('isa88:HAS_PROCEDURE')], ['Release status', 'Approved']];
    }
    case 'isa88:Procedure': return [
      ['Procedure code', code(node, 'PROC')], ['Revision', revision(node)],
      ['Recipe', linked('isa88:HAS_PROCEDURE', 'in')], ['Review status', 'Approved'],
    ];
    case 'isa88:Batch': return [
      ['Batch number', code(node, 'BATCH')], ['Status', 'Complete'], ['Batch quantity', quantity(volume(node))],
      equipment('isa88:USES_UNIT'), ['Execution recipe', linked('isa88:EXECUTES_RECIPE')],
      ['Input lots', number(links('isa88:CONSUMED_LOT').length)], ['Output lot', linked('isa88:PRODUCED_LOT')],
    ];
    case 'isa95:MaterialLot': {
      const producer = links('isa88:PRODUCED_LOT', 'in')[0];
      return [['Lot number', code(node, 'LOT')], ['Material', linked('isa95:DEFINED_BY')],
        ['Quantity', quantity(producer ? volume(producer) : 50000)], ['Quality release', 'Released'],
        ['Produced by', producer?.label || 'Demo receiving'], ['Downstream batches', number(links('isa88:CONSUMED_LOT', 'in').length)]];
    }
    case 'isa95:MaterialDefinition': return [
      ['Material code', code(node, 'MAT')], ['Class', 'Process material'],
      ['Base unit', 'L'], ['Tracked lots', number(links('isa95:DEFINED_BY', 'in').length)], ['Specification', 'Approved'],
    ];
    case 'cmms:WorkOrder': return [
      ['Work order', code(node, 'WO')], ['Status', pick(node, ['Planned', 'In progress', 'Complete'])],
      ['Priority', pick(node, ['P1 · High', 'P2 · Normal', 'P3 · Low'])],
      ['Work type', 'Preventive maintenance'], equipment('cmms:MAINTAINS'), ['Maintenance plan', linked('cmms:GENERATED_FROM')],
    ];
    case 'cmms:MaintenancePlan': return [
      ['Plan code', code(node, 'PM')], ['Strategy', 'Time based'],
      ['Interval', `${pick(node, [30, 60, 90])} days`], equipment('cmms:MAINTAINS'),
      ['Work orders', number(links('cmms:GENERATED_FROM', 'in').length)], ['Plan status', 'Active'],
    ];
    case 'electrical:Panel': return [
      ['Panel code', code(node, 'PNL')], ['Nominal voltage', '480 V AC'], ['Phases', '3'],
      ['Enclosure', pick(node, ['IP54', 'IP65'])], ['Circuits', number(links('electrical:HAS_CIRCUIT').length)],
    ];
    case 'electrical:Circuit': return [
      ['Circuit code', code(node, 'CKT')], ['Design voltage', '480 V AC'], ['Rated current', `${amperage(node)} A`],
      ['Panel', linked('electrical:HAS_CIRCUIT', 'in')], equipment('electrical:SERVES'),
      ['Wire connections', number(links('electrical:IN_CIRCUIT', 'in').length)],
    ];
    case 'electrical:Terminal': return [
      ['Terminal code', code(node, 'TERM')], ['Owner', linked('electrical:TERMINAL_OF')],
      ['Nominal voltage', '480 V AC'], ['Connection type', 'Screw clamp'],
    ];
    case 'electrical:WireConnection': {
      const circuit = links('electrical:IN_CIRCUIT')[0];
      const gauge = { 16: '2.5', 20: '4', 32: '6', 63: '16' }[amperage(circuit || node)];
      return [['Wire code', code(node, 'WIRE')], ['Conductor', `Copper · ${gauge} mm²`],
        ['Circuit', labels(circuit ? [circuit] : [])], ['Endpoint A', linked('electrical:ENDPOINT_A')],
        ['Endpoint B', linked('electrical:ENDPOINT_B')], ['Drawing revision', revision(circuit || node)], review];
    }
    case 'process:Port': return [
      ['Port code', code(node, 'PORT')], equipment('process:PORT_OF'),
      ['Nominal diameter', 'DN 50'], ['Connection', 'Flanged'], ['Service', 'Process liquid'],
    ];
    case 'process:Connection': return [
      ['Line code', code(node, 'LINE')], ['Medium', 'Process liquid'], ['Nominal diameter', 'DN 50'],
      ['Pipe material', '316L stainless steel'], ['Flow direction', 'A → B'],
      ['Endpoint A', linked('process:ENDPOINT_A')], ['Endpoint B', linked('process:ENDPOINT_B')],
      ['Via equipment', linked('process:VIA')], ['Drawing revision', revision(node)], review,
    ];
    default: return [];
  }
}
