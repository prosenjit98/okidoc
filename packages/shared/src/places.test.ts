import { describe, expect, it } from 'vitest';
import { AREA_CSV_TEMPLATE, areaKey, matchIndianState, parseCsv, parseYesNo, readAreasCsv, tidyPlace } from './places';

describe('places', () => {
  it('tidies place names but keeps deliberate mixed case', () => {
    expect(tidyPlace('  lake   town ')).toBe('Lake Town');
    expect(tidyPlace('LAKE TOWN')).toBe('Lake Town');
    expect(tidyPlace('SALT LAKE (SECTOR-1)')).toBe('Salt Lake (Sector-1)');
    expect(tidyPlace('McLeod Ganj')).toBe('McLeod Ganj');
  });

  it('matches states written loosely', () => {
    expect(matchIndianState('west bengal')).toBe('West Bengal');
    expect(matchIndianState('WEST  BENGAL')).toBe('West Bengal');
    expect(matchIndianState('Jammu & Kashmir')).toBe('Jammu and Kashmir');
    expect(matchIndianState('Orissa')).toBe('Odisha');
    expect(matchIndianState('Madras')).toBeNull();
  });

  it('parses quoted CSV fields, CRLF and a BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n"multi\nline",z')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['multi\nline', 'z'],
    ]);
  });

  it('reads the template with loose headers and flags repeated rows', () => {
    const t = readAreasCsv(AREA_CSV_TEMPLATE);
    expect(t.error).toBeUndefined();
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0]).toMatchObject({ line: 2, area: 'Lake Town', pin: '700089', district: 'Kolkata', state: 'West Bengal', area_bn: 'লেক টাউন', active: 'yes' });
    expect(t.rows[1].lat).toBeUndefined();

    const r = readAreasCsv('Office Name,Pincode,District Name,State Name,Extra\nLake Town,700089,Kolkata,West Bengal,x\n\nlake  town,700089,KOLKATA,west bengal,y\n');
    expect(r.rows.map((x) => x.line)).toEqual([2, 4]);
    expect(r.duplicates).toEqual({ 4: 2 });
  });

  it('reports missing columns and empty files', () => {
    expect(readAreasCsv('area,pin\nX,700001').error).toMatch(/Missing columns: district, state/);
    expect(readAreasCsv('\n\n').error).toBe('The file is empty.');
  });

  it('builds area identity keys and reads yes/no', () => {
    expect(areaKey('west bengal', ' kolkata', '700089', 'LAKE TOWN')).toBe(areaKey('West Bengal', 'Kolkata', '700089', 'Lake Town'));
    expect([parseYesNo('Yes'), parseYesNo('0'), parseYesNo(''), parseYesNo('maybe')]).toEqual([true, false, undefined, undefined]);
  });
});
