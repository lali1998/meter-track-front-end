import {allocate,meterBill} from '../../shared/billing';
const people=[{id:1,weight:1},{id:2,weight:1}];
describe('Elszámolás',()=>{
 test('víz',()=>expect(meterBill('483','493',[{price:'752',limit:null}],'billed').items[0].amount).toBe(7520));
 test('villany sávok',()=>expect(meterBill('20200','20783',[{price:'36',limit:'210'},{price:'70',limit:null}],'billed').items.map(i=>i.amount)).toEqual([7560,26110]));
 test('T1',()=>{expect(meterBill('9650','10067',[{price:'23,54',limit:null}],'billed').items[0].amount).toBe(9816);expect(meterBill('9650','10067',[],'info').items).toEqual([]);});
 test('lakók és internet',()=>{expect(allocate(177014,people,{mode:'equal'})).toEqual({1:88507,2:88507});expect(allocate(4400,people,{mode:'exclusive',resident:1})).toEqual({1:4400,2:0});});
 test('jóváírás és maradék',()=>expect(allocate(-5,people,{mode:'percent',values:{1:50,2:50}})).toEqual({1:-3,2:-2}));
 test('érvénytelen értékek',()=>{expect(()=>meterBill('5','3',[],'info')).toThrow();expect(()=>allocate(15,people,{mode:'fixed',values:{1:14}})).toThrow();});
});

