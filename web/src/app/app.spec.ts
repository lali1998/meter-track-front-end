import {monthLabel, money, shiftMonth} from './core';
describe('Magyar megjelenítés',()=>{
 it('a hiány és a mért nulla különbözik',()=>{expect(money(null)).toBe('—');expect(money(0)).toBe('0 Ft');});
 it('évet vált és magyar hónapot ad',()=>{expect(shiftMonth('2023-01',-1)).toBe('2022-12');expect(monthLabel('2022-09')).toContain('szeptember');});
});

