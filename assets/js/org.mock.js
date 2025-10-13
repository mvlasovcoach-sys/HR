/* eslint-disable no-console */
/**
 * Lightweight helper to rewrite the anonymised corporate fixtures.
 * Run with `node assets/js/org.mock.js` to refresh JSON files after editing the
 * objects below or importing data from another source.
 */
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'data', 'org');

const TEAMS = [
  {id: 'ops', name: 'Operations'},
  {id: 'cs', name: 'Customer Service'},
  {id: 'it', name: 'IT'},
  {id: 'lab', name: 'Lab'}
];

function writeJson(fileName, data){
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`wrote ${filePath}`);
}

function main(){
  writeJson('teams.json', {org: 'SPA2099 Demo Co.', depts: TEAMS});

  writeJson('metrics_7d.json', require(path.join(__dirname, '..', '..', 'data', 'org', 'metrics_7d.json')));
  writeJson('metrics_month.json', require(path.join(__dirname, '..', '..', 'data', 'org', 'metrics_month.json')));
  writeJson('metrics_year.json', require(path.join(__dirname, '..', '..', 'data', 'org', 'metrics_year.json')));
  writeJson('events.json', require(path.join(__dirname, '..', '..', 'data', 'org', 'events.json')));
}

if (require.main === module) {
  main();
}

module.exports = {main};
